const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  countSharedMovies,
  filterCollaborationGraph,
  selectionSurvives,
  metricConfig,
  formatMetricValue,
  placeLabels,
  restoreNodePositions,
  networkLinkStyle,
  heatmapTransitionDelay,
  motionDuration,
  networkEdgeWidth,
  communityNodeColor,
  assignCommunityColorFamilies,
  runWhenVisible,
  nodeHitRadius,
  nodeSymbolPath,
  networkZoomAllowed,
} = require("../docs/js/viz_interactions.js");

const moviesById = new Map([
  [1, { title: "Action One", genres: ["Action", "Drama"] }],
  [2, { title: "Comedy Two", genres: ["Comedy"] }],
  [3, { title: "Action Three", genres: ["Action"] }],
  [4, { title: "Action Four", genres: ["Action", "Science Fiction"] }],
]);

const links = [
  { source: "actor_a", target: "director_x", movies: [1, 2, 3, 4] },
  { source: "actor_b", target: "director_x", movies: [1, 3, 4] },
  { source: "actor_b", target: "director_y", movies: [1, 2, 3] },
];

test("counts only shared movies that contain the selected genre", () => {
  const result = countSharedMovies(links[0], "Action", moviesById);
  assert.deepEqual(result.movieIds, [1, 3, 4]);
  assert.equal(result.count, 3);
});

test("keeps all shared movies when genre is All", () => {
  const result = countSharedMovies(links[0], "All", moviesById);
  assert.equal(result.count, 4);
});

test("filters edges by recomputed count and removes isolated nodes", () => {
  const result = filterCollaborationGraph(links, "Action", 3, moviesById);
  assert.equal(result.links.length, 2);
  assert.deepEqual(
    [...result.nodeIds].sort(),
    ["actor_a", "actor_b", "director_x"]
  );

  const stronger = filterCollaborationGraph(links, "Action", 4, moviesById);
  assert.equal(stronger.links.length, 0);
  assert.equal(stronger.nodeIds.size, 0);
});

test("clears a selection when filtering removes that person", () => {
  assert.equal(selectionSurvives("actor_a", new Set(["actor_a", "director_x"])), true);
  assert.equal(selectionSurvives("actor_a", new Set(["director_x"])), false);
  assert.equal(selectionSurvives(null, new Set(["actor_a"])), false);
});

test("defines truthful labels and legend semantics for all heatmap metrics", () => {
  assert.equal(metricConfig.weighted_rating.description, "Vote-count-weighted average of TMDB movie ratings");
  assert.deepEqual(metricConfig.weighted_rating.semantic, ["Lower rating", "Higher rating"]);
  assert.deepEqual(metricConfig.total_votes.semantic, ["Fewer votes", "More votes"]);
  assert.deepEqual(metricConfig.movie_count.semantic, ["Fewer movies", "More movies"]);
});

test("formats ratings with decimals and counts as whole numbers", () => {
  assert.equal(formatMetricValue("weighted_rating", 6.608), "6.61");
  assert.equal(formatMetricValue("total_votes", 355391), "355,391");
  assert.equal(formatMetricValue("movie_count", 52), "52");
  assert.equal(formatMetricValue("weighted_rating", null), "No data");
});

test("places crowded network labels inside the chart without overlapping", () => {
  const labels = [
    { id: "a", name: "Quentin Tarantino", x: 8, y: 55, radius: 10 },
    { id: "b", name: "Robert Rodriguez", x: 70, y: 55, radius: 10 },
    { id: "c", name: "David Yates", x: 76, y: 58, radius: 10 },
  ];
  const placements = placeLabels(labels, 180, 110);
  const boxes = labels.map((label) => {
    const placed = placements.get(label.id);
    assert.ok(placed.x >= 4);
    assert.ok(placed.y >= 4);
    assert.ok(placed.x + placed.width <= 176);
    assert.ok(placed.y + placed.height <= 106);
    return placed;
  });
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      assert.equal(a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y, false);
    }
  }
});

test("reset restores every dragged node to its default layout position", () => {
  const nodes = [
    { id: "a", x: 91, y: 82, defaultX: 12, defaultY: 24 },
    { id: "b", x: 77, y: 66, defaultX: 30, defaultY: 42 },
  ];
  restoreNodePositions(nodes);
  assert.deepEqual(nodes.map(({ x, y }) => [x, y]), [[12, 24], [30, 42]]);
});

test("network links use a visible blue hierarchy for overview, hover, and selection", () => {
  const link = { source: "actor_a", target: "director_x" };
  assert.deepEqual(networkLinkStyle(link, { visible: true }), {
    color: "#58a6ff",
    opacity: 0.78,
  });
  assert.deepEqual(networkLinkStyle(link, { visible: true, hoveredId: "actor_a" }), {
    color: "#79cfff",
    opacity: 0.96,
  });
  assert.deepEqual(networkLinkStyle(link, { visible: true, selectedId: "director_x" }), {
    color: "#58c7f3",
    opacity: 1,
  });
  assert.deepEqual(networkLinkStyle(link, { visible: true, selectedId: "someone_else" }), {
    color: "#31506a",
    opacity: 0.1,
  });
  assert.deepEqual(networkLinkStyle(link, { visible: false }), {
    color: "#31506a",
    opacity: 0,
  });
});

