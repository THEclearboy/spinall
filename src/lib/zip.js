// Lecture des archives .zip exportées par le client Betclic (plusieurs journées).
import { unzipSync, strFromU8 } from "fflate";

/** Retire l'éventuel BOM UTF-8 en tête de fichier. */
export function sansBom(texte) {
  return texte.charCodeAt(0) === 0xfeff ? texte.slice(1) : texte;
}

/** Extrait tous les .txt d'une archive : [{ nom, texte }]. */
export function lireZip(nomArchive, octets) {
  const fichiers = unzipSync(octets, {
    filter: (f) => f.name.toLowerCase().endsWith(".txt"),
  });
  return Object.entries(fichiers).map(([chemin, contenu]) => ({
    nom: `${nomArchive} → ${chemin.split("/").pop()}`,
    texte: sansBom(strFromU8(contenu)),
  }));
}
