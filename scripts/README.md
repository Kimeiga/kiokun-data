# Scripts Directory

Utility scripts for the Kiokun Dictionary project.

## 📋 Available Scripts

### Dictionary Data Processing

#### `view-deflate.sh`
View deflate-compressed dictionary files.

```bash
# View a specific character's data
./scripts/view-deflate.sh 好

# View with pretty-printed JSON
./scripts/view-deflate.sh 地圖 | jq '.'

# Check specific fields
./scripts/view-deflate.sh 学生 | jq '.chinese_words'
```

**What it does:** Decompresses `.json.deflate` files from `output_dictionary/` and pipes them through `jq` for pretty formatting.

**Requirements:** Python 3, jq

---

#### `generate_kanji_mapping.py`
Generate Japanese kanji to Traditional Chinese character mapping using OpenCC (word-level).

```bash
# Generate the J2C mapping (one-time setup or when updating JMdict)
./scripts/generate_kanji_mapping.py
```

**What it does:**
- Extracts all unique kanji **words** from JMdict dictionary
- Converts them to Traditional Chinese using OpenCC `jp2t` configuration
- Generates `src/kanji_mapping_generated.rs` (Rust HashMap)
- Generates `output/kanji_mapping.json` (human-readable)

**Output:**
- `src/kanji_mapping_generated.rs` - 68,801 word-level mappings as Rust code
- `output/kanji_mapping.json` - JSON format for inspection

**Requirements:** Python 3, OpenCC (`brew install opencc`)

---

#### `generate_character_mapping.py`
Extend J2C mapping with character-level mappings from KANJIDIC2.

```bash
# Generate character-level mappings (run after generate_kanji_mapping.py)
./scripts/generate_character_mapping.py
```

**What it does:**
- Extracts all unique kanji **characters** from KANJIDIC2 dictionary
- Converts them to Traditional Chinese using OpenCC `jp2t` configuration
- Merges with existing word-level mappings in `output/j2c_mapping.json`
- Analyzes coverage between Japanese and Chinese character dictionaries

**Output:**
- Updates `output/j2c_mapping.json` with additional character-level mappings

**Requirements:** Python 3, OpenCC (`brew install opencc`)

**Note:** This extends the word-level mappings from `generate_kanji_mapping.py`. Run that script first.

---

### Type Generation

#### `generate_chinese_types.sh`
Generate Rust type definitions from Chinese dictionary JSON.

```bash
# Generate types from full dataset
./scripts/generate_chinese_types.sh

# Generate types from sample (faster, for testing)
./scripts/generate_chinese_types.sh 1000
```

**What it does:**
- Converts JSONL to JSON using `jsonl_to_json.py`
- Generates Rust types using `quicktype`
- Outputs to `schemas/chinese_types.rs`

**Requirements:** Python 3, quicktype (`npm install -g quicktype`)

---

#### `jsonl_to_json.py`
Convert JSONL (JSON Lines) to JSON array format.

```bash
# Convert full file
./scripts/jsonl_to_json.py data/chinese_dictionary.jsonl output/chinese.json

# Convert sample (first 1000 entries)
./scripts/jsonl_to_json.py data/chinese_dictionary.jsonl output/sample.json 1000
```

**What it does:** Reads JSONL file line-by-line and converts to JSON array for use with quicktype.

**Requirements:** Python 3

---

### Verification & Testing

#### `verify_hash_consistency.sh`
Verify that frontend and backend hash functions produce identical results.

```bash
./scripts/verify_hash_consistency.sh
```

**What it does:**
- Tests hash function with sample words (地図, 地圖, 学生, etc.)
- Compares Rust backend hash with TypeScript frontend hash
- Ensures files are fetched from correct GitHub repository shard

**Why it matters:** Hash mismatches cause 404 errors when frontend looks in wrong shard.

**Requirements:** Rust (cargo), Node.js

---

#### `verify_sharding.sh`
Verify that dictionary files are correctly distributed across shards.

```bash
./scripts/verify_sharding.sh
```

**What it does:**
- Checks all shard directories exist
- Counts files in each shard
- Verifies no duplicate files across shards
- Samples random files to verify Han character counts match shard

**Requirements:** Python 3

---

## 🗑️ Removed Scripts

The following scripts have been removed from the repository:

- **`verify_shard_output.sh`** - For old 4-shard system (now using 23-repo system)
- **`separate_shards.py`** - For old 4-shard system
- **`create-github-repos.sh`** - One-time setup script (already completed)
- **`extract_labels.js`** - Depends on external 10ten-ja-reader repo
- **`expand-json.js`** - For old optimized format (not current deflate format)
- **`test_types.py`** - Basic validation, not actively maintained
- **`get_user_id.sh`** - Moved to `sveltekit-app/scripts/`
- **`import_notes.py`** - Moved to `sveltekit-app/scripts/`

---

## 📚 Common Workflows

### Initial Setup
```bash
# 1. Install dependencies
brew install opencc
npm install -g quicktype

# 2. Generate J2C mapping (one-time)
./scripts/generate_kanji_mapping.py          # Word-level mappings
./scripts/generate_character_mapping.py      # Character-level mappings (extends word-level)

# 3. Generate Chinese types (if needed)
./scripts/generate_chinese_types.sh
```

### Development
```bash
# View a dictionary entry
./scripts/view-deflate.sh 好

# Verify hash consistency after changes
./scripts/verify_hash_consistency.sh

# Verify sharding after build
./scripts/verify_sharding.sh
```

### Updating Data
```bash
# After updating JMdict or KANJIDIC2 data
./scripts/generate_kanji_mapping.py          # Word-level mappings
./scripts/generate_character_mapping.py      # Character-level mappings

# After updating Chinese dictionary structure
./scripts/generate_chinese_types.sh
```

---

## 🔧 Requirements

- **Python 3** - For Python scripts
- **Node.js** - For hash verification
- **Rust/Cargo** - For building and hash verification
- **OpenCC** - For Japanese-Chinese character conversion
  - macOS: `brew install opencc`
  - Linux: `apt-get install opencc`
- **quicktype** - For type generation
  - `npm install -g quicktype`
- **jq** - For JSON pretty-printing
  - macOS: `brew install jq`
  - Linux: `apt-get install jq`

---

## 📝 Notes

- All scripts should be run from the repository root directory
- Scripts are designed to be idempotent (safe to run multiple times)
- Most scripts include progress indicators for long-running operations
- Error messages include suggestions for fixing common issues

