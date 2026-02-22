import {
  createStore,
  loadFavorites,
  loadPersistedConfig,
  persistConfig,
  persistFavorites,
} from "./lib/store.js";
import { createRouter } from "./lib/router.js";
import { loadFromConfiguredPaths } from "./lib/dataLoader.js";
import { normalizeDatasetsAsync } from "./lib/normalize.js";
import {
  clearNode,
  createAboutDataCard,
  createCoachNote,
  createDataQualityPanel,
  createErrorCard,
  createLoadingCard,
  createPill,
  debounce,
  el,
  formatNumber,
  formatPercent,
  metricIsPercent,
  metricLabel,
  resolveMetricValue,
} from "./lib/ui/components.js";
import { renderPlayersTableView } from "./lib/ui/playersTable.js";
import { renderPlayerProfile } from "./lib/ui/playerProfile.js";
import { renderCompareView } from "./lib/ui/compare.js";
import { renderLeaderboardsView } from "./lib/ui/leaderboards.js";
import { renderClubsView, renderClubProfile } from "./lib/ui/clubs.js";
import { renderLearnView } from "./lib/ui/learn.js";
import { ChartProvider } from "./lib/charts/chartProvider.js";

const defaultConfig = window.APP_DEFAULT_CONFIG || {
  PLAYERS_JSON_URL: "./players_stats.json.gz",
  TEAMS_JSON_URL: "./teams_stats.json.gz",
  useChartJs: false,
  chartJsCdnUrl: "",
  chartJsLocalUrl: "",
};

const appRoot = document.getElementById("app");
const searchInput = document.getElementById("global-search-input");
const liveRegion = document.getElementById("live-region");
const navLinks = Array.from(document.querySelectorAll("[data-nav-link]"));
const prefersCardsLayout =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(max-width: 860px)").matches;

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
    loadInfo: null,
    sourceMode: "fixed-json-files",
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
      viewMode: prefersCardsLayout ? "cards" : "table",
    },
    compare: {
      a: "",
      b: "",
      metrics: [],
    },
    leaderboards: {
      metric: "decisiveActions",
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
      announce(`${next.size} favori(s) enregistre(s).`);
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
      const config = {
        ...state.config,
        playersUrl: state.config.playersUrl,
        teamsUrl: state.config.teamsUrl,
        useChartJs:
          typeof partialConfig.useChartJs === "boolean"
            ? partialConfig.useChartJs
            : state.config.useChartJs,
        chartJsCdnUrl: partialConfig.chartJsCdnUrl ?? state.config.chartJsCdnUrl,
        chartJsLocalUrl: partialConfig.chartJsLocalUrl ?? state.config.chartJsLocalUrl,
      };
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
          loadInfo: loadMeta.diagnostics || null,
          sourceMode: loadMeta.mode,
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
  actions.setLoading(true, "Chargement de la base JSON...");
  try {
    const config = store.getState().config;
    const loaded = await loadFromConfiguredPaths(config, {
      onProgress: (message) => actions.setLoading(true, message),
    });
    actions.setLoading(true, "Preparation des statistiques...");
    const normalized = await normalizeDatasetsAsync(
      loaded.playersArray,
      loaded.teamsObject,
      loaded.rawPlayersSource,
      loaded.rawTeamsSource,
      {
        chunkSize: 220,
        onProgress: ({ processed, total }) => {
          if (processed === total || processed % 440 === 0) {
            actions.setLoading(
              true,
              `Preparation des statistiques (${formatNumber(processed, 0)}/${formatNumber(total, 0)})...`
            );
          }
        },
      }
    );
    actions.applyNormalizedData(normalized, loaded);
    const loadMs = loaded.diagnostics?.loadMs;
    const durationText =
      typeof loadMs === "number" ? ` en ${formatNumber(loadMs, 0)} ms` : "";
    announce(`${normalized.players.length} joueurs charges${durationText}.`);
  } catch (error) {
    actions.setError({
      title: "Chargement impossible des fichiers de base",
      message:
        "Verifie la presence de players_stats/teams_stats (.json.gz ou .json) a la racine du projet.",
      details: error.technicalDetails || error.message,
    });
  } finally {
    actions.setLoading(false, "");
  }
}

