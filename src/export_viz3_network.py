import json
from pathlib import Path

import networkx as nx
import pandas as pd


# ============================================================
# SETTINGS
# ============================================================

DATA_DIR = Path("data/processed")
OUTPUT_DIR = Path("docs/data")

CAST_PATH = DATA_DIR / "cast_final.csv"
DIRECTORS_PATH = DATA_DIR / "directors_final.csv"
MOVIES_PATH = DATA_DIR / "movies_final.jsonl"

OUTPUT_PATH = OUTPUT_DIR / "viz3_collaboration_network.json"

# A person must appear in at least this many movies
# before entering the Viz 3 candidate pool.
MIN_PERSON_MOVIES = 5

# The visualization starts at 3 shared movies.
MIN_SHARED_MOVIES = 3


# ============================================================
# 1. LOAD DATA
# ============================================================

print("Loading data...")

cast = pd.read_csv(CAST_PATH)
directors = pd.read_csv(DIRECTORS_PATH)
movies = pd.read_json(MOVIES_PATH, lines=True)

print(f"Cast rows:     {len(cast):,}")
print(f"Director rows: {len(directors):,}")
print(f"Movies:        {len(movies):,}")


# ============================================================
# 2. CLEAN IMPORTANT FIELDS
# ============================================================

cast = cast.dropna(
    subset=["tmdbId", "person_id", "name"]
).copy()

directors = directors.dropna(
    subset=["tmdbId", "person_id", "name"]
).copy()

cast["tmdbId"] = cast["tmdbId"].astype(int)
cast["person_id"] = cast["person_id"].astype(int)

directors["tmdbId"] = directors["tmdbId"].astype(int)
directors["person_id"] = directors["person_id"].astype(int)

movies["tmdbId"] = movies["tmdbId"].astype(int)


# ============================================================
# 3. COUNT MOVIES PER ACTOR / DIRECTOR
# ============================================================

actor_counts = (
    cast
    .groupby(["person_id", "name"])["tmdbId"]
    .nunique()
    .reset_index(name="movie_count")
)

director_counts = (
    directors
    .groupby(["person_id", "name"])["tmdbId"]
    .nunique()
    .reset_index(name="movie_count")
)


eligible_actor_ids = set(
    actor_counts.loc[
        actor_counts["movie_count"] >= MIN_PERSON_MOVIES,
        "person_id"
    ]
)

eligible_director_ids = set(
    director_counts.loc[
        director_counts["movie_count"] >= MIN_PERSON_MOVIES,
        "person_id"
    ]
)

print()
print(
    f"Actors with >= {MIN_PERSON_MOVIES} movies: "
    f"{len(eligible_actor_ids):,}"
)

print(
    f"Directors with >= {MIN_PERSON_MOVIES} movies: "
    f"{len(eligible_director_ids):,}"
)


# ============================================================
# 4. BUILD ACTOR-DIRECTOR MOVIE PAIRS
# ============================================================

collaborations = cast.merge(
    directors,
    on="tmdbId",
    suffixes=("_actor", "_director")
)

# Remove self-collaborations.
collaborations = collaborations[
    collaborations["person_id_actor"]
    != collaborations["person_id_director"]
].copy()

# Keep people who satisfy the movie-count requirement.
collaborations = collaborations[
    collaborations["person_id_actor"].isin(eligible_actor_ids)
    & collaborations["person_id_director"].isin(
        eligible_director_ids
    )
].copy()


# ============================================================
# 5. BUILD EDGES
# ============================================================

edge_groups = (
    collaborations
    .groupby([
        "person_id_actor",
        "name_actor",
        "person_id_director",
        "name_director"
    ])
)


edge_rows = []

for keys, group in edge_groups:

    (
        actor_id,
        actor_name,
        director_id,
        director_name
    ) = keys

    movie_ids = sorted(
        group["tmdbId"]
        .dropna()
        .astype(int)
        .unique()
        .tolist()
    )

    collaboration_count = len(movie_ids)

    # The default visualization starts at 3.
    # We do not need edges weaker than this in Viz 3.
    if collaboration_count < MIN_SHARED_MOVIES:
        continue

    edge_rows.append({
        "source": f"actor_{actor_id}",
        "target": f"director_{director_id}",
        "collaboration_count": collaboration_count,
        "movies": movie_ids
    })


print()
print(
    f"Edges with >= {MIN_SHARED_MOVIES} shared movies: "
    f"{len(edge_rows):,}"
)


# ============================================================
# 6. BUILD NETWORKX GRAPH
# ============================================================

G = nx.Graph()

for edge in edge_rows:

    G.add_edge(
        edge["source"],
        edge["target"],
        weight=edge["collaboration_count"]
    )


print(f"Network nodes: {G.number_of_nodes():,}")
print(f"Network edges: {G.number_of_edges():,}")


# ============================================================
# 7. DETECT COMMUNITIES
# ============================================================

# Detect communities separately inside each connected component.

communities = []

components = sorted(
    nx.connected_components(G),
    key=len,
    reverse=True
)

for component_nodes in components:

    subgraph = G.subgraph(component_nodes).copy()

    if subgraph.number_of_nodes() == 1:

        detected = [
            set(subgraph.nodes())
        ]

    else:

        detected = list(
            nx.community.greedy_modularity_communities(
                subgraph,
                weight="weight"
            )
        )

    communities.extend(detected)


communities = sorted(
    communities,
    key=len,
    reverse=True
)


community_lookup = {}

