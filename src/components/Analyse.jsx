import { useEffect, useMemo, useRef, useState } from "react";
import { Bento, Tuile, Pilule } from "./ui/Tuile.jsx";
import { CarteInline } from "./Carte.jsx";
import { GrilleMains, Legende } from "./Grille.jsx";
import { DetailMain } from "./DetailMain.jsx";
import { RapportImpression } from "./RapportImpression.jsx";
import { Courbe } from "./graphes/Courbe.jsx";
import { Anneaux, Anneau } from "./graphes/Anneaux.jsx";
import { Jauge } from "./graphes/Jauge.jsx";
import { Segments } from "./graphes/Segments.jsx";
import { BarresJours } from "./graphes/BarresJours.jsx";
import { CalendrierHeures } from "./graphes/CalendrierHeures.jsx";
import { ListeValeurs } from "./graphes/ListeValeurs.jsx";
import { useCalculEv, cumulerEv } from "./graphes/GrapheEv.jsx";
import { FAMILLES, labelAction } from "../lib/charts.js";
import { calculerStats, positionHero } from "../lib/analyse.js";
import { parseFichier, empreinteFichier, resultatJoueur } from "../lib/historique-mains.js";
import { lireZip, sansBom } from "../lib/zip.js";
import { bilanParLimite, limitesPresentes } from "../lib/limites.js";
import { heuresParJour, totalHeuresMois, formatHeures } from "../lib/heures.js";
import { lireLocal, ecrireLocal } from "../lib/stockage.js";
import { euros, pourcent, dateHeure, ordinal, pluriel, formatBbArrondi } from "../lib/format.js";

const signe = (v) => (v >= 0 ? "+" : "");
const unDecimal = (v) => v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const COULEURS_ANNEAUX = ["#d9ff5a", "#a8d43a", "#6f8f2a"];

