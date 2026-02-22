import { clearNode, createCoachNote, el, formatNumber } from "./components.js";

function normalizeCompetition(clubs, competitions) {
  if (Array.isArray(competitions) && competitions.length > 0) {
    return competitions;
  }
  const map = new Map();
  clubs.forEach((club) => {
    if (club.competitionSlug) {
      map.set(club.competitionSlug, club.competitionName || club.competitionSlug);
    }
  });
  return Array.from(map.entries()).map(([slug, name]) => ({ slug, name }));
}

function createClubIdentity(club) {
  const wrap = el("div", { className: "club-identity" });
  if (club.logoUrl) {
    wrap.append(
      el("img", {
        className: "club-logo-sm",
        attrs: {
          src: club.logoUrl,
          alt: `Logo ${club.name}`,
          loading: "lazy",
          decoding: "async",
          referrerpolicy: "no-referrer",
        },
      })
    );
  }
  const link = el("a", {
    text: club.name,
    attrs: {
      href: `#/club/${encodeURIComponent(club.competitionSlug || "unknown")}/${encodeURIComponent(
        club.slug
      )}`,
    },
  });
  wrap.append(link);
  return wrap;
}

function createMobileClubCard(club) {
  const card = el("article", { className: "club-card" });
  card.append(createClubIdentity(club));
  card.append(el("p", { className: "muted", text: `Rang ${formatNumber(club.rank, 0)} | ${formatNumber(club.points, 0)} pts` }));
  const stats = el("div", { className: "club-stats-row" });
  stats.append(el("span", { text: `J ${formatNumber(club.played, 0)}` }));
  stats.append(el("span", { text: `V ${formatNumber(club.wins, 0)}` }));
  stats.append(el("span", { text: `N ${formatNumber(club.draws, 0)}` }));
  stats.append(el("span", { text: `D ${formatNumber(club.losses, 0)}` }));
  stats.append(el("span", { text: `BP ${formatNumber(club.goals_for, 0)}` }));
  stats.append(el("span", { text: `BC ${formatNumber(club.goals_against, 0)}` }));
  card.append(stats);
  return card;
}

export function renderClubsView(target, context) {
  clearNode(target);
  const page = el("section", { className: "page-card" });
  page.append(el("h2", { text: "Clubs et classements" }));
  page.append(
    createCoachNote(
      "Coach tip: le classement montre la regularite d'une equipe sur toute la saison."
    )
  );

  const clubs = context.clubs || [];
  const competitions = normalizeCompetition(clubs, context.competitions);

  if (clubs.length === 0) {
    page.append(
      el("p", {
        className: "warning-text",
        text: "Aucun classement trouve dans les donnees. Verifie le fichier clubs/classements.",
      })
    );
    target.append(page);
    return;
  }

  const selectedCompetition =
    context.selectedCompetition && competitions.some((c) => c.slug === context.selectedCompetition)
      ? context.selectedCompetition
      : competitions[0]?.slug || "";

  const controls = el("div", { className: "controls-panel" });
  const field = el("label", { className: "field" });
  field.append(el("span", { text: "Competition" }));
  const select = document.createElement("select");
  competitions.forEach((competition) => {
    select.append(el("option", { text: competition.name, attrs: { value: competition.slug } }));
  });
  select.value = selectedCompetition;
  select.addEventListener("change", (event) =>
    context.actions.setCompetition(event.target.value)
  );
  field.append(select);
  controls.append(field);
  page.append(controls);

  const rows = clubs
    .filter((club) => !selectedCompetition || club.competitionSlug === selectedCompetition)
    .sort((a, b) => {
      const rankA = a.rank ?? Number.MAX_SAFE_INTEGER;
      const rankB = b.rank ?? Number.MAX_SAFE_INTEGER;
      return rankA - rankB;
    });

  const mobileCards = el("div", { className: "clubs-mobile-grid" });
  const cardsFragment = document.createDocumentFragment();
  rows.forEach((club) => cardsFragment.append(createMobileClubCard(club)));
  mobileCards.append(cardsFragment);
  page.append(mobileCards);

  const tableWrap = el("div", { className: "table-wrap clubs-table" });
  const table = document.createElement("table");
  const caption = document.createElement("caption");
  caption.textContent = `Classement - ${
    competitions.find((competition) => competition.slug === selectedCompetition)?.name || "Competition"
  }`;
  table.append(caption);

  const thead = document.createElement("thead");
  const hr = document.createElement("tr");
  ["Rang", "Club", "Points", "J", "V", "N", "D", "BP", "BC"].forEach((label) => {
    hr.append(el("th", { text: label, attrs: { scope: "col" } }));
  });
  thead.append(hr);
  table.append(thead);

  const tbody = document.createElement("tbody");
  rows.forEach((club) => {
    const tr = document.createElement("tr");
    tr.append(el("td", { text: formatNumber(club.rank, 0) }));
    const clubTd = document.createElement("td");
    clubTd.append(createClubIdentity(club));
    tr.append(clubTd);
    tr.append(el("td", { text: formatNumber(club.points, 0) }));
    tr.append(el("td", { text: formatNumber(club.played, 0) }));
    tr.append(el("td", { text: formatNumber(club.wins, 0) }));
    tr.append(el("td", { text: formatNumber(club.draws, 0) }));
    tr.append(el("td", { text: formatNumber(club.losses, 0) }));
    tr.append(el("td", { text: formatNumber(club.goals_for, 0) }));
    tr.append(el("td", { text: formatNumber(club.goals_against, 0) }));
    tbody.append(tr);
  });
  table.append(tbody);
  tableWrap.append(table);
  page.append(tableWrap);

  target.append(page);
}

