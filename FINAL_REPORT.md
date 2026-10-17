# WatchNext: Understanding Movies Beyond a Single Rating

## Executive Summary

WatchNext is an interactive website that asks: **What makes audiences love a movie, and if they love one movie, what else might they love?** A rating alone cannot explain whether a movie attracted attention, appealed to a particular audience, or belonged to a recurring creative partnership. We therefore created four connected visualization topics covering genre trends, audience similarity, rating versus discussion, and actor–director collaboration.

The project combines MovieLens 32M with metadata and reviews collected from TMDB. After cleaning and merging both sources, the final dataset contains 2,914 movies. We found that the answer changes with the metric: Animation has the highest vote-count-weighted TMDB rating in the 2016–2025 data, while Action receives the most votes. Audience-similar movies strongly share both release era and genre, but rating, voting attention, and written-review tone do not always agree. These results show why movie discovery benefits from several forms of evidence rather than one score.

## 1. Motivation, Questions, and Intended Audience

Movie websites usually present each title as an independent page with a rating, genre, cast list, and popularity information. This is useful for looking up one movie, but it does not clearly show relationships between movies, audiences, or filmmakers. Our intended audience is general moviegoers who want to discover films and understand why certain titles stand out.

The project addresses four questions:

1. How do genre ratings and audience voting activity change over time?
2. Which movies appeal to similar audiences, and what do those relationships share?
3. How are audience rating, discussion level, and written-review tone different?
4. What repeated actor–director partnerships appear, and how do careers change over time?

Visualization is appropriate because these questions involve spatial relationships, multivariate comparisons, networks, and time. Interactive views make it possible to recognize clusters and outliers, compare groups, and move from an overview to exact details.

## 2. Data Acquisition and Processing

**MovieLens 32M** contains 32,000,204 ratings and 2,000,072 tags from 200,948 users across 87,585 movies. It provides the user-level behavior required for audience similarity. The **TMDB API** supplies genres, release dates, ratings, vote counts, budget, revenue, cast, directors, keywords, and available reviews.

We created the final dataset through two tracks. The historical track began with high-activity MovieLens titles selected by rating count and matched to TMDB IDs. The recent track was collected directly from TMDB to improve coverage after 2016 because MovieLens ratings end in October 2023 and become thinner for newer releases. After duplicate TMDB IDs were removed, the tracks produced 2,914 movies: 1,998 historical and 916 recent.

MovieLens titles, years, genres, ratings, timestamps, and external IDs were cleaned and validated before audience overlap was calculated. From TMDB, we collected movie records, top cast, directors, keywords, and reviews. Zero or clearly unrealistic budget and revenue values were treated as missing. We cleaned and deduplicated 11,481 reviews covering about 2,650 movies, estimated sentiment with `siebert/sentiment-roberta-large-english`, and extracted review keywords using TF–IDF. Visualization-specific JSON files allow each browser view to load only the fields it needs. The complete Python pipeline is documented in `data/README.md`.

## 3. Visualization Design, Interactions, and Findings

### Visualization 1: Movie Universe and Audience Similarity Network

**What.** Visualization 1 contains two coordinated views of one audience-similarity topic. The Movie Universe shows all 2,914 movies as stars. The 2,759 films with MovieLens data are positioned using UMAP on audience-overlap distances. Another 155 newer films are placed by content similarity and use a different star shape. The Audience Network shows a smaller neighborhood connected through shared users who rated both movies at least 4 out of 5.

**Why and how.** The universe answers “where does this movie belong?”, while the network answers “what else do its viewers like?” Users can zoom, pan, search, switch between genre and decade colors, select a movie, and open its network neighborhood. Network interactions include recentering, dragging, genre highlighting, shared-attribute details, and recent content-based suggestions. Across 33,108 stored neighbor relationships, 77.1% connect movies from the same decade, compared with 19.6% for random pairs. In addition, 90.0% share at least one genre, compared with 50.9% for random pairs. Audience neighborhoods therefore reflect both era and genre.

![Visualization 1 — Movie Universe and Audience Network](docs/report-assets/viz1.png)

### Visualization 2: Movie Performance and Audience Discussion

**What.** This scatterplot compares ratings with two forms of audience response. In the default view, the x-axis is rating and the y-axis is discussion, measured by TMDB vote count relative to movies released within plus or minus two years. The second view compares rating with positive written-review share. Bubble size represents revenue and color represents primary genre.

**Why and how.** The chart separates acclaim from attention and reveals “hidden gems,” widely discussed lower-rated movies, and disagreement between ratings and written reviews. Users can select a region, search, filter by genre or decade, switch rating sources, brush to zoom, and click a bubble for movie details. Animated transitions preserve point relationships when the view changes. *The Hunt* has a high rating but relatively lower discussion, while *Suicide Squad* is widely discussed despite its lower rating. These are descriptive patterns, not causal conclusions.

