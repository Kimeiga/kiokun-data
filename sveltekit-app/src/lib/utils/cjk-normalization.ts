/**
 * Normalize CJK compatibility ideographs before looking up external assets.
 *
 * Dictionary display forms remain untouched; this is only for data providers
 * that index canonical Unicode code points (for example 龍 → 龍).
 */
export function normalizeCjkAssetCharacter(character: string): string {
	return character.normalize('NFKC');
}
