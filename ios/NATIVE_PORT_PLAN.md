# Kiokun iOS Native Port

This folder contains the native SwiftUI port of the SvelteKit app. The target architecture is offline-first:

- Immutable dictionary/search data lives in a local read-only store.
- User-owned data lives in a separate writable SQLite store.
- Writes are immediate locally and enqueue replication work for the Cloudflare backend.
- Sync is resumable, idempotent, and based on client-generated IDs plus timestamps.

## Web Parity Checklist

### Dictionary
- [x] Native dictionary/search shell
- [x] Local SQLite FTS search API matching `/api/search`
- [x] Local dictionary lookup API
- [x] Raw-deflate dictionary payload reader
- [x] Offline SQLite bundle builder
- [x] Offline SQLite bundle builder disk-space preflight with optional no-VACUUM build mode for constrained machines
- [x] Entry detail screen with multilingual sections
- [x] Redirect-ready data model
- [x] Static JSON asset compression in SQLite
- [x] Offline duojp sentence-game importer path
- [x] Offline exact kana reading lookup matching `/api/lookup-reading`
- [x] Offline component-gloss/component-use enrichment for character equations, detailed component cards, character-page Component Uses buckets, and similar-character chips
- [x] Frequency rank badges in native appears-in preview rows
- [x] Embedded Japanese/Korean sentence examples from local dictionary records
- [x] Offline Chinese/Korean static sentence-shard lookup on dictionary detail pages
- [x] Offline Japanese pitch accent shard lookup and native visualization
- [x] Offline Japanese/Chinese reel occurrence sections on dictionary detail pages
- [x] Offline phonetic-series lookup backed by `component_uses.json`, `component_glosses.json`, and local dictionary pinyin enrichment
- [x] Native AVSpeech pronunciation controls for dictionary word sections, embedded example sentences, study review cards, and study card lists
- [x] Offline local artifact-mentions section on dictionary detail pages with artifact detail navigation
- [x] Offline Japanese deinflection resolver for native search/detail using the web rule table, romaji/katakana normalization, POS validation, and reading-to-kanji fallback
- [x] Native Japanese/Korean deinflection alternatives in search/detail UI to match the web alternate-match flow
- [x] Offline Korean deinflection resolver for native search/detail using the web rule list, Hangul contractions, irregular reconstruction, and particle stripping
- [x] Native Japanese verb conjugation table generator and detail-page disclosure UI matching the web conjugation forms/categories
- [x] Rich native Chinese/Japanese/Korean entry renderers backed by full local payload metadata: Chinese item readings/stats, Japanese headwords/senses/labels/examples/conjugations, Korean definitions/examples, and deeper character component cards with offline makemeahanzi stroke previews, facts/component-use buckets/variants/historical-evolution strip/history/comments
- [x] Native variant-aware Character Forms overview for single-character entries, merging Chinese traditional/simplified/Hong Kong variants with Japanese and Korean forms from the offline record
- [x] Offline historical-form stroke previews from bundled makemeahanzi vector payloads, with remote historical images only as a fallback
- [x] Import all `output_dictionary/*.json.deflate` records into native bundle DB
- [ ] Close remaining exact web renderer parity details for entry layout/grouping and any media assets not yet shipped offline
- [ ] Port remaining audio surfaces and deep character-page metadata fully

### User Data
- [x] Local notes model matching `/api/notes/[character]`
- [x] Local study cards and SM-2 review logic matching `/api/study`
- [x] Local custom words model
- [x] Local artifacts/images/sentences model
- [x] Sync queue schema and Cloudflare client boundary
- [x] Server-side mobile sync endpoints for batch pull/push
- [x] Native batch push, pull, conflict-aware apply, and sync watermark
- [x] Artifact sentence/image sync contract with R2 image upload payloads
- [x] Native Markdown note editor/preview with offline note image storage and Cloudflare R2 marker rewrite on sync
- [x] Keychain-backed Cloudflare session cookie storage, legacy UserDefaults migration, and authenticated Cookie header injection in the native sync client
- [x] Add first-class native Better Auth sign-in bridge through ASWebAuthenticationSession, a mobile auth completion endpoint, custom URL callback, and Keychain persistence
- [ ] Add conflict tests against real Cloudflare D1 state

