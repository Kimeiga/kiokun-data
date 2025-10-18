use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::Write;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct IdsEntry {
    codepoint: String,
    character: String,
    ids: String,
    apparent_ids: Option<String>,
}

/// Forward lookup: character -> its components
#[derive(Debug, Serialize)]
struct ForwardLookup {
    character: String,
    components: Vec<String>,
    ids_operator: Option<String>,
}

/// Reverse lookup: (component1, component2) -> resulting characters
type ReverseLookup = HashMap<String, Vec<String>>;

// IDS operators that combine two components
const BINARY_OPERATORS: &[char] = &[
    '⿰', // U+2FF0 - left to right
    '⿱', // U+2FF1 - above to below
    '⿴', // U+2FF4 - full surround
    '⿵', // U+2FF5 - surround from above
    '⿶', // U+2FF6 - surround from below
    '⿷', // U+2FF7 - surround from left
    '⿸', // U+2FF8 - surround from upper left
    '⿹', // U+2FF9 - surround from upper right
    '⿺', // U+2FFA - surround from lower left
    '⿻', // U+2FFB - overlaid
    '⿼', // U+2FFC - surround from lower right (rare)
    '⿽', // U+2FFD - surround from lower right (variant)
    '⿾', // U+2FFE - horizontal reflection (rare)
];
// IDS operators that combine three components
const TERNARY_OPERATORS: &[char] = &[
    '⿲', // U+2FF2 - left to middle and right
    '⿳', // U+2FF3 - above to middle and below
];
// Unary operator (not used in decomposition but should be filtered)
const UNARY_OPERATORS: &[char] = &[
    '⿿', // U+2FFF - rotation (rare)
];

fn parse_ids_file(path: &str) -> Result<Vec<IdsEntry>> {
    let content = fs::read_to_string(path)?;
    let mut entries = Vec::new();

    for line in content.lines() {
        if line.trim().is_empty() || line.starts_with(";;") {
            continue;
        }

        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() < 3 {
            continue;
        }

        let codepoint = parts[0].to_string();
        let character = parts[1].to_string();
        let ids = parts[2].to_string();

        let apparent_ids = if parts.len() >= 4 && parts[3].starts_with("@apparent=") {
            Some(parts[3].trim_start_matches("@apparent=").to_string())
        } else {
            None
        };

        entries.push(IdsEntry {
            codepoint,
            character,
            ids,
            apparent_ids,
        });
    }

    Ok(entries)
}

/// Parse CDP file and return a map of CDP references to their IDS decompositions
fn parse_cdp_file(path: &str) -> Result<HashMap<String, String>> {
    let content = fs::read_to_string(path)?;
    let mut cdp_map = HashMap::new();

    for line in content.lines() {
        if line.trim().is_empty() || line.starts_with(";;") {
            continue;
        }

        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() < 3 {
            continue;
        }

        let cdp_id = parts[0].to_string(); // e.g., "CDP-8BBE"
        let entity_ref = parts[1].to_string(); // e.g., "&CDP-8BBE;"
        let ids = parts[2].to_string(); // e.g., "⿳𠂉卌一"

        // Skip self-referential entries (e.g., &CDP-8547; -> &CDP-8547;)
        if ids == entity_ref {
            continue;
        }

        // Store both the entity reference format and the plain ID format
        cdp_map.insert(entity_ref.clone(), ids.clone());
        cdp_map.insert(format!("&{};", cdp_id), ids);
    }

    Ok(cdp_map)
}

/// Recursively resolve CDP references in an IDS string
fn resolve_cdp_references(ids: &str, cdp_map: &HashMap<String, String>, depth: usize) -> String {
    // Prevent infinite recursion
    if depth > 10 {
        return ids.to_string();
    }

    let mut result = ids.to_string();
    let mut changed = false;

    // Find and replace all CDP references
    for (entity_ref, replacement) in cdp_map.iter() {
        if result.contains(entity_ref) {
            result = result.replace(entity_ref, replacement);
            changed = true;
        }
    }

    // If we made changes, recursively resolve in case the replacement contains more CDP refs
    if changed {
        resolve_cdp_references(&result, cdp_map, depth + 1)
    } else {
        result
    }
}

fn is_ids_operator(c: char) -> bool {
    BINARY_OPERATORS.contains(&c) || TERNARY_OPERATORS.contains(&c) || UNARY_OPERATORS.contains(&c)
}

