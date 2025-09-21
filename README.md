# Kiokun Dictionary Merger

A high-performance Rust application that merges Chinese and Japanese dictionaries into a unified multilingual dictionary with **semantic alignment** and advanced definition deduplication. This tool uses **OpenCC (Open Chinese Convert)** to intelligently match Japanese kanji with Traditional Chinese characters, then applies **automatic semantic alignment** to ensure the most semantically similar entries are unified, while preserving language-specific usages separately.

## 🎯 Key Features

- **🧠 Semantic Alignment**: Automatically finds the best Japanese reading that matches Chinese meanings
- **🔄 OpenCC Integration**: Intelligent Japanese kanji → Traditional Chinese character conversion
- **📊 Performance Optimized**: Individual JSON files for direct access (no grepping needed)
- **🌐 Complete Linguistic Data**: Character representations, examples, frequency statistics, metadata
- **🎌 Language-Specific Preservation**: Unique Japanese/Chinese usages kept separate

## 🎯 Project Overview

This dictionary merger creates a comprehensive Chinese-Japanese dictionary by intelligently combining entries from two separate dictionary sources into a modern, structured format with **semantic alignment**, unified definitions, and complete linguistic metadata.

### **🧠 Semantic Alignment Innovation**

The key innovation is **automatic semantic alignment** that ensures the most semantically similar Chinese and Japanese entries are unified:

- **Before**: 頭 unified with とう "counter for animals" (poor semantic match)
- **After**: 頭 unified with あたま "head" (perfect semantic match)
- **Result**: とう "counter for animals" moved to japanese_specific_entries

This creates a dictionary that helps users understand concepts from a **combined perspective** while preserving language-specific nuances.

### **Data Sources**
- **Chinese Dictionary**: 145,580 entries from CC-CEDICT format (JSONL, ~70MB)
- **Japanese Dictionary**: 211,692 entries from JMDict format (JSON, ~124MB)
- **J2C Mapping**: 68,801 Japanese-to-Chinese character conversions (OpenCC jp2t)

### **Current Output Formats**
- **Individual Files**: 22,135 unified entries as separate JSON files (106MB total)
- **Semantically Aligned**: 191 entries automatically realigned for better semantic matching
- **Unified Entries Only**: Entries containing both Chinese and Japanese data
- **Complete Linguistic Data**: Character representations, examples, statistics, metadata

## 📊 Current Results Summary

- **Total Source Entries**: 357,272 (145,580 Chinese + 211,692 Japanese)
- **Unified Entries Generated**: 22,135 (6.2% unification rate)
- **Semantic Realignments Applied**: 191 entries automatically improved
- **Individual JSON Files**: 22,135 files in `output_dictionary/`
- **Total Output Size**: 106MB (93% size reduction from full dataset)
- **Kanji Conversions**: 68,801 mappings using OpenCC jp2t configuration
- **Processing Time**: ~2-3 minutes on modern hardware

## 🏗️ Current Architecture

### **Modern Unified Dictionary Structure**

The current implementation uses an **improved unified format** that consolidates Chinese and Japanese definitions into a single coherent structure:

```rust
pub struct ImprovedUnifiedEntry {
    pub word: String,                                    // Traditional Chinese key
    pub unified: UnifiedSection,                         // ✅ Main unified data
    pub chinese_specific_entries: Vec<ChineseDictionaryElement>, // Additional Chinese entries
    pub japanese_specific_entries: Vec<Word>,            // Additional Japanese entries
    pub metadata: UnifiedMetadata,                       // Creation & confidence data
}

pub struct UnifiedSection {
    pub representations: CharacterRepresentations,       // All character forms + pinyin
    pub chinese_metadata: ChineseMetadata,               // Gloss, search strings
    pub definitions: Vec<UnifiedDefinition>,             // ✅ Consolidated definitions
    pub linguistic_info: LinguisticInfo,                 // Parts of speech, fields
    pub statistics: UnifiedStatistics,                   // Frequency, HSK, JLPT data
    pub examples: Vec<Example>,                          // Usage examples
}
```

### **Unified Definition System**

The core innovation is the **UnifiedDefinition** structure that merges Chinese and Japanese definitions:

```rust
pub struct UnifiedDefinition {
    pub text: String,                                    // The definition text
    pub source_language: String,                         // "unified", "chinese", "japanese"
    pub confidence: f32,                                 // 0.9 for exact matches, 0.7 for single-source
    pub source_entry_ids: Vec<String>,                   // Traceability to original entries

    // Language-specific context (optional)
    pub chinese_fields: Option<ChineseDefinitionFields>, // Pinyin, source, context
    pub japanese_fields: Option<JapaneseDefinitionFields>, // POS, fields, applies_to
}
```

### **Entry Processing Pipeline**

