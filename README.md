# Pastel Football Dashboard

Application statique avec 2 pages:

- `players.html`: dashboard joueurs (classements, filtres, comparaison radar)
- `teams.html`: dashboard equipes (vue par championnat, top equipes, radar)

## Sources de donnees

- `players_stats.json`
- `teams_stats.json`

## Structure

- `index.html`: page d'accueil/navigation
- `players.html`: page joueurs
- `teams.html`: page equipes
- `assets/styles.css`: theme pastel clair (responsive)
- `assets/players.js`: logique dashboard joueurs
- `assets/teams.js`: logique dashboard equipes

## Lancer en local

```bash
python -m http.server 8080
```

Puis ouvrir:

- `http://localhost:8080/`
- `http://localhost:8080/players.html`
- `http://localhost:8080/teams.html`
