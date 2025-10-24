#!/usr/bin/env python3
"""
Import notes from notes.json into the D1 database.

This script:
1. Reads notes from notes.json
2. Converts Japanese characters to Traditional Chinese using OpenCC
3. Inserts notes into the D1 database via Wrangler CLI

Usage:
    python scripts/import_notes.py --user-id YOUR_USER_ID [--remote]
    
Arguments:
    --user-id: Your user ID from the database (required)
    --remote: Apply to remote database instead of local (optional)
"""

import json
import subprocess
import sys
import argparse
from pathlib import Path
from datetime import datetime
import uuid

def find_opencc() -> str:
    """Find the opencc binary."""
    # Try common locations
    locations = [
        'opencc',  # In PATH
        '/opt/homebrew/bin/opencc',  # Homebrew on Apple Silicon
        '/usr/local/bin/opencc',  # Homebrew on Intel Mac
        '/usr/bin/opencc',  # Linux
    ]

    for loc in locations:
        try:
            subprocess.run([loc, '--version'], capture_output=True, check=True)
            return loc
        except (subprocess.CalledProcessError, FileNotFoundError):
            continue

    # Try to find it in Cellar
    try:
        result = subprocess.run(
            ['find', '/opt/homebrew/Cellar/opencc', '-name', 'opencc', '-type', 'f'],
            capture_output=True,
            text=True,
            check=True
        )
        if result.stdout.strip():
            return result.stdout.strip().split('\n')[0]
    except:
        pass

    print("❌ OpenCC not found. Please install OpenCC:")
    print("   macOS: brew install opencc")
    print("   Linux: sudo apt-get install opencc")
    sys.exit(1)

def convert_with_opencc(text: str, opencc_path: str) -> str:
    """Convert Japanese text to Traditional Chinese using OpenCC."""
    try:
        result = subprocess.run(
            [opencc_path, '-c', 'jp2t'],
            input=text,
            text=True,
            capture_output=True,
            check=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"❌ OpenCC conversion failed for '{text}': {e}")
        print(f"   Error output: {e.stderr}")
        return text

def load_notes(notes_path: Path) -> list:
    """Load notes from JSON file."""
    if not notes_path.exists():
        print(f"❌ Notes file not found: {notes_path}")
        sys.exit(1)
    
    with open(notes_path, 'r', encoding='utf-8') as f:
        notes = json.load(f)
    
    print(f"📖 Loaded {len(notes)} notes from {notes_path}")
    return notes

def process_notes(notes: list, user_id: str, opencc_path: str) -> list:
    """
    Process notes: convert Japanese characters to Traditional Chinese.

    Returns list of tuples: (character, note_text, user_id, note_id, created_at, updated_at, is_admin)
    """
    processed = []
    conversions = {}

    print("\n🔄 Converting Japanese characters to Traditional Chinese...")

    for note in notes:
        word = note['word']
        note_text = note['note']

        # Convert to Traditional Chinese
        if word not in conversions:
            traditional = convert_with_opencc(word, opencc_path)
            conversions[word] = traditional
            if word != traditional:
                print(f"  {word} → {traditional}")
        else:
            traditional = conversions[word]
        
        # Generate IDs and timestamps
        note_id = str(uuid.uuid4())
        now = int(datetime.now().timestamp())
        
        processed.append({
            'id': note_id,
            'userId': user_id,
            'character': traditional,
            'noteText': note_text,
            'isAdmin': 0,
            'createdAt': now,
            'updatedAt': now
        })
    
    print(f"\n✅ Processed {len(processed)} notes")
    print(f"📊 Conversions: {len([k for k, v in conversions.items() if k != v])} characters converted")
    
    return processed

def insert_notes_to_db(notes: list, remote: bool = False):
    """Insert notes into D1 database using Wrangler CLI."""
    print(f"\n💾 Inserting {len(notes)} notes into database...")
    
    # Build SQL INSERT statements
    sql_statements = []
    
    for note in notes:
        # Escape single quotes in text
        note_text_escaped = note['noteText'].replace("'", "''")
        character_escaped = note['character'].replace("'", "''")
        
        sql = f"""INSERT OR REPLACE INTO notes (id, userId, character, noteText, isAdmin, createdAt, updatedAt)
VALUES ('{note['id']}', '{note['userId']}', '{character_escaped}', '{note_text_escaped}', {note['isAdmin']}, {note['createdAt']}, {note['updatedAt']});"""
        
        sql_statements.append(sql)
    
    # Execute in batches (D1 has command length limits)
    batch_size = 50
    total_batches = (len(sql_statements) + batch_size - 1) // batch_size
    
    for i in range(0, len(sql_statements), batch_size):
        batch = sql_statements[i:i + batch_size]
        batch_num = i // batch_size + 1
        
        print(f"  Batch {batch_num}/{total_batches}...", end=' ')
        
        # Combine statements
        combined_sql = '\n'.join(batch)
        
        # Execute via Wrangler
        cmd = [
            'npx', 'wrangler', 'd1', 'execute', 'kiokun-notes-db',
            '--command', combined_sql
        ]
        
        if remote:
            cmd.append('--remote')
        else:
            cmd.append('--local')
        
        try:
            result = subprocess.run(
                cmd,
                cwd='sveltekit-app',
                capture_output=True,
                text=True,
                check=True
            )
            print("✅")
        except subprocess.CalledProcessError as e:
            print(f"❌")
            print(f"Error executing batch {batch_num}:")
            print(f"  stdout: {e.stdout}")
            print(f"  stderr: {e.stderr}")
            sys.exit(1)
    
    print(f"\n✅ Successfully inserted {len(notes)} notes!")

def main():
    parser = argparse.ArgumentParser(description='Import notes from notes.json into D1 database')
    parser.add_argument('--user-id', required=True, help='Your user ID from the database')
    parser.add_argument('--remote', action='store_true', help='Apply to remote database instead of local')
    
    args = parser.parse_args()

    # Find OpenCC
    print("🔍 Finding OpenCC...")
    opencc_path = find_opencc()
    print(f"  ✅ Found OpenCC at: {opencc_path}")

    # Paths
    notes_path = Path('notes.json')

    # Load notes
    notes = load_notes(notes_path)

    # Process notes (convert Japanese to Traditional Chinese)
    processed_notes = process_notes(notes, args.user_id, opencc_path)
    
    # Show preview
    print("\n📋 Preview of first 3 notes:")
    for note in processed_notes[:3]:
        print(f"  Character: {note['character']}")
        print(f"  Note: {note['noteText'][:100]}...")
        print()
    
    # Confirm
    db_type = "REMOTE" if args.remote else "LOCAL"
    response = input(f"\n⚠️  About to insert {len(processed_notes)} notes into {db_type} database. Continue? (y/N): ")
    
    if response.lower() != 'y':
        print("❌ Cancelled")
        sys.exit(0)
    
    # Insert into database
    insert_notes_to_db(processed_notes, args.remote)
    
    print("\n🎉 Import complete!")
    print(f"📊 Summary:")
    print(f"  - Notes imported: {len(processed_notes)}")
    print(f"  - Database: {db_type}")
    print(f"  - User ID: {args.user_id}")

if __name__ == "__main__":
    main()

