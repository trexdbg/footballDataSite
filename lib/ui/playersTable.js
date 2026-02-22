import {
  clearNode,
  createCoachNote,
  createHeartButton,
  el,
  formatNumber,
  formatPercent,
  highlightText,
  metricLabel,
  resolveMetricValue,
  uniqueSorted,
} from "./components.js";

const SORTABLE_COLUMNS = [
  { key: "name", label: "Joueur" },
  { key: "club", label: "Club" },
  { key: "position", label: "Poste" },
  { key: "age", label: "Age" },
  { key: "minutes", label: "Minutes" },
  { key: "passAccuracy", label: "Passes %" },
  { key: "duelsWonRate", label: "Duels %" },
];

function valueForSort(player, key) {
  if (key === "name") {
    return player.name.toLowerCase();
  }
  if (key === "club") {
    return (player.club?.name || "").toLowerCase();
  }
  if (key === "position") {
    return (player.position || "").toLowerCase();
  }
  if (key === "age") {
    return player.age ?? -1;
  }
  if (key === "minutes") {
    return player.stats?.minutes ?? -1;
  }
  if (key === "passAccuracy") {
    return player.stats?.passAccuracy ?? -1;
  }
  if (key === "duelsWonRate") {
    return player.stats?.duelsWonRate ?? -1;
  }
  return player.name.toLowerCase();
}

function matchesFilters(player, filters) {
  if (filters.position && player.position !== filters.position) {
    return false;
  }
  if (filters.club && player.club?.name !== filters.club) {
    return false;
  }
  if (filters.season && filters.season !== "all" && player.seasonKey !== filters.season) {
    return false;
  }
  const minutes = player.stats?.minutes;
  if (typeof filters.minutesMin === "number" && filters.minutesMin > 0) {
    if (minutes === null || minutes === undefined || minutes < filters.minutesMin) {
      return false;
    }
  }
  return true;
}

function matchesGlobalSearch(player, query, searchIndexMap) {
  const trimmed = String(query || "").trim().toLowerCase();
  if (!trimmed) {
    return true;
  }
  const haystack = searchIndexMap.get(player.slug) || "";
  return haystack.includes(trimmed);
}

function sortedPlayers(players, sortState) {
  const direction = sortState.dir === "desc" ? -1 : 1;
  return [...players].sort((a, b) => {
    const left = valueForSort(a, sortState.key);
    const right = valueForSort(b, sortState.key);
    if (typeof left === "string" && typeof right === "string") {
      return left.localeCompare(right, "fr") * direction;
    }
    return ((left ?? -1) - (right ?? -1)) * direction;
  });
}

function createSortButton(column, sortState, onSort) {
  const isActive = sortState.key === column.key;
  const directionMark = isActive ? (sortState.dir === "asc" ? "↑" : "↓") : "";
  const button = el("button", {
    text: `${column.label} ${directionMark}`.trim(),
    attrs: {
      type: "button",
      "aria-label": `Trier par ${column.label}`,
    },
  });
  button.addEventListener("click", () => onSort(column.key));
  return button;
}

function createAvatar(player, className = "avatar-sm") {
  const avatar = el("span", { className });
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
    return avatar;
  }
  const initials = (player.name || "J")
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
  avatar.textContent = initials || "J";
  return avatar;
}

function createClubBadge(player, query = "") {
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
  const name = el("span");
  name.append(highlightText(player.club?.name || "—", query));
  wrap.append(name);
  return wrap;
}

function renderRow(player, context) {
  const tr = document.createElement("tr");

  const favTd = document.createElement("td");
  const heart = createHeartButton(
    context.favorites.has(player.slug),
    () => context.actions.toggleFavorite(player.slug),
    player.name
  );
  favTd.append(heart);

  const nameTd = document.createElement("td");
  const identity = el("div", { className: "player-identity" });
  identity.append(createAvatar(player));
  const identityText = el("div");
  const link = el("a", {
    attrs: { href: `#/player/${encodeURIComponent(player.slug)}` },
  });
  link.append(highlightText(player.name, context.searchQuery));
  identityText.append(link);
  const nationalityLine = el("div", { className: "muted" });
  nationalityLine.append(highlightText(player.nationality || "—", context.searchQuery));
  identityText.append(nationalityLine);
  identity.append(identityText);
  nameTd.append(identity);

  const clubTd = document.createElement("td");
  clubTd.append(createClubBadge(player, context.searchQuery));

  const posTd = el("td", { text: player.position || "—" });
  const ageTd = el("td", { text: formatNumber(player.age, 0) });
  const minTd = el("td", { text: formatNumber(player.stats?.minutes, 0) });
  const passTd = el("td", { text: formatPercent(player.stats?.passAccuracy) });
  const duelTd = el("td", { text: formatPercent(player.stats?.duelsWonRate) });
  const seasonTd = el("td", { text: player.seasonKey || "—" });

  const actionsTd = document.createElement("td");
  const compareBtn = el("button", {
    text: "Comparer",
    attrs: { type: "button", "aria-label": `Comparer ${player.name}` },
  });
  compareBtn.addEventListener("click", () => context.actions.addPlayerToCompare(player.slug));
  actionsTd.append(compareBtn);

  tr.append(favTd, nameTd, clubTd, posTd, ageTd, minTd, passTd, duelTd, seasonTd, actionsTd);
  return tr;
}

