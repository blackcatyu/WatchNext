import pandas as pd
import networkx as nx


# ============================================================
# SETTINGS
# ============================================================

CAST_PATH = "data/processed/cast_final.csv"
DIRECTORS_PATH = "data/processed/directors_final.csv"

TOP_N = 10


# ============================================================
# 1. LOAD DATA
# ============================================================

cast = pd.read_csv(CAST_PATH)
directors = pd.read_csv(DIRECTORS_PATH)


print("=" * 70)
print("RAW DATA")
print("=" * 70)

print(f"Cast rows:        {len(cast):,}")
print(f"Director rows:    {len(directors):,}")
print(f"Unique actors:    {cast['person_id'].nunique():,}")
print(f"Unique directors: {directors['person_id'].nunique():,}")


# ============================================================
# 2. COUNT MOVIES FOR EACH PERSON
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


print("\n" + "=" * 70)
print("TOP 10 ACTORS BY NUMBER OF MOVIES")
print("=" * 70)

print(
    actor_counts
    .sort_values("movie_count", ascending=False)
    .head(TOP_N)
    .to_string(index=False)
)


print("\n" + "=" * 70)
print("TOP 10 DIRECTORS BY NUMBER OF MOVIES")
print("=" * 70)

print(
    director_counts
    .sort_values("movie_count", ascending=False)
    .head(TOP_N)
    .to_string(index=False)
)


# ============================================================
# 3. BUILD ACTOR-DIRECTOR COLLABORATIONS
# ============================================================

# Join cast and director records through movie ID.
#
# Example:
#
# Movie A
#   Actor: Leonardo DiCaprio
#   Director: Christopher Nolan
#
# becomes:
#
# Leonardo DiCaprio ---- Christopher Nolan

collaborations = cast.merge(
    directors,
    on="tmdbId",
    suffixes=("_actor", "_director")
)


# ============================================================
# 4. REMOVE SELF-COLLABORATIONS
# ============================================================

# Some people are both actors and directors.
#
# Example:
#
# Clint Eastwood (actor)
#       |
# Clint Eastwood (director)
#
# This is not a collaboration between two different people,
# so remove these self-edges from the network.

self_collaborations = collaborations[
    collaborations["person_id_actor"]
    == collaborations["person_id_director"]
]

print("\n" + "=" * 70)
print("SELF-COLLABORATIONS")
print("=" * 70)

print(
    f"Actor-director movie records where the same person "
    f"appears on both sides: {len(self_collaborations):,}"
)


collaborations = collaborations[
    collaborations["person_id_actor"]
    != collaborations["person_id_director"]
].copy()


# ============================================================
# 5. AGGREGATE COLLABORATION EDGES
# ============================================================

edges = (
    collaborations
    .groupby([
        "person_id_actor",
        "name_actor",
        "person_id_director",
        "name_director"
    ])["tmdbId"]
    .nunique()
    .reset_index(name="collaboration_count")
)


print("\n" + "=" * 70)
print("COLLABORATION NETWORK")
print("=" * 70)

print(f"Actor-director edges after removing self-edges: {len(edges):,}")


print("\n" + "=" * 70)
print("TOP 10 STRONGEST COLLABORATIONS")
print("=" * 70)

print(
    edges
    .sort_values(
        ["collaboration_count", "name_actor"],
        ascending=[False, True]
    )
    .head(TOP_N)
    .to_string(index=False)
)


# ============================================================
# 6. FUNCTION: FILTER NETWORK
# ============================================================

def filter_network(min_movies, min_collaborations):
    """
    Keep actors/directors who appear in at least min_movies movies,
    then keep edges representing at least min_collaborations shared movies.
    """

    eligible_actors = set(
        actor_counts.loc[
            actor_counts["movie_count"] >= min_movies,
            "person_id"
        ]
    )

    eligible_directors = set(
        director_counts.loc[
            director_counts["movie_count"] >= min_movies,
            "person_id"
        ]
    )

    filtered_edges = edges[
        edges["person_id_actor"].isin(eligible_actors)
        & edges["person_id_director"].isin(eligible_directors)
        & (
            edges["collaboration_count"]
            >= min_collaborations
        )
    ].copy()

    return filtered_edges


# ============================================================
# 7. FUNCTION: BUILD NETWORKX GRAPH
# ============================================================

def build_graph(filtered_edges):
    """
    Convert the filtered collaboration table into a NetworkX graph.

    Node IDs include the role prefix so an actor ID and director ID
    cannot accidentally collide.

    Example:
        actor_85
        director_510
    """

    G = nx.Graph()

    for _, row in filtered_edges.iterrows():

        actor_node = f"actor_{int(row['person_id_actor'])}"
        director_node = f"director_{int(row['person_id_director'])}"

        G.add_node(
            actor_node,
            person_id=int(row["person_id_actor"]),
            name=row["name_actor"],
            role="Actor"
        )

        G.add_node(
            director_node,
            person_id=int(row["person_id_director"]),
            name=row["name_director"],
            role="Director"
        )

        G.add_edge(
            actor_node,
            director_node,
            weight=int(row["collaboration_count"])
        )

    return G


# ============================================================
# 8. FUNCTION: BASIC NETWORK STATISTICS
# ============================================================

