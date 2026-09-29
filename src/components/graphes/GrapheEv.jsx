import { useEffect, useState } from "react";
import { cheminLisse, aireSousCourbe, indexSousSouris } from "./chemins.js";
import { dateHeure, pluriel } from "../../lib/format.js";
import { resultatJoueur } from "../../lib/historique-mains.js";
import { tapisAvantRiver, jetonsAttendus } from "../../lib/analyse.js";
import { lireBase, ecrireBase } from "../../lib/stockage.js";
import EvWorker from "../../lib/ev.worker.js?worker&inline";

// Cache en mémoire des résultats par main ; il est aussi persisté dans IndexedDB
// (clé "ev") pour ne jamais recalculer une main déjà vue.
const cacheParMain = new Map();
let cachePersistantCharge = null;

async function chargerCachePersistant() {
  if (!cachePersistantCharge)
    cachePersistantCharge = (async () => {
      const objet = await lireBase("ev");
      if (objet && typeof objet === "object") for (const [id, r] of Object.entries(objet)) if (!cacheParMain.has(id)) cacheParMain.set(id, r);
    })();
  return cachePersistantCharge;
}

let sauvegardePrevue = null;
function sauvegarderCache() {
  if (sauvegardePrevue) return;
  sauvegardePrevue = setTimeout(() => {
    sauvegardePrevue = null;
    ecrireBase("ev", Object.fromEntries(cacheParMain));
  }, 500);
}

function calculerMain(main) {
  const tapis = tapisAvantRiver(main);
  return {
    reel: main.hero ? resultatJoueur(main, main.hero) : 0,
    ev: main.hero ? jetonsAttendus(main) : 0,
    ajustee: !!(tapis && tapis.aVenir > 0),
  };
}

/** Cumule réel / EV sur une liste de mains déjà calculées (triées par date). */
export function cumulerEv(mains, parMain) {
  const triees = [...mains].sort((a, b) => (a.date || 0) - (b.date || 0));
  let cumulReel = 0;
  let cumulEv = 0;
  let nbAjustees = 0;
  const points = [];
  for (const main of triees) {
    const r = parMain.get(main.id);
    if (!r) continue;
    cumulReel += r.reel;
    cumulEv += r.ev;
    if (r.ajustee) nbAjustees += 1;
    points.push({ date: main.date, reel: cumulReel, ev: cumulEv });
  }
  return { points, avancement: 1, nbAjustees, sommeReel: cumulReel, sommeEv: cumulEv, parMain };
}

/**
 * Calcule les jetons réels et attendus de chaque main : d'abord depuis le cache
 * (mémoire puis IndexedDB), puis dans un Web Worker pour les mains manquantes,
 * avec repli sur le fil principal (par petits lots) si le worker est indisponible.
 * Retourne { points, avancement, nbAjustees, sommeReel, sommeEv, parMain } ;
 * `points` et `parMain` valent null tant que le calcul n'est pas terminé.
 */
export function useCalculEv(mains) {
  const [etat, setEtat] = useState({
    points: null,
    avancement: 0,
    nbAjustees: 0,
    sommeReel: 0,
    sommeEv: 0,
    parMain: null,
  });

  useEffect(() => {
    let annule = false;
    let worker = null;

    (async () => {
      await chargerCachePersistant();
      if (annule) return;
      const manquantes = mains.filter((m) => !cacheParMain.has(m.id));
      const terminer = () => {
        const parMain = new Map();
        for (const m of mains) if (cacheParMain.has(m.id)) parMain.set(m.id, cacheParMain.get(m.id));
        if (!annule) setEtat(cumulerEv(mains, parMain));
      };
      if (manquantes.length === 0) {
        terminer();
        return;
      }
      // Nouveau calcul : on repart d'un état « en cours » (pas de points périmés).
      setEtat({
        points: null,
        avancement: (mains.length - manquantes.length) / mains.length,
        nbAjustees: 0,
        sommeReel: 0,
        sommeEv: 0,
        parMain: null,
      });

      // Les mises à jour d'avancement sont limitées à 3 par seconde pour ne pas
      // re-rendre l'onglet à chaque lot.
      let derniereMaj = 0;
      const recevoir = (resultats, fait) => {
        for (const r of resultats) cacheParMain.set(r.id, { reel: r.reel, ev: r.ev, ajustee: r.ajustee });
        sauvegarderCache();
        const maintenant = Date.now();
        if (!annule && maintenant - derniereMaj > 330) {
          derniereMaj = maintenant;
          setEtat((e) => ({ ...e, avancement: (mains.length - manquantes.length + fait) / mains.length }));
        }
      };

      // Repli : calcul sur le fil principal, par lots de 10 mains.
      const calculerIci = () => {
        let index = 0;
        const lot = () => {
          if (annule) return;
          const fin = Math.min(index + 10, manquantes.length);
          const resultats = [];
          for (; index < fin; index++) resultats.push({ id: manquantes[index].id, ...calculerMain(manquantes[index]) });
          recevoir(resultats, index);
          if (index < manquantes.length) setTimeout(lot, 0);
          else terminer();
        };
        lot();
      };

      try {
        worker = new EvWorker();
        let recu = false;
        worker.onmessage = (e) => {
          recu = true;
          if (e.data.type === "lot") recevoir(e.data.resultats, e.data.fait);
          else if (e.data.type === "fin") {
            terminer();
            worker.terminate();
            worker = null;
          }
        };
        worker.onerror = () => {
          worker.terminate();
          worker = null;
          if (!recu) calculerIci();
        };
        worker.postMessage({ mains: manquantes });
      } catch {
        worker = null;
        calculerIci();
      }
    })();

    return () => {
      annule = true;
      if (worker) worker.terminate();
    };
  }, [mains]);

  return etat;
}