```rust
// Phase 1: Load and index dictionaries
let chinese_entries = load_chinese_dictionary("data/chinese_dictionary.jsonl")?;
let japanese_words = load_japanese_dictionary("data/jmdict-examples.json")?;
let j2c_mapping = load_j2c_mapping("output/j2c_mapping.json")?;

// Phase 2: Create combined entries with OpenCC matching
let combined_entries = merge_dictionaries(chinese_entries, japanese_words, &j2c_mapping)?;

// Phase 3: Apply semantic alignment (NEW!)
let aligned_dict = analysis::apply_semantic_alignment(combined_entries).await?;

// Phase 4: Convert to improved unified format
let unified_entries = convert_to_improved_unified(aligned_dict)?;

// Phase 5: Generate individual files (parallel processing)
unified_entries.par_iter().map(|entry| {
    let filename = create_safe_filename(&entry.word);
    let json = serde_json::to_string_pretty(entry)?;
    fs::write(format!("output_dictionary/{}.json", filename), json)?;
}).collect::<Result<Vec<_>, _>>()?;
```

### **Japanese-to-Chinese Matching Strategy**

The merger uses **OpenCC-powered character conversion** for intelligent matching:

1. **J2C Mapping Generation**: Extract all unique kanji from JMDict → Convert using OpenCC jp2t → Generate Rust HashMap
2. **Primary Matching**: Traditional Chinese characters (`trad` field) as primary keys
3. **Japanese Key Generation**:
   - Try `kanji[0].text` first
   - Convert using J2C mapping if available
   - Fallback to `kana[0].text` for kana-only words
4. **Unified Entry Creation**: Merge matching Chinese and Japanese entries into single `ImprovedUnifiedEntry`
5. **Definition Consolidation**: Combine definitions with confidence scoring and source attribution

## 🚀 Quick Start

### **Prerequisites**

- **Rust** (2021 edition or later)
- **Python 3** (for utility scripts)
- **OpenCC** (for Japanese-Chinese character conversion)
- **Node.js + quicktype** (for schema generation, optional)

```bash
# Install OpenCC (macOS)
brew install opencc

# Install quicktype (optional, for schema regeneration)
npm install -g quicktype
```

### **Build & Run**

```bash
# Clone and build
git clone <repository>
cd kiokun-data
cargo build --release

# Generate individual JSON files for unified entries
./target/release/merge_dictionaries --individual-files --unified-only

# Output: 22,135 JSON files in output_dictionary/
# Example: cat output_dictionary/學生.json
```

### **Command Line Options**

```bash
# Generate Japanese-to-Chinese mapping (one-time setup)
./target/release/merge_dictionaries --generate-j2c-mapping

# Generate individual files for all entries (not just unified)
./target/release/merge_dictionaries --individual-files

# Generate only unified entries with semantic alignment (recommended)
./target/release/merge_dictionaries --individual-files --unified-only

# Run semantic alignment analysis only (no file generation)
./target/release/merge_dictionaries --analysis

# Show help
./target/release/merge_dictionaries --help
```

## 📁 Complete Project Structure & File Guide

```
kiokun-data/
├── src/                                           # 🦀 Rust source code
│   ├── main.rs                                    # 🚀 Main entry point, CLI, pipeline orchestration
│   ├── analysis.rs                                # 🧠 Semantic alignment engine & analysis tools
│   ├── improved_unification_engine.rs             # ✅ Dictionary merging & unification logic
│   ├── improved_unified_types.rs                  # ✅ Modern unified data structures
│   ├── chinese_types.rs                           # 🇨🇳 Chinese dictionary type definitions (CC-CEDICT)
│   ├── japanese_types.rs                          # 🇯🇵 Japanese dictionary type definitions (JMDict)
│   ├── combined_types.rs                          # 🔄 Legacy combined types (deprecated)
│   ├── kanji_mapping_generated.rs                 # 🗾 68K+ J2C mappings (3.2MB, auto-generated)
│   └── schemas/                                   # 📋 Schema backups & type generation history
│       ├── chinese_types.rs                       # Backup of Chinese types
│       ├── japanese_types.rs                      # Backup of Japanese types
│       ├── combined_types.rs                      # Backup of legacy types
│       └── improved_unified_types.rs              # Backup of unified types
├── data/                                          # 📚 Source dictionaries (not in git)
│   ├── chinese_dictionary_word_2025-06-25.jsonl  # 145K Chinese entries (~70MB)
│   └── jmdict-examples-eng-3.6.1.json            # 212K Japanese entries (~124MB)
├── output/                                        # 🔄 Intermediate processing outputs
│   ├── j2c_mapping.json                           # Japanese→Chinese character mapping (runtime)
│   ├── kanji_mapping.json                         # Human-readable kanji conversions
│   └── combined_dictionary.json                   # Full combined dictionary (optional)
├── output_dictionary/                             # ✅ Final unified dictionary (22,135 files)
│   ├── 學生.json                                  # Individual entry: student
│   ├── 地圖.json                                  # Individual entry: map
│   ├── 頭.json                                    # Individual entry: head (semantically aligned)
│   ├── 博士.json                                  # Individual entry: doctor (semantically aligned)
│   └── ... (22,131 more files)                   # All unified entries (106MB total)
├── scripts/                                       # 🛠️ Utility scripts & tools
│   ├── generate_chinese_types.sh                  # Auto-generate Chinese type definitions
│   ├── generate_kanji_mapping.py                  # Create J2C mapping using OpenCC
│   ├── jsonl_to_json.py                           # Convert JSONL to JSON format
│   └── test_types.py                              # Validate type definitions
├── target/                                        # 🚀 Rust build outputs
│   ├── debug/                                     # Debug builds
│   └── release/                                   # Release builds
│       └── merge_dictionaries                     # Main executable (optimized)
├── README.md                                      # 📖 This comprehensive guide
├── README_TYPES.md                                # 📋 Type generation documentation
├── UNIFIED_DEFINITIONS_PLAN.md                    # 🔮 Future deduplication roadmap
└── Cargo.toml                                     # 📦 Rust project configuration
```

