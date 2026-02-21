const TEAMS_URL = "teams_stats.json";

const SORT_METRICS = [
  { id: "rank", label: "Classement officiel", order: "asc" },
  { id: "points", label: "Points", order: "desc" },
  { id: "wins", label: "Victoires", order: "desc" },
  { id: "goal_difference", label: "Difference de buts", order: "desc" },
  { id: "goals_for", label: "Buts marques", order: "desc" },
  { id: "goals_against", label: "Buts encaisses", order: "asc" },
  { id: "clean_sheet_rate", label: "Clean sheet rate", order: "desc" },
];

const RADAR_METRICS = [
  { id: "points", label: "Points", reverse: false, factor: 1 },
  { id: "wins", label: "Wins", reverse: false, factor: 1 },
  { id: "goals_for", label: "Attaque", reverse: false, factor: 1 },
  { id: "goal_difference", label: "Diff buts", reverse: false, factor: 1 },
  { id: "clean_sheet_rate", label: "Clean sheet", reverse: false, factor: 100 },
  { id: "goals_against", label: "Defense", reverse: true, factor: 1 },
];

const COLORS = {
  teamA: "#2f6e4f",
  teamASoft: "rgba(47, 110, 79, 0.28)",
  teamB: "#d2792a",
  teamBSoft: "rgba(210, 121, 42, 0.24)",
  grid: "rgba(95, 109, 91, 0.3)",
  label: "#445240",
};

const DEFAULT_TABLE_LIMIT = 20;

const state = {
  payload: null,
  standings: [],
  teamInfo: new Map(),
  competition: null,
  sortMetric: "rank",
  tableLimit: DEFAULT_TABLE_LIMIT,
  compareA: null,
  compareB: null,
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  init().catch((error) => {
    console.error(error);
    showError("Impossible de charger teams_stats.json");
  });
});

async function init() {
  cacheElements();
  bindEvents();

  const payload = await fetchJson(TEAMS_URL);
  state.payload = payload;
  state.standings = mapStandings(payload.standings || []);
  state.teamInfo = mapTeamInfo(payload.data || []);

  const query = readQueryParams();
  state.competition = resolveCompetition(query.competition);
  state.sortMetric = SORT_METRICS.some((metric) => metric.id === query.sort) ? query.sort : "rank";
  state.tableLimit = clampNumber(query.limit, 5, 100, DEFAULT_TABLE_LIMIT);
  state.compareA = query.teamA || null;
  state.compareB = query.teamB || null;

  fillCompetitionSelect();
  fillSortMetricSelect();
  elements.teamSortMetric.value = state.sortMetric;
  elements.teamsTableLimit.value = String(state.tableLimit);
  renderMetaHeader();
  runPipeline();

  window.addEventListener("resize", debounce(() => drawRadar(), 140));
}

function cacheElements() {
  elements.teamsMetaText = document.getElementById("teamsMetaText");
  elements.teamsPageTitle = document.getElementById("teamsPageTitle");
  elements.teamsHeaderLinks = document.getElementById("teamsHeaderLinks");
  elements.competitionFilter = document.getElementById("competitionFilter");
  elements.teamSortMetric = document.getElementById("teamSortMetric");
  elements.teamsTableLimit = document.getElementById("teamsTableLimit");
  elements.compareTeamA = document.getElementById("compareTeamA");
  elements.compareTeamB = document.getElementById("compareTeamB");
  elements.openCompetitionPlayers = document.getElementById("openCompetitionPlayers");
  elements.openRandomClub = document.getElementById("openRandomClub");
  elements.openRandomPlayer = document.getElementById("openRandomPlayer");
  elements.fixturesMetaText = document.getElementById("fixturesMetaText");
  elements.fixturesGrid = document.getElementById("fixturesGrid");
  elements.clubsQuickCount = document.getElementById("clubsQuickCount");
  elements.clubsQuickLinks = document.getElementById("clubsQuickLinks");
  elements.teamsCountText = document.getElementById("teamsCountText");
  elements.leaderCard = document.getElementById("leaderCard");
  elements.attackCard = document.getElementById("attackCard");
  elements.defenseCard = document.getElementById("defenseCard");
  elements.cleanSheetCard = document.getElementById("cleanSheetCard");
  elements.teamsTableBody = document.getElementById("teamsTableBody");
  elements.teamsRadar = document.getElementById("teamsRadar");
  elements.teamsLegend = document.getElementById("teamsLegend");
  elements.teamsMetricGrid = document.getElementById("teamsMetricGrid");
  elements.teamsDuelCards = document.getElementById("teamsDuelCards");
}

