import {
  createStore,
  loadFavorites,
  loadPersistedConfig,
  persistConfig,
  persistFavorites,
} from "./lib/store.js";
import { createRouter } from "./lib/router.js";
import {
  explainExpectedShape,
  loadFromConfiguredPaths,
  loadFromImportedFiles,
} from "./lib/dataLoader.js";
import { normalizeDatasets } from "./lib/normalize.js";
import {
  clearNode,
  createAboutDataCard,
  createCoachNote,
  createDataQualityPanel,
  createErrorCard,
  createLoadingCard,
  debounce,
  el,
  formatNumber,
} from "./lib/ui/components.js";
import { renderPlayersTableView } from "./lib/ui/playersTable.js";
import { renderPlayerProfile } from "./lib/ui/playerProfile.js";
import { renderCompareView } from "./lib/ui/compare.js";
import { renderLeaderboardsView } from "./lib/ui/leaderboards.js";
import { renderClubsView, renderClubProfile } from "./lib/ui/clubs.js";
import { renderLearnView } from "./lib/ui/learn.js";
import { ChartProvider } from "./lib/charts/chartProvider.js";

const defaultConfig = window.APP_DEFAULT_CONFIG || {
  PLAYERS_JSON_URL: "./data/players.json",
  TEAMS_JSON_URL: "./data/teams.json",
  useChartJs: false,
  chartJsCdnUrl: "",
  chartJsLocalUrl: "",
};

const appRoot = document.getElementById("app");
const searchInput = document.getElementById("global-search-input");
const liveRegion = document.getElementById("live-region");
const navLinks = Array.from(document.querySelectorAll("[data-nav-link]"));

const initialState = {
  route: { name: "home", params: {} },
  loading: false,
  loadingMessage: "",
  error: null,
  warnings: [],
  config: loadPersistedConfig(defaultConfig),
  favorites: loadFavorites(),
  data: {
    players: [],
    clubs: [],
    competitions: [],
    seasonKeys: [],
    dataQuality: null,
    meta: { generatedAt: "" },
    sourceMode: "demo",
    detectedFiles: null,
  },
  index: {
    searchMap: new Map(),
    bySlug: new Map(),
    clubsByKey: new Map(),
  },
  ui: {
    searchQuery: "",
    players: {
      filters: {
        position: "",
        club: "",
        season: "all",
        minutesMin: 0,
      },
      sort: { key: "name", dir: "asc" },
      page: 1,
      pageSize: 50,
      viewMode: "table",
    },
    compare: {
      a: "",
      b: "",
      metrics: [],
    },
    leaderboards: {
      metric: "accurate_pass",
      position: "",
      minutesMin: 300,
      topN: 10,
    },
    clubs: {
      competition: "",
    },
  },
};

const store = createStore(initialState);
let chartProvider = new ChartProvider(initialState.config);

function announce(message) {
  liveRegion.textContent = "";
  window.setTimeout(() => {
    liveRegion.textContent = message;
  }, 20);
}

function buildIndexes(players, clubs) {
  const searchMap = new Map();
  const bySlug = new Map();
  const clubsByKey = new Map();
  players.forEach((player) => {
    bySlug.set(player.slug, player);
    const text = [player.name, player.club?.name, player.nationality]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    searchMap.set(player.slug, text);
  });
  clubs.forEach((club) => {
    clubsByKey.set(`${club.competitionSlug}::${club.slug}`, club);
  });
  return { searchMap, bySlug, clubsByKey };
}

function updateState(updater) {
  store.setState((current) => updater(current));
}

