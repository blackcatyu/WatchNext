// "Universe" view for Visualization 1: every candidate movie as a star.
// Positions come from src/export_viz1_universe.py. On viz1.html, movie details, the
// genre palette and the side panel are shared with viz1_similarity_explorer.js via
// window.viz1Explorer. On the homepage there is no explorer, so this file loads the
// explorer's data itself and shows a compact card instead of the side panel.
// Drawn on canvas (≈2,900 stars with glow is too heavy for SVG).

(function () {
  const root = d3.select("#universe");
  const canvasEl = root.select("canvas").node();
  const ctx = canvasEl.getContext("2d");
  const tooltip = root.select(".universe-tooltip");

  let ex; // explorer API
  let stars = [];
  let byKey = new Map();
  let quadtree;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let base = d3.zoomIdentity; // transform that fits the whole universe
  let transform = d3.zoomIdentity;
  let hovered = null;
  let selected = null;
  let colorMode = "genre";
  let highlight = null; // genre or decade being highlighted
  let intro = 1;
  let loading = null;
  let frame = null;
  let zoom;
  let bounds; // [[minX, minY], [maxX, maxY]] of all stars

  const num = d3.format(",");
  const pct = d3.format(".1%");
  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const titleYear = (m) => (m.year ? `${m.title} (${m.year})` : m.title);

  const decadeOf = (m) => (m.year ? Math.max(1930, Math.floor(m.year / 10) * 10) : 1930);
  const decadeColor = d3.scaleSequential((t) => d3.interpolateSpectral(1 - t)).domain([1930, 2020]);
  const groupOf = (s) => (colorMode === "genre" ? ex.genreOf(s.m) : decadeOf(s.m));
  const colorOf = (s) => (colorMode === "genre" ? ex.color(ex.genreOf(s.m)) : decadeColor(decadeOf(s.m)));

  // --------------------------------------------------------------
  // Star sprites: a soft glow for movies with audience data, a four-point
  // sparkle for unrated movies (placed by content similarity instead).
  // --------------------------------------------------------------

  const SPRITE = 64;
  const sprites = new Map();
  function sprite(color, unrated) {
    const key = `${color}|${unrated}`;
    if (sprites.has(key)) return sprites.get(key);
    const c = document.createElement("canvas");
    c.width = c.height = SPRITE;
    const g = c.getContext("2d");
    const mid = SPRITE / 2;
    const rgb = d3.rgb(color);
    const glow = g.createRadialGradient(mid, mid, 0, mid, mid, mid);
    glow.addColorStop(0, "rgba(255,255,255,1)");
    glow.addColorStop(0.12, rgb.copy({ opacity: 1 }).formatRgb());
    glow.addColorStop(0.3, rgb.copy({ opacity: 0.22 }).formatRgb());
    glow.addColorStop(1, rgb.copy({ opacity: 0 }).formatRgb());
    g.fillStyle = glow;
    g.fillRect(0, 0, SPRITE, SPRITE);
    if (unrated) {
      g.globalCompositeOperation = "lighter";
      [[1, 0.09], [0.09, 1]].forEach(([sx, sy]) => {
        const spike = g.createRadialGradient(0, 0, 0, 0, 0, mid);
        spike.addColorStop(0, rgb.brighter(1.2).copy({ opacity: 0.6 }).formatRgb());
        spike.addColorStop(1, "rgba(255,255,255,0)");
        g.save();
        g.translate(mid, mid);
        g.scale(sx, sy);
        g.fillStyle = spike;
        g.beginPath();
        g.arc(0, 0, mid, 0, Math.PI * 2);
        g.fill();
        g.restore();
      });
    }
    sprites.set(key, c);
    return c;
  }

  // --------------------------------------------------------------
  // Setup
  // --------------------------------------------------------------

  function load() {
    if (!loading) {
      loading = Promise.all([
        d3.json("data/viz1_universe.json"),
        window.viz1Explorer ? null : d3.json("data/viz1_similarity_explorer.json"),
      ]).then(([pos, data]) => init(pos, data));
    }
    return loading;
  }

  // Minimal stand-in for the explorer API when embedded without it (homepage).
  // Genre palette mirrors viz1_similarity_explorer.js so colors match across pages.
  function standalone(data) {
    const primaryGenre = (m) => m.genres[0] || "Other";
    const topGenres = [...d3.rollup([...data.movies, ...data.unrated], (v) => v.length, primaryGenre)]
      .sort((a, b) => d3.descending(a[1], b[1]))
      .slice(0, 9)
      .map((d) => d[0]);
    return {
      data,
      topGenres,
      genreOf: (m) => (topGenres.includes(primaryGenre(m)) ? primaryGenre(m) : "Other"),
      color: d3.scaleOrdinal().domain(topGenres).range(d3.schemeTableau10).unknown("#6e7681"),
      panel: null,
      open: (id) => (location.href = `viz1.html#movie=${id}`),
    };
  }

  function init(pos, data) {
    ex = window.viz1Explorer || standalone(data);
    const make = (mode, list) => {
      const items = new Map(list.map((m) => [m.id, m]));
      return ([id, x, y]) => ({ key: `${mode}:${id}`, mode, id, x, y, m: items.get(id) });
    };
    stars = [
      ...pos.audience.map(make("audience", ex.data.movies)),
      ...pos.unrated.map(make("unrated", ex.data.unrated)),
    ];
    // Brightness = TMDB vote-count percentile, the one popularity measure every movie has
    // (MovieLens fan counts are much smaller for newer releases).
    [...stars].sort((a, b) => d3.ascending(a.m.voteCount, b.m.voteCount)).forEach((s, i, all) => (s.pop = i / (all.length - 1)));
    stars.forEach((s) => (s.r = 0.9 + 2.8 * s.pop ** 2));
    stars.sort((a, b) => d3.ascending(a.pop, b.pop)); // bright stars drawn last, on top
    byKey = new Map(stars.map((s) => [s.key, s]));
    quadtree = d3.quadtree(stars, (s) => s.x, (s) => s.y);
    bounds = [
      [d3.min(stars, (s) => s.x), d3.min(stars, (s) => s.y)],
      [d3.max(stars, (s) => s.x), d3.max(stars, (s) => s.y)],
    ];

    zoom = d3
      .zoom()
      .on("zoom", (event) => {
        transform = event.transform;
        draw();
      });
    d3.select(canvasEl)
      .call(zoom)
      .on("dblclick.zoom", null)
      .on("mousemove", onMove)
      .on("mouseleave", () => setHover(null))
      .on("click", onClick);

    new ResizeObserver(resize).observe(root.select(".universe-stage").node());
    resize();
    renderControls();

    // Intro: stars appear brightest-first.
    intro = 0;
    const t = d3.timer((elapsed) => {
      intro = Math.min(1, elapsed / 1600);
      draw();
      if (intro >= 1) t.stop();
    });
  }



  function resize() {
    const stage = root.select(".universe-stage").node();
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    dpr = window.devicePixelRatio || 1;
    width = w;
    height = h;
    canvasEl.width = w * dpr;
    canvasEl.height = h * dpr;
    canvasEl.style.width = `${w}px`;
    canvasEl.style.height = `${h}px`;
    // Fit the stars' actual extent (the layout is much wider than tall), not the 1000×1000 canvas.
    const [[x0, y0], [x1, y1]] = bounds;
    const k = Math.min(w / (x1 - x0), h / (y1 - y0)) * 0.92;
    base = d3.zoomIdentity.translate(w / 2 - (k * (x0 + x1)) / 2, h / 2 - (k * (y0 + y1)) / 2).scale(k);
    zoom.scaleExtent([k * 0.7, k * 40]).extent([[0, 0], [w, h]]);
    d3.select(canvasEl).call(zoom.transform, selected ? focusTransform(selected, transform.k) : base);
  }

  // --------------------------------------------------------------
  // Drawing
  // --------------------------------------------------------------

  function draw() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      paint();
    });
  }

  function neighborsOf(s) {
    const list =
      s.mode === "audience"
        ? s.m.neighbors.map(([id, count, jaccard]) => ({ id, strength: jaccard, label: `${num(count)} liked both (${pct(jaccard)})` }))
        : s.m.anchors.map((n) => ({ id: n.id, strength: n.score / 6, label: `content similarity ${n.score.toFixed(1)}` }));
    // Unrated movies' lines go to their content anchors, which are audience movies.
    return list.map((n) => ({ ...n, star: byKey.get(`audience:${n.id}`) })).filter((n) => n.star);
  }

  function paint() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.75);
    bg.addColorStop(0, "#111a2e");
    bg.addColorStop(1, "#05070c");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    if (!stars.length) return;

    const zoomFactor = transform.k / base.k;
    const grow = Math.sqrt(zoomFactor);
    const sx = (s) => transform.applyX(s.x);
    const sy = (s) => transform.applyY(s.y);
    const active = selected || hovered;
    const linked = new Set();

    // Constellation lines from the hovered/selected star to its nearest neighbors.
    if (active) {
      const lines = neighborsOf(active);
      ctx.lineCap = "round";
      lines.forEach((n) => {
        linked.add(n.star.key);
        ctx.strokeStyle = active.mode === "audience" ? "rgba(88,166,255,0.75)" : "rgba(227,179,65,0.8)";
        ctx.lineWidth = 0.6 + 3 * Math.min(1, n.strength / 0.5);
        ctx.beginPath();
        ctx.moveTo(sx(active), sy(active));
        ctx.lineTo(sx(n.star), sy(n.star));
        ctx.stroke();
      });
    }

    ctx.globalCompositeOperation = "lighter";
    for (const s of stars) {
      const x = sx(s);
      const y = sy(s);
      const R = s.r * grow * 3.6;
      if (x < -R || y < -R || x > width + R || y > height + R) continue;
      // Additive glow saturates the dense core when zoomed out; soften it there.
      let alpha = Math.max(0, Math.min(1, (intro - (1 - s.pop) * 0.6) / 0.4)) * Math.min(1, 0.6 + 0.2 * zoomFactor);
      if (highlight != null && groupOf(s) !== highlight) alpha *= 0.08;
      if (active && s !== active && !linked.has(s.key)) alpha *= 0.35;
      if (alpha <= 0.01) continue;
      ctx.globalAlpha = alpha;
      ctx.drawImage(sprite(colorOf(s), s.mode === "unrated"), x - R, y - R, R * 2, R * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    if (active) {
      ctx.strokeStyle = "#e6edf3";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sx(active), sy(active), active.r * grow * 2 + 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    paintLabels(zoomFactor, linked, active);
  }

  // Titles for the brightest stars on screen; more appear as you zoom in.
  function paintLabels(zoomFactor, linked, active) {
    const budget = Math.min(260, Math.round(14 * zoomFactor ** 1.5));
    const forced = stars.filter((s) => s === active || linked.has(s.key));
    const candidates = [...forced];
    for (let i = stars.length - 1; i >= 0 && candidates.length < budget + forced.length; i--) {
      const s = stars[i];
      if (forced.includes(s)) continue;
      if (highlight != null && groupOf(s) !== highlight) continue;
      const x = transform.applyX(s.x);
      const y = transform.applyY(s.y);
      if (x > 0 && y > 0 && x < width && y < height) candidates.push(s);
    }
    const placed = [];
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    for (const s of candidates) {
      const isForced = s === active || linked.has(s.key);
      ctx.font = `${s === active ? "600 13px" : isForced ? "12px" : "11px"} -apple-system, "Segoe UI", Roboto, sans-serif`;
      const x = transform.applyX(s.x);
      const y = transform.applyY(s.y) - s.r * Math.sqrt(zoomFactor) * 1.6 - 4;
      const w = ctx.measureText(s.m.title).width;
      const box = [x - w / 2 - 2, y - 13, x + w / 2 + 2, y + 1];
      if (s !== active && placed.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
      placed.push(box);
      ctx.fillStyle = "rgba(5,7,12,0.65)";
      ctx.fillText(s.m.title, x + 1, y + 1);
      ctx.fillStyle = isForced ? "#ffffff" : "rgba(230,237,243,0.78)";
      ctx.fillText(s.m.title, x, y);
    }
  }

  // --------------------------------------------------------------
  // Interaction
  // --------------------------------------------------------------

  function starAt(event) {
    const [mx, my] = d3.pointer(event, canvasEl);
    const [wx, wy] = transform.invert([mx, my]);
    const s = quadtree.find(wx, wy, 14 / transform.k);
    if (s && highlight != null && groupOf(s) !== highlight) return null;
    return s || null;
  }

  function onMove(event) {
    setHover(starAt(event), event);
  }

  function setHover(s, event) {
    if (s !== hovered) {
      hovered = s;
      canvasEl.style.cursor = s ? "pointer" : "grab";
      draw();
    }
    if (!s) {
      tooltip.style("opacity", 0);
      return;
    }
    const m = s.m;
    tooltip
      .html(
        `<div class="tt-title">${esc(titleYear(m))}</div>
         <div class="tt-sub">${esc(m.genres.join(" · ") || "No genre")}</div>
         <div class="tt-row">${
           s.mode === "audience"
             ? `MovieLens ${m.ratingMean.toFixed(2)}/5 · TMDB ${m.voteAverage.toFixed(1)}/10<br>${num(m.fans)} MovieLens fans · placed by audience overlap`
             : `TMDB ${m.voteAverage.toFixed(1)}/10 · no MovieLens data, placed by content similarity`
         }</div>
         <div class="tt-hint">${s === selected ? "Click again to deselect and zoom out" : "Click to zoom in"} · lines show its nearest ${s.mode === "audience" ? "audience" : "content"} neighbors</div>`
      )
      .style("opacity", 1);
    const [mx, my] = d3.pointer(event, root.select(".universe-stage").node());
    const tip = tooltip.node().getBoundingClientRect();
    tooltip
      .style("left", `${mx + 14 + tip.width > width ? mx - tip.width - 14 : mx + 14}px`)
      .style("top", `${my + 14 + tip.height > height ? Math.max(0, my - tip.height - 14) : my + 14}px`);
  }

  function onClick(event) {
    if (event.defaultPrevented) return; // end of a drag
    const s = starAt(event);
    if (s && s === selected) zoomOut(); // second click on the selected star
    else if (s) flyTo(s.mode, s.id);
    else select(null);
  }

  function select(s) {
    selected = s;
    draw();
    renderPanel();
  }

  function focusTransform(s, k) {
    return d3.zoomIdentity.translate(width / 2 - k * s.x, height / 2 - k * s.y).scale(k);
  }

  // Zoom so the star and its constellation of neighbors fit on screen.
  function flyTo(mode, id) {
    load().then(() => {
      const s = byKey.get(`${mode}:${id}`);
      if (!s) return;
      select(s);
      const pts = [s, ...neighborsOf(s).map((n) => n.star)];
      const dx = Math.max(...pts.map((p) => Math.abs(p.x - s.x)));
      const dy = Math.max(...pts.map((p) => Math.abs(p.y - s.y)));
      const fit = Math.min(width / (2 * dx + 80), height / (2 * dy + 80));
      const k = Math.max(base.k * 1.5, Math.min(base.k * 10, fit));
      d3.select(canvasEl).transition().duration(1400).call(zoom.transform, focusTransform(s, k));
    });
  }

  // Deselect and pull the camera back to the whole universe.
  function zoomOut() {
    select(null);
    d3.select(canvasEl).transition().duration(1000).call(zoom.transform, base);
  }

  function reset() {
    highlight = null;
    selected = null;
    hovered = null;
    renderControls();
    renderPanel();
    d3.select(canvasEl).transition().duration(900).call(zoom.transform, base);
  }

  // --------------------------------------------------------------
  // Controls (color mode + legend) and side panel
  // --------------------------------------------------------------

  function renderControls() {
    root
      .selectAll(".color-mode button")
      .classed("active", function () {
        return this.dataset.color === colorMode;
      })
      .on("click", function () {
        colorMode = this.dataset.color;
        highlight = null;
        renderControls();
        draw();
      });

    const groups =
      colorMode === "genre"
        ? [...ex.topGenres, "Other"].map((g) => ({ key: g, label: g, color: ex.color(g) }))
        : d3.range(1930, 2030, 10).map((d) => ({ key: d, label: d === 1930 ? "≤1930s" : `${d}s`, color: decadeColor(d) }));
    root
      .select(".universe-legend")
      .selectAll("button")
      .data(groups, (d) => `${colorMode}:${d.key}`)
      .join((enter) => {
        const b = enter.append("button").attr("class", "legend-btn");
        b.append("span").attr("class", "dot");
        b.append("span");
        return b;
      })
      .classed("active", (d) => highlight === d.key)
      .classed("muted", (d) => highlight != null && highlight !== d.key)
      .on("click", (event, d) => {
        highlight = highlight === d.key ? null : d.key;
        if (selected && highlight != null && groupOf(selected) !== highlight) selected = null;
        renderControls();
        renderPanel();
        draw();
      })
      .call((b) => b.select(".dot").style("background", (d) => d.color))
      .call((b) => b.select("span:last-child").text((d) => d.label));
  }

  function renderCard() {
    const card = root.select(".universe-card");
    card.classed("hidden", !selected);
    if (!selected) return;
    const s = selected;
    const audience = s.mode === "audience";
    const rows = neighborsOf(s)
      .slice(0, 6)
      .map(
        (n) => `<li><button data-key="${n.star.key}">${esc(n.star.m.title)}</button>
          <span class="card-num">${audience ? pct(n.strength) : ""}</span></li>`
      )
      .join("");
    card.html(`
      <h4>${esc(s.m.title)} <span class="card-sub">${s.m.year ?? ""}</span></h4>
      <div class="card-sub">${esc(s.m.genres.join(" · "))}</div>
      <div class="card-sub">${
        audience
          ? `MovieLens ${s.m.ratingMean.toFixed(2)}/5 · TMDB ${s.m.voteAverage.toFixed(1)}/10<br>${num(s.m.fans)} MovieLens fans · nearest by audience overlap:`
          : "No MovieLens data · placed beside similar-content movies:"
      }</div>
      <ol>${rows}</ol>
      ${audience ? `<a href="viz1.html#movie=${s.id}">Explore its neighborhood →</a>` : `<a href="viz1.html">Open the full explorer →</a>`}`);
    card.selectAll("li button").on("click", function () {
      const t = byKey.get(this.dataset.key);
      flyTo(t.mode, t.id);
    });
  }

  function renderPanel() {
    const panel = ex.panel;
    if (!panel) return renderCard();
    if (!selected) {
      const nHist = stars.filter((s) => s.mode === "audience").length;
      panel.html(`
        <h2>Movie universe</h2>
        <p class="panel-muted">All ${num(stars.length)} movies at once. Each star is a movie; brighter,
          larger stars have more TMDB votes.</p>
        <ul class="panel-help">
          <li><strong>Round stars</strong> (${num(nHist)}) have MovieLens ratings, including 2016+ releases
            rated before October 2023, and are placed by <strong>audience overlap</strong>: movies near each
            other are liked by the same people (UMAP on 1 − Jaccard).</li>
          <li><strong>Four-point stars</strong> (${num(stars.length - nHist)}) have no MovieLens ratings, mostly
            because they came out after its October 2023 snapshot. Each sits beside the movies it most
            resembles in <strong>content</strong>, so their positions are approximate.</li>
          <li><strong>Scroll or pinch</strong> to zoom, drag to pan; more titles appear as you zoom in.</li>
          <li><strong>Hover</strong> a star to draw lines to its nearest neighbors; <strong>click</strong> it to
            zoom in on it and its neighbors. Click it again to deselect and zoom back out; click empty
            space to deselect without moving.</li>
          <li><strong>Color by decade</strong> to see the strongest pattern here: shared audiences
            follow release era more than genre.</li>
          <li><strong>Search</strong> above to fly to any movie.</li>
        </ul>`);
      return;
    }

    const s = selected;
    const m = s.m;
    const audience = s.mode === "audience";
    const neighbors = neighborsOf(s);
    const rows = neighbors
      .map(
        (n) => `<li><button class="row-btn" data-key="${n.star.key}">
          <span class="dot" style="background:${colorOf(n.star)}"></span>
          <span class="row-title">${esc(n.star.m.title)}</span>
          <span class="row-bar ${audience ? "" : "bar-content"}"><span style="width:${Math.min(1, n.strength / (neighbors[0].strength || 1)) * 100}%"></span></span>
          <span class="row-num">${audience ? pct(n.strength) : (n.strength * 6).toFixed(1)}</span>
        </button></li>`
      )
      .join("");
    panel.html(`
      <div class="panel-badge ${audience ? "" : "badge-recent"}">${audience ? "Audience data" : "No MovieLens data · placed by content"}</div>
      <h2>${esc(m.title)} <span class="panel-year">${m.year ?? ""}</span></h2>
      <div class="chips">${m.genres.map((g) => `<span class="chip">${esc(g)}</span>`).join("")}</div>
      <dl class="facts">
        <dt>Director</dt><dd>${esc(m.directors.join(", ") || "—")}</dd>
        <dt>Starring</dt><dd>${esc(m.cast.join(", ") || "—")}</dd>
        ${audience ? `<dt>MovieLens</dt><dd>${m.ratingMean.toFixed(2)} / 5 from ${num(m.ratingCount)} ratings</dd>` : ""}
        <dt>TMDB</dt><dd>${m.voteAverage.toFixed(1)} / 10 from ${num(m.voteCount)} votes</dd>
      </dl>
      ${audience ? `<button class="expand-btn" type="button" id="universe-open">Explore in the audience network →</button>` : ""}
      <h3>${audience ? "Nearest by audience" : "Placed beside"}</h3>
      <p class="panel-muted">${
        audience
          ? "Share of combined fans who liked both. Click to fly there."
          : "Movies with the most similar content (shared people, genres, keywords); this star sits at their weighted average. Click to fly there."
      }</p>
      <ul class="row-list">${rows}</ul>`);

    panel.select("#universe-open").on("click", () => ex.open(s.id));
    panel.selectAll(".row-btn").on("click", function () {
      const t = byKey.get(this.dataset.key);
      flyTo(t.mode, t.id);
    });
  }

  // --------------------------------------------------------------
  // Public API (used by the explorer's mode switch, search and reset)
  // --------------------------------------------------------------

  window.viz1Universe = {
    show() {
      root.classed("hidden", false);
      load().then(() => {
        resize();
        renderControls();
        renderPanel();
        draw();
      });
    },
    hide() {
      root.classed("hidden", true);
      tooltip.style("opacity", 0);
    },
    flyTo,
    reset() {
      load().then(reset);
    },
  };

  // Without the explorer's side panel (homepage), start on our own.
  if (!document.getElementById("viz1-panel")) window.viz1Universe.show();
})();