function bindEvents() {
  elements.competitionFilter.addEventListener("change", (event) => {
    state.competition = event.target.value;
    state.compareA = null;
    state.compareB = null;
    runPipeline();
  });

  elements.teamSortMetric.addEventListener("change", (event) => {
    state.sortMetric = event.target.value;
    runPipeline();
  });

  elements.teamsTableLimit.addEventListener("change", (event) => {
    state.tableLimit = clampNumber(event.target.value, 5, 100, DEFAULT_TABLE_LIMIT);
    runPipeline();
  });

  elements.compareTeamA.addEventListener("change", (event) => {
    state.compareA = event.target.value;
    if (state.compareA === state.compareB) {
      state.compareB = currentTableRows().find((row) => row.club_slug !== state.compareA)?.club_slug || state.compareA;
      elements.compareTeamB.value = state.compareB || "";
    }
    renderComparison();
    syncUrl();
  });

  elements.compareTeamB.addEventListener("change", (event) => {
    state.compareB = event.target.value;
    if (state.compareA === state.compareB) {
      state.compareA = currentTableRows().find((row) => row.club_slug !== state.compareB)?.club_slug || state.compareB;
      elements.compareTeamA.value = state.compareA || "";
    }
    renderComparison();
    syncUrl();
  });
}

function fillCompetitionSelect() {
  const options = state.standings.map((entry) => ({
    value: entry.competition_slug,
    label: entry.competition_name,
  }));
  fillSelect(elements.competitionFilter, options, state.competition);
}

function fillSortMetricSelect() {
  fillSelect(
    elements.teamSortMetric,
    SORT_METRICS.map((metric) => ({ value: metric.id, label: metric.label })),
    state.sortMetric,
  );
}

function renderMetaHeader() {
  const meta = state.payload?.meta || {};
  const teamsCount = Number(meta.teams_count || 0);
  const from = meta.coverage_from || "?";
  const to = meta.coverage_to || "?";
  const generatedAt = formatDateTime(meta.generated_at);
  elements.teamsMetaText.textContent = `${teamsCount} equipes. Couverture ${from} -> ${to}. MAJ ${generatedAt}.`;
}

function runPipeline() {
  const standing = currentStanding();
  const rows = standing?.table || [];
  const sorted = sortRows(rows, state.sortMetric);

  renderPageContext(standing, rows);
  renderUpcomingFixtures(rows);
  renderQuickClubLinks(rows);
  renderSummaryCards(rows);
  renderTable(sorted);
  syncCompareSelects(rows);
  renderComparison();
  syncUrl();
}

function renderPageContext(standing, rows) {
  if (!standing) {
    elements.teamsPageTitle.textContent = "Championnat introuvable";
    elements.teamsHeaderLinks.innerHTML = "";
    elements.openCompetitionPlayers.href = "players.html";
    elements.openRandomClub.href = "club.html";
    elements.openRandomPlayer.href = "player.html";
    return;
  }

  elements.teamsPageTitle.textContent = `${standing.competition_name} - classements et passerelles clubs/joueurs`;

  const competitionSlug = standing.competition_slug;
  const playersUrl = `players.html?competition=${encodeURIComponent(competitionSlug)}`;
  const randomClub = rows[Math.floor(Math.random() * rows.length)] || null;
  const randomClubUrl = randomClub
    ? `club.html?competition=${encodeURIComponent(competitionSlug)}&club=${encodeURIComponent(randomClub.club_slug)}`
    : `club.html?competition=${encodeURIComponent(competitionSlug)}`;
  const randomPlayerUrl = `player.html?competition=${encodeURIComponent(competitionSlug)}&random=1`;

  elements.teamsHeaderLinks.innerHTML = `
    <a class="inline-link" href="${playersUrl}">Voir tous les joueurs du championnat</a>
    <a class="inline-link" href="${randomClubUrl}">Ouvrir un club au hasard</a>
    <a class="inline-link" href="index.html">Nouveau championnat aleatoire</a>
  `;

  elements.openCompetitionPlayers.href = playersUrl;
  elements.openRandomClub.href = randomClubUrl;
  elements.openRandomPlayer.href = randomPlayerUrl;
}

