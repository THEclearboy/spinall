/**
 * Tuile du tableau de bord (style « bento »).
 * variante : blanc | lime | lavande | orange | jaune | vert | sombre
 * span : largeur en colonnes (sur 12) ; titre en capitales, sous-titre discret,
 * valeur en gros à droite, action (pilule) en haut à droite.
 */
export function Tuile({ variante = "sombre", span = 3, titre, sous, valeur, action, classe = "", children, onClick, style }) {
  return (
    <section
      className={`tuile tuile--${variante} s${span} ${classe}`.trim()}
      onClick={onClick}
      style={style}
    >
      {(titre || valeur || action) && (
        <header className="tuile-entete">
          <div className="tuile-titres">
            {titre && <h3 className="tuile-titre">{titre}</h3>}
            {sous && <p className="tuile-sous">{sous}</p>}
          </div>
          {valeur !== undefined && valeur !== null && <div className="tuile-valeur">{valeur}</div>}
          {action && <div className="tuile-action">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/** Petite pilule (« See All », « This Week », « +0,12 »). */
export function Pilule({ variante = "sombre", children, onClick, titre, classe = "" }) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag className={`pilule pilule--${variante} ${classe}`.trim()} onClick={onClick} title={titre} type={onClick ? "button" : undefined}>
      {children}
    </Tag>
  );
}

/** Grille « bento » : 12 colonnes. */
export function Bento({ children, classe = "" }) {
  return <div className={`bento ${classe}`.trim()}>{children}</div>;
}
