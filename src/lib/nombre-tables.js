// Nombre de tables jouées en même temps, déclaré à l'import par jour et par limite, puis utilisé pour
// comparer ses résultats (cEV, réel, ranges, rythme…) selon le nombre de tables. Fonctions pures.
import { calculerStats, regrouperParties } from "./analyse.js";
import { sessions, cleJour } from "./heures.js";

/** Au-delà de ce nombre de jours dans un import, on ne pose pas la question (trop de lignes). */
export const MAX_JOURS_QUESTION = 3;
export const CHOIX_TABLES = [1, 2, 3, 4, 5, 6, 8];
const DUREE_DERNIERE_MAIN_MS = 60 * 1000;

/** Parties présentes dans des mains : [{ id, limite, date, jour, tables, nbMains }] triées par date. */
export function partiesDe(mains) {
  const parties = new Map();
  for (const m of mains) {
    if (!m.partieId) continue;
    if (!parties.has(m.partieId)) parties.set(m.partieId, { id: m.partieId, limite: m.buyIn ?? null, date: m.date || 0, tables: null, nbMains: 0 });
    const p = parties.get(m.partieId);
    p.nbMains += 1;
    if (m.date && (!p.date || m.date < p.date)) p.date = m.date;
    if (m.tables && !p.tables) p.tables = m.tables;
  }
  const liste = [...parties.values()].sort((a, b) => a.date - b.date);
  for (const p of liste) p.jour = p.date ? cleJour(p.date) : "";
  return liste;
}

/**
 * Lignes « jour × limite » : [{ cle, jour, date, limite, ids, parties, tables }] triées par jour puis limite.
 * tables : valeur déclarée commune aux parties de la ligne, sinon null.
 */
export function lignesParJourEtLimite(parties) {
  const lignes = new Map();
  for (const p of parties) {
    const cle = `${p.jour}|${p.limite ?? "?"}`;
    if (!lignes.has(cle)) lignes.set(cle, { cle, jour: p.jour, date: p.date, limite: p.limite, ids: [], parties: 0, tables: p.tables, mixte: false });
    const l = lignes.get(cle);
    l.ids.push(p.id);
    l.parties += 1;
    if (p.date && p.date < l.date) l.date = p.date;
    if (l.tables !== p.tables) l.mixte = true;
  }
  return [...lignes.values()]
    .map((l) => ({ ...l, tables: l.mixte ? null : l.tables }))
    .sort((a, b) => a.jour.localeCompare(b.jour) || (a.limite ?? 0) - (b.limite ?? 0));
}

export const nombreDeJours = (parties) => new Set(parties.map((p) => p.jour)).size;

/** On demande le nombre de tables quand l'import tient en MAX_JOURS_QUESTION jours au plus. */
export function doitDemanderTables(parties) {
  const n = nombreDeJours(parties);
  return n >= 1 && n <= MAX_JOURS_QUESTION;
}

/** Pose (ou retire, tables = null) le nombre de tables sur les mains des parties données. */
export function definirTables(mains, ids, tables) {
  const cibles = ids instanceof Set ? ids : new Set(ids);
  const voulu = tables ? Number(tables) : null;
  return mains.map((m) => {
    if (!m.partieId || !cibles.has(m.partieId)) return m;
    if ((m.tables ?? null) === voulu && !("entrainement" in m)) return m;
    const copie = { ...m };
    delete copie.entrainement; // ancien marquage « entraînement », remplacé par le nombre de tables
    if (voulu) copie.tables = voulu;
    else delete copie.tables;
    return copie;
  });
}

/** Nombres de tables déclarés, triés : [2, 4, …]. */
export function tablesDeclarees(mains) {
  return [...new Set(mains.filter((m) => m.tables).map((m) => m.tables))].sort((a, b) => a - b);
}

/** Heures de jeu (sessions sans trou de plus de 20 min) contenues dans des mains. */
export function heuresDeJeu(mains) {
  let ms = 0;
  for (const s of sessions(mains)) ms += s.fin - s.debut + DUREE_DERNIERE_MAIN_MS;
  return ms / 3_600_000;
}

/**
 * Tables jouées en même temps d'après les horodatages : chaque partie occupe [première main, dernière main + 1 min].
 * moyenne = somme des durées de parties / durée couverte (union des intervalles) ; max = pic.
 */
export function tablesSimultanees(mains) {
  const intervalles = new Map();
  for (const m of mains) {
    if (!m.partieId || !m.date) continue;
    const i = intervalles.get(m.partieId) || { debut: m.date, fin: m.date };
    if (m.date < i.debut) i.debut = m.date;
    if (m.date > i.fin) i.fin = m.date;
    intervalles.set(m.partieId, i);
  }
  const liste = [...intervalles.values()].map((i) => ({ debut: i.debut, fin: i.fin + DUREE_DERNIERE_MAIN_MS }));
  if (liste.length === 0) return { moyenne: null, max: 0, parties: 0 };
  const evenements = [];
  let sommeDurees = 0;
  for (const i of liste) {
    sommeDurees += i.fin - i.debut;
    evenements.push([i.debut, 1], [i.fin, -1]);
  }
  evenements.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let courant = 0;
  let max = 0;
  let couverture = 0;
  let debutCouvert = null;
  for (const [t, delta] of evenements) {
    if (courant === 0 && delta === 1) debutCouvert = t;
    courant += delta;
    if (courant > max) max = courant;
    if (courant === 0 && debutCouvert !== null) {
      couverture += t - debutCouvert;
      debutCouvert = null;
    }
  }
  return { moyenne: couverture > 0 ? sommeDurees / couverture : null, max, parties: liste.length };
}