function renderQuickClubLinks(rows) {
  elements.clubsQuickCount.textContent = `${rows.length} clubs`;

  if (!rows.length) {
    elements.clubsQuickLinks.innerHTML = `<p class="is-empty">Aucun club sur ce championnat.</p>`;
    return;
  }

  const quick = [...rows]
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 18)
    .map((row) => {
      const url = `club.html?competition=${encodeURIComponent(state.competition)}&club=${encodeURIComponent(row.club_slug)}`;
      return `<a class="pill-link" href="${url}">${row.rank}. ${escapeHtml(row.club_name)}</a>`;
    })
    .join("");

  elements.clubsQuickLinks.innerHTML = quick;
}

function renderUpcomingFixtures(rows) {
  const fixtures = buildUpcomingFixtures(rows).slice(0, 8);
  elements.fixturesMetaText.textContent = `${fixtures.length} affiches prioritaires`;

  if (!fixtures.length) {
    elements.fixturesGrid.innerHTML = `<p class="is-empty">Aucun match a venir detecte.</p>`;
    return;
  }

  elements.fixturesGrid.innerHTML = fixtures
    .map((fixture) => {
      const homeClubUrl = `club.html?competition=${encodeURIComponent(state.competition)}&club=${encodeURIComponent(fixture.homeSlug)}`;
      const awayClubUrl = `club.html?competition=${encodeURIComponent(state.competition)}&club=${encodeURIComponent(fixture.awaySlug)}`;
      const homePlayersUrl = `players.html?competition=${encodeURIComponent(state.competition)}&club=${encodeURIComponent(fixture.homeSlug)}`;
      const awayPlayersUrl = `players.html?competition=${encodeURIComponent(state.competition)}&club=${encodeURIComponent(fixture.awaySlug)}`;
      const duelUrl = `teams.html?competition=${encodeURIComponent(state.competition)}&teamA=${encodeURIComponent(fixture.homeSlug)}&teamB=${encodeURIComponent(fixture.awaySlug)}`;

      return `
        <article class="fixture-card">
          <div class="fixture-top">
            <strong>${formatFixtureDate(fixture.date)}</strong>
            <span class="fixture-badge">${escapeHtml(fixture.tag)}</span>
          </div>
          <h3>
            <a class="inline-link strong-link" href="${homeClubUrl}">${escapeHtml(fixture.homeName)}</a>
            <span> vs </span>
            <a class="inline-link strong-link" href="${awayClubUrl}">${escapeHtml(fixture.awayName)}</a>
          </h3>
          <p>${escapeHtml(fixture.rankLine)}</p>
          <p class="fixture-note">${escapeHtml(fixture.note)}</p>
          <div class="fixture-links">
            <a class="inline-link" href="${homePlayersUrl}">Joueurs ${escapeHtml(fixture.homeShort)}</a>
            <a class="inline-link" href="${awayPlayersUrl}">Joueurs ${escapeHtml(fixture.awayShort)}</a>
            <a class="inline-link" href="${duelUrl}">Ouvrir duel radar</a>
          </div>
        </article>
      `;
    })
    .join("");
}

