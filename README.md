# Foot Stats Coach (100% statique)

Application web **HTML/CSS/JavaScript vanilla** pour explorer des statistiques football.

## Base de donnees

L'application utilise **uniquement** ces deux fichiers JSON a la racine du projet:

- `./players_stats.json`
- `./teams_stats.json`

Aucune option d'import manuel ni de changement de chemins n'est prevue pour les donnees.

## Fonctionnalites principales

- SPA statique avec hash routing (`#/players`, `#/compare`, etc.).
- Chargement automatique de la base JSON fixe au demarrage.
- Normalisation defensive des joueurs/clubs.
- Recherche globale (nom, club, nationalite).
- Favoris persistants (`localStorage`).
- Table Joueurs triable/filtrable/paginee + mode cartes.
- Profil joueur, comparaison A/B, leaderboards, classements clubs.
- Glossaire et panneaux de qualite des donnees.

## Structure

```text
/
  index.html
  styles.css
  config.js
  app.js
  players_stats.json
  teams_stats.json
  /lib/
    dataLoader.js
    schemaInspector.js
    normalize.js
    store.js
    router.js
    /ui/
      components.js
      playersTable.js
      playerProfile.js
      compare.js
      leaderboards.js
      clubs.js
      learn.js
    /charts/
      svgCharts.js
      chartProvider.js
  /assets/
    icons.svg
    /illustrations/
      coach-ball.svg
```

## Demarrage rapide

1. Heberger ce dossier sur un serveur statique.
2. Ouvrir `index.html`.
3. Verifier que `players_stats.json` et `teams_stats.json` sont presents et accessibles a la racine.

## Option Chart.js (facultative)

Par defaut, l'app utilise des graphiques SVG.

Dans `Parametres`, vous pouvez activer "Chart.js si disponible":

- tentative de chargement via fichier local (`chartJsLocalUrl`) puis CDN (`chartJsCdnUrl`)
- fallback automatique en SVG si echec