/** Jetons gagnés cumulés, réel contre attendu (EV). */
export function GrapheEv({ calcul, idSuffixe = "" }) {
  const [survol, setSurvol] = useState(null);
  if (!calcul.points)
    return (
      <p className="muet">Calcul de l'équité des tapis… {Math.round(calcul.avancement * 100)} %</p>
    );
  const points = calcul.points;
  if (points.length < 2) return null;

  const L = 640;
  const H = 210;
  const m = { g: 52, d: 16, h: 16, b: 24 };
  const valeurs = points.flatMap((p) => [p.reel, p.ev]);
  const min = Math.min(0, ...valeurs);
  const max = Math.max(0, ...valeurs);
  const x = (i) => m.g + (i / (points.length - 1)) * (L - m.g - m.d);
  const y = (v) => m.h + ((max - v) / (max - min || 1)) * (H - m.h - m.b);
  const trace = (champ) => points.map((p, i) => ({ x: x(i), y: y(p[champ]) }));
  const dernier = points[points.length - 1];
  const graduations = [min, (min + max) / 2, max].filter((v, i, t) => t.indexOf(v) === i);
  const entier = (v) => Math.round(v).toLocaleString("fr-FR");
  const etiquettesProches = Math.abs(y(dernier.reel) - y(dernier.ev)) < 16;

  return (
    <div className="graphe" onMouseLeave={() => setSurvol(null)}>
      <div className="legende-graphe">
        <span>
          <span className="trait-legende reel" /> Réel
        </span>
        <span>
          <span className="trait-legende ev" /> Attendu (EV)
        </span>
        <span className="muet">{pluriel("main ajustée", calcul.nbAjustees)} à l'équité</span>
      </div>
      <svg
        viewBox={`0 0 ${L} ${H}`}
        onMouseMove={(e) => setSurvol(indexSousSouris(e, L, m.g, m.d, points.length))}
        role="img"
        aria-label="Jetons gagnés cumulés, réel contre attendu"
      >
        {graduations.map((v) => (
          <g key={v}>
            <line x1={m.g} x2={L - m.d} y1={y(v)} y2={y(v)} className="graphe-grille" />
            <text x={m.g - 6} y={y(v) + 3.5} className="graphe-grad">
              {entier(v)}
            </text>
          </g>
        ))}
        <line x1={m.g} x2={L - m.d} y1={y(0)} y2={y(0)} className="graphe-zero" />
        <defs>
          <linearGradient id={`degrade-reel${idSuffixe}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="graphe-degrade-haut" />
            <stop offset="100%" className="graphe-degrade-bas" />
          </linearGradient>
        </defs>
        <path d={aireSousCourbe(trace("reel"), H - m.b)} fill={`url(#degrade-reel${idSuffixe})`} />
        <path d={cheminLisse(trace("ev"))} className="graphe-ligne ev" />
        <path d={cheminLisse(trace("reel"))} className="graphe-ligne" />
        {survol !== null && (
          <line x1={x(survol)} x2={x(survol)} y1={m.h} y2={H - m.b} className="graphe-curseur" />
        )}
        {survol !== null && <circle cx={x(survol)} cy={y(points[survol].reel)} r="4" className="graphe-point" />}
        {survol !== null && <circle cx={x(survol)} cy={y(points[survol].ev)} r="4" className="graphe-point ev" />}
        <circle cx={x(points.length - 1)} cy={y(dernier.reel)} r="4" className="graphe-point" />
        <circle cx={x(points.length - 1)} cy={y(dernier.ev)} r="4" className="graphe-point ev" />
        <text
          x={L - 4}
          y={y(dernier.reel) + (etiquettesProches && dernier.reel < dernier.ev ? 14 : -8)}
          className="graphe-etiquette"
          textAnchor="end"
        >
          {entier(dernier.reel)}
        </text>
        <text
          x={L - 4}
          y={y(dernier.ev) + (etiquettesProches && dernier.ev <= dernier.reel ? 14 : -8)}
          className="graphe-etiquette ev"
          textAnchor="end"
        >
          {entier(dernier.ev)}
        </text>
      </svg>
      {survol !== null && (
        <div className="graphe-infobulle" style={{ left: `${(x(survol) / L) * 100}%` }}>
          <div>
            {dateHeure(points[survol].date)} — main {survol + 1}
          </div>
          <div>
            Réel : <strong>{entier(points[survol].reel)}</strong> jetons
          </div>
          <div>
            Attendu : <strong>{entier(points[survol].ev)}</strong> jetons
          </div>
        </div>
      )}
    </div>
  );
}
