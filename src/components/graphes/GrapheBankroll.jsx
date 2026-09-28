import { useState } from "react";
import { cheminLisse, aireSousCourbe, indexSousSouris } from "./chemins.js";
import { euros, dateHeure, ordinal } from "../../lib/format.js";

/** Net cumulé en euros, partie après partie. courbe : [{ date, cumul, partie }]. */
export function GrapheBankroll({ courbe, idSuffixe = "" }) {
  const [survol, setSurvol] = useState(null);
  const L = 640;
  const H = 210;
  const m = { g: 46, d: 16, h: 16, b: 24 };
  if (courbe.length < 2) return null;

  const valeurs = courbe.map((p) => p.cumul);
  const min = Math.min(0, ...valeurs);
  const max = Math.max(0, ...valeurs);
  const x = (i) => m.g + (i / (courbe.length - 1)) * (L - m.g - m.d);
  const y = (v) => m.h + ((max - v) / (max - min || 1)) * (H - m.h - m.b);
  const points = courbe.map((p, i) => ({ x: x(i), y: y(p.cumul) }));
  const dernier = courbe[courbe.length - 1];
  const graduations = [min, (min + max) / 2, max].filter((v, i, t) => t.indexOf(v) === i);

  return (
    <div className="graphe" onMouseLeave={() => setSurvol(null)}>
      <svg
        viewBox={`0 0 ${L} ${H}`}
        onMouseMove={(e) => setSurvol(indexSousSouris(e, L, m.g, m.d, courbe.length))}
        role="img"
        aria-label="Net cumulé en euros, partie après partie"
      >
        {graduations.map((v) => (
          <g key={v}>
            <line x1={m.g} x2={L - m.d} y1={y(v)} y2={y(v)} className="graphe-grille" />
            <text x={m.g - 6} y={y(v) + 3.5} className="graphe-grad">
              {euros(v)}
            </text>
          </g>
        ))}
        <line x1={m.g} x2={L - m.d} y1={y(0)} y2={y(0)} className="graphe-zero" />
        <defs>
          <linearGradient id={`degrade-bankroll${idSuffixe}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="graphe-degrade-haut" />
            <stop offset="100%" className="graphe-degrade-bas" />
          </linearGradient>
        </defs>
        <path d={aireSousCourbe(points, H - m.b)} fill={`url(#degrade-bankroll${idSuffixe})`} />
        <path d={cheminLisse(points)} className="graphe-ligne" />
        {survol !== null && (
          <line x1={x(survol)} x2={x(survol)} y1={m.h} y2={H - m.b} className="graphe-curseur" />
        )}
        {survol !== null && (
          <circle cx={x(survol)} cy={y(courbe[survol].cumul)} r="4" className="graphe-point" />
        )}
        <circle cx={x(courbe.length - 1)} cy={y(dernier.cumul)} r="4" className="graphe-point" />
        <text
          x={Math.min(x(courbe.length - 1) + 7, L - 4)}
          y={y(dernier.cumul) - 8}
          className="graphe-etiquette"
          textAnchor="end"
        >
          {euros(dernier.cumul)}
        </text>
      </svg>
      {survol !== null && (
        <div className="graphe-infobulle" style={{ left: `${(x(survol) / L) * 100}%` }}>
          <div>{dateHeure(courbe[survol].date)}</div>
          <div>
            {courbe[survol].partie.multiplicateur ? `x${courbe[survol].partie.multiplicateur} — ` : ""}
            {courbe[survol].partie.resultatConnu ? ordinal(courbe[survol].partie.place) : "résultat inconnu"}
            {" · partie "}
            {courbe[survol].partie.netEuro >= 0 ? "+" : ""}
            {euros(courbe[survol].partie.netEuro)}
          </div>
          <div>
            Cumul : <strong>{euros(courbe[survol].cumul)}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
