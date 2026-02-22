import {
  extractPlayersArray,
  extractStandingsObject,
  inspectPlayersDataset,
  inspectTeamsDataset,
} from "./schemaInspector.js";

const FIXED_PLAYERS_JSON_URL = "./players_stats.json";
const FIXED_TEAMS_JSON_URL = "./teams_stats.json";

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

export async function loadFromConfiguredPaths() {
  const playersUrl = FIXED_PLAYERS_JSON_URL;
  const teamsUrl = FIXED_TEAMS_JSON_URL;

  const [playersResult, teamsResult] = await Promise.allSettled([
    fetchJson(playersUrl),
    fetchJson(teamsUrl),
  ]);

  if (playersResult.status === "rejected") {
    const detail = [
      `Echec du chargement joueurs: ${playersResult.reason.message}`,
      teamsResult.status === "rejected"
        ? `Echec du chargement clubs: ${teamsResult.reason.message}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
    throw buildLoadFailure(
      "Impossible de charger la base JSON fixe.",
      detail
    );
  }

  const rawPlayersSource = playersResult.value;
  const rawTeamsSource = teamsResult.status === "fulfilled" ? teamsResult.value : null;

  const playersBundle = ensurePlayersArray(rawPlayersSource);
  if (!playersBundle.players.length) {
    throw buildLoadFailure(
      "Le JSON joueurs est present, mais sa structure n'est pas reconnue.",
      `Chemin detecte: ${playersBundle.report.path}\nScore heuristique: ${playersBundle.report.score}`
    );
  }

  const teamsBundle = ensureTeamsObject(rawTeamsSource);
  const warnings = [];
  if (teamsResult.status === "rejected") {
    warnings.push(`Le fichier teams_stats.json n'a pas ete charge: ${teamsResult.reason.message}`);
  } else if (!teamsBundle.report.found) {
    warnings.push("Aucun classement detecte dans teams_stats.json.");
  }

  return {
    mode: "fixed-json-files",
    playersArray: playersBundle.players,
    teamsObject: teamsBundle.teamsObject,
    warnings,
    rawPlayersSource,
    rawTeamsSource,
  };
}
