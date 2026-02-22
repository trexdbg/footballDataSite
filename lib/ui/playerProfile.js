import {
  clearNode,
  createCoachNote,
  createHeartButton,
  createPill,
  el,
  formatNumber,
  formatPercent,
  metricLabel,
  resolveMetricValue,
} from "./components.js";

const KEY_METRICS_PRIORITY = [
  "minutes",
  "goals",
  "assists",
  "accurate_pass",
  "passAccuracy",
  "duel_won",
  "duelsWonRate",
  "interception",
  "saves",
];

function getMetricEntries(player) {
  const entries = [];
  const seen = new Set();

  const addMetric = (key, source = "stats") => {
    if (seen.has(key)) {
      return;
    }
    const value =
      source === "per90" ? player.per90?.[key] ?? null : resolveMetricValue(player, key);
    if (value === null || value === undefined) {
      return;
    }
    seen.add(key);
    entries.push({ key, value, source });
  };

  KEY_METRICS_PRIORITY.forEach((key) => addMetric(key, "stats"));

  Object.keys(player.stats || {}).forEach((key) => addMetric(key, "stats"));
  Object.keys(player.per90 || {}).forEach((key) => addMetric(key, "per90"));

  return entries;
}

function statDisplay(entry) {
  if (entry.key.includes("rate") || entry.key.includes("accuracy") || entry.key === "passAccuracy") {
    return formatPercent(entry.value);
  }
  return formatNumber(entry.value, 2);
}

function renderStatusRow(player) {
  const row = el("div", { className: "status-row" });
  row.append(createPill("Statut", player.status?.current || "inconnu"));
  row.append(
    createPill(
      "Blessure",
      player.status?.isInjured ? "Oui" : "Non",
      player.status?.isInjured ? "alert" : "ok"
    )
  );
  row.append(
    createPill(
      "Suspension",
      player.status?.isSuspended ? "Oui" : "Non",
      player.status?.isSuspended ? "warning" : "ok"
    )
  );
  row.append(createPill("Saison", player.seasonKey || "—"));
  return row;
}

function renderLastMatches(player) {
  const section = el("section", { className: "page-card" });
  section.append(el("h3", { text: "5 derniers matchs" }));
  if (!Array.isArray(player.lastMatches) || player.lastMatches.length === 0) {
    section.append(
      el("p", {
        text: "Pas de série de matchs disponible pour ce joueur.",
        className: "muted",
      })
    );
    return section;
  }

  const tableWrap = el("div", { className: "table-wrap" });
  const table = document.createElement("table");
  const caption = document.createElement("caption");
  caption.textContent = `Derniers matchs de ${player.name}`;
  table.append(caption);

  const thead = document.createElement("thead");
  const hr = document.createElement("tr");
  ["Date", "Adversaire", "Minutes", "Rating", "Buts", "Passes D"].forEach((label) => {
    hr.append(el("th", { text: label, attrs: { scope: "col" } }));
  });
  thead.append(hr);
  table.append(thead);

  const tbody = document.createElement("tbody");
  player.lastMatches.slice(0, 5).forEach((match) => {
    const tr = document.createElement("tr");
    tr.append(el("td", { text: match.date || "—" }));
    tr.append(el("td", { text: match.opponent || "—" }));
    tr.append(el("td", { text: formatNumber(match.minutes, 0) }));
    tr.append(el("td", { text: formatNumber(match.rating, 2) }));
    tr.append(el("td", { text: formatNumber(match.goals, 0) }));
    tr.append(el("td", { text: formatNumber(match.assists, 0) }));
    tbody.append(tr);
  });
  table.append(tbody);
  tableWrap.append(table);
  section.append(tableWrap);
  return section;
}

function renderAvatar(player) {
  const wrap = el("div", { className: "avatar-wrap" });
  if (player.photoUrl) {
    const img = el("img", {
      attrs: {
        src: player.photoUrl,
        alt: `Photo de ${player.name}`,
        loading: "lazy",
      },
    });
    wrap.append(img);
    return wrap;
  }
  const initials = player.name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
  wrap.textContent = initials || "J";
  return wrap;
}

export function renderPlayerProfile(target, context) {
  clearNode(target);
  const player = context.player;

  if (!player) {
    const card = el("section", { className: "page-card error-card" });
    card.append(el("h2", { text: "Joueur introuvable" }));
    card.append(
      el("p", { text: "Vérifie le lien ou retourne dans la page Joueurs pour choisir un profil." })
    );
    card.append(el("a", { text: "Retour à la table", attrs: { href: "#/players" } }));
    target.append(card);
    return;
  }

  const top = el("section", { className: "page-card profile-header" });
  const identity = el("article");
  identity.append(el("p", { className: "muted", text: "Profil joueur" }));
  identity.append(el("h2", { text: player.name }));
  identity.append(el("p", { text: `${player.position || "—"} • ${player.club?.name || "—"}` }));
  identity.append(el("p", { className: "muted", text: `${player.nationality || "—"} • ${player.age ?? "—"} ans` }));
  identity.append(renderStatusRow(player));

  const actionRow = el("div", { className: "control-row" });
  actionRow.append(
    createHeartButton(
      context.favorites.has(player.slug),
      () => context.actions.toggleFavorite(player.slug),
      player.name
    )
  );
  const compareButton = el("button", {
    text: "Comparer ce joueur",
    attrs: { type: "button", "aria-label": `Comparer ${player.name}` },
  });
  compareButton.addEventListener("click", () => context.actions.addPlayerToCompare(player.slug));
  actionRow.append(compareButton);
  identity.append(actionRow);

  const visual = el("article");
  visual.append(renderAvatar(player));
  visual.append(
    createCoachNote(
      "Coach tip: plus tu joues de minutes, plus tes statistiques racontent ta vraie régularité."
    )
  );

  top.append(identity, visual);
  target.append(top);

  const metricsSection = el("section", { className: "page-card" });
  metricsSection.append(el("h3", { text: "Stats clés" }));

  const allMetrics = getMetricEntries(player);
  const primary = allMetrics.slice(0, 5);
  const extra = allMetrics.slice(5);

  const primaryList = el("ul", { className: "stats-list" });
  primary.forEach((entry) => {
    primaryList.append(
      el("li", { text: `${metricLabel(entry.key)}: ${statDisplay(entry)}${entry.source === "per90" ? " /90" : ""}` })
    );
  });
  metricsSection.append(primaryList);

  if (extra.length > 0) {
    const details = el("details");
    details.append(el("summary", { text: "Voir plus de stats" }));
    const list = el("ul", { className: "stats-list" });
    extra.forEach((entry) => {
      list.append(
        el("li", {
          text: `${metricLabel(entry.key)}: ${statDisplay(entry)}${entry.source === "per90" ? " /90" : ""}`,
        })
      );
    });
    details.append(list);
    metricsSection.append(details);
  }

  target.append(metricsSection);
  target.append(renderLastMatches(player));
}
