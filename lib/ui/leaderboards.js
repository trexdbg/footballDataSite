import {
  clearNode,
  createCoachNote,
  el,
  formatNumber,
  formatPercent,
  metricLabel,
  resolveMetricValue,
  uniqueSorted,
} from "./components.js";

const DEFAULT_METRICS = [
  "accurate_pass",
  "duel_won",
  "interception",
  "saves",
  "goals",
  "assists",
  "passAccuracy",
  "duelsWonRate",
];

function buildMetricOptions(players) {
  const options = new Set(DEFAULT_METRICS);
  players.slice(0, 900).forEach((player) => {
    Object.keys(player.per90 || {}).forEach((key) => options.add(key));
  });
  return Array.from(options).filter((metric) => {
    return players.some((player) => resolveMetricValue(player, metric, { preferPer90: true }) !== null);
  });
}

function scoreRow(player, metricKey) {
  const per90Value = player.per90?.[metricKey];
  if (per90Value !== undefined && per90Value !== null) {
    return { value: per90Value, isPer90: true, isPercent: false };
  }
  if (metricKey === "passAccuracy" || metricKey === "duelsWonRate") {
    const value = resolveMetricValue(player, metricKey);
    return { value: value ?? null, isPer90: false, isPercent: true };
  }
  const statValue = resolveMetricValue(player, metricKey);
  return { value: statValue ?? null, isPer90: false, isPercent: false };
}

function playerIdentity(player) {
  const wrap = el("div", { className: "player-identity" });
  const avatar = el("span", { className: "avatar-sm" });
  if (player.photoUrl) {
    avatar.append(
      el("img", {
        attrs: {
          src: player.photoUrl,
          alt: `Photo de ${player.name}`,
          loading: "lazy",
          decoding: "async",
          referrerpolicy: "no-referrer",
        },
      })
    );
  } else {
    const initials = (player.name || "J")
      .split(" ")
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("");
    avatar.textContent = initials || "J";
  }
  wrap.append(avatar);

  const text = el("div");
  text.append(
    el("a", {
      text: player.name,
      attrs: { href: `#/player/${encodeURIComponent(player.slug)}` },
    })
  );
  text.append(el("p", { className: "muted", text: player.position || "—" }));
  wrap.append(text);
  return wrap;
}

function clubIdentity(player) {
  const wrap = el("div", { className: "club-badge" });
  if (player.club?.logoUrl) {
    wrap.append(
      el("img", {
        className: "club-logo-sm",
        attrs: {
          src: player.club.logoUrl,
          alt: `Logo ${player.club?.name || "club"}`,
          loading: "lazy",
          decoding: "async",
          referrerpolicy: "no-referrer",
        },
      })
    );
  }
  wrap.append(el("span", { text: player.club?.name || "—" }));
  return wrap;
}

function valueLabel(score) {
  let valueText = formatNumber(score.value, 2);
  if (score.isPercent) {
    valueText = formatPercent(score.value);
  } else if (score.isPer90) {
    valueText = `${valueText} /90`;
  }
  return valueText;
}