const actions = {
  setRoute(route) {
    updateState((state) => ({ ...state, route }));
  },
  setLoading(loading, loadingMessage = "") {
    updateState((state) => ({ ...state, loading, loadingMessage }));
  },
  setError(errorObject) {
    updateState((state) => ({ ...state, error: errorObject }));
  },
  clearError() {
    updateState((state) => ({ ...state, error: null }));
  },
  setWarnings(warnings) {
    updateState((state) => ({ ...state, warnings: warnings || [] }));
  },
  setSearchQuery(query) {
    updateState((state) => ({
      ...state,
      ui: {
        ...state.ui,
        searchQuery: query,
        players: { ...state.ui.players, page: 1 },
      },
    }));
  },
  toggleFavorite(slug) {
    updateState((state) => {
      const next = new Set(state.favorites);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      persistFavorites(next);
      announce(`${next.size} favori(s) enregistré(s).`);
      return { ...state, favorites: next };
    });
  },
  setPlayerFilter(key, value) {
    updateState((state) => ({
      ...state,
      ui: {
        ...state.ui,
        players: {
          ...state.ui.players,
          page: 1,
          filters: {
            ...state.ui.players.filters,
            [key]: value,
          },
        },
      },
    }));
  },
  setPlayerSort(key) {
    updateState((state) => {
      const prev = state.ui.players.sort;
      const dir = prev.key === key && prev.dir === "asc" ? "desc" : "asc";
      return {
        ...state,
        ui: {
          ...state.ui,
          players: {
            ...state.ui.players,
            sort: { key, dir },
          },
        },
      };
    });
  },
  setPlayerPage(page) {
    updateState((state) => ({
      ...state,
      ui: {
        ...state.ui,
        players: {
          ...state.ui.players,
          page,
        },
      },
    }));
  },
  setPlayerPageSize(pageSize) {
    updateState((state) => ({
      ...state,
      ui: {
        ...state.ui,
        players: {
          ...state.ui.players,
          pageSize,
          page: 1,
        },
      },
    }));
  },
  togglePlayerViewMode() {
    updateState((state) => ({
      ...state,
      ui: {
        ...state.ui,
        players: {
          ...state.ui.players,
          viewMode: state.ui.players.viewMode === "table" ? "cards" : "table",
        },
      },
    }));
  },
  addPlayerToCompare(slug) {
    updateState((state) => {
      const compare = { ...state.ui.compare };
      if (!compare.a || compare.a === slug) {
        compare.a = slug;
      } else if (!compare.b || compare.b === slug) {
        compare.b = slug;
      } else {
        compare.b = slug;
      }
      return {
        ...state,
        ui: {
          ...state.ui,
          compare,
        },
      };
    });
    router.navigate("/compare");
  },
  setComparePlayer(slot, slug) {
    updateState((state) => ({
      ...state,
      ui: {
        ...state.ui,
        compare: {
          ...state.ui.compare,
          [slot]: slug,
        },
      },
    }));
  },
  swapComparePlayers() {
    updateState((state) => ({
      ...state,
      ui: {
        ...state.ui,
        compare: {
          ...state.ui.compare,
          a: state.ui.compare.b,
          b: state.ui.compare.a,
        },
      },
    }));
  },
  toggleCompareMetric(metric) {
    updateState((state) => {
      const current = state.ui.compare.metrics || [];
      const exists = current.includes(metric);
      let next = [];
      if (exists) {
        next = current.filter((entry) => entry !== metric);
      } else {
        next = [...current, metric];
      }
      if (next.length > 5) {
        next = next.slice(next.length - 5);
      }
      return {
        ...state,
        ui: {
          ...state.ui,
          compare: {
            ...state.ui.compare,
            metrics: next,
          },
        },
      };
    });
  },
  setLeaderboardOption(key, value) {
    updateState((state) => ({
      ...state,
      ui: {
        ...state.ui,
        leaderboards: {
          ...state.ui.leaderboards,
          [key]: value,
        },
      },
    }));
  },
  setCompetition(value) {
    updateState((state) => ({
      ...state,
      ui: {
        ...state.ui,
        clubs: {
          ...state.ui.clubs,
          competition: value,
        },
      },
    }));
  },
  updateConfig(partialConfig) {
    updateState((state) => {
      const config = { ...state.config, ...partialConfig };
      persistConfig(config);
      chartProvider = new ChartProvider(config);
      return { ...state, config };
    });
  },
  applyNormalizedData(bundle, loadMeta) {
    updateState((state) => {
      const indexes = buildIndexes(bundle.players, bundle.clubs);
      const availableSlugs = new Set(bundle.players.map((player) => player.slug));
      const safeA = availableSlugs.has(state.ui.compare.a) ? state.ui.compare.a : "";
      const safeB = availableSlugs.has(state.ui.compare.b) ? state.ui.compare.b : "";
      const competition =
        state.ui.clubs.competition &&
        bundle.competitions.some((entry) => entry.slug === state.ui.clubs.competition)
          ? state.ui.clubs.competition
          : bundle.competitions[0]?.slug || "";

      return {
        ...state,
        error: null,
        warnings: loadMeta.warnings || [],
        data: {
          ...state.data,
          players: bundle.players,
          clubs: bundle.clubs,
          competitions: bundle.competitions,
          seasonKeys: bundle.seasonKeys,
          dataQuality: bundle.dataQuality,
          meta: bundle.meta,
          sourceMode: loadMeta.mode,
          detectedFiles: loadMeta.detected || null,
        },
        index: indexes,
        ui: {
          ...state.ui,
          compare: {
            ...state.ui.compare,
            a: safeA,
            b: safeB,
          },
          clubs: {
            ...state.ui.clubs,
            competition,
          },
        },
      };
    });
  },
};