### **🔍 Key File Explanations**

#### **Core Source Files**

- **`src/main.rs`** (594 lines): Main application entry point
  - CLI argument parsing with `clap`
  - Dictionary loading pipeline orchestration
  - Semantic alignment integration
  - Individual file generation coordination
  - Statistics reporting and error handling

- **`src/analysis.rs`** (866 lines): Semantic alignment engine
  - `apply_semantic_alignment()`: Main realignment function
  - `calculate_semantic_similarity()`: Core similarity algorithm
  - `run_analysis()`: Analysis mode for debugging
  - Keyword matching, category-based similarity, stop word filtering

- **`src/improved_unification_engine.rs`**: Dictionary merging logic
  - `merge_dictionaries_with_mapping()`: Core unification algorithm
  - `convert_to_improved_unified()`: Transform to modern format
  - OpenCC integration for Japanese-Chinese character matching
  - Definition consolidation and confidence scoring

- **`src/improved_unified_types.rs`**: Modern data structures
  - `ImprovedUnifiedEntry`: Main unified entry structure
  - `UnifiedSection`: Core unified data (representations with pinyin, definitions)
  - `UnifiedDefinition`: Consolidated definition with source attribution
  - Complete type safety for all dictionary operations

#### **Dictionary Type Definitions**

- **`src/chinese_types.rs`**: CC-CEDICT format types
  - `ChineseDictionaryElement`: Individual Chinese dictionary entry
  - Pinyin, traditional/simplified characters, definitions, statistics
  - Auto-generated from JSON schema using quicktype

- **`src/japanese_types.rs`**: JMDict format types
  - `Word`: Individual Japanese dictionary entry
  - Kanji, kana, sense arrays with complex nested structures
  - Manual enum fixes for part-of-speech deserialization

- **`src/kanji_mapping_generated.rs`** (68,814 lines): OpenCC mappings
  - `KANJI_TO_TRADITIONAL_MAP`: 68,801 Japanese→Chinese conversions
  - Auto-generated from OpenCC jp2t configuration
  - Enables intelligent character matching for unification

#### **Output Structure**

- **`output_dictionary/*.json`**: Individual unified entries
  - One file per unified word (e.g., `學生.json`, `地圖.json`)
  - Minified JSON for performance (no pretty printing)
  - Direct file access without grepping large files
  - Complete linguistic data: character representations, definitions, examples, statistics

## 🧠 Semantic Alignment System

### **The Problem**

Traditional dictionary unification often produces poor semantic matches:

```
頭 (head) - Chinese: "head"
├── Japanese Option 1: とう "counter for large animals" ❌ Poor match
└── Japanese Option 2: あたま "head" ✅ Perfect match
```

Without semantic alignment, the first Japanese entry found gets unified, leading to confusing results.

### **The Solution: Automatic Semantic Alignment**

The semantic alignment engine analyzes all Japanese entries for each unified word and selects the best semantic match:

```rust
// Core algorithm in src/analysis.rs
fn calculate_semantic_similarity(japanese_gloss: &str, chinese_gloss: &str) -> f64 {
    // 1. Normalize and tokenize both glosses
    let jp_words = normalize_and_tokenize(japanese_gloss);
    let cn_words = normalize_and_tokenize(chinese_gloss);

    // 2. Calculate word-by-word similarity
    for jp_word in &jp_words {
        for cn_word in &cn_words {
            if jp_word == cn_word {
                score += 1.0; // Exact match
            } else if jp_word.contains(cn_word) || cn_word.contains(jp_word) {
                score += 0.7; // Partial match
            } else {
                score += calculate_category_similarity(jp_word, cn_word); // Semantic categories
            }
        }
    }

    // 3. Normalize by total comparisons
    score / total_comparisons
}
```

