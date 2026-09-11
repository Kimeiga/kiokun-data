import assert from 'node:assert/strict';
import {
	cardKey,
	createDrillProgress,
	gradePronunciation,
	normalizePinyin,
	pickNextCard,
	romanizeJapaneseReading,
	updateDrillProgress,
	type DrillData,
	type PronunciationCard
} from './pronunciation-drill';

function card(
	language: 'ja' | 'zh',
	word: string,
	readings: string[],
	rank = 1
): PronunciationCard {
	return { language, word, readings, rank, definition: 'definition' };
}

assert.equal(normalizePinyin('nǚ péngyou'), 'nvpengyou');
assert.equal(normalizePinyin('NU:3 PENG2 YOU5'), 'nvpengyou');
assert(gradePronunciation(card('zh', '朋友', ['péng\u200byou']), 'pengyou'));
assert(gradePronunciation(card('zh', '行', ['xíng', 'háng']), 'hang2'));
assert(!gradePronunciation(card('zh', '行', ['xíng', 'háng']), 'hen'));

assert.equal(romanizeJapaneseReading('がっこう'), 'gakkou');
assert.equal(romanizeJapaneseReading('コーヒー'), 'koohii');
assert(gradePronunciation(card('ja', '学校', ['がっこう']), 'gakkou'));
assert(gradePronunciation(card('ja', '学校', ['がっこう']), 'がっこう'));
assert(gradePronunciation(card('ja', 'コーヒー', ['コーヒー']), 'koohii'));
assert(gradePronunciation(card('ja', 'は', ['は']), 'wa'));
assert(!gradePronunciation(card('ja', '学校', ['がっこう']), 'gakko'));

let progress = createDrillProgress();
progress = updateDrillProgress(progress, 'ja', true);
progress = updateDrillProgress(progress, 'ja', true);
assert.equal(progress.ja.level, 0);
progress = updateDrillProgress(progress, 'ja', true);
assert.deepEqual(progress.ja, { level: 1, correctRun: 0 });
progress = updateDrillProgress(progress, 'ja', false);
assert.deepEqual(progress.ja, { level: 0, correctRun: 0 });
assert.deepEqual(progress.zh, { level: 0, correctRun: 0 });

const data: DrillData = {
	version: 1,
	languages: {
		ja: [card('ja', '一', ['いち'], 1), card('ja', '百一', ['ひゃくいち'], 101)],
		zh: [card('zh', '一', ['yī'], 1), card('zh', '一百零一', ['yī bǎi líng yī'], 101)]
	}
};

const first = pickNextCard(data, new Set(), createDrillProgress(), null, () => 0);
assert.equal(first?.language, 'ja');
assert.equal(first?.rank, 1, 'the first level stays in the most frequent rank band');

const second = pickNextCard(
	data,
	new Set(first ? [cardKey(first)] : []),
	createDrillProgress(),
	first?.language ?? null,
	() => 0
);
assert.equal(second?.language, 'zh', 'mixed practice alternates languages when both have cards');
assert.equal(second?.rank, 1);

const harder = createDrillProgress();
harder.ja.level = 1;
const hardCard = pickNextCard(data, new Set(), harder, 'zh', () => 0);
assert.equal(hardCard?.rank, 101);

const allSeen = new Set(
	Object.values(data.languages).flatMap((cards) => cards.map(cardKey))
);
assert.equal(pickNextCard(data, allSeen, createDrillProgress(), null), null);

console.log('Pronunciation drill tests passed');