async function loadConfiguredData() {
  actions.setLoading(true, "Chargement des fichiers configurés...");
  try {
    const loaded = await loadFromConfiguredPaths(store.getState().config);
    const normalized = normalizeDatasets(
      loaded.playersArray,
      loaded.teamsObject,
      loaded.rawPlayersSource,
      loaded.rawTeamsSource
    );
    actions.applyNormalizedData(normalized, loaded);
    announce(`${normalized.players.length} joueurs chargés.`);
  } catch (error) {
    actions.setError({
      title: "Chargement impossible depuis les chemins configurés",
      message:
        "Tu peux corriger les chemins dans Paramètres ou importer les deux fichiers JSON à la main.",
      details: error.technicalDetails || error.message,
    });
  } finally {
    actions.setLoading(false, "");
  }
}

async function loadImportedData(files) {
  actions.setLoading(true, "Lecture des fichiers importés...");
  try {
    const loaded = await loadFromImportedFiles(files);
    const normalized = normalizeDatasets(
      loaded.playersArray,
      loaded.teamsObject,
      loaded.rawPlayersSource,
      loaded.rawTeamsSource
    );
    actions.applyNormalizedData(normalized, loaded);
    announce(`${normalized.players.length} joueurs importés avec succès.`);
    router.navigate("/home");
  } catch (error) {
    actions.setError({
      title: "Import impossible",
      message:
        error.message ||
        "Je n'arrive pas à reconnaître les deux fichiers JSON. Vérifie les données et réessaie.",
      details: error.technicalDetails || "",
    });
  } finally {
    actions.setLoading(false, "");
  }
}

function createWarningsCard(warnings) {
  const card = el("section", { className: "page-card" });
  card.append(el("h2", { text: "Infos de chargement" }));
  const list = document.createElement("ul");
  warnings.forEach((warning) => {
    list.append(el("li", { text: warning }));
  });
  card.append(list);
  return card;
}

function renderHomeView(root, state) {
  const card = el("section", { className: "page-card" });
  card.append(el("h2", { text: "Accueil du coach" }));
  card.append(
    createCoachNote(
      "Commence par charger les fichiers, puis explore les joueurs, les tops et la comparaison."
    )
  );

  if (state.data.players.length === 0) {
    card.append(
      el("p", {
        text: "Mode démo: aucune donnée chargée pour l'instant.",
      })
    );
    card.append(
      el("p", {
        text: "Va dans Paramètres pour renseigner les chemins JSON ou importer 2 fichiers.",
      })
    );
    card.append(el("a", { text: "Ouvrir les paramètres", attrs: { href: "#/settings" } }));
    root.append(card);
    if (state.error) {
      root.append(createErrorCard(state.error));
    }
    return;
  }

  const quickGrid = el("div", { className: "grid-cards" });
  quickGrid.append(
    el("article", {
      className: "stat-card",
      html: `<h3>Joueurs</h3><p class="kpi">${formatNumber(state.data.players.length, 0)}</p>`,
    })
  );
  quickGrid.append(
    el("article", {
      className: "stat-card",
      html: `<h3>Clubs</h3><p class="kpi">${formatNumber(state.data.clubs.length, 0)}</p>`,
    })
  );
  quickGrid.append(
    el("article", {
      className: "stat-card",
      html: `<h3>Favoris</h3><p class="kpi">${formatNumber(state.favorites.size, 0)}</p>`,
    })
  );
  quickGrid.append(
    el("article", {
      className: "stat-card",
      html: `<h3>Source</h3><p class="kpi">${state.data.sourceMode === "import-files" ? "Import" : "Chemins"}</p>`,
    })
  );

  card.append(quickGrid);
  card.append(el("p", { className: "muted", text: "Astuce: utilise la recherche globale en haut pour aller plus vite." }));
  root.append(card);

  if (state.warnings.length > 0) {
    root.append(createWarningsCard(state.warnings));
  }
  root.append(createAboutDataCard(state.data.meta));
  root.append(createDataQualityPanel(state.data.dataQuality));
}