### **Semantic Categories**

The system uses 12 semantic categories for intelligent matching:

```rust
let categories = vec![
    ("person", vec!["person", "people", "human", "doctor", "teacher", "expert"]),
    ("animal", vec!["animal", "bird", "fish", "whale", "horse", "cattle"]),
    ("body", vec!["head", "body", "hand", "foot", "eye", "nose"]),
    ("time", vec!["time", "day", "night", "future", "past", "hour"]),
    ("place", vec!["place", "location", "area", "region", "country"]),
    // ... 7 more categories
];
```

### **Real Examples of Successful Realignments**

#### **頭 (head) - Perfect Match**
- **Before**: とう "counter for large animals" (score: 0.4)
- **After**: あたま "head" (score: 1.0) ✅
- **Result**: Perfect semantic alignment, counter moved to japanese_specific_entries

#### **博士 (doctor) - Professional Title**
- **Before**: はかせ "expert" (score: 0.5)
- **After**: はくし "doctor" (score: 1.0) ✅
- **Result**: Exact professional title match, expert moved to alternatives

#### **來日 (future days) - Temporal Concept**
- **Before**: らいにち "coming to Japan" (score: 0.0)
- **After**: らいじつ "future day" (score: 0.675) ✅
- **Result**: Temporal concept alignment, Japan-specific meaning preserved

### **Performance Results**

- **Total Entries Analyzed**: 1,016 unified entries with multiple Japanese readings
- **Realignments Applied**: 191 entries (18.8% improvement rate)
- **Processing Time**: ~30 seconds additional processing
- **Success Rate**: 100% of test cases correctly identified and realigned

### **Integration in Pipeline**

```rust
// Semantic alignment is automatically applied during generation
let combined_dict = merge_dictionaries_with_mapping(chinese_entries, japanese_dict.words, j2c_mapping);
let aligned_dict = analysis::apply_semantic_alignment(combined_dict).await?; // ← NEW STEP
let unified_entries = convert_to_improved_unified(aligned_dict)?;
```

## 🔍 Example Output Structure

### **Unified Entry Example (頭 - "head") - Semantically Aligned**

This example shows how semantic alignment improved the unification:

```json
{
  "word": "頭",
  "unified": {
    "representations": {
      "traditional": "頭",
      "simplified": "头",
      "chinese_pinyin": [
        {"reading": "tóu", "source": "Unicode"},
        {"reading": "tou", "source": "Unicode"}
      ],
      "japanese_kanji": [{"text": "頭", "common": true, "tags": []}],
      "japanese_kana": [
        {"text": "あたま", "common": true, "tags": [], "applies_to_kanji": ["*"]},
        {"text": "かしら", "common": true, "tags": [], "applies_to_kanji": ["*"]}
      ]
    },
    "chinese_metadata": {
      "gloss": "head",
      "pinyin_search_string": "tóu tou2 tou"
    },
    "definitions": [
      {
        "text": "head",
        "source_language": "unified", // ← Semantically aligned!
        "confidence": 0.9,
        "source_entry_ids": ["chinese:Unicode", "1582310"],
        "chinese_fields": {"source": "Unicode", "pinyin": "tóu"},
        "japanese_fields": {"part_of_speech": ["N"], "applies_to_kanji": ["*"]}
      },
      {
        "text": "mind",
        "source_language": "japanese",
        "confidence": 0.7,
        "source_entry_ids": ["1582310"],
        "japanese_fields": {"part_of_speech": ["N"], "applies_to_kana": ["あたま"]}
      }
    ],
    "statistics": {
      "chinese": {"hsk_level": 2, "movie_word_rank": 307},
      "japanese": {"common": true, "jlpt_level": null}
    }
  },
  "chinese_specific_entries": [],
  "japanese_specific_entries": [
    {
      "source_id": "1450690", // ← Moved here by semantic alignment
      "kanji": [{"text": "頭", "common": true, "tags": []}],
      "kana": [{"text": "とう", "common": true, "tags": [], "applies_to_kanji": ["*"]}],
      "definitions": [
        {
          "text": "counter for large animals (e.g. head of cattle)",
          "source_language": "japanese",
          "confidence": 0.7,
          "japanese_fields": {"part_of_speech": ["Ctr"]}
        }
      ]
    }
  ],
  "metadata": {
    "created_at": "2025-09-21 04:09:02 UTC",
    "merger_version": "3.0-improved-unified",
    "unification_confidence": 1.0,
    "has_multiple_japanese_entries": true // ← Indicates semantic alignment was applied
  }
}
```

**Key Improvements:**
- ✅ **Primary unified entry**: あたま "head" (perfect semantic match with Chinese "head")
- ✅ **Japanese-specific entry**: とう "counter for animals" (preserved but separated)
- ✅ **Clear structure**: Users see the most relevant meaning first, with alternatives available
- ✅ **No duplication**: Pinyin moved to representations, eliminating redundant pronunciation data

