import { useMemo, useState } from "react";
import { FAMILLES, labelAction } from "../lib/charts.js";
import { resumer, regrouper } from "../lib/statistiques.js";
import { formatBb } from "../lib/format.js";

const LIBELLES_ACTIONS = {
  allin: "All-in",
  call: "Call / Limp / Check",
  raise: "Raise",
  fold: "Fold",
};

export function Precision({ valeur }) {
  if (valeur === null) return <span className="muet">—</span>;
  const niveau = valeur >= 90 ? "ok" : valeur >= 70 ? "moyen" : "alerte";
  return <span className={`precision ${niveau}`}>{valeur} %</span>;
}

function TableauGroupes({ groupes, libelle }) {
  return (
    <table>
      <tbody>
        {groupes.map((g) => (
          <tr key={g.cle}>
            <td>{libelle(g.cle)}</td>
            <td>{g.total}</td>
            <td>
              <Precision valeur={g.precision} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Onglet Statistiques : précision des réponses d'entraînement. */
export function Statistiques({ charts, historique }) {
  const [erreursOuvertes, setErreursOuvertes] = useState(false);
  const global = useMemo(() => resumer(historique), [historique]);
  const parFamille = useMemo(() => regrouper(historique, (r) => r.famille), [historique]);
  const parChart = useMemo(() => regrouper(historique, (r) => r.chartId), [historique]);
  const parAction = useMemo(() => regrouper(historique, (r) => r.attendu), [historique]);
  const parMain = useMemo(
    () =>
      regrouper(historique, (r) => r.main).sort(
        (a, b) => (a.precision ?? 101) - (b.precision ?? 101) || b.total - a.total,
      ),
    [historique],
  );
  const erreurs = useMemo(() => [...historique].filter((r) => !r.correct).reverse(), [historique]);

  if (historique.length === 0)
    return (
      <section className="panneau">
        <p>
          Aucune réponse enregistrée pour l'instant. Lance-toi dans l'
          <strong>Entraînement</strong> !
        </p>
      </section>
    );

  return (
    <section className="stats">
      <div className="panneau">
        <h2>Précision globale</h2>
        <p className="stat-globale">
          <Precision valeur={global.precision} />{" "}
          <span className="muet">
            ({global.bonnes} bonnes réponses sur {global.total})
          </span>
        </p>
      </div>
      <div className="colonnes-stats">
        <div className="panneau">
          <h3>Par famille de situations</h3>
          <TableauGroupes groupes={parFamille} libelle={(cle) => FAMILLES[cle]?.nom || cle} />
        </div>
        <div className="panneau">
          <h3>Par tableau</h3>
          <TableauGroupes
            groupes={parChart}
            libelle={(cle) => charts.find((c) => c.id === cle)?.titre_origine || cle}
          />
        </div>
        <div className="panneau">
          <h3>Par action attendue</h3>
          <table>
            <tbody>
              {parAction.map((g) => (
                <tr key={g.cle}>
                  <td>
                    <span className={`pastille action-${g.cle}`} /> {LIBELLES_ACTIONS[g.cle] || g.cle}
                  </td>
                  <td>{g.total}</td>
                  <td>
                    <Precision valeur={g.precision} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panneau">
          <h3>Par main (les plus ratées d'abord)</h3>
          <div className="liste-mains">
            <TableauGroupes groupes={parMain} libelle={(cle) => cle} />
          </div>
        </div>
      </div>
      <div className="panneau">
        <h3>
          <button className="bouton discret" onClick={() => setErreursOuvertes((o) => !o)}>
            {erreursOuvertes ? "▼" : "▶"} Mes erreurs ({erreurs.length})
          </button>
        </h3>
        {erreursOuvertes && (
          <div className="liste-erreurs">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Tableau</th>
                  <th>Main</th>
                  <th>Profondeur</th>
                  <th>Ma réponse</th>
                  <th>Attendu</th>
                </tr>
              </thead>
              <tbody>
                {erreurs.map((r, i) => (
                  <tr key={i}>
                    <td>{new Date(r.date).toLocaleString("fr-FR")}</td>
                    <td>{r.chartTitre}</td>
                    <td>
                      {r.cartes} ({r.main})
                    </td>
                    <td>{formatBb(r.profondeur)}</td>
                    <td className="mauvaise-reponse">{labelAction(r.famille, r.reponse)}</td>
                    <td className="bonne-reponse">{labelAction(r.famille, r.attendu)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
