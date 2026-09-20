import json
from pathlib import Path

import pandas as pd


# ============================================================
# Paths
# ============================================================

ROOT = Path(__file__).resolve().parents[1]
MOVIES_PATH = ROOT / "data" / "processed" / "movies_final.jsonl"


# ============================================================
# Load complete movie dataset
# ============================================================

records = []

with open(MOVIES_PATH, "r", encoding="utf-8") as f:
    for line in f:
        if line.strip():
            records.append(json.loads(line))

movies = pd.DataFrame(records)

movies["year"] = pd.to_numeric(movies["year"], errors="coerce")
movies["vote_average"] = pd.to_numeric(
    movies["vote_average"], errors="coerce"
)
movies["vote_count"] = pd.to_numeric(
    movies["vote_count"], errors="coerce"
)
movies["rating_mean"] = pd.to_numeric(
    movies["rating_mean"], errors="coerce"
)
movies["rating_count"] = pd.to_numeric(
    movies["rating_count"], errors="coerce"
)


print("=" * 80)
print("VIZ 4 — COMPLETE TMDB DATA COVERAGE")
print("=" * 80)

print("\nTotal movies:", len(movies))

print(
    "Year coverage:",
    int(movies["year"].min()),
    "to",
    int(movies["year"].max())
)


# ============================================================
# Overall source coverage
# ============================================================

print("\n" + "=" * 80)
print("SOURCE")
print("=" * 80)

print(
    movies["source"]
    .value_counts(dropna=False)
    .to_string()
)


# ============================================================
# Rating coverage
# ============================================================

print("\n" + "=" * 80)
print("RATING COVERAGE")
print("=" * 80)

print(
    "Movies with TMDB vote_average:",
    movies["vote_average"].notna().sum()
)

print(
    "Movies with TMDB vote_count:",
    movies["vote_count"].notna().sum()
)

print(
    "Movies with MovieLens rating_mean:",
    movies["rating_mean"].notna().sum()
)

print(
    "Movies with MovieLens rating_count:",
    movies["rating_count"].notna().sum()
)


# ============================================================
# Coverage by year
# ============================================================

year_summary = (
    movies
    .dropna(subset=["year"])
    .groupby("year")
    .agg(
        total_movies=("tmdbId", "count"),

        tmdb_rated=(
            "vote_average",
            lambda x: x.notna().sum()
        ),

        tmdb_with_votes=(
            "vote_count",
            lambda x: (x.fillna(0) > 0).sum()
        ),

        movielens_rated=(
            "rating_mean",
            lambda x: x.notna().sum()
        )
    )
    .reset_index()
    .sort_values("year")
)

year_summary["year"] = year_summary["year"].astype(int)


print("\n" + "=" * 80)
print("COMPLETE COVERAGE BY YEAR")
print("=" * 80)

print(year_summary.to_string(index=False))


# ============================================================
# Recent years
# ============================================================

recent = year_summary[
    year_summary["year"] >= 2015
]

print("\n" + "=" * 80)
print("RECENT YEARS — 2015+")
print("=" * 80)

print(recent.to_string(index=False))


# ============================================================
# Source × year
# ============================================================

source_year = (
    movies
    .dropna(subset=["year"])
    .groupby(["year", "source"])
    .size()
    .reset_index(name="movies")
)

source_year["year"] = source_year["year"].astype(int)

source_year = source_year[
    source_year["year"] >= 2015
]


print("\n" + "=" * 80)
print("RECENT YEARS BY SOURCE")
print("=" * 80)

print(source_year.to_string(index=False))


# ============================================================
# Genre coverage in recent years
# ============================================================

recent_movies = movies[
    movies["year"] >= 2020
].copy()

recent_movies = recent_movies[
    recent_movies["genres"].apply(
        lambda x: isinstance(x, list) and len(x) > 0
    )
]

recent_genres = (
    recent_movies
    .explode("genres")
    .groupby(["year", "genres"])
    .size()
    .reset_index(name="movies")
)

recent_genres["year"] = recent_genres["year"].astype(int)


print("\n" + "=" * 80)
print("GENRE COVERAGE — 2020+")
print("=" * 80)

print(
    recent_genres
    .sort_values(["year", "movies"], ascending=[True, False])
    .to_string(index=False)
)