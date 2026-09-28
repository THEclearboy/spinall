/**
 * Liste « label ………… valeur » (style « Device type »).
 * lignes : [{ label, valeur, classe, couleur (pastille facultative) }].
 */
export function ListeValeurs({ lignes, classe = "" }) {
  return (
    <ul className={`liste-valeurs ${classe}`.trim()}>
      {lignes.map((l, i) => (
        <li key={l.cle ?? i} className={l.classe || ""}>
          <span className="lv-label">
            {l.couleur && <span className="lv-pastille" style={{ background: l.couleur }} />}
            {l.label}
          </span>
          <span className="lv-valeur">{l.valeur}</span>
        </li>
      ))}
    </ul>
  );
}
