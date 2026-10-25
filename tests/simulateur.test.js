import { test } from "node:test";
import assert from "node:assert/strict";
import { creerTable, demarrerMain, actionsLegales, jouer, niveauCourant, positionDe, profondeurEffectiveDe, nomMainDe } from "../src/lib/simulateur/moteur.js";

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
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
const JOUEURS = [
  { id: "hero", nom: "ClearBoy", hero: true },
  { id: "b1", nom: "BiGTony" },
  { id: "b2", nom: "Grrrisbi" },
];
const total = (t) => t.joueurs.reduce((s, j) => s + j.stack, 0) + (t.main && t.main.rue !== "fin" ? t.main.pot : 0);
const carte = (txt) => ({ rang: txt[0], couleur: txt[1] });
const cartes = (...txts) => txts.map(carte);

test("moteur : création, blinds, ordre de parole à 3 joueurs", () => {
  const t = creerTable({ id: "T1", buyIn: 0.2, joueurs: JOUEURS, alea: graine(1), maintenant: 0 });
  assert.equal(t.joueurs.length, 3);
  assert.ok(t.joueurs.every((j) => j.stack === 500));
  assert.ok([2, 3, 5, 10, 25, 100].includes(t.multiplicateur));
  assert.equal(t.prix, Math.round(0.2 * t.multiplicateur * 100) / 100);
  assert.ok(demarrerMain(t, 0));
  const m = t.main;
  assert.equal(m.sb, 10);
  assert.equal(m.bb, 20);
  assert.equal(m.pot, 30);
  assert.equal(Object.keys(m.cartes).length, 3);
  assert.equal(positionDe(m, m.bouton), "BTN");
  assert.equal(m.aParler, m.bouton, "le bouton parle en premier pré-flop à 3");
  const legal = actionsLegales(t);
  assert.equal(legal.montantCall, 20);
  assert.equal(legal.relanceMin, 40);
  assert.equal(legal.relanceMax, 500);
  assert.equal(profondeurEffectiveDe(m, "hero"), 25);
  assert.ok(/^[AKQJT98765432]{2}[so]?$/.test(nomMainDe(m, "hero")));
  assert.equal(total(t), 1500);
});

test("moteur : tout le monde se couche, la grosse blind ramasse et récupère sa surenchère", () => {
  const t = creerTable({ id: "T2", joueurs: JOUEURS, alea: graine(2) });
  demarrerMain(t, 0);
  const m = t.main;
  const bouton = m.bouton;
  jouer(t, bouton, { verbe: "fold" });
  assert.equal(m.aParler, m.petiteBlind);
  jouer(t, m.petiteBlind, { verbe: "fold" });
  assert.equal(m.rue, "fin");
  const bb = t.joueurs.find((j) => j.id === m.grosseBlind);
  assert.equal(bb.stack, 510, "la BB gagne la petite blind");
  assert.equal(total(t), 1500);
  assert.equal(m.resultat.abattage, false);
});

test("moteur : relance minimale, sur-relance et tour qui se referme", () => {
  const t = creerTable({ id: "T3", joueurs: JOUEURS, alea: graine(3) });
  demarrerMain(t, 0);
  const m = t.main;
  const [btn, sb, bb] = [m.bouton, m.petiteBlind, m.grosseBlind];
  jouer(t, btn, { verbe: "raise", montant: 60 });
  assert.equal(m.miseCourante, 60);
  let legal = actionsLegales(t);
  assert.equal(legal.joueur, sb);
  assert.equal(legal.relanceMin, 100, "min-raise = 60 + 40");
  jouer(t, sb, { verbe: "raise", montant: 100 }); // relance trop petite ramenée au minimum
  assert.equal(m.miseCourante, 100);
  jouer(t, bb, { verbe: "call" });
  legal = actionsLegales(t);
  assert.equal(legal.joueur, btn, "la relance rouvre la parole au bouton");
  jouer(t, btn, { verbe: "call" });
  assert.equal(m.rue, "flop");
  assert.equal(m.board.length, 3);
  assert.equal(m.pot, 300);
  assert.equal(m.aParler, sb, "post-flop, la petite blind parle en premier");
  // check autour → turn
  jouer(t, sb, { verbe: "check" });
  jouer(t, bb, { verbe: "check" });
  jouer(t, btn, { verbe: "check" });
  assert.equal(m.rue, "turn");
  assert.equal(m.board.length, 4);
  assert.equal(total(t), 1500);
});

