import { useState } from "react";
import { pluriel } from "../../lib/format.js";

/**
 * Barres verticales avec rails (style « Analytics » orange).
 * jours : [{ jour (horodatage), nb }] ; libelle(nb) pour l'infobulle ;
 * format : "jour" (Lun, Mar…) ou "date" (05/09).
 */
export function BarresJours({ jours, unite = "partie", hauteur = 190, nbMax = 31 }) {
  const [survol, setSurvol] = useState(null);
  const serie = jours.length > nbMax ? jours.slice(jours.length - nbMax) : jours;
  if (serie.length === 0) return null;
  const max = Math.max(...serie.map((j) => j.nb), 1);
  const graduations = [max, Math.round(max / 2)].filter((v, i, t) => v > 0 && t.indexOf(v) === i);
  const etiquette = (jour) =>
    serie.length <= 8
      ? new Date(jour).toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "")
      : new Date(jour).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  const pasEtiquettes = Math.max(1, Math.ceil(serie.length / 8));
  return (
    <div className="barres-jours" style={{ height: hauteur }} onMouseLeave={() => setSurvol(null)}>
      <div className="barres-graduations">
        {graduations.map((g) => (
          <span key={g} style={{ bottom: `${(g / max) * 100}%` }}>
            {g}
          </span>
        ))}
        <span style={{ bottom: 0 }}>0</span>
      </div>
      <div className="barres-zone">
        {serie.map((j, i) => (
          <div
            key={j.jour}
            className={`barre-rail${survol === i ? " active" : ""}`}
            onMouseEnter={() => setSurvol(i)}
            onClick={() => setSurvol(survol === i ? null : i)}
          >
            <div className="barre-valeur" style={{ height: `${(j.nb / max) * 100}%` }} />
            {i % pasEtiquettes === 0 && <span className="barre-etiquette">{etiquette(j.jour)}</span>}
          </div>
        ))}
      </div>
      {survol !== null && (
        <div className="barres-infobulle">
          {new Date(serie[survol].jour).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} —{" "}
          <strong>{pluriel(unite, serie[survol].nb)}</strong>
        </div>
      )}
    </div>
  );
}
