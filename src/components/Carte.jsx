import { SYMBOLES, estRouge } from "../lib/cartes.js";

/** Carte affichée sur la table d'entraînement ({ rang, couleur }). */
export function CarteJeu({ carte, classe }) {
  return (
    <div className={`carte-jeu couleur-${carte.couleur} ${classe}`}>
      <span className="rang">{carte.rang === "T" ? "10" : carte.rang}</span>
      <span className="symbole">{SYMBOLES[carte.couleur]}</span>
    </div>
  );
}

/** Carte compacte dans le texte, depuis "Ah" (format des historiques). */
export function CarteInline({ texte }) {
  const couleur = texte[1];
  return (
    <span className={estRouge(couleur) ? "carte-inline rouge" : "carte-inline"}>
      {texte[0] === "T" ? "10" : texte[0]}
      {SYMBOLES[couleur]}
    </span>
  );
}
