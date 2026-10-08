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

    d3.select("#genre-count").text(genres.length);

    const margin = { top: 150, right: 35, bottom: 45, left: 135 };
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
      .on("mouseenter", highlightCell).on("mousemove", moveTooltip).on("mouseleave", clearHighlight);

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

    function scheduleHeatmapIntro() {
      cellSelection.style("opacity", 0);
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
      clearHighlight();
    }

    function tooltipSelection() {
      let tooltip = d3.select("#heatmap-tooltip");
      if (tooltip.empty()) tooltip = root.append("div").attr("id", "heatmap-tooltip").attr("class", "chart-tooltip");
      return tooltip;
    }

    function highlightCell(event, cell) {
      cellSelection.interrupt("highlight").transition("highlight").duration(130)
        .attr("opacity", (other) => other.genre === cell.genre || +other.year === +cell.year ? 1 : 0.34)
        .attr("stroke-width", (other) => other === cell ? 2.2 : 0)
        .attr("transform", (other) => other === cell ? "translate(0,-2)" : null);
      columnBand.interrupt("band").attr("x", x(+cell.year) - 4).attr("width", x.bandwidth() + 8)
        .transition("band").duration(130).attr("opacity", 1);
      rowBand.interrupt("band").attr("y", y(cell.genre) - 4).attr("height", y.bandwidth() + 8)
        .transition("band").duration(130).attr("opacity", 1);
      xAxisGroup.selectAll(".tick text").classed("is-highlighted", (year) => +year === +cell.year);
      yAxisGroup.selectAll(".tick text").classed("is-highlighted", (genre) => genre === cell.genre);
      tooltipSelection().html(`<div class="tooltip-title">${escapeHtml(cell.genre)} · ${cell.year}${+cell.year === 2026 ? "*" : ""}</div>
        <div class="tooltip-muted">All values for this genre–year cell</div>
        <div class="tooltip-rule"></div>
        <div>Weighted rating: <strong>${logic.formatMetricValue("weighted_rating", cell.weighted_rating)}</strong> / 10</div>
        <div>Movies: <strong>${logic.formatMetricValue("movie_count", cell.movie_count)}</strong></div>
        <div>Total TMDB votes: <strong>${logic.formatMetricValue("total_votes", cell.total_votes)}</strong></div>`)
        .classed("is-visible", true);
      moveTooltip(event);
    }

    function clearHighlight() {
      cellSelection.interrupt("highlight").transition("highlight").duration(logic.motionDuration(150, reducedMotion))
        .attr("opacity", 1).attr("stroke-width", 0).attr("transform", null);
      columnBand.interrupt("band").transition("band").duration(logic.motionDuration(150, reducedMotion)).attr("opacity", 0);
      rowBand.interrupt("band").transition("band").duration(logic.motionDuration(150, reducedMotion)).attr("opacity", 0);
      xAxisGroup.selectAll(".tick text").classed("is-highlighted", false);
      yAxisGroup.selectAll(".tick text").classed("is-highlighted", false);
      tooltipSelection().classed("is-visible", false);
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
