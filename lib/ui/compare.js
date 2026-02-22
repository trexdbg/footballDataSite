import {
  clearNode,
  createCoachNote,
  el,
  formatNumber,
  metricLabel,
  resolveMetricValue,
} from "./components.js";

const COMPARE_COLORS = {
  a: "#0e8a69",
  b: "#d95f02",
};

const PREFERRED_METRICS = [
  "goals",
  "assists",
  "accurate_pass",
  "passAccuracy",
  "duel_won",
  "duelsWonRate",
  "interception",
  "saves",
  "shots",
  "tackles",
];

function buildAvailableMetrics(playerA, playerB) {
  const all = new Set(PREFERRED_METRICS);
  [playerA, playerB].forEach((player) => {
    if (!player) {
      return;
    }
    Object.keys(player.stats || {}).forEach((key) => all.add(key));
    Object.keys(player.per90 || {}).forEach((key) => all.add(key));
  });
  return Array.from(all).filter((key) => {
    const aValue = resolveMetricValue(playerA, key, { preferPer90: true });
    const bValue = resolveMetricValue(playerB, key, { preferPer90: true });
    return aValue !== null || bValue !== null;
  });
}

function buildLineSeries(player, playerLabel, color, metricFallback) {
  const matches = Array.isArray(player?.lastMatches) ? player.lastMatches : [];
  if (matches.length > 0) {
    const points = matches.slice(0, 5).map((match, index) => {
      const yValue =
        match.rating ??
        match.goals ??
        match.assists ??
        match.minutes ??
        0;
      return {
        x: index,
        label: `Match ${index + 1}`,
        y: Number(yValue || 0),
      };
    });
    return { name: `${playerLabel} (5 derniers matchs)`, color, points };
  }

  const points = metricFallback.map((metricKey, index) => ({
    x: index,
    label: metricLabel(metricKey),
    y: Number(resolveMetricValue(player, metricKey, { preferPer90: true }) || 0),
  }));
  return { name: `${playerLabel} (série de métriques)`, color, points };
}

function buildCoachText(playerA, playerB, metrics) {
  let winsA = 0;
  let winsB = 0;
  const strongA = [];
  const strongB = [];

  metrics.forEach((metric) => {
    const aVal = resolveMetricValue(playerA, metric, { preferPer90: true }) || 0;
    const bVal = resolveMetricValue(playerB, metric, { preferPer90: true }) || 0;
    if (aVal > bVal) {
      winsA += 1;
      if (strongA.length < 2) {
        strongA.push(metricLabel(metric));
      }
    } else if (bVal > aVal) {
      winsB += 1;
      if (strongB.length < 2) {
        strongB.push(metricLabel(metric));
      }
    }
  });

  const first =
    winsA === winsB
      ? `Match serré: ${playerA.name} et ${playerB.name} se valent sur beaucoup de points.`
      : winsA > winsB
        ? `${playerA.name} prend l'avantage sur ${winsA} métriques contre ${winsB}.`
        : `${playerB.name} prend l'avantage sur ${winsB} métriques contre ${winsA}.`;

  const detailA = strongA.length ? `${playerA.name} brille surtout en ${strongA.join(" et ")}.` : "";
  const detailB = strongB.length ? `${playerB.name} est plus fort en ${strongB.join(" et ")}.` : "";
  const finalTip =
    "Coach tip: compare aussi les minutes jouées pour savoir si la performance est régulière.";

  return [first, detailA, detailB, finalTip].filter(Boolean).join(" ");
}

function makePlayerSelector(labelText, currentValue, players, onChange) {
  const field = el("label", { className: "field" });
  field.append(el("span", { text: labelText }));
  const select = document.createElement("select");
  select.append(el("option", { text: "Choisir un joueur", attrs: { value: "" } }));
  players.forEach((player) => {
    select.append(
      el("option", { text: `${player.name} (${player.club?.name || "Club?"})`, attrs: { value: player.slug } })
    );
  });
  select.value = currentValue || "";
  select.addEventListener("change", (event) => onChange(event.target.value));
  field.append(select);
  return field;
}

function createMetricsChooser(metrics, selectedMetrics, onToggleMetric) {
  const wrap = el("fieldset", { className: "controls-panel" });
  wrap.append(el("legend", { text: "Métriques du radar (max 5)" }));
  const row = el("div", { className: "chip-row" });
  metrics.slice(0, 16).forEach((metric) => {
    const label = el("label", { className: "chip" });
    const checkbox = el("input", {
      attrs: {
        type: "checkbox",
        value: metric,
      },
    });
    checkbox.checked = selectedMetrics.includes(metric);
    checkbox.addEventListener("change", () => onToggleMetric(metric));
    label.append(checkbox);
    label.append(document.createTextNode(metricLabel(metric)));
    row.append(label);
  });
  wrap.append(row);
  return wrap;
}