function buildUpcomingFixtures(rows) {
  if (!rows.length) {
    return [];
  }

  const rowBySlug = new Map(rows.map((row) => [row.club_slug, row]));
  const fixtures = new Map();

  for (const row of rows) {
    const info = state.teamInfo.get(row.club_slug);
    const next = info?.next_fixture;
    if (!next || !next.opponent_slug) {
      continue;
    }

    const opponentSlug = String(next.opponent_slug || "");
    if (!opponentSlug) {
      continue;
    }

    const date = String(next.date || "");
    const teamsKey = [row.club_slug, opponentSlug].sort().join("|");
    const uniqueKey = `${date}|${teamsKey}`;
    if (fixtures.has(uniqueKey)) {
      continue;
    }

    let homeSlug = row.club_slug;
    let awaySlug = opponentSlug;
    if (next.home_away === "away") {
      homeSlug = opponentSlug;
      awaySlug = row.club_slug;
    }

    const homeRow = rowBySlug.get(homeSlug) || null;
    const awayRow = rowBySlug.get(awaySlug) || null;
    const homeName = homeRow?.club_name || state.teamInfo.get(homeSlug)?.name || prettifySlug(homeSlug);
    const awayName = awayRow?.club_name || state.teamInfo.get(awaySlug)?.name || prettifySlug(awaySlug);
    const importance = fixtureImportance(homeRow, awayRow, rows.length);

    fixtures.set(uniqueKey, {
      date,
      homeSlug,
      awaySlug,
      homeName,
      awayName,
      homeShort: shortName(homeName),
      awayShort: shortName(awayName),
      tag: importance.tag,
      note: importance.note,
      score: importance.score,
      rankLine: importance.rankLine,
    });
  }

  return [...fixtures.values()].sort((left, right) => {
    const leftDate = Date.parse(left.date || "");
    const rightDate = Date.parse(right.date || "");
    const safeLeft = Number.isNaN(leftDate) ? Number.MAX_SAFE_INTEGER : leftDate;
    const safeRight = Number.isNaN(rightDate) ? Number.MAX_SAFE_INTEGER : rightDate;
    if (safeLeft !== safeRight) {
      return safeLeft - safeRight;
    }
    return right.score - left.score;
  });
}

function fixtureImportance(homeRow, awayRow, tableSize) {
  const fallbackRank = tableSize + 5;
  const homeRank = Number(homeRow?.rank || fallbackRank);
  const awayRank = Number(awayRow?.rank || fallbackRank);
  const homePoints = Number(homeRow?.points || 0);
  const awayPoints = Number(awayRow?.points || 0);
  const rankGap = Math.abs(homeRank - awayRank);
  const pointsGap = Math.abs(homePoints - awayPoints);

  const topCut = Math.max(4, Math.min(6, Math.ceil(tableSize * 0.34)));
  const bottomStart = Math.max(tableSize - 3, 1);

  let score = 45;
  let tag = "Affiche";
  let note = "Match a suivre pour la dynamique du championnat.";

  if (homeRank <= topCut && awayRank <= topCut) {
    score += 38;
    tag = "Choc haut de tableau";
    note = "Confrontation directe entre equipes de tete.";
  } else if (homeRank >= bottomStart && awayRank >= bottomStart) {
    score += 30;
    tag = "Bataille maintien";
    note = "Duel sensible pour rester en vie au classement.";
  } else if (rankGap <= 2) {
    score += 24;
    tag = "Duel direct";
    note = "Equipes proches au classement, impact immediat.";
  } else if (pointsGap <= 3) {
    score += 18;
    tag = "Course aux points";
    note = "Ecart de points serre, match potentiellement charniere.";
  }

  if (rankGap <= 1) {
    score += 8;
  }
  if (pointsGap <= 1) {
    score += 8;
  }

  const rankLine = `Classement: #${homeRank} (${homePoints} pts) vs #${awayRank} (${awayPoints} pts)`;
  return { score, tag, note, rankLine };
}

function shortName(name) {
  const cleaned = String(name || "").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return cleaned;
  }
  return parts.slice(0, 2).join(" ");
}

