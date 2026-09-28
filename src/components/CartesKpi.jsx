import { euros, pourcent } from "../lib/format.js";

const signe = (v) => (v >= 0 ? "+" : "");
const unDecimal = (v) => v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

/**
 * Bandeau d'indicateurs de l'onglet Analyse et du rapport imprimé.
 * `variante` : "ecran" (valeurs en attente affichées "…") ou "rapport".
 */
export function CartesKpi({ stats, cEV, reelParPartie, variante = "ecran" }) {
  const ecran = variante === "ecran";
  return (
    <div className="cartes-kpi">
      <div className="kpi">
        <div className="kpi-valeur">{stats.parties.length}</div>
        <div className="kpi-nom">parties</div>
      </div>
      <div className="kpi">
        <div className={stats.netEuro >= 0 ? "kpi-valeur positif" : "kpi-valeur negatif"}>
          {signe(stats.netEuro)}
          {euros(stats.netEuro)}
        </div>
        <div className="kpi-nom">net (buy-ins {euros(stats.investi)})</div>
      </div>
      <div className="kpi">
        <div className="kpi-valeur">
          {stats.places[1]}
          <span className="kpi-detail">
            {" / "}
            {stats.places[2]} / {stats.places[3]}
          </span>
        </div>
        <div className="kpi-nom">1ᵉʳ / 2ᵉ / 3ᵉ</div>
      </div>
      {ecran && (
        <div className="kpi">
          <div className="kpi-valeur">{stats.nbMains}</div>
          <div className="kpi-nom">mains</div>
        </div>
      )}
      <div className="kpi">
        <div className="kpi-valeur">{pourcent(stats.vpip)}</div>
        <div className="kpi-nom">VPIP</div>
      </div>
      <div className="kpi">
        <div className="kpi-valeur">{pourcent(stats.pfr)}</div>
        <div className="kpi-nom">PFR</div>
      </div>
      <div className="kpi">
        <div className="kpi-valeur">
          {stats.showdownsGagnes}
          <span className="kpi-detail"> / {stats.showdownsVus}</span>
        </div>
        <div className="kpi-nom">showdowns gagnés</div>
      </div>
      {ecran ? (
        <div
          className="kpi"
          title="Jetons gagnés en théorie par partie : EV totale (tapis ajustés à l'équité) ÷ nombre de parties"
        >
          <div className={cEV === null ? "kpi-valeur" : cEV >= 0 ? "kpi-valeur positif" : "kpi-valeur negatif"}>
            {cEV === null ? "…" : `${signe(cEV)}${unDecimal(cEV)}`}
            {reelParPartie !== null && (
              <span className="kpi-detail">
                {" "}
                (réel {signe(reelParPartie)}
                {unDecimal(reelParPartie)})
              </span>
            )}
          </div>
          <div className="kpi-nom">cEV — jetons / partie</div>
        </div>
      ) : (
        <div className="kpi">
          <div className={cEV === null ? "kpi-valeur" : cEV >= 0 ? "kpi-valeur positif" : "kpi-valeur negatif"}>
            {cEV === null ? "—" : `${signe(cEV)}${unDecimal(cEV)}`}
          </div>
          <div className="kpi-nom">
            cEV — jetons/partie
            {reelParPartie !== null && ` (réel ${signe(reelParPartie)}${unDecimal(reelParPartie)})`}
          </div>
        </div>
      )}
      <div className="kpi">
        <div
          className={
            ecran
              ? stats.tauxConformite === null
                ? "kpi-valeur"
                : stats.tauxConformite >= 0.85
                  ? "kpi-valeur positif"
                  : "kpi-valeur negatif"
              : stats.tauxConformite !== null && stats.tauxConformite >= 0.85
                ? "kpi-valeur positif"
                : "kpi-valeur negatif"
          }
        >
          {pourcent(stats.tauxConformite)}
        </div>
        <div className="kpi-nom">respect des ranges</div>
      </div>
    </div>
  );
}
