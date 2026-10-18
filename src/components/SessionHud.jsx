import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Tuile, Pilule, Bento } from "./ui/Tuile.jsx";
import {
  demarrer,
  ajouterPartie,
  ajouterPartiesDetectees,
  nombreParties,
  dureeMs,
  partiesParHeure,
  formatChrono,
  terminer,
} from "../lib/session.js";
import { dossierDisponible, choisirDossier, permissionDossier, creerSurveillance, scanner } from "../lib/dossier.js";
import { lireBase, ecrireBase } from "../lib/stockage.js";
import { dateHeure, pluriel } from "../lib/format.js";
import { formatHeures } from "../lib/heures.js";

const INTERVALLE_SCAN_MS = 5000;
const URL_HUD_WINDOWS = "https://theclearboy.github.io/spinall/hud-betclic.zip";
const CLE_DOSSIER = "dossierHud";
const DOSSIER_VIDE = { etat: "aucun", nom: null, nbFichiers: 0, nbSuivis: 0, dernier: null, erreur: null, detectees: 0 };

const heure = (horodatage) => new Date(horodatage).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const pipDisponible = () => typeof window !== "undefined" && "documentPictureInPicture" in window;

/**
 * Ouvre la fenêtre du HUD : « Picture-in-Picture document » (toujours au-dessus
 * des autres fenêtres, Chrome/Edge 116+), sinon une petite fenêtre classique.
 * Les styles de l'app y sont copiés ; le HUD y est rendu par un portail React.
 */
async function ouvrirFenetreFlottante() {
  let fenetre = null;
  let flottante = false;
  if (pipDisponible()) {
    try {
      fenetre = await window.documentPictureInPicture.requestWindow({ width: 300, height: 196 });
      flottante = true;
    } catch {
      fenetre = null;
    }
  }
  if (!fenetre) fenetre = window.open("", "expresso-hud", "popup=yes,width=300,height=196");
  if (!fenetre) return null;
  const doc = fenetre.document;
  doc.documentElement.lang = "fr";
  doc.title = "HUD — Expresso Trainer";
  for (const el of document.querySelectorAll('style, link[rel="stylesheet"]')) doc.head.appendChild(el.cloneNode(true));
  doc.body.className = "hud-fenetre";
  doc.body.innerHTML = "";
  const racine = doc.createElement("div");
  racine.className = "hud-racine";
  doc.body.appendChild(racine);
  return { fenetre, racine, flottante };
}

