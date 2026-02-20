const DATA_URL = "data/players.json";

const PLAYER_PALETTES = [
  {
    main: "#78abf7",
    soft: "rgba(120, 171, 247, 0.24)",
    subtle: "rgba(120, 171, 247, 0.16)",
  },
  {
    main: "#f7a1b4",
    soft: "rgba(247, 161, 180, 0.24)",
    subtle: "rgba(247, 161, 180, 0.16)",
  },
];

const PRESET_LABELS = {
  balanced: "Balanced",
  offensive: "Offense",
  builder: "Build-up",
  defensive: "Defensive",
};

const state = {
  data: null,
  filteredPlayers: [],
  playerA: null,
  playerB: null,
  radarMode: "polygon",
  preset: "balanced",
  position: "all",
  club: "all",
  search: "",
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  init().catch((error) => {
    console.error("Init failed", error);
    showGlobalError("Impossible de charger les donnees.");
  });
});

async function init() {
  cacheElements();
  const data = await fetchData();
  state.data = data;

  hydrateTopMeta();
  buildPresetButtons();
  setActivePresetButton();
  setupFilters();
  setupModeButtons();
  bindEvents();
  seedInitialPlayers();
  syncPlayersFromFilters();
  renderAll();

  window.addEventListener(
    "resize",
    debounce(() => {
      drawRadar();
      drawTrend();
    }, 150),
  );
}

function cacheElements() {
  elements.playerCount = document.getElementById("playerCount");
  elements.generatedAt = document.getElementById("generatedAt");
  elements.searchInput = document.getElementById("searchInput");
  elements.positionFilter = document.getElementById("positionFilter");
  elements.clubFilter = document.getElementById("clubFilter");
  elements.playerASelect = document.getElementById("playerASelect");
  elements.playerBSelect = document.getElementById("playerBSelect");
  elements.radarModes = document.getElementById("radarModes");
  elements.presetModes = document.getElementById("presetModes");
  elements.radarCanvas = document.getElementById("radarCanvas");
  elements.trendCanvas = document.getElementById("trendCanvas");
  elements.radarLegend = document.getElementById("radarLegend");
  elements.radarMetricInfo = document.getElementById("radarMetricInfo");
  elements.playerCardA = document.getElementById("playerCardA");
  elements.playerCardB = document.getElementById("playerCardB");
  elements.metricRows = document.getElementById("metricRows");
  elements.insightList = document.getElementById("insightList");
}

