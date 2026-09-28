import { Table } from "./Table.jsx";
import { formatBb } from "../lib/format.js";

/** La table de l'entraînement : mise en place fixe selon la famille de situation. */
export function TableScene({ famille, cartes, profondeur, contexte, titre, children }) {
  let sieges;
  let pot;
  if (famille === "HU_SB") {
    pot = 1.5;
    sieges = [
      { position: "hero", nom: "Toi", stack: profondeur, cartes, mise: 0.5, dealer: true },
      { position: "haut", nom: "Vilain_BB", stack: profondeur, mise: 1 },
    ];
  } else if (famille === "HU_BB") {
    pot = 2;
    sieges = [
      { position: "hero", nom: "Toi", stack: profondeur, cartes, mise: 1 },
      { position: "haut", nom: "Vilain_SB", stack: profondeur, mise: 1, badgeMise: "Limp", dealer: true },
    ];
  } else {
    pot = 1.5;
    sieges = [
      { position: "hero", nom: "Toi", stack: profondeur, cartes, dealer: true },
      { position: "gauche", nom: "Vilain_SB", stack: profondeur, mise: 0.5 },
      { position: "droite", nom: "Vilain_BB", stack: profondeur, mise: 1 },
    ];
  }
  return (
    <Table sieges={sieges} pot={pot} contexte={titre} sous={contexte} info={{ titre: "Stack effectif", valeur: formatBb(profondeur) }}>
      {children}
    </Table>
  );
}
