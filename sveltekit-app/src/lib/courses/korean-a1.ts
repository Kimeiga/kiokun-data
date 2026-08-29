import { lesson } from './authoring';
import type { CourseUnit, LanguageCourse, ScriptChart } from './types';

const blockChart: ScriptChart = {
	title: 'Hangul syllable blocks',
	caption: 'Letters are written in square syllable blocks. Every block contains an initial position and a vowel; a final consonant is optional.',
	columns: ['letters', 'block', 'reading'],
	rows: [
		{ label: 'CV', cells: [
			{ symbol: 'ㄱ + ㅏ', romanization: 'g/k + a' },
			{ symbol: '가', romanization: 'ga' },
			{ symbol: '가', romanization: 'one syllable' }
		] },
		{ label: 'VC', cells: [
			{ symbol: 'ㅇ + ㅏ', romanization: 'silent initial + a' },
			{ symbol: '아', romanization: 'a' },
			{ symbol: '아', romanization: 'one syllable' }
		] },
		{ label: 'CVC', cells: [
			{ symbol: 'ㅎ + ㅏ + ㄴ', romanization: 'h + a + n' },
			{ symbol: '한', romanization: 'han' },
			{ symbol: '한', romanization: 'final ㄴ is batchim' }
		] }
	]
};

const consonantChart: ScriptChart = {
	title: 'Basic Hangul consonants',
	caption: 'Romanization is only an orientation aid. Several consonants change realization by position and surrounding sound.',
	columns: ['letters', 'initial examples', 'position note'],
	rows: [
		{ label: 'velar', cells: [
			{ symbol: 'ㄱ ㅋ', romanization: 'g/k · k' },
			{ symbol: '가・카', romanization: 'ga · ka' },
			{ symbol: 'ㄱ', romanization: 'plain; ㅋ aspirated' }
		] },
		{ label: 'tongue', cells: [
			{ symbol: 'ㄴ ㄷ ㄹ ㅌ', romanization: 'n · d/t · r/l · t' },
			{ symbol: '나・다・라・타', romanization: 'na · da · ra · ta' },
			{ symbol: 'ㄹ', romanization: 'tap initially, l-like finally' }
		] },
		{ label: 'lips', cells: [
			{ symbol: 'ㅁ ㅂ ㅍ', romanization: 'm · b/p · p' },
			{ symbol: '마・바・파', romanization: 'ma · ba · pa' },
			{ symbol: 'ㅂ', romanization: 'plain; ㅍ aspirated' }
		] },
		{ label: 'front', cells: [
			{ symbol: 'ㅅ ㅈ ㅊ', romanization: 's · j · ch' },
			{ symbol: '사・자・차', romanization: 'sa · ja · cha' },
			{ symbol: 'ㅅ', romanization: 'changes before i/y vowels' }
		] },
		{ label: 'other', cells: [
			{ symbol: 'ㅇ ㅎ', romanization: 'silent/ng · h' },
			{ symbol: '아・하', romanization: 'a · ha' },
			{ symbol: 'ㅇ', romanization: 'silent initially, ng finally' }
		] }
	]
};

const vowelChart: ScriptChart = {
	title: 'Basic Hangul vowels',
	caption: 'Vertical vowels place the initial consonant to the left; horizontal vowels place it above.',
	columns: ['basic', 'y-vowel', 'example blocks'],
	rows: [
		{ label: 'a', cells: [
			{ symbol: 'ㅏ', romanization: 'a' },
			{ symbol: 'ㅑ', romanization: 'ya' },
			{ symbol: '아・야', romanization: 'a · ya' }
		] },
		{ label: 'eo', cells: [
			{ symbol: 'ㅓ', romanization: 'eo' },
			{ symbol: 'ㅕ', romanization: 'yeo' },
			{ symbol: '어・여', romanization: 'eo · yeo' }
		] },
		{ label: 'o', cells: [
			{ symbol: 'ㅗ', romanization: 'o' },
			{ symbol: 'ㅛ', romanization: 'yo' },
			{ symbol: '오・요', romanization: 'o · yo' }
		] },
		{ label: 'u', cells: [
			{ symbol: 'ㅜ', romanization: 'u' },
			{ symbol: 'ㅠ', romanization: 'yu' },
			{ symbol: '우・유', romanization: 'u · yu' }
		] },
		{ label: 'eu/i', cells: [
			{ symbol: 'ㅡ', romanization: 'eu' },
			{ symbol: 'ㅣ', romanization: 'i' },
			{ symbol: '으・이', romanization: 'eu · i' }
		] }
	]
};

const tenseChart: ScriptChart = {
	title: 'Plain, aspirated, and tense consonants',
	caption: 'These series differ in laryngeal setting and timing. English voiced/voiceless labels are not sufficient descriptions.',
	columns: ['plain', 'aspirated', 'tense'],
	rows: [
		{ label: 'k', cells: [
			{ symbol: '가', romanization: '가 ga: ㄱ' },
			{ symbol: '카', romanization: '카 ka: ㅋ' },
			{ symbol: '까', romanization: '까 kka: ㄲ' }
		] },
		{ label: 't', cells: [
			{ symbol: '다', romanization: '다 da: ㄷ' },
			{ symbol: '타', romanization: '타 ta: ㅌ' },
			{ symbol: '따', romanization: '따 tta: ㄸ' }
		] },
		{ label: 'p', cells: [
			{ symbol: '바', romanization: '바 ba: ㅂ' },
			{ symbol: '파', romanization: '파 pa: ㅍ' },
			{ symbol: '빠', romanization: '빠 ppa: ㅃ' }
		] },
		{ label: 'j', cells: [
			{ symbol: '자', romanization: '자 ja: ㅈ' },
			{ symbol: '차', romanization: '차 cha: ㅊ' },
			{ symbol: '짜', romanization: '짜 jja: ㅉ' }
		] },
		{ label: 's', cells: [
			{ symbol: '사', romanization: '사 sa: ㅅ' },
			null,
			{ symbol: '싸', romanization: '싸 ssa: ㅆ' }
		] }
	]
};

const compoundVowelChart: ScriptChart = {
	title: 'Compound Hangul vowels',
	caption: 'Modern Hangul has eleven compound vowels in addition to the ten basic vowels.',
	columns: ['letter', 'reading', 'example'],
	rows: [
		{ label: 'ae/e', cells: [
			{ symbol: 'ㅐ ㅒ ㅔ ㅖ', romanization: 'ae · yae · e · ye' },
			{ symbol: '애・얘・에・예', romanization: 'ae · yae · e · ye' },
			{ symbol: '네', romanization: 'ne', note: 'yes' }
		] },
		{ label: 'wa', cells: [
			{ symbol: 'ㅘ ㅙ ㅚ', romanization: 'wa · wae · oe' },
			{ symbol: '와・왜・외', romanization: 'wa · wae · oe' },
			{ symbol: '와요', romanization: 'wayo', note: 'comes' }
		] },
		{ label: 'wo', cells: [
			{ symbol: 'ㅝ ㅞ ㅟ', romanization: 'wo · we · wi' },
			{ symbol: '워・웨・위', romanization: 'wo · we · wi' },
			{ symbol: '위', romanization: 'wi', note: 'above' }
		] },
		{ label: 'ui', cells: [
			{ symbol: 'ㅢ', romanization: 'ui' },
			{ symbol: '의', romanization: 'ui' },
			{ symbol: '의사', romanization: 'uisa', note: 'doctor' }
		] }
	]
};

const batchimChart: ScriptChart = {
	title: 'Basic final-consonant categories',
	caption: 'Many written final consonants are neutralized to seven basic coda categories before a pause or consonant.',
	columns: ['final value', 'example', 'reading cue'],
	rows: [
		{ label: 'k', cells: [{ symbol: 'ㄱ', romanization: 'k̚' }, { symbol: '국', romanization: 'guk' }, { symbol: '한국', romanization: 'Hanguk' }] },
		{ label: 'n', cells: [{ symbol: 'ㄴ', romanization: 'n' }, { symbol: '산', romanization: 'san' }, { symbol: '한국', romanization: 'Hanguk', note: '한 has final n' }] },
		{ label: 't', cells: [{ symbol: 'ㄷ', romanization: 't̚ category' }, { symbol: '옷', romanization: 'ot' }, { symbol: '끝', romanization: 'kkeut' }] },
		{ label: 'l', cells: [{ symbol: 'ㄹ', romanization: 'l' }, { symbol: '물', romanization: 'mul' }, { symbol: '서울', romanization: 'Seoul' }] },
		{ label: 'm', cells: [{ symbol: 'ㅁ', romanization: 'm' }, { symbol: '밤', romanization: 'bam' }, { symbol: '김', romanization: 'gim' }] },
		{ label: 'p', cells: [{ symbol: 'ㅂ', romanization: 'p̚' }, { symbol: '밥', romanization: 'bap' }, { symbol: '집', romanization: 'jip' }] },
		{ label: 'ng', cells: [{ symbol: 'ㅇ', romanization: 'ng' }, { symbol: '방', romanization: 'bang' }, { symbol: '공', romanization: 'gong' }] }
	]
};

