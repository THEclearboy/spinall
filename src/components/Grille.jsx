import { nomMainParIndices, classeAction, styleAction } from "../lib/charts.js";

/**
 * Grille 13×13 des mains colorée par action.
 * `onClique(main)` rend les cases cliquables (éditeur de ranges).
 */
export function GrilleMains({ mains, mainsModifiees, surligne, onClique, mini = false }) {
  const cases = [];
  for (let l = 0; l < 13; l++)
    for (let c = 0; c < 13; c++) {
      const main = nomMainParIndices(l, c);
      const classes = ["case", classeAction(mains[main])];
      const style = styleAction(mains[main]);
      if (surligne === main) classes.push("surlignee");
      if (mainsModifiees && mainsModifiees.has(main)) classes.push("modifiee");
      const cle = main + l + "-" + c;
      cases.push(
        onClique ? (
          <button
            key={cle}
            className={classes.join(" ")}
            style={style}
            onClick={() => onClique(main)}
            title={`${main} — cliquer pour changer l'action`}
          >
            {main}
          </button>
        ) : (
          <div key={cle} className={classes.join(" ")} style={style}>
            {main}
          </div>
        ),
      );
    }
  return <div className={mini ? "grille mini" : "grille"}>{cases}</div>;
}

export function Legende() {
  return (
    <div className="legende">
      <span className="pastille action-allin" /> All-in
      <span className="pastille action-call" /> Call / Limp / Check
      <span className="pastille action-raise" /> Raise
      <span className="pastille action-fold" /> Fold
      <span className="pastille action-mixte" /> Mixte : les deux actions sont bonnes
    </div>
  );
}
