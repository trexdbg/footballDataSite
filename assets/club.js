const PLAYERS_URL = "players_stats.json";
const TEAMS_URL = "teams_stats.json";

const RANKING_METRICS = [
  { id: "goals_per90", label: "Buts /90" },
  { id: "assists_per90", label: "Assists /90" },
  { id: "shots_on_target_per90", label: "Tirs cadres /90" },
  { id: "accurate_pass_per90", label: "Passes /90" },
  { id: "final_third_passes_per90", label: "Passes dernier tiers /90" },
  { id: "tackles_won_per90", label: "Tacles /90" },
  { id: "interceptions_per90", label: "Interceptions /90" },
  { id: "duels_won_per90", label: "Duels /90" },
  { id: "pass_accuracy_pct", label: "Precision de passe %" },
];

const LEADER_METRICS = [
  "goals_per90",
  "assists_per90",
  "shots_on_target_per90",
  "final_third_passes_per90",
  "tackles_won_per90",
  "interceptions_per90",
  "duels_won_per90",
];

const DEFAULT_MIN_MINUTES = 90;
const DEFAULT_LIMIT = 30;

const state = {
  players: [],
  standings: [],
  teamInfo: new Map(),
  clubSlug: null,
  competitionSlug: null,
  search: "",
  position: "all",
  minMinutes: DEFAULT_MIN_MINUTES,
  rankingMetric: "goals_per90",
  tableLimit: DEFAULT_LIMIT,
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  init().catch((error) => {
    console.error(error);
    showError("Impossible de charger les donnees club.");
  });
});

async function init() {
  cacheElements();
  bindEvents();

  const [playersPayload, teamsPayload] = await Promise.all([fetchJson(PLAYERS_URL), fetchJson(TEAMS_URL)]);
  const competitionIndex = buildCompetitionIndex(teamsPayload.standings || []);

  state.standings = mapStandings(teamsPayload.standings || []);
  state.teamInfo = mapTeamInfo(teamsPayload.data || []);
  state.players = playersPayload.data
    .map((row) => mapPlayer(row, competitionIndex.clubToCompetition))
    .filter((player) => player.minutes > 0 || player.matches > 0);

  hydrateStateFromQuery();
  resolveInitialClub();
  fillMetricSelect();
  fillPositionSelect();
  runPipeline();
}

function cacheElements() {
  elements.clubPageTitle = document.getElementById("clubPageTitle");
  elements.clubMetaText = document.getElementById("clubMetaText");
  elements.clubBreadcrumbs = document.getElementById("clubBreadcrumbs");
  elements.clubPlayerSearch = document.getElementById("clubPlayerSearch");
  elements.clubPositionFilter = document.getElementById("clubPositionFilter");
  elements.clubMinMinutes = document.getElementById("clubMinMinutes");
  elements.clubRankingMetric = document.getElementById("clubRankingMetric");
  elements.clubTableLimit = document.getElementById("clubTableLimit");
  elements.openClubLeague = document.getElementById("openClubLeague");
  elements.openClubPlayers = document.getElementById("openClubPlayers");
  elements.openRandomClubPlayer = document.getElementById("openRandomClubPlayer");
  elements.clubSummaryText = document.getElementById("clubSummaryText");
  elements.clubHero = document.getElementById("clubHero");
  elements.clubRankCard = document.getElementById("clubRankCard");
  elements.clubAttackCard = document.getElementById("clubAttackCard");
  elements.clubDefenseCard = document.getElementById("clubDefenseCard");
  elements.clubCleanCard = document.getElementById("clubCleanCard");
  elements.clubInfoLines = document.getElementById("clubInfoLines");
  elements.clubPlayersCountText = document.getElementById("clubPlayersCountText");
  elements.clubMetricHead = document.getElementById("clubMetricHead");
  elements.clubPlayersTableBody = document.getElementById("clubPlayersTableBody");
  elements.clubLeadersText = document.getElementById("clubLeadersText");
  elements.clubLeadersGrid = document.getElementById("clubLeadersGrid");
}

