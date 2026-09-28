// Cartes, rangs, couleurs et nommage des mains (AKs, T9o, 77…).

export const RANGS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
export const COULEURS = ["s", "h", "d", "c"];
export const SYMBOLES = { s: "♠", h: "♥", d: "♦", c: "♣" };

/** Vrai pour cœur et carreau (affichés en rouge). */
export function estRouge(couleur) {
  return couleur === "h" || couleur === "d";
}

/** Index du rang (0 = As, 12 = Deux). */
export function indexRang(rang) {
  return RANGS.indexOf(rang);
}

/** Les 52 cartes du paquet, sous la forme { rang, couleur }. */
export function paquetComplet() {
  const paquet = [];
  for (const rang of RANGS) for (const couleur of COULEURS) paquet.push({ rang, couleur });
  return paquet;
}

/** Tire deux cartes distinctes au hasard. */
export function tirerDeuxCartes(alea = Math.random) {
  const paquet = paquetComplet();
  const i = Math.floor(alea() * paquet.length);
  const premiere = paquet.splice(i, 1)[0];
  const j = Math.floor(alea() * paquet.length);
  const seconde = paquet.splice(j, 1)[0];
  return [premiere, seconde];
}

/** Nom canonique de la main : "AA", "AKs", "T9o"… (rang le plus fort en premier). */
export function nomMain(carte1, carte2) {
  const i1 = indexRang(carte1.rang);
  const i2 = indexRang(carte2.rang);
  const [haute, basse] = i1 <= i2 ? [carte1, carte2] : [carte2, carte1];
  if (haute.rang === basse.rang) return haute.rang + basse.rang;
  const suffixe = haute.couleur === basse.couleur ? "s" : "o";
  return haute.rang + basse.rang + suffixe;
}

/** Toutes les combinaisons concrètes de cartes correspondant à un nom de main. */
export function combinaisonsDeMain(main) {
  const combos = [];
  const r1 = main[0];
  const r2 = main[1];
  if (r1 === r2) {
    for (let a = 0; a < COULEURS.length; a++)
      for (let b = a + 1; b < COULEURS.length; b++)
        combos.push([
          { rang: r1, couleur: COULEURS[a] },
          { rang: r2, couleur: COULEURS[b] },
        ]);
  } else if (main[2] === "s") {
    for (const couleur of COULEURS)
      combos.push([
        { rang: r1, couleur },
        { rang: r2, couleur },
      ]);
  } else {
    for (const a of COULEURS)
      for (const b of COULEURS)
        if (a !== b)
          combos.push([
            { rang: r1, couleur: a },
            { rang: r2, couleur: b },
          ]);
  }
  return combos;
}

/** Tire au hasard une combinaison concrète d'un nom de main. */
export function tirerCombinaison(main, alea = Math.random) {
  const combos = combinaisonsDeMain(main);
  return combos[Math.floor(alea() * combos.length)];
}

/** "A♠", "T♥"… */
export function texteCarte(carte) {
  return carte.rang + SYMBOLES[carte.couleur];
}

/** Convertit "Ah" (format des historiques) en { rang, couleur }. */
export function carteDepuisTexte(texte) {
  return { rang: texte[0], couleur: texte[1] };
}