fn extract_all_characters(ids: &str) -> Vec<String> {
    // Extract all characters from IDS, filtering out operators and entity references
    let mut result = Vec::new();
    let mut in_entity = false;

    for c in ids.chars() {
        // Skip IDS operators
        if is_ids_operator(c) {
            continue;
        }

        // Detect entity references (start with & or contain ASCII letters/digits/hyphens)
        // Entity references look like: &CDP-8ACC; or GT-K0001 or U-i001+2FF1
        if c == '&' {
            in_entity = true;
            continue;
        }

        if in_entity {
            if c == ';' {
                in_entity = false;
            }
            continue;
        }

        // Skip ASCII characters (they're likely part of unresolved entity references)
        if c.is_ascii() {
            continue;
        }

        result.push(c.to_string());
    }

    result
}

fn extract_components(ids: &str) -> (Option<String>, Vec<String>) {
    let chars: Vec<char> = ids.chars().collect();

    if chars.is_empty() {
        return (None, vec![]);
    }

    // Check if first character is an IDS operator
    let first_char = chars[0];

    if BINARY_OPERATORS.contains(&first_char) {
        // Binary operator: extract next 2 components
        let operator = Some(first_char.to_string());
        let mut components = Vec::new();

        let mut i = 1;
        while i < chars.len() && components.len() < 2 {
            let component = extract_single_component(&chars, &mut i);
            if !component.is_empty() {
                components.push(component);
            }
        }

        (operator, components)
    } else if TERNARY_OPERATORS.contains(&first_char) {
        // Ternary operator: extract next 3 components
        let operator = Some(first_char.to_string());
        let mut components = Vec::new();

        let mut i = 1;
        while i < chars.len() && components.len() < 3 {
            let component = extract_single_component(&chars, &mut i);
            if !component.is_empty() {
                components.push(component);
            }
        }

        (operator, components)
    } else {
        // No operator, just the character itself
        (None, vec![ids.to_string()])
    }
}

fn extract_single_component(chars: &[char], index: &mut usize) -> String {
    if *index >= chars.len() {
        return String::new();
    }

    let start = *index;
    
    // If it's an IDS operator, we need to extract the whole sub-expression
    if BINARY_OPERATORS.contains(&chars[*index]) {
        *index += 1;
        // Extract 2 sub-components
        extract_single_component(chars, index);
        extract_single_component(chars, index);
    } else if TERNARY_OPERATORS.contains(&chars[*index]) {
        *index += 1;
        // Extract 3 sub-components
        extract_single_component(chars, index);
        extract_single_component(chars, index);
        extract_single_component(chars, index);
    } else {
        // Regular character
        *index += 1;
    }
    
    chars[start..*index].iter().collect()
}

fn build_forward_lookup(entries: &[IdsEntry]) -> HashMap<String, ForwardLookup> {
    let mut lookup = HashMap::new();

    for entry in entries {
        // Skip entity references (e.g., &I-J90-5A5E;)
        if entry.character.starts_with('&') {
            continue;
        }

        // Use apparent_ids if available, otherwise use ids
        let ids_to_use = entry.apparent_ids.as_ref().unwrap_or(&entry.ids);

        // Skip if IDS is just the character itself (no decomposition)
        if ids_to_use == &entry.character {
            continue;
        }

        // Extract all actual characters from the IDS (filtering out operators)
        let all_chars = extract_all_characters(ids_to_use);

        // Filter out entity references
        let components: Vec<String> = all_chars.into_iter()
            .filter(|c| !c.starts_with('&'))
            .collect();

        // Only include if we have actual components
        if !components.is_empty() && components != vec![entry.character.clone()] {
            // Get the operator from the original IDS
            let (operator, _) = extract_components(ids_to_use);

            lookup.insert(
                entry.character.clone(),
                ForwardLookup {
                    character: entry.character.clone(),
                    components,
                    ids_operator: operator,
                },
            );
        }
    }

    lookup
}

fn build_reverse_lookup(entries: &[IdsEntry]) -> ReverseLookup {
    let mut lookup: ReverseLookup = HashMap::new();

    for entry in entries {
        // Skip entity references (e.g., &I-J90-5A5E;)
        if entry.character.starts_with('&') {
            continue;
        }

        let ids_to_use = entry.apparent_ids.as_ref().unwrap_or(&entry.ids);

        if ids_to_use == &entry.character {
            continue;
        }

        // Extract all actual characters from the IDS (filtering out operators)
        let all_chars = extract_all_characters(ids_to_use);

        // Filter out entity references
        let all_chars: Vec<String> = all_chars.into_iter()
            .filter(|c| !c.starts_with('&'))
            .collect();

        // For the game, we want to create combinations from pairs of characters
        // This allows players to combine any two characters that appear in the decomposition
        if all_chars.len() >= 2 {
            // Create combinations from all pairs
            for i in 0..all_chars.len() {
                for j in (i+1)..all_chars.len() {
                    let key = format!("{}+{}", all_chars[i], all_chars[j]);
                    lookup
                        .entry(key)
                        .or_insert_with(Vec::new)
                        .push(entry.character.clone());
                }
            }
        }
    }

    // Remove duplicates
    for values in lookup.values_mut() {
        values.sort();
        values.dedup();
    }

    lookup
}

