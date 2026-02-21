const app = window.FootballData;

const state = {
  data: null,
  clubSlug: null,
  competitionSlug: null,
  squadSearch: "",
  squadPosition: "all",
  compareSlug: null,
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  init().catch((error) => {
    console.error(error);
    showError("Impossible de charger la fiche club.");
  });
});

async function init() {
  cacheElements();
  bindEvents();

  state.data = await app.loadData();
  hydrateStateFromQuery();
  ensureClubSelection();

  fillClubSelect();
  fillCompareSelect();
  fillPositionFilter();
  run();

  window.addEventListener(
    "resize",
    app.debounce(() => {
      renderCharts();
    }, 150),
  );
}

function cacheElements() {
  elements.clubTitle = document.getElementById("clubTitle");
  elements.clubMeta = document.getElementById("clubMeta");
  elements.clubSelect = document.getElementById("clubSelect");
  elements.clubPlayerSearch = document.getElementById("clubPlayerSearch");
  elements.clubPosition = document.getElementById("clubPosition");
  elements.clubCompare = document.getElementById("clubCompare");
  elements.clubCompareLink = document.getElementById("clubCompareLink");
  elements.clubStandingsLink = document.getElementById("clubStandingsLink");
  elements.clubSummaryTitle = document.getElementById("clubSummaryTitle");
  elements.clubSummaryText = document.getElementById("clubSummaryText");
  elements.clubKpis = document.getElementById("clubKpis");
  elements.clubRadar = document.getElementById("clubRadar");
  elements.clubRadarLegend = document.getElementById("clubRadarLegend");
  elements.clubFormChart = document.getElementById("clubFormChart");
  elements.clubHighlights = document.getElementById("clubHighlights");
  elements.clubSquadCount = document.getElementById("clubSquadCount");
  elements.clubSquadBody = document.getElementById("clubSquadBody");
  elements.tabButtons = [...document.querySelectorAll("[data-tab]")];
  elements.tabSummary = document.getElementById("tab-summary");
  elements.tabSquad = document.getElementById("tab-squad");
}

function bindEvents() {
  elements.clubSelect.addEventListener("change", (event) => {
    state.clubSlug = event.target.value;
    const selected = currentClub();
    state.competitionSlug = selected?.competitionSlug || state.competitionSlug;
    state.compareSlug = null;
    fillCompareSelect();
    fillPositionFilter();
    run();
  });

  elements.clubPlayerSearch.addEventListener("input", (event) => {
    state.squadSearch = app.normalizeText(event.target.value.trim());
    runSquad();
    syncUrl();
  });

  elements.clubPosition.addEventListener("change", (event) => {
    state.squadPosition = event.target.value;
    runSquad();
    syncUrl();
  });

  elements.clubCompare.addEventListener("change", (event) => {
    state.compareSlug = event.target.value || null;
    runSummary();
    syncUrl();
  });

  for (const button of elements.tabButtons) {
    button.addEventListener("click", () => activateTab(button.dataset.tab));
  }
}

function hydrateStateFromQuery() {
  const params = app.getQueryParams();
  state.clubSlug = params.get("club");
  state.competitionSlug = params.get("competition");
  state.compareSlug = params.get("compare");
  state.squadSearch = app.normalizeText(params.get("search") || "");
  state.squadPosition = params.get("position") || "all";
}

function ensureClubSelection() {
  const clubs = state.data.clubs;
  if (!clubs.length) {
    return;
  }

  const bySlug = state.clubSlug ? state.data.clubsBySlug.get(state.clubSlug) : null;
  if (bySlug) {
    state.competitionSlug = bySlug.competitionSlug;
    return;
  }

  let candidate = null;
  if (state.competitionSlug) {
    candidate = clubs.find((club) => club.competitionSlug === state.competitionSlug);
  }
  if (!candidate) {
    candidate = [...clubs].sort((a, b) => a.rank - b.rank)[0];
  }

  state.clubSlug = candidate?.slug || null;
  state.competitionSlug = candidate?.competitionSlug || null;
}

function fillClubSelect() {
  const sorted = [...state.data.clubs].sort((a, b) => {
    if (a.competitionName === b.competitionName) {
      return a.rank - b.rank;
    }
    return a.competitionName.localeCompare(b.competitionName);
  });

  elements.clubSelect.innerHTML = sorted
    .map((club) => `<option value="${club.slug}">${app.escapeHtml(club.competitionName)} - ${club.rank}. ${app.escapeHtml(club.name)}</option>`)
    .join("");

  if (state.clubSlug) {
    elements.clubSelect.value = state.clubSlug;
  }

  elements.clubPlayerSearch.value = app.getQueryParams().get("search") || "";
}

