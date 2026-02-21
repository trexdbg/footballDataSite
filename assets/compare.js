const app = window.FootballData;

const state = {
  data: null,
  mode: "player",
  competition: "all",
  left: null,
  right: null,
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  init().catch((error) => {
    console.error(error);
    showError("Impossible de charger la page Duel.");
  });
});

async function init() {
  cacheElements();
  bindEvents();

  state.data = await app.loadData();
  hydrateStateFromQuery();
  ensureSelection();

  updateModeButtons();
  fillCompetitionSelect();
  fillProfiles();
  run();
}

function cacheElements() {
  elements.compareMeta = document.getElementById("compareMeta");
  elements.compareWinner = document.getElementById("compareWinner");
  elements.modeButtons = [...document.querySelectorAll("[data-mode]")];
  elements.compareCompetition = document.getElementById("compareCompetition");
  elements.compareLeft = document.getElementById("compareLeft");
  elements.compareRight = document.getElementById("compareRight");
  elements.compareTitle = document.getElementById("compareTitle");
  elements.compareSubtitle = document.getElementById("compareSubtitle");
  elements.compareRadar = document.getElementById("compareRadar");
  elements.compareLegend = document.getElementById("compareLegend");
  elements.compareStats = document.getElementById("compareStats");
}

function bindEvents() {
  for (const button of elements.modeButtons) {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      state.left = null;
      state.right = null;
      state.competition = "all";
      updateModeButtons();
      fillCompetitionSelect();
      fillProfiles();
      run();
    });
  }

  elements.compareCompetition.addEventListener("change", (event) => {
    state.competition = event.target.value;
    state.left = null;
    state.right = null;
    fillProfiles();
    run();
  });

  elements.compareLeft.addEventListener("change", (event) => {
    state.left = event.target.value;
    if (state.left === state.right) {
      state.right = profilePool().find((row) => row.slug !== state.left)?.slug || state.right;
      elements.compareRight.value = state.right || "";
    }
    run();
  });

  elements.compareRight.addEventListener("change", (event) => {
    state.right = event.target.value;
    if (state.right === state.left) {
      state.left = profilePool().find((row) => row.slug !== state.right)?.slug || state.left;
      elements.compareLeft.value = state.left || "";
    }
    run();
  });

  window.addEventListener(
    "resize",
    app.debounce(() => {
      runRadarOnly();
    }, 150),
  );
}

function hydrateStateFromQuery() {
  const params = app.getQueryParams();
  state.mode = params.get("mode") === "club" ? "club" : "player";
  state.competition = params.get("competition") || (state.mode === "club" ? state.data.competitions[0]?.slug || "all" : "all");
  state.left = params.get("left");
  state.right = params.get("right");
}

function ensureSelection() {
  const pool = profilePool();
  if (!pool.length) {
    state.left = null;
    state.right = null;
    return;
  }

  if (!state.left || !pool.some((row) => row.slug === state.left)) {
    state.left = pool[0].slug;
  }
  if (!state.right || !pool.some((row) => row.slug === state.right) || state.right === state.left) {
    state.right = pool.find((row) => row.slug !== state.left)?.slug || state.left;
  }
}

function updateModeButtons() {
  for (const button of elements.modeButtons) {
    button.classList.toggle("active", button.dataset.mode === state.mode);
  }
}

function fillCompetitionSelect() {
  elements.compareCompetition.innerHTML = [
    `<option value="all">Toutes les competitions</option>`,
    ...state.data.competitions.map(
      (competition) => `<option value="${competition.slug}">${app.escapeHtml(competition.name)}</option>`,
    ),
  ].join("");
  elements.compareCompetition.value = state.competition;
}

function fillProfiles() {
  ensureSelection();
  const pool = profilePool();
  elements.compareLeft.innerHTML = pool.map((row) => `<option value="${row.slug}">${labelForRow(row)}</option>`).join("");
  elements.compareRight.innerHTML = pool.map((row) => `<option value="${row.slug}">${labelForRow(row)}</option>`).join("");
  if (state.left) {
    elements.compareLeft.value = state.left;
  }
  if (state.right) {
    elements.compareRight.value = state.right;
  }
}

function labelForRow(row) {
  if (state.mode === "club") {
    return `${row.rank}. ${row.name}`;
  }
  return `${row.name} (${row.position}, ${row.clubName})`;
}

