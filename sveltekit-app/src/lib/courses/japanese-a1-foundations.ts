import type {
	ArrangeActivity,
	ChoiceActivity,
	CourseDialogueLine,
	CourseVocabularyItem,
	JapaneseLesson,
	ProductionActivity,
	ScriptChart,
	ShortAnswerActivity
} from './types';

const line = (
	speaker: string,
	text: string,
	reading: string,
	translation: string
): CourseDialogueLine => ({ speaker, text, reading, translation });

const word = (
	word: string,
	reading: string,
	meaning: string,
	note?: string,
	dictionaryAnchor = word
): CourseVocabularyItem => ({ word, reading, meaning, note, dictionaryAnchor });

const choice = (
	id: string,
	prompt: string,
	options: Array<[string, string]>,
	answer: string,
	rationale: string
): ChoiceActivity => ({
	id,
	type: 'choice',
	title: 'Meaning check',
	prompt,
	options: options.map(([value, label]) => ({ value, label })),
	answer,
	rationale,
	required: true
});

const arrange = (
	id: string,
	prompt: string,
	tiles: string[],
	answer: string[],
	translation: string,
	rationale: string
): ArrangeActivity => ({
	id,
	type: 'arrange',
	title: 'Sentence construction',
	prompt,
	tiles,
	answer,
	translation,
	rationale,
	required: true
});

const typeIn = (
	id: string,
	prompt: string,
	acceptedAnswers: string[],
	referenceAnswer: string,
	rationale: string
): ShortAnswerActivity => ({
	id,
	type: 'short-answer',
	title: 'Written recall',
	prompt,
	acceptedAnswers,
	referenceAnswer,
	rationale,
	placeholder: 'Type in Japanese',
	required: true
});

const produce = (
	id: string,
	mode: 'speak' | 'write',
	prompt: string,
	modelAnswer: string,
	modelReading: string,
	checklist: string[]
): ProductionActivity => ({
	id,
	type: 'production',
	title: mode === 'speak' ? 'Speaking response' : 'Writing response',
	prompt,
	mode,
	modelAnswer,
	modelReading,
	checklist,
	required: true
});

const hiraganaChart: ScriptChart = {
	title: 'Hiragana gojūon',
	caption: 'Read each row across with the vowel columns a, i, u, e, o. Empty cells do not have a basic kana.',
	columns: ['a', 'i', 'u', 'e', 'o'],
	rows: [
		{ label: 'vowel', cells: [
			{ symbol: 'あ', romanization: 'a' }, { symbol: 'い', romanization: 'i' },
			{ symbol: 'う', romanization: 'u' }, { symbol: 'え', romanization: 'e' },
			{ symbol: 'お', romanization: 'o' }
		] },
		{ label: 'k', cells: [
			{ symbol: 'か', romanization: 'ka' }, { symbol: 'き', romanization: 'ki' },
			{ symbol: 'く', romanization: 'ku' }, { symbol: 'け', romanization: 'ke' },
			{ symbol: 'こ', romanization: 'ko' }
		] },
		{ label: 's', cells: [
			{ symbol: 'さ', romanization: 'sa' }, { symbol: 'し', romanization: 'shi' },
			{ symbol: 'す', romanization: 'su' }, { symbol: 'せ', romanization: 'se' },
			{ symbol: 'そ', romanization: 'so' }
		] },
		{ label: 't', cells: [
			{ symbol: 'た', romanization: 'ta' }, { symbol: 'ち', romanization: 'chi' },
			{ symbol: 'つ', romanization: 'tsu' }, { symbol: 'て', romanization: 'te' },
			{ symbol: 'と', romanization: 'to' }
		] },
		{ label: 'n', cells: [
			{ symbol: 'な', romanization: 'na' }, { symbol: 'に', romanization: 'ni' },
			{ symbol: 'ぬ', romanization: 'nu' }, { symbol: 'ね', romanization: 'ne' },
			{ symbol: 'の', romanization: 'no' }
		] },
		{ label: 'h', cells: [
			{ symbol: 'は', romanization: 'ha' }, { symbol: 'ひ', romanization: 'hi' },
			{ symbol: 'ふ', romanization: 'fu' }, { symbol: 'へ', romanization: 'he' },
			{ symbol: 'ほ', romanization: 'ho' }
		] },
		{ label: 'm', cells: [
			{ symbol: 'ま', romanization: 'ma' }, { symbol: 'み', romanization: 'mi' },
			{ symbol: 'む', romanization: 'mu' }, { symbol: 'め', romanization: 'me' },
			{ symbol: 'も', romanization: 'mo' }
		] },
		{ label: 'y', cells: [
			{ symbol: 'や', romanization: 'ya' }, null,
			{ symbol: 'ゆ', romanization: 'yu' }, null,
			{ symbol: 'よ', romanization: 'yo' }
		] },
		{ label: 'r', cells: [
			{ symbol: 'ら', romanization: 'ra' }, { symbol: 'り', romanization: 'ri' },
			{ symbol: 'る', romanization: 'ru' }, { symbol: 'れ', romanization: 're' },
			{ symbol: 'ろ', romanization: 'ro' }
		] },
		{ label: 'w', cells: [
			{ symbol: 'わ', romanization: 'wa' }, null, null, null,
			{ symbol: 'を', romanization: 'o', note: 'particle' }
		] },
		{ label: 'final', cells: [
			{ symbol: 'ん', romanization: 'n', note: 'one mora' }, null, null, null, null
		] }
	]
};

