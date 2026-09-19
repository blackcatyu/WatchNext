async function renderViz2(svgSelector) {
  const data = await d3.json("data/viz2_similarity_network.json");
  const { nodes, links } = data;

  const svg = d3.select(svgSelector);
  const width = +svg.attr("width");
  const height = +svg.attr("height");

  const genreCounts = d3.rollup(nodes, (v) => v.length, (d) => d.genre);
  const topGenres = [...genreCounts.entries()]
    .sort((a, b) => d3.descending(a[1], b[1]))
    .slice(0, 9)
    .map((d) => d[0]);
  const color = d3.scaleOrdinal().domain(topGenres).range(d3.schemeTableau10);
  const genreOf = (d) => (topGenres.includes(d.genre) ? d.genre : "Other");
  color.unknown("#6e7681");

  const degree = new Map(nodes.map((d) => [d.id, 0]));
  links.forEach((l) => {
    degree.set(l.source, (degree.get(l.source) || 0) + 1);
    degree.set(l.target, (degree.get(l.target) || 0) + 1);
  });
  const radius = d3.scaleSqrt()
    .domain([0, d3.max(nodes, (d) => degree.get(d.id)) || 1])
    .range([5, 16]);

  const simulation = d3
    .forceSimulation(nodes)
    .force("link", d3.forceLink(links).id((d) => d.id).distance(110).strength(0.2))
    .force("charge", d3.forceManyBody().strength(-320))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide((d) => radius(degree.get(d.id)) + 14));

  for (let i = 0; i < 500; i++) simulation.tick();
  simulation.stop();

  svg
    .append("g")
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("class", "link")
    .attr("stroke-width", (d) => Math.sqrt(d.weight) / 40)
    .attr("x1", (d) => d.source.x)
    .attr("y1", (d) => d.source.y)
    .attr("x2", (d) => d.target.x)
    .attr("y2", (d) => d.target.y);

  const node = svg
    .append("g")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .attr("class", "node")
    .attr("transform", (d) => `translate(${d.x},${d.y})`);

  node
    .append("circle")
    .attr("r", (d) => radius(degree.get(d.id)))
    .attr("fill", (d) => color(genreOf(d)))
    .attr("stroke", "#0f1216")
    .attr("stroke-width", 1);

  node
    .append("text")
    .attr("dy", (d) => -radius(degree.get(d.id)) - 3)
    .attr("text-anchor", "middle")
    .text((d) => (degree.get(d.id) >= 7 ? d.title : ""));

  const legend = svg.append("g").attr("class", "legend").attr("transform", "translate(10,10)");
  const legendGenres = [...topGenres, "Other"];
  legendGenres.forEach((g, i) => {
    const row = legend.append("g").attr("transform", `translate(0, ${i * 14})`);
    row.append("circle").attr("r", 4).attr("fill", color(g));
    row.append("text").attr("x", 8).attr("y", 3).text(g);
  });
}

renderViz2("#viz2-svg");
