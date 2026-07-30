import assert from 'node:assert/strict';
import { addJapaneseEntry, buildHomophoneGroups } from './extract_homophones.mjs';

function word(id, kanji, reading, gloss = 'definition') {
	return {
		id,
		kanji,
		kana: [{ common: true, text: reading, tags: [], appliesToKanji: ['*'] }],
		sense: [{
			partOfSpeech: ['v5s'],
			appliesToKanji: ['*'],
			appliesToKana: ['*'],
			gloss: [{ lang: 'eng', text: gloss }],
		}],
	};
}

const alternateSpellings = word('1601770', [
	{ common: true, text: '引き伸ばす', tags: [] },
	{ common: true, text: '引き延ばす', tags: [] },
	{ common: false, text: '引き延す', tags: ['sK'] },
], 'ひきのばす');

const oneEntryMap = new Map();
addJapaneseEntry(oneEntryMap, alternateSpellings);
assert.deepEqual(
	buildHomophoneGroups(oneEntryMap).wordGroups,
	[],
	'alternate spellings from one JMdict ID are not homophones'
);

const realHomophones = new Map();
addJapaneseEntry(realHomophones, alternateSpellings, 0);
addJapaneseEntry(
	realHomophones,
	word(
		'9999999',
		[{ common: false, text: '曳き延ばす', tags: [] }],
		'ひきのばす',
		'a genuinely different dictionary entry'
	),
	1
);

assert.deepEqual(buildHomophoneGroups(realHomophones).wordGroups, [{
	r: 'ひきのばす',
	w: [
		{ i: '1601770', w: '引き伸ばす', g: ['definition'], c: 1, p: ['v5s'] },
		{
			i: '9999999',
			w: '曳き延ばす',
			g: ['a genuinely different dictionary entry'],
			c: 1,
			p: ['v5s'],
		},
	],
}]);

console.log('Japanese homophone identity tests passed.');
