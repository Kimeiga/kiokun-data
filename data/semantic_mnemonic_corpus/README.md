# Semantic mnemonic corpus

This directory is the canonical, Git-friendly representation of Kiokun's
24,037 complete editorial mnemonic cards.

The website does not download this corpus. During dictionary publication, the
Rust builder reads these canonical card records directly and embeds the
runtime fields in each character's existing deflate-compressed dictionary
entry.

## Layout

- `manifest.json` binds every canonical file by count, byte count, and
  SHA-256.
- `cards/00.jsonl` through `cards/ff.jsonl` contain one complete editorial
  card per line.
- `order.jsonl` preserves the historical monolith's card order independently
  of bucket placement.
- `metadata.json` preserves the historical artifact's top-level release and
  provenance metadata.

Each card is assigned by `kiokun_simple_hash_low_byte_v1`, the same stable
`00`–`ff` hash used for published dictionary subdirectories. Existing cards
never move when another card is inserted or removed. A normal card edit
changes one readable JSONL line in one small bucket; the largest current
bucket is approximately 260 KiB.

The compact runtime representation is a deterministic projection verified by
the manifest, but it is not duplicated in Git.

## Verify

```sh
python3 scripts/manage_semantic_mnemonic_corpus.py verify
```

The verifier checks:

- all file hashes and byte counts;
- canonical one-record-per-line JSONL formatting;
- stable bucket placement and uniqueness;
- exact agreement among the order, metadata, and card files;
- byte-exact reconstruction of the former monolith; and
- the compact runtime-field projection consumed by the Rust builder.

## Edit with legacy corpus tools

Existing editorial tools can continue using their historical monolithic path:

```sh
python3 scripts/manage_semantic_mnemonic_corpus.py materialize
# Run the editor or repair tool.
python3 scripts/manage_semantic_mnemonic_corpus.py pack
python3 scripts/manage_semantic_mnemonic_corpus.py dematerialize
```

`materialize` writes an ignored compatibility file at:

```text
sveltekit-app/static/research/mnemonics/semantic_mnemonics_all_best_available.json
```

`pack` refuses to replace the canonical corpus unless that file was
materialized from the current manifest. `dematerialize` refuses to remove it
if it contains unpacked edits.

The bucketed JSONL cards are authoritative. The monolith is only a temporary
editing view, and the deployed per-character mnemonic is a typed projection
created by the dictionary builder.
