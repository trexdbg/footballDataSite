function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function toBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value > 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["true", "yes", "1", "injured", "suspended", "active"].includes(normalized);
  }
  return false;
}

function asString(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function pickFirst(obj, keys) {
  if (!isObject(obj)) {
    return undefined;
  }
  for (const key of keys) {
    if (key.includes(".")) {
      const parts = key.split(".");
      let cursor = obj;
      let ok = true;
      for (const part of parts) {
        if (!isObject(cursor) || !(part in cursor)) {
          ok = false;
          break;
        }
        cursor = cursor[part];
      }
      if (ok && cursor !== undefined && cursor !== null && cursor !== "") {
        return cursor;
      }
      continue;
    }
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
      return obj[key];
    }
  }
  return undefined;
}

function slugify(text) {
  return asString(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function normalizeMetricKey(rawKey) {
  return String(rawKey)
    .trim()
    .toLowerCase()
    .replace(/[^\w]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function flattenNumericMetrics(source, prefix = "", out = {}, depth = 0, maxDepth = 2) {
  if (!isObject(source) || depth > maxDepth) {
    return out;
  }
  for (const [key, value] of Object.entries(source)) {
    const fullKey = normalizeMetricKey(prefix ? `${prefix}_${key}` : key);
    if (!fullKey || fullKey.endsWith("_id")) {
      continue;
    }
    const numeric = toNumber(value);
    if (numeric !== null) {
      out[fullKey] = numeric;
      continue;
    }
    if (isObject(value)) {
      flattenNumericMetrics(value, fullKey, out, depth + 1, maxDepth);
    }
  }
  return out;
}

function looksLikeSeasonKey(key) {
  const normalized = String(key).trim().toLowerCase();
  return (
    /\d{4}/.test(normalized) ||
    /^s\d{1,2}$/.test(normalized) ||
    normalized.includes("season") ||
    /^\d{2}-\d{2}$/.test(normalized)
  );
}

function parseSeasonSortValue(key) {
  const text = String(key);
  const allYears = text.match(/\d{4}/g);
  if (allYears && allYears.length > 0) {
    return Number(allYears[allYears.length - 1]);
  }
  const short = text.match(/\d{2}/);
  if (short) {
    return 2000 + Number(short[0]);
  }
  return text.charCodeAt(0);
}

function normalizePositionLabel(rawPosition) {
  const normalized = asString(rawPosition).toLowerCase();
  if (!normalized) {
    return "Poste inconnu";
  }
  if (normalized === "unknown" || normalized === "n/a") {
    return "Poste inconnu";
  }
  if (normalized.includes("goalkeeper") || normalized === "gk" || normalized.includes("gardien")) {
    return "Gardien";
  }
  if (
    normalized.includes("defender") ||
    normalized.includes("defence") ||
    normalized.includes("defenseur")
  ) {
    return "Defenseur";
  }
  if (normalized.includes("midfielder") || normalized.includes("milieu")) {
    return "Milieu";
  }
  if (
    normalized.includes("forward") ||
    normalized.includes("striker") ||
    normalized.includes("attaquant")
  ) {
    return "Attaquant";
  }
  return asString(rawPosition);
}

function pauseMainThread() {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, 0);
  });
}

function extractMinutes(entry, fallbackStats) {
  const fromEntry = toNumber(
    pickFirst(entry, [
      "minutes",
      "mins",
      "mins_played",
      "total_minutes",
      "minutes_played",
      "playing_time",
      "stats.minutes",
      "sums.minutes",
    ])
  );
  if (fromEntry !== null) {
    return fromEntry;
  }
  const fromFallback = toNumber(
    pickFirst(fallbackStats, [
      "minutes",
      "mins",
      "mins_played",
      "total_minutes",
      "minutes_played",
    ])
  );
  return fromFallback;
}

function extractSeasonEntries(rawPlayer) {
  const map = new Map();
  const candidateSources = [
    rawPlayer.season_sums,
    rawPlayer.seasons,
    rawPlayer.stats_by_season,
    rawPlayer.season_stats,
    rawPlayer.statistics_by_season,
    rawPlayer.stats?.season_sums,
    rawPlayer.stats?.seasons,
  ];

  const addEntry = (key, value) => {
    if (!key || !isObject(value)) {
      return;
    }
    map.set(String(key), value);
  };

  for (const source of candidateSources) {
    if (!source) {
      continue;
    }
    if (isObject(source)) {
      for (const [key, value] of Object.entries(source)) {
        if (isObject(value)) {
          addEntry(key, value);
        }
      }
      continue;
    }
    if (Array.isArray(source)) {
      for (const item of source) {
        if (!isObject(item)) {
          continue;
        }
        const seasonKey = pickFirst(item, ["season", "season_key", "key", "id", "name"]);
        const data = pickFirst(item, ["stats", "sums", "totals", "data"]) || item;
        addEntry(seasonKey, data);
      }
    }
  }

  if (map.size === 0) {
    for (const [key, value] of Object.entries(rawPlayer)) {
      if (looksLikeSeasonKey(key) && isObject(value)) {
        map.set(key, value);
      }
    }
  }

  return map;
}

function chooseSeasonKey(seasonMap) {
  const keys = Array.from(seasonMap.keys());
  if (keys.length === 0) {
    return "global";
  }
  const sorted = keys.sort((a, b) => parseSeasonSortValue(b) - parseSeasonSortValue(a));
  for (const key of sorted) {
    const entry = seasonMap.get(key);
    const minutes = extractMinutes(entry, entry?.stats || entry?.sums || {});
    if (minutes !== null && minutes > 0) {
      return key;
    }
  }
  return sorted[0];
}

function extractStatsAndPer90(rawPlayer, seasonData) {
  const statSources = [
    seasonData?.stats_sum,
    seasonData?.stats,
    seasonData?.sums,
    seasonData?.totals,
    seasonData?.statsSum,
    seasonData?.statistics,
    rawPlayer.stats,
    rawPlayer.sums,
    rawPlayer.totals,
    rawPlayer,
  ];
  const per90Sources = [
    seasonData?.stats_per90,
    seasonData?.per90,
    seasonData?.per_90,
    seasonData?.statsPer90,
    rawPlayer.per90,
    rawPlayer.stats_per90,
    rawPlayer.per_90,
    rawPlayer.stats?.per90,
  ];

  const stats = {};
  const per90 = {};

  for (const source of statSources) {
    flattenNumericMetrics(source, "", stats, 0, 2);
  }
  for (const source of per90Sources) {
    flattenNumericMetrics(source, "", per90, 0, 2);
  }

  for (const [key, value] of Object.entries(stats)) {
    if (key.startsWith("stats_sum_")) {
      const cleanKey = key.slice("stats_sum_".length);
      if (cleanKey && stats[cleanKey] === undefined) {
        stats[cleanKey] = value;
      }
      continue;
    }
    if (key.startsWith("stats_per90_")) {
      const cleanKey = key.slice("stats_per90_".length);
      if (cleanKey && per90[cleanKey] === undefined) {
        per90[cleanKey] = value;
      }
    }
  }

  for (const [key, value] of Object.entries(rawPlayer)) {
    const normalizedKey = normalizeMetricKey(key);
    const numericValue = toNumber(value);
    if (numericValue === null) {
      continue;
    }
    if (normalizedKey.endsWith("_per90") || normalizedKey.endsWith("_per_90")) {
      const target = normalizedKey.replace(/_per_?90$/, "");
      per90[target] = numericValue;
    }
  }

  return { stats, per90 };
}

function derivePlayerMetrics(stats, per90, minutes) {
  const accuratePass = stats.accurate_pass ?? stats.passes_accurate ?? stats.successful_passes ?? null;
  const totalPass = stats.total_pass ?? stats.passes_total ?? stats.attempted_passes ?? null;
  if (accuratePass !== null && totalPass !== null && totalPass > 0) {
    stats.passAccuracy = accuratePass / totalPass;
  }

  const duelWon = stats.duel_won ?? stats.duels_won ?? null;
  const duelLost = stats.duel_lost ?? stats.duels_lost ?? null;
  if (duelWon !== null || duelLost !== null) {
    const totalDuels = (duelWon || 0) + (duelLost || 0);
    stats.duelsTotal = totalDuels;
    if (totalDuels > 0 && duelWon !== null) {
      stats.duelsWonRate = duelWon / totalDuels;
    }
  }

  const wonTackle = stats.won_tackle ?? null;
  const totalTackle = stats.total_tackle ?? null;
  if (wonTackle !== null && totalTackle !== null && totalTackle > 0) {
    stats.tackleSuccessRate = wonTackle / totalTackle;
  }

  stats.decisiveActions =
    (stats.pen_area_entries || 0) +
    (stats.successful_final_third_passes || 0) +
    (stats.won_contest || 0);

  per90.decisiveActions =
    (per90.pen_area_entries || 0) +
    (per90.successful_final_third_passes || 0) +
    (per90.won_contest || 0);

  const hasAnyPer90 = Object.keys(per90).length > 0;
  if (!hasAnyPer90 && minutes !== null && minutes > 0) {
    for (const [key, value] of Object.entries(stats)) {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        continue;
      }
      if (key === "minutes" || key.endsWith("rate") || key.includes("accuracy")) {
        continue;
      }
      per90[key] = (value / minutes) * 90;
    }
  }
}

