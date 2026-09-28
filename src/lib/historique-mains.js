// Parseur des historiques de mains Betclic (format texte exporté par le client).

export const RUES = ["preflop", "flop", "turn", "river"];

const REGEX_SECTION =
  /^\*\*\* (HEADER|PLAYERS|HOLE CARDS|PRE-FLOP|FLOP|TURN|RIVER|SHOWDOWN|SUMMARY) \*\*\*(?: \[([^\]]+)\])?$/;
const REGEX_SIEGE = /^Seat (\d+): (.+?) \((\d+)\)(?: \[([^\]]*)\])?$/;
const REGEX_ACTION =
  /^(\d\d:\d\d:\d\d) - (.+?): (Posts SB|Posts BB|Folds|Checks|Calls|Bets|Raises to|Disconnected|Reconnected|Sits in|Sits out)(?: (\d+))?( and is all-in)?$/;
const REGEX_CARTES = /^(.+?): \[([^\]]+)\]$/;
const REGEX_SHOWDOWN = /^(.+?) shows \[([^\]]+)\] \(([^)]+)\)/;
const REGEX_GAIN = /^(.+?) wins .*pot of (\d+)$/;
const REGEX_PLACE = /^(.+?) finished (\d+)\w{2}(?: and wins ([\d.,]+) EUR)?$/;

const VERBES = {
  "Posts SB": "post_sb",
  "Posts BB": "post_bb",
  Folds: "fold",
  Checks: "check",
  Calls: "call",
  Bets: "bet",
  "Raises to": "raise",
};

function nombreDepuisTexte(texte) {
  const m = /([\d]+(?:[.,]\d+)?)/.exec(texte || "");
  return m ? parseFloat(m[1].replace(",", ".")) : null;
}

function dateDepuisTexte(texte) {
  const m = /(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})/.exec(texte || "");
  return m ? Date.parse(`${m[1]}T${m[2]}Z`) : null;
}

/** Parse le bloc texte d'une main. Lève une erreur si la main est illisible. */
export function parseMain(bloc) {
  const lignes = bloc.split(/\r?\n/).map((l) => l.trim());
  const entete = {};
  const main = {
    id: null,
    partieId: null,
    date: null,
    nomJeu: null,
    buyIn: null,
    multiplicateur: null,
    prizePool: null,
    blinds: null,
    potTotal: null,
    rake: 0,
    joueurs: [],
    hero: null,
    cartes: {},
    combinaisons: {},
    board: [],
    actions: [],
    gains: {},
    places: {},
    prixEuro: {},
  };
  let section = null;
  let rue = null;
  let resumeVu = false;

  for (const ligne of lignes) {
    if (ligne === "") continue;
    const sec = REGEX_SECTION.exec(ligne);
    if (sec) {
      section = sec[1];
      if (section === "SUMMARY") resumeVu = true;
      if (section === "PRE-FLOP") rue = "preflop";
      else if (section === "FLOP") rue = "flop";
      else if (section === "TURN") rue = "turn";
      else if (section === "RIVER") rue = "river";
      if (sec[2]) main.board = sec[2].split(" ");
      continue;
    }
    if (section === "HEADER") {
      const i = ligne.indexOf(": ");
      if (i > 0) entete[ligne.slice(0, i)] = ligne.slice(i + 2);
      continue;
    }
    if (section === "PLAYERS") {
      const m = REGEX_SIEGE.exec(ligne);
      if (m) {
        const tags = m[4] ? m[4].split(" ").filter(Boolean) : [];
        const joueur = { siege: Number(m[1]), nom: m[2], stack: Number(m[3]), tags };
        main.joueurs.push(joueur);
        if (tags.includes("Hero")) main.hero = joueur.nom;
      }
      continue;
    }
    if (section === "HOLE CARDS") {
      const m = REGEX_CARTES.exec(ligne);
      if (m) main.cartes[m[1]] = m[2].split(" ");
      continue;
    }
    if (section === "SHOWDOWN") {
      const m = REGEX_SHOWDOWN.exec(ligne);
      if (m) {
        main.cartes[m[1]] = main.cartes[m[1]] || m[2].split(" ");
        main.combinaisons[m[1]] = m[3];
      }
      continue;
    }
    if (section === "SUMMARY") {
      let m = REGEX_GAIN.exec(ligne);
      if (m) {
        main.gains[m[1]] = (main.gains[m[1]] || 0) + Number(m[2]);
        continue;
      }
      m = REGEX_PLACE.exec(ligne);
      if (m) {
        main.places[m[1]] = Number(m[2]);
        if (m[3]) main.prixEuro[m[1]] = parseFloat(m[3].replace(",", "."));
      }
      continue;
    }
    if (rue) {
      const m = REGEX_ACTION.exec(ligne);
      if (m) {
        const verbe = VERBES[m[3]];
        if (!verbe) continue; // Disconnected, Sits out…
        main.actions.push({
          rue,
          joueur: m[2],
          verbe,
          montant: m[4] !== undefined ? Number(m[4]) : null,
          allin: !!m[5],
        });
      } else if (/^\d\d:\d\d:\d\d - /.test(ligne)) {
        throw new Error(`Action non reconnue : "${ligne}"`);
      }
      continue;
    }
  }

  main.id = entete["Hand ID"] || null;
  main.partieId = entete["Game ID"] || null;
  main.modeJeu = entete["Game Mode"] || null;
  main.date = dateDepuisTexte(entete["Date & Time"]);
  main.nomJeu = entete["Game Name"] || null;
  main.buyIn = nombreDepuisTexte(entete["Buy In"]);
  main.prizePool = nombreDepuisTexte(entete["Prize pool"]);
  const mult = /x\s*([\d.,]+)/.exec(entete.Multiplier || "");
  main.multiplicateur = mult ? parseFloat(mult[1].replace(",", ".")) : null;
  const blinds = /(\d+)\s*\/\s*(\d+)/.exec(entete.Blinds || "");
  main.blinds = blinds ? [Number(blinds[1]), Number(blinds[2])] : null;
  main.potTotal = entete["Total Pot"] !== undefined ? Number(entete["Total Pot"]) : null;
  main.rake = entete.Rake !== undefined ? Number(entete.Rake) : 0;

  if (!main.id) throw new Error("Hand ID manquant");
  if (!main.blinds) throw new Error(`Blinds illisibles (main ${main.id})`);
  if (main.joueurs.length === 0) throw new Error(`Aucun joueur (main ${main.id})`);
  if (!resumeVu) throw new Error(`Main tronquée avant *** SUMMARY *** (main ${main.id})`);
  return main;
}