/** Le HUD proprement dit : chrono, parties, cadence, +1 / −1. */
function Hud({ session, maintenant, onPlus, onMoins }) {
  const nb = nombreParties(session);
  const cadence = partiesParHeure(session, maintenant);
  return (
    <div className="hud">
      <div className="hud-entete">
        <span className="hud-marque">● Expresso</span>
        <span className="hud-cadence">{cadence !== null ? `${cadence.toFixed(1)} / h` : "— / h"}</span>
      </div>
      <div className="hud-chrono">{formatChrono(dureeMs(session, maintenant))}</div>
      <div className="hud-bas">
        <div className="hud-parties">
          <strong>{nb}</strong> {pluriel("partie", nb).replace(/^\d+ /, "")}
        </div>
        <div className="hud-boutons">
          <button className="hud-moins" onClick={onMoins} type="button" title="Retirer une partie (touche −)">
            −1
          </button>
          <button className="hud-plus" onClick={onPlus} type="button" title="Ajouter une partie (touche + ou Entrée)">
            +1
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Onglet HUD + fenêtre flottante + surveillance du dossier d'historiques.
 * Toujours monté (même sur un autre onglet) pour que le HUD et le comptage
 * continuent de vivre ; n'affiche son contenu que si `actif`.
 */
export function SessionHud({ actif, session, setSession, sessions, setSessions }) {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const [fenetre, setFenetre] = useState(null);
  const [message, setMessage] = useState(null);
  const [dossier, setDossier] = useState(DOSSIER_VIDE);
  const handleRef = useRef(null);
  const survRef = useRef(null);
  const passageEnCours = useRef(false);

  const plus = useCallback(() => setSession((s) => ajouterPartie(s, 1)), [setSession]);
  const moins = useCallback(() => setSession((s) => ajouterPartie(s, -1)), [setSession]);

  // ---- horloge : sur la fenêtre flottante quand elle existe (ses minuteurs
  // ne sont pas ralentis quand l'onglet principal passe en arrière-plan).
  useEffect(() => {
    const cible = fenetre && !fenetre.fenetre.closed ? fenetre.fenetre : window;
    const tic = () => setMaintenant(Date.now());
    tic();
    const id = cible.setInterval(tic, 1000);
    return () => {
      try {
        cible.clearInterval(id);
      } catch {}
    };
  }, [fenetre]);

  // ---- fenêtre flottante
  async function ouvrirHud() {
    if (fenetre && !fenetre.fenetre.closed) {
      try {
        fenetre.fenetre.focus();
      } catch {}
      return;
    }
    const f = await ouvrirFenetreFlottante();
    if (!f) {
      setMessage("Impossible d'ouvrir la fenêtre : autorise les fenêtres pop-up pour ce site.");
      return;
    }
    f.fenetre.addEventListener("pagehide", () => setFenetre((actuelle) => (actuelle?.fenetre === f.fenetre ? null : actuelle)));
    f.fenetre.addEventListener("keydown", (e) => {
      if (e.key === "+" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        plus();
      } else if (e.key === "-") {
        e.preventDefault();
        moins();
      }
    });
    setMessage(null);
    setFenetre(f);
  }
  function fermerHud() {
    try {
      fenetre?.fenetre.close();
    } catch {}
    setFenetre(null);
  }

  // ---- surveillance du dossier
  const passage = useCallback(async () => {
    const surv = survRef.current;
    if (!surv || passageEnCours.current) return;
    passageEnCours.current = true;
    try {
      const r = await scanner(surv);
      if (r.nouvelles.length) setSession((s) => ajouterPartiesDetectees(s, r.nouvelles));
      setDossier((d) => ({
        ...d,
        etat: "actif",
        nbFichiers: r.nbFichiers,
        nbSuivis: r.nbSuivis,
        dernier: Date.now(),
        erreur: null,
        detectees: d.detectees + r.nouvelles.length,
      }));
    } catch (e) {
      setDossier((d) => ({ ...d, erreur: e?.message || "lecture impossible" }));
    } finally {
      passageEnCours.current = false;
    }
  }, [setSession]);

  const demarrerSurveillance = useCallback(
    async (handle) => {
      handleRef.current = handle;
      if ((await permissionDossier(handle)) !== "granted") {
        setDossier({ ...DOSSIER_VIDE, etat: "permission", nom: handle.name });
        return;
      }
      survRef.current = creerSurveillance(handle);
      setDossier({ ...DOSSIER_VIDE, etat: "initialisation", nom: handle.name });
      await passage();
    },
    [passage],
  );

  // Dossier mémorisé lors d'une visite précédente.
  useEffect(() => {
    let annule = false;
    (async () => {
      const handle = await lireBase(CLE_DOSSIER);
      if (annule || !handle || handle.kind !== "directory") return;
      demarrerSurveillance(handle);
    })();
    return () => {
      annule = true;
    };
  }, [demarrerSurveillance]);

  // Passages réguliers tant que la surveillance est active.
  useEffect(() => {
    if (dossier.etat !== "actif") return;
    const cible = fenetre && !fenetre.fenetre.closed ? fenetre.fenetre : window;
    const id = cible.setInterval(passage, INTERVALLE_SCAN_MS);
    return () => {
      try {
        cible.clearInterval(id);
      } catch {}
    };
  }, [dossier.etat, fenetre, passage]);

  async function choisir() {
    try {
      const handle = await choisirDossier();
      await ecrireBase(CLE_DOSSIER, handle);
      await demarrerSurveillance(handle);
    } catch (e) {
      if (e?.name !== "AbortError") setDossier((d) => ({ ...d, erreur: e?.message || "dossier inaccessible" }));
    }
  }
  async function reprendre() {
    const handle = handleRef.current;
    if (!handle) return;
    if ((await permissionDossier(handle, true)) === "granted") await demarrerSurveillance(handle);
  }
  async function arreter() {
    survRef.current = null;
    handleRef.current = null;
    await ecrireBase(CLE_DOSSIER, null);
    setDossier(DOSSIER_VIDE);
  }

  function terminerSession() {
    const [archive, vierge] = terminer(session, sessions);
    setSessions(archive);
    setSession(vierge);
    setDossier((d) => ({ ...d, detectees: 0 }));
  }

  const portail = fenetre && !fenetre.fenetre.closed ? createPortal(<Hud session={session} maintenant={maintenant} onPlus={plus} onMoins={moins} />, fenetre.racine) : null;
  if (!actif) return portail;

  const nb = nombreParties(session);
  const cadence = partiesParHeure(session, maintenant);
  const aujourdhui = new Date().toDateString();
  const partiesDuJour = sessions.filter((s) => new Date(s.debut).toDateString() === aujourdhui).reduce((t, s) => t + s.parties, 0) + nb;

  return (
    <>
      {portail}
      <Bento>
        <Tuile
          variante="lime"
          span={4}
          titre="Chrono"
          sous={session.debut ? `première table lancée à ${heure(session.debut)}` : "depuis le premier lancement de table"}
          action={
            session.debut ? (
              <Pilule variante="sombre" onClick={terminerSession}>
                Terminer
              </Pilule>
            ) : (
              <Pilule variante="sombre" onClick={() => setSession((s) => demarrer(s))}>
                Lancer
              </Pilule>
            )
          }
        >
          <div className="tuile-grand hud-grand-chrono">{formatChrono(dureeMs(session, maintenant))}</div>
          <p className="tuile-legende">
            {session.debut
              ? "Terminer archive la session et remet le chrono à zéro."
              : "Clique sur Lancer en ouvrant ta première table ; le premier +1 lance aussi le chrono."}
          </p>
        </Tuile>

        <Tuile
          variante="blanc"
          span={4}
          titre="Parties"
          sous="cette session"
          action={
            <Pilule variante="clair" onClick={moins} titre="Retirer une partie">
              −1
            </Pilule>
          }
        >
          <div className="tuile-grand">{nb}</div>
          <div className="pilules">
            <Pilule variante="lime" onClick={plus}>
              +1 partie
            </Pilule>
          </div>
          <p className="tuile-legende">
            {cadence !== null ? `${cadence.toFixed(1)} parties / heure` : "cadence affichée après une minute"}
            {session.partiesAuto.length > 0 && ` · ${session.partiesAuto.length} détectée${session.partiesAuto.length > 1 ? "s" : ""} automatiquement`}
            {partiesDuJour > nb && ` · ${partiesDuJour} aujourd'hui toutes sessions`}
          </p>
        </Tuile>

        <Tuile
          variante="sombre"
          span={4}
          titre="HUD flottant"
          sous="une petite fenêtre qui reste au-dessus des tables"
          action={
            <a className="pilule pilule--blanc" href={URL_HUD_WINDOWS} title="Version Windows autonome, sans navigateur : s'ouvre avec Betclic et compte les tables">
              Version Windows
            </a>
          }
        >
          <div className="hud-apercu">
            <Hud session={session} maintenant={maintenant} onPlus={plus} onMoins={moins} />
          </div>
          <div className="pilules">
            <Pilule variante="lime" onClick={ouvrirHud}>
              {fenetre ? "Afficher le HUD" : "Ouvrir le HUD"}
            </Pilule>
            {fenetre && (
              <Pilule variante="clair" classe="sur-sombre" onClick={fermerHud}>
                Fermer
              </Pilule>
            )}
          </div>
          <p className="tuile-legende">
            {pipDisponible()
              ? "Fenêtre toujours visible, même au-dessus du client Betclic. Touches + / Entrée et − dans la fenêtre."
              : "Ici, le HUD s'ouvre dans une fenêtre séparée classique ; pour une fenêtre toujours au-dessus des tables, utilise Chrome ou Edge sur ordinateur."}
            {" "}
            Sur PC, la <a href={URL_HUD_WINDOWS}>version Windows</a> (zip) se lance avec Betclic, sans navigateur, et compte les
            tables toute seule.
          </p>
          {message && <p className="muet">{message}</p>}
        </Tuile>

        <Tuile variante="sombre" span={6} titre="Comptage automatique" sous="depuis le dossier où le client écrit les historiques">
          {dossier.etat === "aucun" && (
            <>
              <p className="muet">
                Si Betclic enregistre les historiques de mains sur ton disque, choisis ce dossier : chaque nouvelle partie qui y
                apparaît compte +1 et lance le chrono. Les parties déjà présentes ne sont pas comptées.
              </p>
              {dossierDisponible() ? (
                <div className="pilules">
                  <Pilule variante="lime" onClick={choisir}>
                    Choisir le dossier des historiques
                  </Pilule>
                </div>
              ) : (
                <p className="tuile-legende">Disponible dans Chrome ou Edge sur ordinateur. Ici, compte tes parties avec +1.</p>
              )}
            </>
          )}
          {dossier.etat === "permission" && (
            <>
              <p className="muet">
                Dossier mémorisé : <strong>{dossier.nom}</strong>. Le navigateur demande à nouveau l'autorisation de le lire.
              </p>
              <div className="pilules">
                <Pilule variante="lime" onClick={reprendre}>
                  Reprendre la surveillance
                </Pilule>
                <Pilule variante="clair" classe="sur-sombre" onClick={arreter}>
                  Oublier ce dossier
                </Pilule>
              </div>
            </>
          )}
          {(dossier.etat === "initialisation" || dossier.etat === "actif") && (
            <>
              <p className="muet">
                <span className={`hud-point ${dossier.etat === "actif" ? "actif" : ""}`} /> <strong>{dossier.nom}</strong>
                {dossier.etat === "initialisation"
                  ? " — lecture des fichiers existants…"
                  : ` — ${pluriel("fichier", dossier.nbFichiers)}, ${dossier.nbSuivis} surveillé${dossier.nbSuivis > 1 ? "s" : ""}${
                      dossier.dernier ? `, vérifié à ${heure(dossier.dernier)}` : ""
                    }`}
              </p>
              <p className="muet">
                {pluriel("partie", dossier.detectees)} détectée{dossier.detectees > 1 ? "s" : ""} depuis le lancement, vérification toutes
                les 5 secondes.
              </p>
              <div className="pilules">
                <Pilule variante="clair" classe="sur-sombre" onClick={arreter}>
                  Arrêter
                </Pilule>
              </div>
            </>
          )}
          {dossier.erreur && <p className="mauvaise-reponse">{dossier.erreur}</p>}
        </Tuile>

        <Tuile variante="sombre" span={6} titre="Sessions précédentes" sous={sessions.length ? `${pluriel("session", sessions.length)} archivée${sessions.length > 1 ? "s" : ""}` : "rien pour l'instant"}>
          {sessions.length > 0 && (
            <div className="defilant">
              <table className="tableau-limites">
                <thead>
                  <tr>
                    <th>Début</th>
                    <th>Durée</th>
                    <th>Parties</th>
                    <th>Cadence</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.slice(0, 12).map((s) => {
                    const h = (s.fin - s.debut) / 3_600_000;
                    return (
                      <tr key={s.debut}>
                        <td>{dateHeure(s.debut)}</td>
                        <td>{formatHeures(h)}</td>
                        <td>
                          <strong>{s.parties}</strong>
                        </td>
                        <td>{h >= 1 / 60 ? `${(s.parties / h).toFixed(1)} / h` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {sessions.length === 0 && <p className="muet">Chaque session terminée s'ajoute ici avec sa durée, ses parties et sa cadence.</p>}
        </Tuile>
      </Bento>
    </>
  );
}
