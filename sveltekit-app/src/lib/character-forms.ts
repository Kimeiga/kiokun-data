import type { DictionaryEntry, SemanticMnemonicCard } from './types';

export type CharacterFormRole =
	| 'traditional'
	| 'simplified'
	| 'hong-kong'
	| 'japanese'
	| 'korean';

export interface RelatedCharacterFormContext {
	key: string;
	redirect?: string;
	simplifiedFormOf?: string;
	chineseCharacter?: string;
	simplifiedVariants?: string[];
	traditionalVariants?: string[];
	hongKongCharacter?: string;
	japaneseCharacter?: string;
	koreanCharacter?: string;
	koreanHanjaForm?: string;
}

export interface CharacterHeaderForm {
	character: string;
	roles: CharacterFormRole[];
	flags: string;
	roleLabel: string;
	meaning?: string;
	targetId: string;
	languageTag: 'zh-Hant' | 'zh-Hans' | 'zh-HK' | 'ja' | 'ko';
}

/**
 * When a character has several written forms, label every form consistently.
 * Hiding only the form whose mnemonic meaning matches the page headline makes
 * the remaining labels look accidental (for example 乾 / 幹 / 乹 on 干).
 */
export function shouldShowCharacterFormMeaning(
	form: CharacterHeaderForm,
	forms: CharacterHeaderForm[],
	primaryGloss: string | null | undefined
): boolean {
	if (!form.meaning) return false;
	if (forms.length > 1) return true;
	return normalizedConcept(form.meaning) !== normalizedConcept(primaryGloss);
}

export function withCharacterFormGlosses(
	forms: CharacterHeaderForm[],
	glosses: Record<string, string>
): CharacterHeaderForm[] {
	return forms.map((form) => ({
		...form,
		meaning:
			form.meaning ||
			normalizeLearnerGloss(glosses[form.character]) ||
			undefined
	}));
}

const ROLE_ORDER: CharacterFormRole[] = [
	'traditional',
	'hong-kong',
	'simplified',
	'japanese',
	'korean'
];

const ROLE_LABELS: Record<CharacterFormRole, string> = {
	traditional: 'Traditional',
	simplified: 'Simplified',
	'hong-kong': 'Hong Kong',
	japanese: 'Japanese',
	korean: 'Korean'
};

const ROLE_FLAGS: Record<CharacterFormRole, string> = {
	traditional: '🇹🇼',
	'hong-kong': '🇭🇰',
	simplified: '🇨🇳',
	japanese: '🇯🇵',
	korean: '🇰🇷'
};

function isHanCharacterForm(character: string | null | undefined): character is string {
	return Boolean(
		character &&
		[...character].length === 1 &&
		/^\p{Script=Han}$/u.test(character)
	);
}

/**
 * Removes storage-only variant suffixes from learner-facing keywords.
 * These suffixes are useful in the component-gloss index, but are not part of
 * the concept a learner is trying to remember.
 */
export function normalizeLearnerGloss(gloss: string | null | undefined): string {
	return (gloss || '')
		.replace(/\s*\(trad\/jp\)/gi, '')
		.replace(/\s*\(trad\)/gi, '')
		.replace(/\s*\(simp\)/gi, '')
		.replace(/\s*\(jp\)/gi, '')
		.trim();
}

function normalizedConcept(gloss: string | null | undefined): string {
	return normalizeLearnerGloss(gloss)
		.normalize('NFKC')
		.toLocaleLowerCase('en')
		.replace(/\s+/g, ' ');
}

export function mnemonicCardsForEntry(entry: DictionaryEntry): SemanticMnemonicCard[] {
	const cards = [
		entry.semantic_mnemonic,
		...(entry.semantic_mnemonic_variants || [])
	].filter((card): card is SemanticMnemonicCard => Boolean(card));
	const seen = new Set<string>();
	return cards.filter((card) => {
		if (!card.character || seen.has(card.character)) return false;
		seen.add(card.character);
		return true;
	});
}

/**
 * The page headline and the mnemonic target must teach the same concept.
 * Dictionary glosses remain available in the definition section; component
 * glosses remain available for equations. Neither can override this keyword.
 */
export function learnerGlossForEntry(entry: DictionaryEntry): string {
	return normalizeLearnerGloss(
		entry.semantic_mnemonic?.mnemonic_keyword ||
			entry.semantic_mnemonic?.meaning ||
			entry.chinese_char?.gloss ||
			''
	);
}

/**
 * A merged simplified entry may safely canonicalize to its traditional page
 * only when it has one unambiguous traditional target and both mnemonic cards
 * teach the exact same learner concept. This intentionally keeps 后/後,
 * 制/製, and other meaning-bearing mergers on separate routes.
 */
export function equivalentTraditionalTarget(entry: DictionaryEntry): string | null {
	if (entry.redirect || !entry.simplified_form_of) return null;

	const source = entry.chinese_char?.char || entry.key;
	const target = entry.simplified_form_of;
	if (
		[...source].length !== 1 ||
		[...target].length !== 1 ||
		source === target
	) {
		return null;
	}

	const traditionalTargets = (entry.chinese_char?.tradVariants || [])
		.filter((variant) => variant && variant !== source);
	if (
		traditionalTargets.length !== 1 ||
		traditionalTargets[0] !== target
	) {
		return null;
	}

	const cards = mnemonicCardsForEntry(entry);
	const sourceCard = cards.find((card) => card.character === source);
	const targetCard = cards.find((card) => card.character === target);
	const sourceConcept = normalizedConcept(sourceCard?.meaning);
	const targetConcept = normalizedConcept(targetCard?.meaning);

	return sourceConcept && sourceConcept === targetConcept ? target : null;
}