test("moteur : tapis multiples, pots secondaires, éliminations et vainqueur", () => {
  const t = creerTable({ id: "T4", joueurs: JOUEURS, alea: graine(4) });
  t.joueurs[0].stack = 100; // hero court
  t.joueurs[1].stack = 500;
  t.joueurs[2].stack = 900;
  demarrerMain(t, 0);
  const m = t.main;
  // cartes forcées : le gros stack a la meilleure main, le héros la pire
  m.cartes[t.joueurs[2].id] = cartes("As", "Ah");
  m.cartes[t.joueurs[1].id] = cartes("Ks", "Kh");
  m.cartes[t.joueurs[0].id] = cartes("7c", "2d");
  m.paquet = cartes("9d", "8c", "4s", "Jh", "3c", "Qd", "Tc"); // pop() prend la fin : Tc Qd 3c | Jh | 4s
  // tout le monde à tapis dans l'ordre de parole
  while (m.rue !== "fin") jouer(t, m.aParler, { verbe: "allin" });
  assert.equal(m.rue, "fin");
  assert.equal(m.board.length, 5);
  assert.equal(m.resultat.abattage, true);
  const gros = t.joueurs[2];
  const moyen = t.joueurs[1];
  const hero = t.joueurs[0];
  assert.equal(hero.stack, 0);
  assert.equal(moyen.stack, 0);
  assert.equal(gros.stack, 1500, "AA ramasse tout, surenchère comprise");
  assert.equal(hero.elimine, true);
  assert.equal(moyen.elimine, true);
  assert.ok(hero.place === 3 && moyen.place === 2, "le plus petit tapis de départ finit dernier");
  assert.equal(t.termine, true);
  assert.equal(t.vainqueur, gros.id);
  assert.equal(gros.place, 1);
});

test("moteur : pot secondaire partagé correctement quand le petit tapis gagne", () => {
  const t = creerTable({ id: "T5", joueurs: JOUEURS, alea: graine(5) });
  t.joueurs[0].stack = 100;
  t.joueurs[1].stack = 500;
  t.joueurs[2].stack = 900;
  demarrerMain(t, 0);
  const m = t.main;
  m.cartes[t.joueurs[0].id] = cartes("As", "Ah"); // petit tapis, meilleure main
  m.cartes[t.joueurs[1].id] = cartes("Ks", "Kh");
  m.cartes[t.joueurs[2].id] = cartes("7c", "2d");
  m.paquet = cartes("9d", "8c", "4s", "Jh", "3c", "Qd", "Tc");
  while (m.rue !== "fin") jouer(t, m.aParler, { verbe: "allin" });
  const [hero, moyen, gros] = t.joueurs;
  assert.equal(hero.stack, 300, "pot principal : 3 × 100");
  assert.equal(moyen.stack, 800, "pot secondaire : 2 × 400, gagné par KK");
  assert.equal(gros.stack, 400, "surenchère rendue");
  assert.equal(gros.elimine, false);
  assert.equal(t.termine, false);
  assert.equal(total(t), 1500);
});

