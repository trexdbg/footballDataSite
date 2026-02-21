const PLAYERS_URL = "players_stats.json";
const TEAMS_URL = "teams_stats.json";

const RANKING_METRICS = [
  { id: "goals_per90", label: "Buts /90" },
  { id: "assists_per90", label: "Passes decisives /90" },
  { id: "shots_on_target_per90", label: "Tirs cadres /90" },
  { id: "shots_per90", label: "Tirs /90" },
  { id: "accurate_pass_per90", label: "Passes reussies /90" },
  { id: "final_third_passes_per90", label: "Passes dernier tiers /90" },
  { id: "tackles_won_per90", label: "Tacles gagnes /90" },
  { id: "interceptions_per90", label: "Interceptions /90" },
  { id: "duels_won_per90", label: "Duels gagnes /90" },
  { id: "pass_accuracy_pct", label: "Precision de passe %" },
];

const RADAR_METRICS = [
  { id: "goals_per90", label: "Buts" },
  { id: "assists_per90", label: "Assists" },
  { id: "shots_on_target_per90", label: "Tirs cadres" },
  { id: "accurate_pass_per90", label: "Passes" },
  { id: "final_third_passes_per90", label: "Dernier tiers" },
  { id: "tackles_won_per90", label: "Tacles" },
  { id: "interceptions_per90", label: "Interceptions" },
  { id: "duels_won_per90", label: "Duels" },
];

const COLORS = {
  player: "#2f6e4f",
  playerSoft: "rgba(47, 110, 79, 0.26)",
  benchmark: "#d2792a",
  benchmarkSoft: "rgba(210, 121, 42, 0.24)",
  grid: "rgba(95, 109, 91, 0.3)",
  label: "#445240",
};

const DEFAULT_BENCHMARK_MIN_MINUTES = 180;

const state = {
  players: [],
  competitions: [],
  selectedPlayerSlug: null,
  competitionFilter: "all",
  benchmarkPosition: "same",
  benchmarkMinMinutes: DEFAULT_BENCHMARK_MIN_MINUTES,
  search: "",
  pendingRandom: false,
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  init().catch((error) => {
    console.error(error);
    showError("Impossible de charger le profil joueur.");
  });
});

async function init() {
  cacheElements();
  bindEvents();

  const [playersPayload, teamsPayload] = await Promise.all([fetchJson(PLAYERS_URL), fetchJson(TEAMS_URL)]);
  const competitionIndex = buildCompetitionIndex(teamsPayload.standings || []);

  state.players = playersPayload.data
    .map((row) => mapPlayer(row, competitionIndex.clubToCompetition))
    .filter((player) => player.minutes > 0 || player.matches > 0);
  state.competitions = competitionIndex.competitions;

  hydrateStateFromQuery();
  ensureSelection();
  fillControls();
  runPipeline();

  window.addEventListener("resize", debounce(() => drawRadar(), 140));
}

function cacheElements() {
  elements.playerPageTitle = document.getElementById("playerPageTitle");
  elements.playerMetaText = document.getElementById("playerMetaText");
  elements.playerBreadcrumbs = document.getElementById("playerBreadcrumbs");
  elements.playerSearchInput = document.getElementById("playerSearchInput");
  elements.playerCompetitionFilter = document.getElementById("playerCompetitionFilter");
  elements.playerSelect = document.getElementById("playerSelect");
  elements.benchmarkPosition = document.getElementById("benchmarkPosition");
  elements.benchmarkMinMinutes = document.getElementById("benchmarkMinMinutes");
  elements.openPlayerClub = document.getElementById("openPlayerClub");
  elements.openPlayerLeague = document.getElementById("openPlayerLeague");
  elements.openRandomPlayerProfile = document.getElementById("openRandomPlayerProfile");
  elements.playerSummaryText = document.getElementById("playerSummaryText");
  elements.playerHero = document.getElementById("playerHero");
  elements.rankLeagueCard = document.getElementById("rankLeagueCard");
  elements.rankPositionCard = document.getElementById("rankPositionCard");
  elements.minutesCard = document.getElementById("minutesCard");
  elements.impactCard = document.getElementById("impactCard");
  elements.playerRankingMeta = document.getElementById("playerRankingMeta");
  elements.playerRankingTableBody = document.getElementById("playerRankingTableBody");
  elements.playerBenchmarkRadar = document.getElementById("playerBenchmarkRadar");
  elements.playerBenchmarkLegend = document.getElementById("playerBenchmarkLegend");
  elements.playerBenchmarkGrid = document.getElementById("playerBenchmarkGrid");
}

