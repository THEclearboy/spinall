/**
 * Jauge en demi-cercle faite de traits (style « Balance 78 % »).
 * valeur : 0-1 (null = vide). centre : texte affiché sous l'arc.
 */
export function Jauge({ valeur, centre, largeur = 260, nbTraits = 56 }) {
  const cx = largeur / 2;
  const rayon = largeur / 2 - 10;
  const cy = rayon + 8;
  const longueur = 26;
  const hauteur = cy + 6;
  const remplis = valeur === null || valeur === undefined ? 0 : Math.round(Math.max(0, Math.min(1, valeur)) * nbTraits);
  const traits = [];
  for (let i = 0; i < nbTraits; i++) {
    const angle = Math.PI - (Math.PI * (i + 0.5)) / nbTraits; // de gauche (π) à droite (0)
    const x1 = cx + (rayon - longueur) * Math.cos(angle);
    const y1 = cy - (rayon - longueur) * Math.sin(angle);
    const x2 = cx + rayon * Math.cos(angle);
    const y2 = cy - rayon * Math.sin(angle);
    traits.push(
      <line
        key={i}
        x1={x1.toFixed(1)}
        y1={y1.toFixed(1)}
        x2={x2.toFixed(1)}
        y2={y2.toFixed(1)}
        className={i < remplis ? "jauge-trait plein" : "jauge-trait"}
      />,
    );
  }
  return (
    <svg viewBox={`0 0 ${largeur} ${hauteur}`} className="jauge" role="img" aria-label="Jauge">
      {traits}
      {centre !== undefined && (
        <text x={cx} y={cy - 2} className="jauge-centre" textAnchor="middle">
          {centre}
        </text>
      )}
    </svg>
  );
}