function profilePool() {
  if (state.mode === "club") {
    return state.data.clubs
      .filter((club) => state.competition === "all" || club.competitionSlug === state.competition)
      .sort((a, b) => a.rank - b.rank);
  }

  return state.data.players
    .filter((player) => state.competition === "all" || player.competitionSlug === state.competition)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function run() {
  const pool = profilePool();
  elements.compareMeta.textContent = `${pool.length} profils disponibles dans ce mode.`;

  const left = pool.find((row) => row.slug === state.left);
  const right = pool.find((row) => row.slug === state.right);

  if (!left || !right) {
    showError("Selectionne deux profils valides.");
    return;
  }

  const metrics = selectedMetrics(left, right);
  const metricKind = state.mode === "club" ? "team" : "player";
  const normalizer = app.normalizeForRadar(pool, metrics, app.getMetricValue);

  const leftValues = metrics.map((metricId) => {
    const metric = app.getMetricDefinition(metricKind, metricId);
    return normalizer.normalizeValue(metricId, app.getMetricValue(left, metricId), metric?.higherIsBetter === false);
  });

  const rightValues = metrics.map((metricId) => {
    const metric = app.getMetricDefinition(metricKind, metricId);
    return normalizer.normalizeValue(metricId, app.getMetricValue(right, metricId), metric?.higherIsBetter === false);
  });

  elements.compareTitle.textContent = state.mode === "club" ? "Duel equipes" : "Duel joueurs";
  elements.compareSubtitle.textContent = `${nameFor(left)} vs ${nameFor(right)}`;

  app.drawRadarChart(elements.compareRadar, {
    axes: metrics.map((metricId) => app.getMetricDefinition(metricKind, metricId)?.label || metricId),
    datasets: [
      { values: leftValues, color: app.colors.emerald, fill: app.colors.emeraldSoft },
      { values: rightValues, color: app.colors.amber, fill: app.colors.amberSoft },
    ],
  });

  elements.compareLegend.innerHTML = `
    <span class="legend-item"><span class="legend-dot" style="background:${app.colors.emerald};"></span>${app.escapeHtml(nameFor(left))}</span>
    <span class="legend-item"><span class="legend-dot" style="background:${app.colors.amber};"></span>${app.escapeHtml(nameFor(right))}</span>
  `;

  let leftWins = 0;
  let rightWins = 0;

  elements.compareStats.innerHTML = metrics
    .map((metricId) => {
      const def = app.getMetricDefinition(metricKind, metricId);
      const leftRaw = app.getMetricValue(left, metricId);
      const rightRaw = app.getMetricValue(right, metricId);

      const leftBetter = def?.higherIsBetter === false ? leftRaw <= rightRaw : leftRaw >= rightRaw;
      const equal = leftRaw === rightRaw;

      if (!equal) {
        if (leftBetter) {
          leftWins += 1;
        } else {
          rightWins += 1;
        }
      }

      const label = equal ? "Egalite" : leftBetter ? "A devant" : "B devant";
      const cls = equal ? "muted" : leftBetter ? "good" : "warn";

      return `
        <article class="metric">
          <strong>${app.escapeHtml(def?.label || metricId)}</strong>
          <p>A: ${app.formatMetric(metricKind, metricId, leftRaw)}</p>
          <p>B: ${app.formatMetric(metricKind, metricId, rightRaw)}</p>
          <p class="${cls}">${label}</p>
        </article>
      `;
    })
    .join("");

  updateWinnerLabel(left, right, leftWins, rightWins);
  syncUrl();
}

function updateWinnerLabel(left, right, leftWins, rightWins) {
  if (!elements.compareWinner) {
    return;
  }

  if (leftWins === rightWins) {
    elements.compareWinner.textContent = `Resultat du duel: egalite ${leftWins}-${rightWins}`;
    return;
  }

  const winner = leftWins > rightWins ? nameFor(left) : nameFor(right);
  const scoreLeft = Math.max(leftWins, rightWins);
  const scoreRight = Math.min(leftWins, rightWins);
  elements.compareWinner.textContent = `Resultat du duel: ${winner} gagne ${scoreLeft}-${scoreRight}`;
}

function nameFor(row) {
  return row.name;
}

function selectedMetrics(left, right) {
  if (state.mode === "club") {
    return state.data.metrics.teamRadar;
  }

  if (left.position === right.position) {
    return app.getPositionProfile(left.position);
  }

  return ["contributionsP90", "goalsP90", "assistsP90", "shotsOnTargetP90", "passesP90", "duelsWonP90"];
}

function runRadarOnly() {
  const pool = profilePool();
  const left = pool.find((row) => row.slug === state.left);
  const right = pool.find((row) => row.slug === state.right);
  if (!left || !right) {
    return;
  }
  run();
}

function syncUrl() {
  const params = new URLSearchParams();
  params.set("mode", state.mode);
  if (state.competition !== "all") {
    params.set("competition", state.competition);
  }
  if (state.left) {
    params.set("left", state.left);
  }
  if (state.right) {
    params.set("right", state.right);
  }
  app.updateUrlQuery(params);
}

function showError(message) {
  if (elements.compareMeta) {
    elements.compareMeta.textContent = message;
  }
  if (elements.compareWinner) {
    elements.compareWinner.textContent = "Resultat du duel: -";
  }
  if (elements.compareStats) {
    elements.compareStats.innerHTML = `<p class="empty">${app.escapeHtml(message)}</p>`;
  }
}
