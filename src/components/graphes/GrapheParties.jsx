import { useState } from "react";
import { pluriel } from "../../lib/format.js";

/** Nombre de parties jouées par jour (barres). jours : [{ jour, nb }]. */
export function GrapheParties({ jours }) {
  const [survol, setSurvol] = useState(null);
  const L = 640;
  const H = 190;
  const m = { g: 34, d: 10, h: 18, b: 26 };
  if (jours.length === 0) return null;

  const max = Math.max(...jours.map((j) => j.nb), 1);
  const pas = (L - m.g - m.d) / jours.length;
  const largeurBarre = Math.max(2, Math.min(28, pas * 0.62));
  const x = (i) => m.g + pas * i + (pas - largeurBarre) / 2;
  const y = (v) => m.h + ((max - v) / max) * (H - m.h - m.b);
  const dateCourte = (jour) =>
    new Date(jour).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  const pasEtiquettes = Math.ceil(jours.length / 8);

  function surSouris(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * L;
    setSurvol(Math.max(0, Math.min(jours.length - 1, Math.floor((px - m.g) / pas))));
  }

  return (
    <div className="graphe" onMouseLeave={() => setSurvol(null)}>
      <svg viewBox={`0 0 ${L} ${H}`} onMouseMove={surSouris} role="img" aria-label="Nombre de parties jouées par jour">
        {[max, Math.ceil(max / 2)]
          .filter((v, i, t) => t.indexOf(v) === i)
          .map((v) => (
            <g key={v}>
              <line x1={m.g} x2={L - m.d} y1={y(v)} y2={y(v)} className="graphe-grille" />
              <text x={m.g - 6} y={y(v) + 3.5} className="graphe-grad">
                {v}
              </text>
            </g>
          ))}
        <line x1={m.g} x2={L - m.d} y1={y(0)} y2={y(0)} className="graphe-zero" />
        {jours.map((j, i) => (
          <g key={j.jour}>
            {j.nb > 0 && (
              <rect
                x={x(i)}
                y={y(j.nb)}
                width={largeurBarre}
                height={Math.max(2, y(0) - y(j.nb))}
                rx={Math.min(3.5, largeurBarre / 2)}
                className={survol === i ? "barre-jour active" : "barre-jour"}
              />
            )}
            {jours.length <= 16 && j.nb > 0 && (
              <text x={x(i) + largeurBarre / 2} y={y(j.nb) - 5} className="graphe-valeur-barre" textAnchor="middle">
                {j.nb}
              </text>
            )}
            {i % pasEtiquettes === 0 && (
              <text
                x={x(i) + largeurBarre / 2}
                y={H - 8}
                className="graphe-grad"
                textAnchor="middle"
                style={{ textAnchor: "middle" }}
              >
                {dateCourte(j.jour)}
              </text>
            )}
          </g>
        ))}
      </svg>
      {survol !== null && (
        <div className="graphe-infobulle" style={{ left: `${((x(survol) + largeurBarre / 2) / L) * 100}%` }}>
          <div>
            {new Date(jours[survol].jour).toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </div>
          <div>
            <strong>{pluriel("partie", jours[survol].nb)}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
