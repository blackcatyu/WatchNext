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

## TMDB

Not yet acquired — needs an API key from https://www.themoviedb.org/settings/api. Once available, put it in a local `.env` (gitignored) as `TMDB_API_KEY=...`; the acquisition script will read it via `python-dotenv`.