## 🏗️ Improved Structure: Eliminated Duplication

### **Problem Solved: Redundant Pronunciation Data**

The previous structure had **duplication** where kana readings appeared in both sections:
```json
// OLD: Duplicated structure
{
  "representations": {
    "japanese_kana": [{"text": "ひきがえる", "applies_to_kanji": ["蟇","蟇蛙"]}]
  },
  "pronunciations": {
    "japanese": [{"reading": "ひきがえる", "reading_type": "hiragana"}] // ← DUPLICATE!
  }
}
```

### **Solution: Consolidated Representations**

The **new structure eliminates duplication** by moving all character representations to one place:
```json
// NEW: Clean, consolidated structure
{
  "representations": {
    "chinese_pinyin": [{"reading": "má", "source": "Cedict"}], // ← Moved here
    "japanese_kana": [{"text": "ひきがえる", "applies_to_kanji": ["蟇","蟇蛙"]}]
  }
  // No more "pronunciations" section!
}
```

### **Benefits of New Structure**
- ✅ **No Duplication**: Each reading appears only once
- ✅ **Logical Grouping**: All character forms and readings in one place
- ✅ **Rich Mappings Preserved**: Complex `applies_to_kanji` relationships maintained
- ✅ **Cleaner JSON**: Eliminated entire redundant section
- ✅ **Better Performance**: Smaller file sizes, faster parsing

## 🔧 Development & Type Generation

### **Current Type System**

The project uses **quicktype** to generate type-safe Rust structs from JSON data, with manual fixes for enum deserialization:

- **`src/chinese_types.rs`**: Chinese dictionary types (CC-CEDICT format)
- **`src/japanese_types.rs`**: Japanese dictionary types (JMDict format)
- **`src/improved_unified_types.rs`**: Modern unified dictionary structure
- **`src/schemas/`**: Backup copies of all type definitions

### **Regenerating Types**

```bash
# Chinese types (automated)
./scripts/generate_chinese_types.sh

# Japanese types (requires manual enum fixes)
quicktype --lang rust \
  --src data/jmdict-examples-eng-3.6.1.json \
  -o src/schemas/japanese_types.rs \
  --top-level JapaneseEntry \
  --density dense --visibility public \
  --derive-debug --derive-clone --derive-partial-eq \
  --skip-serializing-none --edition-2018

# ⚠️ Then manually fix enum serde attributes (see Known Issues)
```

## ⚠️ Known Issues & Solutions

### **1. Quicktype Enum Deserialization Bug**

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

✅ **Status**: Fixed in current `src/japanese_types.rs`

### **2. Chinese Classifier (CL) Information**

**Issue**: Chinese classifier information like `"CL:張|张[zhāng],本[běn]"` is currently treated as regular definitions.

**Context**: CL stands for "Classifier" (measure words). For 地圖 (map):
- `張/张 (zhāng)`: for flat objects → 一張地圖 (one map)
- `本 (běn)`: for books → 一本地圖 (one atlas)

**Future Enhancement**: Parse and structure classifier information separately from definitions.

### **3. Definition Deduplication Opportunities**

**Current State**: Unified entries may contain similar/duplicate definitions:
- 忍耐: `"patience"`, `"endurance"`, `"perseverance"` (semantic similarity)
- 綠色: `"green"` vs `"green color"` (exact similarity)
- 試演: `"audition"`, `"rehearsal"`, `"dress rehearsal"` (semantic clustering)

**Future Enhancement**: Implement semantic deduplication (see `UNIFIED_DEFINITIONS_PLAN.md`)

## 📈 Performance Analysis

### **Current Performance (v3.0)**
- **Memory Usage**: ~1.5GB peak during processing (improved from 2GB)
- **Processing Time**: ~2-3 minutes for full dataset (improved from 5-10 minutes)
- **Algorithm Complexity**: O(n + m) where n=Chinese entries, m=Japanese entries
- **I/O Pattern**: Sequential read, hash-based matching, parallel file generation

### **✅ Optimizations Implemented**

#### **1. Parallel File Generation**
```rust
// Using Rayon for parallel individual file generation
unified_entries.par_iter().map(|entry| {
    let filename = create_safe_filename(&entry.word);
    let json = serde_json::to_string_pretty(entry)?;
    fs::write(format!("output_dictionary/{}.json", filename), json)?;
}).collect::<Result<Vec<_>, _>>()?;
```

#### **2. Efficient Data Structures**
- **HashMap Lookups**: O(1) dictionary matching performance
- **Streaming JSONL Parser**: Chinese dictionary parsed line-by-line
- **Single-pass Algorithm**: Each dictionary processed only once
- **Memory-efficient Conversion**: Direct transformation to unified format

