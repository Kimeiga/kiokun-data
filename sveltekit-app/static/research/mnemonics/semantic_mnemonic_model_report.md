# Kiokun Semantic Mnemonic Model Bakeoff

Generated: 2026-07-01

## Task

Generate semantic-only kanji/hanzi mnemonic card data:

- no pronunciation hooks
- one sentence mnemonic
- every component appears as `character gloss`
- final character appears as `character gloss`
- use stable Kiokun glosses, with targeted overrides for bad source glosses

The exact hand-written example answers for `連` and `憂` were not included in the bakeoff prompt, because that would only test copying.

## Recommendation

Use `gemini-3.5-flash` for this pipeline.

It tied the top semantic score, returned structured JSON reliably after raising the output cap, and stayed close to the desired concise Kiokun style. `claude-haiku-4-5-20251001` was fastest and also strong, but its `憂` sample introduced non-component imagery more readily. Pro/Opus-tier models did not produce meaningfully better semantic mnemonics on this task.

## Ranked Results

| Rank | Model | Score | Time |
|---:|---|---:|---:|
| 1 | Claude Haiku 4.5 | 8.758 | 1.9s |
| 2 | Gemini 3.5 Flash | 8.758 | 4.44s |
| 3 | Claude Sonnet 5 | 8.758 | 5.13s |
| 4 | Gemini 2.5 Flash | 8.758 | 5.73s |
| 5 | Gemini 3 Flash Preview | 8.758 | 8.29s |
| 6 | Gemini 3.1 Pro Preview | 8.705 | 6.78s |
| 7 | Gemini 3.1 Flash Lite | 8.582 | 1.16s |
| 8 | Claude Opus 4.8 | 8.530 | 4.61s |
| 9 | Gemini 2.5 Pro | 8.270 | 6.10s |
| 10 | Gemini 2.5 Flash Lite | 7.433 | 1.03s |

## Unavailable Models

- OpenAI models were skipped after `gpt-5.4-nano` returned `insufficient_quota` for the local API key.
- Cloudflare Workers AI was skipped because the local account/token returned HTTP 403 for model listing.
- Gemma 4 31B and 26B were tested, but both echoed the task as prose instead of returning valid JSON and were much slower than the best hosted models.

## Generated Data

- `semantic_mnemonics_1000.json`: 1000 generated semantic mnemonic cards.
- `semantic_mnemonic_bakeoff.json`: raw model bakeoff outputs and validation.
- `semantic_mnemonic_card_inputs.json`: cached prepared component inputs.
- `semantic_mnemonic_progress.json`: generation checkpoint and audit trail.

Final QA:

- 1000 cards generated
- 0 validation failures
- 0 pronunciation-hook hits
- 0 `characterless component`, `Kangxi`, `Bldg.`, `Vol.`, or `component in Chinese` placeholder hits
- 19 targeted gloss overrides recorded in the output artifact
