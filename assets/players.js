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
  { id: "contests_won_per90", label: "Contests gagnes /90" },
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

const LEADER_METRICS = [
  "goals_per90",
  "assists_per90",
  "shots_on_target_per90",
  "final_third_passes_per90",
  "tackles_won_per90",
  "interceptions_per90",
  "duels_won_per90",
  "pass_accuracy_pct",
];

const COLORS = {
  playerA: "#7aafeb",
  playerASoft: "rgba(122, 175, 235, 0.28)",
  playerB: "#f7a8b6",
  playerBSoft: "rgba(247, 168, 182, 0.28)",
  grid: "rgba(123, 145, 167, 0.28)",
  label: "#566d84",
};

const DEFAULT_TABLE_LIMIT = 50;
const DEFAULT_MIN_MINUTES = 180;

const state = {
  payload: null,
  players: [],
  filtered: [],
  competitions: [],
  search: "",
  competition: "all",
  position: "all",
  club: "all",
  minMinutes: DEFAULT_MIN_MINUTES,
  rankingMetric: "goals_per90",
  tableLimit: DEFAULT_TABLE_LIMIT,
  compareA: null,
  compareB: null,
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  init().catch((error) => {
    console.error(error);
    showError("Impossible de charger players_stats.json");
  });
});

async function init() {
  cacheElements();
  bindEvents();

  const [playersPayload, teamsPayload] = await Promise.all([fetchJson(PLAYERS_URL), fetchJson(TEAMS_URL)]);
  const competitionIndex = buildCompetitionIndex(teamsPayload.standings || []);

  state.payload = playersPayload;
  state.competitions = competitionIndex.competitions;
  state.players = playersPayload.data
    .map((row) => mapPlayer(row, competitionIndex.clubToCompetition))
    .filter((player) => player.minutes > 0 || player.matches > 0);

  hydrateStateFromQuery();
  fillRankingMetricSelect();
  fillFilters();
  renderMetaHeader();
  runPipeline();

  window.addEventListener("resize", debounce(() => drawRadar(), 140));
}

function cacheElements() {
  elements.playersMetaText = document.getElementById("playersMetaText");
  elements.playersHeaderLinks = document.getElementById("playersHeaderLinks");
  elements.playerSearch = document.getElementById("playerSearch");
  elements.competitionFilter = document.getElementById("competitionFilter");
  elements.positionFilter = document.getElementById("positionFilter");
  elements.clubFilter = document.getElementById("clubFilter");
  elements.minMinutes = document.getElementById("minMinutes");
  elements.rankingMetric = document.getElementById("rankingMetric");
  elements.tableLimit = document.getElementById("tableLimit");
  elements.openTeamsFromPlayers = document.getElementById("openTeamsFromPlayers");
  elements.openRandomPlayerFromList = document.getElementById("openRandomPlayerFromList");
  elements.playersCountText = document.getElementById("playersCountText");
  elements.playersTableBody = document.getElementById("playersTableBody");
  elements.rankingMetricHead = document.getElementById("rankingMetricHead");
  elements.leadersCountText = document.getElementById("leadersCountText");
  elements.leadersGrid = document.getElementById("leadersGrid");
  elements.comparePlayerA = document.getElementById("comparePlayerA");
  elements.comparePlayerB = document.getElementById("comparePlayerB");
  elements.playersRadar = document.getElementById("playersRadar");
  elements.playersLegend = document.getElementById("playersLegend");
  elements.playersMetricGrid = document.getElementById("playersMetricGrid");
}