export function renderCompareView(target, context) {
  clearNode(target);
  const page = el("section", { className: "page-card" });
  page.append(el("h2", { text: "Comparer 2 joueurs" }));
  page.append(
    createCoachNote(
      "Tu peux comparer 2 joueurs poste par poste. Regarde les chiffres, puis lis l'avis du coach."
    )
  );

  const players = context.players || [];
  if (players.length < 2) {
    page.append(
      el("p", {
        className: "warning-text",
        text: "Pas assez de joueurs pour comparer. Charge d'abord les données dans Paramètres.",
      })
    );
    target.append(page);
    return;
  }

  const controls = el("div", { className: "controls-panel" });
  controls.append(el("h3", { text: "Choix des joueurs" }));
  const controlsGrid = el("div", { className: "controls-grid" });

  controlsGrid.append(
    makePlayerSelector("Joueur A", context.compare.a, players, (slug) =>
      context.actions.setComparePlayer("a", slug)
    )
  );
  controlsGrid.append(
    makePlayerSelector("Joueur B", context.compare.b, players, (slug) =>
      context.actions.setComparePlayer("b", slug)
    )
  );

  const swapButton = el("button", {
    text: "Inverser A/B",
    attrs: { type: "button", "aria-label": "Inverser les joueurs A et B" },
  });
  swapButton.addEventListener("click", context.actions.swapComparePlayers);

  controls.append(controlsGrid);
  controls.append(swapButton);
  page.append(controls);

  const playerA = players.find((player) => player.slug === context.compare.a) || null;
  const playerB = players.find((player) => player.slug === context.compare.b) || null;

  if (!playerA || !playerB) {
    page.append(el("p", { text: "Sélectionne deux joueurs pour afficher les graphiques." }));
    target.append(page);
    return;
  }

  const availableMetrics = buildAvailableMetrics(playerA, playerB);
  const selectedMetrics = (context.compare.metrics || []).filter((metric) =>
    availableMetrics.includes(metric)
  );
  const effectiveMetrics =
    selectedMetrics.length > 0 ? selectedMetrics.slice(0, 5) : availableMetrics.slice(0, 5);

  page.append(
    createMetricsChooser(availableMetrics, effectiveMetrics, (metric) =>
      context.actions.toggleCompareMetric(metric)
    )
  );

  const barContainer = el("section", { className: "page-card" });
  barContainer.append(el("h3", { text: "Bar chart: comparaison directe" }));
  const barChartHost = el("div");
  barContainer.append(barChartHost);
  page.append(barContainer);

  const barItems = [];
  effectiveMetrics.forEach((metric) => {
    const aValue = resolveMetricValue(playerA, metric, { preferPer90: true }) || 0;
    const bValue = resolveMetricValue(playerB, metric, { preferPer90: true }) || 0;
    barItems.push({
      label: `${metricLabel(metric)} - ${playerA.name}`,
      value: aValue,
      color: COMPARE_COLORS.a,
    });
    barItems.push({
      label: `${metricLabel(metric)} - ${playerB.name}`,
      value: bValue,
      color: COMPARE_COLORS.b,
    });
  });

  context.chartProvider.renderBarChart(barChartHost, barItems, {
    title: `${playerA.name} vs ${playerB.name}`,
    tableCaption: "Tableau du bar chart",
    ariaLabel: `Comparaison en barres entre ${playerA.name} et ${playerB.name}`,
  });

  const lineContainer = el("section", { className: "page-card" });
  lineContainer.append(el("h3", { text: "Line chart: évolution" }));
  const lineHost = el("div");
  lineContainer.append(lineHost);
  page.append(lineContainer);

  const lineSeries = [
    buildLineSeries(playerA, playerA.name, COMPARE_COLORS.a, effectiveMetrics),
    buildLineSeries(playerB, playerB.name, COMPARE_COLORS.b, effectiveMetrics),
  ];
  context.chartProvider.renderLineChart(lineHost, lineSeries, {
    title: "Tendance sur matchs récents ou série de métriques",
    tableCaption: "Tableau du line chart",
    ariaLabel: `Courbes de comparaison entre ${playerA.name} et ${playerB.name}`,
  });

  const radarContainer = el("section", { className: "page-card" });
  radarContainer.append(el("h3", { text: "Radar chart: zones fortes" }));
  const radarHost = el("div");
  radarContainer.append(radarHost);
  page.append(radarContainer);

  const radarMetrics = effectiveMetrics.slice(0, 5).map((metric) => {
    const a = resolveMetricValue(playerA, metric, { preferPer90: true }) || 0;
    const b = resolveMetricValue(playerB, metric, { preferPer90: true }) || 0;
    return {
      label: metricLabel(metric),
      a,
      b,
      max: Math.max(1, a, b),
    };
  });

  context.chartProvider.renderRadarChart(radarHost, radarMetrics, {
    title: "Radar des forces",
    tableCaption: "Tableau du radar chart",
    labelA: playerA.name,
    labelB: playerB.name,
    colorA: COMPARE_COLORS.a,
    colorB: COMPARE_COLORS.b,
    ariaLabel: `Radar de comparaison ${playerA.name} contre ${playerB.name}`,
  });

  const coachText = buildCoachText(playerA, playerB, effectiveMetrics);
  page.append(el("section", { className: "coach-note", text: coachText }));

  const mini = el("p", {
    className: "muted",
    text: `${playerA.name}: ${formatNumber(playerA.stats.minutes, 0)} min • ${playerB.name}: ${formatNumber(
      playerB.stats.minutes,
      0
    )} min`,
  });
  page.append(mini);

  target.append(page);
}
