# Stadium Kids Lab

Refonte complete orientee enfant, basee uniquement sur:

- `teams_stats.json`
- `players_stats.json`

## Objectif UX

- comparer facilement des joueurs et des equipes
- comprendre les stats sans jargon complexe
- voir rapidement les prochains matchs
- garder un parcours ludique (cartes, duels, reperes visuels)

## Pages

- `index.html`: accueil avec recherche globale, mini-classement, matchs a venir, tendances et duels suggeres
- `clubs.html`: galerie des equipes avec filtres
- `club.html`: fiche equipe (resume, radar, forme recente, effectif)
- `players.html`: galerie joueurs + tableau detaille + leaders
- `player.html`: fiche joueur (resume, radar poste, evolution recente)
- `teams.html`: classements + prochains matchs
- `compare.html`: duel joueur vs joueur / equipe vs equipe avec score de duel

## Scripts

- `assets/common.js`: chargement/mapping des JSON + utilitaires + charts
- `assets/index.js`: logique accueil
- `assets/clubs.js`: logique page equipes
- `assets/teams.js`: logique classements
- `assets/players.js`: logique page joueurs
- `assets/club.js`: logique fiche equipe
- `assets/player.js`: logique fiche joueur
- `assets/compare.js`: logique duel
- `assets/styles.css`: design system global

## Lancer en local

```bash
python -m http.server 8080
```

Puis ouvrir `http://localhost:8080/`.
