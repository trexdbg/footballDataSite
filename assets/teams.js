const app = window.FootballData;

const state = {
  data: null,
  competition: null,
  sort: "rank",
  limit: 20,
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  init().catch((error) => {
    console.error(error);
    showError("Impossible de charger les classements.");
  });
});

async function init() {
  cacheElements();
  bindEvents();

  state.data = await app.loadData();
  hydrateStateFromQuery();

  fillCompetitionSelect();
  elements.standingsSort.value = state.sort;
  elements.standingsLimit.value = String(state.limit);

  run();
}

function cacheElements() {
  elements.standingsMeta = document.getElementById("standingsMeta");
  elements.standingsCompetition = document.getElementById("standingsCompetition");
  elements.standingsSort = document.getElementById("standingsSort");
  elements.standingsLimit = document.getElementById("standingsLimit");
  elements.standingsTitle = document.getElementById("standingsTitle");
  elements.standingsSeason = document.getElementById("standingsSeason");
  elements.standingsKpis = document.getElementById("standingsKpis");
  elements.standingsBody = document.getElementById("standingsBody");
}

function bindEvents() {
  elements.standingsCompetition.addEventListener("change", (event) => {
    state.competition = event.target.value;
    run();
  });

  elements.standingsSort.addEventListener("change", (event) => {
    state.sort = event.target.value;
    run();
  });

  elements.standingsLimit.addEventListener("change", (event) => {
    state.limit = Number(event.target.value || 20);
    run();
  });
}

function hydrateStateFromQuery() {
  const params = app.getQueryParams();
  state.competition = params.get("competition") || state.data.competitions[0]?.slug || null;
  state.sort = params.get("sort") || "rank";
  state.limit = Number(params.get("limit") || 20);
  if (![10, 20, 30].includes(state.limit)) {
    state.limit = 20;
  }
}

function fillCompetitionSelect() {
  elements.standingsCompetition.innerHTML = state.data.competitions
    .map((competition) => `<option value="${competition.slug}">${app.escapeHtml(competition.name)}</option>`)
    .join("");

  if (state.competition) {
    elements.standingsCompetition.value = state.competition;
  }
}

function run() {
  const competition = state.data.competitions.find((item) => item.slug === state.competition) || state.data.competitions[0];
  if (!competition) {
    showError("Aucune competition disponible.");
    return;
  }

  elements.standingsMeta.textContent = `${state.data.competitions.length} competitions disponibles.`;
  elements.standingsTitle.textContent = `Classement ${competition.name}`;
  elements.standingsSeason.textContent = competition.seasonName ? `Saison ${competition.seasonName}` : "Saison non precisee";

  const rows = sortRows(competition.table).slice(0, state.limit);
  renderKpis(competition.table);
  renderRows(rows);
  syncUrl();
}

function sortRows(rows) {
  const sorted = [...rows];
  switch (state.sort) {
    case "points":
      sorted.sort((a, b) => b.points - a.points || a.rank - b.rank);
      break;
    case "recent":
      sorted.sort((a, b) => b.recentPoints - a.recentPoints || a.rank - b.rank);
      break;
    case "attack":
      sorted.sort((a, b) => b.goalsFor - a.goalsFor || a.rank - b.rank);
      break;
    case "defense":
      sorted.sort((a, b) => a.goalsAgainst - b.goalsAgainst || a.rank - b.rank);
      break;
    case "rank":
    default:
      sorted.sort((a, b) => a.rank - b.rank);
      break;
  }
  return sorted;
}

function renderKpis(rows) {
  const leader = [...rows].sort((a, b) => a.rank - b.rank)[0] || null;
  const bestAttack = [...rows].sort((a, b) => b.goalsFor - a.goalsFor)[0] || null;
  const bestDefense = [...rows].sort((a, b) => a.goalsAgainst - b.goalsAgainst)[0] || null;

  elements.standingsKpis.innerHTML = [
    {
      label: "Leader",
      value: leader ? leader.name : "-",
      detail: leader ? `${leader.points} points` : "",
      href: leader ? app.buildUrl("club.html", { club: leader.slug, competition: leader.competitionSlug }) : null,
    },
    {
      label: "Meilleure attaque",
      value: bestAttack ? bestAttack.name : "-",
      detail: bestAttack ? `${bestAttack.goalsFor} buts` : "",
      href: bestAttack ? app.buildUrl("club.html", { club: bestAttack.slug, competition: bestAttack.competitionSlug }) : null,
    },
    {
      label: "Meilleure defense",
      value: bestDefense ? bestDefense.name : "-",
      detail: bestDefense ? `${bestDefense.goalsAgainst} buts encaisses` : "",
      href: bestDefense ? app.buildUrl("club.html", { club: bestDefense.slug, competition: bestDefense.competitionSlug }) : null,
    },
  ]
    .map((kpi) => {
      const title = kpi.href
        ? `<a href="${kpi.href}" style="text-decoration:none;font-weight:700;">${app.escapeHtml(kpi.value)}</a>`
        : app.escapeHtml(kpi.value);
      return `<article class="kpi"><small>${app.escapeHtml(kpi.label)}</small><strong>${title}</strong><span>${app.escapeHtml(
        kpi.detail,
      )}</span></article>`;
    })
    .join("");
}

function renderRows(rows) {
  if (!rows.length) {
    elements.standingsBody.innerHTML = `<tr><td colspan="11" class="empty">Aucune equipe.</td></tr>`;
    return;
  }

  elements.standingsBody.innerHTML = rows
    .map((club) => {
      const clubUrl = app.buildUrl("club.html", { club: club.slug, competition: club.competitionSlug });
      return `
        <tr>
          <td>${club.rank}</td>
          <td>
            <div class="row-id">
              <img class="logo" src="${app.escapeHtml(club.logoUrl)}" alt="${app.escapeHtml(club.name)}" loading="lazy" />
              <a href="${clubUrl}" style="text-decoration:none;font-weight:700;">${app.escapeHtml(club.name)}</a>
            </div>
          </td>
          <td>${club.points}</td>
          <td>${club.played}</td>
          <td>${club.wins}</td>
          <td>${club.draws}</td>
          <td>${club.losses}</td>
          <td>${club.goalsFor}</td>
          <td>${club.goalsAgainst}</td>
          <td>${club.goalDifference}</td>
          <td>${club.recent.wins}W ${club.recent.draws}D ${club.recent.losses}L</td>
        </tr>
      `;
    })
    .join("");
}

function syncUrl() {
  const params = new URLSearchParams();
  if (state.competition) {
    params.set("competition", state.competition);
  }
  if (state.sort !== "rank") {
    params.set("sort", state.sort);
  }
  if (state.limit !== 20) {
    params.set("limit", String(state.limit));
  }
  app.updateUrlQuery(params);
}

function showError(message) {
  if (elements.standingsMeta) {
    elements.standingsMeta.textContent = message;
  }
  if (elements.standingsBody) {
    elements.standingsBody.innerHTML = `<tr><td colspan="11" class="empty">${app.escapeHtml(message)}</td></tr>`;
  }
}