export function relatedCharacterFormContext(
	entry: DictionaryEntry
): RelatedCharacterFormContext {
	return {
		key: entry.key,
		redirect: entry.redirect,
		simplifiedFormOf: entry.simplified_form_of,
		chineseCharacter: entry.chinese_char?.char,
		simplifiedVariants: entry.chinese_char?.simpVariants,
		traditionalVariants: entry.chinese_char?.tradVariants,
		hongKongCharacter: entry.chinese_char?.hkChar,
		japaneseCharacter: entry.japanese_char?.literal,
		koreanCharacter: entry.korean_char?.character,
		koreanHanjaForm: entry.korean_char?.hanjaForm
	};
}

function rolesAndOrderForContexts(
	entry: DictionaryEntry,
	contexts: RelatedCharacterFormContext[]
): {
	rolesByCharacter: Map<string, Set<CharacterFormRole>>;
	primaryRolesByCharacter: Map<string, Set<CharacterFormRole>>;
	order: string[];
} {
	const rolesByCharacter = new Map<string, Set<CharacterFormRole>>();
	const order: string[] = [];

	const add = (character: string | null | undefined, role?: CharacterFormRole) => {
		if (!isHanCharacterForm(character)) return;
		if (!rolesByCharacter.has(character)) {
			rolesByCharacter.set(character, new Set());
			order.push(character);
		}
		if (role) rolesByCharacter.get(character)?.add(role);
	};

	const addContext = (context: RelatedCharacterFormContext) => {
		const chineseCharacter = context.chineseCharacter;
		const simplified = context.simplifiedVariants || [];
		const traditional = context.traditionalVariants || [];
		const hasDifferentSimplified = simplified.some(
			(character) => character !== chineseCharacter
		);
		const hasTraditionalMapping = traditional.length > 0;
		const isMergedIndependentForm = Boolean(context.simplifiedFormOf);

		if (chineseCharacter) {
			if (
				!hasTraditionalMapping ||
				traditional.includes(chineseCharacter) ||
				isMergedIndependentForm
			) {
				add(chineseCharacter, 'traditional');
			}
			if (
				!hasDifferentSimplified ||
				simplified.includes(chineseCharacter) ||
				hasTraditionalMapping
			) {
				add(chineseCharacter, 'simplified');
			}
		}

		for (const character of traditional) add(character, 'traditional');
		for (const character of simplified) add(character, 'simplified');

		if (context.hongKongCharacter) {
			add(context.hongKongCharacter, 'hong-kong');
		} else if (
			chineseCharacter &&
			(
				!hasTraditionalMapping ||
				traditional.includes(chineseCharacter) ||
				isMergedIndependentForm
			)
		) {
			add(chineseCharacter, 'hong-kong');
		}

		add(context.japaneseCharacter, 'japanese');
		add(context.koreanCharacter, 'korean');
		add(context.koreanHanjaForm, 'korean');
	};

	addContext(relatedCharacterFormContext(entry));
	const primaryRolesByCharacter = new Map(
		[...rolesByCharacter].map(([character, roles]) => [
			character,
			new Set(roles)
		])
	);
	for (const context of contexts) addContext(context);

	return { rolesByCharacter, primaryRolesByCharacter, order };
}

function languageTagForRoles(roles: CharacterFormRole[]): CharacterHeaderForm['languageTag'] {
	if (roles.includes('japanese') && !roles.some((role) => role.startsWith('traditional') || role === 'simplified')) {
		return 'ja';
	}
	if (roles.includes('korean') && roles.length === 1) return 'ko';
	if (roles.includes('hong-kong') && roles.length === 1) return 'zh-HK';
	if (roles.includes('simplified') && !roles.includes('traditional')) return 'zh-Hans';
	return 'zh-Hant';
}

export function buildCharacterHeaderForms({
	entry,
	word,
	cards = mnemonicCardsForEntry(entry),
	relatedContexts = []
}: {
	entry: DictionaryEntry;
	word: string;
	cards?: SemanticMnemonicCard[];
	relatedContexts?: RelatedCharacterFormContext[];
}): CharacterHeaderForm[] {
	const {
		rolesByCharacter,
		primaryRolesByCharacter,
		order
	} = rolesAndOrderForContexts(entry, relatedContexts);
	const meaningByCharacter = new Map(
		cards.map((card) => [card.character, normalizeLearnerGloss(card.meaning)])
	);

	const add = (character: string | null | undefined) => {
		if (
			isHanCharacterForm(character) &&
			!order.includes(character)
		) {
			order.push(character);
			rolesByCharacter.set(character, new Set());
		}
	};

	// Keep the canonical Chinese form first, followed by declared variants and
	// language-specific forms. Cards are the final safety net for relationships
	// that older dictionary output did not encode structurally.
	add(entry.chinese_char?.char);
	for (const card of cards) add(card.character);
	if ([...word].length === 1) add(word);

	return order.map((character, index) => {
		// Labels and flags describe how this glyph expresses the canonical
		// page's learner concept. Related entries can contribute definitions
		// without making an unrelated sense look valid in every language.
		const senseRoles = primaryRolesByCharacter.get(character);
		const roles = [...(senseRoles?.size ? senseRoles : rolesByCharacter.get(character) || [])]
			.sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b));
		const flags = roles.map((role) => ROLE_FLAGS[role]).join('');
		const roleLabel = roles.length
			? roles.map((role) => ROLE_LABELS[role]).join(' / ')
			: 'Related form';

		return {
			character,
			roles,
			flags,
			roleLabel,
			meaning: meaningByCharacter.get(character),
			targetId: `character-writer-target-${index}`,
			languageTag: languageTagForRoles(roles)
		};
	});
}