async function fetchData() {
  const response = await fetch(DATA_URL, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Cannot load ${DATA_URL}: ${response.status}`);
  }
  return response.json();
}

function hydrateTopMeta() {
  elements.playerCount.textContent = String(state.data.players.length);
  elements.generatedAt.textContent = formatDateTime(state.data.generated_at_utc);
}

function setupFilters() {
  fillSelect(elements.positionFilter, [
    { value: "all", label: "Tous" },
    ...state.data.positions.map((position) => ({
      value: position,
      label: position,
    })),
  ]);

  fillSelect(elements.clubFilter, [
    { value: "all", label: "Tous" },
    ...state.data.clubs.map((club) => ({
      value: club,
      label: titleize(club),
    })),
  ]);
}

function setupModeButtons() {
  setActiveModeButton();
}

function buildPresetButtons() {
  const presets = Object.keys(state.data.metric_presets);
  elements.presetModes.innerHTML = "";

  for (const preset of presets) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.preset = preset;
    button.textContent = PRESET_LABELS[preset] || titleize(preset);
    if (preset === state.preset) {
      button.classList.add("is-active");
    }
    elements.presetModes.appendChild(button);
  }
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    syncPlayersFromFilters();
    renderAll();
  });

  elements.positionFilter.addEventListener("change", (event) => {
    state.position = event.target.value;
    syncPlayersFromFilters();
    renderAll();
  });

  elements.clubFilter.addEventListener("change", (event) => {
    state.club = event.target.value;
    syncPlayersFromFilters();
    renderAll();
  });

  elements.playerASelect.addEventListener("change", (event) => {
    state.playerA = event.target.value;
    if (state.playerA === state.playerB) {
      pickAlternativeB();
    }
    renderAll();
  });

  elements.playerBSelect.addEventListener("change", (event) => {
    state.playerB = event.target.value;
    if (state.playerB === state.playerA) {
      pickAlternativeA();
    }
    renderAll();
  });

  elements.radarModes.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-mode]");
    if (!button) {
      return;
    }
    state.radarMode = button.dataset.mode;
    setActiveModeButton();
    drawRadar();
  });

  elements.presetModes.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-preset]");
    if (!button) {
      return;
    }
    state.preset = button.dataset.preset;
    setActivePresetButton();
    renderAll();
  });
}

function seedInitialPlayers() {
  const ranked = [...state.data.players].sort(
    (left, right) => left.rankings.global_rank - right.rankings.global_rank,
  );
  state.playerA = ranked[0]?.slug || null;
  state.playerB = ranked[1]?.slug || ranked[0]?.slug || null;
}

function syncPlayersFromFilters() {
  state.filteredPlayers = getFilteredPlayers();

  if (state.filteredPlayers.length === 0) {
    state.playerA = null;
    state.playerB = null;
    fillSelect(elements.playerASelect, []);
    fillSelect(elements.playerBSelect, []);
    return;
  }

  const slugs = new Set(state.filteredPlayers.map((player) => player.slug));
  if (!slugs.has(state.playerA)) {
    state.playerA = state.filteredPlayers[0].slug;
  }
  if (!slugs.has(state.playerB) || state.playerB === state.playerA) {
    state.playerB = state.filteredPlayers.find((player) => player.slug !== state.playerA)?.slug || state.playerA;
  }

  fillSelect(
    elements.playerASelect,
    state.filteredPlayers.map((player) => ({
      value: player.slug,
      label: `${player.name} (${player.position})`,
    })),
    state.playerA,
  );

  fillSelect(
    elements.playerBSelect,
    state.filteredPlayers.map((player) => ({
      value: player.slug,
      label: `${player.name} (${player.position})`,
    })),
    state.playerB,
  );
}

function pickAlternativeB() {
  const fallback = state.filteredPlayers.find((player) => player.slug !== state.playerA);
  state.playerB = fallback?.slug || state.playerA;
  elements.playerBSelect.value = state.playerB || "";
}

function pickAlternativeA() {
  const fallback = state.filteredPlayers.find((player) => player.slug !== state.playerB);
  state.playerA = fallback?.slug || state.playerB;
  elements.playerASelect.value = state.playerA || "";
}

function getFilteredPlayers() {
  const term = normalizeSearch(state.search);
  return state.data.players.filter((player) => {
    const positionMatch = state.position === "all" || player.position === state.position;
    const clubMatch = state.club === "all" || player.club_slug === state.club;
    const searchTarget = normalizeSearch(`${player.name} ${player.club_slug} ${player.position}`);
    const searchMatch = !term || searchTarget.includes(term);
    return positionMatch && clubMatch && searchMatch;
  });
}

function renderAll() {
  const playerA = findPlayer(state.playerA);
  const playerB = findPlayer(state.playerB);

  renderLegend(playerA, playerB);
  renderCards(playerA, playerB);
  renderMetricRows(playerA, playerB);
  renderInsights(playerA, playerB);
  renderRadarMetricInfo();
  drawRadar();
  drawTrend();
}

function renderCards(playerA, playerB) {
  if (!playerA || !playerB) {
    elements.playerCardA.style.borderTopColor = "transparent";
    elements.playerCardB.style.borderTopColor = "transparent";
    elements.playerCardA.innerHTML = '<p class="is-empty">Aucun joueur ne correspond a ce filtre.</p>';
    elements.playerCardB.innerHTML = '<p class="is-empty">Aucun joueur ne correspond a ce filtre.</p>';
    return;
  }

  elements.playerCardA.style.borderTopColor = PLAYER_PALETTES[0].main;
  elements.playerCardB.style.borderTopColor = PLAYER_PALETTES[1].main;
  elements.playerCardA.innerHTML = playerCardTemplate(playerA, PLAYER_PALETTES[0], "A");
  elements.playerCardB.innerHTML = playerCardTemplate(playerB, PLAYER_PALETTES[1], "B");
}

function playerCardTemplate(player, palette, label) {
  const trend = player.summary.score_trend;
  const trendClass = trend >= 0 ? "is-pos" : "is-neg";
  const trendPrefix = trend >= 0 ? "+" : "";
  const rankLabel =
    player.rankings.position_rank > 0
      ? `Rank pos #${player.rankings.position_rank}`
      : `Global #${player.rankings.global_rank}`;

  return `
    <div class="player-header">
      <div>
        <p class="eyebrow">Joueur ${label}</p>
        <h3 class="player-name">${escapeHtml(player.name)}</h3>
        <p class="player-meta">${escapeHtml(player.position)} · ${escapeHtml(player.club_name)}</p>
      </div>
      <span class="rank-pill">${rankLabel}</span>
    </div>

    <div class="stats-strip">
      <div class="stat-box">
        <small>Forme SS2</small>
        <strong>${fmt(player.summary.ss2_form_score, 2)}</strong>
      </div>
      <div class="stat-box">
        <small>Avg score L5</small>
        <strong>${fmt(player.summary.avg_score_last5, 2)}</strong>
      </div>
      <div class="stat-box">
        <small>Trend</small>
        <strong class="${trendClass}">${trendPrefix}${fmt(trend, 2)}</strong>
      </div>
    </div>

    <div class="profile-meters">
      ${profileMeter("Attack", player.profile.attack_index, palette.main)}
      ${profileMeter("Control", player.profile.control_index, palette.main)}
      ${profileMeter("Defense", player.profile.defense_index, palette.main)}
      ${profileMeter("Consistency", player.profile.consistency_index, palette.main)}
    </div>
  `;
}

function profileMeter(label, value, color) {
  return `
    <div class="meter-row">
      <span>${label}</span>
      <div class="meter-track"><div class="meter-fill" style="width:${clamp(value, 0, 100)}%;background:${color};"></div></div>
      <strong>${fmt(value, 0)}</strong>
    </div>
  `;
}

function renderMetricRows(playerA, playerB) {
  if (!playerA || !playerB) {
    elements.metricRows.innerHTML = '<p class="is-empty">Selectionne des joueurs pour comparer les metriques.</p>';
    return;
  }

  const metrics = getActiveMetrics();
  const rows = metrics
    .map((metric) => {
      const aValue = playerA.radar[metric.id] || 0;
      const bValue = playerB.radar[metric.id] || 0;
      const diff = aValue - bValue;
      return { metric, aValue, bValue, diff };
    })
    .sort((left, right) => Math.abs(right.diff) - Math.abs(left.diff));

  elements.metricRows.innerHTML = rows
    .map(({ metric, aValue, bValue, diff }) => {
      const winner = diff >= 0 ? playerA.name : playerB.name;
      return `
        <div class="metric-row">
          <div class="metric-row-head">
            <span class="metric-label">${escapeHtml(metric.label)}</span>
            <span class="metric-values">${escapeHtml(shortName(winner))} +${fmt(Math.abs(diff), 1)}</span>
          </div>
          <div class="duel-track">
            <div class="duel-bar">
              <div class="duel-fill" style="width:${clamp(aValue, 0, 100)}%;background:${PLAYER_PALETTES[0].main};"></div>
            </div>
            <div class="duel-bar">
              <div class="duel-fill" style="width:${clamp(bValue, 0, 100)}%;background:${PLAYER_PALETTES[1].main};"></div>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderInsights(playerA, playerB) {
  if (!playerA || !playerB) {
    elements.insightList.innerHTML = "<li>Aucune comparaison disponible.</li>";
    return;
  }

  const insights = buildInsights(playerA, playerB);
  elements.insightList.innerHTML = insights.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
}

function buildInsights(playerA, playerB) {
  const metrics = getActiveMetrics();
  const comparisons = metrics.map((metric) => ({
    metric,
    diff: (playerA.radar[metric.id] || 0) - (playerB.radar[metric.id] || 0),
  }));
  comparisons.sort((left, right) => Math.abs(right.diff) - Math.abs(left.diff));

  const topGap = comparisons[0];
  const topWinner = topGap.diff >= 0 ? playerA : playerB;
  const topLoser = topGap.diff >= 0 ? playerB : playerA;

  const lines = [];
  lines.push(
    `${topWinner.name} prend l'avantage sur ${topGap.metric.label} avec ${fmt(Math.abs(topGap.diff), 1)} points de plus que ${shortName(topLoser.name)}.`,
  );

  const attackGap = playerA.profile.attack_index - playerB.profile.attack_index;
  if (Math.abs(attackGap) > 6) {
    const winner = attackGap > 0 ? playerA : playerB;
    lines.push(`${winner.name} affiche un profil offensif plus marque (${fmt(Math.abs(attackGap), 1)} pts).`);
  } else {
    lines.push("Les profils offensifs sont proches sur cet echantillon.");
  }

  const trendGap = playerA.summary.score_trend - playerB.summary.score_trend;
  if (Math.abs(trendGap) > 0.55) {
    const winner = trendGap > 0 ? playerA : playerB;
    lines.push(`${winner.name} arrive avec une dynamique recente plus positive.`);
  } else {
    lines.push("La dynamique recente est similaire entre les deux joueurs.");
  }

  const consistencyGap = playerA.profile.consistency_index - playerB.profile.consistency_index;
  const consistencyWinner = consistencyGap >= 0 ? playerA : playerB;
  lines.push(
    `${consistencyWinner.name} semble plus fiable sur la regularite (index ${fmt(
      Math.max(playerA.profile.consistency_index, playerB.profile.consistency_index),
      1,
    )}).`,
  );

  return lines.slice(0, 4);
}

function renderRadarMetricInfo() {
  const metricNames = getActiveMetrics().map((metric) => metric.label);
  elements.radarMetricInfo.textContent = metricNames.join(" · ");
}

function renderLegend(playerA, playerB) {
  if (!playerA || !playerB) {
    elements.radarLegend.innerHTML = "";
    return;
  }

  elements.radarLegend.innerHTML = `
    <div class="legend-item">
      <span class="legend-dot" style="background:${PLAYER_PALETTES[0].main};"></span>
      <span>${escapeHtml(playerA.name)}</span>
    </div>
    <div class="legend-item">
      <span class="legend-dot" style="background:${PLAYER_PALETTES[1].main};"></span>
      <span>${escapeHtml(playerB.name)}</span>
    </div>
  `;
}

function drawRadar() {
  const playerA = findPlayer(state.playerA);
  const playerB = findPlayer(state.playerB);
  const metrics = getActiveMetrics();
  if (!playerA || !playerB || metrics.length < 3) {
    clearCanvas(elements.radarCanvas);
    return;
  }

  const { ctx, width, height } = prepareCanvas(elements.radarCanvas);
  if (!ctx) {
    return;
  }

  const center = { x: width / 2, y: height / 2 };
  const radius = Math.min(width, height) * 0.34;
  const levelCount = 5;
  const axisCount = metrics.length;
  const step = (Math.PI * 2) / axisCount;
  const start = -Math.PI / 2;

  drawRadarGrid(ctx, center, radius, axisCount, levelCount, start, step);
  drawRadarLabels(ctx, center, radius + 22, metrics, start, step);

  const players = [
    { player: playerA, palette: PLAYER_PALETTES[0] },
    { player: playerB, palette: PLAYER_PALETTES[1] },
  ];

  for (const entry of players) {
    const values = metrics.map((metric) => entry.player.radar[metric.id] || 0);
    const points = getRadarPoints(values, center, radius, start, step);
    drawRadarShape(ctx, points, entry.palette, state.radarMode, step, center, radius);
  }
}

function drawRadarGrid(ctx, center, radius, axisCount, levels, start, step) {
  ctx.save();
  ctx.strokeStyle = "rgba(124, 143, 175, 0.3)";
  ctx.lineWidth = 1;

  for (let level = 1; level <= levels; level += 1) {
    const ratio = level / levels;
    ctx.beginPath();
    for (let i = 0; i < axisCount; i += 1) {
      const point = polar(center, radius * ratio, start + i * step);
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
    const tip = polar(center, radius, start + i * step);
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawRadarLabels(ctx, center, radius, metrics, start, step) {
  ctx.save();
  ctx.fillStyle = "#576989";
  ctx.font = "12px Sora";
  for (let i = 0; i < metrics.length; i += 1) {
    const point = polar(center, radius, start + i * step);
    const align = point.x < center.x - 8 ? "right" : point.x > center.x + 8 ? "left" : "center";
    ctx.textAlign = align;
    ctx.textBaseline = point.y > center.y + 6 ? "top" : point.y < center.y - 6 ? "bottom" : "middle";
    ctx.fillText(metrics[i].label, point.x, point.y);
  }
  ctx.restore();
}

function drawRadarShape(ctx, points, palette, mode, step, center, radius) {
  if (mode === "bloom") {
    drawBloomShape(ctx, points, palette);
    return;
  }
  if (mode === "petals") {
    drawPetalsShape(ctx, points, palette, step, center, radius);
    return;
  }
  drawPolygonShape(ctx, points, palette);
}

function drawPolygonShape(ctx, points, palette) {
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
  ctx.fillStyle = palette.soft;
  ctx.strokeStyle = palette.main;
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();

  for (const point of points) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 3.3, 0, Math.PI * 2);
    ctx.fillStyle = palette.main;
    ctx.fill();
  }
  ctx.restore();
}

function drawBloomShape(ctx, points, palette) {
  const count = points.length;
  if (count < 3) {
    drawPolygonShape(ctx, points, palette);
    return;
  }

  ctx.save();
  ctx.beginPath();
  const firstMid = midpoint(points[count - 1], points[0]);
  ctx.moveTo(firstMid.x, firstMid.y);
  for (let i = 0; i < count; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % count];
    const mid = midpoint(current, next);
    ctx.quadraticCurveTo(current.x, current.y, mid.x, mid.y);
  }
  ctx.closePath();
  ctx.fillStyle = palette.soft;
  ctx.strokeStyle = palette.main;
  ctx.lineWidth = 2.4;
  ctx.fill();
  ctx.stroke();

  for (const point of points) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 2.8, 0, Math.PI * 2);
    ctx.fillStyle = palette.main;
    ctx.fill();
  }

  ctx.restore();
}