function bindEvents() {
  elements.clubPlayerSearch.addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    runPipeline();
  });

  elements.clubPositionFilter.addEventListener("change", (event) => {
    state.position = event.target.value;
    runPipeline();
  });

  elements.clubMinMinutes.addEventListener("change", (event) => {
    state.minMinutes = clampNumber(event.target.value, 0, 99999, DEFAULT_MIN_MINUTES);
    event.target.value = String(state.minMinutes);
    runPipeline();
  });

  elements.clubRankingMetric.addEventListener("change", (event) => {
    state.rankingMetric = event.target.value;
    runPipeline();
  });

  elements.clubTableLimit.addEventListener("change", (event) => {
    state.tableLimit = clampNumber(event.target.value, 10, 200, DEFAULT_LIMIT);
    runPipeline();
  });
}

function runPipeline() {
  const standing = standingByCompetition(state.competitionSlug);
  const row = standing?.table.find((item) => item.club_slug === state.clubSlug) || findTeamRowByClub(state.clubSlug);
  const clubPlayers = state.players.filter((player) => player.clubSlug === state.clubSlug);

  const filtered = clubPlayers.filter((player) => {
    const byPosition = state.position === "all" || player.position === state.position;
    const byMinutes = player.minutes >= state.minMinutes;
    const bySearch = !state.search || normalize(`${player.name} ${player.position}`).includes(normalize(state.search));
    return byPosition && byMinutes && bySearch;
  });

  const sorted = sortPlayersByMetric(filtered, state.rankingMetric);
  renderContext(row, standing, clubPlayers, sorted);
  renderOverview(row, standing);
  renderPlayersTable(sorted);
  renderLeaders(filtered.length ? filtered : clubPlayers);
  syncUrl();
}

function renderContext(row, standing, clubPlayers, sorted) {
  const clubName = row?.club_name || clubPlayers[0]?.clubName || prettifySlug(state.clubSlug || "club");
  const competitionName = standing?.competition_name || clubPlayers[0]?.competitionName || "Competition";

  elements.clubPageTitle.textContent = `${clubName} - effectif et performances`;
  elements.clubMetaText.textContent = `${clubPlayers.length} joueurs identifies dans l'effectif.`;
  elements.clubSummaryText.textContent = `${competitionName} - ${sorted.length} joueurs dans la vue active`;

  const leagueUrl = standing
    ? `teams.html?competition=${encodeURIComponent(standing.competition_slug)}`
    : "teams.html";
  const playersUrl = `players.html?competition=${encodeURIComponent(state.competitionSlug || "")}&club=${encodeURIComponent(state.clubSlug || "")}`;
  const randomPlayer = sorted[Math.floor(Math.random() * sorted.length)] || clubPlayers[0] || null;
  const randomProfileUrl = randomPlayer
    ? `player.html?player=${encodeURIComponent(randomPlayer.slug)}`
    : `player.html?competition=${encodeURIComponent(state.competitionSlug || "")}&random=1`;

  elements.clubBreadcrumbs.innerHTML = `
    <a class="inline-link" href="${leagueUrl}">${escapeHtml(competitionName)}</a>
    <span>/</span>
    <a class="inline-link" href="${playersUrl}">Joueurs du club</a>
    <span>/</span>
    <a class="inline-link" href="player.html?competition=${encodeURIComponent(state.competitionSlug || "")}&random=1">Profil joueur</a>
  `;

  elements.openClubLeague.href = leagueUrl;
  elements.openClubPlayers.href = playersUrl;
  elements.openRandomClubPlayer.href = randomProfileUrl;
}

