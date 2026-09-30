import { useEffect, useMemo, useRef, useState } from "react";
import { Pilule } from "./ui/Tuile.jsx";
import { Tourne } from "./ui/Chargement.jsx";
import { calculerStats } from "../lib/analyse.js";
import { bilanParLimite } from "../lib/limites.js";
import { cumulerEv } from "./graphes/GrapheEv.jsx";
import { heuresParJour, cleJour } from "../lib/heures.js";
import { euros } from "../lib/format.js";
import { dessinerBilan, LARGEUR, HAUTEUR } from "../lib/bilan-image.js";

/** Minuit local, il y a `recul` jours. */
function debutJour(recul) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - recul);
  return d.getTime();
}

/**
 * Fenêtre « Partager en image » : rend le bilan de la période choisie sur un
 * canvas et propose téléchargement, copie et partage (Web Share).
 */
export function PartageImage({ mains, charts, parMain, correctionsHeures, limiteActive, onFermer }) {
  const [message, setMessage] = useState(null);
  const [apercu, setApercu] = useState(null);
  const canvasRef = useRef(null);

  const bilan = useMemo(() => {
    // Tout l'historique pour les parties, le cEV, le gain et la variance ;
    // les 3 derniers jours pour les heures et la bankroll.
    const stats = calculerStats(mains, charts);
    const ev = parMain ? cumulerEv(mains, parMain) : null;
    const complet = !!ev;
    const depuis = debutJour(2);
    const recentes = mains.filter((m) => m.date && m.date >= depuis);
    const stats3 = calculerStats(recentes, charts);
    const heuresToutes = heuresParJour(mains, correctionsHeures);
    const heures3 = [2, 1, 0].map((recul) => {
      const d = new Date(debutJour(recul) + 12 * 3_600_000);
      return {
        libelle: recul === 0 ? "auj." : recul === 1 ? "hier" : d.toLocaleDateString("fr-FR", { weekday: "short" }),
        heures: heuresToutes.get(cleJour(d.getTime()))?.heures || 0,
      };
    });
    const limites = bilanParLimite(mains, complet ? parMain : null).filter((l, _, t) => t.length > 2 || l.limite !== null);
    const nbParties = stats.parties.length;
    const auj = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    return {
      titre: `Bilan du ${auj}`,
      sousTitre: limiteActive === null ? "toutes limites" : `limite ${euros(limiteActive)}`,
      sousParties: "depuis le début",
      parties: nbParties,
      nbMains: stats.nbMains,
      joursJoues: stats.partiesParJour.filter((j) => j.nb > 0).length,
      cEV: complet && nbParties ? ev.sommeEv / nbParties : null,
      reelParPartie: complet && nbParties ? ev.sommeReel / nbParties : null,
      netEuro: stats.netEuro,
      investi: stats.investi,
      roi: stats.investi > 0 ? stats.netEuro / stats.investi : null,
      places: stats.places,
      victoires: stats.partiesJouees.length ? stats.places[1] / stats.partiesJouees.length : null,
      tauxConformite: stats.tauxConformite,
      nbSpots: stats.spots.length,
      heures3,
      pointsBankroll: stats3.courbe.map((p) => p.cumul),
      netEuro3: stats3.netEuro,
      parties3: stats3.parties.length,
      pointsReel: complet ? ev.points.map((p) => p.reel) : [],
      pointsEv: complet ? ev.points.map((p) => p.ev) : [],
      limites,
      calculEnCours: !complet,
      dateGeneration: `généré le ${new Date().toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}`,
    };
  }, [mains, charts, parMain, correctionsHeures, limiteActive]);

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        await document.fonts?.load?.('800 40px "Manrope Variable"');
      } catch {}
      if (annule) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = LARGEUR;
      canvas.height = HAUTEUR;
      dessinerBilan(canvas.getContext("2d"), bilan);
      setApercu(canvas.toDataURL("image/png"));
    })();
    return () => {
      annule = true;
    };
  }, [bilan]);

  const nomFichier = () => `expresso-bilan-${new Date().toISOString().slice(0, 10)}.png`;

  function blob() {
    return new Promise((resolve) => canvasRef.current.toBlob(resolve, "image/png"));
  }

  async function telecharger() {
    const b = await blob();
    const url = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomFichier();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setMessage("Image téléchargée.");
  }

  async function copier() {
    try {
      const b = await blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": b })]);
      setMessage("Image copiée : colle-la directement dans la conversation.");
    } catch {
      setMessage("La copie d'image n'est pas disponible ici : utilise Télécharger.");
    }
  }

  async function partager() {
    try {
      const b = await blob();
      const fichier = new File([b], nomFichier(), { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [fichier] })) {
        await navigator.share({ files: [fichier], title: bilan.titre });
        setMessage("Partagé.");
      } else setMessage("Le partage direct n'est pas disponible ici : utilise Copier ou Télécharger.");
    } catch (e) {
      if (e && e.name !== "AbortError") setMessage("Partage impossible : utilise Copier ou Télécharger.");
    }
  }

  const partageDispo = typeof navigator !== "undefined" && !!navigator.canShare;

  return (
    <div className="voile" onClick={onFermer} role="dialog" aria-modal="true">
      <div className="fenetre" onClick={(e) => e.stopPropagation()}>
        <header className="fenetre-entete">
          <div>
            <h3 className="tuile-titre">Partager en image</h3>
            <p className="tuile-sous">tout l'historique, plus les heures et la bankroll des 3 derniers jours</p>
          </div>
          <button className="pilule pilule--clair sur-sombre" onClick={onFermer} type="button">
            Fermer
          </button>
        </header>
        <div className="fenetre-apercu">
          {apercu ? <img src={apercu} alt="Aperçu du bilan" /> : <Tourne />}
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>
        {bilan.calculEnCours && (
          <p className="muet">
            <Tourne /> Le calcul de l'équité n'est pas terminé : le cEV et la courbe apparaîtront dès qu'il l'est.
          </p>
        )}
        <div className="pilules">
          {partageDispo && (
            <Pilule variante="lime" onClick={partager}>
              Envoyer…
            </Pilule>
          )}
          <Pilule variante={partageDispo ? "blanc" : "lime"} onClick={copier}>
            Copier l'image
          </Pilule>
          <Pilule variante="clair" classe="sur-sombre" onClick={telecharger}>
            Télécharger
          </Pilule>
        </div>
        {message && <p className="muet">{message}</p>}
      </div>
    </div>
  );
}
