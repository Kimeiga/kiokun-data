# Kiokun Dictionary Merger

A high-performance Rust application that merges Chinese and Japanese dictionaries into a unified multilingual dictionary. This tool uses **OpenCC (Open Chinese Convert)** to intelligently match Japanese kanji with Traditional Chinese characters, combining entries from both languages that represent the same words (like 学生→學生 "student") while preserving all original data and metadata.

## 🎯 Project Overview

This dictionary merger is designed to create a comprehensive Chinese-Japanese dictionary by intelligently combining entries from two separate dictionary sources:

- **Chinese Dictionary**: 145,580 entries from CC-CEDICT format (JSONL)
- **Japanese Dictionary**: 211,692 entries from JMDict format (JSON)
- **Output**: Unified dictionary with 21,970 matched entries (6.64% unification rate) using OpenCC

## 📊 Results Summary

- **Total Combined Entries**: 330,936
- **Unified Entries (Both Languages)**: 21,970 ⬆️ **+40% improvement!**
- **Chinese-Only Entries**: 122,149
- **Japanese-Only Entries**: 186,817
- **Unification Rate**: 6.64% ⬆️ **+40% improvement!**
- **Output File Size**: ~650MB
- **Kanji Conversions Generated**: 68,801 (using OpenCC jp2t)

## 🏗️ Architecture

### Technical Implementation

#### **JSON Unmarshalling**

```rust
// Chinese Dictionary (JSONL) - Streaming line-by-line parsing
fn load_chinese_dictionary(path: &str) -> Result<Vec<ChineseDictionaryElement>> {
    let file = File::open(path)?;
    let reader = BufReader::new(file);

    for line in reader.lines() {
        let entry: ChineseDictionaryElement = serde_json::from_str(&line?)?;
        entries.push(entry);
    }
}

// Japanese Dictionary (JSON) - Load entire file into memory
fn load_japanese_dictionary(path: &str) -> Result<JapaneseEntry> {
    let content = fs::read_to_string(path)?;  // ⚠️ 124MB loaded at once
    let japanese_dict: JapaneseEntry = serde_json::from_str(&content)?;
}
```

#### **Dictionary Merging Algorithm**

```rust
fn merge_dictionaries(chinese_entries: Vec<ChineseDictionaryElement>, japanese_words: Vec<Word>) -> Result<CombinedDictionary> {
    let mut combined_map: HashMap<String, CombinedEntry> = HashMap::new();

    // Phase 1: Process Chinese entries (O(n) insertion)
    for chinese_entry in chinese_entries {
        let key = chinese_entry.trad.clone(); // Traditional Chinese as key
        combined_map.insert(key, create_entry(chinese_entry));
    }

    // Phase 2: Process Japanese entries (O(1) HashMap lookups)
    for japanese_word in japanese_words {
        let key = get_japanese_key(&japanese_word); // kanji[0].text or kana[0].text

        if let Some(existing_entry) = combined_map.get_mut(&key) {
            // Match found! Create unified entry
            existing_entry.japanese_entry = Some(japanese_word);
            existing_entry.metadata.is_unified = true;
        } else {
            // Japanese-only entry
            combined_map.insert(key, create_japanese_only_entry(japanese_word));
        }
    }
}
```

### Matching Strategy

The merger uses a **traditional Chinese character-based matching heuristic**:

1. **Primary Key**: Traditional Chinese characters (`trad` field)
2. **Chinese Processing**: First entry becomes the unified entry, additional entries go to `chinese_specific_entries`
3. **Japanese Matching**: Matches against `kanji[].text` fields, then `kana[].text` as fallback
4. **Deduplication**: First match wins, subsequent matches are stored as language-specific entries

### Data Structures

```rust
pub struct CombinedEntry {
    pub word: String,                                    // Traditional Chinese key
    pub chinese_entry: Option<ChineseDictionaryElement>, // Primary Chinese entry
    pub chinese_specific_entries: Vec<ChineseDictionaryElement>,
    pub japanese_entry: Option<Word>,                    // Primary Japanese entry  
    pub japanese_specific_entries: Vec<Word>,
    pub metadata: CombinedMetadata,                      // Statistics & flags
}
```

## 🚀 Quick Start

### Prerequisites

- **Rust** (2021 edition)
- **Python 3** (for type generation scripts)
- **Node.js + quicktype** (for schema generation)

```bash
# Install quicktype globally
npm install -g quicktype
```

### Build & Run

```bash
# Clone and build
git clone <repository>
cd kiokun-data
cargo build --release

# Run the merger
./target/release/merge_dictionaries

# Output will be saved to: output/combined_dictionary.json
```

