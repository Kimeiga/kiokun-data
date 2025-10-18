# TODO

## High Priority

- [ ] make system for pulling up works that a word is contained in

## Completed

- [x] **Optimize dictionary output size** (1.7GB → ~900MB)
  - Implemented field name optimization (46% reduction per file)
  - Using shortened field names with expansion in webapp
  - Field mappings in `sveltekit-app/src/lib/field-mappings.ts`

- [x] **Reorganize project structure**
  - Moved all game projects to `game-concepts/` folder
  - Cleaned up temporary documentation files
  - `sveltekit-app/` is primary webapp

- [x] **Stroke order animation**
  - Integrated Hanzi Writer library
  - Animation seamlessly integrated next to character in title
  - Fast, looping animation with proper timing

- [x] Analyze current dictionary structure and webapp usage
- [x] Document optimization strategy and decisions
- [x] Create implementation roadmap