function renderSettingsView(root, state) {
  const page = el("section", { className: "page-card" });
  page.append(el("h2", { text: "Paramètres de chargement" }));
  page.append(
    createCoachNote(
      "Deux modes: 1) chemins configurés, 2) import manuel de fichiers JSON."
    )
  );

  const pathForm = el("form", { className: "controls-panel" });
  pathForm.append(el("h3", { text: "Mode 1 - chemins configurés" }));
  const pathGrid = el("div", { className: "controls-grid" });

  const playersUrlField = el("label", { className: "field" });
  playersUrlField.append(el("span", { text: "Chemin JSON joueurs" }));
  const playersUrlInput = el("input", {
    attrs: {
      type: "text",
      value: state.config.playersUrl,
      placeholder: "./data/players.json",
    },
  });
  playersUrlField.append(playersUrlInput);

  const teamsUrlField = el("label", { className: "field" });
  teamsUrlField.append(el("span", { text: "Chemin JSON clubs/classements" }));
  const teamsUrlInput = el("input", {
    attrs: {
      type: "text",
      value: state.config.teamsUrl,
      placeholder: "./data/teams.json",
    },
  });
  teamsUrlField.append(teamsUrlInput);

  const chartJsField = el("label", { className: "field" });
  chartJsField.append(el("span", { text: "Option graphique" }));
  const chartSelect = document.createElement("select");
  chartSelect.append(el("option", { text: "SVG (léger, recommandé)", attrs: { value: "false" } }));
  chartSelect.append(el("option", { text: "Chart.js si disponible", attrs: { value: "true" } }));
  chartSelect.value = state.config.useChartJs ? "true" : "false";
  chartJsField.append(chartSelect);

  const cndUrlField = el("label", { className: "field" });
  cndUrlField.append(el("span", { text: "URL Chart.js CDN (optionnel)" }));
  const chartCdnInput = el("input", {
    attrs: {
      type: "text",
      value: state.config.chartJsCdnUrl || "",
      placeholder: "https://cdn.jsdelivr.net/npm/chart.js...",
    },
  });
  cndUrlField.append(chartCdnInput);

  pathGrid.append(playersUrlField, teamsUrlField, chartJsField, cndUrlField);
  pathForm.append(pathGrid);

  const pathButtons = el("div", { className: "control-row" });
  const saveBtn = el("button", {
    text: "Sauvegarder + recharger",
    attrs: { type: "submit" },
  });
  const retryBtn = el("button", {
    text: "Recharger sans modifier",
    attrs: { type: "button" },
  });
  retryBtn.addEventListener("click", () => loadConfiguredData());
  pathButtons.append(saveBtn, retryBtn);
  pathForm.append(pathButtons);

  pathForm.addEventListener("submit", (event) => {
    event.preventDefault();
    actions.updateConfig({
      playersUrl: playersUrlInput.value.trim(),
      teamsUrl: teamsUrlInput.value.trim(),
      useChartJs: chartSelect.value === "true",
      chartJsCdnUrl: chartCdnInput.value.trim(),
    });
    loadConfiguredData();
  });

  page.append(pathForm);

  const importSection = el("section", { className: "controls-panel" });
  importSection.append(el("h3", { text: "Mode 2 - import de fichiers" }));
  importSection.append(
    el("p", { text: "Sélectionne les 2 JSON. L'app détecte automatiquement joueurs et classements." })
  );

  const fileInput = el("input", {
    attrs: {
      type: "file",
      accept: "application/json,.json",
      multiple: "true",
      "aria-label": "Importer des fichiers JSON",
    },
  });
  const importBtn = el("button", {
    text: "Importer maintenant",
    attrs: { type: "button" },
  });
  importBtn.addEventListener("click", () => {
    if (!fileInput.files || fileInput.files.length === 0) {
      actions.setError({
        title: "Import incomplet",
        message: "Choisis d'abord les fichiers JSON à importer.",
      });
      return;
    }
    loadImportedData(fileInput.files);
  });

  importSection.append(fileInput, importBtn);
  page.append(importSection);

  const shape = explainExpectedShape();
  const helpDetails = el("details");
  helpDetails.append(el("summary", { text: "Exemples de structure attendue" }));
  helpDetails.append(el("p", { text: "Format joueurs (simplifié):" }));
  helpDetails.append(el("pre", { text: shape.playersExample }));
  helpDetails.append(el("p", { text: "Format clubs/classements (simplifié):" }));
  helpDetails.append(el("pre", { text: shape.teamsExample }));
  page.append(helpDetails);

  if (state.data.detectedFiles) {
    page.append(
      el("p", {
        className: "success-text",
        text: `Dernier import détecté: joueurs=${state.data.detectedFiles.playersFile}, clubs=${state.data.detectedFiles.teamsFile}`,
      })
    );
  }

  if (state.error) {
    page.append(createErrorCard(state.error));
  }

  root.append(page);
}

