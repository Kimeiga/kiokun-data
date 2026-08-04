import assert from 'node:assert/strict';
import {
	filterPronunciationCards,
	groupPronunciationReadings
} from './pronunciation-mnemonics';
import type { PronunciationMnemonicCard } from './types';

function card(language: 'zh' | 'ja'): PronunciationMnemonicCard {
	return {
		character: '行',
		variants: ['行'],
		language,
		review_status: 'reviewed',
		readings: [{
			reading_type: language === 'zh' ? 'mandarin' : 'on',
			display_reading: language === 'zh' ? 'xíng' : 'コウ',
			normalized_reading: language === 'zh' ? 'xing2' : 'こう',
			status: 'core',
			usage_gloss: 'movement',
			editorial_reason: 'common',
			strategy: 'word_anchor',
			overlay: 'anchor',
			anchors: [{
				word: language === 'zh' ? '行动' : '行動',
				reading: language === 'zh' ? 'xíng dòng' : 'こうどう',
				character_reading: language === 'zh' ? 'xíng' : 'こう',
				gloss: 'action',
				frequency: { source: 'fixture', field: 'rank', rank: 1 }
			}]
		}]
	};
}

const cards = [card('zh'), card('ja')];
assert.deepEqual(filterPronunciationCards(cards, { chinese: true, japanese: false }).map((item) => item.language), ['zh']);
assert.deepEqual(filterPronunciationCards(cards, { chinese: false, japanese: true }).map((item) => item.language), ['ja']);
assert.deepEqual(filterPronunciationCards(cards, { chinese: true, japanese: true }).map((item) => item.language), ['zh', 'ja']);
assert.equal(groupPronunciationReadings(cards[0]).core.length, 1);
assert.equal(groupPronunciationReadings(cards[0]).secondary.length, 0);

console.log('pronunciation mnemonic preference tests passed');
