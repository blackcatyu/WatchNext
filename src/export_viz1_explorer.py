"""Export the interactive Visualization 1 (audience similarity explorer) dataset.

Covers every movie so the page can search and re-center on any of them, and adds the
detail-panel data.

Audience movies = every candidate movie that MovieLens users have rated: the whole
historical track plus the recent-track (2016+) movies that appear in MovieLens 32M's
links.csv with at least one >=4/5 rating. Ratings come from the raw ratings.csv because
ratings_candidates.csv only covers the historical track.

- neighbors: each movie's top audience neighbors, ranked by Jaccard overlap of the two
  "liked it" (>=4/5) audiences rather than the raw co-like count, because raw counts
  rank the same few blockbusters first for every movie (Toy Story's top raw-count
  neighbor is The Shawshank Redemption; its top Jaccard neighbor is Toy Story 2).
  The raw count is kept alongside for tooltips.
- unrated: the remaining recent movies (mostly 2024-2026, released after MovieLens'
  2023-10 snapshot) have no audience data. They appear only in a sidebar, ranked by
  *content* similarity (shared genres, directors, top-billed cast, TMDB keywords,
  review keywords), and in the universe view placed beside their content anchors.
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
import scipy.sparse as sp

PROCESSED_DIR = Path("data/processed")
RAW_ML_DIR = Path("data/raw/ml-32m")
OUT_PATH = Path("docs/data/viz1_similarity_explorer.json")
OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

LIKE_THRESHOLD = 4.0
N_OVERVIEW = 80
OVERVIEW_EDGES_PER_NODE = 5
NEIGHBORS_PER_MOVIE = 12
SIDEBAR_PER_MOVIE = 5
TOP_CAST = 5
LENS_GENRES = 12

# Movies per release decade in the default starting view (80 total). Picking purely by
# rating count gives 43 of 80 from the 1990s and almost nothing after 2010, because
# MovieLens users rated 1990s-2000s movies the most. Decade keys are the decade's first
# year; 1960 also takes everything older.
DECADE_QUOTA = {1960: 6, 1970: 8, 1980: 12, 1990: 16, 2000: 16, 2010: 18, 2020: 4}

# Content-similarity weights (unrated sidebar and universe placement).
W_GENRE_JACCARD = 2.0
W_DIRECTOR = 1.5
W_CAST = 0.75
W_TMDB_KEYWORD = 0.3
W_REVIEW_KEYWORD = 0.2


def audience_similarity(movie_ids: list):
    """Co-like counts, fan counts, Jaccard overlap and rating stats among `movie_ids`.

    A "fan" is a MovieLens user who rated the movie >= LIKE_THRESHOLD.
    Returns (co_like, fans, jaccard, rating_count, rating_mean), all indexed like movie_ids.
    """
    idx = {m: i for i, m in enumerate(movie_ids)}
    ratings = pd.read_csv(
        RAW_ML_DIR / "ratings.csv",
        usecols=["userId", "movieId", "rating"],
        dtype={"userId": "int32", "movieId": "int32", "rating": "float32"},
        engine="pyarrow",
    )
    ratings = ratings[ratings["movieId"].isin(idx)]
    stats = ratings.groupby("movieId")["rating"].agg(["size", "mean"]).reindex(movie_ids)
    ratings = ratings[ratings["rating"] >= LIKE_THRESHOLD]
    _, user_idx = np.unique(ratings["userId"].values, return_inverse=True)
    liked = sp.csr_matrix(
        (np.ones(len(ratings), dtype=np.int32), (user_idx, ratings["movieId"].map(idx).values)),
        shape=(user_idx.max() + 1, len(movie_ids)),
    )
    co_like = (liked.T @ liked).toarray().astype(np.int64)
    fans = np.diag(co_like).copy()
    np.fill_diagonal(co_like, 0)
    union = fans[:, None] + fans[None, :] - co_like
    jaccard = np.divide(co_like, union, out=np.zeros(co_like.shape), where=union > 0)
    return co_like, fans, jaccard, stats["size"].fillna(0).values, stats["mean"].values


def load_audience_movies():
    """Split movies_final into (audience, unrated) frames; audience gets a movieId column."""
    movies = pd.read_json(PROCESSED_DIR / "movies_final.jsonl", lines=True)
    links = pd.read_csv(RAW_ML_DIR / "links.csv").dropna(subset=["tmdbId"])
    links["tmdbId"] = links["tmdbId"].astype(int)
    ml_id = links.drop_duplicates("tmdbId").set_index("tmdbId")["movieId"]

    movies["movieId"] = movies["movieId"].fillna(movies["tmdbId"].map(ml_id))
    has_ml = movies["movieId"].notna()
    audience = movies[has_ml].copy()
    audience["movieId"] = audience["movieId"].astype(int)
    return audience.reset_index(drop=True), movies[~has_ml].reset_index(drop=True)


def select_overview(movies: pd.DataFrame) -> list:
    """Most-rated movies within each decade, per DECADE_QUOTA, most-rated first."""
    decade = (movies["year"] // 10 * 10).clip(lower=min(DECADE_QUOTA))
    picked = pd.concat(movies[decade == d].nlargest(n, "rating_count") for d, n in DECADE_QUOTA.items())
    return picked.sort_values("rating_count", ascending=False)["movieId"].tolist()


def incidence(rows: pd.DataFrame, value: str, index: dict, vocab: dict) -> sp.csr_matrix:
    rows = rows[rows["tmdbId"].isin(index)]
    return sp.csr_matrix(
        (
            np.ones(len(rows), dtype=np.float32),
            (rows["tmdbId"].map(index).values, rows[value].map(vocab).values),
        ),
        shape=(len(index), len(vocab)),
    )


def top_k(row: np.ndarray, k: int) -> list:
    return [int(j) for j in np.argsort(-row)[:k] if row[j] > 0]


def main() -> None:
    audience, unrated = load_audience_movies()

    # ---- audience similarity ----------------------------------------------------
    co_like, fans, jaccard, rating_count, rating_mean = audience_similarity(audience["movieId"].tolist())
    audience["fans"], audience["rating_count"], audience["rating_mean"] = fans, rating_count, rating_mean

    # Movies MovieLens lists but nobody rated >=4/5 have no edges; treat them as unrated.
    no_fans = (audience["fans"] == 0).values
    unrated = pd.concat(
        [unrated, audience[no_fans].drop(columns=["fans", "rating_count", "rating_mean"])], ignore_index=True
    )
    keep = np.flatnonzero(~no_fans)
    audience = audience.iloc[keep].reset_index(drop=True)
    co_like, fans, jaccard = co_like[np.ix_(keep, keep)], fans[keep], jaccard[np.ix_(keep, keep)]
    movie_ids = audience["movieId"].tolist()

    # ---- content features (audience x unrated) ----------------------------------
    tmdb_aud = {t: i for i, t in enumerate(audience["tmdbId"])}
    tmdb_unr = {t: i for i, t in enumerate(unrated["tmdbId"])}

    directors = pd.read_csv(PROCESSED_DIR / "directors_final.csv")
    cast = pd.read_csv(PROCESSED_DIR / "cast_final.csv")
    cast = cast[cast["order"] < TOP_CAST]
    tmdb_kw = pd.read_csv(PROCESSED_DIR / "keywords_final.csv")
    review_kw = pd.read_json(PROCESSED_DIR / "review_keywords.jsonl", lines=True)
    review_kw = review_kw.explode("keywords").dropna().rename(columns={"keywords": "keyword"})
    sentiment = pd.read_csv(PROCESSED_DIR / "review_sentiment_summary.csv").set_index("tmdbId")
    genre_rows = pd.concat([audience[["tmdbId", "genres"]], unrated[["tmdbId", "genres"]]]).explode("genres").dropna()

    def pair(rows: pd.DataFrame, value: str):
        vocab = {v: i for i, v in enumerate(rows[value].unique())}
        return incidence(rows, value, tmdb_aud, vocab), incidence(rows, value, tmdb_unr, vocab)

    g_a, g_u = pair(genre_rows, "genres")
    shared = (g_a @ g_u.T).toarray()
    g_union = np.asarray(g_a.sum(1)) + np.asarray(g_u.sum(1)).T - shared
    aud_to_unrated = W_GENRE_JACCARD * np.divide(shared, g_union, out=np.zeros(shared.shape), where=g_union > 0)
    for weight, rows, value in [
        (W_DIRECTOR, directors, "person_id"),
        (W_CAST, cast, "person_id"),
        (W_TMDB_KEYWORD, tmdb_kw, "keyword"),
        (W_REVIEW_KEYWORD, review_kw, "keyword"),
    ]:
        a, u = pair(rows, value)
        aud_to_unrated += weight * (a @ u.T).toarray()

    # ---- per-movie lookups -------------------------------------------------------
    def grouped(rows: pd.DataFrame, col: str) -> dict:
        return rows.groupby("tmdbId")[col].apply(list).to_dict()

    dir_names = grouped(directors, "name")
    cast_names = grouped(cast.sort_values("order"), "name")
    tmdb_kw_sets = {k: set(v) for k, v in grouped(tmdb_kw, "keyword").items()}
    review_kw_lists = grouped(review_kw, "keyword")

    def sentiment_of(tmdb_id):
        if tmdb_id not in sentiment.index:
            return None
        row = sentiment.loc[tmdb_id]
        return [round(float(row["pct_positive"]), 3), int(row["review_count"])]

    def base_record(row) -> dict:
        t = row["tmdbId"]
        return {
            "title": row["title"],
            "year": int(row["year"]) if pd.notna(row["year"]) else None,
            "genres": list(row["genres"]),
            "directors": dir_names.get(t, []),
            "cast": cast_names.get(t, [])[:3],
            "reviewKeywords": review_kw_lists.get(t, []),
            "sentiment": sentiment_of(t),
            "voteAverage": round(float(row["vote_average"]), 2),
            "voteCount": int(row["vote_count"]),
        }

    def reasons(row_a, row_b) -> dict:
        """Why two movies count as content-similar, for chips and tooltips."""
        ta, tb = row_a["tmdbId"], row_b["tmdbId"]
        return {
            "genres": sorted(set(row_a["genres"]) & set(row_b["genres"])),
            "people": sorted(
                (set(dir_names.get(ta, [])) & set(dir_names.get(tb, [])))
                | (set(cast_names.get(ta, [])) & set(cast_names.get(tb, [])))
            ),
            "keywords": sorted(tmdb_kw_sets.get(ta, set()) & tmdb_kw_sets.get(tb, set()))[:6],
        }

    out_movies = []
    for i, row in audience.iterrows():
        rec = base_record(row)
        rec["id"] = int(row["movieId"])
        rec["track"] = row["source"]
        rec["fans"] = int(fans[i])
        rec["ratingCount"] = int(row["rating_count"])
        rec["ratingMean"] = round(float(row["rating_mean"]), 2)
        rec["neighbors"] = [
            [int(movie_ids[j]), int(co_like[i, j]), round(float(jaccard[i, j]), 4)]
            for j in top_k(jaccard[i], NEIGHBORS_PER_MOVIE)
        ]
        rec["unrated"] = [
            {"id": int(unrated.loc[j, "tmdbId"]), "score": round(float(aud_to_unrated[i, j]), 2), **reasons(row, unrated.loc[j])}
            for j in top_k(aud_to_unrated[i], SIDEBAR_PER_MOVIE)
        ]
        out_movies.append(rec)

    unrated_records = []
    for j, row in unrated.iterrows():
        rec = base_record(row)
        rec["id"] = int(row["tmdbId"])
        rec["anchors"] = [
            {"id": int(movie_ids[i]), "score": round(float(aud_to_unrated[i, j]), 2), **reasons(row, audience.loc[i])}
            for i in top_k(aud_to_unrated[:, j], SIDEBAR_PER_MOVIE)
        ]
        unrated_records.append(rec)

    # ---- starting views ("lenses") ------------------------------------------------
    # Each lens is a different set of N_OVERVIEW movies to start browsing from, with each
    # movie's OVERVIEW_EDGES_PER_NODE strongest edges inside that set.
    def overview_links(members: list) -> list:
        sub = jaccard[np.ix_(members, members)]
        edges = set()
        for a in range(len(members)):
            for b in top_k(sub[a], OVERVIEW_EDGES_PER_NODE):
                edges.add(tuple(sorted((members[a], members[b]))))
        return [
            [int(movie_ids[a]), int(movie_ids[b]), int(co_like[a, b]), round(float(jaccard[a, b]), 4)]
            for a, b in edges
        ]

    by_ratings = audience.sort_values("rating_count", ascending=False)
    decade = (by_ratings["year"] // 10 * 10).clip(lower=1960)
    pos = {m: i for i, m in enumerate(movie_ids)}

    lenses = [("all", "Across all decades", [pos[m] for m in select_overview(by_ratings)])]
    for d in sorted(decade.unique()):
        label = "Before 1970" if d == 1960 else f"{d}s"
        lenses.append((f"decade:{d}", label, by_ratings.index[decade == d][:N_OVERVIEW].tolist()))
    newer = by_ratings[by_ratings["source"] == "recent"]
    lenses.append(("recent", "2016+ releases", newer.index[:N_OVERVIEW].tolist()))
    genres = by_ratings.explode("genres")["genres"].value_counts().index[:LENS_GENRES].tolist()
    if "Animation" not in genres:  # small by count but a distinct audience; always offer it
        genres.append("Animation")
    for g in genres:
        has_g = by_ratings["genres"].apply(lambda gs: g in gs)
        lenses.append((f"genre:{g}", g, by_ratings.index[has_g][:N_OVERVIEW].tolist()))

    payload = {
        "likeThreshold": LIKE_THRESHOLD,
        "movies": out_movies,
        "unrated": unrated_records,
        "lenses": [
            {"key": key, "label": label, "ids": [int(movie_ids[i]) for i in members], "links": overview_links(members)}
            for key, label, members in lenses
        ],
    }
    OUT_PATH.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")

    n_recent = sum(m["track"] == "recent" for m in out_movies)
    years = pd.Series([u["year"] for u in unrated_records]).value_counts().sort_index().to_dict()
    print(f"audience movies: {len(out_movies)} ({len(out_movies) - n_recent} historical + {n_recent} recent)")
    print(f"unrated movies: {len(unrated_records)}, by year: {years}")
    print("lenses:", ", ".join(f"{label} ({len(m)})" for _, label, m in lenses))
    print(f"wrote {OUT_PATH} ({OUT_PATH.stat().st_size / 1e6:.2f} MB)")

    by_id = {m["id"]: m for m in out_movies}
    unrated_by_id = {u["id"]: u for u in unrated_records}
    for title in ["Toy Story", "Spirited Away", "Get Out", "Barbie"]:
        m = next((m for m in out_movies if m["title"] == title), None)
        if m:
            print(f"\n{title}: {[by_id[n[0]]['title'] for n in m['neighbors'][:6]]}")
            print(f"  unrated sidebar: {[unrated_by_id[u['id']]['title'] for u in m['unrated']]}")


if __name__ == "__main__":
    main()
