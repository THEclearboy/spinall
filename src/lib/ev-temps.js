// cEV dans le temps : l'EV (jetons, chance neutralisée) regroupée par partie, par jour ou par
// semaine, pour voir quand on en a perdu beaucoup. Fonctions pures.
import { cleJour } from "./heures.js";

/** Lundi 00:00 de la semaine d'un horodatage (fuseau local). */
export function debutSemaine(horodatage) {
  const d = new Date(horodatage);
  d.setHours(0, 0, 0, 0);
  const jour = (d.getDay() + 6) % 7; // lundi = 0
  d.setDate(d.getDate() - jour);
  return d.getTime();
}

/**
 * EV par période. granularite : "partie" | "jour" | "semaine".
 * parMain : Map id → { reel, ev } (calcul d'équité) ; les mains sans résultat sont ignorées.
 * Renvoie [{ cle, date, libelle, ev, reel, parties, mains }] dans l'ordre chronologique.
 */
export function evParPeriode(mains, parMain, granularite = "partie") {
  if (!parMain) return [];
  const groupes = new Map();
  for (const m of mains) {
    const r = parMain.get(m.id);
    if (!r || !m.date) continue;
    let cle;
    let date;
    if (granularite === "jour") {
      cle = cleJour(m.date);
      date = new Date(m.date);
      date.setHours(0, 0, 0, 0);
      date = date.getTime();
    } else if (granularite === "semaine") {
      date = debutSemaine(m.date);
      cle = `s${date}`;
    } else {
      if (!m.partieId) continue;
      cle = m.partieId;
      date = m.date;
    }
    if (!groupes.has(cle)) groupes.set(cle, { cle, date, ev: 0, reel: 0, parties: new Set(), mains: 0, limite: m.buyIn ?? null });
    const g = groupes.get(cle);
    g.ev += r.ev;
    g.reel += r.reel;
    g.mains += 1;
    if (m.partieId) g.parties.add(m.partieId);
    if (m.date < g.date) g.date = m.date;
  }
  const liste = [...groupes.values()].map((g) => ({ ...g, parties: g.parties.size }));
  liste.sort((a, b) => a.date - b.date);
  for (const g of liste) g.libelle = libellePeriode(g.date, granularite);
  return liste;
}

export function libellePeriode(date, granularite) {
  const d = new Date(date);
  if (granularite === "jour") return d.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" });
  if (granularite === "semaine") return `sem. du ${d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}`;
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Les n périodes où l'EV a le plus baissé (ev < 0), de la pire à la moins pire. */
export function piresPeriodes(liste, n = 5) {
  return liste.filter((g) => g.ev < 0).sort((a, b) => a.ev - b.ev).slice(0, n);
}

/** Granularité conseillée : par partie tant que ça reste lisible, sinon par jour, puis par semaine. */
export function granulariteConseillee(nbParties, nbJours) {
  if (nbParties <= 250) return "partie";
  if (nbJours <= 120) return "jour";
  return "semaine";
}
