import { useState } from "react";
import { formatHeures } from "../../lib/heures.js";

const JOURS = ["L", "M", "M", "J", "V", "S", "D"];

function cleMois(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Niveau d'intensité 0-4 selon les heures. */
function niveau(heures) {
  if (!heures) return 0;
  if (heures < 0.5) return 1;
  if (heures < 1.5) return 2;
  if (heures < 3) return 3;
  return 4;
}

/**
 * Calendrier mensuel des heures jouées (cases type calendrier).
 * heures : Map(cle "AAAA-MM-JJ" → { auto, manuel, heures }) ;
 * mois : Date du mois affiché ; onMois(delta) ; onEditer(cle, heures | null).
 */
export function CalendrierHeures({ heures, mois, onMois, onEditer }) {
  const [edition, setEdition] = useState(null); // { cle, valeur }
  const premier = new Date(mois.getFullYear(), mois.getMonth(), 1);
  const nbJours = new Date(mois.getFullYear(), mois.getMonth() + 1, 0).getDate();
  const decalage = (premier.getDay() + 6) % 7; // lundi = 0
  const aujourdHui = cleMois(new Date()) === cleMois(mois) ? new Date().getDate() : null;
  const cases = [];
  for (let i = 0; i < decalage; i++) cases.push(<div key={`v${i}`} className="cal-case vide" />);
  for (let jour = 1; jour <= nbJours; jour++) {
    const cle = `${cleMois(mois)}-${String(jour).padStart(2, "0")}`;
    const info = heures.get(cle);
    const h = info ? info.heures : 0;
    cases.push(
      <button
        key={cle}
        type="button"
        className={`cal-case niveau-${niveau(h)}${info?.manuel !== null && info?.manuel !== undefined ? " manuel" : ""}${aujourdHui === jour ? " aujourdhui" : ""}`}
        title={`${jour}/${mois.getMonth() + 1} : ${formatHeures(h)}${info?.manuel !== null && info?.manuel !== undefined ? " (saisi)" : ""}`}
        onClick={() => setEdition({ cle, valeur: h ? String(Math.round(h * 4) / 4).replace(".", ",") : "" })}
      >
        <span className="cal-jour">{jour}</span>
      </button>,
    );
  }

  function valider() {
    if (!edition) return;
    const texte = edition.valeur.trim().replace(",", ".");
    if (texte === "") onEditer(edition.cle, null);
    else {
      const n = parseFloat(texte);
      if (Number.isFinite(n) && n >= 0) onEditer(edition.cle, n);
    }
    setEdition(null);
  }

  return (
    <div className="calendrier">
      <div className="cal-nav">
        <button type="button" className="pilule pilule--clair" onClick={() => onMois(-1)} aria-label="Mois précédent">
          ‹
        </button>
        <span className="cal-mois">{mois.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</span>
        <button type="button" className="pilule pilule--clair" onClick={() => onMois(1)} aria-label="Mois suivant">
          ›
        </button>
      </div>
      <div className="cal-grille">
        {JOURS.map((j, i) => (
          <div key={i} className="cal-entete">
            {j}
          </div>
        ))}
        {cases}
      </div>
      <div className="cal-legende">
        <span>moins</span>
        {[0, 1, 2, 3, 4].map((n) => (
          <span key={n} className={`cal-swatch niveau-${n}`} />
        ))}
        <span>plus</span>
      </div>
      {edition && (
        <div className="cal-edition">
          <span>
            {new Date(edition.cle).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} — heures jouées
          </span>
          <input
            type="text"
            inputMode="decimal"
            autoFocus
            value={edition.valeur}
            placeholder="ex. 1,5"
            onChange={(e) => setEdition({ ...edition, valeur: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") valider();
              if (e.key === "Escape") setEdition(null);
            }}
          />
          <button type="button" className="pilule pilule--lime" onClick={valider}>
            Enregistrer
          </button>
          <button
            type="button"
            className="pilule pilule--clair"
            onClick={() => {
              onEditer(edition.cle, null);
              setEdition(null);
            }}
            title="Revenir à la valeur calculée depuis les mains"
          >
            Auto
          </button>
          <button type="button" className="pilule pilule--clair" onClick={() => setEdition(null)}>
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}
