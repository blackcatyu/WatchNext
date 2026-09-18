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
- **candidate selection**: joins movies to their rating counts, keeps only movies with a mapped `tmdbId` (needed to join TMDB metadata later) and at least 50 ratings, then takes the top 1,000 by rating count. Ratings and tags are then filtered down to just those candidate movies (`ratings_candidates.csv`, `tags_candidates.csv`) — the full 32M-row ratings table isn't needed once the movie subset is fixed.

This candidate list (`candidate_movies.csv`) is a starting point, not final — once TMDB data is pulled, the subset should be re-filtered for review-data availability per the proposal (500–1,000 movies).

**Caveat:** MovieLens 32M's ratings stop at **2023-10-12** (see `data/raw/ml-32m/README.txt`). A movie released after that date has ~zero MovieLens ratings, so selecting candidates by MovieLens rating count silently excludes everything recent — see the "two tracks" note below.

## TMDB

Needs an API key from https://www.themoviedb.org/settings/api, put in a local `.env` (gitignored) as `TMDB_API_KEY=...`. `src/tmdb_common.py` holds the shared fetch/cache/retry logic (`GET /movie/{id}?append_to_response=credits,keywords,reviews`, cached to `data/raw/tmdb/{id}.json`).

### Two tracks

Because MovieLens can't see anything released after 2023-10-12, movies are pulled in two tracks and tagged by `source`:

- **historical** (`src/fetch_tmdb.py`, ~1,000 movies) — TMDB metadata for the MovieLens-selected candidates above. These are the only movies with real MovieLens user-rating data, so they're the only ones usable for the audience-similarity network (Visualization 2).
- **recent** (`src/fetch_tmdb_recent.py`, ~150–200 movies) — movies released 2023-10-13 through today, discovered directly via TMDB `/discover/movie` (sorted by `vote_count.desc`, not `popularity.desc` — TMDB's popularity score is recomputed continuously, so paginating by it mid-fetch causes movies to drift between pages and produces duplicates/gaps). Filtered to `vote_count >= 50` where available. These have no MovieLens rating data, so they only feed the visualizations that don't need it (scatterplot, timeline, collaboration network, genre heatmap).

Run both, then merge:

```
python src/fetch_tmdb.py
python src/fetch_tmdb_recent.py
python src/merge_candidates.py
```

`src/merge_candidates.py` concatenates both tracks into `movies_final.jsonl` / `cast_final.csv` / `directors_final.csv` / `keywords_final.csv` / `reviews_final.csv`, and null-clips `budget`/`revenue` outside `(0, 3e9]` — TMDB's budget/revenue fields are crowd-edited and very recent/upcoming releases sometimes carry vandalized placeholder numbers (e.g. one 2026 release showed a $2.45B revenue on a 2,746-vote page, implausible for a film that new). The `(0, 3e9]` bound catches obviously-fake and "unset" (0) values but isn't a full fact-check — spot-check before trusting `budget`/`revenue` for very recent titles.
