# Visualizations

Status notes for each of the 5 planned visualizations. Only Visualization 2 has a static build so far.

## Visualization 2 — Audience Similarity Network

**Static version (done):** a node-link graph of the 80 most-rated candidate movies. An edge means a large number of MovieLens users rated both movies ≥4/5 ("liked both"); each node keeps only its 5 strongest edges, so the graph stays readable instead of turning into a fully-connected mesh. Node size reflects how many strong connections a movie has; edge thickness reflects how strong the shared-audience overlap is; color is the movie's primary genre. Layout is `d3.forceSimulation` run to a resting position once on page load — nothing is clickable or draggable yet.

Built from `data/processed/ratings_candidates.csv` (`src/export_viz2_network.py` → `web/data/viz2_similarity_network.json`), rendered in `web/index.html` / `web/js/viz2_similarity_network.js`.

**Planned interactions/animations:**
- **Click a node** to re-center the view on that movie and highlight (fade out everything else) just its direct neighbors — lets a user ask "what else do people who liked this movie also like?", which is the whole point of this visualization.
- **Hover tooltip** on a node showing title, genre, and its exact overlap counts with connected movies.
- **Drag** nodes to manually untangle a crowded area.
- **Genre filter**: clicking a legend entry dims all nodes not in that genre, to check whether strong connections tend to stay within a genre or cross genre lines.
- A brief **transition/animation** when re-centering (nodes animating to new positions rather than snapping) so the "who's connected to whom" relationship reads clearly instead of the layout just jumping.