### App Surfaces
- [x] Search tab
- [x] Dictionary detail flow
- [x] Notes list
- [x] Study/review/stats
- [x] Custom words
- [x] Artifacts and artifact sentences
- [x] Learning/resources shell
- [x] Settings/sync diagnostics, Cloudflare base URL, and Save/Paste/Clear credential controls
- [x] Native artifact image gallery backed by local file storage and Cloudflare image sync payloads
- [x] Offline sentence game shell
- [x] Native sentence game drag/drop zones, answer reordering hooks, and TTS listen/reset controls
- [x] Native sentence game long-press dictionary sheet and Copy Ask prompt export
- [x] Compact native sentence game dictionary lookup sheet with offline language-preferred summaries, pronunciation control, deinflection labels, proper-noun sense ordering, and full-entry navigation
- [x] Native sentence game Simplified/Traditional Chinese display toggle
- [x] Native Sentence Reader matching `/sentence` for Japanese/Chinese/Korean input, offline greedy tokenization, local dictionary lookup sheets, and detail navigation
- [x] Native homophones browser for Japanese/Chinese word and character modes plus Korean Hanja groups
- [x] Native frequency browser for bundled Japanese/Chinese/Korean frequency tabs
- [x] Native Reels browser and offline Japanese/Chinese transcript detail from bundled static assets
- [x] Native Reels-to-dictionary navigation with offline appears-in-reels context
- [x] Native Phonetics browser matching `/phonetic/[char]` grouped sound-component series
- [x] Native handwriting input sheet with offline stroke capture and Cloudflare `/api/handwriting` recognition client
- [x] Native Settings Google sign-in entry point for Better Auth cookie acquisition, retaining manual credential fallback
- [x] Full web game parity (complete production pack)

### Testing
- [x] Simulator-buildable SwiftUI project
- [x] Offline bundle verifier for compressed dictionary/static/game assets
- [x] Native simulator smoke script (`ios/tools/smoke_native_ios.sh`)
- [x] XCTest target for offline fixture lookup/search/reading lookup/game loading, complete bundled game-pack coverage, custom words, dictionary renderer enrichment, rich language renderer metadata and Japanese label loading, embedded examples, static sentence shards, pitch accent, web-rule Japanese deinflection with romaji/POS/reading-fallback/alternate-match coverage, Korean deinflection, Japanese conjugation tables, handwriting recognition contract parsing, homophones, frequency, phonetic series, native speech locale mapping, reels/transcripts, reel occurrences, local artifact mentions, SRS, sync merge behavior, HTTP-level Cloudflare push/pull request coverage, and Keychain credential round-trip/delete behavior
- [x] XCTest coverage for recoverable sync push failures, queued retry attempt/error persistence, and Cloudflare credential/server recovery messaging
- [x] XCTest coverage for artifact image local persistence, thumbnail selection, and compressed Cloudflare upload payload generation
- [x] XCTest coverage for note image local persistence, Markdown marker parsing, and compressed Cloudflare upload payload generation
- [x] XCTest coverage for native sentence game lookup summaries backed by local offline glosses and web-compatible proper-noun demotion
- [x] XCTest coverage for native Better Auth bridge request/callback contracts
- [x] XCUITest target for core offline UI flows: search/detail, rich dictionary renderer metadata parity, native handwriting candidate input, custom words, study review speech controls, artifacts/sentences/images, bundled sentence game, game tile/listen/copy/script controls, library homophones/frequency/phonetics browsing, reel transcript browsing, transcript-word occurrence navigation, Settings credential/sign-in controls, and sync recovery messaging
- [x] UI test coverage for rich dictionary renderer parity across Chinese/Japanese/Korean entries, embedded examples, character equations/component cards/component-use buckets/facts/historical evolution/offline historical stroke previews/media references, and similar-character sections
- [x] UI test coverage for the native Character Forms overview on rich single-character dictionary entries
- [x] UI test coverage for sync recovery messaging with a queued offline mutation, missing Cloudflare base URL, retry attempt persistence, and pending-task error disclosure
- [x] UI test coverage for the system PhotoPicker artifact-image flow using a simulator-seeded photo, local gallery refresh, and saved image preview assertion
- [x] UI test coverage for native auth Settings flow using UI-test Better Auth cookie injection, Keychain persistence status, and credential clear behavior
- [x] UI test coverage for the native Sentence Reader flow from Library launch through language selection, keyboard entry, offline token lookup, and full-entry navigation affordance
- [x] XCTest coverage for native Sentence Reader greedy local dictionary tokenization
- [x] Repeatable offline bundle benchmark harness in native smoke for size, compression, dictionary inflate/decode latency, FTS latency, static asset inflate latency, and game-pack coverage
- [ ] Live Google/Better Auth ASWebAuthenticationSession E2E against a staging Cloudflare backend
- [ ] Offline/online sync E2E against a staging Cloudflare backend
- [x] Full production dictionary import performance and size benchmark run after generating the complete bundle

