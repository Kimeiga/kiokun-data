# Character Dictionary Integration

## Overview

This document describes the integration of character-level dictionaries (KANJIDIC2 and Chinese character dictionary) into the kiokun-data project, including character-level mapping generation, dictionary merging, and unified output generation.

## Implementation Steps

### 1. Character-Level Mapping Generation

**Script**: `scripts/generate_character_mapping.py`

This script extends the existing `j2c_mapping.json` file with character-level mappings from KANJIDIC2 to Chinese character dictionary using OpenCC.

**Process**:
1. Extracts all unique kanji characters from KANJIDIC2 (10,383 characters)
2. Uses OpenCC `jp2t` (Japanese to Traditional Chinese) conversion in batch mode
3. Generates 367 character-level conversions (3.5% conversion rate)
4. Merges with existing word-level mappings (6,379 entries)
5. Outputs updated `output/j2c_mapping.json` with 6,493 total mappings

**Why low conversion rate?**
Most kanji are already identical to their Traditional Chinese equivalents. Only simplified or variant forms need conversion (e.g., 学 → 學, 国 → 國).

**Coverage Analysis**:
- KANJIDIC2 characters: 10,383
- Chinese dictionary characters: 93,845
- Characters with mapping: 367
- Kanji that map to Chinese dict: 367 (3.5%)
- Chinese chars from Kanji: 366 (0.4%)

### 2. Unified Character Types

**File**: `src/unified_character_types.rs`

Created comprehensive type definitions for unified character entries:

```rust
pub struct UnifiedCharacterEntry {
    pub character: String,
    pub codepoint: String,
    pub representations: CharacterRepresentations,
    pub decomposition: Option<CharacterDecomposition>,
    pub meanings: CharacterMeanings,
    pub linguistic_info: CharacterLinguisticInfo,
    pub visual_info: CharacterVisualInfo,
    pub statistics: Option<CharacterStatistics>,
    pub sources: CharacterSources,
}
```

**Key Features**:
- **Representations**: Chinese (pinyin, traditional, simplified) + Japanese (onyomi, kunyomi, nanori)
- **Decomposition**: IDS data with optional apparent structure
- **Meanings**: English meanings, Chinese gloss, Shuowen etymology
- **Linguistic Info**: Radicals, grade level, JLPT level, frequency
- **Visual Info**: Stroke count, historical images, variants
- **Statistics**: Separate Chinese and Japanese statistics
- **Sources**: Tracks which dictionaries contain the character

### 3. Character Merging Logic

**Functions in `src/main.rs`**:

#### `merge_character_dictionaries()`
Main merging function that:
1. Indexes Chinese characters by character string
2. Processes each Japanese kanji:
   - Tries direct character match
   - Falls back to j2c_mapping for converted forms
   - Merges data from both sources if match found
   - Creates Japanese-only entry if no match
3. Adds Chinese-only characters not in KANJIDIC2

**Results**:
- Total unified characters: 92,829
- Matched (in both dictionaries): 10,383
- Japanese-only: 0 (all kanji matched)
- Chinese-only: 82,446

#### Helper Functions:
- `merge_single_character()` - Merges a single kanji with optional Chinese data
- `create_chinese_only_character()` - Creates entry for Chinese-only characters
- `build_character_representations()` - Extracts readings from both sources
- `build_decomposition()` - Combines IDS data (prefers kanji, falls back to Chinese)
- `build_character_meanings()` - Merges English meanings, Chinese gloss, Shuowen
- `build_character_linguistic_info()` - Extracts radicals, grade, JLPT, frequency
- `build_character_visual_info()` - Combines stroke count, images, variants
- `build_character_statistics()` - Merges statistics from both sources
- `build_character_sources()` - Tracks source information and dictionary references

### 4. Output Generation

**Function**: `generate_individual_character_files()`

Generates individual JSON files for each character in `output_dictionary/characters/`.

**Output Statistics**:
- Total files generated: 92,829
- Location: `output_dictionary/characters/`
- Format: `{character}.json` (e.g., `好.json`, `字.json`)
- File size: ~700B - 2KB per character

## Example Output

### Character: 好 (good)