function renderOverview(row, standing) {
  const info = state.teamInfo.get(state.clubSlug) || {};
  const clubName = row?.club_name || prettifySlug(state.clubSlug || "");
  const competitionName = standing?.competition_name || "Competition";
  const logo = row?.logo_url || "";
  const rank = row?.rank ?? "-";
  const points = row?.points ?? "-";

  elements.clubHero.innerHTML = `
    <div class="club-hero-main">
      ${imageTag(logo, clubName)}
      <div>
        <h3>${escapeHtml(clubName)}</h3>
        <p>${escapeHtml(competitionName)} - Rang ${escapeHtml(String(rank))}</p>
      </div>
    </div>
  `;

  elements.clubRankCard.innerHTML = kpiTemplate("Classement", `#${rank}`, `${points} points`);
  elements.clubAttackCard.innerHTML = kpiTemplate("Attaque", String(row?.goals_for ?? "-"), "Buts marques");
  elements.clubDefenseCard.innerHTML = kpiTemplate("Defense", String(row?.goals_against ?? "-"), "Buts encaisses");
  elements.clubCleanCard.innerHTML = kpiTemplate(
    "Clean sheet",
    formatPercent(row?.clean_sheet_rate || 0),
    "Taux de match sans encaisser",
  );

  elements.clubInfoLines.innerHTML = `
    <p><strong>Dernier match:</strong> ${escapeHtml(formatMatch(info.last_match))}</p>
    <p><strong>Prochain match:</strong> ${escapeHtml(formatFixture(info.next_fixture))}</p>
  `;
}

