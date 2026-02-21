const app = window.FootballData;

const state = {
  data: null,
  competition: null,
  search: "",
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  init().catch((error) => {
    console.error(error);
    fail("Impossible de charger les donnees de la page d'accueil.");
  });
});

async function init() {
  cacheElements();
  bindEvents();

  state.data = await app.loadData();
  state.competition = app.getQueryParams().get("competition") || state.data.competitions[0]?.slug || null;

  fillCompetitionSelect();
  renderMeta();
  renderKpis();
  renderStandingsPreview();
  renderTrending();
  renderSuggestions();
}

function cacheElements() {
  elements.homeMeta = document.getElementById("homeMeta");
  elements.globalSearch = document.getElementById("globalSearch");
  elements.searchResults = document.getElementById("searchResults");
  elements.homeKpis = document.getElementById("homeKpis");
  elements.homeCompetition = document.getElementById("homeCompetition");
  elements.homeStandingsBody = document.getElementById("homeStandingsBody");
  elements.homeStandingsLink = document.getElementById("homeStandingsLink");
  elements.hotClubs = document.getElementById("hotClubs");
  elements.hotPlayers = document.getElementById("hotPlayers");
  elements.homeSuggestions = document.getElementById("homeSuggestions");
}

function bindEvents() {
  elements.globalSearch.addEventListener("input", (event) => {
    state.search = app.normalizeText(event.target.value.trim());
    renderSearchResults();
  });

  elements.homeCompetition.addEventListener("change", (event) => {
    state.competition = event.target.value;
    renderStandingsPreview();
  });
}

function renderMeta() {
  elements.homeMeta.textContent = `${state.data.clubs.length} clubs, ${state.data.players.length} joueurs. MAJ ${app.formatDateTime(
    state.data.generatedAt,
  )}.`;
}

function fillCompetitionSelect() {
  elements.homeCompetition.innerHTML = state.data.competitions
    .map((competition) => `<option value="${competition.slug}">${app.escapeHtml(competition.name)}</option>`)
    .join("");

  if (state.competition) {
    elements.homeCompetition.value = state.competition;
  }
}

function renderKpis() {
  const topPlayer = [...state.data.players]
    .filter((player) => player.minutes >= 240)
    .sort((a, b) => b.metrics.contributionsP90 - a.metrics.contributionsP90)[0];
  const topClub = [...state.data.clubs].sort((a, b) => b.points - a.points)[0];

  const cards = [
    {
      label: "Competitions suivies",
      value: String(state.data.competitions.length),
      detail: "Classements lisibles",
    },
    {
      label: "Club leader actuel",
      value: topClub ? topClub.name : "-",
      detail: topClub ? `${topClub.points} pts` : "",
      href: topClub ? app.buildUrl("club.html", { club: topClub.slug, competition: topClub.competitionSlug }) : null,
    },
    {
      label: "Joueur tendance",
      value: topPlayer ? topPlayer.name : "-",
      detail: topPlayer ? `${app.formatMetric("player", "contributionsP90", topPlayer.metrics.contributionsP90)}` : "",
      href: topPlayer ? app.buildUrl("player.html", { player: topPlayer.slug, competition: topPlayer.competitionSlug }) : null,
    },
  ];

  elements.homeKpis.innerHTML = cards
    .map((card) => {
      const title = card.href
        ? `<a class="inline-links" href="${card.href}" style="display:block;text-decoration:none;"><strong>${app.escapeHtml(card.value)}</strong></a>`
        : `<strong>${app.escapeHtml(card.value)}</strong>`;
      return `<article class="kpi"><small>${app.escapeHtml(card.label)}</small>${title}<span>${app.escapeHtml(card.detail || "")}</span></article>`;
    })
    .join("");
}

