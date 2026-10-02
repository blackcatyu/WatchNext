"""Export Visualization 2 (movie performance and audience discussion) data.

One point per candidate movie with box-office revenue (TMDB revenue is unset for ~170
movies, mostly streaming-first releases; they're out of scope here). Two y-axis modes:

- Discussion: TMDB vote count, also as a percentile among movies released within
  +/- YEAR_WINDOW years, so older movies' longer time to accumulate votes doesn't
  push every recent movie into the "less discussed" half.
- Review tone: share of a movie's TMDB reviews the sentiment model labeled positive,
  shrunk toward the overall share (PRIOR_REVIEWS pseudo-reviews) because most movies
  have only a handful of reviews. Only movies with >= MIN_REVIEWS reviews get a tone.
  Percentiles for this mode are computed within that subset so rating and tone are
  compared on the same footing (the diagonal = "tone matches rating").

MovieLens ratings come from export_viz1_explorer.py's output (run that first).
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd

PROCESSED_DIR = Path("data/processed")
EXPLORER_PATH = Path("docs/data/viz1_similarity_explorer.json")
OUT_PATH = Path("docs/data/viz2_scatter.json")

YEAR_WINDOW = 2
MIN_REVIEWS = 3
PRIOR_REVIEWS = 3
TOP_CAST = 3


def percentile(values: pd.Series) -> pd.Series:
    """Rank as a 0-1 fraction (average rank for ties)."""
    return (values.rank(method="average") - 1) / max(len(values.dropna()) - 1, 1)


def main() -> None:
    movies = pd.read_json(PROCESSED_DIR / "movies_final.jsonl", lines=True)
    movies = movies[movies["revenue"].notna()].reset_index(drop=True)

    explorer = json.loads(EXPLORER_PATH.read_text(encoding="utf-8"))
    ml = pd.DataFrame(
        [(m["tmdbId"], m["id"], m["ratingMean"], m["ratingCount"]) for m in explorer["movies"]],
        columns=["tmdbId", "mlId", "mlMean", "mlCount"],
    )
    movies = movies.drop(columns=["movieId"]).merge(ml, on="tmdbId", how="left")

    # ---- discussion: vote count percentile among same-era movies -----------------
    years = movies["year"].values
    votes = movies["vote_count"].values
    movies["discussionPct"] = [
        (votes[np.abs(years - y) <= YEAR_WINDOW] < v).mean()
        + 0.5 * (votes[np.abs(years - y) <= YEAR_WINDOW] == v).mean()
        for y, v in zip(years, votes)
    ]

    # ---- review tone ---------------------------------------------------------------
    sentiment = pd.read_csv(PROCESSED_DIR / "review_sentiment_summary.csv")
    movies = movies.merge(sentiment[["tmdbId", "review_count", "pct_positive"]], on="tmdbId", how="left")
    movies["review_count"] = movies["review_count"].fillna(0).astype(int)
    positive = movies["pct_positive"].fillna(0) * movies["review_count"]
    prior = positive.sum() / movies["review_count"].sum()
    has_tone = movies["review_count"] >= MIN_REVIEWS
    movies["tone"] = np.where(
        has_tone, (positive + PRIOR_REVIEWS * prior) / (movies["review_count"] + PRIOR_REVIEWS), np.nan
    )
    toned = movies[has_tone]
    movies.loc[has_tone, "tonePct"] = percentile(toned["tone"])
    movies.loc[has_tone, "toneRatingPct"] = percentile(toned["vote_average"])
    both = has_tone & movies["mlMean"].notna()
    movies.loc[both, "toneMlPct"] = percentile(movies.loc[both, "mlMean"])

    # ---- overall rating percentiles (for ranking lists) -----------------------------
    movies["ratingPct"] = percentile(movies["vote_average"])
    movies.loc[movies["mlMean"].notna(), "mlPct"] = percentile(movies["mlMean"].dropna())

    # ---- people and keywords ---------------------------------------------------------
    directors = pd.read_csv(PROCESSED_DIR / "directors_final.csv").groupby("tmdbId")["name"].apply(list)
    cast = pd.read_csv(PROCESSED_DIR / "cast_final.csv").sort_values("order")
    cast = cast.groupby("tmdbId")["name"].apply(lambda s: list(s)[:TOP_CAST])
    review_kw = pd.read_json(PROCESSED_DIR / "review_keywords.jsonl", lines=True).set_index("tmdbId")["keywords"]

    def num(v, digits=4):
        return None if pd.isna(v) else round(float(v), digits)

    records = []
    for _, r in movies.iterrows():
        t = r["tmdbId"]
        records.append({
            "id": int(t),
            "mlId": None if pd.isna(r["mlId"]) else int(r["mlId"]),
            "title": r["title"],
            "year": int(r["year"]),
            "genres": list(r["genres"]),
            "directors": directors.get(t, []),
            "cast": cast.get(t, []),
            "reviewKeywords": review_kw.get(t, []),
            "tmdb": round(float(r["vote_average"]), 2),
            "votes": int(r["vote_count"]),
            "ml": num(r["mlMean"], 2),
            "mlCount": None if pd.isna(r["mlCount"]) else int(r["mlCount"]),
            "revenue": int(r["revenue"]),
            "reviews": int(r["review_count"]),
            "pctPositive": num(r["pct_positive"], 3),
            "tone": num(r["tone"], 3),
            "discussionPct": num(r["discussionPct"]),
            "ratingPct": num(r["ratingPct"]),
            "mlPct": num(r["mlPct"]),
            "tonePct": num(r["tonePct"]),
            "toneRatingPct": num(r["toneRatingPct"]),
            "toneMlPct": num(r["toneMlPct"]),
        })

    payload = {
        "yearWindow": YEAR_WINDOW,
        "minReviews": MIN_REVIEWS,
        "tonePrior": round(float(prior), 3),
        "movies": records,
    }
    OUT_PATH.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")

    print(f"movies with revenue: {len(records)} (with MovieLens rating: {movies['mlMean'].notna().sum()})")
    print(f"with review tone (>= {MIN_REVIEWS} reviews): {int(has_tone.sum())}, overall positive share {prior:.2f}")
    print(f"corr(rating pct, tone pct): {movies['toneRatingPct'].corr(movies['tonePct']):.2f}")
    print(f"wrote {OUT_PATH} ({OUT_PATH.stat().st_size / 1e3:.0f} KB)")

    hi_r, lo_d = movies["vote_average"] >= movies["vote_average"].median(), movies["discussionPct"] < 0.5
    gems = movies[hi_r & lo_d].assign(score=lambda d: d["ratingPct"] - d["discussionPct"]).nlargest(8, "score")
    print("\nhidden gems:", [f"{t} ({y})" for t, y in zip(gems["title"], gems["year"])])
    gap = (movies["toneRatingPct"] - movies["tonePct"]).dropna()
    print("rated high, reviewed harshly:", movies.loc[gap.nlargest(6).index, "title"].tolist())
    print("rated low, reviewed warmly:", movies.loc[gap.nsmallest(6).index, "title"].tolist())


if __name__ == "__main__":
    main()
