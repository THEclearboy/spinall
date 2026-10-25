// Petits utilitaires d'affichage du simulateur (textes français, montants de relance proposés).
import { formatNombre } from "../format.js";

const CATEGORIES = ["hauteur", "paire", "double paire", "brelan", "quinte", "couleur", "full", "carré", "quinte flush"];
const P15_5 = 15 ** 5;

/** "paire", "double paire"… depuis un score de l'évaluateur. */
export function nomCategorie(score) {
  return CATEGORIES[Math.floor(score / P15_5)] || "hauteur";
}

/** Libellé court d'une action enregistrée par le moteur. */
export function texteAction(action) {
  if (!action) return "";
  if (action.verbe === "post_sb") return "SB";
  if (action.verbe === "post_bb") return "BB";
  if (action.verbe === "fold") return "Se couche";
  if (action.verbe === "check") return "Parole";
  if (action.allin) return "Tapis";
  if (action.verbe === "call") return "Suit";
  if (action.verbe === "raise") return "Relance";
  return action.verbe;
}

/** Dernière action d'un joueur sur la rue en cours (ou null). */
export function derniereAction(main, id) {
  for (let i = main.actions.length - 1; i >= 0; i--) {
    const a = main.actions[i];
    if (a.joueur === id && a.rue === main.rue) return a;
    if (a.rue !== main.rue) break;
  }
  return null;
}

/** Montant de relance proposé par défaut : 2,5 bb pot non ouvert, 3× en face d'une relance, ½ pot post-flop. */
export function relanceParDefaut(main, legal) {
  if (!legal.peutRelancer) return legal.relanceMax;
  let cible;
  if (main.rue === "preflop") cible = legal.miseCourante <= main.bb ? Math.round(main.bb * 2.5) : legal.miseCourante * 3;
  else cible = Math.round(legal.miseCourante + legal.pot * 0.5);
  return Math.max(legal.relanceMin, Math.min(legal.relanceMax, cible));
}

/** Boutons rapides de relance (montant total sur la rue). */
export function presetsRelance(main, legal) {
  if (!legal.peutRelancer) return [];
  const borne = (v) => Math.max(legal.relanceMin, Math.min(legal.relanceMax, Math.round(v)));
  const liste = [];
  const ajouter = (nom, montant) => {
    const m = borne(montant);
    if (!liste.some((p) => p.montant === m)) liste.push({ nom, montant: m });
  };
  ajouter("Min", legal.relanceMin);
  if (main.rue === "preflop") {
    if (legal.miseCourante <= main.bb) {
      ajouter("2,5 bb", main.bb * 2.5);
      ajouter("3 bb", main.bb * 3);
    } else ajouter("3×", legal.miseCourante * 3);
  } else {
    ajouter("½ pot", legal.miseCourante + legal.pot * 0.5);
    ajouter("¾ pot", legal.miseCourante + legal.pot * 0.75);
    ajouter("Pot", legal.miseCourante + legal.pot);
  }
  ajouter("Tapis", legal.relanceMax);
  return liste;
}

/** Texte de fin de main : « BiGTony remporte 300 avec une paire ». */
export function texteResultat(table, main, nomDe) {
  const r = main.resultat;
  if (!r) return "";
  const parts = [];
  for (const pot of r.pots) {
    if (pot.rendu) continue;
    const noms = pot.gagnants.map(nomDe);
    let texte = `${noms.join(" et ")} remporte${noms.length > 1 ? "nt" : ""} ${formatNombre(pot.montant)}`;
    if (r.abattage && pot.gagnants.length) texte += ` avec ${nomCategorie(r.forces[pot.gagnants[0]])}`;
    parts.push(texte);
  }
  return parts.join(" · ");
}

export const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