function bindEvents() {
  elements.playerSearch.addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    runPipeline();
  });

  elements.competitionFilter.addEventListener("change", (event) => {
    state.competition = event.target.value;
    updateClubFilterOptions();
    runPipeline();
  });

  elements.positionFilter.addEventListener("change", (event) => {
    state.position = event.target.value;
    runPipeline();
  });

  elements.clubFilter.addEventListener("change", (event) => {
    state.club = event.target.value;
    runPipeline();
  });

  elements.minMinutes.addEventListener("change", (event) => {
    state.minMinutes = clampNumber(event.target.value, 0, 99999, DEFAULT_MIN_MINUTES);
    event.target.value = String(state.minMinutes);
    runPipeline();
  });

  elements.rankingMetric.addEventListener("change", (event) => {
    state.rankingMetric = event.target.value;
    runPipeline();
  });

  elements.tableLimit.addEventListener("change", (event) => {
    state.tableLimit = clampNumber(event.target.value, 10, 500, DEFAULT_TABLE_LIMIT);
    runPipeline();
  });

  elements.comparePlayerA.addEventListener("change", (event) => {
    state.compareA = event.target.value;
    if (state.compareA === state.compareB) {
      state.compareB = state.filtered.find((player) => player.slug !== state.compareA)?.slug || state.compareA;
      elements.comparePlayerB.value = state.compareB || "";
    }
    renderComparison();
    syncUrl();
  });

  elements.comparePlayerB.addEventListener("change", (event) => {
    state.compareB = event.target.value;
    if (state.compareA === state.compareB) {
      state.compareA = state.filtered.find((player) => player.slug !== state.compareB)?.slug || state.compareB;
      elements.comparePlayerA.value = state.compareA || "";
    }
    renderComparison();
    syncUrl();
  });
}

function fillRankingMetricSelect() {
  fillSelect(
    elements.rankingMetric,
    RANKING_METRICS.map((metric) => ({ value: metric.id, label: metric.label })),
    state.rankingMetric,
  );
}

function fillFilters() {
  const positions = uniqueSorted(state.players.map((player) => player.position));

  fillSelect(
    elements.competitionFilter,
    [
      { value: "all", label: "Toutes" },
      ...state.competitions.map((item) => ({ value: item.slug, label: item.name })),
    ],
    state.competition,
  );

  fillSelect(
    elements.positionFilter,
    [{ value: "all", label: "Tous" }, ...positions.map((value) => ({ value, label: value }))],
    state.position,
  );

  updateClubFilterOptions();

  elements.playerSearch.value = state.search;
  elements.minMinutes.value = String(state.minMinutes);
  const allowedLimits = new Set(["25", "50", "100"]);
  if (!allowedLimits.has(String(state.tableLimit))) {
    const option = document.createElement("option");
    option.value = String(state.tableLimit);
    option.textContent = `Top ${state.tableLimit}`;
    elements.tableLimit.appendChild(option);
  }
  elements.tableLimit.value = String(state.tableLimit);
}

