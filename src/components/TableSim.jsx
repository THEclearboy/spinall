import { useEffect, useMemo, useState } from "react";
import { SYMBOLES } from "../lib/cartes.js";
import { actionsLegales, niveauCourant } from "../lib/simulateur/moteur.js";
import { texteAction, derniereAction, relanceParDefaut, presetsRelance, texteResultat, nomCategorie, mmss } from "../lib/simulateur/ui.js";
import { euros, formatNombre } from "../lib/format.js";
import { useLargeur } from "./graphes/useLargeur.js";

export const LARGEUR_FENETRE = 640;
export const HAUTEUR_FENETRE = 430;

function Carte({ carte, taille = "" }) {
  if (!carte) return <div className={`sim-carte dos ${taille}`} />;
  return (
    <div className={`sim-carte couleur-${carte.couleur} ${taille}`}>
      <span className="rang">{carte.rang === "T" ? "10" : carte.rang}</span>
      <span className="symbole">{SYMBOLES[carte.couleur]}</span>
    </div>
  );
}

// Scène de 640 × 330 : le héros est ancré par le bas (top = bord inférieur de son étiquette).
const POSITIONS = {
  hero: { left: 320, top: 322 },
  haut: { left: 320, top: 40 },
  gauche: { left: 128, top: 66 },
  droite: { left: 512, top: 66 },
};
const MISES = {
  hero: { left: 320, top: 203 },
  haut: { left: 320, top: 88 },
  gauche: { left: 200, top: 114 },
  droite: { left: 440, top: 114 },
};
const DEALER = {
  hero: { left: 404, top: 262 },
  haut: { left: 392, top: 78 },
  gauche: { left: 206, top: 150 },
  droite: { left: 434, top: 150 },
};

/** Place chaque joueur vivant : héros en bas, un adversaire en haut (HU) ou deux (3 joueurs). */
function disposition(table) {
  const vivants = table.joueurs.filter((j) => !j.elimine || (table.main && table.main.stacksDebut[j.id] !== undefined));
  const hero = vivants.find((j) => j.hero);
  const autres = vivants.filter((j) => !j.hero);
  const places = {};
  if (hero) places[hero.id] = "hero";
  if (autres.length === 1) places[autres[0].id] = "haut";
  else autres.forEach((j, i) => (places[j.id] = i === 0 ? "gauche" : "droite"));
  return places;
}

function Pod({ joueur, position, main, table, hero, parle, progression, revelee, maintenant }) {
  const couche = main && main.couches.has(joueur.id);
  const cartes = main ? main.cartes[joueur.id] : null;
  const action = main ? derniereAction(main, joueur.id) : null;
  const montreAction = action && action.verbe !== "post_sb" && action.verbe !== "post_bb";
  const enMain = main && main.rue !== "fin" && cartes && !couche;
  const finie = main && main.rue === "fin";
  const gain = finie && main.resultat?.gains[joueur.id];
  const force = finie && main.resultat?.abattage && main.resultat.forces[joueur.id] !== undefined ? nomCategorie(main.resultat.forces[joueur.id]) : null;
  const style = { left: POSITIONS[position].left, top: POSITIONS[position].top };
  const classes = ["sim-pod", `pos-${position}`];
  if (hero) classes.push("hero");
  if (couche) classes.push("couche");
  if (parle) classes.push("parle");
  if (joueur.elimine) classes.push("elimine");
  if (gain) classes.push("gagnant");
  return (
    <div className={classes.join(" ")} style={style}>
      {hero && cartes && !joueur.elimine && (
        <div className={`sim-main-hero${couche ? " couchee" : ""}`}>
          <Carte carte={cartes[0]} taille="grande" />
          <Carte carte={cartes[1]} taille="grande" />
        </div>
      )}
      {!hero && (enMain || revelee) && (
        <div className="sim-main-vilain">
          {revelee ? (
            <>
              <Carte carte={cartes[0]} taille="petite" />
              <Carte carte={cartes[1]} taille="petite" />
            </>
          ) : (
            <>
              <Carte taille="petite" />
              <Carte taille="petite" />
            </>
          )}
        </div>
      )}
      <div className="sim-etiquette" style={parle && progression !== null ? { "--p": `${Math.round(progression * 100)}%` } : undefined}>
        <div className="sim-avatar">{joueur.nom.slice(0, 1).toUpperCase()}</div>
        <div className="sim-identite">
          <div className="sim-nom">{joueur.nom}</div>
          <div className="sim-stack">
            {joueur.elimine ? `Éliminé (${joueur.place}ᵉ)` : couche ? "Couché" : formatNombre(joueur.stack)}
            {!joueur.elimine && !couche && main && <span className="sim-bb"> · {(joueur.stack / main.bb).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} bb</span>}
          </div>
        </div>
      </div>
      {montreAction && !finie && <div className={`sim-action-pod verbe-${action.verbe}${action.allin ? " allin" : ""}`}>{texteAction(action)}</div>}
      {gain > 0 && <div className="sim-gain">+{formatNombre(gain)}{force ? ` · ${force}` : ""}</div>}
      {finie && !gain && force && <div className="sim-force">{force}</div>}
    </div>
  );
}

