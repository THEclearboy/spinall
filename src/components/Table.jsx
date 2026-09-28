import { CarteJeu } from "./Carte.jsx";
import { carteDepuisTexte } from "../lib/cartes.js";
import { formatBb, formatNombre } from "../lib/format.js";

function versCarte(carte) {
  if (!carte) return null;
  return typeof carte === "string" ? carteDepuisTexte(carte) : carte;
}

function CarteVide({ classe = "" }) {
  return <div className={`carte-jeu vide ${classe}`} />;
}

/** Un adversaire : dos de cartes (ou cartes visibles), nom, stack. */
function Pod({ nom, stack, position, cartes, couche, etiquette }) {
  const visibles = cartes && cartes.some(Boolean);
  return (
    <div className={`pod ${position}${couche ? " couche" : ""}`}>
      {visibles ? (
        <div className="cartes-vilain">
          {cartes.map((c, i) =>
            c ? <CarteJeu key={i} carte={versCarte(c)} classe="petite" /> : <CarteVide key={i} classe="petite" />,
          )}
        </div>
      ) : (
        <div className="dos-paire">
          <span />
          <span />
        </div>
      )}
      <div className="etiquette-pod">
        <div className="nom">
          {nom}
          {etiquette && <span className="position-siege">{etiquette}</span>}
        </div>
        <div className="stack">{couche ? "couché" : formatBb(stack)}</div>
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

/**
 * Table de poker générique.
 * sieges : [{ position: "hero"|"haut"|"gauche"|"droite", nom, stack, cartes: [c, c] (objets
 *   { rang, couleur } ou "Ah"), mise, badgeMise, dealer, couche, etiquette }] — le héros en premier.
 * board : cartes du tableau ("Ah"…), pot : montant affiché (bb),
 * contexte : texte de la bulle, info : { titre, valeur } (encart en haut à droite).
 */
export function Table({ sieges, board = [], pot, contexte, info, children }) {
  const hero = sieges.find((s) => s.position === "hero");
  const adversaires = sieges.filter((s) => s.position !== "hero");
  const dealer = sieges.find((s) => s.dealer);
  const cartesHero = hero.cartes || [];
  return (
    <div className="scene">
      {contexte && <div className="barre-scene">{contexte}</div>}
      {info && (
        <div className="carte-info">
          {info.titre}
          <strong>{info.valeur}</strong>
        </div>
      )}
      <div className="table-stade">
        <div className="rail" />
        <div className="feutre" />
        <div className="pot">
          Pot <strong>{formatNombre(pot)} bb</strong>
        </div>
        {board.some(Boolean) && (
          <div className="board">
            {board.map((c, i) =>
              c ? <CarteJeu key={i} carte={versCarte(c)} classe="petite" /> : <CarteVide key={i} classe="petite" />,
            )}
          </div>
        )}
        {adversaires.map((s) => (
          <Pod
            key={s.position}
            nom={s.nom}
            stack={s.stack}
            position={s.position}
            cartes={s.cartes}
            couche={s.couche}
            etiquette={s.etiquette}
          />
        ))}
        {sieges.map(
          (s) =>
            s.mise > 0 && <Mise key={s.position} position={`mise-${s.position}`} montant={s.mise} badge={s.badgeMise} />,
        )}
        {dealer && <div className={`jeton-dealer pos-${dealer.position}`}>D</div>}
        <div className={`pod hero${hero.couche ? " couche" : ""}`}>
          <div className="cartes-hero">
            {cartesHero[0] ? <CarteJeu carte={versCarte(cartesHero[0])} classe="inclinee-g" /> : <CarteVide classe="inclinee-g" />}
            {cartesHero[1] ? <CarteJeu carte={versCarte(cartesHero[1])} classe="inclinee-d" /> : <CarteVide classe="inclinee-d" />}
          </div>
          <div className="etiquette-pod claire">
            <div className="nom">
              {hero.nom}
              {hero.etiquette && <span className="position-siege">{hero.etiquette}</span>}
            </div>
            <div className="stack">{hero.couche ? "couché" : formatBb(hero.stack)}</div>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
