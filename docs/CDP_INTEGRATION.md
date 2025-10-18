# CDP (Chinese Document Processing) Integration

## Problem

Some characters in the IDS (Ideographic Description Sequence) files decompose to CDP entity references instead of actual characters. For example:

```
U+821C	舜	⿱&CDP-8BB8;舛
U+821E	舞	⿱&CDP-8BBE;舛
```

These CDP references (like `&CDP-8BBE;`) would appear as Latin letters or other incorrect glyphs when rendered in the game, because they're not actual Unicode characters.

## Solution

We integrated the `IDS-CDP.txt` file which provides the actual IDS decompositions for these CDP references:

```
CDP-8BBE	&CDP-8BBE;	⿳𠂉卌一
```

The solution involves:

1. **Loading CDP mappings** - Parse `IDS-CDP.txt` to create a lookup table mapping CDP entity references to their IDS decompositions
2. **Recursive resolution** - Resolve all CDP references in the main IDS files by substituting them with their actual decompositions
3. **Nested CDP handling** - Some CDP entries reference other CDP entries, so we recursively resolve up to 10 levels deep

## Entity Reference Filtering

In addition to resolving CDP references, we also filter out **all unresolved entity references** to prevent ASCII characters from appearing in the game.

### Types of Entity References Found

The IDS data contains several types of entity references that may not be resolvable:

1. **CDP references** - `&CDP-8ACC;` - Resolved using IDS-CDP.txt
2. **GT references** - `GT-K0001` - Glyph & Typographic references (not resolved)
3. **U-i references** - `U-i001+2FF1` - Unicode ideographic references (not resolved)
4. **Other references** - Various other entity reference formats (JX2-, HD-TK-, etc.)

### Filtering Strategy

The `extract_all_characters()` function now:

1. **Skips entity references** - Detects `&...;` patterns and skips them entirely
2. **Filters ASCII characters** - Any ASCII character (0x00-0x7F) is filtered out
3. **Preserves CJK characters** - Only non-ASCII characters are kept as components

This ensures that:
- ✅ No ASCII letters (A-Z, a-z) appear as cards
- ✅ No ASCII digits (0-9) appear as cards
- ✅ No ASCII symbols (-, +, ;) appear as cards
- ✅ Only valid CJK characters are used in the game

## Implementation

### File: `src/bin/generate_ids_lookups.rs`

#### 1. Parse CDP File
```rust
fn parse_cdp_file(path: &str) -> Result<HashMap<String, String>> {
    // Parses IDS-CDP.txt and creates a map:
    // "&CDP-8BBE;" -> "⿳𠂉卌一"
}
```

#### 2. Resolve CDP References
```rust
fn resolve_cdp_references(ids: &str, cdp_map: &HashMap<String, String>, depth: usize) -> String {
    // Recursively replaces all CDP entity references with their IDS decompositions
    // Prevents infinite recursion by limiting depth to 10
}
```

#### 3. Main Processing Flow
```rust
fn main() -> Result<()> {
    // 1. Load CDP file first
    let cdp_map = parse_cdp_file("data/ids/IDS-CDP.txt")?;
    
    // 2. Load IDS files
    let all_entries = load_ids_files();
    
    // 3. Resolve CDP references in all entries
    for entry in all_entries.iter_mut() {
        entry.ids = resolve_cdp_references(&entry.ids, &cdp_map, 0);
    }
    
    // 4. Build lookups and generate JSON files
}
```

## Results

After integration and entity reference filtering:

- ✅ **248 entries** had CDP references resolved
- ✅ **223 CDP references** loaded from IDS-CDP.txt (after filtering self-referential entries)
- ✅ **0 entity references** remain in the generated lookup files
- ✅ **0 ASCII characters** in component data (all unresolved entity references filtered)
- ✅ **27,160 forward mappings** created (character → components)
- ✅ **27,925 component combinations** available
- ✅ **815 pure components** that cannot be dissolved further
- ✅ Characters like 舜 now decompose to actual components: 爫, 冖, 舛

### Before CDP Integration
```json
"舜": {
  "character": "舜",
  "components": ["&CDP-8BB8;", "舛"]  // ❌ Entity reference
}
```

### After CDP Integration
```json
"舜": {
  "character": "舜",
  "components": ["爫", "冖", "舛"]  // ✅ Actual characters
}
```

## Impact on Game

- **No more Latin letters** appearing as cards
- **All components are real characters** that can be properly rendered
- **Better gameplay** as players can see and understand all components
- **Consistent with dictionary data** used elsewhere in the project

## Files Modified

1. `src/bin/generate_ids_lookups.rs` - Added CDP parsing and resolution
2. `data/ids/IDS-CDP.txt` - New file downloaded from CHISE project
3. `kanji-game/data/ids_forward.json` - Regenerated with CDP resolution
4. `kanji-game/data/ids_reverse.json` - Regenerated with CDP resolution
5. `kanji-card-game/static/data/*.json` - Updated with new data

## Future Considerations

- The CDP file contains 688 entries, but only 345 unique references (some entries are duplicates or self-referential)
- Some CDP entries reference other CDP entries, requiring recursive resolution
- The 10-level recursion limit should be sufficient for all practical cases
- If new IDS files are added, they will automatically benefit from CDP resolution

