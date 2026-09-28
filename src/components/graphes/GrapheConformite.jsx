import { useState } from "react";
import { cheminLisse, aireSousCourbe, indexSousSouris } from "./chemins.js";
import { dateHeure, pluriel } from "../../lib/format.js";

/** Évolution du respect des ranges (moyenne glissante). courbe : [{ date, taux, nbSpots }]. */
export function GrapheConformite({ courbe, idSuffixe = "" }) {
  const [survol, setSurvol] = useState(null);
  const L = 640;
  const H = 190;
  const m = { g: 40, d: 14, h: 14, b: 24 };
  // On ignore les 9 premiers spots : la moyenne n'est pas encore significative.
  const serie = courbe.length > 10 ? courbe.slice(9) : courbe;
  if (serie.length < 2)
    return <p className="muet">Pas encore assez de spots pour tracer l'évolution.</p>;

  const taux = serie.map((p) => p.taux);
  const min = Math.max(0, Math.min(...taux) - 0.08);
  const max = Math.min(1, Math.max(...taux) + 0.04);
  const x = (i) => m.g + (i / (serie.length - 1)) * (L - m.g - m.d);
  const y = (v) => m.h + ((max - v) / (max - min || 1)) * (H - m.h - m.b);
  const points = serie.map((p, i) => ({ x: x(i), y: y(p.taux) }));
  const dernier = serie[serie.length - 1];
  const pct = (v) => `${Math.round(100 * v)} %`;
  const graduations = [min, (min + max) / 2, max].filter((v, i, t) => t.indexOf(v) === i);

  return (
    <div className="graphe" onMouseLeave={() => setSurvol(null)}>
      <svg
        viewBox={`0 0 ${L} ${H}`}
        onMouseMove={(e) => setSurvol(indexSousSouris(e, L, m.g, m.d, serie.length))}
        role="img"
        aria-label="Évolution du taux de respect des ranges"
      >
        {graduations.map((v) => (
          <g key={v}>
            <line x1={m.g} x2={L - m.d} y1={y(v)} y2={y(v)} className="graphe-grille" />
            <text x={m.g - 6} y={y(v) + 3.5} className="graphe-grad">
              {pct(v)}
            </text>
          </g>
        ))}
        <defs>
          <linearGradient id={`degrade-taux${idSuffixe}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="degrade-taux-haut" />
            <stop offset="100%" className="degrade-taux-bas" />
          </linearGradient>
        </defs>
        <path d={aireSousCourbe(points, H - m.b)} fill={`url(#degrade-taux${idSuffixe})`} />
        <path d={cheminLisse(points)} className="graphe-ligne taux" />
        {survol !== null && (
          <line x1={x(survol)} x2={x(survol)} y1={m.h} y2={H - m.b} className="graphe-curseur" />
        )}
        {survol !== null && (
          <circle cx={x(survol)} cy={y(serie[survol].taux)} r="4" className="graphe-point taux" />
        )}
        <circle cx={x(serie.length - 1)} cy={y(dernier.taux)} r="4" className="graphe-point taux" />
        <text x={L - 4} y={y(dernier.taux) - 8} className="graphe-etiquette taux" textAnchor="end">
          {pct(dernier.taux)}
        </text>
      </svg>
      {survol !== null && (
        <div className="graphe-infobulle" style={{ left: `${(x(survol) / L) * 100}%` }}>
          <div>{dateHeure(serie[survol].date)}</div>
          <div>
            Respect : <strong>{pct(serie[survol].taux)}</strong>{" "}
            <span className="muet">(sur {pluriel("spot", serie[survol].nbSpots)})</span>
          </div>
        </div>
      )}
    </div>
  );
}