function drawPetalsShape(ctx, points, palette, step, center, radius) {
  ctx.save();
  const spread = step * 0.26;

  for (const point of points) {
    const valueRatio = distance(center, point) / radius;
    const tipRadius = radius * valueRatio;
    const baseRadius = Math.max(8, radius * 0.11);
    const angle = Math.atan2(point.y - center.y, point.x - center.x);

    const leftBase = polar(center, baseRadius, angle - spread);
    const rightBase = polar(center, baseRadius, angle + spread);
    const leftCtrl = polar(center, tipRadius * 0.62, angle - spread * 0.95);
    const rightCtrl = polar(center, tipRadius * 0.62, angle + spread * 0.95);

    ctx.beginPath();
    ctx.moveTo(leftBase.x, leftBase.y);
    ctx.quadraticCurveTo(leftCtrl.x, leftCtrl.y, point.x, point.y);
    ctx.quadraticCurveTo(rightCtrl.x, rightCtrl.y, rightBase.x, rightBase.y);
    ctx.lineTo(center.x, center.y);
    ctx.closePath();
    ctx.fillStyle = palette.subtle;
    ctx.strokeStyle = hexToRgba(palette.main, 0.48);
    ctx.lineWidth = 1.2;
    ctx.fill();
    ctx.stroke();
  }

  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  });
  ctx.closePath();
  ctx.strokeStyle = palette.main;
  ctx.lineWidth = 1.8;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(center.x, center.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = palette.main;
  ctx.fill();

  ctx.restore();
}

