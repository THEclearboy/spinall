// Le coach : juge chaque décision pré-flop du joueur sur ses tableaux de ranges et
// signale les c-bets manqués (relanceur pré-flop qui checke au flop alors qu'il peut miser).
import { spotCouvert } from "./bot.js";
import { estCorrecte, actionsDe, labelAction } from "../charts.js";
import { positionDe } from "./moteur.js";

export { spotCouvert };

const unDecimal = (v) => v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

/** Action moteur → action de tableau (fold / call / raise / allin). */
export function actionTableau(action, legal) {
  if (action.verbe === "fold") return "fold";
  if (action.verbe === "check" || action.verbe === "call") return "call";
  if (action.verbe === "allin") return "allin";
  if (action.verbe === "raise") {
    const cible = action.montant ?? legal.relanceMin;
    return cible >= legal.relanceMax ? "allin" : "raise";
  }
  return "call";
}

/** Juge une décision pré-flop sur un spot couvert. */
export function jugerPreflop(spot, action, legal) {
  const jouee = actionTableau(action, legal);
  const callATapis = jouee === "call" && legal.callAllin;
  const conforme = estCorrecte(spot.attendu, jouee) || (callATapis && actionsDe(spot.attendu).includes("allin"));
  const position = { HU_SB: "SB (HU)", HU_BB: "BB vs limp (HU)", "3W_BTN": "BTN (3 joueurs)" }[spot.familleId];
  const texte = conforme
    ? `${spot.nom} à ${unDecimal(spot.profondeur)} bb en ${position} : ${labelAction(spot.familleId, jouee)}, conforme.`
    : `${spot.nom} à ${unDecimal(spot.profondeur)} bb en ${position} : joué ${labelAction(spot.familleId, jouee)}, attendu ${labelAction(spot.familleId, spot.attendu)}.`;
  return { conforme, jouee, attendu: spot.attendu, texte, chartId: spot.chart.id, main: spot.nom };
}

/** Le joueur est-il le dernier relanceur pré-flop (et pas à tapis) ? */
export function estRelanceurPreflop(main, id) {
  const relances = main.actions.filter((a) => a.rue === "preflop" && a.verbe === "raise");
  if (!relances.length) return false;
  const derniere = relances[relances.length - 1];
  return derniere.joueur === id && !derniere.allin;
}

/**
 * Au flop, si le joueur était le relanceur pré-flop et peut miser (personne n'a misé devant),
 * dit s'il a c-bet ou non. Renvoie null hors de ce cas.
 */
export function analyserCbet(main, id, action, legal) {
  if (main.rue !== "flop" || !legal.peutCheck || !estRelanceurPreflop(main, id)) return null;
  const dejaMise = main.actions.some((a) => a.rue === "flop" && a.joueur === id);
  if (dejaMise) return null;
  const cbet = action.verbe === "raise" || action.verbe === "allin";
  return {
    cbet,
    texte: cbet
      ? `C-bet au flop en ${positionDe(main, id)}.`
      : `Pas de c-bet au flop : tu as relancé pré-flop et tu checkes alors que personne n'a misé.`,
  };
}
