#!/usr/bin/env python3
import json
from urllib.request import urlopen, Request
from urllib.error import HTTPError

query = """
query IntrospectionQuery {
  __schema {
    queryType { name }
    types {
      name
      kind
      fields {
        name
        args { name type { name kind ofType { name } } }
        type { name kind ofType { name } }
      }
    }
  }
}
"""

payload = json.dumps({"query": query}).encode("utf-8")

req = Request("https://api.cosmos.so/graphql", data=payload, headers={
    "User-Agent": "Mozilla/5.0",
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Origin": "https://www.cosmos.so",
    "Referer": "https://www.cosmos.so/",
})

try:
    with urlopen(req, timeout=30) as response:
        data = json.loads(response.read().decode("utf-8"))
        for t in data.get("data", {}).get("__schema", {}).get("types", []):
            if t["name"] == "Query":
                for field in t.get("fields", []):
                    name = field["name"].lower()
                    if "element" in name or "cluster" in name:
                        print("Field:", field["name"])
                        print("  Args:", json.dumps(field.get("args", []), indent=4))
except HTTPError as e:
    print("Error:", e.code, e.reason)
    print(e.read().decode("utf-8")[:2000])

