function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizePath(pathParts) {
  if (pathParts.length === 0) {
    return "root";
  }
  return `root.${pathParts.join(".")}`;
}

function collectArrays(node, pathParts = [], depth = 0, maxDepth = 4, out = []) {
  if (depth > maxDepth) {
    return out;
  }
  if (Array.isArray(node)) {
    out.push({ path: normalizePath(pathParts), array: node });
    const firstObject = node.find((entry) => isObject(entry));
    if (firstObject) {
      collectArrays(firstObject, [...pathParts, "[i]"], depth + 1, maxDepth, out);
    }
    return out;
  }
  if (!isObject(node)) {
    return out;
  }
  const keys = Object.keys(node);
  for (const key of keys) {
    collectArrays(node[key], [...pathParts, key], depth + 1, maxDepth, out);
  }
  return out;
}

function collectObjects(node, pathParts = [], depth = 0, maxDepth = 4, out = []) {
  if (depth > maxDepth || !isObject(node)) {
    return out;
  }
  out.push({ path: normalizePath(pathParts), object: node });
  for (const key of Object.keys(node)) {
    collectObjects(node[key], [...pathParts, key], depth + 1, maxDepth, out);
  }
  return out;
}

function hasAnyKey(obj, keys) {
  return keys.some((key) => obj[key] !== undefined && obj[key] !== null);
}

function scorePlayerObject(entry) {
  if (!isObject(entry)) {
    return 0;
  }
  let score = 0;
  const hasName = hasAnyKey(entry, [
    "name",
    "player_name",
    "full_name",
    "fullname",
    "display_name",
  ]);
  const hasId = hasAnyKey(entry, ["slug", "id", "player_id", "uuid"]);
  const hasPosition = hasAnyKey(entry, ["position", "pos", "role"]);
  const hasClub = hasAnyKey(entry, [
    "club",
    "club_name",
    "club_slug",
    "team",
    "team_name",
    "team_slug",
  ]);
  const hasNationality = hasAnyKey(entry, [
    "nationality",
    "country",
    "nation",
    "nationality_code",
  ]);
  const hasSeasonShape = hasAnyKey(entry, [
    "season_sums",
    "seasons",
    "stats",
    "season_stats",
  ]);

  if (hasName) {
    score += 2;
  }
  if (hasId) {
    score += 2;
  }
  if (hasPosition) {
    score += 1;
  }
  if (hasClub) {
    score += 1;
  }
  if (hasNationality) {
    score += 0.6;
  }
  if (hasSeasonShape) {
    score += 0.6;
  }
  return score;
}

function scoreClubObject(entry) {
  if (!isObject(entry)) {
    return 0;
  }
  let score = 0;
  const hasClubIdentity = hasAnyKey(entry, [
    "club_slug",
    "club_name",
    "slug",
    "name",
    "team_name",
    "team_slug",
  ]);
  const hasRank = hasAnyKey(entry, ["rank", "position", "pos"]);
  const hasPoints = hasAnyKey(entry, ["points", "pts"]);
  const hasMatches = hasAnyKey(entry, ["played", "matches", "wins", "draws", "losses"]);

  if (hasClubIdentity) {
    score += 2.2;
  }
  if (hasRank) {
    score += 1;
  }
  if (hasPoints) {
    score += 1;
  }
  if (hasMatches) {
    score += 0.8;
  }
  return score;
}

function evaluateArray(array, scoreFn) {
  if (!Array.isArray(array) || array.length === 0) {
    return { score: 0, confidence: 0, sampleSize: 0 };
  }
  const sample = array.filter((entry) => isObject(entry)).slice(0, 40);
  if (sample.length === 0) {
    return { score: 0, confidence: 0, sampleSize: 0 };
  }
  const total = sample.reduce((acc, entry) => acc + scoreFn(entry), 0);
  const avg = total / sample.length;
  return {
    score: Number(avg.toFixed(3)),
    confidence: Math.min(1, avg / 4),
    sampleSize: sample.length,
  };
}

function looksLikeStandingsObject(obj) {
  if (!isObject(obj)) {
    return false;
  }
  if (Array.isArray(obj.standings)) {
    return obj.standings.some(
      (entry) =>
        isObject(entry) &&
        Array.isArray(entry.table) &&
        entry.table.some((row) => scoreClubObject(row) >= 2.5)
    );
  }
  if (Array.isArray(obj.table)) {
    return obj.table.some((row) => scoreClubObject(row) >= 2.5);
  }
  return false;
}

export function inspectPlayersDataset(root) {
  const candidates = collectArrays(root);
  let best = {
    found: false,
    score: 0,
    confidence: 0,
    path: "root",
    array: [],
  };

  for (const candidate of candidates) {
    const evaluation = evaluateArray(candidate.array, scorePlayerObject);
    if (evaluation.score > best.score) {
      best = {
        found: evaluation.score >= 2.2,
        score: evaluation.score,
        confidence: evaluation.confidence,
        path: candidate.path,
        array: candidate.array,
      };
    }
  }
  return best;
}

export function inspectTeamsDataset(root) {
  const objectCandidates = collectObjects(root);
  let bestStandingsObject = null;

  for (const candidate of objectCandidates) {
    if (looksLikeStandingsObject(candidate.object)) {
      bestStandingsObject = {
        found: true,
        score: 4.8,
        confidence: 1,
        path: candidate.path,
        standingsObject: candidate.object,
      };
      break;
    }
  }

  if (bestStandingsObject) {
    return bestStandingsObject;
  }

  const arrayCandidates = collectArrays(root);
  let best = {
    found: false,
    score: 0,
    confidence: 0,
    path: "root",
    standingsObject: null,
  };

  for (const candidate of arrayCandidates) {
    const evaluation = evaluateArray(candidate.array, scoreClubObject);
    if (evaluation.score > best.score) {
      best = {
        found: evaluation.score >= 2.3,
        score: evaluation.score,
        confidence: evaluation.confidence,
        path: candidate.path,
        standingsObject: { standings: [{ competition_slug: "unknown", table: candidate.array }] },
      };
    }
  }
  return best;
}

export function classifyDataset(root) {
  const players = inspectPlayersDataset(root);
  const teams = inspectTeamsDataset(root);
  if (players.found && players.score >= teams.score) {
    return { kind: "players", players, teams };
  }
  if (teams.found) {
    return { kind: "teams", players, teams };
  }
  return { kind: "unknown", players, teams };
}

export function extractPlayersArray(root) {
  const result = inspectPlayersDataset(root);
  return result.found ? result.array : [];
}

export function extractStandingsObject(root) {
  const result = inspectTeamsDataset(root);
  if (!result.found) {
    return { standings: [] };
  }
  return result.standingsObject || { standings: [] };
}
