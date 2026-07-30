# Korean example translations

KRDICT supplies English definitions, but its example payloads are Korean-only.
Kiokun now treats each example as a sense occurrence and embeds an English
translation into the same dictionary shard as the Korean definition.

## Corpus

- 57,597 loaded Korean word entries
- 582,216 exact example occurrences
- 7,278 model requests at 80 examples per request
- Stable occurrence IDs use the loaded word ID plus definition/example indexes
- The source Korean text is stored with every translation and must match during
  the Rust build, so a changed KRDICT row cannot silently receive a stale
  translation

Exact occurrences are intentionally not deduplicated by Korean text. A short
example such as an interjection or sound effect can require the headword and
sense definition to translate correctly.

## Model bakeoff

The stress set contained 17 long formal sentences, proverbs, idioms, quoted
Korean grammar, very short fragments, numbers, and sound effects. Candidates
were hidden behind randomized labels and scored by two successful blind model
judges. A third judge response was invalid JSON and was excluded.

| Candidate | Mean score | Wins | Severe errors |
| --- | ---: | ---: | ---: |
| GPT-5.6 Sol | 4.794 | 12 | 0 |
| GPT-5.5 | 4.794 | 4 | 0 |
| Claude Sonnet 5 | 4.647 | 8 | 0 |
| Gemini 3.6 Flash (default thinking) | 4.588 | 5 | 0 |
| GPT-5.6 Terra | 4.559 | 1 | 0 |
| GPT-5.6 Luna | 4.500 | 3 | 0 |
| Gemini 3.6 Flash (minimal thinking) | 4.500 | 1 | 0 |

M2M100 was rejected before blind scoring because it produced severe lexical
errors on the stress set, including translating “double-edged sword” as
“two-day sword,” treating personal names as common nouns, and confusing Korean
causative grammar with civil law. Gemini 3.5 Flash-Lite was also excluded after
inventing a person in a grammar example.

GPT-5.6 Sol was the quality winner. The configured OpenAI account permits only
900,000 Sol input tokens in the batch queue, however, which would require 52
serial provider jobs for this corpus. The production bulk pass therefore uses
the zero-severe-error Gemini 3.6 Flash configuration with minimal thinking and
durable per-request checkpoints. The Sol path remains supported for targeted
review and future regeneration.

## Reproduction

```sh
python3 scripts/translate_korean_examples.py prepare
python3 scripts/translate_korean_examples.py translate-gemini
python3 scripts/translate_korean_examples.py process-gemini
python3 scripts/translate_korean_examples.py verify
```

`translate-gemini` is resumable and can be restarted after a provider limit or
network interruption. For a large regeneration, `run-gemini-batch` can run
beside it as an optional queue-based accelerator; both commands write the same
per-request checkpoints, and the processing step accepts only complete
80-example responses.

The committed output is split under
`data/krdict-example-translations-en/`. Provider uploads, job IDs, source
exports, and checkpoint files remain in the gitignored
`data/korean_example_translation_work/` directory.

The Rust dictionary build loads the committed parts, validates occurrence IDs
and Korean source text, and assigns `translation` on the existing
`KoreanExample` object. No runtime translation endpoint or new word-page UI is
required.