function fillCompareSelect() {
  const club = currentClub();
  const pool = state.data.clubs
    .filter((row) => row.competitionSlug === club?.competitionSlug && row.slug !== club?.slug)
    .sort((a, b) => a.rank - b.rank);

  if (state.compareSlug && !pool.some((row) => row.slug === state.compareSlug)) {
    state.compareSlug = null;
  }
  if (!state.compareSlug) {
    state.compareSlug = pool[0]?.slug || null;
  }

  elements.clubCompare.innerHTML = pool
    .map((row) => `<option value="${row.slug}">${row.rank}. ${app.escapeHtml(row.name)}</option>`)
    .join("");

  if (state.compareSlug) {
    elements.clubCompare.value = state.compareSlug;
  }
}

function fillPositionFilter() {
  const players = clubPlayers();
  const positions = [...new Set(players.map((player) => player.position))].sort((a, b) => a.localeCompare(b));
  if (state.squadPosition !== "all" && !positions.includes(state.squadPosition)) {
    state.squadPosition = "all";
  }
  elements.clubPosition.innerHTML = [
    `<option value="all">Tous les postes</option>`,
    ...positions.map((position) => `<option value="${position}">${position}</option>`),
  ].join("");
  elements.clubPosition.value = state.squadPosition;
}

function run() {
  runSummary();
  runSquad();
  syncUrl();
}

function runSummary() {
  const club = currentClub();
  if (!club) {
    showError("Club introuvable.");
    return;
  }

  const competition = state.data.competitions.find((item) => item.slug === club.competitionSlug);
  const compareClub = state.compareSlug ? state.data.clubsBySlug.get(state.compareSlug) : null;

  elements.clubTitle.textContent = club.name;
  elements.clubMeta.textContent = `${club.competitionName} | Saison ${club.seasonName || "en cours"}`;
  elements.clubSummaryTitle.textContent = `${club.name} - resume`;
  elements.clubSummaryText.textContent = `Rang ${club.rank}, ${club.points} points, forme recente ${club.recent.points}/15.`;

  elements.clubKpis.innerHTML = [
    { label: "Classement", value: `#${club.rank}`, detail: `${club.points} points` },
    { label: "Attaque", value: String(club.goalsFor), detail: "Buts marques" },
    { label: "Defense", value: String(club.goalsAgainst), detail: "Buts encaisses" },
    { label: "Clean sheets", value: `${app.formatNumber(club.cleanSheetRate, 1)}%`, detail: "Sur la saison" },
    { label: "Forme (5)", value: `${club.recent.points}/15`, detail: `${club.recent.wins}W ${club.recent.draws}D ${club.recent.losses}L` },
    { label: "Prochain match", value: app.formatDate(club.nextFixture?.date), detail: app.formatFixture(club.nextFixture, state.data.clubsBySlug) },
  ]
    .map((kpi) => `<article class="kpi"><small>${app.escapeHtml(kpi.label)}</small><strong>${app.escapeHtml(kpi.value)}</strong><span>${app.escapeHtml(kpi.detail)}</span></article>`)
    .join("");

  elements.clubStandingsLink.href = app.buildUrl("teams.html", { competition: club.competitionSlug });
  elements.clubCompareLink.href = app.buildUrl("compare.html", {
    mode: "club",
    competition: club.competitionSlug,
    left: club.slug,
    right: compareClub?.slug || "",
  });

  elements.clubHighlights.innerHTML = [
    `Dernier match: ${app.formatFixture(club.lastMatch, state.data.clubsBySlug)}`,
    `Prochain match: ${app.formatFixture(club.nextFixture, state.data.clubsBySlug)}`,
    `Effectif detecte: ${clubPlayers().length} joueurs`,
  ]
    .map((text) => `<article class="metric"><p>${app.escapeHtml(text)}</p></article>`)
    .join("");

  renderCharts();
}

