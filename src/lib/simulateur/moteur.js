// Moteur d'une table de Spin & Rush (3 joueurs, hyper-turbo, le vainqueur prend tout).
// Machine à états pure : aucune horloge ici, le temps est passé en paramètre.
import { paquetComplet, nomMain } from "../cartes.js";
import { evaluer, codeCarte } from "../equite.js";

export const RUES = ["preflop", "flop", "turn", "river"];
export const STRUCTURE_DEFAUT = [
  [10, 20],
  [15, 30],
  [25, 50],
  [40, 80],
  [60, 120],
  [100, 200],
  [150, 300],
  [250, 500],
  [400, 800],
  [600, 1200],
  [1000, 2000],
];
export const STACK_DEPART = 500;
/** Multiplicateurs du prix et leur fréquence approximative. */
export const MULTIPLICATEURS = [
  [2, 0.75],
  [3, 0.15],
  [5, 0.07],
  [10, 0.025],
  [25, 0.004],
  [100, 0.001],
];

export function tirerMultiplicateur(alea = Math.random) {
  let r = alea();
  for (const [m, p] of MULTIPLICATEURS) {
    if (r < p) return m;
    r -= p;
  }
  return 2;
}

function melanger(paquet, alea) {
  for (let i = paquet.length - 1; i > 0; i--) {
    const j = Math.floor(alea() * (i + 1));
    [paquet[i], paquet[j]] = [paquet[j], paquet[i]];
  }
  return paquet;
}

const code = (c) => codeCarte(c.rang + c.couleur);

/**
 * Crée une table. joueurs : [{ id, nom, hero?, bot? }] (3). alea : () → [0,1).
 */
export function creerTable({ id, buyIn = 0.2, joueurs, stackDepart = STACK_DEPART, structure = STRUCTURE_DEFAUT, dureeNiveauMs = 3 * 60_000, maintenant = 0, alea = Math.random, multiplicateur = null }) {
  const multi = multiplicateur ?? tirerMultiplicateur(alea);
  return {
    id,
    buyIn,
    multiplicateur: multi,
    prix: Math.round(buyIn * multi * 100) / 100,
    structure,
    dureeNiveauMs,
    debut: maintenant,
    joueurs: joueurs.map((j, i) => ({ id: j.id, nom: j.nom, hero: !!j.hero, bot: !j.hero, siege: i, stack: stackDepart, elimine: false, place: null })),
    bouton: Math.floor(alea() * joueurs.length),
    numeroMain: 0,
    main: null,
    termine: false,
    vainqueur: null,
    alea,
  };
}

export function niveauCourant(table, maintenant) {
  const index = Math.min(table.structure.length - 1, Math.floor(Math.max(0, maintenant - table.debut) / table.dureeNiveauMs));
  const [sb, bb] = table.structure[index];
  const finNiveau = table.debut + (index + 1) * table.dureeNiveauMs;
  return { index, sb, bb, finNiveau, restantMs: Math.max(0, finNiveau - maintenant) };
}

const actifs = (table) => table.joueurs.filter((j) => !j.elimine);
const parId = (table, id) => table.joueurs.find((j) => j.id === id);

function siegeSuivantActif(table, siege) {
  const n = table.joueurs.length;
  for (let k = 1; k <= n; k++) {
    const j = table.joueurs[(siege + k) % n];
    if (!j.elimine) return j.siege;
  }
  return siege;
}

/** Joueurs encore dans le coup (pas couchés). */
export const dansLeCoup = (main, table) => actifs(table).filter((j) => !main.couches.has(j.id));
/** Joueurs qui peuvent encore agir (dans le coup, pas à tapis). */
const peuventAgir = (main, table) => dansLeCoup(main, table).filter((j) => !main.allin.has(j.id));

function engager(table, main, joueur, montant) {
  const reel = Math.min(montant, joueur.stack);
  joueur.stack -= reel;
  main.mises[joueur.id] = (main.mises[joueur.id] || 0) + reel;
  main.totalEngage[joueur.id] = (main.totalEngage[joueur.id] || 0) + reel;
  main.pot += reel;
  if (joueur.stack === 0) main.allin.add(joueur.id);
  return reel;
}

