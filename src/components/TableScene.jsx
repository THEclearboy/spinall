import { CarteJeu } from "./Carte.jsx";
import { formatBb, formatNombre } from "../lib/format.js";

function Pod({ nom, stack, position }) {
  return (
    <div className={`pod ${position}`}>
      <div className="dos-paire">
        <span />
        <span />
      </div>
      <div className="etiquette-pod">
        <div className="nom">{nom}</div>
        <div className="stack">{formatBb(stack)}</div>
      </div>
    </div>
  );
}

function Mise({ position, montant, badge }) {
  return (
    <div className={`mise ${position}`}>
      <span className="jeton" />
      {formatNombre(montant)}
      {badge && <span className="badge-mise">{badge}</span>}
    </div>
  );
}

/** La table de poker de l'entraînement : adversaires, blinds, bouton, cartes du héros. */
export function TableScene({ famille, cartes, profondeur, contexte, children }) {
  const huSb = famille === "HU_SB";
  const huBb = famille === "HU_BB";
  const btn3w = famille === "3W_BTN";
  const pot = huBb ? 2 : 1.5;
  return (
    <div className="scene">
      <div className="barre-scene">{contexte}</div>
      <div className="carte-info">
        Stack effectif<strong>{formatBb(profondeur)}</strong>
      </div>
      <div className="table-stade">
        <div className="rail" />
        <div className="feutre" />
        <div className="pot">
          Pot <strong>{formatNombre(pot)} bb</strong>
        </div>
        {huSb && <Pod nom="Vilain_BB" stack={profondeur} position="haut" />}
        {huBb && <Pod nom="Vilain_SB" stack={profondeur} position="haut" />}
        {btn3w && (
          <>
            <Pod nom="Vilain_SB" stack={profondeur} position="gauche" />
            <Pod nom="Vilain_BB" stack={profondeur} position="droite" />
          </>
        )}
        {huSb && (
          <>
            <Mise position="mise-haut" montant={1} />
            <Mise position="mise-hero" montant={0.5} />
          </>
        )}
        {huBb && (
          <>
            <Mise position="mise-haut" montant={1} badge="Limp" />
            <Mise position="mise-hero" montant={1} />
          </>
        )}
        {btn3w && (
          <>
            <Mise position="mise-gauche" montant={0.5} />
            <Mise position="mise-droite" montant={1} />
          </>
        )}
        <div className={`jeton-dealer ${huBb ? "pos-haut" : "pos-hero"}`}>D</div>
        <div className="pod hero">
          <div className="cartes-hero">
            <CarteJeu carte={cartes[0]} classe="inclinee-g" />
            <CarteJeu carte={cartes[1]} classe="inclinee-d" />
          </div>
          <div className="etiquette-pod claire">
            <div className="nom">Toi</div>
            <div className="stack">{formatBb(profondeur)}</div>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