function currentStanding() {
  return state.standings.find((entry) => entry.competition_slug === state.competition) || null;
}

function currentTableRows() {
  return currentStanding()?.table || [];
}

function sortRows(rows, metricId) {
  const config = SORT_METRICS.find((metric) => metric.id === metricId) || SORT_METRICS[0];
  const direction = config.order === "asc" ? 1 : -1;

  return [...rows].sort((left, right) => {
    const a = Number(left[config.id] || 0);
    const b = Number(right[config.id] || 0);
    if (a === b) {
      return left.rank - right.rank;
    }
    return (a - b) * direction;
  });
}

function renderSummaryCards(rows) {
  const comp = currentStanding();
  const teamsCount = rows.length;
  const leader = [...rows].sort((a, b) => a.rank - b.rank)[0];
  const bestAttack = [...rows].sort((a, b) => b.goals_for - a.goals_for)[0];
  const bestDefense = [...rows].sort((a, b) => a.goals_against - b.goals_against)[0];
  const bestClean = [...rows].sort((a, b) => b.clean_sheet_rate - a.clean_sheet_rate)[0];

  const leaderUrl = leader ? `club.html?competition=${encodeURIComponent(state.competition)}&club=${encodeURIComponent(leader.club_slug)}` : null;
  const attackUrl = bestAttack
    ? `club.html?competition=${encodeURIComponent(state.competition)}&club=${encodeURIComponent(bestAttack.club_slug)}`
    : null;
  const defenseUrl = bestDefense
    ? `club.html?competition=${encodeURIComponent(state.competition)}&club=${encodeURIComponent(bestDefense.club_slug)}`
    : null;
  const cleanUrl = bestClean
    ? `club.html?competition=${encodeURIComponent(state.competition)}&club=${encodeURIComponent(bestClean.club_slug)}`
    : null;

  elements.teamsCountText.textContent = `${teamsCount} equipes - ${comp?.competition_name || ""}`;
  elements.leaderCard.innerHTML = kpiTemplate("Leader", leader?.club_name, `Rang ${leader?.rank || "-"}`, leaderUrl);
  elements.attackCard.innerHTML = kpiTemplate(
    "Meilleure attaque",
    bestAttack?.club_name,
    `${bestAttack?.goals_for ?? "-"} buts marques`,
    attackUrl,
  );
  elements.defenseCard.innerHTML = kpiTemplate(
    "Meilleure defense",
    bestDefense?.club_name,
    `${bestDefense?.goals_against ?? "-"} buts encaisses`,
    defenseUrl,
  );
  elements.cleanSheetCard.innerHTML = kpiTemplate(
    "Top clean sheets",
    bestClean?.club_name,
    `${formatPercent(bestClean?.clean_sheet_rate || 0)}`,
    cleanUrl,
  );
}

function renderTable(sortedRows) {
  const limited = sortedRows.slice(0, state.tableLimit);
  if (limited.length === 0) {
    elements.teamsTableBody.innerHTML = `<tr><td colspan="11" class="is-empty">Aucune equipe pour ce championnat.</td></tr>`;
    return;
  }

  elements.teamsTableBody.innerHTML = limited
    .map((row) => {
      const clubUrl = `club.html?competition=${encodeURIComponent(state.competition)}&club=${encodeURIComponent(row.club_slug)}`;
      const playersUrl = `players.html?competition=${encodeURIComponent(state.competition)}&club=${encodeURIComponent(row.club_slug)}`;

      return `
        <tr>
          <td>${row.rank}</td>
          <td>
            <div class="team-cell">
              ${imageTag(row.logo_url, row.club_name)}
              <a class="inline-link strong-link" href="${clubUrl}">${escapeHtml(row.club_name)}</a>
            </div>
          </td>
          <td>
            <div class="mini-links">
              <a class="inline-link" href="${clubUrl}">Page club</a>
              <a class="inline-link" href="${playersUrl}">Joueurs</a>
            </div>
          </td>
          <td>${row.points}</td>
          <td>${row.wins}</td>
          <td>${row.draws}</td>
          <td>${row.losses}</td>
          <td>${row.goals_for}</td>
          <td>${row.goals_against}</td>
          <td>${row.goal_difference}</td>
          <td>${formatPercent(row.clean_sheet_rate)}</td>
        </tr>
      `;
    })
    .join("");
}

