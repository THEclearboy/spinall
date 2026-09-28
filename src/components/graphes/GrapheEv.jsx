import { useEffect, useState } from "react";
import { cheminLisse, aireSousCourbe, indexSousSouris } from "./chemins.js";
import { dateHeure, pluriel } from "../../lib/format.js";
import { resultatJoueur } from "../../lib/historique-mains.js";
import { tapisAvantRiver, jetonsAttendus } from "../../lib/analyse.js";

// Cache des résultats par main (le calcul d'équité est coûteux).
const cacheParMain = new Map();

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
 * Calcule, par lots de 50 mains pour ne pas bloquer l'interface, les jetons réels et
 * attendus de chaque main. Retourne { points, avancement, nbAjustees, sommeReel, sommeEv,
 * parMain } ; `points` et `parMain` valent null tant que le calcul n'est pas terminé.
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
    const triees = [...mains].sort((a, b) => (a.date || 0) - (b.date || 0));
    const parMain = new Map();
    let index = 0;

    function lot() {
      if (annule) return;
      const fin = Math.min(index + 50, triees.length);
      for (; index < fin; index++) {
        const main = triees[index];
        let calcule = cacheParMain.get(main.id);
        if (!calcule) {
          const tapis = tapisAvantRiver(main);
          calcule = {
            reel: main.hero ? resultatJoueur(main, main.hero) : 0,
            ev: main.hero ? jetonsAttendus(main) : 0,
            ajustee: !!(tapis && tapis.aVenir > 0),
          };
          cacheParMain.set(main.id, calcule);
        }
        parMain.set(main.id, calcule);
      }
      if (index < triees.length) {
        setEtat((e) => ({ ...e, avancement: index / triees.length }));
        setTimeout(lot, 0);
      } else {
        setEtat(cumulerEv(triees, parMain));
      }
    }

    lot();
    return () => {
      annule = true;
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