function bindEvents() {
  elements.playerSearchInput.addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    const hit = selectablePlayers().find((player) => normalize(player.name).includes(normalize(state.search)));
    if (hit) {
      state.selectedPlayerSlug = hit.slug;
      runPipeline();
    }
  });

  elements.playerCompetitionFilter.addEventListener("change", (event) => {
    state.competitionFilter = event.target.value;
    ensureSelection();
    fillPlayerSelect();
    runPipeline();
  });

  elements.playerSelect.addEventListener("change", (event) => {
    state.selectedPlayerSlug = event.target.value;
    runPipeline();
  });

  elements.benchmarkPosition.addEventListener("change", (event) => {
    state.benchmarkPosition = event.target.value;
    runPipeline();
  });

  elements.benchmarkMinMinutes.addEventListener("change", (event) => {
    state.benchmarkMinMinutes = clampNumber(event.target.value, 0, 99999, DEFAULT_BENCHMARK_MIN_MINUTES);
    event.target.value = String(state.benchmarkMinMinutes);
    runPipeline();
  });

  elements.openRandomPlayerProfile.addEventListener("click", (event) => {
    event.preventDefault();
    const candidates = selectablePlayers();
    if (!candidates.length) {
      return;
    }
    state.selectedPlayerSlug = candidates[Math.floor(Math.random() * candidates.length)].slug;
    runPipeline();
  });
}

function runPipeline() {
  if (state.pendingRandom) {
    const candidates = selectablePlayers();
    if (candidates.length) {
      state.selectedPlayerSlug = candidates[Math.floor(Math.random() * candidates.length)].slug;
    }
    state.pendingRandom = false;
    fillPlayerSelect();
  }

  const selectedPlayer = state.players.find((player) => player.slug === state.selectedPlayerSlug) || null;
  if (!selectedPlayer) {
    showError("Joueur introuvable pour cette selection.");
    return;
  }

  const competitionPlayers = state.players.filter(
    (player) => player.competitionSlug === selectedPlayer.competitionSlug && player.minutes >= state.benchmarkMinMinutes,
  );
  const positionKey = state.benchmarkPosition === "same" ? selectedPlayer.position : state.benchmarkPosition;
  const benchmarkPool = competitionPlayers.filter((player) => player.position === positionKey);

  fillPositionSelect(selectedPlayer);
  fillPlayerSelect();
  renderContext(selectedPlayer, competitionPlayers, benchmarkPool, positionKey);
  renderRankingTable(selectedPlayer, competitionPlayers, benchmarkPool);
  renderBenchmark(selectedPlayer, benchmarkPool, competitionPlayers, positionKey);
  syncUrl(selectedPlayer);
}