function syncCompareSelects(rows) {
  const ordered = [...rows].sort((a, b) => a.rank - b.rank);
  const options = ordered.map((row) => ({
    value: row.club_slug,
    label: `${row.rank}. ${row.club_name}`,
  }));

  if (!ordered.length) {
    fillSelect(elements.compareTeamA, []);
    fillSelect(elements.compareTeamB, []);
    state.compareA = null;
    state.compareB = null;
    return;
  }

  const slugs = new Set(ordered.map((row) => row.club_slug));
  if (!state.compareA || !slugs.has(state.compareA)) {
    state.compareA = ordered[0].club_slug;
  }
  if (!state.compareB || !slugs.has(state.compareB) || state.compareB === state.compareA) {
    state.compareB = ordered.find((row) => row.club_slug !== state.compareA)?.club_slug || state.compareA;
  }

  fillSelect(elements.compareTeamA, options, state.compareA);
  fillSelect(elements.compareTeamB, options, state.compareB);
}

function renderComparison() {
  const rows = currentTableRows();
  const teamA = rows.find((row) => row.club_slug === state.compareA);
  const teamB = rows.find((row) => row.club_slug === state.compareB);

  if (!teamA || !teamB) {
    elements.teamsLegend.innerHTML = "";
    elements.teamsMetricGrid.innerHTML = '<p class="is-empty">Selectionne deux equipes.</p>';
    elements.teamsDuelCards.innerHTML = "";
    clearCanvas(elements.teamsRadar);
    return;
  }

  elements.teamsLegend.innerHTML = `
    <div class="legend-item">
      <span class="dot" style="background:${COLORS.teamA};"></span>
      <span>${escapeHtml(teamA.club_name)}</span>
    </div>
    <div class="legend-item">
      <span class="dot" style="background:${COLORS.teamB};"></span>
      <span>${escapeHtml(teamB.club_name)}</span>
    </div>
  `;

  renderMetricGrid(teamA, teamB, rows);
  renderDuelCards(teamA, teamB);
  drawRadar(teamA, teamB, rows);
}

function renderMetricGrid(teamA, teamB, rows) {
  const html = RADAR_METRICS.map((metric) => {
    const a = radarRawValue(teamA, metric);
    const b = radarRawValue(teamB, metric);
    const bounds = radarBounds(rows, metric);

    const normA = normalizeRadarValue(a, metric, bounds);
    const normB = normalizeRadarValue(b, metric, bounds);
    const diff = normA - normB;
    const lead = diff >= 0 ? "A devant" : "B devant";
    const leadClass = diff >= 0 ? "text-good" : "text-warn";

    return `
      <article class="metric-item">
        <strong>${escapeHtml(metric.label)}</strong>
        <p>A: ${formatRadarMetric(a, metric)} | B: ${formatRadarMetric(b, metric)}</p>
        <p class="${leadClass}">${lead} (${formatNumber(Math.abs(diff) * 100, 1)} pts radar)</p>
      </article>
    `;
  }).join("");

  elements.teamsMetricGrid.innerHTML = html;
}

function renderDuelCards(teamA, teamB) {
  const cardA = duelCardTemplate(teamA);
  const cardB = duelCardTemplate(teamB);
  elements.teamsDuelCards.innerHTML = `${cardA}${cardB}`;
}

