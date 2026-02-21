
(() => {
  const TEAMS_URL = "teams_stats.json";
  const PLAYERS_URL = "players_stats.json";

  const PLAYER_METRICS = [
    { id: "goalsP90", label: "Buts /90", decimals: 2, suffix: "", higherIsBetter: true },
    { id: "assistsP90", label: "Passes decisives /90", decimals: 2, suffix: "", higherIsBetter: true },
    { id: "contributionsP90", label: "Buts + passes /90", decimals: 2, suffix: "", higherIsBetter: true },
    { id: "shotsP90", label: "Tirs /90", decimals: 2, suffix: "", higherIsBetter: true },
    { id: "shotsOnTargetP90", label: "Tirs cadres /90", decimals: 2, suffix: "", higherIsBetter: true },
    { id: "passesP90", label: "Passes reussies /90", decimals: 2, suffix: "", higherIsBetter: true },
    { id: "passAccuracy", label: "Precision de passe", decimals: 1, suffix: "%", higherIsBetter: true },
    { id: "finalThirdPassesP90", label: "Passes dernier tiers /90", decimals: 2, suffix: "", higherIsBetter: true },
    { id: "tacklesWonP90", label: "Tacles gagnes /90", decimals: 2, suffix: "", higherIsBetter: true },
    { id: "interceptionsP90", label: "Interceptions /90", decimals: 2, suffix: "", higherIsBetter: true },
    { id: "duelsWonP90", label: "Duels gagnes /90", decimals: 2, suffix: "", higherIsBetter: true },
    { id: "savesP90", label: "Arrets /90", decimals: 2, suffix: "", higherIsBetter: true },
    { id: "goalsConcededP90", label: "Buts encaisses /90", decimals: 2, suffix: "", higherIsBetter: false },
    { id: "cleanSheetsRate5", label: "Clean sheets (5 derniers)", decimals: 1, suffix: "%", higherIsBetter: true },
  ];

  const TEAM_METRICS = [
    { id: "points", label: "Points", decimals: 0, suffix: "", higherIsBetter: true },
    { id: "wins", label: "Victoires", decimals: 0, suffix: "", higherIsBetter: true },
    { id: "goalsFor", label: "Buts marques", decimals: 0, suffix: "", higherIsBetter: true },
    { id: "goalsAgainst", label: "Buts encaisses", decimals: 0, suffix: "", higherIsBetter: false },
    { id: "goalDifference", label: "Difference de buts", decimals: 0, suffix: "", higherIsBetter: true },
    { id: "cleanSheetRate", label: "Clean sheets", decimals: 1, suffix: "%", higherIsBetter: true },
    { id: "recentPoints", label: "Points (5 derniers)", decimals: 0, suffix: "", higherIsBetter: true },
  ];

  const POSITION_PROFILES = {
    Forward: ["goalsP90", "shotsOnTargetP90", "shotsP90", "assistsP90", "contributionsP90", "duelsWonP90"],
    Midfielder: ["assistsP90", "passesP90", "passAccuracy", "finalThirdPassesP90", "interceptionsP90", "duelsWonP90"],
    Defender: ["tacklesWonP90", "interceptionsP90", "duelsWonP90", "passAccuracy", "passesP90", "goalsP90"],
    Goalkeeper: ["savesP90", "goalsConcededP90", "cleanSheetsRate5", "passesP90", "passAccuracy", "duelsWonP90"],
    default: ["contributionsP90", "shotsOnTargetP90", "passesP90", "passAccuracy", "tacklesWonP90", "duelsWonP90"],
  };

  const TEAM_RADAR_METRICS = ["points", "goalsFor", "goalDifference", "cleanSheetRate", "recentPoints", "goalsAgainst"];

  const COLORS = {
    emerald: "#14745f",
    emeraldSoft: "rgba(20, 116, 95, 0.2)",
    amber: "#c96f2b",
    amberSoft: "rgba(201, 111, 43, 0.2)",
    navy: "#16324f",
    grid: "rgba(22, 50, 79, 0.18)",
    text: "#152433",
  };

  let cachePromise = null;

  async function loadData() {
    if (!cachePromise) {
      cachePromise = Promise.all([fetchJson(TEAMS_URL), fetchJson(PLAYERS_URL)]).then(([teamsPayload, playersPayload]) => {
        return buildDataset(teamsPayload, playersPayload);
      });
    }
    return cachePromise;
  }

  function buildDataset(teamsPayload, playersPayload) {
    const standings = Array.isArray(teamsPayload?.standings) ? teamsPayload.standings : [];
    const teamsInfoRaw = Array.isArray(teamsPayload?.data) ? teamsPayload.data : [];
    const playersRaw = Array.isArray(playersPayload?.data) ? playersPayload.data : [];

    const teamsInfo = new Map(
      teamsInfoRaw.map((entry) => [
        String(entry?.slug || ""),
        {
          name: repairText(entry?.name || ""),
          logoUrl: String(entry?.logo_url || ""),
          lastMatch: normalizeFixture(entry?.last_match),
          nextFixture: normalizeFixture(entry?.next_fixture),
          recent: normalizeRecent(entry?.last5_summary),
        },
      ]),
    );

    const competitions = [];
    const clubs = [];
    const clubsBySlug = new Map();
    const clubToCompetition = new Map();

    for (const standing of standings) {
      const compSlug = String(standing?.competition_slug || "");
      const compName = repairText(standing?.competition_name || compSlug || "Competition");
      const competition = {
        slug: compSlug,
        name: compName,
        displayName: compName,
        seasonName: String(standing?.season_name || ""),
        table: [],
      };

      const table = Array.isArray(standing?.table) ? standing.table : [];
      for (const row of table) {
        const clubSlug = String(row?.club_slug || "");
        const info = teamsInfo.get(clubSlug) || {};
        const recent = info.recent || normalizeRecent();
        const club = {
          slug: clubSlug,
          name: repairText(row?.club_name || info.name || prettifySlug(clubSlug)),
          logoUrl: String(row?.logo_url || info.logoUrl || ""),
          competitionSlug: compSlug,
          competitionName: compName,
          seasonName: competition.seasonName,
          rank: toNumber(row?.rank),
          played: toNumber(row?.played),
          points: toNumber(row?.points),
          wins: toNumber(row?.wins),
          draws: toNumber(row?.draws),
          losses: toNumber(row?.losses),
          goalsFor: toNumber(row?.goals_for),
          goalsAgainst: toNumber(row?.goals_against),
          goalDifference: toNumber(row?.goal_difference),
          cleanSheetRate: toNumber(row?.clean_sheet_rate) * 100,
          recent,
          recentPoints: recent.points,
          recentGoalDifference: recent.goalDifference,
          lastMatch: info.lastMatch || null,
          nextFixture: info.nextFixture || null,
        };
        competition.table.push(club);
        clubs.push(club);
        clubsBySlug.set(clubSlug, club);
        clubToCompetition.set(clubSlug, {
          slug: compSlug,
          name: compName,
          seasonName: competition.seasonName,
        });
      }

      competition.table.sort((a, b) => a.rank - b.rank);
      competitions.push(competition);
    }

    competitions.sort((a, b) => a.name.localeCompare(b.name));

    const players = playersRaw
      .map((row) => mapPlayer(row, clubToCompetition, clubsBySlug))
      .filter((player) => player && player.position !== "Coach");

    const playersBySlug = new Map(players.map((player) => [player.slug, player]));
    const playersByClub = new Map();
    const playersByCompetition = new Map();

    for (const player of players) {
      if (!playersByClub.has(player.clubSlug)) {
        playersByClub.set(player.clubSlug, []);
      }
      playersByClub.get(player.clubSlug).push(player);

      if (!playersByCompetition.has(player.competitionSlug)) {
        playersByCompetition.set(player.competitionSlug, []);
      }
      playersByCompetition.get(player.competitionSlug).push(player);
    }

    for (const club of clubs) {
      const clubPlayers = playersByClub.get(club.slug) || [];
      club.nextMatchAvailability = buildNextMatchAvailability(club, clubPlayers);
    }

    return {
      generatedAt: String(teamsPayload?.meta?.generated_at || playersPayload?.meta?.generated_at || ""),
      competitions,
      clubs,
      clubsBySlug,
      players,
      playersBySlug,
      playersByClub,
      playersByCompetition,
      metrics: { player: PLAYER_METRICS, team: TEAM_METRICS, teamRadar: TEAM_RADAR_METRICS },
    };
  }
  function mapPlayer(row, clubToCompetition, clubsBySlug) {
    const season = latestSeason(row?.season_sums || {}, row?.yearly || {});
    const seasonPer90 = toNumberMap(season?.stats_per90 || {});
    const seasonSum = toNumberMap(season?.stats_sum || {});
    const recent = aggregateRecent(Array.isArray(row?.last5_matches) ? row.last5_matches : []);

    const seasonMinutes = numberOr(season?.minutes, season?.minutes_played, seasonSum?.minutes_played, 0);
    const seasonMatches = numberOr(season?.matches_played, seasonSum?.appearances, 0);

    const useSeasonCore = seasonMinutes >= 180 || seasonMatches >= 3;
    const goalsP90 = useSeasonCore ? numberOr(seasonPer90.goals, recent.per90.goals, 0) : numberOr(recent.per90.goals, seasonPer90.goals, 0);
    const assistsP90 = useSeasonCore
      ? numberOr(seasonPer90.assists, recent.per90.assists, 0)
      : numberOr(recent.per90.assists, seasonPer90.assists, 0);

    const passes = numberOr(recent.per90.accurate_pass, seasonPer90.accurate_pass, 0);
    const missed = numberOr(recent.per90.missed_pass, seasonPer90.missed_pass, 0);
    const passAccuracy = passes + missed > 0 ? (passes * 100) / (passes + missed) : 0;

    const clubSlug = String(row?.club_slug || "");
    const club = clubsBySlug.get(clubSlug) || null;
    const competition = clubToCompetition.get(clubSlug) || { slug: "unknown", name: "Hors competition", seasonName: "" };
    const cleanSheets = numberOr(recent.totals.clean_sheet_60, 0);
    const status = normalizePlayerStatus(row?.status);

    return {
      slug: String(row?.slug || ""),
      name: repairText(row?.name || "Joueur"),
      position: normalizePosition(row?.position),
      clubSlug,
      clubName: club?.name || prettifySlug(clubSlug),
      competitionSlug: competition.slug,
      competitionName: competition.name,
      seasonName: competition.seasonName,
      imageUrl: String(row?.player_image_url || ""),
      clubLogoUrl: String(row?.club_logo_url || club?.logoUrl || ""),
      minutes: seasonMinutes > 0 ? seasonMinutes : recent.minutes,
      matches: seasonMatches > 0 ? seasonMatches : recent.matches,
      metrics: {
        goalsP90,
        assistsP90,
        contributionsP90: goalsP90 + assistsP90,
        shotsP90: numberOr(recent.per90.total_scoring_att, seasonPer90.total_scoring_att, 0),
        shotsOnTargetP90: numberOr(recent.per90.ontarget_scoring_att, seasonPer90.ontarget_scoring_att, 0),
        passesP90: passes,
        passAccuracy,
        finalThirdPassesP90: numberOr(recent.per90.successful_final_third_passes, seasonPer90.successful_final_third_passes, 0),
        tacklesWonP90: numberOr(recent.per90.won_tackle, seasonPer90.won_tackle, 0),
        interceptionsP90: numberOr(recent.per90.interception_won, seasonPer90.interception_won, 0),
        duelsWonP90: numberOr(recent.per90.duel_won, seasonPer90.duel_won, 0),
        savesP90: numberOr(recent.per90.saves, seasonPer90.saves, 0),
        goalsConcededP90: numberOr(recent.per90.goals_conceded, seasonPer90.goals_conceded, 0),
        cleanSheetsRate5: recent.matches ? (cleanSheets / recent.matches) * 100 : 0,
      },
      recent,
      recentTrend: recent.timeline,
      status,
      searchText: normalizeText(`${row?.name || ""} ${row?.position || ""} ${club?.name || clubSlug} ${competition.name || ""}`),
    };
  }

  function latestSeason(seasonSums, yearly) {
    const seasonKey = latestSeasonKey(seasonSums);
    if (seasonKey && seasonSums[seasonKey]) {
      return seasonSums[seasonKey];
    }
    const yearlyKey = latestSeasonKey(yearly);
    if (yearlyKey && yearly[yearlyKey]) {
      return yearly[yearlyKey];
    }
    return null;
  }

  function latestSeasonKey(container) {
    const keys = Object.keys(container || {});
    if (!keys.length) {
      return null;
    }
    return keys.sort((a, b) => seasonRank(b) - seasonRank(a))[0];
  }

  function seasonRank(key) {
    const value = String(key || "").trim();
    const match = value.match(/^(\d{4})\s*[/-]\s*(\d{4})$/);
    if (match) {
      return Number(match[1]) * 10000 + Number(match[2]);
    }
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
    const dateValue = Date.parse(value);
    return Number.isNaN(dateValue) ? 0 : dateValue;
  }

  function aggregateRecent(matches) {
    const totals = {};
    const per90 = {};
    const timeline = [];
    let minutes = 0;

    for (const match of matches) {
      const stats = toNumberMap(match?.stats || {});
      const extra = toNumberMap(match?.stats_extra || {});
      const matchMinutes = numberOr(match?.minutes_played, stats?.mins_played, 0);
      minutes += matchMinutes;

      for (const [key, value] of Object.entries(stats)) {
        totals[key] = numberOr(totals[key], 0) + numberOr(value, 0);
      }
      for (const [key, value] of Object.entries(extra)) {
        totals[key] = numberOr(totals[key], 0) + numberOr(value, 0);
      }

      const scoreIndex = Math.max(
        0,
        numberOr(stats.goals, 0) * 4 +
          numberOr(stats.assists, 0) * 3 +
          numberOr(stats.ontarget_scoring_att, 0) * 1.1 +
          numberOr(stats.successful_final_third_passes, 0) * 0.07 +
          numberOr(stats.won_tackle, 0) * 0.2 +
          numberOr(stats.interception_won, 0) * 0.2 +
          numberOr(stats.duel_won, 0) * 0.12 +
          numberOr(extra.saves, 0) * 0.9 -
          numberOr(extra.goals_conceded, 0) * 1.1,
      );

      timeline.push({
        date: String(match?.date || ""),
        minutes: matchMinutes,
        goals: numberOr(stats.goals, 0),
        assists: numberOr(stats.assists, 0),
        scoreIndex,
      });
    }

    const factor = minutes > 0 ? 90 / minutes : 0;
    for (const [key, value] of Object.entries(totals)) {
      per90[key] = numberOr(value, 0) * factor;
    }

    timeline.sort((a, b) => Date.parse(a.date || "") - Date.parse(b.date || ""));

    return { totals, per90, timeline, minutes, matches: matches.length };
  }

  function normalizeRecent(input = {}) {
    return {
      matches: toNumber(input.matches),
      wins: toNumber(input.wins),
      draws: toNumber(input.draws),
      losses: toNumber(input.losses),
      points: toNumber(input.points),
      goalsFor: toNumber(input.goals_for),
      goalsAgainst: toNumber(input.goals_against),
      goalDifference: toNumber(input.goal_difference),
      cleanSheetRate: toNumber(input.clean_sheet_rate) * 100,
    };
  }

  function normalizeFixture(fixture) {
    if (!fixture) {
      return null;
    }
    return {
      date: String(fixture.date || fixture.match_date || fixture.kickoff_at || fixture.kickoff || ""),
      opponentSlug: String(fixture.opponent_slug || fixture.opponentSlug || fixture?.opponent?.slug || ""),
      homeAway: String(fixture.home_away || fixture.homeAway || fixture.venue || ""),
      score: String(fixture.score || fixture.result || ""),
    };
  }

  function normalizePlayerStatus(status) {
    const injuries = Array.isArray(status?.active_injuries) ? status.active_injuries.map((entry) => normalizeInjury(entry)).filter(Boolean) : [];
    const suspensions = Array.isArray(status?.active_suspensions)
      ? status.active_suspensions.map((entry) => normalizeSuspension(entry)).filter(Boolean)
      : [];

    const current = String(status?.current || "").toLowerCase();
    const isInjured = toBoolean(status?.is_injured) || current === "injured";
    const isSuspended = toBoolean(status?.is_suspended) || current === "suspended";

    return {
      current: current || (isInjured ? "injured" : isSuspended ? "suspended" : "available"),
      isInjured,
      isSuspended,
      isRedCardSuspension: toBoolean(status?.is_red_card_suspension),
      activeInjuries: injuries,
      activeSuspensions: suspensions,
    };
  }

  function normalizeInjury(injury) {
    if (!injury) {
      return null;
    }
    return {
      id: String(injury.id || ""),
      kind: repairText(injury.kind || injury.type || ""),
      status: repairText(injury.status || ""),
      details: repairText(injury.details || ""),
      startDate: String(injury.start_date || injury.startDate || ""),
      expectedEndDate: String(injury.expected_end_date || injury.end_date || injury.expectedEndDate || ""),
    };
  }

  function normalizeSuspension(suspension) {
    if (!suspension) {
      return null;
    }
    return {
      id: String(suspension.id || ""),
      reason: repairText(suspension.reason || ""),
      kind: repairText(suspension.kind || ""),
      matches: toNumber(suspension.matches),
      startDate: String(suspension.start_date || suspension.startDate || ""),
      endDate: String(suspension.end_date || suspension.endDate || ""),
      competitionSlug: String(suspension.competition_slug || suspension.competitionSlug || ""),
      competitionName: repairText(suspension.competition_name || suspension.competitionName || ""),
    };
  }

  function buildNextMatchAvailability(club, players) {
    const fixtureDate = String(club?.nextFixture?.date || "");
    const competitionSlug = String(club?.competitionSlug || "");

    if (!fixtureDate) {
      return { injured: [], suspended: [], total: 0 };
    }

    const injured = [];
    const suspended = [];

    for (const player of players || []) {
      const status = player?.status || null;
      if (!status) {
        continue;
      }

      if (status.isInjured) {
        const injury = selectInjuryForFixture(status.activeInjuries, fixtureDate);
        if (injury) {
          injured.push({
            slug: player.slug,
            name: player.name,
            position: player.position,
            reason: injury.kind || injury.details || "",
            returnDate: injury.expectedEndDate || "",
          });
        }
      }

      if (status.isSuspended) {
        const suspension = selectSuspensionForFixture(status.activeSuspensions, fixtureDate, competitionSlug);
        if (suspension) {
          suspended.push({
            slug: player.slug,
            name: player.name,
            position: player.position,
            reason: suspension.reason || suspension.kind || "",
            matches: suspension.matches,
            endDate: suspension.endDate || "",
          });
        }
      }
    }

    injured.sort((a, b) => a.name.localeCompare(b.name));
    suspended.sort((a, b) => a.name.localeCompare(b.name));

    return {
      injured,
      suspended,
      total: injured.length + suspended.length,
    };
  }

  function selectInjuryForFixture(injuries, fixtureDate) {
    if (!Array.isArray(injuries) || !injuries.length) {
      return {};
    }

    const dated = injuries.find((entry) => isDateInRange(fixtureDate, entry.startDate, entry.expectedEndDate));
    if (dated) {
      return dated;
    }

    if (!fixtureDate) {
      return injuries[0];
    }

    const withoutDates = injuries.find((entry) => !entry.startDate && !entry.expectedEndDate);
    return withoutDates || null;
  }

  function selectSuspensionForFixture(suspensions, fixtureDate, competitionSlug) {
    if (!Array.isArray(suspensions) || !suspensions.length) {
      return {};
    }

    const competitionScoped = suspensions.filter((entry) => !entry.competitionSlug || !competitionSlug || entry.competitionSlug === competitionSlug);
    const pool = competitionScoped.length ? competitionScoped : suspensions;

    const dated = pool.find((entry) => isDateInRange(fixtureDate, entry.startDate, entry.endDate));
    if (dated) {
      return dated;
    }

    if (!fixtureDate) {
      return pool[0];
    }

    const withoutDates = pool.find((entry) => !entry.startDate && !entry.endDate);
    return withoutDates || null;
  }

  function isDateInRange(targetDate, startDate, endDate) {
    if (!targetDate) {
      return true;
    }

    const target = toTimestamp(targetDate);
    if (target === null) {
      return true;
    }

    const start = toTimestamp(startDate);
    if (start !== null && target < start) {
      return false;
    }

    const end = toTimestamp(endDate);
    if (end !== null && target > end) {
      return false;
    }

    return true;
  }

  function toTimestamp(value) {
    if (!value) {
      return null;
    }
    const parsed = Date.parse(String(value));
    return Number.isNaN(parsed) ? null : parsed;
  }

  function normalizePosition(position) {
    const value = repairText(String(position || "Unknown"));
    if (["Goalkeeper", "Defender", "Midfielder", "Forward", "Coach"].includes(value)) {
      return value;
    }
    return "Unknown";
  }

  function getMetricDefinition(kind, metricId) {
    const source = kind === "team" ? TEAM_METRICS : PLAYER_METRICS;
    return source.find((metric) => metric.id === metricId) || null;
  }

  function getMetricValue(item, metricId) {
    if (!item) {
      return 0;
    }
    if (Object.prototype.hasOwnProperty.call(item, metricId)) {
      return toNumber(item[metricId]);
    }
    if (item.metrics && Object.prototype.hasOwnProperty.call(item.metrics, metricId)) {
      return toNumber(item.metrics[metricId]);
    }
    return 0;
  }

  function formatMetric(kind, metricId, value) {
    const metric = getMetricDefinition(kind, metricId);
    if (!metric) {
      return formatNumber(value, 2);
    }
    return `${formatNumber(value, metric.decimals)}${metric.suffix || ""}`;
  }

  function getPositionProfile(position) {
    return POSITION_PROFILES[position] || POSITION_PROFILES.default;
  }

  function normalizeForRadar(items, metricIds, getter = getMetricValue) {
    const ranges = new Map();
    for (const metricId of metricIds) {
      const values = items.map((item) => toNumber(getter(item, metricId)));
      ranges.set(metricId, { min: Math.min(...values), max: Math.max(...values) });
    }

    return {
      normalizeValue(metricId, rawValue, invert = false) {
        const range = ranges.get(metricId) || { min: 0, max: 1 };
        const span = range.max - range.min;
        if (span <= 0) {
          return 0.5;
        }
        if (invert) {
          return clamp((range.max - rawValue) / span, 0, 1);
        }
        return clamp((rawValue - range.min) / span, 0, 1);
      },
    };
  }
  function drawRadarChart(canvas, config) {
    if (!canvas || !config || !Array.isArray(config.axes) || !Array.isArray(config.datasets) || !config.axes.length) {
      return;
    }

    const prepared = prepareCanvas(canvas);
    if (!prepared) {
      return;
    }

    const { ctx, width, height } = prepared;
    const axisCount = config.axes.length;
    const levels = 5;
    const startAngle = -Math.PI / 2;
    const step = (Math.PI * 2) / axisCount;
    const center = { x: width / 2, y: height / 2 };
    const radius = Math.min(width, height) * 0.34;

    ctx.save();
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;

    for (let level = 1; level <= levels; level += 1) {
      const ratio = level / levels;
      ctx.beginPath();
      for (let i = 0; i < axisCount; i += 1) {
        const p = polar(center, radius * ratio, startAngle + i * step);
        if (i === 0) {
          ctx.moveTo(p.x, p.y);
        } else {
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.closePath();
      ctx.stroke();
    }

    for (let i = 0; i < axisCount; i += 1) {
      const p = polar(center, radius, startAngle + i * step);
      ctx.beginPath();
      ctx.moveTo(center.x, center.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }

    ctx.fillStyle = COLORS.text;
    ctx.font = "600 12px 'Plus Jakarta Sans', 'Segoe UI', sans-serif";
    for (let i = 0; i < axisCount; i += 1) {
      const p = polar(center, radius + 16, startAngle + i * step);
      ctx.textAlign = p.x < center.x - 8 ? "right" : p.x > center.x + 8 ? "left" : "center";
      ctx.textBaseline = p.y < center.y - 8 ? "bottom" : p.y > center.y + 8 ? "top" : "middle";
      ctx.fillText(config.axes[i], p.x, p.y);
    }

    for (const dataset of config.datasets) {
      const points = dataset.values.map((value, i) => polar(center, radius * clamp(numberOr(value, 0), 0, 1), startAngle + i * step));
      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      ctx.closePath();
      ctx.fillStyle = dataset.fill || COLORS.emeraldSoft;
      ctx.strokeStyle = dataset.color || COLORS.emerald;
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();

      for (const point of points) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 2.8, 0, Math.PI * 2);
        ctx.fillStyle = dataset.color || COLORS.emerald;
        ctx.fill();
      }
    }

    ctx.restore();
  }

  function drawLineChart(canvas, values, options = {}) {
    if (!canvas || !Array.isArray(values) || !values.length) {
      return;
    }

    const prepared = prepareCanvas(canvas);
    if (!prepared) {
      return;
    }

    const { ctx, width, height } = prepared;
    const padding = 24;
    const innerWidth = width - padding * 2;
    const innerHeight = height - padding * 2;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;

    ctx.save();
    ctx.strokeStyle = "rgba(22, 50, 79, 0.15)";
    for (let i = 0; i <= 4; i += 1) {
      const y = padding + (innerHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    const points = values.map((value, i) => {
      const x = padding + (innerWidth * i) / Math.max(1, values.length - 1);
      const y = padding + innerHeight - ((value - min) / span) * innerHeight;
      return { x, y };
    });

    const stroke = options.stroke || COLORS.emerald;
    const fill = options.fill || COLORS.emeraldSoft;

    ctx.beginPath();
    points.forEach((point, i) => {
      if (i === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.beginPath();
    points.forEach((point, i) => {
      if (i === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.lineTo(points[points.length - 1].x, padding + innerHeight);
    ctx.lineTo(points[0].x, padding + innerHeight);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();

    ctx.restore();
  }

  function drawBarChart(canvas, labels, values, options = {}) {
    if (!canvas || !Array.isArray(values) || !values.length) {
      return;
    }

    const prepared = prepareCanvas(canvas);
    if (!prepared) {
      return;
    }

    const { ctx, width, height } = prepared;
    const padding = 18;
    const max = Math.max(...values, 1);
    const gap = 14;
    const totalWidth = width - padding * 2;
    const barWidth = (totalWidth - gap * (values.length - 1)) / values.length;
    const usableHeight = height - padding * 2 - 18;
    const palette = options.palette || [COLORS.emerald, COLORS.amber, COLORS.navy];

    ctx.save();
    ctx.font = "600 11px 'Plus Jakarta Sans', 'Segoe UI', sans-serif";
    ctx.textAlign = "center";

    for (let i = 0; i < values.length; i += 1) {
      const value = values[i];
      const ratio = value / max;
      const h = Math.max(2, usableHeight * ratio);
      const x = padding + i * (barWidth + gap);
      const y = height - padding - h - 18;

      ctx.fillStyle = palette[i % palette.length];
      ctx.fillRect(x, y, barWidth, h);

      ctx.fillStyle = COLORS.text;
      ctx.fillText(String(value), x + barWidth / 2, y - 4);
      ctx.fillStyle = "rgba(21, 36, 51, 0.7)";
      ctx.fillText(String(labels[i] || ""), x + barWidth / 2, height - padding);
    }

    ctx.restore();
  }

  function prepareCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return null;
    }

    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const targetW = Math.floor(rect.width * ratio);
    const targetH = Math.floor(rect.height * ratio);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    return { ctx, width: rect.width, height: rect.height };
  }

  function polar(center, radius, angle) {
    return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
  }

  function getQueryParams() {
    return new URLSearchParams(window.location.search);
  }

  function buildUrl(path, paramsObj = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(paramsObj)) {
      if (value === null || value === undefined || value === "") {
        continue;
      }
      params.set(key, String(value));
    }
    const query = params.toString();
    return query ? `${path}?${query}` : path;
  }

  function updateUrlQuery(params) {
    const search = params.toString() ? `?${params.toString()}` : "";
    if (window.location.search !== search) {
      window.history.replaceState(null, "", `${window.location.pathname}${search}`);
    }
  }
  function rankValue(target, pool, valueAccessor, descending = true) {
    if (!target || !Array.isArray(pool) || !pool.length) {
      return null;
    }

    const sorted = [...pool].sort((a, b) => {
      const left = numberOr(valueAccessor(a), 0);
      const right = numberOr(valueAccessor(b), 0);
      if (left === right) {
        return String(a.slug || "").localeCompare(String(b.slug || ""));
      }
      return descending ? right - left : left - right;
    });

    const idx = sorted.findIndex((entry) => entry.slug === target.slug);
    return idx >= 0 ? idx + 1 : null;
  }

  function percentile(value, values, higherIsBetter = true) {
    const clean = values.map((v) => toNumber(v)).filter((v) => Number.isFinite(v));
    if (!clean.length) {
      return 0;
    }

    const count = higherIsBetter ? clean.filter((v) => v <= value).length : clean.filter((v) => v >= value).length;
    return (count / clean.length) * 100;
  }

  function getCompetition(dataset, slug) {
    return dataset.competitions.find((competition) => competition.slug === slug) || null;
  }

  function formatFixture(fixture, clubsBySlug) {
    if (!fixture) {
      return "Aucune information";
    }
    const opponent = clubsBySlug?.get(fixture.opponentSlug)?.name || prettifySlug(fixture.opponentSlug || "");
    const where = fixture.homeAway === "home" ? "domicile" : fixture.homeAway === "away" ? "exterieur" : "-";
    const score = fixture.score ? ` | ${fixture.score}` : "";
    return `${formatDate(fixture.date)} | ${where} vs ${opponent}${score}`;
  }

  function formatDate(dateValue) {
    if (!dateValue) {
      return "-";
    }
    const date = new Date(dateValue);
    if (Number.isNaN(date.valueOf())) {
      return String(dateValue);
    }
    return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  }

  function formatDateTime(dateValue) {
    if (!dateValue) {
      return "-";
    }
    const date = new Date(dateValue);
    if (Number.isNaN(date.valueOf())) {
      return String(dateValue);
    }
    return date.toLocaleString("fr-FR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatNumber(value, digits = 0) {
    return toNumber(value).toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
  }

  function toNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function toBoolean(value) {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "number") {
      return value !== 0;
    }

    const normalized = String(value || "")
      .trim()
      .toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }

  function numberOr(...values) {
    for (const value of values) {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) {
        return numeric;
      }
    }
    return 0;
  }

  function toNumberMap(input) {
    const output = {};
    for (const [key, value] of Object.entries(input || {})) {
      output[key] = numberOr(value, 0);
    }
    return output;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function repairText(input) {
    const raw = String(input || "");
    if (!/[ÃƒÆ’Ãƒâ€š]/.test(raw)) {
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

  function prettifySlug(slug) {
    return repairText(
      String(slug || "")
        .replaceAll("-", " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (part) => part.toUpperCase()),
    );
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Impossible de charger ${url} (${response.status})`);
    }
    return response.json();
  }

  function debounce(callback, waitMs) {
    let timeout = null;
    return (...args) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => callback(...args), waitMs);
    };
  }

  window.FootballData = {
    loadData,
    colors: COLORS,
    metrics: { player: PLAYER_METRICS, team: TEAM_METRICS, teamRadar: TEAM_RADAR_METRICS },
    getCompetition,
    getMetricDefinition,
    getMetricValue,
    formatMetric,
    getPositionProfile,
    normalizeForRadar,
    drawRadarChart,
    drawLineChart,
    drawBarChart,
    getQueryParams,
    buildUrl,
    updateUrlQuery,
    rankValue,
    percentile,
    formatFixture,
    formatDate,
    formatDateTime,
    formatNumber,
    normalizeText,
    prettifySlug,
    repairText,
    escapeHtml,
    numberOr,
    clamp,
    debounce,
  };
})();