function extractLastMatches(rawPlayer) {
  const fromRaw = pickFirst(rawPlayer, [
    "last_matches",
    "recent_matches",
    "form",
    "matches",
    "last5",
  ]);
  if (!Array.isArray(fromRaw)) {
    return [];
  }
  return fromRaw
    .filter((match) => isObject(match))
    .slice(0, 5)
    .map((match) => {
      const flattenedStats = flattenNumericMetrics(match.stats || {}, "", {}, 0, 1);
      const minutes = toNumber(
        pickFirst(match, ["minutes", "mins", "playing_time", "minutes_played", "stats.mins_played"])
      );
      const rating = toNumber(pickFirst(match, ["rating", "score", "performance"]));
      const goals = toNumber(match.goals);
      const assists = toNumber(match.assists);
      return {
        date: asString(pickFirst(match, ["date", "match_date", "played_at"])) || "Date inconnue",
        opponent: asString(
          pickFirst(match, ["opponent", "opponent_name", "against", "versus", "opponent_slug"])
        ) || "Adversaire inconnu",
        minutes,
        rating,
        goals,
        assists,
        accurate_pass: toNumber(flattenedStats.accurate_pass),
        duel_won: toNumber(flattenedStats.duel_won),
        poss_won: toNumber(flattenedStats.poss_won),
        saves: toNumber(flattenedStats.saves),
      };
    });
}

