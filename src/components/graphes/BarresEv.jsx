import { useState } from "react";
import { useLargeur } from "./useLargeur.js";

/**
 * Barres signées (EV par période) : positives en lime, négatives en orange, ligne du zéro.
 * valeurs : [{ cle, ev, libelle }] ; infobulle(index) → nœuds React ; formatY(v) pour les graduations.
 */
export function BarresEv({ valeurs, hauteur = 230, formatY = (v) => String(Math.round(v)), infobulle, surClic }) {
  const [ref, mesuree] = useLargeur();
  const [survol, setSurvol] = useState(null);
  const n = valeurs.length;
  if (n === 0) return null;
  const L = Math.max(240, mesuree || 640);
  const H = hauteur;
  const m = { g: 52, d: 12, h: 14, b: 26 };
  const evs = valeurs.map((v) => v.ev);
  const max = Math.max(0, ...evs);
  const min = Math.min(0, ...evs);
  const y = (v) => m.h + ((max - v) / (max - min || 1)) * (H - m.h - m.b);
  const largeurZone = L - m.g - m.d;
  const pas = largeurZone / n;
  const lb = Math.max(1, Math.min(22, pas * 0.72));
  const x = (i) => m.g + pas * i + (pas - lb) / 2;
  const graduations = [max, 0, min].filter((v, i, t) => t.indexOf(v) === i);
  const pasEtiquettes = Math.max(1, Math.ceil(n / 8));
  const indexSousSouris = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * L;
    const i = Math.floor((px - m.g) / pas);
    return i >= 0 && i < n ? i : null;
  };
  return (
    <div className="courbe barres-ev" ref={ref} onMouseLeave={() => setSurvol(null)}>
      <svg
        viewBox={`0 0 ${L} ${H}`}
        role="img"
        aria-label="EV par période"
        onMouseMove={(e) => setSurvol(indexSousSouris(e))}
        onClick={(e) => {
          const i = indexSousSouris(e);
          if (i !== null && surClic) surClic(i);
        }}
      >
        {graduations.map((v) => (
          <g key={v}>
            <line x1={m.g} x2={L - m.d} y1={y(v)} y2={y(v)} className={v === 0 ? "courbe-zero" : "courbe-grille"} />
            <text x={m.g - 8} y={y(v) + 3.5} className="courbe-grad" textAnchor="end">
              {formatY(v)}
            </text>
          </g>
        ))}
        {valeurs.map((v, i) => {
          const y0 = y(0);
          const y1 = y(v.ev);
          const haut = Math.min(y0, y1);
          const h = Math.max(1.5, Math.abs(y1 - y0));
          return (
            <rect
              key={v.cle}
              x={x(i)}
              y={haut}
              width={lb}
              height={h}
              rx={Math.min(3, lb / 2)}
              className={`barre-ev ${v.ev >= 0 ? "positif" : "negatif"}${survol === i ? " active" : ""}`}
            />
          );
        })}
        {valeurs.map((v, i) =>
          i % pasEtiquettes === 0 || i === n - 1 ? (
            <text key={`e${v.cle}`} x={x(i) + lb / 2} y={H - 8} className="courbe-grad" textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>
              {v.etiquette ?? v.libelle}
            </text>
          ) : null,
        )}
      </svg>
      {survol !== null && infobulle && (
        <div className="courbe-infobulle" style={{ left: `${((x(survol) + lb / 2) / L) * 100}%` }}>
          {infobulle(survol)}
        </div>
      )}
    </div>
  );
}
