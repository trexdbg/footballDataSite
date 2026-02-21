const app = window.FootballData;

const state = {
  data: null,
  competition: "all",
  playerSlug: null,
  search: "",
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  init().catch((error) => {
    console.error(error);
    showError("Impossible de charger la fiche joueur.");
  });
});

async function init() {
  cacheElements();
  bindEvents();

  state.data = await app.loadData();
  hydrateStateFromQuery();
  ensureSelection();

  fillCompetitionSelect();
  fillPlayerSelect();
  run();

  window.addEventListener(
    "resize",
    app.debounce(() => {
      renderCharts();
    }, 150),
  );
}

function cacheElements() {
  elements.playerTitle = document.getElementById("playerTitle");
  elements.playerMeta = document.getElementById("playerMeta");
  elements.playerCompetition = document.getElementById("playerCompetition");
  elements.playerSearch = document.getElementById("playerSearch");
  elements.playerSelect = document.getElementById("playerSelect");
  elements.playerCompareLink = document.getElementById("playerCompareLink");
  elements.playerClubLink = document.getElementById("playerClubLink");
  elements.playerSummaryTitle = document.getElementById("playerSummaryTitle");
  elements.playerSummaryText = document.getElementById("playerSummaryText");
  elements.playerKpis = document.getElementById("playerKpis");
  elements.playerRadar = document.getElementById("playerRadar");
  elements.playerRadarLegend = document.getElementById("playerRadarLegend");
  elements.playerTrend = document.getElementById("playerTrend");
  elements.playerTrendText = document.getElementById("playerTrendText");
  elements.playerStrengths = document.getElementById("playerStrengths");
}

function bindEvents() {
  elements.playerCompetition.addEventListener("change", (event) => {
    state.competition = event.target.value;
    ensureSelection();
    fillPlayerSelect();
    run();
  });

  elements.playerSearch.addEventListener("input", (event) => {
    state.search = app.normalizeText(event.target.value.trim());
    const first = selectablePlayers().find((player) => player.searchText.includes(state.search));
    if (first) {
      state.playerSlug = first.slug;
      fillPlayerSelect();
      run();
    }
  });

  elements.playerSelect.addEventListener("change", (event) => {
    state.playerSlug = event.target.value;
    run();
  });
}

function hydrateStateFromQuery() {
  const params = app.getQueryParams();
  state.competition = params.get("competition") || "all";
  state.playerSlug = params.get("player");
  state.search = app.normalizeText(params.get("search") || "");
  elements.playerSearch.value = params.get("search") || "";
}

function ensureSelection() {
  const pool = selectablePlayers();
  if (!pool.length && state.competition !== "all") {
    state.competition = "all";
  }

  const nextPool = selectablePlayers();
  if (!nextPool.length) {
    state.playerSlug = null;
    return;
  }

  if (!state.playerSlug || !nextPool.some((player) => player.slug === state.playerSlug)) {
    state.playerSlug = nextPool[0].slug;
  }
}

function fillCompetitionSelect() {
  elements.playerCompetition.innerHTML = [
    `<option value="all">Toutes les competitions</option>`,
    ...state.data.competitions.map(
      (competition) => `<option value="${competition.slug}">${app.escapeHtml(competition.name)}</option>`,
    ),
  ].join("");
  elements.playerCompetition.value = state.competition;
}

function fillPlayerSelect() {
  const pool = selectablePlayers();
  elements.playerSelect.innerHTML = pool
    .map((player) => `<option value="${player.slug}">${app.escapeHtml(player.name)} (${app.escapeHtml(player.clubName)})</option>`)
    .join("");

  if (state.playerSlug) {
    elements.playerSelect.value = state.playerSlug;
  }
}

function selectablePlayers() {
  if (state.competition === "all") {
    return state.data.players;
  }
  return state.data.players.filter((player) => player.competitionSlug === state.competition);
}

function currentPlayer() {
  return state.playerSlug ? state.data.playersBySlug.get(state.playerSlug) : null;
}

function run() {
  const player = currentPlayer();
  if (!player) {
    showError("Joueur introuvable.");
    return;
  }

  elements.playerTitle.textContent = player.name;
  elements.playerMeta.textContent = `${player.competitionName} | ${player.clubName}`;
  elements.playerSummaryTitle.textContent = `${player.name} - profil ${player.position.toLowerCase()}`;
  elements.playerSummaryText.textContent = `Age et nationalite non disponibles dans les JSON. Lecture basee sur minutes et stats de match.`;

  const competitionPool = state.data.playersByCompetition.get(player.competitionSlug) || [];
  const positionPool = competitionPool.filter((row) => row.position === player.position);

  renderKpis(player, competitionPool, positionPool);
  renderStrengths(player, positionPool.length ? positionPool : competitionPool);
  renderCharts();
  syncLinks(player);
  syncUrl();
}

