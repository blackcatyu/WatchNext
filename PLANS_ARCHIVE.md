# Archived Homepage Plans

The Interaction / Animation Plan and Evaluation Plan sections were removed from the homepage (`docs/index.html`) on 2026-10-17. They were written as plans before the interactive versions were built, so some details (for example, the 80-movie network in Visualization 1) no longer match the current site. This file keeps the original text for reference. Visualization 2 had no Interaction Plan section on the homepage.

## Interaction / Animation Plan

### Visualization 1 — Movie Universe and Audience Network

2,914 movies cleaned, but a node-link diagram is only readable up to roughly a hundred nodes shown at once — no amount of animation fixes a 2,000-node hairball. So instead of trying to render everything simultaneously, the plan is **focus + search**: keep the rendered view small at all times, and use interaction to make the full dataset *reachable* rather than all visible at once.

- **Expand the backing similarity data** from today's 80 most-rated movies to all ~1,998 historical-track movies (the ones with real MovieLens ratings — the 916 "recent" movies still can't appear here, same MovieLens-coverage limit noted in the Dataset section). This is just a bigger co-rating computation, not a bigger picture.

- **Click a node** to re-center the view on that movie, show only its top neighbors (fading/removing the rest), and open a **detail panel** with its director, top review keywords (TF-IDF, already computed in `review_keywords.jsonl`), and review sentiment (% positive, review count, from the sentiment model already run over all reviews in `review_sentiment_summary.csv`) — answers "what else do people who liked this movie also like, and why," which is the proposal's stated goal of checking whether audience similarity tracks shared genres/keywords/people, not just genre alone. Whatever the total dataset size, the screen only ever shows one movie's neighborhood.

- **Search/jump to any movie** by title, not just the 80 shown by default — this is how the other ~1,900 movies stay useful: reachable on demand, not rendered up front.

- **"Recent movies like this" sidebar**, shown alongside the detail panel when a node is clicked — surfaces the 916 "recent" movies (2016–2026), which have no MovieLens ratings and so can never appear as a graph node/edge here. These are ranked by *content* similarity instead (shared genre, shared cast/director, review-keyword overlap) rather than audience co-rating, and are deliberately kept in a separate sidebar rather than drawn as graph edges — mixing an audience-behavior edge with a content-similarity edge in the same graph would blur two different, differently-trustworthy claims ("people who liked this also liked that" vs. "this looks similar to that").

- **Hover tooltip** (lighter than the click panel) on a node showing title, genre, and its exact overlap counts with connected movies.

- **Drag** nodes to manually untangle a crowded area.

- **Genre filter**: clicking a legend entry dims nodes outside that genre, to check whether strong connections tend to stay within a genre or cross genre lines.

- **Transition animation** when re-centering or jumping to a search result (nodes animate to new positions rather than snapping) so the "who's connected to whom" relationship stays legible across the change.

### Visualization 3 — Actor & Director Collaboration Network

The interactive version lets users move from the overall collaboration network to detailed information about one actor or director.

- **Search for an actor or director.** Users will be able to enter a person's name and directly locate them in the network. The selected person and their direct collaborators will be highlighted while unrelated nodes are dimmed. This is useful because finding one person manually becomes difficult when the network contains hundreds of nodes.

- **Filter by movie genre.** Users will be able to select a genre such as Action, Drama, Comedy, or Science Fiction. The network will then recalculate collaboration relationships using only movies from that genre. This can help users compare whether collaboration patterns change across different types of movies.

- **Change the minimum number of shared movies.** A slider will allow users to increase the collaboration threshold from three shared movies to four, five, or six or more. Increasing the threshold removes weaker relationships and makes stronger repeated collaborations easier to see.

- **Select one actor or director.** Clicking a person will highlight their direct collaborators and connect the collaboration network to an individual career view.

- **Explore the career view.** In the career view, the x-axis will represent release year and the y-axis will represent TMDB rating. Circle size will represent movie revenue, while color will represent the movie's primary genre. This allows users to move from the overall collaboration structure to the career of one person.

- **Use hover tooltips for details.** Hovering over a person will show their name, role, movie count, and collaboration strength. Hovering over an edge will show the two collaborators, their shared-movie count, and movie titles. In the career view, movie tooltips will show title, year, rating, genre, and revenue. This lets users check exact values behind the visual encodings without permanently crowding the charts with labels.

- **Use transitions when the view changes.** When users change the genre or collaboration threshold, filtered-out edges and nodes with no remaining links will fade out, and returning elements will fade in. Node sizes and edge widths will transition to the updated collaboration counts; retained nodes will respond to link attraction, node repulsion, collision, and a gentle community pull before settling near their previous positions. Dragging one person briefly reactivates those same forces, while community colors remain consistent. Selecting a person will fade unrelated elements while emphasizing their collaborators.

### Visualization 4 — Genre Ratings Over Time

The interactive version compares different aspects of genre performance while keeping the same genre-by-year heatmap structure.

- **Switch between different metrics.** A dropdown will let users recolor the same genre–year grid by Weighted Average Rating, Total Vote Count, or Number of Movies. These measures show rating levels, voting activity, and dataset coverage, respectively. For example, users could check whether a highly rated genre–year also has many votes or contains only a few movies.

- **Hover over a cell for exact values.** A tooltip will show the genre, year, weighted rating, total votes, and movie count. Showing all three measures together will help users interpret a cell's color in context, especially when a high rating is based on limited coverage.

- **Highlight the corresponding row and column.** Hovering over a cell will emphasize its genre row and year column while dimming unrelated cells. Moving the pointer away will restore the full heatmap. This will help users follow one genre across years or compare genres within the same year.

- **Select a cell to inspect its movies.** Clicking or tapping a cell pins its row and column and opens a detail panel with the weighted rating, vote total, movie count, and the contributing titles ranked by TMDB vote count. The first six titles keep the overview compact, with an option to reveal the full list and clarify which movies most influence the weighted average.

- **Animate metric changes with a synchronized legend.** When users select a different metric, the rows and columns will stay in the same positions while cell colors transition to the new values. The metric label, legend range, units, and displayed values will update with the selection, so a color is always interpreted using the active metric. Keeping cell positions fixed will help users track the same genre–year across rating, voting activity, and movie count; the transition represents a change of measure, not a change over time.

## Evaluation Plan

**What we will evaluate.** We will evaluate whether users can correctly understand the visual encodings and use each visualization to answer its intended questions. For example, in the collaboration network, users should be able to identify actors and directors and find strong repeated collaborations. In the genre heatmap, users should be able to compare rating patterns across genres and years. After interactions are implemented, we will also evaluate whether they make these tasks easier.

**How we will evaluate it.** We will conduct informal think-aloud sessions with a small group of classmates or friends who were not involved in the project. Participants will complete several simple tasks using the visualizations while explaining what they are looking at and how they reach their answers. We will test the implemented interactive versions and use the same tasks again after any revisions.

**What data / feedback we will collect.** We will record task success or failure, approximate completion time, and specific points of confusion or misunderstanding. We will also collect short participant feedback on the clarity and usefulness of each visualization and its interactions.
