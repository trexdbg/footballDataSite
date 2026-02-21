# Pastel Football Dashboard

Application statique fan-football avec navigation complete:

- `index.html`: entree championnat aleatoire
- `teams.html`: hub championnat (classement, clubs, comparaisons)
- `club.html`: page club (effectif, tops internes, contexte)
- `players.html`: recherche et classements joueurs (tri competition)
- `player.html`: profil joueur (rangs, radar vs moyenne poste championnat)

## Sources de donnees

- `players_stats.json`
- `teams_stats.json`

## Structure

- `index.html`: entree aleatoire et navigation
- `players.html`: page joueurs
- `player.html`: profil joueur dedie
- `teams.html`: page equipes/championnats
- `club.html`: page club dediee
- `assets/styles.css`: theme pastel clair (responsive)
- `assets/players.js`: logique dashboard joueurs
- `assets/teams.js`: logique dashboard equipes
- `assets/player.js`: logique profil joueur
- `assets/club.js`: logique page club
- `assets/index.js`: logique entree championnat aleatoire

## Lancer en local

```bash
python -m http.server 8080
```

Puis ouvrir:

- `http://localhost:8080/`
- `http://localhost:8080/players.html`
- `http://localhost:8080/teams.html`
- `http://localhost:8080/club.html`
- `http://localhost:8080/player.html`
