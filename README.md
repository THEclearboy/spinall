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
