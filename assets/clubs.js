const app = window.FootballData;

const state = {
  data: null,
  search: "",
  competition: "all",
  sort: "rank",
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  init().catch((error) => {
    console.error(error);
    showError("Impossible de charger la page Equipes.");
  });
});

async function init() {
  cacheElements();
  bindEvents();

  state.data = await app.loadData();

  const params = app.getQueryParams();
  state.competition = params.get("competition") || "all";
  state.search = app.normalizeText(params.get("search") || "");
  state.sort = params.get("sort") || "rank";

  fillCompetitionSelect();
  elements.clubsSearch.value = params.get("search") || "";
  elements.clubsSort.value = state.sort;

  renderMeta();
  run();
}

function cacheElements() {
  elements.clubsMeta = document.getElementById("clubsMeta");
  elements.clubsSearch = document.getElementById("clubsSearch");
  elements.clubsCompetition = document.getElementById("clubsCompetition");
  elements.clubsSort = document.getElementById("clubsSort");
  elements.clubsCount = document.getElementById("clubsCount");
  elements.clubsList = document.getElementById("clubsList");
}

function bindEvents() {
  elements.clubsSearch.addEventListener("input", (event) => {
    state.search = app.normalizeText(event.target.value.trim());
    run();
  });

  elements.clubsCompetition.addEventListener("change", (event) => {
    state.competition = event.target.value;
    run();
  });

  elements.clubsSort.addEventListener("change", (event) => {
    state.sort = event.target.value;
    run();
  });
}

function renderMeta() {
  elements.clubsMeta.textContent = `${state.data.clubs.length} equipes disponibles.`;
}

function fillCompetitionSelect() {
  const options = [
    `<option value="all">Toutes les competitions</option>`,
    ...state.data.competitions.map(
      (competition) => `<option value="${competition.slug}">${app.escapeHtml(competition.name)}</option>`,
    ),
  ];
  elements.clubsCompetition.innerHTML = options.join("");

  if (state.competition !== "all") {
    elements.clubsCompetition.value = state.competition;
  }
}

function run() {
  const filtered = state.data.clubs.filter((club) => {
    const byCompetition = state.competition === "all" || club.competitionSlug === state.competition;
    const bySearch = !state.search || app.normalizeText(`${club.name} ${club.competitionName}`).includes(state.search);
    return byCompetition && bySearch;
  });

  const sorted = sortClubs(filtered);
  elements.clubsCount.textContent = `${sorted.length} equipe${sorted.length > 1 ? "s" : ""}`;

  if (!sorted.length) {
    elements.clubsList.innerHTML = `<p class="empty">Aucune equipe avec ces filtres.</p>`;
    syncUrl();
    return;
  }

  elements.clubsList.innerHTML = sorted
    .map((club) => {
      const clubUrl = app.buildUrl("club.html", { club: club.slug, competition: club.competitionSlug });
      const compareUrl = app.buildUrl("compare.html", { mode: "club", competition: club.competitionSlug, left: club.slug });
      const fixture = app.formatFixture(club.nextFixture, state.data.clubsBySlug);
      return `
        <article class="club-card">
          <div class="row-id">
            <img class="logo big" src="${app.escapeHtml(club.logoUrl)}" alt="${app.escapeHtml(club.name)}" loading="lazy" />
            <div>
              <h3><a href="${clubUrl}" style="text-decoration:none;">${app.escapeHtml(club.name)}</a></h3>
              <p class="club-meta">${app.escapeHtml(club.competitionName)} | Rang ${club.rank}</p>
            </div>
          </div>
          <div class="card-tags">
            <span class="tag">${club.points} pts</span>
            <span class="tag">${club.goalsFor} BP</span>
            <span class="tag">${club.goalsAgainst} BC</span>
            <span class="tag">Forme: ${club.recent.points}/15</span>
          </div>
          <p class="club-meta" style="margin-top:0.45rem;">Prochain match: ${app.escapeHtml(fixture)}</p>
          <div class="actions" style="margin-top:0.58rem;">
            <a class="btn alt" href="${clubUrl}">Voir la fiche</a>
            <a class="btn" href="${compareUrl}">Duel equipe</a>
          </div>
        </article>
      `;
    })
    .join("");

  syncUrl();
}

function sortClubs(clubs) {
  const sorted = [...clubs];
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

function syncUrl() {
  const params = new URLSearchParams();
  if (state.competition !== "all") {
    params.set("competition", state.competition);
  }
  if (state.search) {
    params.set("search", elements.clubsSearch.value.trim());
  }
  if (state.sort !== "rank") {
    params.set("sort", state.sort);
  }
  app.updateUrlQuery(params);
}

function showError(message) {
  if (elements.clubsMeta) {
    elements.clubsMeta.textContent = message;
  }
  if (elements.clubsList) {
    elements.clubsList.innerHTML = `<p class="empty">${app.escapeHtml(message)}</p>`;
  }
}