## Local Data Stores

The native app is designed around two logical SQLite stores, even when initially hosted in one physical database for development:

- `dictionary_entries`: immutable keyed JSON records plus dictionary version metadata.
- `dictionary_search`: FTS5 index equivalent to the web `dictionary_search` table.
- User tables: `notes`, `study_cards`, `custom_words`, `artifacts`, `artifact_images`, `artifact_sentences`, `sentence_words`.
- Replication tables: `sync_queue`, sync timestamps, and per-row `dirty/deleted/syncedAt` metadata.

Cloudflare sync configuration uses `UserDefaults` only for the non-secret base URL. The Better Auth session cookie is stored as a generic password in Keychain under the native app service, is migrated once from the legacy `cloudflareSessionCookie` default if present, and is attached to sync requests as the `Cookie` header. The native app has a Better Auth sign-in bridge through `ASWebAuthenticationSession`, with manual Save/Paste/Clear credential controls kept as a recovery path; live Google sign-in still needs staging E2E validation.

The current bundled diagnostic production `KiokunDictionary.sqlite` was generated from:

- `output_dictionary/**/*.json.deflate`
- `output_search_index.csv`
- `sveltekit-app/static` static JSON packs
- duojp `data-unified` game manifest, distractors, and chunks

The installed bundle currently verifies at 873.4 MiB with 1,485,736 dictionary entries, 834,036 search rows, 1,036 static assets, and the complete duojp game pack: 217/217 chunks with 216,039 manifest rows. It can ship with the app and be atomically replaced by app updates or a future Wi-Fi dictionary updater.

## Offline Bundle Build

The app looks for `KiokunDictionary.sqlite` in the bundle on first launch and copies it into Application Support as the writable app database. The production dictionary records stay compressed as raw-deflate blobs and are inflated only for the selected entry.

The bundle builder writes to a temporary SQLite file next to the target and atomically replaces the target only after a successful commit, `ANALYZE`, and `VACUUM`. A failed production build should leave the previously working app bundle intact.

Build the current simulator-test bundle. It keeps dictionary/search rows small, but includes the complete compressed duojp sentence-game pack:

```bash
python3 ios/tools/build_offline_dictionary.py \
  --dictionary-dir output_dictionary \
  --search-csv output_search_index.csv \
  --static-dir sveltekit-app/static \
  --static-glob 'game_data/*.json' \
  --static-glob 'homophones_*.json' \
  --static-glob 'frequency_list.json' \
  --static-glob 'japanese_labels.json' \
  --static-glob 'pitch/*.json' \
  --static-glob 'zh_sentences/0.json' \
  --static-glob 'zh_sentences/idx/*.json' \
  --static-glob 'kr_sentences/0.json' \
  --static-glob 'kr_sentences/idx/*.json' \
  --static-glob 'video_data.json' \
  --static-glob 'chinese_video_data.json' \
  --static-glob 'reel_transcripts*.json' \
  --include-game-data \
  --output /tmp/KiokunDictionary-fixture.sqlite \
  --version fixture \
  --limit-dictionary 25 \
  --limit-search 100
```

