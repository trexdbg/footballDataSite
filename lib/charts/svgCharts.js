const SVG_NS = "http://www.w3.org/2000/svg";

function createSvgElement(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    node.setAttribute(key, String(value));
  });
  return node;
}

function clearContainer(container) {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
}

function buildSvgRoot(width, height, options = {}) {
  const svg = createSvgElement("svg", {
    viewBox: `0 0 ${width} ${height}`,
    width,
    height,
    role: "img",
    "aria-label": options.ariaLabel || options.title || "Graphique",
  });

  const title = createSvgElement("title");
  title.textContent = options.title || "Graphique";
  const desc = createSvgElement("desc");
  desc.textContent =
    options.description || "Graphique statistique accompagné d'un tableau résumé.";
  svg.append(title, desc);
  return svg;
}

function appendSummaryTable(container, captionText, headers, rows, formatter = (v) => String(v)) {
  const wrap = document.createElement("div");
  wrap.className = "chart-table table-wrap";

  const table = document.createElement("table");
  const caption = document.createElement("caption");
  caption.textContent = captionText;
  table.append(caption);

  const thead = document.createElement("thead");
  const hr = document.createElement("tr");
  headers.forEach((headerText) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = headerText;
    hr.append(th);
  });
  thead.append(hr);
  table.append(thead);

  const tbody = document.createElement("tbody");
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    row.forEach((value) => {
      const td = document.createElement("td");
      td.textContent = formatter(value);
      tr.append(td);
    });
    tbody.append(tr);
  });
  table.append(tbody);
  wrap.append(table);
  container.append(wrap);
}

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "N/A";
  }
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits }).format(value);
}

export function renderBarChartSVG(container, items, options = {}) {
  clearContainer(container);
  const shell = document.createElement("div");
  shell.className = "chart-shell";
  container.append(shell);

  if (!Array.isArray(items) || items.length === 0) {
    shell.append(document.createTextNode("Pas assez de données pour le bar chart."));
    return;
  }

  const safeItems = items.map((item) => ({
    label: String(item.label || ""),
    value: typeof item.value === "number" ? item.value : 0,
    color: item.color || "#0e8a69",
  }));
  const maxValue = Math.max(1, ...safeItems.map((item) => item.value));
  const width = 760;
  const height = Math.max(220, safeItems.length * 34 + 70);
  const margin = { top: 24, right: 30, bottom: 18, left: 230 };
  const chartWidth = width - margin.left - margin.right;

  const svg = buildSvgRoot(width, height, {
    title: options.title || "Comparaison en barres",
    description:
      options.description || "Chaque barre représente la valeur d'une statistique.",
    ariaLabel: options.ariaLabel,
  });

  const axis = createSvgElement("line", {
    x1: margin.left,
    y1: margin.top - 8,
    x2: margin.left,
    y2: height - margin.bottom,
    stroke: "#6a787b",
    "stroke-width": 1.5,
  });
  svg.append(axis);

  safeItems.forEach((item, index) => {
    const barHeight = 20;
    const y = margin.top + index * 32;
    const valueWidth = (item.value / maxValue) * chartWidth;

    const label = createSvgElement("text", {
      x: margin.left - 8,
      y: y + 14,
      "text-anchor": "end",
      fill: "#3a4b4e",
      "font-size": 12,
    });
    label.textContent = item.label;
    svg.append(label);

    const rect = createSvgElement("rect", {
      x: margin.left,
      y,
      width: Math.max(0, valueWidth),
      height: barHeight,
      rx: 4,
      fill: item.color,
      opacity: 0.85,
    });
    svg.append(rect);

    const valueText = createSvgElement("text", {
      x: margin.left + valueWidth + 8,
      y: y + 14,
      fill: "#1e2b2d",
      "font-size": 12,
    });
    valueText.textContent = formatNumber(item.value, 2);
    svg.append(valueText);
  });

  shell.append(svg);
  appendSummaryTable(
    shell,
    options.tableCaption || "Résumé du bar chart",
    ["Élément", "Valeur"],
    safeItems.map((item) => [item.label, formatNumber(item.value, 2)]),
    (value) => String(value)
  );
}