function extractGeneratedAt(rawPlayers, rawTeams) {
  const fromPlayers = pickFirst(rawPlayers, [
    "meta.generated_at",
    "generated_at",
    "meta.generatedAt",
  ]);
  if (fromPlayers) {
    return asString(fromPlayers);
  }
  const fromTeams = pickFirst(rawTeams, [
    "meta.generated_at",
    "generated_at",
    "meta.generatedAt",
  ]);
  return fromTeams ? asString(fromTeams) : "";
}

function normalizeClubRow(row, competitionSlug, competitionName) {
  const fromClubObject = isObject(row.club) ? row.club : {};
  const slug =
    asString(
      pickFirst(row, ["club_slug", "slug", "team_slug", "club.id"]) ||
        pickFirst(fromClubObject, ["slug", "id"])
    ) ||
    slugify(
      pickFirst(row, ["club_name", "name", "team_name"]) || pickFirst(fromClubObject, ["name"])
    );

  const name =
    asString(
      pickFirst(row, ["club_name", "name", "team_name"]) || pickFirst(fromClubObject, ["name"])
    ) || "Club inconnu";

  return {
    slug,
    name,
    logoUrl: asString(
      pickFirst(row, ["club_logo", "logo", "logo_url"]) ||
        pickFirst(fromClubObject, ["logo", "logo_url"])
    ),
    competitionSlug,
    competitionName,
    rank: toNumber(pickFirst(row, ["rank", "position", "pos"])),
    points: toNumber(pickFirst(row, ["points", "pts"])),
    played: toNumber(pickFirst(row, ["played", "matches", "games"])),
    wins: toNumber(pickFirst(row, ["wins", "won"])),
    draws: toNumber(pickFirst(row, ["draws", "draw"])),
    losses: toNumber(pickFirst(row, ["losses", "lost"])),
    goals_for: toNumber(pickFirst(row, ["goals_for", "goals_scored", "gf"])),
    goals_against: toNumber(pickFirst(row, ["goals_against", "goals_conceded", "ga"])),
  };
}