## 📁 Project Structure

```
kiokun-data/
├── src/
│   ├── main.rs              # Dictionary merger implementation
│   ├── chinese_types.rs     # Chinese dictionary type definitions
│   ├── japanese_types.rs    # Japanese dictionary type definitions (with enum fixes)
│   └── combined_types.rs    # Unified dictionary type definitions
├── data/
│   ├── chinese_dictionary_word_2025-06-25.jsonl  # Source Chinese dictionary
│   └── jmdict-examples-eng-3.6.1.json            # Source Japanese dictionary
├── schemas/
│   ├── chinese_types.rs     # Generated Chinese types (quicktype)
│   └── japanese_types.rs    # Generated Japanese types (quicktype + manual fixes)
├── scripts/
│   ├── generate_chinese_types.sh  # Automated Chinese type generation
│   ├── jsonl_to_json.py           # JSONL to JSON converter
│   └── test_types.py              # Type validation
├── output/
│   └── combined_dictionary.json   # Merged dictionary output (~611MB)
└── README_TYPES.md                # Type generation documentation
```

## 🔧 Type Generation

This project uses **quicktype** to generate type-safe Rust structs from JSON data, with manual fixes for enum deserialization.

### Regenerate Chinese Types

```bash
./scripts/generate_chinese_types.sh
```

### Regenerate Japanese Types

```bash
quicktype --lang rust \
  --src data/jmdict-examples-eng-3.6.1.json \
  -o schemas/japanese_types.rs \
  --top-level JapaneseEntry \
  --density dense \
  --visibility public \
  --derive-debug \
  --derive-clone \
  --derive-partial-eq \
  --skip-serializing-none \
  --edition-2018 \
  --leading-comments

# ⚠️ IMPORTANT: Manual enum fixes required after quicktype generation
# See "Known Issues" section below
```

## ⚠️ Known Issues & Solutions

### Quicktype Enum Deserialization Bug

**Problem**: Quicktype generates incorrect serde attributes for Japanese part-of-speech enums.

- **JSON contains**: `"v5u"`, `"n"`, `"unc"`, etc.
- **Quicktype generates**: `V5U`, `N`, `Unc` variants without proper `#[serde(rename)]` attributes
- **Result**: Deserialization fails with "unknown variant" errors

**Solution**: After running quicktype, manually add serde rename attributes:

```rust
// Before (quicktype output)
V5U,
N,
Unc,

// After (manual fix)
#[serde(rename = "v5u")]
V5U,
#[serde(rename = "n")]  
N,
#[serde(rename = "unc")]
Unc,
```

This has been fixed in the current `src/japanese_types.rs` file.

## 📈 Performance Analysis

### **Current Performance**
- **Memory Usage**: ~2GB peak during processing
- **Processing Time**: ~5-10 minutes for full dataset
- **Algorithm Complexity**: O(n + m) where n=Chinese entries, m=Japanese entries
- **I/O Pattern**: Sequential read, hash-based matching (O(1) lookups)

### **Performance Bottlenecks**

#### **❌ Issues**
1. **Japanese Dictionary Loading**: 124MB JSON loaded entirely into memory
2. **Single-threaded Processing**: No parallelization of dictionary parsing
3. **Memory Footprint**: All 336K entries kept in memory simultaneously
4. **Output Serialization**: 611MB JSON written in single operation

#### **✅ Optimizations Already Implemented**
1. **Streaming JSONL Parser**: Chinese dictionary parsed line-by-line
2. **HashMap Lookups**: O(1) dictionary matching performance
3. **Single-pass Algorithm**: Each dictionary processed only once
4. **Progress Reporting**: User feedback during long operations

### **Recommended Performance Improvements**

```rust
// 1. Streaming JSON Parser for Japanese Dictionary
use serde_json::Deserializer;
let file = File::open("japanese.json")?;
let reader = BufReader::new(file);
let stream = Deserializer::from_reader(reader).into_iter::<Word>();

// 2. Parallel Processing with Rayon
use rayon::prelude::*;
chinese_entries.par_iter().for_each(|entry| {
    // Process entries in parallel
});

// 3. Memory-mapped Files for Large Datasets
use memmap2::Mmap;
let mmap = unsafe { Mmap::map(&file)? };

// 4. Streaming Output Writer
use serde_json::ser::Serializer;
let writer = BufWriter::new(File::create("output.json")?);
let mut serializer = Serializer::new(writer);
```

### **Scalability Considerations**
- **Current**: Handles ~350K entries efficiently
- **Projected**: Could scale to 1M+ entries with streaming optimizations
- **Memory**: Linear growth with dataset size (needs streaming for very large datasets)
- **Additional Languages**: Architecture supports easy extension