function renderContext(selectedPlayer, competitionPlayers, benchmarkPool, positionKey) {
  const leagueUrl = `teams.html?competition=${encodeURIComponent(selectedPlayer.competitionSlug)}`;
  const clubUrl = `club.html?competition=${encodeURIComponent(selectedPlayer.competitionSlug)}&club=${encodeURIComponent(selectedPlayer.clubSlug)}`;
  const playersUrl = `players.html?competition=${encodeURIComponent(selectedPlayer.competitionSlug)}&position=${encodeURIComponent(selectedPlayer.position)}`;
  const competitionName = selectedPlayer.competitionName;

  elements.playerPageTitle.textContent = `${selectedPlayer.name} - profil avance`;
  elements.playerMetaText.textContent = `${competitionName} | ${selectedPlayer.clubName} | ${selectedPlayer.position}`;
  elements.playerSummaryText.textContent = `${competitionPlayers.length} joueurs de reference en championnat`;

  elements.playerBreadcrumbs.innerHTML = `
    <a class="inline-link" href="${leagueUrl}">${escapeHtml(competitionName)}</a>
    <span>/</span>
    <a class="inline-link" href="${clubUrl}">${escapeHtml(selectedPlayer.clubName)}</a>
    <span>/</span>
    <a class="inline-link" href="${playersUrl}">Liste joueurs</a>
  `;

  elements.playerHero.innerHTML = `
    <div class="player-hero-main">
      ${imageTag(selectedPlayer.imageUrl, selectedPlayer.name)}
      <div>
        <h3>${escapeHtml(selectedPlayer.name)}</h3>
        <p>${escapeHtml(selectedPlayer.position)} - ${escapeHtml(selectedPlayer.clubName)}</p>
      </div>
    </div>
  `;

  const rankLeagueGoals = rankByMetric(selectedPlayer, competitionPlayers, "goals_per90");
  const rankPositionGoals = rankByMetric(selectedPlayer, benchmarkPool, "goals_per90");
  const impactPercentile = percentileMean(selectedPlayer, competitionPlayers, RADAR_METRICS.map((metric) => metric.id));

  elements.rankLeagueCard.innerHTML = kpiTemplate(
    "Rang buts /90 (championnat)",
    rankLeagueGoals ? `#${rankLeagueGoals}/${competitionPlayers.length}` : "-",
    "Tous postes",
  );
  elements.rankPositionCard.innerHTML = kpiTemplate(
    `Rang buts /90 (${positionKey})`,
    rankPositionGoals ? `#${rankPositionGoals}/${benchmarkPool.length}` : "-",
    "Meme poste",
  );
  elements.minutesCard.innerHTML = kpiTemplate(
    "Temps de jeu",
    `${formatNumber(selectedPlayer.minutes, 0)} min`,
    `${formatNumber(selectedPlayer.matches, 0)} matchs`,
  );
  elements.impactCard.innerHTML = kpiTemplate(
    "Impact global",
    `${formatNumber(impactPercentile, 1)}e pct`,
    "Moyenne des percentiles radar",
  );

  elements.openPlayerClub.href = clubUrl;
  elements.openPlayerLeague.href = leagueUrl;
  elements.openRandomPlayerProfile.href = "#";
}

