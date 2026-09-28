import { useRef } from "react";
import { FAMILLES } from "../lib/charts.js";
import { telechargerJson, lireFichierJson } from "../lib/stockage.js";

/** Onglet Réglages : tableaux actifs, options d'entraînement, export/import des données. */
export function Reglages({
  donnees,
  charts,
  reglages,
  setReglages,
  overrides,
  setOverrides,
  historique,
  setHistorique,
  poids,
  setPoids,
  analyse,
  setAnalyse,
}) {
  const champFichier = useRef(null);

  function basculerChart(id) {
    setReglages((r) => {
      const actifs = r.chartsActifs.includes(id)
        ? r.chartsActifs.filter((c) => c !== id)
        : [...r.chartsActifs, id];
      return { ...r, chartsActifs: actifs };
    });
  }

  function basculerFamille(familleId) {
    const ids = charts.filter((c) => c.famille.id === familleId).map((c) => c.id);
    const tousActifs = ids.every((id) => reglages.chartsActifs.includes(id));
    setReglages((r) => ({
      ...r,
      chartsActifs: tousActifs
        ? r.chartsActifs.filter((id) => !ids.includes(id))
        : [...new Set([...r.chartsActifs, ...ids])],
    }));
  }

  function reinitialiserStats() {
    if (window.confirm("Réinitialiser toutes les statistiques et l’historique des erreurs ?")) {
      setHistorique([]);
      setPoids({});
    }
  }

  function exporterTout() {
    telechargerJson(
      {
        application: "expresso-trainer",
        version_export: 2,
        date_export: new Date().toISOString(),
        overrides,
        historique,
        poids,
        reglages,
        analyse,
      },
      "expresso-trainer-donnees.json",
    );
  }

  async function importerTout(e) {
    const fichier = e.target.files?.[0];
    e.target.value = "";
    if (!fichier) return;
    try {
      const contenu = await lireFichierJson(fichier);
      if (contenu.application !== "expresso-trainer") {
        window.alert("Ce fichier ne ressemble pas à un export Expresso Trainer.");
        return;
      }
      if (!window.confirm("Remplacer toutes les données actuelles par celles du fichier ?")) return;
      setOverrides(contenu.overrides || {});
      setHistorique(contenu.historique || []);
      setPoids(contenu.poids || {});
      if (contenu.reglages) setReglages((r) => ({ ...r, ...contenu.reglages }));
      if (contenu.analyse) setAnalyse(contenu.analyse);
      window.alert("Import terminé.");
    } catch {
      window.alert("Fichier illisible : import annulé.");
    }
  }

  return (
    <section className="reglages">
      <div className="panneau">
        <h2>Situations à travailler</h2>
        <p className="muet">
          Décoche les familles ou tableaux que tu ne veux pas réviser pour l'instant.
        </p>
        {Object.values(FAMILLES).map((famille) => {
          const chartsFamille = charts.filter((c) => c.famille.id === famille.id);
          const tousActifs = chartsFamille.every((c) => reglages.chartsActifs.includes(c.id));
          return (
            <div key={famille.id} className="groupe-reglage">
              <label className="interrupteur titre-famille">
                <input type="checkbox" checked={tousActifs} onChange={() => basculerFamille(famille.id)} />
                <strong>{famille.nom}</strong>
              </label>
              <div className="sous-liste">
                {chartsFamille.map((c) => (
                  <label key={c.id} className="interrupteur">
                    <input
                      type="checkbox"
                      checked={reglages.chartsActifs.includes(c.id)}
                      onChange={() => basculerChart(c.id)}
                    />
                    {c.titre_origine}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="panneau">
        <h2>Entraînement</h2>
        <label className="interrupteur">
          <input
            type="checkbox"
            checked={reglages.repetitionEspacee}
            onChange={(e) => setReglages((r) => ({ ...r, repetitionEspacee: e.target.checked }))}
          />
          Répétition espacée : refaire apparaître plus souvent les mains où je me trompe
        </label>
        <label className="interrupteur">
          <input
            type="checkbox"
            checked={reglages.erreursUniquement}
            onChange={(e) => setReglages((r) => ({ ...r, erreursUniquement: e.target.checked }))}
          />
          Mode « Erreurs uniquement » : ne travailler que mes fautes passées
        </label>
        <label className="interrupteur">
          <input
            type="checkbox"
            checked={reglages.sonsActifs}
            onChange={(e) => setReglages((r) => ({ ...r, sonsActifs: e.target.checked }))}
          />
          Sons de feedback
        </label>
      </div>
      <div className="panneau">
        <h2>Données</h2>
        <div className="barre-actions">
          <button className="bouton" onClick={exporterTout}>
            Exporter toutes mes données (JSON)
          </button>
          <button className="bouton" onClick={() => champFichier.current?.click()}>
            Importer des données…
          </button>
          <input
            ref={champFichier}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={importerTout}
          />
          <button className="bouton danger" onClick={reinitialiserStats}>
            Réinitialiser les statistiques
          </button>
        </div>
        <p className="muet">
          L'export contient : ranges corrigées, historique des réponses, poids de révision, réglages
          et la base des mains importées ({analyse.mains.length} mains). Source des ranges :{" "}
          {donnees.source}
        </p>
      </div>
    </section>
  );
}
