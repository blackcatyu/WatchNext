from pathlib import Path

import numpy as np
import pandas as pd

OUT_DIR = Path("data/processed")


def sane_money(series: pd.Series) -> pd.Series:
    return series.where(series.between(1, 3_000_000_000), np.nan)


def load_track(movies_path: Path, source: str) -> pd.DataFrame:
    df = pd.read_json(movies_path, lines=True)
    df["source"] = source
    df["budget"] = sane_money(df["budget"])
    df["revenue"] = sane_money(df["revenue"])
    return df


def concat_side_table(historical_path: Path, recent_path: Path) -> pd.DataFrame:
    hist = pd.read_csv(historical_path)
    recent = pd.read_csv(recent_path)
    return pd.concat([hist, recent], ignore_index=True)


def main() -> None:
    historical = load_track(OUT_DIR / "tmdb_movies.jsonl", "historical")
    recent = load_track(OUT_DIR / "tmdb_movies_recent.jsonl", "recent")

    candidates = pd.read_csv(OUT_DIR / "candidate_movies.csv")[
        ["tmdbId", "movieId", "imdbId", "rating_count", "rating_mean", "rating_std"]
    ]
    historical = historical.merge(candidates, on="tmdbId", how="left")
    for col in ["movieId", "imdbId", "rating_count", "rating_mean", "rating_std"]:
        recent[col] = np.nan

    movies = pd.concat([historical, recent], ignore_index=True)
    movies["year"] = pd.to_datetime(movies["release_date"], errors="coerce").dt.year

    movies.to_json(OUT_DIR / "movies_final.jsonl", orient="records", lines=True)

    cast = concat_side_table(OUT_DIR / "tmdb_cast.csv", OUT_DIR / "tmdb_cast_recent.csv")
    crew = concat_side_table(OUT_DIR / "tmdb_directors.csv", OUT_DIR / "tmdb_directors_recent.csv")
    keywords = concat_side_table(OUT_DIR / "tmdb_keywords.csv", OUT_DIR / "tmdb_keywords_recent.csv")
    reviews = concat_side_table(OUT_DIR / "tmdb_reviews.csv", OUT_DIR / "tmdb_reviews_recent.csv")

    cast.to_csv(OUT_DIR / "cast_final.csv", index=False)
    crew.to_csv(OUT_DIR / "directors_final.csv", index=False)
    keywords.to_csv(OUT_DIR / "keywords_final.csv", index=False)
    reviews.to_csv(OUT_DIR / "reviews_final.csv", index=False)

    n_dropped_budget = historical["budget"].isna().sum() + recent["budget"].isna().sum()
    print(f"final movie set: {len(movies)} ({(movies['source'] == 'historical').sum()} historical, "
          f"{(movies['source'] == 'recent').sum()} recent)")
    print(f"year range: {movies['year'].min():.0f}-{movies['year'].max():.0f}")
    print(f"budget/revenue values dropped as implausible: {n_dropped_budget}")
    print(f"cast: {len(cast)}, directors: {len(crew)}, keywords: {len(keywords)}, reviews: {len(reviews)}")


if __name__ == "__main__":
    main()
