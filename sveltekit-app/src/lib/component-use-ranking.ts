import { LEARNER_CHARACTER_FREQUENCY_ORDER } from './generated-character-frequency-ranks';

export interface RankedCharacterUse {
	character: string;
	roles: string[];
}

const LOW_VALUE_GLOSS_RE = /\b(?:archaic|obsolete|variant|same as|surname only)\b/i;
const LEARNER_FREQUENCY_RANKS = new Map(
	[...LEARNER_CHARACTER_FREQUENCY_ORDER].map((character, index) => [character, index])
);

/**
 * Keep the first collapsed row useful to learners. Corpus arrays are
 * codepoint-sorted, which otherwise puts rare Extension-A forms such as 㟁
 * ahead of everyday characters such as 刊, 岸, 汗, and 肝.
 */
export function sortCharacterUses<T extends RankedCharacterUse>(
	uses: T[],
	glosses: Record<string, string>,
	roleOrder: string[]
): T[] {
	const originalOrder = new Map(uses.map((use, index) => [use.character, index]));
	const rolePriority = new Map(roleOrder.map((role, index) => [role, index]));

	return [...uses].sort((left, right) => {
		const scriptDifference = commonCharacterBlock(left.character) - commonCharacterBlock(right.character);
		if (scriptDifference) return scriptDifference;

		const leftGloss = cleanCharacterUseGloss(glosses[left.character] || '');
		const rightGloss = cleanCharacterUseGloss(glosses[right.character] || '');
		const glossDifference = glossQuality(leftGloss) - glossQuality(rightGloss);
		if (glossDifference) return glossDifference;

		const frequencyDifference =
			learnerFrequencyRank(left.character) -
			learnerFrequencyRank(right.character);
		if (frequencyDifference) return frequencyDifference;

		const roleDifference =
			bestRolePriority(left.roles, rolePriority) -
			bestRolePriority(right.roles, rolePriority);
		if (roleDifference) return roleDifference;

		return (originalOrder.get(left.character) ?? 0) - (originalOrder.get(right.character) ?? 0);
	});
}

export function cleanCharacterUseGloss(gloss: string): string {
	const cleaned = gloss.replace(/\s+/g, ' ').trim();
	const repeated = cleaned.match(/^(.+?)\s+a\s+\1$/i);
	return repeated?.[1] || cleaned;
}

function commonCharacterBlock(character: string): number {
	const codePoint = character.codePointAt(0) || 0;
	if (codePoint >= 0x4e00 && codePoint <= 0x9fff) return 0;
	if (codePoint >= 0xf900 && codePoint <= 0xfaff) return 1;
	if (codePoint >= 0x3400 && codePoint <= 0x4dbf) return 2;
	return 3;
}

function glossQuality(gloss: string): number {
	if (!gloss) return 2;
	return LOW_VALUE_GLOSS_RE.test(gloss) ? 1 : 0;
}

function learnerFrequencyRank(character: string): number {
	return LEARNER_FREQUENCY_RANKS.get(character) ?? Number.MAX_SAFE_INTEGER;
}

function bestRolePriority(roles: string[], priorities: Map<string, number>): number {
	return Math.min(...roles.map((role) => priorities.get(role) ?? priorities.size), priorities.size);
}
