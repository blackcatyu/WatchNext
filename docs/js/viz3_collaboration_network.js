(function () {
  "use strict";

  const root = d3.select("#network");
  if (root.empty()) return;

  const logic = window.WatchNextViz;
  const WIDTH = 1100;
  const HEIGHT = 680;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || false;
  const DURATION = logic.motionDuration(360, reducedMotion);
  const FOCUS_DURATION = logic.motionDuration(520, reducedMotion);
  const DEFAULT_THRESHOLD = 3;
  const formatInteger = d3.format(",");

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const normalize = (value) => String(value || "").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  d3.json("data/viz3_collaboration_network.json").then((data) => {
    const nodes = data.nodes.map((node) => ({ ...node }));
    const rawLinks = data.links.map((link) => ({
      ...link,
      source: String(link.source),
      target: String(link.target),
      movies: (link.movies || []).map(Number),
    }));
    const careers = data.career || {};
    const nodeById = new Map(nodes.map((node) => [node.id, node]));

    const allMovies = new Map();
    Object.values(careers).flat().forEach((movie) => allMovies.set(+movie.tmdbId, movie));
    const allGenres = [...new Set([...allMovies.values()].flatMap((movie) => movie.genres || []))]
      .sort(d3.ascending);

    const communities = Array.from(d3.group(nodes, (node) => node.community), ([id, members]) => ({ id, members }))
      .sort((a, b) => d3.ascending(a.id, b.id));
    const communityById = new Map(communities.map((community) => [community.id, community]));
    const careerColor = d3.scaleOrdinal()
      .domain(allGenres)
      .range(allGenres.map((genre, index) => d3.hcl((index * 137.508 + 12) % 360, 52, 67).formatHex()));

    const isDirector = (node) => node.role.toLowerCase() === "director";
    const baseRadius = d3.scaleSqrt().domain(d3.extent(nodes, (node) => node.weighted_degree)).range([5, 14]);
    const symbolRadius = (node) => baseRadius(node.weighted_degree) * (isDirector(node) ? 1.18 : 1);

    function settle(simulation) {
      simulation.stop().alphaMin(0.0001).alphaDecay(0.025);
      while (simulation.alpha() > simulation.alphaMin()) simulation.tick();
      for (let index = 0; index < 180; index += 1) simulation.tick();
    }

    const communityLinks = rawLinks.map((link) => ({
      source: nodeById.get(link.source).community,
      target: nodeById.get(link.target).community,
    })).filter((link) => link.source !== link.target);
    const communityFamilies = logic.assignCommunityColorFamilies(
      communities.map((community) => community.id),
      communityLinks,
      7
    );
    const communityColor = d3.scaleOrdinal()
      .domain(communities.map((community) => community.id))
      .range(communities.map((community, index) => logic.communityNodeColor(
        index,
        communityFamilies.get(String(community.id))
      )));

    settle(d3.forceSimulation(communities)
      .force("link", d3.forceLink(communityLinks).id((community) => community.id).distance(95).strength(0.15))
      .force("charge", d3.forceManyBody().strength(-170))
      .force("x", d3.forceX(0).strength(0.015))
      .force("y", d3.forceY(0).strength(0.035))
      .force("collision", d3.forceCollide((community) => Math.sqrt(community.members.length) * 17 + 10).iterations(3)));

    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    communities.forEach((community) => community.members.forEach((node, index) => {
      const radius = Math.sqrt(index + 0.5) * 16;
      node.x = community.x + Math.cos(index * goldenAngle) * radius;
      node.y = community.y + Math.sin(index * goldenAngle) * radius;
    }));

    const layoutLinks = rawLinks.map((link) => ({ ...link }));
    settle(d3.forceSimulation(nodes)
      .force("link", d3.forceLink(layoutLinks).id((node) => node.id)
        .distance((link) => Math.max(32, 58 - (link.collaboration_count - 3) * 4)).strength(0.65))
      .force("charge", d3.forceManyBody().strength(-35))
      .force("communityX", d3.forceX((node) => communityById.get(node.community).x).strength(0.16))
      .force("communityY", d3.forceY((node) => communityById.get(node.community).y).strength(0.16))
      .force("collision", d3.forceCollide((node) => symbolRadius(node) + 3).iterations(3)));

    const padding = 42;
    const minX = d3.min(nodes, (node) => node.x - symbolRadius(node));
    const maxX = d3.max(nodes, (node) => node.x + symbolRadius(node));
    const minY = d3.min(nodes, (node) => node.y - symbolRadius(node));
    const maxY = d3.max(nodes, (node) => node.y + symbolRadius(node));
    const fitScale = Math.min((WIDTH - padding * 2) / (maxX - minX), (HEIGHT - padding * 2) / (maxY - minY));
    nodes.forEach((node) => {
      node.x = WIDTH / 2 + (node.x - (minX + maxX) / 2) * fitScale;
      node.y = HEIGHT / 2 + (node.y - (minY + maxY) / 2) * fitScale;
      node.defaultX = node.x;
      node.defaultY = node.y;
    });

    rawLinks.forEach((link) => {
      link.sourceNode = nodeById.get(link.source);
      link.targetNode = nodeById.get(link.target);
      link.key = `${link.source}|${link.target}`;
    });

    const svg = root.append("svg")
      .attr("viewBox", `0 0 ${WIDTH} ${HEIGHT}`)
      .attr("role", "img")
      .attr("aria-label", "Interactive actor and director collaboration network");
    const defs = svg.append("defs");
    const glow = defs.append("filter").attr("id", "network-focus-glow")
      .attr("x", "-80%").attr("y", "-80%").attr("width", "260%").attr("height", "260%");
    glow.append("feGaussianBlur").attr("stdDeviation", 4).attr("result", "blur");
    const glowMerge = glow.append("feMerge");
    glowMerge.append("feMergeNode").attr("in", "blur");
    glowMerge.append("feMergeNode").attr("in", "SourceGraphic");
    const viewport = svg.append("g");
    const haloLayer = viewport.append("g").attr("class", "network-halos");
    const linkLayer = viewport.append("g").attr("class", "network-links");
    const nodeLayer = viewport.append("g").attr("class", "network-nodes");
    const sheenLayer = viewport.append("g").attr("class", "network-node-sheens");
    const labelLayer = viewport.append("g").attr("class", "network-labels");
    const hitLayer = viewport.append("g").attr("class", "network-node-hits");

    const zoom = d3.zoom()
      .filter((event) => logic.networkZoomAllowed({
        isNodeHit: Boolean(event.target.closest?.(".network-node-hit")),
        type: event.type,
        button: event.button,
        ctrlKey: event.ctrlKey,
      }))
      .scaleExtent([0.75, 5])
      .on("zoom", (event) => viewport.attr("transform", event.transform));
    svg.call(zoom).on("dblclick.zoom", null);

    const maximumSharedMovies = d3.max(rawLinks, (link) => link.collaboration_count);
    const linkSelection = linkLayer.selectAll("line").data(rawLinks, (link) => link.key).join("line")
      .attr("class", "network-link")
      .attr("x1", (link) => link.sourceNode.x).attr("y1", (link) => link.sourceNode.y)
      .attr("x2", (link) => link.targetNode.x).attr("y2", (link) => link.targetNode.y)
      .attr("stroke", "#4f9bd8").attr("stroke-linecap", "round")
      .on("mouseenter", function (event, link) {
        d3.select(this).interrupt("edge-hover").transition("edge-hover").duration(120)
          .attr("stroke", "#9bddff").attr("stroke-opacity", 1);
        showEdgeTooltip(event, link);
      })
      .on("mousemove", moveNetworkTooltip)
      .on("mouseleave", function () {
        hideNetworkTooltip();
        updateFocusState(true);
      });

    const nodeSelection = nodeLayer.selectAll("path").data(nodes, (node) => node.id).join("path")
      .attr("class", "network-node")
      .attr("transform", (node) => `translate(${node.x},${node.y})`)
      .attr("d", (node) => nodeSymbol(node, baseRadius(node.weighted_degree)))
      .attr("fill", (node) => communityColor(node.community))
      .attr("stroke", "#e6edf3").attr("stroke-width", 0.8)
      .attr("pointer-events", "none");

    const sheenSelection = sheenLayer.selectAll("path").data(nodes, (node) => node.id).join("path")
      .attr("class", "network-node-sheen")
      .attr("transform", (node) => `translate(${node.x},${node.y})`)
      .attr("d", (node) => nodeSymbol(node, baseRadius(node.weighted_degree) * 0.62))
      .attr("fill", "none").attr("stroke", "rgba(255,255,255,0.42)").attr("stroke-width", 0.8)
      .attr("pointer-events", "none");

    const defaultLabelIds = new Set(nodes.slice().sort((a, b) => b.weighted_degree - a.weighted_degree).slice(0, 18).map((node) => node.id));
    let activeLabelIds = new Set(defaultLabelIds);
    const labelSelection = labelLayer.selectAll("text").data(nodes, (node) => node.id).join("text")
      .attr("x", (node) => node.x + symbolRadius(node) + 5).attr("y", (node) => node.y - 5)
      .attr("fill", "#e6edf3").attr("font-size", 9.5).attr("font-weight", 550)
      .attr("paint-order", "stroke").attr("stroke", "#0f1216").attr("stroke-width", 3)
      .attr("pointer-events", "none").text((node) => node.name);

    svg.on("click", (event) => {
      if (event.target === svg.node()) selectPerson(null);
    });

    const haloSelection = haloLayer.selectAll("circle").data(nodes, (node) => node.id).join("circle")
      .attr("class", "network-halo")
      .attr("cx", (node) => node.x).attr("cy", (node) => node.y)
      .attr("r", 0).attr("fill", "none").attr("stroke", "#ffd166")
      .attr("stroke-width", 1.8).attr("opacity", 0).attr("pointer-events", "none");

    let activeMouseDrag = null;
    let mouseDragOrigin = null;

    const nodeHitSelection = hitLayer.selectAll("circle").data(nodes, (node) => node.id).join("circle")
      .attr("class", "network-node-hit")
      .attr("data-person-id", (node) => node.id)
      .attr("cx", (node) => node.x).attr("cy", (node) => node.y)
      .attr("r", (node) => logic.nodeHitRadius(baseRadius(node.weighted_degree)))
      .attr("fill", "transparent")
      .on("pointerdown.node-drag", function (event, node) {
        event.stopPropagation();
        node.dragPointerId = event.pointerId;
        node.dragOrigin = [event.clientX, event.clientY];
        node.wasDragged = false;
        this.setPointerCapture?.(event.pointerId);
        d3.select(this).classed("is-dragging", true);
      })
      .on("pointermove.node-drag", function (event, node) {
        if (node.dragPointerId !== event.pointerId) return;
        event.stopPropagation();
        if (node.dragOrigin && Math.hypot(event.clientX - node.dragOrigin[0], event.clientY - node.dragOrigin[1]) > 3) {
          node.wasDragged = true;
        }
        const [x, y] = d3.pointer(event, viewport.node());
        node.x = Math.max(10, Math.min(WIDTH - 10, x));
        node.y = Math.max(10, Math.min(HEIGHT - 10, y));
        refreshPositions();
      })
      .on("pointerup.node-drag pointercancel.node-drag", function (event, node) {
        if (node.dragPointerId !== event.pointerId) return;
        event.stopPropagation();
        this.releasePointerCapture?.(event.pointerId);
        node.dragPointerId = null;
        node.dragOrigin = null;
        d3.select(this).classed("is-dragging", false);
      })
      .on("mousedown.node-drag", function (event, node) {
        event.stopPropagation();
        if (event.button !== 0) return;
        activeMouseDrag = { node, element: this };
        mouseDragOrigin = [event.clientX, event.clientY];
        node.wasDragged = false;
        d3.select(this).classed("is-dragging", true);
      })
      .on("mouseenter", (event, node) => {
        state.hoveredId = node.id;
        updateFocusState(true);
        showNodeTooltip(event, node);
      })
      .on("mousemove", moveNetworkTooltip)
      .on("mouseleave", () => {
        state.hoveredId = null;
        hideNetworkTooltip();
        updateFocusState(true);
      })
      .on("click", (event, node) => {
        event.stopPropagation();
        if (node.wasDragged) {
          node.wasDragged = false;
          return;
        }
        selectPerson(state.selectedId === node.id ? null : node.id);
      });

    window.addEventListener("mousemove", (event) => {
      if (!activeMouseDrag) return;
      event.preventDefault();
      const { node } = activeMouseDrag;
      if (mouseDragOrigin && Math.hypot(event.clientX - mouseDragOrigin[0], event.clientY - mouseDragOrigin[1]) > 3) {
        node.wasDragged = true;
      }
      const [x, y] = d3.pointer(event, viewport.node());
      node.x = Math.max(10, Math.min(WIDTH - 10, x));
      node.y = Math.max(10, Math.min(HEIGHT - 10, y));
      refreshPositions();
    }, { passive: false });

    window.addEventListener("mouseup", () => {
      if (!activeMouseDrag) return;
      d3.select(activeMouseDrag.element).classed("is-dragging", false);
      activeMouseDrag = null;
      mouseDragOrigin = null;
    });

    const state = { genre: "All", threshold: DEFAULT_THRESHOLD, selectedId: null, hoveredId: null };
    let currentFiltered = null;
    let currentStrength = new Map();
    setupControls();
    updateGraph(false);
    scheduleNetworkIntro();

    function nodeSymbol(node, radius) {
      return logic.nodeSymbolPath(node.role, radius * (isDirector(node) ? 1.08 : 1));
    }

    function refreshPositions() {
      linkSelection.attr("x1", (link) => link.sourceNode.x).attr("y1", (link) => link.sourceNode.y)
        .attr("x2", (link) => link.targetNode.x).attr("y2", (link) => link.targetNode.y);
      nodeSelection.attr("transform", (node) => `translate(${node.x},${node.y})`);
      sheenSelection.attr("transform", (node) => `translate(${node.x},${node.y})`);
      haloSelection.attr("cx", (node) => node.x).attr("cy", (node) => node.y);
      nodeHitSelection.attr("cx", (node) => node.x).attr("cy", (node) => node.y);
      positionLabels(activeLabelIds);
    }

    function scheduleNetworkIntro() {
      const introLabels = labelSelection.filter((node) => defaultLabelIds.has(node.id));
      linkSelection.style("opacity", 0);
      nodeSelection.style("opacity", 0);
      sheenSelection.style("opacity", 0);
      introLabels.style("opacity", 0);
      logic.runWhenVisible(root.node(), () => {
        const duration = logic.motionDuration(360, reducedMotion);
        root.classed("is-introduced", true);
        linkSelection.transition("intro").delay((link, index) => reducedMotion ? 0 : (index % 14) * 7)
          .duration(duration).ease(d3.easeCubicOut).style("opacity", 1);
        nodeSelection.transition("intro").delay((node, index) => reducedMotion ? 0
          : (communityFamilies.get(String(node.community)) || 0) * 34 + (index % 5) * 8)
          .duration(duration).ease(d3.easeCubicOut).style("opacity", 1);
        sheenSelection.transition("intro").delay((node, index) => reducedMotion ? 0
          : (communityFamilies.get(String(node.community)) || 0) * 34 + (index % 5) * 8 + 70)
          .duration(duration).ease(d3.easeCubicOut).style("opacity", 1)
          .on("end", function () { d3.select(this).style("opacity", null); });
        introLabels.transition("intro").delay((node, index) => reducedMotion ? 0 : 180 + (index % 12) * 10)
          .duration(duration).ease(d3.easeCubicOut).style("opacity", 1)
          .on("end", function () { d3.select(this).style("opacity", null); });
      }, reducedMotion);
    }

    function positionLabels(labelIds) {
      activeLabelIds = new Set(labelIds);
      const labelNodes = nodes.filter((node) => activeLabelIds.has(node.id)).map((node) => ({
        id: node.id,
        name: node.name,
        x: node.x,
        y: node.y,
        radius: symbolRadius(node),
      }));
      const placements = logic.placeLabels(labelNodes, WIDTH, HEIGHT);
      labelSelection.filter((node) => activeLabelIds.has(node.id))
        .attr("text-anchor", "start")
        .attr("x", (node) => placements.get(node.id).x)
        .attr("y", (node) => placements.get(node.id).y + placements.get(node.id).height - 2);
    }

    function updateGraph(animate = true) {
      currentFiltered = logic.filterCollaborationGraph(rawLinks, state.genre, state.threshold, allMovies);
      const filteredByKey = new Map(currentFiltered.links.map((link) => [`${link.source}|${link.target}`, link]));
      currentStrength = new Map(nodes.map((node) => [node.id, 0]));
      currentFiltered.links.forEach((link) => {
        currentStrength.set(link.source, currentStrength.get(link.source) + link.filtered_count);
        currentStrength.set(link.target, currentStrength.get(link.target) + link.filtered_count);
      });

      if (state.selectedId && !logic.selectionSurvives(state.selectedId, currentFiltered.nodeIds)) {
        clearSelection(true);
      }

      const maxStrength = d3.max([...currentStrength.values()]) || 1;
      const activeRadius = d3.scaleSqrt().domain([1, maxStrength]).range([5, 14]);
      const transition = svg.transition("graph").duration(animate ? DURATION : 0).ease(d3.easeCubicInOut);

      linkSelection
        .style("pointer-events", (link) => filteredByKey.has(link.key) ? "stroke" : "none")
        .transition(transition)
        .attr("stroke-width", (link) => {
          const filtered = filteredByKey.get(link.key);
          return filtered ? logic.networkEdgeWidth(filtered.filtered_count, maximumSharedMovies) : 0.4;
        })
        .attr("stroke", (link) => logic.networkLinkStyle(link, {
          visible: filteredByKey.has(link.key),
          selectedId: state.selectedId,
        }).color)
        .attr("stroke-opacity", (link) => logic.networkLinkStyle(link, {
          visible: filteredByKey.has(link.key),
          selectedId: state.selectedId,
        }).opacity);

      nodeSelection
        .classed("is-selected", (node) => node.id === state.selectedId)
        .transition(transition)
        .attr("d", (node) => nodeSymbol(node, currentFiltered.nodeIds.has(node.id) ? activeRadius(Math.max(1, currentStrength.get(node.id))) : 3))
        .attr("fill-opacity", (node) => currentFiltered.nodeIds.has(node.id) ? 0.96 : 0)
        .attr("stroke-width", 1.05)
        .attr("stroke", "#fff8e7");

      sheenSelection.transition(transition)
        .attr("d", (node) => nodeSymbol(node, currentFiltered.nodeIds.has(node.id) ? activeRadius(Math.max(1, currentStrength.get(node.id))) * 0.62 : 2))
        .attr("opacity", (node) => currentFiltered.nodeIds.has(node.id) ? 0.72 : 0);

      nodeHitSelection
        .style("pointer-events", (node) => currentFiltered.nodeIds.has(node.id) ? "all" : "none")
        .transition(transition)
        .attr("r", (node) => currentFiltered.nodeIds.has(node.id)
          ? logic.nodeHitRadius(activeRadius(Math.max(1, currentStrength.get(node.id)))) : 0);

      tweenNumber("#person-count", currentFiltered.nodeIds.size, animate);
      tweenNumber("#collaboration-count", currentFiltered.links.length, animate);
      d3.select("#genre-state").text(state.genre);
      d3.select("#threshold-state").text(`${state.threshold}+`);
      d3.select("#threshold-output").text(state.threshold === 6 ? "6+" : state.threshold);
      window.setTimeout(() => updateFocusState(false), animate ? DURATION : 0);
      updateCareer();
    }

    function relatedIds(personId) {
      const related = new Set(personId ? [personId] : []);
      if (!personId || !currentFiltered) return related;
      currentFiltered.links.forEach((link) => {
        if (link.source === personId) related.add(link.target);
        if (link.target === personId) related.add(link.source);
      });
      return related;
    }

    function updateFocusState(animate = true) {
      if (!currentFiltered) return;
      const focusId = state.selectedId || state.hoveredId;
      const focusIds = relatedIds(focusId);
      const filteredKeys = new Set(currentFiltered.links.map((link) => `${link.source}|${link.target}`));
      const duration = animate ? logic.motionDuration(180, reducedMotion) : 0;
      const transition = svg.transition("focus").duration(duration).ease(d3.easeCubicOut);
      const visibleLabelIds = new Set([...(focusId ? focusIds : defaultLabelIds)]
        .filter((nodeId) => currentFiltered.nodeIds.has(nodeId)));
      positionLabels(visibleLabelIds);

      linkSelection.interrupt("focus").transition(transition)
        .attr("stroke", (link) => logic.networkLinkStyle(link, {
          visible: filteredKeys.has(link.key),
          selectedId: state.selectedId,
          hoveredId: state.selectedId ? null : state.hoveredId,
        }).color)
        .attr("stroke-opacity", (link) => logic.networkLinkStyle(link, {
          visible: filteredKeys.has(link.key),
          selectedId: state.selectedId,
          hoveredId: state.selectedId ? null : state.hoveredId,
        }).opacity);

      nodeSelection
        .classed("is-hovered", (node) => node.id === state.hoveredId)
        .interrupt("focus").transition(transition)
        .attr("fill-opacity", (node) => {
          if (!currentFiltered.nodeIds.has(node.id)) return 0;
          return focusId && !focusIds.has(node.id) ? 0.12 : 1;
        })
        .attr("stroke", (node) => node.id === state.selectedId ? "#fff3c4" : node.id === state.hoveredId ? "#fff8e7" : "#f2eadc")
        .attr("stroke-width", (node) => node.id === state.selectedId ? 2.8 : node.id === state.hoveredId ? 1.8 : 0.8)
        .style("filter", (node) => focusIds.has(node.id) ? "url(#network-focus-glow)" : null);

      sheenSelection.interrupt("focus").transition(transition)
        .attr("opacity", (node) => {
          if (!currentFiltered.nodeIds.has(node.id)) return 0;
          return focusId && !focusIds.has(node.id) ? 0.04 : 0.78;
        });

      labelSelection.interrupt("focus").transition(transition).attr("opacity", (node) => {
        if (!currentFiltered.nodeIds.has(node.id)) return 0;
        return visibleLabelIds.has(node.id) ? 1 : 0;
      });

      haloSelection.interrupt("focus").transition(transition)
        .attr("r", (node) => node.id === focusId ? symbolRadius(node) + (state.selectedId ? 9 : 6) : 0)
        .attr("opacity", (node) => node.id === focusId ? (state.selectedId ? 0.9 : 0.55) : 0)
        .attr("stroke", (node) => node.id === state.selectedId ? "#ffd166" : "#fff8e7")
        .attr("stroke-width", (node) => node.id === state.selectedId ? 2.2 : 1.4);
    }

    function tweenNumber(selector, nextValue, animate) {
      const selection = d3.select(selector);
      if (selection.empty()) return;
      const startValue = +String(selection.text()).replaceAll(",", "") || 0;
      selection.interrupt("count").transition("count")
        .duration(animate ? logic.motionDuration(280, reducedMotion) : 0)
        .tween("text", () => {
          const interpolate = d3.interpolateNumber(startValue, nextValue);
          return (time) => selection.text(formatInteger(Math.round(interpolate(time))));
        });
    }

    function selectPerson(personId, focus = false) {
      state.selectedId = personId;
      state.hoveredId = null;
      hideNetworkTooltip();
      updateGraph(true);
      if (!personId) return;
      const node = nodeById.get(personId);
      d3.select("#person-search").property("value", node.name);
      window.setTimeout(traceSelectedLinks, DURATION);
      if (focus) {
        svg.transition("zoom").duration(FOCUS_DURATION).ease(d3.easeCubicInOut).call(
          zoom.transform,
          d3.zoomIdentity.translate(WIDTH / 2, HEIGHT / 2).scale(1.8).translate(-node.x, -node.y)
        );
      }
    }

    function traceSelectedLinks() {
      if (!state.selectedId || reducedMotion) return;
      linkSelection.filter((link) => link.source === state.selectedId || link.target === state.selectedId)
        .interrupt("trace")
        .attr("stroke-dasharray", "5 5")
        .attr("stroke-dashoffset", 20)
        .transition("trace").duration(520).ease(d3.easeCubicOut)
        .attr("stroke-dashoffset", 0)
        .on("end", function () { d3.select(this).attr("stroke-dasharray", null); });
    }

    function clearSelection(clearSearch = false) {
      state.selectedId = null;
      state.hoveredId = null;
      if (clearSearch) d3.select("#person-search").property("value", "");
      updateCareer();
    }

    function setupControls() {
      const genreSelect = d3.select("#genre-filter");
      if (!genreSelect.empty()) {
        genreSelect.selectAll("option.genre-option").data(allGenres).join("option")
          .attr("class", "genre-option").attr("value", (genre) => genre).text((genre) => genre);
        genreSelect.on("change", function () {
          state.genre = this.value;
          updateGraph(true);
        });
      }

      d3.select("#shared-movies").on("input", function () {
        state.threshold = +this.value;
        updateGraph(true);
      });

      d3.select("#network-reset").on("click", () => {
        state.genre = "All";
        state.threshold = DEFAULT_THRESHOLD;
        state.selectedId = null;
        state.hoveredId = null;
        d3.select("#genre-filter").property("value", "All");
        d3.select("#shared-movies").property("value", DEFAULT_THRESHOLD);
        d3.select("#person-search").property("value", "");
        closeSearchResults();
        logic.restoreNodePositions(nodes);
        refreshPositions();
        svg.transition("zoom").duration(logic.motionDuration(480, reducedMotion)).ease(d3.easeCubicInOut)
          .call(zoom.transform, d3.zoomIdentity);
        updateGraph(true);
      });

      setupSearch();
    }

    function setupSearch() {
      const input = d3.select("#person-search");
      const results = d3.select("#person-results");
      if (input.empty() || results.empty()) return;
      let matches = [];

      function showResults() {
        const query = normalize(input.property("value").trim());
        if (!query) return closeSearchResults();
        matches = nodes.filter((node) => normalize(node.name).includes(query))
          .sort((a, b) => d3.descending(normalize(a.name).startsWith(query), normalize(b.name).startsWith(query)) || b.weighted_degree - a.weighted_degree)
          .slice(0, 8);
        results.classed("is-open", true).selectAll("li").data(matches.length ? matches : [null]).join("li")
          .attr("role", "option")
          .each(function (node) {
            const item = d3.select(this).html("");
            if (!node) return item.append("span").attr("class", "tooltip-muted").text("No matching person");
            item.append("span").text(node.name);
            item.append("span").attr("class", "search-result-role").text(`${node.role} · ${node.movie_count} movies`);
          })
          .on("mousedown", (event, node) => { event.preventDefault(); if (node) pickSearchResult(node); });
        input.attr("aria-expanded", "true");
      }

      function pickSearchResult(node) {
        if (!currentFiltered.nodeIds.has(node.id)) {
          state.genre = "All";
          state.threshold = DEFAULT_THRESHOLD;
          d3.select("#genre-filter").property("value", "All");
          d3.select("#shared-movies").property("value", DEFAULT_THRESHOLD);
          updateGraph(false);
        }
        input.property("value", node.name);
        closeSearchResults();
        selectPerson(node.id, true);
      }

      input.on("input", showResults).on("focus", showResults)
        .on("blur", () => window.setTimeout(closeSearchResults, 90))
        .on("keydown", (event) => {
          if (event.key === "Enter" && matches.length) pickSearchResult(matches[0]);
          if (event.key === "Escape") closeSearchResults();
        });

    }

    function closeSearchResults() {
      d3.select("#person-results").classed("is-open", false).html("");
      d3.select("#person-search").attr("aria-expanded", "false");
    }

    function updateCareer() {
      const panel = d3.select("#career-panel");
      if (panel.empty()) return;
      const chart = d3.select("#career-chart");
      const empty = d3.select("#career-empty");
      const legend = d3.select("#career-legend");
      chart.selectAll("*").remove();
      legend.selectAll("*").remove();

      if (!state.selectedId) {
        panel.classed("has-selection", false);
        d3.select("#career-title").text("Select a person to explore their career");
        d3.select("#career-subtitle").text("Click a circle or diamond in the network above.");
        empty.attr("hidden", null);
        chart.attr("hidden", true);
        hideCareerTooltip();
        return;
      }

      const person = nodeById.get(state.selectedId);
      const movies = (careers[state.selectedId] || []).filter((movie) => Number.isFinite(+movie.year) && Number.isFinite(+movie.vote_average));
      d3.select("#career-title").text(`${person.name}'s career`);
      d3.select("#career-subtitle").text(`${person.role} · ${movies.length} films in this dataset`);
      empty.attr("hidden", true);
      chart.attr("hidden", null);
      panel.classed("has-selection", true);

      const width = 1060;
      const height = 380;
      const margin = { top: 24, right: 26, bottom: 54, left: 58 };
      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;
      const careerSvg = chart.append("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("role", "img")
        .attr("aria-label", `${person.name} film career by release year and TMDB rating`);
      const plot = careerSvg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
      const yearExtent = d3.extent(movies, (movie) => +movie.year);
      if (yearExtent[0] === yearExtent[1]) { yearExtent[0] -= 1; yearExtent[1] += 1; }
      const x = d3.scaleLinear().domain(yearExtent).nice().range([0, innerWidth]);
      const ratingExtent = d3.extent(movies, (movie) => +movie.vote_average);
      const ratingPad = Math.max(0.35, (ratingExtent[1] - ratingExtent[0]) * 0.15);
      const y = d3.scaleLinear().domain([Math.max(0, ratingExtent[0] - ratingPad), Math.min(10, ratingExtent[1] + ratingPad)]).nice().range([innerHeight, 0]);
      const revenueMax = d3.max(movies, (movie) => +movie.revenue || 0) || 1;
      const radius = d3.scaleSqrt().domain([0, revenueMax]).range([4, 17]);

      plot.append("g").attr("class", "career-grid").call(d3.axisLeft(y).ticks(6).tickSize(-innerWidth).tickFormat(""));
      plot.append("g").attr("class", "career-axis").attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).ticks(Math.min(10, yearExtent[1] - yearExtent[0] + 1)).tickFormat(d3.format("d")));
      plot.append("g").attr("class", "career-axis").call(d3.axisLeft(y).ticks(6));
      careerSvg.append("text").attr("x", margin.left + innerWidth / 2).attr("y", height - 12).attr("text-anchor", "middle")
        .attr("fill", "#8b949e").attr("font-size", 11).text("Release year");
      careerSvg.append("text").attr("transform", `translate(15,${margin.top + innerHeight / 2}) rotate(-90)`).attr("text-anchor", "middle")
        .attr("fill", "#8b949e").attr("font-size", 11).text("TMDB rating");

      plot.selectAll("circle").data(movies, (movie) => movie.tmdbId).join("circle")
        .attr("class", "career-dot")
        .attr("cx", (movie) => x(+movie.year)).attr("cy", (movie) => y(+movie.vote_average)).attr("r", 0)
        .attr("fill", (movie) => careerColor((movie.genres || ["Other"])[0] || "Other"))
        .attr("fill-opacity", 0.82)
        .on("mouseenter", showMovieTooltip).on("mousemove", moveCareerTooltip).on("mouseleave", hideCareerTooltip)
        .transition("career-enter")
        .delay((movie) => reducedMotion ? 0 : Math.max(0, +movie.year - yearExtent[0]) * 18)
        .duration(logic.motionDuration(320, reducedMotion)).ease(d3.easeBackOut.overshoot(1.15))
        .attr("r", (movie) => movie.revenue ? radius(+movie.revenue) : 4);

      const careerGenres = [...new Set(movies.map((movie) => (movie.genres || ["Other"])[0] || "Other"))].sort(d3.ascending);
      legend.selectAll("span").data(careerGenres).join("span")
        .html((genre) => `<i style="background:${careerColor(genre)}"></i>${escapeHtml(genre)}`);
    }

    function networkTooltip() {
      let tooltip = d3.select("#network-tooltip");
      if (tooltip.empty()) tooltip = root.append("div").attr("id", "network-tooltip").attr("class", "chart-tooltip");
      return tooltip;
    }

    function showNodeTooltip(event, node) {
      const current = currentStrength.get(node.id) || 0;
      networkTooltip().html(`<div class="tooltip-title">${escapeHtml(node.name)}</div>
        <div class="tooltip-muted">${escapeHtml(node.role)} · ${formatInteger(node.movie_count)} movies</div>
        <div class="tooltip-rule"></div>
        <div>Current collaboration strength: <strong>${formatInteger(current)}</strong></div>
        <div>Overall strength: ${formatInteger(node.weighted_degree)}</div>
        <div class="tooltip-muted">Community ${node.community} · Click for career view</div>`).classed("is-visible", true);
      moveNetworkTooltip(event);
    }

    function showEdgeTooltip(event, link) {
      const filtered = currentFiltered.links.find((item) => `${item.source}|${item.target}` === link.key);
      if (!filtered) return;
      const titles = filtered.filtered_movies.map((movieId) => allMovies.get(+movieId)?.title).filter(Boolean);
      networkTooltip().html(`<div class="tooltip-title">${escapeHtml(link.sourceNode.name)} + ${escapeHtml(link.targetNode.name)}</div>
        <div><strong>${filtered.filtered_count}</strong> shared movie${filtered.filtered_count === 1 ? "" : "s"}${state.genre === "All" ? "" : ` in ${escapeHtml(state.genre)}`}</div>
        <div class="tooltip-rule"></div><div class="tooltip-muted">${titles.map(escapeHtml).join(" · ")}</div>`).classed("is-visible", true);
      moveNetworkTooltip(event);
    }

    function moveTooltipWithin(event, tooltip, container) {
      const bounds = container.node().getBoundingClientRect();
      const tipBounds = tooltip.node().getBoundingClientRect();
      let left = event.clientX - bounds.left + 14;
      let top = event.clientY - bounds.top + 14;
      if (left + tipBounds.width > bounds.width) left = event.clientX - bounds.left - tipBounds.width - 14;
      if (top + tipBounds.height > bounds.height) top = Math.max(6, event.clientY - bounds.top - tipBounds.height - 14);
      tooltip.style("left", `${Math.max(6, left)}px`).style("top", `${Math.max(6, top)}px`);
    }

    function moveNetworkTooltip(event) { moveTooltipWithin(event, networkTooltip(), root); }
    function hideNetworkTooltip() { networkTooltip().classed("is-visible", false); }

    function showMovieTooltip(event, movie) {
      const genres = (movie.genres || []).join(" · ") || "Genre unavailable";
      const revenue = movie.revenue ? `$${d3.format(",.0f")(+movie.revenue)}` : "Not reported";
      d3.select("#career-tooltip").html(`<div class="tooltip-title">${escapeHtml(movie.title)}</div>
        <div class="tooltip-muted">${movie.year} · ${escapeHtml(genres)}</div>
        <div class="tooltip-rule"></div><div>TMDB rating: <strong>${(+movie.vote_average).toFixed(2)}</strong> / 10</div>
        <div>Revenue: ${revenue}</div>`).classed("is-visible", true);
      moveCareerTooltip(event);
    }

    function moveCareerTooltip(event) {
      const tooltip = d3.select("#career-tooltip");
      const container = d3.select("#career-panel");
      if (!tooltip.empty() && !container.empty()) moveTooltipWithin(event, tooltip, container);
    }
    function hideCareerTooltip() { d3.select("#career-tooltip").classed("is-visible", false); }

  }).catch((error) => {
    console.error("Error loading Visualization 3:", error);
    root.append("p").style("color", "#f85149").text("Unable to load the collaboration network.");
  });
})();
