import { useEffect, useRef, useState } from "react";

/**
 * Largeur réelle (en px) d'un élément, suivie par ResizeObserver, pour que les
 * SVG gardent des textes lisibles quelle que soit la largeur de la tuile.
 * Retourne [ref, largeur] ; largeur vaut 0 tant que rien n'est mesuré.
 */
export function useLargeur() {
  const ref = useRef(null);
  const [largeur, setLargeur] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const maj = () => setLargeur(Math.round(el.clientWidth));
    maj();
    const obs = new ResizeObserver(maj);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, largeur];
}