#### **3. OpenCC Integration**
- **Batch Processing**: 68,801 kanji conversions pre-generated
- **Runtime Mapping**: O(1) HashMap lookups for J2C conversion
- **Optimized Matching**: Intelligent fallback from kanji→kana→skip

### **Current Bottlenecks & Future Improvements**

#### **❌ Remaining Issues**
1. **Japanese Dictionary Loading**: 124MB JSON still loaded entirely into memory
2. **Memory Footprint**: All entries kept in memory during processing
3. **Single-threaded Parsing**: Dictionary loading not parallelized

#### **🚀 Recommended Next Steps**
```rust
// 1. Streaming JSON Parser for Japanese Dictionary
use serde_json::Deserializer;
let file = File::open("japanese.json")?;
let reader = BufReader::new(file);
let stream = Deserializer::from_reader(reader).into_iter::<Word>();

// 2. Memory-mapped Files for Very Large Datasets
use memmap2::Mmap;
let mmap = unsafe { Mmap::map(&file)? };

// 3. Incremental Processing Pipeline
for chunk in entries.chunks(10000) {
    process_chunk_parallel(chunk)?;
    // Reduce peak memory usage
}
```

### **Scalability Assessment**
- **Current Capacity**: 357K entries processed efficiently
- **Projected Scaling**: 1M+ entries possible with streaming optimizations
- **Memory Growth**: Linear with dataset size
- **Multi-language Support**: Architecture ready for Korean, Vietnamese, etc.

## 🔍 Quality Examples & Results

### **Successful Unified Entries**

#### **Perfect Semantic Matches**
- **學生** (student): Chinese `"student"` + Japanese `"student (esp. university student)"` ✅
- **綠色** (green): Chinese `"green"` + Japanese `"green color"` ✅
- **地圖** (map): Chinese `"map"` + Japanese `"atlas"`, `"chart"`, `"plan"` ✅

#### **Rich Linguistic Data**
- **忍耐** (patience): 7 definitions including `"patience"`, `"endurance"`, `"perseverance"`, `"to endure"`, `"to bear with"`
- **同胞** (compatriot): 8 definitions covering `"compatriot"`, `"sibling"`, `"fellow citizen"`, `"brethren"`
- **試演** (rehearsal): 6 definitions from `"audition"` to `"dress rehearsal"` to `"trial performance"`

#### **Complete Metadata Preservation**
```json
// Example: 忍耐 includes HSK level, frequency data, pronunciation, examples
{
  "statistics": {
    "chinese": {"hsk_level": 7, "movie_word_rank": 7782},
    "japanese": {"common": true, "jlpt_level": null}
  },
  "examples": [
    {
      "text": "彼の忍耐強さには驚いた。",
      "translation": "I wondered at his perseverance."
    }
  ]
}
```

## 🛠️ OpenCC Integration & J2C Mapping

### **Japanese-Chinese Character Conversion System**

The project uses **OpenCC (Open Chinese Convert)** for intelligent Japanese kanji → Traditional Chinese matching:

#### **🚀 Conversion Performance**
- **Mapping Size**: 68,801 Japanese→Chinese character conversions
- **Coverage**: Handles complex kanji variants and traditional forms
- **Generated File**: `src/kanji_mapping_generated.rs` (3.2MB of Rust code)
- **Unification Improvement**: Enables 6.2% unification rate from raw dictionaries

#### **Key Conversion Examples**
```
学生 → 學生 (student)        会社 → 會社 (company)
国家 → 國家 (country)        読書 → 讀書 (reading)
地図 → 地圖 (map)           運転 → 運轉 (driving)
緑色 → 綠色 (green)         忍耐 → 忍耐 (patience)
```

#### **Regenerating J2C Mapping**
```bash
# Prerequisites
brew install opencc  # macOS
# or: apt-get install opencc  # Ubuntu

# Generate mapping from JMDict entries
python3 scripts/generate_kanji_mapping.py

# Output files:
# - src/kanji_mapping_generated.rs (Rust HashMap)
# - output/kanji_mapping.json (human-readable)
# - output/j2c_mapping.json (runtime mapping)
```

#### **Runtime Matching Process**
```rust
// 1. Extract Japanese kanji
let japanese_key = word.kanji[0].text.clone(); // e.g., "学生"

// 2. Convert using J2C mapping
let chinese_key = j2c_mapping.get(&japanese_key)
    .unwrap_or(&japanese_key); // e.g., "學生"

// 3. Look up in Chinese dictionary
if let Some(chinese_entry) = chinese_dict.get(chinese_key) {
    // Create unified entry!
}
```

## 🧪 Development & Testing

### **Adding New Dictionary Sources**

The architecture supports easy extension to additional languages:

