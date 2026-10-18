// Dossier des historiques surveillé par le HUD (API File System Access :
// Chrome et Edge sur ordinateur). Choix du dossier, permission, listage des
// fichiers texte et détection des parties nouvellement écrites par le client.
import { idsPartiesDuTexte } from "./session.js";

const PROFONDEUR_MAX = 3;
const MAX_FICHIERS = 20_000;
/** Un fichier modifié il y a moins longtemps que ça peut encore recevoir des mains. */
const RECENT_MS = 48 * 3_600_000;

export const dossierDisponible = () =>
  typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";

export function choisirDossier() {
  return window.showDirectoryPicker({ id: "historiques-betclic", mode: "read" });
}

/** "granted" | "prompt" | "denied". demander = true relance la demande (il faut un clic). */
export async function permissionDossier(handle, demander = false) {
  try {
    const options = { mode: "read" };
    let etat = await handle.queryPermission(options);
    if (etat === "prompt" && demander) etat = await handle.requestPermission(options);
    return etat;
  } catch {
    return "denied";
  }
}

/** Liste récursive des fichiers texte du dossier : [{ chemin, handle }]. */
export async function listerFichiers(dossier, chemin = "", profondeur = 0, resultat = []) {
  if (profondeur > PROFONDEUR_MAX || resultat.length >= MAX_FICHIERS) return resultat;
  for await (const [nom, entree] of dossier.entries()) {
    if (nom.startsWith(".")) continue;
    const cheminEntree = chemin ? `${chemin}/${nom}` : nom;
    if (entree.kind === "directory") await listerFichiers(entree, cheminEntree, profondeur + 1, resultat);
    else if (/\.(txt|log|hh)$/i.test(nom) || !nom.includes(".")) resultat.push({ chemin: cheminEntree, handle: entree });
    if (resultat.length >= MAX_FICHIERS) break;
  }
  return resultat;
}

/** État d'une surveillance : fichiers vus et parties déjà connues (jamais comptées). */
export function creerSurveillance(dossier) {
  return { dossier, fichiers: new Map(), connus: new Set(), initialisee: false };
}

/**
 * Un passage sur le dossier.
 * - Premier passage : mémorise tous les fichiers et les parties des fichiers
 *   récents, qui ne seront pas comptées (elles datent d'avant le HUD).
 * - Passages suivants : relit les fichiers nouveaux ou modifiés et renvoie
 *   les ids de parties jamais vus. Les vieux fichiers ne sont plus relus.
 */
export async function scanner(surv, maintenant = Date.now()) {
  const liste = await listerFichiers(surv.dossier);
  const nouvelles = [];
  for (const { chemin, handle } of liste) {
    const precedent = surv.fichiers.get(chemin);
    if (surv.initialisee && precedent && !precedent.suivi) continue;
    const fichier = await handle.getFile();
    const etat = {
      mtime: fichier.lastModified,
      taille: fichier.size,
      suivi: maintenant - fichier.lastModified < RECENT_MS,
    };
    if (!surv.initialisee) {
      surv.fichiers.set(chemin, etat);
      if (etat.suivi) for (const id of idsPartiesDuTexte(await fichier.text())) surv.connus.add(id);
      continue;
    }
    const change = !precedent || precedent.mtime !== etat.mtime || precedent.taille !== etat.taille;
    surv.fichiers.set(chemin, { ...etat, suivi: true });
    if (!change) continue;
    for (const id of idsPartiesDuTexte(await fichier.text()))
      if (!surv.connus.has(id)) {
        surv.connus.add(id);
        nouvelles.push(id);
      }
  }
  surv.initialisee = true;
  let nbSuivis = 0;
  for (const f of surv.fichiers.values()) if (f.suivi) nbSuivis += 1;
  return { nouvelles, nbFichiers: liste.length, nbSuivis };
}