test("network edge widths remain legible after responsive SVG scaling", () => {
  assert.equal(networkEdgeWidth(3, 12), 1.8);
  assert.equal(networkEdgeWidth(12, 12), 6.8);
});

test("heatmap transitions ripple briefly from left to right", () => {
  assert.equal(heatmapTransitionDelay(2016, 0), 0);
  assert.equal(heatmapTransitionDelay(2017, 0), 18);
  assert.equal(heatmapTransitionDelay(2026, 12), 216);
});

test("reduced motion turns animated durations into immediate updates", () => {
  assert.equal(motionDuration(320, false), 320);
  assert.equal(motionDuration(320, true), 0);
});

test("embedded network skips count animation when summary elements are absent", () => {
  const source = fs.readFileSync(path.join(__dirname, "../docs/js/viz3_collaboration_network.js"), "utf8");
  assert.match(source, /function tweenNumber[\s\S]*?if \(selection\.empty\(\)\) return;/);
});

test("all collaboration communities get unique colors outside the blue and purple hue range", () => {
  const colors = Array.from({ length: 79 }, (_, index) => communityNodeColor(index));
  assert.equal(new Set(colors).size, 79);
  colors.forEach((color) => {
    const hue = +color.match(/^hsl\(([\d.]+)/)[1];
    assert.ok(hue <= 172 || hue >= 345, `unexpected blue or purple hue: ${hue}`);
  });
});

test("neighboring community indexes rotate through clearly different color families", () => {
  const hues = Array.from({ length: 79 }, (_, index) => {
    const color = communityNodeColor(index);
    return +color.match(/^hsl\(([\d.]+)/)[1];
  });
  for (let index = 1; index < hues.length; index += 1) {
    const directDistance = Math.abs(hues[index] - hues[index - 1]);
    const circularDistance = Math.min(directDistance, 360 - directDistance);
    assert.ok(circularDistance >= 55,
      `community ${index - 1} and ${index} are too similar: ${hues[index - 1]} vs ${hues[index]}`);
  }
});

test("connected collaboration communities are assigned different color families", () => {
  assert.equal(typeof assignCommunityColorFamilies, "function");
  const families = assignCommunityColorFamilies(
    ["a", "b", "c", "d", "e"],
    [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
      { source: "c", target: "a" },
      { source: "c", target: "d" },
      { source: "d", target: "e" },
    ],
    7
  );
  [
    ["a", "b"], ["b", "c"], ["c", "a"], ["c", "d"], ["d", "e"],
  ].forEach(([source, target]) => assert.notEqual(families.get(source), families.get(target)));
});

test("homepage intro waits until its chart becomes visible and then runs once", () => {
  assert.equal(typeof runWhenVisible, "function");
  let observedElement = null;
  let disconnected = 0;
  let callbackCount = 0;
  let observerCallback;
  class FakeObserver {
    constructor(callback) { observerCallback = callback; }
    observe(element) { observedElement = element; }
    disconnect() { disconnected += 1; }
  }
  const element = { id: "chart" };
  runWhenVisible(element, () => { callbackCount += 1; }, false, FakeObserver);
  assert.equal(observedElement, element);
  assert.equal(callbackCount, 0);
  observerCallback([{ target: element, isIntersecting: true }]);
  observerCallback([{ target: element, isIntersecting: true }]);
  assert.equal(callbackCount, 1);
  assert.equal(disconnected, 1);
});

test("small network nodes receive a generous individual drag target", () => {
  assert.equal(nodeHitRadius(5), 14);
  assert.equal(nodeHitRadius(14), 20);
});

test("actor and director symbols use distinct polished paths", () => {
  const actor = nodeSymbolPath("Actor", 10);
  const director = nodeSymbolPath("Director", 10);
  assert.match(actor, /A10,10/);
  assert.match(director, /Q0,-10/);
  assert.notEqual(actor, director);
});

test("network zoom ignores node drag targets but keeps normal pan and wheel zoom", () => {
  assert.equal(networkZoomAllowed({ isNodeHit: true, type: "mousedown", button: 0 }), false);
  assert.equal(networkZoomAllowed({ isNodeHit: false, type: "mousedown", button: 0 }), true);
  assert.equal(networkZoomAllowed({ isNodeHit: false, type: "mousedown", button: 0, ctrlKey: true }), false);
  assert.equal(networkZoomAllowed({ isNodeHit: false, type: "wheel", button: 0, ctrlKey: true }), true);
  assert.equal(networkZoomAllowed({ isNodeHit: false, type: "mousedown", button: 1 }), false);
});

test("node drag targets capture pointer movement in network coordinates", () => {
  const source = fs.readFileSync(path.join(__dirname, "../docs/js/viz3_collaboration_network.js"), "utf8");
  assert.match(source, /setPointerCapture\?\.\(event\.pointerId\)/);
  assert.match(source, /d3\.pointer\(event, viewport\.node\(\)\)/);
  assert.match(source, /releasePointerCapture\?\.\(event\.pointerId\)/);
});
