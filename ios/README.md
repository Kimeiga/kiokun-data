# Kiokun Native iOS

This directory contains the native SwiftUI iOS app source.

The app uses a generated offline SQLite bundle at:

```text
ios/Kiokun/Resources/KiokunDictionary.sqlite
```

That file is intentionally not committed. It is about 873 MiB in the current workspace
and is generated from the dictionary/static/game data.

## Generate the offline bundle

From the repository root, generate the production bundle before opening, running, or
archiving the native app:

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

If disk space is tight, run a preflight first:

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

The Xcode project includes `KiokunDictionary.sqlite` as a bundled resource, so a full
native build expects this generated file to exist locally.

## Verify

Run the native smoke test from the repository root:

```bash
ios/tools/smoke_native_ios.sh
```
