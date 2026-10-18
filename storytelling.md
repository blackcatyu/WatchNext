# WatchNext Storyline

This document defines the final narrative for the website and presentation. WatchNext has **four primary visualization topics**. The Movie Universe and Audience Network are two coordinated views inside Visualization 1: the universe provides the overview, and the network provides details for a selected movie. They should not be presented as separate main visualizations.

## 1. The story in one question

> **What makes audiences love a movie — and if people love one movie, what else might they love?**

WatchNext is designed for general moviegoers who want to discover films and understand the relationships behind ratings, attention, recommendations, and creative partnerships. A rating can tell us whether a movie was liked, but it cannot explain the whole picture. The four visualizations therefore move from broad changes over time to audience neighborhoods, differences between acclaim and attention, and the people who repeatedly make movies together.

The story should answer four connected research questions:

1. **How do genre reception and audience voting activity change over time?**
2. **Which movies attract similar audiences? If viewers like one movie, what other movies are they likely to enjoy?**
3. **How do ratings differ from audience attention and written-review tone?**
4. **Which actor–director partnerships recur, and what do individual career timelines reveal about genre experience, audience reception, and commercial scale?**

Together, these questions use several kinds of evidence, rather than one rating, to help viewers find and understand a movie. The fourth question links the collaboration overview to the individual Career Timeline and Genre Profile.

## 2. Verified findings that support the story

These findings come from the data currently used by the website and can be stated as results rather than hypotheses.

### Genre performance changes with the metric

Across 2016–2025, excluding the partial 2026 column, **Animation has the highest vote-count-weighted TMDB rating (7.47)**, followed by Drama (7.31) and Romance (7.28). **Action receives the most voting attention**, with 2,046,555 total TMDB votes in the dataset. A genre that leads in rating therefore does not necessarily lead in audience activity.

### Audience neighborhoods reflect both era and genre

Across 33,108 stored top-neighbor relationships in the audience-similarity data:

- 77.1% connect movies from the same release decade, compared with 19.6% for random movie pairs;
- 36.8% share the same primary genre, compared with 12.2% for random pairs;
- 90.0% share at least one genre, compared with 50.9% for random pairs.

The accurate claim is not that era simply replaces genre. Audience similarity is structured by **both release era and genre**, with release decade providing an especially strong organizing pattern.

### Ratings, attention, and review tone are different signals

The scatterplot contains highly rated movies with relatively little discussion, as well as widely discussed movies with lower ratings. For example, *The Hunt* appears in the high-rating, lower-discussion region, while *Suicide Squad* is highly discussed despite its lower rating. Written-review tone can also diverge from the numerical rating, although this comparison must retain the warning that review samples are often small and sentiment models can misread dark subject matter.

### Repeated collaborations form recognizable communities

The strongest repeated actor–director collaboration in the displayed network is **Bill Murray and Wes Anderson (8 shared movies)**. Other strong examples include Johnny Depp and Tim Burton (7), Robert De Niro and Martin Scorsese (7), and Michael Caine and Christopher Nolan (6). These repeated partnerships make the network's communities interpretable as working relationships rather than decorative clusters.

## 3. Final story arc

The reading order follows **Context → Overview and Detail → Important Difference → People and Relationships → Insight**. The underlying visualization numbers and page routes remain unchanged; the homepage uses story chapters to create a natural reading sequence.

| Story stage | Chapter | Main visualization | Finding-style headline | Role in the story |
|---|---|---|---|---|
| **Context** | 1. Genres over time | Visualization 4 — Genre Heatmap | **Animation leads in ratings; Action draws the most voting attention** | Establishes that the answer changes depending on whether we measure acclaim, attention, or coverage. |
| **Overview and detail** | 2. The movie universe | Visualization 1 — Movie Universe + Audience Network | **Audience taste creates neighborhoods shaped by both era and genre** | Shows every movie at once, then lets the viewer inspect the audience neighborhood around one movie. |
| **Important difference** | 3. Rated, discussed, and reviewed | Visualization 2 — Performance and Discussion Scatterplot | **A movie can be loved, widely discussed, or warmly reviewed — these are not the same thing** | Separates numerical rating, voting attention, and written-review tone. |
| **People and relationships** | 4. Who makes these movies together? | Visualization 3 — Collaboration Network + Career View | **Repeated creative partnerships form durable movie communities** | Moves from audience response to the actors and directors behind the films. |
| **Insight** | What we learned | Conclusion; no new chart | **Finding a meaningful next movie takes more than one score** | Combines the evidence and returns to the central question. |

## 4. Chapter-by-chapter narrative

### Opening: A rating is only the beginning

**Purpose:** Introduce the motivation before presenting technical details.

