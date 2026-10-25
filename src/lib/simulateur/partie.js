// Session de simulation multi-tables : horloges (temps d'action, délais des adversaires,
// enchaînement des mains et des parties), coach et compteurs. Le temps est injecté (tick).
import { creerTable, demarrerMain, actionsLegales, jouer, tirerMultiplicateur } from "./moteur.js";
import { deciderBot, rendreLegale } from "./bot.js";
import { spotCouvert, jugerPreflop, analyserCbet } from "./coach.js";

/** Durée d'un niveau de blinds chez Betclic selon le multiplicateur : ×2 1 min, ×3 1 min 30, ×4 et plus 2 min. */
export function dureeNiveauBetclic(multiplicateur) {
  if (multiplicateur <= 2) return 60;
  if (multiplicateur <= 3) return 90;
  return 120;
}

export const NOMS_BOTS = ["BiGTonyGrinD", "Grrrisbi", "LaMachine", "Sabrina", "Yoyo_Spin", "El_Patron", "Mimi", "Zed", "Kraken", "Nono", "Flash", "Pokerface"];

export class Simulation {
  constructor({ nbTables = 3, buyIn = 0.2, charts, secondesAction = 10, dureeNiveauSec = "auto", nomHero = "ClearBoy", alea = Math.random, maintenant = Date.now() }) {
    this.charts = charts;
    this.alea = alea;
    this.options = { nbTables, buyIn, secondesAction, dureeNiveauSec, nomHero };
    this.messages = [];
    this.prochainMessage = 1;
    this.stats = { parties: 0, partiesGagnees: 0, mainsJouees: 0, spots: 0, erreurs: 0, cbetOk: 0, cbetManques: 0, tempsEcoules: 0, investi: 0, gagne: 0, places: { 1: 0, 2: 0, 3: 0 } };
    this.debut = maintenant;
    this.tables = [];
    for (let i = 0; i < nbTables; i++) this.tables.push(this.nouvelleTable(i, maintenant));
  }

  nouvelleTable(index, maintenant) {
    const noms = [...NOMS_BOTS].sort(() => this.alea() - 0.5);
    const multiplicateur = tirerMultiplicateur(this.alea);
    const dureeNiveauSec = this.options.dureeNiveauSec === "auto" ? dureeNiveauBetclic(multiplicateur) : Number(this.options.dureeNiveauSec);
    const table = creerTable({
      id: `T${index + 1}`,
      buyIn: this.options.buyIn,
      joueurs: [
        { id: "hero", nom: this.options.nomHero, hero: true },
        { id: `b${index}a`, nom: noms[0] },
        { id: `b${index}b`, nom: noms[1] },
      ],
      dureeNiveauMs: dureeNiveauSec * 1000,
      maintenant,
      alea: this.alea,
      multiplicateur,
    });
    this.stats.investi = Math.round((this.stats.investi + this.options.buyIn) * 100) / 100;
    return { index, table, prochaineMain: maintenant + 1500, prochaineTable: null, botDelai: null, heroDepuis: null, spot: null, signal: false, finie: false, dernierMessage: null, mains: 0, resultatHero: null };
  }

  /** Fait avancer toutes les tables jusqu'à l'instant `maintenant`. */
  tick(maintenant) {
    for (const t of this.tables) {
      const table = t.table;
      const hero = table.joueurs.find((j) => j.hero);
      // partie finie pour le joueur : table gagnée, ou éliminé (on ne regarde pas les bots finir entre eux)
      const finie = table.termine || (hero.elimine && (!table.main || table.main.rue === "fin"));
      if (finie) {
        if (t.prochaineTable === null) {
          t.finie = true;
          t.prochaineTable = maintenant + 5000;
          this.clorePartie(t, maintenant);
        } else if (maintenant >= t.prochaineTable) {
          this.tables[t.index] = this.nouvelleTable(t.index, maintenant);
        }
        continue;
      }
      if (!table.main || table.main.rue === "fin") {
        if (t.prochaineMain === null) t.prochaineMain = maintenant + (table.main?.resultat?.abattage ? 3500 : 1800);
        if (maintenant >= t.prochaineMain) {
          t.prochaineMain = null;
          t.botDelai = null;
          t.heroDepuis = null;
          t.spot = null;
          demarrerMain(table, maintenant);
          t.mains += 1;
          this.stats.mainsJouees += 1;
          this.armerHero(t, maintenant);
        }
        continue;
      }
      const id = table.main.aParler;
      if (!id) continue;
      if (id === "hero") {
        if (t.heroDepuis === null) this.armerHero(t, maintenant);
        else if (maintenant - t.heroDepuis >= this.options.secondesAction * 1000) {
          const legal = actionsLegales(table);
          const auto = { verbe: legal.peutCheck ? "check" : "fold" };
          this.stats.tempsEcoules += 1;
          this.ajouterMessage(t, "temps", `Temps écoulé : ${legal.peutCheck ? "check" : "fold"} automatique.`, maintenant);
          this.agirHero(t.table.id, auto, maintenant, true);
        }
        continue;
      }
      if (t.botDelai === null) t.botDelai = maintenant + 500 + this.alea() * 1700;
      if (maintenant >= t.botDelai) {
        const action = deciderBot(table, id, this.charts, this.alea);
        jouer(table, id, action);
        t.botDelai = null;
        t.heroDepuis = null;
        t.spot = null;
        this.armerHero(t, maintenant);
      }
    }
  }

