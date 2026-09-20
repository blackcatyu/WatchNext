import json
from pathlib import Path

import pandas as pd


# ============================================================
# Paths
# ============================================================

ROOT = Path(__file__).resolve().parents[1]

MOVIES_PATH = ROOT / "data" / "processed" / "movies_final.jsonl"
OUTPUT_PATH = ROOT / "docs" / "data" / "viz4_genre_heatmap.json"


# ============================================================
# Visualization settings
# ============================================================

START_YEAR = 2016
END_YEAR = 2026

# Keep the major genres that have useful coverage in recent years.
GENRES = [
    "Action",
    "Adventure",
    "Animation",
    "Comedy",
    "Crime",
    "Drama",
    "Family",
    "Fantasy",
    "Horror",
    "Mystery",
    "Romance",
    "Science Fiction",
    "Thriller",
]


# ============================================================
# Load movie data
# ============================================================

records = []

with open(MOVIES_PATH, "r", encoding="utf-8") as f:
    for line in f:
        if line.strip():
            records.append(json.loads(line))

movies = pd.DataFrame(records)


# ============================================================
# Clean fields
# ============================================================

movies["year"] = pd.to_numeric(
    movies["year"],
    errors="coerce"
)

movies["vote_average"] = pd.to_numeric(
    movies["vote_average"],
    errors="coerce"
)

movies["vote_count"] = pd.to_numeric(
    movies["vote_count"],
    errors="coerce"
)


# Keep recent movies with valid TMDB voting data.
movies = movies[
    movies["year"].between(START_YEAR, END_YEAR)
    & movies["vote_average"].notna()
    & movies["vote_count"].notna()
    & (movies["vote_count"] > 0)
].copy()

movies["year"] = movies["year"].astype(int)


# ============================================================
# Expand genres
#
# One movie can belong to multiple genres.
# Therefore, a movie can contribute to multiple heatmap cells.
# ============================================================

movies = movies[
    movies["genres"].apply(
        lambda x: isinstance(x, list) and len(x) > 0
    )
].copy()

genre_movies = movies.explode("genres")

genre_movies = genre_movies.rename(
    columns={"genres": "genre"}
)

genre_movies = genre_movies[
    genre_movies["genre"].isin(GENRES)
].copy()


# ============================================================
# Weighted rating component
#
# Weighted TMDB rating:
#
# sum(vote_average * vote_count)
# --------------------------------
#          sum(vote_count)
#
# This gives movies with more audience votes more influence.
# ============================================================

genre_movies["weighted_rating_component"] = (
    genre_movies["vote_average"]
    * genre_movies["vote_count"]
)


# ============================================================
# Aggregate Genre × Year
# ============================================================

summary = (
    genre_movies
    .groupby(["year", "genre"])
    .agg(
        movie_count=("tmdbId", "nunique"),
        total_votes=("vote_count", "sum"),
        rating_weighted_sum=("weighted_rating_component", "sum"),
        mean_rating=("vote_average", "mean"),
    )
    .reset_index()
)


summary["weighted_rating"] = (
    summary["rating_weighted_sum"]
    / summary["total_votes"]
)


# ============================================================
# Create complete Genre × Year grid
#
# This ensures missing cells are represented explicitly
# instead of disappearing from the heatmap.
# ============================================================

years = list(range(START_YEAR, END_YEAR + 1))

complete_grid = pd.MultiIndex.from_product(
    [years, GENRES],
    names=["year", "genre"]
).to_frame(index=False)

summary = complete_grid.merge(
    summary,
    on=["year", "genre"],
    how="left"
)


# Missing cells have no movies.
summary["movie_count"] = (
    summary["movie_count"]
    .fillna(0)
    .astype(int)
)

summary["total_votes"] = (
    summary["total_votes"]
    .fillna(0)
    .astype(int)
)


# ============================================================
# Convert records for JSON
# ============================================================

cells = []

for _, row in summary.iterrows():

    weighted_rating = (
        None
        if pd.isna(row["weighted_rating"])
        else round(float(row["weighted_rating"]), 3)
    )

    mean_rating = (
        None
        if pd.isna(row["mean_rating"])
        else round(float(row["mean_rating"]), 3)
    )

    cells.append({
        "year": int(row["year"]),
        "genre": row["genre"],
        "weighted_rating": weighted_rating,
        "mean_rating": mean_rating,
        "total_votes": int(row["total_votes"]),
        "movie_count": int(row["movie_count"]),
    })


# ============================================================
# Year coverage
# ============================================================

year_coverage = (
    movies
    .groupby("year")
    .agg(
        movie_count=("tmdbId", "nunique"),
        total_votes=("vote_count", "sum")
    )
    .reset_index()
)


coverage_records = []

for _, row in year_coverage.iterrows():

    coverage_records.append({
        "year": int(row["year"]),
        "movie_count": int(row["movie_count"]),
        "total_votes": int(row["total_votes"]),
    })


# ============================================================
# Metadata
# ============================================================

output = {
    "metadata": {
        "title": "Genre Ratings Over Time",
        "start_year": START_YEAR,
        "end_year": END_YEAR,

        "genres": GENRES,
        "years": years,

        "default_metric": "weighted_rating",

        "metrics": {
            "weighted_rating": {
                "label": "Weighted Average Rating",
                "description":
                    "TMDB vote averages weighted by each movie's vote count.",
                "unit": "/ 10",
            },

            "total_votes": {
                "label": "Total Vote Count",
                "description":
                    "Total number of TMDB votes received by movies in the cell.",
                "unit": "votes",
            },

            "movie_count": {
                "label": "Number of Movies",
                "description":
                    "Number of movies in the genre-year cell.",
                "unit": "movies",
            },
        },

        "note":
            "Movies can belong to multiple genres, so one movie may contribute "
            "to more than one genre. 2026 represents partial-year coverage.",
    },

    "year_coverage": coverage_records,

    "cells": cells,
}


# ============================================================
# Save JSON
# ============================================================

OUTPUT_PATH.parent.mkdir(
    parents=True,
    exist_ok=True
)

with open(
    OUTPUT_PATH,
    "w",
    encoding="utf-8"
) as f:

    json.dump(
        output,
        f,
        ensure_ascii=False,
        indent=2
    )


# ============================================================
# Summary
# ============================================================

print("=" * 70)
print("VIZ 4 EXPORT COMPLETE")
print("=" * 70)

print("Output:", OUTPUT_PATH)

print(
    "Years:",
    START_YEAR,
    "to",
    END_YEAR
)

print(
    "Genres:",
    len(GENRES)
)

print(
    "Heatmap cells:",
    len(cells)
)

print(
    "Movies used:",
    movies["tmdbId"].nunique()
)

print(
    "Non-empty cells:",
    sum(
        cell["movie_count"] > 0
        for cell in cells
    )
)

print(
    "Empty cells:",
    sum(
        cell["movie_count"] == 0
        for cell in cells
    )
)

print("\nYear coverage:")

for record in coverage_records:
    print(
        record["year"],
        "movies:",
        record["movie_count"],
        "| votes:",
        f'{record["total_votes"]:,}'
    )