function normalizeClubs(rawTeams) {
  const competitionsMap = new Map();
  const clubsMap = new Map();

  const standingsInput = Array.isArray(rawTeams?.standings)
    ? rawTeams.standings
    : Array.isArray(rawTeams?.table)
      ? [{ competition_slug: "unknown", competition_name: "Compétition", table: rawTeams.table }]
      : [];

  standingsInput.forEach((standing, index) => {
    const competitionSlug =
      asString(
        pickFirst(standing, ["competition_slug", "competitionSlug", "slug", "competition.id"])
      ) || `competition-${index + 1}`;
    const competitionName =
      asString(
        pickFirst(standing, ["competition_name", "competition", "name", "competition.name"])
      ) || `Compétition ${index + 1}`;
    competitionsMap.set(competitionSlug, competitionName);

    const tableRows = Array.isArray(standing.table)
      ? standing.table
      : Array.isArray(standing.standings)
        ? standing.standings
        : [];

    tableRows.forEach((row) => {
      if (!isObject(row)) {
        return;
      }
      const normalized = normalizeClubRow(row, competitionSlug, competitionName);
      const key = `${normalized.competitionSlug}::${normalized.slug}`;
      const prev = clubsMap.get(key);
      if (!prev || (normalized.rank !== null && (prev.rank === null || normalized.rank < prev.rank))) {
        clubsMap.set(key, normalized);
      }
    });
  });

  return {
    clubs: Array.from(clubsMap.values()),
    competitions: Array.from(competitionsMap.entries()).map(([slug, name]) => ({ slug, name })),
  };
}

function computeDataQuality(players) {
  const fields = [
    { key: "name", label: "Nom joueur" },
    { key: "position", label: "Poste" },
    { key: "age", label: "Age" },
    { key: "nationality", label: "Nationalité" },
    { key: "club.name", label: "Club" },
    { key: "stats.minutes", label: "Minutes" },
  ];
  const missing = fields.map((field) => ({ ...field, count: 0, ratio: 0 }));
  let inconsistentMinutes = 0;

  const getByPath = (obj, path) => {
    const segments = path.split(".");
    let cursor = obj;
    for (const segment of segments) {
      if (!cursor || !(segment in cursor)) {
        return undefined;
      }
      cursor = cursor[segment];
    }
    return cursor;
  };

  for (const player of players) {
    for (const row of missing) {
      const value = getByPath(player, row.key);
      if (value === null || value === undefined || value === "") {
        row.count += 1;
      }
    }

    const minutes = toNumber(player.stats.minutes);
    if (minutes === null || minutes !== 0) {
      continue;
    }

    const hasNonZeroStat = Object.entries(player.stats).some(
      ([metric, value]) =>
        metric !== "minutes" &&
        metric !== "passAccuracy" &&
        metric !== "duelsWonRate" &&
        typeof value === "number" &&
        value > 0
    );
    if (hasNonZeroStat) {
      inconsistentMinutes += 1;
    }
  }

  for (const row of missing) {
    row.ratio = players.length > 0 ? row.count / players.length : 0;
  }

  const frequentMissing = missing
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return {
    playersCount: players.length,
    frequentMissing,
    inconsistencies: [
      {
        label: "Joueurs avec minutes = 0 mais des stats > 0",
        count: inconsistentMinutes,
      },
    ],
  };
}

