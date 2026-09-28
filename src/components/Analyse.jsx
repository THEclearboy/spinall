import { useMemo, useRef, useState } from "react";
import { CarteInline } from "./Carte.jsx";
import { GrilleMains, Legende } from "./Grille.jsx";
import { CartesKpi } from "./CartesKpi.jsx";
import { DetailMain } from "./DetailMain.jsx";
import { RapportImpression } from "./RapportImpression.jsx";
import { GrapheBankroll } from "./graphes/GrapheBankroll.jsx";
import { GrapheParties } from "./graphes/GrapheParties.jsx";
import { GrapheConformite } from "./graphes/GrapheConformite.jsx";
import { GrapheEv, useCalculEv } from "./graphes/GrapheEv.jsx";
import { labelAction } from "../lib/charts.js";
import { calculerStats, positionHero } from "../lib/analyse.js";
import { parseFichier, empreinteFichier, resultatJoueur } from "../lib/historique-mains.js";
import { lireZip, sansBom } from "../lib/zip.js";
import { euros, dateHeure, ordinal, pluriel, formatBbArrondi } from "../lib/format.js";

/** Onglet Analyse : import des historiques Betclic, KPI, graphes, écarts, parties, mains. */
export function Analyse({ charts, analyse, setAnalyse, chargee, sauvegardeOk }) {
  const [rapport, setRapport] = useState(null);
  const [importEnCours, setImportEnCours] = useState(false);
  const [survolDepot, setSurvolDepot] = useState(false);
  const [ecartOuvert, setEcartOuvert] = useState(null);
  const [mainOuverte, setMainOuverte] = useState(null);
  const [filtrePosition, setFiltrePosition] = useState("toutes");
  const [ecartsSeulement, setEcartsSeulement] = useState(false);
  const [showdownSeulement, setShowdownSeulement] = useState(false);
  const [nbAffichees, setNbAffichees] = useState(50);
  const champFichier = useRef(null);

  const stats = useMemo(() => calculerStats(analyse.mains, charts), [analyse.mains, charts]);
  const spotParMain = useMemo(() => {
    const m = new Map();
    for (const spot of stats.spots) m.set(spot.handId, spot);
    return m;
  }, [stats.spots]);
  const resultatParMain = useMemo(() => {
    const m = new Map();
    for (const main of analyse.mains) m.set(main.id, main.hero ? resultatJoueur(main, main.hero) : 0);
    return m;
  }, [analyse.mains]);
  const calculEv = useCalculEv(analyse.mains);
  const cEV = calculEv.points && stats.parties.length > 0 ? calculEv.sommeEv / stats.parties.length : null;
  const reelParPartie =
    calculEv.points && stats.parties.length > 0 ? calculEv.sommeReel / stats.parties.length : null;

  async function importer(fichiers) {
    if (importEnCours) return;
    setImportEnCours(true);
    try {
      const messages = [];
      const textes = [];
      let ignores = 0;
      for (const fichier of [...fichiers]) {
        const nom = fichier.name.toLowerCase();
        if (nom.endsWith(".txt")) textes.push({ nom: fichier.name, texte: sansBom(await fichier.text()) });
        else if (nom.endsWith(".zip")) {
          try {
            const extraits = lireZip(fichier.name, new Uint8Array(await fichier.arrayBuffer()));
            if (extraits.length === 0) messages.push(`${fichier.name} : aucun fichier .txt dans l'archive`);
            textes.push(...extraits);
          } catch {
            messages.push(`${fichier.name} : archive illisible`);
          }
        } else ignores += 1;
      }

      const idsConnus = new Set(analyse.mains.map((m) => m.id));
      const fichiersConnus = new Map((analyse.fichiers || []).map((f) => [f.empreinte, f]));
      const nouveauxFichiers = [];
      const nouvellesMains = [];
      for (const { nom, texte } of textes) {
        try {
          const empreinte = empreinteFichier(texte);
          const deja = fichiersConnus.get(empreinte);
          if (deja) {
            messages.push(
              `${nom} : déjà importé le ${dateHeure(deja.date)}` +
                (deja.nom !== nom ? ` (sous le nom ${deja.nom})` : "") +
                " — ignoré",
            );
            continue;
          }
          const { mains, erreurs } = parseFichier(texte);
          const expresso = mains.filter((m) => !m.modeJeu || m.modeJeu === "Spin");
          const tournois = mains.length - expresso.length;
          let ajoutees = 0;
          let doublons = 0;
          for (const main of expresso) {
            if (idsConnus.has(main.id)) {
              doublons += 1;
              continue;
            }
            idsConnus.add(main.id);
            nouvellesMains.push(main);
            ajoutees += 1;
          }
          if (mains.length === 0 && erreurs.length === 0)
            messages.push(`${nom} : aucune main Betclic reconnue (est-ce bien un export d'historique ?)`);
          else {
            messages.push(
              `${nom} : ${pluriel("main ajoutée", ajoutees)}` +
                (doublons ? `, ${pluriel("déjà connue", doublons)}` : "") +
                (tournois ? `, ${pluriel("main de tournoi ignorée", tournois)} (hors Expresso)` : "") +
                (erreurs.length ? `, ${pluriel("bloc illisible", erreurs.length)}` : ""),
            );
            const fiche = { empreinte, nom, date: Date.now(), nbMains: expresso.length };
            fichiersConnus.set(empreinte, fiche);
            nouveauxFichiers.push(fiche);
          }
        } catch {
          messages.push(`${nom} : fichier illisible`);
        }
      }
      if (ignores > 0) messages.push(`${pluriel("fichier ignoré", ignores)} (seuls les .txt et .zip sont lus)`);
      if (nouvellesMains.length > 0 || nouveauxFichiers.length > 0)
        setAnalyse((a) => {
          const ids = new Set(a.mains.map((m) => m.id));
          const empreintes = new Set((a.fichiers || []).map((f) => f.empreinte));
          return {
            ...a,
            mains: [...a.mains, ...nouvellesMains.filter((m) => !ids.has(m.id))],
            fichiers: [...(a.fichiers || []), ...nouveauxFichiers.filter((f) => !empreintes.has(f.empreinte))],
          };
        });
      if (messages.length > 0) setRapport(messages);
    } finally {
      setImportEnCours(false);
    }
  }

  function viderBase() {
    if (window.confirm("Supprimer toutes les mains importées ? (les stats d’entraînement ne sont pas touchées)")) {
      setAnalyse((a) => ({ ...a, mains: [], fichiers: [] }));
      setRapport(null);
    }
  }

  function imprimer() {
    try {
      window.print();
    } catch {
      window.alert("L'impression n'est pas disponible ici — utilise la version locale de l'app.");
    }
  }

  const chartsParId = useMemo(() => new Map(charts.map((c) => [c.id, c])), [charts]);
  const conformite = useMemo(() => {
    const parChart = new Map(stats.conformiteParChart.map((l) => [l.chartId, l]));
    return charts.filter((c) => parChart.has(c.id)).map((c) => parChart.get(c.id));
  }, [stats.conformiteParChart, charts]);
  const mainsFiltrees = useMemo(() => {
    let liste = [...analyse.mains].sort((a, b) => (b.date || 0) - (a.date || 0));
    if (filtrePosition !== "toutes") liste = liste.filter((m) => positionHero(m) === filtrePosition);
    if (ecartsSeulement) liste = liste.filter((m) => spotParMain.get(m.id)?.conforme === false);
    if (showdownSeulement) liste = liste.filter((m) => m.combinaisons[m.hero] !== undefined);
    return liste;
  }, [analyse.mains, filtrePosition, ecartsSeulement, showdownSeulement, spotParMain]);
  const ecarts = useMemo(() => [...stats.ecarts].reverse(), [stats.ecarts]);

  return (
    <section className="analyse">
      <div
        className={survolDepot ? "panneau depot survol" : "panneau depot"}
        onDragOver={(e) => {
          e.preventDefault();
          setSurvolDepot(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setSurvolDepot(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setSurvolDepot(false);
          importer(e.dataTransfer.files);
        }}
      >
        <h2>Importer des historiques Betclic</h2>
        <p className="muet">
          Glisse ici un ou <strong>plusieurs</strong> fichiers d'export (menu « Historique des mains »
          du client Betclic) — fichiers .txt ou <strong>archives .zip</strong> contenant plusieurs
          journées, ou{" "}
          <button className="bouton petit" onClick={() => champFichier.current?.click()} disabled={importEnCours}>
            {importEnCours ? "import en cours…" : "choisis des fichiers…"}
          </button>{" "}
          Un fichier déjà importé (même renommé) est refusé, et les mains en double sont ignorées
          automatiquement : impossible de compter deux fois une session.
        </p>
        <input
          ref={champFichier}
          type="file"
          accept=".txt,.zip,text/plain,application/zip"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            importer(e.target.files);
            e.target.value = "";
          }}
        />
        {rapport && rapport.length > 0 && (
          <ul className="rapport-import">
            {rapport.map((ligne, i) => (
              <li key={i}>{ligne}</li>
            ))}
          </ul>
        )}
        {analyse.mains.length > 0 && (
          <p className="muet">
            Base : <strong>{pluriel("main", analyse.mains.length)}</strong>, {pluriel("partie", stats.parties.length)}
            {(analyse.fichiers || []).length > 0 && `, ${pluriel("fichier", analyse.fichiers.length)}`}.{" "}
            <button
              className="bouton petit"
              onClick={imprimer}
              disabled={!calculEv.points}
              title="Ouvre le dialogue d'impression : choisis « Enregistrer en PDF »"
            >
              {calculEv.points ? "Exporter le rapport (PDF)" : "Rapport : calcul en cours…"}
            </button>{" "}
            <button className="bouton petit danger" onClick={viderBase}>
              Vider la base
            </button>
            {!sauvegardeOk && (
              <span className="alerte-stockage" role="alert">
                {" "}
                ⚠ La base n'a pas pu être enregistrée par le navigateur : elle restera en mémoire pour
                cette session mais ne sera pas conservée. Exporte tes données (Réglages).
              </span>
            )}
          </p>
        )}
        {(analyse.fichiers || []).length > 0 && (
          <details className="liste-fichiers">
            <summary className="muet">Fichiers déjà importés</summary>
            <ul className="rapport-import">
              {[...analyse.fichiers].reverse().map((f) => (
                <li key={f.empreinte}>
                  {f.nom} — {pluriel("main", f.nbMains)}, importé le {dateHeure(f.date)}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {!chargee ? (
        <div className="panneau">
          <p className="muet">Chargement de la base de mains…</p>
        </div>
      ) : analyse.mains.length === 0 ? (
        <div className="panneau">
          <p className="muet">
            Aucune main pour l'instant. Depuis le client Betclic : Mon compte → Historique des mains →
            Exporter, puis dépose les fichiers ci-dessus.
          </p>
        </div>
      ) : (
        <>
          <CartesKpi stats={stats} cEV={cEV} reelParPartie={reelParPartie} />

          {stats.courbe.length >= 2 && (
            <div className="panneau">
              <h3>Net cumulé (€), partie après partie</h3>
              <GrapheBankroll courbe={stats.courbe} />
              {stats.parties.some((p) => !p.resultatConnu) && (
                <p className="muet">
                  ⚠ {stats.parties.filter((p) => !p.resultatConnu).length} partie(s) sans ligne de
                  résultat dans l'export (comptées comme buy-in perdu).
                </p>
              )}
            </div>
          )}

          {analyse.mains.length >= 2 && (
            <div className="panneau">
              <h3>Jetons gagnés, main après main — réel vs attendu</h3>
              <p className="muet">
                Quand un tapis est payé avant la river, la courbe « attendu » remplace le résultat par
                pot × ton équité au moment de l'all-in. Si le réel est sous l'attendu, tu es malchanceux
                à tapis (et inversement) — c'est la variance, pas ton jeu.
              </p>
              <GrapheEv calcul={calculEv} />
            </div>
          )}

          <div className="colonnes-graphes">
            {stats.partiesParJour.length > 0 && (
              <div className="panneau">
                <h3>Parties par jour</h3>
                <GrapheParties jours={stats.partiesParJour} />
              </div>
            )}
            {stats.courbeConformite.length >= 2 && (
              <div className="panneau">
                <h3>Respect des ranges — évolution</h3>
                <p className="muet">Moyenne glissante sur les 50 derniers spots joués dans les situations couvertes.</p>
                <GrapheConformite courbe={stats.courbeConformite} />
              </div>
            )}
          </div>

          <div className="panneau">
            <h3>Respect des ranges pré-flop</h3>
            <p className="muet">
              {stats.spots.length} mains jouées dans les 3 situations couvertes par les tableaux (blinds
              postées entières uniquement). Profondeur en bb, stacks avant blinds : en HU, min des deux
              stacks ; en 3-way, min(toi, plus gros adversaire).
            </p>
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
                    <td>
                      <span
                        className={
                          ligne.conformes / ligne.total >= 0.85
                            ? "precision ok"
                            : ligne.conformes / ligne.total >= 0.7
                              ? "precision moyen"
                              : "precision alerte"
                        }
                      >
                        {Math.round((100 * ligne.conformes) / ligne.total)} %
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h4>Écarts ({stats.ecarts.length}) — clique pour voir le tableau</h4>
            <div className="liste-ecarts">
              {ecarts.map((e) => (
                <div key={e.handId} className="ecart">
                  <button
                    className="ligne-ecart"
                    aria-expanded={ecartOuvert === e.handId}
                    onClick={() => setEcartOuvert(ecartOuvert === e.handId ? null : e.handId)}
                  >
                    <span className="muet">{dateHeure(e.date)}</span>
                    <span>
                      {e.cartes.map((c) => (
                        <CarteInline key={c} texte={c} />
                      ))}{" "}
                      <strong>{e.main}</strong> à {formatBbArrondi(e.profondeur)}
                    </span>
                    <span>
                      joué <strong className="mauvaise-reponse">{labelAction(e.familleId, e.jouee)}</strong>,
                      attendu <strong className="bonne-reponse">{labelAction(e.familleId, e.attendu)}</strong>
                    </span>
                    <span className="muet">{e.chartTitre}</span>
                  </button>
                  {ecartOuvert === e.handId && chartsParId.get(e.chartId) && (
                    <div className="detail-ecart">
                      <GrilleMains mains={chartsParId.get(e.chartId).mains} surligne={e.main} />
                      <Legende />
                    </div>
                  )}
                </div>
              ))}
              {stats.ecarts.length === 0 && <p className="muet">Aucun écart — impeccable !</p>}
            </div>
          </div>

          <div className="panneau">
            <h3>Parties ({stats.parties.length})</h3>
            <div className="liste-mains">
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
          </div>

          <div className="panneau">
            <h3>Mains ({mainsFiltrees.length})</h3>
            <div className="filtres-mains">
              <label>
                Position{" "}
                <select value={filtrePosition} onChange={(e) => setFiltrePosition(e.target.value)}>
                  <option value="toutes">toutes</option>
                  <option value="HU-SB">HU — SB</option>
                  <option value="HU-BB">HU — BB</option>
                  <option value="3W-BTN">3-way — BTN</option>
                  <option value="3W-SB">3-way — SB</option>
                  <option value="3W-BB">3-way — BB</option>
                </select>
              </label>
              <label className="interrupteur">
                <input type="checkbox" checked={ecartsSeulement} onChange={(e) => setEcartsSeulement(e.target.checked)} />
                Écarts de range uniquement
              </label>
              <label className="interrupteur">
                <input
                  type="checkbox"
                  checked={showdownSeulement}
                  onChange={(e) => setShowdownSeulement(e.target.checked)}
                />
                Showdown uniquement
              </label>
            </div>
            <div className="liste-tables-mains">
              {mainsFiltrees.slice(0, nbAffichees).map((main) => {
                const spot = spotParMain.get(main.id);
                const bigBlind = main.blinds[1];
                const resultat = resultatParMain.get(main.id) || 0;
                const ouverte = mainOuverte === main.id;
                return (
                  <div key={main.id} className="main-jouee">
                    <button
                      className="ligne-main"
                      aria-expanded={ouverte}
                      onClick={() => setMainOuverte(ouverte ? null : main.id)}
                    >
                      <span className="muet">{dateHeure(main.date)}</span>
                      <span>{positionHero(main) || "?"}</span>
                      <span>
                        {(main.cartes[main.hero] || []).map((c) => (
                          <CarteInline key={c} texte={c} />
                        ))}
                      </span>
                      <span className={resultat >= 0 ? "bonne-reponse" : "mauvaise-reponse"}>
                        {resultat >= 0 ? "+" : ""}
                        {(resultat / bigBlind).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} bb
                      </span>
                      <span>
                        {spot ? (
                          spot.conforme ? (
                            <span className="badge-conforme">✓ range</span>
                          ) : (
                            <span className="badge-ecart">✘ écart</span>
                          )
                        ) : (
                          <span className="muet">hors tableaux</span>
                        )}
                      </span>
                    </button>
                    {ouverte && <DetailMain main={main} spot={spot} chartsParId={chartsParId} />}
                  </div>
                );
              })}
            </div>
            {mainsFiltrees.length > nbAffichees && (
              <button className="bouton" onClick={() => setNbAffichees((n) => n + 100)}>
                Afficher plus ({pluriel("restante", mainsFiltrees.length - nbAffichees)})
              </button>
            )}
          </div>

          <RapportImpression
            analyse={analyse}
            stats={stats}
            calculEv={calculEv}
            conformite={conformite}
            cEV={cEV}
            reelParPartie={reelParPartie}
          />
        </>
      )}
    </section>
  );
}
