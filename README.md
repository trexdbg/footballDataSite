# Foot Stats Coach (100% statique)

Application web **HTML/CSS/JavaScript vanilla** pour explorer des statistiques football.

## Base de donnees

L'application charge en priorite les fichiers compresses a la racine:

- `./players_stats.json.gz`
- `./teams_stats.json.gz`

Puis elle bascule automatiquement sur:

- `./players_stats.json`
- `./teams_stats.json`

si le `.gz` est indisponible ou si le navigateur ne supporte pas la decompression.

## Fonctionnalites principales

- SPA statique avec hash routing (`#/players`, `#/compare`, etc.).
- Chargement automatique de la base JSON fixe au demarrage (cache runtime + fallback .json).
- Normalisation defensive des joueurs/clubs, en traitement progressif pour garder l'UI fluide.
- Recherche globale (nom, club, nationalite).
- Favoris persistants (`localStorage`).
- Table Joueurs triable/filtrable/paginee + mode cartes.
- Profil joueur, comparaison A/B, leaderboards, classements clubs.
- Glossaire et panneaux de qualite des donnees.
- Interface responsive revue (mobile-first) avec visuels joueurs/clubs.

## Structure

```text
/
  index.html
  styles.css
  config.js
  app.js
  players_stats.json.gz
  teams_stats.json.gz
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
3. Verifier que les fichiers `.json.gz` sont presents (et garder les `.json` comme fallback).

## Option Chart.js (facultative)

Par defaut, l'app utilise des graphiques SVG.

Dans `Parametres`, vous pouvez activer "Chart.js si disponible":

- tentative de chargement via fichier local (`chartJsLocalUrl`) puis CDN (`chartJsCdnUrl`)
- fallback automatique en SVG si echec
