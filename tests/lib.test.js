import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import donnees from "../src/data/ranges.json" with { type: "json" };
import { nomMain, combinaisonsDeMain, tirerDeuxCartes } from "../src/lib/cartes.js";
import { construireCharts, trouverChart, toutesLesMains, exporterRangesCorrigees, labelAction, estCorrecte } from "../src/lib/charts.js";
import { tirerQuestion, majPoids, tirerProfondeur } from "../src/lib/entrainement.js";
import { parseFichier, resultatJoueur, empreinteFichier } from "../src/lib/historique-mains.js";
import { evaluer, codeCarte, equite } from "../src/lib/equite.js";
import { calculerStats, spotPreflop, profondeurEffective, jetonsAttendus } from "../src/lib/analyse.js";
import { pluriel } from "../src/lib/format.js";

const ici = path.dirname(fileURLToPath(import.meta.url));
const historique = fs.readFileSync(path.join(ici, "fixtures", "historique-test.txt"), "utf8");

test("nomMain : rang fort en premier, s/o selon les couleurs", () => {
  assert.equal(nomMain({ rang: "K", couleur: "h" }, { rang: "A", couleur: "h" }), "AKs");
  assert.equal(nomMain({ rang: "9", couleur: "c" }, { rang: "T", couleur: "d" }), "T9o");
  assert.equal(nomMain({ rang: "7", couleur: "c" }, { rang: "7", couleur: "d" }), "77");
  assert.equal(combinaisonsDeMain("AA").length, 6);
  assert.equal(combinaisonsDeMain("AKs").length, 4);
  assert.equal(combinaisonsDeMain("AKo").length, 12);
  const [a, b] = tirerDeuxCartes(() => 0);
  assert.notDeepEqual(a, b);
});

test("charts : 169 mains, exceptions et corrections appliquées", () => {
  const charts = construireCharts(donnees);
  assert.equal(charts.length, donnees.charts.length);
  assert.equal(toutesLesMains().length, 169);
  const huSb = trouverChart(charts, "HU_SB", 5.5);
  assert.equal(huSb.id, "HU_SB_5-12", "intervalle semi-ouvert : 5,5bb → tableau 5,5-12");
  assert.equal(huSb.mains["AKs"], "allin");
  assert.equal(huSb.mains["72o"], "fold");
  assert.equal(huSb.mains["Q7o"], "call");
  assert.equal(trouverChart(charts, "3W_BTN", 40).id, "3W_BTN_15plus");
  const corriges = construireCharts(donnees, { "HU_SB_5-12": { "72o": "allin" } });
  assert.equal(corriges.find((c) => c.id === "HU_SB_5-12").mains["72o"], "allin");
  const exporte = exporterRangesCorrigees(donnees, { "HU_SB_5-12": { "72o": "allin" } });
  assert.ok(exporte.charts.find((c) => c.id === "HU_SB_5-12").exceptions.allin.includes("72o"));
});

test("entraînement : poids de révision et tirage", () => {
  let poids = majPoids({}, "HU_SB_5-12", "72o", false);
  assert.equal(poids["HU_SB_5-12|72o"], 3);
  poids = majPoids(poids, "HU_SB_5-12", "72o", false);
  poids = majPoids(poids, "HU_SB_5-12", "72o", false);
  poids = majPoids(poids, "HU_SB_5-12", "72o", false);
  poids = majPoids(poids, "HU_SB_5-12", "72o", false);
  assert.equal(poids["HU_SB_5-12|72o"], 12, "plafonné");
  for (let i = 0; i < 5; i++) poids = majPoids(poids, "HU_SB_5-12", "72o", true);
  assert.equal(poids["HU_SB_5-12|72o"], undefined, "sort de la révision sous 0,75");

  const charts = construireCharts(donnees);
  const q = tirerQuestion(charts, {}, {}, () => 0.5);
  assert.ok(q.chart && q.main && q.cartes.length === 2);
  assert.equal(tirerQuestion(charts, {}, { erreursUniquement: true }), null);
  const revision = tirerQuestion(charts, { "HU_SB_5-12|72o": 3 }, { erreursUniquement: true }, () => 0.1);
  assert.equal(revision.main, "72o");
  assert.equal(revision.issueDeRevision, true);
  const p = tirerProfondeur(charts.find((c) => c.id === "HU_SB_12plus"), () => 0.999);
  assert.ok(p >= 12 && p < 25);
});