function renderCard(player, context) {
  const card = el("article", { className: "player-mini-card" });

  const topRow = el("div", { className: "summary-banner" });
  const identity = el("div", { className: "player-identity" });
  identity.append(createAvatar(player, "avatar-md"));
  const identityText = el("div");
  const link = el("a", {
    attrs: { href: `#/player/${encodeURIComponent(player.slug)}` },
  });
  link.append(highlightText(player.name, context.searchQuery));
  identityText.append(link);
  identityText.append(
    el("p", {
      className: "muted",
      text: `${player.position || "Poste?"} | ${player.nationality || "?"}`,
    })
  );
  identity.append(identityText);

  topRow.append(identity);
  topRow.append(
    createHeartButton(
      context.favorites.has(player.slug),
      () => context.actions.toggleFavorite(player.slug),
      player.name
    )
  );
  card.append(topRow);

  card.append(createClubBadge(player, context.searchQuery));
  card.append(
    el("p", {
      text: `Minutes: ${formatNumber(player.stats?.minutes, 0)} | Saison: ${player.seasonKey || "?"}`,
    })
  );

  const quickStats = [
    { key: "passAccuracy", isPercent: true },
    { key: "duelsWonRate", isPercent: true },
    { key: "goals", isPercent: false },
  ];
  const list = el("ul", { className: "stats-list" });
  quickStats.forEach((stat) => {
    const value = resolveMetricValue(player, stat.key);
    const display = stat.isPercent ? formatPercent(value) : formatNumber(value, 1);
    list.append(el("li", { text: `${metricLabel(stat.key)}: ${display}` }));
  });
  card.append(list);

  const compareBtn = el("button", {
    text: "Ajouter a la comparaison",
    attrs: { type: "button", "aria-label": `Ajouter ${player.name} a la comparaison` },
  });
  compareBtn.addEventListener("click", () => context.actions.addPlayerToCompare(player.slug));
  card.append(compareBtn);
  return card;
}