function drawTrend() {
  const playerA = findPlayer(state.playerA);
  const playerB = findPlayer(state.playerB);
  if (!playerA || !playerB) {
    clearCanvas(elements.trendCanvas);
    return;
  }

  const { ctx, width, height } = prepareCanvas(elements.trendCanvas);
  if (!ctx) {
    return;
  }

  const padding = { top: 16, right: 20, bottom: 30, left: 34 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxPoints = 10;

  drawTrendGrid(ctx, padding, chartWidth, chartHeight);
  drawTrendSeries(ctx, playerA.matches, PLAYER_PALETTES[0], padding, chartWidth, chartHeight, maxPoints);
  drawTrendSeries(ctx, playerB.matches, PLAYER_PALETTES[1], padding, chartWidth, chartHeight, maxPoints);

  ctx.save();
  ctx.fillStyle = "#5f6f8b";
  ctx.font = "11px Sora";
  ctx.textAlign = "left";
  ctx.fillText("0", 10, height - padding.bottom + 4);
  ctx.fillText("100", 8, padding.top + 4);
  ctx.textAlign = "right";
  ctx.fillText("Last 10", width - 8, height - 8);
  ctx.restore();
}

function drawTrendGrid(ctx, padding, chartWidth, chartHeight) {
  ctx.save();
  ctx.strokeStyle = "rgba(124, 143, 175, 0.26)";
  ctx.lineWidth = 1;

  for (let i = 0; i <= 5; i += 1) {
    const y = padding.top + (chartHeight * i) / 5;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + chartWidth, y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawTrendSeries(ctx, matches, palette, padding, chartWidth, chartHeight, maxPoints) {
  const series = matches.slice(-maxPoints);
  if (series.length === 0) {
    return;
  }

  const points = series.map((match, index) => {
    const x = padding.left + (chartWidth * index) / Math.max(series.length - 1, 1);
    const y = padding.top + chartHeight - (chartHeight * clamp(match.score, 0, 100)) / 100;
    return { x, y, score: match.score };
  });

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(points[0].x, padding.top + chartHeight);
  points.forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.lineTo(points[points.length - 1].x, padding.top + chartHeight);
  ctx.closePath();
  ctx.fillStyle = palette.subtle;
  ctx.fill();

  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  });
  ctx.strokeStyle = palette.main;
  ctx.lineWidth = 2.1;
  ctx.stroke();

  for (const point of points) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = palette.main;
    ctx.fill();
  }
  ctx.restore();
}

