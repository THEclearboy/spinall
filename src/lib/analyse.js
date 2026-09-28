// Analyse des mains importées : positions, spots pré-flop couverts par les
// tableaux, regroupement en parties, statistiques et EV à tapis.
import { nomMain, carteDepuisTexte } from "./cartes.js";
import { trouverChart, actionAttendue, estCorrecte, actionsDe } from "./charts.js";
import { misesDetaillees, resultatJoueur } from "./historique-mains.js";
import { equite } from "./equite.js";

/** "HU-SB", "HU-BB", "3W-BTN", "3W-SB", "3W-BB" ou null. */
export function positionHero(main) {
  const hero = main.joueurs.find((j) => j.nom === main.hero);
  if (!hero) return null;
  const format = main.joueurs.length === 2 ? "HU" : "3W";
  if (hero.tags.includes("SB")) return `${format}-SB`;
  if (hero.tags.includes("BB")) return `${format}-BB`;
  if (hero.tags.includes("BTN")) return `${format}-BTN`;
  return null;
}

/**
 * Stack effectif du héros en bb (stacks avant blinds) :
 * HU = min des deux stacks ; 3-way = min(héros, plus gros adversaire).
 */
export function profondeurEffective(main) {
  const hero = main.joueurs.find((j) => j.nom === main.hero);
  if (!hero || !main.blinds) return null;
  const adverses = main.joueurs.filter((j) => j.nom !== main.hero).map((j) => j.stack);
  if (adverses.length === 0) return null;
  const reference = adverses.length === 1 ? adverses[0] : Math.max(...adverses);
  return Math.min(hero.stack, reference) / main.blinds[1];
}

/** Actions pré-flop hors blinds postées. */
export function actionsPreflop(main) {
  return main.actions.filter(
    (a) => a.rue === "preflop" && a.verbe !== "post_sb" && a.verbe !== "post_bb",
  );
}

/**
 * Si la première décision du héros tombe dans une situation couverte par un
 * tableau, renvoie le spot (attendu / joué / conforme), sinon null.
 */
export function spotPreflop(main, charts) {
  if (!main.hero || !main.cartes[main.hero] || main.cartes[main.hero].length !== 2) return null;
  // Blind postée à tapis : pas de décision réelle.
  if (main.actions.some((a) => (a.verbe === "post_sb" || a.verbe === "post_bb") && a.allin))
    return null;

  const position = positionHero(main);
  const actions = actionsPreflop(main);
  const indexHero = actions.findIndex((a) => a.joueur === main.hero);
  if (indexHero === -1) return null;
  const avant = actions.slice(0, indexHero);
  const actionHero = actions[indexHero];

  let familleId = null;
  if (main.joueurs.length === 2 && position === "HU-SB" && avant.length === 0) familleId = "HU_SB";
  else if (main.joueurs.length === 2 && position === "HU-BB" && avant.length === 1 && avant[0].verbe === "call")
    familleId = "HU_BB";
  else if (main.joueurs.length === 3 && position === "3W-BTN" && avant.length === 0) familleId = "3W_BTN";
  if (!familleId) return null;

  const profondeur = profondeurEffective(main);
  if (profondeur === null) return null;
  const chart = trouverChart(charts, familleId, profondeur);
  if (!chart) return null;

  const [c1, c2] = main.cartes[main.hero];
  const nom = nomMain(carteDepuisTexte(c1), carteDepuisTexte(c2));
  const attendu = actionAttendue(chart, nom);

  let jouee;
  if (actionHero.verbe === "fold") jouee = "fold";
  else if (actionHero.verbe === "check" || actionHero.verbe === "call") jouee = "call";
  else if (actionHero.verbe === "raise") jouee = actionHero.allin ? "allin" : "raise";
  else return null;

  // Un call à tapis vaut un all-in.
  const conforme =
    estCorrecte(attendu, jouee) || (jouee === "call" && actionHero.allin && actionsDe(attendu).includes("allin"));
  return {
    handId: main.id,
    date: main.date,
    familleId,
    chartId: chart.id,
    chartTitre: chart.titre_origine,
    main: nom,
    cartes: main.cartes[main.hero],
    profondeur,
    attendu,
    jouee,
    conforme,
  };
}

