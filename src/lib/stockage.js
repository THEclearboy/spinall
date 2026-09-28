// Persistance : localStorage pour les petits objets (préfixe "expresso."),
// IndexedDB (base "expresso-trainer") pour la base de mains importées,
// avec repli sur localStorage si IndexedDB est indisponible.

const PREFIXE = "expresso.";
const NOM_BASE = "expresso-trainer";
const MAGASIN = "donnees";

export function lireLocal(cle, defaut) {
  try {
    const brut = localStorage.getItem(PREFIXE + cle);
    return brut === null ? defaut : JSON.parse(brut);
  } catch {
    return defaut;
  }
}

export function ecrireLocal(cle, valeur) {
  try {
    localStorage.setItem(PREFIXE + cle, JSON.stringify(valeur));
    return true;
  } catch {
    return false;
  }
}

export function supprimerLocal(cle) {
  try {
    localStorage.removeItem(PREFIXE + cle);
  } catch {}
}

function ouvrirBase() {
  return new Promise((resolve, reject) => {
    const requete = indexedDB.open(NOM_BASE, 1);
    requete.onupgradeneeded = () => requete.result.createObjectStore(MAGASIN);
    requete.onsuccess = () => resolve(requete.result);
    requete.onerror = () => reject(requete.error);
  });
}

export async function lireBase(cle) {
  try {
    const db = await ouvrirBase();
    return await new Promise((resolve, reject) => {
      const requete = db.transaction(MAGASIN, "readonly").objectStore(MAGASIN).get(cle);
      requete.onsuccess = () => resolve(requete.result === undefined ? null : requete.result);
      requete.onerror = () => reject(requete.error);
    });
  } catch {
    return lireLocal(cle, null);
  }
}

export async function ecrireBase(cle, valeur) {
  try {
    const db = await ouvrirBase();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(MAGASIN, "readwrite");
      transaction.objectStore(MAGASIN).put(valeur, cle);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    return true;
  } catch {
    return ecrireLocal(cle, valeur);
  }
}

/**
 * Télécharge un objet en JSON. Dans un artifact Claude, passe par la
 * capacité "downloads" ; sinon, lien <a download> classique.
 */
export async function telechargerJson(objet, nomFichier) {
  const texte = JSON.stringify(objet, null, 2);
  if (typeof window.claude?.use === "function") {
    try {
      const downloads = await window.claude.use("downloads");
      if (downloads) {
        await downloads.save({ filename: nomFichier, data: texte }).catch(() => {});
        return;
      }
    } catch {}
  }
  const blob = new Blob([texte], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  URL.revokeObjectURL(url);
}

export function lireFichierJson(fichier) {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => {
      try {
        resolve(JSON.parse(lecteur.result));
      } catch (erreur) {
        reject(erreur);
      }
    };
    lecteur.onerror = () => reject(lecteur.error);
    lecteur.readAsText(fichier);
  });
}