const katakanaChart: ScriptChart = {
	title: 'Katakana gojūon',
	caption: 'Katakana represents the same basic sound inventory. It is common in loanwords, foreign names, sound effects, and emphasis.',
	columns: ['a', 'i', 'u', 'e', 'o'],
	rows: [
		{ label: 'vowel', cells: [
			{ symbol: 'ア', romanization: 'a' }, { symbol: 'イ', romanization: 'i' },
			{ symbol: 'ウ', romanization: 'u' }, { symbol: 'エ', romanization: 'e' },
			{ symbol: 'オ', romanization: 'o' }
		] },
		{ label: 'k', cells: [
			{ symbol: 'カ', romanization: 'ka' }, { symbol: 'キ', romanization: 'ki' },
			{ symbol: 'ク', romanization: 'ku' }, { symbol: 'ケ', romanization: 'ke' },
			{ symbol: 'コ', romanization: 'ko' }
		] },
		{ label: 's', cells: [
			{ symbol: 'サ', romanization: 'sa' }, { symbol: 'シ', romanization: 'shi' },
			{ symbol: 'ス', romanization: 'su' }, { symbol: 'セ', romanization: 'se' },
			{ symbol: 'ソ', romanization: 'so' }
		] },
		{ label: 't', cells: [
			{ symbol: 'タ', romanization: 'ta' }, { symbol: 'チ', romanization: 'chi' },
			{ symbol: 'ツ', romanization: 'tsu' }, { symbol: 'テ', romanization: 'te' },
			{ symbol: 'ト', romanization: 'to' }
		] },
		{ label: 'n', cells: [
			{ symbol: 'ナ', romanization: 'na' }, { symbol: 'ニ', romanization: 'ni' },
			{ symbol: 'ヌ', romanization: 'nu' }, { symbol: 'ネ', romanization: 'ne' },
			{ symbol: 'ノ', romanization: 'no' }
		] },
		{ label: 'h', cells: [
			{ symbol: 'ハ', romanization: 'ha' }, { symbol: 'ヒ', romanization: 'hi' },
			{ symbol: 'フ', romanization: 'fu' }, { symbol: 'ヘ', romanization: 'he' },
			{ symbol: 'ホ', romanization: 'ho' }
		] },
		{ label: 'm', cells: [
			{ symbol: 'マ', romanization: 'ma' }, { symbol: 'ミ', romanization: 'mi' },
			{ symbol: 'ム', romanization: 'mu' }, { symbol: 'メ', romanization: 'me' },
			{ symbol: 'モ', romanization: 'mo' }
		] },
		{ label: 'y', cells: [
			{ symbol: 'ヤ', romanization: 'ya' }, null,
			{ symbol: 'ユ', romanization: 'yu' }, null,
			{ symbol: 'ヨ', romanization: 'yo' }
		] },
		{ label: 'r', cells: [
			{ symbol: 'ラ', romanization: 'ra' }, { symbol: 'リ', romanization: 'ri' },
			{ symbol: 'ル', romanization: 'ru' }, { symbol: 'レ', romanization: 're' },
			{ symbol: 'ロ', romanization: 'ro' }
		] },
		{ label: 'w', cells: [
			{ symbol: 'ワ', romanization: 'wa' }, null, null, null,
			{ symbol: 'ヲ', romanization: 'o', note: 'rare' }
		] },
		{ label: 'final', cells: [
			{ symbol: 'ン', romanization: 'n', note: 'one mora' }, null, null, null, null
		] }
	]
};

const voicingChart: ScriptChart = {
	title: 'Voicing marks',
	caption: 'Dakuten (゛) voices four rows. Handakuten (゜) applies only to the h row and produces p sounds.',
	columns: ['plain', 'dakuten ゛', 'handakuten ゜'],
	rows: [
		{ label: 'k', cells: [
			{ symbol: 'か き く け こ', romanization: 'ka ki ku ke ko' },
			{ symbol: 'が ぎ ぐ げ ご', romanization: 'ga gi gu ge go' },
			null
		] },
		{ label: 's', cells: [
			{ symbol: 'さ し す せ そ', romanization: 'sa shi su se so' },
			{ symbol: 'ざ じ ず ぜ ぞ', romanization: 'za ji zu ze zo' },
			null
		] },
		{ label: 't', cells: [
			{ symbol: 'た ち つ て と', romanization: 'ta chi tsu te to' },
			{ symbol: 'だ ぢ づ で ど', romanization: 'da ji zu de do', note: 'ぢ・づ have restricted use' },
			null
		] },
		{ label: 'h', cells: [
			{ symbol: 'は ひ ふ へ ほ', romanization: 'ha hi fu he ho' },
			{ symbol: 'ば び ぶ べ ぼ', romanization: 'ba bi bu be bo' },
			{ symbol: 'ぱ ぴ ぷ ぺ ぽ', romanization: 'pa pi pu pe po' }
		] }
	]
};

const contractedChart: ScriptChart = {
	title: 'Contracted sounds with small ゃ・ゅ・ょ',
	caption: 'An i-column kana plus a small y kana forms one mora. The corresponding katakana combinations work the same way.',
	columns: ['-ya', '-yu', '-yo'],
	rows: [
		{ label: 'k', cells: [
			{ symbol: 'きゃ', romanization: 'kya' }, { symbol: 'きゅ', romanization: 'kyu' },
			{ symbol: 'きょ', romanization: 'kyo' }
		] },
		{ label: 'sh', cells: [
			{ symbol: 'しゃ', romanization: 'sha' }, { symbol: 'しゅ', romanization: 'shu' },
			{ symbol: 'しょ', romanization: 'sho' }
		] },
		{ label: 'ch', cells: [
			{ symbol: 'ちゃ', romanization: 'cha' }, { symbol: 'ちゅ', romanization: 'chu' },
			{ symbol: 'ちょ', romanization: 'cho' }
		] },
		{ label: 'j', cells: [
			{ symbol: 'じゃ', romanization: 'ja' }, { symbol: 'じゅ', romanization: 'ju' },
			{ symbol: 'じょ', romanization: 'jo' }
		] },
		{ label: 'n', cells: [
			{ symbol: 'にゃ', romanization: 'nya' }, { symbol: 'にゅ', romanization: 'nyu' },
			{ symbol: 'にょ', romanization: 'nyo' }
		] },
		{ label: 'h/b/p', cells: [
			{ symbol: 'ひゃ・びゃ・ぴゃ', romanization: 'hya · bya · pya' },
			{ symbol: 'ひゅ・びゅ・ぴゅ', romanization: 'hyu · byu · pyu' },
			{ symbol: 'ひょ・びょ・ぴょ', romanization: 'hyo · byo · pyo' }
		] },
		{ label: 'm/r', cells: [
			{ symbol: 'みゃ・りゃ', romanization: 'mya · rya' },
			{ symbol: 'みゅ・りゅ', romanization: 'myu · ryu' },
			{ symbol: 'みょ・りょ', romanization: 'myo · ryo' }
		] }
	]
};

