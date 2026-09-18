from pathlib import Path

import pandas as pd
import requests

from tmdb_common import API_KEY, BASE_URL, fetch_and_extract

OUT_DIR = Path("data/processed")

START_DATE = "2016-09-19"  # last ~10 years
TODAY = "2026-09-19"
TARGET_MIN, TARGET_MAX = 500, 600
VOTE_COUNT_THRESHOLDS = [200, 50, 20]


def discover_ids(min_votes: int, limit: int) -> list[int]:
    # sort_by=vote_count.desc rather than popularity.desc: popularity is
    # recomputed continuously by TMDB, so paginating by it mid-fetch causes
    # movies to drift between pages, producing duplicates and gaps.
    seen: set[int] = set()
    ids: list[int] = []
    page = 1
    while len(ids) < limit:
        resp = requests.get(
            f"{BASE_URL}/discover/movie",
            params={
                "api_key": API_KEY,
                "sort_by": "vote_count.desc",
                "primary_release_date.gte": START_DATE,
                "primary_release_date.lte": TODAY,
                "vote_count.gte": min_votes,
                "include_adult": "false",
                "page": page,
            },
            timeout=15,
        )
        resp.raise_for_status()
        payload = resp.json()
        results = payload.get("results", [])
        if not results:
            break
        for m in results:
            if m["id"] not in seen:
                seen.add(m["id"])
                ids.append(m["id"])
        if page >= payload.get("total_pages", 1):
            break
        page += 1
    return ids[:limit]


def main() -> None:
    tmdb_ids: list[int] = []
    for min_votes in VOTE_COUNT_THRESHOLDS:
        tmdb_ids = discover_ids(min_votes, TARGET_MAX)
        print(f"vote_count.gte={min_votes} -> {len(tmdb_ids)} movies found")
        if len(tmdb_ids) >= TARGET_MIN:
            break

    print(f"fetching details for {len(tmdb_ids)} recent movies ({START_DATE} to {TODAY})")
    result = fetch_and_extract(tmdb_ids)

    pd.DataFrame(result["movies"]).to_json(
        OUT_DIR / "tmdb_movies_recent.jsonl", orient="records", lines=True
    )
    pd.DataFrame(result["cast"]).to_csv(OUT_DIR / "tmdb_cast_recent.csv", index=False)
    pd.DataFrame(result["crew"]).to_csv(OUT_DIR / "tmdb_directors_recent.csv", index=False)
    pd.DataFrame(result["keywords"]).to_csv(OUT_DIR / "tmdb_keywords_recent.csv", index=False)
    pd.DataFrame(result["reviews"]).to_csv(OUT_DIR / "tmdb_reviews_recent.csv", index=False)

    print(f"\nrecent movies fetched: {len(result['movies'])}, missing/failed: {len(result['missing'])}")


if __name__ == "__main__":
    main()
