import assert from 'node:assert/strict';
import {
	buildAnnotatedSentenceSegments,
	compactSentenceGloss,
	isStudyableSentenceWord,
	type SentenceWordAnalysis,
} from './sentence-analysis';
import { detectLanguage } from './utils/sentence-tokenizer';

function word(overrides: Partial<SentenceWordAnalysis> & Pick<SentenceWordAnalysis, 'surfaceForm' | 'position'>): SentenceWordAnalysis {
	return {
		surfaceForm: overrides.surfaceForm,
		wordSlug: overrides.wordSlug || overrides.surfaceForm,
		position: overrides.position,
		dictionaryForm: overrides.dictionaryForm || null,
		reading: overrides.reading || null,
		gloss: overrides.gloss || null,
		conjugation: overrides.conjugation || null,
	};
}

assert.equal(compactSentenceGloss('to reveal; to disclose; to divulge'), 'reveal');
assert.equal(compactSentenceGloss('indicates sentence topic, indicates contrast with another option'), 'indicates sentence topic');
assert.equal(detectLanguage('入居者募集'), 'ja');
assert.equal(detectLanguage('関係者以外立入禁止'), 'ja');
assert.equal(detectLanguage('新しい彼女'), 'ja');
assert.equal(detectLanguage('验证码十五分钟内有效'), 'zh');
assert.equal(detectLanguage('阿里巴巴'), 'zh');
assert.equal(detectLanguage('안녕하세요'), 'ko');
assert.equal(compactSentenceGloss('a very long dictionary definition that cannot fit inside the token hint', 18), 'very long…');

const chinese = '您的验证码:9548，切勿泄露。';
const chineseSegments = buildAnnotatedSentenceSegments(chinese, [
	word({ surfaceForm: '您', position: 0, reading: 'nín', gloss: 'you (polite)' }),
	word({ surfaceForm: '的', position: 1, reading: 'de', gloss: 'possessive particle' }),
	word({ surfaceForm: '验证码', position: 2, reading: 'yàn zhèng mǎ', gloss: 'verification code' }),
	word({ surfaceForm: '9548', position: 6 }),
	word({ surfaceForm: '切勿', position: 11, reading: 'qiè wù', gloss: 'must not' }),
	word({ surfaceForm: '泄露', position: 13, reading: 'xiè lòu', gloss: 'to reveal; to disclose' }),
]);
assert.equal(chineseSegments.map((segment) => segment.text).join(''), chinese);
assert.equal(chineseSegments.find((segment) => segment.text === '验证码')?.definition, 'verification code');
assert.equal(chineseSegments.find((segment) => segment.text === '泄露')?.definition, 'reveal');

const japanese = '名を捨てて実を取る。';
const japaneseSegments = buildAnnotatedSentenceSegments(japanese, [
	word({ surfaceForm: '名', position: 0, reading: 'な', gloss: 'name; reputation' }),
	word({ surfaceForm: 'を', position: 1, gloss: 'object marker' }),
	word({ surfaceForm: '捨て', position: 2, dictionaryForm: '捨てる', reading: 'すて', gloss: 'to discard' }),
	word({ surfaceForm: 'て', position: 4, gloss: 'conjunctive particle' }),
	word({ surfaceForm: '実', position: 5, reading: 'じつ', gloss: 'substance; reality' }),
	word({ surfaceForm: 'を', position: 6, gloss: 'object marker' }),
	word({ surfaceForm: '取る', position: 7, reading: 'とる', gloss: 'to take' }),
]);
assert.equal(japaneseSegments.map((segment) => segment.text).join(''), japanese);
assert.equal(japaneseSegments.find((segment) => segment.text === '捨て')?.target, '捨てる');

assert.equal(isStudyableSentenceWord(word({ surfaceForm: '9548', position: 0 })), false);
assert.equal(isStudyableSentenceWord(word({ surfaceForm: '验证码', position: 0 })), true);
assert.equal(isStudyableSentenceWord(word({ surfaceForm: 'Alibaba', position: 0, gloss: 'Alibaba Group' })), true);

console.log('sentence analysis tests passed');