**Opening copy:**

> A movie can earn a high rating without attracting much attention. Two films from different genres can appeal to the same audience, while familiar actor–director partnerships can connect entire groups of movies. WatchNext combines 2,914 films, about 32 million MovieLens ratings, and 11,481 TMDB reviews to explore what ratings alone leave out.

Immediately follow the hook with the central question and a short explanation of the two data sources. Keep the complete cleaning pipeline available as methods detail, but do not make it the first thing the audience has to read.

**Transition to Chapter 1:**

> Before looking at individual movies, start with the broadest view: how do genre ratings and audience attention change over time?

### Chapter 1: Genres over time

**Headline:** **Animation leads in ratings; Action draws the most voting attention.**

**Visualization:** Genre × year heatmap, with switches for weighted rating, total votes, and movie count.

**Immediate evidence:**

- Open on weighted rating and annotate Animation as the highest-rated genre across 2016–2025.
- Use a second annotation or short note to explain that Action leads in total votes.
- Keep the 2026 partial-year warning beside the chart. The 2026 data currently contain only 28 movies and must not be interpreted as a complete annual decline.

**Try this:**

> Switch from Rating to Votes. The same grid now answers a different question: which genres attract the most audience activity rather than the highest evaluation?

**On-demand detail:** Clicking a cell reveals the movies behind its value, so viewers can see whether a result reflects many films or a few influential titles.

**Transition to Chapter 2:**

> Genre trends provide context, but genres alone do not explain why two individual movies attract similar audiences. To see that structure, place every movie in the same universe.

### Chapter 2: The movie universe and its audience neighborhoods

**Headline:** **Audience taste creates neighborhoods shaped by both era and genre.**

**Visualization 1 has two coordinated layers:**

1. **Movie Universe — overview.** All 2,914 movies appear together. The 2,759 films with MovieLens audience data are positioned by audience overlap; 155 newer films without MovieLens data are placed using content similarity and use a different star shape.
2. **Audience Network — details on demand.** Search for or select a movie to inspect its strongest audience-similarity relationships, shared genres, people, keywords, and recent content-based suggestions.

These are two views of the same question, not two separate main visualizations. The universe answers “where does this movie sit?”, while the network answers “what else do people who liked it also like?”

**Immediate evidence:**

- Open the Universe colored by decade so the chronological structure is visible without requiring a control change.
- Annotate an older-film region, a recent-film region, and one recognizable franchise or director cluster.
- Add the verified neighbor comparison near the visualization: 77.1% of stored audience neighbors share a release decade, while 90.0% share at least one genre.

**Try this:**

> Change the color from Decade to Genre, then search for *Oppenheimer*. Open its audience neighborhood to see which films share its viewers and what those connections have in common.

**On-demand detail:** Tooltips, selection cards, shared-attribute summaries, and the network are supporting evidence. They should not replace the opening annotation and headline.

**Caveat:** MovieLens ratings end in October 2023. Movies without audience-rating coverage are visibly distinguished and use content similarity rather than audience overlap.

**Transition to Chapter 3:**

> Audience neighborhoods show which movies are liked together. But being liked is not the same as being widely discussed — and a numerical rating does not always match the tone of written reviews.

### Chapter 3: Rated, discussed, and reviewed

**Headline:** **A movie can be loved, widely discussed, or warmly reviewed — these are not the same thing.**

**Visualization:** Multivariate scatterplot with Rating vs. Discussion and Rating vs. Review Tone views.

**Immediate evidence:**

- Label one high-rating, lower-discussion example such as *The Hunt*.
- Label one acclaimed and widely discussed example such as *Oppenheimer*.
- Label one highly discussed, lower-rated example such as *Suicide Squad*.

These labels should be treated as examples from this dataset, not universal categories or causal explanations.

**Try this:**

> Select “Hidden gems,” then switch to Review Tone. Notice how the movies that stand out change when written reactions replace voting activity.

**On-demand detail:** Search, region selection, genre and decade filters, brush-to-zoom, rating-source switching, and movie detail support exploration after the main comparison is understood.

**Caveats:**

- Discussion is measured relative to movies released within ±2 years, reducing the advantage older movies have had in accumulating votes.
- Low-vote TMDB movies can have unstable or unusually high ratings; MovieLens provides an alternative rating source where available.
- Only movies with enough written reviews appear in the review-tone view, and the sentiment model can misread dark or violent subject matter as negative.

**Transition to Chapter 4:**

> Audience response describes what happened around a movie. The final view asks who repeatedly worked together to create these films and how those partnerships appear across a career.

### Chapter 4: Creative partnerships and careers

**Headline:** **Repeated creative partnerships form durable movie communities.**

