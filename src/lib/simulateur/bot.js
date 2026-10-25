// Adversaires automatiques : pré-flop sur les mêmes ranges que le joueur quand le spot est
// couvert (avec un peu de bruit), sinon force de main (formule de Chen) et profondeur ;
// post-flop sur la force de la main faite et les tirages. Volontairement simple et lisible.
import { actionsLegales, positionDe, nomMainDe, profondeurEffectiveDe, actionsPreflop, dansLeCoup } from "./moteur.js";
import { trouverChart, actionAttendue, actionsDe } from "../charts.js";
import { evaluer, codeCarte } from "../equite.js";
import { indexRang } from "../cartes.js";

const code = (c) => codeCarte(c.rang + c.couleur);
const P15_5 = 15 ** 5;
const P15_4 = 15 ** 4;

/** Force pré-flop 0..1 (formule de Chen normalisée sur 20). */
export function forcePreflop(c1, c2) {
  const valeur = (r) => ({ A: 10, K: 8, Q: 7, J: 6, T: 5 })[r] ?? Number(r) / 2;
  const i1 = indexRang(c1.rang);
  const i2 = indexRang(c2.rang);
  const [h, b] = i1 <= i2 ? [c1, c2] : [c2, c1];
  let score = valeur(h.rang);
  if (h.rang === b.rang) score = Math.max(5, score * 2);
  else {
    if (h.couleur === b.couleur) score += 2;
    const ecart = indexRang(b.rang) - indexRang(h.rang) - 1;
    score -= [0, 1, 2, 4][ecart] ?? 5;
    if (ecart <= 1 && indexRang(h.rang) > indexRang("Q")) score += 1;
  }
  return Math.max(0, Math.min(1, score / 20));
}

/** Spot pré-flop couvert par un tableau pour le joueur `id`, ou null. */
export function spotCouvert(table, id, charts) {
  const main = table.main;
  if (!main || main.rue !== "preflop") return null;
  if (main.actions.some((a) => (a.verbe === "post_sb" || a.verbe === "post_bb") && a.allin)) return null;
  const avant = actionsPreflop(main).filter((a) => a.joueur !== id);
  const position = positionDe(main, id);
  let familleId = null;
  if (main.headsUp && position === "SB" && avant.length === 0) familleId = "HU_SB";
  else if (main.headsUp && position === "BB" && avant.length === 1 && avant[0].verbe === "call") familleId = "HU_BB";
  else if (!main.headsUp && position === "BTN" && avant.length === 0) familleId = "3W_BTN";
  if (!familleId) return null;
  const profondeur = profondeurEffectiveDe(main, id);
  if (profondeur === null) return null;
  const chart = trouverChart(charts, familleId, profondeur);
  if (!chart) return null;
  const nom = nomMainDe(main, id);
  return { familleId, chart, nom, profondeur, attendu: actionAttendue(chart, nom) };
}

/** Traduit une action de tableau (allin / call / raise / fold) en action moteur légale. */
export function actionDepuisTableau(attendu, legal, alea = Math.random) {
  const options = actionsDe(attendu);
  const choix = options.length > 1 ? options[alea() < 0.6 ? 0 : 1] : options[0];
  if (choix === "allin") return legal.peutRelancer ? { verbe: "allin" } : { verbe: legal.peutCheck ? "check" : "call" };
  if (choix === "raise") {
    if (!legal.peutRelancer) return { verbe: legal.peutCheck ? "check" : "call" };
    const cible = Math.round(legal.bb * 2.5);
    if (cible >= legal.relanceMax * 0.45) return { verbe: "allin" };
    return { verbe: "raise", montant: Math.max(legal.relanceMin, cible) };
  }
  if (choix === "call") return { verbe: legal.peutCheck ? "check" : "call" };
  return { verbe: legal.peutCheck ? "check" : "fold" };
}

