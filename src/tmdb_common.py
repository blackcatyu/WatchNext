import json
import os
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.environ["TMDB_API_KEY"]
BASE_URL = "https://api.themoviedb.org/3"
CACHE_DIR = Path("data/raw/tmdb")
CACHE_DIR.mkdir(parents=True, exist_ok=True)

MAX_RETRIES = 3


def fetch_movie(tmdb_id: int) -> dict | None:
    cache_path = CACHE_DIR / f"{tmdb_id}.json"
    if cache_path.exists():
        return json.loads(cache_path.read_text(encoding="utf-8"))

    url = f"{BASE_URL}/movie/{tmdb_id}"
    params = {"api_key": API_KEY, "append_to_response": "credits,keywords,reviews"}

    for _ in range(MAX_RETRIES):
        resp = requests.get(url, params=params, timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            cache_path.write_text(json.dumps(data), encoding="utf-8")
            return data
        if resp.status_code == 404:
            return None
        if resp.status_code == 429:
            time.sleep(float(resp.headers.get("Retry-After", 1)))
            continue
        time.sleep(1)
    return None


def extract_rows(tmdb_id: int, data: dict) -> dict:
    movie = {
        "tmdbId": tmdb_id,
        "title": data.get("title"),
        "release_date": data.get("release_date"),
        "genres": [g["name"] for g in data.get("genres", [])],
        "vote_average": data.get("vote_average"),
        "vote_count": data.get("vote_count"),
        "popularity": data.get("popularity"),
        "budget": data.get("budget"),
        "revenue": data.get("revenue"),
        "runtime": data.get("runtime"),
        "overview": data.get("overview"),
    }

    cast = [
        {
            "tmdbId": tmdb_id,
            "person_id": c.get("id"),
            "name": c.get("name"),
            "character": c.get("character"),
            "order": c.get("order"),
        }
        for c in data.get("credits", {}).get("cast", [])[:10]
    ]

    crew = [
        {"tmdbId": tmdb_id, "person_id": c.get("id"), "name": c.get("name"), "job": c.get("job")}
        for c in data.get("credits", {}).get("crew", [])
        if c.get("job") == "Director"
    ]

    keywords = [
        {"tmdbId": tmdb_id, "keyword": k.get("name")}
        for k in data.get("keywords", {}).get("keywords", [])
    ]

    reviews = [
        {
            "tmdbId": tmdb_id,
            "author": r.get("author"),
            "content": r.get("content"),
            "created_at": r.get("created_at"),
            "author_rating": (r.get("author_details") or {}).get("rating"),
        }
        for r in data.get("reviews", {}).get("results", [])
    ]

    return {"movie": movie, "cast": cast, "crew": crew, "keywords": keywords, "reviews": reviews}


def fetch_and_extract(tmdb_ids: list[int], progress_every: int = 100) -> dict:
    movies, cast_rows, crew_rows, keyword_rows, review_rows = [], [], [], [], []
    missing = []

    for i, tmdb_id in enumerate(tmdb_ids, 1):
        data = fetch_movie(tmdb_id)
        if data is None:
            missing.append(tmdb_id)
        else:
            rows = extract_rows(tmdb_id, data)
            movies.append(rows["movie"])
            cast_rows.extend(rows["cast"])
            crew_rows.extend(rows["crew"])
            keyword_rows.extend(rows["keywords"])
            review_rows.extend(rows["reviews"])

        if i % progress_every == 0 or i == len(tmdb_ids):
            print(f"{i}/{len(tmdb_ids)} fetched, {len(missing)} missing")

    return {
        "movies": movies,
        "cast": cast_rows,
        "crew": crew_rows,
        "keywords": keyword_rows,
        "reviews": review_rows,
        "missing": missing,
    }
