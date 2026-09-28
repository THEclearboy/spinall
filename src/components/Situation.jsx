import { useEffect, useMemo, useState } from "react";
import { Table } from "./Table.jsx";
import { ChoixCarte, SlotCarte } from "./ChoixCarte.jsx";
import {
  situationParDefaut,
  siegesActifs,
  etiquettesPositions,
  cartesUtilisees,
  potTotal,
  rueCourante,
  encoderSituation,
  decoderSituation,
  POSITIONS_HU,
  POSITIONS_3W,
} from "../lib/situation.js";
import { lireLocal, ecrireLocal } from "../lib/stockage.js";
import { formatBb } from "../lib/format.js";

/**
 * Onglet Situation : une table entièrement paramétrable (format, bouton, stacks, mises,
 * cartes, board, note) pour expliquer une mise en situation.
 */
export function Situation() {
  const [situation, setSituation] = useState(() => {
    const sauvee = lireLocal("situation", null);
    if (!sauvee) return situationParDefaut();
    try {
      return decoderSituation(JSON.stringify(sauvee));
    } catch {
      return situationParDefaut();
    }
  });
  const [slotActif, setSlotActif] = useState(null); // { type: "siege", index, carte } | { type: "board", index }
  const [message, setMessage] = useState(null);

  useEffect(() => {
    ecrireLocal("situation", situation);
  }, [situation]);

  const actifs = siegesActifs(situation);
  const etiquettes = etiquettesPositions(situation);
  const utilisees = useMemo(() => cartesUtilisees(situation), [situation]);
  const positions = situation.format === "HU" ? POSITIONS_HU : POSITIONS_3W;

  const sieges = actifs.map((s, i) => ({
    position: positions[i],
    nom: s.nom || (i === 0 ? "Toi" : `Vilain ${i}`),
    stack: s.stack,
    cartes: s.cartes,
    mise: s.mise,
    dealer: situation.dealer % actifs.length === i,
    couche: s.couche,
    etiquette: etiquettes[i],
  }));

  function majSiege(index, champ, valeur) {
    setSituation((s) => {
      const sieges = s.sieges.map((siege, i) => (i === index ? { ...siege, [champ]: valeur } : siege));
      return { ...s, sieges };
    });
  }

  function choisirCarte(carte) {
    if (!slotActif) return;
    setSituation((s) => {
      if (slotActif.type === "board") {
        const board = [...s.board];
        board[slotActif.index] = carte;
        return { ...s, board };
      }
      const sieges = s.sieges.map((siege, i) => {
        if (i !== slotActif.index) return siege;
        const cartes = [...siege.cartes];
        cartes[slotActif.carte] = carte;
        return { ...siege, cartes };
      });
      return { ...s, sieges };
    });
    // Passe automatiquement au slot suivant du même groupe.
    if (carte) {
      if (slotActif.type === "siege" && slotActif.carte === 0) setSlotActif({ ...slotActif, carte: 1 });
      else if (slotActif.type === "board" && slotActif.index < 4) setSlotActif({ type: "board", index: slotActif.index + 1 });
      else setSlotActif(null);
    }
  }

  function slotEstActif(type, index, carte) {
    return !!slotActif && slotActif.type === type && slotActif.index === index && (type === "board" || slotActif.carte === carte);
  }

  function basculerSlot(type, index, carte) {
    setSlotActif(slotEstActif(type, index, carte) ? null : { type, index, carte });
  }

  function valeurSlot() {
    if (!slotActif) return null;
    if (slotActif.type === "board") return situation.board[slotActif.index];
    return situation.sieges[slotActif.index].cartes[slotActif.carte];
  }

  async function copier() {
    const texte = encoderSituation(situation);
    try {
      await navigator.clipboard.writeText(texte);
      setMessage("Situation copiée : colle-la dans un message, ton ami la retrouvera avec « Coller ».");
    } catch {
      window.prompt("Copie ce texte :", texte);
    }
  }

  async function coller() {
    let texte = null;
    try {
      texte = await navigator.clipboard.readText();
    } catch {}
    if (!texte) texte = window.prompt("Colle ici la situation reçue :");
    if (!texte) return;
    try {
      setSituation(decoderSituation(texte));
      setSlotActif(null);
      setMessage("Situation chargée.");
    } catch {
      setMessage("Ce texte n'est pas une situation valide.");
    }
  }

  function reinitialiser() {
    setSituation(situationParDefaut());
    setSlotActif(null);
    setMessage(null);
  }

  const nombre = (valeur, defaut = 0) => {
    const n = parseFloat(String(valeur).replace(",", "."));
    return Number.isFinite(n) ? n : defaut;
  };

  return (
    <section className="situation">
      <Table
        sieges={sieges}
        board={situation.board}
        pot={potTotal(situation)}
        contexte={`${rueCourante(situation)} — ${situation.format === "HU" ? "heads-up" : "3 joueurs"}`}
        info={{ titre: "Pot", valeur: formatBb(potTotal(situation)) }}
      >
        {situation.note && <div className="note-situation">{situation.note}</div>}
      </Table>

      <div className="panneau editeur-situation">
        <div className="ligne-editeur">
          <div className="segment">
            <button className={situation.format === "HU" ? "actif" : ""} onClick={() => setSituation((s) => ({ ...s, format: "HU", dealer: s.dealer % 2 }))}>
              Heads-up
            </button>
            <button className={situation.format === "3W" ? "actif" : ""} onClick={() => setSituation((s) => ({ ...s, format: "3W" }))}>
              3 joueurs
            </button>
          </div>
          <label className="champ">
            Bouton (dealer)
            <select value={situation.dealer % actifs.length} onChange={(e) => setSituation((s) => ({ ...s, dealer: Number(e.target.value) }))}>
              {actifs.map((s, i) => (
                <option key={i} value={i}>
                  {s.nom || (i === 0 ? "Toi" : `Vilain ${i}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="champ">
            Pot déjà au milieu (bb)
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0"
              value={situation.potBase}
              onChange={(e) => setSituation((s) => ({ ...s, potBase: nombre(e.target.value) }))}
            />
          </label>
        </div>

        <div className="sieges-editeur">
          {actifs.map((siege, i) => (
            <div key={i} className={`siege-editeur${siege.couche ? " couche" : ""}`}>
              <div className="siege-entete">
                <input
                  className="nom-siege"
                  value={siege.nom}
                  placeholder={i === 0 ? "Toi" : `Vilain ${i}`}
                  onChange={(e) => majSiege(i, "nom", e.target.value)}
                />
                <span className="position-siege">{etiquettes[i]}</span>
              </div>
              <div className="ligne-editeur">
                <label className="champ">
                  Stack (bb)
                  <input type="number" inputMode="decimal" step="0.5" min="0" value={siege.stack} onChange={(e) => majSiege(i, "stack", nombre(e.target.value))} />
                </label>
                <label className="champ">
                  Mise en cours (bb)
                  <input type="number" inputMode="decimal" step="0.5" min="0" value={siege.mise} onChange={(e) => majSiege(i, "mise", nombre(e.target.value))} />
                </label>
                <label className="interrupteur">
                  <input type="checkbox" checked={siege.couche} onChange={(e) => majSiege(i, "couche", e.target.checked)} />
                  Couché
                </label>
              </div>
              <div className="slots">
                <span className="muet">Cartes</span>
                {[0, 1].map((c) => (
                  <SlotCarte
                    key={c}
                    carte={siege.cartes[c]}
                    actif={slotEstActif("siege", i, c)}
                    onClick={() => basculerSlot("siege", i, c)}
                    libelle={`Carte ${c + 1} de ${siege.nom}`}
                  />
                ))}
                {slotActif && slotActif.type === "siege" && slotActif.index === i && (
                  <ChoixCarte utilisees={utilisees} valeur={valeurSlot()} onChoix={choisirCarte} />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="board-editeur">
          <div className="slots">
            <span className="muet">Board</span>
            {[0, 1, 2, 3, 4].map((b) => (
              <SlotCarte
                key={b}
                carte={situation.board[b]}
                actif={slotEstActif("board", b)}
                onClick={() => basculerSlot("board", b)}
                libelle={b < 3 ? "Flop" : b === 3 ? "Turn" : "River"}
              />
            ))}
          </div>
          {slotActif && slotActif.type === "board" && (
            <ChoixCarte utilisees={utilisees} valeur={valeurSlot()} onChoix={choisirCarte} />
          )}
        </div>

        <label className="champ champ-large">
          Explication (affichée sur la table)
          <textarea
            rows={2}
            value={situation.note}
            placeholder="Ex. : ici, avec 12 bb et un limp devant, tu dois envoyer le tapis…"
            onChange={(e) => setSituation((s) => ({ ...s, note: e.target.value }))}
          />
        </label>

        <div className="barre-actions">
          <button className="bouton" onClick={copier}>
            Copier la situation
          </button>
          <button className="bouton" onClick={coller}>
            Coller une situation
          </button>
          <button className="bouton danger" onClick={reinitialiser}>
            Réinitialiser
          </button>
        </div>
        {message && <p className="muet">{message}</p>}
      </div>
    </section>
  );
}