export function renderLeaderboardsView(target, context) {
  clearNode(target);
  const page = el("section", { className: "page-card" });
  page.append(el("h2", { text: "Leaderboards - Top stats" }));
  page.append(
    createCoachNote(
      "Coach tip: les stats /90 aident a comparer des joueurs qui n'ont pas joue le meme nombre de minutes."
    )
  );

  const players = context.players || [];
  if (players.length === 0) {
    page.append(
      el("p", {
        text: "Charge des donnees pour voir les meilleurs joueurs par metrique.",
        className: "warning-text",
      })
    );
    target.append(page);
    return;
  }

  const metricOptions = buildMetricOptions(players);
  const selectedMetric = metricOptions.includes(context.options.metric)
    ? context.options.metric
    : metricOptions[0];

  const controls = el("div", { className: "controls-panel" });
  const grid = el("div", { className: "controls-grid" });

  const metricField = el("label", { className: "field" });
  metricField.append(el("span", { text: "Metrique" }));
  const metricSelect = document.createElement("select");
  metricOptions.forEach((metric) => {
    metricSelect.append(el("option", { text: metricLabel(metric), attrs: { value: metric } }));
  });
  metricSelect.value = selectedMetric;
  metricSelect.addEventListener("change", (event) =>
    context.actions.setLeaderboardOption("metric", event.target.value)
  );
  metricField.append(metricSelect);

  const positionField = el("label", { className: "field" });
  positionField.append(el("span", { text: "Poste" }));
  const positionSelect = document.createElement("select");
  positionSelect.append(el("option", { text: "Tous", attrs: { value: "" } }));
  uniqueSorted(players.map((player) => player.position)).forEach((position) => {
    positionSelect.append(el("option", { text: position, attrs: { value: position } }));
  });
  positionSelect.value = context.options.position;
  positionSelect.addEventListener("change", (event) =>
    context.actions.setLeaderboardOption("position", event.target.value)
  );
  positionField.append(positionSelect);

  const minField = el("label", { className: "field" });
  minField.append(el("span", { text: "Minutes minimum" }));
  const minInput = el("input", {
    attrs: {
      type: "number",
      min: "0",
      step: "10",
      value: String(context.options.minutesMin || 0),
    },
  });
  minInput.addEventListener("change", (event) =>
    context.actions.setLeaderboardOption("minutesMin", Number(event.target.value) || 0)
  );
  minField.append(minInput);

  const topField = el("label", { className: "field" });
  topField.append(el("span", { text: "Top N" }));
  const topSelect = document.createElement("select");
  [10, 25, 50].forEach((count) => {
    topSelect.append(el("option", { text: String(count), attrs: { value: String(count) } }));
  });
  topSelect.value = String(context.options.topN || 10);
  topSelect.addEventListener("change", (event) =>
    context.actions.setLeaderboardOption("topN", Number(event.target.value) || 10)
  );
  topField.append(topSelect);

  grid.append(metricField, positionField, minField, topField);
  controls.append(grid);
  page.append(controls);

  const rows = players
    .filter((player) => {
      if (context.options.position && player.position !== context.options.position) {
        return false;
      }
      const minutes = player.stats?.minutes ?? 0;
      return minutes >= (context.options.minutesMin || 0);
    })
    .map((player) => {
      const score = scoreRow(player, selectedMetric);
      return { player, score };
    })
    .filter((entry) => entry.score.value !== null && entry.score.value !== undefined)
    .sort((a, b) => b.score.value - a.score.value)
    .slice(0, context.options.topN || 10);

  const cards = el("div", { className: "leaderboards-cards" });
  const cardsFragment = document.createDocumentFragment();
  rows.forEach((entry, index) => {
    const card = el("article", { className: "player-mini-card" });
    card.append(el("p", { className: "muted", text: `#${index + 1}` }));
    card.append(playerIdentity(entry.player));
    card.append(clubIdentity(entry.player));
    card.append(
      el("p", { text: `${metricLabel(selectedMetric)}: ${valueLabel(entry.score)}` })
    );
    card.append(
      el("p", {
        className: "muted",
        text: `Minutes: ${formatNumber(entry.player.stats?.minutes, 0)}`,
      })
    );
    cardsFragment.append(card);
  });
  cards.append(cardsFragment);
  page.append(cards);

  const tableWrap = el("div", { className: "table-wrap leaderboards-table" });
  const table = document.createElement("table");
  const caption = document.createElement("caption");
  caption.textContent = `Top ${context.options.topN || 10} - ${metricLabel(selectedMetric)}`;
  table.append(caption);
  const thead = document.createElement("thead");
  const hr = document.createElement("tr");
  ["Rang", "Joueur", "Club", "Poste", "Minutes", "Valeur"].forEach((name) => {
    hr.append(el("th", { text: name, attrs: { scope: "col" } }));
  });
  thead.append(hr);
  table.append(thead);

  const tbody = document.createElement("tbody");
  rows.forEach((entry, index) => {
    const tr = document.createElement("tr");
    tr.append(el("td", { text: String(index + 1) }));

    const nameTd = document.createElement("td");
    nameTd.append(playerIdentity(entry.player));
    tr.append(nameTd);

    const clubTd = document.createElement("td");
    clubTd.append(clubIdentity(entry.player));
    tr.append(clubTd);

    tr.append(el("td", { text: entry.player.position || "—" }));
    tr.append(el("td", { text: formatNumber(entry.player.stats?.minutes, 0) }));
    tr.append(el("td", { text: valueLabel(entry.score) }));
    tbody.append(tr);
  });
  table.append(tbody);
  tableWrap.append(table);
  page.append(tableWrap);

  if (rows.length === 0) {
    page.append(
      el("p", {
        text: "Aucun joueur ne correspond a ce filtre. Essaie avec moins de minutes minimum.",
      })
    );
  }

  target.append(page);
}
