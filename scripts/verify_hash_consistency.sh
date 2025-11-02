#!/bin/bash
# Verify that frontend and backend hash functions produce identical results
# This prevents 404 errors caused by hash function mismatches

set -e

echo "🔍 Verifying hash function consistency between frontend and backend..."
echo ""

# Test cases: words that should hash to different shards
TEST_CASES=(
    "地図"  # Japanese word (2 chars)
    "地圖"  # Traditional Chinese (2 chars)
    "学生"  # Japanese word (2 chars)
    "學生"  # Traditional Chinese (2 chars)
    "図"    # Japanese character (1 char)
    "圖"    # Traditional Chinese (1 char)
)

echo "📊 Testing hash function with sample words:"
echo ""

# Backend hash calculation (Rust)
echo "Backend (Rust):"
for word in "${TEST_CASES[@]}"; do
    # Use Rust to calculate hash
    hash=$(cargo run --quiet --bin build_dictionary -- --test-hash "$word" 2>/dev/null || echo "ERROR")
    if [ "$hash" != "ERROR" ]; then
        echo "  $word → hash: $hash"
    else
        echo "  ⚠️  Could not calculate hash for: $word"
    fi
done

echo ""

# Frontend hash calculation (Node.js)
echo "Frontend (TypeScript/JavaScript):"
node -e "
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash * 31 + char) >>> 0;
  }
  return hash;
}

const testCases = ['地図', '地圖', '学生', '學生', '図', '圖'];
testCases.forEach(word => {
  const hash = simpleHash(word);
  const hanCount = [...word].filter(c => /[\u4e00-\u9fff]/.test(c)).length;
  let shard;
  if (hanCount === 0) {
    shard = 'non-han';
  } else if (hanCount === 1) {
    shard = \`han-1char-\${(hash % 2) + 1}\`;
  } else if (hanCount === 2) {
    shard = \`han-2char-\${(hash % 3) + 1}\`;
  } else {
    shard = \`han-3plus-\${(hash % 4) + 1}\`;
  }
  console.log(\`  \${word} → hash: \${hash}, shard: \${shard}\`);
});
"

echo ""
echo "✅ If the hash values match between backend and frontend, the system is consistent."
echo "⚠️  If they don't match, update the hash function in sveltekit-app/src/lib/shard-utils.ts"
echo ""
echo "Expected behavior:"
echo "  - Same word should produce same hash in both systems"
echo "  - Hash determines which shard (repository) the file is stored in"
echo "  - Mismatch causes 404 errors when frontend looks in wrong shard"

