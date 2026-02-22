const METRIC_LABELS = {
  minutes: "Minutes jouees",
  matches_played: "Matchs joues",
  goals: "Buts",
  assists: "Passes decisives",
  saves: "Arrets",
  saved_ibox: "Arrets dans la surface",
  dive_save: "Parades plongees",
  good_high_claim: "Sorties aeriennes gagnees",
  punches: "Poings utilises",
  accurate_keeper_sweeper: "Sorties gardien reussies",
  accurate_pass: "Passes reussies",
  total_pass: "Passes tentees",
  missed_pass: "Passes ratees",
  successful_final_third_passes: "Passes vers le dernier tiers",
  pen_area_entries: "Entrees dans la surface",
  accurate_cross: "Centres reussis",
  won_contest: "Duels offensifs gagnes",
  duel_won: "Duels gagnes",
  duel_lost: "Duels perdus",
  duelsTotal: "Duels joues",
  duelsWonRate: "Taux de duels gagnes",
  total_tackle: "Tacles tentes",
  won_tackle: "Tacles gagnes",
  tackleSuccessRate: "Taux de tacles gagnes",
  interception_won: "Interceptions gagnees",
  outfielder_block: "Tirs bloques",
  effective_clearance: "Degagements",
  blocked_cross: "Centres bloques",
  last_man_tackle: "Dernier tacle",
  poss_won: "Ballons recuperes",
  poss_lost_ctrl: "Ballons perdus",
  challenge_lost: "Duels defensifs perdus",
  fouls: "Fautes commises",
  was_fouled: "Fautes subies",
  yellow_card: "Cartons jaunes",
  red_card: "Cartons rouges",
  passAccuracy: "Precision de passe",
  decisiveActions: "Actions decisives",
};

const POSITION_METRICS = {
  Gardien: [
    "saves",
    "saved_ibox",
    "good_high_claim",
    "accurate_keeper_sweeper",
    "passAccuracy",
    "accurate_pass",
    "punches",
  ],
  Defenseur: [
    "interception_won",
    "won_tackle",
    "tackleSuccessRate",
    "duelsWonRate",
    "effective_clearance",
    "blocked_cross",
    "accurate_pass",
    "passAccuracy",
  ],
  Milieu: [
    "accurate_pass",
    "passAccuracy",
    "successful_final_third_passes",
    "pen_area_entries",
    "duelsWonRate",
    "poss_won",
    "won_contest",
    "decisiveActions",
  ],
  Attaquant: [
    "decisiveActions",
    "pen_area_entries",
    "successful_final_third_passes",
    "won_contest",
    "duel_won",
    "accurate_pass",
    "passAccuracy",
  ],
  default: [
    "decisiveActions",
    "accurate_pass",
    "passAccuracy",
    "duelsWonRate",
    "interception_won",
    "saves",
  ],
};

const RATE_METRICS = new Set(["passAccuracy", "duelsWonRate", "tackleSuccessRate"]);

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
    return "-";
  }
  if (typeof value !== "number") {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return "-";
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

export function metricIsPercent(metricKey) {
  if (!metricKey) {
    return false;
  }
  if (RATE_METRICS.has(metricKey)) {
    return true;
  }
  const normalized = String(metricKey).toLowerCase();
  return normalized.includes("rate") || normalized.includes("accuracy");
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
  if (metricKey === "tackleSuccessRate") {
    return player.stats.tackleSuccessRate ?? null;
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

export function inferPositionGroup(position) {
  const normalized = String(position || "").toLowerCase();
  if (normalized.includes("gardien") || normalized.includes("goalkeeper")) {
    return "Gardien";
  }
  if (normalized.includes("defenseur") || normalized.includes("defender")) {
    return "Defenseur";
  }
  if (normalized.includes("milieu") || normalized.includes("midfielder")) {
    return "Milieu";
  }
  if (normalized.includes("attaquant") || normalized.includes("forward") || normalized.includes("striker")) {
    return "Attaquant";
  }
  return "default";
}

export function metricsForPosition(player, options = {}) {
  const limit = Number(options.limit) > 0 ? Number(options.limit) : 4;
  const preferPer90 = Boolean(options.preferPer90);
  if (!player) {
    return [];
  }

  const positionGroup = inferPositionGroup(player.position);
  const candidates = [
    ...(POSITION_METRICS[positionGroup] || []),
    ...POSITION_METRICS.default,
  ];
  const uniqueCandidates = Array.from(new Set(candidates));

  const selected = [];
  for (const key of uniqueCandidates) {
    const value = resolveMetricValue(player, key, { preferPer90 });
    if (value === null || value === undefined) {
      continue;
    }
    selected.push({ key, value });
    if (selected.length >= limit) {
      break;
    }
  }
  return selected;
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
  card.append(el("h2", { text: "Preparation du terrain" }));
  card.append(el("p", { text: message }));
  const meter = el("div", { className: "loading-meter" });
  meter.append(el("span", { className: "loading-fill" }));
  card.append(meter);
  return card;
}

export function createErrorCard(options = {}) {
  const card = el("section", { className: "page-card error-card" });
  card.append(el("h2", { text: options.title || "Oups, quelque chose bloque." }));
  card.append(
    el("p", {
      text:
        options.message ||
        "Je n'arrive pas a lire les donnees pour le moment. Verifie players_stats/teams_stats (.json.gz ou .json).",
    })
  );
  if (options.details) {
    const details = el("details");
    details.append(el("summary", { text: "Details techniques" }));
    details.append(el("pre", { text: options.details }));
    card.append(details);
  }
  return card;
}

export function createDataQualityPanel(dataQuality) {
  const details = el("details");
  details.append(el("summary", { text: "Qualite des donnees" }));
  if (!dataQuality) {
    details.append(el("p", { text: "Aucune donnee a analyser pour le moment." }));
    return details;
  }

  details.append(
    el("p", { text: `Joueurs charges: ${formatNumber(dataQuality.playersCount, 0)}` })
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
    details.append(el("h3", { text: "Incoherences detectees" }));
    details.append(list);
  }

  return details;
}

export function createAboutDataCard(meta) {
  const card = el("section", { className: "page-card" });
  card.append(el("h2", { text: "A propos des donnees" }));
  const generatedAtText = meta?.generatedAt
    ? `Date de generation: ${meta.generatedAt}`
    : "Date de generation: date inconnue";
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
  return label || "-";
}
