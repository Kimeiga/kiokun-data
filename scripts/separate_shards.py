#!/usr/bin/env python3
"""
Separate dictionary files into 4 shards based on Han character count.
This is much faster than building each shard separately.
"""

import os
import shutil
from pathlib import Path

def is_han_character(c: str) -> bool:
    """Check if a character is a Han (CJK) character."""
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

def count_han_chars(word: str) -> int:
    """Count the number of Han characters in a word."""
    return sum(1 for c in word if is_han_character(c))

def get_shard_for_word(word: str) -> str:
    """Determine which shard a word belongs to."""
    han_count = count_han_chars(word)
    
    if han_count == 0:
        return "non-han"
    elif han_count == 1:
        return "han-1char"
    elif han_count == 2:
        return "han-2char"
    else:
        return "han-3plus"

def main():
    source_dir = Path("output_dictionary")
    
    if not source_dir.exists():
        print("❌ Error: output_dictionary directory does not exist")
        print("   Run the build first: cargo run --release --bin merge_dictionaries -- --individual-files --optimize --mode all")
        return 1
    
    # Create shard directories
    shards = {
        "non-han": Path("output_non-han"),
        "han-1char": Path("output_han-1char"),
        "han-2char": Path("output_han-2char"),
        "han-3plus": Path("output_han-3plus"),
    }
    
    print("📁 Creating shard directories...")
    for shard_dir in shards.values():
        shard_dir.mkdir(exist_ok=True)
    
    # Count files
    all_files = list(source_dir.glob("*.json"))
    total_files = len(all_files)
    
    print(f"📊 Found {total_files:,} files to separate")
    print("")
    
    # Separate files into shards
    shard_counts = {shard: 0 for shard in shards.keys()}
    
    for i, file_path in enumerate(all_files, 1):
        # Get the word from the filename (remove .json extension)
        word = file_path.stem
        
        # Determine which shard this word belongs to
        shard = get_shard_for_word(word)
        
        # Copy file to the appropriate shard directory
        dest_path = shards[shard] / file_path.name
        shutil.copy2(file_path, dest_path)
        
        shard_counts[shard] += 1
        
        # Progress indicator
        if i % 10000 == 0:
            print(f"  Processed {i:,}/{total_files:,} files ({i*100//total_files}%)")
    
    print("")
    print("✅ Separation complete!")
    print("")
    print("📊 File counts per shard:")
    for shard, count in shard_counts.items():
        size = sum(f.stat().st_size for f in shards[shard].glob("*.json"))
        size_mb = size / (1024 * 1024)
        print(f"  {shard:12s}: {count:,} files ({size_mb:.1f} MB)")
    
    print("")
    print(f"  Total:        {sum(shard_counts.values()):,} files")
    
    # Verify no duplicates
    if sum(shard_counts.values()) != total_files:
        print("")
        print("⚠️  Warning: File count mismatch!")
        print(f"   Source: {total_files:,} files")
        print(f"   Shards: {sum(shard_counts.values()):,} files")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())

