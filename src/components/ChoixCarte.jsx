import { RANGS, COULEURS, SYMBOLES, estRouge } from "../lib/cartes.js";

/**
 * Sélecteur de carte : 4 lignes (une par couleur) × 13 rangs.
 * utilisees : Set des cartes déjà placées ("Ah"…), valeur : carte courante du slot,
 * onChoix(carte | null).
 */
export function ChoixCarte({ utilisees, valeur, onChoix }) {
  return (
    <div className="choix-carte">
      {COULEURS.map((couleur) => (
        <div key={couleur} className="choix-carte-ligne">
          {RANGS.map((rang) => {
            const carte = rang + couleur;
            const prise = utilisees.has(carte) && carte !== valeur;
            return (
              <button
                key={carte}
                type="button"
                className={`choix-carte-bouton${estRouge(couleur) ? " rouge" : ""}${carte === valeur ? " actuelle" : ""}`}
                disabled={prise}
                onClick={() => onChoix(carte)}
              >
                {rang === "T" ? "10" : rang}
                {SYMBOLES[couleur]}
              </button>
            );
          })}
        </div>
      ))}
      <div className="choix-carte-pied">
        <button type="button" className="bouton petit" onClick={() => onChoix(null)}>
          Retirer la carte
        </button>
      </div>
    </div>
  );
}

/** Un emplacement de carte cliquable (affiche la carte ou un "?"). */
export function SlotCarte({ carte, actif, onClick, libelle }) {
  return (
    <button
      type="button"
      className={`slot-carte${carte ? (estRouge(carte[1]) ? " rouge" : "") : " vide"}${actif ? " actif" : ""}`}
      onClick={onClick}
      title={libelle}
    >
      {carte ? (
        <>
          {carte[0] === "T" ? "10" : carte[0]}
          {SYMBOLES[carte[1]]}
        </>
      ) : (
        "?"
      )}
    </button>
  );
}
