import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
	cardKey,
	createDrillProgress,
	DRILL_START_LEVEL,
	gradePronunciation,
	isPronunciationCardEligible,
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
assert(!isPronunciationCardEligible(card('ja', 'そんな', ['そんな'])));
assert(!isPronunciationCardEligible(card('ja', 'コーヒー', ['コーヒー'])));
assert(isPronunciationCardEligible(card('ja', '学校', ['がっこう'])));
assert(isPronunciationCardEligible(card('zh', '啊', ['a'])));

const generatedData = JSON.parse(
	await readFile(new URL('../../static/pronunciation_drill.json', import.meta.url), 'utf8')
) as DrillData;
assert(generatedData.languages.ja.length > 0);
assert(generatedData.languages.ja.every(isPronunciationCardEligible));

let progress = createDrillProgress();
assert.equal(progress.ja.level, DRILL_START_LEVEL);
progress = updateDrillProgress(progress, 'ja', true);
progress = updateDrillProgress(progress, 'ja', true);
assert.equal(progress.ja.level, DRILL_START_LEVEL);
progress = updateDrillProgress(progress, 'ja', true);
assert.deepEqual(progress.ja, { level: DRILL_START_LEVEL + 1, correctRun: 0 });
progress = updateDrillProgress(progress, 'ja', false);
assert.deepEqual(progress.ja, { level: DRILL_START_LEVEL, correctRun: 0 });
assert.deepEqual(progress.zh, { level: DRILL_START_LEVEL, correctRun: 0 });

const data: DrillData = {
	version: 1,
	languages: {
		ja: [
			card('ja', '一', ['いち'], 1),
			card('ja', '百一', ['ひゃくいち'], 101),
			card('ja', '四百一', ['よんひゃくいち'], 401),
			card('ja', '五百一', ['ごひゃくいち'], 501),
			card('ja', 'そんな', ['そんな'], 402)
		],
		zh: [
			card('zh', '一', ['yī'], 1),
			card('zh', '一百零一', ['yī bǎi líng yī'], 101),
			card('zh', '四百零一', ['sì bǎi líng yī'], 401),
			card('zh', '五百零一', ['wǔ bǎi líng yī'], 501)
		]
	}
};

const first = pickNextCard(data, new Set(), createDrillProgress(), null, () => 0);
assert.equal(first?.language, 'ja');
assert.equal(first?.rank, 401, 'new sessions start in the harder rank band');

const second = pickNextCard(
	data,
	new Set(first ? [cardKey(first)] : []),
	createDrillProgress(),
	first?.language ?? null,
	() => 0
);
assert.equal(second?.language, 'zh', 'mixed practice alternates languages when both have cards');
assert.equal(second?.rank, 401);

const harder = createDrillProgress();
harder.ja.level = DRILL_START_LEVEL + 1;
const hardCard = pickNextCard(data, new Set(), harder, 'zh', () => 0);
assert.equal(hardCard?.rank, 501);

const allSeen = new Set(
	Object.values(data.languages).flatMap((cards) => cards.map(cardKey))
);
assert.equal(pickNextCard(data, allSeen, createDrillProgress(), null), null);

console.log('Pronunciation drill tests passed');
