import { useState } from "react";
import { GrilleMains, Legende } from "./Grille.jsx";
import { ACTIONS_EDITEUR, FAMILLES, exporterRangesCorrigees } from "../lib/charts.js";
import { telechargerJson } from "../lib/stockage.js";

/** Onglet Ranges : consulter et corriger les tableaux case par case. */
export function Ranges({ donnees, charts, overrides, setOverrides }) {
  const [chartId, setChartId] = useState(charts[0].id);
  const chart = charts.find((c) => c.id === chartId);

  /** Fait tourner l'action de la case (allin → call → raise → fold → mixtes → allin). */
  function basculerCase(main) {
    const actuelle = chart.mains[main];
    const index = ACTIONS_EDITEUR.indexOf(actuelle);
    const suivante = ACTIONS_EDITEUR[(index + 1) % ACTIONS_EDITEUR.length];
    setOverrides((o) => {
      const corrections = { ...(o[chartId] || {}) };
      const origine = donnees.charts.find((c) => c.id === chartId);
      const actionOrigine =
        Object.entries(origine.exceptions || {}).find(([, liste]) => liste.includes(main))?.[0] ||
        origine.action_par_defaut;
      if (suivante === actionOrigine) delete corrections[main];
      else corrections[main] = suivante;
      return { ...o, [chartId]: corrections };
    });
  }

  function annulerCorrections() {
    setOverrides((o) => {
      const copie = { ...o };
      delete copie[chartId];
      return copie;
    });
  }

  const nbCorrections = Object.keys(overrides[chartId] || {}).length;

  return (
    <section className="ranges">
      <div className="selecteur-charts">
        {Object.values(FAMILLES).map((famille) => (
          <div key={famille.id} className="groupe-famille">
            <span className="nom-famille">{famille.nom}</span>
            <div className="boutons-charts">
              {charts
                .filter((c) => c.famille.id === famille.id)
                .map((c) => (
                  <button
                    key={c.id}
                    className={c.id === chartId ? "bouton petit actif" : "bouton petit"}
                    onClick={() => setChartId(c.id)}
                  >
                    {c.depth_max_bb === null
                      ? `${c.depth_min_bb.toLocaleString("fr-FR")} bb et +`
                      : `${c.depth_min_bb.toLocaleString("fr-FR")}–${c.depth_max_bb.toLocaleString("fr-FR")} bb`}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
      <div className="panneau">
        <h2>{chart.titre_origine}</h2>
        <p className="muet">
          Action par défaut : <strong>{chart.action_par_defaut}</strong> — cliquer sur une case pour
          faire tourner son action : all-in, call, raise, fold, puis les cases mixtes (deux actions acceptées). Les
          corrections sont enregistrées automatiquement.
          {chart.commentaire && (
            <>
              <br />
              💬 {chart.commentaire}
            </>
          )}
        </p>
        <GrilleMains mains={chart.mains} mainsModifiees={chart.mainsModifiees} onClique={basculerCase} />
        <Legende />
        <div className="barre-actions">
          <button
            className="bouton"
            onClick={() =>
              telechargerJson(exporterRangesCorrigees(donnees, overrides), "ranges-expresso-corrige.json")
            }
          >
            Exporter les ranges corrigées (JSON)
          </button>
          {nbCorrections > 0 && (
            <button className="bouton danger" onClick={annulerCorrections}>
              Annuler mes {nbCorrections} correction(s) sur ce tableau
            </button>
          )}
        </div>
      </div>
      <div className="panneau a-verifier">
        <h3>⚠ Cases à vérifier avec ton ami</h3>
        <p className="muet">
          Les ranges ont été retranscrites depuis des captures d'écran : ces points sont incertains.
        </p>
        <ul>
          {donnees.cases_a_verifier_par_l_utilisateur.map((texte, i) => (
            <li key={i}>{texte}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