export function renderPlayersTableView(target, context) {
  clearNode(target);

  const page = el("section", { className: "page-card" });
  page.append(el("h2", { text: context.title || "Table des joueurs" }));
  page.append(
    createCoachNote(
      "Coach tip: 80% de passes reussies veut dire que sur 10 passes, environ 8 arrivent au bon coequipier."
    )
  );

  const allPlayers = context.players || [];
  const filters = context.filters;
  const searchQuery = context.searchQuery || "";
  const filtered = allPlayers
    .filter((player) => matchesFilters(player, filters))
    .filter((player) => matchesGlobalSearch(player, searchQuery, context.searchIndex));

  const sorted = sortedPlayers(filtered, context.sortState);
  const safePageSize = Number(context.pageSize) > 0 ? Number(context.pageSize) : 50;
  const totalPages = Math.max(1, Math.ceil(sorted.length / safePageSize));
  const safePage = Math.min(Math.max(1, context.page), totalPages);
  const start = (safePage - 1) * safePageSize;
  const visiblePlayers = sorted.slice(start, start + safePageSize);

  const infoLine = el("p", {
    className: "muted",
    attrs: { "aria-live": "polite" },
    text: `${sorted.length} joueur(s) affiche(s)`,
  });
  page.append(infoLine);

  const controls = el("div", { className: "controls-panel" });
  controls.append(el("h3", { text: "Filtres et affichage" }));
  const controlsGrid = el("div", { className: "controls-grid" });

  const positionField = el("label", { className: "field" });
  positionField.append(el("span", { text: "Poste" }));
  const positionSelect = el("select", { attrs: { "aria-label": "Filtrer par poste" } });
  positionSelect.append(el("option", { text: "Tous", attrs: { value: "" } }));
  uniqueSorted(allPlayers.map((player) => player.position)).forEach((position) => {
    positionSelect.append(el("option", { text: position, attrs: { value: position } }));
  });
  positionSelect.value = filters.position;
  positionSelect.addEventListener("change", (event) =>
    context.actions.setPlayerFilter("position", event.target.value)
  );
  positionField.append(positionSelect);

  const clubField = el("label", { className: "field" });
  clubField.append(el("span", { text: "Club" }));
  const clubSelect = el("select", { attrs: { "aria-label": "Filtrer par club" } });
  clubSelect.append(el("option", { text: "Tous", attrs: { value: "" } }));
  uniqueSorted(allPlayers.map((player) => player.club?.name)).forEach((clubName) => {
    clubSelect.append(el("option", { text: clubName, attrs: { value: clubName } }));
  });
  clubSelect.value = filters.club;
  clubSelect.addEventListener("change", (event) =>
    context.actions.setPlayerFilter("club", event.target.value)
  );
  clubField.append(clubSelect);

  const seasonField = el("label", { className: "field" });
  seasonField.append(el("span", { text: "Saison" }));
  const seasonSelect = el("select", { attrs: { "aria-label": "Filtrer par saison" } });
  seasonSelect.append(el("option", { text: "Toutes", attrs: { value: "all" } }));
  (context.seasonKeys || []).forEach((season) => {
    seasonSelect.append(el("option", { text: season, attrs: { value: season } }));
  });
  seasonSelect.value = filters.season;
  seasonSelect.addEventListener("change", (event) =>
    context.actions.setPlayerFilter("season", event.target.value)
  );
  seasonField.append(seasonSelect);

  const minField = el("label", { className: "field" });
  minField.append(el("span", { text: "Minutes minimum" }));
  const minInput = el("input", {
    attrs: { type: "number", min: "0", step: "10", value: String(filters.minutesMin || 0) },
  });
  minInput.addEventListener("change", (event) =>
    context.actions.setPlayerFilter("minutesMin", Number(event.target.value) || 0)
  );
  minField.append(minInput);

  controlsGrid.append(positionField, clubField, seasonField, minField);
  controls.append(controlsGrid);

  const displayControls = el("div", { className: "control-row" });
  const viewButton = el("button", {
    text: context.viewMode === "table" ? "Passer en cartes" : "Passer en tableau",
    attrs: { type: "button" },
  });
  viewButton.addEventListener("click", () => context.actions.togglePlayerViewMode());

  const pageSizeLabel = el("label", { className: "field" });
  pageSizeLabel.append(el("span", { text: "Lignes par page" }));
  const pageSizeSelect = el("select");
  [25, 50, 100].forEach((size) => {
    pageSizeSelect.append(el("option", { text: String(size), attrs: { value: String(size) } }));
  });
  pageSizeSelect.value = String(safePageSize);
  pageSizeSelect.addEventListener("change", (event) =>
    context.actions.setPlayerPageSize(Number(event.target.value))
  );
  pageSizeLabel.append(pageSizeSelect);
  displayControls.append(viewButton, pageSizeLabel);
  controls.append(displayControls);

  page.append(controls);

  if (sorted.length === 0) {
    page.append(
      el("p", {
        className: "warning-text",
        text:
          context.emptyMessage ||
          "Aucun joueur trouve avec ces filtres. Essaie d'enlever un filtre ou de reduire les minutes minimum.",
      })
    );
    target.append(page);
    return;
  }

  if (context.viewMode === "cards") {
    const cards = el("div", { className: "grid-cards players-grid" });
    const fragment = document.createDocumentFragment();
    visiblePlayers.forEach((player) => fragment.append(renderCard(player, context)));
    cards.append(fragment);
    page.append(cards);
  } else {
    const tableWrap = el("div", { className: "table-wrap" });
    const table = document.createElement("table");
    const caption = document.createElement("caption");
    caption.textContent = `${context.title || "Joueurs"} - page ${safePage} sur ${totalPages}`;
    table.append(caption);

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    headRow.append(el("th", { text: "Fav", attrs: { scope: "col" } }));

    SORTABLE_COLUMNS.forEach((column) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.append(createSortButton(column, context.sortState, context.actions.setPlayerSort));
      headRow.append(th);
    });

    headRow.append(el("th", { text: "Saison", attrs: { scope: "col" } }));
    headRow.append(el("th", { text: "Actions", attrs: { scope: "col" } }));
    thead.append(headRow);
    table.append(thead);

    const tbody = document.createElement("tbody");
    const fragment = document.createDocumentFragment();
    visiblePlayers.forEach((player) => fragment.append(renderRow(player, context)));
    tbody.append(fragment);
    table.append(tbody);

    tableWrap.append(table);
    page.append(tableWrap);
  }

  const pagination = el("div", { className: "pagination" });
  const prevBtn = el("button", {
    text: "Page precedente",
    attrs: { type: "button", disabled: safePage <= 1 ? "true" : null },
  });
  prevBtn.disabled = safePage <= 1;
  prevBtn.addEventListener("click", () => context.actions.setPlayerPage(Math.max(1, safePage - 1)));

  const nextBtn = el("button", {
    text: "Page suivante",
    attrs: { type: "button", disabled: safePage >= totalPages ? "true" : null },
  });
  nextBtn.disabled = safePage >= totalPages;
  nextBtn.addEventListener("click", () =>
    context.actions.setPlayerPage(Math.min(totalPages, safePage + 1))
  );

  pagination.append(prevBtn);
  pagination.append(el("span", { text: `Page ${safePage} / ${totalPages}` }));
  pagination.append(nextBtn);
  page.append(pagination);

  target.append(page);
}
