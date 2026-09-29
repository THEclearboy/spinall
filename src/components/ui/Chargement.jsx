/**
 * Indicateurs de chargement dans l'identité de l'app.
 * - <Chargement avancement={0.42} texte="…" /> : barre lime animée avec pourcentage.
 * - <Tourne /> : petit anneau tournant, à placer dans une cellule ou une ligne.
 */
export function Chargement({ avancement = 0, texte = "Calcul en cours…", compact = false }) {
  const pct = Math.max(0, Math.min(100, Math.round(avancement * 100)));
  return (
    <div className={`chargement${compact ? " compact" : ""}`} role="status" aria-live="polite">
      <div className="chargement-entete">
        <span className="chargement-texte">
          <Tourne /> {texte}
        </span>
        <span className="chargement-pct">{pct} %</span>
      </div>
      <div className="chargement-barre">
        <div className="chargement-remplissage" style={{ width: `${Math.max(4, pct)}%` }} />
      </div>
    </div>
  );
}

export function Tourne({ classe = "" }) {
  return <span className={`tourne ${classe}`.trim()} aria-hidden="true" />;
}
