// Visualization 2: movie performance and audience discussion.
// A self-contained component: it builds its own controls inside an empty
// <div id="scatter" class="scatter">, so viz2.html and the homepage embed it the same
// way. Data comes from src/export_viz2_scatter.py.
//
// Two modes share one SVG and animate between each other:
//   discussion — x = rating, y = discussion (same-era vote-count percentile or raw
//                votes), median lines split four quadrants such as "hidden gems".
//   tone       — x = rating percentile, y = review-tone percentile; the diagonal is
//                "tone matches rating", distance from it = disagreement.

(async function () {
  const root = d3.select("#scatter");
  if (root.empty()) return;
  root.html(`
    <div class="scatter-bar">
      <div class="seg scatter-mode" role="group" aria-label="View">
        <button type="button" data-mode="discussion">Rating vs. discussion</button>
        <button type="button" data-mode="tone">Rating vs. review tone</button>
      </div>
      <div class="seg scatter-rating" role="group" aria-label="Rating source">
        <span>Rating</span>
        <button type="button" data-rating="tmdb">TMDB</button>
        <button type="button" data-rating="ml">MovieLens</button>
      </div>
      <div class="seg scatter-y" role="group" aria-label="Discussion measure">
        <span>Discussion</span>
        <button type="button" data-y="pct">vs. same era</button>
        <button type="button" data-y="raw">Raw votes</button>
      </div>
      <label class="scatter-size"><input type="checkbox" checked /> Size = box office</label>
      <select class="scatter-decade" aria-label="Release decade"><option value="all">All decades</option></select>
      <div class="scatter-search">
        <input type="search" placeholder="Find a movie…" autocomplete="off" aria-label="Find a movie" />
        <ul role="listbox"></ul>
      </div>
    </div>
    <div class="scatter-legend legend-bar" aria-label="Highlight a genre"></div>
    <div class="scatter-status">
      <span class="scatter-count"></span>
      <button type="button" class="scatter-reset-zoom hidden">Reset zoom</button>
      <span class="scatter-hint">Drag across empty space to zoom · double-click to zoom out</span>
    </div>
    <div class="scatter-body">
      <div class="scatter-chart">
        <svg role="img" aria-label="Scatterplot of movie rating against discussion"></svg>
        <div class="scatter-tooltip"></div>
      </div>
      <aside class="scatter-side" aria-live="polite"></aside>
    </div>`);
  const data = await d3.json("data/viz2_scatter.json");
  const movies = data.movies;

  const W = 900;
  const H = 600;
  const M = { top: 20, right: 24, bottom: 56, left: 64 };
  const DURATION = 800;

  const num = d3.format(",");
  const pct = d3.format(".0%");
  const money = (v) => (v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : `$${Math.round(v / 1e6)}M`);
  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const normalize = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const titleYear = (m) => `${m.title} (${m.year})`;

  // Same palette rule as Visualization 1 (nine most common primary genres + Other),
  // which yields the same genre order on this dataset, so colors match across pages.
  const primaryGenre = (m) => m.genres[0] || "Other";
  const topGenres = [...d3.rollup(movies, (v) => v.length, primaryGenre)]
    .sort((a, b) => d3.descending(a[1], b[1]))
    .slice(0, 9)
    .map((d) => d[0]);
  const genreOf = (m) => (topGenres.includes(primaryGenre(m)) ? primaryGenre(m) : "Other");
  const color = d3.scaleOrdinal().domain(topGenres).range(d3.schemeTableau10).unknown("#6e7681");
  const radius = d3.scaleSqrt().domain([0, d3.max(movies, (m) => m.revenue)]).range([1.5, 17]);

  // --------------------------------------------------------------
  // State
  // --------------------------------------------------------------

  const state = {
    mode: "discussion",
    rating: "tmdb", // or "ml"
    yScale: "pct", // discussion mode: "pct" (same-era percentile) or "raw" (votes)
    sizeByRevenue: true,
    decade: "all",
    genre: null,
    region: null, // selected quadrant/side key
    selected: null, // selected movie
    zoom: null, // [[x0, x1], [y0, y1]] in data units, or null
  };

  // --------------------------------------------------------------
  // Accessors per mode
  // --------------------------------------------------------------

  const ratingOf = (m) => (state.rating === "ml" ? m.ml : m.tmdb);
  // Discussion percentile matching the current y-axis: same-era, or among all movies.
  const votesRank = new Map([...movies].sort((a, b) => a.votes - b.votes).map((m, i) => [m, i / (movies.length - 1)]));
  const discussionPctOf = (m) => (rawVotes() ? votesRank.get(m) : m.discussionPct);
  const ratingPctOf = (m) => (state.rating === "ml" ? m.mlPct : m.ratingPct);

  function xOf(m) {
    if (state.mode === "tone") return state.rating === "ml" ? m.toneMlPct : m.toneRatingPct;
    return ratingOf(m);
  }
  // Tone takes few distinct values (most movies have 3-6 reviews), so ties stack into
  // rows; a small fixed per-movie jitter (±1.5 percentile points) separates them.
  const jitter = (m) => ((((m.id * 2654435761) >>> 0) % 1000) / 1000 - 0.5) * 0.03;
  function yOf(m) {
    if (state.mode === "tone") return m.tonePct == null ? null : m.tonePct + jitter(m);
    return state.yScale === "pct" ? m.discussionPct : m.votes;
  }
  const decadeOk = (m) => state.decade === "all" || Math.floor(m.year / 10) * 10 === +state.decade;
  const inScope = (m) => xOf(m) != null && yOf(m) != null && decadeOk(m);

  // Regions: quadrants (discussion) or the two sides of the diagonal (tone).
  // `score` ranks movies inside a region for the side list (higher = more typical).
  const REGIONS = {
    discussion: [
      { key: "gems", label: "Hidden gems", sub: "high rating, little discussion", corner: "br",
        test: (m, mx, my) => xOf(m) >= mx && yOf(m) < my, score: (m) => ratingPctOf(m) - discussionPctOf(m) },
      { key: "hits", label: "Acclaimed hits", sub: "high rating, much discussion", corner: "tr",
        test: (m, mx, my) => xOf(m) >= mx && yOf(m) >= my, score: (m) => ratingPctOf(m) + discussionPctOf(m) },
      { key: "buzz", label: "Talked about despite low ratings", sub: "low rating, much discussion", corner: "tl",
        test: (m, mx, my) => xOf(m) < mx && yOf(m) >= my, score: (m) => discussionPctOf(m) - ratingPctOf(m) },
      { key: "quiet", label: "Low rated, little discussed", sub: "low rating, little discussion", corner: "bl",
        test: (m, mx, my) => xOf(m) < mx && yOf(m) < my, score: (m) => -(ratingPctOf(m) + discussionPctOf(m)) },
    ],
    tone: [
      { key: "warm", label: "Reviewed warmer than rated", sub: "reviews more positive than the rating", corner: "tl",
        test: (m) => m.tonePct > xOf(m), score: (m) => m.tonePct - xOf(m) }, // un-jittered tone
      { key: "harsh", label: "Rated higher than reviewed", sub: "reviews more negative than the rating", corner: "br",
        test: (m) => m.tonePct < xOf(m), score: (m) => xOf(m) - m.tonePct },
    ],
  };

  // --------------------------------------------------------------
  // SVG scaffolding
  // --------------------------------------------------------------

  const svg = root.select("svg").attr("viewBox", `0 0 ${W} ${H}`);
  const defs = svg.append("defs");
  defs.append("clipPath").attr("id", "scatter-clip").append("rect")
    .attr("x", M.left).attr("y", M.top).attr("width", W - M.left - M.right).attr("height", H - M.top - M.bottom);

  const gx = svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - M.bottom})`);
  const gy = svg.append("g").attr("class", "axis").attr("transform", `translate(${M.left},0)`);
  const xLabel = svg.append("text").attr("class", "axis-label").attr("text-anchor", "middle")
    .attr("x", (M.left + W - M.right) / 2).attr("y", H - 14);
  const yLabel = svg.append("text").attr("class", "axis-label").attr("text-anchor", "middle")
    .attr("transform", `translate(18,${(M.top + H - M.bottom) / 2}) rotate(-90)`);

  const plot = svg.append("g").attr("clip-path", "url(#scatter-clip)");
  const brushLayer = plot.append("g").attr("class", "brush");
  const guideLayer = plot.append("g").attr("class", "guides");
  const dotLayer = plot.append("g");
  const regionLayer = svg.append("g");
  const ringLayer = plot.append("g");
  const tooltip = root.select(".scatter-tooltip");

  const x = d3.scaleLinear();
  let yImpl = d3.scaleLinear(); // linear, or log for raw vote counts
  const Y = (v) => yImpl(v);
  const rawVotes = () => state.mode === "discussion" && state.yScale === "raw";

  // --------------------------------------------------------------
  // Scales
  // --------------------------------------------------------------

  function updateScales(visible) {
    const pad = (lo, hi) => [lo - (hi - lo) * 0.03, hi + (hi - lo) * 0.03];
    let xd, yd;
    if (state.mode === "tone") {
      xd = [-0.02, 1.02];
      yd = [-0.02, 1.02];
    } else {
      xd = pad(...d3.extent(visible, xOf));
      yd = state.yScale === "pct" ? [-0.02, 1.02] : d3.extent(visible, yOf);
    }
    if (state.zoom) [xd, yd] = state.zoom;
    x.domain(xd).range([M.left, W - M.right]);
    yImpl = (rawVotes() ? d3.scaleLog() : d3.scaleLinear()).domain(yd).range([H - M.bottom, M.top]);
    if (rawVotes() && !state.zoom) yImpl.nice();
  }

  // --------------------------------------------------------------
  // Render
  // --------------------------------------------------------------

  function render(animate = true) {
    if (state.selected && !inScope(state.selected)) state.selected = null;
    const visible = movies.filter(inScope);
    updateScales(visible);
    const t = svg.transition().duration(animate ? DURATION : 0).ease(d3.easeCubicInOut);

    // Axes
    gx.transition(t).call(d3.axisBottom(x).ticks(8).tickFormat(state.mode === "tone" ? pct : d3.format(".1f")));
    const yAxis = d3.axisLeft(yImpl).ticks(6, rawVotes() ? "~s" : undefined);
    if (!rawVotes()) yAxis.tickFormat(pct);
    gy.transition(t).call(yAxis);
    xLabel.text(
      state.mode === "tone"
        ? `${state.rating === "ml" ? "MovieLens" : "TMDB"} rating (percentile among movies with ≥${data.minReviews} reviews) →`
        : state.rating === "ml" ? "MovieLens average rating (0.5–5) →" : "TMDB average rating (0–10) →"
    );
    yLabel.text(
      state.mode === "tone"
        ? "Review tone (percentile of positive-review share) →"
        : state.yScale === "pct"
          ? `Discussion vs. movies released ±${data.yearWindow} years (TMDB votes percentile) →`
          : "TMDB votes (log scale) →"
    );

    // Medians (discussion) or diagonal (tone)
    const mx = d3.median(visible, xOf);
    const my = d3.median(visible, yOf);
    state.medians = [mx, my];
    const guides = state.mode === "tone"
      ? [{ k: "diag", x1: 0, y1: 0, x2: 1, y2: 1 }]
      : [
          { k: "mx", x1: mx, y1: yImpl.domain()[0], x2: mx, y2: yImpl.domain()[1] },
          { k: "my", x1: x.domain()[0], y1: my, x2: x.domain()[1], y2: my },
        ];
    guideLayer.selectAll("line").data(guides, (d) => d.k)
      .join((e) => e.append("line").attr("class", "guide").style("opacity", 0))
      .transition(t).style("opacity", 1)
      .attr("x1", (d) => x(d.x1)).attr("y1", (d) => Y(d.y1)).attr("x2", (d) => x(d.x2)).attr("y2", (d) => Y(d.y2));

    // Dots (data join keyed by movie so mode switches animate)
    const visibleSet = new Set(visible);
    const regionTest = activeRegion();
    dotLayer.selectAll("circle").data(movies, (m) => m.id)
      .join((e) => e.append("circle").attr("class", "dot")
        .attr("cx", (M.left + W - M.right) / 2).attr("cy", (M.top + H - M.bottom) / 2).attr("r", 0)
        .on("mouseenter", (event, m) => showTooltip(event, m))
        .on("mousemove", moveTooltip)
        .on("mouseleave", hideTooltip)
        .on("click", (event, m) => selectMovie(m)))
      .attr("fill", (m) => color(genreOf(m)))
      .classed("hidden-dot", (m) => !visibleSet.has(m))
      .sort((a, b) => d3.descending(a.revenue, b.revenue)) // big bubbles behind small ones
      .transition(t)
      .attr("cx", (m) => (visibleSet.has(m) ? x(xOf(m)) : x(x.domain()[0])))
      .attr("cy", (m) => (visibleSet.has(m) ? Y(yOf(m)) : Y(yImpl.domain()[0])))
      .attr("r", (m) => (visibleSet.has(m) ? (state.sizeByRevenue ? radius(m.revenue) : 3) : 0))
      .style("opacity", (m) => dotOpacity(m, regionTest));

    renderRegions(visible);
    renderRing();
    renderSide(visible);
    renderControls(visible);
  }

  function activeRegion() {
    if (!state.region) return null;
    const r = REGIONS[state.mode].find((d) => d.key === state.region);
    return r ? (m) => r.test(m, ...state.medians) : null;
  }

  function dotOpacity(m, regionTest) {
    if (!inScope(m)) return 0;
    if (state.selected && state.selected !== m) return 0.25;
    if (state.genre && genreOf(m) !== state.genre) return 0.07;
    if (regionTest && !regionTest(m)) return 0.1;
    return 0.75;
  }

  function restyle() {
    const regionTest = activeRegion();
    dotLayer.selectAll("circle").transition().duration(200).style("opacity", (m) => dotOpacity(m, regionTest));
    renderRing();
  }

  // Faint region names in the plot corners (orientation only; they don't block the
  // bubbles underneath). Regions are selected from the side panel.
  function renderRegions(visible) {
    const pos = {
      tl: [M.left + 10, M.top + 16, "start"],
      tr: [W - M.right - 10, M.top + 16, "end"],
      bl: [M.left + 10, H - M.bottom - 10, "start"],
      br: [W - M.right - 10, H - M.bottom - 10, "end"],
    };
    state.regionCounts = Object.fromEntries(
      REGIONS[state.mode].map((r) => [r.key, visible.filter((m) => r.test(m, ...state.medians)).length])
    );
    regionLayer.selectAll("text.region-mark").data(REGIONS[state.mode], (d) => `${state.mode}:${d.key}`)
      .join("text").attr("class", "region-mark")
      .attr("x", (d) => pos[d.corner][0]).attr("y", (d) => pos[d.corner][1])
      .attr("text-anchor", (d) => pos[d.corner][2])
      .classed("active", (d) => state.region === d.key)
      .text((d) => d.label);
  }

  // Ring around the selected movie.
  function renderRing() {
    const m = state.selected && inScope(state.selected) ? [state.selected] : [];
    ringLayer.selectAll("circle").data(m, (d) => d.id)
      .join("circle").attr("class", "ring")
      .attr("cx", (d) => x(xOf(d))).attr("cy", (d) => Y(yOf(d)))
      .attr("r", (d) => (state.sizeByRevenue ? radius(d.revenue) : 3) + 5);
  }

  // --------------------------------------------------------------
  // Tooltip
  // --------------------------------------------------------------

  function showTooltip(event, m) {
    const rows = [
      `TMDB ${m.tmdb.toFixed(1)}/10${m.ml != null ? ` · MovieLens ${m.ml.toFixed(2)}/5` : ""}`,
      `${num(m.votes)} TMDB votes · ${pct(m.discussionPct)} of same-era movies have fewer`,
      `Box office ${money(m.revenue)}`,
      m.tone != null
        ? `${pct(m.pctPositive)} positive across ${m.reviews} reviews`
        : `${m.reviews} review${m.reviews === 1 ? "" : "s"} (too few for a tone score)`,
    ];
    tooltip.html(`<div class="tt-title">${esc(titleYear(m))}</div>
      <div class="tt-sub">${esc(m.genres.join(" · "))}</div>
      ${rows.map((r) => `<div class="tt-row">${r}</div>`).join("")}
      <div class="tt-hint">Click for details</div>`).style("opacity", 1);
    moveTooltip(event);
  }

  function moveTooltip(event) {
    const wrap = root.select(".scatter-chart").node().getBoundingClientRect();
    const tip = tooltip.node().getBoundingClientRect();
    let left = event.clientX - wrap.left + 14;
    let top = event.clientY - wrap.top + 14;
    if (left + tip.width > wrap.width) left = event.clientX - wrap.left - tip.width - 14;
    if (top + tip.height > wrap.height) top = Math.max(0, event.clientY - wrap.top - tip.height - 14);
    tooltip.style("left", `${left}px`).style("top", `${top}px`);
  }

  const hideTooltip = () => tooltip.style("opacity", 0);

  // --------------------------------------------------------------
  // Side panel: region list or movie detail
  // --------------------------------------------------------------

  const side = root.select(".scatter-side");
  const chips = (items, cls = "") => items.map((t) => `<span class="chip ${cls}">${esc(t)}</span>`).join("");

  function selectMovie(m) {
    state.selected = state.selected === m ? null : m;
    restyle();
    renderSide(movies.filter(inScope));
  }

  function renderSide(visible) {
    if (state.selected) return renderDetail(state.selected);
    const regions = REGIONS[state.mode];
    const region = regions.find((r) => r.key === state.region);
    if (!region) {
      side.html(`
        <h3>${state.mode === "tone" ? "Rating vs. review tone" : "Rating vs. discussion"}</h3>
        <p class="side-muted">${
          state.mode === "tone"
            ? `${num(visible.length)} movies with at least ${data.minReviews} TMDB reviews. Movies on the diagonal are reviewed about as warmly as they are rated; distance from it is disagreement.
               Points are jittered slightly up and down to separate ties.
               The tone score is a sentiment model's positive/negative label per review, adjusted toward the ${pct(data.tonePrior)} average for movies with few reviews. It can read dark or violent subject matter as negative, so check the review keywords before trusting a large gap.`
            : `${num(visible.length)} movies with box-office revenue. The lines are medians of the movies shown. ${
                rawVotes()
                  ? "Discussion is raw TMDB votes, so older movies, which have had longer to collect votes, sit higher; switch to “vs. same era” to compare like with like."
                  : `Discussion is compared with movies released within ±${data.yearWindow} years, so older movies' extra decades of votes don't push recent ones down.`
              }`
        }</p>
        <p class="side-muted">Pick a region below to highlight it and list its most typical movies, or click any bubble for details.</p>
        <ul class="side-regions">${regions
          .map((r) => `<li><button data-key="${r.key}"><strong>${r.label} (${num(state.regionCounts[r.key])})</strong><span>${r.sub}</span></button></li>`)
          .join("")}</ul>`);
      side.selectAll(".side-regions button").on("click", function () {
        state.region = this.dataset.key;
        restyle();
        renderRegions(movies.filter(inScope));
        renderSide(movies.filter(inScope));
      });
      return;
    }
    const members = visible
      .filter((m) => region.test(m, ...state.medians) && (!state.genre || genreOf(m) === state.genre))
      .filter((m) => region.score(m) != null && !Number.isNaN(region.score(m)))
      .sort((a, b) => d3.descending(region.score(a), region.score(b)))
      .slice(0, 15);
    side.html(`
      <button class="side-back" type="button">← All regions</button>
      <h3>${region.label}</h3>
      <p class="side-muted">${region.sub}. Most typical first${state.genre ? `, ${esc(state.genre)} only` : ""}.</p>
      <ol class="side-list">${members
        .map((m) => `<li><button data-id="${m.id}"><span class="dot" style="background:${color(genreOf(m))}"></span>
          <span class="side-title">${esc(m.title)}</span><span class="side-year">${m.year}</span></button></li>`)
        .join("") || `<li class="side-muted">No movies here with the current filters.</li>`}</ol>`);
    side.select(".side-back").on("click", () => {
      state.region = null;
      restyle();
      renderRegions(movies.filter(inScope));
      renderSide(movies.filter(inScope));
    });
    side.selectAll(".side-list button").on("click", function () {
      selectMovie(movies.find((m) => m.id === +this.dataset.id));
    });
  }

  function renderDetail(m) {
    const tone = m.tone != null
      ? `<div class="sentiment-bar"><span style="width:${m.pctPositive * 100}%"></span></div>
         <div class="side-muted">${pct(m.pctPositive)} positive across ${m.reviews} TMDB reviews
           (tone percentile ${pct(m.tonePct)})</div>`
      : `<div class="side-muted">${m.reviews} TMDB review${m.reviews === 1 ? "" : "s"}, too few for a tone score.</div>`;
    side.html(`
      <button class="side-back" type="button">← Back</button>
      <h3>${esc(m.title)} <span class="side-year">${m.year}</span></h3>
      <div class="chips">${chips(m.genres)}</div>
      <dl class="side-facts">
        <dt>Director</dt><dd>${esc(m.directors.join(", ") || "—")}</dd>
        <dt>Starring</dt><dd>${esc(m.cast.join(", ") || "—")}</dd>
        <dt>TMDB</dt><dd>${m.tmdb.toFixed(1)} / 10 from ${num(m.votes)} votes</dd>
        ${m.ml != null ? `<dt>MovieLens</dt><dd>${m.ml.toFixed(2)} / 5 from ${num(m.mlCount)} ratings</dd>` : ""}
        <dt>Box office</dt><dd>${money(m.revenue)}</dd>
        <dt>Discussion</dt><dd>more votes than ${pct(m.discussionPct)} of movies released ±${data.yearWindow} years</dd>
      </dl>
      <h4>Review tone</h4>
      ${tone}
      <h4>Most mentioned in reviews</h4>
      <div class="chips">${chips(m.reviewKeywords, "chip-kw") || `<span class="side-muted">No review keywords.</span>`}</div>
      ${m.mlId != null ? `<a class="side-link" href="viz1.html#movie=${m.mlId}">See who else its fans liked (Visualization 1) →</a>` : ""}`);
    side.select(".side-back").on("click", () => selectMovie(m));
  }

  // --------------------------------------------------------------
  // Controls
  // --------------------------------------------------------------

  function setActive(selector, attr, value) {
    root.selectAll(selector).classed("active", function () {
      return this.dataset[attr] === value;
    });
  }

  function renderControls(visible) {
    setActive(".scatter-mode button", "mode", state.mode);
    setActive(".scatter-rating button", "rating", state.rating);
    setActive(".scatter-y button", "y", state.yScale);
    root.select(".scatter-y").classed("hidden", state.mode !== "discussion");
    root.select(".scatter-size input").property("checked", state.sizeByRevenue);
    root.select(".scatter-reset-zoom").classed("hidden", !state.zoom);

    root.select(".scatter-legend").selectAll("button")
      .data([...topGenres, "Other"])
      .join((e) => {
        const b = e.append("button").attr("class", "legend-btn");
        b.append("span").attr("class", "dot");
        b.append("span").attr("class", "legend-label");
        return b;
      })
      .classed("active", (g) => state.genre === g)
      .classed("muted", (g) => state.genre && state.genre !== g)
      .on("click", (event, g) => {
        state.genre = state.genre === g ? null : g;
        restyle();
        renderControls(movies.filter(inScope));
        renderSide(movies.filter(inScope));
      })
      .call((b) => b.select(".dot").style("background", (g) => color(g)))
      .call((b) => b.select(".legend-label").text((g) => g));

    const hiddenNote = [];
    if (state.rating === "ml") hiddenNote.push("movies without MovieLens ratings are hidden");
    if (state.mode === "tone") hiddenNote.push(`movies with fewer than ${data.minReviews} reviews are hidden`);
    root.select(".scatter-count").text(
      `${num(visible.length)} of ${num(movies.length)} movies shown${hiddenNote.length ? ` (${hiddenNote.join("; ")})` : ""}`
    );
  }

  root.selectAll(".scatter-mode button").on("click", function () {
    if (state.mode === this.dataset.mode) return;
    state.mode = this.dataset.mode;
    state.region = null;
    state.zoom = null;
    render();
  });
  root.selectAll(".scatter-rating button").on("click", function () {
    state.rating = this.dataset.rating;
    state.zoom = null;
    render();
  });
  root.selectAll(".scatter-y button").on("click", function () {
    state.yScale = this.dataset.y;
    state.zoom = null;
    render();
  });
  root.select(".scatter-size input").on("change", function () {
    state.sizeByRevenue = this.checked;
    render();
  });
  root.select(".scatter-decade").on("change", function () {
    state.decade = this.value;
    state.zoom = null;
    render();
  });
  root.select(".scatter-decade").selectAll("option.decade")
    .data([...new Set(movies.map((m) => Math.floor(m.year / 10) * 10))].sort())
    .join("option").attr("class", "decade").attr("value", (d) => d).text((d) => `${d}s`);

  // Brush to zoom; the reset button (or double-click) zooms back out.
  const brush = d3.brush()
    .extent([[M.left, M.top], [W - M.right, H - M.bottom]])
    .on("end", (event) => {
      if (!event.selection) return;
      const [[x0, y0], [x1, y1]] = event.selection;
      brushLayer.call(brush.move, null);
      if (Math.abs(x1 - x0) < 8 || Math.abs(y1 - y0) < 8) return;
      state.zoom = [[x.invert(x0), x.invert(x1)], [yImpl.invert(y1), yImpl.invert(y0)]];
      render();
    });
  brushLayer.call(brush);
  svg.on("dblclick", () => {
    if (!state.zoom) return;
    state.zoom = null;
    render();
  });
  root.select(".scatter-reset-zoom").on("click", () => {
    state.zoom = null;
    render();
  });

  // Search: highlight a movie and open its details.
  const searchInput = root.select(".scatter-search input");
  const results = root.select(".scatter-search ul");
  const index = movies.map((m) => ({ m, key: normalize(m.title) }));
  let matches = [];
  function showResults() {
    const q = normalize(searchInput.property("value").trim());
    if (!q) return results.style("display", "none");
    matches = index
      .filter((d) => d.key.includes(q))
      .sort((a, b) => d3.descending(a.key.startsWith(q), b.key.startsWith(q)) || d3.descending(a.m.votes, b.m.votes))
      .slice(0, 8)
      .map((d) => d.m);
    results.style("display", "block").selectAll("li").data(matches.length ? matches : [null]).join("li")
      .html((m) => (m ? `${esc(m.title)} <span class="side-muted">${m.year}</span>` : `<span class="side-muted">No match among movies with box-office data.</span>`))
      .on("mousedown", (event, m) => m && pick(m));
  }
  function pick(m) {
    searchInput.property("value", m.title);
    results.style("display", "none");
    if (!inScope(m)) {
      // Make the movie visible: clear the filters that hide it.
      state.decade = "all";
      root.select(".scatter-decade").property("value", "all");
      if (state.rating === "ml" && m.ml == null) state.rating = "tmdb";
      if (state.mode === "tone" && m.tone == null) state.mode = "discussion";
      state.zoom = null;
      render();
    }
    state.selected = null;
    selectMovie(m);
  }
  searchInput.on("input", showResults).on("focus", showResults)
    .on("blur", () => results.style("display", "none"))
    .on("keydown", (event) => {
      if (event.key === "Enter" && matches.length) pick(matches[0]);
      if (event.key === "Escape") results.style("display", "none");
    });

  render(false);
})();
