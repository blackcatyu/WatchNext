# Visualizations

Status notes for each planned visualization.

## Visualization 1 — Audience Similarity Network

**Static version (retired):** the interim check-in showed a static 80-movie node-link graph (most-rated movies, 5 strongest edges each). It was replaced by the interactive version below, and its files (`src/export_viz2_network.py`, `docs/js/viz2_similarity_network.js`, `docs/data/viz2_similarity_network.json`) were removed. The interactive audience network's default view is its successor: 80 movies picked across release decades (`DECADE_QUOTA` in `src/export_viz1_explorer.py`; 6 pre-1970, then 8/12/16/16/18/4 for the 1970s–2020s). Picking purely by rating count gave 43 of 80 from the 1990s and only one after 2010.

**Why only 80 of the 2,914 cleaned movies, and does that change later?** The candidate set has 2,914 movies, but a node-link diagram stops being readable well before a few hundred nodes — that's a legibility limit, not a rendering one, so no amount of animation makes an "all 2,914 nodes at once" view work. The fix isn't a bigger picture, it's **focus + search**: keep the rendered view small always, and use interaction to make the full dataset *reachable* rather than all visible simultaneously. Concretely:
- The **backing similarity computation** expands from today's 80 most-rated movies to all ~1,998 historical-track movies (the ones with real MovieLens ratings — the 916 "recent" movies still can't participate here, same MovieLens-coverage gap as elsewhere in the pipeline). That's just a bigger co-rating matrix, not a bigger drawing.
- The **rendered graph stays small regardless**: clicking a movie re-centers on it and shows only its own top neighbors, so the screen never shows more than one movie's neighborhood at a time, whether the backing set is 80 movies or 1,998.
- A **search box** lets a user jump straight to any of the ~1,998 movies by title, not just the 80 shown by default — this is how the other ~1,900 stay useful without ever being drawn all at once.

**What about the review keywords and sentiment scores?** Not used yet either. The proposal's stated goal for this visualization is checking whether audience similarity tracks shared genres/keywords/actors/directors, but the static version only encodes genre (as node color) — `review_keywords.jsonl` (TF-IDF keywords) and `review_sentiment_summary.csv` (the sentiment-model output, one row per movie: % positive, review count) aren't wired in anywhere yet. Rather than forcing them into the node's primary encoding (color is already genre, size is already connection count — adding more channels there gets cluttered fast), they belong in the same click-triggered detail panel below: a lightweight, on-demand way to actually check "do these two strongly-connected movies share keywords/sentiment," which is exactly the comparison the proposal asks for.

**What about the recent-track movies (2016–2026)?** They have zero MovieLens ratings by construction (that's *why* they're a separate track — see `data/README.md`), so there's no data to compute a co-rating edge for them, ever. They can't become graph nodes here without misrepresenting what an edge means. Instead, when a user centers on a historical movie, a **separate sidebar** surfaces recent movies ranked by *content* similarity (shared genre, shared cast/director, review-keyword overlap) — deliberately not drawn as graph edges, so an audience-behavior claim ("people who liked this also liked that") never gets visually conflated with a weaker content-similarity claim ("this looks similar to that"). Update: most recent-track movies turned out to be in MovieLens 32M after all (761 of 916 have ≥4/5 ratings), so they are now real nodes in the audience network. Only the ~155 released after the October 2023 snapshot remain content-only (sidebar and universe).

**Planned interactions/animations:**
- **Click a node** to re-center the view on that movie, show only its top neighbors (fading/removing the rest), and open a **detail panel** with its director, top review keywords, and review sentiment (% positive, review count) — lets a user ask "what else do people who liked this movie also like, and why?", which is the whole point of this visualization plus the proposal's genre/keyword/people comparison goal. Works the same way whether the node came from the default 80 or a search result.
- **"Recent movies like this" sidebar**, shown alongside the detail panel on click — see above.
- **Search/jump to any movie** by title across the full ~1,998-movie backing set (see above).
- **Hover tooltip** (lighter than the click panel) on a node showing title, genre, and its exact overlap counts with connected movies.
- **Drag** nodes to manually untangle a crowded area.
- **Genre filter**: clicking a legend entry dims all nodes not in that genre, to check whether strong connections tend to stay within a genre or cross genre lines.
- A brief **transition/animation** when re-centering or jumping to a search result (nodes animating to new positions rather than snapping) so the "who's connected to whom" relationship reads clearly instead of the layout just jumping.

## Visualization 2 — Movie Performance and Audience Discussion

**Interactive version (done):** `docs/viz2.html`, also embedded on the homepage. `docs/js/viz2_scatter.js` builds its own controls inside an empty `#scatter` div. Data comes from `src/export_viz2_scatter.py` → `docs/data/viz2_scatter.json`, which reads `movies_final.jsonl`, `review_sentiment_summary.csv`, `review_keywords.jsonl` and the cast/director files, plus MovieLens ratings from Viz 1's export (run `export_viz1_explorer.py` first).

A bubble scatterplot of the 2,745 movies with box-office revenue. The ~170 without box office are left out: TMDB has no revenue for them, and they are mostly streaming-first releases such as Bird Box and Enola Holmes. Bubble size is box office (can be turned off) and color is primary genre, using the same palette as Viz 1. Two views animate into each other:

