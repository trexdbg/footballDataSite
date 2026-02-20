# Pastel Pitch Lab

Site statique de comparaison de joueurs de football, base sur:

- `players_kpi.parquet`
- `player_rankings.parquet`

Le site est compatible GitHub Pages (aucun backend requis).

## Structure

- `index.html`: page principale
- `assets/styles.css`: design pastel, responsive
- `assets/app.js`: logique de comparaison et graphiques
- `scripts/build_data.py`: conversion parquet -> JSON front
- `data/players.json`: donnees generees

## Regenerer les donnees

Prerequis Python:

- `pandas`
- `pyarrow`
- `numpy`

Commande:

```bash
python scripts/build_data.py
```

Le script cree/actualise `data/players.json`.

## Lancer en local

Exemple simple avec Python:

```bash
python -m http.server 8080
```

Puis ouvrir `http://localhost:8080`.

## Publier sur GitHub Pages

1. Pousser ce dossier sur une branche (`main` par exemple).
2. Dans GitHub: `Settings > Pages`.
3. Source: `Deploy from a branch`.
4. Selectionner la branche et le dossier racine (`/root`).

Le site sera servi en statique, avec les assets et `data/players.json`.
