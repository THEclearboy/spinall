// Agrégats sur l'historique des réponses d'entraînement.

export function resumer(reponses) {
  const total = reponses.length;
  const bonnes = reponses.filter((r) => r.correct).length;
  return { total, bonnes, precision: total === 0 ? null : Math.round((100 * bonnes) / total) };
}

/** Regroupe les réponses par clé et résume chaque groupe : [{ cle, total, bonnes, precision }]. */
export function regrouper(reponses, cleDe) {
  const groupes = new Map();
  for (const reponse of reponses) {
    const cle = cleDe(reponse);
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push(reponse);
  }
  return [...groupes.entries()].map(([cle, liste]) => ({ cle, ...resumer(liste) }));
}
