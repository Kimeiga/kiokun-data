# Import Notes from notes.json

This guide explains how to import notes from `notes.json` into the D1 database.

## Overview

The import script:
1. Reads notes from `notes.json`
2. Converts Japanese characters to Traditional Chinese using OpenCC
3. Inserts notes into the D1 database

## Prerequisites

- **OpenCC** must be installed:
  ```bash
  # macOS
  brew install opencc
  
  # Linux
  sudo apt-get install opencc
  ```

## Step 1: Get Your User ID

First, you need to find your user ID from the database.

### For Local Database:
```bash
./scripts/get_user_id.sh
```

### For Remote Database:
```bash
./scripts/get_user_id.sh --remote
```

This will show a table like:
```
┌──────────────────────────────────────┬──────────────┬─────────────────────┐
│ id                                   │ name         │ email               │
├──────────────────────────────────────┼──────────────┼─────────────────────┤
│ abc123def456...                      │ John Doe     │ john@example.com    │
└──────────────────────────────────────┴──────────────┴─────────────────────┘
```

Copy your `id` value (the long string in the first column).

## Step 2: Import Notes

### To Local Database (for testing):
```bash
python3 scripts/import_notes.py --user-id YOUR_USER_ID
```

### To Remote Database (production):
```bash
python3 scripts/import_notes.py --user-id YOUR_USER_ID --remote
```

Replace `YOUR_USER_ID` with the ID you copied in Step 1.

## Example

```bash
# 1. Get your user ID
./scripts/get_user_id.sh --remote

# 2. Import notes (replace with your actual user ID)
python3 scripts/import_notes.py --user-id abc123def456ghi789 --remote
```

## What Happens During Import

1. **Loading**: Reads all notes from `notes.json`
2. **Converting**: Converts Japanese characters to Traditional Chinese
   - Example: `地図` → `地圖`
   - Example: `学生` → `學生`
3. **Preview**: Shows first 3 notes for confirmation
4. **Confirmation**: Asks you to confirm before inserting
5. **Inserting**: Inserts notes in batches of 50

## Sample Output

```
📖 Loaded 5642 notes from notes.json

🔄 Converting Japanese characters to Traditional Chinese...
  地図 → 地圖
  学生 → 學生
  会社 → 會社
  ...

✅ Processed 5642 notes
📊 Conversions: 1234 characters converted

📋 Preview of first 3 notes:
  Character: 奇
  Note: It's strange (奇妙) that a "big" person "can" use that tiny KI...

  Character: 妙
  Note: It's strange that MYo women are so few in number...

  Character: 病
  Note: I ate the YAMs, and now I'm sick with third degree BYOU.

⚠️  About to insert 5642 notes into REMOTE database. Continue? (y/N): y

💾 Inserting 5642 notes into database...
  Batch 1/113... ✅
  Batch 2/113... ✅
  ...

✅ Successfully inserted 5642 notes!

🎉 Import complete!
📊 Summary:
  - Notes imported: 5642
  - Database: REMOTE
  - User ID: abc123def456ghi789
```

## Notes Format

The `notes.json` file should have this structure:
```json
[
  {
    "word": "奇",
    "pronunciation": "キ, く.しき, あや.しい, くし, めずら.しい",
    "definition": "strange, strangeness, curiosity",
    "note": "It's strange (奇妙) that a \"big\" person \"can\" use that tiny KI\n\nBig 大 + approve 可 = weird (suspicious)\n大 dai + 可 ka -> 奇 ki"
  }
]
```

## Character Conversion

The script uses OpenCC's `jp2t` (Japanese to Traditional Chinese) configuration:

- **Single characters**: `学` → `學`, `図` → `圖`
- **Multi-character words**: `地図` → `地圖`, `学生` → `學生`
- **Already traditional**: `奇` → `奇` (no change)

This ensures notes are attached to the correct Traditional Chinese character pages in the dictionary.

## Troubleshooting

### "OpenCC not found"
Install OpenCC:
```bash
brew install opencc  # macOS
```

### "Notes file not found"
Make sure `notes.json` is in the root directory of the project.

### "User ID not found"
Make sure you're using the correct user ID from the database. Run `./scripts/get_user_id.sh` to verify.

### Duplicate Notes
The script uses `INSERT OR REPLACE`, so if you run it multiple times with the same user ID, it will update existing notes instead of creating duplicates.

## Database Schema

Notes are stored with this structure:
```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  character TEXT NOT NULL,
  noteText TEXT NOT NULL,
  isAdmin INTEGER NOT NULL DEFAULT 0,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  UNIQUE(userId, character)
);
```

Each user can have **one note per character**.