test("parseur Betclic : mains, blinds, joueurs, actions, résultat", () => {
  const { mains, erreurs } = parseFichier(historique);
  assert.equal(mains.length + erreurs.length, 24);
  assert.ok(mains.length >= 20);
  const premiere = mains[0];
  assert.equal(premiere.id, "1000");
  assert.equal(premiere.partieId, "500");
  assert.deepEqual(premiere.blinds, [10, 20]);
  assert.equal(premiere.hero, "Hero");
  assert.equal(premiere.joueurs.length, 3);
  assert.equal(premiere.buyIn, 0.2);
  assert.equal(premiere.multiplicateur, 2);
  assert.ok(premiere.actions.some((a) => a.verbe === "raise" && a.allin));
  assert.equal(premiere.board.length, 5);
  assert.equal(resultatJoueur(premiere, "Hero"), 520);
  assert.equal(empreinteFichier(historique), empreinteFichier(historique));
  assert.notEqual(empreinteFichier(historique), empreinteFichier(historique + " "));
});

test("évaluateur : ordre des combinaisons", () => {
  const m = (t) => t.split(" ").map(codeCarte);
  const quinteFlush = evaluer(m("Ah Kh Qh Jh Th 2c 3d"));
  const carre = evaluer(m("As Ad Ah Ac 2c 3d 4h"));
  const full = evaluer(m("As Ad Ah 2c 2d 3d 4h"));
  const couleur = evaluer(m("Ah 9h 7h 4h 2h Kc 3d"));
  const quinte = evaluer(m("As 2d 3h 4c 5s Kc 9d"));
  const brelan = evaluer(m("As Ad Ah 2c 7d 3d 4h"));
  const deuxPaires = evaluer(m("As Ad 2h 2c 7d 3d 4h"));
  const paire = evaluer(m("As Ad 2h 5c 9d Jd 4h"));
  const hauteur = evaluer(m("As Kd 2h 5c 7d 3d 9h"));
  const ordre = [quinteFlush, carre, full, couleur, quinte, brelan, deuxPaires, paire, hauteur];
  for (let i = 1; i < ordre.length; i++) assert.ok(ordre[i - 1] > ordre[i], `rang ${i}`);
  // AA contre KK pré-flop ≈ 82 %
  const e = equite({ Hero: ["As", "Ad"], Vilain: ["Ks", "Kd"] }, "Hero", [], 5, [], "test");
  assert.ok(e > 0.78 && e < 0.86, `équité AA vs KK = ${e}`);
  // river : tout est connu
  assert.equal(equite({ Hero: ["As", "Ad"], Vilain: ["Ks", "Kd"] }, "Hero", ["2c", "3d", "7h", "9s", "Jc"], 0), 1);
});

test("analyse : spots pré-flop, profondeur effective, statistiques", () => {
  const charts = construireCharts(donnees);
  const { mains } = parseFichier(historique);
  const premiere = mains[0];
  assert.equal(profondeurEffective(premiere), 25);
  const spot = spotPreflop(premiere, charts);
  assert.ok(spot, "BTN premier de parole en 3-way est couvert");
  assert.equal(spot.familleId, "3W_BTN");
  assert.equal(spot.chartId, "3W_BTN_15plus");
  assert.equal(spot.main, "62o");
  assert.equal(spot.jouee, "allin");
  assert.equal(spot.attendu, "fold");
  assert.equal(spot.conforme, false);

  const stats = calculerStats(mains, charts);
  assert.equal(stats.parties.length, 6);
  assert.equal(stats.nbMains, mains.length);
  assert.ok(stats.spots.length > 0);
  assert.ok(stats.tauxConformite !== null);
  assert.equal(stats.courbe.length, 6);
  assert.ok(stats.partiesParJour.length >= 6);
  const attendu = jetonsAttendus(premiere);
  assert.ok(Number.isFinite(attendu) && attendu !== 520, "tapis pré-flop : EV ≠ réel");
});

test("pluriel", () => {
  assert.equal(pluriel("main ajoutée", 1), "1 main ajoutée");
  assert.equal(pluriel("main ajoutée", 3), "3 mains ajoutées");
  assert.equal(pluriel("déjà connue", 2), "2 déjà connues");
});

