# Project Context

## 2026-10-17 — Storyline and report corrections

- Corrected the random-pair same-primary-genre baseline from 12.4% to 12.2% in the homepage, storyline document, public report, and Markdown report. The value comes from all 3,804,661 unordered pairs among the 2,759 audience-data movies.
- Clarified team contributions using the agreed ownership: Jiaxuan handled TMDB processing, Visualizations 3 and 4, and overall website layout, visual design, and interaction polish; Muyu handled the remaining data processing and Visualizations 1 and 2.
- Kept visualization content, data files, layout, interactions, story order, and numbering unchanged.

## 2026-10-18 — Final report restructuring

- Reorganized the final report around the required sections: Introduction, Method, Results, Discussion, and Conclusion.
- Presented five visualization views in Results: Movie Universe, Audience Network, Performance and Discussion Scatterplot, Actor–Director Collaboration Network, and Genre Ratings Heatmap. The website still treats the first two as coordinated overview/detail views inside Visualization 1 and keeps four story chapters.
- Added an in-report jump menu and a direct link from every result subsection to its interactive visualization.
- Added explicit What–Why–How, strengths, interaction effectiveness, limitations, and future-improvement subsections to Discussion while retaining the verified findings, screenshots, contribution statement, and references.

## 2026-10-18 — Editable A1 poster

- Created a one-page A1 portrait PowerPoint poster from the approved final report and storyline, using the WatchNext cinematic color, typography, and visualization style.
- Organized the poster around Motivation, Research Questions, Data and Method, Visualization Story, Key Insights, Live Demonstration, Audience Feedback, and Conclusion.
- Kept all poster text and layout elements editable. The four visualization screenshots remain replaceable image objects.
- Left clearly labeled placeholders for Group No., member last names, and the audience-feedback QR code, as requested.

## 2026-10-18 — Enhanced poster detail views

- Preserved the approved four-chapter storyline order and the original editable poster.
- Added real interface insets for the Genre Heatmap movie detail list, the Movie Universe Audience Network, and Christopher Nolan's Career View in the Collaboration Network.
- Added concise Question, How to Explore, and Key Insight text to every visualization panel so the poster can support both quick reading and the live demonstration.

## 2026-10-18 — Full interaction screenshots in poster

- Replaced the four poster visualization images with fresh screenshots of the complete interactive work areas.
- Preserved the full search, filter, metric, threshold, reset, status, legend, and chart regions rather than cropping to the graph alone.
- Reduced each detail inset and limited its overlap to the lower part of the main chart, leaving every interaction control visible.

## 2026-10-18 — Storyline overview-to-detail guidance

- Kept the established chapter order and added explicit overview-to-detail explanations to the homepage storyline.
- Chapter 2 now distinguishes View 2 (Movie Universe) from View 3 (Audience Network), explains the handoff through the selected movie, defines the audience links, and states what viewers can learn from the coordinated views.
- Chapter 4 now uses the empty Career View state to explain how filters shape the Collaboration Network, how clicking a person links the overview to the career chart, and how to read year, rating, revenue, and genre.
- Added responsive styling and regression checks for both storyline explanations without changing the underlying data or visualization behavior.

## 2026-10-18 — Live linked detail views on the homepage

- Embedded the complete Audience Network directly below the Movie Universe instead of using only explanatory copy. It opens on Oppenheimer to preserve the established case-study thread and includes the network, audience links, movie facts, sentiment, review keywords, and related titles.
- Linked Movie Universe selections to the embedded Audience Network: clicking a MovieLens star carries that movie into the network, while search, neighboring-movie clicks, breadcrumbs, genre highlighting, dragging, expansion, and reset remain available on the homepage.
- Made Christopher Nolan the homepage Collaboration Network default so the real Career View is immediately visible. Reset restores this story example; selecting another actor or director still updates the network focus and career chart.
- Added a thin chronological path behind the career bubbles while retaining the existing year, TMDB rating, revenue-size, and primary-genre encodings.
- Verified all 35 automated tests, desktop movie/person interaction flows, responsive 390 px layout without horizontal overflow, reset behavior, and a clean browser console.

## 2026-10-18 — Career chart edge spacing

- Added one year of domain padding around the selected person's earliest and latest films, plus wider internal chart margins, so endpoint bubbles no longer touch the axes or panel border.
- Added embedded Career View padding in the final-loaded story stylesheet so the cinematic layout no longer overrides it to zero. The title and chart now sit 36 px from the card edge at 1440 px and 20 px from it at 390 px.
- Updated shared JavaScript and stylesheet cache versions on the affected pages after browser QA exposed a stale-script mismatch.
- Rechecked all 37 automated tests, both desktop and 390 px layouts, and browser console output after the cascade fix.