function decisionPreflopLibre(table, id, legal, alea) {
  const main = table.main;
  const [c1, c2] = main.cartes[id];
  const f = forcePreflop(c1, c2);
  const profondeur = profondeurEffectiveDe(main, id) ?? 25;
  const aPayer = legal.montantCall;
  const facePartiel = legal.miseCourante > main.bb; // quelqu'un a relancé
  if (!facePartiel) {
    // pot non ouvert (SB ou BB à 3 joueurs après fold du bouton, option de la BB…)
    if (legal.peutCheck) return f >= 0.6 && legal.peutRelancer && alea() < 0.7 ? { verbe: "raise", montant: Math.round(main.bb * 2.5) } : { verbe: "check" };
    if (profondeur <= 10) return f >= 0.33 ? { verbe: "allin" } : { verbe: "fold" };
    if (f >= 0.45) return legal.peutRelancer ? { verbe: "raise", montant: Math.round(main.bb * 2.5) } : { verbe: "call" };
    if (f >= 0.28) return { verbe: "call" };
    return { verbe: "fold" };
  }
  const tapisEnFace = legal.callAllin || aPayer >= legal.stack * 0.6 || legal.miseCourante >= legal.stack * 0.6;
  const cote = aPayer / (legal.pot + aPayer);
  if (tapisEnFace) {
    const seuil = profondeur <= 8 ? 0.34 : cote < 0.3 ? 0.42 : 0.5;
    return f >= seuil ? { verbe: "call" } : { verbe: "fold" };
  }
  if (f >= 0.62) return profondeur <= 15 || !legal.peutRelancer ? { verbe: "allin" } : { verbe: "raise", montant: Math.round(legal.miseCourante * 3) };
  if (f >= 0.4 || (cote < 0.25 && f >= 0.3)) return { verbe: "call" };
  if (profondeur <= 12 && alea() < 0.08) return { verbe: "allin" };
  return { verbe: "fold" };
}

/** Catégorie de main faite (0 hauteur … 8 quinte flush) et rang de la paire éventuelle. */
export function lireMain(cartes, board) {
  const score = evaluer([...cartes.map(code), ...board.map(code)]);
  const categorie = Math.floor(score / P15_5);
  const premier = Math.floor(score / P15_4) % 15;
  return { score, categorie, premier };
}

/** Tirages : couleur (4 cartes d'une couleur) et quinte (4 rangs dans une fenêtre de 5). */
export function tirages(cartes, board) {
  const toutes = [...cartes, ...board];
  const parCouleur = {};
  for (const c of toutes) parCouleur[c.couleur] = (parCouleur[c.couleur] || 0) + 1;
  const couleur = Object.values(parCouleur).some((n) => n === 4) && board.length < 5;
  const rangs = new Set(toutes.map((c) => 14 - indexRang(c.rang)));
  if (rangs.has(14)) rangs.add(1);
  let quinte = false;
  for (let bas = 1; bas <= 10 && !quinte; bas++) {
    let n = 0;
    for (let r = bas; r < bas + 5; r++) if (rangs.has(r)) n += 1;
    if (n === 4 && board.length < 5) quinte = true;
  }
  return { couleur, quinte };
}

