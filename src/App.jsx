import { useEffect, useMemo, useState } from "react";
import donnees from "./data/ranges.json";
import { construireCharts } from "./lib/charts.js";
import { lireLocal, ecrireLocal, supprimerLocal, lireBase, ecrireBase } from "./lib/stockage.js";
import { Entrainement } from "./components/Entrainement.jsx";
import { Statistiques } from "./components/Statistiques.jsx";
import { Analyse } from "./components/Analyse.jsx";
import { Ranges } from "./components/Ranges.jsx";
import { Reglages } from "./components/Reglages.jsx";
import { Situation } from "./components/Situation.jsx";

function reglagesParDefaut() {
  return {
    chartsActifs: donnees.charts.map((c) => c.id),
    repetitionEspacee: true,
    erreursUniquement: false,
    sonsActifs: true,
  };
}

const ONGLETS = [
  { id: "entrainement", nom: "Entraînement" },
  { id: "stats", nom: "Statistiques" },
  { id: "analyse", nom: "Analyse" },
  { id: "situation", nom: "Situation" },
  { id: "ranges", nom: "Ranges" },
  { id: "reglages", nom: "Réglages" },
];

export default function App() {
  const [onglet, setOnglet] = useState("entrainement");
  const [overrides, setOverrides] = useState(() => lireLocal("overrides", {}));
  const [historique, setHistorique] = useState(() => lireLocal("historique", []));
  const [poids, setPoids] = useState(() => lireLocal("poids", {}));
  const [reglages, setReglages] = useState(() => ({ ...reglagesParDefaut(), ...lireLocal("reglages", {}) }));
  const [analyse, setAnalyse] = useState({ version: 1, mains: [] });
  const [analyseChargee, setAnalyseChargee] = useState(false);
  const [sauvegardeOk, setSauvegardeOk] = useState(true);

  // Chargement de la base de mains : IndexedDB, avec migration de l'ancien
  // stockage localStorage ("expresso.analyse") si présent.
  useEffect(() => {
    let annule = false;
    (async () => {
      const depuisBase = await lireBase("analyse");
      const depuisLocal = lireLocal("analyse", null);
      const ids = new Set();
      const mains = [];
      for (const main of [...(depuisBase?.mains || []), ...(depuisLocal?.mains || [])])
        if (!ids.has(main.id)) {
          ids.add(main.id);
          mains.push(main);
        }
      const empreintes = new Set();
      const fichiers = [];
      for (const fichier of [...(depuisBase?.fichiers || []), ...(depuisLocal?.fichiers || [])])
        if (!empreintes.has(fichier.empreinte)) {
          empreintes.add(fichier.empreinte);
          fichiers.push(fichier);
        }
      const fusion = { version: 1, mains, fichiers };
      if (depuisLocal?.mains?.length && (await ecrireBase("analyse", fusion))) {
        const relu = await lireBase("analyse");
        if (relu && relu.mains.length >= mains.length) supprimerLocal("analyse");
      }
      if (!annule) {
        setAnalyse(fusion);
        setAnalyseChargee(true);
      }
    })();
    return () => {
      annule = true;
    };
  }, []);

  useEffect(() => {
    ecrireLocal("overrides", overrides);
  }, [overrides]);
  useEffect(() => {
    ecrireLocal("historique", historique);
  }, [historique]);
  useEffect(() => {
    ecrireLocal("poids", poids);
  }, [poids]);
  useEffect(() => {
    ecrireLocal("reglages", reglages);
  }, [reglages]);
  useEffect(() => {
    if (!analyseChargee) return;
    let annule = false;
    ecrireBase("analyse", analyse).then((ok) => {
      if (!annule) setSauvegardeOk(ok);
    });
    return () => {
      annule = true;
    };
  }, [analyse, analyseChargee]);

  const charts = useMemo(() => construireCharts(donnees, overrides), [overrides]);

  return (
    <div className="app">
      <header className="entete">
        <h1>
          Expresso <span className="accent">Trainer</span>
        </h1>
        <nav className="onglets">
          {ONGLETS.map((o) => (
            <button
              key={o.id}
              className={onglet === o.id ? "onglet actif" : "onglet"}
              onClick={() => setOnglet(o.id)}
            >
              {o.nom}
            </button>
          ))}
        </nav>
      </header>
      <main className="contenu">
        {onglet === "entrainement" && (
          <Entrainement
            charts={charts}
            reglages={reglages}
            setReglages={setReglages}
            poids={poids}
            setPoids={setPoids}
            setHistorique={setHistorique}
          />
        )}
        {onglet === "stats" && <Statistiques charts={charts} historique={historique} />}
        {onglet === "analyse" && (
          <Analyse
            charts={charts}
            analyse={analyse}
            setAnalyse={setAnalyse}
            chargee={analyseChargee}
            sauvegardeOk={sauvegardeOk}
          />
        )}
        {onglet === "situation" && <Situation />}
        {onglet === "ranges" && (
          <Ranges donnees={donnees} charts={charts} overrides={overrides} setOverrides={setOverrides} />
        )}
        {onglet === "reglages" && (
          <Reglages
            donnees={donnees}
            charts={charts}
            reglages={reglages}
            setReglages={setReglages}
            overrides={overrides}
            setOverrides={setOverrides}
            historique={historique}
            setHistorique={setHistorique}
            poids={poids}
            setPoids={setPoids}
            analyse={analyse}
            setAnalyse={setAnalyse}
          />
        )}
      </main>
    </div>
  );
}
