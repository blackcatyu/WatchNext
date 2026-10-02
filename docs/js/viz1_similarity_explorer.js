// Interactive audience similarity network (Visualization 1).
// Drives the audience-network tab of viz1.html (the homepage embeds only the universe
// view). Data comes from src/export_viz1_explorer.py.
//
// Every movie MovieLens users have rated (historical track + 2016+ releases MovieLens
// covers) is a possible node; edges are "liked both" Jaccard overlap. Movies with no
// MovieLens data (mostly released after its 2023-10 snapshot) only appear in the
// sidebar and in the universe view (viz1_universe.js), which shares this page's
// toolbar and side panel.

(async function () {
  const data = await d3.json("data/viz1_similarity_explorer.json");

  const WIDTH = 1000;
  const HEIGHT = 720;
  const PAD = 24;
  const DURATION = 750;
  const MAX_NODES = 260;

  const svg = d3.select("#viz1-svg").attr("viewBox", `0 0 ${WIDTH} ${HEIGHT}`);
  const tooltip = d3.select("#viz1-tooltip");
  const panel = d3.select("#viz1-panel");

  const pct = d3.format(".1%");
  const num = d3.format(",");
  const normalize = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const titleYear = (m) => (m.year ? `${m.title} (${m.year})` : m.title);
  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const pairKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

  // --------------------------------------------------------------
  // Data
  // --------------------------------------------------------------

  const movies = new Map(data.movies.map((m) => [m.id, m]));
  const unrated = new Map(data.unrated.map((m) => [m.id, m]));
  const neighborsOf = (m) =>
    m.neighbors.map(([id, count, jaccard]) => ({ id, strength: jaccard, info: { count, jaccard } }));

  const lenses = data.lenses.map((lens) => ({
    ...lens,
    links: lens.links.map(([a, b, count, jaccard]) => ({ a, b, strength: jaccard, info: { count, jaccard } })),
  }));
  const lensByKey = new Map(lenses.map((l) => [l.key, l]));

  // Every known pair (neighbor lists + all starting-view links), so edges can be drawn
  // between any two visible movies, including ones added by expanding.
  const pairs = new Map();
  data.movies.forEach((m) => neighborsOf(m).forEach((n) => pairs.set(pairKey(m.id, n.id), n.info)));
  lenses.forEach((lens) => lens.links.forEach((l) => pairs.set(pairKey(l.a, l.b), l.info)));

  // --------------------------------------------------------------
  // Encodings
  // --------------------------------------------------------------

  const primaryGenre = (m) => m.genres[0] || "Other";
  const topGenres = [...d3.rollup([...data.movies, ...data.unrated], (v) => v.length, primaryGenre)]
    .sort((a, b) => d3.descending(a[1], b[1]))
    .slice(0, 9)
    .map((d) => d[0]);
  const genreOf = (m) => (topGenres.includes(primaryGenre(m)) ? primaryGenre(m) : "Other");
  const color = d3.scaleOrdinal().domain(topGenres).range(d3.schemeTableau10).unknown("#6e7681");
  const linkWidth = d3.scaleSqrt().domain([0, 0.75]).range([0.4, 6]).clamp(true);

  // --------------------------------------------------------------
  // State
  // --------------------------------------------------------------

  const state = {
    focusId: null,
    genre: null,
    hoverId: null,
    history: [],
    lens: "all",
    added: new Set(), // movies added by expanding
    expanded: [], // movies whose neighbors were added, in order
    notice: null,
  };
  const simNodes = new Map(); // reused across views so positions animate
  let view = { nodes: [], links: [] };

  // --------------------------------------------------------------
  // SVG scaffolding
  // --------------------------------------------------------------

  const linkLayer = svg.append("g");
  const nodeLayer = svg.append("g");

  const simulation = d3
    .forceSimulation()
    .force("link", d3.forceLink().id((d) => d.id))
    .force("charge", d3.forceManyBody())
    .force("x", d3.forceX(WIDTH / 2).strength(0.05))
    .force("y", d3.forceY(HEIGHT / 2).strength(0.09))
    .force("collide", d3.forceCollide())
    .on("tick", ticked);

  function ticked() {
    view.nodes.forEach((d) => {
      d.x = Math.max(PAD, Math.min(WIDTH - PAD, d.x));
      d.y = Math.max(PAD, Math.min(HEIGHT - PAD, d.y));
    });
    linkLayer
      .selectAll("line")
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);
    nodeLayer.selectAll("g.node").attr("transform", (d) => `translate(${d.x},${d.y})`);
  }

  function simNode(id, origin) {
    if (!simNodes.has(id)) {
      simNodes.set(id, {
        id,
        movie: movies.get(id),
        x: origin ? origin.x + (Math.random() - 0.5) * 40 : WIDTH / 2 + (Math.random() - 0.5) * 200,
        y: origin ? origin.y + (Math.random() - 0.5) * 40 : HEIGHT / 2 + (Math.random() - 0.5) * 200,
      });
    }
    return simNodes.get(id);
  }

  // --------------------------------------------------------------
  // View construction
  // --------------------------------------------------------------

  const currentLens = () => lensByKey.get(state.lens);

  function overviewView() {
    const lens = currentLens();
    const base = new Set(lens.ids);
    const added = [...state.added].filter((id) => !base.has(id));
    const nodes = [...lens.ids, ...added].map((id) => simNode(id));
    const link = (a, b, strength, info) => ({
      source: simNodes.get(a), target: simNodes.get(b), strength, info, primary: true,
    });
    const links = lens.links.map((l) => link(l.a, l.b, l.strength, l.info));
    // Edges touching added movies: any known pair among the visible movies.
    const seen = new Set(links.map((l) => pairKey(l.source.id, l.target.id)));
    added.forEach((a) =>
      nodes.forEach((n) => {
        const k = pairKey(a, n.id);
        const info = a !== n.id && !seen.has(k) && pairs.get(k);
        if (info) {
          seen.add(k);
          links.push(link(a, n.id, info.jaccard, info));
        }
      })
    );
    const origins = new Set(state.expanded);
    const degree = d3.rollup(links.flatMap((l) => [l.source.id, l.target.id]), (v) => v.length, (d) => d);
    const r = d3.scaleSqrt().domain([0, d3.max(degree.values())]).range([5, 16]);
    const labeled = new Set(
      [...nodes].sort((a, b) => d3.descending(degree.get(a.id) || 0, degree.get(b.id) || 0)).slice(0, 18).map((d) => d.id)
    );
    nodes.forEach((d) => {
      d.r = r(degree.get(d.id) || 0);
      d.label = labeled.has(d.id) || origins.has(d.id);
      d.origin = origins.has(d.id);
      d.isAdded = !base.has(d.id);
      d.fx = d.fy = null;
    });
    return { nodes, links, linkDistance: 90, charge: nodes.length > 120 ? -140 : -200 };
  }

  function focusView(id) {
    const center = simNode(id);
    const neighbors = neighborsOf(center.movie);
    const nodes = [center, ...neighbors.map((n) => simNode(n.id, center))];
    const links = neighbors.map((n) => ({
      source: center, target: simNodes.get(n.id), strength: n.strength, info: n.info, primary: true,
    }));
    // Edges among the neighbors themselves, so clusters inside the neighborhood stay visible.
    nodes.slice(1).forEach((a, i) =>
      nodes.slice(i + 2).forEach((b) => {
        const info = pairs.get(pairKey(a.id, b.id));
        if (info) links.push({ source: a, target: b, strength: info.jaccard, info, primary: false });
      })
    );
    const maxS = d3.max(neighbors, (n) => n.strength) || 1;
    const r = d3.scaleSqrt().domain([0, maxS]).range([6, 15]);
    const strengthOf = new Map(neighbors.map((n) => [n.id, n.strength]));
    nodes.forEach((d) => {
      d.label = true;
      d.origin = d.isAdded = false;
      if (d !== center) {
        d.r = r(strengthOf.get(d.id));
        d.fx = d.fy = null;
      }
    });
    center.r = 20;
    links.forEach((l) => (l.distance = l.primary ? 150 + 190 * (1 - l.strength / maxS) : 200));
    return { nodes, links, center, charge: -900 };
  }

  // --------------------------------------------------------------
  // Rendering
  // --------------------------------------------------------------

  function render() {
    const next = state.focusId == null ? overviewView() : focusView(state.focusId);
    view = next;

    simulation.nodes(next.nodes);
    simulation
      .force("link")
      .links(next.links)
      .distance((l) => l.distance ?? next.linkDistance)
      .strength((l) => (l.primary ? 0.25 : 0.05));
    simulation.force("charge").strength(next.charge);
    simulation.force("collide").radius((d) => d.r + (d.label ? 16 : 6));

    svg.interrupt("center");
    if (next.center) {
      const c = next.center;
      const ix = d3.interpolate(c.x, WIDTH / 2);
      const iy = d3.interpolate(c.y, HEIGHT / 2);
      svg
        .transition("center")
        .duration(DURATION)
        .ease(d3.easeCubicInOut)
        .tween("center", () => (t) => {
          c.fx = ix(t);
          c.fy = iy(t);
        });
    }

    linkLayer
      .selectAll("line")
      .data(next.links, (l) => pairKey(l.source.id, l.target.id))
      .join(
        (enter) => enter.append("line").attr("class", "link").style("stroke-opacity", 0),
        (update) => update.interrupt(), // cancel a pending exit if the edge comes straight back
        (exit) => exit.transition().duration(DURATION / 2).style("stroke-opacity", 0).remove()
      )
      .attr("stroke-width", (l) => (l.primary ? linkWidth(l.strength) : 1))
      .attr("stroke-dasharray", (l) => (l.primary ? null : "3 3"));

    const node = nodeLayer
      .selectAll("g.node")
      .data(next.nodes, (d) => d.id)
      .join(
        (enter) => {
          const g = enter
            .append("g")
            .attr("class", "node")
            .attr("opacity", 0)
            .attr("transform", (d) => `translate(${d.x},${d.y})`)
            .style("cursor", "pointer")
            .on("mouseenter", (event, d) => hover(event, d))
            .on("mousemove", moveTooltip)
            .on("mouseleave", () => hover(null, null))
            .on("click", (event, d) => {
              if (event.defaultPrevented) return; // drag, not click
              if (event.shiftKey) expand(d.id);
              else focus(d.id);
            })
            .call(drag);
          g.append("circle").attr("stroke", "#0f1216").attr("stroke-width", 1).attr("r", 0);
          g.append("text").attr("text-anchor", "middle");
          return g;
        },
        (update) => update.interrupt(),
        (exit) => exit.transition().duration(DURATION / 2).attr("opacity", 0).remove()
      );

    node
      .select("circle")
      .attr("fill", (d) => color(genreOf(d.movie)))
      .attr("stroke-dasharray", (d) => (d.isAdded ? "2 1.5" : null))
      .transition()
      .duration(DURATION)
      .attr("r", (d) => d.r)
      .attr("stroke", (d) => (d === next.center || d.origin ? "#e6edf3" : "#0f1216"))
      .attr("stroke-width", (d) => (d === next.center ? 2.5 : d.origin ? 1.5 : 1));

    node
      .select("text")
      .text((d) => (d.label ? d.movie.title : ""))
      .attr("dy", (d) => -d.r - 4)
      .style("font-size", (d) => (d === next.center ? "13px" : next.center ? "11px" : "9px"))
      .style("font-weight", (d) => (d === next.center ? 600 : null));

    d3.select("#viz1-encoding").text(
      next.center
        ? "Node size and edge thickness = audience overlap with the centered movie; dashed lines = links among its neighbors. Drag any movie to move it."
        : "Edge thickness = audience overlap (share of combined fans who liked both); node size = number of connections shown. Drag any movie to move it."
    );
    simulation.alpha(next.center ? 0.9 : 0.7).restart();
    applyEmphasis();
    renderModeSwitch();
    renderLensControls();
    renderPanel();
    renderBreadcrumbs();
    renderLegend();
  }

  // Opacity combines the genre filter and hover highlighting.
  function applyEmphasis() {
    const hovered = state.hoverId;
    const adjacent = new Set();
    if (hovered != null) {
      adjacent.add(hovered);
      view.links.forEach((l) => {
        if (l.source.id === hovered) adjacent.add(l.target.id);
        if (l.target.id === hovered) adjacent.add(l.source.id);
      });
    }
    const inGenre = (d) => !state.genre || genreOf(d.movie) === state.genre;
    const nodeOpacity = (d) => {
      if (hovered != null) return adjacent.has(d.id) ? 1 : 0.12;
      return inGenre(d) ? 1 : 0.12;
    };
    const linkOpacity = (l) => {
      if (hovered != null) return l.source.id === hovered || l.target.id === hovered ? 0.85 : 0.04;
      if (state.genre) return inGenre(l.source) && inGenre(l.target) ? 0.6 : 0.04;
      return l.primary ? 0.4 : 0.18;
    };
    nodeLayer
      .selectAll("g.node")
      .filter((d) => view.nodes.includes(d))
      .transition("emphasis")
      .duration(200)
      .attr("opacity", nodeOpacity);
    linkLayer
      .selectAll("line")
      .filter((l) => view.links.includes(l))
      .transition("emphasis")
      .duration(200)
      .style("stroke-opacity", linkOpacity); // style, not attr: style.css sets .link stroke-opacity
  }

  // --------------------------------------------------------------
  // Drag
  // --------------------------------------------------------------

  const drag = d3
    .drag()
    .on("start", (event, d) => {
      if (!event.active) simulation.alphaTarget(0.2).restart();
      d.fx = d.x;
      d.fy = d.y;
    })
    .on("drag", (event, d) => {
      d.fx = event.x;
      d.fy = event.y;
    })
    .on("end", (event, d) => {
      if (!event.active) simulation.alphaTarget(0);
      if (d !== view.center) d.fx = d.fy = null;
    });

  // --------------------------------------------------------------
  // Tooltip
  // --------------------------------------------------------------

  function hover(event, d) {
    state.hoverId = d ? d.id : null;
    applyEmphasis();
    if (!d) {
      tooltip.style("opacity", 0);
      return;
    }
    const m = d.movie;
    let html = `<div class="tt-title">${esc(titleYear(m))}</div>
      <div class="tt-sub">${esc(m.genres.join(" · ") || "No genre")}</div>
      <div class="tt-row">${num(m.fans)} MovieLens users rated it ≥${data.likeThreshold}/5</div>`;

    if (view.center && d !== view.center) {
      const c = view.center.movie;
      const info = pairs.get(pairKey(c.id, m.id));
      const sharedGenres = m.genres.filter((g) => c.genres.includes(g));
      const sharedKw = m.reviewKeywords.filter((k) => c.reviewKeywords.includes(k));
      html += `<div class="tt-section">With <strong>${esc(c.title)}</strong></div>
        <div class="tt-row">Liked both: <strong>${num(info.count)}</strong> users
          (${pct(info.jaccard)} of their combined fans)</div>
        <div class="tt-row">Shared genres: ${esc(sharedGenres.join(", ") || "none")}</div>
        <div class="tt-row">Shared review keywords: ${esc(sharedKw.join(", ") || "none")}</div>`;
    } else {
      const conn = view.links
        .filter((l) => l.source === d || l.target === d)
        .map((l) => ({ other: l.source === d ? l.target : l.source, ...l }))
        .sort((a, b) => d3.descending(a.strength, b.strength))
        .slice(0, 6);
      if (conn.length) {
        html += `<div class="tt-section">Connected here to</div>` +
          conn
            .map(
              (c) => `<div class="tt-row">${esc(c.other.movie.title)} —
                <strong>${num(c.info.count)}</strong> liked both (${pct(c.info.jaccard)})</div>`
            )
            .join("");
      }
    }
    html += `<div class="tt-hint">Click to ${d === view.center ? "stay centered" : "center on this movie"} ·
      Shift-click to add its neighbors to the map</div>`;
    tooltip.html(html).style("opacity", 1);
    moveTooltip(event);
  }

  function moveTooltip(event) {
    const wrap = document.querySelector(".explorer-graph").getBoundingClientRect();
    const tip = tooltip.node().getBoundingClientRect();
    let x = event.clientX - wrap.left + 14;
    let y = event.clientY - wrap.top + 14;
    if (x + tip.width > wrap.width) x = event.clientX - wrap.left - tip.width - 14;
    if (y + tip.height > wrap.height) y = Math.max(0, event.clientY - wrap.top - tip.height - 14);
    tooltip.style("left", `${x}px`).style("top", `${y}px`);
  }

  // --------------------------------------------------------------
  // Detail panel + unrated sidebar
  // --------------------------------------------------------------

  const chips = (items, cls = "") => items.map((t) => `<span class="chip ${cls}">${esc(t)}</span>`).join("");

  function sentimentHtml(s) {
    return s
      ? `<div class="sentiment-bar"><span style="width:${s[0] * 100}%"></span></div>
         <div class="panel-muted">${pct(s[0])} positive across ${num(s[1])} TMDB review${s[1] === 1 ? "" : "s"}</div>`
      : `<div class="panel-muted">No TMDB reviews available.</div>`;
  }

  function renderPanel() {
    if (state.focusId == null) {
      panel.html(`
        <h2>Audience network</h2>
        <p class="panel-muted">Starting view: <strong>${esc(currentLens().label)}</strong>. Each movie keeps
          its 5 strongest audience connections. Covers ${num(data.movies.length)} movies MovieLens users
          rated through October 2023, including 2016+ releases.</p>
        <ul class="panel-help">
          <li><strong>Hover</strong> a movie to see what it is connected to and how many users liked both.</li>
          <li><strong>Click</strong> a movie to center on it and open its details.</li>
          <li><strong>Shift-click</strong> a movie to add its neighbors to this map and keep growing it
            (added movies have a dashed outline).</li>
          <li><strong>Start from</strong> another decade or genre with the menu above the graph.</li>
          <li><strong>Search</strong> above to jump to any of ${num(data.movies.length + data.unrated.length)} movies.</li>
          <li><strong>Click a genre</strong> in the legend to see whether strong connections stay inside that genre.</li>
          <li><strong>Drag</strong> movies to untangle crowded areas.</li>
        </ul>`);
      return;
    }

    const m = movies.get(state.focusId);
    const neighbors = neighborsOf(m);
    const maxS = d3.max(neighbors, (n) => n.strength) || 1;
    const neighborRows = neighbors
      .map((n) => {
        const o = movies.get(n.id);
        return `<li><button class="row-btn" data-id="${n.id}">
            <span class="dot" style="background:${color(genreOf(o))}"></span>
            <span class="row-title">${esc(o.title)}</span>
            <span class="row-bar"><span style="width:${(n.strength / maxS) * 100}%"></span></span>
            <span class="row-num">${pct(n.strength)}</span>
          </button></li>`;
      })
      .join("");

    const unratedRows = m.unrated
      .map((r) => {
        const u = unrated.get(r.id);
        const reasons = chips(r.people, "chip-person") + chips(r.genres) + chips(r.keywords.slice(0, 3), "chip-kw");
        return `<li class="recent-item"><button class="cross-btn" data-id="${r.id}">
            <div class="row-title">${esc(titleYear(u))}</div>
            <div class="panel-muted">${esc(u.directors.join(", "))}</div>
            <div class="chips">${reasons}</div>
          </button></li>`;
      })
      .join("");

    // Newer releases have far fewer MovieLens fans, so their overlaps are noisier.
    const smallAudience =
      m.track === "recent"
        ? `<p class="panel-note">Released ${m.year}: MovieLens data stops in October 2023, so this movie has
            only ${num(m.fans)} fans there and its overlaps are noisier than older movies'.</p>`
        : "";

    panel.html(`
      <h2>${esc(m.title)} <span class="panel-year">${m.year ?? ""}</span></h2>
      <div class="chips">${chips(m.genres)}</div>
      <button class="expand-btn" type="button">＋ Add it and its neighbors to the map</button>
      <dl class="facts">
        <dt>Director</dt><dd>${esc(m.directors.join(", ") || "—")}</dd>
        <dt>Starring</dt><dd>${esc(m.cast.join(", ") || "—")}</dd>
        <dt>MovieLens</dt><dd>${m.ratingMean.toFixed(2)} / 5 from ${num(m.ratingCount)} ratings</dd>
      </dl>
      ${smallAudience}

      <h3>Review sentiment</h3>
      ${sentimentHtml(m.sentiment)}

      <h3>Top review keywords</h3>
      <div class="chips">${chips(m.reviewKeywords, "chip-kw") || `<span class="panel-muted">None</span>`}</div>

      <h3>People who liked this also liked</h3>
      <p class="panel-muted">Share of the two movies' combined fans who liked both. Click to re-center.</p>
      <ul class="row-list">${neighborRows}</ul>

      <div class="recent-box">
        <h3>Newest releases like this</h3>
        <p class="panel-muted">Movies not yet in MovieLens (mostly 2024–2026), matched by <strong>content</strong>
          (shared people, genres, keywords) since there is no audience data for them. Click one to find it
          in the universe view.</p>
        <ul class="recent-list">${unratedRows || `<li class="panel-muted">No close matches.</li>`}</ul>
      </div>`);

    panel.select(".expand-btn").on("click", () => {
      expand(m.id);
      revealGraph();
    });
    panel.selectAll(".row-btn").on("click", function () {
      focus(+this.dataset.id);
      revealGraph();
    });
    panel.selectAll(".cross-btn").on("click", function () {
      openInUniverse("unrated", +this.dataset.id);
    });
  }

  // Panel links can sit far below the graph; bring the graph back into view.
  function revealGraph() {
    const graph = document.querySelector(universeActive ? "#universe" : ".explorer-graph");
    if (graph.getBoundingClientRect().top < 0) graph.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // --------------------------------------------------------------
  // Universe hand-off (viz1_universe.js)
  // --------------------------------------------------------------

  let universeActive = false;

  function renderModeSwitch() {
    const current = universeActive ? "universe" : "audience";
    d3.selectAll("#viz1-modes button")
      .classed("active", function () {
        return this.dataset.mode === current;
      })
      .attr("aria-pressed", function () {
        return this.dataset.mode === current;
      });
  }

  d3.selectAll("#viz1-modes button").on("click", function () {
    if (this.dataset.mode === "universe") {
      if (!universeActive) enterUniverse();
    } else if (universeActive) {
      leaveUniverse();
      render();
    }
  });

  function enterUniverse() {
    universeActive = true;
    simulation.stop();
    tooltip.style("opacity", 0);
    d3.select(".explorer").classed("show-universe", true);
    d3.select("#viz1-crumbs").selectAll("*").remove();
    renderModeSwitch();
    window.viz1Universe.show();
  }

  function leaveUniverse() {
    universeActive = false;
    d3.select(".explorer").classed("show-universe", false);
    window.viz1Universe.hide();
  }

  function openInUniverse(kind, id) {
    if (!universeActive) enterUniverse();
    window.viz1Universe.flyTo(kind, id);
    revealGraph();
  }

  // --------------------------------------------------------------
  // Expansion, starting views, breadcrumbs, legend
  // --------------------------------------------------------------

  // Grow the starting view: add a movie and its neighbors, then return to the map.
  function expand(id) {
    const visible = new Set([...currentLens().ids, ...state.added]);
    const incoming = [id, ...neighborsOf(movies.get(id)).map((n) => n.id)].filter((x) => !visible.has(x));
    if (visible.size + incoming.length > MAX_NODES) {
      state.notice = `The map is limited to ${MAX_NODES} movies to stay readable. Clear added movies or start from another view.`;
    } else {
      state.notice = null;
      // Create new nodes at the expanded movie's position so they visibly grow out of it.
      const origin = simNodes.get(id) || simNode(id);
      incoming.forEach((x) => {
        simNode(x, origin);
        state.added.add(x);
      });
      if (!state.expanded.includes(id)) state.expanded.push(id);
    }
    state.focusId = null;
    state.history = [];
    state.hoverId = null;
    tooltip.style("opacity", 0);
    render();
  }

  function clearAdded() {
    state.added.clear();
    state.expanded = [];
    state.notice = null;
  }

  function renderLensControls() {
    const groups = d3.groups(lenses, (l) =>
      l.key === "all" ? "Default" : l.key.startsWith("genre:") ? "By genre" : "By release date"
    );
    const select = d3.select("#viz1-lens");
    select
      .selectAll("optgroup")
      .data(groups, (g) => g[0])
      .join("optgroup")
      .attr("label", (g) => g[0])
      .selectAll("option")
      .data((g) => g[1])
      .join("option")
      .attr("value", (l) => l.key)
      .text((l) => l.label);
    select.property("value", state.lens);

    const added = state.added.size;
    const expandedTitles = state.expanded.map((id) => movies.get(id).title);
    const status = d3.select("#viz1-status");
    status.html(
      state.focusId != null
        ? `Centered on one movie. Use the path above or <em>Overview</em> to return to the map.`
        : `${num(currentLens().ids.length)} movies${
            added
              ? ` + <strong>${added}</strong> added from ${esc(expandedTitles.slice(-3).join(", "))}${expandedTitles.length > 3 ? "…" : ""}
                 <button class="link-btn" id="viz1-clear">Clear added</button>`
              : ""
          }${state.notice ? ` <span class="notice">${esc(state.notice)}</span>` : ""}`
    );
    status.select("#viz1-clear").on("click", () => {
      clearAdded();
      render();
    });
  }

  d3.select("#viz1-lens").on("change", function () {
    state.lens = this.value;
    clearAdded();
    state.focusId = null;
    state.history = [];
    render();
  });

  function renderBreadcrumbs() {
    const items = [{ id: null, label: "Overview" }, ...state.history.map((id) => ({ id, label: movies.get(id).title }))];
    d3.select("#viz1-crumbs")
      .selectAll("button")
      .data(items)
      .join("button")
      .attr("class", (d, i) => `crumb${i === items.length - 1 ? " current" : ""}`)
      .text((d) => d.label)
      .on("click", (event, d) => {
        state.history = state.history.slice(0, items.indexOf(d)); // items[0] is "Overview"
        state.focusId = d.id;
        render();
      });
  }

  function renderLegend() {
    const legend = d3.select("#viz1-legend");
    legend
      .selectAll("button")
      .data([...topGenres, "Other"])
      .join((enter) => {
        const b = enter.append("button").attr("class", "legend-btn");
        b.append("span").attr("class", "dot");
        b.append("span").attr("class", "legend-label");
        return b;
      })
      .classed("active", (g) => state.genre === g)
      .classed("muted", (g) => state.genre && state.genre !== g)
      .on("click", (event, g) => {
        state.genre = state.genre === g ? null : g;
        renderLegend();
        applyEmphasis();
      })
      .call((b) => b.select(".dot").style("background", (g) => color(g)))
      .call((b) => b.select(".legend-label").text((g) => g));

    const stat = d3.select("#viz1-genre-stat");
    if (!state.genre) {
      stat.text("Click a genre to highlight it.");
      return;
    }
    const touching = view.links.filter((l) => genreOf(l.source.movie) === state.genre || genreOf(l.target.movie) === state.genre);
    const within = touching.filter((l) => genreOf(l.source.movie) === state.genre && genreOf(l.target.movie) === state.genre);
    stat.html(
      touching.length
        ? `<strong>${within.length}</strong> of ${touching.length} connections touching ${esc(state.genre)} stay within it
           (${pct(within.length / touching.length)}).`
        : `No ${esc(state.genre)} movies in this view.`
    );
  }

  function focus(id) {
    if (state.focusId === id) return;
    const at = state.history.indexOf(id);
    state.history = at >= 0 ? state.history.slice(0, at + 1) : [...state.history, id];
    state.focusId = id;
    state.hoverId = null;
    tooltip.style("opacity", 0);
    render();
  }

  function reset() {
    searchInput.property("value", "");
    results.html("").style("display", "none");
    if (universeActive) {
      window.viz1Universe.reset();
      return;
    }
    state.focusId = null;
    state.history = [];
    state.genre = null;
    state.hoverId = null;
    state.lens = "all";
    clearAdded();
    simNodes.forEach((d) => (d.fx = d.fy = null));
    render();
  }

  d3.select("#viz1-reset").on("click", reset);

  // --------------------------------------------------------------
  // Search (audience movies + unrated movies, which open in the universe)
  // --------------------------------------------------------------

  const maxVotes = d3.max([...data.movies, ...data.unrated], (m) => m.voteCount);
  const searchIndex = [
    ...data.movies.map((m) => ({ m, kind: "audience" })),
    ...data.unrated.map((m) => ({ m, kind: "unrated" })),
  ].map((d) => ({ ...d, key: normalize(d.m.title), pop: d.m.voteCount / maxVotes }));
  const searchInput = d3.select("#viz1-search");
  const results = d3.select("#viz1-results");
  let matches = [];
  let active = 0;

  function showResults() {
    const q = normalize(searchInput.property("value").trim());
    if (!q) {
      results.style("display", "none");
      return;
    }
    matches = searchIndex
      .filter((d) => d.key.includes(q))
      .sort((a, b) => d3.descending(a.key.startsWith(q), b.key.startsWith(q)) || d3.descending(a.pop, b.pop))
      .slice(0, 8);
    active = 0;
    results
      .style("display", "block")
      .selectAll("li")
      .data(matches.length ? matches : [null])
      .join("li")
      .attr("class", (d, i) => (d && i === active ? "active" : null))
      .html((d) =>
        d
          ? `${esc(d.m.title)} <span class="panel-muted">${d.m.year ?? ""} · ${esc(primaryGenre(d.m))}</span>${
              d.kind === "unrated" ? `<span class="track-tag tag-recent">no audience data</span>` : ""
            }`
          : `<span class="panel-muted">No movie matches.</span>`
      )
      .on("mousedown", (event, d) => d && pick(d));
  }

  function pick(d) {
    searchInput.property("value", d.m.title);
    results.style("display", "none");
    if (universeActive || d.kind === "unrated") openInUniverse(d.kind, d.m.id);
    else focus(d.m.id);
  }

  searchInput
    .on("input", showResults)
    .on("focus", showResults)
    .on("blur", () => results.style("display", "none"))
    .on("keydown", (event) => {
      if (!matches.length) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        active = (active + (event.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length;
        results.selectAll("li").attr("class", (d, i) => (i === active ? "active" : null));
      } else if (event.key === "Enter") {
        pick(matches[active]);
      } else if (event.key === "Escape") {
        results.style("display", "none");
      }
    });

  // --------------------------------------------------------------
  // Start
  // --------------------------------------------------------------

  window.viz1Explorer = {
    data,
    color,
    genreOf,
    topGenres,
    panel,
    open(id) {
      leaveUniverse();
      state.history = [];
      state.focusId = null; // so focus() re-renders even if this movie was already centered
      focus(id);
      revealGraph();
    },
  };

  d3.select("#viz1-count").text(num(data.movies.length + data.unrated.length));
  render();
  // The universe is the default view; #audience opens the network and #movie=<id>
  // (used by the homepage universe) opens the network centered on that movie.
  const linked = +(location.hash.match(/^#movie=(\d+)$/) || [])[1];
  if (movies.has(linked)) {
    leaveUniverse();
    focus(linked);
  } else if (location.hash === "#audience") leaveUniverse();
  else enterUniverse();
})();
