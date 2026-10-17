(function () {
  "use strict";

  const root = d3.select("#heatmap");
  if (root.empty()) return;
  const logic = window.WatchNextViz;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || false;
  const DURATION = logic.motionDuration(420, reducedMotion);

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

  d3.json("data/viz4_genre_heatmap.json").then((data) => {
    const cells = data.cells || data.data || [];
    const years = data.metadata?.years || [...new Set(cells.map((cell) => +cell.year))].sort(d3.ascending);
    const genres = data.metadata?.genres || [...new Set(cells.map((cell) => cell.genre))];
    let metric = data.metadata?.default_metric || "weighted_rating";
    let pinnedCell = null;
    let moviesExpanded = false;
    let detailCloseTimer = null;

    d3.select("#genre-count").text(genres.length);

    const margin = { top: 150, right: 210, bottom: 45, left: 135 };
    const cellWidth = 68;
    const cellHeight = 36;
    const innerWidth = years.length * cellWidth;
    const innerHeight = genres.length * cellHeight;
    const width = margin.left + innerWidth + margin.right;
    const height = margin.top + innerHeight + margin.bottom;

    const svg = root.append("svg").attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img").attr("aria-label", "Genre by release year heatmap");
    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient").attr("id", "viz4-gradient")
      .attr("x1", "0%").attr("x2", "100%").attr("y1", "0%").attr("y2", "0%");
    const chart = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const x = d3.scaleBand().domain(years).range([0, innerWidth]).padding(0.04);
    const y = d3.scaleBand().domain(genres).range([0, innerHeight]).padding(0.04);

    const columnBand = chart.append("rect").attr("class", "heatmap-focus-band heatmap-focus-band--column")
      .attr("y", -8).attr("height", innerHeight + 16).attr("rx", 7).attr("opacity", 0);
    const rowBand = chart.append("rect").attr("class", "heatmap-focus-band heatmap-focus-band--row")
      .attr("x", -8).attr("width", innerWidth + 16).attr("rx", 7).attr("opacity", 0);

    const xAxisGroup = chart.append("g").attr("class", "heatmap-axis heatmap-x-axis")
      .call(d3.axisTop(x).tickSize(0).tickPadding(12).tickFormat((year) => +year === 2026 ? "2026*" : year));
    const yAxisGroup = chart.append("g").attr("class", "heatmap-axis heatmap-y-axis")
      .call(d3.axisLeft(y).tickSize(0).tickPadding(10));
    xAxisGroup.select(".domain").remove();
    yAxisGroup.select(".domain").remove();

    const cellSelection = chart.selectAll("rect.heatmap-cell").data(cells, (cell) => `${cell.genre}|${cell.year}`).join("rect")
      .attr("class", "heatmap-cell")
      .attr("x", (cell) => x(+cell.year)).attr("y", (cell) => y(cell.genre))
      .attr("width", x.bandwidth()).attr("height", y.bandwidth()).attr("rx", 3).attr("ry", 3)
      .attr("stroke", "#f0f6fc").attr("stroke-width", 0)
      .attr("tabindex", 0).attr("role", "button")
      .attr("aria-label", (cell) => `${cell.genre}, ${cell.year}. Select to view ${cell.movie_count} movies.`)
      .on("mouseenter", highlightCell).on("mousemove", moveTooltip).on("mouseleave", handleCellLeave)
      .on("click", (event, cell) => {
        event.stopPropagation();
        if (pinnedCell && cellKey(pinnedCell) === cellKey(cell)) clearPinnedCell();
        else pinCell(cell);
      })
      .on("keydown", (event, cell) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        if (pinnedCell && cellKey(pinnedCell) === cellKey(cell)) clearPinnedCell();
        else pinCell(cell);
      });

    // Story annotation: outline the genre that leads the active metric over the complete
    // years (2026 is partial), so the chapter's finding is visible before any interaction.
    const fullYearCells = cells.filter((cell) => +cell.year !== 2026);
    const annotation = chart.append("g").attr("class", "heatmap-annotation").attr("pointer-events", "none");
    const annotationBox = annotation.append("rect").attr("x", -6).attr("width", innerWidth + 12)
      .attr("height", y.bandwidth() + 8).attr("rx", 6).attr("fill", "none")
      .attr("stroke", "#f2cf7a").attr("stroke-width", 2).attr("stroke-dasharray", "6 4");
    const annotationTick = annotation.append("line").attr("x1", innerWidth + 6).attr("x2", innerWidth + 18)
      .attr("stroke", "#f2cf7a").attr("stroke-width", 1.5);
    const annotationLabel = annotation.append("text").attr("x", innerWidth + 24).attr("fill", "#f2cf7a")
      .attr("font-size", 12).attr("font-weight", 700);
    const annotationValue = annotation.append("text").attr("x", innerWidth + 24).attr("fill", "#e9e3d9")
      .attr("font-size", 12);

    const legendX = margin.left;
    const legendY = 38;
    const legendWidth = 320;
    const legendHeight = 11;
    const legend = svg.append("g").attr("class", "heatmap-legend");
    const legendTitle = legend.append("text").attr("x", legendX).attr("y", legendY - 14)
      .attr("fill", "#e6edf3").attr("font-size", 12).attr("font-weight", 700);
    legend.append("rect").attr("x", legendX).attr("y", legendY).attr("width", legendWidth)
      .attr("height", legendHeight).attr("rx", 3).attr("fill", "url(#viz4-gradient)");
    const legendMin = legend.append("text").attr("x", legendX).attr("y", legendY + 31)
      .attr("fill", "#8b949e").attr("font-size", 10);
    const legendMax = legend.append("text").attr("x", legendX + legendWidth).attr("y", legendY + 31)
      .attr("text-anchor", "end").attr("fill", "#8b949e").attr("font-size", 10);
    const legendLow = legend.append("text").attr("x", legendX).attr("y", legendY + 52)
      .attr("fill", "#8b949e").attr("font-size", 9.5);
    const legendHigh = legend.append("text").attr("x", legendX + legendWidth).attr("y", legendY + 52)
      .attr("text-anchor", "end").attr("fill", "#8b949e").attr("font-size", 9.5);

    svg.append("text").attr("x", margin.left + innerWidth).attr("y", margin.top - 42)
      .attr("text-anchor", "end").attr("fill", "#8b949e").attr("font-size", 9.5)
      .text("* 2026 contains partial-year data");

    const metricSelect = d3.select("#metric-select");
    const metricButtons = d3.selectAll("#metric-buttons [data-metric]");
    let colorScale;
    renderMetric(false);
    scheduleHeatmapIntro();

    if (!metricSelect.empty()) {
      metricSelect.property("value", metric).on("change", function () {
        chooseMetric(this.value);
      });
    }
    metricButtons.on("click", function () { chooseMetric(this.dataset.metric); });
    d3.select("#heatmap-clear").on("click", clearPinnedCell);
    d3.select("#heatmap-show-all").on("click", () => {
      if (!pinnedCell) return;
      moviesExpanded = true;
      renderMovieDetail(pinnedCell);
    });
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && pinnedCell) clearPinnedCell();
    });
    syncMetricControls();

    function chooseMetric(nextMetric) {
      if (!logic.metricConfig[nextMetric] || nextMetric === metric) return;
      metric = nextMetric;
      metricSelect.property("value", metric);
      syncMetricControls();
      renderMetric(true);
    }

    function syncMetricControls() {
      metricButtons.classed("active", function () { return this.dataset.metric === metric; })
        .attr("aria-pressed", function () { return this.dataset.metric === metric ? "true" : "false"; });
    }

    function scaleForMetric() {
      const values = cells.map((cell) => +cell[metric]).filter(Number.isFinite);
      let extent = d3.extent(values);
      if (extent[0] == null || extent[1] == null) extent = [0, 1];
      if (metric !== "weighted_rating") extent[0] = 0;
      if (extent[0] === extent[1]) extent[1] = extent[0] + 1;
      const interpolator = metric === "weighted_rating" ? d3.interpolateYlGnBu
        : metric === "total_votes" ? d3.interpolateBlues : d3.interpolatePurples;
      const scale = metric === "weighted_rating" ? d3.scaleSequential(interpolator) : d3.scaleSequentialSqrt(interpolator);
      return { extent, interpolator, scale: scale.domain(extent) };
    }

    function metricLeader() {
      const byGenre = d3.rollups(fullYearCells, (group) => {
        const votes = d3.sum(group, (cell) => +cell.total_votes || 0);
        if (metric === "weighted_rating") {
          return votes ? d3.sum(group, (cell) => (+cell.weighted_rating || 0) * (+cell.total_votes || 0)) / votes : null;
        }
        return d3.sum(group, (cell) => +cell[metric] || 0);
      }, (cell) => cell.genre).filter(([, value]) => value != null);
      const [genre, value] = d3.greatest(byGenre, ([, value]) => value) || [];
      return genre ? { genre, value } : null;
    }

    function renderAnnotation(animate) {
      const leader = metricLeader();
      if (!leader) return annotation.attr("display", "none");
      const firstYear = d3.min(fullYearCells, (cell) => +cell.year);
      const lastYear = d3.max(fullYearCells, (cell) => +cell.year);
      const span = `${firstYear}–${String(lastYear).slice(-2)}`;
      const copy = {
        weighted_rating: [`Highest rated, ${span}`, `${leader.genre} · ${logic.formatMetricValue(metric, leader.value)} / 10`],
        total_votes: [`Most votes, ${span}`, `${leader.genre} · ${d3.format(".3~s")(leader.value).replace("G", "B")} votes`],
        movie_count: [`Most movies, ${span}`, `${leader.genre} · ${logic.formatMetricValue(metric, leader.value)} films`],
      }[metric];
      const top = y(leader.genre) - 4;
      const mid = y(leader.genre) + y.bandwidth() / 2;
      const transition = annotation.transition("annotation").duration(animate ? DURATION : 0).ease(d3.easeCubicInOut);
      annotation.attr("display", null).attr("aria-label", `${copy[0]}: ${copy[1]}`);
      annotationBox.transition(transition).attr("y", top);
      annotationTick.transition(transition).attr("y1", mid).attr("y2", mid);
      annotationLabel.text(copy[0]).transition(transition).attr("y", mid - 3);
      annotationValue.text(copy[1]).transition(transition).attr("y", mid + 13);
    }

    function setAnnotationDimmed(dimmed) {
      annotation.interrupt("annotation-dim").transition("annotation-dim")
        .duration(logic.motionDuration(150, reducedMotion)).attr("opacity", dimmed ? 0.25 : 1);
    }

    function scheduleHeatmapIntro() {
      cellSelection.style("opacity", 0);
      annotation.style("opacity", 0);
      legend.attr("opacity", 0);
      xAxisGroup.attr("opacity", 0);
      yAxisGroup.attr("opacity", 0);
      logic.runWhenVisible(root.node(), () => {
        const duration = logic.motionDuration(360, reducedMotion);
        root.classed("is-introduced", true);
        legend.transition("intro").duration(duration).attr("opacity", 1);
        xAxisGroup.transition("intro").duration(duration).attr("opacity", 1);
        yAxisGroup.transition("intro").duration(duration).attr("opacity", 1);
        cellSelection.transition("intro")
          .delay((cell) => reducedMotion ? 0 : logic.heatmapTransitionDelay(+cell.year, genres.indexOf(cell.genre)))
          .duration(duration).ease(d3.easeCubicOut).style("opacity", 1);
        annotation.transition("intro").delay(reducedMotion ? 0 : 650).duration(duration).style("opacity", 1);
      }, reducedMotion);
    }

    function renderMetric(animate) {
      const config = logic.metricConfig[metric];
      const scaleData = scaleForMetric();
      colorScale = scaleData.scale;
      const duration = animate ? DURATION : 0;

      d3.select("#viz4-controls").classed("is-updating", animate);
      cellSelection.transition("metric")
        .delay((cell) => animate ? logic.heatmapTransitionDelay(+cell.year, genres.indexOf(cell.genre)) : 0)
        .duration(duration).ease(d3.easeCubicInOut).attr("fill", (cell) => {
        const value = cell[metric];
        return value == null || !Number.isFinite(+value) ? "#30363d" : colorScale(+value);
      }).on("end", () => d3.select("#viz4-controls").classed("is-updating", false));

      const stops = d3.range(0, 1.001, 0.1);
      gradient.selectAll("stop").data(stops).join("stop")
        .attr("offset", (stop) => `${stop * 100}%`)
        .transition("metric").duration(duration).ease(d3.easeCubicInOut)
        .attr("stop-color", (stop) => scaleData.interpolator(stop));
      legendTitle.interrupt("legend").transition("legend").duration(duration / 2).attr("opacity", 0)
        .transition("legend").duration(duration / 2).attr("opacity", 1).text(config.label);
      tweenLegendValue(legendMin, scaleData.extent[0], metric, duration);
      tweenLegendValue(legendMax, scaleData.extent[1], metric, duration);
      legendLow.text(config.semantic[0]);
      legendHigh.text(config.semantic[1]);
      d3.select("#metric-state").text(config.label);
      d3.select("#metric-description").text(config.description);
      syncMetricControls();
      renderAnnotation(animate);
      if (pinnedCell) applyCellFocus(pinnedCell, true);
      else clearVisualFocus();
    }

    function tooltipSelection() {
      let tooltip = d3.select("#heatmap-tooltip");
      if (tooltip.empty()) tooltip = root.append("div").attr("id", "heatmap-tooltip").attr("class", "chart-tooltip");
      return tooltip;
    }

    function highlightCell(event, cell) {
      applyCellFocus(cell, Boolean(pinnedCell && cellKey(pinnedCell) === cellKey(cell)));
      showCellTooltip(event, cell);
    }

    function applyCellFocus(cell, isPinned = false) {
      cellSelection.interrupt("highlight").transition("highlight").duration(130)
        .attr("opacity", (other) => other.genre === cell.genre || +other.year === +cell.year ? 1 : 0.34)
        .attr("stroke-width", (other) => other === cell ? 2.2 : 0)
        .attr("transform", (other) => other === cell ? "translate(0,-2) scale(1.018)" : null);
      setAnnotationDimmed(true);
      columnBand.interrupt("band").transition("band").duration(logic.motionDuration(170, reducedMotion))
        .ease(d3.easeCubicOut).attr("x", x(+cell.year) - 4).attr("width", x.bandwidth() + 8).attr("opacity", 1);
      rowBand.interrupt("band").transition("band").duration(logic.motionDuration(170, reducedMotion))
        .ease(d3.easeCubicOut).attr("y", y(cell.genre) - 4).attr("height", y.bandwidth() + 8).attr("opacity", 1);
      xAxisGroup.selectAll(".tick text").classed("is-highlighted", (year) => +year === +cell.year);
      yAxisGroup.selectAll(".tick text").classed("is-highlighted", (genre) => genre === cell.genre);
      cellSelection.classed("is-active", (other) => cellKey(other) === cellKey(cell))
        .classed("is-pinned", (other) => Boolean(isPinned && cellKey(other) === cellKey(cell)));
    }

    function showCellTooltip(event, cell) {
      tooltipSelection().html(`<div class="tooltip-title">${escapeHtml(cell.genre)} · ${cell.year}${+cell.year === 2026 ? "*" : ""}</div>
        <div class="tooltip-muted">All values for this genre–year cell</div>
        <div class="tooltip-rule"></div>
        <div>Weighted rating: <strong>${logic.formatMetricValue("weighted_rating", cell.weighted_rating)}</strong> / 10</div>
        <div>Movies: <strong>${logic.formatMetricValue("movie_count", cell.movie_count)}</strong></div>
        <div>Total TMDB votes: <strong>${logic.formatMetricValue("total_votes", cell.total_votes)}</strong></div>`)
        .classed("is-visible", true);
      moveTooltip(event);
    }

    function handleCellLeave() {
      tooltipSelection().classed("is-visible", false);
      if (pinnedCell) applyCellFocus(pinnedCell, true);
      else clearVisualFocus();
    }

    function clearVisualFocus() {
      cellSelection.interrupt("highlight").transition("highlight").duration(logic.motionDuration(150, reducedMotion))
        .attr("opacity", 1).attr("stroke-width", 0).attr("transform", null);
      cellSelection.classed("is-active", false).classed("is-pinned", false);
      setAnnotationDimmed(false);
      columnBand.interrupt("band").transition("band").duration(logic.motionDuration(150, reducedMotion)).attr("opacity", 0);
      rowBand.interrupt("band").transition("band").duration(logic.motionDuration(150, reducedMotion)).attr("opacity", 0);
      xAxisGroup.selectAll(".tick text").classed("is-highlighted", false);
      yAxisGroup.selectAll(".tick text").classed("is-highlighted", false);
      tooltipSelection().classed("is-visible", false);
    }

    function cellKey(cell) {
      return `${cell.genre}|${cell.year}`;
    }

    function pinCell(cell) {
      pinnedCell = cell;
      moviesExpanded = false;
      tooltipSelection().classed("is-visible", false);
      applyCellFocus(cell, true);
      renderMovieDetail(cell);
    }

    function clearPinnedCell() {
      pinnedCell = null;
      moviesExpanded = false;
      clearVisualFocus();
      const panel = d3.select("#heatmap-detail");
      panel.classed("is-open", false);
      window.clearTimeout(detailCloseTimer);
      detailCloseTimer = window.setTimeout(() => {
        if (!pinnedCell) panel.attr("hidden", true);
      }, logic.motionDuration(230, reducedMotion));
    }

    function renderMovieDetail(cell) {
      const panel = d3.select("#heatmap-detail");
      window.clearTimeout(detailCloseTimer);
      panel.attr("hidden", null);
      window.requestAnimationFrame(() => panel.classed("is-open", true));
      d3.select("#heatmap-detail-title").text(`${cell.genre} · ${cell.year}${+cell.year === 2026 ? "*" : ""}`);
      d3.select("#heatmap-detail-subtitle").text(+cell.year === 2026
        ? "Partial-year coverage. Movies are ranked by TMDB vote count, which shows their influence on the weighted rating."
        : "Movies are ranked by TMDB vote count, which shows their influence on the weighted rating.");
      d3.select("#heatmap-detail-rating").text(`${logic.formatMetricValue("weighted_rating", cell.weighted_rating)} / 10`);
      d3.select("#heatmap-detail-votes").text(logic.formatMetricValue("total_votes", cell.total_votes));
      d3.select("#heatmap-detail-count").text(logic.formatMetricValue("movie_count", cell.movie_count));

      const allMovies = logic.visibleMoviesForCell(cell.movies, true);
      const visibleMovies = logic.visibleMoviesForCell(cell.movies, moviesExpanded);
      const rows = d3.select("#heatmap-movie-list").selectAll("li")
        .data(visibleMovies, (movie) => movie.tmdb_id).join(
          (enter) => enter.append("li").attr("class", "heatmap-movie-card").style("opacity", 0)
            .style("transform", "translateY(7px)"),
          (update) => update,
          (exit) => exit.remove()
        );
      rows.html("");
      rows.append("span").attr("class", "heatmap-movie-rank")
        .text((movie) => allMovies.findIndex((item) => item.tmdb_id === movie.tmdb_id) + 1);
      const copy = rows.append("div").attr("class", "heatmap-movie-copy");
      copy.append("h3").text((movie) => movie.title);
      copy.append("p").text((movie) => `TMDB rating ${(+movie.vote_average).toFixed(2)} / 10`);
      rows.append("strong").attr("class", "heatmap-movie-votes")
        .text((movie) => `${logic.formatMetricValue("total_votes", movie.vote_count)} votes`);
      rows.transition("detail-list").delay((movie, index) => reducedMotion ? 0 : index * 34)
        .duration(logic.motionDuration(240, reducedMotion)).ease(d3.easeCubicOut)
        .style("opacity", 1).style("transform", "translateY(0)");

      d3.select("#heatmap-show-all")
        .attr("hidden", allMovies.length > 6 && !moviesExpanded ? null : true)
        .text(`Show all ${allMovies.length} movies`);
    }

    function moveTooltip(event) {
      const tooltip = tooltipSelection();
      const container = root.node().parentElement;
      const bounds = container.getBoundingClientRect();
      const tipBounds = tooltip.node().getBoundingClientRect();
      let left = event.clientX - bounds.left + 14;
      let top = event.clientY - bounds.top + 14;
      if (left + tipBounds.width > bounds.width) left = event.clientX - bounds.left - tipBounds.width - 14;
      if (top + tipBounds.height > bounds.height) top = Math.max(6, event.clientY - bounds.top - tipBounds.height - 14);
      tooltip.style("left", `${Math.max(6, left)}px`).style("top", `${Math.max(6, top)}px`);
    }

    function tweenLegendValue(selection, nextValue, metricName, duration) {
      const previous = +(selection.attr("data-value") || nextValue);
      selection.attr("data-value", nextValue).interrupt("legend-value").transition("legend-value")
        .duration(duration).tween("text", () => {
          const interpolate = d3.interpolateNumber(previous, nextValue);
          return (time) => selection.text(logic.formatMetricValue(metricName, interpolate(time)));
        });
    }
  }).catch((error) => {
    console.error("Error loading Visualization 4:", error);
    root.append("p").style("color", "#f85149").text("Unable to load the genre heatmap.");
  });
})();
