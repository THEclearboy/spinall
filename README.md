# Expresso Trainer

Entraîneur pré-flop et tracker pour **Expresso Betclic** (Spin & Go 3-max hyper-turbo).
Application React mono-page, sans serveur : toutes les données restent dans le navigateur.

- **Entraînement** : une main, un stack effectif, une décision (Fold / Limp / Raise / All-in) ;
  feedback immédiat, série, répétition espacée des mains ratées, mode « erreurs uniquement ».
- **Statistiques** : précision globale, par famille de situations, par tableau, par action, par main.
- **Analyse** : import des historiques de mains Betclic (.txt ou .zip), tableau de bord « bento » :
  gain net et cEV **par limite** (0,20 €, 1 €, toutes), bankroll, réel vs attendu (équité à tapis),
  parties par jour, **calendrier des heures jouées** (calculées d'après les mains, corrigeables à la
  main), VPIP / PFR, places, respect des ranges, écarts, déroulé de chaque main, rapport PDF.
- **Situation** : une table entièrement paramétrable (format, bouton, stacks, mises, cartes,
  board, explication) pour se faire expliquer une mise en situation ; copier / coller pour l'envoyer.
- **Ranges** : les 10 tableaux (HU SB, HU BB face à limp, 3-way BTN) consultables et corrigeables
  case par case, export JSON.
- **Réglages** : tableaux actifs, options, export / import complet des données.