function cleMois(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Onglet Analyse : import des historiques Betclic et tableau de bord. */
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
  const [limite, setLimite] = useState(null); // buy-in affiché (null = toutes)
  const [periodeJours, setPeriodeJours] = useState(30); // 7, 30 ou 0 (tout)
  const [moisCalendrier, setMoisCalendrier] = useState(null);
  const [correctionsHeures, setCorrectionsHeures] = useState(() => lireLocal("heures", {}));
  const champFichier = useRef(null);

  useEffect(() => {
    ecrireLocal("heures", correctionsHeures);
  }, [correctionsHeures]);

  const limites = useMemo(() => limitesPresentes(analyse.mains), [analyse.mains]);
  const limiteActive = limite !== null && limites.includes(limite) ? limite : null;
  const mainsScope = useMemo(
    () => (limiteActive === null ? analyse.mains : analyse.mains.filter((m) => m.buyIn === limiteActive)),
    [analyse.mains, limiteActive],
  );
  const stats = useMemo(() => calculerStats(mainsScope, charts), [mainsScope, charts]);
  const spotParMain = useMemo(() => {
    const m = new Map();
    for (const spot of stats.spots) m.set(spot.handId, spot);
    return m;
  }, [stats.spots]);
  const resultatParMain = useMemo(() => {
    const m = new Map();
    for (const main of mainsScope) m.set(main.id, main.hero ? resultatJoueur(main, main.hero) : 0);
    return m;
  }, [mainsScope]);
  const calculEvTotal = useCalculEv(analyse.mains);
  const calculEv = useMemo(
    () =>
      calculEvTotal.parMain
        ? limiteActive === null
          ? calculEvTotal
          : cumulerEv(mainsScope, calculEvTotal.parMain)
        : calculEvTotal,
    [calculEvTotal, mainsScope, limiteActive],
  );
  const bilan = useMemo(() => bilanParLimite(analyse.mains, calculEvTotal.parMain), [analyse.mains, calculEvTotal.parMain]);
  const cEV = calculEv.points && stats.parties.length > 0 ? calculEv.sommeEv / stats.parties.length : null;
  const reelParPartie = calculEv.points && stats.parties.length > 0 ? calculEv.sommeReel / stats.parties.length : null;

  const heures = useMemo(() => heuresParJour(mainsScope, correctionsHeures), [mainsScope, correctionsHeures]);
  const moisAffiche = useMemo(() => {
    if (moisCalendrier) return moisCalendrier;
    const dates = mainsScope.map((m) => m.date).filter(Boolean);
    const ref = dates.length ? new Date(Math.max(...dates)) : new Date();
    return new Date(ref.getFullYear(), ref.getMonth(), 1);
  }, [moisCalendrier, mainsScope]);
  const totalHeures = useMemo(() => {
    let t = 0;
    for (const v of heures.values()) t += v.heures;
    return t;
  }, [heures]);

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
              `${nom} : déjà importé le ${dateHeure(deja.date)}` + (deja.nom !== nom ? ` (sous le nom ${deja.nom})` : "") + " — ignoré",
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
  const conformiteParFamille = useMemo(() => {
    const parFamille = new Map();
    for (const spot of stats.spots) {
      if (!parFamille.has(spot.familleId)) parFamille.set(spot.familleId, { total: 0, conformes: 0 });
      const l = parFamille.get(spot.familleId);
      l.total += 1;
      if (spot.conforme) l.conformes += 1;
    }
    return Object.values(FAMILLES).map((f, i) => {
      const l = parFamille.get(f.id);
      return {
        label: f.nom,
        couleur: COULEURS_ANNEAUX[i],
        valeur: l ? l.conformes / l.total : 0,
        texte: l ? `${Math.round((100 * l.conformes) / l.total)} % · ${l.total}` : "—",
      };
    });
  }, [stats.spots]);
  const mainsFiltrees = useMemo(() => {
    let liste = [...mainsScope].sort((a, b) => (b.date || 0) - (a.date || 0));
    if (filtrePosition !== "toutes") liste = liste.filter((m) => positionHero(m) === filtrePosition);
    if (ecartsSeulement) liste = liste.filter((m) => spotParMain.get(m.id)?.conforme === false);
    if (showdownSeulement) liste = liste.filter((m) => m.combinaisons[m.hero] !== undefined);
    return liste;
  }, [mainsScope, filtrePosition, ecartsSeulement, showdownSeulement, spotParMain]);
  const ecarts = useMemo(() => [...stats.ecarts].reverse(), [stats.ecarts]);
  const partiesRecentes = useMemo(
    () => (periodeJours ? stats.partiesParJour.slice(-periodeJours) : stats.partiesParJour),
    [stats.partiesParJour, periodeJours],
  );
  const nbPartiesPeriode = partiesRecentes.reduce((s, j) => s + j.nb, 0);
  const roi = stats.investi > 0 ? stats.netEuro / stats.investi : null;
  const libelleScope = limiteActive === null ? "toutes limites" : `limite ${euros(limiteActive)}`;

  const nbFichiers = (analyse.fichiers || []).length;
  const dernierJour = mainsScope.reduce((max, m) => (m.date && m.date > max ? m.date : max), 0);
  const premierJour = mainsScope.reduce((min, m) => (m.date && (min === 0 || m.date < min) ? m.date : min), 0);
  const nbJoursJoues = stats.partiesParJour.filter((j) => j.nb > 0).length;

  /* Barre d'import : zone de dépôt sur toute la largeur, rapport replié. */
  const barreImport = (
    <Tuile
      variante="sombre"
      span={12}
      classe={`barre-import${survolDepot ? " survol" : ""}`}
      onClick={undefined}
    >
      <div
        className="barre-import-contenu"
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
        <div className="barre-import-texte">
          <h3 className="tuile-titre">Historiques Betclic</h3>
          <p className="tuile-sous">
            {analyse.mains.length > 0
              ? `${pluriel("main", analyse.mains.length)} · ${pluriel("partie", bilan[bilan.length - 1]?.parties || 0)} · ${pluriel("fichier", nbFichiers)}`
              : "aucune main pour l'instant"}
            {premierJour > 0 && dernierJour > 0 && ` · du ${new Date(premierJour).toLocaleDateString("fr-FR")} au ${new Date(dernierJour).toLocaleDateString("fr-FR")}`}
          </p>
        </div>
        <div className="pilules">
          {limites.length > 1 && (
            <div className="segment">
              <button className={limiteActive === null ? "actif" : ""} onClick={() => setLimite(null)}>
                Toutes
              </button>
              {limites.map((l) => (
                <button key={l} className={limiteActive === l ? "actif" : ""} onClick={() => setLimite(l)}>
                  {euros(l)}
                </button>
              ))}
            </div>
          )}
          {analyse.mains.length > 0 && (
            <>
              <Pilule variante="clair" onClick={imprimer} titre="Ouvre le dialogue d'impression : choisis « Enregistrer en PDF »">
                {calculEvTotal.points ? "Rapport PDF" : "Rapport : calcul…"}
              </Pilule>
              <Pilule variante="clair" onClick={viderBase}>
                Vider la base
              </Pilule>
            </>
          )}
          <Pilule variante="lime" onClick={() => !importEnCours && champFichier.current?.click()} titre="Fichiers .txt ou .zip exportés par le client Betclic">
            {importEnCours ? "Import…" : "+ Ajouter des mains"}
          </Pilule>
        </div>
      </div>
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
      {(rapport?.length > 0 || nbFichiers > 0) && (
        <div className="barre-import-details">
          {rapport && rapport.length > 0 && (
            <details open>
              <summary className="muet">Dernier import : {pluriel("ligne", rapport.length)}</summary>
              <ul className="rapport-import">
                {rapport.map((ligne, i) => (
                  <li key={i}>{ligne}</li>
                ))}
              </ul>
            </details>
          )}
          {nbFichiers > 0 && (
            <details>
              <summary className="muet">{pluriel("fichier importé", nbFichiers)}</summary>
              <ul className="rapport-import">
                {[...analyse.fichiers].reverse().map((f) => (
                  <li key={f.empreinte}>
                    {f.nom} — {pluriel("main", f.nbMains)}, le {dateHeure(f.date)}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      {!sauvegardeOk && (
        <p className="alerte-stockage" role="alert">
          ⚠ La base n'a pas pu être enregistrée par le navigateur : elle restera en mémoire pour cette session seulement. Exporte tes
          données (Réglages).
        </p>
      )}
    </Tuile>
  );

  if (!chargee)
    return (
      <section className="analyse">
        <Bento>
          {barreImport}
          <Tuile variante="blanc" span={12} titre="Chargement">
            <p className="tuile-grand" style={{ fontSize: "1.6rem" }}>
              Chargement de la base de mains…
            </p>
          </Tuile>
        </Bento>
      </section>
    );

  if (analyse.mains.length === 0)
    return (
      <section className="analyse">
        <Bento>
          {barreImport}
          <Tuile variante="lime" span={12} titre="Aucune main pour l'instant" sous="tout commence par un import">
            <p className="tuile-grand" style={{ fontSize: "2rem" }}>
              Exporte ton historique depuis le client Betclic (Mon compte → Historique des mains → Exporter), puis dépose les
              fichiers ici.
            </p>
            <p className="tuile-legende">
              Tu obtiendras : parties et cEV, gains par limite, bankroll, respect des ranges, heures jouées, parties par jour et le
              détail de chaque main.
            </p>
          </Tuile>
        </Bento>
      </section>
    );

  return (
    <section className="analyse">
      <Bento>
        {barreImport}

        {/* ---- Niveau 1 : l'essentiel — volume et cEV, puis argent ---- */}
        <Tuile variante="lime" span={3} titre="Parties" sous={libelleScope}>
          <div className="tuile-grand">{stats.parties.length}</div>
          <p className="tuile-pied">
            {pluriel("main", stats.nbMains)} · {pluriel("jour de jeu", nbJoursJoues)}
          </p>
        </Tuile>

        <Tuile
          variante="blanc"
          span={3}
          titre="cEV / partie"
          sous="jetons gagnés par partie, chance neutralisée"
          action={<Pilule variante="clair" titre="Jetons gagnés en théorie : les tapis payés avant la river sont comptés à leur équité (pot × équité)">?</Pilule>}
        >
          <div className={`tuile-grand ${cEV !== null && cEV < 0 ? "negatif" : "orange"}`}>
            {cEV === null ? "…" : `${signe(cEV)}${unDecimal(cEV)}`}
          </div>
          <p className="tuile-pied">
            {reelParPartie === null ? "calcul en cours" : `réel : ${signe(reelParPartie)}${unDecimal(reelParPartie)} jetons / partie`}
          </p>
        </Tuile>

        <Tuile
          variante="sombre"
          span={3}
          titre="Gain net"
          sous={libelleScope}
          action={roi !== null && <Pilule variante={roi >= 0 ? "lime" : "orange"} classe="delta">ROI {signe(roi)}{pourcent(roi)}</Pilule>}
        >
          <div className={`tuile-grand ${stats.netEuro >= 0 ? "positif" : "negatif"}`}>
            {signe(stats.netEuro)}
            {euros(stats.netEuro)}
          </div>
          <p className="tuile-pied">{euros(stats.investi)} de buy-ins investis</p>
        </Tuile>

        <Tuile variante="sombre" span={3} titre="Par limite" sous="clique sur une ligne pour filtrer">
          <div className="defilant">
            <table className="tableau-limites">
              <thead>
                <tr>
                  <th>Limite</th>
                  <th>Parties</th>
                  <th title="Jetons gagnés par partie, chance neutralisée">cEV</th>
                  <th>Gain</th>
                </tr>
              </thead>
              <tbody>
                {bilan
                  .filter((l) => limites.length > 1 || l.limite !== null)
                  .map((l) => (
                    <tr
                      key={l.limite === null ? "total" : l.limite}
                      className={`ligne-limite${l.limite === null ? " total" : ""}${(limiteActive ?? null) === l.limite ? " active" : ""}`}
                      onClick={() => setLimite(l.limite)}
                    >
                      <td>{l.limite === null ? "Toutes" : euros(l.limite)}</td>
                      <td>{l.parties}</td>
                      <td className={l.cEV === null ? "" : l.cEV >= 0 ? "bonne-reponse" : "mauvaise-reponse"}>
                        {l.cEV === null ? "…" : `${signe(l.cEV)}${unDecimal(l.cEV)}`}
                      </td>
                      <td className={l.netEuro >= 0 ? "bonne-reponse" : "mauvaise-reponse"}>
                        {signe(l.netEuro)}
                        {euros(l.netEuro)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Tuile>

        {/* ---- Niveau 2 : tendances ---- */}
        <Tuile
          variante="blanc"
          span={6}
          titre="Réel vs attendu"
          sous="jetons gagnés main après main — l'écart, c'est la variance"
          action={
            <div className="legende-graphe">
              <span>
                <span className="trait-legende" /> Réel
              </span>
              <span>
                <span className="trait-legende ev" /> Attendu (EV)
              </span>
            </div>
          }
        >
          {calculEv.points && calculEv.points.length >= 2 ? (
            <>
              <Courbe
                series={[
                  { cle: "reel", valeurs: calculEv.points.map((p) => p.reel) },
                  { cle: "ev", valeurs: calculEv.points.map((p) => p.ev), classe: "ev" },
                ]}
                formatY={(v) => Math.round(v).toLocaleString("fr-FR")}
                infobulle={(i) => (
                  <>
                    <div>
                      {dateHeure(calculEv.points[i].date)} — main {i + 1}
                    </div>
                    <div>
                      Réel : <strong>{Math.round(calculEv.points[i].reel).toLocaleString("fr-FR")}</strong> jetons
                    </div>
                    <div>
                      Attendu : <strong>{Math.round(calculEv.points[i].ev).toLocaleString("fr-FR")}</strong> jetons
                    </div>
                  </>
                )}
                idSuffixe="-ev"
              />
              <p className="tuile-legende">
                {pluriel("main ajustée", calculEv.nbAjustees)} à l'équité. Réel sous l'attendu = malchance à tapis, et inversement.
              </p>
            </>
          ) : (
            <p className="tuile-legende">Calcul de l'équité des tapis… {Math.round(calculEv.avancement * 100)} %</p>
          )}
        </Tuile>

        <Tuile
          variante="blanc"
          span={6}
          titre="Bankroll"
          sous={`net cumulé, partie après partie — ${libelleScope}`}
          valeur={`${signe(stats.netEuro)}${euros(stats.netEuro)}`}
        >
          {stats.courbe.length >= 2 ? (
            <Courbe
              series={[{ cle: "net", valeurs: stats.courbe.map((p) => p.cumul) }]}
              formatY={(v) => euros(v)}
              infobulle={(i) => (
                <>
                  <div>{dateHeure(stats.courbe[i].date)}</div>
                  <div>
                    {stats.courbe[i].partie.multiplicateur ? `x${stats.courbe[i].partie.multiplicateur} — ` : ""}
                    {stats.courbe[i].partie.resultatConnu ? ordinal(stats.courbe[i].partie.place) : "résultat inconnu"} · partie{" "}
                    {signe(stats.courbe[i].partie.netEuro)}
                    {euros(stats.courbe[i].partie.netEuro)}
                  </div>
                  <div>
                    Cumul : <strong>{euros(stats.courbe[i].cumul)}</strong>
                  </div>
                </>
              )}
            />
          ) : (
            <p className="tuile-legende">Encore une partie et la courbe apparaît.</p>
          )}
          {stats.parties.some((p) => !p.resultatConnu) && (
            <p className="tuile-legende">
              ⚠ {stats.parties.filter((p) => !p.resultatConnu).length} partie(s) sans ligne de résultat dans l'export (comptées comme
              buy-in perdu).
            </p>
          )}
        </Tuile>

        {/* ---- Niveau 3 : qualité du jeu ---- */}
        <Tuile variante="vert" span={3} titre="Respect des ranges" sous="par situation, pré-flop">
          <div className="anneaux-bloc">
            <Anneaux series={conformiteParFamille} centre={stats.tauxConformite === null ? "—" : `${Math.round(100 * stats.tauxConformite)}%`} />
            <ListeValeurs lignes={conformiteParFamille.map((s) => ({ cle: s.label, label: s.label, couleur: s.couleur, valeur: s.texte }))} />
          </div>
        </Tuile>

        <Tuile variante="jaune" span={3} titre="Ranges — global" sous={`${stats.spots.length} spots couverts`}>
          <Jauge valeur={stats.tauxConformite} centre={stats.tauxConformite === null ? "—" : `${Math.round(100 * stats.tauxConformite)}%`} />
          <ListeValeurs
            lignes={[
              { cle: "c", label: "Conformes", valeur: stats.spots.length - stats.ecarts.length },
              { cle: "e", label: "Écarts", valeur: stats.ecarts.length },
            ]}
          />
        </Tuile>

        <Tuile variante="vert" span={3} titre="Ranges — évolution" sous="moyenne glissante sur 50 spots">
          {stats.courbeConformite.length > 10 ? (
            <Courbe
              series={[{ cle: "taux", valeurs: stats.courbeConformite.slice(9).map((p) => p.taux), classe: "taux" }]}
              formatY={(v) => `${Math.round(100 * v)} %`}
              zero={false}
              aire={false}
              hauteur={170}
              infobulle={(i) => {
                const p = stats.courbeConformite.slice(9)[i];
                return (
                  <>
                    <div>{dateHeure(p.date)}</div>
                    <div>
                      Respect : <strong>{Math.round(100 * p.taux)} %</strong> (sur {pluriel("spot", p.nbSpots)})
                    </div>
                  </>
                );
              }}
              idSuffixe="-taux"
            />
          ) : (
            <p className="tuile-legende">Pas encore assez de spots pour tracer l'évolution.</p>
          )}
        </Tuile>

        <Tuile variante="sombre" span={3} titre="Places" sous="1ᵉʳ / 2ᵉ / 3ᵉ">
          <Segments
            parts={[
              { label: "1ᵉʳ", valeur: stats.places[1], couleur: "var(--lime)" },
              { label: "2ᵉ", valeur: stats.places[2], couleur: "var(--lavande)" },
              { label: "3ᵉ", valeur: stats.places[3], couleur: "var(--orange)" },
            ]}
          />
          <div className="segments-legende">
            <span style={{ "--c": "var(--lime)" }}>1ᵉʳ</span>
            <span style={{ "--c": "var(--lavande)" }}>2ᵉ</span>
            <span style={{ "--c": "var(--orange)" }}>3ᵉ</span>
          </div>
          <ListeValeurs
            lignes={[
              { cle: "v", label: "Victoires", valeur: stats.partiesJouees.length ? pourcent(stats.places[1] / stats.partiesJouees.length) : "—" },
              { cle: "s", label: "Showdowns gagnés", valeur: `${stats.showdownsGagnes} / ${stats.showdownsVus}` },
            ]}
          />
        </Tuile>

        {/* ---- Niveau 4 : volume ---- */}
        <Tuile
          variante="orange"
          span={6}
          titre="Parties par jour"
          sous={periodeJours ? `${periodeJours} derniers jours` : "depuis le début"}
          valeur={`${nbPartiesPeriode}`}
          action={
            <div className="pilules">
              {[7, 30, 0].map((p) => (
                <Pilule key={p} variante={periodeJours === p ? "sombre" : "clair"} onClick={() => setPeriodeJours(p)}>
                  {p ? `${p} j` : "Tout"}
                </Pilule>
              ))}
            </div>
          }
        >
          <BarresJours jours={partiesRecentes} unite="partie" nbMax={periodeJours || 60} />
        </Tuile>

        <Tuile
          variante="blanc"
          span={6}
          titre="Heures jouées"
          sous="calculées d'après tes mains — clique sur un jour pour corriger"
          valeur={formatHeures(totalHeuresMois(heures, cleMois(moisAffiche)))}
        >
          <CalendrierHeures
            heures={heures}
            mois={moisAffiche}
            onMois={(delta) => setMoisCalendrier(new Date(moisAffiche.getFullYear(), moisAffiche.getMonth() + delta, 1))}
            onEditer={(cle, valeur) =>
              setCorrectionsHeures((c) => {
                const copie = { ...c };
                if (valeur === null) delete copie[cle];
                else copie[cle] = valeur;
                return copie;
              })
            }
          />
          <p className="tuile-legende">Total sur la période : {formatHeures(totalHeures)}.</p>
        </Tuile>

        {/* ---- Niveau 5 : style de jeu ---- */}
        <Tuile variante="lavande" span={3} titre="VPIP" sous="mains jouées volontairement">
          <div className="anneau-bloc">
            <Anneau valeur={stats.vpip || 0} couleur="#46468c" taille={120} epaisseur={12} centre={pourcent(stats.vpip)} />
          </div>
        </Tuile>
        <Tuile variante="lavande" span={3} titre="PFR" sous="relances pré-flop">
          <div className="anneau-bloc">
            <Anneau valeur={stats.pfr || 0} couleur="#46468c" taille={120} epaisseur={12} centre={pourcent(stats.pfr)} />
          </div>
        </Tuile>
        <Tuile variante="sombre" span={3} titre="Mains" sous="dans la sélection">
          <div className="tuile-grand">{stats.nbMains}</div>
          <p className="tuile-pied">{stats.mainsAvecHero} avec ta position connue</p>
        </Tuile>
        <Tuile variante="sombre" span={3} titre="Par partie" sous="moyennes">
          <ListeValeurs
            lignes={[
              { cle: "m", label: "Mains par partie", valeur: stats.parties.length ? unDecimal(stats.nbMains / stats.parties.length) : "—" },
              { cle: "h", label: "Durée moyenne", valeur: stats.parties.length ? formatHeures(totalHeures / stats.parties.length) : "—" },
              { cle: "p", label: "Parties par jour de jeu", valeur: nbJoursJoues ? unDecimal(stats.parties.length / nbJoursJoues) : "—" },
            ]}
          />
        </Tuile>
      </Bento>

      <div className="panneau">
        <h3>Respect des ranges pré-flop — détail</h3>
        <p className="muet">
          {stats.spots.length} mains jouées dans les 3 situations couvertes par les tableaux (blinds postées entières uniquement).
          Profondeur en bb, stacks avant blinds : en HU, min des deux stacks ; en 3-way, min(toi, plus gros adversaire).
        </p>
        <div className="defilant">
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
        </div>
        <h4>Écarts ({stats.ecarts.length}) — clique pour voir le tableau</h4>
        <div className="liste-ecarts">
          {ecarts.map((e) => (
            <div key={e.handId} className="ecart">
              <button className="ligne-ecart" aria-expanded={ecartOuvert === e.handId} onClick={() => setEcartOuvert(ecartOuvert === e.handId ? null : e.handId)}>
                <span className="muet">{dateHeure(e.date)}</span>
                <span>
                  {e.cartes.map((c) => (
                    <CarteInline key={c} texte={c} />
                  ))}{" "}
                  <strong>{e.main}</strong> à {formatBbArrondi(e.profondeur)}
                </span>
                <span>
                  joué <strong className="mauvaise-reponse">{labelAction(e.familleId, e.jouee)}</strong>, attendu{" "}
                  <strong className="bonne-reponse">{labelAction(e.familleId, e.attendu)}</strong>
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
                <th>Limite</th>
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
                  <td>{p.buyIn !== null && p.buyIn !== undefined ? euros(p.buyIn) : "?"}</td>
                  <td>x{p.multiplicateur ?? "?"}</td>
                  <td>{p.nbMains}</td>
                  <td>{p.resultatConnu ? ordinal(p.place) : "?"}</td>
                  <td className={p.netEuro >= 0 ? "bonne-reponse" : "mauvaise-reponse"}>
                    {signe(p.netEuro)}
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
            <input type="checkbox" checked={showdownSeulement} onChange={(e) => setShowdownSeulement(e.target.checked)} />
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
                <button className="ligne-main" aria-expanded={ouverte} onClick={() => setMainOuverte(ouverte ? null : main.id)}>
                  <span className="muet">{dateHeure(main.date)}</span>
                  <span>{positionHero(main) || "?"}</span>
                  <span>
                    {(main.cartes[main.hero] || []).map((c) => (
                      <CarteInline key={c} texte={c} />
                    ))}
                  </span>
                  <span className={resultat >= 0 ? "bonne-reponse" : "mauvaise-reponse"}>
                    {signe(resultat)}
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

      {calculEv.points && (
        <RapportImpression
        analyse={{ ...analyse, mains: mainsScope }}
        limite={limiteActive}
        bilan={bilan}
        stats={stats}
        calculEv={calculEv}
        conformite={conformite}
        cEV={cEV}
        reelParPartie={reelParPartie}
      />
      )}
    </section>
  );
}
