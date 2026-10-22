// Mode entraînement (sessions de jeu marquées) : des parties marquées « entraînement » (souvent à 0,20 €, pour
// apprendre à jouer plus de tables sans risquer d'argent) comparées aux parties
// normales de la même limite. Fonctions pures.
import { calculerStats, regrouperParties } from "./analyse.js";
import { sessions } from "./heures.js";

export const LIMITE_ENTRAINEMENT_DEFAUT = 0.2;
const DUREE_DERNIERE_MAIN_MS = 60 * 1000;

/** Parties présentes dans des mains : [{ id, limite, date, entrainement, nbMains }]. */
export function partiesDe(mains) {
  const parties = new Map();
  for (const m of mains) {
    if (!m.partieId) continue;
    if (!parties.has(m.partieId)) parties.set(m.partieId, { id: m.partieId, limite: m.buyIn ?? null, date: m.date || 0, entrainement: !!m.entrainement, nbMains: 0 });
    const p = parties.get(m.partieId);
    p.nbMains += 1;
    if (m.date && (!p.date || m.date < p.date)) p.date = m.date;
    if (m.entrainement) p.entrainement = true;
  }
  return [...parties.values()].sort((a, b) => a.date - b.date);
}

/** Nombre de parties par limite : [{ limite, parties }] triées par limite. */
export function partiesParLimite(parties) {
  const compte = new Map();
  for (const p of parties) compte.set(p.limite, (compte.get(p.limite) || 0) + 1);
  return [...compte.entries()].map(([limite, nb]) => ({ limite, parties: nb })).sort((a, b) => (a.limite ?? 0) - (b.limite ?? 0));
}

/** Marque (ou démarque) les mains des parties données. Les autres mains sont inchangées. */
export function marquerParties(mains, ids, valeur = true) {
  const cibles = ids instanceof Set ? ids : new Set(ids);
  return mains.map((m) => {
    if (!m.partieId || !cibles.has(m.partieId)) return m;
    if (!!m.entrainement === valeur) return m;
    const copie = { ...m };
    if (valeur) copie.entrainement = true;
    else delete copie.entrainement;
    return copie;
  });
}

/** Ids des parties d'une limite jouées entre debut et fin (bornes incluses, horodatages ms ; null = sans borne). */
export function idsParLimiteEtPeriode(mains, limite, debut = null, fin = null) {
  const ids = new Set();
  for (const p of partiesDe(mains)) {
    if (limite !== null && p.limite !== limite) continue;
    if (debut !== null && p.date < debut) continue;
    if (fin !== null && p.date > fin) continue;
    ids.add(p.id);
  }
  return ids;
}

/** mode : "tout" | "normal" | "entrainement". */
export function filtrerMode(mains, mode) {
  if (mode === "normal") return mains.filter((m) => !m.entrainement);
  if (mode === "entrainement") return mains.filter((m) => m.entrainement);
  return mains;
}

/** Heures de jeu (sessions sans trou de plus de 20 min) contenues dans des mains. */
export function heuresDeJeu(mains) {
  let ms = 0;
  for (const s of sessions(mains)) ms += s.fin - s.debut + DUREE_DERNIERE_MAIN_MS;
  return ms / 3_600_000;
}

/**
 * Tables jouées en même temps : chaque partie occupe [première main, dernière main + 1 min].
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

/** Résumé d'un sous-ensemble de mains (normal ou entraînement) pour la comparaison. */
export function resumerMode(mains, charts, parMain) {
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
 * Comparaison normal / entraînement sur une limite (null = toutes).
 * Renvoie { limite, normal, entrainement, limitesEntrainement } ; limitesEntrainement liste les
 * limites qui ont des parties d'entraînement, pour proposer un choix.
 */
export function comparerEntrainement(mains, charts, parMain, limite = null) {
  const cibles = limite === null ? mains : mains.filter((m) => m.buyIn === limite);
  const limitesEntrainement = [...new Set(mains.filter((m) => m.entrainement).map((m) => m.buyIn))].sort((a, b) => a - b);
  return {
    limite,
    limitesEntrainement,
    normal: resumerMode(filtrerMode(cibles, "normal"), charts, parMain),
    entrainement: resumerMode(filtrerMode(cibles, "entrainement"), charts, parMain),
  };
}

/** Limite proposée par défaut pour la comparaison : 0,20 € si elle existe, sinon la plus basse avec de l'entraînement. */
export function limiteComparaisonParDefaut(mains) {
  const limites = [...new Set(mains.filter((m) => m.entrainement).map((m) => m.buyIn))].sort((a, b) => a - b);
  if (limites.includes(LIMITE_ENTRAINEMENT_DEFAUT)) return LIMITE_ENTRAINEMENT_DEFAUT;
  return limites.length ? limites[0] : null;
}

// regrouperParties est réexporté pour les composants qui n'ont besoin que de lui.
export { regrouperParties };