const foreignSoundChart: ScriptChart = {
	title: 'Common katakana extensions',
	caption: 'Small vowel kana extend katakana for foreign sounds. ヴ is ウ with dakuten and is conventionally romanized v or vu.',
	columns: ['combination', 'reading', 'example'],
	rows: [
		{ label: 'f', cells: [
			{ symbol: 'ファ・フィ・フェ・フォ', romanization: 'fa · fi · fe · fo' },
			{ symbol: 'フ + small vowel', romanization: 'f series' },
			{ symbol: 'ファイル', romanization: 'fairu', note: 'file' }
		] },
		{ label: 't/d', cells: [
			{ symbol: 'ティ・ディ', romanization: 'ti · di' },
			{ symbol: 'テ/デ + small ィ', romanization: 'extended t/d' },
			{ symbol: 'パーティー', romanization: 'pātī', note: 'party' }
		] },
		{ label: 'v', cells: [
			{ symbol: 'ヴァ・ヴィ・ヴ・ヴェ・ヴォ', romanization: 'va · vi · vu · ve · vo' },
			{ symbol: 'ウ + dakuten', romanization: 'v series' },
			{ symbol: 'ヴァイオリン', romanization: 'vaiorin', note: 'violin' }
		] },
		{ label: 'w', cells: [
			{ symbol: 'ウィ・ウェ・ウォ', romanization: 'wi · we · wo' },
			{ symbol: 'ウ + small vowel', romanization: 'w series' },
			{ symbol: 'ウェブ', romanization: 'webu', note: 'web' }
		] }
	]
};

