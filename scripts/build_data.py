from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean
from typing import Any

import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
PLAYERS_PARQUET = ROOT / "players_kpi.parquet"
RANKINGS_PARQUET = ROOT / "player_rankings.parquet"
OUTPUT_JSON = ROOT / "data" / "players.json"


RADAR_METRICS: list[dict[str, str]] = [
    {
        "id": "creation",
        "label": "Creation",
        "source": "chance_creation_percentile",
        "description": "Percentile de creation d'occasions",
    },
    {
        "id": "progression",
        "label": "Progression",
        "source": "progression_actions_percentile",
        "description": "Percentile d'actions de progression",
    },
    {
        "id": "defending",
        "label": "Defending",
        "source": "defensive_actions_percentile",
        "description": "Percentile d'actions defensives",
    },
    {
        "id": "finishing",
        "label": "Finishing",
        "source": "shots_on_target_percentile",
        "description": "Percentile de tirs cadres",
    },
    {
        "id": "form",
        "label": "Form",
        "source": "ss2_form_score",
        "description": "Score de forme SS2 normalise",
    },
    {
        "id": "reliability",
        "label": "Reliability",
        "source": "score_percentile_60",
        "description": "Frequence des matchs >= 60",
    },
    {
        "id": "minutes",
        "label": "Minutes",
        "source": "minutes_played_last5",
        "description": "Charge de jeu recente",
    },
    {
        "id": "stability",
        "label": "Stability",
        "source": "volatility_between_games",
        "description": "Regularite entre matchs (inverse de volatilite)",
    },
]


METRIC_PRESETS: dict[str, list[str]] = {
    "balanced": [
        "creation",
        "progression",
        "defending",
        "finishing",
        "form",
        "reliability",
        "minutes",
        "stability",
    ],
    "offensive": [
        "creation",
        "finishing",
        "form",
        "progression",
        "reliability",
        "minutes",
    ],
    "builder": [
        "progression",
        "creation",
        "reliability",
        "stability",
        "minutes",
        "defending",
    ],
    "defensive": [
        "defending",
        "stability",
        "reliability",
        "minutes",
        "progression",
        "form",
    ],
}


