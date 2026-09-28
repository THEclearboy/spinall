import { useCallback, useEffect, useMemo, useState } from "react";
import { TableScene } from "./TableScene.jsx";
import { GrilleMains, Legende } from "./Grille.jsx";
import { texteCarte } from "../lib/cartes.js";
import { actionAttendue, labelAction } from "../lib/charts.js";
import { tirerQuestion, majPoids } from "../lib/entrainement.js";
import { sonBonneReponse, sonMauvaiseReponse } from "../lib/sons.js";

/** Onglet Entraînement : une main, un stack, une décision. */
export function Entrainement({ charts, reglages, setReglages, poids, setPoids, setHistorique }) {
  const chartsActifs = useMemo(
    () => charts.filter((c) => reglages.chartsActifs.includes(c.id)),
    [charts, reglages.chartsActifs],
  );
  const [question, setQuestion] = useState(null);
  const [phase, setPhase] = useState("question"); // "question" | "feedback"
  const [resultat, setResultat] = useState(null);
  const [tableauDemande, setTableauDemande] = useState(false);
  const [serie, setSerie] = useState(0);
  const [record, setRecord] = useState(0);
  const [session, setSession] = useState({ total: 0, bonnes: 0 });

  const suivante = useCallback(() => {
    setQuestion(
      tirerQuestion(chartsActifs, poids, {
        repetitionEspacee: reglages.repetitionEspacee,
        erreursUniquement: reglages.erreursUniquement,
      }),
    );
    setPhase("question");
    setResultat(null);
    setTableauDemande(false);
  }, [chartsActifs, poids, reglages.repetitionEspacee, reglages.erreursUniquement]);

  useEffect(() => {
    suivante();
    // Nouvelle question seulement quand la sélection ou le mode change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartsActifs, reglages.erreursUniquement]);

  useEffect(() => {
    const surTouche = (e) => {
      if (phase === "feedback" && e.key === "Enter") suivante();
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [phase, suivante]);

  function repondre(action) {
    if (phase !== "question" || !question) return;
    const attendu = actionAttendue(question.chart, question.main);
    const correct = action === attendu;
    setResultat({ action, attendu, correct });
    setPhase("feedback");
    if (correct) {
      sonBonneReponse(reglages.sonsActifs);
      setSerie((s) => {
        const suivante = s + 1;
        setRecord((r) => Math.max(r, suivante));
        return suivante;
      });
    } else {
      sonMauvaiseReponse(reglages.sonsActifs);
      setSerie(0);
    }
    setSession((s) => ({ total: s.total + 1, bonnes: s.bonnes + (correct ? 1 : 0) }));
    setPoids((p) => majPoids(p, question.chart.id, question.main, correct));
    setHistorique((h) => [
      ...h,
      {
        date: new Date().toISOString(),
        chartId: question.chart.id,
        chartTitre: question.chart.titre_origine,
        famille: question.chart.famille.id,
        main: question.main,
        cartes: question.cartes.map(texteCarte).join(" "),
        profondeur: question.profondeur,
        reponse: action,
        attendu,
        correct,
      },
    ]);
  }

  if (chartsActifs.length === 0)
    return (
      <section className="panneau">
        <p>
          Aucun tableau n'est activé. Va dans <strong>Réglages</strong> pour en sélectionner.
        </p>
      </section>
    );

  if (!question)
    return (
      <section className="panneau">
        <p>
          Mode <strong>Erreurs uniquement</strong> : aucune erreur enregistrée pour les tableaux
          sélectionnés. Bravo — ou entraîne-toi d'abord en mode normal !
        </p>
        <button
          className="bouton"
          onClick={() => setReglages((r) => ({ ...r, erreursUniquement: false }))}
        >
          Repasser en mode normal
        </button>
      </section>
    );

  const famille = question.chart.famille;
  const enFeedback = phase === "feedback";
  const montrerTableau = (enFeedback && !resultat.correct) || (enFeedback && tableauDemande);

  return (
    <section className="entrainement">
      <div className="bandeau-score">
        <span>
          Série : <strong>{serie}</strong> 🔥 (record {record})
        </span>
        <span>
          Session : <strong>{session.bonnes}</strong> / {session.total}
        </span>
        {question.issueDeRevision && <span className="etiquette-revision">Révision</span>}
        <label className="interrupteur">
          <input
            type="checkbox"
            checked={reglages.erreursUniquement}
            onChange={(e) => setReglages((r) => ({ ...r, erreursUniquement: e.target.checked }))}
          />
          Erreurs uniquement
        </label>
      </div>
      <div className={montrerTableau ? "zone-jeu avec-tableau" : "zone-jeu"}>
        <TableScene
          famille={famille.id}
          cartes={question.cartes}
          profondeur={question.profondeur}
          contexte={famille.contexte}
        >
          <div className="panneau-actions">
            {famille.boutons.map((bouton) => {
              let classe = `bouton-poker action-${bouton.action}`;
              if (enFeedback) {
                if (bouton.action === resultat.attendu) classe += " correcte";
                else if (bouton.action === resultat.action) classe += " fausse";
                else classe += " estompee";
              }
              return (
                <button
                  key={bouton.action}
                  className={classe}
                  onClick={() => repondre(bouton.action)}
                  disabled={enFeedback}
                >
                  {bouton.label}
                </button>
              );
            })}
          </div>
          {enFeedback && (
            <div className={resultat.correct ? "toast bon" : "toast mauvais"}>
              <p className="verdict">
                {resultat.correct ? "✔ Correct !" : "✘ Raté."} <strong>{question.main}</strong> à
                ce stack = <strong>{labelAction(famille.id, resultat.attendu)}</strong>
              </p>
              <div className="toast-boutons">
                <button className="bouton principal" onClick={suivante} autoFocus>
                  Suivante (Entrée)
                </button>
                {resultat.correct && !tableauDemande && (
                  <button className="bouton" onClick={() => setTableauDemande(true)}>
                    Voir le tableau
                  </button>
                )}
              </div>
            </div>
          )}
        </TableScene>
        {montrerTableau && (
          <aside className="panneau-tableau">
            <h3>{question.chart.titre_origine}</h3>
            <p className="sous-titre-tableau">
              Ta main : <strong>{question.cartes.map(texteCarte).join(" ")}</strong> ={" "}
              <strong>{question.main}</strong> — attendu :{" "}
              <strong>{labelAction(famille.id, resultat.attendu)}</strong>
            </p>
            <GrilleMains mains={question.chart.mains} surligne={question.main} />
            <Legende />
          </aside>
        )}
      </div>
    </section>
  );
}
