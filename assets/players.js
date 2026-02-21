const app = window.FootballData;

const state = {
  data: null,
  search: "",
  competition: "all",
  position: "all",
  metric: "contributionsP90",
  minMinutes: 180,
  limit: 50,
};

const elements = {};

const TABLE_METRICS = ["contributionsP90", "goalsP90", "assistsP90", "shotsOnTargetP90", "passesP90", "passAccuracy", "tacklesWonP90"];

document.addEventListener("DOMContentLoaded", () => {
  init().catch((error) => {
    console.error(error);
    showError("Impossible de charger la page Joueurs.");
  });
});

async function init() {
  cacheElements();
  bindEvents();

  state.data = await app.loadData();
  hydrateStateFromQuery();

  fillCompetitionSelect();
  fillPositionSelect();
  fillMetricSelect();

  elements.playersSearch.value = app.getQueryParams().get("search") || "";
  elements.playersMinutes.value = String(state.minMinutes);
  elements.playersLimit.value = String(state.limit);

  run();
}

function cacheElements() {
  elements.playersMeta = document.getElementById("playersMeta");
  elements.playersSearch = document.getElementById("playersSearch");
  elements.playersCompetition = document.getElementById("playersCompetition");
  elements.playersPosition = document.getElementById("playersPosition");
  elements.playersMetric = document.getElementById("playersMetric");
  elements.playersMinutes = document.getElementById("playersMinutes");
  elements.playersLimit = document.getElementById("playersLimit");
  elements.playersCount = document.getElementById("playersCount");
  elements.playersMetricHead = document.getElementById("playersMetricHead");
  elements.playersBody = document.getElementById("playersBody");
  elements.playersLeaders = document.getElementById("playersLeaders");
}

function bindEvents() {
  elements.playersSearch.addEventListener("input", (event) => {
    state.search = app.normalizeText(event.target.value.trim());
    run();
  });

  elements.playersCompetition.addEventListener("change", (event) => {
    state.competition = event.target.value;
    fillPositionSelect();
    run();
  });

  elements.playersPosition.addEventListener("change", (event) => {
    state.position = event.target.value;
    run();
  });

  elements.playersMetric.addEventListener("change", (event) => {
    state.metric = event.target.value;
    run();
  });

  elements.playersMinutes.addEventListener("change", (event) => {
    state.minMinutes = Math.max(0, Number(event.target.value || 0));
    run();
  });

  elements.playersLimit.addEventListener("change", (event) => {
    state.limit = Number(event.target.value || 50);
    run();
  });
}

function hydrateStateFromQuery() {
  const params = app.getQueryParams();
  state.competition = params.get("competition") || "all";
  state.position = params.get("position") || "all";
  state.search = app.normalizeText(params.get("search") || "");
  state.metric = params.get("metric") || "contributionsP90";
  state.minMinutes = Math.max(0, Number(params.get("minMinutes") || 180));
  state.limit = Number(params.get("limit") || 50);
  if (![25, 50, 100].includes(state.limit)) {
    state.limit = 50;
  }
}

function fillCompetitionSelect() {
  elements.playersCompetition.innerHTML = [
    `<option value="all">Toutes les competitions</option>`,
    ...state.data.competitions.map(
      (competition) => `<option value="${competition.slug}">${app.escapeHtml(competition.name)}</option>`,
    ),
  ].join("");
  elements.playersCompetition.value = state.competition;
}

function fillPositionSelect() {
  const pool = state.data.players.filter((player) => state.competition === "all" || player.competitionSlug === state.competition);
  const positions = [...new Set(pool.map((player) => player.position))].sort((a, b) => a.localeCompare(b));

  if (state.position !== "all" && !positions.includes(state.position)) {
    state.position = "all";
  }

  elements.playersPosition.innerHTML = [
    `<option value="all">Tous les postes</option>`,
    ...positions.map((position) => `<option value="${position}">${position}</option>`),
  ].join("");
  elements.playersPosition.value = state.position;
}

function fillMetricSelect() {
  const options = TABLE_METRICS.map((metricId) => {
    const metric = app.getMetricDefinition("player", metricId);
    if (!metric) {
      return null;
    }
    return `<option value="${metric.id}">${app.escapeHtml(metric.label)}</option>`;
  }).filter(Boolean);

  elements.playersMetric.innerHTML = options.join("");
  if (!TABLE_METRICS.includes(state.metric)) {
    state.metric = "contributionsP90";
  }
  elements.playersMetric.value = state.metric;
}