  /** Si c'est au joueur de parler, démarre son compte à rebours et repère le spot pré-flop. */
  armerHero(t, maintenant) {
    const main = t.table.main;
    if (!main || main.rue === "fin" || main.aParler !== "hero") return false;
    if (t.heroDepuis === null) {
      t.heroDepuis = maintenant;
      t.spot = spotCouvert(t.table, "hero", this.charts);
      t.signal = true; // l'interface joue un son une fois
    }
    return true;
  }

  /** Le joueur agit sur une table. Renvoie l'action jouée ou null si ce n'était pas à lui. */
  agirHero(tableId, action, maintenant = Date.now(), automatique = false) {
    const t = this.tables.find((x) => x.table.id === tableId);
    if (!t) return null;
    const table = t.table;
    if (!table.main || table.main.aParler !== "hero") return null;
    const legal = actionsLegales(table);
    const legale = rendreLegale(action, legal);
    const spot = t.spot || spotCouvert(table, "hero", this.charts);
    if (spot) {
      const verdict = jugerPreflop(spot, legale, legal);
      this.stats.spots += 1;
      if (!verdict.conforme) this.stats.erreurs += 1;
      this.ajouterMessage(t, verdict.conforme ? "ok" : "erreur", verdict.texte, maintenant, verdict);
    }
    const cbet = analyserCbet(table.main, "hero", legale, legal);
    if (cbet) {
      if (cbet.cbet) this.stats.cbetOk += 1;
      else this.stats.cbetManques += 1;
      if (!cbet.cbet || !automatique) this.ajouterMessage(t, cbet.cbet ? "cbet-ok" : "cbet-manque", cbet.texte, maintenant);
    }
    const jouee = jouer(table, "hero", legale);
    t.heroDepuis = null;
    t.spot = null;
    t.botDelai = null;
    return jouee;
  }

  clorePartie(t, maintenant) {
    const table = t.table;
    const hero = table.joueurs.find((j) => j.hero);
    this.stats.parties += 1;
    if (hero.place) this.stats.places[hero.place] += 1;
    if (hero.place === 1) {
      this.stats.partiesGagnees += 1;
      this.stats.gagne = Math.round((this.stats.gagne + table.prix) * 100) / 100;
    }
    t.resultatHero = { place: hero.place, prix: hero.place === 1 ? table.prix : 0 };
    const texte = hero.place === 1 ? `Partie gagnée : ${table.prix.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}.` : `Partie terminée : ${hero.place === 2 ? "2ᵉ" : "3ᵉ"} place.`;
    this.ajouterMessage(t, "info", texte, maintenant);
  }

  ajouterMessage(t, type, texte, maintenant, detail = null) {
    const m = { id: this.prochainMessage++, tableId: t.table.id, type, texte, temps: maintenant, detail };
    this.messages.push(m);
    if (this.messages.length > 300) this.messages.shift();
    t.dernierMessage = m;
    return m;
  }

  /** Secondes restantes pour le joueur sur une table (null si ce n'est pas à lui). */
  tempsRestant(t, maintenant) {
    if (!t.table.main || t.table.main.rue === "fin" || t.table.main.aParler !== "hero") return null;
    if (t.heroDepuis === null) return this.options.secondesAction;
    return Math.max(0, this.options.secondesAction - (maintenant - t.heroDepuis) / 1000);
  }

  get netEuro() {
    return this.stats.gagne - this.stats.investi;
  }
}
