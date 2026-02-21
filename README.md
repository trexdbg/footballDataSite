# Football Data Hub

Refonte complete orientee UX, basee uniquement sur:

- `teams_stats.json`
- `players_stats.json`

## Pages

- `index.html`: accueil (recherche globale, apercu classement, tendances, suggestions de comparaison)
- `clubs.html`: exploration des clubs
- `club.html`: fiche club (resume, radar, forme recente, effectif)
- `players.html`: exploration des joueurs
- `player.html`: fiche joueur (resume, radar poste, evolution recente)
- `teams.html`: classements
- `compare.html`: comparaison club vs club / joueur vs joueur

## Scripts

- `assets/common.js`: chargement des donnees + mapping + utilitaires + charts
- `assets/index.js`: logique accueil
- `assets/clubs.js`: logique page clubs
- `assets/teams.js`: logique classements
- `assets/players.js`: logique page joueurs
- `assets/club.js`: logique fiche club
- `assets/player.js`: logique fiche joueur
- `assets/compare.js`: logique comparaisons
- `assets/styles.css`: design system global

## Lancer en local

```bash
python -m http.server 8080
```

Puis ouvrir `http://localhost:8080/`.
