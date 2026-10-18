// Session de jeu suivie par le HUD : chrono depuis le premier lancement de
// table, compteur de parties (à la main et/ou détectées dans le dossier des
// historiques), archive des sessions terminées. Fonctions pures.

export function nouvelleSession() {
  return { debut: null, parties: 0, partiesAuto: [] };
}

/** Démarre le chrono s'il ne tourne pas déjà. */
export function demarrer(session, maintenant = Date.now()) {
  return session.debut ? session : { ...session, debut: maintenant };
}

/** +1 (ou delta) partie comptée à la main ; démarre le chrono au besoin. */
export function ajouterPartie(session, delta = 1, maintenant = Date.now()) {
  const s = demarrer(session, maintenant);
  return { ...s, parties: Math.max(0, s.parties + delta) };
}

/** Ajoute les parties détectées (ids) pas encore comptées ; démarre le chrono au besoin. */
export function ajouterPartiesDetectees(session, ids, maintenant = Date.now()) {
  const nouvelles = ids.filter((id, i) => !session.partiesAuto.includes(id) && ids.indexOf(id) === i);
  if (!nouvelles.length) return session;
  const s = demarrer(session, maintenant);
  return { ...s, partiesAuto: [...s.partiesAuto, ...nouvelles] };
}

export function nombreParties(session) {
  return session.parties + session.partiesAuto.length;
}

export function dureeMs(session, maintenant = Date.now()) {
  return session.debut ? Math.max(0, maintenant - session.debut) : 0;
}

/** Parties par heure ; null tant que le chrono n'a pas tourné une minute. */
export function partiesParHeure(session, maintenant = Date.now()) {
  const ms = dureeMs(session, maintenant);
  if (ms < 60_000) return null;
  return (nombreParties(session) * 3_600_000) / ms;
}

/** "0:45", "12:04" sous l'heure ; "1:05:32" au-delà. */
export function formatChrono(ms) {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/**
 * Termine la session : l'archive si le chrono a tourné, puis repart à zéro.
 * Renvoie [sessionsArchivees, sessionVierge].
 */
export function terminer(session, sessions, maintenant = Date.now()) {
  if (!session.debut) return [sessions, nouvelleSession()];
  const entree = { debut: session.debut, fin: maintenant, parties: nombreParties(session) };
  return [[entree, ...sessions].slice(0, 200), nouvelleSession()];
}

/** Ids de parties (« Game ID ») présents dans un texte d'historique, sans le parser entièrement. */
export function idsPartiesDuTexte(texte) {
  const ids = new Set();
  // Un fichier en cours d'écriture peut se terminer par une ligne incomplète : on l'ignore.
  const complet = texte.endsWith("\n") ? texte : texte.slice(0, texte.lastIndexOf("\n") + 1);
  const regex = /^Game ID: (.+?)\s*$/gm;
  let m;
  while ((m = regex.exec(complet))) ids.add(m[1]);
  return ids;
}
