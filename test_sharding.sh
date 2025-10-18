#!/bin/bash

echo "🧪 Testing Sharding Logic"
echo "========================="
echo ""

# Test cases
declare -A tests=(
    ["ひらがな"]="non-han"
    ["カタカナ"]="non-han"
    ["好"]="han-1char"
    ["地"]="han-1char"
    ["的"]="han-1char"
    ["地図"]="han-2char"
    ["好き"]="han-2char"
    ["一人"]="han-2char"
    ["一把好手"]="han-3plus"
    ["図書館"]="han-3plus"
)

# Create a simple Rust test program
cat > /tmp/test_shard.rs << 'RUST'
fn is_han_character(c: char) -> bool {
    matches!(c,
        '\u{4E00}'..='\u{9FFF}'   |
        '\u{3400}'..='\u{4DBF}'   |
        '\u{20000}'..='\u{2A6DF}' |
        '\u{2A700}'..='\u{2B73F}' |
        '\u{2B740}'..='\u{2B81F}' |
        '\u{2B820}'..='\u{2CEAF}' |
        '\u{2CEB0}'..='\u{2EBEF}' |
        '\u{30000}'..='\u{3134F}'
    )
}

fn get_shard(word: &str) -> &'static str {
    let han_count = word.chars().filter(|c| is_han_character(*c)).count();
    match han_count {
        0 => "non-han",
        1 => "han-1char",
        2 => "han-2char",
        _ => "han-3plus",
    }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: {} <word>", args[0]);
        std::process::exit(1);
    }
    println!("{}", get_shard(&args[1]));
}
RUST

# Compile the test program
rustc /tmp/test_shard.rs -o /tmp/test_shard

# Run tests
passed=0
failed=0

for word in "${!tests[@]}"; do
    expected="${tests[$word]}"
    actual=$(/tmp/test_shard "$word")
    
    if [ "$actual" == "$expected" ]; then
        echo "✅ $word → $actual"
        ((passed++))
    else
        echo "❌ $word → $actual (expected: $expected)"
        ((failed++))
    fi
done

echo ""
echo "========================="
echo "Results: $passed passed, $failed failed"

# Cleanup
rm -f /tmp/test_shard.rs /tmp/test_shard

if [ $failed -eq 0 ]; then
    echo "🎉 All tests passed!"
    exit 0
else
    echo "💥 Some tests failed!"
    exit 1
fi
