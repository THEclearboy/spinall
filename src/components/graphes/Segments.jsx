/**
 * Barre segmentée (style « Performance +58k ») : des blocs arrondis dont la largeur
 * est proportionnelle à la valeur. Les blocs remplissent la hauteur disponible de la
 * tuile ; chaque bloc porte son libellé en haut et sa valeur en bas.
 * parts : [{ label, valeur, couleur, texte }].
 */
export function Segments({ parts, hauteur = 64 }) {
  const total = parts.reduce((s, p) => s + p.valeur, 0);
  if (total === 0) return <div className="segments vide" style={{ minHeight: hauteur }} />;
  return (
    <div className="segments" style={{ minHeight: hauteur }}>
      {parts.map((p, i) =>
        p.valeur > 0 ? (
          <div
            key={i}
            className="segment-bloc"
            style={{ flexGrow: p.valeur, background: p.couleur, color: p.texte || "var(--blanc)" }}
            title={`${p.label} : ${p.valeur} (${Math.round((p.valeur / total) * 100)} %)`}
          >
            <span className="segment-cle">{p.label}</span>
            <span className="segment-libelle">{p.valeur}</span>
          </div>
        ) : null,
      )}
    </div>
  );
}
