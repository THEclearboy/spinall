// Dessine le « bilan en image » (1080 × 1440, affiche dans l'identité bento) sur un canvas :
// tout l'historique, sauf les heures et la bankroll qui portent sur les 3 derniers jours.
import { euros, pourcent, pluriel } from "./format.js";
import { formatHeures } from "./heures.js";

export const LARGEUR = 1080;
export const HAUTEUR = 1440;
/** Facteur de résolution du PNG exporté (2 → 2160 × 2880). */
export const ECHELLE = 2;

const C = {
  noir: "#000000",
  sombre: "#1c1c1c",
  sombre2: "#262626",
  blanc: "#ffffff",
  lime: "#d9ff5a",
  lime2: "#b8dc3e",
  lavande: "#aebbff",
  violet: "#46468c",
  orange: "#e8834a",
  vert: "#1d2a1c",
  jaune: "#f5e27a",
  muet: "#9a9a9a",
  texteSombre: "#111111",
  muetSombre: "#6b6b6b",
};
const POLICE = '"Manrope Variable", Manrope, "Helvetica Neue", Arial, sans-serif';
const signe = (v) => (v >= 0 ? "+" : "");
const unDecimal = (v) => v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const entier = (v) => Math.round(v).toLocaleString("fr-FR");

function arrondi(ctx, x, y, l, h, r, couleur) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + l, y, x + l, y + h, r);
  ctx.arcTo(x + l, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + l, y, r);
  ctx.closePath();
  ctx.fillStyle = couleur;
  ctx.fill();
}