## 2026-10-18 — V3 and V4 chart-side reading guides

- Added a V2-style explanation panel beside the V3 Collaboration Network on both the homepage and standalone page. It defines person shapes, partnership width, community color, node strength, the click-to-Career-View handoff, and the fact that filters recompute links.
- Added a matching panel beside the V4 Genre Heatmap on both surfaces. Its question, metric meaning, comparison prompt, and caveat update with Rating, Votes, and Movies while retaining the cell-to-movie-detail instructions and the 2026 partial-year warning.
- Kept the V3 Career View and V4 movie-detail list full-width below their overview charts. At widths below 880 px, both reading guides stack below their charts instead of compressing the visualization.
- Verified 38 automated tests, desktop 1440 px two-column layout, 390 px stacked layout, V3 search-to-career linkage, V4 metric switching and Drama 2023 movie detail, homepage presence, and clean browser logs.

## 2026-10-18 — Poster screenshots updated for V3 and V4 guides

- Re-captured the poster's V3 and V4 overview images after the chart-side reading guides were added to the website.
- Kept the V3 overview network at full visual strength so its communities remain legible at poster scale, while the linked Christopher Nolan Career View remains a separate inset taken from the homepage's default story state.
- Preserved the V4 rating heatmap guide and Drama 2023 movie-detail inset, making the overview-to-detail interaction visible without changing the poster's story order or A1 layout.

## 2026-10-18 — Poster detail insets aligned left

- Moved every poster detail inset to the lower-left of its visualization panel: Drama 2023 movie details, the Oppenheimer Audience Network, and Christopher Nolan's Career View.
- Preserved each inset's size, border, label, and limited overlap with the main chart so the interaction controls and V3/V4 reading guides remain visible.

## 2026-10-18 — V3 and V4 reading guides unified with V1 and V2

- Reworked the V3 and V4 chart-side explanations to match the plain V1/V2 side-panel pattern: a direct heading, one short description, compact interaction bullets, and a simple caveat.
- Removed the uppercase kicker, nested definition rows, and gold action cards that made the guides feel separate from the rest of the site.
- Kept V4's guide synchronized with Rating, Votes, and Movies, while retaining the 2026 partial-year warning and the cell-to-movie-detail instructions.
- Kept V3's network encodings, filter-recalculation explanation, and network-to-Career-View handoff without changing chart data or interactions.
- Re-captured the desktop V3/V4 interfaces and regenerated an editable A1 poster with the updated guide style.

## 2026-10-18 — V3 Career View line-only rendering fix

- Fixed the dark curved shape behind the V3 career bubbles. It was not an intended area encoding: the standalone page lacked the shared `.career-line` rule, so the open SVG path received the browser's default black fill.
- Moved the Career View path styling into the shared visualization stylesheet so both the homepage and standalone V3 render the same thin gold chronological line with `fill: none`.
- Bumped the shared stylesheet cache version and added a regression test that requires a no-fill career path with the intended stroke.
- Verified Christopher Nolan's Career View in both browser surfaces: the black fill is gone, the 1.5 px line remains visible, and both browser consoles are clean.

## 2026-10-18 — V3 Career View same-year trend correction

- Corrected the Career View trend for people with multiple films in the same release year. Individual film circles remain unchanged, but the gold trend now uses one average TMDB rating per year rather than connecting same-year films vertically in an arbitrary order.
- Updated the subtitle to explain that the line represents yearly average rating.
- Removed the temporary dash mask after the line-drawing animation completes, preventing the final years of longer careers from appearing truncated.
- Added regression coverage for same-year averaging and animation cleanup, then verified Hugh Jackman's 22-film view through 2026 with no vertical links or browser-console errors.

## 2026-10-18 — Linked V3 career genre profile

- Added a responsive Genre Profile beside the selected person's Career Timeline on both the standalone V3 page and the homepage story view.
- The profile switches between Experience (film count), Rating (vote-count-weighted TMDB movie rating), and Revenue (median reported box-office revenue). Multi-genre films contribute to every listed genre; missing or zero revenue is excluded from the median.
- Clicking a radar point highlights that genre's films in the timeline and dims the remaining films. The gold trend line stays defined as the yearly average across all films, and the note explicitly preserves that meaning.
- Added exact genre tooltips for film count, weighted rating, total TMDB votes, and reported-revenue coverage; the top six genres are chosen by film count to keep the chart readable.
- Fixed the radar SVG's intrinsic dimensions after browser QA found its lower labels could overflow the card, and increased the timeline's vertical proportion to balance the two linked views.
- Verified all 41 automated tests, desktop metric switching and genre linkage, the homepage default Christopher Nolan state, 390 px stacked layout, and clean browser consoles.

