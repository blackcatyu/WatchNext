import json
from pathlib import Path

import numpy as np
import pandas as pd

PROCESSED_DIR = Path("data/processed")
OUT_PATH = Path("docs/data/viz2_similarity_network.json")
OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

N_MOVIES = 80
TOP_EDGES_PER_NODE = 5
LIKE_THRESHOLD = 4.0


def main() -> None:
    candidates = pd.read_csv(PROCESSED_DIR / "candidate_movies.csv").head(N_MOVIES)
    movie_ids = candidates["movieId"].tolist()

    movies = pd.read_json(PROCESSED_DIR / "movies_final.jsonl", lines=True)
    titles = movies.set_index("movieId")[["title", "genres"]]

    ratings = pd.read_csv(
        PROCESSED_DIR / "ratings_candidates.csv",
        usecols=["userId", "movieId", "rating"],
        dtype={"userId": "int64", "movieId": "int64", "rating": "float32"},
    )
    ratings = ratings[ratings["movieId"].isin(movie_ids) & (ratings["rating"] >= LIKE_THRESHOLD)]

    liked = pd.crosstab(ratings["userId"], ratings["movieId"]).clip(upper=1)
    liked = liked.reindex(columns=movie_ids, fill_value=0)

    co_like = liked.T.values @ liked.values
    np.fill_diagonal(co_like, 0)

    id_to_idx = {mid: i for i, mid in enumerate(movie_ids)}
    edges = {}
    for i, mid in enumerate(movie_ids):
        top_idx = np.argsort(co_like[i])[::-1][:TOP_EDGES_PER_NODE]
        for j in top_idx:
            weight = int(co_like[i, j])
            if weight <= 0:
                continue
            key = tuple(sorted((i, j)))
            edges[key] = max(edges.get(key, 0), weight)

    nodes = []
    for mid in movie_ids:
        row = titles.loc[mid] if mid in titles.index else None
        title = row["title"] if row is not None else str(mid)
        genre = row["genres"][0] if row is not None and row["genres"] else "Other"
        nodes.append({"id": int(mid), "title": title, "genre": genre})

    links = [
        {"source": int(movie_ids[i]), "target": int(movie_ids[j]), "weight": w}
        for (i, j), w in edges.items()
    ]

    OUT_PATH.write_text(json.dumps({"nodes": nodes, "links": links}, indent=2), encoding="utf-8")

    print(f"nodes: {len(nodes)}, edges: {len(links)}")
    degree = pd.Series([l["source"] for l in links] + [l["target"] for l in links]).value_counts()
    print(f"isolated nodes (no edges): {(~pd.Series(movie_ids).isin(degree.index)).sum()}")

    top_pairs = sorted(links, key=lambda l: -l["weight"])[:5]
    id_to_title = {n["id"]: n["title"] for n in nodes}
    print("\nstrongest pairs:")
    for l in top_pairs:
        print(f"  {id_to_title[l['source']]!r} <-> {id_to_title[l['target']]!r}: {l['weight']}")


if __name__ == "__main__":
    main()
