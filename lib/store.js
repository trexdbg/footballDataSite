export const STORAGE_KEYS = {
  config: "foot-stats-coach.config.v1",
  favorites: "foot-stats-coach.favorites.v1",
};

function safeJsonParse(raw, fallbackValue) {
  if (!raw) {
    return fallbackValue;
  }
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return fallbackValue;
  }
}

export function loadPersistedConfig(defaultConfig) {
  const fromStorage = safeJsonParse(localStorage.getItem(STORAGE_KEYS.config), {});
  return {
    playersUrl: defaultConfig.PLAYERS_JSON_URL,
    teamsUrl: defaultConfig.TEAMS_JSON_URL,
    useChartJs:
      typeof fromStorage.useChartJs === "boolean"
        ? fromStorage.useChartJs
        : Boolean(defaultConfig.useChartJs),
    chartJsCdnUrl: fromStorage.chartJsCdnUrl || defaultConfig.chartJsCdnUrl,
    chartJsLocalUrl: fromStorage.chartJsLocalUrl || defaultConfig.chartJsLocalUrl,
  };
}

export function persistConfig(config) {
  localStorage.setItem(
    STORAGE_KEYS.config,
    JSON.stringify({
      useChartJs: Boolean(config?.useChartJs),
      chartJsCdnUrl: config?.chartJsCdnUrl || "",
      chartJsLocalUrl: config?.chartJsLocalUrl || "",
    })
  );
}

export function loadFavorites() {
  const raw = safeJsonParse(localStorage.getItem(STORAGE_KEYS.favorites), []);
  if (!Array.isArray(raw)) {
    return new Set();
  }
  return new Set(raw.filter((value) => typeof value === "string"));
}

export function persistFavorites(favoritesSet) {
  const list = Array.from(favoritesSet);
  localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(list));
}

export function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();

  function getState() {
    return state;
  }

  function setState(nextOrUpdater) {
    const nextState =
      typeof nextOrUpdater === "function"
        ? nextOrUpdater(state)
        : { ...state, ...nextOrUpdater };

    if (!nextState || nextState === state) {
      return;
    }
    state = nextState;
    listeners.forEach((listener) => listener(state));
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    getState,
    setState,
    subscribe,
  };
}