function renderRoute(state) {
  clearNode(appRoot);

  if (state.loading) {
    appRoot.append(createLoadingCard(state.loadingMessage));
    return;
  }

  switch (state.route.name) {
    case "home":
      renderHomeView(appRoot, state);
      break;
    case "players":
      renderPlayersTableView(appRoot, {
        title: "Table des joueurs",
        players: state.data.players,
        favorites: state.favorites,
        searchQuery: state.ui.searchQuery,
        searchIndex: state.index.searchMap,
        filters: state.ui.players.filters,
        seasonKeys: state.data.seasonKeys,
        sortState: state.ui.players.sort,
        page: state.ui.players.page,
        pageSize: state.ui.players.pageSize,
        viewMode: state.ui.players.viewMode,
        actions,
      });
      break;
    case "favorites":
      renderPlayersTableView(appRoot, {
        title: "Mes favoris",
        players: state.data.players.filter((player) => state.favorites.has(player.slug)),
        favorites: state.favorites,
        searchQuery: state.ui.searchQuery,
        searchIndex: state.index.searchMap,
        filters: state.ui.players.filters,
        seasonKeys: state.data.seasonKeys,
        sortState: state.ui.players.sort,
        page: state.ui.players.page,
        pageSize: state.ui.players.pageSize,
        viewMode: state.ui.players.viewMode,
        emptyMessage: "Tu n'as pas encore de favori. Clique sur un coeur dans la table joueurs.",
        actions,
      });
      break;
    case "player": {
      const player = state.index.bySlug.get(state.route.params.slug);
      renderPlayerProfile(appRoot, { player, favorites: state.favorites, actions });
      break;
    }
    case "compare":
      renderCompareView(appRoot, {
        players: state.data.players,
        compare: state.ui.compare,
        chartProvider,
        actions,
      });
      break;
    case "leaderboards":
      renderLeaderboardsView(appRoot, {
        players: state.data.players,
        options: state.ui.leaderboards,
        actions,
      });
      break;
    case "clubs":
      renderClubsView(appRoot, {
        clubs: state.data.clubs,
        competitions: state.data.competitions,
        selectedCompetition: state.ui.clubs.competition,
        actions,
      });
      break;
    case "club": {
      const key = `${state.route.params.competitionSlug}::${state.route.params.slug}`;
      const club = state.index.clubsByKey.get(key);
      renderClubProfile(appRoot, { club });
      break;
    }
    case "learn":
      renderLearnView(appRoot);
      break;
    case "settings":
      renderSettingsView(appRoot, state);
      break;
    default:
      renderHomeView(appRoot, state);
      break;
  }

  if (state.error && state.route.name !== "settings" && state.data.players.length > 0) {
    appRoot.append(createErrorCard(state.error));
  }
}

function syncNav(routeName) {
  navLinks.forEach((link) => {
    const href = link.getAttribute("href") || "";
    const route = href.replace(/^#\//, "");
    const active = routeName === route || (route === "players" && routeName === "player");
    link.classList.toggle("active", active);
  });
}

function render() {
  const state = store.getState();
  syncNav(state.route.name);
  if (searchInput.value !== state.ui.searchQuery) {
    searchInput.value = state.ui.searchQuery;
  }
  renderRoute(state);
}

const router = createRouter((route) => actions.setRoute(route));
store.subscribe(render);

searchInput.addEventListener(
  "input",
  debounce((event) => {
    actions.setSearchQuery(event.target.value);
  }, 150)
);

render();
loadConfiguredData();
