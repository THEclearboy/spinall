import { useState } from "react";
import { cheminLisse, aireSousCourbe, indexSousSouris } from "./chemins.js";

/**
 * Courbe lissée avec points (style « Analytics » sur carte blanche).
 * series : [{ cle, valeurs: number[], classe }] (même longueur) ;
 * etiquettesX : string[] (facultatif) ; formatY(v) ; infobulle(index) → nœuds React.
 * zero : tracer la ligne du zéro. aire : remplir sous la première série.
 */
export function Courbe({ series, etiquettesX, formatY = (v) => String(v), infobulle, zero = true, aire = true, hauteur = 210, largeur = 640, min: minForce, max: maxForce, idSuffixe = "" }) {
  const [survol, setSurvol] = useState(null);
  const n = series[0]?.valeurs.length || 0;
  if (n < 2) return null;
  const L = largeur;
  const H = hauteur;
  const m = { g: 48, d: 18, h: 18, b: etiquettesX ? 28 : 18 };
  const toutes = series.flatMap((s) => s.valeurs);
  const min = minForce !== undefined ? minForce : Math.min(zero ? 0 : Infinity, ...toutes);
  const max = maxForce !== undefined ? maxForce : Math.max(zero ? 0 : -Infinity, ...toutes);
  const x = (i) => m.g + (i / (n - 1)) * (L - m.g - m.d);
  const y = (v) => m.h + ((max - v) / (max - min || 1)) * (H - m.h - m.b);
  const graduations = [min, (min + max) / 2, max].filter((v, i, t) => t.indexOf(v) === i);
  const montrerPoints = n <= 40;
  const pasEtiquettes = etiquettesX ? Math.max(1, Math.ceil(n / 6)) : 1;
  return (
    <div className="courbe" onMouseLeave={() => setSurvol(null)}>
      <svg viewBox={`0 0 ${L} ${H}`} onMouseMove={(e) => setSurvol(indexSousSouris(e, L, m.g, m.d, n))} role="img" aria-label="Courbe">
        {graduations.map((v) => (
          <g key={v}>
            <line x1={m.g} x2={L - m.d} y1={y(v)} y2={y(v)} className="courbe-grille" />
            <text x={m.g - 8} y={y(v) + 3.5} className="courbe-grad" textAnchor="end">
              {formatY(v)}
            </text>
          </g>
        ))}
        {zero && min < 0 && <line x1={m.g} x2={L - m.d} y1={y(0)} y2={y(0)} className="courbe-zero" />}
        {aire && (
          <>
            <defs>
              <linearGradient id={`courbe-aire${idSuffixe}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" className="courbe-aire-haut" />
                <stop offset="100%" className="courbe-aire-bas" />
              </linearGradient>
            </defs>
            <path
              d={aireSousCourbe(
                series[0].valeurs.map((v, i) => ({ x: x(i), y: y(v) })),
                H - m.b,
              )}
              fill={`url(#courbe-aire${idSuffixe})`}
            />
          </>
        )}
        {series.map((s) => (
          <path key={s.cle} d={cheminLisse(s.valeurs.map((v, i) => ({ x: x(i), y: y(v) })))} className={`courbe-ligne ${s.classe || ""}`} />
        ))}
        {montrerPoints &&
          series.map((s) =>
            s.valeurs.map((v, i) => (
              <circle key={`${s.cle}-${i}`} cx={x(i)} cy={y(v)} r={survol === i ? 6 : 4.5} className={`courbe-point ${s.classe || ""}`} />
            )),
          )}
        {survol !== null && <line x1={x(survol)} x2={x(survol)} y1={m.h} y2={H - m.b} className="courbe-curseur" />}
        {survol !== null &&
          !montrerPoints &&
          series.map((s) => <circle key={s.cle} cx={x(survol)} cy={y(s.valeurs[survol])} r="5" className={`courbe-point ${s.classe || ""}`} />)}
        {etiquettesX &&
          etiquettesX.map((e, i) =>
            i % pasEtiquettes === 0 || i === n - 1 ? (
              <text key={i} x={x(i)} y={H - 8} className="courbe-grad" textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>
                {e}
              </text>
            ) : null,
          )}
      </svg>
      {survol !== null && infobulle && (
        <div className="courbe-infobulle" style={{ left: `${(x(survol) / L) * 100}%` }}>
          {infobulle(survol)}
        </div>
      )}
    </div>
  );
}
