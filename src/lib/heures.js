// Heures jouées par jour, déduites des horodatages des mains importées :
// une session = une suite de mains sans trou de plus de SEUIL_SESSION ; sa durée
// va de la première à la dernière main (+ 1 min). Une correction manuelle par
// jour peut remplacer la valeur calculée.

const SEUIL_SESSION_MS = 20 * 60 * 1000;
const DUREE_DERNIERE_MAIN_MS = 60 * 1000;

/** "2026-09-28" (fuseau local) pour un horodatage. */
export function cleJour(horodatage) {
  const d = new Date(horodatage);
  const mois = String(d.getMonth() + 1).padStart(2, "0");
  const jour = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mois}-${jour}`;
}

/** Sessions de jeu : [{ debut, fin, nbMains }] triées par date. */
export function sessions(mains) {
  const dates = mains.map((m) => m.date).filter(Boolean).sort((a, b) => a - b);
  const liste = [];
  let courante = null;
  for (const date of dates) {
    if (courante && date - courante.fin <= SEUIL_SESSION_MS) {
      courante.fin = date;
      courante.nbMains += 1;
    } else {
      courante = { debut: date, fin: date, nbMains: 1 };
      liste.push(courante);
    }
  }
  return liste;
}

/**
 * Heures par jour. corrections : { "2026-09-28": 2.5 } (heures saisies à la main).
 * Retourne Map(cle → { auto, manuel, heures }) où heures = manuel ?? auto.
 */
export function heuresParJour(mains, corrections = {}) {
  const parJour = new Map();
  for (const s of sessions(mains)) {
    // Une session qui passe minuit est répartie entre les deux jours.
    let debut = s.debut;
    const fin = s.fin + DUREE_DERNIERE_MAIN_MS;
    while (debut < fin) {
      const minuit = new Date(debut);
      minuit.setHours(24, 0, 0, 0);
      const borne = Math.min(fin, minuit.getTime());
      const cle = cleJour(debut);
      parJour.set(cle, (parJour.get(cle) || 0) + (borne - debut) / 3_600_000);
      debut = borne;
    }
  }
  const resultat = new Map();
  const cles = new Set([...parJour.keys(), ...Object.keys(corrections)]);
  for (const cle of cles) {
    const auto = Math.round((parJour.get(cle) || 0) * 100) / 100;
    const manuel = corrections[cle] !== undefined && corrections[cle] !== null ? corrections[cle] : null;
    resultat.set(cle, { auto, manuel, heures: manuel ?? auto });
  }
  return resultat;
}

/** Total des heures sur un mois ("2026-09"). */
export function totalHeuresMois(heures, cleMois) {
  let total = 0;
  for (const [cle, v] of heures) if (cle.startsWith(cleMois)) total += v.heures;
  return total;
}

/** "1 h 30", "45 min", "0 min". */
export function formatHeures(heures) {
  const minutes = Math.round(heures * 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}