function metricValueForHome(player, metricKey, preferPer90 = false) {
  const value = resolveMetricValue(player, metricKey, { preferPer90 });
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 0;
  }
  return Number(value) || 0;
}

function decisiveScore(player) {
  const goals = metricValueForHome(player, "goals");
  const assists = metricValueForHome(player, "assists");
  const penEntries90 = metricValueForHome(player, "pen_area_entries", true);
  const finalThird90 = metricValueForHome(player, "successful_final_third_passes", true);
  const contest90 = metricValueForHome(player, "won_contest", true);
  const duelsRate = metricValueForHome(player, "duelsWonRate");

  return (
    goals * 14 +
    assists * 10 +
    penEntries90 * 4 +
    finalThird90 * 3 +
    contest90 * 2 +
    duelsRate * 1.2
  );
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

function createPlayerSpotlightCard(player) {
  const card = el("article", { className: "spotlight-card" });
  const top = el("div", { className: "spotlight-top" });
  const avatar = el("span", { className: "spotlight-avatar" });

  if (player.photoUrl) {
    avatar.append(
      el("img", {
        attrs: {
          src: player.photoUrl,
          alt: `Photo de ${player.name}`,
          loading: "eager",
          decoding: "async",
        },
      })
    );
  } else {
    const initials = player.name
      .split(" ")
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("");
    avatar.textContent = initials || "J";
  }

  top.append(avatar);
  if (player.club?.logoUrl) {
    top.append(
      el("img", {
        className: "club-logo-sm",
        attrs: {
          src: player.club.logoUrl,
          alt: `Logo ${player.club?.name || "club"}`,
          loading: "lazy",
          decoding: "async",
        },
      })
    );
  }

  card.append(top);
  const link = el("a", {
    className: "spotlight-title",
    text: player.name,
    attrs: { href: `#/player/${encodeURIComponent(player.slug)}` },
  });
  card.append(link);
  card.append(
    el("p", {
      className: "muted",
      text: `${player.position || "Poste?"} | ${player.club?.name || "Club?"}`,
    })
  );

  const badges = el("div", { className: "spotlight-badges" });
  badges.append(el("span", { text: `${formatNumber(player.stats?.minutes, 0)} min` }));
  badges.append(
    el("span", {
      text: `Actions decisives: ${formatNumber(metricValueForHome(player, "decisiveActions"), 1)}`,
    })
  );
  badges.append(
    el("span", {
      text: `Decisif /90: ${formatNumber(metricValueForHome(player, "decisiveActions", true), 2)}`,
    })
  );
  card.append(badges);
  return card;
}

function createClubSpotlightCard(club) {
  const card = el("article", { className: "club-card" });
  const top = el("div", { className: "club-identity" });
  if (club.logoUrl) {
    top.append(
      el("img", {
        className: "club-logo-sm",
        attrs: {
          src: club.logoUrl,
          alt: `Logo ${club.name}`,
          loading: "lazy",
          decoding: "async",
        },
      })
    );
  }
  top.append(
    el("a", {
      text: club.name,
      attrs: {
        href: `#/club/${encodeURIComponent(club.competitionSlug || "unknown")}/${encodeURIComponent(
          club.slug
        )}`,
      },
    })
  );
  card.append(top);
  card.append(
    el("p", {
      className: "muted",
      text: `Rang ${formatNumber(club.rank, 0)} | ${formatNumber(club.points, 0)} pts`,
    })
  );
  return card;
}

function topPlayerByMetric(players, metricKey, options = {}) {
  const minMinutes = Number(options.minMinutes) || 300;
  const preferPer90 = Boolean(options.preferPer90);
  const position = options.position || "";

  const rows = players
    .filter((player) => {
      if (position && player.position !== position) {
        return false;
      }
      const minutes = player.stats?.minutes ?? 0;
      return minutes >= minMinutes;
    })
    .map((player) => ({
      player,
      value: resolveMetricValue(player, metricKey, { preferPer90 }),
    }))
    .filter((entry) => entry.value !== null && entry.value !== undefined)
    .sort((a, b) => b.value - a.value);

  return rows[0] || null;
}

function createKpiInsightCard(title, entry, metricKey) {
  const card = el("article", { className: "stat-card kpi-insight" });
  card.append(el("h3", { text: title }));

  if (!entry) {
    card.append(el("p", { className: "muted", text: "Pas de donnee disponible" }));
    return card;
  }

  const link = el("a", {
    text: entry.player.name,
    attrs: { href: `#/player/${encodeURIComponent(entry.player.slug)}` },
  });
  card.append(link);
  card.append(el("p", { className: "muted", text: `${entry.player.position} | ${entry.player.club?.name || "Club?"}` }));

  const valueText = metricIsPercent(metricKey)
    ? formatPercent(entry.value)
    : formatNumber(entry.value, 2);
  card.append(el("p", { className: "kpi", text: valueText }));
  card.append(el("p", { className: "muted", text: metricLabel(metricKey) }));
  return card;
}

function renderHomeView(root, state) {
  const card = el("section", { className: "page-card hero-shell" });
  card.append(el("h2", { text: "Tableau de bord coach" }));
  card.append(
    createCoachNote(
      "Explore rapidement les KPI utiles: joueurs decisifs, tops par metrique, et lecture par poste."
    )
  );

  if (state.data.players.length === 0) {
    card.append(
      el("p", {
        text: "Aucune donnee chargee pour l'instant.",
      })
    );
    card.append(
      el("p", {
        text: "Verifie que players_stats et teams_stats sont accessibles a la racine.",
      })
    );
    card.append(el("a", { text: "Ouvrir les parametres", attrs: { href: "#/settings" } }));
    root.append(card);
    if (state.error) {
      root.append(createErrorCard(state.error));
    }
    return;
  }

  const quickGrid = el("div", { className: "grid-cards hero-grid" });
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
      html: `<h3>Source</h3><p class="kpi">JSON fixe</p>`,
    })
  );

  card.append(quickGrid);

  if (state.data.loadInfo) {
    const loadInfoRow = el("div", { className: "status-row" });
    loadInfoRow.append(createPill("Joueurs", state.data.loadInfo.playersSource || "network"));
    loadInfoRow.append(createPill("Clubs", state.data.loadInfo.teamsSource || "network"));
    loadInfoRow.append(createPill("Temps", `${formatNumber(state.data.loadInfo.loadMs, 0)} ms`, "ok"));
    card.append(loadInfoRow);
  }

  const cta = el("div", { className: "hero-cta" });
  cta.append(el("a", { className: "button", text: "Explorer les joueurs", attrs: { href: "#/players" } }));
  cta.append(el("a", { className: "button", text: "Voir les tops", attrs: { href: "#/leaderboards" } }));
  cta.append(el("a", { className: "button", text: "Comparer", attrs: { href: "#/compare" } }));
  card.append(cta);

  root.append(card);

  const kpiSection = el("section", { className: "page-card" });
  kpiSection.append(el("h3", { text: "KPI express" }));
  const kpiGrid = el("div", { className: "grid-cards" });
  const players = state.data.players;
  kpiGrid.append(
    createKpiInsightCard(
      "Precision de passe",
      topPlayerByMetric(players, "passAccuracy", { minMinutes: 500 }),
      "passAccuracy"
    )
  );
  kpiGrid.append(
    createKpiInsightCard(
      "Duels gagnes",
      topPlayerByMetric(players, "duelsWonRate", { minMinutes: 500 }),
      "duelsWonRate"
    )
  );
  kpiGrid.append(
    createKpiInsightCard(
      "Recuperations /90",
      topPlayerByMetric(players, "poss_won", { minMinutes: 400, preferPer90: true }),
      "poss_won"
    )
  );
  kpiGrid.append(
    createKpiInsightCard(
      "Arrets /90 (gardiens)",
      topPlayerByMetric(players, "saves", {
        minMinutes: 400,
        preferPer90: true,
        position: "Gardien",
      }),
      "saves"
    )
  );
  kpiSection.append(kpiGrid);
  root.append(kpiSection);

  const featuredPlayers = [...state.data.players]
    .filter((player) => player.position !== "Gardien" && (player.stats?.minutes ?? 0) >= 450)
    .map((player) => ({ player, score: decisiveScore(player) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((row) => row.player);

  const playersSection = el("section", { className: "page-card" });
  playersSection.append(el("h3", { text: "Joueurs les plus decisifs" }));
  playersSection.append(
    el("p", {
      className: "muted",
      text: "Classement base sur les actions decisives et la contribution offensive /90.",
    })
  );
  const playersGrid = el("div", { className: "grid-cards home-spotlights" });
  const playersFragment = document.createDocumentFragment();
  featuredPlayers.forEach((player) => playersFragment.append(createPlayerSpotlightCard(player)));
  playersGrid.append(playersFragment);
  playersSection.append(playersGrid);
  root.append(playersSection);

  const featuredClubs = [...state.data.clubs]
    .sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER))
    .slice(0, 8);

  const clubsSection = el("section", { className: "page-card" });
  clubsSection.append(el("h3", { text: "Clubs en vue" }));
  const clubsGrid = el("div", { className: "grid-cards home-clubs" });
  const clubsFragment = document.createDocumentFragment();
  featuredClubs.forEach((club) => clubsFragment.append(createClubSpotlightCard(club)));
  clubsGrid.append(clubsFragment);
  clubsSection.append(clubsGrid);
  root.append(clubsSection);

  if (state.warnings.length > 0) {
    root.append(createWarningsCard(state.warnings));
  }
  root.append(createAboutDataCard(state.data.meta));
  root.append(createDataQualityPanel(state.data.dataQuality));
}

