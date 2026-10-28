import { useMemo, useState } from "react";
import { Tuile } from "./ui/Tuile.jsx";
import { Tourne } from "./ui/Chargement.jsx";
import { comparerParTables, detailParJour, lignesASaisir, CHOIX_TABLES, formatJour } from "../lib/nombre-tables.js";
import { euros, pourcent, pluriel } from "../lib/format.js";
import { formatHeures } from "../lib/heures.js";

const signe = (v) => (v >= 0 ? "+" : "");
const unDecimal = (v) => v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const nomTables = (n) => (n === null ? "Non renseigné" : n === 1 ? "1 table" : `${n} tables`);
const MAX_LIGNES_SAISIE = 60;

/** Valeur formatée, ou « — » si inconnue, ou un spinner si le calcul d'équité est en cours. */
function Valeur({ v, fmt, calcul }) {
  if (v === null || v === undefined || Number.isNaN(v)) return calcul ? <Tourne /> : <span className="muet">—</span>;
  return fmt(v);
}

/** Barre signée proportionnelle (cEV par partie) à côté de la valeur. */
function BarreCev({ v, max }) {
  if (v === null || v === undefined || !max) return null;
  const largeur = Math.min(100, (Math.abs(v) / max) * 100);
  return (
    <span className={`barre-cev ${v >= 0 ? "positif" : "negatif"}`} aria-hidden="true">
      <span style={{ width: `${largeur}%` }} />
    </span>
  );
}

/** Pilules 1 à 8 tables + « ? » pour une ligne jour × limite. */
export function ChoixNombreTables({ valeur, surChoix, compact = false }) {
  return (
    <div className={`segment${compact ? " compact" : ""}`}>
      {CHOIX_TABLES.map((n) => (
        <button key={n} type="button" className={valeur === n ? "actif" : ""} onClick={() => surChoix(n)}>
          {compact ? n : nomTables(n)}
        </button>
      ))}
      <button type="button" className={valeur === "?" ? "actif" : ""} onClick={() => surChoix(null)} title="Je ne sais plus">
        ?
      </button>
    </div>
  );
}

/**
 * Tuile « cEV par nombre de tables » : sur la limite choisie, une ligne par nombre de tables déclaré
 * (parties, cEV et réel par partie, ROI, ranges, victoires, rythme, heures, VPIP, PFR). Une ligne cliquée
 * détaille les jours. Un volet replié permet de renseigner les jours passés.
 */
