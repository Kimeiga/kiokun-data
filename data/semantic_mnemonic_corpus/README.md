# Semantic mnemonic corpus

This directory is the canonical, Git-friendly representation of Kiokun's
24,037 semantic mnemonic cards.

The website does not download this corpus. During dictionary publication, the
Rust builder reads the compact `runtime/` shards and embeds each relevant card
in that character's existing deflate-compressed dictionary entry.

## Layout

- `manifest.json` binds every shard by range, count, byte count, and SHA-256.
- `source/*.json` preserves the complete editorial cards, including review and
  provenance metadata.
- `runtime/*.json` is a deterministic projection containing only fields
  accepted by the Rust dictionary payload.

No tracked file in this layout approaches GitHub's 50 MiB warning threshold.
The largest source shard is approximately 2.5 MiB.

## Verify

```sh
python3 scripts/manage_semantic_mnemonic_corpus.py verify
```

The verifier reconstructs the complete source artifact in memory, validates
all shard ranges and hashes, and proves that the runtime cards are the exact
allowed-field projection of the source cards.

## Edit with legacy corpus tools

Existing editorial tools can still use their historical monolithic path:

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

`pack` refuses to replace the canonical shards unless that file was
materialized from the current manifest. `dematerialize` refuses to remove it
if it contains unpacked edits.

The sharded source is authoritative. The monolith is only a temporary editing
view, and the runtime shards are generated derivatives.
