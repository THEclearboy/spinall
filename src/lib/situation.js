// Visualisateur de situations : modèle d'une main mise en scène librement.

export const POSITIONS_HU = ["hero", "haut"];
export const POSITIONS_3W = ["hero", "gauche", "droite"]; // ordre horaire depuis le héros

export function situationParDefaut() {
  return {
    version: 1,
    format: "3W",
    dealer: 0, // index du siège au bouton (0 = héros)
    sieges: [
      { nom: "Toi", stack: 25, mise: 0, cartes: [null, null], couche: false },
      { nom: "Vilain 1", stack: 25, mise: 0.5, cartes: [null, null], couche: false },
      { nom: "Vilain 2", stack: 25, mise: 1, cartes: [null, null], couche: false },
    ],
    board: [null, null, null, null, null],
    potBase: 0,
    note: "",
  };
}

/** Sièges réellement en jeu selon le format (2 ou 3). */
export function siegesActifs(situation) {
  return situation.format === "HU" ? situation.sieges.slice(0, 2) : situation.sieges.slice(0, 3);
}

/** Positions (BTN / SB / BB) de chaque siège actif, à partir du bouton. */
export function etiquettesPositions(situation) {
  const n = situation.format === "HU" ? 2 : 3;
  const dealer = situation.dealer % n;
  const etiquettes = new Array(n).fill("");
  if (n === 2) {
    etiquettes[dealer] = "BTN / SB";
    etiquettes[(dealer + 1) % 2] = "BB";
  } else {
    etiquettes[dealer] = "BTN";
    etiquettes[(dealer + 1) % 3] = "SB";
    etiquettes[(dealer + 2) % 3] = "BB";
  }
  return etiquettes;
}

export function cartesUtilisees(situation) {
  const set = new Set();
  for (const s of siegesActifs(situation)) for (const c of s.cartes) if (c) set.add(c);
  for (const c of situation.board) if (c) set.add(c);
  return set;
}

export function potTotal(situation) {
  return situation.potBase + siegesActifs(situation).reduce((s, siege) => s + (siege.mise || 0), 0);
}

export function rueCourante(situation) {
  const n = situation.board.filter(Boolean).length;
  if (n >= 5) return "River";
  if (n === 4) return "Turn";
  if (n >= 3) return "Flop";
  return "Pré-flop";
}

/** Sérialisation compacte pour copier/coller la situation à un ami. */
export function encoderSituation(situation) {
  return JSON.stringify(situation);
}

export function decoderSituation(texte) {
  const objet = JSON.parse(texte);
  if (!objet || !Array.isArray(objet.sieges) || !Array.isArray(objet.board)) throw new Error("Situation invalide");
  const defaut = situationParDefaut();
  return {
    ...defaut,
    ...objet,
    sieges: defaut.sieges.map((s, i) => ({ ...s, ...(objet.sieges[i] || {}) })),
    board: [0, 1, 2, 3, 4].map((i) => objet.board[i] || null),
  };
}