export function ComparaisonTables({ mains, charts, parMain, limite, setLimite, limites, definir }) {
  const cmp = useMemo(() => comparerParTables(mains, charts, parMain, limite), [mains, charts, parMain, limite]);
  const calcul = !parMain;
  const [selection, setSelection] = useState(undefined); // nombre de tables dont on détaille les jours
  const [sansValeur, setSansValeur] = useState(true);
  const [repondues, setRepondues] = useState({});
  const detail = useMemo(() => (selection === undefined ? [] : detailParJour(mains, parMain, limite, selection)), [mains, parMain, limite, selection]);
  const saisie = useMemo(() => lignesASaisir(mains, sansValeur), [mains, sansValeur]);
  const lignes = [...cmp.lignes, ...(cmp.sansTables ? [{ tables: null, ...cmp.sansTables }] : [])];
  const maxCev = Math.max(0, ...lignes.map((l) => Math.abs(l.cEV ?? 0)), Math.abs(cmp.total.cEV ?? 0));
  const colonnes = [
    { cle: "parties", nom: "Parties", fmt: (v) => String(v) },
    { cle: "cEV", nom: "cEV / partie", fmt: (v) => `${signe(v)}${unDecimal(v)}`, sens: true, calcul, barre: true, titre: "jetons gagnés par partie, chance neutralisée" },
    { cle: "reel", nom: "Réel / partie", fmt: (v) => `${signe(v)}${unDecimal(v)}`, sens: true, calcul, titre: "jetons réellement gagnés par partie" },
    { cle: "roi", nom: "ROI", fmt: pourcent, sens: true },
    { cle: "netEuro", nom: "Gain net", fmt: (v) => `${signe(v)}${euros(v)}`, sens: true },
    { cle: "conformite", nom: "Ranges", fmt: pourcent, titre: "respect des ranges pré-flop" },
    { cle: "victoires", nom: "Victoires", fmt: pourcent },
    { cle: "partiesParHeure", nom: "Parties / h", fmt: unDecimal },
    { cle: "tablesMoyennes", nom: "Tables mesurées", fmt: (v, r) => `${unDecimal(v)} · pic ${r.tablesMax}`, titre: "tables en même temps d'après les horodatages : moyenne · pic" },
    { cle: "heures", nom: "Heures", fmt: (v) => (v > 0 ? formatHeures(v) : "—") },
    { cle: "vpip", nom: "VPIP", fmt: pourcent },
    { cle: "pfr", nom: "PFR", fmt: pourcent },
  ];
  const choixLimites = [...new Set([...limites])].sort((a, b) => a - b);

  function repondre(ligne, n) {
    definir(ligne.ids, n);
    setRepondues((r) => ({ ...r, [ligne.cle]: n === null ? "?" : n }));
  }

  const Ligne = ({ r, nom, total = false }) => {
    const active = !total && selection !== undefined && selection === r.tables;
    return (
      <tr className={`${total ? "total" : "cliquable"}${active ? " active" : ""}`} onClick={total ? undefined : () => setSelection(active ? undefined : r.tables)}>
        <td>{nom}</td>
        {colonnes.map((c) => {
          const v = r[c.cle];
          const classe = c.sens && v !== null && v !== undefined && v !== 0 ? (v > 0 ? "positif" : "negatif") : "";
          return (
            <td key={c.cle} className={classe} title={c.titre}>
              {c.barre && <BarreCev v={v} max={maxCev} />}
              <Valeur v={v} fmt={(x) => c.fmt(x, r)} calcul={c.calcul} />
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <Tuile
      variante="sombre"
      span={12}
      titre="cEV par nombre de tables"
      sous={`${limite === null ? "toutes limites" : `à ${euros(limite)}`} : tes résultats selon le nombre de tables jouées en même temps (déclaré à l'import, par jour et par limite)`}
      action={
        choixLimites.length > 0 && (
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
      {cmp.lignes.length === 0 ? (
        <p className="muet">
          Aucun nombre de tables renseigné {limite === null ? "" : `à ${euros(limite)}`}. Réponds à la question posée après un import (quand il tient en 3 jours), ou renseigne
          les jours passés ci-dessous.
        </p>
      ) : (
        <div className="defilant">
          <table className="tableau-limites comparaison par-tables">
            <thead>
              <tr>
                <th>Tables</th>
                {colonnes.map((c) => (
                  <th key={c.cle} title={c.titre}>
                    {c.nom}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lignes.map((r) => (
                <Ligne key={String(r.tables)} r={r} nom={nomTables(r.tables)} />
              ))}
              <Ligne r={cmp.total} nom="Toutes" total />
            </tbody>
          </table>
        </div>
      )}
      {selection !== undefined && detail.length > 0 && (
        <div className="detail-tables">
          <p className="muet">
            {nomTables(selection)} {limite === null ? "" : `à ${euros(limite)}`}, jour par jour (cEV et réel en jetons par partie) :
          </p>
          <div className="defilant">
            <table className="tableau-limites comparaison">
              <thead>
                <tr>
                  <th>Jour</th>
                  <th>Parties</th>
                  <th>cEV / partie</th>
                  <th>Réel / partie</th>
                  <th>Gain net</th>
                </tr>
              </thead>
              <tbody>
                {detail.map((j) => (
                  <tr key={j.jour}>
                    <td>{formatJour(j.date)}</td>
                    <td>{j.parties}</td>
                    <td className={j.cEV === null ? "" : j.cEV >= 0 ? "positif" : "negatif"}>
                      <Valeur v={j.cEV} fmt={(v) => `${signe(v)}${unDecimal(v)}`} calcul={calcul} />
                    </td>
                    <td className={j.reel === null ? "" : j.reel >= 0 ? "positif" : "negatif"}>
                      <Valeur v={j.reel} fmt={(v) => `${signe(v)}${unDecimal(v)}`} calcul={calcul} />
                    </td>
                    <td className={j.netEuro >= 0 ? "positif" : "negatif"}>
                      {signe(j.netEuro)}
                      {euros(j.netEuro)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {cmp.lignes.length > 0 && (
        <p className="tuile-legende">
          Clique une ligne pour voir le détail par jour. cEV et réel sont en jetons par partie ; « Tables mesurées » vient du chevauchement des parties dans le
          temps, à comparer au nombre déclaré.
        </p>
      )}
      <details className="marquage">
        <summary className="muet">Renseigner ou corriger le nombre de tables par jour</summary>
        <div className="saisie-tables">
          <div className="segment">
            <button type="button" className={sansValeur ? "actif" : ""} onClick={() => setSansValeur(true)}>
              Jours sans valeur
            </button>
            <button type="button" className={!sansValeur ? "actif" : ""} onClick={() => setSansValeur(false)}>
              Tous les jours
            </button>
          </div>
          {saisie.length === 0 ? (
            <p className="muet">Tout est renseigné.</p>
          ) : (
            <div className="lignes-tables">
              {saisie.slice(0, MAX_LIGNES_SAISIE).map((l) => (
                <div className="ligne-tables" key={l.cle}>
                  <span className="ligne-tables-libelle">
                    <strong>{formatJour(l.date)}</strong> · {l.limite === null ? "limite inconnue" : euros(l.limite)} · {pluriel("partie", l.parties)}
                  </span>
                  <ChoixNombreTables valeur={repondues[l.cle] ?? l.tables ?? undefined} surChoix={(n) => repondre(l, n)} compact />
                </div>
              ))}
              {saisie.length > MAX_LIGNES_SAISIE && <p className="muet">… et {pluriel("autre ligne", saisie.length - MAX_LIGNES_SAISIE)} plus ancienne{saisie.length - MAX_LIGNES_SAISIE > 1 ? "s" : ""}.</p>}
            </div>
          )}
        </div>
      </details>
    </Tuile>
  );
}