```rust
// 1. Define types for new language
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KoreanDictionaryElement {
    pub hangul: String,
    pub hanja: Option<String>,
    pub definitions: Vec<String>,
    // ... other fields
}

// 2. Extend unified entry structure
pub struct ImprovedUnifiedEntry {
    // ... existing fields
    pub korean_specific_entries: Vec<KoreanDictionaryElement>, // Add new language
}

// 3. Implement matching logic
fn match_korean_entries(korean_entries: Vec<KoreanDictionaryElement>,
                       existing_map: &mut HashMap<String, CombinedEntry>) {
    // Match using hanja characters or other strategies
}
```

### **Testing & Validation**

```bash
# Build and run full pipeline with semantic alignment
cargo build --release
./target/release/merge_dictionaries --individual-files --unified-only

# Run semantic alignment analysis only (for debugging)
./target/release/merge_dictionaries --analysis

# Validate specific semantically aligned entries
cat output_dictionary/頭.json | jq '.unified.representations.japanese_kana[0].text'  # Should be "あたま"
cat output_dictionary/博士.json | jq '.unified.representations.japanese_kana[0].text'  # Should be "はくし"
cat output_dictionary/來日.json | jq '.unified.representations.japanese_kana[0].text'  # Should be "らいじつ"

# Check semantic alignment results
cat output_dictionary/頭.json | jq '.japanese_specific_entries[].kana[0].text'  # Should show "とう"
cat output_dictionary/博士.json | jq '.japanese_specific_entries[].kana[0].text'  # Should show "はかせ"

# Check output statistics
find output_dictionary -name "*.json" | wc -l  # Should be 22,135
du -sh output_dictionary/                      # Should be ~106MB

# Validate type consistency
python3 scripts/test_types.py
```

### **Quality Assurance**

```bash
# Check for common issues
grep -r "null" output_dictionary/*.json | head -5  # Look for unexpected nulls
jq '.unified.definitions | length' output_dictionary/*.json | sort -nr | head -10  # Find entries with most definitions

# Validate unified definition structure
cat output_dictionary/忍耐.json | jq '.unified.definitions[] | select(.source_language == "unified")'
```

## �‍💻 Developer Onboarding Guide

### **Getting Started as a New Developer**

#### **1. Understanding the Codebase (30 minutes)**

```bash
# Clone and explore
git clone <repository>
cd kiokun-data

# Read the key files in order:
cat README.md                           # This comprehensive guide
cat src/main.rs                         # Main pipeline (594 lines)
cat src/analysis.rs                     # Semantic alignment (866 lines)
cat src/improved_unification_engine.rs  # Dictionary merging logic
cat src/improved_unified_types.rs       # Data structures
```

#### **2. Build and Test (15 minutes)**

```bash
# Install dependencies
brew install opencc  # macOS
# or: apt-get install opencc  # Ubuntu

# Build (first time takes ~1 minute)
cargo build --release

# Test with analysis mode (fast, no file generation)
./target/release/merge_dictionaries --analysis

# Full test (generates 22,135 files, ~3 minutes)
./target/release/merge_dictionaries --individual-files --unified-only
```

#### **3. Key Concepts to Understand**

- **OpenCC Integration**: Japanese kanji → Traditional Chinese character conversion
- **Semantic Alignment**: Automatic selection of best Japanese reading for Chinese meaning
- **Unified Structure**: Combined Chinese-Japanese entries with language-specific alternatives
- **Individual Files**: Performance optimization for direct file access

#### **4. Common Development Tasks**

```bash
# Add new semantic categories (src/analysis.rs)
let categories = vec![
    ("your_category", vec!["word1", "word2", "word3"]),
    // ... existing categories
];

# Modify similarity scoring (src/analysis.rs)
fn calculate_semantic_similarity(jp_gloss: &str, cn_gloss: &str) -> f64 {
    // Your improvements here
}

# Add new CLI flags (src/main.rs)
let matches = Command::new("merge_dictionaries")
    .arg(Arg::new("your-flag").long("your-flag").help("Your description"))
    // ... existing args

# Extend unified structure (src/improved_unified_types.rs)
pub struct ImprovedUnifiedEntry {
    // ... existing fields
    pub your_new_field: YourType,
}
```

## �🚀 Future Enhancements

### **Phase 1: Enhanced Semantic Alignment (In Progress)**
- ✅ **Basic Semantic Alignment**: Implemented (191 entries realigned)
- 🔄 **Synonym Integration**: Add WordNet/ConceptNet for better similarity
- 🔄 **ML-based Similarity**: Use sentence embeddings for semantic matching
- 🔄 **User Feedback Loop**: Allow manual corrections to improve algorithm

### **Phase 2: Definition Deduplication (Planned)**
- **Semantic Clustering**: Group similar definitions (`"patience"`, `"endurance"`, `"perseverance"`)
- **Exact Match Merging**: Combine identical definitions with source attribution
- **Grammatical Consolidation**: Group verb forms (`"to endure"`, `"to bear with"`)
- **Specificity Handling**: Merge general/specific variants (`"student"` vs `"university student"`)