![Visualization 2 — Movie Performance and Audience Discussion](docs/report-assets/viz2.png)

### Visualization 3: Actor–Director Collaboration and Career View

**What.** The network contains 318 actors and directors connected by 278 repeated-collaboration links. Circles represent actors, diamonds represent directors, node size represents collaboration strength, edge width represents shared movies, and color represents a community detected from the network. Selecting a person opens a career chart where year is mapped to the x-axis, TMDB rating to the y-axis, revenue to circle size, and genre to color.

**Why and how.** The network reveals recurring creative relationships, while the career chart connects the overview to one person's work. Users can search, select a genre, change the shared-movie threshold, zoom, pan, drag individual nodes, select collaborators, and reset the state. The genre filter recomputes collaboration counts from shared movie IDs rather than only hiding nodes. Short force-based transitions use attraction, repulsion, collision, and community forces to preserve the viewer's mental map. Bill Murray and Wes Anderson form the strongest displayed collaboration with eight shared movies; Johnny Depp and Tim Burton, and Robert De Niro and Martin Scorsese, each share seven.

![Visualization 3 — Collaboration Network and Career View](docs/report-assets/viz3.png)

### Visualization 4: Genre Ratings Over Time

**What.** This heatmap compares 13 major genres across 2016–2026. Rows are genres, columns are years, and the default color is the vote-count-weighted average TMDB rating. Users can recolor the same grid by total votes or number of movies. Multi-genre movies can contribute to more than one row.

**Why and how.** A fixed grid makes evaluation, voting activity, and dataset coverage directly comparable. Hovering emphasizes a genre row and year column and shows all three measures. Clicking a cell pins it and opens its contributing movies. Metric changes animate briefly and update the legend, units, and labels together. Excluding partial 2026, Animation has the highest 2016–2025 weighted rating at 7.47, while Action receives about 2.05 million votes. A visible note explains that the 28 movies in 2026 are partial-year coverage, not a complete annual decline.

![Visualization 4 — Genre Ratings Over Time](docs/report-assets/viz4.png)

## 4. Design Evaluation

The project's main strength is that each interaction supports a clear task. Search locates a known movie or person, filters support comparison, zooming reveals dense areas, and selection connects overview with detail. Consistent typography, controls, dark cinematic styling, movie-inspired elements, and restrained transitions make the four topics feel like one website.

Important limitations remain. The dataset favors titles with more MovieLens ratings or TMDB votes and is not representative of every released film. The newest movies do not have equivalent audience-overlap data. TMDB vote count measures voting activity, not complete popularity or discussion. Review samples are small for many movies, and the sentiment model may read dark subject matter as negative tone. Revenue is also missing for many streaming-first releases. Finally, Visualization 3 intentionally emphasizes people with at least five movies and collaborations with at least three shared films.

During development, we tested loading, search, filtering, metric switching, selection, reset behavior, zooming, dragging, tooltips, responsive layout, and console errors in the browser. We prepared a task-based think-aloud plan, but a larger formal user study has not yet been completed. Future improvements include collecting structured user feedback, adding more homepage annotations, and carrying selected movies or people more consistently between views.

## 5. Conclusion

WatchNext shows that movie reception is multidimensional. The genre with the highest rating is not necessarily the one with the most voting activity. Audience-similar films form neighborhoods shaped by era and genre, while ratings, attention, and written reactions can disagree. Repeated actor–director partnerships add another structural view of how movies are connected.

Instead of producing one automatic recommendation, WatchNext offers a transparent exploration process. A viewer can begin with a familiar movie, inspect its audience neighborhood, compare acclaim with attention, and follow the people behind it. This answers our original question by showing not only which movies audiences value, but also how those movies connect to other titles, audience behavior, and filmmakers.

## 6. Team Contributions

**Jiaxuan** was responsible for TMDB data acquisition and processing, including movie metadata, cast, directors, keywords, and reviews. Jiaxuan developed Visualizations 3 and 4, including their data exports, filters, animations, and linked detail views. Jiaxuan also led the overall website layout, cinematic visual design, interaction polish, and cross-page consistency.

**Muyu** was responsible for the remaining data processing, including MovieLens-based audience similarity. Muyu developed Visualizations 1 and 2, including the Movie Universe, Audience Network, and performance/discussion scatterplot with their search, filtering, selection, and detail interactions.

Both team members contributed to project framing, integration, debugging, interpretation, documentation, and presentation preparation.

## References

- GroupLens Research. *MovieLens 32M Dataset*. https://grouplens.org/datasets/movielens/32m/
- The Movie Database. *TMDB API Documentation*. https://developer.themoviedb.org/docs/getting-started
- SiEBERT. *Sentiment RoBERTa Large English*. https://huggingface.co/siebert/sentiment-roberta-large-english
