import { CartesKpi } from "./CartesKpi.jsx";
import { GrapheBankroll } from "./graphes/GrapheBankroll.jsx";
import { GrapheParties } from "./graphes/GrapheParties.jsx";
import { GrapheConformite } from "./graphes/GrapheConformite.jsx";
import { GrapheEv } from "./graphes/GrapheEv.jsx";
import { labelAction } from "../lib/charts.js";
import { euros, dateHeure, ordinal, pluriel, formatBbArrondi } from "../lib/format.js";

/** Version imprimable de l'analyse (visible uniquement via window.print, voir @media print). */
export function RapportImpression({ analyse, stats, calculEv, conformite, cEV, reelParPartie }) {
  const dates = analyse.mains.map((m) => m.date).filter(Boolean);
  const debut = dates.length ? Math.min(...dates) : null;
  const fin = dates.length ? Math.max(...dates) : null;
  const jour = (d) => new Date(d).toLocaleDateString("fr-FR");
  const ecarts = [...stats.ecarts].reverse();

  return (
    <div className="rapport-impression" aria-hidden="true">
      <header className="rapport-entete">
        <h1>Expresso Trainer — Rapport d'analyse</h1>
        <p className="muet">
          {pluriel("main", stats.nbMains)}, {pluriel("partie", stats.parties.length)}
          {debut && fin && ` — du ${jour(debut)} au ${jour(fin)}`} · généré le{" "}
          {new Date().toLocaleDateString("fr-FR")}
        </p>
      </header>
      <CartesKpi stats={stats} cEV={cEV} reelParPartie={reelParPartie} variante="rapport" />
      {stats.courbe.length >= 2 && (
        <div className="panneau">
          <h3>Net cumulé (€), partie après partie</h3>
          <GrapheBankroll courbe={stats.courbe} idSuffixe="-rapport" />
        </div>
      )}
      {calculEv.points && calculEv.points.length >= 2 && (
        <div className="panneau">
          <h3>Jetons gagnés, main après main — réel vs attendu (EV)</h3>
          <GrapheEv calcul={calculEv} idSuffixe="-rapport" />
        </div>
      )}
      {stats.partiesParJour.length > 0 && (
        <div className="panneau">
          <h3>Parties par jour</h3>
          <GrapheParties jours={stats.partiesParJour} />
        </div>
      )}
      {stats.courbeConformite.length >= 2 && (
        <div className="panneau">
          <h3>Respect des ranges — évolution (moyenne glissante, 50 spots)</h3>
          <GrapheConformite courbe={stats.courbeConformite} idSuffixe="-rapport" />
        </div>
      )}
      <div className="panneau">
        <h3>Conformité aux ranges, par tableau</h3>
        <table>
          <thead>
            <tr>
              <th>Tableau</th>
              <th>Mains</th>
              <th>Conformes</th>
              <th>Taux</th>
            </tr>
          </thead>
          <tbody>
            {conformite.map((ligne) => (
              <tr key={ligne.chartId}>
                <td>{ligne.chartTitre}</td>
                <td>{ligne.total}</td>
                <td>{ligne.conformes}</td>
                <td>{Math.round((100 * ligne.conformes) / ligne.total)} %</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panneau">
        <h3>Écarts de range ({ecarts.length})</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Tableau</th>
              <th>Main</th>
              <th>Profondeur</th>
              <th>Joué</th>
              <th>Attendu</th>
            </tr>
          </thead>
          <tbody>
            {ecarts.map((e) => (
              <tr key={e.handId}>
                <td>{dateHeure(e.date)}</td>
                <td>{e.chartTitre}</td>
                <td>{e.main}</td>
                <td>{formatBbArrondi(e.profondeur)}</td>
                <td className="mauvaise-reponse">{labelAction(e.familleId, e.jouee)}</td>
                <td className="bonne-reponse">{labelAction(e.familleId, e.attendu)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panneau">
        <h3>Parties ({stats.parties.length})</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Multiplicateur</th>
              <th>Mains</th>
              <th>Place</th>
              <th>Net</th>
            </tr>
          </thead>
          <tbody>
            {[...stats.parties].reverse().map((p) => (
              <tr key={p.id}>
                <td>{dateHeure(p.date)}</td>
                <td>x{p.multiplicateur ?? "?"}</td>
                <td>{p.nbMains}</td>
                <td>{p.resultatConnu ? ordinal(p.place) : "?"}</td>
                <td className={p.netEuro >= 0 ? "bonne-reponse" : "mauvaise-reponse"}>
                  {p.netEuro >= 0 ? "+" : ""}
                  {euros(p.netEuro)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muet rapport-pied">
        Profondeur = stack effectif en bb (HU : min des deux stacks ; 3-way : min du héros et du plus
        gros adversaire), stacks avant blinds. Expected chips : tapis retournés avant la river
        remplacés par pot × équité. Généré par Expresso Trainer.
      </p>
    </div>
  );
}
