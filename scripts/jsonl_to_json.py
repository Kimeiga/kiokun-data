#!/usr/bin/env python3
"""
Convert JSONL (JSON Lines) file to JSON array format.
This script reads a JSONL file and converts it to a JSON array for use with quicktype.
"""

import json
import sys
import os
from pathlib import Path

def jsonl_to_json(input_file, output_file, sample_size=None):
    """
    Convert JSONL file to JSON array.
    
    Args:
        input_file: Path to input JSONL file
        output_file: Path to output JSON file
        sample_size: Optional - only take first N entries (useful for large files)
    """
    entries = []
    
    print(f"Reading JSONL file: {input_file}")
    
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            for i, line in enumerate(f):
                if sample_size and i >= sample_size:
                    print(f"Stopping at {sample_size} entries (sample mode)")
                    break
                    
                line = line.strip()
                if line:  # Skip empty lines
                    try:
                        entry = json.loads(line)
                        entries.append(entry)
                    except json.JSONDecodeError as e:
                        print(f"Warning: Skipping invalid JSON on line {i+1}: {e}")
                        continue
                
                # Progress indicator for large files
                if (i + 1) % 10000 == 0:
                    print(f"Processed {i + 1} entries...")
    
    except FileNotFoundError:
        print(f"Error: File {input_file} not found")
        return False
    except Exception as e:
        print(f"Error reading file: {e}")
        return False
    
    print(f"Read {len(entries)} entries")
    
    # Write JSON array
    print(f"Writing JSON file: {output_file}")
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(entries, f, ensure_ascii=False, indent=2)
        
        print(f"Successfully converted {len(entries)} entries to {output_file}")
        return True
        
    except Exception as e:
        print(f"Error writing file: {e}")
        return False

def main():
    if len(sys.argv) < 3:
        print("Usage: python3 jsonl_to_json.py <input.jsonl> <output.json> [sample_size]")
        print("Example: python3 jsonl_to_json.py data/chinese_dict.jsonl schemas/chinese_sample.json 1000")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    sample_size = int(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3].strip() else None
    
    # Create output directory if it doesn't exist
    output_dir = Path(output_file).parent
    output_dir.mkdir(parents=True, exist_ok=True)
    
    success = jsonl_to_json(input_file, output_file, sample_size)
    
    if success:
        print("\n✅ Conversion completed successfully!")
        if sample_size:
            print(f"📝 Note: Only converted first {sample_size} entries (sample mode)")
        print(f"📁 Output file: {output_file}")
    else:
        print("\n❌ Conversion failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()
