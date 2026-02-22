const ROUTES = new Set([
  "home",
  "players",
  "favorites",
  "compare",
  "leaderboards",
  "clubs",
  "learn",
  "settings",
  "player",
  "club",
]);

function decodeSegment(segment) {
  try {
    return decodeURIComponent(segment || "");
  } catch (_error) {
    return segment || "";
  }
}

export function parseHash(hashValue) {
  const raw = (hashValue || "").replace(/^#\/?/, "");
  if (!raw) {
    return { name: "home", params: {} };
  }

  const cleanPart = raw.split("?")[0];
  const segments = cleanPart.split("/").filter(Boolean).map(decodeSegment);

  if (segments[0] === "player" && segments[1]) {
    return { name: "player", params: { slug: segments[1] } };
  }
  if (segments[0] === "club" && segments[1] && segments[2]) {
    return {
      name: "club",
      params: { competitionSlug: segments[1], slug: segments[2] },
    };
  }
  if (ROUTES.has(segments[0])) {
    return { name: segments[0], params: {} };
  }
  return { name: "home", params: {}, notFound: true };
}

export function createRouter(onChange) {
  const handleChange = () => {
    onChange(parseHash(window.location.hash));
  };
  window.addEventListener("hashchange", handleChange);
  handleChange();

  return {
    navigate(path) {
      const normalized = path.startsWith("/") ? path : `/${path}`;
      const nextHash = `#${normalized}`;
      if (window.location.hash !== nextHash) {
        window.location.hash = nextHash;
      } else {
        handleChange();
      }
    },
    destroy() {
      window.removeEventListener("hashchange", handleChange);
    },
  };
}
