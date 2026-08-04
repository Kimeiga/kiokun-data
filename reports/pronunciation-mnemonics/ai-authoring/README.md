# AI pronunciation-mnemonic authoring pass

This directory records the model-authored editorial pass requested after the
initial deterministic bootstrap proved too formulaic. The proposal files are
not runtime input. `scripts/assemble_ai_pronunciation_mnemonics.py` validates
their complete coverage and produces the tracked
`data/pronunciation_mnemonic_authoring/mnemonics.jsonl` source only after a
different agent has reviewed each partition. It lives beside the runtime corpus
so the corpus's transactional directory exchange cannot remove its own input.

## Reproducible partitions

- Chinese target ranks 1–50
- Chinese target ranks 51–100 plus the reviewed `行` extension
- Japanese target ranks 1–50
- Japanese target ranks 51–100 plus the reviewed `図` and `食` extensions

The input commit is `62ef8ac3483a1344a6c9259e26cf988cf0fe4380`. Authors read
the canonical pronunciation cards, target manifests, semantic mnemonic cards,
and the structured evidence already bound to each reading. Reading identities,
anchors, glosses, and evidence are immutable during this pass.

## Author prompt

For every assigned card, return one JSONL proposal containing language,
character, target rank, optional card-level `memory_bridge`, and one proposal
for every existing reading. Author only `strategy`, `overlay`, and
`memory_bridge`.

Each overlay must work as a genuine retrieval cue tied to the semantic scene or
as a vivid exact-word anchor—not procedural text such as “attach this reading”
or “the compound locks it in.” An `integrated_sound_cue` needs a phonetically
defensible cue that lets a learner retrieve the sound. When that would be
strained, use `word_anchor`; a strong common word is better than a bad English
pun. Keep Mandarin tone motion consistent. Keep Japanese On and Kun distinct,
preserve complete Kun lexemes, and never imply that every reading shares the
character headline's lexical meaning. Use phonetic-component strategy only
where the existing source-backed metadata supports it. Avoid repeated formulae,
invented etymology, obscure anchors, and long stories with unrelated objects.

For a multi-reading card, add a concise `memory_bridge` when one coherent scene
can make the contrasts retrievable. A bridge must do more than list the anchor
words.

## Independent review prompt

A different agent compares each proposal with the immutable canonical reading
and anchor data, the semantic scene, and the original authoring-quality rules.
It checks linguistic accuracy, natural English, memorability, sound-cue
closeness, tone behavior, sandhi, On/Kun and okurigana handling, variant
handling, semantic alignment, boilerplate, and over-promotion. It revises the
proposal in place, preserves identities, then writes a structured review under
`reviews/` with counts, issue categories, representative before/after changes,
and a final result.

## Mechanical gate

The assembler rejects missing/extra cards, changed target ranks or reading
identities, duplicate readings, empty prose, unsupported phonetic-component
claims, duplicate overlays, and known bootstrap boilerplate. The ordinary
corpus verifier then independently rechecks the finished cards against Chinese
dictionary data, KANJIDIC, JMdict, JPDB, bucket placement, packed projections,
and the Rust runtime schema.
