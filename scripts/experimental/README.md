# Experimental Scripts

These scripts were used for exploring APIs and testing during development. They are not part of the main pipeline but are kept for reference.

## Scripts

### `cosmos_introspect.py`
GraphQL introspection script for exploring the Cosmos.so API schema. Used to discover available queries, mutations, and types.

### `test_cosmos_api.py`
Testing script for the Cosmos.so GraphQL API. Used to experiment with different queries and understand the API response format.

### `test_cosmos_pagination.py`
Script for testing pagination approaches with the Cosmos.so API. Explored cursor-based pagination before switching to Playwright scrolling approach.

### `test_tokenizers.py`
Comparison script for Japanese tokenizers (MeCab vs SudachiPy). Used to evaluate tokenization quality for dictionary matching. Concluded that SudachiPy Mode C works best for casual/spoken Japanese.

## Note

These scripts may require manual setup or API access to run. They are primarily for documentation and reference purposes.

