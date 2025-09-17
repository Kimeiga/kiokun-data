#!/bin/bash

# Script to convert Chinese JSONL to JSON and generate Rust types
# Usage: ./scripts/generate_chinese_types.sh [sample_size]

set -e  # Exit on any error

# Configuration
CHINESE_JSONL="data/chinese_dictionary_word_2025-06-25.jsonl"
CHINESE_JSON="schemas/chinese_sample.json"
CHINESE_TYPES="schemas/chinese_types.rs"
SAMPLE_SIZE=${1}  # No default - use full dataset if not specified

echo "🚀 Generating Chinese dictionary Rust types..."
if [ -n "$SAMPLE_SIZE" ]; then
    echo "📊 Using sample size: $SAMPLE_SIZE entries"
else
    echo "📊 Using full dataset (all entries)"
fi

# Step 1: Check if input file exists
if [ ! -f "$CHINESE_JSONL" ]; then
    echo "❌ Error: Chinese JSONL file not found: $CHINESE_JSONL"
    exit 1
fi

# Step 2: Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: python3 is required but not installed"
    exit 1
fi

# Step 3: Check if quicktype is available
if ! command -v quicktype &> /dev/null; then
    echo "❌ Error: quicktype is required but not installed"
    echo "💡 Install with: npm install -g quicktype"
    exit 1
fi

# Step 4: Create directories
mkdir -p schemas scripts

# Step 5: Convert JSONL to JSON (sample for quicktype)
echo "📝 Step 1: Converting JSONL to JSON (sample)..."
python3 scripts/jsonl_to_json.py "$CHINESE_JSONL" "$CHINESE_JSON" "$SAMPLE_SIZE"

if [ ! -f "$CHINESE_JSON" ]; then
    echo "❌ Error: Failed to create JSON file"
    exit 1
fi

# Step 6: Generate Rust types with quicktype
echo "🦀 Step 2: Generating Rust types with quicktype..."
quicktype \
    --lang rust \
    --src "$CHINESE_JSON" \
    --out "$CHINESE_TYPES" \
    --top-level ChineseDictionary \
    --density dense \
    --visibility public \
    --derive-debug \
    --derive-clone \
    --derive-partial-eq \
    --skip-serializing-none \
    --edition-2018 \
    --leading-comments

if [ ! -f "$CHINESE_TYPES" ]; then
    echo "❌ Error: Failed to generate Rust types"
    exit 1
fi

# Step 7: Clean up temporary JSON file (optional)
echo "🧹 Step 3: Cleaning up temporary files..."
rm -f "$CHINESE_JSON"

# Step 8: Show results
echo ""
echo "✅ Success! Generated Rust types for Chinese dictionary"
echo "📁 Output file: $CHINESE_TYPES"
if [ -n "$SAMPLE_SIZE" ]; then
    echo "📊 Based on $SAMPLE_SIZE sample entries"
else
    echo "📊 Based on full dataset"
fi
echo ""
echo "🔍 Preview of generated types:"
head -20 "$CHINESE_TYPES"
echo ""
echo "💡 You can now use these types in your Rust project!"
echo "💡 To see the full file: cat $CHINESE_TYPES"