function duelCardTemplate(row) {
  const info = state.teamInfo.get(row.club_slug);
  const lastMatch = formatMatch(info?.last_match);
  const nextFixture = formatFixture(info?.next_fixture);
  const summary = info?.last5_summary || {};
  const clubUrl = `club.html?competition=${encodeURIComponent(state.competition)}&club=${encodeURIComponent(row.club_slug)}`;
  const playersUrl = `players.html?competition=${encodeURIComponent(state.competition)}&club=${encodeURIComponent(row.club_slug)}`;

  return `
    <article class="duel-card">
      <div class="duel-card-head">
        ${imageTag(row.logo_url, row.club_name)}
        <h3>${escapeHtml(row.club_name)}</h3>
      </div>
      <p><strong>Forme:</strong> ${summary.points ?? row.points} pts sur ${summary.matches ?? 5} matchs</p>
      <p><strong>Dernier match:</strong> ${escapeHtml(lastMatch)}</p>
      <p><strong>Prochain match:</strong> ${escapeHtml(nextFixture)}</p>
      <p class="duel-links">
        <a class="inline-link" href="${clubUrl}">Page club</a>
        <a class="inline-link" href="${playersUrl}">Joueurs du club</a>
      </p>
    </article>
  `;
}

function drawRadar(teamA = null, teamB = null, rows = null) {
  const sourceRows = rows || currentTableRows();
  const left = teamA || sourceRows.find((row) => row.club_slug === state.compareA);
  const right = teamB || sourceRows.find((row) => row.club_slug === state.compareB);
  if (!left || !right || sourceRows.length === 0) {
    clearCanvas(elements.teamsRadar);
    return;
  }

  const { ctx, width, height } = prepareCanvas(elements.teamsRadar);
  if (!ctx) {
    return;
  }

  const center = { x: width / 2, y: height / 2 };
  const radius = Math.min(width, height) * 0.34;
  const angleStep = (Math.PI * 2) / RADAR_METRICS.length;
  const startAngle = -Math.PI / 2;

  const boundsByMetric = {};
  for (const metric of RADAR_METRICS) {
    boundsByMetric[metric.id] = radarBounds(sourceRows, metric);
  }

  drawRadarGrid(ctx, center, radius, RADAR_METRICS.length, 5, startAngle, angleStep);
  drawRadarLabels(ctx, center, radius + 20, startAngle, angleStep);

  const pointsA = RADAR_METRICS.map((metric, index) => {
    const value = radarRawValue(left, metric);
    const ratio = normalizeRadarValue(value, metric, boundsByMetric[metric.id]);
    return polar(center, radius * ratio, startAngle + index * angleStep);
  });

  const pointsB = RADAR_METRICS.map((metric, index) => {
    const value = radarRawValue(right, metric);
    const ratio = normalizeRadarValue(value, metric, boundsByMetric[metric.id]);
    return polar(center, radius * ratio, startAngle + index * angleStep);
  });

  drawRadarShape(ctx, pointsA, COLORS.teamA, COLORS.teamASoft);
  drawRadarShape(ctx, pointsB, COLORS.teamB, COLORS.teamBSoft);
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
  ctx.font = "12px IBM Plex Sans";
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

function radarRawValue(row, metric) {
  const raw = Number(row[metric.id] || 0);
  return raw * Number(metric.factor || 1);
}

function radarBounds(rows, metric) {
  if (!rows.length) {
    return { min: 0, max: 1 };
  }
  const values = rows.map((row) => radarRawValue(row, metric));
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max };
}

function normalizeRadarValue(value, metric, bounds) {
  const span = bounds.max - bounds.min;
  if (span <= 0) {
    return 0.5;
  }
  if (metric.reverse) {
    return clamp((bounds.max - value) / span, 0, 1);
  }
  return clamp((value - bounds.min) / span, 0, 1);
}

function formatRadarMetric(value, metric) {
  if (metric.id === "clean_sheet_rate") {
    return `${formatNumber(value, 1)}%`;
  }
  return formatNumber(value, 2);
}

function mapStandings(entries) {
  return entries
    .map((entry) => ({
      competition_slug: String(entry.competition_slug || ""),
      competition_name: repairText(entry.competition_name || entry.competition_slug || "Competition"),
      competition_type: String(entry.competition_type || ""),
      ranking_basis: String(entry.ranking_basis || ""),
      table: (entry.table || []).map(mapTableRow),
    }))
    .sort((a, b) => a.competition_name.localeCompare(b.competition_name));
}