## Développer

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # tests unitaires (parseur, ranges, équité, analyse)
npm run build    # produit dist/index.html : UN seul fichier, tout intégré
```


## HUD de session

Deux HUD, au choix.

### HUD Windows autonome (`outils/windows/`, sans navigateur)

Un script PowerShell + WPF, rien à installer : `hud-betclic.ps1` et ses lanceurs
`.cmd`, empaquetés en `hud-betclic.zip` à chaque build (`scripts/empaqueter-outils.mjs`
→ `public/`, servi sur https://theclearboy.github.io/spinall/hud-betclic.zip).

- Petite fenêtre noire toujours au-dessus : chrono depuis le premier lancement
  de table, parties (+1 / −1, touches + / Entrée / −), cadence, clic droit → menu.
- `installer-hud-betclic.cmd` : veille lancée tout de suite et à chaque démarrage
  de Windows. Dès que le processus Betclic tourne (`-Processus "*betclic*"`, ou
  une fenêtre principale « Betclic »), le HUD apparaît ; il se range quand Betclic
  se ferme.
- Détection des parties : chaque nouvelle fenêtre de table de Betclic (visible,
  titrée, ≥ 300 × 300 px, hors 30 s de démarrage) compte +1 et lance le chrono.
  Réglages `-FiltreTable`, `-CompterTitres`, `-DelaiDemarrage`, `-TailleMinTable`.
- Fichiers dans `%LOCALAPPDATA%\Expresso Trainer` : `session.json` (session en
  cours, reprise au redémarrage ; nouvelle session après `-PauseMax` 120 min sans
  activité), `sessions.csv` (archive), `journal.log` (chaque fenêtre vue, pour
  ajuster le filtre), `position.json`.
- `hud-betclic.cmd` ouvre le HUD maintenant ; si une veille tourne déjà, il lui
  demande d'afficher sa fenêtre (fichier `afficher.signal`).
- Installation : `-Installer` recopie le script dans `%LOCALAPPDATA%\Expresso Trainer`
  (réécrit, donc sans la marque « téléchargé d'Internet » qui fait bloquer les
  `.cmd` du zip par SmartScreen) et y pointe le raccourci de démarrage. Le script
  brut est aussi servi en `hud-betclic.ps1.txt` pour une installation en une
  commande PowerShell (voir `LISEZMOI.txt` ou l'onglet HUD du site). Smart App
  Control (Windows 11 récent) bloque tout script non signé : à désactiver.

Non testé ici (pas de Windows) : vérifier d'abord avec `hud-betclic.cmd -Veille`
dans une console visible que les tables sont bien détectées.

### Onglet HUD du site

L'onglet **HUD** suit une session de jeu : chrono depuis le premier lancement de
table, nombre de parties jouées et cadence (parties / heure).

- **Compteur** : `+1` / `−1` à la main ; le premier `+1` (ou le bouton Lancer)
  démarre le chrono. **Terminer** archive la session (durée, parties, cadence)
  dans la liste des sessions précédentes.
- **Fenêtre flottante** : « Ouvrir le HUD » ouvre une petite fenêtre
  Picture-in-Picture (Chrome / Edge 116+) qui reste au-dessus du client Betclic.
  Touches `+` / `Entrée` et `−` dans la fenêtre. Ailleurs, le HUD s'ouvre dans
  une fenêtre pop-up classique.
- **Comptage automatique** (Chrome / Edge sur ordinateur) : choisir le dossier
  où le client écrit les historiques de mains ; chaque nouveau `Game ID` qui y
  apparaît compte une partie et lance le chrono au besoin. Les parties déjà
  présentes au lancement ne sont pas comptées ; seuls les fichiers modifiés
  dans les 48 h sont relus (toutes les 5 s). Le dossier est mémorisé ; le
  navigateur peut redemander l'autorisation de lecture à la visite suivante.
- Le HUD et le comptage continuent sur les autres onglets ; la session en cours
  survit à un rechargement (`expresso.session`, `expresso.sessions`).

## Déployer

Le build est un fichier HTML autonome (`dist/index.html`, ~330 Ko, police incluse).

- **GitHub Pages** (automatique) : chaque push sur `main` lance `.github/workflows/pages.yml`
  (tests, build, déploiement). Adresse publique : <https://theclearboy.github.io/spinall/>.
  C'est l'adresse à donner au hub « Mes apps » (page directe).
- **Artifact Claude** : le même fichier est aussi publié sur
  <https://claude.ai/artifact/F5uGStopTKN3Dy1yEKEx5b> (privé, nécessite d'être connecté).
- **En local** : ouvrir `dist/index.html` directement dans un navigateur.

Les données (mains importées, historique, réglages) sont stockées par le navigateur **par
adresse** : en changeant d'adresse, exporter depuis Réglages puis importer sur la nouvelle.

## Organisation du code

```
src/
  main.jsx                 point d'entrée
  App.jsx                  onglets, état global, persistance
  styles.css               thème sombre « bento » (Manrope, tuiles colorées), table, grilles, impression
  data/ranges.json         les tableaux de ranges (source : captures d'écran d'un ami)
  lib/
    cartes.js              rangs, couleurs, nommage des mains (AKs, T9o…)
    charts.js              familles de situations, grilles 13×13, corrections
    entrainement.js        tirage des questions, répétition espacée
    stockage.js            localStorage + IndexedDB, export/import JSON
    historique-mains.js    parseur des historiques Betclic, mises, résultats
    zip.js                 lecture des archives .zip (fflate)
    equite.js              évaluateur de mains et équité à tapis
    analyse.js             spots pré-flop, parties, statistiques, EV
    limites.js             bilan par buy-in (gain, ROI, places, cEV)
    heures.js              heures jouées par jour (sessions déduites des mains)
    situation.js           modèle du visualisateur de situations
    statistiques.js        agrégats de l'entraînement
    format.js              nombres, dates, pluriels (fr-FR)
    sons.js                bips de feedback (Web Audio)
  components/
    Entrainement.jsx  Statistiques.jsx  Analyse.jsx  Situation.jsx  Ranges.jsx  Reglages.jsx
    Table.jsx (table générique)  TableScene.jsx  Carte.jsx  ChoixCarte.jsx  Grille.jsx
    DetailMain.jsx  CartesKpi.jsx + RapportImpression.jsx (version papier)  BilanLimites.jsx
    ui/Tuile.jsx           tuile, pilule et grille bento
    graphes/               Courbe, Anneaux, Jauge, Segments, BarresJours, CalendrierHeures,
                           ListeValeurs, GrapheEv (calcul d'EV) + graphes du rapport papier
tests/                     node --test, avec un historique synthétique dans fixtures/
```

## Données persistées

| Clé | Contenu |
|---|---|
| `localStorage` `expresso.overrides` | corrections de ranges |
| `localStorage` `expresso.historique` | réponses d'entraînement |
| `localStorage` `expresso.poids` | poids de répétition espacée |
| `localStorage` `expresso.reglages` | réglages |
| `localStorage` `expresso.heures` | heures jouées saisies à la main (par jour) |
| `localStorage` `expresso.situation` | dernière situation mise en scène |
| IndexedDB `expresso-trainer` / `donnees` / `analyse` | mains importées et fichiers déjà importés |

## Mettre à jour un tableau depuis une capture d'écran

`scripts/lire_tableaux2.py` (Python, Pillow + numpy) détecte les grilles 13×13 dans une image,
lit la couleur de chaque case (rouge = all-in, vert = call/limp/check, bleu = fold, orange = raise)
et repère les cases **mixtes** (moitié gauche / moitié droite : les deux actions sont acceptées,
notées `"allin/call"`). Il imprime les exceptions à coller dans `src/data/ranges.json`.

```bash
pip install pillow numpy
python3 scripts/lire_tableaux2.py capture.png
```

## Conventions des tableaux

Intervalles de profondeur semi-ouverts `[min, max)` en big blinds, stacks avant blinds.
Stack effectif : en HU, min des deux stacks ; en 3-way, min(héros, plus gros adversaire).
Toute situation hors des trois familles couvertes est laissée au libre arbitre du joueur.