function texte(ctx, t, x, y, { taille = 24, poids = 600, couleur = C.blanc, align = "left", espacement = 0, maj = false } = {}) {
  ctx.font = `${poids} ${taille}px ${POLICE}`;
  ctx.fillStyle = couleur;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${espacement}px`;
  ctx.fillText(maj ? String(t).toUpperCase() : String(t), x, y);
  const l = ctx.measureText(maj ? String(t).toUpperCase() : String(t)).width;
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  return l;
}

/** Texte dont la taille est réduite tant qu'il dépasse largeurMax. */
function texteAjuste(ctx, t, x, y, largeurMax, opts) {
  let taille = opts.taille;
  ctx.font = `${opts.poids || 600} ${taille}px ${POLICE}`;
  while (taille > 24 && ctx.measureText(String(t)).width > largeurMax) {
    taille -= 4;
    ctx.font = `${opts.poids || 600} ${taille}px ${POLICE}`;
  }
  return texte(ctx, t, x, y, { ...opts, taille });
}

function pilule(ctx, t, x, y, { fond = C.sombre, couleur = C.blanc, taille = 20, alignDroite = false } = {}) {
  ctx.font = `800 ${taille}px ${POLICE}`;
  const l = ctx.measureText(t).width + 30;
  const h = taille + 18;
  const x0 = alignDroite ? x - l : x;
  arrondi(ctx, x0, y, l, h, h / 2, fond);
  texte(ctx, t, x0 + l / 2, y + h / 2 + taille * 0.36, { taille, poids: 800, couleur, align: "center" });
  return l;
}

/** Petit libellé en capitales espacées (« PARTIES », « CEV / PARTIE »…). */
function libelle(ctx, t, x, y, couleur = C.muet, align = "left") {
  return texte(ctx, t, x, y, { taille: 19, poids: 800, couleur, espacement: 2.5, maj: true, align });
}

function ligne(ctx, x1, y1, x2, y2, couleur, epaisseur = 1) {
  ctx.save();
  ctx.strokeStyle = couleur;
  ctx.lineWidth = epaisseur;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

/**
 * Trace des séries dans le rectangle g = { x, y, l, h }.
 * series : [{ valeurs, couleur, aire?, pointille? }] ; clair : fond clair (grille sombre).
 */
function tracerSeries(ctx, series, g, clair, format = entier) {
  const tout = series.flatMap((s) => s.valeurs);
  const min = Math.min(0, ...tout);
  const max = Math.max(0, ...tout);
  const py = (v) => g.y + ((max - v) / (max - min || 1)) * g.h;
  // grille légère : haut, zéro, bas
  ctx.save();
  ctx.strokeStyle = clair ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  [g.y, g.y + g.h].forEach((yy) => {
    ctx.beginPath();
    ctx.moveTo(g.x, yy);
    ctx.lineTo(g.x + g.l, yy);
    ctx.stroke();
  });
  ctx.setLineDash([4, 6]);
  ctx.strokeStyle = clair ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(g.x, py(0));
  ctx.lineTo(g.x + g.l, py(0));
  ctx.stroke();
  ctx.restore();
  for (const s of series) {
    const px = (i) => g.x + (i / (s.valeurs.length - 1)) * g.l;
    ctx.save();
    if (s.aire) {
      const grad = ctx.createLinearGradient(0, g.y, 0, g.y + g.h);
      grad.addColorStop(0, s.aire);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.moveTo(px(0), py(s.valeurs[0]));
      for (let i = 1; i < s.valeurs.length; i++) ctx.lineTo(px(i), py(s.valeurs[i]));
      ctx.lineTo(px(s.valeurs.length - 1), g.y + g.h);
      ctx.lineTo(px(0), g.y + g.h);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }
    ctx.setLineDash(s.pointille ? [10, 8] : []);
    ctx.strokeStyle = s.couleur;
    ctx.lineWidth = s.pointille ? 4 : 5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(px(0), py(s.valeurs[0]));
    for (let i = 1; i < s.valeurs.length; i++) ctx.lineTo(px(i), py(s.valeurs[i]));
    ctx.stroke();
    // point final
    const nf = s.valeurs.length - 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(px(nf), py(s.valeurs[nf]), 7, 0, Math.PI * 2);
    ctx.fillStyle = s.couleur;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = clair ? C.blanc : C.sombre;
    ctx.stroke();
    ctx.restore();
  }
  // valeurs min / max à droite
  const gradCouleur = clair ? C.muetSombre : C.muet;
  texte(ctx, format(max), g.x + g.l + 12, g.y + 6, { taille: 15, poids: 700, couleur: gradCouleur });
  texte(ctx, format(min), g.x + g.l + 12, g.y + g.h + 6, { taille: 15, poids: 700, couleur: gradCouleur });
}

/** Légende horizontale alignée à droite ; renvoie la largeur consommée. */
function legende(ctx, items, xDroite, y, couleurTexte) {
  let lx = xDroite;
  for (let i = items.length - 1; i >= 0; i--) {
    const [nom, couleur] = items[i];
    ctx.font = `700 17px ${POLICE}`;
    const w = ctx.measureText(nom).width;
    lx -= w;
    texte(ctx, nom, lx, y, { taille: 17, poids: 700, couleur: couleurTexte });
    lx -= 34;
    arrondi(ctx, lx, y - 10, 26, 6, 3, couleur);
    lx -= 22;
  }
  return xDroite - lx;
}

/**
 * bilan : { titre, sousTitre, sousParties, parties, nbMains, joursJoues, cEV, reelParPartie, netEuro, investi,
 *   roi, places, victoires, tauxConformite, nbSpots, heures3: [{ libelle, heures }], pointsBankroll,
 *   pointsReel, pointsEv, limites: [{ limite, parties, cEV, netEuro }], calculEnCours, dateGeneration }
 */
export function dessinerBilan(ctx, b) {
  const M = 56; // marge
  const L = LARGEUR - 2 * M; // largeur utile
  ctx.fillStyle = C.noir;
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);

  // halo lime discret en haut à droite
  const halo = ctx.createRadialGradient(LARGEUR - 120, -40, 0, LARGEUR - 120, -40, 520);
  halo.addColorStop(0, "rgba(217,255,90,0.16)");
  halo.addColorStop(1, "rgba(217,255,90,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, LARGEUR, 600);

  // ---- en-tête
  arrondi(ctx, M, 62, 14, 14, 7, C.lime);
  texte(ctx, "Expresso Trainer", M + 26, 76, { taille: 20, poids: 800, couleur: C.lime, espacement: 3, maj: true });
  pilule(ctx, b.sousTitre, LARGEUR - M, 54, { fond: C.sombre2, couleur: C.blanc, taille: 17, alignDroite: true });
  texte(ctx, b.titre, M, 146, { taille: 56, poids: 800, couleur: C.blanc });
  ligne(ctx, M, 190, LARGEUR - M, 190, "rgba(255,255,255,0.12)");

  // ---- héros : parties (lime) et cEV (blanc), côte à côte sur fond noir
  let y = 236;
  const xMilieu = M + L / 2;
  libelle(ctx, "Parties", M, y);
  texteAjuste(ctx, b.parties, M - 6, y + 176, L / 2 - 50, { taille: 190, poids: 800, couleur: C.lime });
  texte(ctx, `${b.sousParties} · ${pluriel("main", b.nbMains)} · ${pluriel("jour de jeu", b.joursJoues)}`, M, y + 220, { taille: 19, poids: 600, couleur: C.muet });

  ligne(ctx, xMilieu, y - 8, xMilieu, y + 228, "rgba(255,255,255,0.12)");

  const xC = xMilieu + 40;
  libelle(ctx, "cEV / partie", xC, y);
  if (b.cEV === null) {
    texte(ctx, b.calculEnCours ? "calcul…" : "—", xC - 4, y + 176, { taille: 96, poids: 800, couleur: C.muet });
    texte(ctx, b.calculEnCours ? "l'équité est encore en cours de calcul" : "aucune partie", xC, y + 220, { taille: 19, poids: 600, couleur: C.muet });
  } else {
    texteAjuste(ctx, `${signe(b.cEV)}${unDecimal(b.cEV)}`, xC - 6, y + 176, LARGEUR - M - xC + 10, { taille: 190, poids: 800, couleur: C.blanc });
    texte(ctx, `jetons / partie, chance neutralisée · réel ${signe(b.reelParPartie)}${unDecimal(b.reelParPartie)}`, xC, y + 220, { taille: 19, poids: 600, couleur: C.muet });
  }
  y += 262;
  ligne(ctx, M, y, LARGEUR - M, y, "rgba(255,255,255,0.12)");

  // ---- bande : gain net (grand) + tableau par limite (carte sombre)
  y += 44;
  const positif = b.netEuro >= 0;
  libelle(ctx, "Gain net", M, y);
  texteAjuste(ctx, `${signe(b.netEuro)}${euros(b.netEuro)}`, M - 3, y + 104, L * 0.5 - 30, { taille: 96, poids: 800, couleur: positif ? C.lime : C.orange });
  if (b.roi !== null) {
    pilule(ctx, `ROI ${signe(b.roi)}${pourcent(b.roi)}`, M, y + 130, { fond: positif ? C.lime : C.orange, couleur: C.texteSombre, taille: 18 });
  }
  texte(ctx, `${euros(b.investi)} de buy-ins`, M + (b.roi !== null ? 160 : 0), y + 156, { taille: 19, poids: 600, couleur: C.muet });

  const xT = M + L * 0.5;
  const lT = L * 0.5;
  const hT = 196;
  arrondi(ctx, xT, y - 26, lT, hT, 28, C.sombre);
  libelle(ctx, "Par limite", xT + 28, y + 12);
  const cols = [xT + 28, xT + lT * 0.36, xT + lT * 0.6, xT + lT - 28];
  let yl = y + 46;
  ["Limite", "Parties", "cEV", "Gain"].forEach((t, i) => texte(ctx, t, cols[i], yl, { taille: 14, poids: 800, couleur: C.muet, espacement: 1, maj: true, align: i === 3 ? "right" : "left" }));
  yl += 34;
  const lignes = b.limites.slice(0, 3);
  lignes.forEach((l, i) => {
    const total = l.limite === null;
    if (i > 0) ligne(ctx, xT + 28, yl - 24, xT + lT - 28, yl - 24, "rgba(255,255,255,0.08)");
    texte(ctx, total ? "Toutes" : euros(l.limite), cols[0], yl, { taille: 21, poids: 800, couleur: total ? C.lime : C.blanc });
    texte(ctx, l.parties, cols[1], yl, { taille: 21, poids: 700, couleur: C.blanc });
    texte(ctx, l.cEV === null ? "…" : `${signe(l.cEV)}${unDecimal(l.cEV)}`, cols[2], yl, { taille: 21, poids: 800, couleur: l.cEV === null ? C.muet : C.blanc });
    texte(ctx, `${signe(l.netEuro)}${euros(l.netEuro)}`, cols[3], yl, { taille: 21, poids: 800, couleur: l.netEuro >= 0 ? C.lime : C.orange, align: "right" });
    yl += 40;
  });
  if (!lignes.length) texte(ctx, "aucune partie", xT + 28, yl, { taille: 19, poids: 600, couleur: C.muet });
  y += hT + 4;

  // ---- carte blanche : réel vs attendu
  const hR = 318;
  arrondi(ctx, M, y, L, hR, 32, C.blanc);
  libelle(ctx, "Réel vs attendu", M + 30, y + 44, C.muetSombre);
  texte(ctx, "jetons gagnés main après main — l'écart, c'est la variance", M + 30, y + 72, { taille: 18, poids: 600, couleur: C.muetSombre });
  legende(ctx, [["Réel", C.lime2], ["Attendu (EV)", C.orange]], LARGEUR - M - 30, y + 46, C.muetSombre);
  if (b.pointsReel.length >= 2) {
    tracerSeries(
      ctx,
      [
        { valeurs: b.pointsReel, couleur: C.lime2, aire: "rgba(197, 234, 58, 0.4)" },
        { valeurs: b.pointsEv, couleur: C.orange, pointille: true },
      ],
      { x: M + 30, y: y + 100, l: L - 60 - 70, h: hR - 100 - 62 },
      true,
    );
    const dr = b.pointsReel[b.pointsReel.length - 1];
    const de = b.pointsEv[b.pointsEv.length - 1];
    texte(ctx, `réel ${signe(dr)}${entier(dr)} jetons`, M + 30, y + hR - 24, { taille: 19, poids: 800, couleur: C.texteSombre });
    texte(ctx, `attendu ${signe(de)}${entier(de)} jetons`, M + 30 + 220, y + hR - 24, { taille: 19, poids: 800, couleur: C.orange });
    const ecart = dr - de;
    texte(ctx, `${ecart >= 0 ? "chance" : "malchance"} ${signe(ecart)}${entier(ecart)}`, LARGEUR - M - 30, y + hR - 24, { taille: 19, poids: 700, couleur: C.muetSombre, align: "right" });
  } else {
    texte(ctx, b.calculEnCours ? "Calcul de l'équité en cours…" : "Pas assez de parties.", M + 30, y + hR / 2 + 30, { taille: 24, poids: 700, couleur: C.muetSombre });
  }
  y += hR + 20;

  // ---- bas : bankroll (carte sombre, 7/12) + heures 3 derniers jours (carte lavande, 5/12)
  const G = 20;
  const hB = HAUTEUR - y - 76;
  const lB = (L - G) * (7 / 12);
  arrondi(ctx, M, y, lB, hB, 32, C.sombre);
  libelle(ctx, "Bankroll", M + 30, y + 44);
  texte(ctx, "les 3 derniers jours, partie après partie", M + 30, y + 72, { taille: 18, poids: 600, couleur: C.muet });
  if (b.pointsBankroll.length >= 2) {
    tracerSeries(ctx, [{ valeurs: b.pointsBankroll, couleur: C.lime, aire: "rgba(217,255,90,0.35)" }], { x: M + 30, y: y + 104, l: lB - 60 - 76, h: hB - 104 - 70 }, false, (v) => `${entier(v)} €`);
    texte(ctx, `${signe(b.netEuro3)}${euros(b.netEuro3)}`, M + 30, y + hB - 26, { taille: 30, poids: 800, couleur: b.netEuro3 >= 0 ? C.lime : C.orange });
    texte(ctx, `sur ${pluriel("partie", b.parties3)}`, M + 30 + 14 + ctx.measureText(`${signe(b.netEuro3)}${euros(b.netEuro3)}`).width, y + hB - 26, { taille: 18, poids: 600, couleur: C.muet });
  } else {
    texte(ctx, "Pas assez de parties sur 3 jours.", M + 30, y + hB / 2 + 20, { taille: 22, poids: 700, couleur: C.muet });
  }

  const xH = M + lB + G;
  const lH = L - lB - G;
  arrondi(ctx, xH, y, lH, hB, 32, C.lavande);
  libelle(ctx, "Heures jouées", xH + 30, y + 44, "#4b4f8f");
  texte(ctx, "les 3 derniers jours", xH + 30, y + 72, { taille: 18, poids: 600, couleur: "#4b4f8f" });
  const totalH = b.heures3.reduce((s, j) => s + j.heures, 0);
  texte(ctx, formatHeures(totalH), xH + lH - 30, y + 58, { taille: 34, poids: 800, couleur: "#14143a", align: "right" });
  // barres verticales : hauteur proportionnelle au jour le plus long, valeur au-dessus
  const zone = { x: xH + 30, y: y + 112, l: lH - 60, h: hB - 112 - 60 };
  const maxH = Math.max(1 / 60, ...b.heures3.map((j) => j.heures));
  const lCol = zone.l / 3;
  const lBarre = Math.min(96, lCol * 0.62);
  const hEtiquette = 34; // place réservée à la valeur au-dessus de la barre
  const socle = zone.y + zone.h; // bas des barres
  ligne(ctx, zone.x, socle + 0.5, zone.x + zone.l, socle + 0.5, "rgba(20,20,58,0.25)");
  b.heures3.forEach((j, i) => {
    const cx = zone.x + i * lCol + lCol / 2;
    const hb = j.heures > 0 ? Math.max(14, (j.heures / maxH) * (zone.h - hEtiquette)) : 6;
    const yb = socle - hb;
    arrondi(ctx, cx - lBarre / 2, yb, lBarre, hb, Math.min(14, hb / 2), j.heures > 0 ? (i === 2 ? "#14143a" : C.violet) : "rgba(20,20,58,0.2)");
    texte(ctx, j.heures ? formatHeures(j.heures) : "0", cx, yb - 12, { taille: 19, poids: 800, couleur: "#14143a", align: "center" });
    texte(ctx, j.libelle, cx, y + hB - 26, { taille: 15, poids: 800, couleur: "#4b4f8f", align: "center", espacement: 1, maj: true });
  });

  // ---- pied
  texte(ctx, "theclearboy.github.io/spinall", LARGEUR - M, HAUTEUR - 30, { taille: 16, poids: 700, couleur: C.muet, align: "right" });
  texte(ctx, b.dateGeneration, M, HAUTEUR - 30, { taille: 16, poids: 700, couleur: C.muet });
}
