/**
 * Utility functions for converting Japanese dictionary tags to human-readable labels
 * Uses the labels extracted from 10ten-ja-reader
 */

import labelsData from '$lib/japanese-labels.json';

export interface JapaneseLabels {
    pos: Record<string, string>;
    misc: Record<string, string>;
    field: Record<string, string>;
    dial: Record<string, string>;
    head_info: Record<string, string>;
}

export const labels: JapaneseLabels = labelsData.labels as JapaneseLabels;
export const flatLabels: Record<string, string> = labelsData.flatLabels;

/**
 * Get the human-readable label for a tag
 * @param tag - The tag to convert (e.g., "adv", "uk", "io")
 * @returns The human-readable label (e.g., "adverb", "usually kana", "irreg.")
 */
export function getLabel(tag: string): string {
    return flatLabels[tag] || tag;
}

/**
 * Get the human-readable label for a part-of-speech tag
 * @param tag - The POS tag (e.g., "adv", "n", "v5r")
 * @returns The human-readable label (e.g., "adverb", "noun", "-ru Godan/u-verb")
 */
export function getPosLabel(tag: string): string {
    return labels.pos[tag] || tag;
}

/**
 * Get the human-readable label for a misc tag
 * @param tag - The misc tag (e.g., "uk", "arch", "hon")
 * @returns The human-readable label (e.g., "usually kana", "archaic", "honorific")
 */
export function getMiscLabel(tag: string): string {
    return labels.misc[tag] || tag;
}

/**
 * Get the human-readable label for a field tag
 * @param tag - The field tag (e.g., "comp", "med", "sports")
 * @returns The human-readable label (e.g., "computing", "medicine", "sports")
 */
export function getFieldLabel(tag: string): string {
    return labels.field[tag] || tag;
}

/**
 * Get the human-readable label for a dialect tag
 * @param tag - The dialect tag (e.g., "ks", "kt", "ok")
 * @returns The human-readable label (e.g., "Kansai dialect", "Kanto dialect", "Ryuukyuu dialect")
 */
export function getDialectLabel(tag: string): string {
    return labels.dial[tag] || tag;
}

/**
 * Get the human-readable label for a headword info tag
 * @param tag - The headword info tag (e.g., "io", "iK", "oK")
 * @returns The human-readable label (e.g., "irreg.", "irreg.", "old")
 */
export function getHeadInfoLabel(tag: string): string {
    // Map the short tags to the full tag names used in the labels
    const tagMap: Record<string, string> = {
        'iK': 'ikanji',
        'ik': 'ikana',
        'io': 'io',
        'oK': 'okanji',
        'ok': 'okana',
        'rK': 'rkanji',
        'rk': 'rkana',
        'sK': 'ikanji',  // search-only kanji form (treat as irregular)
        'sk': 'ikana'    // search-only kana form (treat as irregular)
    };
    
    const mappedTag = tagMap[tag] || tag;
    return labels.head_info[mappedTag] || tag;
}

