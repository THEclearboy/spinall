// Évaluation des mains de poker et calcul d'équité à tapis
// (énumération exacte jusqu'à 2 cartes à venir, Monte-Carlo au-delà).

const VALEUR_RANG = { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, T: 10, J: 11, Q: 12, K: 13, A: 14 };
const VALEUR_COULEUR = { s: 0, h: 1, d: 2, c: 3 };
const ITERATIONS_MONTE_CARLO = 10_000;

/** "Ah" → entier (rang × 4 + couleur). */
export function codeCarte(texte) {
  return VALEUR_RANG[texte[0]] * 4 + VALEUR_COULEUR[texte[1]];
}

function score(categorie, a = 0, b = 0, c = 0, d = 0, e = 0) {
  return ((((categorie * 15 + a) * 15 + b) * 15 + c) * 15 + d) * 15 + e;
}

/** Rang haut de la meilleure quinte dans un masque de rangs, 0 sinon. */
function hautQuinte(masque) {
  if (masque & (1 << 14)) masque |= 2; // l'As compte aussi comme 1
  for (let haut = 14; haut >= 5; haut--) {
    const fenetre = 31 << (haut - 4);
    if ((masque & fenetre) === fenetre) return haut;
  }
  return 0;
}

/** Force d'une main de 5 à 7 cartes (codes). Plus grand = plus fort. */
export function evaluer(cartes) {
  const compte = new Array(15).fill(0);
  const masqueParCouleur = [0, 0, 0, 0];
  const nbParCouleur = [0, 0, 0, 0];
  let masque = 0;
  for (const carte of cartes) {
    const rang = carte >> 2;
    const couleur = carte & 3;
    compte[rang] += 1;
    masqueParCouleur[couleur] |= 1 << rang;
    nbParCouleur[couleur] += 1;
    masque |= 1 << rang;
  }
  let couleurFlush = -1;
  for (let c = 0; c < 4; c++) if (nbParCouleur[c] >= 5) couleurFlush = c;
  if (couleurFlush >= 0) {
    const haut = hautQuinte(masqueParCouleur[couleurFlush]);
    if (haut > 0) return score(8, haut); // quinte flush
  }
  const carres = [];
  const brelans = [];
  const paires = [];
  const seules = [];
  for (let r = 14; r >= 2; r--) {
    if (compte[r] === 4) carres.push(r);
    else if (compte[r] === 3) brelans.push(r);
    else if (compte[r] === 2) paires.push(r);
    else if (compte[r] === 1) seules.push(r);
  }
  if (carres.length > 0) return score(7, carres[0], Math.max(...brelans, ...paires, ...seules, 0));
  if (brelans.length >= 2) return score(6, brelans[0], brelans[1]);
  if (brelans.length === 1 && paires.length > 0) return score(6, brelans[0], paires[0]);
  if (couleurFlush >= 0) {
    const hauts = [];
    for (let r = 14; r >= 2 && hauts.length < 5; r--)
      if (masqueParCouleur[couleurFlush] & (1 << r)) hauts.push(r);
    return score(5, ...hauts);
  }
  const quinte = hautQuinte(masque);
  if (quinte > 0) return score(4, quinte);
  if (brelans.length === 1) return score(3, brelans[0], seules[0], seules[1]);
  if (paires.length >= 2) return score(2, paires[0], paires[1], Math.max(paires[2] || 0, seules[0] || 0));
  if (paires.length === 1) return score(1, paires[0], seules[0], seules[1], seules[2]);
  return score(0, seules[0], seules[1], seules[2], seules[3], seules[4]);
}

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
function alea(graine) {
  let etat = graine >>> 0;
  return () => {
    etat = (etat + 1831565813) | 0;
    let t = Math.imul(etat ^ (etat >>> 15), 1 | etat);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hachage(texte) {
  let h = 2166136261;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Part du pot revenant au joueur `indexHero` sur un board complet (1, 0 ou 1/n en cas d'égalité). */
function partDuPot(mainsJoueurs, indexHero, board) {
  let meilleur = -1;
  let nbGagnants = 0;
  let heroGagne = false;
  for (let i = 0; i < mainsJoueurs.length; i++) {
    const force = evaluer([...mainsJoueurs[i], ...board]);
    if (force > meilleur) {
      meilleur = force;
      nbGagnants = 1;
      heroGagne = i === indexHero;
    } else if (force === meilleur) {
      nbGagnants += 1;
      if (i === indexHero) heroGagne = true;
    }
  }
  return heroGagne ? 1 / nbGagnants : 0;
}

/**
 * Équité du héros face aux autres mains connues.
 * mains : { joueur: ["Ah","Kd"] } ; board : cartes déjà retournées ;
 * aVenir : nombre de cartes restant à distribuer ;
 * cartesMortes : cartes vues ailleurs (joueurs couchés) ;
 * graine : chaîne pour rendre le Monte-Carlo reproductible.
 */
export function equite(mains, hero, board, aVenir, cartesMortes = [], graine = "") {
  const noms = Object.keys(mains);
  const indexHero = noms.indexOf(hero);
  const codesMains = noms.map((n) => mains[n].map(codeCarte));
  const codesBoard = board.map(codeCarte);
  const connues = new Set([...codesMains.flat(), ...codesBoard, ...cartesMortes.map(codeCarte)]);
  const restantes = [];
  for (let r = 2; r <= 14; r++)
    for (let c = 0; c < 4; c++) {
      const code = r * 4 + c;
      if (!connues.has(code)) restantes.push(code);
    }

  if (aVenir === 0) return partDuPot(codesMains, indexHero, codesBoard);
  if (aVenir === 1) {
    let somme = 0;
    for (const carte of restantes) somme += partDuPot(codesMains, indexHero, [...codesBoard, carte]);
    return somme / restantes.length;
  }
  if (aVenir === 2) {
    let somme = 0;
    let nb = 0;
    for (let i = 0; i < restantes.length; i++)
      for (let j = i + 1; j < restantes.length; j++) {
        somme += partDuPot(codesMains, indexHero, [...codesBoard, restantes[i], restantes[j]]);
        nb += 1;
      }
    return somme / nb;
  }
  // 5 cartes à venir (tapis pré-flop) : Monte-Carlo déterministe.
  const tirage = alea(hachage(graine || noms.join("|")));
  let somme = 0;
  const paquet = restantes.slice();
  for (let iteration = 0; iteration < ITERATIONS_MONTE_CARLO; iteration++) {
    for (let k = 0; k < 5; k++) {
      const m = k + Math.floor(tirage() * (paquet.length - k));
      const tmp = paquet[k];
      paquet[k] = paquet[m];
      paquet[m] = tmp;
    }
    somme += partDuPot(codesMains, indexHero, [...codesBoard, paquet[0], paquet[1], paquet[2], paquet[3], paquet[4]]);
  }
  return somme / ITERATIONS_MONTE_CARLO;
}