fn main() -> Result<()> {
    println!("🔧 Generating IDS lookup files for kanji game...");

    // Load CDP file first
    println!("\n📖 Loading CDP (Chinese Document Processing) references...");
    let cdp_map = match parse_cdp_file("data/ids/IDS-CDP.txt") {
        Ok(map) => {
            println!("  ✅ Loaded {} CDP references", map.len() / 2); // Divided by 2 because we store each twice
            map
        }
        Err(e) => {
            eprintln!("  ⚠️  Warning: Failed to load CDP file: {}", e);
            eprintln!("  Continuing without CDP resolution...");
            HashMap::new()
        }
    };

    // Load all IDS files
    let mut all_entries = Vec::new();

    let ids_files = vec![
        "data/ids/IDS-UCS-Basic.txt",
        "data/ids/IDS-UCS-Ext-A.txt",
        // Note: IDS-JIS-X0208-1990.txt excluded - contains only entity references (&I-J90-...)
    ];

    for file in ids_files {
        println!("  Loading {}...", file);
        match parse_ids_file(file) {
            Ok(entries) => {
                println!("    ✅ Loaded {} entries", entries.len());
                all_entries.extend(entries);
            }
            Err(e) => {
                eprintln!("    ⚠️  Warning: Failed to load {}: {}", file, e);
            }
        }
    }

    println!("\n📊 Total entries loaded: {}", all_entries.len());

    // Resolve CDP references in all entries
    if !cdp_map.is_empty() {
        println!("\n🔄 Resolving CDP references in IDS sequences...");
        let mut resolved_count = 0;
        for entry in all_entries.iter_mut() {
            let original_ids = entry.ids.clone();
            entry.ids = resolve_cdp_references(&entry.ids, &cdp_map, 0);
            if entry.ids != original_ids {
                resolved_count += 1;
            }

            // Also resolve in apparent_ids if present
            if let Some(ref apparent) = entry.apparent_ids {
                let original_apparent = apparent.clone();
                let resolved_apparent = resolve_cdp_references(apparent, &cdp_map, 0);
                if resolved_apparent != original_apparent {
                    entry.apparent_ids = Some(resolved_apparent);
                }
            }
        }
        println!("  ✅ Resolved CDP references in {} entries", resolved_count);
    }

    // Build forward lookup
    println!("\n🔨 Building forward lookup (character → components)...");
    let forward_lookup = build_forward_lookup(&all_entries);
    println!("  ✅ Created {} forward mappings", forward_lookup.len());

    // Build reverse lookup
    println!("\n🔨 Building reverse lookup (components → characters)...");
    let reverse_lookup = build_reverse_lookup(&all_entries);
    println!("  ✅ Created {} reverse mappings", reverse_lookup.len());

    // Create output directory
    fs::create_dir_all("kanji-game/data")?;

    // Write forward lookup
    println!("\n💾 Writing forward lookup to kanji-game/data/ids_forward.json...");
    let forward_json = serde_json::to_string_pretty(&forward_lookup)?;
    let mut file = File::create("kanji-game/data/ids_forward.json")?;
    file.write_all(forward_json.as_bytes())?;
    println!("  ✅ Written");

    // Write reverse lookup with optimized format (string if single, array if multiple)
    println!("\n💾 Writing reverse lookup to kanji-game/data/ids_reverse.json...");
    let mut reverse_optimized = serde_json::Map::new();
    let mut single_count = 0;
    let mut multi_count = 0;

    for (key, chars) in reverse_lookup.iter() {
        if chars.len() == 1 {
            reverse_optimized.insert(key.clone(), serde_json::json!(chars[0]));
            single_count += 1;
        } else {
            reverse_optimized.insert(key.clone(), serde_json::json!(chars));
            multi_count += 1;
        }
    }

    let reverse_json = serde_json::to_string_pretty(&reverse_optimized)?;
    let mut file = File::create("kanji-game/data/ids_reverse.json")?;
    file.write_all(reverse_json.as_bytes())?;
    println!("  ✅ Written");

    println!("\n✨ IDS lookup files generated successfully!");
    println!("\n📈 Statistics:");
    println!("  - Characters that can be dissolved: {}", forward_lookup.len());
    println!("  - Component combinations available: {}", reverse_lookup.len());
    println!("    • Single result: {}", single_count);
    println!("    • Multiple results: {} (player will choose)", multi_count);

    Ok(())
}

