// Résultats par limite (buy-in) : gains, places, cEV.
import { regrouperParties } from "./analyse.js";

/** Buy-ins distincts présents dans les mains, triés croissant. */
export function limitesPresentes(mains) {
  const set = new Set();
  for (const main of mains) if (main.buyIn !== null && main.buyIn !== undefined) set.add(main.buyIn);
  return [...set].sort((a, b) => a - b);
}

/**
 * Bilan par limite et global.
 * evParMain : Map(handId → { reel, ev }) (null tant que le calcul n'est pas fini).
 * Retourne [{ limite: number|null (null = toutes), parties, partiesJouees, netEuro, investi, roi,
 *   places, nbMains, cEV, reelParPartie }].
 */
export function bilanParLimite(mains, evParMain) {
  const limites = limitesPresentes(mains);
  const lignes = [];
  for (const limite of [...limites, null]) {
    const selection = limite === null ? mains : mains.filter((m) => m.buyIn === limite);
    const parties = regrouperParties(selection);
    const jouees = parties.filter((p) => p.resultatConnu);
    const netEuro = parties.reduce((s, p) => s + p.netEuro, 0);
    const investi = parties.reduce((s, p) => s + (p.buyIn || 0), 0);
    const places = { 1: 0, 2: 0, 3: 0 };
    for (const p of jouees) if (places[p.place] !== undefined) places[p.place] += 1;
    let sommeEv = 0;
    let sommeReel = 0;
    let evComplet = !!evParMain;
    if (evParMain)
      for (const m of selection) {
        const r = evParMain.get(m.id);
        if (!r) {
          evComplet = false;
          break;
        }
        sommeEv += r.ev;
        sommeReel += r.reel;
      }
    lignes.push({
      limite,
      parties: parties.length,
      partiesJouees: jouees.length,
      netEuro,
      investi,
      roi: investi > 0 ? netEuro / investi : null,
      places,
      nbMains: selection.length,
      cEV: evComplet && parties.length > 0 ? sommeEv / parties.length : null,
      reelParPartie: evComplet && parties.length > 0 ? sommeReel / parties.length : null,
    });
  }
  return lignes;
}