function createClubLookup(clubs) {
  const byCompetitionAndSlug = new Map();
  const bySlug = new Map();
  clubs.forEach((club) => {
    byCompetitionAndSlug.set(`${club.competitionSlug}::${club.slug}`, club);
    if (!bySlug.has(club.slug)) {
      bySlug.set(club.slug, club);
    }
  });
  return { byCompetitionAndSlug, bySlug };
}

function normalizePlayer(rawPlayer, index, clubLookup) {
  const playerName =
    asString(pickFirst(rawPlayer, ["name", "player_name", "full_name", "display_name"])) ||
    `Joueur ${index + 1}`;
  const rawSlug = pickFirst(rawPlayer, ["slug", "id", "player_id", "uuid"]);
  const slug = asString(rawSlug) || slugify(playerName);
  const id = asString(pickFirst(rawPlayer, ["id", "player_id", "uuid"])) || slug;

  const seasonMap = extractSeasonEntries(rawPlayer);
  const seasonKey = chooseSeasonKey(seasonMap);
  const seasonData = seasonMap.get(seasonKey) || {};

  const { stats, per90 } = extractStatsAndPer90(rawPlayer, seasonData);
  const minutes = extractMinutes(seasonData, stats);
  if (minutes !== null) {
    stats.minutes = minutes;
  }
  derivePlayerMetrics(stats, per90, minutes);

  const clubSlug =
    asString(
      pickFirst(rawPlayer, [
        "club_slug",
        "club.slug",
        "team_slug",
        "team.slug",
        "club.id",
      ])
    ) ||
    slugify(
      pickFirst(rawPlayer, [
        "club_name",
        "club.name",
        "team_name",
        "team.name",
      ])
    );

  const competitionSlug =
    asString(
      pickFirst(rawPlayer, [
        "competition_slug",
        "competition.slug",
        "league_slug",
        "league.slug",
      ])
    ) || "";

  const lookupClub =
    clubLookup.byCompetitionAndSlug.get(`${competitionSlug}::${clubSlug}`) ||
    clubLookup.bySlug.get(clubSlug);

  const club = {
    slug: clubSlug || "unknown",
    name:
      asString(
        pickFirst(rawPlayer, ["club_name", "club.name", "team_name", "team.name"])
      ) ||
      lookupClub?.name ||
      "Club inconnu",
    logoUrl:
      asString(
        pickFirst(rawPlayer, [
          "club_logo",
          "club_logo_url",
          "club.logo",
          "club.logo_url",
          "team_logo",
          "team_logo_url",
          "team.logo",
          "team.logo_url",
        ])
      ) || lookupClub?.logoUrl || "",
    competitionSlug: competitionSlug || lookupClub?.competitionSlug || "",
    rank:
      toNumber(pickFirst(rawPlayer, ["club_rank", "rank"])) ??
      lookupClub?.rank ??
      null,
  };

  const statusValue = asString(
    pickFirst(rawPlayer, ["status", "player_status", "availability", "current_status"])
  );
  const status = {
    current: statusValue || "inconnu",
    isInjured: toBoolean(
      pickFirst(rawPlayer, [
        "is_injured",
        "injured",
        "injury",
        "status_flags.injured",
      ])
    ),
    isSuspended: toBoolean(
      pickFirst(rawPlayer, [
        "is_suspended",
        "suspended",
        "status_flags.suspended",
      ])
    ),
  };

  return {
    id,
    slug,
    name: playerName,
    photoUrl: asString(
      pickFirst(rawPlayer, [
        "photo",
        "photo_url",
        "player_image_url",
        "player.photo_url",
        "avatar",
        "image_url",
        "image",
        "picture",
      ])
    ),
    age: toNumber(pickFirst(rawPlayer, ["age", "player_age"])),
    position: normalizePositionLabel(pickFirst(rawPlayer, ["position", "pos", "role"])),
    nationality:
      asString(pickFirst(rawPlayer, ["nationality", "country", "nation"])) ||
      "Nationalité inconnue",
    nationality_code: asString(
      pickFirst(rawPlayer, ["nationality_code", "country_code", "nation_code"])
    ),
    club,
    status,
    seasonKey,
    stats,
    per90,
    lastMatches: extractLastMatches(rawPlayer),
  };
}