/**
 * Une table du simulateur, dessinée à taille fixe (640 × 430) puis mise à l'échelle de sa colonne.
 * t : emplacement de la Simulation ({ table, … }), maintenant : horloge de la simulation.
 */
export function TableSim({ t, sim, maintenant, agir, focalisee, surFocus, preaction, setPreaction }) {
  const [ref, largeur] = useLargeur();
  const echelle = largeur ? Math.min(1, largeur / LARGEUR_FENETRE) : 1;
  const table = t.table;
  const main = table.main;
  const legal = main && main.rue !== "fin" && main.aParler === "hero" ? actionsLegales(table) : null;
  const niveau = niveauCourant(table, maintenant);
  const places = useMemo(() => disposition(table), [table, table.joueurs.map((j) => j.elimine).join()]);
  const restant = sim.tempsRestant(t, maintenant);
  const progression = legal ? restant / sim.options.secondesAction : null;
  const cle = main ? `${table.id}-${main.numero}-${main.rue}-${main.actions.length}` : "";
  const [relance, setRelance] = useState(0);
  useEffect(() => {
    if (legal) setRelance(relanceParDefaut(main, legal));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);
  // pré-action « parole / se coucher » : exécutée dès que c'est à nous
  useEffect(() => {
    if (legal && preaction === "checkfold") {
      setPreaction(null);
      agir(table.id, { verbe: legal.peutCheck ? "check" : "fold" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, preaction]);

  const nomDe = (id) => table.joueurs.find((j) => j.id === id)?.nom || id;
  // comme sur Betclic : au centre le pot déjà ramassé, les mises de la rue restent devant les joueurs
  const potCentral = main ? (main.rue === "fin" ? main.pot : main.pot - Object.values(main.mises).reduce((a, b) => a + b, 0)) : 0;
  const message = t.dernierMessage && maintenant - t.dernierMessage.temps < 4200 ? t.dernierMessage : null;
  const presets = legal ? presetsRelance(main, legal) : [];
  const urgence = legal && restant <= 3;
  const classes = ["sim-cadre"];
  if (legal) classes.push("a-toi");
  if (focalisee) classes.push("focalisee");
  if (urgence) classes.push("urgence");
  if (t.finie) classes.push("terminee");

  return (
    <div className={classes.join(" ")} ref={ref} style={{ height: HAUTEUR_FENETRE * echelle }} onMouseDown={() => surFocus(table.id)}>
      <div className="sim-fenetre" style={{ transform: `scale(${echelle})` }}>
        <header className="sim-entete">
          <div className="sim-titre">
            <span className="sim-logo">b</span>
            Spin &amp; Rush - {euros(table.buyIn)} <span className="sim-numero">· {table.id} · main {table.numeroMain}</span>
          </div>
          <div className="sim-niveau">
            Blinds {formatNombre(niveau.sb)} / {formatNombre(niveau.bb)}
            <span className="sim-suivant">niveau suivant dans {mmss(niveau.restantMs)}</span>
          </div>
          <div className="sim-prix">
            <span className="sim-multi">×{table.multiplicateur}</span>
            {euros(table.prix)}
          </div>
        </header>

        <div className="sim-scene">
          <div className="sim-rail" />
          <div className="sim-tapis">
            <span className="sim-filigrane">Spin &amp; Rush</span>
          </div>

          {main && (
            <div className="sim-centre">
              <div className="sim-pot">
                Pot <strong>{formatNombre(potCentral)}</strong>
                {potCentral !== main.pot && <em>total {formatNombre(main.pot)}</em>}
              </div>
              {main.board.length > 0 && (
                <div className="sim-board">
                  {main.board.map((c, i) => (
                    <Carte key={i} carte={c} taille="board" />
                  ))}
                </div>
              )}
            </div>
          )}

          {main &&
            Object.entries(places).map(([id, pos]) => {
              const mise = main.rue !== "fin" ? main.mises[id] || 0 : 0;
              if (!mise) return null;
              return (
                <div key={id} className="sim-mise" style={{ left: MISES[pos].left, top: MISES[pos].top }}>
                  <span className="sim-jeton" />
                  {formatNombre(mise)}
                </div>
              );
            })}
          {main && places[main.bouton] && (
            <div className="sim-dealer" style={{ left: DEALER[places[main.bouton]].left, top: DEALER[places[main.bouton]].top }}>
              D
            </div>
          )}

          {table.joueurs.map((j) => {
            const pos = places[j.id];
            if (!pos) return null;
            return (
              <Pod
                key={j.id}
                joueur={j}
                position={pos}
                main={main}
                table={table}
                hero={j.hero}
                parle={!!main && main.rue !== "fin" && main.aParler === j.id}
                progression={j.hero ? progression : null}
                revelee={!!main && !!main.revelees[j.id]}
                maintenant={maintenant}
              />
            );
          })}

          {main && main.rue === "fin" && !t.finie && (
            <div className="sim-resultat">{texteResultat(table, main, nomDe)}</div>
          )}

          {t.finie && (
            <div className="sim-fin-partie">
              <strong>{t.resultatHero?.place === 1 ? `Gagné ! ${euros(table.prix)}` : `Partie terminée · ${t.resultatHero?.place}ᵉ place`}</strong>
              <span>Nouvelle partie dans {t.prochaineTable ? mmss(t.prochaineTable - maintenant) : "…"}</span>
            </div>
          )}

          {message && (
            <div className={`sim-bandeau type-${message.type}`}>
              <strong>
                {message.type === "erreur" && "Erreur de range"}
                {message.type === "ok" && "Range respectée"}
                {message.type === "cbet-manque" && "C-bet manqué"}
                {message.type === "cbet-ok" && "C-bet"}
                {message.type === "temps" && "Temps écoulé"}
                {message.type === "info" && "Partie"}
              </strong>
              {message.texte}
            </div>
          )}
        </div>

        <div className="sim-actions">
          {legal ? (
            <>
              <div className="sim-temps">
                <div className="sim-temps-barre" style={{ width: `${Math.round((progression || 0) * 100)}%` }} />
                <span>{Math.ceil(restant)} s</span>
              </div>
              <div className="sim-relance">
                {legal.peutRelancer && (
                  <>
                    <div className="sim-presets">
                      {presets.map((p) => (
                        <button key={p.nom} type="button" className={p.montant === relance ? "actif" : ""} onClick={() => setRelance(p.montant)}>
                          {p.nom}
                        </button>
                      ))}
                    </div>
                    <input
                      type="range"
                      min={legal.relanceMin}
                      max={legal.relanceMax}
                      step={main.sb}
                      value={relance}
                      onChange={(e) => setRelance(Number(e.target.value))}
                      aria-label="Montant de la relance"
                    />
                  </>
                )}
              </div>
              <div className="sim-boutons">
                <button type="button" className="sim-bouton fold" onClick={() => agir(table.id, { verbe: legal.peutCheck ? "check" : "fold" })}>
                  {legal.peutCheck ? "Parole" : "Se coucher"}
                  <small>F</small>
                </button>
                {!legal.peutCheck && (
                  <button type="button" className="sim-bouton call" onClick={() => agir(table.id, { verbe: "call" })}>
                    {legal.callAllin ? "Tapis" : "Suivre"}
                    <span>{formatNombre(legal.montantCall)}</span>
                    <small>C</small>
                  </button>
                )}
                {legal.peutCheck && legal.peutRelancer && (
                  <button type="button" className="sim-bouton call" onClick={() => agir(table.id, { verbe: "check" })}>
                    Parole
                    <small>C</small>
                  </button>
                )}
                {legal.peutRelancer && (
                  <button
                    type="button"
                    className={`sim-bouton raise${relance >= legal.relanceMax ? " allin" : ""}`}
                    onClick={() => agir(table.id, relance >= legal.relanceMax ? { verbe: "allin" } : { verbe: "raise", montant: relance })}
                  >
                    {relance >= legal.relanceMax ? "Tapis" : legal.miseCourante > 0 && !legal.peutCheck ? "Relancer" : "Miser"}
                    <span>{formatNombre(relance)}</span>
                    <small>R</small>
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="sim-attente">
              {main && main.rue !== "fin" && !t.finie ? (
                <>
                  <span>{main.aParler ? `${nomDe(main.aParler)} réfléchit…` : "…"}</span>
                  {!main.couches.has("hero") && !main.allin.has("hero") && (
                    <label className="sim-preaction">
                      <input type="checkbox" checked={preaction === "checkfold"} onChange={(e) => setPreaction(e.target.checked ? "checkfold" : null)} />
                      Parole / Se coucher
                    </label>
                  )}
                </>
              ) : (
                <span>{t.finie ? "Partie terminée" : "Prochaine main…"}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