def to_float(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    if isinstance(value, (np.floating, np.integer)):
        value = float(value)
    try:
        if pd.isna(value):
            return default
    except Exception:
        pass
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def to_int(value: Any, default: int = 0) -> int:
    return int(round(to_float(value, float(default))))


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def normalize(value: float, min_value: float, max_value: float, invert: bool = False) -> float:
    if max_value <= min_value:
        normalized = 0.5
    else:
        normalized = (value - min_value) / (max_value - min_value)
    normalized = clamp01(normalized)
    return 1.0 - normalized if invert else normalized


def slug_to_label(slug: str) -> str:
    return slug.replace("-", " ").strip().title()


def collect_bounds(players_df: pd.DataFrame) -> dict[str, tuple[float, float]]:
    keys = ["ss2_form_score", "volatility_between_games", "minutes_played_last5"]
    values: dict[str, list[float]] = {key: [] for key in keys}
    for raw_kpis in players_df["kpis_readable"]:
        if not isinstance(raw_kpis, dict):
            continue
        for key in keys:
            values[key].append(to_float(raw_kpis.get(key), 0.0))
    return {key: (min(vals), max(vals)) for key, vals in values.items() if vals}


def get_matches(raw_matches: Any, club_slug: str) -> list[dict[str, Any]]:
    if isinstance(raw_matches, np.ndarray):
        source = raw_matches.tolist()
    elif isinstance(raw_matches, list):
        source = raw_matches
    else:
        source = []

    matches: list[dict[str, Any]] = []
    for item in source:
        if not isinstance(item, dict):
            continue
        aa = item.get("aa", {}) if isinstance(item.get("aa"), dict) else {}
        decisions = item.get("dec", {}) if isinstance(item.get("dec"), dict) else {}
        positive = decisions.get("pos", {}) if isinstance(decisions.get("pos"), dict) else {}

        home = str(item.get("at", "") or "")
        away = str(item.get("ht", "") or "")
        is_home = home == club_slug
        opponent = away if is_home else home

        match = {
            "date": str(item.get("d", "") or ""),
            "score": round(to_float(item.get("s"), 0.0), 2),
            "status": str(item.get("st", "") or ""),
            "opponent": opponent,
            "is_home": bool(is_home),
            "minutes": to_int(aa.get("mins_played"), 0),
            "goals": to_int(positive.get("goals"), 0),
            "assists": to_int(positive.get("goal_assist"), 0),
            "key_actions": to_int(aa.get("adjusted_total_att_assist"), 0),
        }
        matches.append(match)

    matches.sort(key=lambda m: m["date"])
    return matches[-10:]


def build() -> None:
    players_df = pd.read_parquet(PLAYERS_PARQUET)
    rankings_df = pd.read_parquet(RANKINGS_PARQUET)

    bounds = collect_bounds(players_df)
    rank_map = {
        row["slug"]: {
            "position_rank": to_int(row.get("rank"), 0),
            "rank_score": round(to_float(row.get("rank_score"), 0.0), 3),
            "ss2": round(to_float(row.get("SS2"), 0.0), 2),
            "pct70": round(to_float(row.get("pct70"), 0.0) * 100.0, 1),
            "pct60": round(to_float(row.get("pct60"), 0.0) * 100.0, 1),
        }
        for _, row in rankings_df.iterrows()
        if isinstance(row.get("slug"), str)
    }

    players: list[dict[str, Any]] = []
    for _, row in players_df.iterrows():
        slug = str(row.get("slug", "") or "")
        name = str(row.get("name", "") or "")
        position = str(row.get("position", "") or "Unknown")
        club_slug = str(row.get("club_slug", "") or "unknown-club")
        readable = row.get("kpis_readable", {})
        if not isinstance(readable, dict):
            readable = {}

        matches = get_matches(row.get("matches"), club_slug)
        match_scores = [to_float(match["score"], 0.0) for match in matches]
        matches_played = len(matches)

        ss2 = to_float(readable.get("ss2_form_score"), 0.0)
        volatility = to_float(readable.get("volatility_between_games"), 0.0)
        minutes_last5 = to_float(readable.get("minutes_played_last5"), 0.0)

        radar = {
            "creation": round(clamp01(to_float(readable.get("chance_creation_percentile"), 0.0)) * 100.0, 1),
            "progression": round(clamp01(to_float(readable.get("progression_actions_percentile"), 0.0)) * 100.0, 1),
            "defending": round(clamp01(to_float(readable.get("defensive_actions_percentile"), 0.0)) * 100.0, 1),
            "finishing": round(clamp01(to_float(readable.get("shots_on_target_percentile"), 0.0)) * 100.0, 1),
            "form": round(
                normalize(ss2, bounds["ss2_form_score"][0], bounds["ss2_form_score"][1]) * 100.0,
                1,
            ),
            "reliability": round(clamp01(to_float(readable.get("score_percentile_60"), 0.0)) * 100.0, 1),
            "minutes": round(
                normalize(
                    minutes_last5,
                    bounds["minutes_played_last5"][0],
                    bounds["minutes_played_last5"][1],
                )
                * 100.0,
                1,
            ),
            "stability": round(
                normalize(
                    volatility,
                    bounds["volatility_between_games"][0],
                    bounds["volatility_between_games"][1],
                    invert=True,
                )
                * 100.0,
                1,
            ),
        }

        profile = {
            "attack_index": round(mean([radar["creation"], radar["finishing"], radar["form"]]), 1),
            "control_index": round(mean([radar["progression"], radar["reliability"], radar["minutes"]]), 1),
            "defense_index": round(mean([radar["defending"], radar["stability"], radar["reliability"]]), 1),
            "consistency_index": round(mean([radar["stability"], radar["minutes"], radar["reliability"]]), 1),
        }

        rank_snapshot = rank_map.get(
            slug,
            {
                "position_rank": 0,
                "rank_score": round(to_float(readable.get("rank_score_composite"), 0.0), 3),
                "ss2": round(ss2, 2),
                "pct70": round(clamp01(to_float(readable.get("score_percentile_70"), 0.0)) * 100.0, 1),
                "pct60": round(clamp01(to_float(readable.get("score_percentile_60"), 0.0)) * 100.0, 1),
            },
        )

        players.append(
            {
                "slug": slug,
                "name": name,
                "position": position,
                "club_slug": club_slug,
                "club_name": slug_to_label(club_slug),
                "summary": {
                    "avg_score_last5": round(to_float(readable.get("avg_score_last_5"), 0.0), 2),
                    "avg_score_last15": round(to_float(readable.get("avg_score_last_15"), 0.0), 2),
                    "ss2_form_score": round(ss2, 2),
                    "score_trend": round(to_float(readable.get("score_trend"), 0.0), 3),
                    "minutes_last5": to_int(minutes_last5),
                    "starter_rate_last5": round(clamp01(to_float(readable.get("starter_rate_last5"), 0.0)) * 100.0, 1),
                    "volatility": round(volatility, 3),
                    "score_std_dev": round(to_float(readable.get("score_std_dev"), 0.0), 2),
                    "rank_score_composite": round(to_float(readable.get("rank_score_composite"), 0.0), 3),
                    "fixture_difficulty": round(to_float(readable.get("fixture_difficulty_score"), 0.0), 3),
                    "matches_sampled": matches_played,
                    "recent_avg_score": round(mean(match_scores), 2) if match_scores else 0.0,
                },
                "rankings": rank_snapshot,
                "radar": radar,
                "profile": profile,
                "matches": matches,
            }
        )

    players_sorted = sorted(
        players,
        key=lambda player: (
            player["summary"]["rank_score_composite"],
            player["summary"]["ss2_form_score"],
        ),
        reverse=True,
    )
    global_rank_map = {player["slug"]: index + 1 for index, player in enumerate(players_sorted)}

    for player in players:
        player["rankings"]["global_rank"] = global_rank_map[player["slug"]]

    payload = {
        "generated_at_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "source_files": [
            PLAYERS_PARQUET.name,
            RANKINGS_PARQUET.name,
        ],
        "radar_metrics": RADAR_METRICS,
        "metric_presets": METRIC_PRESETS,
        "positions": sorted(set(player["position"] for player in players)),
        "clubs": sorted(set(player["club_slug"] for player in players)),
        "players": sorted(players, key=lambda player: player["name"].lower()),
    }

    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Generated {OUTPUT_JSON} with {len(players)} players")


if __name__ == "__main__":
    build()