for community_id, community in enumerate(communities):

    for node_id in community:

        community_lookup[node_id] = community_id


print(f"Communities: {len(communities):,}")


# ============================================================
# 8. PREPARE PERSON LOOKUPS
# ============================================================

actor_count_lookup = {
    int(row.person_id): int(row.movie_count)
    for row in actor_counts.itertuples()
}

director_count_lookup = {
    int(row.person_id): int(row.movie_count)
    for row in director_counts.itertuples()
}


actor_name_lookup = (
    cast
    .drop_duplicates("person_id")
    .set_index("person_id")["name"]
    .to_dict()
)

director_name_lookup = (
    directors
    .drop_duplicates("person_id")
    .set_index("person_id")["name"]
    .to_dict()
)


# ============================================================
# 9. BUILD NODE DATA
# ============================================================

nodes = []


for node_id in G.nodes():

    role, person_id_text = node_id.split("_", 1)
    person_id = int(person_id_text)

    if role == "actor":

        name = actor_name_lookup.get(
            person_id,
            "Unknown"
        )

        movie_count = actor_count_lookup.get(
            person_id,
            0
        )

        display_role = "Actor"

    else:

        name = director_name_lookup.get(
            person_id,
            "Unknown"
        )

        movie_count = director_count_lookup.get(
            person_id,
            0
        )

        display_role = "Director"


    degree = G.degree(node_id)

    weighted_degree = sum(
        edge_data.get("weight", 1)
        for _, _, edge_data
        in G.edges(node_id, data=True)
    )


    nodes.append({
        "id": node_id,
        "person_id": person_id,
        "name": name,
        "role": display_role,
        "movie_count": int(movie_count),
        "degree": int(degree),
        "weighted_degree": int(weighted_degree),
        "community": int(
            community_lookup.get(node_id, -1)
        )
    })


# ============================================================
# 10. PREPARE MOVIE METADATA
# ============================================================

movie_columns = [
    "tmdbId",
    "title",
    "year",
    "release_date",
    "genres",
    "vote_average",
    "vote_count",
    "popularity",
    "revenue",
    "runtime"
]

available_movie_columns = [
    column
    for column in movie_columns
    if column in movies.columns
]

movie_info = movies[
    available_movie_columns
].copy()


movie_lookup = (
    movie_info
    .drop_duplicates("tmdbId")
    .set_index("tmdbId")
    .to_dict(orient="index")
)


# ============================================================
# 11. BUILD CAREER DATA FOR EACH PERSON
# ============================================================

career = {}


# ---------------------------
# Actors
# ---------------------------

for node in nodes:

    if node["role"] != "Actor":
        continue

    person_id = node["person_id"]
    node_id = node["id"]

    person_movies = (
        cast.loc[
            cast["person_id"] == person_id,
            "tmdbId"
        ]
        .dropna()
        .astype(int)
        .unique()
        .tolist()
    )

    career_movies = []

    for tmdb_id in person_movies:

        if tmdb_id not in movie_lookup:
            continue

        info = movie_lookup[tmdb_id]

        record = {
            "tmdbId": tmdb_id,
            **info
        }

        career_movies.append(record)

    career[node_id] = career_movies


# ---------------------------
# Directors
# ---------------------------

for node in nodes:

    if node["role"] != "Director":
        continue

    person_id = node["person_id"]
    node_id = node["id"]

    person_movies = (
        directors.loc[
            directors["person_id"] == person_id,
            "tmdbId"
        ]
        .dropna()
        .astype(int)
        .unique()
        .tolist()
    )

    career_movies = []

    for tmdb_id in person_movies:

        if tmdb_id not in movie_lookup:
            continue

        info = movie_lookup[tmdb_id]

        record = {
            "tmdbId": tmdb_id,
            **info
        }

        career_movies.append(record)

    career[node_id] = career_movies


# ============================================================
# 12. CONVERT PANDAS / NUMPY VALUES TO JSON-SAFE VALUES
# ============================================================

def clean_json_value(value):

    if isinstance(value, list):
        return [
            clean_json_value(item)
            for item in value
        ]

    if isinstance(value, dict):
        return {
            key: clean_json_value(item)
            for key, item in value.items()
        }

    if pd.isna(value):
        return None

    if hasattr(value, "item"):
        return value.item()

    return value


nodes = clean_json_value(nodes)
edge_rows = clean_json_value(edge_rows)
career = clean_json_value(career)


# ============================================================
# 13. BUILD FINAL JSON
# ============================================================

output = {
    "metadata": {
        "min_person_movies": MIN_PERSON_MOVIES,
        "min_shared_movies": MIN_SHARED_MOVIES,
        "slider_values": [3, 4, 5, 6],
        "node_count": len(nodes),
        "edge_count": len(edge_rows),
        "community_count": len(communities)
    },

    "nodes": nodes,

    "links": edge_rows,

    "career": career
}


# ============================================================
# 14. SAVE OUTPUT
# ============================================================

OUTPUT_DIR.mkdir(
    parents=True,
    exist_ok=True
)

with open(
    OUTPUT_PATH,
    "w",
    encoding="utf-8"
) as file:

    json.dump(
        output,
        file,
        ensure_ascii=False,
        indent=2
    )


print()
print("=" * 70)
print("EXPORT COMPLETE")
print("=" * 70)

print(f"Output: {OUTPUT_PATH}")
print(f"Nodes:  {len(nodes):,}")
print(f"Links:  {len(edge_rows):,}")
print(f"Career profiles: {len(career):,}")
print(f"Communities: {len(communities):,}")