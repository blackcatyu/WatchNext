# Storytelling Plan

How a viewer moves through the project, so the visualizations read as one story rather than separate charts. This is a plan: chapter headlines marked *(to verify)* are hypotheses that still need a data check, and the open decisions at the end are not settled yet.

## 1. The story in one question

> **What makes audiences love a movie — and if people love one movie, what else do they love?**

This is aimed at our intended audience (general moviegoers) and ties together the proposal's five research questions: audience preferences (RQ1), audience similarity (RQ2), popularity vs. discussion (RQ3), reviews (RQ4), and people and collaboration (RQ5). Time runs through every chapter.

Findings we already have that the story can stand on:

- **Audience taste clusters by release era more than by genre.** In the universe view colored by decade, stars run in a gradient from older movies to 2020s releases, while genre colors are mixed throughout.
- **High ratings and high attention are different things.** There are highly rated movies that few people talk about ("hidden gems") and lower-rated movies that many people talk about.
- **Ratings and review tone don't always agree.** Some movies are rated higher than their written reviews would suggest, and vice versa.
- **Recurring actor–director groups** form visible communities in the collaboration network.

## 2. Story arc

| Stage | Chapter | Visualization | Questions it answers | Draft headline (states the finding, not the chart name) |
|---|---|---|---|---|
| **Context** | Intro + "Genres over time" | Opening text with key numbers; genre × year heatmap | When and where: how genre ratings and attention change over time | *(to verify)* e.g. "Dramas are rated highest; action draws the most votes" |
| **Overview** | "The movie universe" | Universe star map (all 2,914 movies) | What: where every movie sits in audience taste | "Audiences cluster by era, not by genre" |
| **Important pattern** | "Rated vs. talked about" | Rating vs. discussion / review tone scatterplot | Key relationships and differences | "A high rating doesn't mean people are talking about it" |
| **Deeper exploration** | "Who else likes this?" and "Who makes it?" | Audience similarity network; collaboration network with career view | Who is involved: audiences and filmmakers | *(to verify)* e.g. "Fans of a movie also like movies from the same era and director more than the same genre" |
| **Insight** | "What we learned" | Conclusion section (no new chart) | Why it matters | 3–4 takeaways, each linking back to a chart with the example highlighted |

How the five questions map onto the story:

- **What is happening?** Audience preference and attention follow patterns that ratings alone don't show.
- **Where or when?** Release era and genre (heatmap, universe colored by decade).
- **Who or what is involved?** Movies; directors and actors; MovieLens raters and TMDB reviewers.
- **What relationships or differences exist?** Era explains taste better than genre; rating diverges from attention and from review tone; collaboration groups relate to reception.
- **Why might it matter?** It helps people find good movies they haven't heard of, tell acclaim apart from hype, and understand why recommendations work the way they do.

## 3. Chapter plans

### Intro (Context)

- **Hook:** one sentence posing the central question, plus three headline numbers: 2,914 movies, about 32M MovieLens ratings, about 11,500 TMDB reviews.
- **Short "what's in here":** where the data comes from and what it covers. This includes the MovieLens cutoff in October 2023, and that the dataset covers popular movies only.
- **Transition:** "Before looking at individual movies, how have genres fared over time?"

### Genres over time (Context)

- **Visualization:** genre × year heatmap; metric switch between weighted rating, total votes and movie count.
- **Pre-set annotation:** the strongest genre trend (pick after the data check), with a callout on the cell.
- **Try this:** switch the metric to total votes and see which genres attract attention rather than acclaim.
- **Transition:** "Genres tell only part of the story. Here is every movie at once, placed by who likes it."

### The movie universe (Overview)

- **Visualization:** universe star map.
- **Opens colored by decade** so the main finding is visible immediately, rather than leaving viewers to discover the toggle.
- **Pre-set annotations:** a franchise cluster (e.g. The Lord of the Rings trilogy, Toy Story series), the older-movie region, and the 2020s region.
- **Try this:** switch to genre colors and notice how mixed they are compared with decades.
- **Transition:** "Popular movies sit in the bright center, but popularity isn't the same as being loved."

### Rated vs. talked about (Important pattern)