/** Regroupe les mains par partie (Game ID), triées par date. */
export function regrouperParties(mains) {
  const parties = new Map();
  for (const main of mains) {
    if (!main.partieId) continue;
    if (!parties.has(main.partieId))
      parties.set(main.partieId, {
        id: main.partieId,
        nomJeu: main.nomJeu,
        date: main.date,
        buyIn: main.buyIn,
        multiplicateur: main.multiplicateur,
        prizePool: main.prizePool,
        nbMains: 0,
        place: null,
        gainEuro: 0,
        resultatConnu: false,
      });
    const partie = parties.get(main.partieId);
    partie.nbMains += 1;
    if (main.date && (!partie.date || main.date < partie.date)) partie.date = main.date;
    if (main.hero && main.places[main.hero] !== undefined) {
      partie.place = main.places[main.hero];
      partie.resultatConnu = true;
      partie.gainEuro = main.prixEuro[main.hero] || 0;
    }
  }
  const liste = [...parties.values()];
  for (const partie of liste) partie.netEuro = partie.gainEuro - (partie.buyIn || 0);
  liste.sort((a, b) => (a.date || 0) - (b.date || 0));
  return liste;
}

export function statsPreflopHero(main) {
  const actions = actionsPreflop(main).filter((a) => a.joueur === main.hero);
  return {
    vpip: actions.some((a) => a.verbe === "call" || a.verbe === "raise" || a.verbe === "bet"),
    pfr: actions.some((a) => a.verbe === "raise"),
    allinPre: actions.some((a) => a.allin),
  };
}

export function showdownHero(main) {
  const ilYAShowdown = Object.keys(main.combinaisons).length > 0;
  const heroMontre = main.combinaisons[main.hero] !== undefined;
  return { auShowdown: ilYAShowdown && heroMontre, gagne: heroMontre && (main.gains[main.hero] || 0) > 0 };
}

