import { useCallback, useEffect, useRef, useState } from "react";
import { Bento, Tuile, Pilule } from "./ui/Tuile.jsx";
import { TableSim } from "./TableSim.jsx";
import { GrilleMains, Legende } from "./Grille.jsx";
import { Simulation } from "../lib/simulateur/partie.js";
import { actionsLegales } from "../lib/simulateur/moteur.js";
import { relanceParDefaut } from "../lib/simulateur/ui.js";
import { lireLocal, ecrireLocal } from "../lib/stockage.js";
import { euros, pourcent, pluriel } from "../lib/format.js";
import { sonTonTour, sonMauvaiseReponse } from "../lib/sons.js";
import "../sim.css";

const OPTIONS_DEFAUT = { nbTables: 3, buyIn: 0.2, secondesAction: 10, dureeNiveauSec: "auto", nomHero: "Toi", affichage: "bb" };
const CUMUL_VIDE = { sessions: 0, parties: 0, partiesGagnees: 0, spots: 0, erreurs: 0, cbetOk: 0, cbetManques: 0, tempsEcoules: 0, investi: 0, gagne: 0 };
const TYPES = {
  erreur: "Erreur de range",
  ok: "Range respectée",
  "cbet-manque": "C-bet manqué",
  "cbet-ok": "C-bet",
  temps: "Temps écoulé",
  info: "Partie",
};

/** Table où le joueur doit agir : celle qu'il a cliquée si c'est à lui, sinon la plus urgente. */
function tableFocalisee(sim, focus, maintenant) {
  const aToi = sim.tables.filter((t) => t.table.main && t.table.main.rue !== "fin" && t.table.main.aParler === "hero");
  if (!aToi.length) return null;
  const choisie = aToi.find((t) => t.table.id === focus);
  if (choisie) return choisie;
  return aToi.sort((a, b) => sim.tempsRestant(a, maintenant) - sim.tempsRestant(b, maintenant))[0];
}

const signe = (v) => (v > 0 ? "+" : "");

function Compteur({ nom, valeur, classe = "" }) {
  return (
    <div className={`sim-compteur ${classe}`.trim()}>
      <strong>{valeur}</strong>
      <span>{nom}</span>
    </div>
  );
}