export const japaneseFoundationsLessons: JapaneseLesson[] = [
	{
		id: 'lp-00-writing-systems',
		sequence: 0,
		unitId: 'launchpad',
		title: 'Japanese writing systems',
		shortTitle: 'Writing systems',
		kind: 'script',
		durationMinutes: 18,
		canDo: 'Distinguish hiragana, katakana, and kanji and use the two basic kana charts as sound references.',
		focus: ['hiragana', 'katakana', 'kanji', 'gojūon chart order'],
		scenario: [
			line('Hiragana', 'わたし', 'わたし', 'I; me'),
			line('Katakana', 'コーヒー', 'コーヒー', 'coffee'),
			line('Mixed text', '日本語を勉強します。', 'にほんご を べんきょうします。', 'I study Japanese.')
		],
		notice: [
			'Hiragana and katakana are two symbol sets for the same basic sound system. Kanji primarily represents lexical meaning and readings.',
			'Normal Japanese sentences mix scripts: kanji for many content words, hiragana for grammar and endings, and katakana where its functions apply.'
		],
		explanation: [
			'The gojūon chart organizes kana by consonant row and vowel column. It is a reference system, not an alphabetical order based on English letters.',
			'Hiragana is common in grammatical material and many native words. Katakana is common in loanwords, foreign names, sound effects, scientific names, and emphasis. The charts below show the 46 basic symbols in each set.'
		],
		scriptCharts: [hiraganaChart, katakanaChart],
		vocabulary: [
			word('平仮名', 'ひらがな', 'hiragana'),
			word('片仮名', 'カタカナ', 'katakana'),
			word('漢字', 'かんじ', 'kanji'),
			word('日本語', 'にほんご', 'Japanese language')
		],
		activities: [
			choice(
				'lp00-script',
				'Which script normally writes the loanword コーヒー?',
				[['katakana', 'Katakana'], ['hiragana', 'Hiragana'], ['kanji', 'Kanji']],
				'katakana',
				'コーヒー is a loanword written in katakana.'
			),
			arrange(
				'lp00-build',
				'Build すし from the hiragana chart.',
				['し', 'ス', 'す'],
				['す', 'し'],
				'sushi',
				'す and し are hiragana. ス is the katakana symbol for the same su sound.'
			),
			produce(
				'lp00-identify',
				'speak',
				'Identify the script in each item, then read the kana: わたし, コーヒー, 日本語.',
				'わたし：ひらがな。コーヒー：カタカナ。日本語：漢字とひらがな。',
				'わたし：ひらがな。こーひー：かたかな。にほんご：かんじ と ひらがな。',
				['Hiragana identified', 'Katakana identified', 'Kanji identified', 'Kana read by sound rather than English letter name']
			)
		],
		transferPrompt: 'Classify the scripts in テレビ, たべます, and 学校, then locate each kana in the appropriate chart.',
		transferSupport: 'Angular loanword symbols usually indicate katakana; rounded grammatical endings usually indicate hiragana.'
	},
	{
		id: 'lp-01-five-vowels',
		sequence: 1,
		unitId: 'launchpad',
		title: 'Japanese vowel timing',
		shortTitle: 'Five vowels',
		kind: 'sound',
		durationMinutes: 10,
		canDo: 'Hear and produce the five Japanese vowels without turning them into English glides.',
		focus: ['あ・い・う・え・お', 'one mora per beat', 'short, steady vowels'],
		scenario: [
			line('Guide', 'あ・い・う・え・お', 'あ・い・う・え・お', 'a · i · u · e · o'),
			line('Guide', 'あおい', 'あおい', 'blue'),
			line('Guide', 'いえ', 'いえ', 'house')
		],
		notice: [
			'Each kana carries a stable vowel. Do not add an English-style y or w sound at the end.',
			'あおい has three beats: a-o-i. いえ has two: i-e.'
		],
		explanation: [
			'Japanese rhythm counts morae, small timing units. At this stage, tap once for each kana.',
			'The vowel う is produced with relaxed, less-rounded lips than English “oo.” Accuracy matters more than volume.'
		],
		vocabulary: [
			word('あおい', 'あおい', 'blue', 'Three morae: a-o-i', '青い'),
			word('いえ', 'いえ', 'house', 'Two morae: i-e', '家'),
			word('うえ', 'うえ', 'above; on top', 'Two morae: u-e', '上')
		],
		activities: [
			choice(
				'lp01-hear',
				'Which item has three morae?',
				[['aoi', 'あおい (a-o-i)'], ['ie', 'いえ (i-e)'], ['ue', 'うえ (u-e)']],
				'aoi',
				'あおい contains three vowel kana, so it takes three beats.'
			),
			arrange(
				'lp01-build',
				'Build “house.”',
				['え', 'い', 'お'],
				['い', 'え'],
				'house',
				'いえ is pronounced in two clean beats: i-e.'
			),
			produce(
				'lp01-speak',
				'speak',
				'Say あ・い・う・え・お twice. Keep every vowel the same length.',
				'あ・い・う・え・お',
				'あ・い・う・え・お',
				['Five distinct beats', 'No English-style glide after え or お', 'Relaxed lips on う']
			)
		],
		transferPrompt: 'Read うえ → いえ → あおい without romaji and keep the beat count stable.',
		transferSupport: 'Tap 2 → 2 → 3 beats before speaking.'
	},
	{
		id: 'lp-02-kana-rows-one',
		sequence: 2,
		unitId: 'launchpad',
		title: 'Hiragana: vowel through t rows',
		shortTitle: 'Kana rows I',
		kind: 'script',
		durationMinutes: 14,
		canDo: 'Decode short words built from the vowel, k, s, and t rows.',
		focus: ['か・き・く・け・こ', 'さ・し・す・せ・そ', 'た・ち・つ・て・と'],
		scenario: [
			line('Guide', 'すし', 'すし', 'sushi'),
			line('Guide', 'あさ', 'あさ', 'morning'),
			line('Guide', 'ちかてつ', 'ちかてつ', 'subway')
		],
		notice: [
			'し is shi, ち is chi, and つ is tsu; these are the three irregular romanized sounds in today’s rows.',
			'Read left to right in morae: ち・か・て・つ.'
		],
		explanation: [
			'Learn kana as sound symbols inside words, not as pictures with English letter names.',
			'Use romaji only to check an unfamiliar symbol. The goal is direct kana-to-sound decoding.'
		],
		vocabulary: [
			word('すし', 'すし', 'sushi'),
			word('あさ', 'あさ', 'morning', undefined, '朝'),
			word('ちかてつ', 'ちかてつ', 'subway', undefined, '地下鉄'),
			word('そこ', 'そこ', 'there')
		],
		activities: [
			choice(
				'lp02-read',
				'Which word reads chi-ka-te-tsu?',
				[['chikatetsu', 'ちかてつ'], ['sushi', 'すし'], ['asatte', 'あさって']],
				'chikatetsu',
				'ち・か・て・つ maps directly to chi-ka-te-tsu.'
			),
			arrange(
				'lp02-build',
				'Build “sushi.”',
				['し', 'す', 'さ'],
				['す', 'し'],
				'sushi',
				'す is su and し is shi.'
			),
			typeIn(
				'lp02-recall',
				'Type “morning” in hiragana.',
				['あさ'],
				'あさ',
				'あさ is a-sa.'
			),
			produce(
				'lp02-read-new',
				'speak',
				'Read たこ, せかい, and くつ aloud without romaji.',
				'たこ。せかい。くつ。',
				'たこ。せかい。くつ。',
				['Each kana decoded in order', 'No inserted English vowels', 'Steady mora timing']
			)
		],
		transferPrompt: 'Decode たこ, せかい, and くつ before revealing any reading help.',
		transferSupport: 'Point to one kana at a time; do not guess from the whole shape.'
	},
	{
		id: 'lp-03-kana-rows-two',
		sequence: 3,
		unitId: 'launchpad',
		title: 'Hiragana: n through w rows',
		shortTitle: 'Kana rows II',
		kind: 'script',
		durationMinutes: 15,
		canDo: 'Decode short words from the n, h, m, y, r, and w rows.',
		focus: ['な・は・ま rows', 'や・ゆ・よ', 'ら row', 'わ・を・ん'],
		scenario: [
			line('Guide', 'にほん', 'にほん', 'Japan'),
			line('Guide', 'やま', 'やま', 'mountain'),
			line('Guide', 'わたし', 'わたし', 'I; me')
		],
		notice: [
			'ん is a mora of its own. にほん has three beats: に・ほ・ん.',
			'を is normally pronounced お when it marks the object of a verb.'
		],
		explanation: [
			'The r-row is a light tongue tap, not a sustained English r or l.',
			'You can now decode all 46 basic hiragana. Speed comes from repeated word reading, not isolated chart recitation.'
		],
		vocabulary: [
			word('にほん', 'にほん', 'Japan', undefined, '日本'),
			word('やま', 'やま', 'mountain', undefined, '山'),
			word('わたし', 'わたし', 'I; me', 'Neutral-polite first-person word', '私'),
			word('ほん', 'ほん', 'book', undefined, '本')
		],
		activities: [
			choice(
				'lp03-count',
				'How many morae are in にほん?',
				[['two', '2'], ['three', '3'], ['four', '4']],
				'three',
				'に・ほ・ん has three morae; ん occupies its own beat.'
			),
			arrange(
				'lp03-build',
				'Build “Japan.”',
				['ほ', 'に', 'ん', 'ま'],
				['に', 'ほ', 'ん'],
				'Japan',
				'にほん is read ni-ho-n.'
			),
			typeIn(
				'lp03-recall',
				'Type “I; me” in hiragana.',
				['わたし'],
				'わたし',
				'わたし is the neutral first-person form used in this course.'
			),
			produce(
				'lp03-read-new',
				'speak',
				'Read はる, みせ, よる, くるま, and ほん without a chart.',
				'はる。みせ。よる。くるま。ほん。',
				'はる。みせ。よる。くるま。ほん。',
				['Direct kana reading', 'A separate beat for ん', 'Light tongue tap on る and ら']
			)
		],
		transferPrompt: 'Read はる, みせ, よる, くるま, and ほん without a chart.',
		transferSupport: 'If one symbol blocks you, check only that symbol and reread the whole word.'
	},
	{
		id: 'lp-04-katakana',
		sequence: 4,
		unitId: 'launchpad',
		title: 'Basic katakana reading',
		shortTitle: 'Katakana reading',
		kind: 'script',
		durationMinutes: 16,
		canDo: 'Decode common loanwords with the basic katakana chart and interpret the long-vowel mark.',
		focus: ['katakana gojūon', 'loanwords', 'long-vowel mark ー'],
		scenario: [
			line('Example', 'コーヒー', 'コーヒー', 'coffee'),
			line('Example', 'アメリカ', 'アメリカ', 'United States; America'),
			line('Example', 'テレビ', 'テレビ', 'television')
		],
		notice: [
			'Katakana symbols map to the same basic sounds as hiragana: か and カ are both ka.',
			'The mark ー lengthens the preceding vowel. コーヒー has four morae: コ・ー・ヒ・ー.'
		],
		explanation: [
			'Katakana spelling adapts foreign words to Japanese sound patterns, so it does not reproduce the source-language pronunciation exactly.',
			'Read through Japanese morae first. Recognizing the likely source word can confirm meaning, but it should not replace kana decoding.'
		],
		scriptCharts: [katakanaChart],
		vocabulary: [
			word('コーヒー', 'コーヒー', 'coffee'),
			word('アメリカ', 'アメリカ', 'United States; America'),
			word('テレビ', 'テレビ', 'television'),
			word('ホテル', 'ホテル', 'hotel')
		],
		activities: [
			choice(
				'lp04-length',
				'How many morae are in コーヒー?',
				[['four', '4: コ・ー・ヒ・ー'], ['three', '3: コ・ヒ・ー'], ['two', '2: コ・ヒ']],
				'four',
				'Each long-vowel mark occupies one timing unit.'
			),
			arrange(
				'lp04-build',
				'Build テレビ.',
				['ビ', 'テ', 'レ', 'べ'],
				['テ', 'レ', 'ビ'],
				'television',
				'All three selected symbols are katakana.'
			),
			produce(
				'lp04-read',
				'speak',
				'Read コーヒー, アメリカ, テレビ, and ホテル from katakana.',
				'コーヒー。アメリカ。テレビ。ホテル。',
				'こーひー。あめりか。てれび。ほてる。',
				['Katakana decoded directly', 'Both long vowels in コーヒー held', 'No English consonants added']
			)
		],
		transferPrompt: 'Use the chart to decode カメラ, レストラン, and タクシー before guessing their source words.',
		transferSupport: 'Read each katakana symbol as a Japanese mora from left to right.'
	},
	{
		id: 'lp-05-voicing-marks',
		sequence: 5,
		unitId: 'launchpad',
		title: 'Dakuten and handakuten',
		shortTitle: 'Voicing marks',
		kind: 'script',
		durationMinutes: 17,
		canDo: 'Read kana modified by dakuten or handakuten and distinguish the b and p series.',
		focus: ['dakuten ゛', 'handakuten ゜', 'g/z/d/b/p rows', 'じ・ぢ and ず・づ'],
		scenario: [
			line('Contrast', 'か → が', 'か → が', 'ka → ga'),
			line('Contrast', 'は → ば → ぱ', 'は → ば → ぱ', 'ha → ba → pa'),
			line('Example', 'かばん／パン', 'かばん／パン', 'bag / bread')
		],
		notice: [
			'Dakuten is the two-stroke mark ゛. It changes k→g, s→z, t→d, and h→b.',
			'Handakuten is the circle ゜. It applies to the h row and changes h sounds to p sounds.'
		],
		explanation: [
			'The voiced t-row symbols ぢ and づ are usually pronounced like じ and ず in standard Japanese, but their spelling is restricted to particular words and sound changes.',
			'The same marks and sound changes apply to katakana: カ→ガ, ハ→バ→パ, ウ→ヴ.'
		],
		scriptCharts: [voicingChart],
		vocabulary: [
			word('かばん', 'かばん', 'bag', undefined, '鞄'),
			word('パン', 'パン', 'bread'),
			word('水', 'みず', 'water'),
			word('電話', 'でんわ', 'telephone')
		],
		activities: [
			choice(
				'lp05-mark',
				'Which mark changes は (ha) to ぱ (pa)?',
				[['circle', 'Handakuten ゜'], ['strokes', 'Dakuten ゛'], ['long', 'Long-vowel mark ー']],
				'circle',
				'The handakuten circle produces the p series from the h row.'
			),
			arrange(
				'lp05-build',
				'Build かばん.',
				['ぱ', 'か', 'ん', 'ば'],
				['か', 'ば', 'ん'],
				'bag',
				'ば is は with dakuten; ん remains a separate mora.'
			),
			produce(
				'lp05-contrast',
				'speak',
				'Read the contrasts か・が, さ・ざ, た・だ, and は・ば・ぱ.',
				'か・が。さ・ざ。た・だ。は・ば・ぱ。',
				'か・が。さ・ざ。た・だ。は・ば・ぱ。',
				['Voicing contrast audible', 'p series distinct from b series', 'No extra vowel after each item']
			)
		],
		transferPrompt: 'Read がくせい, でんわ, ぶんぽう, and パン and identify the mark used in each modified kana.',
		transferSupport: 'Two strokes indicate dakuten; a circle indicates handakuten.'
	},
	{
		id: 'lp-06-contracted-sounds',
		sequence: 6,
		unitId: 'launchpad',
		title: 'Contracted and extended sounds',
		shortTitle: 'Combined kana',
		kind: 'script',
		durationMinutes: 19,
		canDo: 'Read contracted sounds such as じゃ and common katakana extensions including ヴ.',
		focus: ['small ゃ・ゅ・ょ', 'じゃ versus じや', 'small vowel combinations', 'ヴ'],
		scenario: [
			line('Contrast', 'じゃ／じや', 'じゃ／じや', 'ja (one mora) / ji-ya (two morae)'),
			line('Katakana', 'ティ／ファ', 'ティ／ファ', 'ti / fa'),
			line('Katakana', 'ヴ', 'ヴ', 'vu; v-series base')
		],
		notice: [
			'An i-column kana followed by small ゃ, ゅ, or ょ forms one contracted mora: じ + small ゃ = じゃ (ja). Full-sized じや is two morae.',
			'Katakana uses small vowel symbols to approximate foreign sounds. ヴ is ウ with dakuten and is conventionally romanized vu or v.'
		],
		explanation: [
			'Contracted sounds use a small second kana and take one beat: きゃ, しゅ, ちょ, じゃ. A full-sized や, ゆ, or よ starts another mora.',
			'In actual Japanese speech, ヴ may be pronounced close to English v or merged toward ブ, depending on the speaker and word. Spellings with バ行 also remain common, so the dictionary form should be checked.'
		],
		scriptCharts: [contractedChart, foreignSoundChart],
		vocabulary: [
			word('じゃ', 'じゃ', 'ja; contracted sound'),
			word('今日', 'きょう', 'today'),
			word('写真', 'しゃしん', 'photograph'),
			word('ファイル', 'ファイル', 'file'),
			word('ヴ', 'ヴ', 'vu; katakana v-series symbol')
		],
		activities: [
			choice(
				'lp06-mora',
				'Which spelling represents one mora pronounced ja?',
				[['small', 'じゃ'], ['full', 'じや'], ['kata', 'ジヤ']],
				'small',
				'Small ゃ combines with じ into the single mora じゃ.'
			),
			arrange(
				'lp06-build',
				'Build じゃ with the correct kana size.',
				['や', 'じ', 'ゃ'],
				['じ', 'ゃ'],
				'ja',
				'The second kana must be small ゃ.'
			),
			produce(
				'lp06-read',
				'speak',
				'Contrast じゃ and じや, then read ティ, ファ, and ヴ.',
				'じゃ。じや。ティ。ファ。ヴ。',
				'じゃ。じ・や。てぃ。ふぁ。ゔ。',
				['One beat for じゃ', 'Two beats for じや', 'Small katakana vowels combined', 'ヴ identified as the v-series base']
			)
		],
		transferPrompt: 'Decode きょう, しゃしん, パーティー, ファイル, and ヴァイオリン while counting morae.',
		transferSupport: 'Small kana combine with the preceding symbol; full-sized kana begin a new mora.'
	},
	{
		id: 'lp-07-sound-changes',
		sequence: 4,
		unitId: 'launchpad',
		title: 'Long vowels, consonant length, and ん',
		shortTitle: 'Sound contrasts',
		kind: 'sound',
		durationMinutes: 14,
		canDo: 'Distinguish sound length and the small pause that can change a word.',
		focus: ['long vowels', 'small っ', 'ん timing', 'Japanese keyboard input'],
		scenario: [
			line('Guide', 'ここ', 'ここ', 'here'),
			line('Guide', 'こうこう', 'こうこう', 'high school'),
			line('Guide', 'きて／きって', 'きて／きって', 'come and… / postage stamp')
		],
		notice: [
			'こうこう has four morae: こ・う・こ・う. The written う lengthens each お sound.',
			'Small っ creates a silent beat before the following consonant: き・っ・て.'
		],
		explanation: [
			'Vowel length and consonant length can distinguish words, so “close enough” timing can change meaning.',
			'On a Japanese keyboard, type doubled consonants for small っ (kitte → きって) and nn for ん when needed.'
		],
		vocabulary: [
			word('ここ', 'ここ', 'here'),
			word('こうこう', 'こうこう', 'high school', undefined, '高校'),
			word('きって', 'きって', 'postage stamp', undefined, '切手'),
			word('こんにちは', 'こんにちは', 'hello', 'The written は is pronounced wa in this greeting')
		],
		activities: [
			choice(
				'lp07-length',
				'Which form has four morae?',
				[['koko', 'ここ'], ['koukou', 'こうこう'], ['kitte', 'きって']],
				'koukou',
				'こ・う・こ・う contains four morae.'
			),
			arrange(
				'lp07-build',
				'Build “postage stamp.”',
				['て', 'き', 'っ', 'ん'],
				['き', 'っ', 'て'],
				'postage stamp',
				'The small っ holds one beat before て.'
			),
			produce(
				'lp07-speak',
				'speak',
				'Contrast ここ, こうこう, きて, and きって. Keep the length differences audible.',
				'ここ。こうこう。きて。きって。',
				'ここ。こうこう。きて。きって。',
				['Four beats in こうこう', 'A silent beat in きって', 'No extra vowel after ん']
			)
		],
		transferPrompt: 'Use a Japanese keyboard to type こんにちは, きって, and こうこう from sound.',
		transferSupport: 'Type konnichiha, kitte, and koukou; then verify the kana, not the romaji.'
	},
	{
		id: 'u1-01-name',
		sequence: 5,
		unitId: 'introductions',
		title: 'Stating your name',
		shortTitle: 'Your name',
		kind: 'core',
		durationMinutes: 13,
		canDo: 'Give your name in a polite first meeting.',
		focus: ['X は Y です', 'topic は', 'polite です'],
		scenario: [
			line('マヤ', 'こんにちは。わたしはマヤです。', 'こんにちは。わたしは まや です。', 'Hello. I’m Maya.'),
			line('健', 'こんにちは。健です。', 'こんにちは。けん です。', 'Hello. I’m Ken.')
		],
		notice: [
			'は marks what the sentence is about and is pronounced わ here.',
			'Japanese often drops わたしは when the speaker is already obvious.'
		],
		explanation: [
			'X は Y です identifies X as Y. です makes the statement suitable for a polite first meeting.',
			'Saying マヤです is natural after greeting someone; repeating “I” in every sentence sounds heavy.'
		],
		vocabulary: [
			word('私', 'わたし', 'I; me', 'Often omitted when obvious'),
			word('です', 'です', 'polite copula; is/am/are'),
			word('こんにちは', 'こんにちは', 'hello'),
			word('名前', 'なまえ', 'name')
		],
		activities: [
			choice(
				'u101-meaning',
				'What is Maya doing in わたしはマヤです?',
				[['name', 'Giving her name'], ['ask', 'Asking a name'], ['origin', 'Giving her origin']],
				'name',
				'The pattern X は Y です identifies the topic X as Y.'
			),
			arrange(
				'u101-build',
				'Build “I’m Maya.”',
				['マヤ', 'は', 'です', 'わたし'],
				['わたし', 'は', 'マヤ', 'です'],
				'I’m Maya.',
				'The topic comes before は; the identity comes before です.'
			),
			produce(
				'u101-speak',
				'speak',
				'Greet someone and give your real or chosen name.',
				'こんにちは。アレックスです。',
				'こんにちは。あれっくす です。',
				['Greeting first', 'Name before です', 'Steady mora timing']
			)
		],
		transferPrompt: 'A new classmate says はじめまして. Reply with your name without reading the model.',
		transferSupport: 'Use はじめまして。___です。'
	},
	{
		id: 'u1-02-ask-name',
		sequence: 6,
		unitId: 'introductions',
		title: 'Asking someone’s name',
		shortTitle: 'Ask a name',
		kind: 'core',
		durationMinutes: 14,
		canDo: 'Ask someone’s name politely and respond with your own.',
		focus: ['お名前は？', 'question intonation', 'X さん'],
		scenario: [
			line('健', 'お名前は？', 'おなまえは？', 'What is your name?'),
			line('マヤ', 'マヤです。お名前は？', 'まや です。おなまえは？', 'I’m Maya. And you?'),
			line('健', '健です。', 'けん です。', 'I’m Ken.')
		],
		notice: [
			'The unfinished-looking お名前は？ works because the missing information is obvious.',
			'Attach さん to someone else’s name, not normally to your own.'
		],
		explanation: [
			'お adds politeness to 名前 in this common question. A gentle rising intonation marks the question in speech.',
			'Japanese conversation often reuses the topic question: お名前は？ can mean “And your name?”'
		],
		vocabulary: [
			word('お名前', 'おなまえ', 'name (polite)'),
			word('何', 'なに／なん', 'what'),
			word('さん', 'さん', 'polite name suffix'),
			word('初めまして', 'はじめまして', 'nice to meet you')
		],
		activities: [
			choice(
				'u102-title',
				'Which is the normal polite way to address Ken?',
				[['ken-san', '健さん'], ['watashi-san', 'わたしさん'], ['ken-desu-san', '健ですさん']],
				'ken-san',
				'さん follows another person’s name.'
			),
			arrange(
				'u102-build',
				'Build “What is your name?”',
				['は', 'お名前', 'です', '？'],
				['お名前', 'は', '？'],
				'What is your name?',
				'The compact conversational question is お名前は？'
			),
			typeIn(
				'u102-recall',
				'Type the polite question “What is your name?”',
				['お名前は？', 'お名前は', 'おなまえは？', 'おなまえは'],
				'お名前は？',
				'Kanji or kana is accepted; punctuation is optional.'
			),
			produce(
				'u102-speak',
				'speak',
				'Ask for a name, listen to an imagined reply, then address the person with さん.',
				'お名前は？ リナさんですね。',
				'おなまえは？ りなさん です ね。',
				['Polite name question', 'The other person’s name repeated', 'さん attached to their name']
			)
		],
		transferPrompt: 'Ask a person named リナ for their name, then address them as リナさん.',
		transferSupport: 'Question first; after the answer, repeat the name with さん.'
	},
	{
		id: 'u1-03-origin-role',
		sequence: 7,
		unitId: 'introductions',
		title: 'Origin and occupation',
		shortTitle: 'Origin & role',
		kind: 'core',
		durationMinutes: 16,
		canDo: 'State your origin or affiliation and ask one matching question.',
		focus: ['X から来ました', 'X の Y', 'も for “also”'],
		scenario: [
			line('マヤ', 'カナダから来ました。大学の学生です。', 'かなだ から きました。だいがく の がくせい です。', 'I came from Canada. I’m a university student.'),
			line('健', 'わたしも学生です。', 'わたし も がくせい です。', 'I’m also a student.')
		],
		notice: [
			'から marks the starting point: カナダから, “from Canada.”',
			'の connects nouns. 大学の学生 is a student of a university—a university student.'
		],
		explanation: [
			'来ました is the polite past of 来る, “come.” The phrase X から来ました is a conventional way to say where you are from.',
			'も replaces は when the new statement means “also”: わたしも学生です.'
		],
		vocabulary: [
			word('来ました', 'きました', 'came', 'Polite past of 来る', '来る'),
			word('大学', 'だいがく', 'university'),
			word('学生', 'がくせい', 'student'),
			word('会社員', 'かいしゃいん', 'company employee'),
			word('国', 'くに', 'country')
		],
		activities: [
			choice(
				'u103-particle',
				'Which particle means “from” in カナダ___来ました?',
				[['kara', 'から'], ['no', 'の'], ['mo', 'も']],
				'kara',
				'から marks the point of origin.'
			),
			arrange(
				'u103-build',
				'Build “I’m also a student.”',
				['学生', 'わたし', 'です', 'も'],
				['わたし', 'も', '学生', 'です'],
				'I’m also a student.',
				'も follows the topic and contributes the meaning “also.”'
			),
			produce(
				'u103-write',
				'write',
				'Write two short lines: where you are from and your role. Use a fictional answer if you prefer.',
				'アメリカから来ました。会社員です。',
				'あめりか から きました。かいしゃいん です。',
				['Place + から来ました', 'Role + です', 'No need to repeat わたしは']
			)
		],
		transferPrompt: 'Someone says 大学生です. Tell them that you are also a student.',
		transferSupport: 'Replace は with も: わたしも…'
	},
	{
		id: 'u1-04-repair',
		sequence: 8,
		unitId: 'introductions',
		title: 'Requesting repetition',
		shortTitle: 'Ask for repair',
		kind: 'core',
		durationMinutes: 14,
		canDo: 'Signal that you did not understand and ask for one repetition.',
		focus: ['すみません', 'もう一度お願いします', 'ゆっくりお願いします'],
		scenario: [
			line('健', 'お仕事は何ですか。', 'おしごとは なん ですか。', 'What do you do for work?'),
			line('マヤ', 'すみません。もう一度お願いします。', 'すみません。もう いちど おねがいします。', 'Excuse me. Once more, please.'),
			line('健', 'お仕事は、何ですか。', 'おしごとは、なん ですか。', 'What do you do for work?')
		],
		notice: [
			'すみません gets attention and softens the request; it is not only an apology.',
			'お願いします turns the requested action into a polite appeal.'
		],
		explanation: [
			'Repair language is a core beginner skill: it lets you stay in a conversation when the input exceeds your current level.',
			'Use もう一度 for “once more” and ゆっくり for “slowly.” You can combine them only when necessary.'
		],
		vocabulary: [
			word('すみません', 'すみません', 'excuse me; sorry'),
			word('もう一度', 'もういちど', 'once more'),
			word('ゆっくり', 'ゆっくり', 'slowly'),
			word('お願いします', 'おねがいします', 'please', 'Polite request formula', 'お願い'),
			word('仕事', 'しごと', 'work; job')
		],
		activities: [
			choice(
				'u104-repair',
				'You heard the words but they were too fast. What is the most useful reply?',
				[['slow', 'ゆっくりお願いします。'], ['name', 'お名前は？'], ['also', 'わたしもです。']],
				'slow',
				'ゆっくりお願いします directly requests slower speech.'
			),
			arrange(
				'u104-build',
				'Build “Once more, please.”',
				['お願いします', 'もう', '一度', 'です'],
				['もう', '一度', 'お願いします'],
				'Once more, please.',
				'もう一度 names the requested repetition; お願いします makes it polite.'
			),
			produce(
				'u104-speak',
				'speak',
				'Interrupt politely and request repetition. Then request slower speech.',
				'すみません。もう一度お願いします。ゆっくりお願いします。',
				'すみません。もう いちど おねがいします。ゆっくり おねがいします。',
				['Attention signal first', 'Clear repair request', 'Polite お願いします ending']
			)
		],
		transferPrompt: 'A speaker repeats the same fast sentence. Change your repair request instead of repeating it unchanged.',
		transferSupport: 'Move from もう一度お願いします to ゆっくりお願いします.'
	},
	{
		id: 'u1-05-first-meeting',
		sequence: 9,
		unitId: 'introductions',
		title: 'Mission: first meeting',
		shortTitle: 'First meeting',
		kind: 'mission',
		durationMinutes: 18,
		canDo: 'Complete a short first meeting, exchange two details, and repair one problem.',
		focus: ['greeting', 'name and origin', 'follow-up', 'repair'],
		scenario: [
			line('リナ', 'はじめまして。リナです。お名前は？', 'はじめまして。りな です。おなまえは？', 'Nice to meet you. I’m Rina. What is your name?'),
			line('あなた', 'アレックスです。カナダから来ました。', 'あれっくす です。かなだ から きました。', 'I’m Alex. I came from Canada.'),
			line('リナ', 'すみません。もう一度お願いします。', 'すみません。もう いちど おねがいします。', 'Sorry—once more, please.')
		],
		notice: [
			'The exchange has an outcome: both people leave with a name and one personal detail.',
			'The repair request is part of successful communication, not evidence that the conversation failed.'
		],
		explanation: [
			'Plan ideas, not a script: greeting → name → one detail → one matching question → close.',
			'If your partner signals trouble, repeat only the unclear part more slowly.'
		],
		vocabulary: [
			word('初めまして', 'はじめまして', 'nice to meet you'),
			word('よろしくお願いします', 'よろしくおねがいします', 'pleased to meet you; I look forward to working with you'),
			word('出身', 'しゅっしん', 'origin; hometown')
		],
		activities: [
			choice(
				'u105-understand',
				'What must both people know for the mission to succeed?',
				[['details', 'A name and one personal detail'], ['all', 'A memorized five-line script'], ['kanji', 'Every name in kanji']],
				'details',
				'The Can-do measures exchanged information, not script recitation.'
			),
			typeIn(
				'u105-repair',
				'Your partner did not hear your origin. Type “Once more, please.” as the partner.',
				['もう一度お願いします', 'もういちどおねがいします'],
				'もう一度お願いします。',
				'This is the repair phrase practiced in the previous lesson.'
			),
			produce(
				'u105-mission',
				'speak',
				'Complete the meeting from a blank start. Give a name and origin, ask one question, and include one repair turn.',
				'はじめまして。アレックスです。カナダから来ました。お名前は？ すみません。もう一度お願いします。',
				'はじめまして。あれっくす です。かなだ から きました。おなまえは？ すみません。もう いちど おねがいします。',
				['Name exchanged', 'One personal detail exchanged', 'One question asked', 'One repair phrase used']
			)
		],
		transferPrompt: 'Repeat the mission with a different name, country, and partner response. Do not reuse the same full script.',
		transferSupport: 'Keep the interaction frame; replace the personal information.'
	}
];
