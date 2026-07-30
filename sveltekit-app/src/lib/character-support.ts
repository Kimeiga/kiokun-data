export interface ComponentTypeData {
	chars: string[];
	count: number;
	verified: number;
}

export interface ComponentUsesMap {
	[char: string]: {
		[componentType: string]: ComponentTypeData;
	};
}

export interface CharacterSupportSource {
	charGlosses: Record<string, string>;
	charTaxonomy: Record<string, string[]>;
	componentUses: ComponentUsesMap;
}

export interface CharacterSupportData {
	charGlosses: Record<string, string>;
	charTaxonomy: Record<string, string[]>;
	componentUses: ComponentUsesMap;
}

const HAN_CHARACTER_RE = /^\p{Script=Han}$/u;

function isHanCharacter(char: string): boolean {
	return HAN_CHARACTER_RE.test(char);
}

export function buildCharacterSupportData(
	source: CharacterSupportSource,
	{
		chars,
		components
	}: {
		chars: Iterable<string>;
		components: Iterable<string>;
	}
): CharacterSupportData {
	const charSet = new Set([...chars].filter(Boolean));
	const componentSet = new Set([...components].filter(Boolean));
	const componentUses: ComponentUsesMap = {};

	for (const component of componentSet) {
		const uses = source.componentUses[component];
		if (!uses) continue;

		componentUses[component] = uses;
		charSet.add(component);

		for (const typeData of Object.values(uses)) {
			for (const char of typeData.chars) {
				if (isHanCharacter(char)) charSet.add(char);
			}
		}
	}

	const charGlosses: Record<string, string> = {};
	const charTaxonomy: Record<string, string[]> = {};

	for (const char of charSet) {
		if (source.charGlosses[char]) charGlosses[char] = source.charGlosses[char];
		if (source.charTaxonomy[char]) charTaxonomy[char] = source.charTaxonomy[char];
	}

	return {
		charGlosses,
		charTaxonomy,
		componentUses
	};
}
