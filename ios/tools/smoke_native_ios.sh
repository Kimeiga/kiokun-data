#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROJECT="$ROOT_DIR/ios/Kiokun.xcodeproj"
SCHEME="${SCHEME:-Kiokun}"
DESTINATION="${DESTINATION:-platform=iOS Simulator,name=iPhone 17,OS=26.5}"
DERIVED_DATA="${DERIVED_DATA:-/tmp/kiokun-ios-derived}"
BUNDLE_ID="${BUNDLE_ID:-dev.kiokun.native}"
DEVICE_ID="${DEVICE_ID:-A29B10A9-77A8-4E7D-8655-A0DA328B7160}"
BUNDLE_DB="$ROOT_DIR/ios/Kiokun/Resources/KiokunDictionary.sqlite"
PHOTO_FIXTURE="${PHOTO_FIXTURE:-/tmp/kiokun-ui-photo.png}"

python3 "$ROOT_DIR/ios/tools/verify_offline_bundle.py" "$BUNDLE_DB"
python3 "$ROOT_DIR/ios/tools/benchmark_offline_bundle.py" "$BUNDLE_DB"

if [[ ! -f "$PHOTO_FIXTURE" ]]; then
  /usr/bin/base64 -D > "$PHOTO_FIXTURE" <<'PHOTO'
iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAjklEQVR4nO3XwQmAIBAAwXj/jd2lA0stQkwg8kEg4Mt63tM7jD73A3gLMAuYBcwC5gGzgFnALGAXMAuYBcwC5gGzgFnALGAXMAuYBcwC5gGzgFnALGAXMAuYBcwC5gGzgFnALGAXMAuYBcwC5gGzgFnALGAXMAuYBcwC5gGzgFnALGAXMAv4xwAhNQMb8CzUDAAAAABJRU5ErkJggg==
PHOTO
fi
xcrun simctl boot "$DEVICE_ID" 2>/dev/null || true
xcrun simctl bootstatus "$DEVICE_ID" -b >/dev/null
xcrun simctl addmedia "$DEVICE_ID" "$PHOTO_FIXTURE"

xcrun --sdk iphonesimulator swiftc \
  -parse-as-library \
  -typecheck "$ROOT_DIR/ios/Kiokun/KiokunApp.swift" \
  -target arm64-apple-ios17.0-simulator \
  -lsqlite3 \
  -lz

xcodebuild \
  -project "$PROJECT" \
  -scheme "$SCHEME" \
  -destination "$DESTINATION" \
  -derivedDataPath "$DERIVED_DATA" \
  test

xcrun simctl bootstatus "$DEVICE_ID" -b
xcrun simctl uninstall "$DEVICE_ID" "$BUNDLE_ID" 2>/dev/null || true
xcrun simctl install "$DEVICE_ID" "$DERIVED_DATA/Build/Products/Debug-iphonesimulator/Kiokun.app"
xcrun simctl launch "$DEVICE_ID" "$BUNDLE_ID" >/dev/null

sleep 2
APP_CONTAINER="$(xcrun simctl get_app_container "$DEVICE_ID" "$BUNDLE_ID" data)"
APP_DB="$APP_CONTAINER/Library/Application Support/Kiokun/kiokun.sqlite"
python3 "$ROOT_DIR/ios/tools/verify_offline_bundle.py" "$APP_DB"

/usr/bin/sqlite3 "$APP_DB" "
select 'dictionary_entries', count(*) from dictionary_entries
union all select 'dictionary_search', count(*) from dictionary_search
union all select 'static_assets', count(*) from static_assets
union all select 'notes', count(*) from notes
union all select 'study_cards', count(*) from study_cards
union all select 'custom_words', count(*) from custom_words
union all select 'artifacts', count(*) from artifacts
union all select 'sync_queue', count(*) from sync_queue;
"
