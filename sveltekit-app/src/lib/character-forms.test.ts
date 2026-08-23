import assert from 'node:assert/strict';
import { normalizeCjkAssetCharacter } from './utils/cjk-normalization';
import type { DictionaryEntry, SemanticMnemonicCard } from './types';
import {
	buildCharacterHeaderForms,
	characterWriterDomKey,
	equivalentTraditionalTarget,
	learnerGlossForEntry,
	normalizeLearnerGloss,
	relatedCharacterFormContext,
	shouldShowCharacterFormMeaning,
	withCharacterFormGlosses
} from './character-forms';

assert.notEqual(
	characterWriterDomKey('逃', {
		targetId: 'character-writer-target-0',
		character: '逃'
	}),
	characterWriterDomKey('兆', {
		targetId: 'character-writer-target-0',
		character: '兆'
	}),
	'client navigation remounts the externally mutated stroke-order target'
);

assert.equal(normalizeCjkAssetCharacter('龍'), '龍');
assert.equal(normalizeCjkAssetCharacter('龍'), '龍');

function card(character: string, meaning: string): SemanticMnemonicCard {
	return {
		character,
		meaning,
		equation: `Visual form: ${character} ${meaning}`,
		mnemonic: `${character} means ${meaning}.`
	};
}

function entry(
	value: Partial<DictionaryEntry> & Pick<DictionaryEntry, 'key'>
): DictionaryEntry {
	return {
		chinese_words: [],
		japanese_words: [],
		related_japanese_words: [],
		japanese_names: [],
		contains: [],
		contained_in_chinese: [],
		contained_in_japanese: [],
		...value
	};
}

const pictureMapEntry = entry({
	key: '圖',
	chinese_char: {
		char: '圖',
		gloss: 'picture (trad)',
		simpVariants: ['图']
	} as any,
	japanese_char: { literal: '図' } as any,
	semantic_mnemonic: card('圖', 'map'),
	semantic_mnemonic_variants: [card('图', 'map'), card('図', 'map')]
});

assert.equal(
	learnerGlossForEntry(pictureMapEntry),
	'map',
	'the mnemonic concept, not a component-support gloss, drives the headline'
);
assert.equal(normalizeLearnerGloss('picture (trad/jp)'), 'picture');

const visualKeywordEntry = entry({
	key: '弋',
	chinese_char: {
		char: '弋',
		gloss: 'shoot with a tethered arrow'
	} as any,
	semantic_mnemonic: {
		...card('弋', 'bladeless halberd'),
		lexical_gloss: 'wooden stake; tethered hunting arrow',
		mnemonic_keyword: 'bladeless halberd',
		keyword_kind: 'visual_comparison'
	}
});
assert.equal(
	learnerGlossForEntry(visualKeywordEntry),
	'bladeless halberd',
	'an explicitly labeled visual keyword drives the learning heading'
);

const equivalentYu = entry({
	key: '于',
	simplified_form_of: '於',
	chinese_char: {
		char: '于',
		tradVariants: ['於']
	} as any,
	semantic_mnemonic: card('于', 'at'),
	semantic_mnemonic_variants: [card('於', 'at')]
});
assert.equal(
	equivalentTraditionalTarget(equivalentYu),
	'於',
	'equivalent one-to-one forms canonicalize'
);

for (const [source, target, sourceMeaning, targetMeaning] of [
	['后', '後', 'queen', 'after'],
	['制', '製', 'system', 'manufacture']
] as const) {
	const distinctEntry = entry({
		key: source,
		simplified_form_of: target,
		chinese_char: {
			char: source,
			tradVariants: [target]
		} as any,
		semantic_mnemonic: card(source, sourceMeaning),
		semantic_mnemonic_variants: [card(target, targetMeaning)]
	});
	assert.equal(
		equivalentTraditionalTarget(distinctEntry),
		null,
		`${source}/${target} stays separate because the learner concepts differ`
	);
}

const atTarget = entry({
	key: '於',
	chinese_char: {
		char: '於',
		gloss: 'in',
		simpVariants: ['于']
	} as any,
	japanese_char: { literal: '於' } as any,
	semantic_mnemonic: card('於', 'at'),
	semantic_mnemonic_variants: [card('于', 'at')]
});
const relatedYuContext = relatedCharacterFormContext(
	entry({
		...equivalentYu,
		japanese_char: { literal: '于' } as any,
		korean_char: {
			character: '于',
			readings: [],
			meanings: [],
			meaningsEn: []
		}
	})
);
const atForms = buildCharacterHeaderForms({
	entry: atTarget,
	word: '於',
	relatedContexts: [relatedYuContext]
});
assert.deepEqual(atForms.map((form) => form.character), ['於', '于']);
assert.deepEqual(atForms[0].roles, ['traditional', 'hong-kong', 'japanese']);
assert.deepEqual(
	atForms[1].roles,
	['simplified'],
	'the unified header labels the form for the canonical “at” sense, not unrelated senses'
);

const distinctForms = buildCharacterHeaderForms({
	entry: entry({
		key: '後',
		chinese_char: {
			char: '後',
			simpVariants: ['后']
		} as any,
		semantic_mnemonic: card('後', 'after'),
		semantic_mnemonic_variants: [card('后', 'queen')]
	}),
	word: '後'
});
assert.equal(distinctForms.find((form) => form.character === '后')?.meaning, 'queen');

const mapForms = buildCharacterHeaderForms({
	entry: pictureMapEntry,
	word: '圖'
});
assert.deepEqual(mapForms.map((form) => form.character), ['圖', '图', '図']);
assert(mapForms[2].roles.includes('japanese'));

const koreanReadingForms = buildCharacterHeaderForms({
	entry: entry({
		key: '生',
		chinese_char: {
			char: '生'
		} as any,
		japanese_char: { literal: '生' } as any,
		korean_char: {
			character: '생',
			hanjaForm: '生',
			readings: [{ hangul: '생' }],
			meanings: [],
			meaningsEn: ['life']
		},
		semantic_mnemonic: card('生', 'life')
	}),
	word: '생'
});
assert.deepEqual(
	koreanReadingForms.map((form) => form.character),
	['生'],
	'Hangul readings stay in the readings row instead of creating a second character-form tile'
);
assert(koreanReadingForms[0].roles.includes('korean'));

const dryForms = withCharacterFormGlosses(buildCharacterHeaderForms({
	entry: entry({
		key: '干',
		chinese_char: {
			char: '干',
			tradVariants: ['乾', '幹', '乹']
		} as any,
		semantic_mnemonic: card('干', 'dry')
	}),
	word: '干'
}), {
	'乾': 'dry (trad/jp)',
	'幹': 'trunk (trad/jp)',
	'乹': 'dry (archaic)'
});
assert.deepEqual(
	dryForms.map((form) => [form.character, form.meaning]),
	[
		['干', 'dry'],
		['乾', 'dry'],
		['幹', 'trunk'],
		['乹', 'dry (archaic)']
	]
);
assert(
	dryForms.every((form) => shouldShowCharacterFormMeaning(form, dryForms, 'dry')),
	'all written forms get parallel labels when the page presents several variants'
);

console.log('character-forms: all regression tests passed');
