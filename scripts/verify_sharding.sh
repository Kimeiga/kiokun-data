#!/bin/bash
set -e

echo "🔍 Verifying Dictionary Sharding"
echo "================================="
echo ""

# Check if output directories exist
SHARDS=("output_non-han" "output_han-1char" "output_han-2char" "output_han-3plus")
for shard in "${SHARDS[@]}"; do
    if [ ! -d "$shard" ]; then
        echo "❌ Directory $shard does not exist. Run the build first."
        exit 1
    fi
done

echo "✅ All shard directories exist"
echo ""

# Count files in each shard
echo "📊 File counts per shard:"
for shard in "${SHARDS[@]}"; do
    count=$(find "$shard" -name "*.json" | wc -l | tr -d ' ')
    size=$(du -sh "$shard" | cut -f1)
    echo "  $shard: $count files ($size)"
done
echo ""

# Check for duplicates across shards
echo "🔍 Checking for duplicate files across shards..."
temp_file=$(mktemp)

for shard in "${SHARDS[@]}"; do
    find "$shard" -name "*.json" -exec basename {} \; >> "$temp_file"
done

duplicates=$(sort "$temp_file" | uniq -d)
if [ -n "$duplicates" ]; then
    echo "❌ Found duplicate files across shards:"
    echo "$duplicates"
    rm "$temp_file"
    exit 1
else
    echo "✅ No duplicate files found across shards"
fi

rm "$temp_file"
echo ""

# Sample and verify Han character counts
echo "🧪 Sampling files to verify Han character counts..."

# Function to count Han characters in a filename
count_han_chars() {
    local filename="$1"
    # Remove .json extension
    local word="${filename%.json}"
    
    # Use Python to count Han characters
    python3 << EOF
import sys
import unicodedata

def is_han_character(c):
    code = ord(c)
    return (
        (0x4E00 <= code <= 0x9FFF) or    # CJK Unified Ideographs
        (0x3400 <= code <= 0x4DBF) or    # Extension A
        (0x20000 <= code <= 0x2A6DF) or  # Extension B
        (0x2A700 <= code <= 0x2B73F) or  # Extension C
        (0x2B740 <= code <= 0x2B81F) or  # Extension D
        (0x2B820 <= code <= 0x2CEAF) or  # Extension E
        (0x2CEB0 <= code <= 0x2EBEF) or  # Extension F
        (0x30000 <= code <= 0x3134F)     # Extension G
    )

word = "$word"
han_count = sum(1 for c in word if is_han_character(c))
print(han_count)
EOF
}

# Sample 10 random files from each shard
errors=0
for shard in "${SHARDS[@]}"; do
    echo "  Checking $shard..."
    
    # Determine expected Han count for this shard
    case "$shard" in
        "output_non-han")
            expected_min=0
            expected_max=0
            ;;
        "output_han-1char")
            expected_min=1
            expected_max=1
            ;;
        "output_han-2char")
            expected_min=2
            expected_max=2
            ;;
        "output_han-3plus")
            expected_min=3
            expected_max=999999
            ;;
    esac
    
    # Sample 10 random files
    files=$(find "$shard" -name "*.json" | shuf -n 10)
    
    for file in $files; do
        filename=$(basename "$file")
        han_count=$(count_han_chars "$filename")
        
        if [ "$han_count" -lt "$expected_min" ] || [ "$han_count" -gt "$expected_max" ]; then
            echo "    ❌ $filename has $han_count Han chars (expected $expected_min-$expected_max)"
            ((errors++))
        fi
    done
done

if [ $errors -eq 0 ]; then
    echo "✅ All sampled files have correct Han character counts"
else
    echo "❌ Found $errors files with incorrect Han character counts"
    exit 1
fi

echo ""
echo "✅ All sharding verification tests passed!"
echo ""
echo "Summary:"
echo "  - No duplicate files across shards"
echo "  - All sampled files in correct shards based on Han character count"
echo "  - Sharding logic is working correctly"