/** Toutes les statistiques de l'onglet Analyse. */
export function calculerStats(mains, charts) {
  const triees = [...mains].sort((a, b) => (a.date || 0) - (b.date || 0));
  const parties = regrouperParties(triees);
  const partiesJouees = parties.filter((p) => p.resultatConnu);
  const netEuro = parties.reduce((s, p) => s + p.netEuro, 0);
  const investi = parties.reduce((s, p) => s + (p.buyIn || 0), 0);
  const places = { 1: 0, 2: 0, 3: 0 };
  for (const partie of partiesJouees) if (places[partie.place] !== undefined) places[partie.place] += 1;

  let nbVpip = 0;
  let nbPfr = 0;
  let mainsAvecHero = 0;
  for (const main of triees) {
    if (!main.hero) continue;
    mainsAvecHero += 1;
    const s = statsPreflopHero(main);
    if (s.vpip) nbVpip += 1;
    if (s.pfr) nbPfr += 1;
  }

  let showdownsVus = 0;
  let showdownsGagnes = 0;
  for (const main of triees) {
    const s = showdownHero(main);
    if (s.auShowdown) {
      showdownsVus += 1;
      if (s.gagne) showdownsGagnes += 1;
    }
  }

  const spots = [];
  for (const main of triees) {
    const spot = spotPreflop(main, charts);
    if (spot) spots.push(spot);
  }
  const ecarts = spots.filter((s) => !s.conforme);
  const parChart = new Map();
  for (const spot of spots) {
    if (!parChart.has(spot.chartId))
      parChart.set(spot.chartId, { chartId: spot.chartId, chartTitre: spot.chartTitre, total: 0, conformes: 0 });
    const ligne = parChart.get(spot.chartId);
    ligne.total += 1;
    if (spot.conforme) ligne.conformes += 1;
  }

  let cumul = 0;
  const courbe = parties.map((partie) => {
    cumul += partie.netEuro;
    return { date: partie.date, cumul, partie };
  });

  const parJour = new Map();
  for (const partie of parties) {
    if (!partie.date) continue;
    const d = new Date(partie.date);
    const jour = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    parJour.set(jour, (parJour.get(jour) || 0) + 1);
  }
  const partiesParJour = [];
  if (parJour.size > 0) {
    const jours = [...parJour.keys()].sort((a, b) => a - b);
    const curseur = new Date(jours[0]);
    while (curseur.getTime() <= jours[jours.length - 1]) {
      partiesParJour.push({ jour: curseur.getTime(), nb: parJour.get(curseur.getTime()) || 0 });
      curseur.setDate(curseur.getDate() + 1);
    }
  }

  // Moyenne glissante du respect des ranges sur les 50 derniers spots.
  const fenetre = [];
  let sommeFenetre = 0;
  const courbeConformite = spots.map((spot) => {
    fenetre.push(spot.conforme ? 1 : 0);
    sommeFenetre += spot.conforme ? 1 : 0;
    if (fenetre.length > 50) sommeFenetre -= fenetre.shift();
    return { date: spot.date, taux: sommeFenetre / fenetre.length, nbSpots: fenetre.length };
  });

  return {
    nbMains: triees.length,
    mainsAvecHero,
    parties,
    partiesJouees,
    netEuro,
    investi,
    places,
    vpip: mainsAvecHero ? nbVpip / mainsAvecHero : null,
    pfr: mainsAvecHero ? nbPfr / mainsAvecHero : null,
    showdownsVus,
    showdownsGagnes,
    spots,
    ecarts,
    conformiteParChart: [...parChart.values()],
    tauxConformite: spots.length ? spots.filter((s) => s.conforme).length / spots.length : null,
    courbe,
    partiesParJour,
    courbeConformite,
  };
}

/**
 * Si un tapis a été payé avant la river avec les cartes connues, décrit la
 * situation : { aVenir, participants, rueDuTapis } ; sinon null.
 */
export function tapisAvantRiver(main) {
  const mises = main.actions.filter((a) =>
    ["post_sb", "post_bb", "call", "bet", "raise"].includes(a.verbe),
  );
  if (!mises.some((a) => a.allin)) return null;
  const derniere = mises[mises.length - 1];
  const aVenir = { preflop: 5, flop: 2, turn: 1, river: 0 }[derniere.rue];
  const couches = new Set(main.actions.filter((a) => a.verbe === "fold").map((a) => a.joueur));
  const participants = main.joueurs
    .map((j) => j.nom)
    .filter((nom) => !couches.has(nom) && main.cartes[nom]?.length === 2);
  if (participants.length < 2 || !participants.includes(main.hero) || main.board.length !== 5)
    return null;
  return { aVenir, participants, rueDuTapis: derniere.rue };
}

/**
 * Jetons "attendus" du héros sur la main : résultat réel, sauf si un tapis a
 * été payé avant la river, auquel cas pot × équité au moment de l'all-in.
 */
export function jetonsAttendus(main) {
  const reel = resultatJoueur(main, main.hero);
  const tapis = tapisAvantRiver(main);
  if (!tapis || tapis.aVenir === 0) return reel;
  const { plafonnes } = misesDetaillees(main);
  const miseHero = plafonnes[main.hero] || 0;
  const pot = Object.values(plafonnes).reduce((s, m) => s + Math.min(m, miseHero), 0);
  const mainsConnues = {};
  for (const nom of tapis.participants) mainsConnues[nom] = main.cartes[nom];
  const cartesMortes = Object.entries(main.cartes)
    .filter(([nom]) => !tapis.participants.includes(nom))
    .flatMap(([, cartes]) => cartes);
  const boardAuTapis = main.board.slice(0, 5 - tapis.aVenir);
  return equite(mainsConnues, main.hero, boardAuTapis, tapis.aVenir, cartesMortes, main.id) * pot - miseHero;
}
