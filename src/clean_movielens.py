import re
from pathlib import Path

import numpy as np
import pandas as pd

RAW_DIR = Path("data/raw/ml-32m")
OUT_DIR = Path("data/processed")
OUT_DIR.mkdir(parents=True, exist_ok=True)

MIN_RATING_COUNT = 50
N_CANDIDATES = 2000

YEAR_RE = re.compile(r"\s*\((\d{4})\)\s*$")


def clean_movies(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, dtype={"movieId": "int64"})
    years = df["title"].str.extract(YEAR_RE)[0]
    df["year"] = pd.to_numeric(years, errors="coerce").astype("Int64")
    df["clean_title"] = df["title"].str.replace(YEAR_RE, "", regex=True).str.strip()
    df["genres"] = df["genres"].replace("(no genres listed)", np.nan)
    df["genres_list"] = df["genres"].apply(
        lambda g: g.split("|") if isinstance(g, str) else []
    )
    return df.drop(columns=["genres"]).rename(columns={"genres_list": "genres"})


def clean_links(path: Path) -> pd.DataFrame:
    df = pd.read_csv(
        path,
        dtype={"movieId": "int64", "imdbId": "string", "tmdbId": "Int64"},
    )
    df["imdbId"] = df["imdbId"].str.zfill(7)
    return df


def clean_ratings(path: Path, keep_movie_ids: set[int]) -> pd.DataFrame:
    df = pd.read_csv(
        path,
        dtype={"userId": "int64", "movieId": "int64", "rating": "float32"},
    )
    df = df[df["movieId"].isin(keep_movie_ids)]
    valid_rating = df["rating"].mod(0.5).eq(0) & df["rating"].between(0.5, 5.0)
    df = df[valid_rating]
    df = df.drop_duplicates(subset=["userId", "movieId"], keep="last")
    df["timestamp"] = pd.to_datetime(df["timestamp"], unit="s")
    return df


def clean_tags(path: Path, keep_movie_ids: set[int]) -> pd.DataFrame:
    df = pd.read_csv(path, dtype={"userId": "int64", "movieId": "int64"})
    df = df[df["movieId"].isin(keep_movie_ids)]
    df["tag"] = df["tag"].str.strip()
    df = df[df["tag"].notna() & (df["tag"] != "")]
    df["timestamp"] = pd.to_datetime(df["timestamp"], unit="s")
    return df


def select_candidates(movies: pd.DataFrame, links: pd.DataFrame, ratings_path: Path) -> pd.DataFrame:
    stats = (
        pd.read_csv(ratings_path, usecols=["movieId", "rating"], dtype={"movieId": "int64", "rating": "float32"})
        .groupby("movieId")["rating"]
        .agg(rating_count="count", rating_mean="mean", rating_std="std")
        .reset_index()
    )
    merged = movies.merge(stats, on="movieId", how="left").merge(
        links[["movieId", "imdbId", "tmdbId"]], on="movieId", how="left"
    )
    eligible = merged[
        merged["tmdbId"].notna() & (merged["rating_count"].fillna(0) >= MIN_RATING_COUNT)
    ]
    candidates = eligible.sort_values("rating_count", ascending=False).head(N_CANDIDATES)
    return candidates.reset_index(drop=True)


def main() -> None:
    movies = clean_movies(RAW_DIR / "movies.csv")
    links = clean_links(RAW_DIR / "links.csv")

    candidates = select_candidates(movies, links, RAW_DIR / "ratings.csv")
    candidate_ids = set(candidates["movieId"])

    ratings = clean_ratings(RAW_DIR / "ratings.csv", candidate_ids)
    tags = clean_tags(RAW_DIR / "tags.csv", candidate_ids)

    movies.to_json(OUT_DIR / "movies_clean.jsonl", orient="records", lines=True)
    links.to_csv(OUT_DIR / "links_clean.csv", index=False)
    candidates.drop(columns=["genres"]).to_csv(OUT_DIR / "candidate_movies.csv", index=False)
    ratings.to_csv(OUT_DIR / "ratings_candidates.csv", index=False)
    tags.to_csv(OUT_DIR / "tags_candidates.csv", index=False)

    print(f"movies total:        {len(movies):,}")
    print(f"candidate movies:    {len(candidates):,}")
    print(f"ratings (candidates):{len(ratings):,}")
    print(f"tags (candidates):   {len(tags):,}")
    print(f"\noutputs written to {OUT_DIR.resolve()}")


if __name__ == "__main__":
    main()