## 🔍 Quality Examples

Sample unified entries showing successful matches:

- **緊急** - Chinese: "urgent" ↔ Japanese: "urgency" ✅
- **反語** - Chinese: "irony" ↔ Japanese: "irony" ✅ (Perfect match)
- **浪費** - Chinese: "to waste" ↔ Japanese: "waste" ✅
- **爛** - Chinese: "rotten" ↔ Japanese: "brilliant" (Semantic drift - interesting!)

## 🛠️ Development

### OpenCC Integration for Japanese-Chinese Matching

The project uses **OpenCC (Open Chinese Convert)** to dramatically improve matching between Japanese kanji and Chinese traditional characters:

#### **🚀 Performance Breakthrough:**
- **Before**: Manual mapping with 4.74% unification rate
- **After**: OpenCC-powered mapping with **6.64% unification rate (+40% improvement!)**
- **Generated**: 68,801 comprehensive kanji conversions using `jp2t` configuration

#### **How It Works:**
1. **Extract unique kanji** from all JMDict entries (219,141 unique strings)
2. **Batch convert** using OpenCC's `jp2t` (Japanese to Traditional Chinese) configuration
3. **Generate Rust mapping** with 68,801 conversions automatically
4. **Runtime conversion** of Japanese kanji keys to Traditional Chinese for matching

#### **Regenerating Kanji Mapping:**
```bash
# Install OpenCC (macOS)
brew install opencc

# Generate comprehensive mapping from JMDict
python3 scripts/generate_kanji_mapping.py

# This creates:
# - src/kanji_mapping_generated.rs (3.2MB Rust code)
# - output/kanji_mapping.json (inspection file)
```

#### **Key Conversions Examples:**
- `学生` → `學生` (student)
- `国家` → `國家` (country)
- `会社` → `會社` (company)
- `読書` → `讀書` (reading)
- `運転` → `運轉` (driving)

### Adding New Dictionary Sources

1. Create type definitions using quicktype
2. Implement matching logic in `src/main.rs`
3. Update `CombinedEntry` structure as needed
4. Add language-specific entry arrays

### Testing

```bash
# Build and test
cargo build --release
./target/release/merge_dictionaries

# Validate output
python3 scripts/test_types.py
```

## � Future Enhancements

### **Performance Optimizations**
- **Streaming JSON Parser**: Replace `fs::read_to_string()` with streaming parser for Japanese dictionary
- **Parallel Processing**: Use rayon for multi-threaded dictionary processing
- **Memory-mapped I/O**: Use `memmap2` for very large dictionary files
- **Incremental Output**: Stream output JSON instead of writing 611MB at once
- **SIMD String Matching**: Vectorized character comparison for faster matching

### **Feature Enhancements**
- **Additional Languages**: Korean, Vietnamese, Thai dictionary integration
- **Fuzzy Matching**: Handle variant character forms and alternative spellings
- **Semantic Matching**: ML-based meaning similarity for better unification
- **API Server**: REST API for real-time dictionary queries
- **Export Formats**: Support for Anki, CSV, XML output formats
- **Compression**: Use binary formats (MessagePack, CBOR) for smaller output files

## 🐛 Troubleshooting

### Build Issues

```bash
# Clean build
cargo clean
cargo build --release

# Update Rust toolchain
rustup update
```

### Memory Issues

If you encounter OOM errors with large datasets:

```bash
# Increase system swap space or use a machine with more RAM
# The merger requires ~2GB RAM for the current dataset
```

### Type Generation Issues

```bash
# Regenerate all types
./scripts/generate_chinese_types.sh
# Then manually fix Japanese enums as described above
```

## 📚 Technical References

- **CC-CEDICT**: Chinese dictionary format specification
- **JMDict**: Japanese dictionary project documentation
- **Quicktype**: Code generation tool for JSON schemas
- **Serde**: Rust serialization framework
- **Unicode Han Database**: For character variant handling

## 📊 Dataset Information

### Chinese Dictionary (CC-CEDICT)
- **Format**: JSONL (JSON Lines)
- **Entries**: 145,580
- **Size**: ~70MB
- **Key Fields**: `simp`, `trad`, `pinyin`, `definitions`
- **Date**: 2025-06-25

### Japanese Dictionary (JMDict)
- **Format**: JSON
- **Entries**: 211,692 words
- **Size**: ~124MB
- **Key Fields**: `kanji`, `kana`, `sense`, `gloss`
- **Version**: 3.6.1

---

**Built with ❤️ in Rust for high-performance multilingual dictionary processing.**
