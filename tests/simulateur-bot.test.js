import { test } from "node:test";
import assert from "node:assert/strict";
import donnees from "../src/data/ranges.json" with { type: "json" };
import { construireCharts } from "../src/lib/charts.js";
import { creerTable, demarrerMain, actionsLegales, jouer } from "../src/lib/simulateur/moteur.js";
import { deciderBot, forcePreflop, spotCouvert, lireMain, tirages } from "../src/lib/simulateur/bot.js";
import { jugerPreflop, analyserCbet, estRelanceurPreflop } from "../src/lib/simulateur/coach.js";
import { Simulation, dureeNiveauBetclic } from "../src/lib/simulateur/partie.js";

function graine(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const charts = construireCharts(donnees);
const carte = (txt) => ({ rang: txt[0], couleur: txt[1] });
const cartes = (...txts) => txts.map(carte);
const JOUEURS = [
  { id: "hero", nom: "ClearBoy", hero: true },
  { id: "b1", nom: "BiGTony" },
  { id: "b2", nom: "Grrrisbi" },
];

test("bot : force pré-flop, lecture de main et tirages", () => {
  assert.equal(forcePreflop(carte("As"), carte("Ah")), 1);
  assert.ok(forcePreflop(carte("As"), carte("Ks")) > forcePreflop(carte("7c"), carte("2d")));
  assert.ok(forcePreflop(carte("Js"), carte("Ts")) > forcePreflop(carte("Jc"), carte("6d")));
  const paire = lireMain(cartes("As", "Kd"), cartes("Ah", "7c", "2s"));
  assert.equal(paire.categorie, 1);
  assert.equal(paire.premier, 14, "top paire d'as");
  assert.equal(lireMain(cartes("9s", "9d"), cartes("9h", "7c", "2s")).categorie, 3);
  assert.deepEqual(tirages(cartes("As", "Ks"), cartes("Qs", "7s", "2d")), { couleur: true, quinte: false });
  assert.deepEqual(tirages(cartes("9c", "8d"), cartes("7s", "6h", "2d")), { couleur: false, quinte: true });
  assert.deepEqual(tirages(cartes("9c", "8d"), cartes("7s", "6h", "2d", "Kc", "Kd")), { couleur: false, quinte: false }, "plus de tirage à la river");
});

test("bot : des centaines de parties jouées par des bots sans action illégale, jetons conservés", () => {
  const alea = graine(7);
  let partiesFinies = 0;
  for (let p = 0; p < 12; p++) {
    const t = creerTable({ id: "B" + p, joueurs: JOUEURS, alea, dureeNiveauMs: 30_000 });
    let horloge = 0;
    let mains = 0;
    while (!t.termine && mains < 400) {
      horloge += 15_000;
      demarrerMain(t, horloge);
      mains += 1;
      let coups = 0;
      while (t.main.rue !== "fin" && coups < 80) {
        const legal = actionsLegales(t);
        const action = deciderBot(t, legal.joueur, charts, alea);
        assert.ok(action && ["fold", "check", "call", "raise", "allin"].includes(action.verbe), "action connue");
        jouer(t, legal.joueur, action);
        coups += 1;
      }
      assert.equal(t.main.rue, "fin");
      const total = t.joueurs.reduce((s, j) => s + j.stack, 0);
      assert.equal(total, 1500);
    }
    if (t.termine) partiesFinies += 1;
  }
  assert.ok(partiesFinies >= 10, `les bots finissent leurs parties (${partiesFinies}/12)`);
});

test("coach : spot couvert, verdict pré-flop, c-bet", () => {
  const t = creerTable({ id: "C1", joueurs: JOUEURS, alea: graine(11) });
  demarrerMain(t, 0);
  const m = t.main;
  // forcer : héros au bouton avec AA à 25 bb → attendu all-in (ou raise selon le tableau)
  const btn = m.bouton;
  m.cartes[btn] = cartes("As", "Ah");
  const spot = spotCouvert(t, btn, charts);
  assert.ok(spot, "le bouton premier de parole est couvert");
  assert.equal(spot.familleId, "3W_BTN");
  assert.equal(spot.nom, "AA");
  assert.equal(spot.profondeur, 25);
  const legal = actionsLegales(t);
  const verdictFold = jugerPreflop(spot, { verbe: "fold" }, legal);
  assert.equal(verdictFold.conforme, false);
  assert.match(verdictFold.texte, /attendu/);
  const verdictAttendu = jugerPreflop(spot, spot.attendu === "allin" ? { verbe: "allin" } : { verbe: "raise", montant: 50 }, legal);
  assert.equal(verdictAttendu.conforme, true);
  // les autres positions ne sont pas couvertes à 3 joueurs
  jouer(t, btn, { verbe: "raise", montant: 50 });
  assert.equal(spotCouvert(t, m.petiteBlind, charts), null);
  // c-bet : le bouton a relancé ; au flop, s'il peut miser et checke → c-bet manqué
  jouer(t, m.petiteBlind, { verbe: "fold" });
  jouer(t, m.grosseBlind, { verbe: "call" });
  assert.equal(m.rue, "flop");
  assert.equal(estRelanceurPreflop(m, btn), true);
  jouer(t, m.grosseBlind, { verbe: "check" });
  const legalFlop = actionsLegales(t);
  assert.equal(legalFlop.joueur, btn);
  assert.equal(analyserCbet(m, btn, { verbe: "check" }, legalFlop).cbet, false);
  assert.equal(analyserCbet(m, btn, { verbe: "raise", montant: 60 }, legalFlop).cbet, true);
  assert.equal(analyserCbet(m, m.grosseBlind, { verbe: "check" }, legalFlop), null, "la BB n'était pas le relanceur");
});

test("simulation : 3 tables, horloge, temps écoulé, compteurs", () => {
  const alea = graine(99);
  const sim = new Simulation({ nbTables: 3, buyIn: 0.2, charts, secondesAction: 10, dureeNiveauSec: 60, alea, maintenant: 0 });
  assert.equal(sim.tables.length, 3);
  assert.equal(sim.stats.investi, 0.6);
  let horloge = 0;
  let decisions = 0;
  for (let i = 0; i < 4000 && decisions < 60; i++) {
    horloge += 250;
    sim.tick(horloge);
    for (const t of sim.tables) {
      if (t.table.main && t.table.main.aParler === "hero") {
        const restant = sim.tempsRestant(t, horloge);
        assert.ok(restant !== null && restant <= 10);
        if (decisions % 3 === 0) continue; // on laisse parfois le temps s'écouler
        const legal = actionsLegales(t.table);
        sim.agirHero(t.table.id, legal.peutCheck ? { verbe: "check" } : { verbe: "call" }, horloge);
        decisions += 1;
      }
    }
  }
  assert.ok(sim.stats.mainsJouees > 10, "des mains sont jouées");
  assert.ok(sim.stats.tempsEcoules > 0, "le temps écoulé déclenche un fold/check automatique");
  assert.ok(sim.messages.some((m) => m.type === "temps"));
  assert.ok(sim.stats.spots >= 0);
  for (const t of sim.tables) {
    const total = t.table.joueurs.reduce((s, j) => s + j.stack, 0) + (t.table.main && t.table.main.rue !== "fin" ? t.table.main.pot : 0);
    assert.equal(total, 1500);
  }
});

test("simulation : le joueur éliminé voit sa partie se terminer et une nouvelle table arriver", () => {
  const alea = graine(3);
  const sim = new Simulation({ nbTables: 1, buyIn: 1, charts, secondesAction: 10, dureeNiveauSec: 60, alea, maintenant: 0 });
  let horloge = 0;
  let finies = 0;
  let debutPremiere = sim.tables[0].table.debut;
  for (let i = 0; i < 20000 && sim.stats.parties < 2; i++) {
    horloge += 200;
    sim.tick(horloge);
    const t = sim.tables[0];
    if (t.finie) finies += 1;
    if (t.table.main && t.table.main.aParler === "hero") sim.agirHero(t.table.id, { verbe: "allin" }, horloge); // on pousse tout, pour finir vite
  }
  assert.ok(sim.stats.parties >= 2, `au moins deux parties jouées (${sim.stats.parties})`);
  assert.ok(finies > 0, "la table passe par l'état « finie »");
  assert.notEqual(sim.tables[0].table.debut, debutPremiere, "une nouvelle table a remplacé la première");
  assert.equal(sim.stats.places[1] + sim.stats.places[2] + sim.stats.places[3], sim.stats.parties);
  assert.ok(sim.stats.investi >= sim.stats.parties && sim.stats.investi <= sim.stats.parties + 1, "chaque table lancée coûte un buy-in");
});

test("structure Betclic : durée des niveaux selon le multiplicateur", () => {
  assert.equal(dureeNiveauBetclic(2), 60);
  assert.equal(dureeNiveauBetclic(3), 90);
  assert.equal(dureeNiveauBetclic(5), 120);
  assert.equal(dureeNiveauBetclic(100), 120);
  const sim = new Simulation({ nbTables: 2, buyIn: 0.2, charts, alea: graine(5), maintenant: 0 });
  for (const t of sim.tables) assert.equal(t.table.dureeNiveauMs, dureeNiveauBetclic(t.table.multiplicateur) * 1000);
  const fixe = new Simulation({ nbTables: 1, buyIn: 0.2, charts, dureeNiveauSec: 180, alea: graine(5), maintenant: 0 });
  assert.equal(fixe.tables[0].table.dureeNiveauMs, 180_000);
});
