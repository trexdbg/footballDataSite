import {
  clearNode,
  createCoachNote,
  createHeartButton,
  createPill,
  el,
  formatNumber,
  formatPercent,
  inferPositionGroup,
  metricIsPercent,
  metricLabel,
  metricsForPosition,
} from "./components.js";

function statDisplay(entry) {
  if (metricIsPercent(entry.key)) {
    return formatPercent(entry.value);
  }
  return formatNumber(entry.value, 2);
}

function buildPositionMetrics(player) {
  const primary = metricsForPosition(player, { limit: 6, preferPer90: false });
  const extraPer90 = metricsForPosition(player, { limit: 8, preferPer90: true })
    .filter((entry) => !primary.some((mainEntry) => mainEntry.key === entry.key))
    .map((entry) => ({ ...entry, source: "per90" }));
  return { primary, extraPer90 };
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
  row.append(createPill("Saison", player.seasonKey || "-"));
  return row;
}

function renderLastMatches(player) {
  const section = el("section", { className: "page-card" });
  section.append(el("h3", { text: "5 derniers matchs" }));
  if (!Array.isArray(player.lastMatches) || player.lastMatches.length === 0) {
    section.append(
      el("p", {
        text: "Pas de serie de matchs disponible pour ce joueur.",
        className: "muted",
      })
    );
    return section;
  }

  const positionGroup = inferPositionGroup(player.position);
  const tableWrap = el("div", { className: "table-wrap" });
  const table = document.createElement("table");
  const caption = document.createElement("caption");
  caption.textContent = `Derniers matchs de ${player.name}`;
  table.append(caption);

  const headers =
    positionGroup === "Gardien"
      ? ["Date", "Adversaire", "Minutes", "Arrets", "Passes reussies", "Recuperations"]
      : ["Date", "Adversaire", "Minutes", "Passes reussies", "Duels gagnes", "Recuperations"];

  const thead = document.createElement("thead");
  const hr = document.createElement("tr");
  headers.forEach((label) => {
    hr.append(el("th", { text: label, attrs: { scope: "col" } }));
  });
  thead.append(hr);
  table.append(thead);

  const tbody = document.createElement("tbody");
  player.lastMatches.slice(0, 5).forEach((match) => {
    const tr = document.createElement("tr");
    tr.append(el("td", { text: match.date || "-" }));
    tr.append(el("td", { text: match.opponent || "-" }));
    tr.append(el("td", { text: formatNumber(match.minutes, 0) }));
    if (positionGroup === "Gardien") {
      tr.append(el("td", { text: formatNumber(match.saves, 0) }));
      tr.append(el("td", { text: formatNumber(match.accurate_pass, 0) }));
      tr.append(el("td", { text: formatNumber(match.poss_won, 0) }));
    } else {
      tr.append(el("td", { text: formatNumber(match.accurate_pass, 0) }));
      tr.append(el("td", { text: formatNumber(match.duel_won, 0) }));
      tr.append(el("td", { text: formatNumber(match.poss_won, 0) }));
    }
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
    wrap.append(
      el("img", {
        attrs: {
          src: player.photoUrl,
          alt: `Photo de ${player.name}`,
          loading: "eager",
          decoding: "async",
        },
      })
    );
    return wrap;
  }
  const initials = (player.name || "J")
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
  wrap.textContent = initials || "J";
  return wrap;
}

function renderClubBadge(player) {
  const row = el("div", { className: "profile-club-line" });
  if (player.club?.logoUrl) {
    row.append(
      el("img", {
        className: "club-logo-lg",
        attrs: {
          src: player.club.logoUrl,
          alt: `Logo ${player.club?.name || "club"}`,
          loading: "lazy",
          decoding: "async",
        },
      })
    );
  }
  row.append(el("span", { text: player.club?.name || "Club inconnu" }));
  return row;
}

export function renderPlayerProfile(target, context) {
  clearNode(target);
  const player = context.player;

  if (!player) {
    const card = el("section", { className: "page-card error-card" });
    card.append(el("h2", { text: "Joueur introuvable" }));
    card.append(
      el("p", { text: "Verifie le lien ou retourne dans la page Joueurs pour choisir un profil." })
    );
    card.append(el("a", { text: "Retour a la table", attrs: { href: "#/players" } }));
    target.append(card);
    return;
  }

  const top = el("section", { className: "page-card profile-header profile-hero" });
  const identity = el("article");
  identity.append(el("p", { className: "muted", text: "Profil joueur" }));
  identity.append(el("h2", { text: player.name }));
  identity.append(renderClubBadge(player));
  identity.append(
    el("p", {
      className: "muted",
      text: `${player.position || "-"} | ${player.nationality || "-"} | ${player.age ?? "-"} ans`,
    })
  );
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

  const visual = el("article", { className: "profile-visual" });
  visual.append(renderAvatar(player));
  visual.append(
    createCoachNote(
      "Coach tip: tes KPI changent selon ton poste. Compare toujours a role equivalent."
    )
  );

  top.append(identity, visual);
  target.append(top);

  const metricsSection = el("section", { className: "page-card" });
  metricsSection.append(el("h3", { text: "Stats cles selon le poste" }));

  const { primary, extraPer90 } = buildPositionMetrics(player);

  const primaryList = el("ul", { className: "stats-list" });
  primary.forEach((entry) => {
    primaryList.append(
      el("li", {
        text: `${metricLabel(entry.key)}: ${statDisplay(entry)}`,
      })
    );
  });
  metricsSection.append(primaryList);

  if (extraPer90.length > 0) {
    const details = el("details");
    details.append(el("summary", { text: "Voir les KPI /90" }));
    const list = el("ul", { className: "stats-list" });
    extraPer90.forEach((entry) => {
      list.append(
        el("li", {
          text: `${metricLabel(entry.key)}: ${statDisplay(entry)} /90`,
        })
      );
    });
    details.append(list);
    metricsSection.append(details);
  }

  target.append(metricsSection);
  target.append(renderLastMatches(player));
}
