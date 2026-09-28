// Formatage des nombres, dates et textes (français).

/** "12,5 bb" (entraînement). */
export const formatBb = (valeur) => `${valeur.toLocaleString("fr-FR")} bb`;

/** "12,5 bb" avec au plus une décimale (analyse). */
export const formatBbArrondi = (valeur) =>
  `${valeur.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} bb`;

export const formatNombre = (valeur) => valeur.toLocaleString("fr-FR");

export const euros = (valeur) =>
  valeur.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

/** Taux 0-1 → "45,3 %" ; null → "—". */
export const pourcent = (taux) =>
  taux === null ? "—" : `${(100 * taux).toFixed(1).replace(".", ",")} %`;

export const dateHeure = (horodatage) =>
  new Date(horodatage).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

export const ordinal = (place) => (place === 1 ? "1ᵉʳ" : `${place}ᵉ`);

const MOTS_INVARIABLES = new Set(["déjà", "à", "en", "de", "non", "hors"]);

/** pluriel("main ajoutée", 3) → "3 mains ajoutées". */
export const pluriel = (texte, nombre) =>
  `${nombre} ${
    nombre > 1
      ? texte.replace(/(\S+)/g, (mot) =>
          MOTS_INVARIABLES.has(mot) || mot.endsWith("s") ? mot : mot + "s",
        )
      : texte
  }`;