test("heures jouées : sessions et corrections manuelles", async () => {
  const { heuresParJour, sessions, cleJour, formatHeures } = await import("../src/lib/heures.js");
  const { parseFichier } = await import("../src/lib/historique-mains.js");
  const { mains } = parseFichier(historique);
  const s = sessions(mains);
  assert.ok(s.length >= 6, "au moins une session par partie");
  const heures = heuresParJour(mains);
  assert.ok(heures.size >= 6);
  const cle = cleJour(mains[0].date);
  assert.ok(heures.get(cle).heures > 0);
  const corrige = heuresParJour(mains, { [cle]: 2.5 });
  assert.equal(corrige.get(cle).heures, 2.5);
  // Une session qui passe minuit est répartie entre les deux jours.
  const soir = new Date(2026, 8, 28, 23, 30, 0, 0).getTime();
  const nuit = [0, 10, 20, 30, 40, 50, 59].map((min, i) => ({ id: `n${i}`, date: soir + min * 60_000 }));
  const coupe = heuresParJour(nuit);
  assert.equal(coupe.get("2026-09-28").heures, 0.5);
  assert.equal(coupe.get("2026-09-29").heures, 0.5);
  assert.equal(corrige.get(cle).manuel, 2.5);
  assert.equal(formatHeures(1.5), "1 h 30");
  assert.equal(formatHeures(0.25), "15 min");
});

test("bilan par limite : une ligne par buy-in plus le total", async () => {
  const { bilanParLimite, limitesPresentes } = await import("../src/lib/limites.js");
  const { parseFichier } = await import("../src/lib/historique-mains.js");
  const { mains } = parseFichier(historique);
  assert.deepEqual(limitesPresentes(mains), [0.2, 1]);
  const bilan = bilanParLimite(mains, null);
  assert.equal(bilan.length, 3);
  assert.equal(bilan[2].limite, null);
  assert.equal(bilan[0].parties + bilan[1].parties, bilan[2].parties);
  assert.ok(Math.abs(bilan[0].netEuro + bilan[1].netEuro - bilan[2].netEuro) < 1e-9);
  assert.equal(bilan[0].cEV, null, "cEV inconnu tant que l'EV n'est pas calculée");
  const evParMain = new Map(mains.map((m) => [m.id, { reel: 10, ev: 5 }]));
  const avecEv = bilanParLimite(mains, evParMain);
  assert.ok(avecEv[2].cEV !== null);
});

test("situation : positions et cartes utilisées", async () => {
  const { situationParDefaut, etiquettesPositions, cartesUtilisees, potTotal, rueCourante, encoderSituation, decoderSituation } =
    await import("../src/lib/situation.js");
  const s = situationParDefaut();
  assert.deepEqual(etiquettesPositions(s), ["BTN", "SB", "BB"]);
  s.dealer = 1;
  assert.deepEqual(etiquettesPositions(s), ["BB", "BTN", "SB"]);
  s.format = "HU";
  assert.deepEqual(etiquettesPositions(s), ["BB", "BTN / SB"]);
  s.sieges[0].cartes = ["Ah", "Kd"];
  s.board = ["2c", "7d", "9s", null, null];
  assert.deepEqual([...cartesUtilisees(s)].sort(), ["2c", "7d", "9s", "Ah", "Kd"]);
  assert.equal(rueCourante(s), "Flop");
  assert.equal(potTotal(s), 0.5);
  const copie = decoderSituation(encoderSituation(s));
  assert.deepEqual(copie.sieges[0].cartes, ["Ah", "Kd"]);
  assert.throws(() => decoderSituation("{}"));
});

test("cases mixtes : deux actions acceptées, nouveaux tableaux HU", () => {
  const charts = construireCharts(donnees);
  const sb = trouverChart(charts, "HU_SB", 5.2);
  assert.equal(sb.id, "HU_SB_0-5", "0-5,5 bb couvre 5,2 bb");
  assert.equal(sb.mains["AA"], "call");
  assert.equal(sb.mains["QQ"], "allin/call");
  assert.equal(sb.mains["T5o"], "allin/fold");
  assert.equal(sb.mains["94o"], "fold");
  assert.equal(sb.mains["T6o"], "allin");
  assert.equal(trouverChart(charts, "HU_SB", 5.5).id, "HU_SB_5-12");
  const bb = trouverChart(charts, "HU_BB", 3);
  assert.equal(bb.mains["A2o"], "allin");
  assert.equal(bb.mains["22"], "allin");
  assert.equal(bb.mains["J2s"], "allin/call");
  assert.equal(bb.mains["72o"], "allin/call");
  assert.equal(labelAction("HU_BB", "allin/call"), "All-in ou Check");
  assert.equal(estCorrecte("allin/call", "call"), true);
  assert.equal(estCorrecte("allin/call", "raise"), false);
  assert.equal(estCorrecte("fold", "fold"), true);
});
