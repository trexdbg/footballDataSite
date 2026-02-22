const METRIC_LABELS = {
  minutes: "Minutes jouées",
  goals: "Buts",
  assists: "Passes décisives",
  shots: "Tirs",
  saves: "Arrêts",
  interception: "Interceptions",
  interceptions: "Interceptions",
  accurate_pass: "Passes réussies",
  total_pass: "Passes tentées",
  passAccuracy: "Précision de passe",
  duel_won: "Duels gagnés",
  duels_won: "Duels gagnés",
  duel_lost: "Duels perdus",
  duelsTotal: "Duels joués",
  duelsWonRate: "Taux de duels gagnés",
  tackles: "Tacles",
  clearances: "Dégagements",
};

export function clearNode(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

export function el(tagName, options = {}) {
  const node = document.createElement(tagName);
  if (options.className) {
    node.className = options.className;
  }
  if (options.text !== undefined) {
    node.textContent = options.text;
  }
  if (options.html !== undefined) {
    node.innerHTML = options.html;
  }
  if (options.attrs) {
    for (const [key, value] of Object.entries(options.attrs)) {
      if (value === null || value === undefined) {
        continue;
      }
      node.setAttribute(key, String(value));
    }
  }
  return node;
}

export function debounce(fn, waitMs = 150) {
  let timer = null;
  return function debounced(...args) {
    if (timer) {
      window.clearTimeout(timer);
    }
    timer = window.setTimeout(() => fn.apply(this, args), waitMs);
  };
}

export function formatNumber(value, maxFractionDigits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  if (typeof value !== "number") {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return "—";
    }
    return new Intl.NumberFormat("fr-FR", {
      maximumFractionDigits: maxFractionDigits,
    }).format(numeric);
  }
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: maxFractionDigits,
  }).format(value);
}

export function formatPercent(rate) {
  if (rate === null || rate === undefined || Number.isNaN(rate)) {
    return "N/A";
  }
  const value = rate > 1 ? rate : rate * 100;
  return `${formatNumber(value, 1)}%`;
}

export function metricLabel(metricKey) {
  if (!metricKey) {
    return "Stat";
  }
  if (METRIC_LABELS[metricKey]) {
    return METRIC_LABELS[metricKey];
  }
  return metricKey
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function resolveMetricValue(player, metricKey, options = {}) {
  const preferPer90 = Boolean(options.preferPer90);
  if (!player) {
    return null;
  }
  if (metricKey === "passAccuracy") {
    return player.stats.passAccuracy ?? null;
  }
  if (metricKey === "duelsWonRate") {
    return player.stats.duelsWonRate ?? null;
  }
  if (preferPer90) {
    if (player.per90?.[metricKey] !== undefined) {
      return player.per90[metricKey];
    }
    if (player.stats?.[metricKey] !== undefined) {
      return player.stats[metricKey];
    }
    return null;
  }
  if (player.stats?.[metricKey] !== undefined) {
    return player.stats[metricKey];
  }
  if (player.per90?.[metricKey] !== undefined) {
    return player.per90[metricKey];
  }
  return null;
}

export function highlightText(text, query) {
  const fragment = document.createDocumentFragment();
  const source = String(text ?? "");
  const trimmed = String(query ?? "").trim();
  if (!trimmed) {
    fragment.append(document.createTextNode(source));
    return fragment;
  }
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escaped, "ig");
  let lastIndex = 0;
  let match = regex.exec(source);

  while (match) {
    if (match.index > lastIndex) {
      fragment.append(document.createTextNode(source.slice(lastIndex, match.index)));
    }
    const mark = document.createElement("mark");
    mark.className = "highlight";
    mark.textContent = source.slice(match.index, match.index + match[0].length);
    fragment.append(mark);
    lastIndex = match.index + match[0].length;
    match = regex.exec(source);
  }

  if (lastIndex < source.length) {
    fragment.append(document.createTextNode(source.slice(lastIndex)));
  }
  return fragment;
}

export function createCoachNote(message) {
  return el("aside", { className: "coach-note", text: message });
}

export function createLoadingCard(message = "Chargement des statistiques...") {
  const card = el("section", { className: "page-card" });
  card.append(el("h2", { text: "Préparation du terrain" }));
  card.append(el("p", { text: message }));
  return card;
}

export function createErrorCard(options = {}) {
  const card = el("section", { className: "page-card error-card" });
  card.append(el("h2", { text: options.title || "Oups, quelque chose bloque." }));
  card.append(
    el("p", {
      text:
        options.message ||
        "Je n'arrive pas à lire les données pour le moment. Vérifie players_stats.json et teams_stats.json.",
    })
  );
  if (options.details) {
    const details = el("details");
    details.append(el("summary", { text: "Détails techniques" }));
    details.append(el("pre", { text: options.details }));
    card.append(details);
  }
  return card;
}

export function createDataQualityPanel(dataQuality) {
  const details = el("details");
  details.append(el("summary", { text: "Qualité des données" }));
  if (!dataQuality) {
    details.append(el("p", { text: "Aucune donnée à analyser pour le moment." }));
    return details;
  }

  details.append(
    el("p", { text: `Joueurs chargés: ${formatNumber(dataQuality.playersCount, 0)}` })
  );

  if (Array.isArray(dataQuality.frequentMissing) && dataQuality.frequentMissing.length > 0) {
    const list = el("ul");
    dataQuality.frequentMissing.forEach((row) => {
      const item = el("li", {
        text: `${row.label}: ${row.count} manquants (${formatPercent(row.ratio)})`,
      });
      list.append(item);
    });
    details.append(el("h3", { text: "Champs souvent manquants" }));
    details.append(list);
  }

  if (Array.isArray(dataQuality.inconsistencies) && dataQuality.inconsistencies.length > 0) {
    const list = el("ul");
    dataQuality.inconsistencies.forEach((row) => {
      list.append(el("li", { text: `${row.label}: ${row.count}` }));
    });
    details.append(el("h3", { text: "Incohérences détectées" }));
    details.append(list);
  }

  return details;
}

export function createAboutDataCard(meta) {
  const card = el("section", { className: "page-card" });
  card.append(el("h2", { text: "A propos des données" }));
  const generatedAtText = meta?.generatedAt
    ? `Date de génération: ${meta.generatedAt}`
    : "Date de génération: date inconnue";
  card.append(el("p", { text: generatedAtText }));
  return card;
}

export function createPill(label, value, className = "") {
  const chip = el("span", {
    className: `chip ${className}`.trim(),
  });
  chip.append(el("strong", { text: label }));
  chip.append(document.createTextNode(` ${value}`));
  return chip;
}

export function createHeartButton(isActive, onClick, playerName = "") {
  const button = el("button", {
    className: `heart-btn ${isActive ? "active" : ""}`.trim(),
    text: isActive ? "♥" : "♡",
    attrs: {
      type: "button",
      "aria-label": isActive
        ? `Retirer ${playerName} des favoris`
        : `Ajouter ${playerName} aux favoris`,
    },
  });
  button.addEventListener("click", onClick);
  return button;
}

export function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean).map((value) => String(value).trim()))).sort(
    (a, b) => a.localeCompare(b, "fr")
  );
}

export function byText(label) {
  return label || "—";
}
