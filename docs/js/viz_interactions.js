(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WatchNextViz = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const metricConfig = {
    weighted_rating: {
      label: "Weighted Average Rating",
      description: "Vote-count-weighted average of TMDB movie ratings",
      semantic: ["Lower rating", "Higher rating"],
      interpolator: "interpolateYlGnBu",
    },
    total_votes: {
      label: "Total Vote Count",
      description: "Total TMDB vote count for movies in the cell",
      semantic: ["Fewer votes", "More votes"],
      interpolator: "interpolateBlues",
    },
    movie_count: {
      label: "Number of Movies",
      description: "Number of movies in the genre-year cell",
      semantic: ["Fewer movies", "More movies"],
      interpolator: "interpolatePurples",
    },
  };

  function movieIdSetForGenre(link, genre, moviesById) {
    return (link.movies || []).filter((movieId) => {
      if (genre === "All") return true;
      const movie = moviesById.get(+movieId);
      return Boolean(movie && Array.isArray(movie.genres) && movie.genres.includes(genre));
    });
  }

  function countSharedMovies(link, genre, moviesById) {
    const movieIds = movieIdSetForGenre(link, genre, moviesById);
    return { count: movieIds.length, movieIds };
  }

  function endpointId(endpoint) {
    return typeof endpoint === "object" ? endpoint.id : endpoint;
  }

  function filterCollaborationGraph(links, genre, threshold, moviesById) {
    const filteredLinks = links
      .map((link) => {
        const result = countSharedMovies(link, genre, moviesById);
        return {
          ...link,
          source: endpointId(link.source),
          target: endpointId(link.target),
          filtered_count: result.count,
          filtered_movies: result.movieIds,
        };
      })
      .filter((link) => link.filtered_count >= threshold);

    const nodeIds = new Set();
    filteredLinks.forEach((link) => {
      nodeIds.add(link.source);
      nodeIds.add(link.target);
    });
    return { links: filteredLinks, nodeIds };
  }

  function selectionSurvives(selectedId, visibleNodeIds) {
    return Boolean(selectedId && visibleNodeIds.has(selectedId));
  }

  function formatMetricValue(metric, value) {
    if (value == null || !Number.isFinite(+value)) return "No data";
    if (metric === "weighted_rating") return (+value).toFixed(2);
    return Math.round(+value).toLocaleString("en-US");
  }

  function placeLabels(labels, width, height) {
    const padding = 4;
    const occupied = labels.map((label) => ({
      x: label.x - label.radius - 2,
      y: label.y - label.radius - 2,
      width: label.radius * 2 + 4,
      height: label.radius * 2 + 4,
    }));
    const placements = new Map();
    const overlaps = (candidate) => occupied.some((box) =>
      candidate.x < box.x + box.width && candidate.x + candidate.width > box.x
      && candidate.y < box.y + box.height && candidate.y + candidate.height > box.y
    );

    labels.forEach((label) => {
      const labelWidth = Math.max(24, String(label.name || "").length * 5.65 + 3);
      const labelHeight = 12;
      const candidates = [];
      [0, 8, 16, 26, 38].forEach((extra) => {
        const gap = label.radius + 5 + extra;
        candidates.push(
          { x: label.x + gap, y: label.y - labelHeight / 2, width: labelWidth, height: labelHeight },
          { x: label.x - gap - labelWidth, y: label.y - labelHeight / 2, width: labelWidth, height: labelHeight },
          { x: label.x - labelWidth / 2, y: label.y - gap - labelHeight, width: labelWidth, height: labelHeight },
          { x: label.x - labelWidth / 2, y: label.y + gap, width: labelWidth, height: labelHeight }
        );
      });
      const placement = candidates.find((candidate) =>
        candidate.x >= padding && candidate.y >= padding
        && candidate.x + candidate.width <= width - padding
        && candidate.y + candidate.height <= height - padding
        && !overlaps(candidate)
      ) || {
        x: Math.max(padding, Math.min(width - padding - labelWidth, label.x + label.radius + 5)),
        y: Math.max(padding, Math.min(height - padding - labelHeight, label.y - labelHeight / 2)),
        width: labelWidth,
        height: labelHeight,
      };
      occupied.push(placement);
      placements.set(label.id, placement);
    });
    return placements;
  }

  function restoreNodePositions(nodes) {
    nodes.forEach((node) => {
      node.x = node.defaultX;
      node.y = node.defaultY;
    });
  }

  function networkLinkStyle(link, state = {}) {
    if (!state.visible) return { color: "#31506a", opacity: 0 };
    const touches = (personId) => personId && (
      endpointId(link.source) === personId || endpointId(link.target) === personId
    );
    if (touches(state.selectedId)) return { color: "#58c7f3", opacity: 1 };
    if (state.selectedId) return { color: "#31506a", opacity: 0.1 };
    if (touches(state.hoveredId)) return { color: "#79cfff", opacity: 0.96 };
    return { color: "#58a6ff", opacity: 0.78 };
  }

  function networkEdgeWidth(sharedMovies, maximumSharedMovies) {
    const minimum = 1.8;
    const maximum = 6.8;
    if (+maximumSharedMovies <= 3) return minimum;
    const ratio = Math.max(0, Math.min(1, (+sharedMovies - 3) / (+maximumSharedMovies - 3)));
    return minimum + ratio * (maximum - minimum);
  }

  function heatmapTransitionDelay(year, genreIndex) {
    return Math.max(0, (+year - 2016) * 18 + Math.max(0, +genreIndex || 0) * 3);
  }

  function motionDuration(duration, reducedMotion) {
    return reducedMotion ? 0 : duration;
  }

  function runWhenVisible(element, callback, reducedMotion = false, Observer = globalThis.IntersectionObserver) {
    let completed = false;
    const runOnce = () => {
      if (completed) return;
      completed = true;
      callback();
    };
    if (reducedMotion || typeof Observer !== "function") {
      runOnce();
      return null;
    }
    const observer = new Observer((entries) => {
      if (completed) return;
      if (!entries.some((entry) => entry.target === element && entry.isIntersecting)) return;
      observer.disconnect();
      runOnce();
    }, { threshold: 0.16 });
    observer.observe(element);
    return observer;
  }

  function assignCommunityColorFamilies(communityIds, links, familyCount = 7) {
    const ids = [...communityIds].map(String);
    const count = Math.max(1, Math.floor(+familyCount || 1));
    const neighbors = new Map(ids.map((id) => [id, new Set()]));
    const endpointId = (endpoint) => String(endpoint?.id ?? endpoint);
    (links || []).forEach((link) => {
      const source = endpointId(link.source);
      const target = endpointId(link.target);
      if (source === target || !neighbors.has(source) || !neighbors.has(target)) return;
      neighbors.get(source).add(target);
      neighbors.get(target).add(source);
    });

    const ordered = ids.slice().sort((a, b) => neighbors.get(b).size - neighbors.get(a).size || a.localeCompare(b));
    const assignments = new Map();
    const usage = Array.from({ length: count }, () => 0);
    ordered.forEach((id) => {
      const neighborFamilies = [...neighbors.get(id)].map((neighbor) => assignments.get(neighbor)).filter(Number.isInteger);
      const family = chooseColorFamily(neighborFamilies, usage, count);
      assignments.set(id, family);
      usage[family] += 1;
    });
    return assignments;
  }

  function chooseColorFamily(neighborFamilies, usage, familyCount) {
    let bestFamily = 0;
    let bestScore = Infinity;
    for (let family = 0; family < familyCount; family += 1) {
      const conflicts = neighborFamilies.filter((neighborFamily) => neighborFamily === family).length;
      const score = conflicts * 1000 + usage[family] * 10 + family;
      if (score < bestScore) {
        bestScore = score;
        bestFamily = family;
      }
    }
    return bestFamily;
  }

  function communityNodeColor(index, familyIndex = null) {
    const distinctFamilies = [5, 95, 25, 150, 60, 345, 125];
    const colorIndex = Math.max(0, Math.floor(+index || 0));
    const resolvedFamily = familyIndex == null
      ? colorIndex % distinctFamilies.length
      : ((Math.floor(+familyIndex || 0) % distinctFamilies.length) + distinctFamilies.length) % distinctFamilies.length;
    const hue = distinctFamilies[resolvedFamily];
    const saturation = 64 + (colorIndex % 3) * 7;
    const lightness = 51 + (colorIndex % 20) * 1.1 + Math.floor(colorIndex / 20) * 0.12;
    return `hsl(${hue} ${saturation}% ${lightness}%)`;
  }

  function nodeHitRadius(visibleRadius) {
    return Math.max(14, (+visibleRadius || 0) + 6);
  }

  function nodeSymbolPath(role, radius) {
    const r = Math.max(1, +radius || 1);
    if (String(role).toLowerCase() !== "director") {
      return `M${r},0A${r},${r} 0 1 1 ${-r},0A${r},${r} 0 1 1 ${r},0Z`;
    }
    const corner = Math.max(1.4, r * 0.24);
    const edge = r - corner;
    return `M${corner},${-edge}Q0,${-r} ${-corner},${-edge}`
      + `L${-edge},${-corner}Q${-r},0 ${-edge},${corner}`
      + `L${-corner},${edge}Q0,${r} ${corner},${edge}`
      + `L${edge},${corner}Q${r},0 ${edge},${-corner}Z`;
  }

  function networkZoomAllowed(event = {}) {
    if (event.isNodeHit) return false;
    if (event.button) return false;
    return !event.ctrlKey || event.type === "wheel";
  }

  return {
    countSharedMovies,
    filterCollaborationGraph,
    selectionSurvives,
    metricConfig,
    formatMetricValue,
    placeLabels,
    restoreNodePositions,
    networkLinkStyle,
    networkEdgeWidth,
    heatmapTransitionDelay,
    motionDuration,
    runWhenVisible,
    communityNodeColor,
    assignCommunityColorFamilies,
    nodeHitRadius,
    nodeSymbolPath,
    networkZoomAllowed,
  };
});