const lessons = [
	lesson({
		id: 'ko-00-blocks', unitId: 'korean-launchpad', title: 'Hangul syllable blocks', shortTitle: 'Syllable blocks', kind: 'script', durationMinutes: 18,
		canDo: 'Identify the initial, vowel, and optional final positions in a Hangul syllable block.',
		focus: ['phonemic letters', 'syllable blocks', 'initial/vowel/final', 'ㅇ placeholder'],
		scenario: [['Build', 'ㄱ + ㅏ → 가', 'g/k + a → ga', 'consonant plus vowel'], ['Build', 'ㅎ + ㅏ + ㄴ → 한', 'h + a + n → han', 'consonant, vowel, and final consonant']],
		notice: ['Hangul letters combine into square syllable blocks rather than running as a horizontal alphabetic string.', 'Every written syllable needs an initial position. Initial ㅇ is silent and fills that position before a vowel.'],
		explanation: ['A vertical vowel places the initial to its left; a horizontal vowel places the initial above it.', 'A final consonant, called 받침 batchim, sits at the bottom of the block.'],
		scriptCharts: [blockChart],
		vocabulary: [['한글', 'hangeul', 'Hangul; Korean alphabet'], ['글자', 'geulja', 'letter; written character'], ['소리', 'sori', 'sound'], ['한국어', 'hangugeo', 'Korean language']],
		choice: { prompt: 'What does initial ㅇ contribute in 아?', options: [['silent', 'It is silent and fills the initial position'], ['ng', 'It is pronounced ng initially'], ['h', 'It is pronounced h']], answer: 'silent', rationale: 'ㅇ is silent in the initial position and ng-like in the final position.' },
		arrange: { prompt: 'Build the letters in 한 from initial to final.', tiles: ['ㄴ', 'ㅎ', 'ㅏ'], answer: ['ㅎ', 'ㅏ', 'ㄴ'], translation: 'han', rationale: '한 contains initial ㅎ, vowel ㅏ, and final ㄴ.' },
		production: { mode: 'speak', prompt: 'Point to the initial, vowel, and final in 한, then read the block.', modelAnswer: '한', modelReading: 'han', checklist: ['Initial ㅎ identified', 'Vowel ㅏ identified', 'Final ㄴ identified', 'Block read as one syllable'] },
		transferPrompt: 'Segment 가, 아, 문, and 한 into initial, vowel, and optional final positions.', transferSupport: '가 = ㄱ+ㅏ; 아 = ㅇ+ㅏ; 문 = ㅁ+ㅜ+ㄴ; 한 = ㅎ+ㅏ+ㄴ.'
	}),
	lesson({
		id: 'ko-01-consonants', unitId: 'korean-launchpad', title: 'Basic Hangul consonants', shortTitle: 'Basic consonants', kind: 'script', durationMinutes: 18,
		canDo: 'Recognize the fourteen basic consonants and read them in simple vowel blocks.',
		focus: ['14 basic consonants', 'position-dependent sound', 'ㅇ', 'ㄹ'],
		scenario: [['Rows', '가 나 다 라 마', 'ga na da ra ma', 'basic consonants with ㅏ'], ['Rows', '바 사 아 자 차 카 타 파 하', 'ba sa a ja cha ka ta pa ha', 'remaining basic consonants with ㅏ']],
		notice: ['Romanization is approximate; consonant realization changes by syllable position and context.', 'ㄹ is tap-like between vowels and l-like in many final positions.'],
		explanation: ['Learn consonants inside pronounceable blocks instead of memorizing isolated letter names only.', 'Plain consonants ㄱ, ㄷ, ㅂ, and ㅈ are neither equivalent to fixed English voiced nor fixed English voiceless sounds.'],
		scriptCharts: [consonantChart],
		vocabulary: [['나', 'na', 'I; me, informal'], ['나라', 'nara', 'country'], ['사람', 'saram', 'person'], ['하나', 'hana', 'one']],
		choice: { prompt: 'Which basic consonant is silent initially but ng-like finally?', options: [['ieung', 'ㅇ'], ['hieut', 'ㅎ'], ['nieun', 'ㄴ']], answer: 'ieung', rationale: 'ㅇ changes by position: silent initially and ng-like finally.' },
		arrange: { prompt: 'Build 나 from its letters.', tiles: ['ㅏ', 'ㄴ', 'ㅓ'], answer: ['ㄴ', 'ㅏ'], translation: 'na', rationale: '나 combines ㄴ and ㅏ.' },
		production: { mode: 'speak', prompt: 'Read 가 나 다 라 마 and 바 사 아 자 하.', modelAnswer: '가 나 다 라 마. 바 사 아 자 하.', modelReading: 'ga na da ra ma. ba sa a ja ha.', checklist: ['Every block read once', 'ㅇ in 아 remains silent', 'ㄹ receives a light tap-like sound'] },
		transferPrompt: 'Decode 나라, 사람, 하나, and 바다 one block at a time.', transferSupport: '나-라; 사-람; 하-나; 바-다.'
	}),
	lesson({
		id: 'ko-02-vowels', unitId: 'korean-launchpad', title: 'Basic Hangul vowels', shortTitle: 'Basic vowels', kind: 'script', durationMinutes: 18,
		canDo: 'Recognize the ten basic vowels and place vertical and horizontal vowels correctly in blocks.',
		focus: ['ㅏㅑㅓㅕ', 'ㅗㅛㅜㅠ', 'ㅡㅣ', 'block orientation'],
		scenario: [['Vertical', '아 야 어 여 이', 'a ya eo yeo i', 'vertical-vowel blocks'], ['Horizontal', '오 요 우 유 으', 'o yo u yu eu', 'horizontal-vowel blocks']],
		notice: ['Vertical vowels place the consonant on the left; horizontal vowels place it above.', 'Romanized eo and eu are spelling conventions, not sequences of two separate vowels.'],
		explanation: ['The short extra stroke creates the y-series in ㅑ, ㅕ, ㅛ, and ㅠ.', 'Keep ㅗ and ㅜ distinct by the direction of the short stroke.'],
		scriptCharts: [vowelChart],
		vocabulary: [['아이', 'ai', 'child'], ['우유', 'uyu', 'milk'], ['오이', 'oi', 'cucumber'], ['여우', 'yeou', 'fox']],
		choice: { prompt: 'Which vowel has its short stroke above the horizontal line?', options: [['o', 'ㅗ'], ['u', 'ㅜ'], ['eu', 'ㅡ']], answer: 'o', rationale: 'ㅗ has the short stroke above; ㅜ has it below.' },
		arrange: { prompt: 'Build 우 from its letters.', tiles: ['ㅇ', 'ㅜ', 'ㅗ'], answer: ['ㅇ', 'ㅜ'], translation: 'u', rationale: '우 uses silent initial ㅇ with vowel ㅜ.' },
		production: { mode: 'speak', prompt: 'Read 아 야 어 여 오 요 우 유 으 이.', modelAnswer: '아 야 어 여 오 요 우 유 으 이.', modelReading: 'a ya eo yeo o yo u yu eu i.', checklist: ['Ten vowel blocks attempted', 'ㅗ and ㅜ remain distinct', 'eo and eu treated as single vowel labels'] },
		transferPrompt: 'Decode 아이, 우유, 오이, and 여우 without naming English letters.', transferSupport: 'Read one Hangul block at a time.'
	}),
	lesson({
		id: 'ko-03-consonant-series', unitId: 'korean-launchpad', title: 'Plain, aspirated, and tense consonants', shortTitle: 'Consonant series', kind: 'sound', durationMinutes: 19,
		canDo: 'Distinguish the plain, aspirated, and tense consonant series in simple syllables.',
		focus: ['ㄱ/ㅋ/ㄲ', 'ㄷ/ㅌ/ㄸ', 'ㅂ/ㅍ/ㅃ', 'ㅈ/ㅊ/ㅉ', 'ㅅ/ㅆ'],
		scenario: [['Contrast', '가／카／까', 'ga / ka / kka', 'plain / aspirated / tense'], ['Contrast', '자／차／짜', 'ja / cha / jja', 'plain / aspirated / tense']],
		notice: ['Aspirated consonants have a stronger release of air.', 'Tense consonants use tighter articulation and different timing; they are written as doubled letters.'],
		explanation: ['The three-way contrast is central to Korean and cannot be reduced to English voiced versus voiceless pairs.', 'Compare syllables with the same vowel and similar pitch environment.'],
		scriptCharts: [tenseChart],
		vocabulary: [['가다', 'gada', 'go'], ['크다', 'keuda', 'be big'], ['짜다', 'jjada', 'be salty'], ['싸다', 'ssada', 'be inexpensive']],
		choice: { prompt: 'Which letter is the tense counterpart of ㄱ?', options: [['ssanggiyeok', 'ㄲ'], ['kieuk', 'ㅋ'], ['digeut', 'ㄷ']], answer: 'ssanggiyeok', rationale: 'ㄲ is the tense doubled counterpart; ㅋ is aspirated.' },
		arrange: { prompt: 'Build 까 from its letters.', tiles: ['ㄱ', 'ㄲ', 'ㅏ'], answer: ['ㄲ', 'ㅏ'], translation: 'kka', rationale: 'The tense initial is written ㄲ.' },
		production: { mode: 'speak', prompt: 'Contrast 가/카/까, 다/타/따, and 자/차/짜.', modelAnswer: '가, 카, 까. 다, 타, 따. 자, 차, 짜.', modelReading: 'ga, ka, kka. da, ta, tta. ja, cha, jja.', checklist: ['More air on aspirated syllables', 'Tense syllables begin tightly', 'Vowel quality remains stable'] },
		transferPrompt: 'Read 고기, 토끼, 커피, and 짜요 and classify each highlighted initial as plain, aspirated, or tense.', transferSupport: 'ㄱ plain; ㄲ tense; ㅋ/ㅍ aspirated; ㅉ tense.'
	}),
	lesson({
		id: 'ko-04-compound-vowels', unitId: 'korean-launchpad', title: 'Compound Hangul vowels', shortTitle: 'Compound vowels', kind: 'script', durationMinutes: 18,
		canDo: 'Recognize the eleven compound vowels and decode common words that contain them.',
		focus: ['ㅐ/ㅔ', 'ㅘ/ㅝ', 'ㅚ/ㅟ', 'ㅢ'],
		scenario: [['Examples', '왜・외・위', 'wae · oe · wi', 'why · outside · above'], ['Example', '의사', 'uisa', 'doctor']],
		notice: ['Compound vowels occupy one vowel position inside the block.', 'ㅐ and ㅔ are merged or nearly merged for many contemporary Seoul speakers, but spelling remains distinct.'],
		explanation: ['Read the compound as one syllabic vowel rather than two separate beats.', 'Pronunciation of ㅢ varies by position and grammatical function; ui is the reference reading.'],
		scriptCharts: [compoundVowelChart],
		vocabulary: [['왜', 'wae', 'why'], ['외국', 'oeguk', 'foreign country'], ['위', 'wi', 'above'], ['의사', 'uisa', 'doctor']],
		choice: { prompt: 'Which item is one compound vowel inside a single block?', options: [['wae', '왜'], ['a-i', '아이'], ['u-yu', '우유']], answer: 'wae', rationale: '왜 contains the single compound vowel ㅙ.' },
		arrange: { prompt: 'Build 와 from its letters.', tiles: ['ㅇ', 'ㅘ', 'ㅏ', 'ㅗ'], answer: ['ㅇ', 'ㅘ'], translation: 'wa', rationale: '와 uses silent ㅇ with compound vowel ㅘ.' },
		production: { mode: 'speak', prompt: 'Read 애, 에, 와, 워, 외, 위, and 의.', modelAnswer: '애, 에, 와, 워, 외, 위, 의.', modelReading: 'ae, e, wa, wo, oe, wi, ui.', checklist: ['Each item kept to one syllable', '와 and 워 remain distinct', '위 does not become two syllables'] },
		transferPrompt: 'Decode 왜요, 외국, 위에, and 의사 one block at a time.', transferSupport: '왜-요; 외-국; 위-에; 의-사.'
	}),
	lesson({
		id: 'ko-05-batchim', unitId: 'korean-launchpad', title: 'Final consonants: batchim', shortTitle: 'Batchim', kind: 'script', durationMinutes: 19,
		canDo: 'Identify a final consonant and read the seven basic coda categories before a pause.',
		focus: ['받침', 'seven coda categories', 'unreleased stops', 'ㅇ final'],
		scenario: [['Examples', '국・옷・밥', 'guk · ot · bap', 'country · clothes · rice/meal'], ['Examples', '산・물・밤・방', 'san · mul · bam · bang', 'mountain · water · night · room']],
		notice: ['A final consonant sits at the bottom of the block.', 'Stop codas are unreleased before a pause; do not add an English-style final vowel.'],
		explanation: ['Several different written consonants neutralize into the same final sound category.', 'Final ㅇ is ng-like, unlike its silent initial use.'],
		scriptCharts: [batchimChart],
		vocabulary: [['국', 'guk', 'country'], ['옷', 'ot', 'clothes'], ['밥', 'bap', 'rice; meal'], ['방', 'bang', 'room']],
		choice: { prompt: 'How is ㅇ used in 방?', options: [['final-ng', 'As final ng'], ['silent', 'As a silent initial'], ['h', 'As h']], answer: 'final-ng', rationale: 'ㅇ in the final position is ng-like.' },
		arrange: { prompt: 'Build 밥 from initial, vowel, and final.', tiles: ['ㅂ', 'ㅏ', 'ㅂ', 'ㅍ'], answer: ['ㅂ', 'ㅏ', 'ㅂ'], translation: 'bap', rationale: '밥 contains ㅂ in both initial and final positions.' },
		production: { mode: 'speak', prompt: 'Read 국, 옷, 밥, 산, 물, 밤, and 방 without releasing stop codas.', modelAnswer: '국, 옷, 밥, 산, 물, 밤, 방.', modelReading: 'guk, ot, bap, san, mul, bam, bang.', checklist: ['Final stops remain unreleased', 'Final ㄹ is l-like', 'Final ㅇ is ng-like'] },
		transferPrompt: 'Identify and classify the batchim in 한국, 사람, 서울, 집, and 공.', transferSupport: 'ㄱ, ㅁ, ㄹ, ㅂ, ㅇ.'
	}),
	lesson({
		id: 'ko-06-linking', unitId: 'korean-launchpad', title: 'Linking and basic sound changes', shortTitle: 'Sound changes', kind: 'sound', durationMinutes: 19,
		canDo: 'Recognize basic linking before a vowel and two high-frequency consonant changes.',
		focus: ['받침 linking', '한국어', '옷이', 'nasal assimilation'],
		scenario: [['Linking', '한국어', 'han-gu-geo', 'Korean language'], ['Linking', '옷이', 'o-si', 'clothes + subject particle'], ['Assimilation', '국물', 'gung-mul', 'soup']],
		notice: ['Before a following vowel-initial block, a pronounceable final consonant often links into the next syllable.', 'Spelling remains stable even when pronunciation changes.'],
		explanation: ['한국어 is written 한-국-어 but commonly parsed in speech as 한-구-거.', 'In 국물, final ㄱ becomes ng-like before ㅁ through nasal assimilation.'],
		vocabulary: [['한국어', 'hangugeo', 'Korean language'], ['옷이', 'osi', 'clothes + subject marker'], ['국물', 'gungmul', 'soup; broth'], ['있어요', 'isseoyo', 'there is; have']],
		choice: { prompt: 'Which spoken segmentation reflects linking in 한국어?', options: [['linked', '한-구-거'], ['written', '한-국-어 with three separated releases'], ['extra', '하-누-거']], answer: 'linked', rationale: 'Final ㄱ links to the following vowel-initial 어.' },
		arrange: { prompt: 'Arrange the spoken syllables of 한국어.', tiles: ['거', '한', '구'], answer: ['한', '구', '거'], translation: 'hangugeo', rationale: 'Linking yields the spoken sequence 한-구-거.' },
		production: { mode: 'speak', prompt: 'Read 한국어, 옷이, and 국물 with the basic sound changes.', modelAnswer: '한국어. 옷이. 국물.', modelReading: 'han-gu-geo. o-si. gung-mul.', checklist: ['Final consonant links before a vowel', '옷이 has si in connected speech', '국물 begins gung-mul rather than guk-mul'] },
		transferPrompt: 'Predict and then check the connected pronunciation of 집에, 음악, and 한국인.', transferSupport: 'Final consonants may link before vowels; check each dictionary audio after predicting.'
	}),
	lesson({
		id: 'ko-07-reading', unitId: 'korean-launchpad', title: 'Reading words without romanization', shortTitle: 'Word reading', kind: 'reader', durationMinutes: 17,
		canDo: 'Decode short Hangul words directly and use romanization only to check a completed reading.',
		focus: ['direct Hangul decoding', 'spacing', 'keyboard layout', 'sound-change check'],
		scenario: [['Words', '사람・학교・우유', 'saram · hakgyo · uyu', 'person · school · milk'], ['Phrase', '한국어 공부', 'hangugeo gongbu', 'Korean study']],
		notice: ['Korean separates words with spaces, while particles attach to the word they mark.', 'Typing uses individual consonant and vowel keys; the input method assembles valid blocks automatically.'],
		explanation: ['Decode block by block, then reread the word with any relevant linking or assimilation.', 'Romanization cannot represent every contextual detail reliably and should become a checking tool rather than the main reading path.'],
		vocabulary: [['사람', 'saram', 'person'], ['학교', 'hakgyo', 'school'], ['우유', 'uyu', 'milk'], ['공부', 'gongbu', 'study']],
		choice: { prompt: 'Which item contains three Hangul syllable blocks?', options: [['saram', '사람'], ['hakgyo', '학교'], ['hangugeo', '한국어']], answer: 'hangugeo', rationale: '한국어 contains 한, 국, and 어, three blocks.' },
		arrange: { prompt: 'Build 한국어 from syllable blocks.', tiles: ['어', '국', '한', '글'], answer: ['한', '국', '어'], translation: 'Korean language', rationale: 'The written word is 한-국-어.' },
		production: { mode: 'speak', prompt: 'Read 사람, 학교, 우유, and 한국어 without opening romanization first.', modelAnswer: '사람. 학교. 우유. 한국어.', modelReading: 'saram. hakgyo. uyu. hangugeo.', checklist: ['Each block decoded in order', 'No English letter names used', 'Connected pronunciation checked after the first attempt'] },
		transferPrompt: 'Type 친구, 이름, 커피, and 서울 from a Hangul keyboard reference, then read the result.', transferSupport: 'Build each block from consonant and vowel letters; check the completed word, not Latin spelling.'
	}),
	lesson({
		id: 'ko-08-name', unitId: 'korean-introductions', title: 'Stating your name', shortTitle: 'Your name',
		canDo: 'State your name politely and ask someone’s name.',
		focus: ['저는…예요/이에요', '이름이 뭐예요', 'topic particle 는'],
		scenario: [['민지', '안녕하세요. 저는 민지예요.', 'annyeonghaseyo. jeoneun minjiyeyo.', 'Hello. I am Minji.'], ['준호', '안녕하세요. 이름이 뭐예요?', 'annyeonghaseyo. ireumi mwoyeyo?', 'Hello. What is your name?']],
		notice: ['저는 marks 저 “I” as the topic with 는.', '예요 follows a vowel-ending noun; 이에요 follows a consonant-ending noun.'],
		explanation: ['Name + 예요/이에요 identifies the speaker politely.', '이름이 뭐예요 literally asks what the name is; 이 marks 이름 as the subject.'],
		vocabulary: [['저', 'jeo', 'I; me, polite'], ['이름', 'ireum', 'name'], ['뭐', 'mwo', 'what'], ['안녕하세요', 'annyeonghaseyo', 'hello']],
		choice: { prompt: 'Which ending follows the vowel-ending name 민지?', options: [['yeyo', '예요'], ['ieyo', '이에요'], ['aniyo', '아니요']], answer: 'yeyo', rationale: '예요 follows a noun ending in a vowel.' },
		arrange: { prompt: 'Build “I am Minji.”', tiles: ['민지예요', '저는', '뭐예요'], answer: ['저는', '민지예요'], translation: 'I am Minji.', rationale: 'The topic phrase precedes the name predicate.' },
		production: { mode: 'speak', prompt: 'Greet someone, state your name, and ask their name.', modelAnswer: '안녕하세요. 저는 민지예요. 이름이 뭐예요?', modelReading: 'annyeonghaseyo. jeoneun minjiyeyo. ireumi mwoyeyo?', checklist: ['Polite greeting included', 'Name ends with 예요 or 이에요', 'Question uses 이름이 뭐예요'] },
		transferPrompt: 'Replace 민지 with your own name and choose 예요 or 이에요 from the final sound.', transferSupport: 'Vowel ending + 예요; consonant ending + 이에요.'
	}),
	lesson({
		id: 'ko-09-identity', unitId: 'korean-introductions', title: 'Identity and negation', shortTitle: 'Identity',
		canDo: 'State a noun identity with 이에요/예요 and negate it with 아니에요.',
		focus: ['학생이에요', '아니에요', '저도', 'noun predicates'],
		scenario: [['민지', '저는 학생이에요.', 'jeoneun haksaeng-ieyo.', 'I am a student.'], ['준호', '저는 학생이 아니에요. 회사원이에요.', 'jeoneun haksaeng-i anieyo. hoesawon-ieyo.', 'I am not a student. I am an office worker.']],
		notice: ['A consonant-ending noun such as 학생 takes 이에요.', 'Noun negation uses noun + 이/가 아니에요.'],
		explanation: ['아니에요 is not formed by simply placing 안 before 이에요.', '도 means “also” and replaces a topic or subject particle in simple expressions such as 저도.'],
		vocabulary: [['학생', 'haksaeng', 'student'], ['회사원', 'hoesawon', 'office worker'], ['아니에요', 'anieyo', 'is not'], ['도', 'do', 'also']],
		choice: { prompt: 'Which sentence means “I am not a student”?', options: [['negative', '저는 학생이 아니에요.'], ['positive', '저는 학생이에요.'], ['question', '학생이에요?']], answer: 'negative', rationale: '학생이 아니에요 negates the noun identity.' },
		arrange: { prompt: 'Build “I am a student.”', tiles: ['학생이에요', '저는', '아니에요'], answer: ['저는', '학생이에요'], translation: 'I am a student.', rationale: '학생 ends in a consonant, so it takes 이에요.' },
		production: { mode: 'speak', prompt: 'State one identity and contrast it with one identity that is not true.', modelAnswer: '저는 회사원이에요. 학생이 아니에요.', modelReading: 'jeoneun hoesawon-ieyo. haksaeng-i anieyo.', checklist: ['Positive noun predicate included', 'Negative uses 이/가 아니에요', 'Polite ending maintained'] },
		transferPrompt: 'Use two new occupations to state one positive and one negative identity.', transferSupport: '저는 …이에요/예요. …이/가 아니에요.'
	}),
	lesson({
		id: 'ko-10-origin', unitId: 'korean-introductions', title: 'Origin and language', shortTitle: 'Origin and language',
		canDo: 'State where you came from and which language you study.',
		focus: ['…에서 왔어요', '한국어를 공부해요', 'object particle 을/를'],
		scenario: [['준호', '어디에서 왔어요?', 'eodieseo wasseoyo?', 'Where are you from?'], ['민지', '캐나다에서 왔어요. 한국어를 공부해요.', 'kaenadaeseo wasseoyo. hangugeoreul gongbuhaeyo.', 'I am from Canada. I study Korean.']],
		notice: ['Place + 에서 왔어요 states the place someone came from.', '를 follows a vowel-ending object; 을 follows a consonant-ending object.'],
		explanation: ['The subject is often omitted when the speaker is clear.', '공부해요 is the polite present form used for study as an activity.'],
		vocabulary: [['어디', 'eodi', 'where'], ['에서', 'eseo', 'from; at'], ['왔어요', 'wasseoyo', 'came'], ['공부해요', 'gongbuhaeyo', 'study']],
		choice: { prompt: 'What does 캐나다에서 왔어요 state?', options: [['origin', 'The speaker came from Canada'], ['location-now', 'The speaker is currently in Canada'], ['language', 'The speaker studies Canadian']], answer: 'origin', rationale: 'Place + 에서 왔어요 states origin.' },
		arrange: { prompt: 'Build “I study Korean.”', tiles: ['공부해요', '한국어를', '왔어요'], answer: ['한국어를', '공부해요'], translation: 'I study Korean.', rationale: 'The object phrase precedes 공부해요.' },
		production: { mode: 'speak', prompt: 'State where you are from and that you study Korean.', modelAnswer: '캐나다에서 왔어요. 한국어를 공부해요.', modelReading: 'kaenadaeseo wasseoyo. hangugeoreul gongbuhaeyo.', checklist: ['Origin uses 에서 왔어요', '한국어 takes 를', 'Both statements use polite endings'] },
		transferPrompt: 'Ask and answer the origin question with a different place and language.', transferSupport: '어디에서 왔어요? …에서 왔어요. …를 공부해요.'
	}),
	lesson({
		id: 'ko-11-intro-mission', unitId: 'korean-introductions', title: 'Mission: complete a first meeting', shortTitle: 'First meeting', kind: 'mission', durationMinutes: 18,
		canDo: 'Complete a polite first meeting with a name, identity, origin, and one question.',
		focus: ['integrated introduction', 'polite endings', 'question response'],
		scenario: [['민지', '안녕하세요. 저는 민지예요. 캐나다에서 왔어요.', 'annyeonghaseyo. jeoneun minjiyeyo. kaenadaeseo wasseoyo.', 'Hello. I am Minji. I am from Canada.'], ['준호', '반가워요. 저는 준호예요. 한국어를 공부해요?', 'bangawoyo. jeoneun junho-yeyo. hangugeoreul gongbuhaeyo?', 'Nice to meet you. I am Junho. Do you study Korean?']],
		notice: ['Korean often omits repeated subjects after the topic is established.', 'A rising question intonation can turn a polite statement form into a question in suitable contexts.'],
		explanation: ['The mission combines forms already introduced rather than adding a new grammar target.', 'Maintain the polite 해요-style register throughout the first meeting.'],
		vocabulary: [['반가워요', 'bangawoyo', 'nice to meet you'], ['한국', 'Hanguk', 'Korea'], ['영어', 'yeongeo', 'English language'], ['친구', 'chingu', 'friend']],
		choice: { prompt: 'Which expression maintains the polite register?', options: [['polite', '반가워요'], ['plain', '반가워'], ['noun', '반가움']], answer: 'polite', rationale: 'The -요 ending maintains the polite conversational register.' },
		arrange: { prompt: 'Build “I came from Canada.”', tiles: ['왔어요', '캐나다에서', '저는'], answer: ['저는', '캐나다에서', '왔어요'], translation: 'I came from Canada.', rationale: 'The origin phrase precedes 왔어요.' },
		production: { mode: 'speak', prompt: 'Give your name, identity, and origin, then ask one relevant question.', modelAnswer: '안녕하세요. 저는 민지예요. 학생이에요. 캐나다에서 왔어요. 이름이 뭐예요?', modelReading: 'annyeonghaseyo. jeoneun minjiyeyo. haksaeng-ieyo. kaenadaeseo wasseoyo. ireumi mwoyeyo?', checklist: ['Name stated politely', 'One identity included', 'Origin uses 에서 왔어요', 'One relevant question asked'] },
		transferPrompt: 'Repeat the meeting with a different identity and origin without copying the model nouns.', transferSupport: '저는 …예요/이에요. …에서 왔어요. …예요/이에요?'
	}),
	lesson({
		id: 'ko-12-day-date', unitId: 'korean-daily', title: 'Days and dates', shortTitle: 'Days and dates',
		canDo: 'Ask and state a weekday or simple calendar date.',
		focus: ['오늘', '무슨 요일', '월/일', '에'],
		scenario: [['민지', '오늘은 무슨 요일이에요?', 'oneureun museun yoir-ieyo?', 'What day is it today?'], ['준호', '오늘은 수요일이에요. 팔월 이십 일이에요.', 'oneureun suyoir-ieyo. parwol isip ir-ieyo.', 'Today is Wednesday. It is August 20.']],
		notice: ['Weekday names end in 요일.', 'Calendar dates move from month to day and use Sino-Korean numbers.'],
		explanation: ['무슨 asks which kind or which item from an expected set.', 'Sound changes affect connected readings such as 월 and 일; dictionary audio should confirm them.'],
		vocabulary: [['오늘', 'oneul', 'today'], ['요일', 'yoil', 'weekday'], ['수요일', 'suyoil', 'Wednesday'], ['일', 'il', 'day; one']],
		choice: { prompt: 'Which weekday is 수요일?', options: [['wed', 'Wednesday'], ['mon', 'Monday'], ['fri', 'Friday']], answer: 'wed', rationale: '수요일 is Wednesday.' },
		arrange: { prompt: 'Build “What day is it today?”', tiles: ['무슨', '오늘은', '요일이에요'], answer: ['오늘은', '무슨', '요일이에요'], translation: 'What day is it today?', rationale: '무슨 modifies 요일.' },
		production: { mode: 'speak', prompt: 'Ask today’s weekday and answer with a weekday and date.', modelAnswer: '오늘은 무슨 요일이에요? 수요일이에요. 팔월 이십 일이에요.', modelReading: 'oneureun museun yoir-ieyo? suyoir-ieyo. parwol isip ir-ieyo.', checklist: ['Question uses 무슨 요일', 'Weekday ends in 요일', 'Month precedes day'] },
		transferPrompt: 'State three different dates and weekdays in Korean order.', transferSupport: '…월 …일, …요일이에요.'
	}),
	lesson({
		id: 'ko-13-clock-time', unitId: 'korean-daily', title: 'Clock time', shortTitle: 'Clock time',
		canDo: 'Ask for the current time and state an hour and half hour.',
		focus: ['지금', '몇 시', 'native Korean hours', '반'],
		scenario: [['준호', '지금 몇 시예요?', 'jigeum myeot siyeyo?', 'What time is it now?'], ['민지', '지금 일곱 시 반이에요.', 'jigeum ilgop si ban-ieyo.', 'It is 7:30 now.']],
		notice: ['Hours use native Korean numbers; minutes use Sino-Korean numbers.', '반 follows 시 for half past the hour.'],
		explanation: ['몇 asks how many or which number in the time question.', 'Some native hour forms shorten before 시: 하나→한 시, 둘→두 시, 셋→세 시, 넷→네 시.'],
		vocabulary: [['지금', 'jigeum', 'now'], ['시', 'si', 'hour; o’clock'], ['분', 'bun', 'minute'], ['반', 'ban', 'half']],
		choice: { prompt: 'What time is 일곱 시 반?', options: [['730', '7:30'], ['715', '7:15'], ['630', '6:30']], answer: '730', rationale: '반 means half past the stated hour.' },
		arrange: { prompt: 'Build “It is 7:30 now.”', tiles: ['일곱 시', '지금', '반이에요'], answer: ['지금', '일곱 시', '반이에요'], translation: 'It is 7:30 now.', rationale: 'The time phrase precedes the polite predicate ending.' },
		production: { mode: 'speak', prompt: 'Ask the time and answer with 7:30 and 9:15.', modelAnswer: '지금 몇 시예요? 일곱 시 반이에요. 아홉 시 십오 분이에요.', modelReading: 'jigeum myeot siyeyo? ilgop si ban-ieyo. ahop si sibo bun-ieyo.', checklist: ['몇 시 used in the question', 'Native Korean number used for hour', 'Sino-Korean number used for minutes'] },
		transferPrompt: 'State 2:00, 6:20, and 10:30 with the correct number systems.', transferSupport: '두 시; 여섯 시 이십 분; 열 시 반.'
	}),
	lesson({
		id: 'ko-14-routine', unitId: 'korean-daily', title: 'Daily routine', shortTitle: 'Daily routine',
		canDo: 'Describe when routine actions happen using a time phrase marked by 에.',
		focus: ['time + 에', '매일', '일어나요', '먹어요'],
		scenario: [['민지', '저는 매일 일곱 시에 일어나요.', 'jeoneun maeil ilgop sie ireonayo.', 'I get up at seven every day.'], ['준호', '여덟 시에 아침을 먹어요.', 'yeodeol sie achimeul meogeoyo.', 'I eat breakfast at eight.']],
		notice: ['에 marks the time at which an event happens.', 'The object particle 을 follows consonant-ending 아침.'],
		explanation: ['Korean time phrases normally precede the verb.', 'The polite present endings in 일어나요 and 먹어요 do not change by grammatical person.'],
		vocabulary: [['매일', 'maeil', 'every day'], ['일어나다', 'ireonada', 'get up'], ['아침', 'achim', 'morning; breakfast'], ['먹다', 'meokda', 'eat']],
		choice: { prompt: 'Which particle marks seven o’clock as the event time?', options: [['e', '에'], ['eul', '을'], ['eun', '은']], answer: 'e', rationale: '에 marks the time when the action occurs.' },
		arrange: { prompt: 'Build “I get up at seven every day.”', tiles: ['일어나요', '매일', '저는', '일곱 시에'], answer: ['저는', '매일', '일곱 시에', '일어나요'], translation: 'I get up at seven every day.', rationale: 'The order is topic + frequency + marked time + verb.' },
		production: { mode: 'speak', prompt: 'Describe when you get up and when you eat breakfast.', modelAnswer: '저는 매일 일곱 시에 일어나요. 여덟 시에 아침을 먹어요.', modelReading: 'jeoneun maeil ilgop sie ireonayo. yeodeol sie achimeul meogeoyo.', checklist: ['Each clock time takes 에', 'Two routine actions included', 'Polite verb endings maintained'] },
		transferPrompt: 'Describe two new routine actions with different times.', transferSupport: '저는 …시에 …아요/어요.'
	}),
	lesson({
		id: 'ko-15-schedule-mission', unitId: 'korean-daily', title: 'Mission: arrange a time', shortTitle: 'Arrange a time', kind: 'mission', durationMinutes: 18,
		canDo: 'Propose a meeting day and time, respond, and confirm the arrangement.',
		focus: ['…에 만나요', '어때요', '좋아요', 'confirmation'],
		scenario: [['민지', '토요일 오후 세 시에 만나요. 어때요?', 'toyoil ohu se sie mannayo. eottaeyo?', 'Let’s meet Saturday at 3 p.m. How is that?'], ['준호', '좋아요. 토요일에 만나요.', 'joayo. toyoire mannayo.', 'Sounds good. See you Saturday.']],
		notice: ['에 marks both a meeting time and a destination in different patterns.', '어때요 asks how a proposal is; 좋아요 accepts it positively.'],
		explanation: ['Time expressions move from larger units to smaller ones: weekday, part of day, hour.', 'Repeat the agreed information in the final confirmation.'],
		vocabulary: [['토요일', 'toyoil', 'Saturday'], ['오후', 'ohu', 'afternoon'], ['만나요', 'mannayo', 'meet'], ['어때요', 'eottaeyo', 'how is it']],
		choice: { prompt: 'Which order follows the normal large-to-small time sequence?', options: [['right', '토요일 오후 세 시'], ['reverse', '세 시 오후 토요일'], ['mixed', '오후 토요일 세 시']], answer: 'right', rationale: 'Weekday precedes part of day, which precedes the hour.' },
		arrange: { prompt: 'Build “Let’s meet Saturday at three.”', tiles: ['만나요', '토요일', '세 시에'], answer: ['토요일', '세 시에', '만나요'], translation: 'Let’s meet Saturday at three.', rationale: 'The time phrase marked by 에 precedes 만나요.' },
		production: { mode: 'speak', prompt: 'Propose a day and time, accept or reject it, and confirm the final plan.', modelAnswer: '토요일 오후 세 시에 만나요. 어때요? 좋아요. 토요일 오후 세 시에 만나요.', modelReading: 'toyoil ohu se sie mannayo. eottaeyo? joayo. toyoil ohu se sie mannayo.', checklist: ['Proposal includes day and time', 'Response is explicit', 'Final confirmation repeats the agreed time'] },
		transferPrompt: 'Reject one proposal, offer a replacement time, and confirm it.', transferSupport: '…에 만나요. 어때요? 그때는 안 돼요. …은/는 어때요?'
	}),
	lesson({
		id: 'ko-16-ordering', unitId: 'korean-food-places', title: 'Ordering food and drink', shortTitle: 'Ordering',
		canDo: 'Order common items with 주세요 and basic counters.',
		focus: ['주세요', '하나/한 잔', '하고', 'service politeness'],
		scenario: [['손님', '비빔밥 하나하고 차 한 잔 주세요.', 'bibimbap hanahago cha han jan juseyo.', 'Please give me one bibimbap and one cup of tea.'], ['직원', '네, 알겠습니다.', 'ne, algetseumnida.', 'Yes, understood.']],
		notice: ['주세요 turns the preceding item into a polite request.', '하나 can count an item by itself; 한 is the shortened form before a counter such as 잔.'],
		explanation: ['하고 links nouns in conversational Korean.', 'Counters follow native Korean number forms in this beginner pattern.'],
		vocabulary: [['주세요', 'juseyo', 'please give me'], ['비빔밥', 'bibimbap', 'bibimbap'], ['잔', 'jan', 'cup; glass counter'], ['하고', 'hago', 'and; with']],
		choice: { prompt: 'Which expression politely requests the preceding item?', options: [['juseyo', '주세요'], ['anieyo', '아니에요'], ['eodiyeyo', '어디예요']], answer: 'juseyo', rationale: '주세요 is the service-request form used here.' },
		arrange: { prompt: 'Build “One cup of tea, please.”', tiles: ['주세요', '차', '한 잔'], answer: ['차', '한 잔', '주세요'], translation: 'One cup of tea, please.', rationale: 'The item and quantity precede 주세요.' },
		production: { mode: 'speak', prompt: 'Order one food item and one drink with an appropriate counter.', modelAnswer: '비빔밥 하나하고 차 한 잔 주세요.', modelReading: 'bibimbap hanahago cha han jan juseyo.', checklist: ['Request ends with 주세요', 'Drink uses 한 잔', '하고 links the items'] },
		transferPrompt: 'Place a new two-item order and respond when asked whether you need anything else.', transferSupport: '… 하나하고 … 한 잔 주세요. 괜찮아요.'
	}),
	lesson({
		id: 'ko-17-prices', unitId: 'korean-food-places', title: 'Prices and quantities', shortTitle: 'Prices',
		canDo: 'Ask a price, understand a whole-won answer, and confirm a total.',
		focus: ['얼마예요', '원', '모두', 'Sino-Korean numbers'],
		scenario: [['손님', '이거 얼마예요?', 'igeo eolmayeyo?', 'How much is this?'], ['직원', '팔천 원이에요. 모두 만이천 원이에요.', 'palcheon won-ieyo. modu man-icheon won-ieyo.', 'It is 8,000 won. The total is 12,000 won.']],
		notice: ['얼마예요 asks how much something costs.', 'Prices use Sino-Korean numbers plus 원.'],
		explanation: ['모두 introduces the total in this exchange.', 'Large Korean price numbers group around units such as 천 thousand and 만 ten thousand.'],
		vocabulary: [['이거', 'igeo', 'this thing'], ['얼마', 'eolma', 'how much'], ['원', 'won', 'won currency unit'], ['모두', 'modu', 'all; altogether']],
		choice: { prompt: 'What amount is 팔천 원?', options: [['8000', '8,000 won'], ['18000', '18,000 won'], ['800', '800 won']], answer: '8000', rationale: '팔천 is eight thousand.' },
		arrange: { prompt: 'Build “How much is this?”', tiles: ['얼마예요', '이거', '뭐예요'], answer: ['이거', '얼마예요'], translation: 'How much is this?', rationale: 'The item topic precedes 얼마예요.' },
		production: { mode: 'speak', prompt: 'Ask one price and confirm a total of twelve thousand won.', modelAnswer: '이거 얼마예요? 팔천 원이에요. 모두 만이천 원이에요, 맞아요?', modelReading: 'igeo eolmayeyo? palcheon won-ieyo. modu man-icheon won-ieyo, majayo?', checklist: ['Price question uses 얼마예요', 'Amounts end with 원', 'Total introduced with 모두'] },
		transferPrompt: 'Ask and answer prices of 5,000, 16,000, and 32,000 won, then state a total.', transferSupport: '이거 얼마예요? …원이에요. 모두 …원이에요.'
	}),
	lesson({
		id: 'ko-18-location', unitId: 'korean-food-places', title: 'Asking where a place is', shortTitle: 'Location',
		canDo: 'Ask where a place is and understand a simple relative-location answer.',
		focus: ['어디에 있어요', '옆', '앞', '에'],
		scenario: [['민지', '화장실이 어디에 있어요?', 'hwajangsiri eodie isseoyo?', 'Where is the restroom?'], ['직원', '식당 옆에 있어요.', 'sikdang yeope isseoyo.', 'It is beside the restaurant.']],
		notice: ['어디에 있어요 asks where something exists.', 'Relative-location nouns follow the landmark and take 에: 식당 옆에.'],
		explanation: ['The subject particle 이 follows consonant-ending 화장실.', '앞 means front and 옆 means side; both can form location phrases with 에.'],
		vocabulary: [['화장실', 'hwajangsil', 'restroom'], ['어디', 'eodi', 'where'], ['식당', 'sikdang', 'restaurant'], ['옆', 'yeop', 'side; beside']],
		choice: { prompt: 'What relationship does 옆 express?', options: [['beside', 'Beside; next to'], ['inside', 'Inside'], ['behind', 'Behind']], answer: 'beside', rationale: '옆 means the side or beside.' },
		arrange: { prompt: 'Build “Where is the restroom?”', tiles: ['어디에', '화장실이', '있어요'], answer: ['화장실이', '어디에', '있어요'], translation: 'Where is the restroom?', rationale: 'The unknown location phrase precedes 있어요.' },
		production: { mode: 'speak', prompt: 'Ask for the restroom and give a location beside the restaurant.', modelAnswer: '화장실이 어디에 있어요? 식당 옆에 있어요.', modelReading: 'hwajangsiri eodie isseoyo? sikdang yeope isseoyo.', checklist: ['Question uses 어디에 있어요', 'Answer ends with 있어요', 'Landmark precedes 옆에'] },
		transferPrompt: 'Ask for a station, shop, or school and answer using 앞에 or 옆에.', transferSupport: '…이/가 어디에 있어요? … 앞에/옆에 있어요.'
	}),
	lesson({
		id: 'ko-19-service-mission', unitId: 'korean-food-places', title: 'Mission: order and ask for a location', shortTitle: 'Service exchange', kind: 'mission', durationMinutes: 20,
		canDo: 'Complete a Korean service exchange with an order, price confirmation, and location question.',
		focus: ['integrated order', 'total confirmation', 'location question'],
		scenario: [['손님', '비빔밥 하나하고 차 한 잔 주세요. 모두 얼마예요?', 'bibimbap hanahago cha han jan juseyo. modu eolmayeyo?', 'Please give me one bibimbap and one cup of tea. How much is it altogether?'], ['직원', '만이천 원이에요. 화장실은 문 옆에 있어요.', 'man-icheon won-ieyo. hwajangsireun mun yeope isseoyo.', 'It is 12,000 won. The restroom is beside the door.']],
		notice: ['The total question can omit an established list of items.', '은 can mark 화장실 as the topic when shifting from payment to location.'],
		explanation: ['This mission combines counters, requests, prices, and existence-location patterns.', 'Open production remains self-checked rather than automatically certified.'],
		vocabulary: [['문', 'mun', 'door'], ['더', 'deo', 'more'], ['필요해요', 'piryohaeyo', 'need'], ['감사합니다', 'gamsahamnida', 'thank you']],
		choice: { prompt: 'Which question asks for the total price?', options: [['total', '모두 얼마예요?'], ['location', '화장실이 어디에 있어요?'], ['identity', '누구예요?']], answer: 'total', rationale: '모두 얼마예요 asks how much everything costs together.' },
		arrange: { prompt: 'Build “The restroom is beside the door.”', tiles: ['문', '있어요', '화장실은', '옆에'], answer: ['화장실은', '문', '옆에', '있어요'], translation: 'The restroom is beside the door.', rationale: 'The landmark 문 precedes 옆에 있어요.' },
		production: { mode: 'speak', prompt: 'Order two items, ask the total, then ask where the restroom is.', modelAnswer: '비빔밥 하나하고 차 한 잔 주세요. 모두 얼마예요? 화장실이 어디에 있어요?', modelReading: 'bibimbap hanahago cha han jan juseyo. modu eolmayeyo? hwajangsiri eodie isseoyo?', checklist: ['Two counted items ordered', 'Total requested with 모두 얼마예요', 'Location requested with 어디에 있어요', 'Polite endings maintained'] },
		transferPrompt: 'Repeat the exchange with different items, a different total, and a different destination.', transferSupport: '… 주세요. 모두 얼마예요? …이/가 어디에 있어요?'
	}),
	lesson({
		id: 'ko-20-family-photo', unitId: 'korean-family-home', title: 'Identifying family members', shortTitle: 'Family photo',
		canDo: 'Identify one person in a family photo and state that person’s relationship to you.',
		focus: ['이분은 누구예요', '제 + family noun', '언니 versus 누나'],
		scenario: [['준호', '이분은 누구예요?', 'ibuneun nuguyeyo?', 'Who is this person?'], ['민지', '제 언니예요. 서울에서 일해요.', 'je eonniyeyo. seoureseo ilhaeyo.', 'She is my older sister. She works in Seoul.']],
		notice: ['이분 is a respectful way to refer to “this person”; 누구 asks who the person is.', '제 is the polite contracted form of 저의 and marks the relationship as “my.”'],
		explanation: ['A woman normally calls her older sister 언니; a man normally calls his older sister 누나. The speaker’s gender determines the term.', '에서 marks the place where an action such as working happens.'],
		vocabulary: [['이분', 'ibun', 'this person (respectful)'], ['누구', 'nugu', 'who'], ['언니', 'eonni', 'older sister of a female'], ['제', 'je', 'my (polite)'], ['일하다', 'ilhada', 'work']],
		choice: { prompt: 'What information does 이분은 누구예요 request?', options: [['person', 'The person’s identity'], ['place', 'The person’s location'], ['age', 'The person’s age']], answer: 'person', rationale: '누구 means “who” and asks for a person’s identity.' },
		reviewChoices: [{ prompt: 'Which term does a female speaker normally use for her older sister?', options: [['eonni', '언니'], ['nuna', '누나'], ['namdongsaeng', '남동생']], answer: 'eonni', rationale: 'A female speaker normally refers to her older sister as 언니.' }],
		arrange: { prompt: 'Build “She is my older sister.”', tiles: ['언니예요', '제', '누구예요', '저는'], answer: ['제', '언니예요'], translation: 'She is my older sister.', rationale: '제 modifies 언니, and the noun predicate ends in 예요.' },
		production: { mode: 'speak', prompt: 'Identify one person in a photo and say where that person works or lives.', modelAnswer: '제 언니예요. 서울에서 일해요.', modelReading: 'je eonniyeyo. seoureseo ilhaeyo.', checklist: ['Relationship uses 제', 'Sibling term matches the intended speaker', 'Work location uses 에서'] },
		transferPrompt: 'Identify a different family member and replace Seoul and work with new information.', transferSupport: '제 …예요/이에요. …에서 일해요.／…에 살아요.'
	}),
	lesson({
		id: 'ko-21-family-existence', unitId: 'korean-family-home', title: 'Saying who is in your family', shortTitle: 'Who is in the family',
		canDo: 'Ask whether someone has siblings and give a positive or negative counted answer.',
		focus: ['있어요／없어요', '형제자매', '한 명'],
		scenario: [['민지', '형제자매가 있어요?', 'hyeongje-jamaega isseoyo?', 'Do you have any siblings?'], ['준호', '네, 남동생이 한 명 있어요.', 'ne, namdongsaengi han myeong isseoyo.', 'Yes, I have one younger brother.']],
		notice: ['있어요 expresses existence or possession; 없어요 gives the corresponding negative.', '명 counts people, and 하나 shortens to 한 before the counter.'],
		explanation: ['Korean commonly expresses possession by saying that someone or something exists in the speaker’s situation.', 'The person marked by 이/가 comes before the count: 남동생이 한 명 있어요.'],
		vocabulary: [['형제자매', 'hyeongje-jamae', 'siblings'], ['있다', 'itda', 'exist; have'], ['없다', 'eopda', 'not exist; not have'], ['남동생', 'namdongsaeng', 'younger brother'], ['명', 'myeong', 'counter for people']],
		choice: { prompt: 'Which form means “do not have” or “there is not”?', options: [['eopseoyo', '없어요'], ['isseoyo', '있어요'], ['anieyo', '아니에요']], answer: 'eopseoyo', rationale: '없어요 is the negative existence or possession form.' },
		reviewChoices: [{ prompt: 'Which sentence says “I have one younger brother”?', options: [['one', '남동생이 한 명 있어요.'], ['object', '남동생을 한 명 있어요.'], ['negative', '남동생이 없어요.']], answer: 'one', rationale: 'The person takes 이, the count is 한 명, and the sentence ends in 있어요.' }],
		arrange: { prompt: 'Build “I have one younger brother.”', tiles: ['한 명', '있어요', '남동생이', '없어요'], answer: ['남동생이', '한 명', '있어요'], translation: 'I have one younger brother.', rationale: 'The person marked by 이 comes before the count and existence verb.' },
		production: { mode: 'speak', prompt: 'Ask about siblings and answer positively or negatively with one detail.', modelAnswer: '형제자매가 있어요? 네, 남동생이 한 명 있어요.', modelReading: 'hyeongje-jamaega isseoyo? ne, namdongsaengi han myeong isseoyo.', checklist: ['Question uses 있어요', 'Negative answer uses 없어요 when needed', 'Counted person uses 명'] },
		transferPrompt: 'Give a new answer with no siblings or with a different number and relationship.', transferSupport: '형제자매가 없어요.／…이/가 … 명 있어요.'
	}),
	lesson({
		id: 'ko-22-home-rooms', unitId: 'korean-family-home', title: 'Rooms and location at home', shortTitle: 'Rooms at home',
		canDo: 'Ask how many rooms a home has and locate a person, animal, or object inside it.',
		focus: ['집에…있어요', '몇 개', 'place + 에 있어요'],
		scenario: [['준호', '집에 방이 몇 개 있어요?', 'jibe bangi myeot gae isseoyo?', 'How many rooms are in your home?'], ['민지', '세 개 있어요. 고양이는 거실에 있어요.', 'se gae isseoyo. goyangineun geosire isseoyo.', 'There are three. The cat is in the living room.']],
		notice: ['몇 comes before the counter 개 to ask how many things there are.', '에 marks both the broader setting 집 and the specific location 거실.'],
		explanation: ['The answer can omit 방 because the question already establishes what 개 counts.', '있어요 expresses both the presence of the rooms and the cat; Korean does not use separate animate and inanimate verbs here.'],
		vocabulary: [['집', 'jip', 'home; house'], ['방', 'bang', 'room'], ['몇 개', 'myeot gae', 'how many things'], ['고양이', 'goyangi', 'cat'], ['거실', 'geosil', 'living room']],
		choice: { prompt: 'How many rooms are in the example home?', options: [['three', 'Three'], ['one', 'One'], ['five', 'Five']], answer: 'three', rationale: '세 개 있어요 states that there are three.' },
		reviewChoices: [{ prompt: 'Which sentence correctly puts the cat in the living room?', options: [['location', '고양이는 거실에 있어요.'], ['object', '고양이는 거실을 있어요.'], ['identity', '고양이는 거실이에요.']], answer: 'location', rationale: 'The location takes 에 and is followed by 있어요.' }],
		arrange: { prompt: 'Build “The cat is in the living room.”', tiles: ['거실에', '고양이는', '없어요', '있어요'], answer: ['고양이는', '거실에', '있어요'], translation: 'The cat is in the living room.', rationale: 'The location marked by 에 precedes 있어요.' },
		production: { mode: 'speak', prompt: 'State how many rooms a home has and locate one person, animal, or object.', modelAnswer: '집에 방이 세 개 있어요. 고양이는 거실에 있어요.', modelReading: 'jibe bangi se gae isseoyo. goyangineun geosire isseoyo.', checklist: ['Room count uses 개', 'Location uses 에', 'Existence statement ends in 있어요 or 없어요'] },
		transferPrompt: 'Change the room count and locate a different person or object in another room.', transferSupport: '집에 방이 … 개 있어요. …은/는 …에 있어요.'
	}),
	lesson({
		id: 'ko-23-family-home-mission', unitId: 'korean-family-home', title: 'Mission: describe a family and home', shortTitle: 'Family and home mission', kind: 'mission', durationMinutes: 20,
		canDo: 'Give a short connected description of family size, relationships, residence, and one home location.',
		focus: ['가족이 몇 명이에요', '부모님', 'place + 에 살아요', '한 마리'],
		scenario: [['준호', '가족이 몇 명이에요?', 'gajogi myeot myeong-ieyo?', 'How many people are in your family?'], ['민지', '네 명이에요. 부모님, 언니, 저예요. 서울에 살아요. 집에 고양이 한 마리가 있어요.', 'ne myeong-ieyo. bumonim, eonni, jeoyeyo. seoure sarayo. jibe goyangi han mariga isseoyo.', 'There are four: my parents, older sister, and me. We live in Seoul. There is one cat at home.']],
		notice: ['네 is the shortened native Korean form used before 명; 부모님 refers respectfully to one’s parents.', '살아요 takes the residence location marked by 에, while 마리 counts animals.'],
		explanation: ['A connected answer can move from family count to relationships, residence, and a home detail without repeating 가족 in every sentence.', 'Counters match the noun category: 명 for people, 개 for general things, and 마리 for animals.'],
		vocabulary: [['가족', 'gajok', 'family'], ['부모님', 'bumonim', 'parents (honorific)'], ['살다', 'salda', 'live; reside'], ['마리', 'mari', 'counter for animals'], ['네 명', 'ne myeong', 'four people']],
		choice: { prompt: 'How many people are in Minji’s family description?', options: [['four', 'Four'], ['three', 'Three'], ['five', 'Five']], answer: 'four', rationale: '네 명이에요 gives the family count as four.' },
		reviewChoices: [{ prompt: 'Which phrase correctly states “We live in Seoul”?', options: [['live', '서울에 살아요.'], ['subject', '서울이 살아요.'], ['object', '서울을 살아요.']], answer: 'live', rationale: 'The residence location is marked by 에 before 살아요 in this lesson.' }],
		arrange: { prompt: 'Build “There is one cat at home.”', tiles: ['한 마리가', '있어요', '집에', '고양이'], answer: ['집에', '고양이', '한 마리가', '있어요'], translation: 'There is one cat at home.', rationale: 'The setting comes first, followed by the animal, its counted subject phrase, and 있어요.' },
		production: { mode: 'speak', prompt: 'Describe a real or invented family and home in at least four connected statements.', modelAnswer: '가족이 네 명이에요. 부모님, 언니, 저예요. 서울에 살아요. 집에 방이 세 개 있어요.', modelReading: 'gajogi ne myeong-ieyo. bumonim, eonni, jeoyeyo. seoure sarayo. jibe bangi se gae isseoyo.', checklist: ['Family count uses 명', 'At least one relationship is named', 'Residence uses 에 살아요', 'One home detail uses 있어요 or 없어요'] },
		transferPrompt: 'Repeat the description with a different family size, city, room count, and home-location detail.', transferSupport: '가족이 … 명이에요. …예요/이에요. …에 살아요. 집에 …이/가 있어요.'
	}),
	lesson({
		id: 'ko-24-hobbies', unitId: 'korean-leisure-weather', title: 'Talking about hobbies', shortTitle: 'Hobbies and interests',
		canDo: 'Ask about someone’s hobby and name one activity as your own hobby.',
		focus: ['취미가 뭐예요', 'verb stem + 기', 'noun + 예요/이에요'],
		scenario: [['민지', '취미가 뭐예요?', 'chwimiga mwoyeyo?', 'What is your hobby?'], ['준호', '제 취미는 영화 보기예요.', 'je chwimineun yeonghwa bogiyeyo.', 'My hobby is watching movies.']],
		notice: ['뭐 asks what the hobby is, while 취미 takes the subject marker 가 in the question.', '보기 turns 보다 into an activity noun that can be identified as a hobby.'],
		explanation: ['Attach 기 to a verb stem to name the activity: 보다 becomes 보기 and 듣다 becomes 듣기.', 'Because 보기 ends in a vowel, the noun predicate takes 예요 rather than 이에요.'],
		vocabulary: [['취미', 'chwimi', 'hobby'], ['뭐', 'mwo', 'what'], ['영화', 'yeonghwa', 'movie'], ['보기', 'bogi', 'watching; seeing']],
		choice: { prompt: 'Which form names “watching” as an activity?', options: [['bogi', '보기'], ['bwayo', '봐요'], ['bwasseoyo', '봤어요']], answer: 'bogi', rationale: 'Verb stem 보- plus 기 forms the activity noun 보기.' },
		arrange: { prompt: 'Build “My hobby is watching movies.”', tiles: ['제 취미는', '영화 보기예요', '뭐예요', '봤어요'], answer: ['제 취미는', '영화 보기예요'], translation: 'My hobby is watching movies.', rationale: 'The topic phrase is followed by the activity noun and 예요.' },
		production: { mode: 'speak', prompt: 'Ask about a hobby and answer with a different activity.', modelAnswer: '취미가 뭐예요? 제 취미는 음악 듣기예요.', modelReading: 'chwimiga mwoyeyo? je chwimineun eumak deutgiyeyo.', checklist: ['Question uses 취미가 뭐예요', 'Answer turns a verb into an activity with 기', 'Noun ending uses 예요 or 이에요 correctly'] },
		transferPrompt: 'Replace watching movies with a different hobby and ask a new person the same question.', transferSupport: '취미가 뭐예요? 제 취미는 …기예요.'
	}),
	lesson({
		id: 'ko-25-weather', unitId: 'korean-leisure-weather', title: 'Describing today’s weather', shortTitle: 'Today’s weather',
		canDo: 'Ask about today’s weather and give a short description with two linked details.',
		focus: ['날씨가 어때요', 'descriptive verb ending', '-고 linking'],
		scenario: [['준호', '오늘 날씨가 어때요?', 'oneul nalssiga eottaeyo?', 'How is the weather today?'], ['민지', '따뜻하고 맑아요.', 'ttatteuthago malgayo.', 'It is warm and clear.']],
		notice: ['어때요 asks for a description of the subject marked by 가.', '-고 links 따뜻하다 to the following description without making a second sentence.'],
		explanation: ['Korean descriptive verbs conjugate as predicates, so the sentence does not add a separate copula before 따뜻해요 or 맑아요.', 'Use -고 on the first description and a polite ending on the final one.'],
		vocabulary: [['오늘', 'oneul', 'today'], ['날씨', 'nalssi', 'weather'], ['따뜻하다', 'ttatteuthada', 'be warm'], ['맑다', 'makda', 'be clear']],
		choice: { prompt: 'Which line gives two linked weather descriptions?', options: [['linked', '따뜻하고 맑아요.'], ['noun', '따뜻한 맑아요.'], ['copula', '따뜻하고 맑은이에요.']], answer: 'linked', rationale: '-고 links the first descriptive verb to the final polite predicate.' },
		arrange: { prompt: 'Build “It is warm and clear.”', tiles: ['따뜻하고', '맑아요', '날씨가', '있어요'], answer: ['따뜻하고', '맑아요'], translation: 'It is warm and clear.', rationale: 'The first description takes -고, and the last carries the polite ending.' },
		production: { mode: 'speak', prompt: 'Ask about the weather and answer with two conditions.', modelAnswer: '오늘 날씨가 어때요? 춥고 흐려요.', modelReading: 'oneul nalssiga eottaeyo? chupgo heuryeoyo.', checklist: ['Question uses 날씨가 어때요', 'First description connects with -고', 'Final description has a polite ending'] },
		transferPrompt: 'Change both weather details and the day while keeping the question and linked answer complete.', transferSupport: '… 날씨가 어때요? …고 …아요/어요.'
	}),
	lesson({
		id: 'ko-26-weekend-past', unitId: 'korean-leisure-weather', title: 'Reporting a completed weekend activity', shortTitle: 'What you did',
		canDo: 'Ask what someone did over the weekend and report one completed activity.',
		focus: ['주말에 뭐 했어요', 'past -았/었-', 'activity location + 에서'],
		scenario: [['민지', '주말에 뭐 했어요?', 'jumare mwo haesseoyo?', 'What did you do over the weekend?'], ['준호', '공원에서 산책했어요.', 'gongwoneseo sanchaekhaesseoyo.', 'I took a walk in the park.']],
		notice: ['했어요 is the polite past form of 하다.', '에서 marks the location where the walking activity occurred.'],
		explanation: ['The past marker appears inside the polite verb ending: 하다 becomes 했어요 and 보다 becomes 봤어요.', 'The question and answer share a completed weekend frame, so the answer does not need to repeat 주말에.'],
		vocabulary: [['주말', 'jumal', 'weekend'], ['뭐', 'mwo', 'what'], ['공원', 'gongwon', 'park'], ['산책하다', 'sanchaekhada', 'take a walk']],
		choice: { prompt: 'Which form reports a completed activity politely?', options: [['past', '산책했어요'], ['present', '산책해요'], ['future', '산책할 거예요']], answer: 'past', rationale: '했어요 contains the polite past form of 하다.' },
		arrange: { prompt: 'Build “I took a walk in the park.”', tiles: ['공원에서', '산책했어요', '산책해요', '좋아해요'], answer: ['공원에서', '산책했어요'], translation: 'I took a walk in the park.', rationale: 'The activity location marked by 에서 comes before the polite past verb.' },
		production: { mode: 'speak', prompt: 'Ask about the weekend and answer with one completed activity.', modelAnswer: '주말에 뭐 했어요? 영화를 봤어요.', modelReading: 'jumare mwo haesseoyo? yeonghwareul bwasseoyo.', checklist: ['Question uses 뭐 했어요', 'Answer uses a polite past verb', 'Object or activity location has the needed particle'] },
		transferPrompt: 'Replace the park walk with a different completed activity and a different past time expression.', transferSupport: '…에 뭐 했어요? …았어요/었어요/했어요.'
	}),
	lesson({
		id: 'ko-27-weekend-mission', unitId: 'korean-leisure-weather', title: 'Mission: make a weather-aware plan', shortTitle: 'Weekend plan', kind: 'mission', durationMinutes: 20,
		canDo: 'Use a forecast to suggest an activity, accept it, and confirm a meeting time.',
		focus: ['내일 날씨가 좋아요', '같이…갈까요', 'time + 에 만나요'],
		scenario: [['준호', '내일 날씨가 좋아요. 같이 공원에 갈까요?', 'naeil nalssiga joayo. gachi gongwone galkkayo?', 'The weather will be good tomorrow. Shall we go to the park together?'], ['민지', '좋아요. 세 시에 만나요.', 'joayo. se sie mannayo.', 'Sounds good. Let’s meet at three.']],
		notice: ['-(으)ㄹ까요 proposes a shared action and asks for the listener’s response.', 'The meeting time takes 에 before 만나요.'],
		explanation: ['The weather statement gives a practical reason for the suggestion.', 'After accepting, confirm a concrete time or place so the exchange produces a complete plan.'],
		vocabulary: [['내일', 'naeil', 'tomorrow'], ['같이', 'gachi', 'together'], ['갈까요', 'galkkayo', 'shall we go'], ['만나다', 'mannada', 'meet']],
		choice: { prompt: 'Which line makes the suggestion?', options: [['suggest', '같이 공원에 갈까요?'], ['weather', '내일 날씨가 좋아요.'], ['time', '세 시에 만나요.']], answer: 'suggest', rationale: '갈까요 asks whether to go together.' },
		arrange: { prompt: 'Build “Shall we go to the park together?”', tiles: ['같이', '공원에', '갈까요', '갔어요'], answer: ['같이', '공원에', '갈까요'], translation: 'Shall we go to the park together?', rationale: '같이 precedes the destination and the shared-action proposal.' },
		production: { mode: 'speak', prompt: 'State the weather, suggest an activity, then accept and set a time.', modelAnswer: '내일 날씨가 좋아요. 같이 공원에 갈까요? 좋아요. 세 시에 만나요.', modelReading: 'naeil nalssiga joayo. gachi gongwone galkkayo? joayo. se sie mannayo.', checklist: ['Weather supports the activity', 'Suggestion uses -(으)ㄹ까요', 'Response accepts or declines', 'Plan includes a time marked by 에'] },
		transferPrompt: 'Change the forecast, activity, and meeting time while keeping the suggestion and confirmation complete.', transferSupport: '내일 날씨가 …. 같이 …에 갈까요? 좋아요. … 시에 만나요.'
	})
].map((item, index) => ({ ...item, sequence: index + 1 }));