function run() {
  const filtered = state.data.players.filter((player) => {
    const byCompetition = state.competition === "all" || player.competitionSlug === state.competition;
    const byPosition = state.position === "all" || player.position === state.position;
    const byMinutes = player.minutes >= state.minMinutes;
    const bySearch = !state.search || player.searchText.includes(state.search);
    return byCompetition && byPosition && byMinutes && bySearch;
  });

  const metricDef = app.getMetricDefinition("player", state.metric);
  const sorted = [...filtered].sort((a, b) => {
    const left = app.getMetricValue(a, state.metric);
    const right = app.getMetricValue(b, state.metric);
    if (left === right) {
      return b.minutes - a.minutes;
    }
    if (metricDef?.higherIsBetter === false) {
      return left - right;
    }
    return right - left;
  });

  renderMeta(filtered.length);
  renderTable(sorted, metricDef);
  renderLeaders(filtered);
  syncUrl();
}

function renderMeta(total) {
  elements.playersMeta.textContent = `${state.data.players.length} joueurs disponibles.`;
  elements.playersCount.textContent = `${total} joueur${total > 1 ? "s" : ""} filtres`;
}

function renderTable(sorted, metricDef) {
  elements.playersMetricHead.textContent = metricDef?.label || "Metrique";
  const rows = sorted.slice(0, state.limit);

  if (!rows.length) {
    elements.playersBody.innerHTML = `<tr><td colspan="7" class="empty">Aucun joueur avec ces filtres.</td></tr>`;
    return;
  }

  elements.playersBody.innerHTML = rows
    .map((player, index) => {
      const profileUrl = app.buildUrl("player.html", { player: player.slug, competition: player.competitionSlug });
      const clubUrl = app.buildUrl("club.html", { club: player.clubSlug, competition: player.competitionSlug });
      const metricValue = app.getMetricValue(player, state.metric);
      const metricLabel = app.formatMetric("player", state.metric, metricValue);
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
          <td><a href="${clubUrl}" style="text-decoration:none;">${app.escapeHtml(player.clubName)}</a></td>
          <td>${app.escapeHtml(player.competitionName)}</td>
          <td>${app.formatNumber(player.minutes, 0)}</td>
          <td><strong>${metricLabel}</strong></td>
        </tr>
      `;
    })
    .join("");
}

function renderLeaders(pool) {
  const metrics = ["goalsP90", "assistsP90", "shotsOnTargetP90", "passesP90", "tacklesWonP90", "interceptionsP90"];
  const leaders = metrics
    .map((metricId) => {
      const metric = app.getMetricDefinition("player", metricId);
      if (!metric) {
        return null;
      }
      const sorted = [...pool].sort((a, b) => {
        const left = app.getMetricValue(a, metricId);
        const right = app.getMetricValue(b, metricId);
        if (metric.higherIsBetter === false) {
          return left - right;
        }
        return right - left;
      });
      return { metric, player: sorted[0] || null };
    })
    .filter((entry) => entry?.player)
    .slice(0, 6);

  if (!leaders.length) {
    elements.playersLeaders.innerHTML = `<p class="empty">Aucun leader disponible.</p>`;
    return;
  }

  elements.playersLeaders.innerHTML = leaders
    .map((entry) => {
      const value = app.getMetricValue(entry.player, entry.metric.id);
      const playerUrl = app.buildUrl("player.html", { player: entry.player.slug, competition: entry.player.competitionSlug });
      return `
        <article class="player-card">
          <h3 style="font-size:0.95rem; margin-bottom:0.2rem;">${app.escapeHtml(entry.metric.label)}</h3>
          <p class="player-meta"><a href="${playerUrl}" style="text-decoration:none;font-weight:700;">${app.escapeHtml(
            entry.player.name,
          )}</a></p>
          <div class="card-tags"><span class="tag">${app.formatMetric("player", entry.metric.id, value)}</span></div>
        </article>
      `;
    })
    .join("");
}

function syncUrl() {
  const params = new URLSearchParams();
  if (state.competition !== "all") {
    params.set("competition", state.competition);
  }
  if (state.position !== "all") {
    params.set("position", state.position);
  }
  if (state.search) {
    params.set("search", elements.playersSearch.value.trim());
  }
  if (state.metric !== "contributionsP90") {
    params.set("metric", state.metric);
  }
  if (state.minMinutes !== 180) {
    params.set("minMinutes", String(state.minMinutes));
  }
  if (state.limit !== 50) {
    params.set("limit", String(state.limit));
  }
  app.updateUrlQuery(params);
}

function showError(message) {
  if (elements.playersMeta) {
    elements.playersMeta.textContent = message;
  }
  if (elements.playersBody) {
    elements.playersBody.innerHTML = `<tr><td colspan="7" class="empty">${app.escapeHtml(message)}</td></tr>`;
  }
}
