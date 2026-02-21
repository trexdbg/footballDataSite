const TEAMS_URL = "teams_stats.json";

const state = {
  competitions: [],
  selected: null,
  redirectTimer: null,
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  init().catch((error) => {
    console.error(error);
    showError("Impossible de charger les championnats.");
  });
});

async function init() {
  cacheElements();
  bindEvents();

  const payload = await fetchJson(TEAMS_URL);
  state.competitions = (payload.standings || []).map((entry) => ({
    slug: String(entry.competition_slug || ""),
    name: repairText(entry.competition_name || entry.competition_slug || "Competition"),
    teamsCount: Number((entry.table || []).length || 0),
    seasonName: String(entry.season_name || ""),
  }));

  if (!state.competitions.length) {
    showError("Aucun championnat disponible.");
    return;
  }

  pickRandomLeague();
}

function cacheElements() {
  elements.randomLeagueTitle = document.getElementById("randomLeagueTitle");
  elements.randomLeagueMeta = document.getElementById("randomLeagueMeta");
  elements.openRandomLeague = document.getElementById("openRandomLeague");
  elements.rerollLeague = document.getElementById("rerollLeague");
}

function bindEvents() {
  elements.rerollLeague.addEventListener("click", () => {
    pickRandomLeague();
  });
}

function pickRandomLeague() {
  const index = Math.floor(Math.random() * state.competitions.length);
  state.selected = state.competitions[index];
  renderSelection();
}

function renderSelection() {
  if (!state.selected) {
    return;
  }

  const target = `teams.html?competition=${encodeURIComponent(state.selected.slug)}`;
  const season = state.selected.seasonName ? ` Saison ${state.selected.seasonName}.` : "";

  elements.randomLeagueTitle.textContent = `${state.selected.name}: ouverture automatique`;
  elements.randomLeagueMeta.textContent = `${state.selected.teamsCount} clubs.${season}`;
  elements.openRandomLeague.href = target;

  if (state.redirectTimer !== null) {
    clearTimeout(state.redirectTimer);
  }
  state.redirectTimer = setTimeout(() => {
    window.location.href = target;
  }, 1400);
}

function showError(message) {
  elements.randomLeagueTitle.textContent = message;
  elements.randomLeagueMeta.textContent = "Utilise les liens Joueurs ou Equipes.";
  elements.openRandomLeague.href = "teams.html";
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Echec chargement ${url}: ${response.status}`);
  }
  return response.json();
}

function repairText(input) {
  const raw = String(input || "");
  if (!/[ÃƒÃ‚]/.test(raw)) {
    return raw;
  }

  try {
    const bytes = Uint8Array.from(raw, (char) => char.charCodeAt(0));
    const decoded = new TextDecoder("utf-8").decode(bytes);
    return decoded || raw;
  } catch {
    return raw;
  }
}
