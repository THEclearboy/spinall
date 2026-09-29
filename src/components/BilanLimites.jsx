import { euros, pourcent } from "../lib/format.js";
import { Tourne } from "./ui/Chargement.jsx";

const signe = (v) => (v >= 0 ? "+" : "");
const unDecimal = (v) => v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

/**
 * Tableau « Résultats par limite » : une ligne par buy-in + une ligne Total.
 * lignes : sortie de bilanParLimite ; selection : limite affichée (null = toutes) ;
 * onSelection(limite) : clic sur une ligne pour filtrer tout l'onglet.
 */
export function BilanLimites({ lignes, selection, onSelection }) {
  return (
    <div className="bilan-limites">
      <table>
        <thead>
          <tr>
            <th>Limite</th>
            <th>Parties</th>
            <th>Gain net</th>
            <th>ROI</th>
            <th>1ᵉʳ / 2ᵉ / 3ᵉ</th>
            <th title="Jetons gagnés en théorie par partie (tapis ajustés à l'équité)">cEV / partie</th>
            <th title="Jetons réellement gagnés par partie">Réel / partie</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => {
            const active = (selection ?? null) === l.limite;
            return (
              <tr
                key={l.limite === null ? "total" : l.limite}
                className={`ligne-limite${l.limite === null ? " total" : ""}${active ? " active" : ""}`}
                onClick={() => onSelection(l.limite)}
                title="Cliquer pour n'afficher que cette limite"
              >
                <td>{l.limite === null ? "Toutes" : euros(l.limite)}</td>
                <td>{l.parties}</td>
                <td className={l.netEuro >= 0 ? "bonne-reponse" : "mauvaise-reponse"}>
                  {signe(l.netEuro)}
                  {euros(l.netEuro)}
                </td>
                <td>{l.roi === null ? "—" : `${signe(l.roi)}${pourcent(l.roi)}`}</td>
                <td>
                  {l.places[1]} / {l.places[2]} / {l.places[3]}
                </td>
                <td className={l.cEV === null ? "" : l.cEV >= 0 ? "bonne-reponse" : "mauvaise-reponse"}>
                  {l.cEV === null ? <Tourne /> : `${signe(l.cEV)}${unDecimal(l.cEV)}`}
                </td>
                <td>{l.reelParPartie === null ? <Tourne /> : `${signe(l.reelParPartie)}${unDecimal(l.reelParPartie)}`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
