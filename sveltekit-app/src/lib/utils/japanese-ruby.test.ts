import assert from 'node:assert/strict';
import { splitJapaneseRubyParts, trimJapaneseReadingSuffix } from './japanese-ruby';

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

console.log('japanese ruby tests passed');