def print_network_stats(label, min_movies, min_collaborations):

    filtered_edges = filter_network(
        min_movies,
        min_collaborations
    )

    G = build_graph(filtered_edges)

    actor_nodes = [
        node
        for node, data in G.nodes(data=True)
        if data["role"] == "Actor"
    ]

    director_nodes = [
        node
        for node, data in G.nodes(data=True)
        if data["role"] == "Director"
    ]

    print("\n" + "=" * 70)

    print(
        f"STRATEGY {label}: "
        f">= {min_movies} movies, "
        f">= {min_collaborations} collaborations"
    )

    print("=" * 70)

    print(f"Actors:    {len(actor_nodes):,}")
    print(f"Directors: {len(director_nodes):,}")
    print(f"Nodes:     {G.number_of_nodes():,}")
    print(f"Edges:     {G.number_of_edges():,}")

    if G.number_of_nodes() == 0:
        print("No nodes remain after filtering.")
        return filtered_edges, G

    components = sorted(
        nx.connected_components(G),
        key=len,
        reverse=True
    )

    print(f"Connected components: {len(components):,}")

    print(
        f"Largest component:    "
        f"{len(components[0]):,} nodes"
    )

    largest_share = (
        len(components[0])
        / G.number_of_nodes()
        * 100
    )

    print(
        f"Largest component share: "
        f"{largest_share:.1f}%"
    )

    print("\nLargest component sizes:")

    for i, component in enumerate(components[:10], start=1):
        print(
            f"  Component {i}: "
            f"{len(component):,} nodes"
        )

    return filtered_edges, G


# ============================================================
# 9. COMPARE FILTERING STRATEGIES
# ============================================================

strategy_A_edges, G_A = print_network_stats(
    label="A",
    min_movies=3,
    min_collaborations=2
)

strategy_B_edges, G_B = print_network_stats(
    label="B",
    min_movies=5,
    min_collaborations=2
)

strategy_C_edges, G_C = print_network_stats(
    label="C",
    min_movies=5,
    min_collaborations=3
)


# ============================================================
# 10. FUNCTION: COMMUNITY DETECTION
# ============================================================

def analyze_communities(G, label):
    """
    Detect collaboration communities using NetworkX's
    greedy modularity community detection.

    Community detection is performed separately for each
    connected component because disconnected components
    already represent independent groups.
    """

    print("\n" + "=" * 70)
    print(f"COMMUNITY ANALYSIS — STRATEGY {label}")
    print("=" * 70)

    if G.number_of_nodes() == 0:
        print("No network available.")
        return

    components = sorted(
        nx.connected_components(G),
        key=len,
        reverse=True
    )

    all_communities = []

    for component_nodes in components:

        subgraph = G.subgraph(component_nodes).copy()

        # A single-node component is already its own community.
        if subgraph.number_of_nodes() == 1:

            communities = [
                set(subgraph.nodes())
            ]

        else:

            communities = list(
                nx.community.greedy_modularity_communities(
                    subgraph,
                    weight="weight"
                )
            )

        all_communities.extend(communities)


    all_communities = sorted(
        all_communities,
        key=len,
        reverse=True
    )


    print(
        f"Total detected communities: "
        f"{len(all_communities):,}"
    )

    print("\nLargest community sizes:")

    for i, community in enumerate(
        all_communities[:10],
        start=1
    ):

        print(
            f"  Community {i}: "
            f"{len(community):,} nodes"
        )


    # --------------------------------------------------------
    # Show important people in the largest communities
    # --------------------------------------------------------

    print("\n" + "-" * 70)
    print("TOP PEOPLE IN THE LARGEST COMMUNITIES")
    print("-" * 70)


    for community_number, community in enumerate(
        all_communities[:10],
        start=1
    ):

        community_subgraph = G.subgraph(community)

        ranked_nodes = sorted(
            community_subgraph.degree(weight="weight"),
            key=lambda x: x[1],
            reverse=True
        )

        print(
            f"\nCommunity {community_number} "
            f"({len(community)} nodes)"
        )

        for node, weighted_degree in ranked_nodes[:8]:

            data = G.nodes[node]

            print(
                f"  {data['name']:<25} "
                f"{data['role']:<10} "
                f"weighted_degree={weighted_degree}"
            )


# ============================================================
# 11. ANALYZE STRATEGY B AND C COMMUNITIES
# ============================================================

analyze_communities(
    G_B,
    label="B"
)

analyze_communities(
    G_C,
    label="C"
)


# ============================================================
# 12. SUMMARY
# ============================================================

print("\n" + "=" * 70)
print("DONE")
print("=" * 70)

print(
    """
Interpretation guide:

Strategy A
  More people and relationships.
  Useful for understanding the broader network,
  but likely too dense for the final visualization.

Strategy B
  Keeps people appearing in at least 5 movies
  and collaborations occurring at least twice.
  This may be useful for the interactive network.

Strategy C
  Keeps only stronger recurring collaborations.
  This may be useful for the default/static view.

Connected components
  Show whether the network forms one large structure
  or many separate collaboration groups.

Communities
  Show groups of actors and directors who collaborate
  more strongly with one another.

Next step
  Compare Strategy B and C using:
      1. network size
      2. largest component
      3. community structure
      4. recognizability of people in each community

Then choose the filtering rule for Visualization 3.
"""
)