export function renderClubProfile(target, context) {
  clearNode(target);
  const page = el("section", { className: "page-card" });
  const club = context.club;

  if (!club) {
    page.append(el("h2", { text: "Club introuvable" }));
    page.append(el("p", { text: "Retourne dans Classements pour choisir un club valide." }));
    page.append(el("a", { text: "Voir les classements", attrs: { href: "#/clubs" } }));
    target.append(page);
    return;
  }

  const hero = el("div", { className: "club-profile-hero" });
  if (club.logoUrl) {
    hero.append(
      el("img", {
        className: "club-logo-xl",
        attrs: {
          src: club.logoUrl,
          alt: `Logo ${club.name}`,
          loading: "lazy",
          decoding: "async",
          referrerpolicy: "no-referrer",
        },
      })
    );
  }
  const identity = el("div");
  identity.append(el("h2", { text: club.name }));
  identity.append(
    el("p", { className: "muted", text: `Competition: ${club.competitionName || club.competitionSlug}` })
  );
  hero.append(identity);
  page.append(hero);

  const cards = el("div", { className: "grid-cards" });
  cards.append(
    el("article", {
      className: "club-card",
      html: `<strong>Rang</strong><span class="kpi">${formatNumber(club.rank, 0)}</span>`,
    })
  );
  cards.append(
    el("article", {
      className: "club-card",
      html: `<strong>Points</strong><span class="kpi">${formatNumber(club.points, 0)}</span>`,
    })
  );
  cards.append(
    el("article", {
      className: "club-card",
      html: `<strong>Matchs joues</strong><span class="kpi">${formatNumber(club.played, 0)}</span>`,
    })
  );
  cards.append(
    el("article", {
      className: "club-card",
      html: `<strong>Buts marques</strong><span class="kpi">${formatNumber(club.goals_for, 0)}</span>`,
    })
  );
  cards.append(
    el("article", {
      className: "club-card",
      html: `<strong>Buts encaisses</strong><span class="kpi">${formatNumber(club.goals_against, 0)}</span>`,
    })
  );
  page.append(cards);
  page.append(el("a", { text: "Retour au classement", attrs: { href: "#/clubs" } }));

  target.append(page);
}