**Visualization:** Actor–director collaboration network linked to the individual Career Timeline and Genre Profile.

**Immediate evidence:**

- Annotate Bill Murray × Wes Anderson as the strongest displayed repeat collaboration, with 8 shared movies.
- Use Wes Anderson as an example of a highly connected director in the filtered network.
- Keep the actor/director shapes and collaboration-count edge encoding visible in the compact key.

**Try this:**

> Search for Christopher Nolan, inspect his recurring collaborators, and then follow his Career Timeline to *Oppenheimer*. Switch the Genre Profile between Experience, Rating, and Revenue, then click a genre to highlight its films.

**On-demand detail:** Person, collaboration, and movie tooltips provide exact values. Clicking a person reveals their films over time, while the network remains the structural overview. The timeline helps viewers understand the span and rhythm of an actor's or director's career. The radar summarizes genres where their work has more experience, stronger audience reception, or greater commercial scale. It can support discussion of likely strengths and commercial value, but it does not directly measure acting or directing skill.

**Caveat:** This view intentionally includes people with at least five movies and collaborations represented by at least three shared movies. It describes repeated partnerships within the selected dataset, not every credit in the film industry.

**Transition to the conclusion:**

> Genres, audience neighborhoods, attention, review tone, and creative partnerships each reveal a different part of movie reception. Together they provide a stronger answer than any single score.

## 5. One case study across all four visualizations

Use ***Oppenheimer*** as the recurring example because it can be followed through every main topic:

- **Genre Heatmap:** it contributes to the 2023 Drama cell and appears in the selected cell's movie list.
- **Movie Universe and Audience Network:** it has real MovieLens audience data and a searchable audience neighborhood.
- **Performance and Discussion Scatterplot:** it is both highly rated and highly discussed in the current dataset.
- **Collaboration Network and Career View:** its director, Christopher Nolan, appears with recurring collaborators and a complete career profile.

The case study should guide the viewer without forcing every interaction to remain synchronized. A short “Continue with *Oppenheimer*” prompt is sufficient; users must still be able to explore any movie or person independently.

## 6. Conclusion: what the audience should learn

The homepage should end with conclusions rather than another implementation plan.

**Recommended conclusion copy:**

> WatchNext shows why one rating cannot fully describe a movie. Genre performance changes when we compare ratings with voting activity. Movies liked by similar audiences form neighborhoods shaped by both era and genre. Attention, numerical ratings, and written reactions often disagree. Behind those patterns, repeated actor–director partnerships create recognizable creative communities.
>
> To find your next movie, begin with one you already love, inspect its audience neighborhood, compare whether its neighbors are acclaimed or simply widely discussed, and then follow the people behind it. The result is not a single automatic recommendation, but a more transparent way to understand why a movie may be worth watching.

**Four final takeaways:**

1. **The metric changes the story:** the highest-rated genre is not the genre with the most voting activity.
2. **Audience similarity has structure:** both release era and shared genres strongly shape movie neighborhoods.
3. **Acclaim is not attention:** ratings, discussion, and review tone capture different audience responses.
4. **Movies are also social products:** recurring actor–director partnerships form visible creative communities.

## 7. Storytelling rules for the website and presentation

1. Use **four numbered story chapters**, one for each primary visualization topic. V1's Universe and Network remain overview and detail views within the same chapter.
2. Lead each chapter with a **finding-style headline**, not only the chart name.
3. Show at least one piece of **immediate evidence** before asking the viewer to interact.
4. Include one short **“Try this” prompt** per chapter; keep full interaction instructions secondary.
5. End every chapter with a transition that turns the current finding into the next question.
6. Keep caveats beside the claim they qualify. Do not hide partial-year, missing-review, MovieLens cutoff, or sentiment-model limitations in a distant methods section.
7. Preserve the existing visualization numbers and routes. Story chapters control the reading order without renaming implementation files.
8. Replace future-tense “Interaction / Animation Plan” copy on the final homepage with present-tense **“How to explore”** text.
9. Keep essential claims visible without hover. On touch screens, the same details must be available through tap or focus.
10. Use the final conclusion to answer the central question; do not end the website with the Evaluation Plan.

## 8. Implementation order

1. Add the opening hook, central question, and compact dataset summary.
2. Reorder the homepage narrative to Heatmap → Visualization 1 → Scatterplot → Collaboration Network while preserving the existing page routes and internal visualization numbers.
3. Add the verified finding headline, one annotation, one “Try this” prompt, and one transition to each chapter.
4. Use *Oppenheimer* as the recurring case study where a preselected or linked example is helpful.
5. Replace development-plan language with current behavior and move full methods or evaluation material below the conclusion or to supporting documentation.
6. Add the final takeaway and limitations sections.
