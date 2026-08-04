# Language-specific pronunciation mnemonics

## Model

Kiokun keeps two learning layers independent:

1. The semantic mnemonic is language-neutral and remains the stable visual
   backbone.
2. A pronunciation card supplies one Mandarin or Japanese sound layer. The UI
   places that layer directly after the semantic scene, but it never merges
   Chinese and Japanese prose.

Language preferences are authoritative. Chinese-only mode renders Mandarin;
Japanese-only mode renders Japanese; enabling both produces two explicitly
labeled groups. Japanese cards label `On` and `Kun`, while Mandarin displays
tone-marked pinyin. Existing speech synthesis reads the complete anchor word,
not isolated romanization.

## What counts as a core reading

A core reading must occur in useful common modern vocabulary, express a common
meaning or grammatical use, add information that cannot be inferred from
another displayed reading, and have an exact verified anchor word. Rare,
archaic, literary, and name-only dictionary readings are not promoted merely
because they exist. There is no fixed one-reading limit.

That policy gives Mandarin `行` both `xíng` (行动) and `háng` (银行). Japanese
`行` has `コウ`, `ギョウ`, `いく`, and `おこなう`. Japanese `生` deliberately
teaches five practical readings rather than copying its much longer raw
KANJIDIC list. `図` includes `ズ`, `ト`, and the complete kun lexeme `はかる`;
`食` stores `食べる（たべる）`, not the bare fragment `た.べる`.

## Deterministic top-100 selection

Chinese selection uses `statistics.movieCharRank` in
`data/chinese_dictionary_char_2025-06-25.jsonl`, the repository's direct Hanzi
usage-frequency field. Ranks 1 through 100 are selected. Rows sharing a rank
are grouped as one underlying measured entry; a source-linked modern
simplified form is the projection identity, followed by a non-variant record
and Unicode order as deterministic fallbacks. Linked simplified and
traditional forms remain in `variants`, so `发` covers `發` and `髮` without
inflating the target count.

Japanese selection uses KANJIDIC's `characters[].misc.frequency` field in
`data/kanjidic2-en-3.6.1.json`. The lowest 100 usage ranks win, with Unicode
code-point order resolving ties. JLPT level is not used.

Run `python3 scripts/select_pronunciation_targets.py --check` to independently
rederive and byte-compare both tracked manifests. Chinese `行` and Japanese
`図`/`食` are reviewed regression extensions outside the manifests; they cover
required difficult behaviors without manipulating either frequency list.

## Mandarin authoring

Learner-facing readings use tone marks. `normalized_reading` uses a searchable
ASCII syllable plus tone number (`xíng` → `xing2`, neutral `de` → `de5`). The
sound-cue vocabulary is stable:

- first tone: `high_level`;
- second tone: `rising`;
- third tone: `dip_then_rise`;
- fourth tone: `falling`;
- neutral tone: `light_neutral`.

Canonical dictionary tones remain stored even when connected speech changes.
The `一` and `不` overlays explain common tone sandhi without replacing `yī`
or `bù`. Authentic sound components are used only where the repository's
structured component data marks them as sound-bearing. Otherwise a concise
shared-scene cue or, most often, a strong common word anchor is preferred to a
strained English pun.

Every Mandarin core reading is checked against the repository character
reading data. Its anchor must be an exact Chinese dictionary headword/reading
pair and carries `movieWordRank` when available.

## Japanese authoring

`reading_type` is always explicit: `on` or `kun`. On readings keep their
katakana display form and use common compounds. Kun readings keep both the
KANJIDIC source notation (`た.べる`) and the complete learner-facing lexeme
(`たべる` with anchor `食べる（たべる）`). The anchor separately records the
character-bearing stem (`た`) and complete word reading.

Validation checks the classified reading against KANJIDIC and the complete
word/reading pair against JMdict. Documented phonological alternations are not
silently treated as new character readings: for example `出発（しゅっぱつ）`
records the surface `しゅっ`/`ぱつ` and explains the sokuon behavior. Pitch
accent is intentionally absent because the corpus does not fabricate
word-level pitch data.

## Mnemonic strategies

- `phonetic_component`: a source-backed sound-bearing component adjacent to
  the semantic equation.
- `integrated_sound_cue`: one concise cue reuses the existing semantic scene.
- `word_anchor`: an attached reading card uses a common exact word when scene
  integration would be forced.

All cards include editorial justification, usage-specific gloss, confidence,
review status, sources, and frequency/usefulness evidence. Secondary readings,
when added later, remain behind progressive disclosure in the UI.

## Authoring workflow

Use the commands documented in the corpus README. The canonical workflow is
`get` → edit one record → `upsert` → `verify` → `pack`. The shared API reads and
writes stable buckets directly. It never materializes the former 59 MB semantic
mnemonic monolith. Packing is deterministic and transactional.

Before expanding beyond 100, update the relevant target manifest rule or add a
clearly labeled reviewed extension, author anchors from structured repository
data, run the malformed-fixture and difficult-reading regression tests, and
repeat the deterministic manual audit. New language projections must not alter
or duplicate the semantic card.