/** Démarre une nouvelle main. Renvoie false si la table est terminée. */
export function demarrerMain(table, maintenant) {
  if (table.termine) return false;
  const vivants = actifs(table);
  if (vivants.length < 2) return false;
  const niveau = niveauCourant(table, maintenant);
  table.numeroMain += 1;
  // bouton : au joueur actif suivant (première main : tirage dans creerTable)
  if (table.numeroMain > 1) table.bouton = siegeSuivantActif(table, table.bouton);
  else if (table.joueurs[table.bouton].elimine) table.bouton = siegeSuivantActif(table, table.bouton);
  const bouton = table.joueurs[table.bouton];
  const headsUp = vivants.length === 2;
  const sb = headsUp ? bouton : table.joueurs[siegeSuivantActif(table, table.bouton)];
  const bb = table.joueurs[siegeSuivantActif(table, sb.siege)];
  const paquet = melanger(paquetComplet(), table.alea);
  const main = {
    numero: table.numeroMain,
    niveau: niveau.index,
    sb: niveau.sb,
    bb: niveau.bb,
    headsUp,
    bouton: bouton.id,
    petiteBlind: sb.id,
    grosseBlind: bb.id,
    stacksDebut: Object.fromEntries(vivants.map((j) => [j.id, j.stack])),
    paquet,
    cartes: {},
    board: [],
    rue: "preflop",
    pot: 0,
    mises: {},
    totalEngage: {},
    couches: new Set(),
    allin: new Set(),
    aAgi: new Set(),
    miseCourante: 0,
    derniereRelance: niveau.bb,
    dernierAgresseur: null,
    aParler: null,
    actions: [],
    resultat: null,
    revelees: {},
  };
  table.main = main;
  for (const j of vivants) main.cartes[j.id] = [paquet.pop(), paquet.pop()];
  const miseSb = engager(table, main, sb, niveau.sb);
  main.actions.push({ joueur: sb.id, verbe: "post_sb", montant: miseSb, rue: "preflop", allin: main.allin.has(sb.id) });
  const miseBb = engager(table, main, bb, niveau.bb);
  main.actions.push({ joueur: bb.id, verbe: "post_bb", montant: miseBb, rue: "preflop", allin: main.allin.has(bb.id) });
  main.miseCourante = Math.max(miseSb, miseBb, niveau.bb);
  main.dernierAgresseur = bb.id;
  // premier à parler pré-flop : le bouton (3 joueurs) ou la SB (heads-up, = bouton)
  main.aParler = headsUp ? sb.id : bouton.id;
  verifierSuite(table);
  return true;
}

/** Actions possibles pour le joueur à qui c'est le tour. */
export function actionsLegales(table) {
  const main = table.main;
  if (!main || !main.aParler || main.rue === "fin") return null;
  const j = parId(table, main.aParler);
  const mise = main.mises[j.id] || 0;
  const aPayer = Math.max(0, main.miseCourante - mise);
  const peutCheck = aPayer === 0;
  const montantCall = Math.min(aPayer, j.stack);
  const relanceMin = Math.min(j.stack + mise, main.miseCourante + main.derniereRelance);
  const relanceMax = j.stack + mise;
  // relancer n'a de sens que si quelqu'un peut encore suivre
  const adversairesPouvantSuivre = peuventAgir(main, table).filter((a) => a.id !== j.id).length;
  const peutRelancer = relanceMax > main.miseCourante && adversairesPouvantSuivre > 0;
  return {
    joueur: j.id,
    peutCheck,
    montantCall,
    callAllin: aPayer >= j.stack,
    peutRelancer,
    relanceMin,
    relanceMax,
    miseCourante: main.miseCourante,
    pot: main.pot,
    stack: j.stack,
    bb: main.bb,
  };
}

/**
 * Le joueur `id` joue. action : { verbe: "fold"|"check"|"call"|"raise"|"allin", montant? }
 * (montant = mise totale visée sur la rue pour raise). Renvoie l'action normalisée.
 */
