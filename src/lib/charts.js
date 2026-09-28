// Tableaux de ranges : familles de situations, construction des grilles 13×13
// à partir du JSON (action par défaut + exceptions + corrections de l'utilisateur).
import { RANGS } from "./cartes.js";

export const ACTIONS = ["allin", "call", "raise", "fold"];
/** Cycle de l'éditeur de ranges : les quatre actions puis les cases mixtes. */
export const ACTIONS_EDITEUR = ["allin", "call", "raise", "fold", "allin/call", "allin/fold", "call/fold", "raise/fold"];

/** "allin/call" → ["allin", "call"] ; "fold" → ["fold"]. */
export function actionsDe(attendu) {
  return String(attendu).split("/");
}

/** Vrai si l'action jouée fait partie des actions acceptées (case mixte ou non). */
export function estCorrecte(attendu, action) {
  return actionsDe(attendu).includes(action);
}

/** Classe CSS d'une case : "action-allin", "action-mixte allin-call"… */
export function classeAction(attendu) {
  const actions = actionsDe(attendu);
  return actions.length > 1 ? `action-mixte ${actions.join("-")}` : `action-${actions[0]}`;
}

/** Style de fond d'une case mixte (deux couleurs côte à côte). */
export function styleAction(attendu) {
  const actions = actionsDe(attendu);
  if (actions.length < 2) return undefined;
  return { background: `linear-gradient(90deg, var(--${actions[0]}) 50%, var(--${actions[1]}) 50%)` };
}

/** Les trois situations couvertes par les tableaux. */
export const FAMILLES = {
  HU_SB: {
    id: "HU_SB",
    nom: "HU — SB, premier de parole",
    contexte: "Heads-up. Tu es de petite blind (au bouton), premier de parole.",
    boutons: [
      { action: "fold", label: "Fold" },
      { action: "call", label: "Limp" },
      { action: "raise", label: "Raise" },
      { action: "allin", label: "All-in" },
    ],
  },
  HU_BB: {
    id: "HU_BB",
    nom: "HU — BB, face à un limp",
    contexte: "Heads-up. La SB a limpé, à toi de parler en grosse blind.",
    boutons: [
      { action: "call", label: "Check" },
      { action: "raise", label: "Raise" },
      { action: "allin", label: "All-in" },
    ],
  },
  "3W_BTN": {
    id: "3W_BTN",
    nom: "3-way — BTN, premier de parole",
    contexte: "Table à 3 joueurs. Tu es au bouton, premier de parole.",
    boutons: [
      { action: "fold", label: "Fold" },
      { action: "call", label: "Limp" },
      { action: "raise", label: "Raise" },
      { action: "allin", label: "All-in" },
    ],
  },
};

export function familleDuChart(chart) {
  if (chart.format_table === "HU" && chart.position_heros === "SB") return FAMILLES.HU_SB;
  if (chart.format_table === "HU" && chart.position_heros === "BB") return FAMILLES.HU_BB;
  if (chart.format_table === "3max" && chart.position_heros === "BTN") return FAMILLES["3W_BTN"];
  throw new Error(`Chart hors périmètre : ${chart.id}`);
}

/** Libellé d'une action dans le contexte d'une famille ("Limp", "Check"…). */
export function labelAction(familleId, action) {
  const actions = actionsDe(action);
  if (actions.length > 1) return actions.map((a) => labelAction(familleId, a)).join(" ou ");
  const bouton = FAMILLES[familleId]?.boutons.find((b) => b.action === action);
  return bouton
    ? bouton.label
    : { allin: "All-in", call: "Call", raise: "Raise", fold: "Fold" }[action] || action;
}

/** Nom de la main à la case (ligne, colonne) de la grille 13×13. */
export function nomMainParIndices(ligne, colonne) {
  if (ligne === colonne) return RANGS[ligne] + RANGS[colonne];
  return ligne < colonne
    ? RANGS[ligne] + RANGS[colonne] + "s"
    : RANGS[colonne] + RANGS[ligne] + "o";
}

/** Les 169 mains, dans l'ordre de la grille. */
export function toutesLesMains() {
  const mains = [];
  for (let l = 0; l < 13; l++) for (let c = 0; c < 13; c++) mains.push(nomMainParIndices(l, c));
  return mains;
}

/**
 * Construit les charts prêts à l'emploi : chaque chart reçoit `famille`,
 * `mains` (main → action) et `mainsModifiees` (cases corrigées par l'utilisateur).
 * `overrides` : { chartId: { main: action } }.
 */
export function construireCharts(donnees, overrides = {}) {
  return donnees.charts.map((chart) => {
    const mains = {};
    for (const main of toutesLesMains()) mains[main] = chart.action_par_defaut;
    for (const [action, liste] of Object.entries(chart.exceptions || {}))
      for (const main of liste) mains[main] = action;
    const corrections = overrides[chart.id] || {};
    for (const [main, action] of Object.entries(corrections)) mains[main] = action;
    return {
      ...chart,
      famille: familleDuChart(chart),
      mains,
      mainsModifiees: new Set(Object.keys(corrections)),
    };
  });
}

/** Chart d'une famille à une profondeur donnée (intervalles [min, max)). */
export function trouverChart(charts, familleId, profondeurBb) {
  return (
    charts.find(
      (c) =>
        c.famille.id === familleId &&
        profondeurBb >= c.depth_min_bb &&
        (c.depth_max_bb === null || profondeurBb < c.depth_max_bb),
    ) || null
  );
}

export function actionAttendue(chart, main) {
  return chart.mains[main];
}

/** Réexporte le JSON d'origine en y intégrant les corrections de l'utilisateur. */
export function exporterRangesCorrigees(donnees, overrides = {}) {
  const charts = construireCharts(donnees, overrides);
  const copie = JSON.parse(JSON.stringify(donnees));
  copie.charts = copie.charts.map((chart) => {
    const construit = charts.find((c) => c.id === chart.id);
    const exceptions = {};
    for (const main of toutesLesMains()) {
      const action = construit.mains[main];
      if (action !== chart.action_par_defaut) {
        if (!exceptions[action]) exceptions[action] = [];
        exceptions[action].push(main);
      }
    }
    return { ...chart, exceptions };
  });
  return copie;
}