function renderStandingsPreview() {
  const competition = state.data.competitions.find((item) => item.slug === state.competition) || state.data.competitions[0];
  if (!competition) {
    elements.homeStandingsBody.innerHTML = `<tr><td colspan="4" class="empty">Aucune competition disponible.</td></tr>`;
    return;
  }

  const topRows = competition.table.slice(0, 6);
  elements.homeStandingsBody.innerHTML = topRows
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
          <td>${club.recent.wins}W ${club.recent.draws}D ${club.recent.losses}L</td>
        </tr>
      `;
    })
    .join("");

  elements.homeStandingsLink.href = app.buildUrl("teams.html", { competition: competition.slug });
}

function renderTrending() {
  const hotClubs = [...state.data.clubs]
    .sort((a, b) => b.recentPoints * 1.7 + b.points * 0.25 - (a.recentPoints * 1.7 + a.points * 0.25))
    .slice(0, 3);

  elements.hotClubs.innerHTML = hotClubs
    .map((club) => {
      const href = app.buildUrl("club.html", { club: club.slug, competition: club.competitionSlug });
      return `
        <article class="club-card">
          <h3><a href="${href}" style="text-decoration:none;">${app.escapeHtml(club.name)}</a></h3>
          <p class="club-meta">${app.escapeHtml(club.competitionName)} | ${club.points} pts</p>
          <div class="card-tags">
            <span class="tag">Forme: ${club.recent.points}/15</span>
            <span class="tag">Diff: ${club.goalDifference}</span>
          </div>
        </article>
      `;
    })
    .join("");

  const hotPlayers = [...state.data.players]
    .filter((player) => player.minutes >= 240)
    .sort((a, b) => b.metrics.contributionsP90 - a.metrics.contributionsP90)
    .slice(0, 3);

  elements.hotPlayers.innerHTML = hotPlayers
    .map((player) => {
      const href = app.buildUrl("player.html", { player: player.slug, competition: player.competitionSlug });
      return `
        <article class="player-card">
          <h3><a href="${href}" style="text-decoration:none;">${app.escapeHtml(player.name)}</a></h3>
          <p class="player-meta">${app.escapeHtml(player.clubName)} | ${app.escapeHtml(player.position)}</p>
          <div class="card-tags">
            <span class="tag">${app.formatMetric("player", "contributionsP90", player.metrics.contributionsP90)}</span>
            <span class="tag">${app.formatMetric("player", "shotsOnTargetP90", player.metrics.shotsOnTargetP90)}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderSuggestions() {
  const topClubs = [...state.data.clubs].sort((a, b) => a.rank - b.rank).slice(0, 2);
  const topPlayers = [...state.data.players]
    .filter((player) => player.minutes >= 240)
    .sort((a, b) => b.metrics.contributionsP90 - a.metrics.contributionsP90)
    .slice(0, 2);

  const clubCard = topClubs.length === 2
    ? `<article class="compare-row"><h3>Club vs Club</h3><p class="muted">${app.escapeHtml(topClubs[0].name)} vs ${app.escapeHtml(topClubs[1].name)}</p><a class="btn" href="${app.buildUrl("compare.html", {
        mode: "club",
        competition: topClubs[0].competitionSlug,
        left: topClubs[0].slug,
        right: topClubs[1].slug,
      })}">Ouvrir cette comparaison</a></article>`
    : "";

  const playerCard = topPlayers.length === 2
    ? `<article class="compare-row"><h3>Joueur vs Joueur</h3><p class="muted">${app.escapeHtml(topPlayers[0].name)} vs ${app.escapeHtml(topPlayers[1].name)}</p><a class="btn" href="${app.buildUrl("compare.html", {
        mode: "player",
        competition: topPlayers[0].competitionSlug,
        left: topPlayers[0].slug,
        right: topPlayers[1].slug,
      })}">Ouvrir cette comparaison</a></article>`
    : "";

  elements.homeSuggestions.innerHTML = `${clubCard}${playerCard}` || `<p class="empty">Pas assez de donnees pour suggerer un duel.</p>`;
}

function renderSearchResults() {
  const query = state.search;
  if (!query || query.length < 2) {
    elements.searchResults.innerHTML = "";
    return;
  }

  const clubs = state.data.clubs
    .filter((club) => app.normalizeText(`${club.name} ${club.competitionName}`).includes(query))
    .slice(0, 4)
    .map((club) => ({
      type: "Club",
      label: club.name,
      detail: club.competitionName,
      href: app.buildUrl("club.html", { club: club.slug, competition: club.competitionSlug }),
    }));

  const players = state.data.players
    .filter((player) => player.searchText.includes(query))
    .slice(0, 4)
    .map((player) => ({
      type: "Joueur",
      label: player.name,
      detail: `${player.position} - ${player.clubName}`,
      href: app.buildUrl("player.html", { player: player.slug, competition: player.competitionSlug }),
    }));

  const rows = [...clubs, ...players].slice(0, 8);
  if (!rows.length) {
    elements.searchResults.innerHTML = `<p class="empty">Aucun resultat.</p>`;
    return;
  }

  elements.searchResults.innerHTML = rows
    .map(
      (row) => `<a class="result-link" href="${row.href}"><span><strong>${app.escapeHtml(row.label)}</strong><em>${app.escapeHtml(
        row.detail,
      )}</em></span><span class="tag">${row.type}</span></a>`,
    )
    .join("");
}

function fail(message) {
  if (elements.homeMeta) {
    elements.homeMeta.textContent = message;
  }
}
