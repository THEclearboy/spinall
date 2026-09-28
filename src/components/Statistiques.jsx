import { useMemo, useState } from "react";
import { Bento, Tuile, Pilule } from "./ui/Tuile.jsx";
import { Jauge } from "./graphes/Jauge.jsx";
import { Anneaux } from "./graphes/Anneaux.jsx";
import { ListeValeurs } from "./graphes/ListeValeurs.jsx";
import { FAMILLES, labelAction } from "../lib/charts.js";
import { resumer, regrouper } from "../lib/statistiques.js";
import { formatBb } from "../lib/format.js";

const LIBELLES_ACTIONS = {
  allin: "All-in",
  call: "Call / Limp / Check",
  raise: "Raise",
  fold: "Fold",
};
const COULEURS_ACTIONS = { allin: "var(--allin)", call: "var(--call)", raise: "var(--raise)", fold: "#6b6b6b" };
const COULEURS_ANNEAUX = ["#d9ff5a", "#a8d43a", "#6f8f2a"];

export function Precision({ valeur }) {
  if (valeur === null) return <span className="muet">—</span>;
  const niveau = valeur >= 90 ? "ok" : valeur >= 70 ? "moyen" : "alerte";
  return <span className={`precision ${niveau}`}>{valeur} %</span>;
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
      <Bento>
        <Tuile variante="sombre" span={12} titre="Statistiques">
          <p className="tuile-grand" style={{ fontSize: "1.6rem" }}>
            Aucune réponse enregistrée pour l'instant.
          </p>
          <p className="muet">Lance-toi dans l'Entraînement : chaque réponse alimente cet écran.</p>
        </Tuile>
      </Bento>
    );

  const familles = Object.values(FAMILLES);
  const seriesFamilles = familles.map((f, i) => {
    const g = parFamille.find((p) => p.cle === f.id);
    return { label: f.nom, valeur: g && g.precision !== null ? g.precision / 100 : 0, couleur: COULEURS_ANNEAUX[i], total: g?.total || 0, precision: g?.precision ?? null };
  });

  return (
    <section className="stats">
      <Bento>
        <Tuile variante="jaune" span={4} titre="Précision globale" sous={`${global.total} réponses`} action={<Pilule variante="sombre">{global.bonnes} bonnes</Pilule>}>
          <Jauge valeur={global.precision === null ? null : global.precision / 100} centre={global.precision === null ? "—" : `${global.precision}%`} />
          <p className="tuile-legende">Part de bonnes réponses sur l'ensemble de tes sessions d'entraînement.</p>
        </Tuile>

        <Tuile variante="vert" span={4} titre="Par famille de situations" sous="précision par situation">
          <div className="anneaux-bloc">
            <Anneaux series={seriesFamilles} centre={global.precision === null ? "—" : `${global.precision}%`} />
            <ListeValeurs
              lignes={seriesFamilles.map((s) => ({
                cle: s.label,
                label: s.label,
                couleur: s.couleur,
                valeur: s.precision === null ? "—" : `${s.precision} %`,
              }))}
            />
          </div>
        </Tuile>

        <Tuile variante="sombre" span={4} titre="Par tableau" sous="précision et nombre de réponses">
          <ListeValeurs
            lignes={parChart.map((g) => ({
              cle: g.cle,
              label: charts.find((c) => c.id === g.cle)?.titre_origine || g.cle,
              valeur: (
                <>
                  <Precision valeur={g.precision} /> <span className="muet">· {g.total}</span>
                </>
              ),
            }))}
          />
        </Tuile>

        <Tuile variante="lavande" span={4} titre="Par action attendue" sous="quand la bonne réponse était…">
          <div className="barres-h">
            {parAction.map((g) => (
              <div key={g.cle} className="barre-h">
                <div className="barre-h-entete">
                  <span>
                    <span className="lv-pastille" style={{ background: COULEURS_ACTIONS[g.cle] || "#666" }} /> {LIBELLES_ACTIONS[g.cle] || g.cle}
                  </span>
                  <span>
                    <strong>{g.precision === null ? "—" : `${g.precision} %`}</strong> <span className="muet">· {g.total}</span>
                  </span>
                </div>
                <div className="barre-h-piste">
                  <div className="barre-h-valeur" style={{ width: `${g.precision || 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Tuile>

        <Tuile variante="blanc" span={8} titre="Par main" sous="les plus ratées d'abord">
          <div className="liste-mains">
            <table>
              <thead>
                <tr>
                  <th>Main</th>
                  <th>Réponses</th>
                  <th>Précision</th>
                </tr>
              </thead>
              <tbody>
                {parMain.map((g) => (
                  <tr key={g.cle}>
                    <td>
                      <strong>{g.cle}</strong>
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
        </Tuile>

        <Tuile
          variante="sombre"
          span={12}
          titre={`Mes erreurs (${erreurs.length})`}
          sous="les dernières d'abord"
          action={
            <Pilule variante="lime" onClick={() => setErreursOuvertes((o) => !o)}>
              {erreursOuvertes ? "Masquer" : "Voir tout"}
            </Pilule>
          }
        >
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
        </Tuile>
      </Bento>
    </section>
  );
}