test("moteur : passage en heads-up, bouton = petite blind, BB parle en premier post-flop", () => {
  const t = creerTable({ id: "T6", joueurs: JOUEURS, alea: graine(6) });
  t.joueurs[2].elimine = true;
  t.joueurs[2].stack = 0;
  t.joueurs[2].place = 3;
  t.joueurs[0].stack = 700;
  t.joueurs[1].stack = 800;
  demarrerMain(t, 0);
  const m = t.main;
  assert.equal(m.headsUp, true);
  assert.equal(m.petiteBlind, m.bouton, "en HU le bouton poste la petite blind");
  assert.equal(m.aParler, m.petiteBlind, "et parle en premier pré-flop");
  assert.equal(positionDe(m, m.bouton), "SB");
  jouer(t, m.petiteBlind, { verbe: "call" }); // limp
  assert.equal(m.aParler, m.grosseBlind);
  const legal = actionsLegales(t);
  assert.equal(legal.peutCheck, true, "la BB a l'option");
  jouer(t, m.grosseBlind, { verbe: "check" });
  assert.equal(m.rue, "flop");
  assert.equal(m.aParler, m.grosseBlind, "post-flop la BB parle en premier en HU");
  assert.equal(profondeurEffectiveDe(m, "hero"), 35, "min(700, 800) / 20");
});

test("moteur : un tapis insuffisant pour une relance complète ne rouvre pas la parole", () => {
  const t = creerTable({ id: "T7", joueurs: JOUEURS, alea: graine(7) });
  demarrerMain(t, 0);
  const m = t.main;
  const [btn, sb, bb] = [m.bouton, m.petiteBlind, m.grosseBlind];
  t.joueurs.find((j) => j.id === sb).stack = 60; // la SB a 60 (+10 déjà postés)
  jouer(t, btn, { verbe: "raise", montant: 60 });
  jouer(t, sb, { verbe: "allin" }); // mise totale 70 : relance de 10 < 40
  assert.equal(m.miseCourante, 70);
  jouer(t, bb, { verbe: "call" });
  assert.equal(actionsLegales(t).joueur, btn, "le bouton doit compléter 10");
  assert.equal(actionsLegales(t).peutRelancer, true, "mais il peut encore relancer la BB qui a suivi");
  jouer(t, btn, { verbe: "call" });
  assert.equal(m.rue, "flop");
  assert.equal(total(t), 1070, "1500 moins les 430 retirés à la SB pour le test");
});

test("moteur : niveaux de blinds dans le temps", () => {
  const t = creerTable({ id: "T8", joueurs: JOUEURS, alea: graine(8), maintenant: 1000, dureeNiveauMs: 60_000 });
  assert.deepEqual([niveauCourant(t, 1000).index, niveauCourant(t, 60_999).index, niveauCourant(t, 61_000).index, niveauCourant(t, 10 * 60_000 * 60).index], [0, 0, 1, t.structure.length - 1]);
  assert.equal(niveauCourant(t, 1000).restantMs, 60_000);
  demarrerMain(t, 61_000);
  assert.equal(t.main.bb, 30);
  assert.equal(t.main.pot, 45);
});

test("moteur : une partie entière jouée au hasard reste cohérente", () => {
  const alea = graine(42);
  const t = creerTable({ id: "T9", joueurs: JOUEURS, alea, maintenant: 0, dureeNiveauMs: 60_000 });
  let mains = 0;
  let horloge = 0;
  while (!t.termine && mains < 500) {
    horloge += 20_000;
    assert.ok(demarrerMain(t, horloge));
    mains += 1;
    let coups = 0;
    while (t.main.rue !== "fin" && coups < 60) {
      const legal = actionsLegales(t);
      const r = alea();
      let action;
      if (r < 0.3) action = { verbe: legal.peutCheck ? "check" : "fold" };
      else if (r < 0.7) action = { verbe: legal.peutCheck ? "check" : "call" };
      else if (legal.peutRelancer) action = { verbe: "raise", montant: legal.relanceMin + Math.floor(alea() * (legal.relanceMax - legal.relanceMin + 1)) };
      else action = { verbe: legal.peutCheck ? "check" : "call" };
      jouer(t, legal.joueur, action);
      coups += 1;
    }
    assert.equal(t.main.rue, "fin", "chaque main se termine");
    assert.equal(total(t), 1500, "les jetons sont conservés");
  }
  assert.equal(t.termine, true, "la partie se termine");
  assert.deepEqual([...t.joueurs].sort((a, b) => a.place - b.place).map((j) => j.place), [1, 2, 3]);
});
