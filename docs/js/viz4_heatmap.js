// ============================================================
// Visualization 4
// Genre Ratings Over Time
// Static Interim Check-In Version
//
// X = Release year
// Y = Genre
// Color = Vote-count-weighted average TMDB rating
//
// 2026 is marked with an asterisk because it contains
// partial-year data.
// ============================================================


d3.json("data/viz4_genre_heatmap.json")
    .then(function (data) {


        // ----------------------------------------------------
        // 1. Read data
        // ----------------------------------------------------

        const cells =
            data.cells ||
            data.data ||
            [];


        const years =
            data.metadata?.years ||
            Array.from(
                new Set(
                    cells.map(
                        d => +d.year
                    )
                )
            ).sort(
                (a, b) => a - b
            );


        const genres =
            data.metadata?.genres ||
            Array.from(
                new Set(
                    cells.map(
                        d => d.genre
                    )
                )
            );


        d3.select("#genre-count")
            .text(genres.length);


        // ----------------------------------------------------
        // 2. Chart settings
        // ----------------------------------------------------

        // Extra top space is intentionally reserved for:
        //
        // Legend title
        // Gradient
        // Numeric values
        // Semantic labels
        // Gap
        // Year axis
        //
        // This prevents the legend from overlapping the years.

        const margin = {
            top: 135,
            right: 35,
            bottom: 45,
            left: 135
        };


        const cellWidth = 68;
        const cellHeight = 36;


        const innerWidth =
            years.length *
            cellWidth;


        const innerHeight =
            genres.length *
            cellHeight;


        const width =
            margin.left +
            innerWidth +
            margin.right;


        const height =
            margin.top +
            innerHeight +
            margin.bottom;


        const svg = d3
            .select("#heatmap")
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
            );


        const chart = svg
            .append("g")

            .attr(
                "transform",
                `translate(${margin.left}, ${margin.top})`
            );


        // ----------------------------------------------------
        // 3. Position scales
        // ----------------------------------------------------

        const xScale = d3
            .scaleBand()

            .domain(years)

            .range([
                0,
                innerWidth
            ])

            .padding(0.04);


        const yScale = d3
            .scaleBand()

            .domain(genres)

            .range([
                0,
                innerHeight
            ])

            .padding(0.04);


        // ----------------------------------------------------
        // 4. Rating color scale
        // ----------------------------------------------------

        const validRatings =
            cells
                .map(
                    d =>
                        +d.weighted_rating
                )
                .filter(
                    value =>
                        Number.isFinite(value)
                );


        const ratingExtent =
            d3.extent(
                validRatings
            );


        // Fallback in case no valid rating is available.
        if (
            ratingExtent[0] === undefined ||
            ratingExtent[1] === undefined
        ) {

            ratingExtent[0] = 0;
            ratingExtent[1] = 10;

        }


        // Prevent zero-width domain.
        if (
            ratingExtent[0] ===
            ratingExtent[1]
        ) {

            ratingExtent[1] =
                ratingExtent[0] + 1;

        }


        const colorScale = d3
            .scaleSequential()

            .domain(
                ratingExtent
            )

            .interpolator(
                d3.interpolateYlGnBu
            );


        // ----------------------------------------------------
        // 5. Draw heatmap cells
        // ----------------------------------------------------

        chart
            .selectAll(".heatmap-cell")

            .data(cells)

            .join("rect")

            .attr(
                "class",
                "heatmap-cell"
            )

            .attr(
                "x",
                d =>
                    xScale(
                        +d.year
                    )
            )

            .attr(
                "y",
                d =>
                    yScale(
                        d.genre
                    )
            )

            .attr(
                "width",
                xScale.bandwidth()
            )

            .attr(
                "height",
                yScale.bandwidth()
            )

            .attr(
                "rx",
                3
            )

            .attr(
                "ry",
                3
            )

            .attr(
                "fill",
                d => {

                    const rating =
                        +d.weighted_rating;


                    if (
                        !Number.isFinite(
                            rating
                        )
                    ) {

                        return "#30363d";

                    }


                    return colorScale(
                        rating
                    );

                }
            );


        // ----------------------------------------------------
        // 6. X axis — years
        // ----------------------------------------------------

        const xAxis = d3
            .axisTop(
                xScale
            )

            .tickSize(0)

            .tickPadding(12)

            .tickFormat(
                year => {

                    if (
                        +year === 2026
                    ) {

                        return "2026*";

                    }


                    return year;

                }
            );


        const xAxisGroup = chart
            .append("g")

            .attr(
                "class",
                "heatmap-axis heatmap-x-axis"
            )

            .call(
                xAxis
            );


        xAxisGroup
            .select(".domain")
            .remove();


        xAxisGroup
            .selectAll("text")

            .attr(
                "fill",
                "#e6edf3"
            )

            .attr(
                "font-size",
                10.5
            );


        // ----------------------------------------------------
        // 7. Y axis — genres
        // ----------------------------------------------------

        const yAxis = d3
            .axisLeft(
                yScale
            )

            .tickSize(0)

            .tickPadding(10);


        const yAxisGroup = chart
            .append("g")

            .attr(
                "class",
                "heatmap-axis heatmap-y-axis"
            )

            .call(
                yAxis
            );


        yAxisGroup
            .select(".domain")
            .remove();


        yAxisGroup
            .selectAll("text")

            .attr(
                "fill",
                "#e6edf3"
            )

            .attr(
                "font-size",
                10.5
            );


        // ----------------------------------------------------
        // 8. Static legend
        // ----------------------------------------------------

        // The legend is aligned with the left side of the
        // heatmap instead of being placed above the last years.

        const legendWidth = 300;
        const legendHeight = 10;

        const legendX = margin.left;
        const legendY = 34;


        // ----------------------------------------------------
        // 9. Gradient definition
        // ----------------------------------------------------

        const defs =
            svg.append("defs");


        const gradient =
            defs
                .append(
                    "linearGradient"
                )

                .attr(
                    "id",
                    "rating-gradient"
                )

                .attr(
                    "x1",
                    "0%"
                )

                .attr(
                    "x2",
                    "100%"
                )

                .attr(
                    "y1",
                    "0%"
                )

                .attr(
                    "y2",
                    "0%"
                );


        const stops =
            d3.range(
                0,
                1.01,
                0.1
            );


        gradient
            .selectAll("stop")

            .data(stops)

            .join("stop")

            .attr(
                "offset",
                d =>
                    `${d * 100}%`
            )

            .attr(
                "stop-color",
                d => {

                    const value =
                        ratingExtent[0] +
                        d *
                        (
                            ratingExtent[1] -
                            ratingExtent[0]
                        );


                    return colorScale(
                        value
                    );

                }
            );


        // ----------------------------------------------------
        // 10. Legend title
        // ----------------------------------------------------

        svg
            .append("text")

            .attr(
                "x",
                legendX
            )

            .attr(
                "y",
                legendY - 12
            )

            .attr(
                "fill",
                "#e6edf3"
            )

            .attr(
                "font-size",
                12
            )

            .attr(
                "font-weight",
                600
            )

            .text(
                "Weighted Average Rating"
            );


        // ----------------------------------------------------
        // 11. Gradient bar
        // ----------------------------------------------------

        svg
            .append("rect")

            .attr(
                "x",
                legendX
            )

            .attr(
                "y",
                legendY
            )

            .attr(
                "width",
                legendWidth
            )

            .attr(
                "height",
                legendHeight
            )

            .attr(
                "rx",
                2
            )

            .attr(
                "fill",
                "url(#rating-gradient)"
            );


        // ----------------------------------------------------
        // 12. Numeric legend values
        // ----------------------------------------------------

        svg
            .append("text")

            .attr(
                "x",
                legendX
            )

            .attr(
                "y",
                legendY + 30
            )

            .attr(
                "fill",
                "#8b949e"
            )

            .attr(
                "font-size",
                10
            )

            .text(
                ratingExtent[0]
                    .toFixed(1)
            );


        svg
            .append("text")

            .attr(
                "x",
                legendX +
                legendWidth
            )

            .attr(
                "y",
                legendY + 30
            )

            .attr(
                "text-anchor",
                "end"
            )

            .attr(
                "fill",
                "#8b949e"
            )

            .attr(
                "font-size",
                10
            )

            .text(
                ratingExtent[1]
                    .toFixed(1)
            );


        // ----------------------------------------------------
        // 13. Semantic legend labels
        // ----------------------------------------------------

        svg
            .append("text")

            .attr(
                "x",
                legendX
            )

            .attr(
                "y",
                legendY + 50
            )

            .attr(
                "fill",
                "#8b949e"
            )

            .attr(
                "font-size",
                9.5
            )

            .text(
                "Lower rating"
            );


        svg
            .append("text")

            .attr(
                "x",
                legendX +
                legendWidth
            )

            .attr(
                "y",
                legendY + 50
            )

            .attr(
                "text-anchor",
                "end"
            )

            .attr(
                "fill",
                "#8b949e"
            )

            .attr(
                "font-size",
                9.5
            )

            .text(
                "Higher rating"
            );


        // ----------------------------------------------------
        // 14. Partial-year note
        // ----------------------------------------------------

        svg
            .append("text")

            .attr(
                "x",
                margin.left +
                innerWidth
            )

            .attr(
                "y",
                margin.top -
                40
            )

            .attr(
                "text-anchor",
                "end"
            )

            .attr(
                "fill",
                "#8b949e"
            )

            .attr(
                "font-size",
                9.5
            )

            .text(
                "* 2026 contains partial-year data"
            );

    })


    .catch(function (error) {

        console.error(
            "Error loading Visualization 4:",
            error
        );


        d3.select("#heatmap")
            .append("p")

            .style(
                "color",
                "#f85149"
            )

            .text(
                "Unable to load the genre heatmap."
            );

    });