function setActiveModeButton() {
  const buttons = elements.radarModes.querySelectorAll("button[data-mode]");
  buttons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === state.radarMode);
  });
}

function setActivePresetButton() {
  const buttons = elements.presetModes.querySelectorAll("button[data-preset]");
  buttons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.preset === state.preset);
  });
}

function getActiveMetrics() {
  const ids = state.data.metric_presets[state.preset] || state.data.metric_presets.balanced;
  return ids
    .map((id) => state.data.radar_metrics.find((metric) => metric.id === id))
    .filter(Boolean);
}

function findPlayer(slug) {
  if (!slug) {
    return null;
  }
  return state.data.players.find((player) => player.slug === slug) || null;
}

function fillSelect(selectElement, options, selected = null) {
  selectElement.innerHTML = "";
  for (const option of options) {
    const item = document.createElement("option");
    item.value = option.value;
    item.textContent = option.label;
    selectElement.appendChild(item);
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

function getRadarPoints(values, center, radius, start, step) {
  return values.map((value, index) => {
    const angle = start + index * step;
    const point = polar(center, radius * (clamp(value, 0, 100) / 100), angle);
    return { ...point, angle, value };
  });
}

function polar(center, radius, angle) {
  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius,
  };
}

function midpoint(left, right) {
  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
  };
}