### **Phase 3: Enhanced Linguistic Features**
- **Classifier Parsing**: Structure Chinese measure words (`CL:張|张[zhāng],本[běn]`)
- **Etymology Tracking**: Preserve word origin and historical development
- **Usage Frequency**: Integrate corpus-based frequency data
- **Semantic Networks**: Link related words and antonyms

### **Phase 4: Performance & Scale**
- **Streaming JSON Parser**: Handle arbitrarily large dictionaries
- **Incremental Updates**: Support dictionary updates without full rebuild
- **Compressed Storage**: Binary formats for production deployment
- **API Server**: REST/GraphQL interface for real-time queries

### **Phase 5: Multi-language Expansion**
- **Korean Integration**: Hangul-Hanja matching with Chinese characters
- **Vietnamese Support**: Chữ Nôm historical character matching
- **Thai Dictionary**: Royal Institute dictionary integration
- **Cross-language Semantic Matching**: ML-based meaning similarity

## 🐛 Troubleshooting

### **Build Issues**

```bash
# Clean build
cargo clean
cargo build --release

# Update Rust toolchain
rustup update stable

# Check for missing dependencies
cargo check
```

### **Runtime Issues**

```bash
# Memory issues (current requirement: ~1.5GB)
# Increase system swap or use machine with more RAM

# Missing data files
ls -la data/  # Should contain both dictionary files
ls -la output/j2c_mapping.json  # Should exist after first run

# Permission issues
chmod +x target/release/merge_dictionaries
```

### **Output Validation**

```bash
# Check output directory
ls -la output_dictionary/ | head -5
find output_dictionary -name "*.json" | wc -l  # Should be 22,135

# Validate JSON structure
cat output_dictionary/學生.json | jq '.' > /dev/null  # Should not error
cat output_dictionary/地圖.json | jq '.unified.definitions | length'  # Should show definition count
```

### **Type Generation Issues**

```bash
# Regenerate Chinese types
./scripts/generate_chinese_types.sh

# Regenerate Japanese types (requires manual enum fixes)
quicktype --lang rust --src data/jmdict-examples-eng-3.6.1.json -o src/schemas/japanese_types.rs
# Then copy to src/japanese_types.rs and fix enums
```

## 📚 Technical References & Standards

### **Dictionary Standards**
- **[CC-CEDICT](https://cc-cedict.org/)**: Community-maintained Chinese-English dictionary
- **[JMDict](http://www.edrdg.org/jmdict/j_jmdict.html)**: Japanese-Multilingual Dictionary Project
- **[OpenCC](https://github.com/BYVoid/OpenCC)**: Open Chinese Convert for character conversion

### **Technical Stack**
- **[Rust](https://www.rust-lang.org/)**: Systems programming language (2021 edition)
- **[Serde](https://serde.rs/)**: Serialization framework for Rust
- **[Rayon](https://github.com/rayon-rs/rayon)**: Data parallelism library
- **[Quicktype](https://quicktype.io/)**: Code generation from JSON schemas

### **Unicode & Character Handling**
- **[Unicode Han Database](https://www.unicode.org/reports/tr38/)**: CJK character specifications
- **[Traditional/Simplified Mapping](https://github.com/BYVoid/OpenCC/tree/master/data)**: OpenCC conversion tables

## 📊 Current Dataset Information

### **Chinese Dictionary (CC-CEDICT)**
- **Format**: JSONL (JSON Lines, streaming-friendly)
- **Entries**: 145,580 words
- **File Size**: ~70MB
- **Key Fields**: `simp`, `trad`, `pinyin`, `definitions`, `statistics`
- **Date**: 2025-06-25
- **Encoding**: UTF-8

### **Japanese Dictionary (JMDict)**
- **Format**: JSON (single large object)
- **Entries**: 211,692 words
- **File Size**: ~124MB
- **Key Fields**: `kanji`, `kana`, `sense`, `gloss`, `examples`
- **Version**: 3.6.1 (English glosses)
- **Encoding**: UTF-8

### **Generated Outputs**
- **Individual Files**: 22,135 JSON files (106MB total)
- **J2C Mapping**: 68,801 kanji conversions (3.2MB Rust code)
- **Unification Rate**: 6.2% (22,135 unified / 357,272 total entries)
- **Average File Size**: ~4.8KB per unified entry

---

## 📈 Project Status & Metrics

- **Current Version**: 3.2 - Structural Optimization Edition
- **Lines of Code**: ~70,000 (including generated mappings)
- **Test Coverage**: Manual validation of key semantic alignments
- **Performance**: 357K entries processed in ~3 minutes
- **Memory Usage**: ~1.5GB peak during processing
- **Output Quality**: 191 semantic improvements + structural optimization (eliminated duplication)

---

**Built with ❤️ in Rust for high-performance multilingual dictionary processing with intelligent semantic alignment.**

*Last updated: September 2025 | Version 3.2 - Structural Optimization Edition*