/** Empreinte stable du contenu d'un fichier (double FNV-1a + longueur). */
export function empreinteFichier(texte) {
  let h1 = 2166136261;
  let h2 = 40389867;
  for (let i = 0; i < texte.length; i++) {
    const c = texte.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ c, 16777619);
  }
  return `${(h1 >>> 0).toString(16)}-${(h2 >>> 0).toString(16)}-${texte.length}`;
}

/** Parse un fichier complet (mains séparées par une ligne de tirets). */
export function parseFichier(texte) {
  const mains = [];
  const erreurs = [];
  for (const bloc of texte.split(/\r?\n-{4,}\r?\n/)) {
    if (!bloc.includes("*** HEADER ***")) continue;
    try {
      mains.push(parseMain(bloc));
    } catch (erreur) {
      erreurs.push(erreur.message);
    }
  }
  return { mains, erreurs };
}

/** Montant engagé par joueur sur une rue (une relance remplace, une mise s'ajoute). */
export function misesParRue(main, rue) {
  const mises = {};
  for (const action of main.actions) {
    if (action.rue !== rue) continue;
    if (["post_sb", "post_bb", "call", "bet"].includes(action.verbe))
      mises[action.joueur] = (mises[action.joueur] || 0) + action.montant;
    else if (action.verbe === "raise") mises[action.joueur] = action.montant;
  }
  return mises;
}

/**
 * Mises de chaque joueur sur toute la main : brutes, plafonnées à la
 * deuxième plus grosse mise de la rue (l'excédent non suivi est rendu),
 * et la part rendue. `rendusDejaInclus` indique si les gains de l'historique
 * comptent déjà cet excédent.
 */
export function misesDetaillees(main) {
  const bruts = {};
  const plafonnes = {};
  const rendus = {};
  for (const rue of RUES) {
    const mises = misesParRue(main, rue);
    const tri = Object.values(mises).sort((a, b) => b - a);
    const seconde = tri.length > 1 ? tri[1] : 0;
    for (const [joueur, montant] of Object.entries(mises)) {
      bruts[joueur] = (bruts[joueur] || 0) + montant;
      const plafonne = montant === tri[0] ? Math.min(montant, seconde) : montant;
      plafonnes[joueur] = (plafonnes[joueur] || 0) + plafonne;
      rendus[joueur] = (rendus[joueur] || 0) + (montant - plafonne);
    }
  }
  const totalGains = Object.values(main.gains).reduce((s, g) => s + g, 0);
  const totalPlafonne = Object.values(plafonnes).reduce((s, m) => s + m, 0);
  return { bruts, plafonnes, rendus, rendusDejaInclus: totalGains !== totalPlafonne };
}

/** Résultat net d'un joueur sur la main, en jetons. */
export function resultatJoueur(main, joueur) {
  const { bruts, rendus, rendusDejaInclus } = misesDetaillees(main);
  const rendu = rendusDejaInclus ? 0 : rendus[joueur] || 0;
  return (main.gains[joueur] || 0) + rendu - (bruts[joueur] || 0);
}
