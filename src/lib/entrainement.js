// Tirage des questions d'entraînement et répétition espacée.
import { tirerDeuxCartes, nomMain, tirerCombinaison } from "./cartes.js";

const PROFONDEUR_MAX_BB = 25; // pour les tableaux "et plus"
const POIDS_AJOUT = 3; // poids ajouté à une main ratée
const POIDS_MAX = 12;
const FACTEUR_BONNE_REPONSE = 0.5; // le poids est divisé par 2 à chaque bonne réponse
const POIDS_MIN = 0.75; // en dessous, la main sort de la liste de révision
const PROBA_REVISION = 0.35; // chance de tirer une main à réviser (mode répétition espacée)

export function clePoids(chartId, main) {
  return `${chartId}|${main}`;
}

/** Met à jour les poids de révision après une réponse. */
export function majPoids(poids, chartId, main, correct) {
  const cle = clePoids(chartId, main);
  const suivant = { ...poids };
  if (correct) {
    if (suivant[cle] !== undefined) {
      const reduit = suivant[cle] * FACTEUR_BONNE_REPONSE;
      if (reduit < POIDS_MIN) delete suivant[cle];
      else suivant[cle] = reduit;
    }
  } else {
    suivant[cle] = Math.min((suivant[cle] || 0) + POIDS_AJOUT, POIDS_MAX);
  }
  return suivant;
}

/** Profondeur aléatoire (par demi-bb) dans l'intervalle du chart. */
export function tirerProfondeur(chart, alea = Math.random) {
  const min = Math.max(chart.depth_min_bb, 1);
  const max = chart.depth_max_bb === null ? PROFONDEUR_MAX_BB : chart.depth_max_bb;
  const brut = min + alea() * (max - min);
  let profondeur = Math.round(brut * 2) / 2;
  if (profondeur >= max) profondeur = max - 0.5;
  if (profondeur < min) profondeur = min;
  return profondeur;
}

function tiragePondere(cles, poids, alea) {
  const total = cles.reduce((somme, cle) => somme + poids[cle], 0);
  let curseur = alea() * total;
  for (const cle of cles) {
    curseur -= poids[cle];
    if (curseur <= 0) return cle;
  }
  return cles[cles.length - 1];
}

/**
 * Tire la prochaine question parmi les charts actifs.
 * options : { repetitionEspacee, erreursUniquement }.
 * Retourne null s'il n'y a aucun chart, ou aucune erreur en mode "erreurs uniquement".
 */
export function tirerQuestion(chartsActifs, poids, options = {}, alea = Math.random) {
  if (chartsActifs.length === 0) return null;
  const ids = new Set(chartsActifs.map((c) => c.id));
  const aReviser = Object.keys(poids).filter((cle) => ids.has(cle.split("|")[0]));
  const revision = options.erreursUniquement
    ? aReviser.length > 0
    : options.repetitionEspacee && aReviser.length > 0 && alea() < PROBA_REVISION;
  if (options.erreursUniquement && aReviser.length === 0) return null;

  if (revision) {
    const cle = tiragePondere(aReviser, poids, alea);
    const [chartId, main] = cle.split("|");
    const chart = chartsActifs.find((c) => c.id === chartId);
    const cartes = tirerCombinaison(main, alea);
    return { chart, cartes, main, profondeur: tirerProfondeur(chart, alea), issueDeRevision: true };
  }

  const chart = chartsActifs[Math.floor(alea() * chartsActifs.length)];
  const cartes = tirerDeuxCartes(alea);
  return {
    chart,
    cartes,
    main: nomMain(cartes[0], cartes[1]),
    profondeur: tirerProfondeur(chart, alea),
    issueDeRevision: false,
  };
}