function runSquad() {
  const players = clubPlayers().filter((player) => {
    const byPosition = state.squadPosition === "all" || player.position === state.squadPosition;
    const bySearch = !state.squadSearch || player.searchText.includes(state.squadSearch);
    return byPosition && bySearch;
  });

  players.sort((a, b) => b.minutes - a.minutes);
  elements.clubSquadCount.textContent = `${players.length} joueur${players.length > 1 ? "s" : ""}`;

  if (!players.length) {
    elements.clubSquadBody.innerHTML = `<tr><td colspan="7" class="empty">Aucun joueur pour ces filtres.</td></tr>`;
    return;
  }

  elements.clubSquadBody.innerHTML = players
    .map((player, index) => {
      const profileUrl = app.buildUrl("player.html", { player: player.slug, competition: player.competitionSlug });
      return `
        <tr>
          <td>${index + 1}</td>
          <td>
            <div class="row-id">
              <img class="avatar" src="${app.escapeHtml(player.imageUrl)}" alt="${app.escapeHtml(player.name)}" loading="lazy" />
              <a href="${profileUrl}" style="text-decoration:none;font-weight:700;">${app.escapeHtml(player.name)}</a>
            </div>
          </td>
          <td>${app.escapeHtml(player.position)}</td>
          <td>${app.formatNumber(player.minutes, 0)}</td>
          <td>${app.formatMetric("player", "goalsP90", player.metrics.goalsP90)}</td>
          <td>${app.formatMetric("player", "assistsP90", player.metrics.assistsP90)}</td>
          <td><a href="${profileUrl}" style="text-decoration:none;">Voir profil</a></td>
        </tr>
      `;
    })
    .join("");
}

function renderCharts() {
  const club = currentClub();
  if (!club) {
    return;
  }
  const competition = state.data.competitions.find((item) => item.slug === club.competitionSlug);
  const competitionRows = competition?.table || [];

  const metrics = state.data.metrics.teamRadar;
  const normalizer = app.normalizeForRadar(competitionRows, metrics, app.getMetricValue);
  const radarValues = metrics.map((metricId) => {
    const metric = app.getMetricDefinition("team", metricId);
    const value = app.getMetricValue(club, metricId);
    return normalizer.normalizeValue(metricId, value, metric?.higherIsBetter === false);
  });

  const avg = buildAverageTeam(competitionRows, metrics);
  const avgValues = metrics.map((metricId) => {
    const metric = app.getMetricDefinition("team", metricId);
    return normalizer.normalizeValue(metricId, avg[metricId] || 0, metric?.higherIsBetter === false);
  });

  app.drawRadarChart(elements.clubRadar, {
    axes: metrics.map((metricId) => app.getMetricDefinition("team", metricId)?.label || metricId),
    datasets: [
      { values: avgValues, color: app.colors.navy, fill: "rgba(22, 50, 79, 0.16)" },
      { values: radarValues, color: app.colors.emerald, fill: app.colors.emeraldSoft },
    ],
  });

  elements.clubRadarLegend.innerHTML = `
    <span class="legend-item"><span class="legend-dot" style="background:${app.colors.emerald};"></span>${app.escapeHtml(club.name)}</span>
    <span class="legend-item"><span class="legend-dot" style="background:${app.colors.navy};"></span>Moyenne championnat</span>
  `;

  app.drawBarChart(elements.clubFormChart, ["W", "D", "L"], [club.recent.wins, club.recent.draws, club.recent.losses], {
    palette: [app.colors.emerald, app.colors.amber, app.colors.navy],
  });
}

function buildAverageTeam(rows, metricIds) {
  const output = {};
  for (const metricId of metricIds) {
    const total = rows.reduce((sum, row) => sum + app.getMetricValue(row, metricId), 0);
    output[metricId] = rows.length ? total / rows.length : 0;
  }
  return output;
}

function currentClub() {
  return state.clubSlug ? state.data.clubsBySlug.get(state.clubSlug) : null;
}

function clubPlayers() {
  return state.data.playersByClub.get(state.clubSlug) || [];
}

function activateTab(tab) {
  for (const button of elements.tabButtons) {
    button.classList.toggle("active", button.dataset.tab === tab);
  }
  elements.tabSummary.classList.toggle("active", tab === "summary");
  elements.tabSquad.classList.toggle("active", tab === "squad");
}

function syncUrl() {
  const club = currentClub();
  const params = new URLSearchParams();
  if (club?.competitionSlug) {
    params.set("competition", club.competitionSlug);
  }
  if (club?.slug) {
    params.set("club", club.slug);
  }
  if (state.compareSlug) {
    params.set("compare", state.compareSlug);
  }
  if (state.squadPosition !== "all") {
    params.set("position", state.squadPosition);
  }
  if (state.squadSearch) {
    params.set("search", elements.clubPlayerSearch.value.trim());
  }
  app.updateUrlQuery(params);
}

function showError(message) {
  if (elements.clubMeta) {
    elements.clubMeta.textContent = message;
  }
  if (elements.clubSummaryText) {
    elements.clubSummaryText.textContent = message;
  }
  if (elements.clubSquadBody) {
    elements.clubSquadBody.innerHTML = `<tr><td colspan="7" class="empty">${app.escapeHtml(message)}</td></tr>`;
  }
}
