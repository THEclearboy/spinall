/**
 * Barre segmentée (style « Performance +58k ») : des blocs arrondis dont la largeur
 * est proportionnelle à la valeur. parts : [{ label, valeur, couleur }].
 */
export function Segments({ parts, hauteur = 64 }) {
  const total = parts.reduce((s, p) => s + p.valeur, 0);
  if (total === 0) return <div className="segments vide" style={{ height: hauteur }} />;
  return (
    <div className="segments" style={{ height: hauteur }}>
      {parts.map((p, i) =>
        p.valeur > 0 ? (
          <div
            key={i}
            className="segment-bloc"
            style={{ flexGrow: p.valeur, background: p.couleur }}
            title={`${p.label} : ${p.valeur}`}
          >
            <span className="segment-libelle">{p.valeur}</span>
          </div>
        ) : null,
      )}
    </div>
  );
}