function mapTableRow(row) {
  return {
    club_slug: String(row.club_slug || ""),
    club_name: repairText(row.club_name || prettifySlug(row.club_slug || "")),
    logo_url: String(row.logo_url || ""),
    points: Number(row.points || 0),
    wins: Number(row.wins || 0),
    draws: Number(row.draws || 0),
    losses: Number(row.losses || 0),
    goals_for: Number(row.goals_for || 0),
    goals_against: Number(row.goals_against || 0),
    goal_difference: Number(row.goal_difference || 0),
    clean_sheet_rate: Number(row.clean_sheet_rate || 0),
    rank: Number(row.rank || 0),
  };
}

function mapTeamInfo(entries) {
  const map = new Map();
  for (const row of entries) {
    map.set(String(row.slug || ""), {
      name: repairText(row.name || ""),
      last_match: row.last_match || null,
      next_fixture: row.next_fixture || null,
      last5_summary: row.last5_summary || null,
    });
  }
  return map;
}

function kpiTemplate(label, value, detail, href = null) {
  const safeValue = escapeHtml(value || "-");
  const title = href ? `<a class="inline-link strong-link" href="${href}">${safeValue}</a>` : safeValue;
  return `
    <small>${escapeHtml(label)}</small>
    <strong>${title}</strong>
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
  const safeAlt = escapeHtml(alt || "logo");
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

function formatPercent(value) {
  return `${formatNumber(Number(value || 0) * 100, 1)}%`;
}

function formatNumber(value, digits = 2) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return "0";
  }
  return numeric.toFixed(digits);
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

function formatFixtureDate(raw) {
  if (!raw) {
    return "Date inconnue";
  }
  const date = new Date(raw);
  if (Number.isNaN(date.valueOf())) {
    return raw;
  }
  return date.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
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

function resolveCompetition(rawSlug) {
  const available = new Set(state.standings.map((entry) => entry.competition_slug));
  if (rawSlug && available.has(rawSlug)) {
    return rawSlug;
  }
  if (!state.standings.length) {
    return null;
  }
  const index = Math.floor(Math.random() * state.standings.length);
  return state.standings[index].competition_slug;
}

function readQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    competition: params.get("competition"),
    sort: params.get("sort"),
    limit: params.get("limit"),
    teamA: params.get("teamA"),
    teamB: params.get("teamB"),
  };
}

function syncUrl() {
  const params = new URLSearchParams();
  if (state.competition) {
    params.set("competition", state.competition);
  }
  if (state.sortMetric !== "rank") {
    params.set("sort", state.sortMetric);
  }
  if (state.tableLimit !== DEFAULT_TABLE_LIMIT) {
    params.set("limit", String(state.tableLimit));
  }
  if (state.compareA) {
    params.set("teamA", state.compareA);
  }
  if (state.compareB) {
    params.set("teamB", state.compareB);
  }

  const targetSearch = params.toString() ? `?${params.toString()}` : "";
  if (window.location.search !== targetSearch) {
    window.history.replaceState(null, "", `${window.location.pathname}${targetSearch}`);
  }
}

function showError(message) {
  elements.teamsMetaText.textContent = message;
  elements.teamsPageTitle.textContent = "Erreur de chargement";
  elements.teamsHeaderLinks.innerHTML = "";
  elements.teamsCountText.textContent = message;
  elements.fixturesMetaText.textContent = message;
  elements.fixturesGrid.innerHTML = `<p class="is-empty">${escapeHtml(message)}</p>`;
  elements.clubsQuickLinks.innerHTML = `<p class="is-empty">${escapeHtml(message)}</p>`;
  elements.teamsTableBody.innerHTML = `<tr><td colspan="11" class="is-empty">${escapeHtml(message)}</td></tr>`;
  elements.teamsMetricGrid.innerHTML = `<p class="is-empty">${escapeHtml(message)}</p>`;
  elements.teamsDuelCards.innerHTML = "";
}
