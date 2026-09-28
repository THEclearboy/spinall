import { CarteInline } from "./Carte.jsx";
import { GrilleMains } from "./Grille.jsx";
import { labelAction } from "../lib/charts.js";
import { formatBbArrondi } from "../lib/format.js";

const NOMS_RUES = { preflop: "Pré-flop", flop: "Flop", turn: "Turn", river: "River" };

function decrireAction(action, bigBlind) {
  const bb = (montant) =>
    `${(montant / bigBlind).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} bb`;
  const tapis = action.allin ? " (all-in)" : "";
  switch (action.verbe) {
    case "post_sb":
      return `poste la SB ${bb(action.montant)}${tapis}`;
    case "post_bb":
      return `poste la BB ${bb(action.montant)}${tapis}`;
    case "fold":
      return "se couche";
    case "check":
      return "check";
    case "call":
      return `paie ${bb(action.montant)}${tapis}`;
    case "bet":
      return `mise ${bb(action.montant)}${tapis}`;
    case "raise":
      return `relance à ${bb(action.montant)}${tapis}`;
    default:
      return action.verbe;
  }
}

/** Déroulé complet d'une main importée (joueurs, actions rue par rue, showdown, gains). */
export function DetailMain({ main, spot, chartsParId }) {
  const bigBlind = main.blinds[1];
  const rues = ["preflop", "flop", "turn", "river"].filter((rue) =>
    main.actions.some((a) => a.rue === rue),
  );
  const boardParRue = {
    flop: main.board.slice(0, 3),
    turn: main.board.slice(0, 4),
    river: main.board.slice(0, 5),
  };
  return (
    <div className="detail-main">
      <p>
        <strong>
          Blinds {main.blinds[0]}/{main.blinds[1]}
        </strong>
        {" — "}
        {main.joueurs.map((j) => (
          <span key={j.nom} className="joueur-detail">
            {j.nom === main.hero ? <strong>{j.nom}</strong> : j.nom} ({formatBbArrondi(j.stack / bigBlind)}
            {j.tags
              .filter((t) => t !== "Hero")
              .map((t) => ` ${t}`)
              .join("")}
            )
          </span>
        ))}
      </p>
      {rues.map((rue) => (
        <div key={rue} className="rue-detail">
          <span className="nom-rue">
            {NOMS_RUES[rue]}
            {rue !== "preflop" && boardParRue[rue] && (
              <>
                {" "}
                {boardParRue[rue].map((c) => (
                  <CarteInline key={c} texte={c} />
                ))}
              </>
            )}
          </span>
          <ul>
            {main.actions
              .filter((a) => a.rue === rue)
              .map((a, i) => (
                <li key={i} className={a.joueur === main.hero ? "action-hero" : ""}>
                  {a.joueur} {decrireAction(a, bigBlind)}
                </li>
              ))}
          </ul>
        </div>
      ))}
      {Object.keys(main.combinaisons).length > 0 && (
        <p>
          Showdown :{" "}
          {Object.entries(main.combinaisons).map(([joueur, combinaison]) => (
            <span key={joueur} className="joueur-detail">
              {joueur}{" "}
              {(main.cartes[joueur] || []).map((c) => (
                <CarteInline key={c} texte={c} />
              ))}{" "}
              ({combinaison})
            </span>
          ))}
        </p>
      )}
      <p>
        {Object.entries(main.gains).map(([joueur, gain]) => (
          <span key={joueur} className="joueur-detail">
            {joueur} remporte {formatBbArrondi(gain / bigBlind)}
          </span>
        ))}
      </p>
      {spot && !spot.conforme && chartsParId.get(spot.chartId) && (
        <div className="detail-ecart">
          <p>
            Écart de range : joué{" "}
            <strong className="mauvaise-reponse">{labelAction(spot.familleId, spot.jouee)}</strong>, attendu{" "}
            <strong className="bonne-reponse">{labelAction(spot.familleId, spot.attendu)}</strong> —{" "}
            {spot.chartTitre}
          </p>
          <GrilleMains mains={chartsParId.get(spot.chartId).mains} surligne={spot.main} />
        </div>
      )}
    </div>
  );
}
