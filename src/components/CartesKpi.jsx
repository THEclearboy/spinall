import { euros, pourcent } from "../lib/format.js";

const signe = (v) => (v >= 0 ? "+" : "");
const unDecimal = (v) => v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

function Kpi({ valeur, nom, classe = "", detail, titre }) {
  return (
    <div className="kpi" title={titre}>
      <div className={`kpi-valeur ${classe}`.trim()}>
        {valeur}
        {detail && <span className="kpi-detail">{detail}</span>}
      </div>
      <div className="kpi-nom">{nom}</div>
    </div>
  );
}

const classeSigne = (v) => (v === null ? "" : v >= 0 ? "positif" : "negatif");

/**
 * Indicateurs de l'onglet Analyse et du rapport imprimé, en trois groupes :
 * résultats (parties, gain, places), jeu (mains, VPIP, PFR, showdowns), qualité (cEV, ranges).
 * `variante` : "ecran" (valeurs en attente affichées "…") ou "rapport".
 */
export function CartesKpi({ stats, cEV, reelParPartie, variante = "ecran" }) {
  const ecran = variante === "ecran";
  const attente = ecran ? "…" : "—";
  return (
    <div className="groupes-kpi">
      <div className="groupe-kpi">
        <h4>Résultats</h4>
        <div className="cartes-kpi">
          <Kpi valeur={stats.parties.length} nom="parties jouées" />
          <Kpi
            valeur={`${signe(stats.netEuro)}${euros(stats.netEuro)}`}
            classe={classeSigne(stats.netEuro)}
            nom={`gain net (${euros(stats.investi)} de buy-ins)`}
          />
          <Kpi
            valeur={stats.places[1]}
            detail={` / ${stats.places[2]} / ${stats.places[3]}`}
            nom="1ᵉʳ / 2ᵉ / 3ᵉ"
          />
        </div>
      </div>
      <div className="groupe-kpi">
        <h4>Ton jeu</h4>
        <div className="cartes-kpi">
          <Kpi valeur={stats.nbMains} nom="mains" />
          <Kpi valeur={pourcent(stats.vpip)} nom="VPIP — mains jouées volontairement" />
          <Kpi valeur={pourcent(stats.pfr)} nom="PFR — relances pré-flop" />
          <Kpi valeur={stats.showdownsGagnes} detail={` / ${stats.showdownsVus}`} nom="showdowns gagnés" />
        </div>
      </div>
      <div className="groupe-kpi">
        <h4>Qualité du jeu</h4>
        <div className="cartes-kpi">
          <Kpi
            valeur={cEV === null ? attente : `${signe(cEV)}${unDecimal(cEV)}`}
            classe={classeSigne(cEV)}
            detail={reelParPartie !== null ? ` (réel ${signe(reelParPartie)}${unDecimal(reelParPartie)})` : undefined}
            nom="cEV — jetons gagnés par partie, chance neutralisée"
            titre="Jetons gagnés en théorie par partie : EV totale (tapis ajustés à l'équité) ÷ nombre de parties"
          />
          <Kpi
            valeur={pourcent(stats.tauxConformite)}
            classe={
              stats.tauxConformite === null
                ? ecran
                  ? ""
                  : "negatif"
                : stats.tauxConformite >= 0.85
                  ? "positif"
                  : "negatif"
            }
            nom="respect des ranges pré-flop"
          />
        </div>
      </div>
    </div>
  );
}
