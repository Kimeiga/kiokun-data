import assert from 'node:assert/strict';
import {
	mergeJapaneseCompoundTokens,
	splitJapaneseRubyParts,
	trimJapaneseReadingSuffix
} from './japanese-ruby';

assert.deepEqual(splitJapaneseRubyParts('伸ばす', 'のばす'), [
	{ text: '伸', reading: 'の' },
	{ text: 'ばす' }
]);

assert.deepEqual(splitJapaneseRubyParts('伸ばした', 'ノバシタ'), [
	{ text: '伸', reading: 'の' },
	{ text: 'ばした' }
]);

assert.deepEqual(splitJapaneseRubyParts('お祝い', 'おいわい'), [
	{ text: 'お' },
	{ text: '祝', reading: 'いわ' },
	{ text: 'い' }
]);

assert.deepEqual(splitJapaneseRubyParts('取り扱う', 'とりあつかう'), [
	{ text: '取', reading: 'と' },
	{ text: 'り' },
	{ text: '扱', reading: 'あつか' },
	{ text: 'う' }
]);

assert.deepEqual(splitJapaneseRubyParts('銀行', 'ぎんこう'), [
	{ text: '銀行', reading: 'ぎんこう' }
]);

assert.deepEqual(splitJapaneseRubyParts('伸ばす', 'mismatched'), [
	{ text: '伸ばす', reading: 'mismatched' }
]);

assert.equal(trimJapaneseReadingSuffix('ノバシ', 'し'), 'のば');
assert.equal(trimJapaneseReadingSuffix('のばせません', 'せません'), 'のば');
assert.equal(trimJapaneseReadingSuffix('のばし', 'た'), null);

const compoundReadings = new Map([
	['皮表紙', 'かわびょうし'],
	['委員会', 'いいんかい']
]);
const lookupCompoundReading = async (surface: string) => compoundReadings.get(surface) ?? null;

assert.deepEqual(
	await mergeJapaneseCompoundTokens([
		{ text: '小さ', isWord: true },
		{ text: 'な', isWord: true },
		{ text: '皮表', isWord: true },
		{ text: '紙', isWord: true },
		{ text: 'の', isWord: true },
		{ text: '本', isWord: true }
	], lookupCompoundReading),
	[
		{ text: '小さ', isWord: true },
		{ text: 'な', isWord: true },
		{ text: '皮表紙', reading: 'かわびょうし', isWord: true },
		{ text: 'の', isWord: true },
		{ text: '本', isWord: true }
	]
);

assert.deepEqual(
	await mergeJapaneseCompoundTokens([
		{ text: '委員', isWord: true },
		{ text: '会', isWord: true }
	], lookupCompoundReading),
	[{ text: '委員会', reading: 'いいんかい', isWord: true }]
);

console.log('japanese ruby tests passed');
