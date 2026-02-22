import {
  renderBarChartSVG,
  renderLineChartSVG,
  renderRadarChartSVG,
} from "./svgCharts.js";

function clearNode(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function formatValue(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "N/A";
  }
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value);
}

function appendSummaryTable(container, captionText, headers, rows) {
  const wrap = document.createElement("div");
  wrap.className = "chart-table table-wrap";
  const table = document.createElement("table");
  const caption = document.createElement("caption");
  caption.textContent = captionText;
  table.append(caption);
  const thead = document.createElement("thead");
  const hr = document.createElement("tr");
  headers.forEach((header) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = header;
    hr.append(th);
  });
  thead.append(hr);
  table.append(thead);
  const tbody = document.createElement("tbody");
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    row.forEach((cell) => {
      const td = document.createElement("td");
      td.textContent = String(cell);
      tr.append(td);
    });
    tbody.append(tr);
  });
  table.append(tbody);
  wrap.append(table);
  container.append(wrap);
}

function createChartShell(container) {
  clearNode(container);
  const shell = document.createElement("div");
  shell.className = "chart-shell";
  container.append(shell);
  return shell;
}

export class ChartProvider {
  constructor(config) {
    this.config = config;
    this.chartJsReady = false;
    this.chartJsError = null;
    if (config.useChartJs) {
      this.loadChartJs();
    }
  }

  loadChartJs() {
    if (window.Chart) {
      this.chartJsReady = true;
      return;
    }
    const existing = document.querySelector("script[data-chartjs-loader='true']");
    if (existing) {
      existing.addEventListener("load", () => {
        this.chartJsReady = Boolean(window.Chart);
      });
      existing.addEventListener("error", () => {
        this.chartJsError = "Erreur de chargement Chart.js.";
      });
      return;
    }

    const script = document.createElement("script");
    script.dataset.chartjsLoader = "true";
    script.src = this.config.chartJsLocalUrl || this.config.chartJsCdnUrl;
    script.async = true;
    script.onload = () => {
      if (window.Chart) {
        this.chartJsReady = true;
        return;
      }
      if (this.config.chartJsCdnUrl && script.src !== this.config.chartJsCdnUrl) {
        const fallback = document.createElement("script");
        fallback.dataset.chartjsLoader = "true";
        fallback.src = this.config.chartJsCdnUrl;
        fallback.async = true;
        fallback.onload = () => {
          this.chartJsReady = Boolean(window.Chart);
        };
        fallback.onerror = () => {
          this.chartJsError = "Chart.js indisponible, retour au mode SVG.";
        };
        document.head.append(fallback);
      }
    };
    script.onerror = () => {
      if (this.config.chartJsCdnUrl && script.src !== this.config.chartJsCdnUrl) {
        const fallback = document.createElement("script");
        fallback.dataset.chartjsLoader = "true";
        fallback.src = this.config.chartJsCdnUrl;
        fallback.async = true;
        fallback.onload = () => {
          this.chartJsReady = Boolean(window.Chart);
        };
        fallback.onerror = () => {
          this.chartJsError = "Chart.js indisponible, retour au mode SVG.";
        };
        document.head.append(fallback);
      } else {
        this.chartJsError = "Chart.js indisponible, retour au mode SVG.";
      }
    };
    document.head.append(script);
  }

  renderBarChart(container, items, options = {}) {
    if (!this.config.useChartJs || !this.chartJsReady || !window.Chart) {
      renderBarChartSVG(container, items, options);
      return;
    }

    const shell = createChartShell(container);
    const canvas = document.createElement("canvas");
    shell.append(canvas);
    if (container.__chartInstance) {
      container.__chartInstance.destroy();
    }
    const chart = new window.Chart(canvas.getContext("2d"), {
      type: "bar",
      data: {
        labels: items.map((item) => item.label),
        datasets: [
          {
            label: options.title || "Comparaison",
            data: items.map((item) => item.value),
            backgroundColor: items.map((item) => item.color || "#0e8a69"),
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        plugins: { legend: { display: false }, title: { display: true, text: options.title || "" } },
      },
    });
    container.__chartInstance = chart;
    shell.style.minHeight = "260px";
    appendSummaryTable(
      shell,
      options.tableCaption || "Résumé du bar chart",
      ["Élément", "Valeur"],
      items.map((item) => [item.label, formatValue(item.value)])
    );
  }

  renderLineChart(container, series, options = {}) {
    if (!this.config.useChartJs || !this.chartJsReady || !window.Chart) {
      renderLineChartSVG(container, series, options);
      return;
    }

    const shell = createChartShell(container);
    const canvas = document.createElement("canvas");
    shell.append(canvas);
    if (container.__chartInstance) {
      container.__chartInstance.destroy();
    }

    const labels = series[0]?.points?.map((point, index) => point.label || `Point ${index + 1}`) || [];
    const chart = new window.Chart(canvas.getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: series.map((entry) => ({
          label: entry.name,
          data: entry.points.map((point) => point.y),
          borderColor: entry.color || "#0e8a69",
          backgroundColor: entry.color || "#0e8a69",
          tension: 0.25,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { title: { display: true, text: options.title || "" } },
      },
    });
    container.__chartInstance = chart;
    shell.style.minHeight = "280px";

    appendSummaryTable(
      shell,
      options.tableCaption || "Résumé du line chart",
      ["Point", ...series.map((entry) => entry.name)],
      labels.map((label, idx) => [
        label,
        ...series.map((entry) => formatValue(entry.points[idx]?.y)),
      ])
    );
  }

  renderRadarChart(container, metrics, options = {}) {
    if (!this.config.useChartJs || !this.chartJsReady || !window.Chart) {
      renderRadarChartSVG(container, metrics, options);
      return;
    }

    const shell = createChartShell(container);
    const canvas = document.createElement("canvas");
    shell.append(canvas);
    if (container.__chartInstance) {
      container.__chartInstance.destroy();
    }

    const chart = new window.Chart(canvas.getContext("2d"), {
      type: "radar",
      data: {
        labels: metrics.map((metric) => metric.label),
        datasets: [
          {
            label: options.labelA || "Joueur A",
            data: metrics.map((metric) => metric.a),
            borderColor: options.colorA || "#0e8a69",
            backgroundColor: "rgba(14,138,105,0.24)",
          },
          {
            label: options.labelB || "Joueur B",
            data: metrics.map((metric) => metric.b),
            borderColor: options.colorB || "#d95f02",
            backgroundColor: "rgba(217,95,2,0.18)",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { title: { display: true, text: options.title || "" } },
      },
    });
    container.__chartInstance = chart;
    shell.style.minHeight = "320px";

    appendSummaryTable(
      shell,
      options.tableCaption || "Résumé du radar chart",
      ["Métrique", options.labelA || "Joueur A", options.labelB || "Joueur B"],
      metrics.map((metric) => [metric.label, formatValue(metric.a), formatValue(metric.b)])
    );
  }
}
