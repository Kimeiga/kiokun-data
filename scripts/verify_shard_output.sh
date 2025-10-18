#!/bin/bash

# Verify that the --shard-output flag correctly distributed files into 4 shards

set -e

echo "🔍 Verifying shard output..."
echo ""

# Check that all 4 shard directories exist
if [ ! -d "output_dictionary/output_non-han" ]; then
    echo "❌ Error: output_dictionary/output_non-han directory not found"
    exit 1
fi

if [ ! -d "output_dictionary/output_han-1char" ]; then
    echo "❌ Error: output_dictionary/output_han-1char directory not found"
    exit 1
fi

if [ ! -d "output_dictionary/output_han-2char" ]; then
    echo "❌ Error: output_dictionary/output_han-2char directory not found"
    exit 1
fi

if [ ! -d "output_dictionary/output_han-3plus" ]; then
    echo "❌ Error: output_dictionary/output_han-3plus directory not found"
    exit 1
fi

echo "✅ All 4 shard directories exist"
echo ""

# Count files in each shard
NON_HAN_COUNT=$(find output_dictionary/output_non-han -type f -name "*.json" | wc -l | tr -d ' ')
HAN_1CHAR_COUNT=$(find output_dictionary/output_han-1char -type f -name "*.json" | wc -l | tr -d ' ')
HAN_2CHAR_COUNT=$(find output_dictionary/output_han-2char -type f -name "*.json" | wc -l | tr -d ' ')
HAN_3PLUS_COUNT=$(find output_dictionary/output_han-3plus -type f -name "*.json" | wc -l | tr -d ' ')

echo "📊 File counts:"
echo "  non-han:    $NON_HAN_COUNT files"
echo "  han-1char:  $HAN_1CHAR_COUNT files"
echo "  han-2char:  $HAN_2CHAR_COUNT files"
echo "  han-3plus:  $HAN_3PLUS_COUNT files"
echo ""

TOTAL=$((NON_HAN_COUNT + HAN_1CHAR_COUNT + HAN_2CHAR_COUNT + HAN_3PLUS_COUNT))
echo "  Total:      $TOTAL files"
echo ""

# Sample 5 random files from each shard and verify they're in the correct shard
echo "🔍 Verifying sample files from each shard..."
echo ""

# Function to count Han characters in a filename
count_han_chars() {
    local filename="$1"
    # Remove .json extension
    local word="${filename%.json}"
    # Use Python to count Han characters
    python3 -c "
import sys
import re

def is_han_character(c):
    code = ord(c)
    return (
        (0x4E00 <= code <= 0x9FFF) or   # CJK Unified Ideographs
        (0x3400 <= code <= 0x4DBF) or   # CJK Extension A
        (0x20000 <= code <= 0x2A6DF) or # CJK Extension B
        (0x2A700 <= code <= 0x2B73F) or # CJK Extension C
        (0x2B740 <= code <= 0x2B81F) or # CJK Extension D
        (0x2B820 <= code <= 0x2CEAF) or # CJK Extension E
        (0x2CEB0 <= code <= 0x2EBEF) or # CJK Extension F
        (0x30000 <= code <= 0x3134F)    # CJK Extension G
    )

word = sys.argv[1]
count = sum(1 for c in word if is_han_character(c))
print(count)
" "$word"
}

# Verify non-han shard
echo "Checking non-han shard..."
find output_dictionary/output_non-han -type f -name "*.json" | head -5 | while read file; do
    filename=$(basename "$file")
    han_count=$(count_han_chars "$filename")
    if [ "$han_count" -ne 0 ]; then
        echo "  ❌ Error: $filename has $han_count Han characters (should be 0)"
        exit 1
    fi
    echo "  ✅ $filename (0 Han chars)"
done
echo ""

# Verify han-1char shard
echo "Checking han-1char shard..."
find output_dictionary/output_han-1char -type f -name "*.json" | head -5 | while read file; do
    filename=$(basename "$file")
    han_count=$(count_han_chars "$filename")
    if [ "$han_count" -ne 1 ]; then
        echo "  ❌ Error: $filename has $han_count Han characters (should be 1)"
        exit 1
    fi
    echo "  ✅ $filename (1 Han char)"
done
echo ""

# Verify han-2char shard
echo "Checking han-2char shard..."
find output_dictionary/output_han-2char -type f -name "*.json" | head -5 | while read file; do
    filename=$(basename "$file")
    han_count=$(count_han_chars "$filename")
    if [ "$han_count" -ne 2 ]; then
        echo "  ❌ Error: $filename has $han_count Han characters (should be 2)"
        exit 1
    fi
    echo "  ✅ $filename (2 Han chars)"
done
echo ""

# Verify han-3plus shard
echo "Checking han-3plus shard..."
find output_dictionary/output_han-3plus -type f -name "*.json" | head -5 | while read file; do
    filename=$(basename "$file")
    han_count=$(count_han_chars "$filename")
    if [ "$han_count" -lt 3 ]; then
        echo "  ❌ Error: $filename has $han_count Han characters (should be 3+)"
        exit 1
    fi
    echo "  ✅ $filename ($han_count Han chars)"
done
echo ""

echo "✅ All sample files are in the correct shards!"
echo ""
echo "🎉 Shard output verification complete!"

