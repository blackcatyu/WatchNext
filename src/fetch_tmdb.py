import json
from pathlib import Path

import pandas as pd

from tmdb_common import fetch_and_extract

CANDIDATES_PATH = Path("data/processed/candidate_movies.csv")
OUT_DIR = Path("data/processed")


def main() -> None:
    candidates = pd.read_csv(CANDIDATES_PATH)
    tmdb_ids = candidates["tmdbId"].dropna().astype(int).tolist()

    result = fetch_and_extract(tmdb_ids)

    pd.DataFrame(result["movies"]).to_json(OUT_DIR / "tmdb_movies.jsonl", orient="records", lines=True)
    pd.DataFrame(result["cast"]).to_csv(OUT_DIR / "tmdb_cast.csv", index=False)
    pd.DataFrame(result["crew"]).to_csv(OUT_DIR / "tmdb_directors.csv", index=False)
    pd.DataFrame(result["keywords"]).to_csv(OUT_DIR / "tmdb_keywords.csv", index=False)
    pd.DataFrame(result["reviews"]).to_csv(OUT_DIR / "tmdb_reviews.csv", index=False)

    print(f"\nmovies fetched: {len(result['movies'])}, missing/failed: {len(result['missing'])}")
    print(
        f"cast rows: {len(result['cast'])}, directors: {len(result['crew'])}, "
        f"keywords: {len(result['keywords'])}, reviews: {len(result['reviews'])}"
    )
    if result["missing"]:
        (OUT_DIR / "tmdb_missing_ids.json").write_text(json.dumps(result["missing"]), encoding="utf-8")


if __name__ == "__main__":
    main()
