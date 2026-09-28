# Expresso Trainer

Entraîneur pré-flop et tracker pour **Expresso Betclic** (Spin & Go 3-max hyper-turbo).
Application React mono-page, sans serveur : toutes les données restent dans le navigateur.

- **Entraînement** : une main, un stack effectif, une décision (Fold / Limp / Raise / All-in) ;
  feedback immédiat, série, répétition espacée des mains ratées, mode « erreurs uniquement ».
- **Statistiques** : précision globale, par famille de situations, par tableau, par action, par main.
- **Analyse** : import des historiques de mains Betclic (.txt ou .zip), KPI (net €, places, VPIP,
  PFR, showdowns, cEV), courbe de bankroll, réel vs attendu (équité à tapis), parties par jour,
  respect des ranges, liste des écarts et déroulé de chaque main, rapport imprimable (PDF).
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

## Déployer

Le build est un fichier HTML autonome (`dist/index.html`, ~300 Ko, police incluse).
Il est publié comme artifact Claude à l'adresse
<https://claude.ai/artifact/F5uGStopTKN3Dy1yEKEx5b>, ouverte par le hub « Mes apps »
en page directe. Pour mettre à jour : `npm run build`, puis republier `dist/index.html`
sur cette même adresse (ou l'ouvrir directement depuis le disque).

## Organisation du code

```
src/
  main.jsx                 point d'entrée
  App.jsx                  onglets, état global, persistance
  styles.css               thème clair/sombre, table, grilles, graphes, impression
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
    statistiques.js        agrégats de l'entraînement
    format.js              nombres, dates, pluriels (fr-FR)
    sons.js                bips de feedback (Web Audio)
  components/
    Entrainement.jsx  Statistiques.jsx  Analyse.jsx  Ranges.jsx  Reglages.jsx
    TableScene.jsx  Carte.jsx  Grille.jsx  CartesKpi.jsx  DetailMain.jsx  RapportImpression.jsx
    graphes/               GrapheBankroll, GrapheEv, GrapheParties, GrapheConformite
tests/                     node --test, avec un historique synthétique dans fixtures/
```

## Données persistées

| Clé | Contenu |
|---|---|
| `localStorage` `expresso.overrides` | corrections de ranges |
| `localStorage` `expresso.historique` | réponses d'entraînement |
| `localStorage` `expresso.poids` | poids de répétition espacée |
| `localStorage` `expresso.reglages` | réglages |
| IndexedDB `expresso-trainer` / `donnees` / `analyse` | mains importées et fichiers déjà importés |

## Conventions des tableaux

Intervalles de profondeur semi-ouverts `[min, max)` en big blinds, stacks avant blinds.
Stack effectif : en HU, min des deux stacks ; en 3-way, min(héros, plus gros adversaire).
Toute situation hors des trois familles couvertes est laissée au libre arbitre du joueur.