function renderPlayersTable(sortedPlayers) {
  const metricLabel = metricById(state.rankingMetric)?.label || "Metrique";
  const limited = sortedPlayers.slice(0, state.tableLimit);

  elements.clubPlayersCountText.textContent = `${sortedPlayers.length} joueurs`;
  elements.clubMetricHead.textContent = metricLabel;

  if (!limited.length) {
    elements.clubPlayersTableBody.innerHTML = `<tr><td colspan="7" class="is-empty">Aucun joueur pour ces filtres.</td></tr>`;
    return;
  }

  elements.clubPlayersTableBody.innerHTML = limited
    .map((player, index) => {
      const value = metricValue(player, state.rankingMetric);
      const profileUrl = `player.html?player=${encodeURIComponent(player.slug)}`;
      const listUrl = `players.html?competition=${encodeURIComponent(player.competitionSlug)}&club=${encodeURIComponent(player.clubSlug)}`;
      return `
        <tr>
          <td>${index + 1}</td>
          <td>
            <div class="player-cell">
              ${imageTag(player.imageUrl, player.name)}
              <a class="inline-link strong-link" href="${profileUrl}">${escapeHtml(player.name)}</a>
            </div>
          </td>
          <td>${escapeHtml(player.position)}</td>
          <td>${formatNumber(player.minutes, 0)}</td>
          <td>${formatNumber(player.matches, 0)}</td>
          <td><strong>${formatMetric(value, state.rankingMetric)}</strong></td>
          <td>
            <div class="mini-links">
              <a class="inline-link" href="${profileUrl}">Profil</a>
              <a class="inline-link" href="${listUrl}">Liste joueurs</a>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderLeaders(players) {
  if (!players.length) {
    elements.clubLeadersText.textContent = "0 metrique";
    elements.clubLeadersGrid.innerHTML = `<p class="is-empty">Aucun leader disponible.</p>`;
    return;
  }

  const leaders = LEADER_METRICS.map((metricId) => {
    const metric = metricById(metricId);
    const top = sortPlayersByMetric(players, metricId)[0];
    if (!metric || !top) {
      return null;
    }
    return { metric, top, value: metricValue(top, metricId) };
  }).filter(Boolean);

  elements.clubLeadersText.textContent = `${leaders.length} metriques`;
  elements.clubLeadersGrid.innerHTML = leaders
    .map((entry) => {
      const profileUrl = `player.html?player=${encodeURIComponent(entry.top.slug)}`;
      return `
        <article class="leader-card">
          <small>${escapeHtml(entry.metric.label)}</small>
          <strong><a class="inline-link strong-link" href="${profileUrl}">${escapeHtml(entry.top.name)}</a></strong>
          <p>${formatMetric(entry.value, entry.metric.id)}</p>
        </article>
      `;
    })
    .join("");
}

function fillMetricSelect() {
  fillSelect(
    elements.clubRankingMetric,
    RANKING_METRICS.map((metric) => ({ value: metric.id, label: metric.label })),
    state.rankingMetric,
  );
}

function fillPositionSelect() {
  const positions = uniqueSorted(state.players.filter((player) => player.clubSlug === state.clubSlug).map((player) => player.position));
  if (state.position !== "all" && !positions.includes(state.position)) {
    state.position = "all";
  }
  fillSelect(
    elements.clubPositionFilter,
    [{ value: "all", label: "Tous" }, ...positions.map((position) => ({ value: position, label: position }))],
    state.position,
  );
  elements.clubPlayerSearch.value = state.search;
  elements.clubMinMinutes.value = String(state.minMinutes);
  const allowedLimits = new Set(["15", "30", "60"]);
  if (!allowedLimits.has(String(state.tableLimit))) {
    const option = document.createElement("option");
    option.value = String(state.tableLimit);
    option.textContent = `Top ${state.tableLimit}`;
    elements.clubTableLimit.appendChild(option);
  }
  elements.clubTableLimit.value = String(state.tableLimit);
}

function hydrateStateFromQuery() {
  const params = new URLSearchParams(window.location.search);
  state.clubSlug = params.get("club");
  state.competitionSlug = params.get("competition");
  state.position = params.get("position") || "all";
  state.search = (params.get("search") || "").trim().toLowerCase();
  state.minMinutes = clampNumber(params.get("minMinutes"), 0, 99999, DEFAULT_MIN_MINUTES);
  state.tableLimit = clampNumber(params.get("limit"), 10, 200, DEFAULT_LIMIT);
  state.rankingMetric = params.get("metric") || state.rankingMetric;
  if (!RANKING_METRICS.some((metric) => metric.id === state.rankingMetric)) {
    state.rankingMetric = "goals_per90";
  }
}

function resolveInitialClub() {
  const clubs = uniqueSorted(state.players.map((player) => player.clubSlug));
  const hasClub = state.clubSlug && clubs.includes(state.clubSlug);
  if (!hasClub) {
    if (state.competitionSlug) {
      const standing = standingByCompetition(state.competitionSlug);
      state.clubSlug = standing?.table?.[0]?.club_slug || null;
    }
  }

  if (!state.clubSlug) {
    const randomStanding = state.standings[Math.floor(Math.random() * state.standings.length)] || null;
    state.clubSlug = randomStanding?.table?.[0]?.club_slug || clubs[0] || null;
  }

  const foundStanding = findStandingByClub(state.clubSlug);
  if (foundStanding) {
    state.competitionSlug = foundStanding.competition_slug;
  }
}

function standingByCompetition(slug) {
  return state.standings.find((standing) => standing.competition_slug === slug) || null;
}

function findStandingByClub(clubSlug) {
  return state.standings.find((standing) => standing.table.some((row) => row.club_slug === clubSlug)) || null;
}

function findTeamRowByClub(clubSlug) {
  for (const standing of state.standings) {
    const row = standing.table.find((item) => item.club_slug === clubSlug);
    if (row) {
      return row;
    }
  }
  return null;
}

function syncUrl() {
  const params = new URLSearchParams();
  if (state.competitionSlug) {
    params.set("competition", state.competitionSlug);
  }
  if (state.clubSlug) {
    params.set("club", state.clubSlug);
  }
  if (state.position !== "all") {
    params.set("position", state.position);
  }
  if (state.search) {
    params.set("search", state.search);
  }
  if (state.rankingMetric !== "goals_per90") {
    params.set("metric", state.rankingMetric);
  }
  if (state.minMinutes !== DEFAULT_MIN_MINUTES) {
    params.set("minMinutes", String(state.minMinutes));
  }
  if (state.tableLimit !== DEFAULT_LIMIT) {
    params.set("limit", String(state.tableLimit));
  }

  const targetSearch = params.toString() ? `?${params.toString()}` : "";
  if (window.location.search !== targetSearch) {
    window.history.replaceState(null, "", `${window.location.pathname}${targetSearch}`);
  }
}

function sortPlayersByMetric(players, metricId) {
  return [...players].sort((left, right) => metricValue(right, metricId) - metricValue(left, metricId));
}

function metricById(metricId) {
  return RANKING_METRICS.find((metric) => metric.id === metricId) || null;
}

function metricValue(player, metricId) {
  switch (metricId) {
    case "goals_per90":
      return Number(player.per90.goals || 0);
    case "assists_per90":
      return Number(player.per90.assists || 0);
    case "shots_on_target_per90":
      return Number(player.per90.ontarget_scoring_att || 0);
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

  const accuratePass = Number(per90.accurate_pass || 0);
  const missedPass = Number(per90.missed_pass || 0);
  const passAccuracy = accuratePass + missedPass > 0 ? (accuratePass * 100) / (accuratePass + missedPass) : 0;
  const clubSlug = String(row.club_slug || "unknown");
  const competition = clubToCompetition.get(clubSlug) || { slug: "unknown", name: "Competition" };

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

function mapStandings(entries) {
  return entries
    .map((entry) => ({
      competition_slug: String(entry.competition_slug || ""),
      competition_name: repairText(entry.competition_name || entry.competition_slug || "Competition"),
      table: (entry.table || []).map((row) => ({
        club_slug: String(row.club_slug || ""),
        club_name: repairText(row.club_name || prettifySlug(row.club_slug || "")),
        logo_url: String(row.logo_url || ""),
        points: Number(row.points || 0),
        goals_for: Number(row.goals_for || 0),
        goals_against: Number(row.goals_against || 0),
        clean_sheet_rate: Number(row.clean_sheet_rate || 0),
        rank: Number(row.rank || 0),
      })),
    }))
    .sort((a, b) => a.competition_name.localeCompare(b.competition_name));
}

function mapTeamInfo(entries) {
  const map = new Map();
  for (const row of entries) {
    map.set(String(row.slug || ""), {
      last_match: row.last_match || null,
      next_fixture: row.next_fixture || null,
    });
  }
  return map;
}

function buildCompetitionIndex(standings) {
  const clubToCompetition = new Map();
  for (const standing of standings || []) {
    const slug = String(standing.competition_slug || "");
    const name = repairText(standing.competition_name || slug || "Competition");
    for (const row of standing.table || []) {
      clubToCompetition.set(String(row.club_slug || ""), { slug, name });
    }
  }
  return { clubToCompetition };
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

function normalizePosition(position) {
  return repairText(String(position || "Unknown"));
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

function kpiTemplate(label, value, detail) {
  return `
    <small>${escapeHtml(label)}</small>
    <strong>${escapeHtml(value || "-")}</strong>
    <span>${escapeHtml(detail || "-")}</span>
  `;
}

function formatMatch(lastMatch) {
  if (!lastMatch) {
    return "Aucune info";
  }
  const where = lastMatch.home_away === "home" ? "domicile" : lastMatch.home_away === "away" ? "exterieur" : "?";
  const opponent = prettifySlug(lastMatch.opponent_slug || "?");
  return `${lastMatch.date || "?"} (${where}) ${lastMatch.score || "-"} vs ${opponent}`;
}

function formatFixture(nextFixture) {
  if (!nextFixture) {
    return "Aucune info";
  }
  const where = nextFixture.home_away === "home" ? "domicile" : nextFixture.home_away === "away" ? "exterieur" : "?";
  const opponent = prettifySlug(nextFixture.opponent_slug || "?");
  return `${nextFixture.date || "?"} (${where}) vs ${opponent}`;
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
  return [...new Set(items.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function normalize(input) {
  return String(input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function formatNumber(value, digits = 2) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric.toFixed(digits) : "0";
}

function formatMetric(value, metricId) {
  return metricId === "pass_accuracy_pct" ? `${formatNumber(value, 1)}%` : formatNumber(value, 2);
}

function formatPercent(value) {
  return `${formatNumber(Number(value || 0) * 100, 1)}%`;
}

function clampNumber(raw, min, max, fallback) {
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(numeric)));
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

function showError(message) {
  elements.clubPageTitle.textContent = "Erreur";
  elements.clubMetaText.textContent = message;
  elements.clubPlayersCountText.textContent = message;
  elements.clubPlayersTableBody.innerHTML = `<tr><td colspan="7" class="is-empty">${escapeHtml(message)}</td></tr>`;
  elements.clubLeadersGrid.innerHTML = `<p class="is-empty">${escapeHtml(message)}</p>`;
}