- **Visualization:** scatterplot, opening in the rating vs. discussion view.
- **Pre-set annotations:** one hidden gem, one acclaimed hit, and one movie talked about despite low ratings, each labeled on the chart.
- **Try this:**
  - Open "Hidden gems" in the side panel.
  - Switch to the review-tone view to find movies whose reviews disagree with their rating.
- **Caveats shown on the page:**
  - Discussion is measured against movies from the same era.
  - TMDB ratings for low-vote movies run high. Consider defaulting to MovieLens ratings (see open decisions).
  - The sentiment model reads dark or violent subject matter as negative.
- **Transition:** "Pick any movie. Who else do its fans like, and who made it?"

### Who else likes this? and Who makes it? (Deeper exploration)

- **Audience similarity network:** answers RQ2. The panel shows shared genres, people and keywords between neighbors.
  - Add one summary statistic: how often a movie's top neighbors share its genre, director or era, compared with random pairs. *(to compute)*
- **Collaboration network with career view:** answers RQ5. Annotate the strongest repeat collaboration and one "bridge" person who connects otherwise separate groups. *(to compute)*
- **Try this:** search for the case-study movie (see Section 4) and follow its director into the collaboration network.

### What we learned (Insight)

- **3–4 takeaways**, each one sentence, linking back to the chart and example that supports it. For instance:
  - "Era beats genre": universe.
  - "Hidden gems exist and here are some": scatterplot.
  - "Fans' next favorites usually share X": audience network.
- **How to use the site to find your next movie:** a short practical guide that ties the findings back to the audience.
- **Limitations:**
  - MovieLens data ends in October 2023, so 2024–2026 releases have no audience data and are placed by content similarity only.
  - The movie set is popular movies only.
  - Review counts are small (median 3 per movie).
  - The sentiment model misreads some dark subject matter as negative.
  - TMDB revenue is missing for streaming-first releases.

## 4. Storytelling devices used throughout

1. **One case-study movie followed through every chapter.** It is pre-highlighted in each chart, so the viewer sees one movie from every angle:
   - its cell trend in the heatmap,
   - its place in the universe,
   - its quadrant in the scatterplot,
   - its fans' other favorites,
   - its director's collaborators.

   This also delivers the proposal's promise of linked selections across views. Candidate movies: *Parasite*, *Spirited Away*. Choose after the data checks so the movie is a good example in every chapter.
2. **Pre-set annotations.** Each chart opens with 2–3 labeled examples and a one-line note, so the point is visible without interaction. Interaction is for going further.
3. **"Try this" prompts:** 1–2 guided actions per chapter.
4. **Transition sentences** at the end of each chapter, turning one finding into the next question.
5. **Consistent visual hierarchy:**
   - numbered chapters with finding-style headlines;
   - one genre palette across all charts (already shared by the Viz 1 and Viz 2 charts);
   - one "selected" style;
   - one caveat style.
6. **Cross-links between charts.** Already in place: scatterplot → audience network (`viz1.html#movie=<id>`) and universe ↔ audience network. To extend: the collaboration network should link people to their movies in other views.

## 5. Open decisions

1. **We have four visualizations; the brief asks for five.**
   - **(Recommended)** Count the universe star map and the audience similarity network as separate visualizations. They use different techniques and play different story roles (Overview vs. Deeper exploration).
   - Alternatively, split the career view out of the collaboration network, as in the original proposal.
2. **Renumber to match the story order?** That would make the order heatmap → universe → scatterplot → audience network → collaboration network. The alternative is to keep current numbering and only reorder the homepage, but numbers that don't follow the reading order would confuse viewers.
3. **Extend the heatmap beyond 2016–2026.** To serve as context for the "era" finding it should cover the full range, e.g. 5- or 10-year bins back to the 1920s.
4. **Scatterplot default rating:** switch the default from TMDB to MovieLens, so hidden gems aren't dominated by low-vote movies with inflated TMDB scores.
5. **Case-study movie:** pick after the data checks below.

## 6. Next steps

1. **Data checks to turn the *(to verify)* headlines into findings:**
   - share of audience-network neighbors sharing genre / director / era vs. a random baseline;
   - strongest heatmap trends;
   - top repeat collaborations and bridge people;
   - candidate hidden gems / hits / buzz movies for annotations.
2. **Write final chapter headlines, explanatory text, annotations and transitions** for review.
3. **Implement:** a narrative homepage layout, pre-set annotations, case-study highlighting and the conclusion section.