const units: CourseUnit[] = [
	{ id: 'korean-launchpad', sequence: 0, title: 'Hangul and sound system', nativeTitle: '한글과 발음', strapline: 'Syllable blocks, consonants, vowels, batchim, and basic sound changes.', canDo: 'Decode beginner Hangul words directly and recognize the sound changes needed for connected reading.', mission: 'Read and type unfamiliar beginner words without depending on romanization.', lessonIds: lessons.filter((item) => item.unitId === 'korean-launchpad').map((item) => item.id) },
	{ id: 'korean-introductions', sequence: 1, title: 'Introductions and identity', nativeTitle: '자기소개', strapline: 'Names, identity, origin, language study, and a complete first meeting.', canDo: 'Introduce yourself politely, exchange one personal detail, and ask a matching question.', mission: 'Complete a first meeting with a name, identity, origin, and one follow-up question.', lessonIds: lessons.filter((item) => item.unitId === 'korean-introductions').map((item) => item.id) },
	{ id: 'korean-daily', sequence: 2, title: 'Daily routine and time', nativeTitle: '일상과 시간', strapline: 'Dates, clock time, routine descriptions, and scheduling.', canDo: 'Describe a short routine and negotiate a specific day and time.', mission: 'Propose, revise, and confirm a meeting time.', lessonIds: lessons.filter((item) => item.unitId === 'korean-daily').map((item) => item.id) },
	{ id: 'korean-food-places', sequence: 3, title: 'Food, prices, and places', nativeTitle: '음식과 장소', strapline: 'Counters, service requests, prices, totals, and simple locations.', canDo: 'Order common items, confirm a price, and ask where a place is.', mission: 'Complete an order and obtain one location in the same service exchange.', lessonIds: lessons.filter((item) => item.unitId === 'korean-food-places').map((item) => item.id) },
	{ id: 'korean-family-home', sequence: 4, title: 'Family and home', nativeTitle: '가족과 집', strapline: 'Relationships, existence, people and animal counters, rooms, and locations at home.', canDo: 'Identify family members, state who is in a household, describe a home, and locate a person, animal, or object.', mission: 'Give a connected description of a family and home with accurate counters, particles, and existence forms.', lessonIds: lessons.filter((item) => item.unitId === 'korean-family-home').map((item) => item.id) },
	{ id: 'korean-leisure-weather', sequence: 5, title: 'Leisure, weather, and plans', nativeTitle: '취미, 날씨와 계획', strapline: 'Hobbies, simple weather, completed activities, and concrete weekend plans.', canDo: 'Discuss a hobby, describe the weather, report a completed activity, and make a specific plan.', mission: 'Use the weather to suggest an activity, respond, and confirm when to meet.', lessonIds: lessons.filter((item) => item.unitId === 'korean-leisure-weather').map((item) => item.id) }
];

export const koreanA1Course: LanguageCourse = {
	id: 'korean-a1',
	slug: 'korean',
	title: 'Korean foundations: Hangul to A1',
	languageName: 'Korean',
	nativeName: '한국어',
	glyph: '한',
	language: 'ko',
	htmlLanguage: 'ko',
	studyLanguage: 'ko',
	speechLanguage: 'ko',
	readingLabel: 'Romanization',
	level: 'Launchpad–A1',
	description: 'A 28-lesson introductory Korean course covering Hangul, sound changes, everyday exchanges, family and home descriptions, leisure and weather, retrieval, open production, and transfer checks.',
	designPromise: 'Each lesson moves from Hangul form to sound and meaning, checks a constrained target, requires original use, and ends with reduced support.',
	units,
	lessons
};