function renderKpis(player, competitionPool, positionPool) {
  const rankComp = app.rankValue(player, competitionPool, (row) => row.metrics.contributionsP90, true);
  const rankPos = app.rankValue(player, positionPool, (row) => row.metrics.contributionsP90, true);
  const trend = player.recentTrend;
  const last = trend[trend.length - 1];
  const recentGoals = player.recentTrend.reduce((sum, item) => sum + item.goals, 0);

  elements.playerKpis.innerHTML = [
    {
      label: "Rang contribution /90",
      value: rankComp ? `#${rankComp}/${competitionPool.length}` : "-",
      detail: "Tous postes",
    },
    {
      label: "Rang meme poste",
      value: rankPos ? `#${rankPos}/${positionPool.length}` : "-",
      detail: player.position,
    },
    {
      label: "Temps de jeu",
      value: `${app.formatNumber(player.minutes, 0)} min`,
      detail: `${app.formatNumber(player.matches, 0)} matchs`,
    },
    {
      label: "Dernier match",
      value: last ? app.formatDate(last.date) : "-",
      detail: last ? `Index ${app.formatNumber(last.scoreIndex, 1)}` : "Aucune donnee",
    },
    {
      label: "Buts sur 5 matchs",
      value: app.formatNumber(recentGoals, 0),
      detail: "Fenetre recente",
    },
    {
      label: "Profil",
      value: player.position,
      detail: player.clubName,
    },
  ]
    .map((kpi) => `<article class="kpi"><small>${app.escapeHtml(kpi.label)}</small><strong>${app.escapeHtml(kpi.value)}</strong><span>${app.escapeHtml(kpi.detail)}</span></article>`)
    .join("");
}

function renderCharts() {
  const player = currentPlayer();
  if (!player) {
    return;
  }

  const competitionPool = state.data.playersByCompetition.get(player.competitionSlug) || [];
  const positionPool = competitionPool.filter((row) => row.position === player.position);
  const refPool = positionPool.length ? positionPool : competitionPool;

  const metrics = app.getPositionProfile(player.position);
  const normalizer = app.normalizeForRadar(refPool, metrics, app.getMetricValue);

  const playerValues = metrics.map((metricId) => {
    const metric = app.getMetricDefinition("player", metricId);
    return normalizer.normalizeValue(metricId, app.getMetricValue(player, metricId), metric?.higherIsBetter === false);
  });

  const average = buildAveragePlayer(refPool, metrics);
  const avgValues = metrics.map((metricId) => {
    const metric = app.getMetricDefinition("player", metricId);
    return normalizer.normalizeValue(metricId, average[metricId] || 0, metric?.higherIsBetter === false);
  });

  app.drawRadarChart(elements.playerRadar, {
    axes: metrics.map((metricId) => app.getMetricDefinition("player", metricId)?.label || metricId),
    datasets: [
      { values: avgValues, color: app.colors.navy, fill: "rgba(22, 50, 79, 0.16)" },
      { values: playerValues, color: app.colors.emerald, fill: app.colors.emeraldSoft },
    ],
  });

  elements.playerRadarLegend.innerHTML = `
    <span class="legend-item"><span class="legend-dot" style="background:${app.colors.emerald};"></span>${app.escapeHtml(player.name)}</span>
    <span class="legend-item"><span class="legend-dot" style="background:${app.colors.navy};"></span>Moyenne ${app.escapeHtml(player.position)}</span>
  `;

  const trend = player.recentTrend;
  const values = trend.length ? trend.map((item) => item.scoreIndex) : [0, 0, 0, 0, 0];
  app.drawLineChart(elements.playerTrend, values, { stroke: app.colors.amber, fill: app.colors.amberSoft });
  elements.playerTrendText.textContent = trend.length
    ? `Indice d'activite base sur les ${trend.length} derniers matchs.`
    : "Pas de serie recente disponible.";
}

function buildAveragePlayer(players, metricIds) {
  const average = {};
  for (const metricId of metricIds) {
    const total = players.reduce((sum, row) => sum + app.getMetricValue(row, metricId), 0);
    average[metricId] = players.length ? total / players.length : 0;
  }
  return average;
}

function renderStrengths(player, pool) {
  const metrics = app.getPositionProfile(player.position).slice(0, 6);
  elements.playerStrengths.innerHTML = metrics
    .map((metricId) => {
      const metric = app.getMetricDefinition("player", metricId);
      const value = app.getMetricValue(player, metricId);
      const distribution = pool.map((row) => app.getMetricValue(row, metricId));
      const pct = app.percentile(value, distribution, metric?.higherIsBetter !== false);
      const cls = pct >= 60 ? "good" : pct < 40 ? "warn" : "muted";
      return `
        <article class="metric">
          <strong>${app.escapeHtml(metric?.label || metricId)}</strong>
          <p>${app.formatMetric("player", metricId, value)}</p>
          <p class="${cls}">Percentile poste: ${app.formatNumber(pct, 1)}</p>
        </article>
      `;
    })
    .join("");
}

function syncLinks(player) {
  elements.playerCompareLink.href = app.buildUrl("compare.html", {
    mode: "player",
    competition: player.competitionSlug,
    left: player.slug,
  });
  elements.playerClubLink.href = app.buildUrl("club.html", { club: player.clubSlug, competition: player.competitionSlug });
}

function syncUrl() {
  const player = currentPlayer();
  const params = new URLSearchParams();
  if (player?.competitionSlug) {
    params.set("competition", player.competitionSlug);
  }
  if (player?.slug) {
    params.set("player", player.slug);
  }
  if (state.search) {
    params.set("search", elements.playerSearch.value.trim());
  }
  app.updateUrlQuery(params);
}

function showError(message) {
  if (elements.playerMeta) {
    elements.playerMeta.textContent = message;
  }
  if (elements.playerSummaryText) {
    elements.playerSummaryText.textContent = message;
  }
  if (elements.playerStrengths) {
    elements.playerStrengths.innerHTML = `<p class="empty">${app.escapeHtml(message)}</p>`;
  }
}