function renderSettingsView(root, state) {
  const page = el("section", { className: "page-card" });
  page.append(el("h2", { text: "Parametres" }));
  page.append(
    createCoachNote(
      "La base de donnees est fixe: players_stats + teams_stats (formats .json.gz ou .json)."
    )
  );

  const sourcePanel = el("section", { className: "controls-panel" });
  sourcePanel.append(el("h3", { text: "Source de donnees" }));
  sourcePanel.append(
    el("p", {
      text: "Fichier joueurs prioritaire: ./players_stats.json.gz (fallback: ./players_stats.json)",
    })
  );
  sourcePanel.append(
    el("p", {
      text: "Fichier clubs prioritaire: ./teams_stats.json.gz (fallback: ./teams_stats.json)",
    })
  );
  const reloadBtn = el("button", {
    text: "Recharger les donnees",
    attrs: { type: "button" },
  });
  reloadBtn.addEventListener("click", () => loadConfiguredData());
  sourcePanel.append(reloadBtn);
  page.append(sourcePanel);

  const chartForm = el("form", { className: "controls-panel" });
  chartForm.append(el("h3", { text: "Graphiques" }));
  const chartGrid = el("div", { className: "controls-grid" });
  const chartJsField = el("label", { className: "field" });
  chartJsField.append(el("span", { text: "Option graphique" }));
  const chartSelect = document.createElement("select");
  chartSelect.append(el("option", { text: "SVG (leger, recommande)", attrs: { value: "false" } }));
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

  chartGrid.append(chartJsField, cndUrlField);
  chartForm.append(chartGrid);

  const chartButtons = el("div", { className: "control-row" });
  const saveBtn = el("button", {
    text: "Sauvegarder",
    attrs: { type: "submit" },
  });
  const retryBtn = el("button", {
    text: "Recharger",
    attrs: { type: "button" },
  });
  retryBtn.addEventListener("click", () => loadConfiguredData());
  chartButtons.append(saveBtn, retryBtn);
  chartForm.append(chartButtons);

  chartForm.addEventListener("submit", (event) => {
    event.preventDefault();
    actions.updateConfig({
      useChartJs: chartSelect.value === "true",
      chartJsCdnUrl: chartCdnInput.value.trim(),
    });
  });
  page.append(chartForm);

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



