# Data Pipeline

## Layout

- `data/raw/` — untouched downloads (gitignored, regenerate via steps below)
- `data/processed/` — cleaned outputs of `src/clean_movielens.py` (gitignored, regenerate by running the script)

## MovieLens 32M

Download: https://grouplens.org/datasets/movielens/32m/ (direct: https://files.grouplens.org/datasets/movielens/ml-32m.zip)

```
curl -L -o data/raw/ml-32m.zip https://files.grouplens.org/datasets/movielens/ml-32m.zip
unzip data/raw/ml-32m.zip -d data/raw/
```

Verify against `data/raw/ml-32m/checksums.txt` (md5) before cleaning.

Run cleaning:

```
python src/clean_movielens.py
```

`src/clean_movielens.py` does the following:

- **movies**: extracts release `year` from the title, keeps a `clean_title` without the trailing `(YYYY)`, and splits the pipe-delimited `genres` string into a list (`(no genres listed)` becomes `[]`). Written to `movies_clean.jsonl` (list-valued `genres` doesn't round-trip cleanly through CSV).
- **links**: keeps `imdbId` as a zero-padded 7-digit string (leading zeros are significant and get silently dropped if read as a number) and `tmdbId` as a nullable integer.
- **ratings**: drops rows with a rating outside `[0.5, 5.0]` or not on the 0.5-step scale, drops duplicate `(userId, movieId)` pairs, and converts the unix timestamp to a datetime.
- **tags**: strips whitespace, drops empty/null tags, converts the unix timestamp to a datetime.
- **candidate selection**: joins movies to their rating counts, keeps only movies with a mapped `tmdbId` (needed to join TMDB metadata later) and at least 50 ratings, then takes the top `N_CANDIDATES` (currently 2,000) by rating count. Ratings and tags are then filtered down to just those candidate movies (`ratings_candidates.csv`, `tags_candidates.csv`) — the full 32M-row ratings table isn't needed once the movie subset is fixed.

This candidate list (`candidate_movies.csv`) is a starting point, not final — the final site should narrow back down per the proposal's 500–1,000-movie target once visualizations are built; 2,000 is a working superset, not the final scope, and a node-link diagram (Visualizations 2 and 4) with 2,000 nodes will need its own filtering/aggregation to stay legible.

**Caveats:**
- MovieLens 32M's ratings stop at **2023-10-12** (see `data/raw/ml-32m/README.txt`). A movie released after that date has ~zero MovieLens ratings, so selecting candidates by MovieLens rating count silently excludes everything recent — see the "two tracks" note below.
- The historical track is heavily skewed toward the 1990s–2000s (MovieLens' user base rated movies from that era the most) and thins out fast after 2015. The recent track (below) fills in 2016 onward — see `data/figures/historical_year_distribution.svg` (regenerate with `python src/plot_year_distribution.py`):

  ![Candidate set release-decade distribution, historical vs. recent](figures/historical_year_distribution.svg)

## TMDB

Needs an API key from https://www.themoviedb.org/settings/api, put in a local `.env` (gitignored) as `TMDB_API_KEY=...`. `src/tmdb_common.py` holds the shared fetch/cache/retry logic (`GET /movie/{id}?append_to_response=credits,keywords,reviews`, cached to `data/raw/tmdb/{id}.json`).

### Two tracks

Because MovieLens can't see anything released after 2023-10-12, and its own rating-count-based selection thins out even before that (few ratings had accumulated yet for 2016–2019 releases by the 2023-10 snapshot), movies are pulled in two tracks and tagged by `source`:

- **historical** (`src/fetch_tmdb.py`, ~2,000 movies) — TMDB metadata for the MovieLens-selected candidates above. These are the only movies with real MovieLens user-rating data, so they're the only ones usable for the audience-similarity network (Visualization 2).
- **recent** (`src/fetch_tmdb_recent.py`, ~900–1,000 movies) — movies released since `START_DATE` (2016-01-01), discovered directly via TMDB `/discover/movie` (sorted by `vote_count.desc`, not `popularity.desc` — TMDB's popularity score is recomputed continuously, so paginating by it mid-fetch causes movies to drift between pages and produces duplicates/gaps), taking the top `vote_count.gte` threshold in `VOTE_COUNT_THRESHOLDS` that yields at least `TARGET_MIN` movies. These have no MovieLens rating data, so they only feed the visualizations that don't need it (scatterplot, timeline, collaboration network, genre heatmap). The recent window overlaps the historical track's tail (both can have a 2018 movie, say); `merge_candidates.py` drops the recent copy of any `tmdbId` already present in historical, since the historical copy carries MovieLens ratings the recent one doesn't.

  Note the tradeoff behind `TARGET_MIN`/`TARGET_MAX`: selection is "top N by vote_count" over the whole window, and older movies in that window have had more time to accumulate votes, so widening `START_DATE` without also raising the target count skews the result toward the older end and thins out the newest months further (they haven't had time to accumulate 200+ votes yet either way — same underlying effect as the MovieLens cutoff, just on a shorter timescale).

Run both, then merge:

```
python src/fetch_tmdb.py
python src/fetch_tmdb_recent.py
python src/merge_candidates.py
```

`src/merge_candidates.py` concatenates both tracks into `movies_final.jsonl` / `cast_final.csv` / `directors_final.csv` / `keywords_final.csv` / `reviews_final.csv`, and null-clips `budget`/`revenue` outside `(0, 3e9]` — TMDB's budget/revenue fields are crowd-edited and very recent/upcoming releases sometimes carry vandalized placeholder numbers (e.g. one 2026 release showed a $2.45B revenue on a 2,746-vote page, implausible for a film that new). The `(0, 3e9]` bound catches obviously-fake and "unset" (0) values but isn't a full fact-check — spot-check before trusting `budget`/`revenue` for very recent titles.