function sommesEv(mains, parMain) {
  if (!parMain) return null;
  let ev = 0;
  let reel = 0;
  let complet = true;
  for (const m of mains) {
    const r = parMain.get(m.id);
    if (!r) {
      complet = false;
      continue;
    }
    ev += r.ev;
    reel += r.reel;
  }
  return complet ? { ev, reel } : null;
}

/** Résumé d'un sous-ensemble de mains : parties, cEV et réel par partie (jetons), ROI, ranges, rythme… */
export function resumer(mains, charts, parMain) {
  const stats = calculerStats(mains, charts);
  const nbParties = stats.parties.length;
  const heures = heuresDeJeu(mains);
  const ev = sommesEv(mains, parMain);
  const tables = tablesSimultanees(mains);
  return {
    parties: nbParties,
    nbMains: stats.nbMains,
    conformite: stats.tauxConformite,
    nbSpots: stats.spots.length,
    cEV: ev && nbParties ? ev.ev / nbParties : null,
    reel: ev && nbParties ? ev.reel / nbParties : null,
    netEuro: stats.netEuro,
    investi: stats.investi,
    roi: stats.investi > 0 ? stats.netEuro / stats.investi : null,
    victoires: stats.partiesJouees.length ? stats.places[1] / stats.partiesJouees.length : null,
    heures,
    partiesParHeure: heures > 0 ? nbParties / heures : null,
    tablesMoyennes: tables.moyenne,
    tablesMax: tables.max,
    vpip: stats.vpip,
    pfr: stats.pfr,
  };
}

/**
 * Résultats par nombre de tables sur une limite (null = toutes) :
 * { limite, lignes: [{ tables, …resumer }], sansTables: resumer | null, total: resumer, limitesAvecTables }.
 */
export function comparerParTables(mains, charts, parMain, limite = null) {
  const cibles = limite === null ? mains : mains.filter((m) => m.buyIn === limite);
  const limitesAvecTables = [...new Set(mains.filter((m) => m.tables).map((m) => m.buyIn))].sort((a, b) => a - b);
  const lignes = tablesDeclarees(cibles).map((n) => ({ tables: n, ...resumer(cibles.filter((m) => m.tables === n), charts, parMain) }));
  const sans = cibles.filter((m) => !m.tables);
  return {
    limite,
    limitesAvecTables,
    lignes,
    sansTables: sans.length && lignes.length ? resumer(sans, charts, parMain) : null,
    total: resumer(cibles, charts, parMain),
  };
}

/** Détail par jour d'un nombre de tables sur une limite : [{ jour, date, parties, cEV, reel, netEuro }] du plus récent au plus ancien. */
export function detailParJour(mains, parMain, limite, tables) {
  const cibles = mains.filter((m) => (limite === null || m.buyIn === limite) && (tables === null ? !m.tables : m.tables === tables));
  const parJour = new Map();
  for (const m of cibles) {
    if (!m.date) continue;
    const jour = cleJour(m.date);
    if (!parJour.has(jour)) parJour.set(jour, { jour, date: m.date, mains: [] });
    const j = parJour.get(jour);
    j.mains.push(m);
    if (m.date < j.date) j.date = m.date;
  }
  return [...parJour.values()]
    .map((j) => {
      const parties = regrouperParties(j.mains);
      const ev = sommesEv(j.mains, parMain);
      return {
        jour: j.jour,
        date: j.date,
        parties: parties.length,
        cEV: ev && parties.length ? ev.ev / parties.length : null,
        reel: ev && parties.length ? ev.reel / parties.length : null,
        netEuro: parties.reduce((s, p) => s + p.netEuro, 0),
      };
    })
    .sort((a, b) => b.date - a.date);
}

/** Limite proposée par défaut : celle qui a le plus de parties avec un nombre de tables, sinon la plus jouée. */
export function limiteParDefaut(mains) {
  const compte = new Map();
  const total = new Map();
  for (const p of partiesDe(mains)) {
    total.set(p.limite, (total.get(p.limite) || 0) + 1);
    if (p.tables) compte.set(p.limite, (compte.get(p.limite) || 0) + 1);
  }
  const source = compte.size ? compte : total;
  let meilleure = null;
  for (const [limite, n] of source) if (meilleure === null || n > source.get(meilleure)) meilleure = limite;
  return meilleure;
}

/** Lignes jour × limite pour la saisie après coup (du plus récent au plus ancien) ; sansValeur : seulement celles sans nombre de tables. */
export function lignesASaisir(mains, sansValeur = true) {
  return lignesParJourEtLimite(partiesDe(mains))
    .filter((l) => !sansValeur || l.tables === null)
    .sort((a, b) => b.jour.localeCompare(a.jour) || (a.limite ?? 0) - (b.limite ?? 0));
}

export const formatJour = (date) => new Date(date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
