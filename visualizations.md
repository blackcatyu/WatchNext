# Visualizations

Status notes for each of the 5 planned visualizations. Only Visualization 2 has a static build so far.

## Visualization 2 — Audience Similarity Network

**Static version (done):** a node-link graph of the 80 most-rated candidate movies. An edge means a large number of MovieLens users rated both movies ≥4/5 ("liked both"); each node keeps only its 5 strongest edges, so the graph stays readable instead of turning into a fully-connected mesh. Node size reflects how many strong connections a movie has; edge thickness reflects how strong the shared-audience overlap is; color is the movie's primary genre. Layout is `d3.forceSimulation` run to a resting position once on page load — nothing is clickable or draggable yet.

Built from `data/processed/ratings_candidates.csv` (`src/export_viz2_network.py` → `docs/data/viz2_similarity_network.json`), rendered in `docs/index.html` / `docs/js/viz2_similarity_network.js`.

**Why only 80 of the 2,914 cleaned movies, and does that change later?** The candidate set has 2,914 movies, but a node-link diagram stops being readable well before a few hundred nodes — that's a legibility limit, not a rendering one, so no amount of animation makes an "all 2,914 nodes at once" view work. The fix isn't a bigger picture, it's **focus + search**: keep the rendered view small always, and use interaction to make the full dataset *reachable* rather than all visible simultaneously. Concretely:
- The **backing similarity computation** expands from today's 80 most-rated movies to all ~1,998 historical-track movies (the ones with real MovieLens ratings — the 916 "recent" movies still can't participate here, same MovieLens-coverage gap as elsewhere in the pipeline). That's just a bigger co-rating matrix, not a bigger drawing.
- The **rendered graph stays small regardless**: clicking a movie re-centers on it and shows only its own top neighbors, so the screen never shows more than one movie's neighborhood at a time, whether the backing set is 80 movies or 1,998.
- A **search box** lets a user jump straight to any of the ~1,998 movies by title, not just the 80 shown by default — this is how the other ~1,900 stay useful without ever being drawn all at once.

**Planned interactions/animations:**
- **Click a node** to re-center the view on that movie and highlight (fade out everything else) just its direct neighbors — lets a user ask "what else do people who liked this movie also like?", which is the whole point of this visualization. Works the same way whether the node came from the default 80 or a search result.
- **Search/jump to any movie** by title across the full ~1,998-movie backing set (see above).
- **Hover tooltip** on a node showing title, genre, and its exact overlap counts with connected movies.
- **Drag** nodes to manually untangle a crowded area.
- **Genre filter**: clicking a legend entry dims all nodes not in that genre, to check whether strong connections tend to stay within a genre or cross genre lines.
- A brief **transition/animation** when re-centering or jumping to a search result (nodes animating to new positions rather than snapping) so the "who's connected to whom" relationship reads clearly instead of the layout just jumping.