export function jouer(table, id, action) {
  const main = table.main;
  if (!main || main.aParler !== id) throw new Error("ce n'est pas à ce joueur de parler");
  const legal = actionsLegales(table);
  const j = parId(table, id);
  let verbe = action.verbe;
  let montant = 0;
  let allin = false;
  if (verbe === "allin") {
    verbe = legal.peutRelancer ? "raise" : legal.peutCheck && j.stack === 0 ? "check" : "call";
    action = { verbe, montant: legal.relanceMax };
  }
  if (verbe === "fold") {
    if (legal.peutCheck) verbe = "check"; // se coucher sans mise à payer n'a pas de sens
    else main.couches.add(id);
  }
  if (verbe === "check") {
    if (!legal.peutCheck) throw new Error("check impossible, il y a une mise à payer");
  } else if (verbe === "call") {
    montant = engager(table, main, j, legal.montantCall);
    allin = main.allin.has(id);
  } else if (verbe === "raise") {
    if (!legal.peutRelancer) throw new Error("relance impossible");
    let cible = Math.round(action.montant ?? legal.relanceMin);
    cible = Math.max(legal.relanceMin, Math.min(legal.relanceMax, cible));
    const mise = main.mises[id] || 0;
    const increment = cible - main.miseCourante;
    montant = engager(table, main, j, cible - mise);
    allin = main.allin.has(id);
    const relanceComplete = increment >= main.derniereRelance;
    if (relanceComplete) main.derniereRelance = increment;
    main.miseCourante = cible;
    main.dernierAgresseur = id;
    // une relance complète rouvre la parole aux autres
    if (relanceComplete) main.aAgi = new Set();
  }
  main.aAgi.add(id);
  const enregistree = { joueur: id, verbe, montant, rue: main.rue, allin };
  main.actions.push(enregistree);
  avancer(table, id);
  return enregistree;
}

/** Passe la parole au suivant, ou change de rue, ou termine la main. */
function avancer(table, dernier) {
  const main = table.main;
  const encore = dansLeCoup(main, table);
  if (encore.length === 1) return terminerMain(table);
  const agissants = peuventAgir(main, table);
  const tourFini = agissants.every((j) => main.aAgi.has(j.id) && (main.mises[j.id] || 0) === main.miseCourante);
  if (!tourFini) {
    // prochain joueur pouvant agir après `dernier`
    const siege = parId(table, dernier).siege;
    const n = table.joueurs.length;
    for (let k = 1; k <= n; k++) {
      const cand = table.joueurs[(siege + k) % n];
      if (!cand.elimine && !main.couches.has(cand.id) && !main.allin.has(cand.id)) {
        main.aParler = cand.id;
        return;
      }
    }
  }
  // tour terminé
  if (agissants.length <= 1) return abattreJusquAuBout(table);
  rueSuivante(table);
}

/** Si plus personne ne peut agir (tapis), on distribue le reste du board et on abat. */
function abattreJusquAuBout(table) {
  const main = table.main;
  main.aParler = null;
  while (main.board.length < 5) main.board.push(main.paquet.pop());
  main.rue = "river";
  terminerMain(table);
}

function rueSuivante(table) {
  const main = table.main;
  const index = RUES.indexOf(main.rue);
  if (index === RUES.length - 1) return terminerMain(table);
  main.rue = RUES[index + 1];
  if (main.rue === "flop") main.board.push(main.paquet.pop(), main.paquet.pop(), main.paquet.pop());
  else main.board.push(main.paquet.pop());
  main.mises = {};
  main.miseCourante = 0;
  main.derniereRelance = main.bb;
  main.aAgi = new Set();
  // premier à parler post-flop : premier joueur actif à gauche du bouton (en HU, la BB)
  const siegeBouton = parId(table, main.bouton).siege;
  const n = table.joueurs.length;
  main.aParler = null;
  for (let k = 1; k <= n; k++) {
    const cand = table.joueurs[(siegeBouton + k) % n];
    if (!cand.elimine && !main.couches.has(cand.id) && !main.allin.has(cand.id)) {
      main.aParler = cand.id;
      break;
    }
  }
  if (!main.aParler) abattreJusquAuBout(table);
}

/** Après une mise non suivie : la surenchère revient au joueur, les pots sont construits par paliers. */
function construirePots(table, main) {
  const encore = dansLeCoup(main, table).map((j) => j.id);
  const engages = Object.entries(main.totalEngage).filter(([, v]) => v > 0);
  const paliers = [...new Set(engages.map(([, v]) => v))].sort((a, b) => a - b);
  const pots = [];
  let precedent = 0;
  for (const palier of paliers) {
    let montant = 0;
    for (const [, v] of engages) montant += Math.max(0, Math.min(v, palier) - precedent);
    const eligibles = encore.filter((id) => (main.totalEngage[id] || 0) >= palier);
    if (montant > 0) pots.push({ montant, eligibles });
    precedent = palier;
  }
  return pots;
}