function updateClubFilterOptions() {
  const source = state.players.filter((player) => state.competition === "all" || player.competitionSlug === state.competition);
  const clubsMap = new Map();
  for (const player of source) {
    if (!clubsMap.has(player.clubSlug)) {
      clubsMap.set(player.clubSlug, player.clubName);
    }
  }

  const clubs = [...clubsMap.entries()]
    .map(([slug, name]) => ({ slug, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (state.club !== "all" && !clubs.some((club) => club.slug === state.club)) {
    state.club = "all";
  }

  fillSelect(
    elements.clubFilter,
    [{ value: "all", label: "Tous" }, ...clubs.map((club) => ({ value: club.slug, label: club.name }))],
    state.club,
  );
}

function renderMetaHeader() {
  const meta = state.payload?.meta || {};
  const playersCount = Number(meta.players_count || state.players.length || 0);
  const from = meta.coverage_from || "?";
  const to = meta.coverage_to || "?";
  const generatedAt = formatDateTime(meta.generated_at);

  elements.playersMetaText.textContent = `${playersCount} joueurs. Couverture ${from} -> ${to}. MAJ ${generatedAt}.`;
}

function runPipeline() {
  state.filtered = state.players.filter((player) => {
    const byCompetition = state.competition === "all" || player.competitionSlug === state.competition;
    const byPosition = state.position === "all" || player.position === state.position;
    const byClub = state.club === "all" || player.clubSlug === state.club;
    const byMinutes = player.minutes >= state.minMinutes;
    const searchText = normalize(`${player.name} ${player.position} ${player.clubName} ${player.competitionName}`);
    const bySearch = !state.search || searchText.includes(normalize(state.search));
    return byCompetition && byPosition && byClub && byMinutes && bySearch;
  });

  const sorted = sortPlayersByMetric(state.filtered, state.rankingMetric);
  renderContextLinks(sorted);
  renderRankingTable(sorted);
  renderLeaders();
  syncComparisonSelects(sorted);
  renderComparison();
  syncUrl();
}

function sortPlayersByMetric(players, metricId) {
  return [...players].sort((left, right) => {
    const a = metricValue(left, metricId);
    const b = metricValue(right, metricId);
    return b - a;
  });
}

function renderContextLinks(sortedPlayers) {
  const competition = competitionBySlug(state.competition);
  const titleLabel = competition?.name || "Tous les championnats";
  const teamsUrl = competition ? `teams.html?competition=${encodeURIComponent(competition.slug)}` : "teams.html";
  const randomPlayer = sortedPlayers[Math.floor(Math.random() * sortedPlayers.length)] || null;
  const randomProfileUrl = randomPlayer
    ? `player.html?player=${encodeURIComponent(randomPlayer.slug)}`
    : competition
      ? `player.html?competition=${encodeURIComponent(competition.slug)}&random=1`
      : "player.html";

  elements.playersHeaderLinks.innerHTML = `
    <a class="inline-link" href="${teamsUrl}">Classement championnat: ${escapeHtml(titleLabel)}</a>
    <a class="inline-link" href="club.html${competition ? `?competition=${encodeURIComponent(competition.slug)}` : ""}">Clubs de la selection</a>
    <a class="inline-link" href="${randomProfileUrl}">Profil joueur au hasard</a>
  `;

  elements.openTeamsFromPlayers.href = teamsUrl;
  elements.openRandomPlayerFromList.href = randomProfileUrl;
}

function renderRankingTable(sortedPlayers) {
  const limited = sortedPlayers.slice(0, state.tableLimit);
  const metricLabel = metricById(state.rankingMetric)?.label || "Metrique";

  elements.rankingMetricHead.textContent = metricLabel;
  elements.playersCountText.textContent = `${state.filtered.length} joueurs filtres`;

  if (limited.length === 0) {
    elements.playersTableBody.innerHTML = `<tr><td colspan="8" class="is-empty">Aucun joueur pour ces filtres.</td></tr>`;
    return;
  }

  elements.playersTableBody.innerHTML = limited
    .map((player, index) => {
      const rank = index + 1;
      const metric = metricValue(player, state.rankingMetric);
      const playerUrl = `player.html?player=${encodeURIComponent(player.slug)}`;
      const clubUrl = `club.html?competition=${encodeURIComponent(player.competitionSlug)}&club=${encodeURIComponent(player.clubSlug)}`;
      const competitionUrl = `teams.html?competition=${encodeURIComponent(player.competitionSlug)}`;

      return `
        <tr>
          <td>${rank}</td>
          <td>
            <div class="player-cell">
              ${imageTag(player.imageUrl, player.name)}
              <a class="inline-link strong-link" href="${playerUrl}">${escapeHtml(player.name)}</a>
            </div>
          </td>
          <td>${escapeHtml(player.position)}</td>
          <td><a class="inline-link" href="${clubUrl}">${escapeHtml(player.clubName)}</a></td>
          <td><a class="inline-link" href="${competitionUrl}">${escapeHtml(player.competitionName)}</a></td>
          <td>${formatNumber(player.minutes, 0)}</td>
          <td>${formatNumber(player.matches, 0)}</td>
          <td><strong>${formatMetric(metric, state.rankingMetric)}</strong></td>
        </tr>
      `;
    })
    .join("");
}

function renderLeaders() {
  if (!state.filtered.length) {
    elements.leadersCountText.textContent = "0 leader";
    elements.leadersGrid.innerHTML = `<p class="is-empty">Aucun leader disponible.</p>`;
    return;
  }

  const leaders = LEADER_METRICS.map((metricId) => {
    const metric = metricById(metricId);
    const top = sortPlayersByMetric(state.filtered, metricId)[0];
    if (!top || !metric) {
      return null;
    }
    return { metric, top, value: metricValue(top, metricId) };
  }).filter(Boolean);

  elements.leadersCountText.textContent = `${leaders.length} stats`;
  elements.leadersGrid.innerHTML = leaders
    .map((entry) => {
      const playerUrl = `player.html?player=${encodeURIComponent(entry.top.slug)}`;
      const clubUrl = `club.html?competition=${encodeURIComponent(entry.top.competitionSlug)}&club=${encodeURIComponent(entry.top.clubSlug)}`;
      const listUrl = buildPlayersListLink(entry.metric.id);

      return `
        <article class="leader-card">
          <small>${escapeHtml(entry.metric.label)}</small>
          <strong><a class="inline-link strong-link" href="${playerUrl}">${escapeHtml(entry.top.name)}</a></strong>
          <p>${formatMetric(entry.value, entry.metric.id)}</p>
          <p>
            <a class="inline-link" href="${clubUrl}">${escapeHtml(entry.top.clubName)}</a>
            <span> | </span>
            <a class="inline-link" href="${listUrl}">Voir top</a>
          </p>
        </article>
      `;
    })
    .join("");
}

function buildPlayersListLink(metricId) {
  const params = new URLSearchParams();
  if (state.competition !== "all") {
    params.set("competition", state.competition);
  }
  if (state.position !== "all") {
    params.set("position", state.position);
  }
  if (state.club !== "all") {
    params.set("club", state.club);
  }
  params.set("metric", metricId);
  if (state.minMinutes !== DEFAULT_MIN_MINUTES) {
    params.set("minMinutes", String(state.minMinutes));
  }
  return `players.html?${params.toString()}`;
}

function syncComparisonSelects(sortedPlayers) {
  const candidates = sortedPlayers.slice(0, 500);
  const options = candidates.map((player) => ({
    value: player.slug,
    label: `${player.name} (${player.position}, ${player.clubName})`,
  }));

  if (!candidates.length) {
    fillSelect(elements.comparePlayerA, []);
    fillSelect(elements.comparePlayerB, []);
    state.compareA = null;
    state.compareB = null;
    return;
  }

  const validSlugs = new Set(candidates.map((player) => player.slug));
  if (!state.compareA || !validSlugs.has(state.compareA)) {
    state.compareA = candidates[0].slug;
  }
  if (!state.compareB || !validSlugs.has(state.compareB) || state.compareB === state.compareA) {
    state.compareB = candidates.find((player) => player.slug !== state.compareA)?.slug || state.compareA;
  }

  fillSelect(elements.comparePlayerA, options, state.compareA);
  fillSelect(elements.comparePlayerB, options, state.compareB);
}

function renderComparison() {
  const playerA = state.filtered.find((player) => player.slug === state.compareA);
  const playerB = state.filtered.find((player) => player.slug === state.compareB);

  if (!playerA || !playerB) {
    elements.playersLegend.innerHTML = "";
    elements.playersMetricGrid.innerHTML = '<p class="is-empty">Selectionne deux joueurs.</p>';
    clearCanvas(elements.playersRadar);
    return;
  }

  elements.playersLegend.innerHTML = `
    <div class="legend-item">
      <span class="dot" style="background:${COLORS.playerA};"></span>
      <span>${escapeHtml(playerA.name)}</span>
    </div>
    <div class="legend-item">
      <span class="dot" style="background:${COLORS.playerB};"></span>
      <span>${escapeHtml(playerB.name)}</span>
    </div>
  `;

  renderMetricGrid(playerA, playerB);
  drawRadar(playerA, playerB);
}

function renderMetricGrid(playerA, playerB) {
  const html = RADAR_METRICS.map((metric) => {
    const a = metricValue(playerA, metric.id);
    const b = metricValue(playerB, metric.id);
    const diff = a - b;
    const label = diff >= 0 ? "A devant" : "B devant";
    const diffClass = diff >= 0 ? "text-good" : "text-warn";

    return `
      <article class="metric-item">
        <strong>${escapeHtml(metric.label)}</strong>
        <p>A: ${formatMetric(a, metric.id)} | B: ${formatMetric(b, metric.id)}</p>
        <p class="${diffClass}">${label}: ${formatNumber(Math.abs(diff), 2)}</p>
      </article>
    `;
  }).join("");

  elements.playersMetricGrid.innerHTML = html;
}

function drawRadar(playerA = null, playerB = null) {
  const left = playerA || state.filtered.find((player) => player.slug === state.compareA);
  const right = playerB || state.filtered.find((player) => player.slug === state.compareB);
  if (!left || !right) {
    clearCanvas(elements.playersRadar);
    return;
  }

  const { ctx, width, height } = prepareCanvas(elements.playersRadar);
  if (!ctx) {
    return;
  }

  const center = { x: width / 2, y: height / 2 };
  const radius = Math.min(width, height) * 0.34;
  const angleStep = (Math.PI * 2) / RADAR_METRICS.length;
  const startAngle = -Math.PI / 2;

  const maxByMetric = {};
  for (const metric of RADAR_METRICS) {
    const max = Math.max(
      ...state.filtered.map((player) => metricValue(player, metric.id)),
      metric.id === "pass_accuracy_pct" ? 100 : 0.001,
    );
    maxByMetric[metric.id] = max;
  }

  drawRadarGrid(ctx, center, radius, RADAR_METRICS.length, 5, startAngle, angleStep);
  drawRadarLabels(ctx, center, radius + 20, startAngle, angleStep);

  const pointsA = RADAR_METRICS.map((metric, index) => {
    const value = metricValue(left, metric.id);
    const ratio = clamp(value / maxByMetric[metric.id], 0, 1);
    return polar(center, radius * ratio, startAngle + index * angleStep);
  });

  const pointsB = RADAR_METRICS.map((metric, index) => {
    const value = metricValue(right, metric.id);
    const ratio = clamp(value / maxByMetric[metric.id], 0, 1);
    return polar(center, radius * ratio, startAngle + index * angleStep);
  });

  drawRadarShape(ctx, pointsA, COLORS.playerA, COLORS.playerASoft);
  drawRadarShape(ctx, pointsB, COLORS.playerB, COLORS.playerBSoft);
}

function drawRadarGrid(ctx, center, radius, axisCount, levels, startAngle, step) {
  ctx.save();
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;

  for (let level = 1; level <= levels; level += 1) {
    const ratio = level / levels;
    ctx.beginPath();
    for (let i = 0; i < axisCount; i += 1) {
      const p = polar(center, radius * ratio, startAngle + i * step);
      if (i === 0) {
        ctx.moveTo(p.x, p.y);
      } else {
        ctx.lineTo(p.x, p.y);
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
  ctx.font = "12px Space Grotesk";
  for (let i = 0; i < RADAR_METRICS.length; i += 1) {
    const p = polar(center, radius, startAngle + i * step);
    ctx.textAlign = p.x < center.x - 10 ? "right" : p.x > center.x + 10 ? "left" : "center";
    ctx.textBaseline = p.y > center.y + 8 ? "top" : p.y < center.y - 8 ? "bottom" : "middle";
    ctx.fillText(RADAR_METRICS[i].label, p.x, p.y);
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
  let totals = toNumberObject(season?.stats_sum || {});

  if (Array.isArray(row.last5_matches) && row.last5_matches.length > 0) {
    const fallback = aggregateFromLastMatches(row.last5_matches);
    if (minutes <= 0) {
      minutes = fallback.minutes;
    }
    if (matches <= 0) {
      matches = fallback.matches;
    }
    per90 = mergeNumberObjects(fallback.per90, per90);
    totals = mergeNumberObjects(fallback.totals, totals);
  }

  const accuratePass = Number(per90.accurate_pass || 0);
  const missedPass = Number(per90.missed_pass || 0);
  const passAccuracy = accuratePass + missedPass > 0 ? (accuratePass * 100) / (accuratePass + missedPass) : 0;
  const clubSlug = String(row.club_slug || "unknown");
  const competition = clubToCompetition.get(clubSlug) || {
    slug: "unknown",
    name: "Hors championnat",
  };

  return {
    slug: String(row.slug || ""),
    name: repairText(row.name || "Unknown"),
    position: normalizePosition(row.position || "Unknown"),
    clubSlug,
    clubName: prettifySlug(clubSlug),
    imageUrl: String(row.player_image_url || ""),
    clubLogo: String(row.club_logo_url || ""),
    competitionSlug: competition.slug,
    competitionName: competition.name,
    minutes,
    matches,
    per90,
    totals,
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
    case "contests_won_per90":
      return Number(player.per90.won_contest || 0);
    case "pass_accuracy_pct":
      return Number(player.passAccuracy || 0);
    default:
      return 0;
  }
}

function metricById(metricId) {
  return RANKING_METRICS.find((metric) => metric.id === metricId) || null;
}

function resolveSeasonRecord(row) {
  const seasonSums = row.season_sums || {};
  const seasonSumsKey = latestSeasonKey(seasonSums);
  if (seasonSumsKey && seasonSums[seasonSumsKey]) {
    return seasonSums[seasonSumsKey];
  }

  const yearly = row.yearly || {};
  const yearlyKey = latestSeasonKey(yearly);
  if (yearlyKey && yearly[yearlyKey]) {
    return yearly[yearlyKey];
  }

  return null;
}

function latestSeasonKey(container) {
  const keys = Object.keys(container || {});
  if (keys.length === 0) {
    return null;
  }

  const ranked = keys
    .map((key) => ({ key, rank: seasonKeyRank(key) }))
    .filter((entry) => Number.isFinite(entry.rank));

  if (ranked.length === 0) {
    keys.sort((a, b) => a.localeCompare(b));
    return keys[keys.length - 1];
  }

  ranked.sort((a, b) => b.rank - a.rank);
  return ranked[0].key;
}

function seasonKeyRank(rawKey) {
  const key = String(rawKey || "").trim();
  if (!key) {
    return null;
  }

  const numeric = Number(key);
  if (Number.isFinite(numeric)) {
    return numeric * 10000;
  }

  const seasonMatch = key.match(/^(\d{4})\s*[/-]\s*(\d{4})$/);
  if (seasonMatch) {
    const startYear = Number(seasonMatch[1]);
    const endYear = Number(seasonMatch[2]);
    if (Number.isFinite(startYear) && Number.isFinite(endYear)) {
      return startYear * 10000 + endYear;
    }
  }

  const parsedDate = Date.parse(key);
  if (!Number.isNaN(parsedDate)) {
    return parsedDate;
  }

  return null;
}

function aggregateFromLastMatches(matches) {
  const totals = {};
  let minutes = 0;

  for (const match of matches) {
    const stats = match?.stats || {};
    const matchMinutes = Number(match?.minutes_played || stats.mins_played || 0);
    minutes += matchMinutes;
    for (const [key, rawValue] of Object.entries(stats)) {
      const numeric = Number(rawValue || 0);
      totals[key] = Number(totals[key] || 0) + numeric;
    }
  }

  const factor = minutes > 0 ? 90 / minutes : 0;
  const per90 = {};
  for (const [key, total] of Object.entries(totals)) {
    per90[key] = Number(total) * factor;
  }

  return {
    minutes,
    matches: matches.length,
    totals,
    per90,
  };
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

function normalizePosition(position) {
  const value = String(position || "Unknown");
  if (value.includes("baseball")) {
    return "Autre sport";
  }
  return repairText(value);
}

function imageTag(url, alt) {
  const safeAlt = escapeHtml(alt || "avatar");
  if (!url) {
    return '<span class="avatar" aria-hidden="true"></span>';
  }
  return `<img class="avatar" src="${escapeHtml(url)}" alt="${safeAlt}" loading="lazy" />`;
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

function uniqueSorted(items) {
  const unique = [...new Set(items.filter(Boolean))];
  return unique.sort((a, b) => a.localeCompare(b));
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
  if (!ctx) {
    return;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function polar(center, radius, angle) {
  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius,
  };
}

function normalize(input) {
  return String(input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
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

function formatNumber(value, digits = 2) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return "0";
  }
  return numeric.toFixed(digits);
}

function formatMetric(value, metricId) {
  if (metricId === "pass_accuracy_pct") {
    return `${formatNumber(value, 1)}%`;
  }
  return formatNumber(value, 2);
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

function formatDateTime(raw) {
  if (!raw) {
    return "?";
  }
  const date = new Date(raw);
  if (Number.isNaN(date.valueOf())) {
    return raw;
  }
  return date.toLocaleString("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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

function buildCompetitionIndex(standings) {
  const clubToCompetition = new Map();
  const map = new Map();

  for (const standing of standings || []) {
    const slug = String(standing.competition_slug || "");
    const name = repairText(standing.competition_name || slug || "Competition");
    map.set(slug, { slug, name });
    for (const row of standing.table || []) {
      const clubSlug = String(row.club_slug || "");
      clubToCompetition.set(clubSlug, { slug, name });
    }
  }

  const competitions = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  return { competitions, clubToCompetition };
}

function hydrateStateFromQuery() {
  const query = readQueryParams();
  const competitionSet = new Set(state.competitions.map((item) => item.slug));
  const positionSet = new Set(state.players.map((player) => player.position));
  const clubSet = new Set(state.players.map((player) => player.clubSlug));
  const metricSet = new Set(RANKING_METRICS.map((metric) => metric.id));

  state.search = query.search ? query.search.trim().toLowerCase() : "";
  state.competition = query.competition && competitionSet.has(query.competition) ? query.competition : "all";
  state.position = query.position && positionSet.has(query.position) ? query.position : "all";
  state.club = query.club && clubSet.has(query.club) ? query.club : "all";
  state.rankingMetric = query.metric && metricSet.has(query.metric) ? query.metric : state.rankingMetric;
  state.minMinutes = clampNumber(query.minMinutes, 0, 99999, DEFAULT_MIN_MINUTES);
  state.tableLimit = clampNumber(query.limit, 10, 500, DEFAULT_TABLE_LIMIT);
  state.compareA = query.playerA || null;
  state.compareB = query.playerB || null;
}

function readQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    search: params.get("search"),
    competition: params.get("competition"),
    position: params.get("position"),
    club: params.get("club"),
    metric: params.get("metric"),
    minMinutes: params.get("minMinutes"),
    limit: params.get("limit"),
    playerA: params.get("playerA"),
    playerB: params.get("playerB"),
  };
}

function syncUrl() {
  const params = new URLSearchParams();
  if (state.search) {
    params.set("search", state.search);
  }
  if (state.competition !== "all") {
    params.set("competition", state.competition);
  }
  if (state.position !== "all") {
    params.set("position", state.position);
  }
  if (state.club !== "all") {
    params.set("club", state.club);
  }
  if (state.rankingMetric !== "goals_per90") {
    params.set("metric", state.rankingMetric);
  }
  if (state.minMinutes !== DEFAULT_MIN_MINUTES) {
    params.set("minMinutes", String(state.minMinutes));
  }
  if (state.tableLimit !== DEFAULT_TABLE_LIMIT) {
    params.set("limit", String(state.tableLimit));
  }
  if (state.compareA) {
    params.set("playerA", state.compareA);
  }
  if (state.compareB) {
    params.set("playerB", state.compareB);
  }

  const targetSearch = params.toString() ? `?${params.toString()}` : "";
  if (window.location.search !== targetSearch) {
    window.history.replaceState(null, "", `${window.location.pathname}${targetSearch}`);
  }
}

function competitionBySlug(slug) {
  return state.competitions.find((item) => item.slug === slug) || null;
}

function showError(message) {
  elements.playersMetaText.textContent = message;
  elements.playersCountText.textContent = message;
  elements.playersHeaderLinks.innerHTML = "";
  elements.playersTableBody.innerHTML = `<tr><td colspan="8" class="is-empty">${escapeHtml(message)}</td></tr>`;
  elements.leadersGrid.innerHTML = `<p class="is-empty">${escapeHtml(message)}</p>`;
  elements.playersMetricGrid.innerHTML = `<p class="is-empty">${escapeHtml(message)}</p>`;
}
