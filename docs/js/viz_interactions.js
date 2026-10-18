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

  const heatmapReadingGuides = {
    weighted_rating: {
      title: "Weighted average rating",
      meaning: "Each cell shows the vote-count-weighted average of TMDB movie ratings for one genre and release year.",
      lookFor: "rows and years; the outlined row marks the highest-rated genre across complete years.",
      caveat: "Movies with more TMDB votes have more influence on the cell average.",
    },
    total_votes: {
      title: "Total vote count",
      meaning: "Each cell shows voting activity as the total TMDB vote count received by movies in one genre and release year.",
      lookFor: "rows and years to find where voting activity is highest; the outlined row marks the genre with the most votes.",
      caveat: "Vote count measures voting activity, not the total size of a movie's audience.",
    },
    movie_count: {
      title: "Number of movies",
      meaning: "Each cell shows the number of movies that belong to one genre and release year in this dataset.",
      lookFor: "rows and years to see how the dataset's genre mix changes; the outlined row marks the genre with the most movies.",
      caveat: "Movies with multiple genres contribute to every relevant genre row.",
    },
  };

  function heatmapReadingGuide(metric) {
    return heatmapReadingGuides[metric] || heatmapReadingGuides.weighted_rating;
  }

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

  function careerYearDomain(years, padding = 1) {
    const numericYears = (years || []).map(Number).filter(Number.isFinite);
    if (!numericYears.length) return [0, 1];
    const first = Math.min(...numericYears);
    const last = Math.max(...numericYears);
    const buffer = Math.max(1, +padding || 0);
    return [first - buffer, last + buffer];
  }

  function careerTrendPoints(movies) {
    const ratingsByYear = new Map();
    (movies || []).forEach((movie) => {
      const year = +movie.year;
      const rating = +movie.vote_average;
      if (!Number.isFinite(year) || !Number.isFinite(rating)) return;
      if (!ratingsByYear.has(year)) ratingsByYear.set(year, []);
      ratingsByYear.get(year).push(rating);
    });
    return [...ratingsByYear.entries()]
      .sort(([yearA], [yearB]) => yearA - yearB)
      .map(([year, ratings]) => ({
        year,
        vote_average: ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length,
        movie_count: ratings.length,
      }));
  }

  function careerGenreProfiles(movies, limit = 6) {
    const profiles = new Map();
    (movies || []).forEach((movie) => {
      const genres = [...new Set((movie.genres || []).filter(Boolean))];
      genres.forEach((genre) => {
        if (!profiles.has(genre)) {
          profiles.set(genre, {
            genre,
            movie_count: 0,
            rating_total: 0,
            total_votes: 0,
            revenues: [],
          });
        }
        const profile = profiles.get(genre);
        const rating = +movie.vote_average;
        const votes = Math.max(0, +movie.vote_count || 0);
        const revenue = +movie.revenue || 0;
        profile.movie_count += 1;
        if (Number.isFinite(rating) && votes > 0) {
          profile.rating_total += rating * votes;
          profile.total_votes += votes;
        }
        if (revenue > 0) profile.revenues.push(revenue);
      });
    });

    return [...profiles.values()]
      .map((profile) => {
        const revenues = profile.revenues.slice().sort((a, b) => a - b);
        const middle = Math.floor(revenues.length / 2);
        const medianRevenue = !revenues.length ? 0 : revenues.length % 2
          ? revenues[middle]
          : (revenues[middle - 1] + revenues[middle]) / 2;
        return {
          genre: profile.genre,
          movie_count: profile.movie_count,
          weighted_rating: profile.total_votes ? profile.rating_total / profile.total_votes : 0,
          total_votes: profile.total_votes,
          median_revenue: medianRevenue,
          reported_revenue_count: revenues.length,
        };
      })
      .sort((a, b) => b.movie_count - a.movie_count
        || b.weighted_rating - a.weighted_rating
        || a.genre.localeCompare(b.genre))
      .slice(0, Math.max(1, +limit || 6));
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
      node.vx = 0;
      node.vy = 0;
      node.fx = null;
      node.fy = null;
    });
  }

  function networkLinkStyle(link, state = {}) {
    if (!state.visible) return { color: "#555c60", opacity: 0 };
    const touches = (personId) => personId && (
      endpointId(link.source) === personId || endpointId(link.target) === personId
    );
    if (touches(state.selectedId)) return { color: "#f2cf7a", opacity: 1 };
    if (state.selectedId) return { color: "#555c60", opacity: 0.06 };
    if (touches(state.hoveredId)) return { color: "#e8c47d", opacity: 0.9 };
    return { color: "#b8afa0", opacity: 0.46 };
  }

  function networkNodeStyle(state = {}) {
    if (!state.visible) {
      return { fillOpacity: 0, stroke: "#777a79", strokeWidth: 0.65, insetOpacity: 0, haloOpacity: 0 };
    }
    if (state.focused && state.related === false) {
      return { fillOpacity: 0.1, stroke: "#777a79", strokeWidth: 0.65, insetOpacity: 0.05, haloOpacity: 0 };
    }
    if (state.selected) {
      return { fillOpacity: 1, stroke: "#f2cf7a", strokeWidth: 2.1, insetOpacity: 0.46, haloOpacity: 0.88 };
    }
    if (state.hovered) {
      return { fillOpacity: 1, stroke: "#f3eadb", strokeWidth: 1.45, insetOpacity: 0.42, haloOpacity: 0.48 };
    }
    return { fillOpacity: 0.9, stroke: "#ddd7cc", strokeWidth: 0.75, insetOpacity: 0.34, haloOpacity: 0 };
  }

  function networkEdgeWidth(sharedMovies, maximumSharedMovies) {
    const minimum = 1.35;
    const maximum = 5.3;
    if (+maximumSharedMovies <= 3) return minimum;
    const ratio = Math.max(0, Math.min(1, (+sharedMovies - 3) / (+maximumSharedMovies - 3)));
    return minimum + ratio * (maximum - minimum);
  }

  function collaborationLinkDistance(sharedMovies) {
    return Math.max(34, 70 - Math.max(0, (+sharedMovies || 0) - 3) * 5.2);
  }

  function collaborationLinkStrength(sharedMovies) {
    return Math.min(0.82, 0.34 + Math.max(0, (+sharedMovies || 0) - 3) * 0.065);
  }

  function collaborationChargeStrength(visibleNodeCount) {
    return Math.max(-48, -22 - Math.sqrt(Math.max(1, +visibleNodeCount || 1)) * 1.25);
  }

  function visibleMoviesForCell(movies, expanded, limit = 6) {
    const sorted = [...(movies || [])].sort((a, b) =>
      (+b.vote_count || 0) - (+a.vote_count || 0)
      || (+b.vote_average || 0) - (+a.vote_average || 0)
      || String(a.title || "").localeCompare(String(b.title || ""))
    );
    return expanded ? sorted : sorted.slice(0, Math.max(0, +limit || 0));
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
    // Order the families by perceptual distance so neighboring network
    // communities reach a contrasting family before a related hue.
    const distinctFamilies = [5, 150, 45, 345, 95, 25, 125];
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
    heatmapReadingGuide,
    formatMetricValue,
    careerYearDomain,
    careerTrendPoints,
    careerGenreProfiles,
    placeLabels,
    restoreNodePositions,
    networkLinkStyle,
    networkNodeStyle,
    networkEdgeWidth,
    collaborationLinkDistance,
    collaborationLinkStrength,
    collaborationChargeStrength,
    visibleMoviesForCell,
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