export function renderLineChartSVG(container, series, options = {}) {
  clearContainer(container);
  const shell = document.createElement("div");
  shell.className = "chart-shell";
  container.append(shell);

  if (!Array.isArray(series) || series.length === 0) {
    shell.append(document.createTextNode("Pas assez de données pour le line chart."));
    return;
  }

  const nonEmpty = series.filter((entry) => Array.isArray(entry.points) && entry.points.length > 0);
  if (nonEmpty.length === 0) {
    shell.append(document.createTextNode("Pas assez de points pour dessiner la courbe."));
    return;
  }

  const width = 760;
  const height = 340;
  const margin = { top: 30, right: 24, bottom: 56, left: 54 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const allY = nonEmpty.flatMap((entry) => entry.points.map((point) => Number(point.y || 0)));
  const maxY = Math.max(1, ...allY);
  const minY = Math.min(0, ...allY);
  const yRange = maxY - minY || 1;

  const maxPoints = Math.max(...nonEmpty.map((entry) => entry.points.length));
  const xStep = maxPoints > 1 ? chartWidth / (maxPoints - 1) : chartWidth;

  const svg = buildSvgRoot(width, height, {
    title: options.title || "Evolution comparée",
    description: options.description || "Deux courbes pour comparer la progression.",
    ariaLabel: options.ariaLabel,
  });

  for (let i = 0; i <= 5; i += 1) {
    const y = margin.top + (i / 5) * chartHeight;
    const value = maxY - (i / 5) * yRange;
    const line = createSvgElement("line", {
      x1: margin.left,
      y1: y,
      x2: width - margin.right,
      y2: y,
      stroke: "#8fa3a6",
      "stroke-width": 0.8,
      "stroke-dasharray": "3 3",
    });
    const label = createSvgElement("text", {
      x: margin.left - 8,
      y: y + 4,
      "text-anchor": "end",
      fill: "#3a4b4e",
      "font-size": 11,
    });
    label.textContent = formatNumber(value, 1);
    svg.append(line, label);
  }

  const labels = nonEmpty[0].points.map((point, idx) => point.label || `Point ${idx + 1}`);
  labels.forEach((labelText, idx) => {
    const x = margin.left + idx * xStep;
    const label = createSvgElement("text", {
      x,
      y: height - margin.bottom + 18,
      "text-anchor": "middle",
      fill: "#3a4b4e",
      "font-size": 11,
    });
    label.textContent = labelText;
    svg.append(label);
  });

  nonEmpty.forEach((entry) => {
    const color = entry.color || "#0e8a69";
    const points = entry.points.map((point, idx) => {
      const x = margin.left + idx * xStep;
      const y = margin.top + ((maxY - Number(point.y || 0)) / yRange) * chartHeight;
      return { x, y, raw: point };
    });

    const pathData = points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(" ");
    const path = createSvgElement("path", {
      d: pathData,
      fill: "none",
      stroke: color,
      "stroke-width": 2.4,
    });
    svg.append(path);

    points.forEach((point) => {
      const circle = createSvgElement("circle", {
        cx: point.x,
        cy: point.y,
        r: 3.3,
        fill: color,
      });
      svg.append(circle);
    });
  });

  nonEmpty.forEach((entry, idx) => {
    const legendY = 20 + idx * 16;
    const legendLine = createSvgElement("line", {
      x1: width - 170,
      y1: legendY,
      x2: width - 150,
      y2: legendY,
      stroke: entry.color || "#0e8a69",
      "stroke-width": 3,
    });
    const legendText = createSvgElement("text", {
      x: width - 144,
      y: legendY + 4,
      fill: "#1e2b2d",
      "font-size": 11,
    });
    legendText.textContent = entry.name || `Série ${idx + 1}`;
    svg.append(legendLine, legendText);
  });

  shell.append(svg);

  const header = ["Point", ...nonEmpty.map((entry) => entry.name || "Série")];
  const rows = labels.map((label, idx) => {
    const values = nonEmpty.map((entry) => {
      const point = entry.points[idx];
      return point ? formatNumber(point.y, 2) : "N/A";
    });
    return [label, ...values];
  });

  appendSummaryTable(
    shell,
    options.tableCaption || "Résumé du line chart",
    header,
    rows,
    (value) => String(value)
  );
}

export function renderRadarChartSVG(container, metrics, options = {}) {
  clearContainer(container);
  const shell = document.createElement("div");
  shell.className = "chart-shell";
  container.append(shell);

  if (!Array.isArray(metrics) || metrics.length < 3) {
    shell.append(
      document.createTextNode("Le radar a besoin d'au moins 3 métriques pour être lisible.")
    );
    return;
  }

  const width = 540;
  const height = 420;
  const cx = 250;
  const cy = 210;
  const radius = 140;

  const svg = buildSvgRoot(width, height, {
    title: options.title || "Radar des forces",
    description: options.description || "Comparaison des forces sur plusieurs métriques.",
    ariaLabel: options.ariaLabel,
  });

  for (let ring = 1; ring <= 5; ring += 1) {
    const ringPoints = metrics.map((_, index) => {
      const angle = (Math.PI * 2 * index) / metrics.length - Math.PI / 2;
      const r = (radius * ring) / 5;
      return `${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`;
    });
    const poly = createSvgElement("polygon", {
      points: ringPoints.join(" "),
      fill: "none",
      stroke: "#8fa3a6",
      "stroke-width": 0.8,
      "stroke-dasharray": ring === 5 ? "0" : "3 2",
      opacity: ring === 5 ? 0.8 : 0.6,
    });
    svg.append(poly);
  }

  metrics.forEach((metric, index) => {
    const angle = (Math.PI * 2 * index) / metrics.length - Math.PI / 2;
    const axisX = cx + Math.cos(angle) * radius;
    const axisY = cy + Math.sin(angle) * radius;
    svg.append(
      createSvgElement("line", {
        x1: cx,
        y1: cy,
        x2: axisX,
        y2: axisY,
        stroke: "#6a787b",
        "stroke-width": 1,
      })
    );
    const labelX = cx + Math.cos(angle) * (radius + 18);
    const labelY = cy + Math.sin(angle) * (radius + 18);
    const label = createSvgElement("text", {
      x: labelX,
      y: labelY,
      "text-anchor":
        Math.cos(angle) > 0.35 ? "start" : Math.cos(angle) < -0.35 ? "end" : "middle",
      "dominant-baseline":
        Math.sin(angle) > 0.45 ? "hanging" : Math.sin(angle) < -0.45 ? "auto" : "middle",
      fill: "#1e2b2d",
      "font-size": 11,
    });
    label.textContent = metric.label;
    svg.append(label);
  });

  const makePolygon = (key, color) => {
    const points = metrics.map((metric, index) => {
      const max = Math.max(1, Number(metric.max || 1));
      const value = Math.max(0, Number(metric[key] || 0));
      const ratio = Math.min(1, value / max);
      const angle = (Math.PI * 2 * index) / metrics.length - Math.PI / 2;
      return `${cx + Math.cos(angle) * radius * ratio},${cy + Math.sin(angle) * radius * ratio}`;
    });
    return createSvgElement("polygon", {
      points: points.join(" "),
      fill: color,
      stroke: color,
      "stroke-width": 2,
      opacity: 0.28,
    });
  };

  const colorA = options.colorA || "#0e8a69";
  const colorB = options.colorB || "#d95f02";
  svg.append(makePolygon("a", colorA));
  svg.append(makePolygon("b", colorB));

  const legendA = createSvgElement("text", {
    x: width - 180,
    y: 28,
    fill: colorA,
    "font-size": 12,
  });
  legendA.textContent = options.labelA || "Joueur A";
  const legendB = createSvgElement("text", {
    x: width - 180,
    y: 46,
    fill: colorB,
    "font-size": 12,
  });
  legendB.textContent = options.labelB || "Joueur B";
  svg.append(legendA, legendB);

  shell.append(svg);
  appendSummaryTable(
    shell,
    options.tableCaption || "Résumé du radar chart",
    ["Métrique", options.labelA || "Joueur A", options.labelB || "Joueur B"],
    metrics.map((metric) => [
      metric.label,
      formatNumber(metric.a, 2),
      formatNumber(metric.b, 2),
    ]),
    (value) => String(value)
  );
}
