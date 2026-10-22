import { useMemo, useState } from "react";
import { Tuile, Pilule } from "./ui/Tuile.jsx";
import { Tourne } from "./ui/Chargement.jsx";
import { comparerEntrainement } from "../lib/mode-entrainement.js";
import { euros, pourcent, pluriel } from "../lib/format.js";
import { formatHeures } from "../lib/heures.js";

const signe = (v) => (v >= 0 ? "+" : "");
const unDecimal = (v) => v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const points = (d) => `${signe(d)}${(d * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} pt`;

/** Valeur formatée, ou « — » si inconnue, ou un spinner si le calcul d'équité est en cours. */
function Valeur({ v, fmt, calcul }) {
  if (v === null || v === undefined || Number.isNaN(v)) return calcul ? <Tourne /> : <span className="muet">—</span>;
  return fmt(v);
}

/**
 * Tuile « Entraînement vs normal » : sur une limite, les parties marquées entraînement
 * face aux autres. Avec un petit formulaire pour marquer ou démarquer des parties.
 */
export function Comparaison({ mains, charts, parMain, limite, setLimite, limites, marquer, idsParLimiteEtPeriode }) {
  const [tables, setTables] = useState(null);
  const cmp = useMemo(() => comparerEntrainement(mains, charts, parMain, limite, tables), [mains, charts, parMain, limite, tables]);
  const n = cmp.normal;
  const t = cmp.entrainement;
  const calcul = !parMain;
  const [formLimite, setFormLimite] = useState(limite ?? limites[0] ?? null);
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [formTables, setFormTables] = useState("");
  const [message, setMessage] = useState(null);

  const lignes = [
    { label: "Parties", n: n.parties, t: t.parties, fmt: (v) => String(v), fmtEcart: (d) => `${signe(d)}${d}` },
    {
      label: "Tables déclarées à l'import (moyenne)",
      n: null,
      t: t.tablesDeclarees,
      fmt: (v, r) => `${unDecimal(v)}${r.partiesAvecTables < r.parties ? ` (${r.partiesAvecTables}/${r.parties} parties)` : ""}`,
      fmtEcart: null,
    },
    { label: "Respect des ranges pré-flop", n: n.conformite, t: t.conformite, fmt: pourcent, fmtEcart: points, sens: 1 },
    { label: "cEV / partie (jetons)", n: n.cEV, t: t.cEV, fmt: (v) => `${signe(v)}${unDecimal(v)}`, fmtEcart: (d) => `${signe(d)}${unDecimal(d)}`, sens: 1, calcul },
    { label: "Réel / partie (jetons)", n: n.reel, t: t.reel, fmt: (v) => `${signe(v)}${unDecimal(v)}`, fmtEcart: (d) => `${signe(d)}${unDecimal(d)}`, sens: 1, calcul },
    { label: "ROI", n: n.roi, t: t.roi, fmt: pourcent, fmtEcart: points, sens: 1 },
    { label: "Gain net", n: n.netEuro, t: t.netEuro, fmt: euros, fmtEcart: (d) => `${signe(d)}${euros(d)}`, sens: 1 },
    { label: "Victoires", n: n.victoires, t: t.victoires, fmt: pourcent, fmtEcart: points, sens: 1 },
    { label: "Parties / heure", n: n.partiesParHeure, t: t.partiesParHeure, fmt: unDecimal, fmtEcart: (d) => `${signe(d)}${unDecimal(d)}` },
    {
      label: "Tables en même temps (moyenne · pic)",
      n: n.tablesMoyennes,
      t: t.tablesMoyennes,
      fmt: (v, r) => `${unDecimal(v)} · ${r.tablesMax}`,
      fmtEcart: (d) => `${signe(d)}${unDecimal(d)}`,
    },
    { label: "Heures jouées", n: n.heures, t: t.heures, fmt: (v) => (v > 0 ? formatHeures(v) : "—"), fmtEcart: null },
    { label: "VPIP", n: n.vpip, t: t.vpip, fmt: pourcent, fmtEcart: points },
    { label: "PFR", n: n.pfr, t: t.pfr, fmt: pourcent, fmtEcart: points },
  ];

  const choixLimites = [...new Set([...cmp.limitesEntrainement, ...(limite !== null && !cmp.limitesEntrainement.includes(limite) ? [limite] : [])])].sort((a, b) => a - b);

  function appliquer(valeur) {
    const debut = du ? new Date(du + "T00:00:00").getTime() : null;
    const fin = au ? new Date(au + "T23:59:59.999").getTime() : null;
    const ids = idsParLimiteEtPeriode(formLimite, debut, fin);
    if (ids.size === 0) {
      setMessage("Aucune partie ne correspond à cette limite et cette période.");
      return;
    }
    const nbTables = formTables ? Number(formTables) : null;
    marquer([...ids], valeur, nbTables);
    setMessage(
      `${pluriel("partie", ids.size)} ${valeur ? "marquée" : "remise"}${ids.size > 1 ? "s" : ""} ${valeur ? "entraînement" : "en normal"}${
        valeur && nbTables ? `, ${nbTables} table${nbTables > 1 ? "s" : ""}` : ""
      }.`,
    );
  }

  return (
    <Tuile
      variante="sombre"
      span={12}
      titre="Entraînement vs normal"
      sous={limite === null ? "toutes limites : parties marquées entraînement face aux autres" : `à ${euros(limite)} : parties marquées entraînement face aux autres`}
      action={
        choixLimites.length + 1 > 1 && (
          <div className="segment">
            {choixLimites.map((l) => (
              <button key={l} className={limite === l ? "actif" : ""} onClick={() => setLimite(l)} type="button">
                {euros(l)}
              </button>
            ))}
            <button className={limite === null ? "actif" : ""} onClick={() => setLimite(null)} type="button">
              Toutes
            </button>
          </div>
        )
      }
    >
      {cmp.tablesDeclarees.length > 0 && (
        <div className="pilules">
          <span className="muet">Entraînement :</span>
          <div className="segment">
            <button className={tables === null ? "actif" : ""} onClick={() => setTables(null)} type="button">
              toutes les sessions
            </button>
            {cmp.tablesDeclarees.map((nb) => (
              <button key={nb} className={tables === nb ? "actif" : ""} onClick={() => setTables(nb)} type="button">
                {nb === 1 ? "1 table" : `${nb} tables`}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="defilant">
        <table className="tableau-limites comparaison">
          <thead>
            <tr>
              <th></th>
              <th>Normal</th>
              <th>Entraînement</th>
              <th>Écart</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => {
              const connu = l.n !== null && l.n !== undefined && l.t !== null && l.t !== undefined;
              const d = connu ? l.t - l.n : null;
              const classe = l.sens && d !== null && d !== 0 ? (d > 0 ? "positif" : "negatif") : "";
              return (
                <tr key={l.label}>
                  <td>{l.label}</td>
                  <td>
                    <Valeur v={l.n} fmt={(v) => l.fmt(v, n)} calcul={l.calcul} />
                  </td>
                  <td>
                    <strong>
                      <Valeur v={l.t} fmt={(v) => l.fmt(v, t)} calcul={l.calcul} />
                    </strong>
                  </td>
                  <td className={`ecart ${classe}`}>{l.fmtEcart && d !== null ? l.fmtEcart(d) : <span className="muet">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="tuile-legende">
        Entraînement : {pluriel("partie", t.parties)}, {pluriel("main", t.nbMains)}, {pluriel("spot pré-flop", t.nbSpots)} · normal :{" "}
        {pluriel("partie", n.parties)}. L'écart est entraînement moins normal ; en vert quand l'entraînement fait mieux.
      </p>
      <details className="marquage">
        <summary className="muet">Marquer ou démarquer des parties (par limite et période)</summary>
        <div className="formulaire-marquage">
          <label>
            Limite{" "}
            <select value={formLimite ?? ""} onChange={(e) => setFormLimite(e.target.value === "" ? null : Number(e.target.value))}>
              <option value="">toutes</option>
              {limites.map((l) => (
                <option key={l} value={l}>
                  {euros(l)}
                </option>
              ))}
            </select>
          </label>
          <label>
            du <input type="date" value={du} onChange={(e) => setDu(e.target.value)} />
          </label>
          <label>
            au <input type="date" value={au} onChange={(e) => setAu(e.target.value)} />
          </label>
          <label>
            tables <input type="number" min="1" max="30" className="court" value={formTables} onChange={(e) => setFormTables(e.target.value)} placeholder="n" />
          </label>
          <Pilule variante="lime" onClick={() => appliquer(true)}>
            Marquer entraînement
          </Pilule>
          <Pilule variante="clair" classe="sur-sombre" onClick={() => appliquer(false)}>
            Remettre en normal
          </Pilule>
        </div>
        {message && <p className="muet">{message}</p>}
      </details>
    </Tuile>
  );
}