function distance(left, right) {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function formatDateTime(raw) {
  if (!raw) {
    return "-";
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

function titleize(input) {
  return String(input || "")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (part) => part.toUpperCase());
}

function shortName(name) {
  const cleaned = String(name || "").trim();
  const chunks = cleaned.split(/\s+/);
  if (chunks.length <= 1) {
    return cleaned;
  }
  return `${chunks[0]} ${chunks[chunks.length - 1]}`;
}

function normalizeSearch(input) {
  return String(input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function fmt(value, decimals = 1) {
  const numeric = Number(value || 0);
  if (Number.isNaN(numeric)) {
    return "0";
  }
  return numeric.toFixed(decimals);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgba(hex, alpha) {
  const cleanHex = hex.replace("#", "");
  if (cleanHex.length !== 6) {
    return `rgba(0, 0, 0, ${alpha})`;
  }
  const red = Number.parseInt(cleanHex.slice(0, 2), 16);
  const green = Number.parseInt(cleanHex.slice(2, 4), 16);
  const blue = Number.parseInt(cleanHex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function debounce(callback, waitMs) {
  let timeoutId = null;
  return (...args) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => callback(...args), waitMs);
  };
}

function escapeHtml(input) {
  return String(input ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function showGlobalError(message) {
  const text = escapeHtml(message);
  const fallback = `<p class="is-empty">${text}</p>`;
  if (elements.playerCardA) {
    elements.playerCardA.innerHTML = fallback;
  }
  if (elements.playerCardB) {
    elements.playerCardB.innerHTML = fallback;
  }
}