- **Rating vs. discussion.**
  - x is audience rating: TMDB by default, MovieLens optional for the 2,604 movies that have it.
  - y is discussion: TMDB vote count as a percentile among movies released within ±2 years. Raw counts would make every recent movie look under-discussed, because older movies have had decades to collect votes. Raw votes on a log axis are also available.
  - Median lines split four regions: hidden gems (high rating, little discussion), acclaimed hits, talked about despite low ratings, and low rated, little discussed.
- **Rating vs. review tone.**
  - Covers the 1,613 movies with ≥3 TMDB reviews. Most movies have only 3–6 reviews, so tone is shrunk toward the overall 73% positive share. Both axes are percentiles within that subset.
  - The diagonal means the reviews are as warm as the rating. The two sides are "reviewed warmer than rated" and "rated higher than reviewed".
  - Small vertical jitter separates tied tone values.
  - Caveat, also stated on the page: the sentiment model can read dark or violent subject matter as negative. Reservoir Dogs, American History X and Apocalypse Now land among "rated higher than reviewed".

Interactions:
- Choose a region in the side panel to highlight it and list its 15 most typical movies (ranked by percentile gap).
- Click a bubble for director, cast, both ratings, box office, review tone and the most mentioned review keywords, with a link to the movie's Viz 1 neighborhood.
- Hover tooltips.
- Highlight a genre from the legend; filter by decade; search.
- Brush to zoom (double-click or "Reset zoom" to zoom back out).
- Animated transitions when switching view, rating source or y-axis.

Hidden gems with TMDB ratings skew toward low-vote movies whose few voters are enthusiasts (e.g. A Dog's Journey). Switching x to MovieLens gives a sturdier list.

## Visualization 3 — Actor & Director Collaboration and Career Explorer

**Static version (done):** an actor–director collaboration network connected to an individual career view. In the network, circles represent actors and diamonds represent directors. An edge connects an actor and a director when they worked on the same movie, and edge thickness represents the number of shared movies. Node size represents total collaboration strength. The current static view keeps people with at least 5 movies and collaborations with at least 3 shared movies so that the network remains readable.

Selecting a person connects the overview network to a career-level view below. The career view plots the selected actor's or director's movies over time: release year is encoded on the x-axis, TMDB rating on the y-axis, revenue by circle size, and primary genre by color.

Built from `data/processed/cast_final.csv`, `data/processed/directors_final.csv`, and `data/processed/movies_final.jsonl` (`src/export_viz3_network.py` → `docs/data/viz3_collaboration_network.json`), rendered in `docs/viz3.html` / `docs/js/viz3_collaboration_network.js`.

**Planned interactions/animations:**
- **Search for an actor or director** by name and highlight that person and their direct collaborators.
- **Genre filter** recomputes collaboration strength using only shared movies in the selected genre.
- **Minimum shared movies slider** filters the network by collaboration strength.
- **Hover** over a person to inspect their role and collaboration information.
- **Click/select a person** to connect the collaboration overview to the career view below.
- The **career view** shows the selected person's movies across release years, with hover tooltips for title, year, rating, genre, and revenue.
- **Reset** restores the complete default network and clears the current selection.
- Animated transitions are used when the network or career view changes so that users can follow changes instead of seeing an abrupt replacement.

**Evaluation plan:** we will ask users to complete several representative tasks, such as finding a frequent actor–director collaboration, identifying a person's strongest collaborator, and examining how that person's movie ratings and genres change over their career. We will record whether users reach the correct answer, where they hesitate or become confused, and whether the network-to-career transition is understandable. Feedback will be used to revise filtering, labels, and visual encodings.


## Visualization 4 — Genre Ratings Over Time

**Static version (done):** a genre-by-year heatmap showing how movie ratings and audience engagement vary across major genres from 2016 through 2026. Each row represents a movie genre and each column represents a release year. The default color encoding shows the weighted average TMDB rating, where each movie's `vote_average` is weighted by its `vote_count`. This prevents movies with very few votes from having the same influence as movies with much larger voting audiences.

The visualization uses the full TMDB-based movie dataset rather than only the MovieLens-matched subset, allowing recent movies to remain represented. Users can switch among three metrics: **Weighted Average Rating**, **Total Vote Count**, and **Number of Movies**. A movie may belong to multiple genres and therefore contribute to multiple genre rows. The 2026 column is marked as partial-year coverage and should not be interpreted as a complete annual total.

Built from `data/processed/movies_final.jsonl` (`src/export_viz4_heatmap.py` → `docs/data/viz4_genre_heatmap.json`), rendered in `docs/viz4.html` / `docs/js/viz4_heatmap.js`.

**Planned interactions/animations:**
- **Metric dropdown** switches the heatmap among weighted rating, total vote count, and number of movies, allowing users to compare evaluation, audience voting activity, and dataset representation.
- **Hover over a cell** to see the exact genre, year, weighted rating, movie count, and total vote count.
- Hovering also **highlights the corresponding genre row and year column** while dimming unrelated cells, making individual genre–year comparisons easier to follow.
- Color transitions animate when the selected metric changes so that users can track changes rather than seeing the heatmap abruptly redraw.
- The color legend updates with the selected metric and explains the direction of the encoding.

**Evaluation plan:** we will ask users to perform tasks such as identifying which genres receive relatively higher ratings in a selected year, comparing one genre across multiple years, and determining whether a visually prominent pattern reflects ratings, voting activity, or movie count. We will observe task accuracy, completion difficulty, and confusion between the three metrics. Feedback will be used to improve the color scale, legend, tooltip information, and metric labels.