```json
{
  "character": "好",
  "codepoint": "597d",
  "representations": {
    "chinese": {
      "pinyin": [],
      "traditional": null,
      "simplified": null
    },
    "japanese": {
      "onyomi": ["コウ"],
      "kunyomi": ["この.む", "す.く", "よ.い", "い.い"],
      "nanori": ["こ", "たか", "とし", "よし"]
    }
  },
  "decomposition": {
    "ids": "⿰女子",
    "ids_apparent": null,
    "components": null
  },
  "meanings": {
    "english": ["fond", "pleasing", "like something"],
    "chinese_gloss": "good",
    "shuowen": "《說文》："好，美也。从女、子。""
  },
  "linguistic_info": {
    "radicals": [{"radical_type": "classical", "value": 38}],
    "grade": 4,
    "jlpt": 3,
    "frequency": 423
  },
  "visual_info": {
    "stroke_count": 6,
    "images": [
      {
        "source": "academia-sinica",
        "url": "https://data.dong-chinese.com/img/sinica/%E5%A5%BD_0.png",
        "description": "鐵31.1(甲)",
        "image_type": "Oracle",
        "era": "(~1250-1000 BC)"
      },
      // ... 14 more historical images
    ],
    "variants": [
      {"variant_type": "academia-sinica", "character": "好", "parts": ["女子"]},
      {"variant_type": "academia-sinica", "character": "𡥆", "parts": ["丑子"]}
    ]
  },
  "statistics": {
    "chinese": {
      "hsk_level": 1,
      "frequency_rank": 15,
      "general_standard_num": null
    },
    "japanese": {
      "frequency": 423,
      "grade": 4,
      "jlpt": 3
    }
  },
  "sources": {
    "in_kanjidic": true,
    "in_chinese_dict": true,
    "kanjidic_id": "好",
    "chinese_dict_id": "5f523afdde54193ed8730cf3",
    "dictionary_references": [
      {"reference_type": "nelson_c", "value": "1191", "morohashi": null},
      {"reference_type": "moro", "value": "6053", "morohashi": {"volume": 3, "page": 627}},
      // ... 21 more dictionary references
    ]
  }
}
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Load Source Data                                         │
├─────────────────────────────────────────────────────────────┤
│ • KANJIDIC2 (10,383 kanji)                                  │
│ • Chinese Character Dict (93,831 characters)                │
│ • IDS Database (33,994 characters with decomposition)       │
│ • j2c_mapping.json (6,493 mappings)                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Enrich with IDS Data                                     │
├─────────────────────────────────────────────────────────────┤
│ • Add IDS decomposition to Chinese chars (27,126 enriched)  │
│ • Add IDS decomposition to Japanese kanji (9,980 enriched)  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Merge Character Dictionaries                             │
├─────────────────────────────────────────────────────────────┤
│ • Match kanji to Chinese characters (direct + j2c_mapping)  │
│ • Merge data from both sources                              │
│ • Create unified character entries                          │
│ • Result: 92,829 unified characters                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Generate Output Files                                    │
├─────────────────────────────────────────────────────────────┤
│ • Individual JSON file per character                        │
│ • Location: output_dictionary/characters/{character}.json   │
│ • 92,829 files generated                                    │
└─────────────────────────────────────────────────────────────┘
```

## Usage

### Generate Character Mapping
```bash
python3 scripts/generate_character_mapping.py
```

### Generate Character Files
```bash
cargo run --bin merge_dictionaries -- --individual-files
```

### View Character Data
```bash
cat output_dictionary/characters/好.json | jq '.'
```

## Benefits for Learners

1. **Comprehensive Character Information**: Each character has data from both Chinese and Japanese perspectives
2. **Historical Context**: Oracle bone, bronze, seal script images show character evolution
3. **Decomposition Data**: IDS shows how characters are composed from components
4. **Learning Metrics**: Grade level, JLPT level, HSK level, frequency rankings
5. **Multiple Readings**: Both Chinese pinyin and Japanese on/kun/nanori readings
6. **Etymology**: Shuowen Jiezi classical explanations
7. **Cross-References**: 20+ dictionary reference codes for further study

## Future Enhancements

1. **Parse IDS Components**: Extract individual components from IDS strings
2. **Component-Based Search**: Find characters by component
3. **Learning Paths**: Suggest character learning order based on component dependencies
4. **Pinyin Extraction**: Parse pinyin from Chinese dictionary definitions
5. **Variant Analysis**: Better handling of traditional/simplified variants
6. **Mnemonic Generation**: Use decomposition + meanings to generate memory aids

## Files Modified/Created

### New Files:
- `scripts/generate_character_mapping.py` - Character mapping generation script
- `src/unified_character_types.rs` - Unified character type definitions
- `docs/CHARACTER_INTEGRATION.md` - This documentation

### Modified Files:
- `src/main.rs` - Added character merging and output generation
- `src/chinese_char_types.rs` - Added IDS fields
- `src/japanese_char_types.rs` - Added IDS fields
- `output/j2c_mapping.json` - Extended with character-level mappings

### Output:
- `output_dictionary/characters/*.json` - 92,829 character files