## 2026-10-18 — Report linked-detail evidence and career interpretation

- Added full Oppenheimer Audience Network and Christopher Nolan Career Timeline + Genre Profile screenshots to the HTML and Markdown final reports, with concise overview-to-detail steps matching the homepage story.
- Updated the Story and Report explanations so the timeline supports reading career span and rhythm, while the profile compares genre experience, vote-count-weighted audience reception, and median reported commercial scale.
- Kept the interpretation honest: these signals can suggest where a person's work is frequent, well received, or commercially strong, but they do not directly measure acting or directing skill.
- Linked each report screenshot to the same selected case study. The Audience Network opens on Oppenheimer, and V3 now accepts a `person` URL parameter so the Christopher Nolan screenshot opens the matching interactive Career View.
- Re-generated both report assets from loaded browser states and verified the desktop links, selected examples, responsive 390 px report layout, image visibility, and browser-console health.

## 2026-10-18 — Research-question-led final report revision

- Expanded both the Markdown and HTML final reports with an evidence-led Executive Summary and explicit Introduction subsections for project motivation, research questions, intended audience, and why visualization is appropriate.
- Defined four research-question groups covering genre change, audience similarity and next-movie discovery, ratings versus attention and review tone, and recurring actor–director partnerships plus individual career patterns.
- Added the career subquestion to connect the Collaboration Network with the Career Timeline and Genre Profile while stating that experience, audience reception, and commercial scale do not directly measure acting or directing skill.
- Mapped every visualization to its research question and rewrote the Conclusion as four specific evidence-based answers followed by the complete project's contribution to transparent movie discovery.
- Retained the professor-required Introduction, Method, Results, Discussion, and Conclusion structure while allowing the report to exceed the approximate word target where additional explanation improves clarity.

## 2026-10-18 — Research-question synchronization and contribution wording

- Synchronized the same four research-question groups across the homepage opening, `storytelling.md`, the HTML/Markdown final reports, and the editable A1 poster. The poster uses shorter display wording but preserves the report's meaning, including next-movie discovery and the career-detail subquestion.
- Added a compact two-column Research Questions block to the homepage that collapses to one column on small screens without changing the four-chapter story order.
- Kept Muyu's supplied contribution paragraph unchanged in wording and synchronized it into the Markdown report.
- Revised Jiaxuan's contribution to a comparable length, covering TMDB processing, the vote-count-weighted Genre Heatmap aggregation, V3/V4 interactions, overall website design, and the editable A1 poster.
- Preserved the source poster and exported a new validated editable A1 file named `STATS401_Poster_Group_No_MemberLastName_Final_Questions.pptx`.

## 2026-10-18 — Final submission audit

- Audited the website, five visualization views, interaction coverage, processed data, pipeline code, storyline, final report, screenshots, reproducibility documentation, and Git state against the complete project requirements.
- Verified 48 automated tests, JavaScript and Python syntax, all published JSON and processed CSV/JSONL files, internal website references, final-dataset counts and uniqueness, desktop interactions, 390 px responsive layout, and clean browser logs.
- Confirmed the local branch matched `origin/main` before committing. Poster metadata and PDF export were deliberately excluded from the blocking audit at the user's request; the editable A1 source remains in `poster/`.
- Kept the untracked poster drafts out of this website/report commit so the editable poster can be finalized separately.

## 2026-10-18 — Final editable poster synchronization

- Expanded Poster Question 4 to match the final report: recurring actor–director partnerships plus what Career Timelines reveal about genre experience, audience reception, and commercial scale.
- Replaced the outdated V3 timeline-only inset with the final Christopher Nolan Career Timeline and linked Genre Profile screenshot.
- Synchronized the V3 exploration instructions, live-demonstration sequence, viewer takeaway, and conclusion with the current website and report while preserving the one-page A1 design.
- Kept the poster local and untracked, as requested. The final deliverable is an editable PPTX rather than a PDF.

## 2026-10-18 — Collaboration threshold wording

- Clarified the Chapter 4 “Try this” prompt on the homepage: the Collaboration Network defaults to 3 shared movies, while raising the control from 3 to 5 is an optional demonstration for focusing on stronger partnerships.
- Kept the data, control range, reset behavior, and filtering logic unchanged.
