import assert from 'node:assert/strict';
import { createReadStream, readFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import type { DictionaryEntry, SemanticMnemonicCard } from './types';
import {
	buildCharacterHeaderForms,
	learnerGlossForEntry,
	normalizeLearnerGloss
} from './character-forms';

interface CorpusManifest {
	count: number;
	card_buckets: Array<{
		path: string;
		bucket: string;
		count: number;
	}>;
}

interface CorpusCard extends SemanticMnemonicCard {
	alias_of?: string;
}

const corpusRoot = resolve(process.cwd(), '../data/semantic_mnemonic_corpus');
const cardsRoot = join(corpusRoot, 'cards');
const manifest = JSON.parse(
	readFileSync(join(corpusRoot, 'manifest.json'), 'utf8')
) as CorpusManifest;
const bucketFiles = readdirSync(cardsRoot)
	.filter((file) => file.endsWith('.jsonl'))
	.sort();

assert.equal(bucketFiles.length, manifest.card_buckets.length);

const cards = new Map<string, CorpusCard>();
const aliases = new Map<string, string>();

for (const file of bucketFiles) {
	const expectedBucket = basename(file, '.jsonl');
	const expectedCount =
		manifest.card_buckets.find((bucket) => bucket.bucket === expectedBucket)
			?.count ?? -1;
	let bucketCount = 0;
	const lines = createInterface({
		input: createReadStream(join(cardsRoot, file), { encoding: 'utf8' }),
		crlfDelay: Infinity
	});

	for await (const line of lines) {
		if (!line.trim()) continue;
		const card = JSON.parse(line) as CorpusCard;
		bucketCount += 1;

		assert.equal(
			[...card.character].length,
			1,
			`${file}: card key must be one Unicode character`
		);
		assert(!cards.has(card.character), `duplicate card for ${card.character}`);
		assert(normalizeLearnerGloss(card.meaning), `${card.character}: missing learner meaning`);
		assert(card.equation?.trim(), `${card.character}: missing equation`);
		assert(card.mnemonic?.trim(), `${card.character}: missing mnemonic`);
		const semanticLayerValues = [
			card.lexical_gloss,
			card.mnemonic_keyword,
			card.keyword_kind
		];
		if (semanticLayerValues.some((value) => value !== undefined)) {
			assert(
				semanticLayerValues.every(
					(value) => typeof value === 'string' && value.trim()
				),
				`${card.character}: semantic-layer fields must be defined together`
			);
			assert.equal(
				card.meaning,
				card.mnemonic_keyword,
				`${card.character}: legacy meaning must match mnemonic_keyword`
			);
		}

		const entry = {
			key: card.character,
			chinese_words: [],
			japanese_words: [],
			related_japanese_words: [],
			japanese_names: [],
			contains: [],
			contained_in_chinese: [],
			contained_in_japanese: [],
			chinese_char: {
				char: card.character,
				gloss: `conflicting dictionary gloss for ${card.character}`
			},
			semantic_mnemonic: card
		} as unknown as DictionaryEntry;
		const learnerMeaning = normalizeLearnerGloss(card.meaning);

		assert.equal(
			learnerGlossForEntry(entry),
			learnerMeaning,
			`${card.character}: dictionary evidence overrode the learner heading`
		);
		const header = buildCharacterHeaderForms({
			entry,
			word: card.character,
			cards: [card]
		});
		assert.equal(header[0]?.character, card.character);
		assert.equal(header[0]?.meaning, learnerMeaning);

		cards.set(card.character, card);
		if (card.alias_of) aliases.set(card.character, card.alias_of);
	}

	assert.equal(
		bucketCount,
		expectedCount,
		`${file}: manifest count does not match the bucket`
	);
}

assert.equal(cards.size, manifest.count, 'manifest count does not match corpus cards');

const yi = cards.get('弋');
assert(yi, '弋: missing semantic-layer regression card');
assert.equal(yi.meaning, 'bladeless halberd');
assert.equal(yi.mnemonic_keyword, 'bladeless halberd');
assert.equal(
	yi.lexical_gloss,
	'wooden stake; tethered hunting arrow; shoot with a tethered arrow'
);
assert.equal(yi.keyword_kind, 'visual_comparison');

for (const [character, target] of aliases) {
	assert(cards.has(target), `${character}: alias target ${target} is missing`);

	const visited = new Set<string>([character]);
	let current: string | undefined = target;
	while (current) {
		assert(!visited.has(current), `${character}: alias cycle reaches ${current}`);
		visited.add(current);
		current = aliases.get(current);
	}
}

console.log(
	`character-corpus-invariants: ${cards.size.toLocaleString('en-US')} cards passed`
);
