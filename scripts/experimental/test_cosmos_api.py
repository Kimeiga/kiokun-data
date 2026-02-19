#!/usr/bin/env python3
"""Test different Cosmos API approaches."""

import json
from urllib.request import urlopen, Request
from urllib.error import HTTPError

# Try different queries based on the error message hints
# The error mentioned: UserListFiltersInput, ElementTileList, DeleteClustersInput, ElementTile

queries_to_try = [
    # Test various pagination args on elements query
    {
        "name": "elements with pagination arg",
        "query": """
query Elements($filters: ElementListFilters!, $pagination: PaginationInput) {
  elements(filters: $filters, pagination: $pagination) {
    items { id }
    meta { nextPageCursor count }
  }
}
""",
        "variables": {"filters": {"clusterId": 660174747}, "pagination": {"cursor": "eyJ2MSI6MzkxLjAsInYyIjozMzA3NDAyNn0="}}
    },
    # Maybe limit/offset
    {
        "name": "elements with limit/offset",
        "query": """
query Elements($filters: ElementListFilters!, $limit: Int, $offset: Int) {
  elements(filters: $filters, limit: $limit, offset: $offset) {
    items { id }
    meta { nextPageCursor count }
  }
}
""",
        "variables": {"filters": {"clusterId": 660174747}, "limit": 50, "offset": 50}
    },
    # Maybe first/after (Relay style)
    {
        "name": "elements with first/after",
        "query": """
query Elements($filters: ElementListFilters!, $first: Int, $after: String) {
  elements(filters: $filters, first: $first, after: $after) {
    items { id }
    meta { nextPageCursor count }
  }
}
""",
        "variables": {"filters": {"clusterId": 660174747}, "first": 50, "after": "eyJ2MSI6MzkxLjAsInYyIjozMzA3NDAyNn0="}
    },
]

for q in queries_to_try:
    print(f"\n{'='*60}")
    print(f"Trying: {q['name']}")
    print(f"{'='*60}")
    
    payload = json.dumps({"query": q["query"], "variables": q["variables"]}).encode("utf-8")
    
    req = Request("https://api.cosmos.so/graphql", data=payload, headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Origin": "https://www.cosmos.so",
        "Referer": "https://www.cosmos.so/kimeiga/j",
    })
    
    try:
        with urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode("utf-8"))
            print("SUCCESS!")
            print(json.dumps(data, indent=2)[:1500])
    except HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"Error: {e.code} {e.reason}")
        # Parse and show cleaner error
        try:
            err = json.loads(body)
            for error in err.get("errors", []):
                print(f"  - {error.get('message', 'Unknown error')}")
        except:
            print(body[:500])

