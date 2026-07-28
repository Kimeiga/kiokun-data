import assert from 'node:assert/strict';
import { alignChinesePinyinReadings } from './chinese-ruby';

assert.deepEqual(
	alignChinesePinyinReadings(['银行', '集团'], 'yínháng jítuán'),
	['yínháng', 'jítuán'],
	'word-spaced pinyin stays with the corresponding Chinese word'
);

assert.deepEqual(
	alignChinesePinyinReadings(['银行', '集团'], 'yín háng jí tuán'),
	['yín háng', 'jí tuán'],
	'syllable-spaced pinyin is grouped by Chinese word'
);

assert.deepEqual(
	alignChinesePinyinReadings(['银行', '集团'], 'yínháng jí tuán'),
	['yínháng', 'jí tuán'],
	'mixed compact and syllable-spaced pinyin aligns by syllable count'
);

assert.deepEqual(
	alignChinesePinyinReadings(['你好', '，', '世界'], 'nǐ hǎo, shì jiè'),
	['nǐ hǎo', undefined, 'shì jiè'],
	'punctuation does not consume a pinyin reading'
);

assert.deepEqual(
	alignChinesePinyinReadings(['我', '去', '银行'], 'wǒ qù yínháng'),
	['wǒ', 'qù', 'yínháng'],
	'compact word readings work beside single-character words'
);

assert.deepEqual(
	alignChinesePinyinReadings(['COVID', '-', '19', '疫情'], 'COVID-19 yìqíng'),
	[undefined, undefined, undefined, 'yìqíng'],
	'Latin surface text is not mistaken for a Chinese reading'
);

assert.deepEqual(
	alignChinesePinyinReadings(['银行', '集团'], 'yínhángjítuán'),
	[undefined, undefined],
	'insufficient boundaries degrade without attaching the whole reading to the first word'
);

console.log('chinese ruby alignment tests passed');
