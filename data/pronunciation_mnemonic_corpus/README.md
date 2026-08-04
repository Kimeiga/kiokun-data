# Pronunciation mnemonic corpus

This is the canonical bucket-native source for Kiokun's language-specific
pronunciation layers. It is deliberately separate from the language-neutral
semantic mnemonic corpus. The dictionary builder composes both at publication
time, so a shared semantic scene remains stable while Mandarin and Japanese
sound cues can be maintained and reviewed independently.

## Layout

- `targets/zh.json` and `targets/ja.json` are the reproducible top-100
  selection manifests.
- `cards/00.jsonl` through `cards/ff.jsonl` are the complete editorial records.
- `packed/00.json` through `packed/ff.json` are deterministic runtime
  projections consumed by Rust.
- `manifest.json` binds every target, source bucket, and packed bucket by
  SHA-256, byte count, record count, and stable bucket identity.

The key is `language:character` (for example `zh:行` and `ja:行`). It uses the
same `kiokun_simple_hash_low_byte_v1` low-byte hash as the semantic corpus and
published dictionary. Shared characters therefore get separate language
records without duplicating the semantic mnemonic.

## Verify and inspect

```sh
python3 scripts/select_pronunciation_targets.py --check
python3 scripts/assemble_ai_pronunciation_mnemonics.py --check
python3 scripts/bootstrap_pronunciation_mnemonics.py
git diff --exit-code -- data/pronunciation_mnemonic_corpus
python3 scripts/manage_pronunciation_mnemonic_corpus.py verify
python3 scripts/manage_pronunciation_mnemonic_corpus.py stats --json
python3 scripts/manage_pronunciation_mnemonic_corpus.py get --language zh --character 行
python3 scripts/manage_pronunciation_mnemonic_corpus.py project --character 行
```

The AI author and independent-review records live in
`reports/pronunciation-mnemonics/ai-authoring/`. The assembler binds each
review to the exact proposal hash and fixed input commit, then deterministically
produces `data/pronunciation_mnemonic_authoring/mnemonics.jsonl`. The bootstrap
requires exact authored coverage and has no prose-template fallback.

The corpus verifier checks exact target and reviewed-extension coverage,
readings, anchor words, variants, bucket placements, source hashes, packed
projections, Mandarin tones, source-backed sound components, Chinese word
ranks, KANJIDIC on/kun classifications, complete kun lexemes, JMdict pairs,
Japanese character-reading surfaces, and JPDB ranks.

## Edit, delete, and pack

Export a card with `get`, revise the JSON, then use the bucket-native API:

```sh
python3 scripts/manage_pronunciation_mnemonic_corpus.py upsert /tmp/zh-xing.json
python3 scripts/manage_pronunciation_mnemonic_corpus.py delete --language zh --character 行
python3 scripts/manage_pronunciation_mnemonic_corpus.py pack
```

`upsert`, `delete`, and `pack` build a complete temporary corpus, validate it,
and use an atomic directory exchange only after success. A failed validation
cannot leave mixed source and runtime generations. Updates are bound to the
manifest the writer loaded, reject concurrent changes, and roll back when deep
post-install verification fails. Do not hand-edit packed files and do not build
a monolithic compatibility artifact.

## Audit

```sh
python3 scripts/manage_pronunciation_mnemonic_corpus.py audit \
  --seed 20260804 \
  --sample-per-language 30 \
  --output reports/pronunciation-mnemonics/manual-audit-2026-08-04.json
```

The deterministic audit includes 30 random records per language plus every
multi-reading, phonetic-component, variant, irregular-anchor, and documented
phonological-alternation record.
