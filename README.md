# Foot Stats Coach (100% statique)

Application web **HTML/CSS/JavaScript vanilla** pour jeunes joueurs (10+), orientée "coach sympa", sans backend, sans framework, sans build tool.

## Fonctionnalités

- SPA statique avec hash routing (`#/players`, `#/compare`, etc.).
- Chargement de données en **2 modes**:
  - `Mode chemins configurés`: via `config.js` + écran Paramètres + sauvegarde `localStorage`.
  - `Mode import fichier`: import de JSON via `<input type="file" multiple>`.
- Détection heuristique du schéma JSON (noms de fichiers/structure non garantis).
- Normalisation défensive des joueurs/clubs (champs manquants tolérés).
- Recherche globale (nom, club, nationalité) avec surlignage.
- Favoris persistants (`localStorage`).
- Table Joueurs triable/filtrable/paginée + mode cartes.
- Profil joueur: identité, statut, stats clés, derniers matchs, bouton comparer.
- Comparaison A/B avec 3 visuels (bar, line, radar) + tableaux texte accessibles.
- Leaderboards (top N par métrique) avec filtres.
- Classements clubs/compétitions + page club.
- Glossaire/tutoriels en vocabulaire simple.
- Accessibilité: focus visible, tables accessibles, aria-label, aria-live.
- Performance: pagination, debounce recherche, index de recherche, rendu fragment.

## Structure

```text
/
  index.html
  styles.css
  config.js
  app.js
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
  /data/
    README.md
  README.md
  CREDITS.md
```

## Démarrage rapide

1. Héberger ce dossier sur un serveur statique (ex: GitHub Pages).
2. Ouvrir `index.html`.
3. Aller dans `Paramètres`.
4. Choisir l'un des deux modes:
   - `Chemins configurés` (par défaut: `./data/players.json` et `./data/teams.json`)
   - `Import de fichiers` (sélectionner 2 JSON)

## Configuration des chemins

Valeurs par défaut dans `config.js`:

```js
PLAYERS_JSON_URL = "./data/players.json";
TEAMS_JSON_URL = "./data/teams.json";
```

Vous pouvez les modifier:
- directement dans `config.js`
- ou dans l'écran `Paramètres` (persisté en `localStorage`)

## Si vos fichiers ont d'autres noms

Exemple actuel possible:
- `players_stats.json`
- `teams_stats.json`

Deux options:
- mettre à jour les chemins dans `Paramètres`
- ou utiliser `Import de fichiers` sans renommer

## Résilience des données

- Parsing défensif: si des champs manquent, l'app continue avec `—` ou `N/A`.
- Sélection de saison:
  - saison la plus récente avec `minutes > 0` si possible
  - sinon saison la plus récente
- Calculs dérivés:
  - `passAccuracy = accurate_pass / total_pass`
  - `duelsTotal = duel_won + duel_lost`
  - `duelsWonRate = duel_won / duelsTotal`
  - calcul `per90` si absent et minutes disponibles
- Panneau "Qualité des données": champs manquants fréquents + incohérences.

## Accessibilité

- Navigation clavier (Tab / Enter / Space) sur les contrôles.
- Focus visible.
- Tables avec `<caption>`, `<th scope="col">`, `<tbody>`.
- Zone `aria-live` pour messages dynamiques.
- SVG accessibles (`role="img"` + title/desc/aria-label) + tableau texte de résumé.

## Option Chart.js (facultative)

Par défaut, l'app utilise des graphiques SVG légers.

Dans `Paramètres`, vous pouvez activer "Chart.js si disponible":
- tentative de chargement via fichier local (`chartJsLocalUrl`) puis CDN (`chartJsCdnUrl`)
- fallback automatique SVG si échec

## Déploiement GitHub Pages

1. Pousser ce dépôt sur GitHub.
2. Activer Pages sur la branche principale.
3. Déposer vos JSON dans `/data` ou configurer les chemins dans l'app.

## Checklist d'acceptation

- [ ] L’app démarre sans données (mode démo) et affiche comment importer.
- [ ] Avec 2 JSON valides, les onglets fonctionnent et aucun crash.
- [ ] Recherche + tri + filtres fonctionnent.
- [ ] Comparaison A/B produit 3 visuels (SVG) + tableau texte.
- [ ] Favoris persistent après refresh.
- [ ] Navigation clavier OK (tab, enter, espace), focus visible.
- [ ] Table a `<caption>` et headers corrects.
- [ ] L’app reste fluide avec plusieurs milliers de joueurs (pagination active).