function terminerMain(table) {
  const main = table.main;
  main.aParler = null;
  const encore = dansLeCoup(main, table);
  const pots = construirePots(table, main);
  const forces = {};
  const abattage = encore.length > 1;
  if (abattage) {
    const board = main.board.map(code);
    for (const j of encore) {
      forces[j.id] = evaluer([...main.cartes[j.id].map(code), ...board]);
      main.revelees[j.id] = main.cartes[j.id];
    }
  }
  const gains = {};
  const detail = [];
  for (const pot of pots) {
    let gagnants = pot.eligibles;
    if (gagnants.length === 0) gagnants = encore.map((j) => j.id); // sécurité
    if (abattage && gagnants.length > 1) {
      const meilleure = Math.max(...gagnants.map((id) => forces[id]));
      gagnants = gagnants.filter((id) => forces[id] === meilleure);
    }
    const part = Math.floor(pot.montant / gagnants.length);
    let reste = pot.montant - part * gagnants.length;
    // l'ordre de distribution du reste : à partir de la gauche du bouton
    const ordre = [...gagnants].sort((a, b) => ordreDepuisBouton(table, a) - ordreDepuisBouton(table, b));
    for (const id of ordre) {
      const bonus = reste > 0 ? 1 : 0;
      reste -= bonus;
      gains[id] = (gains[id] || 0) + part + bonus;
    }
    const rendu = pot.eligibles.length === 1 && gagnants.length === 1 && pots.length > 1 && pot === pots[pots.length - 1];
    detail.push({ montant: pot.montant, gagnants, rendu });
  }
  for (const [id, g] of Object.entries(gains)) parId(table, id).stack += g;
  main.resultat = { pots: detail, gains, abattage, forces };
  main.rue = "fin";
  // éliminations : place = nombre de joueurs encore en vie avant élimination
  const vivantsAvant = actifs(table).length;
  const elimines = actifs(table).filter((j) => j.stack === 0);
  // en cas d'éliminations simultanées, le plus gros stack de départ de la main est mieux classé
  elimines.sort((a, b) => (main.stacksDebut[a.id] || 0) - (main.stacksDebut[b.id] || 0));
  let place = vivantsAvant;
  for (const j of elimines) {
    j.elimine = true;
    j.place = place;
    place -= 1;
  }
  const restants = actifs(table);
  if (restants.length === 1) {
    restants[0].place = 1;
    table.termine = true;
    table.vainqueur = restants[0].id;
  }
}

function ordreDepuisBouton(table, id) {
  const siegeBouton = parId(table, table.main.bouton).siege;
  const n = table.joueurs.length;
  return (parId(table, id).siege - siegeBouton + n) % n || n;
}

/** Position d'un joueur sur la main en cours : "BTN" | "SB" | "BB" (en HU le bouton est la SB). */
export function positionDe(main, id) {
  if (main.headsUp) return id === main.petiteBlind ? "SB" : "BB";
  if (id === main.bouton) return "BTN";
  if (id === main.petiteBlind) return "SB";
  return "BB";
}

/** Nom canonique des cartes d'un joueur ("AKs"). */
export function nomMainDe(main, id) {
  const c = main.cartes[id];
  return c ? nomMain(c[0], c[1]) : null;
}

/** Profondeur effective (bb) d'un joueur au début de la main : HU min des deux ; 3-way min(lui, plus gros adversaire). */
export function profondeurEffectiveDe(main, id) {
  const stacks = main.stacksDebut;
  const autres = Object.entries(stacks).filter(([k]) => k !== id).map(([, v]) => v);
  if (!autres.length) return null;
  const reference = autres.length === 1 ? autres[0] : Math.max(...autres);
  return Math.min(stacks[id], reference) / main.bb;
}

/** Actions pré-flop hors blinds. */
export const actionsPreflop = (main) => main.actions.filter((a) => a.rue === "preflop" && a.verbe !== "post_sb" && a.verbe !== "post_bb");

/** Vérifie après la pose des blinds si tout le monde est déjà à tapis. */
function verifierSuite(table) {
  const main = table.main;
  if (peuventAgir(main, table).length <= 1 && main.allin.size >= 1) {
    // ex. : les deux blinds à tapis ; le bouton éventuel peut encore parler
    if (peuventAgir(main, table).length === 0) abattreJusquAuBout(table);
  }
}

/** Montant total engagé par un joueur sur la main (pour l'affichage). */
export const engageTotal = (main, id) => main.totalEngage[id] || 0;