function buildNormalizedBundle(players, normalizedClubsBundle, rawPlayersSource, rawTeamsSource) {
  const seasonsSet = new Set(players.map((player) => player.seasonKey).filter(Boolean));
  const seasonKeys = Array.from(seasonsSet).sort(
    (a, b) => parseSeasonSortValue(b) - parseSeasonSortValue(a)
  );

  const dataQuality = computeDataQuality(players);

  const generatedAt = extractGeneratedAt(rawPlayersSource || {}, rawTeamsSource || {});
  const meta = {
    generatedAt: generatedAt || "",
  };

  return {
    players,
    clubs: normalizedClubsBundle.clubs,
    competitions: normalizedClubsBundle.competitions,
    seasonKeys,
    dataQuality,
    meta,
  };
}

export function normalizeDatasets(playersInput, teamsInput, rawPlayersSource, rawTeamsSource) {
  const playersArray = Array.isArray(playersInput) ? playersInput : [];
  const teamsRoot = isObject(teamsInput) ? teamsInput : { standings: [] };

  const normalizedClubsBundle = normalizeClubs(teamsRoot);
  const clubLookup = createClubLookup(normalizedClubsBundle.clubs);

  const players = playersArray
    .filter((entry) => isObject(entry))
    .map((entry, index) => normalizePlayer(entry, index, clubLookup));

  return buildNormalizedBundle(players, normalizedClubsBundle, rawPlayersSource, rawTeamsSource);
}

export async function normalizeDatasetsAsync(
  playersInput,
  teamsInput,
  rawPlayersSource,
  rawTeamsSource,
  options = {}
) {
  const playersArray = Array.isArray(playersInput) ? playersInput : [];
  const teamsRoot = isObject(teamsInput) ? teamsInput : { standings: [] };
  const normalizedClubsBundle = normalizeClubs(teamsRoot);
  const clubLookup = createClubLookup(normalizedClubsBundle.clubs);

  const onProgress =
    typeof options.onProgress === "function" ? options.onProgress : () => {};
  const chunkSize = Number(options.chunkSize) > 0 ? Number(options.chunkSize) : 200;

  const sourcePlayers = playersArray.filter((entry) => isObject(entry));
  const total = sourcePlayers.length;
  const players = [];

  for (let index = 0; index < total; index += 1) {
    players.push(normalizePlayer(sourcePlayers[index], index, clubLookup));
    if ((index + 1) % chunkSize === 0 || index + 1 === total) {
      onProgress({
        processed: index + 1,
        total,
        ratio: total > 0 ? (index + 1) / total : 1,
      });
      await pauseMainThread();
    }
  }

  return buildNormalizedBundle(players, normalizedClubsBundle, rawPlayersSource, rawTeamsSource);
}
