// Petits sons de feedback synthétisés (Web Audio, aucun fichier).

let contexte = null;

function contexteAudio() {
  if (!contexte) contexte = new (window.AudioContext || window.webkitAudioContext)();
  return contexte;
}

function bip(frequence, delai, duree, forme = "sine", volume = 0.12) {
  const ctx = contexteAudio();
  const oscillateur = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillateur.type = forme;
  oscillateur.frequency.value = frequence;
  gain.gain.setValueAtTime(volume, ctx.currentTime + delai);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delai + duree);
  oscillateur.connect(gain);
  gain.connect(ctx.destination);
  oscillateur.start(ctx.currentTime + delai);
  oscillateur.stop(ctx.currentTime + delai + duree);
}

export function sonBonneReponse(actif) {
  if (!actif) return;
  try {
    bip(660, 0, 0.09);
    bip(880, 0.09, 0.14);
  } catch {}
}

export function sonMauvaiseReponse(actif) {
  if (!actif) return;
  try {
    bip(180, 0, 0.22, "square", 0.08);
  } catch {}
}
