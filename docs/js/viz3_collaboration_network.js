// Static collaboration network.
// The exported dataset already applies the
// >=5 person-movies and >=3 shared-movies thresholds;
// do not filter it again.

d3.json("data/viz3_collaboration_network.json")
.then(function (data) {

    const nodes = data.nodes.map(d => ({ ...d }));
    const links = data.links.map(d => ({ ...d }));

    const width = 1100;
    const height = 760;
    const padding = 38;

    const goldenAngle =
        Math.PI * (3 - Math.sqrt(5));


    // --------------------------------------------------
    // Summary
    // --------------------------------------------------

    d3.select("#person-count")
        .text(nodes.length);

    d3.select("#collaboration-count")
        .text(links.length);


    // --------------------------------------------------
    // Visual encodings
    // --------------------------------------------------

    const nodeRadius = d3.scaleSqrt()
        .domain(
            d3.extent(
                nodes,
                d => d.weighted_degree
            )
        )
        .range([5, 14]);


    const edgeWidth = d3.scaleLinear()
        .domain([
            3,
            d3.max(
                links,
                d => d.collaboration_count
            )
        ])
        .range([1, 5]);


    const isDirector = d =>
        d.role.toLowerCase() === "director";


    // A diamond's vertical tip extends farther
    // than the equivalent circle.

    const symbolRadius = d =>
        nodeRadius(d.weighted_degree) *
        (
            isDirector(d)
                ? Math.sqrt(
                    Math.PI *
                    1.15 *
                    Math.sqrt(3) /
                    2
                )
                : 1
        );


    // --------------------------------------------------
    // Communities
    // --------------------------------------------------

    const communities = Array.from(
        d3.group(
            nodes,
            d => d.community
        ),
        ([id, members]) => ({
            id,
            members
        })
    )
    .sort(
        (a, b) =>
            d3.ascending(a.id, b.id)
    );


    const communityById =
        new Map(
            communities.map(
                d => [d.id, d]
            )
        );


    const nodeById =
        new Map(
            nodes.map(
                d => [d.id, d]
            )
        );


    // Stable colors based on collaboration
    // community, not actor/director role.

    const communityColor =
        d3.scaleOrdinal()
            .domain(
                communities.map(
                    d => d.id
                )
            )
            .range(
                communities.map(
                    (d, i) =>
                        d3.hcl(
                            (
                                i * 137.508 + 20
                            ) % 360,
                            48,
                            66 + (i % 3) * 7
                        ).formatHex()
                )
            );


    // --------------------------------------------------
    // Example community legend
    // --------------------------------------------------
    //
    // Only two communities are shown here.
    // The purpose is to explain what the colors mean,
    // rather than listing every detected community.

    const exampleCommunities =
        communities
            .slice()
            .sort(
                (a, b) =>
                    b.members.length -
                    a.members.length
            )
            .slice(0, 2);


    const legend =
        d3.select("#community-legend")
            .selectAll("li")
            .data(exampleCommunities)
            .join("li")
            .attr(
                "class",
                "community-legend-item"
            );


    legend.append("span")
        .attr(
            "class",
            "community-swatch"
        )
        .attr(
            "aria-hidden",
            "true"
        )
        .style(
            "background-color",
            d => communityColor(d.id)
        );


    const legendText =
        legend.append("div");


    legendText.append("strong")
        .text(
            d =>
                `Community ${d.id}`
        );


    legendText.append("span")
        .attr(
            "class",
            "community-members"
        )
        .text(
            d =>
                d.members
                    .slice()
                    .sort(
                        (a, b) =>
                            b.weighted_degree -
                            a.weighted_degree ||
                            d3.ascending(
                                a.name,
                                b.name
                            )
                    )
                    .slice(0, 2)
                    .map(
                        person =>
                            person.name
                    )
                    .join(" / ")
        );


    // --------------------------------------------------
    // Community-level layout
    // --------------------------------------------------

    const communityLinks =
        links
            .map(d => ({
                source:
                    nodeById
                        .get(d.source)
                        .community,

                target:
                    nodeById
                        .get(d.target)
                        .community
            }))
            .filter(
                d =>
                    d.source !==
                    d.target
            );


    function settle(simulation) {

        simulation
            .stop()
            .alphaMin(0.0001)
            .alphaDecay(0.025);


        // Manual ticks finish before anything
        // is rendered, so there is no visible
        // force animation.

        while (
            simulation.alpha() >
            simulation.alphaMin()
        ) {
            simulation.tick();
        }


        // Let residual velocity decay.

        for (
            let i = 0;
            i < 200;
            i++
        ) {

            simulation.tick();

            if (
                d3.max(
                    simulation.nodes(),
                    d =>
                        Math.hypot(
                            d.vx,
                            d.vy
                        )
                ) < 0.001
            ) {
                break;
            }
        }
    }


    settle(
        d3.forceSimulation(
            communities
        )
        .stop()

        .force(
            "link",

            d3.forceLink(
                communityLinks
            )
            .id(
                d => d.id
            )
            .distance(95)
            .strength(0.15)
        )

        .force(
            "charge",

            d3.forceManyBody()
                .strength(-170)
        )

        .force(
            "x",

            d3.forceX(0)
                .strength(0.015)
        )

        .force(
            "y",

            d3.forceY(0)
                .strength(0.035)
        )

        .force(
            "collision",

            d3.forceCollide(
                d =>
                    Math.sqrt(
                        d.members.length
                    ) * 17 + 10
            )
            .iterations(3)
        )
    );


    // --------------------------------------------------
    // Initial positions inside each community
    // --------------------------------------------------

    communities.forEach(
        community => {

            community.members.forEach(
                (node, i) => {

                    const radius =
                        Math.sqrt(
                            i + 0.5
                        ) * 16;


                    node.x =
                        community.x +
                        Math.cos(
                            i *
                            goldenAngle
                        ) *
                        radius;


                    node.y =
                        community.y +
                        Math.sin(
                            i *
                            goldenAngle
                        ) *
                        radius;
                }
            );
        }
    );


    // --------------------------------------------------
    // Person-level force layout
    // --------------------------------------------------

    settle(
        d3.forceSimulation(nodes)
            .stop()

            .force(
                "link",

                d3.forceLink(links)
                    .id(
                        d => d.id
                    )
                    .distance(
                        d =>
                            Math.max(
                                32,
                                58 -
                                (
                                    d.collaboration_count -
                                    3
                                ) *
                                4
                            )
                    )
                    .strength(0.65)
            )

            .force(
                "charge",

                d3.forceManyBody()
                    .strength(-35)
            )

            .force(
                "communityX",

                d3.forceX(
                    d =>
                        communityById
                            .get(
                                d.community
                            )
                            .x
                )
                .strength(0.16)
            )

            .force(
                "communityY",

                d3.forceY(
                    d =>
                        communityById
                            .get(
                                d.community
                            )
                            .y
                )
                .strength(0.16)
            )

            .force(
                "collision",

                d3.forceCollide(
                    d =>
                        symbolRadius(d) +
                        3
                )
                .iterations(3)
            )
    );


    // --------------------------------------------------
    // Fit network into SVG
    // --------------------------------------------------

    const minX =
        d3.min(
            nodes,
            d =>
                d.x -
                symbolRadius(d)
        );


    const maxX =
        d3.max(
            nodes,
            d =>
                d.x +
                symbolRadius(d)
        );


    const minY =
        d3.min(
            nodes,
            d =>
                d.y -
                symbolRadius(d)
        );


    const maxY =
        d3.max(
            nodes,
            d =>
                d.y +
                symbolRadius(d)
        );


    const scale =
        Math.min(

            (
                width -
                padding * 2
            ) /
            (
                maxX -
                minX
            ),

            (
                height -
                padding * 2
            ) /
            (
                maxY -
                minY
            )
        );


    nodes.forEach(
        d => {

            d.x =
                width / 2 +
                (
                    d.x -
                    (
                        minX +
                        maxX
                    ) /
                    2
                ) *
                scale;


            d.y =
                height / 2 +
                (
                    d.y -
                    (
                        minY +
                        maxY
                    ) /
                    2
                ) *
                scale;
        }
    );


    // --------------------------------------------------
    // SVG
    // --------------------------------------------------

    const svg =
        d3.select("#network")
            .append("svg")

            .attr(
                "width",
                width
            )

            .attr(
                "height",
                height
            )

            .attr(
                "viewBox",
                `0 0 ${width} ${height}`
            )

            .attr(
                "role",
                "img"
            )

            .attr(
                "aria-label",
                `${nodes.length} people and ${links.length} collaborations. Color indicates collaboration community; circles are actors and diamonds are directors.`
            )

            // Static visualization:
            // no mouse interaction.
            .attr(
                "pointer-events",
                "none"
            );


    // --------------------------------------------------
    // Edges
    // --------------------------------------------------

    svg.append("g")
        .attr(
            "class",
            "network-links"
        )

        .selectAll("line")

        .data(links)

        .join("line")

        .attr(
            "x1",
            d => d.source.x
        )

        .attr(
            "y1",
            d => d.source.y
        )

        .attr(
            "x2",
            d => d.target.x
        )

        .attr(
            "y2",
            d => d.target.y
        )

        .attr(
            "stroke",
            "#8b949e"
        )

        .attr(
            "stroke-opacity",
            0.4
        )

        .attr(
            "stroke-width",
            d =>
                edgeWidth(
                    d.collaboration_count
                )
        );


    // --------------------------------------------------
    // Nodes
    // --------------------------------------------------

    svg.append("g")
        .attr(
            "class",
            "network-nodes"
        )

        .selectAll("path")

        .data(nodes)

        .join("path")

        .attr(
            "transform",
            d =>
                `translate(${d.x}, ${d.y})`
        )

        .attr(
            "d",
            d =>
                d3.symbol()

                    .type(
                        isDirector(d)
                            ? d3.symbolDiamond
                            : d3.symbolCircle
                    )

                    .size(
                        Math.PI *
                        nodeRadius(
                            d.weighted_degree
                        ) ** 2 *
                        (
                            isDirector(d)
                                ? 1.15
                                : 1
                        )
                    )()
        )

        .attr(
            "fill",
            d =>
                communityColor(
                    d.community
                )
        )

        .attr(
            "fill-opacity",
            0.95
        )

        .attr(
            "stroke",
            "#e6edf3"
        )

        .attr(
            "stroke-width",
            0.8
        );


    // --------------------------------------------------
    // Selected labels
    // --------------------------------------------------

    const labelNodes =
        nodes
            .slice()
            .sort(
                (a, b) =>
                    b.weighted_degree -
                    a.weighted_degree
            )
            .slice(0, 18);


    svg.append("g")
        .attr(
            "class",
            "network-labels"
        )

        .selectAll("text")

        .data(labelNodes)

        .join("text")

        .attr(
            "x",
            d =>
                d.x +
                (
                    d.x >
                    width * 0.75
                        ? -1
                        : 1
                ) *
                (
                    nodeRadius(
                        d.weighted_degree
                    ) +
                    5
                )
        )

        .attr(
            "y",
            d =>
                d.y - 5
        )

        .attr(
            "text-anchor",
            d =>
                d.x >
                width * 0.75
                    ? "end"
                    : "start"
        )

        .text(
            d => d.name
        )

        .attr(
            "fill",
            "#e6edf3"
        )

        .attr(
            "font-size",
            9.5
        )

        .attr(
            "font-weight",
            500
        )

        .attr(
            "paint-order",
            "stroke"
        )

        .attr(
            "stroke",
            "#0f1216"
        )

        .attr(
            "stroke-width",
            3
        )

        .attr(
            "stroke-linejoin",
            "round"
        );


    // --------------------------------------------------
    // Label placement
    // --------------------------------------------------

    const occupied =
        nodes.map(
            d => ({
                x:
                    d.x -
                    symbolRadius(d) -
                    2,

                y:
                    d.y -
                    symbolRadius(d) -
                    2,

                width:
                    symbolRadius(d) *
                    2 +
                    4,

                height:
                    symbolRadius(d) *
                    2 +
                    4
            })
        );


    svg.selectAll(
        ".network-labels text"
    )
    .each(
        function (d) {

            const label =
                d3.select(this);

            const box =
                this.getBBox();

            const gap =
                symbolRadius(d) +
                6;

            const candidates = [];


            for (
                const extra of
                [0, 8, 16, 24]
            ) {

                const offset =
                    gap + extra;


                candidates.push(

                    [
                        d.x + offset,
                        d.y -
                        box.height / 2
                    ],

                    [
                        d.x -
                        offset -
                        box.width,

                        d.y -
                        box.height / 2
                    ],

                    [
                        d.x -
                        box.width / 2,

                        d.y -
                        offset -
                        box.height
                    ],

                    [
                        d.x -
                        box.width / 2,

                        d.y +
                        offset
                    ]
                );
            }


            const placement =
                candidates.find(
                    ([x, y]) =>

                        x >= 8 &&

                        x +
                        box.width <=
                        width - 8 &&

                        y >= 30 &&

                        y +
                        box.height <=
                        height - 8 &&

                        !occupied.some(
                            b =>
                                x <
                                b.x +
                                b.width &&

                                x +
                                box.width >
                                b.x &&

                                y <
                                b.y +
                                b.height &&

                                y +
                                box.height >
                                b.y
                        )
                );


            if (placement) {

                const [x, y] =
                    placement;


                label
                    .attr(
                        "text-anchor",
                        "start"
                    )

                    .attr(
                        "x",
                        x
                    )

                    .attr(
                        "y",
                        y +
                        (
                            Number(
                                label.attr("y")
                            ) -
                            box.y
                        )
                    );


                occupied.push({
                    x:
                        x - 2,

                    y:
                        y - 2,

                    width:
                        box.width + 4,

                    height:
                        box.height + 4
                });

            } else {

                occupied.push(box);
            }
        }
    );


    // --------------------------------------------------
    // Static annotation
    // --------------------------------------------------

    svg.append("text")
        .attr("x", 18)
        .attr("y", 22)
        .attr(
            "fill",
            "#8b949e"
        )
        .attr(
            "font-size",
            10
        )
        .text(
            "Labels show selected high-collaboration people."
        );

})
.catch(function (error) {

    console.error(
        "Error loading Visualization 3:",
        error
    );

    d3.select("#network")
        .append("p")
        .style(
            "color",
            "#f85149"
        )
        .text(
            "Unable to load the collaboration network."
        );
});