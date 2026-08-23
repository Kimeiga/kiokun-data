import assert from 'node:assert/strict';
import kuromoji from 'kuromoji';
import type { D1Database } from '@cloudflare/workers-types';
import { findJapaneseReadingMatch } from './dictionary-lookup';
import { tokenizeJapanese } from './kuromoji-loader';
import { japaneseContextualMeaning } from './sentence-analysis';
import { segmentText } from '$lib/utils/segment';

function buildTokenizer(): Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>> {
	return new Promise((resolve, reject) => {
		kuromoji.builder({ dicPath: `${process.cwd()}/node_modules/kuromoji/dict` }).build(
			(error, tokenizer) => error ? reject(error) : resolve(tokenizer)
		);
	});
}

const tokenizer = await buildTokenizer();

assert.deepEqual(
	tokenizeJapanese(tokenizer, 'こんにちは').map((token) => token.surfaceForm),
	['こんにちは']
);
assert.deepEqual(
	tokenizeJapanese(tokenizer, 'ありがとう').map((token) => token.surfaceForm),
	['ありがとう']
);

const politeRequest = tokenizeJapanese(tokenizer, 'これをください');
assert.equal(politeRequest.find((token) => token.surfaceForm === 'ください')?.basicForm, 'くださる');

const photo = tokenizeJapanese(tokenizer, '写真を撮ってもらえますか');
assert.equal(photo.find((token) => token.surfaceForm === '撮っ')?.basicForm, '撮る');
assert.equal(photo.find((token) => token.surfaceForm === 'もらえ')?.basicForm, 'もらえる');

const comprehension = tokenizeJapanese(tokenizer, '日本語が少し分かります');
assert.equal(comprehension.find((token) => token.surfaceForm === '分かり')?.basicForm, '分かる');

const transit = tokenizeJapanese(tokenizer, '空港までどうやって行きますか');
assert.equal(transit.find((token) => token.surfaceForm === '行き')?.basicForm, '行く');

assert.deepEqual(
	tokenizeJapanese(tokenizer, 'Wi-Fiはありますか').map((token) => token.surfaceForm).slice(0, 1),
	['Wi-Fi']
);

assert.deepEqual(segmentText('こんにちは', 'ja'), ['こんにちは']);
assert.deepEqual(segmentText('ありがとう', 'ja'), ['ありがとう']);
assert.ok(segmentText('これをください', 'ja').includes('ください'));
assert.ok(segmentText('Wi-Fiはありますか', 'ja').includes('Wi-Fi'));

assert.deepEqual(japaneseContextualMeaning({ surfaceForm: 'ます', pos: '助動詞' }), {
	gloss: 'polite verb ending',
	dictionaryForm: null,
});
assert.deepEqual(japaneseContextualMeaning({ surfaceForm: 'ました', pos: '表現' }), {
	gloss: 'polite past-tense ending',
	dictionaryForm: null,
});
assert.deepEqual(japaneseContextualMeaning({ surfaceForm: 'ください', pos: '補助動詞' }), {
	gloss: 'please (do or give this for me)',
	dictionaryForm: '下さい',
});
assert.equal(japaneseContextualMeaning({ surfaceForm: 'ます', pos: '名詞' }), null);

for (const expression of [
	'どうやって',
	'お願いします',
	'ありがとうございます',
	'ありがとうございました',
	'おはようございます',
	'いってきます',
	'いってらっしゃい',
	'おかえりなさい',
	'ごちそうさまでした',
	'よろしくお願いします',
	'ました',
	'ません',
	'ませんでした',
	'でした',
]) {
	assert.ok(
		tokenizeJapanese(tokenizer, expression).some((token) => token.surfaceForm === expression),
		`${expression} should remain a single useful expression`
	);
	assert.ok(segmentText(expression, 'ja').includes(expression));
}

const fakeDb = {
	prepare() {
		return {
			bind(value: string) {
				assert.equal(value, 'どこ');
				return {
					async all() {
						return {
							results: [
								{
									word: '何処',
									pronunciation: 'どこ',
									definition: 'where; what place',
									is_common: 1,
								},
							],
						};
					},
				};
			},
		};
	},
} as unknown as D1Database;

assert.deepEqual(await findJapaneseReadingMatch('ドコ', fakeDb), {
	word: '何処',
	pronunciation: 'どこ',
	definition: 'where; what place',
	is_common: 1,
});

const pronounDb = {
	prepare() {
		return {
			bind(value: string) {
				assert.equal(value, 'これ');
				return {
					async all() {
						return {
							results: [
								{ word: '此れ', pronunciation: 'これ', definition: 'this', is_common: 1 },
								{ word: 'これ', pronunciation: 'これ', definition: 'hey', is_common: 0 },
							],
						};
					},
				};
			},
		};
	},
} as unknown as D1Database;

assert.equal((await findJapaneseReadingMatch('これ', pronounDb))?.word, '此れ');

const particleDb = {
	prepare() {
		return {
			bind() {
				return {
					async all() {
						return {
							results: [
								{ word: '歯', pronunciation: 'は', definition: 'tooth', is_common: 1 },
								{ word: 'は', pronunciation: 'は', definition: 'topic marker', is_common: 1 },
							],
						};
					},
				};
			},
		};
	},
} as unknown as D1Database;

assert.equal((await findJapaneseReadingMatch('は', particleDb))?.word, 'は');

console.log('Japanese sentence analysis tests passed');
