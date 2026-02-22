const PLAYERS_JSON_URL = "./players_stats.json";
const TEAMS_JSON_URL = "./teams_stats.json";

window.PLAYERS_JSON_URL = PLAYERS_JSON_URL;
window.TEAMS_JSON_URL = TEAMS_JSON_URL;

window.APP_DEFAULT_CONFIG = Object.freeze({
  PLAYERS_JSON_URL,
  TEAMS_JSON_URL,
  useChartJs: false,
  chartJsCdnUrl: "https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js",
  chartJsLocalUrl: "./vendor/chart.umd.min.js",
});
