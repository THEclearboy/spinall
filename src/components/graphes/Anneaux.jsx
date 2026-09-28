function arc(cx, cy, r, debut, fin) {
  // angles en degrés, 0 = haut, sens horaire
  const a1 = ((debut - 90) * Math.PI) / 180;
  const a2 = ((fin - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const x2 = cx + r * Math.cos(a2);
  const y2 = cy + r * Math.sin(a2);
  const grand = fin - debut > 180 ? 1 : 0;
  return `M${x1.toFixed(2)},${y1.toFixed(2)}A${r},${r} 0 ${grand} 1 ${x2.toFixed(2)},${y2.toFixed(2)}`;
}

/**
 * Anneaux concentriques (style « Skill rate »).
 * series : [{ label, valeur (0-1 ou null), couleur }] — la première est l'anneau extérieur.
 * centre : texte au milieu. taille : côté du SVG.
 */
export function Anneaux({ series, centre, taille = 200, epaisseur = 12, ecart = 6 }) {
  const cx = taille / 2;
  const cy = taille / 2;
  const rayonExterieur = taille / 2 - epaisseur / 2 - 2;
  return (
    <svg viewBox={`0 0 ${taille} ${taille}`} className="anneaux" role="img" aria-label="Anneaux de progression">
      {series.map((s, i) => {
        const r = rayonExterieur - i * (epaisseur + ecart);
        const valeur = s.valeur === null || s.valeur === undefined ? 0 : Math.max(0, Math.min(1, s.valeur));
        const fin = Math.max(0.5, valeur * 359.9);
        return (
          <g key={s.label || i}>
            <circle cx={cx} cy={cy} r={r} className="anneau-piste" strokeWidth={epaisseur} />
            {valeur > 0 && (
              <path d={arc(cx, cy, r, 0, fin)} stroke={s.couleur} strokeWidth={epaisseur} strokeLinecap="round" fill="none" />
            )}
          </g>
        );
      })}
      {centre !== undefined && (
        <text x={cx} y={cy} className="anneaux-centre" textAnchor="middle" dominantBaseline="central">
          {centre}
        </text>
      )}
    </svg>
  );
}

/** Un seul anneau (style « Activity 78 % »). */
export function Anneau({ valeur, couleur, piste, taille = 120, epaisseur = 10, centre }) {
  return (
    <svg viewBox={`0 0 ${taille} ${taille}`} className="anneau" role="img" aria-label="Anneau de progression">
      <circle cx={taille / 2} cy={taille / 2} r={taille / 2 - epaisseur / 2 - 1} className="anneau-piste" stroke={piste} strokeWidth={epaisseur} />
      {valeur > 0 && (
        <path
          d={arc(taille / 2, taille / 2, taille / 2 - epaisseur / 2 - 1, 0, Math.max(0.5, Math.min(1, valeur) * 359.9))}
          stroke={couleur}
          strokeWidth={epaisseur}
          strokeLinecap="round"
          fill="none"
        />
      )}
      {centre !== undefined && (
        <text x={taille / 2} y={taille / 2} className="anneau-centre" textAnchor="middle" dominantBaseline="central">
          {centre}
        </text>
      )}
    </svg>
  );
}