Build the production bundle when the machine has enough free disk for the generated SQLite file and temporary SQLite work:

```bash
python3 ios/tools/build_offline_dictionary.py \
  --dictionary-dir output_dictionary \
  --search-csv output_search_index.csv \
  --static-dir sveltekit-app/static \
  --include-game-data \
  --output ios/Kiokun/Resources/KiokunDictionary.sqlite \
  --version "$(date +%Y%m%d)" \
  --write-source-manifest /tmp/kiokun-source-manifest.json \
  --progress-interval 50000
```

For a disk-space-only preflight using a saved source manifest:

```bash
python3 ios/tools/build_offline_dictionary.py \
  --dictionary-dir output_dictionary \
  --search-csv output_search_index.csv \
  --static-dir sveltekit-app/static \
  --include-game-data \
  --output ios/Kiokun/Resources/KiokunDictionary.sqlite \
  --version "$(date +%Y%m%d)" \
  --source-manifest /tmp/kiokun-source-manifest.json \
  --preflight-only
```

The current repository artifacts are large (`output_dictionary` is 6.3 GiB in this workspace), and the production game import downloads 217 JSON chunks from the duojp GitHub data source. The builder now fails fast when the target volume does not have enough room for the output SQLite, the existing bundle, and SQLite temporary/VACUUM work. Use `--skip-vacuum` only when you need a lower-temp-space diagnostic build and can tolerate a larger SQLite file; the installed 873.4 MiB bundle is a diagnostic production build created with that tradeoff. A repacked App Store build should be regenerated with normal `VACUUM` on a larger build volume.

## Native Smoke Test

Run the native smoke test from the repo root:

```bash
ios/tools/smoke_native_ios.sh
```

It verifies the bundled compressed SQLite pack, benchmarks the bundle's size/compression/search/decompression characteristics, typechecks the SwiftUI app, runs the XCTest and XCUITest suites on the iPhone 17 simulator, installs and launches the app, and verifies the copied simulator database. The latest production smoke passed with 14/14 UI tests and 29/29 unit tests, then verified the launched simulator database at 1,485,736 dictionary entries, 834,036 search rows, and 1,036 static assets. Override `DEVICE_ID`, `DESTINATION`, or `DERIVED_DATA` if the default simulator is unavailable.

After adding URLSession-injected Cloudflare client coverage, the native XCTest suite passes 30/30 tests, including a local protocol-backed sync round trip that verifies `/api/sync/push` request encoding, Better Auth Cookie header injection, server acknowledgement handling, queue cleanup, `/api/sync/pull`, remote row application, and sync watermark persistence. Live Google/Better Auth and Cloudflare D1/R2 staging E2E remain separate validation gates because they require real backend credentials and deployment state.

After adding character Component Uses renderer parity, `testDictionaryDetailRendersRichOfflineRecordMetadata` passes on the iPhone 17 simulator and verifies the visible Component Uses heading, role label, verified count, and linked character chips. The full native XCTest suite also passes 30/30 after the component-use parser/model changes.

After adding detailed character component cards, the same rich renderer UI flow verifies the Components section, equation, phonetic component label, pinyin, and hint text. Focused decode tests verify component role labels, pinyin, and hints, and the full native XCTest suite still passes 30/30.

After replacing the text-only historical-form disclosure with the native Historical Evolution strip, the rich renderer UI flow verifies the visible section, historical type/era labels, and the regular modern fallback card. Historical image URLs still use online `AsyncImage` when reachable; the native strip always renders offline fallback glyphs and labels from the local payload.

After adding offline makemeahanzi stroke previews to native component cards, focused decode tests verify `data.strokes`/`matches` parsing and the rich renderer UI flow verifies the `componentStrokePreview` node on the iPhone 17 simulator.

After adding the native Sentence Reader, focused unit coverage verifies greedy tokenization against local dictionary rows and the focused UI flow verifies Library launch, Chinese input, keyboard dismissal, token tap, local lookup sheet rendering, and full-entry navigation access on the iPhone 17 simulator.
