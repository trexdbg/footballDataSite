import {
  classifyDataset,
  extractPlayersArray,
  extractStandingsObject,
  inspectPlayersDataset,
  inspectTeamsDataset,
} from "./schemaInspector.js";

async function fetchJson(url) {
  if (!url || typeof url !== "string") {
    throw new Error("URL vide ou invalide.");
  }
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} (${response.statusText}) sur ${url}`);
  }
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`JSON invalide dans ${url}: ${error.message}`);
  }
}

function buildLoadFailure(message, technicalDetails = "") {
  const error = new Error(message);
  error.technicalDetails = technicalDetails;
  return error;
}

function ensurePlayersArray(rawData) {
  const inspector = inspectPlayersDataset(rawData);
  if (!inspector.found) {
    return { players: [], report: inspector };
  }
  return { players: extractPlayersArray(rawData), report: inspector };
}

function ensureTeamsObject(rawData) {
  if (!rawData) {
    return { teamsObject: { standings: [] }, report: { found: false, score: 0 } };
  }
  const inspector = inspectTeamsDataset(rawData);
  if (!inspector.found) {
    return { teamsObject: { standings: [] }, report: inspector };
  }
  return { teamsObject: extractStandingsObject(rawData), report: inspector };
}

export async function loadFromConfiguredPaths(config) {
  const playersUrl = config.playersUrl;
  const teamsUrl = config.teamsUrl;

  const [playersResult, teamsResult] = await Promise.allSettled([
    fetchJson(playersUrl),
    fetchJson(teamsUrl),
  ]);

  if (playersResult.status === "rejected") {
    const detail = [
      `Échec du chargement joueurs: ${playersResult.reason.message}`,
      teamsResult.status === "rejected"
        ? `Échec du chargement clubs: ${teamsResult.reason.message}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
    throw buildLoadFailure(
      "Impossible de charger les données depuis les chemins configurés.",
      detail
    );
  }

  const rawPlayersSource = playersResult.value;
  const rawTeamsSource = teamsResult.status === "fulfilled" ? teamsResult.value : null;

  const playersBundle = ensurePlayersArray(rawPlayersSource);
  if (!playersBundle.players.length) {
    throw buildLoadFailure(
      "Le JSON joueurs a été trouvé, mais sa structure n'est pas reconnue.",
      `Chemin détecté: ${playersBundle.report.path}\nScore heuristique: ${playersBundle.report.score}`
    );
  }

  const teamsBundle = ensureTeamsObject(rawTeamsSource);
  const warnings = [];
  if (teamsResult.status === "rejected") {
    warnings.push(`Le fichier clubs/classements n'a pas été chargé: ${teamsResult.reason.message}`);
  } else if (!teamsBundle.report.found) {
    warnings.push("Aucun classement détecté dans le JSON clubs.");
  }

  return {
    mode: "configured-paths",
    playersArray: playersBundle.players,
    teamsObject: teamsBundle.teamsObject,
    warnings,
    rawPlayersSource,
    rawTeamsSource,
  };
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Lecture impossible pour ${file.name}`));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsText(file);
  });
}

async function readAndParseFile(file) {
  const content = await readFileAsText(file);
  try {
    const parsed = JSON.parse(content);
    return { file, parsed };
  } catch (error) {
    throw new Error(`JSON invalide dans ${file.name}: ${error.message}`);
  }
}

function chooseBestCandidate(candidates, kind) {
  if (!candidates.length) {
    return null;
  }
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const strongest = sorted[0];
  if (kind === "players" && strongest.score < 2.2) {
    return null;
  }
  if (kind === "teams" && strongest.score < 2.2) {
    return null;
  }
  return strongest;
}

export async function loadFromImportedFiles(fileList) {
  const files = Array.from(fileList || []).filter((file) => file.type.includes("json") || file.name.endsWith(".json"));
  if (files.length < 2) {
    throw buildLoadFailure(
      "Import incomplet: ajoute deux fichiers JSON (joueurs + clubs/classements)."
    );
  }

  const parsedFiles = [];
  for (const file of files) {
    const result = await readAndParseFile(file);
    parsedFiles.push(result);
  }

  const playerCandidates = [];
  const teamCandidates = [];

  for (const entry of parsedFiles) {
    const classification = classifyDataset(entry.parsed);
    if (classification.kind === "players") {
      playerCandidates.push({
        ...entry,
        score: classification.players.score,
        players: extractPlayersArray(entry.parsed),
      });
    }
    if (classification.kind === "teams") {
      teamCandidates.push({
        ...entry,
        score: classification.teams.score,
        teamsObject: extractStandingsObject(entry.parsed),
      });
    }
  }

  const bestPlayers = chooseBestCandidate(playerCandidates, "players");
  const bestTeams = chooseBestCandidate(teamCandidates, "teams");

  if (!bestPlayers) {
    throw buildLoadFailure(
      "Je ne trouve pas le fichier des joueurs dans tes imports.",
      "Astuce: vérifie qu'il y a bien un tableau de joueurs avec au moins un nom et un identifiant."
    );
  }

  if (!bestTeams) {
    throw buildLoadFailure(
      "Je ne trouve pas le fichier clubs/classements dans tes imports.",
      "Astuce: le fichier classement contient souvent standings[] puis table[] avec club_name/club_slug."
    );
  }

  return {
    mode: "import-files",
    playersArray: bestPlayers.players,
    teamsObject: bestTeams.teamsObject,
    warnings: [],
    rawPlayersSource: bestPlayers.parsed,
    rawTeamsSource: bestTeams.parsed,
    detected: {
      playersFile: bestPlayers.file.name,
      teamsFile: bestTeams.file.name,
    },
  };
}

export function explainExpectedShape() {
  return {
    playersExample: `[
  {
    "id": "player-1",
    "name": "Alex Martin",
    "position": "Midfielder",
    "club_name": "FC Demo",
    "season_sums": { "2024-2025": { "minutes": 820, "accurate_pass": 310, "total_pass": 390 } }
  }
]`,
    teamsExample: `{
  "standings": [
    {
      "competition_slug": "ligue-demo",
      "competition_name": "Ligue Demo",
      "table": [
        { "club_slug": "fc-demo", "club_name": "FC Demo", "rank": 1, "points": 42, "played": 18 }
      ]
    }
  ]
}`,
  };
}