function decisionPostflop(table, id, legal, alea) {
  const main = table.main;
  const cartes = main.cartes[id];
  const { categorie, premier } = lireMain(cartes, main.board);
  const rangsBoard = main.board.map((c) => 14 - indexRang(c.rang));
  const hautBoard = Math.max(...rangsBoard);
  const paireDeMain = cartes[0].rang === cartes[1].rang;
  const rangPaireMain = 14 - indexRang(cartes[0].rang);
  // niveaux : 0 rien, 1 paire faible, 2 top paire / surpaire, 3 deux paires et mieux
  let niveau = 0;
  if (categorie >= 2) niveau = 3;
  else if (categorie === 1) {
    const paireSurBoard = rangsBoard.filter((r) => r === premier).length >= 2;
    if (paireSurBoard) niveau = 0.5; // paire du board, rien de plus
    else if (premier >= hautBoard || (paireDeMain && rangPaireMain > hautBoard)) niveau = 2;
    else niveau = 1;
  }
  const t = tirages(cartes, main.board);
  const tirage = t.couleur || t.quinte;
  const agresseur = main.dernierAgresseur === id;
  const adversaires = dansLeCoup(main, table).length - 1;
  const pot = legal.pot;
  const miser = (fraction) => {
    const cible = Math.round(legal.miseCourante + pot * fraction);
    if (!legal.peutRelancer) return { verbe: legal.peutCheck ? "check" : "call" };
    if (cible >= legal.relanceMax * 0.6) return { verbe: "allin" };
    return { verbe: "raise", montant: Math.max(legal.relanceMin, Math.min(legal.relanceMax, cible)) };
  };
  if (legal.peutCheck) {
    if (niveau >= 3) return alea() < 0.85 ? miser(0.66) : { verbe: "check" };
    if (niveau === 2) return alea() < 0.75 ? miser(0.6) : { verbe: "check" };
    if (tirage) return alea() < 0.45 ? miser(0.5) : { verbe: "check" };
    if (niveau === 1) return alea() < 0.35 ? miser(0.4) : { verbe: "check" };
    if (agresseur && adversaires === 1 && alea() < 0.55) return miser(0.5); // c-bet
    return alea() < 0.1 ? miser(0.5) : { verbe: "check" };
  }
  const aPayer = legal.montantCall;
  const cote = aPayer / (pot + aPayer);
  const gros = aPayer >= legal.stack * 0.6 || legal.callAllin;
  if (niveau >= 3) return alea() < 0.6 && legal.peutRelancer ? miser(1) : { verbe: "call" };
  if (niveau === 2) {
    if (gros) return cote < 0.45 || categorie >= 1 ? { verbe: "call" } : { verbe: "fold" };
    return alea() < 0.2 && legal.peutRelancer ? miser(0.8) : { verbe: "call" };
  }
  if (tirage) {
    const bonTirage = t.couleur && t.quinte;
    if (cote < (bonTirage ? 0.45 : 0.33)) return { verbe: "call" };
    return alea() < 0.08 && legal.peutRelancer && !gros ? miser(1) : { verbe: "fold" };
  }
  if (niveau === 1) return cote < 0.28 && !gros ? { verbe: "call" } : { verbe: "fold" };
  if (niveau === 0.5) return cote < 0.2 && !gros ? { verbe: "call" } : { verbe: "fold" };
  return alea() < 0.06 && legal.peutRelancer && !gros ? miser(1) : { verbe: "fold" };
}

/** Décision d'un adversaire automatique ; renvoie toujours une action légale. */
export function deciderBot(table, id, charts, alea = Math.random) {
  const legal = actionsLegales(table);
  if (!legal || legal.joueur !== id) return null;
  let action;
  if (table.main.rue === "preflop") {
    const spot = spotCouvert(table, id, charts);
    if (spot && alea() < 0.85) action = actionDepuisTableau(spot.attendu, legal, alea);
    else action = decisionPreflopLibre(table, id, legal, alea);
  } else action = decisionPostflop(table, id, legal, alea);
  return rendreLegale(action, legal);
}

export function rendreLegale(action, legal) {
  if (!action) return { verbe: legal.peutCheck ? "check" : "fold" };
  if (action.verbe === "fold" && legal.peutCheck) return { verbe: "check" };
  if (action.verbe === "check" && !legal.peutCheck) return { verbe: "call" };
  if (action.verbe === "raise") {
    if (!legal.peutRelancer) return { verbe: legal.peutCheck ? "check" : "call" };
    const montant = Math.max(legal.relanceMin, Math.min(legal.relanceMax, Math.round(action.montant ?? legal.relanceMin)));
    return { verbe: "raise", montant };
  }
  if (action.verbe === "allin" && !legal.peutRelancer) return { verbe: legal.peutCheck ? "check" : "call" };
  return action;
}
