#!/usr/bin/env python3
import csv
import json

def parse_notes_csv(filename):
    """Parse the Notes.csv file which has multi-line quoted fields."""
    notes = []
    
    with open(filename, 'r', encoding='utf-8') as f:
        # Use csv.reader which properly handles quoted fields with newlines
        reader = csv.reader(f)
        
        for row in reader:
            # Skip empty rows
            if not row or all(field.strip() == '' for field in row):
                continue
            
            # Each row should have 4 fields: word, pronunciation, definition, note
            if len(row) >= 4:
                entry = {
                    "word": row[0].strip(),
                    "pronunciation": row[1].strip(),
                    "definition": row[2].strip(),
                    "note": row[3].strip()
                }
                notes.append(entry)
            elif len(row) > 0:
                # Handle incomplete rows
                print(f"Warning: Row has {len(row)} fields instead of 4: {row[:2]}")
    
    return notes

if __name__ == "__main__":
    notes = parse_notes_csv("Notes.csv")
    
    # Write to JSON file
    with open("notes.json", 'w', encoding='utf-8') as f:
        json.dump(notes, f, ensure_ascii=False, indent=2)
    
    print(f"Converted {len(notes)} notes to notes.json")
    
    # Print first few entries as a sample
    print("\nFirst 3 entries:")
    for i, note in enumerate(notes[:3], 1):
        print(f"\n--- Entry {i} ---")
        print(f"Word: {note['word']}")
        print(f"Pronunciation: {note['pronunciation']}")
        print(f"Definition: {note['definition'][:50]}...")
        print(f"Note: {note['note'][:100]}...")

