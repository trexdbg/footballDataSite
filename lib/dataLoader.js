import {
  extractPlayersArray,
  extractStandingsObject,
  inspectPlayersDataset,
  inspectTeamsDataset,
} from "./schemaInspector.js";

const FALLBACK_PLAYERS_JSON_URL = "./players_stats.json";
const FALLBACK_TEAMS_JSON_URL = "./teams_stats.json";
const RUNTIME_CACHE_NAME = "foot-stats-coach.data.v2";

function nowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function supportsDecompressionStream() {
  return typeof DecompressionStream !== "undefined";
}

function hasGzipSuffix(url) {
  const text = String(url || "");
  const noQuery = text.split("?")[0];
  return noQuery.endsWith(".gz");
}

function stripGzipSuffix(url) {
  const text = String(url || "");
  const [path, query] = text.split("?");
  if (!path || !path.endsWith(".gz")) {
    return text;
  }
  return query ? `${path.slice(0, -3)}?${query}` : path.slice(0, -3);
}

function cleanUrl(url, fallbackUrl) {
  if (typeof url === "string" && url.trim()) {
    return url.trim();
  }
  return fallbackUrl;
}

async function readRuntimeCache(url) {
  if (!("caches" in globalThis)) {
    return null;
  }
  try {
    const cache = await caches.open(RUNTIME_CACHE_NAME);
    const cachedResponse = await cache.match(url);
    return cachedResponse || null;
  } catch (_error) {
    return null;
  }
}

async function writeRuntimeCache(url, response) {
  if (!("caches" in globalThis)) {
    return;
  }
  try {
    const cache = await caches.open(RUNTIME_CACHE_NAME);
    await cache.put(url, response);
  } catch (_error) {
    // Ignore cache write failures (private mode, quota, etc.).
  }
}

async function parseJsonFromResponse(response, url) {
  const targetIsGzip = hasGzipSuffix(url);
  if (!targetIsGzip) {
    try {
      return await response.json();
    } catch (error) {
      throw new Error(`JSON invalide dans ${url}: ${error.message}`);
    }
  }

  if (!supportsDecompressionStream()) {
    throw new Error(
      "Le navigateur ne supporte pas DecompressionStream pour lire un JSON compresse (.gz)."
    );
  }

  if (!response.body) {
    throw new Error(`Le flux reponse est indisponible pour ${url}.`);
  }

  try {
    const decompressed = response.body.pipeThrough(new DecompressionStream("gzip"));
    const text = await new Response(decompressed).text();
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`JSON .gz invalide dans ${url}: ${error.message}`);
  }
}

async function requestJson(url) {
  const fromRuntimeCache = await readRuntimeCache(url);
  if (fromRuntimeCache) {
    const data = await parseJsonFromResponse(fromRuntimeCache.clone(), url);
    return {
      data,
      urlUsed: url,
      cacheMode: "runtime-cache",
    };
  }

  const response = await fetch(url, { cache: "default" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} (${response.statusText}) sur ${url}`);
  }

  await writeRuntimeCache(url, response.clone());
  const data = await parseJsonFromResponse(response, url);
  return {
    data,
    urlUsed: url,
    cacheMode: "network",
  };
}

async function fetchJsonWithFallback(url) {
  const isGzip = hasGzipSuffix(url);
  try {
    return await requestJson(url);
  } catch (firstError) {
    if (!isGzip) {
      throw firstError;
    }
    const fallbackUrl = stripGzipSuffix(url);
    const fallbackResult = await requestJson(fallbackUrl);
    return {
      ...fallbackResult,
      warnings: [
        `Fallback actif: ${url} indisponible, utilisation de ${fallbackUrl}.`,
      ],
    };
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

export async function loadFromConfiguredPaths(config = {}, options = {}) {
  const startedAt = nowMs();
  const onProgress =
    typeof options.onProgress === "function" ? options.onProgress : () => {};

  const defaultConfig = globalThis.APP_DEFAULT_CONFIG || {};
  const playersUrl = cleanUrl(
    config.playersUrl || defaultConfig.PLAYERS_JSON_URL,
    FALLBACK_PLAYERS_JSON_URL
  );
  const teamsUrl = cleanUrl(
    config.teamsUrl || defaultConfig.TEAMS_JSON_URL,
    FALLBACK_TEAMS_JSON_URL
  );

  onProgress("Telechargement des donnees joueurs...");

  const [playersResult, teamsResult] = await Promise.allSettled([
    fetchJsonWithFallback(playersUrl),
    fetchJsonWithFallback(teamsUrl),
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

  const rawPlayersSource = playersResult.value.data;
  const rawTeamsSource = teamsResult.status === "fulfilled" ? teamsResult.value.data : null;

  onProgress("Validation de la structure des fichiers...");

  const playersBundle = ensurePlayersArray(rawPlayersSource);
  if (!playersBundle.players.length) {
    throw buildLoadFailure(
      "Le JSON joueurs est present, mais sa structure n'est pas reconnue.",
      `Chemin detecte: ${playersBundle.report.path}\nScore heuristique: ${playersBundle.report.score}`
    );
  }

  const teamsBundle = ensureTeamsObject(rawTeamsSource);
  const warnings = [];
  if (Array.isArray(playersResult.value.warnings)) {
    warnings.push(...playersResult.value.warnings);
  }
  if (teamsResult.status === "fulfilled" && Array.isArray(teamsResult.value.warnings)) {
    warnings.push(...teamsResult.value.warnings);
  }

  if (teamsResult.status === "rejected") {
    warnings.push(`Le fichier teams_stats n'a pas ete charge: ${teamsResult.reason.message}`);
  } else if (!teamsBundle.report.found) {
    warnings.push("Aucun classement detecte dans teams_stats.");
  }

  const finishedAt = nowMs();
  return {
    mode: "fixed-json-files",
    playersArray: playersBundle.players,
    teamsObject: teamsBundle.teamsObject,
    warnings,
    rawPlayersSource,
    rawTeamsSource,
    diagnostics: {
      playersUrl: playersResult.value.urlUsed,
      teamsUrl: teamsResult.status === "fulfilled" ? teamsResult.value.urlUsed : teamsUrl,
      playersSource: playersResult.value.cacheMode,
      teamsSource: teamsResult.status === "fulfilled" ? teamsResult.value.cacheMode : "error",
      loadMs: Math.round(finishedAt - startedAt),
    },
  };
}