function renderRankingTable(selectedPlayer, competitionPlayers, benchmarkPool) {
  elements.playerRankingMeta.textContent = `${competitionPlayers.length} joueurs dans le benchmark championnat`;
  elements.playerRankingTableBody.innerHTML = RANKING_METRICS.map((metric) => {
    const value = metricValue(selectedPlayer, metric.id);
    const leagueRank = rankByMetric(selectedPlayer, competitionPlayers, metric.id);
    const positionRank = rankByMetric(selectedPlayer, benchmarkPool, metric.id);
    const percentile = percentileByMetric(selectedPlayer, competitionPlayers, metric.id);
    const topUrl = `players.html?competition=${encodeURIComponent(selectedPlayer.competitionSlug)}&metric=${encodeURIComponent(metric.id)}&position=${encodeURIComponent(selectedPlayer.position)}`;
    return `
      <tr>
        <td>${escapeHtml(metric.label)}</td>
        <td><strong>${formatMetric(value, metric.id)}</strong></td>
        <td>${leagueRank ? `#${leagueRank}/${competitionPlayers.length}` : "-"}</td>
        <td>${positionRank ? `#${positionRank}/${benchmarkPool.length}` : "-"}</td>
        <td>${formatNumber(percentile, 1)}e pct</td>
        <td><a class="inline-link" href="${topUrl}">Top stat</a></td>
      </tr>
    `;
  }).join("");
}

function renderBenchmark(selectedPlayer, benchmarkPool, competitionPlayers, positionKey) {
  const average = averageProfile(benchmarkPool);
  elements.playerBenchmarkLegend.innerHTML = `
    <div class="legend-item">
      <span class="dot" style="background:${COLORS.player};"></span>
      <span>${escapeHtml(selectedPlayer.name)}</span>
    </div>
    <div class="legend-item">
      <span class="dot" style="background:${COLORS.benchmark};"></span>
      <span>Moyenne ${escapeHtml(positionKey)} (${benchmarkPool.length} joueurs)</span>
    </div>
  `;

  elements.playerBenchmarkGrid.innerHTML = RADAR_METRICS.map((metric) => {
    const p = metricValue(selectedPlayer, metric.id);
    const avg = average[metric.id] || 0;
    const diff = p - avg;
    const cls = diff >= 0 ? "text-good" : "text-warn";
    return `
      <article class="metric-item">
        <strong>${escapeHtml(metric.label)}</strong>
        <p>Joueur: ${formatMetric(p, metric.id)}</p>
        <p>Moyenne: ${formatMetric(avg, metric.id)}</p>
        <p class="${cls}">Ecart: ${formatNumber(Math.abs(diff), 2)}</p>
      </article>
    `;
  }).join("");

  drawRadar(selectedPlayer, average, competitionPlayers);
}

function drawRadar(selectedPlayer = null, averageProfileData = null, competitionPlayers = null) {
  if (!selectedPlayer || !averageProfileData || !competitionPlayers?.length) {
    clearCanvas(elements.playerBenchmarkRadar);
    return;
  }

  const { ctx, width, height } = prepareCanvas(elements.playerBenchmarkRadar);
  if (!ctx) {
    return;
  }

  const center = { x: width / 2, y: height / 2 };
  const radius = Math.min(width, height) * 0.34;
  const angleStep = (Math.PI * 2) / RADAR_METRICS.length;
  const startAngle = -Math.PI / 2;

  const maxByMetric = {};
  for (const metric of RADAR_METRICS) {
    maxByMetric[metric.id] = Math.max(...competitionPlayers.map((player) => metricValue(player, metric.id)), 0.001);
  }

  drawRadarGrid(ctx, center, radius, RADAR_METRICS.length, 5, startAngle, angleStep);
  drawRadarLabels(ctx, center, radius + 20, startAngle, angleStep);

  const pointsPlayer = RADAR_METRICS.map((metric, index) => {
    const ratio = clamp(metricValue(selectedPlayer, metric.id) / maxByMetric[metric.id], 0, 1);
    return polar(center, radius * ratio, startAngle + index * angleStep);
  });

  const pointsAverage = RADAR_METRICS.map((metric, index) => {
    const ratio = clamp((averageProfileData[metric.id] || 0) / maxByMetric[metric.id], 0, 1);
    return polar(center, radius * ratio, startAngle + index * angleStep);
  });

  drawRadarShape(ctx, pointsAverage, COLORS.benchmark, COLORS.benchmarkSoft);
  drawRadarShape(ctx, pointsPlayer, COLORS.player, COLORS.playerSoft);
}

function fillControls() {
  fillSelect(
    elements.playerCompetitionFilter,
    [{ value: "all", label: "Toutes" }, ...state.competitions.map((competition) => ({ value: competition.slug, label: competition.name }))],
    state.competitionFilter,
  );
  fillPositionSelect();
  fillPlayerSelect();
  elements.playerSearchInput.value = state.search;
  elements.benchmarkMinMinutes.value = String(state.benchmarkMinMinutes);
}

function fillPlayerSelect() {
  const options = selectablePlayers().map((player) => ({
    value: player.slug,
    label: `${player.name} (${player.position} - ${player.clubName})`,
  }));
  fillSelect(elements.playerSelect, options, state.selectedPlayerSlug);
}

function fillPositionSelect(selectedPlayer = null) {
  const positions = uniqueSorted(selectablePlayers().map((player) => player.position));
  fillSelect(
    elements.benchmarkPosition,
    [
      { value: "same", label: "Meme poste que le joueur" },
      ...positions.map((position) => ({ value: position, label: position })),
    ],
    state.benchmarkPosition,
  );
  if (selectedPlayer && state.benchmarkPosition !== "same" && !positions.includes(state.benchmarkPosition)) {
    state.benchmarkPosition = "same";
    elements.benchmarkPosition.value = "same";
  }
}

function selectablePlayers() {
  if (state.competitionFilter === "all") {
    return state.players;
  }
  return state.players.filter((player) => player.competitionSlug === state.competitionFilter);
}

function ensureSelection() {
  let selectable = selectablePlayers();
  if (!selectable.length && state.competitionFilter !== "all") {
    state.competitionFilter = "all";
    selectable = selectablePlayers();
  }
  if (!selectable.length) {
    state.selectedPlayerSlug = null;
    return;
  }

  if (state.selectedPlayerSlug && selectable.some((player) => player.slug === state.selectedPlayerSlug)) {
    return;
  }

  state.selectedPlayerSlug = selectable[0].slug;
}

function hydrateStateFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const queryPlayer = params.get("player");
  const queryCompetition = params.get("competition");
  const queryBenchmarkPos = params.get("benchmarkPosition");

  if (queryCompetition) {
    state.competitionFilter = queryCompetition;
  }
  if (queryPlayer) {
    state.selectedPlayerSlug = queryPlayer;
  }
  if (queryBenchmarkPos) {
    state.benchmarkPosition = queryBenchmarkPos;
  }

  state.search = (params.get("search") || "").trim().toLowerCase();
  state.benchmarkMinMinutes = clampNumber(params.get("benchmarkMinMinutes"), 0, 99999, DEFAULT_BENCHMARK_MIN_MINUTES);
  state.pendingRandom = params.get("random") === "1";
}

function syncUrl(selectedPlayer) {
  const params = new URLSearchParams();
  if (selectedPlayer?.slug) {
    params.set("player", selectedPlayer.slug);
  }
  if (state.competitionFilter !== "all") {
    params.set("competition", state.competitionFilter);
  }
  if (state.benchmarkPosition !== "same") {
    params.set("benchmarkPosition", state.benchmarkPosition);
  }
  if (state.search) {
    params.set("search", state.search);
  }
  if (state.benchmarkMinMinutes !== DEFAULT_BENCHMARK_MIN_MINUTES) {
    params.set("benchmarkMinMinutes", String(state.benchmarkMinMinutes));
  }
  const targetSearch = params.toString() ? `?${params.toString()}` : "";
  if (window.location.search !== targetSearch) {
    window.history.replaceState(null, "", `${window.location.pathname}${targetSearch}`);
  }
}

function rankByMetric(targetPlayer, players, metricId) {
  if (!targetPlayer || !players.length) {
    return null;
  }
  const sorted = [...players].sort((a, b) => metricValue(b, metricId) - metricValue(a, metricId));
  const index = sorted.findIndex((player) => player.slug === targetPlayer.slug);
  return index >= 0 ? index + 1 : null;
}

function percentileByMetric(targetPlayer, players, metricId) {
  if (!targetPlayer || !players.length) {
    return 0;
  }
  const value = metricValue(targetPlayer, metricId);
  const lowerOrEqual = players.filter((player) => metricValue(player, metricId) <= value).length;
  return (lowerOrEqual / players.length) * 100;
}

function percentileMean(targetPlayer, players, metricIds) {
  if (!players.length || !metricIds.length) {
    return 0;
  }
  const sum = metricIds.reduce((acc, metricId) => acc + percentileByMetric(targetPlayer, players, metricId), 0);
  return sum / metricIds.length;
}

function averageProfile(players) {
  const output = {};
  for (const metric of RADAR_METRICS) {
    const total = players.reduce((acc, player) => acc + metricValue(player, metric.id), 0);
    output[metric.id] = players.length ? total / players.length : 0;
  }
  return output;
}

function drawRadarGrid(ctx, center, radius, axisCount, levels, startAngle, step) {
  ctx.save();
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let level = 1; level <= levels; level += 1) {
    const ratio = level / levels;
    ctx.beginPath();
    for (let i = 0; i < axisCount; i += 1) {
      const point = polar(center, radius * ratio, startAngle + i * step);
      if (i === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    }
    ctx.closePath();
    ctx.stroke();
  }
  for (let i = 0; i < axisCount; i += 1) {
    const tip = polar(center, radius, startAngle + i * step);
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRadarLabels(ctx, center, radius, startAngle, step) {
  ctx.save();
  ctx.fillStyle = COLORS.label;
  ctx.font = "12px IBM Plex Sans";
  for (let i = 0; i < RADAR_METRICS.length; i += 1) {
    const point = polar(center, radius, startAngle + i * step);
    ctx.textAlign = point.x < center.x - 10 ? "right" : point.x > center.x + 10 ? "left" : "center";
    ctx.textBaseline = point.y > center.y + 8 ? "top" : point.y < center.y - 8 ? "bottom" : "middle";
    ctx.fillText(RADAR_METRICS[i].label, point.x, point.y);
  }
  ctx.restore();
}

function drawRadarShape(ctx, points, stroke, fill) {
  ctx.save();
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  });
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();

  for (const point of points) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = stroke;
    ctx.fill();
  }
  ctx.restore();
}

function mapPlayer(row, clubToCompetition) {
  const season = resolveSeasonRecord(row);
  let minutes = Number(season?.minutes || season?.minutes_played || 0);
  let matches = Number(season?.matches_played || 0);
  let per90 = toNumberObject(season?.stats_per90 || {});

  if (Array.isArray(row.last5_matches) && row.last5_matches.length > 0) {
    const fallback = aggregateFromLastMatches(row.last5_matches);
    if (minutes <= 0) {
      minutes = fallback.minutes;
    }
    if (matches <= 0) {
      matches = fallback.matches;
    }
    per90 = mergeNumberObjects(fallback.per90, per90);
  }

  const clubSlug = String(row.club_slug || "unknown");
  const competition = clubToCompetition.get(clubSlug) || { slug: "unknown", name: "Competition" };
  const accuratePass = Number(per90.accurate_pass || 0);
  const missedPass = Number(per90.missed_pass || 0);
  const passAccuracy = accuratePass + missedPass > 0 ? (accuratePass * 100) / (accuratePass + missedPass) : 0;

  return {
    slug: String(row.slug || ""),
    name: repairText(row.name || "Unknown"),
    position: normalizePosition(row.position || "Unknown"),
    clubSlug,
    clubName: prettifySlug(clubSlug),
    competitionSlug: competition.slug,
    competitionName: competition.name,
    imageUrl: String(row.player_image_url || ""),
    minutes,
    matches,
    per90,
    passAccuracy,
  };
}

function metricValue(player, metricId) {
  switch (metricId) {
    case "goals_per90":
      return Number(player.per90.goals || 0);
    case "assists_per90":
      return Number(player.per90.assists || 0);
    case "shots_on_target_per90":
      return Number(player.per90.ontarget_scoring_att || 0);
    case "shots_per90":
      return Number(player.per90.total_scoring_att || 0);
    case "accurate_pass_per90":
      return Number(player.per90.accurate_pass || 0);
    case "final_third_passes_per90":
      return Number(player.per90.successful_final_third_passes || 0);
    case "tackles_won_per90":
      return Number(player.per90.won_tackle || 0);
    case "interceptions_per90":
      return Number(player.per90.interception_won || 0);
    case "duels_won_per90":
      return Number(player.per90.duel_won || 0);
    case "pass_accuracy_pct":
      return Number(player.passAccuracy || 0);
    default:
      return 0;
  }
}

function resolveSeasonRecord(row) {
  const seasonSums = row.season_sums || {};
  const key = Object.keys(seasonSums).sort((a, b) => b.localeCompare(a))[0];
  return key ? seasonSums[key] : null;
}

function aggregateFromLastMatches(matches) {
  const totals = {};
  let minutes = 0;
  for (const match of matches) {
    const stats = match?.stats || {};
    const mins = Number(match?.minutes_played || stats.mins_played || 0);
    minutes += mins;
    for (const [key, rawValue] of Object.entries(stats)) {
      totals[key] = Number(totals[key] || 0) + Number(rawValue || 0);
    }
  }
  const factor = minutes > 0 ? 90 / minutes : 0;
  const per90 = {};
  for (const [key, total] of Object.entries(totals)) {
    per90[key] = Number(total) * factor;
  }
  return { minutes, matches: matches.length, per90 };
}

function toNumberObject(input) {
  const output = {};
  for (const [key, value] of Object.entries(input || {})) {
    output[key] = Number(value || 0);
  }
  return output;
}

function mergeNumberObjects(base, override) {
  const output = toNumberObject(base || {});
  for (const [key, value] of Object.entries(override || {})) {
    output[key] = Number(value || 0);
  }
  return output;
}

function buildCompetitionIndex(standings) {
  const clubToCompetition = new Map();
  const map = new Map();
  for (const standing of standings || []) {
    const slug = String(standing.competition_slug || "");
    const name = repairText(standing.competition_name || slug || "Competition");
    map.set(slug, { slug, name });
    for (const row of standing.table || []) {
      clubToCompetition.set(String(row.club_slug || ""), { slug, name });
    }
  }
  const competitions = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  return { clubToCompetition, competitions };
}

function kpiTemplate(label, value, detail) {
  return `
    <small>${escapeHtml(label)}</small>
    <strong>${escapeHtml(value || "-")}</strong>
    <span>${escapeHtml(detail || "-")}</span>
  `;
}

function imageTag(url, alt) {
  const safeAlt = escapeHtml(alt || "avatar");
  if (!url) {
    return '<span class="avatar avatar-xl" aria-hidden="true"></span>';
  }
  return `<img class="avatar avatar-xl" src="${escapeHtml(url)}" alt="${safeAlt}" loading="lazy" />`;
}

function fillSelect(selectElement, options, selected = null) {
  selectElement.innerHTML = "";
  for (const option of options) {
    const node = document.createElement("option");
    node.value = option.value;
    node.textContent = option.label;
    selectElement.appendChild(node);
  }
  if (selected !== null) {
    selectElement.value = selected;
  }
}

function prepareCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return { ctx: null, width: 0, height: 0 };
  }

  const ratio = window.devicePixelRatio || 1;
  const targetWidth = Math.floor(rect.width * ratio);
  const targetHeight = Math.floor(rect.height * ratio);
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { ctx: null, width: 0, height: 0 };
  }

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  return { ctx, width: rect.width, height: rect.height };
}

function clearCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function polar(center, radius, angle) {
  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius,
  };
}

function uniqueSorted(items) {
  return [...new Set(items.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function normalize(input) {
  return String(input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function normalizePosition(position) {
  return repairText(String(position || "Unknown"));
}

function formatNumber(value, digits = 2) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric.toFixed(digits) : "0";
}

function formatMetric(value, metricId) {
  return metricId === "pass_accuracy_pct" ? `${formatNumber(value, 1)}%` : formatNumber(value, 2);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clampNumber(raw, min, max, fallback) {
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return clamp(Math.round(numeric), min, max);
}

function prettifySlug(slug) {
  return repairText(
    String(slug || "")
      .replaceAll("-", " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (part) => part.toUpperCase()),
  );
}

function repairText(input) {
  const raw = String(input || "");
  if (!/[ÃƒÃ‚]/.test(raw)) {
    return raw;
  }
  try {
    const bytes = Uint8Array.from(raw, (char) => char.charCodeAt(0));
    const decoded = new TextDecoder("utf-8").decode(bytes);
    return decoded || raw;
  } catch {
    return raw;
  }
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Echec chargement ${url}: ${response.status}`);
  }
  return response.json();
}

function escapeHtml(input) {
  return String(input ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function debounce(callback, waitMs) {
  let timeout = null;
  return (...args) => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => callback(...args), waitMs);
  };
}

function showError(message) {
  elements.playerPageTitle.textContent = "Erreur";
  elements.playerMetaText.textContent = message;
  elements.playerSummaryText.textContent = message;
  elements.playerRankingTableBody.innerHTML = `<tr><td colspan="6" class="is-empty">${escapeHtml(message)}</td></tr>`;
  elements.playerBenchmarkGrid.innerHTML = `<p class="is-empty">${escapeHtml(message)}</p>`;
  clearCanvas(elements.playerBenchmarkRadar);
}
