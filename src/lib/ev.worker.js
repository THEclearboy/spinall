// Worker : calcule jetons réels / attendus (équité à tapis) hors du fil principal.
// Reçoit { mains: [...] }, renvoie des lots { type: "lot", resultats: [{ id, reel, ev, ajustee }], fait, total }
// puis { type: "fin" }.
import { resultatJoueur } from "./historique-mains.js";
import { tapisAvantRiver, jetonsAttendus } from "./analyse.js";

export function calculerMain(main) {
  const tapis = tapisAvantRiver(main);
  return {
    id: main.id,
    reel: main.hero ? resultatJoueur(main, main.hero) : 0,
    ev: main.hero ? jetonsAttendus(main) : 0,
    ajustee: !!(tapis && tapis.aVenir > 0),
  };
}

self.onmessage = (e) => {
  const mains = e.data.mains || [];
  const total = mains.length;
  let lot = [];
  for (let i = 0; i < total; i++) {
    lot.push(calculerMain(mains[i]));
    if (lot.length >= 20 || i === total - 1) {
      self.postMessage({ type: "lot", resultats: lot, fait: i + 1, total });
      lot = [];
    }
  }
  self.postMessage({ type: "fin" });
};
