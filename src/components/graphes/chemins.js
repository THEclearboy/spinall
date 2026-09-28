// Tracés SVG lissés (courbes de Catmull-Rom converties en Bézier cubiques).

/** Chemin "d" d'une courbe lissée passant par les points [{ x, y }]. */
export function cheminLisse(points) {
  if (points.length < 2) return "";
  let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

/** Même courbe, fermée jusqu'à la ligne de base `yBase` (pour le dégradé de remplissage). */
export function aireSousCourbe(points, yBase) {
  if (points.length < 2) return "";
  const dernier = points[points.length - 1];
  return (
    cheminLisse(points) +
    `L${dernier.x.toFixed(1)},${yBase.toFixed(1)}L${points[0].x.toFixed(1)},${yBase.toFixed(1)}Z`
  );
}

/** Index du point le plus proche de la souris, pour une échelle linéaire. */
export function indexSousSouris(evenement, largeur, margeGauche, margeDroite, nbPoints) {
  const rect = evenement.currentTarget.getBoundingClientRect();
  const x = ((evenement.clientX - rect.left) / rect.width) * largeur;
  return Math.max(
    0,
    Math.min(nbPoints - 1, Math.round(((x - margeGauche) / (largeur - margeGauche - margeDroite)) * (nbPoints - 1))),
  );
}