/** Onglet Simulateur : 2 à 4 tables de Spin & Rush contre des bots, avec le coach pré-flop et c-bet. */
export function Simulateur({ charts, reglages, actif = true }) {
  const [options, setOptions] = useState(() => ({ ...OPTIONS_DEFAUT, ...lireLocal("simulateur.options", {}) }));
  const [cumul, setCumul] = useState(() => ({ ...CUMUL_VIDE, ...lireLocal("simulateur.cumul", {}) }));
  const [etat, setEtat] = useState("accueil"); // accueil | jeu | pause
  const [, setRendu] = useState(0);
  const [focus, setFocus] = useState(null);
  const [rangeVisible, setRangeVisible] = useState(null);
  const [preactions, setPreactions] = useState({});
  const [filtre, setFiltre] = useState("tout");
  const simRef = useRef(null);
  const decalage = useRef(0);
  const pauseDepuis = useRef(null);
  const messagesSonores = useRef(0);
  const horloge = useCallback(() => Date.now() - decalage.current, []);

  useEffect(() => {
    ecrireLocal("simulateur.options", options);
  }, [options]);
  useEffect(() => {
    ecrireLocal("simulateur.cumul", cumul);
  }, [cumul]);

  const sons = useCallback(() => {
    const sim = simRef.current;
    if (!sim) return;
    for (const t of sim.tables)
      if (t.signal) {
        t.signal = false;
        sonTonTour(reglages.sonsActifs);
      }
    const nouveaux = sim.messages.filter((m) => m.id > messagesSonores.current);
    if (nouveaux.length) {
      messagesSonores.current = nouveaux[nouveaux.length - 1].id;
      if (nouveaux.some((m) => m.type === "erreur" || m.type === "cbet-manque")) sonMauvaiseReponse(reglages.sonsActifs);
    }
  }, [reglages.sonsActifs]);

  const demarrer = () => {
    decalage.current = 0;
    pauseDepuis.current = null;
    messagesSonores.current = 0;
    simRef.current = new Simulation({ ...options, charts, maintenant: Date.now() });
    setPreactions({});
    setFocus(null);
    setRangeVisible(null);
    setEtat("jeu");
  };
  const mettreEnPause = useCallback(() => {
    pauseDepuis.current = Date.now();
    setEtat("pause");
  }, []);
  const reprendre = () => {
    if (pauseDepuis.current !== null) decalage.current += Date.now() - pauseDepuis.current;
    pauseDepuis.current = null;
    setEtat("jeu");
  };
  const arreter = () => {
    const sim = simRef.current;
    if (sim) {
      const s = sim.stats;
      setCumul((c) => ({
        sessions: c.sessions + 1,
        parties: c.parties + s.parties,
        partiesGagnees: c.partiesGagnees + s.partiesGagnees,
        spots: c.spots + s.spots,
        erreurs: c.erreurs + s.erreurs,
        cbetOk: c.cbetOk + s.cbetOk,
        cbetManques: c.cbetManques + s.cbetManques,
        tempsEcoules: c.tempsEcoules + s.tempsEcoules,
        investi: Math.round((c.investi + s.investi) * 100) / 100,
        gagne: Math.round((c.gagne + s.gagne) * 100) / 100,
      }));
    }
    simRef.current = null;
    setEtat("accueil");
  };

  // L'onglet quitté met la partie en pause : les compteurs de temps ne tournent pas dans le vide.
  useEffect(() => {
    if (!actif && etat === "jeu") mettreEnPause();
  }, [actif, etat, mettreEnPause]);

  useEffect(() => {
    if (etat !== "jeu") return;
    const id = setInterval(() => {
      const sim = simRef.current;
      if (!sim) return;
      sim.tick(horloge());
      sons();
      setRendu((n) => n + 1);
    }, 100);
    return () => clearInterval(id);
  }, [etat, horloge, sons]);

  const agir = useCallback(
    (tableId, action) => {
      const sim = simRef.current;
      if (!sim || etat !== "jeu") return;
      sim.agirHero(tableId, action, horloge());
      sons();
      setRendu((n) => n + 1);
    },
    [etat, horloge, sons],
  );

  useEffect(() => {
    if (etat !== "jeu") return;
    const surTouche = (e) => {
      if (e.target && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      const sim = simRef.current;
      if (!sim) return;
      const k = e.key.toLowerCase();
      if (/^[1-4]$/.test(k)) {
        const t = sim.tables[Number(k) - 1];
        if (t) setFocus(t.table.id);
        return;
      }
      const t = tableFocalisee(sim, focus, horloge());
      if (!t) return;
      const legal = actionsLegales(t.table);
      if (!legal || legal.joueur !== "hero") return;
      if (k === "f") agir(t.table.id, { verbe: legal.peutCheck ? "check" : "fold" });
      else if (k === "c") agir(t.table.id, { verbe: legal.peutCheck ? "check" : "call" });
      else if (k === "r") agir(t.table.id, { verbe: "raise", montant: relanceParDefaut(t.table.main, legal) });
      else if (k === "a") agir(t.table.id, { verbe: "allin" });
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [etat, focus, agir, horloge]);

  const sim = simRef.current;
  const maintenant = etat === "pause" && pauseDepuis.current !== null ? pauseDepuis.current - decalage.current : horloge();
  const stats = sim ? sim.stats : null;
  const conformite = (s) => (s.spots ? pourcent((s.spots - s.erreurs) / s.spots) : "—");
  const tauxCbet = (s) => (s.cbetOk + s.cbetManques ? pourcent(s.cbetOk / (s.cbetOk + s.cbetManques)) : "—");
  const net = stats ? Math.round((stats.gagne - stats.investi) * 100) / 100 : 0;
  const focalisee = sim ? tableFocalisee(sim, focus, maintenant) : null;
  const messages = sim ? [...sim.messages].reverse().filter((m) => filtre === "tout" || (filtre === "erreurs" ? m.type === "erreur" || m.type === "cbet-manque" : m.type === filtre)) : [];

  return (
    <div className="sim" hidden={!actif}>
      {etat === "accueil" && (
        <Bento>
          <Tuile variante="sombre" span={8} titre="Simulateur Spin & Rush" sous="2 à 4 tables contre des bots, avec le coach qui signale chaque écart de range pré-flop et chaque c-bet manqué.">
            <div className="sim-options">
              <div className="sim-option">
                <span className="sim-option-nom">Tables</span>
                <div className="segment">
                  {[2, 3, 4].map((n) => (
                    <button key={n} type="button" className={options.nbTables === n ? "actif" : ""} onClick={() => setOptions({ ...options, nbTables: n })}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sim-option">
                <span className="sim-option-nom">Limite</span>
                <div className="segment">
                  {[0.2, 1, 5].map((b) => (
                    <button key={b} type="button" className={options.buyIn === b ? "actif" : ""} onClick={() => setOptions({ ...options, buyIn: b })}>
                      {euros(b)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sim-option">
                <span className="sim-option-nom">Temps pour agir</span>
                <div className="segment">
                  {[7, 10, 12, 15].map((s) => (
                    <button key={s} type="button" className={options.secondesAction === s ? "actif" : ""} onClick={() => setOptions({ ...options, secondesAction: s })}>
                      {s} s
                    </button>
                  ))}
                </div>
              </div>
              <div className="sim-option">
                <span className="sim-option-nom">Niveaux de blinds</span>
                <div className="segment">
                  {[
                    ["auto", "Betclic"],
                    [60, "1 min"],
                    [120, "2 min"],
                    [180, "3 min"],
                  ].map(([v, nom]) => (
                    <button key={v} type="button" className={options.dureeNiveauSec === v ? "actif" : ""} onClick={() => setOptions({ ...options, dureeNiveauSec: v })} title={v === "auto" ? "×2 : 1 min, ×3 : 1 min 30, ×4 et plus : 2 min" : undefined}>
                      {nom}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sim-option">
                <span className="sim-option-nom">Montants</span>
                <div className="segment">
                  {[
                    ["bb", "Big blinds"],
                    ["jetons", "Jetons"],
                  ].map(([v, nom]) => (
                    <button key={v} type="button" className={options.affichage === v ? "actif" : ""} onClick={() => setOptions({ ...options, affichage: v })}>
                      {nom}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sim-option">
                <span className="sim-option-nom">Ton pseudo</span>
                <input className="sim-pseudo" value={options.nomHero} maxLength={14} onChange={(e) => setOptions({ ...options, nomHero: e.target.value || "Toi" })} />
              </div>
            </div>
            <div className="sim-demarrer">
              <button type="button" className="bouton principal" onClick={demarrer}>
                Lancer {options.nbTables} tables
              </button>
              <p className="sim-aide">
                Tapis de 500 jetons, blinds 10/20, structure Betclic (×2 : niveaux d'1 min, ×3 : 1 min 30, ×4 et plus : 2 min). Clavier : <kbd>F</kbd> se coucher / parole,{" "}
                <kbd>C</kbd> suivre, <kbd>R</kbd> relancer (montant proposé), <kbd>A</kbd> tapis, <kbd>1</kbd>–<kbd>4</kbd> choisir la table. Sans action à temps : parole ou abandon
                automatique.
              </p>
            </div>
          </Tuile>
          <Tuile variante="lime" span={4} titre="Depuis le début" sous={cumul.sessions ? pluriel("session", cumul.sessions) : "aucune session pour l'instant"}>
            <div className="sim-compteurs">
              <Compteur nom="parties" valeur={cumul.parties} />
              <Compteur nom="gagnées" valeur={cumul.partiesGagnees} />
              <Compteur nom="ranges respectées" valeur={conformite(cumul)} />
              <Compteur nom="erreurs de range" valeur={cumul.erreurs} />
              <Compteur nom="c-bets joués" valeur={tauxCbet(cumul)} />
              <Compteur nom="c-bets manqués" valeur={cumul.cbetManques} />
              <Compteur nom="temps écoulés" valeur={cumul.tempsEcoules} />
              <Compteur nom="net (fictif)" valeur={`${signe(cumul.gagne - cumul.investi)}${euros(Math.round((cumul.gagne - cumul.investi) * 100) / 100)}`} />
            </div>
          </Tuile>
        </Bento>
      )}

      {sim && (
        <>
          <div className="sim-barre">
            <div className="sim-compteurs ligne">
              <Compteur nom="parties" valeur={`${stats.parties}${stats.partiesGagnees ? ` (${stats.partiesGagnees} gagnée${stats.partiesGagnees > 1 ? "s" : ""})` : ""}`} />
              <Compteur nom="mains" valeur={stats.mainsJouees} />
              <Compteur nom="ranges" valeur={conformite(stats)} classe={stats.erreurs ? "alerte" : ""} />
              <Compteur nom="erreurs" valeur={stats.erreurs} classe={stats.erreurs ? "alerte" : ""} />
              <Compteur nom="c-bets" valeur={`${stats.cbetOk} / ${stats.cbetOk + stats.cbetManques}`} classe={stats.cbetManques ? "alerte" : ""} />
              <Compteur nom="temps écoulés" valeur={stats.tempsEcoules} classe={stats.tempsEcoules ? "alerte" : ""} />
              <Compteur nom="net (fictif)" valeur={`${signe(net)}${euros(net)}`} classe={net > 0 ? "positif" : net < 0 ? "negatif" : ""} />
            </div>
            <div className="sim-commandes">
              <div className="segment" title="Affichage des montants">
                <button type="button" className={options.affichage !== "jetons" ? "actif" : ""} onClick={() => setOptions({ ...options, affichage: "bb" })}>
                  bb
                </button>
                <button type="button" className={options.affichage === "jetons" ? "actif" : ""} onClick={() => setOptions({ ...options, affichage: "jetons" })}>
                  Jetons
                </button>
              </div>
              {etat === "jeu" ? (
                <button type="button" className="bouton" onClick={mettreEnPause}>
                  Pause
                </button>
              ) : (
                <button type="button" className="bouton principal" onClick={reprendre}>
                  Reprendre
                </button>
              )}
              <button type="button" className="bouton danger" onClick={arreter}>
                Arrêter
              </button>
            </div>
          </div>

          <div className={`sim-tables n${sim.tables.length}${etat === "pause" ? " en-pause" : ""}`}>
            {sim.tables.map((t) => (
              <TableSim
                key={`${t.table.id}-${t.table.debut}`}
                t={t}
                sim={sim}
                maintenant={maintenant}
                agir={agir}
                focalisee={focalisee ? focalisee.table.id === t.table.id : false}
                surFocus={setFocus}
                preaction={preactions[t.table.id] || null}
                setPreaction={(v) => setPreactions((p) => ({ ...p, [t.table.id]: v }))}
                affichage={options.affichage}
              />
            ))}
            {etat === "pause" && (
              <div className="sim-voile">
                <strong>Pause</strong>
                <button type="button" className="bouton principal" onClick={reprendre}>
                  Reprendre
                </button>
              </div>
            )}
          </div>

          <Bento>
            <Tuile
              variante="sombre"
              span={12}
              titre="Coach"
              sous="chaque décision pré-flop couverte par tes ranges est jugée ; au flop, relanceur pré-flop qui checke = c-bet manqué"
              action={
                <div className="segment">
                  {[
                    ["tout", "Tout"],
                    ["erreurs", "Erreurs"],
                    ["ok", "Conformes"],
                    ["temps", "Temps"],
                  ].map(([id, nom]) => (
                    <button key={id} type="button" className={filtre === id ? "actif" : ""} onClick={() => setFiltre(id)}>
                      {nom}
                    </button>
                  ))}
                </div>
              }
            >
              {messages.length === 0 ? (
                <p className="sim-vide">Rien à signaler pour l'instant : joue tes mains, le coach parle quand une décision est couverte par un tableau.</p>
              ) : (
                <ul className="sim-journal">
                  {messages.slice(0, 40).map((m) => (
                    <li key={m.id} className={`type-${m.type}`}>
                      <Pilule variante={m.type === "erreur" || m.type === "cbet-manque" ? "orange" : m.type === "ok" || m.type === "cbet-ok" ? "lime" : "clair"}>{TYPES[m.type]}</Pilule>
                      <span className="sim-journal-table">{m.tableId}</span>
                      <span className="sim-journal-texte">{m.texte}</span>
                      {m.detail?.chartId && (
                        <button type="button" className="bouton petit discret" onClick={() => setRangeVisible(rangeVisible === m.id ? null : m.id)}>
                          {rangeVisible === m.id ? "Masquer la range" : "Voir la range"}
                        </button>
                      )}
                      {rangeVisible === m.id && m.detail?.chartId && (
                        <div className="sim-range">
                          <GrilleMains mains={charts.find((c) => c.id === m.detail.chartId)?.mains || {}} surligne={m.detail.main} />
                          <Legende />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Tuile>
          </Bento>
        </>
      )}
    </div>
  );
}
