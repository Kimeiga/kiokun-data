import { lesson } from './authoring';
import type { CourseUnit, LanguageCourse, ScriptChart } from './types';

const toneChart: ScriptChart = {
	title: 'Mandarin tone contrast',
	caption: 'Tone is part of the syllable. The neutral tone is short and unstressed rather than a fifth full contour.',
	columns: ['1 high level', '2 rising', '3 low/dipping', '4 falling', 'neutral'],
	rows: [
		{
			label: 'ma',
			cells: [
				{ symbol: '妈', romanization: 'mā', note: 'mother' },
				{ symbol: '麻', romanization: 'má', note: 'hemp' },
				{ symbol: '马', romanization: 'mǎ', note: 'horse' },
				{ symbol: '骂', romanization: 'mà', note: 'scold' },
				{ symbol: '吗', romanization: 'ma', note: 'question particle' }
			]
		}
	]
};

const initialChart: ScriptChart = {
	title: 'Pinyin initials',
	caption: 'Pinyin letters represent Mandarin sound categories. Similar-looking English letters do not guarantee the same articulation.',
	columns: ['initials', 'contrast', 'examples'],
	rows: [
		{ label: 'lips', cells: [
			{ symbol: 'b p m f', romanization: 'unaspirated · aspirated · nasal · fricative' },
			{ symbol: 'b / p', romanization: 'aspiration contrast' },
			{ symbol: '八・怕・妈・饭', romanization: 'bā · pà · mā · fàn' }
		] },
		{ label: 'tongue', cells: [
			{ symbol: 'd t n l', romanization: 'd · t · n · l' },
			{ symbol: 'd / t', romanization: 'aspiration contrast' },
			{ symbol: '大・他・你・来', romanization: 'dà · tā · nǐ · lái' }
		] },
		{ label: 'velar', cells: [
			{ symbol: 'g k h', romanization: 'g · k · h' },
			{ symbol: 'g / k', romanization: 'aspiration contrast' },
			{ symbol: '个・看・好', romanization: 'gè · kàn · hǎo' }
		] },
		{ label: 'palatal', cells: [
			{ symbol: 'j q x', romanization: 'j · q · x' },
			{ symbol: 'j / q', romanization: 'aspiration contrast' },
			{ symbol: '家・去・想', romanization: 'jiā · qù · xiǎng' }
		] },
		{ label: 'retroflex', cells: [
			{ symbol: 'zh ch sh r', romanization: 'zh · ch · sh · r' },
			{ symbol: 'zh / ch', romanization: 'aspiration contrast' },
			{ symbol: '中・吃・是・人', romanization: 'zhōng · chī · shì · rén' }
		] },
		{ label: 'dental', cells: [
			{ symbol: 'z c s', romanization: 'z · c · s' },
			{ symbol: 'z / c', romanization: 'aspiration contrast' },
			{ symbol: '早・菜・三', romanization: 'zǎo · cài · sān' }
		] }
	]
};

const finalChart: ScriptChart = {
	title: 'Pinyin finals',
	caption: 'A final contains the vowel nucleus and any glide or nasal ending. Not every theoretical initial–final combination occurs.',
	columns: ['finals', 'examples', 'note'],
	rows: [
		{ label: 'simple', cells: [
			{ symbol: 'a o e i u ü', romanization: 'basic finals' },
			{ symbol: '他・我・喝・你・不・女', romanization: 'tā · wǒ · hē · nǐ · bù · nǚ' },
			{ symbol: 'ü', romanization: 'keep the lip rounding' }
		] },
		{ label: 'compound', cells: [
			{ symbol: 'ai ei ao ou ie üe', romanization: 'compound finals' },
			{ symbol: '来・累・好・有・写・学', romanization: 'lái · lèi · hǎo · yǒu · xiě · xué' },
			{ symbol: 'iu / ui', romanization: 'contracted spellings' }
		] },
		{ label: 'nasal', cells: [
			{ symbol: 'an en in un ün', romanization: 'front nasal -n' },
			{ symbol: 'ang eng ing ong', romanization: 'back nasal -ng' },
			{ symbol: '-n / -ng', romanization: 'meaning can change' }
		] }
	]
};

const toneChangeChart: ScriptChart = {
	title: 'Common tone changes',
	caption: 'Pinyin normally preserves citation-tone spelling even when connected speech changes the realized tone.',
	columns: ['written form', 'typical realization', 'condition'],
	rows: [
		{ label: '3 + 3', cells: [
			{ symbol: '你好', romanization: 'nǐ hǎo' },
			{ symbol: 'ní hǎo', romanization: '2 + 3 in speech' },
			{ symbol: 'third tone before third tone', romanization: 'sandhi' }
		] },
		{ label: '不', cells: [
			{ symbol: '不是', romanization: 'bù shì' },
			{ symbol: 'bú shì', romanization: '2 + 4 in speech' },
			{ symbol: '不 before fourth tone', romanization: 'tone change' }
		] },
		{ label: '一', cells: [
			{ symbol: '一个', romanization: 'yī gè' },
			{ symbol: 'yí ge', romanization: '2 + neutral in speech' },
			{ symbol: '一 changes by following tone', romanization: 'context dependent' }
		] }
	]
};

const lessons = [
	lesson({
		id: 'zh-00-pinyin-tones', unitId: 'mandarin-launchpad', title: 'Characters, Pinyin, and tone', shortTitle: 'Pinyin and tone', kind: 'sound', durationMinutes: 18,
		canDo: 'Interpret a basic Pinyin syllable and distinguish the four lexical tones from the neutral tone.',
		focus: ['characters', 'initial + final + tone', 'four tones', 'neutral tone'],
		scenario: [['Contrast', '妈・麻・马・骂・吗', 'mā · má · mǎ · mà · ma', 'mother · hemp · horse · scold · question particle'], ['Example', '你好吗？', 'Nǐ hǎo ma?', 'How are you?']],
		notice: ['A written Chinese syllable can be represented as an initial, a final, and a tone.', 'Tone distinguishes words. The neutral tone is written without a tone mark.'],
		explanation: ['Pinyin is the standard romanization used here for pronunciation and keyboard input; it does not replace characters.', 'Tone marks belong over the vowel nucleus. Tone numbers are useful for analysis, but normal Pinyin uses diacritics.'],
		scriptCharts: [toneChart],
		vocabulary: [['妈', 'mā', 'mother'], ['马', 'mǎ', 'horse'], ['吗', 'ma', 'yes–no question particle'], ['好', 'hǎo', 'good']],
		choice: { prompt: 'Which Pinyin form has fourth tone?', options: [['ma1', 'mā'], ['ma3', 'mǎ'], ['ma4', 'mà']], answer: 'ma4', rationale: 'The falling grave accent marks fourth tone.' },
		arrange: { prompt: 'Build 你好.', tiles: ['好', '你', '吗'], answer: ['你', '好'], translation: 'hello; you good', rationale: '你好 combines 你 and 好.' },
		production: { mode: 'speak', prompt: 'Contrast mā, má, mǎ, mà, and neutral-tone ma.', modelAnswer: '妈，麻，马，骂，吗。', modelReading: 'mā, má, mǎ, mà, ma.', checklist: ['Five distinct tone patterns attempted', 'Fourth tone falls decisively', 'Neutral tone is short and unstressed'] },
		transferPrompt: 'Read 妈, 马, and 吗 from their Pinyin, then state the tone category of each syllable.', transferSupport: 'mā = first tone; mǎ = third tone; ma = neutral tone.'
	}),
	lesson({
		id: 'zh-01-initials-one', unitId: 'mandarin-launchpad', title: 'Pinyin initials: basic contrasts', shortTitle: 'Initials I', kind: 'sound', durationMinutes: 16,
		canDo: 'Read basic Pinyin initials and distinguish the major aspirated and unaspirated pairs.',
		focus: ['b/p', 'd/t', 'g/k', 'm n l f h'],
		scenario: [['Contrast', '八／怕', 'bā / pà', 'eight / be afraid'], ['Contrast', '大／他', 'dà / tā', 'big / he']],
		notice: ['Pinyin b, d, and g are normally unaspirated; p, t, and k have a stronger release of air.', 'The contrast is not the same as English voiced versus voiceless spelling.'],
		explanation: ['Hold a hand in front of the mouth to check the stronger puff on p, t, and k.', 'Attach each initial directly to its final; do not insert an extra vowel between them.'],
		scriptCharts: [initialChart],
		vocabulary: [['八', 'bā', 'eight'], ['大', 'dà', 'big'], ['他', 'tā', 'he'], ['看', 'kàn', 'look; watch']],
		choice: { prompt: 'Which initial is the aspirated partner of b?', options: [['p', 'p'], ['m', 'm'], ['f', 'f']], answer: 'p', rationale: 'The b/p pair is distinguished mainly by aspiration.' },
		arrange: { prompt: 'Build Pinyin for 八.', tiles: ['p', 'b', 'ā'], answer: ['b', 'ā'], translation: 'bā', rationale: '八 is bā with an unaspirated initial.' },
		production: { mode: 'speak', prompt: 'Contrast bā/pā, dā/tā, and gā/kā with a hand near your mouth.', modelAnswer: '八，趴；搭，他；嘎，咖。', modelReading: 'bā, pā; dā, tā; gā, kā.', checklist: ['Stronger air on p, t, and k', 'No extra vowel after the initial', 'Tone kept stable across each pair'] },
		transferPrompt: 'Read 爸爸, 弟弟, and 哥哥 from Pinyin and identify each word’s first initial.', transferSupport: 'bàba, dìdi, gēge begin with b, d, and g.'
	}),
	lesson({
		id: 'zh-02-initials-two', unitId: 'mandarin-launchpad', title: 'Pinyin initials: palatal and sibilant sets', shortTitle: 'Initials II', kind: 'sound', durationMinutes: 17,
		canDo: 'Distinguish j/q/x, zh/ch/sh/r, and z/c/s in common beginner words.',
		focus: ['j q x', 'zh ch sh r', 'z c s', 'tongue position'],
		scenario: [['Contrast', '鸡／七／西', 'jī / qī / xī', 'chicken / seven / west'], ['Contrast', '吃／次', 'chī / cì', 'eat / time; occurrence']],
		notice: ['j/q/x occur before high front sounds such as i and ü; the tongue stays forward.', 'zh/ch/sh/r use a retracted tongue position, while z/c/s stay farther forward.'],
		explanation: ['English spellings are only rough reminders. Learn these initials through repeated syllable contrasts.', 'q, ch, and c are the aspirated members of their respective sets.'],
		scriptCharts: [initialChart],
		vocabulary: [['吃', 'chī', 'eat'], ['去', 'qù', 'go'], ['是', 'shì', 'be'], ['三', 'sān', 'three']],
		choice: { prompt: 'Which set contains the initial in 去 qù?', options: [['palatal', 'j/q/x'], ['retroflex', 'zh/ch/sh/r'], ['dental', 'z/c/s']], answer: 'palatal', rationale: 'q belongs to the palatal j/q/x set.' },
		arrange: { prompt: 'Build Pinyin for 去.', tiles: ['q', 'ch', 'ù'], answer: ['q', 'ù'], translation: 'qù', rationale: '去 is written qù.' },
		production: { mode: 'speak', prompt: 'Read jī–qī–xī, zhī–chī–shī, and zī–cī–sī.', modelAnswer: '鸡、七、西；知、吃、诗；资、词、思。', modelReading: 'jī, qī, xī; zhī, chī, shī; zī, cí, sī.', checklist: ['Three sets remain distinct', 'Aspiration audible on q, ch, and c', 'No English-style final consonants added'] },
		transferPrompt: 'Read 西, 十, and 四 and identify whether each begins with x, sh, or s.', transferSupport: 'xī begins with x; shí begins with sh; sì begins with s.'
	}),
	lesson({
		id: 'zh-03-finals', unitId: 'mandarin-launchpad', title: 'Pinyin finals and ü', shortTitle: 'Finals and ü', kind: 'sound', durationMinutes: 17,
		canDo: 'Read common simple, compound, and nasal finals and preserve the distinction between u and ü.',
		focus: ['simple finals', 'compound finals', '-n/-ng', 'ü spelling'],
		scenario: [['Contrast', '路／绿', 'lù / lǜ', 'road / green'], ['Contrast', '真／正', 'zhēn / zhèng', 'real / correct']],
		notice: ['ü uses tongue position similar to i with rounded lips. It is distinct from u.', 'After j, q, and x, written u represents ü because plain u cannot occur there.'],
		explanation: ['Nasal endings -n and -ng must remain distinct because they can distinguish words.', 'The y and w spellings organize syllables without a consonant initial: i→yi, u→wu, ü→yu.'],
		scriptCharts: [finalChart],
		vocabulary: [['女', 'nǚ', 'woman; female'], ['绿', 'lǜ', 'green'], ['学', 'xué', 'study; learn'], ['中', 'zhōng', 'middle; China']],
		choice: { prompt: 'Which word contains the rounded front vowel ü?', options: [['lv', '绿 lǜ'], ['lu', '路 lù'], ['lai', '来 lái']], answer: 'lv', rationale: '绿 is lǜ, distinct from 路 lù.' },
		arrange: { prompt: 'Build Pinyin for 女.', tiles: ['n', 'l', 'ǚ'], answer: ['n', 'ǚ'], translation: 'nǚ', rationale: '女 is nǚ with explicit ü after n.' },
		production: { mode: 'speak', prompt: 'Contrast lù/lǜ and zhēn/zhēng.', modelAnswer: '路，绿；真，正。', modelReading: 'lù, lǜ; zhēn, zhèng.', checklist: ['Lip rounding distinguishes ü', '-n ends at the front of the mouth', '-ng ends farther back'] },
		transferPrompt: 'Read 去, 女, 路, and 绿 and explain why the dots appear in some Pinyin spellings but not others.', transferSupport: 'After j/q/x/y, written u can represent ü; after n/l, the dots remain.'
	}),
	lesson({
		id: 'zh-04-tone-changes', unitId: 'mandarin-launchpad', title: 'Tone changes in connected speech', shortTitle: 'Tone changes', kind: 'sound', durationMinutes: 17,
		canDo: 'Recognize common third-tone, 不, 一, and neutral-tone changes without changing dictionary spelling.',
		focus: ['third-tone sandhi', '不', '一', 'neutral syllables'],
		scenario: [['Example', '你好。', 'Nǐ hǎo. → Ní hǎo.', 'Hello.'], ['Example', '不是。', 'Bù shì. → Bú shì.', 'It is not.']],
		notice: ['Two adjacent third tones are normally realized as second tone plus third tone.', '不 becomes second tone before a fourth tone. 一 changes according to the following tone.'],
		explanation: ['Standard Pinyin usually writes citation tones, so 你好 remains nǐ hǎo even though the first syllable rises in ordinary speech.', 'Many unstressed particles and repeated kinship syllables use a short neutral tone.'],
		scriptCharts: [toneChangeChart],
		vocabulary: [['你好', 'nǐ hǎo', 'hello'], ['不是', 'bú shì', 'is not', 'Connected-speech reading shown'], ['一个', 'yí ge', 'one; one item', 'Connected-speech reading shown'], ['妈妈', 'māma', 'mother']],
		choice: { prompt: 'How is the first syllable of 你好 normally realized?', options: [['second', 'As a rising second tone'], ['third', 'As a full third tone'], ['neutral', 'As neutral tone']], answer: 'second', rationale: 'Third tone before another third tone normally becomes second tone in speech.' },
		arrange: { prompt: 'Build 不是.', tiles: ['不', '很', '是'], answer: ['不', '是'], translation: 'is not', rationale: '不 precedes the fourth-tone syllable 是.' },
		production: { mode: 'speak', prompt: 'Say 你好, 不是, 一个, and 妈妈 with connected-speech tone patterns.', modelAnswer: '你好。不是。一个。妈妈。', modelReading: 'ní hǎo. bú shì. yí ge. māma.', checklist: ['First syllable of 你好 rises', '不 rises before 是', 'Second syllable of 妈妈 is light'] },
		transferPrompt: 'Read 很好, 不去, 一杯, and 爸爸 aloud, then identify the tone-change rule in each.', transferSupport: 'Third+third, 不 before fourth, 一 before first, and a neutral repeated syllable are the four targets.'
	}),
	lesson({
		id: 'zh-05-name', unitId: 'mandarin-introductions', title: 'Stating your name', shortTitle: 'Your name',
		canDo: 'State your name and understand the corresponding first-meeting question.',
		focus: ['我叫…', '你叫什么名字？', 'pronouns'],
		scenario: [['林娜', '你好，我叫林娜。', 'Nǐ hǎo, wǒ jiào Lín Nà.', 'Hello, my name is Lin Na.'], ['王明', '你好。你叫什么名字？', 'Nǐ hǎo. Nǐ jiào shénme míngzi?', 'Hello. What is your name?']],
		notice: ['叫 introduces the name someone is called.', '什么 asks “what”; 什么名字 asks for a name.'],
		explanation: ['我叫 + name is a direct, neutral introduction pattern.', 'Chinese does not require a form equivalent to English “am” in this pattern.'],
		vocabulary: [['我', 'wǒ', 'I; me'], ['你', 'nǐ', 'you'], ['叫', 'jiào', 'be called'], ['名字', 'míngzi', 'name']],
		choice: { prompt: 'What information does 你叫什么名字 request?', options: [['name', 'A name'], ['country', 'A country'], ['time', 'A time']], answer: 'name', rationale: '什么名字 means “what name.”' },
		arrange: { prompt: 'Build “My name is Lin Na.”', tiles: ['林娜', '我', '叫', '是'], answer: ['我', '叫', '林娜'], translation: 'My name is Lin Na.', rationale: 'The introduction pattern is 我叫 + name.' },
		production: { mode: 'speak', prompt: 'Greet someone, state your name, and ask their name.', modelAnswer: '你好，我叫林娜。你叫什么名字？', modelReading: 'Nǐ hǎo, wǒ jiào Lín Nà. Nǐ jiào shénme míngzi?', checklist: ['Greeting included', '我叫 used with a name', 'Question ends with 什么名字'] },
		transferPrompt: 'Replace 林娜 with your own name and answer the same question without reading the model.', transferSupport: '你好，我叫…'
	}),
	lesson({
		id: 'zh-06-identity', unitId: 'mandarin-introductions', title: 'Identity and origin', shortTitle: 'Origin',
		canDo: 'State a basic identity or country of origin with 是 and understand a negative answer.',
		focus: ['A 是 B', '不是', '哪国人'],
		scenario: [['王明', '我是中国人。', 'Wǒ shì Zhōngguó rén.', 'I am Chinese.'], ['林娜', '我不是中国人。我是加拿大人。', 'Wǒ bú shì Zhōngguó rén. Wǒ shì Jiānádà rén.', 'I am not Chinese. I am Canadian.']],
		notice: ['是 links a person or thing to a noun identity.', '不是 negates 是; 不 is normally realized as bú before fourth-tone 是.'],
		explanation: ['Country + 人 forms many nationality expressions.', 'Do not add 是 before ordinary adjective predicates; this lesson uses noun identities only.'],
		vocabulary: [['是', 'shì', 'be'], ['不是', 'bú shì', 'be not'], ['中国', 'Zhōngguó', 'China'], ['人', 'rén', 'person']],
		choice: { prompt: 'Which sentence says “I am not Chinese”?', options: [['negative', '我不是中国人。'], ['positive', '我是中国人。'], ['question', '你是中国人吗？']], answer: 'negative', rationale: '不是 negates the identity.' },
		arrange: { prompt: 'Build “I am Chinese.”', tiles: ['中国人', '我', '是', '叫'], answer: ['我', '是', '中国人'], translation: 'I am Chinese.', rationale: 'A 是 B identifies A as B.' },
		production: { mode: 'speak', prompt: 'State where you are from, then give one contrasting negative statement.', modelAnswer: '我是加拿大人。我不是中国人。', modelReading: 'Wǒ shì Jiānádà rén. Wǒ bú shì Zhōngguó rén.', checklist: ['是 used for noun identity', '不是 used for the contrast', 'Country name remains understandable'] },
		transferPrompt: 'Ask and answer 你是哪国人？ using a country that has not appeared in the model.', transferSupport: '我是…人。'
	}),
	lesson({
		id: 'zh-07-ma-ne', unitId: 'mandarin-introductions', title: 'Yes–no questions and follow-up', shortTitle: '吗 and 呢',
		canDo: 'Ask a yes–no question with 吗 and return the same topic with 呢.',
		focus: ['吗', '呢', 'short answers'],
		scenario: [['林娜', '你是学生吗？', 'Nǐ shì xuésheng ma?', 'Are you a student?'], ['王明', '是，我是学生。你呢？', 'Shì, wǒ shì xuésheng. Nǐ ne?', 'Yes, I am a student. And you?']],
		notice: ['吗 turns a statement into a neutral yes–no question.', '呢 can return an established question or topic: 你呢 means “and you?”'],
		explanation: ['Keep statement word order and add 吗 at the end.', 'Short answers commonly repeat the relevant verb: 是 / 不是.'],
		vocabulary: [['学生', 'xuésheng', 'student'], ['吗', 'ma', 'yes–no question particle'], ['呢', 'ne', 'topic-return particle'], ['也', 'yě', 'also']],
		choice: { prompt: 'Which particle makes 你是学生 into a yes–no question?', options: [['ma', '吗'], ['ne', '呢'], ['ye', '也']], answer: 'ma', rationale: 'Sentence-final 吗 marks a neutral yes–no question.' },
		arrange: { prompt: 'Build “Are you a student?”', tiles: ['学生', '你', '吗', '是'], answer: ['你', '是', '学生', '吗'], translation: 'Are you a student?', rationale: 'The statement order remains, with 吗 added at the end.' },
		production: { mode: 'speak', prompt: 'Ask whether someone is a student, answer, and return the question.', modelAnswer: '你是学生吗？是，我是学生。你呢？', modelReading: 'Nǐ shì xuésheng ma? Shì, wǒ shì xuésheng. Nǐ ne?', checklist: ['吗 at the end of the question', 'Answer repeats 是 or 不是', '你呢 returns the topic'] },
		transferPrompt: 'Replace 学生 with 老师 and complete the same three-turn exchange.', transferSupport: '你是老师吗？…你呢？'
	}),
	lesson({
		id: 'zh-08-numbers-age', unitId: 'mandarin-introductions', title: 'Numbers and age', shortTitle: 'Numbers and age',
		canDo: 'Understand basic numbers and state an adult age with 岁.',
		focus: ['0–100', '十 patterns', '岁', '多大'],
		scenario: [['王明', '你多大？', 'Nǐ duō dà?', 'How old are you?'], ['林娜', '我二十五岁。', 'Wǒ èrshíwǔ suì.', 'I am twenty-five years old.']],
		notice: ['十一 is 10+1; 二十五 is 2×10+5.', '岁 follows the number directly; do not add 是.'],
		explanation: ['多大 is a common age question among adults; context affects whether it is socially appropriate.', '二 is used in ordinary counting and age numbers; 两 appears before many measure words.'],
		vocabulary: [['十', 'shí', 'ten'], ['二十', 'èrshí', 'twenty'], ['岁', 'suì', 'years old'], ['多大', 'duō dà', 'how old']],
		choice: { prompt: 'Which number is 二十五?', options: [['25', '25'], ['52', '52'], ['15', '15']], answer: '25', rationale: '二十 is twenty and 五 adds five.' },
		arrange: { prompt: 'Build “I am twenty-five years old.”', tiles: ['二十五', '我', '是', '岁'], answer: ['我', '二十五', '岁'], translation: 'I am twenty-five years old.', rationale: 'Age uses person + number + 岁 without 是.' },
		production: { mode: 'speak', prompt: 'Ask an adult’s age and give an age answer.', modelAnswer: '你多大？我二十五岁。', modelReading: 'Nǐ duō dà? Wǒ èrshíwǔ suì.', checklist: ['多大 used as the question', 'Number precedes 岁', 'No 是 inserted before the age'] },
		transferPrompt: 'State the ages 18, 34, and 67 in complete sentences without looking at English digits.', transferSupport: '十八、三十四、六十七 + 岁。'
	}),
	lesson({
		id: 'zh-09-intro-mission', unitId: 'mandarin-introductions', title: 'Mission: complete a first meeting', shortTitle: 'First meeting', kind: 'mission', durationMinutes: 18,
		canDo: 'Complete a short first meeting with a name, identity, question, and follow-up.',
		focus: ['integrated introduction', 'question response', 'topic return'],
		scenario: [['林娜', '你好，我叫林娜。我是学生。你呢？', 'Nǐ hǎo, wǒ jiào Lín Nà. Wǒ shì xuésheng. Nǐ ne?', 'Hello, my name is Lin Na. I am a student. And you?'], ['王明', '我叫王明。我也是学生。', 'Wǒ jiào Wáng Míng. Wǒ yě shì xuésheng.', 'My name is Wang Ming. I am also a student.']],
		notice: ['A compact introduction does not need to repeat every pronoun when the subject remains clear.', '也 goes before 是: 我也是学生.'],
		explanation: ['The mission combines previously checked forms without introducing a new grammar target.', 'Listen for whether the partner asks a yes–no question or returns a topic with 呢.'],
		vocabulary: [['你好', 'nǐ hǎo', 'hello'], ['老师', 'lǎoshī', 'teacher'], ['也', 'yě', 'also'], ['哪国人', 'nǎ guó rén', 'person of which country']],
		choice: { prompt: 'Where does 也 belong in “I am also a student”?', options: [['before-shi', 'Before 是'], ['after-student', 'After 学生'], ['sentence-end', 'At the sentence end']], answer: 'before-shi', rationale: '也 normally precedes the predicate it modifies.' },
		arrange: { prompt: 'Build “I am also a student.”', tiles: ['学生', '也', '我', '是'], answer: ['我', '也', '是', '学生'], translation: 'I am also a student.', rationale: 'The order is subject + 也 + 是 + identity.' },
		production: { mode: 'speak', prompt: 'Give your name and identity, ask one matching question, and respond to the answer.', modelAnswer: '你好，我叫林娜。我是学生。你是学生吗？', modelReading: 'Nǐ hǎo, wǒ jiào Lín Nà. Wǒ shì xuésheng. Nǐ shì xuésheng ma?', checklist: ['Name stated with 叫', 'Identity stated with 是', 'One relevant question asked', 'Tone patterns remain intelligible'] },
		transferPrompt: 'Complete the meeting again with a different occupation and country, without copying the model nouns.', transferSupport: '我叫…；我是…；你是…吗？'
	}),
	lesson({
		id: 'zh-10-week-date', unitId: 'mandarin-daily', title: 'Days and dates', shortTitle: 'Days and dates',
		canDo: 'Ask and state a weekday or simple calendar date.',
		focus: ['今天', '星期', '月/号', '几'],
		scenario: [['林娜', '今天星期几？', 'Jīntiān xīngqī jǐ?', 'What day is it today?'], ['王明', '今天星期三，八月二十号。', 'Jīntiān xīngqīsān, bā yuè èrshí hào.', 'Today is Wednesday, August 20.']],
		notice: ['Weekdays use 星期 plus a number, with 星期天 or 星期日 for Sunday.', 'Dates move from larger to smaller units: month before day.'],
		explanation: ['几 asks for a small expected number and appears where the missing number belongs.', '号 is common for spoken calendar dates; 日 is more formal or written.'],
		vocabulary: [['今天', 'jīntiān', 'today'], ['星期', 'xīngqī', 'week; weekday'], ['月', 'yuè', 'month'], ['号', 'hào', 'day of month']],
		choice: { prompt: 'What day is 星期三?', options: [['wed', 'Wednesday'], ['tue', 'Tuesday'], ['sun', 'Sunday']], answer: 'wed', rationale: '星期三 is the third numbered weekday, Wednesday.' },
		arrange: { prompt: 'Build “What day is it today?”', tiles: ['星期', '今天', '几', '吗'], answer: ['今天', '星期', '几'], translation: 'What day is it today?', rationale: '几 occupies the missing weekday-number position.' },
		production: { mode: 'speak', prompt: 'Ask for today’s weekday and answer with a weekday and date.', modelAnswer: '今天星期几？今天星期三，八月二十号。', modelReading: 'Jīntiān xīngqī jǐ? Jīntiān xīngqīsān, bā yuè èrshí hào.', checklist: ['Question uses 几', 'Weekday uses 星期', 'Month stated before date'] },
		transferPrompt: 'State three different dates and weekdays using the Chinese large-to-small order.', transferSupport: '八月二十号，星期三。'
	}),
	lesson({
		id: 'zh-11-clock-time', unitId: 'mandarin-daily', title: 'Clock time', shortTitle: 'Clock time',
		canDo: 'Ask for the current time and state an hour and half hour.',
		focus: ['几点', '点', '分', '半'],
		scenario: [['王明', '现在几点？', 'Xiànzài jǐ diǎn?', 'What time is it now?'], ['林娜', '现在七点半。', 'Xiànzài qī diǎn bàn.', 'It is 7:30 now.']],
		notice: ['点 marks the hour; 分 marks minutes.', '半 follows 点: 七点半 is half past seven.'],
		explanation: ['The time phrase generally moves from hour to minute.', '两点 is normally used for two o’clock rather than 二点.'],
		vocabulary: [['现在', 'xiànzài', 'now'], ['点', 'diǎn', 'o’clock'], ['分', 'fēn', 'minute'], ['半', 'bàn', 'half']],
		choice: { prompt: 'What time is 七点半?', options: [['730', '7:30'], ['715', '7:15'], ['630', '6:30']], answer: '730', rationale: '半 means half an hour after the stated hour.' },
		arrange: { prompt: 'Build “It is 7:30 now.”', tiles: ['七点', '现在', '半', '是'], answer: ['现在', '七点', '半'], translation: 'It is 7:30 now.', rationale: 'The time expression does not require 是.' },
		production: { mode: 'speak', prompt: 'Ask the time and answer with 7:30 and 9:15.', modelAnswer: '现在几点？七点半。九点十五分。', modelReading: 'Xiànzài jǐ diǎn? Qī diǎn bàn. Jiǔ diǎn shíwǔ fēn.', checklist: ['几点 used in the question', '半 follows 点', 'Minutes follow the hour'] },
		transferPrompt: 'State 2:00, 6:20, and 10:30 without using English word order.', transferSupport: '两点；六点二十分；十点半。'
	}),
	lesson({
		id: 'zh-12-routine', unitId: 'mandarin-daily', title: 'Daily routine', shortTitle: 'Daily routine',
		canDo: 'Describe when one routine action happens with a time phrase before the verb.',
		focus: ['time + verb', '每天', '起床', '吃饭'],
		scenario: [['林娜', '我每天七点起床。', 'Wǒ měitiān qī diǎn qǐchuáng.', 'I get up at seven every day.'], ['王明', '我八点吃早饭。', 'Wǒ bā diǎn chī zǎofàn.', 'I eat breakfast at eight.']],
		notice: ['A time phrase normally appears before the verb.', '每天 establishes frequency and can precede a more specific clock time.'],
		explanation: ['Chinese verbs do not conjugate for person. Word order and time expressions carry much of the temporal information.', 'Do not insert 在 before a simple clock time in this pattern.'],
		vocabulary: [['每天', 'měitiān', 'every day'], ['起床', 'qǐchuáng', 'get up'], ['吃', 'chī', 'eat'], ['早饭', 'zǎofàn', 'breakfast']],
		choice: { prompt: 'Where does 七点 normally appear in 我七点起床?', options: [['before-verb', 'Before 起床'], ['after-verb', 'After 起床'], ['sentence-end', 'Only at sentence end']], answer: 'before-verb', rationale: 'The time phrase normally precedes the verb.' },
		arrange: { prompt: 'Build “I get up at seven every day.”', tiles: ['起床', '七点', '每天', '我'], answer: ['我', '每天', '七点', '起床'], translation: 'I get up at seven every day.', rationale: 'The order is subject + frequency + time + verb.' },
		production: { mode: 'speak', prompt: 'Describe when you get up and when you eat breakfast.', modelAnswer: '我每天七点起床，八点吃早饭。', modelReading: 'Wǒ měitiān qī diǎn qǐchuáng, bā diǎn chī zǎofàn.', checklist: ['Time precedes each verb', 'Two routine actions included', 'Verbs are not conjugated'] },
		transferPrompt: 'Describe two different routine actions with new times and no English time prepositions.', transferSupport: '我…点…；我…点…。'
	}),
	lesson({
		id: 'zh-13-frequency-negation', unitId: 'mandarin-daily', title: 'Frequency and negation', shortTitle: 'Frequency and negation',
		canDo: 'State how often an activity happens and negate a habitual action with 不.',
		focus: ['常常', '有时候', '不常', 'frequency before verb'],
		scenario: [['王明', '我常常喝茶。', 'Wǒ chángcháng hē chá.', 'I often drink tea.'], ['林娜', '我不常喝咖啡。', 'Wǒ bù cháng hē kāfēi.', 'I do not often drink coffee.']],
		notice: ['Frequency expressions normally appear before the verb.', '不 negates a habitual or general action; 没 is used for different negative contexts.'],
		explanation: ['不常 means “not often,” while 从不 means “never.”', 'The scope changes with placement: 不常喝 means drinking is not frequent.'],
		vocabulary: [['常常', 'chángcháng', 'often'], ['有时候', 'yǒushíhou', 'sometimes'], ['不', 'bù', 'not'], ['咖啡', 'kāfēi', 'coffee']],
		choice: { prompt: 'Which sentence means “I do not often drink coffee”?', options: [['not-often', '我不常喝咖啡。'], ['often', '我常常喝咖啡。'], ['not-coffee', '我不咖啡。']], answer: 'not-often', rationale: '不常 precedes the verb 喝.' },
		arrange: { prompt: 'Build “I sometimes drink tea.”', tiles: ['喝', '我', '茶', '有时候'], answer: ['我', '有时候', '喝', '茶'], translation: 'I sometimes drink tea.', rationale: 'The frequency phrase precedes the verb.' },
		production: { mode: 'speak', prompt: 'State one activity you often do and one you do not often do.', modelAnswer: '我常常喝茶。我不常喝咖啡。', modelReading: 'Wǒ chángcháng hē chá. Wǒ bù cháng hē kāfēi.', checklist: ['Frequency phrase before verb', '不 placed before 常', 'Two contrasting habits stated'] },
		transferPrompt: 'Describe three activities using 常常, 有时候, and 不常 exactly once each.', transferSupport: '我常常…；我有时候…；我不常…。'
	}),
	lesson({
		id: 'zh-14-schedule-mission', unitId: 'mandarin-daily', title: 'Mission: arrange a time', shortTitle: 'Arrange a time', kind: 'mission', durationMinutes: 18,
		canDo: 'Propose a day and time, respond to availability, and confirm the arrangement.',
		focus: ['星期…可以吗', '有时间', '那…见', 'confirmation'],
		scenario: [['林娜', '星期六下午三点可以吗？', 'Xīngqīliù xiàwǔ sān diǎn kěyǐ ma?', 'Is Saturday at 3 p.m. okay?'], ['王明', '可以。那星期六见。', 'Kěyǐ. Nà xīngqīliù jiàn.', 'Yes. Then see you Saturday.']],
		notice: ['可以吗 asks whether a proposal is acceptable.', '那 introduces the resulting plan: “then; in that case.”'],
		explanation: ['Chinese time expressions move from larger units to smaller ones: weekday, part of day, hour.', 'A final confirmation should repeat enough information to prevent ambiguity.'],
		vocabulary: [['可以', 'kěyǐ', 'may; be okay'], ['下午', 'xiàwǔ', 'afternoon'], ['有时间', 'yǒu shíjiān', 'have time'], ['见', 'jiàn', 'see; meet']],
		choice: { prompt: 'Which order follows the normal large-to-small time sequence?', options: [['right', '星期六下午三点'], ['reverse', '三点下午星期六'], ['mixed', '下午星期六三点']], answer: 'right', rationale: 'Weekday precedes part of day, which precedes the hour.' },
		arrange: { prompt: 'Build “Is Saturday at three okay?”', tiles: ['三点', '星期六', '吗', '可以'], answer: ['星期六', '三点', '可以', '吗'], translation: 'Is Saturday at three okay?', rationale: 'The time phrase comes first, followed by 可以吗.' },
		production: { mode: 'speak', prompt: 'Propose a day and time, accept or reject it, and confirm the final plan.', modelAnswer: '星期六下午三点可以吗？可以。那星期六下午三点见。', modelReading: 'Xīngqīliù xiàwǔ sān diǎn kěyǐ ma? Kěyǐ. Nà xīngqīliù xiàwǔ sān diǎn jiàn.', checklist: ['Proposal includes day and time', 'Availability response is explicit', 'Final confirmation repeats the agreed time'] },
		transferPrompt: 'Negotiate a different time after rejecting the first proposal, then confirm the replacement.', transferSupport: '…可以吗？不可以。…可以吗？可以。'
	}),
	lesson({
		id: 'zh-15-measure-words', unitId: 'mandarin-food-places', title: 'Quantities and measure words', shortTitle: 'Measure words',
		canDo: 'Use common number–measure word–noun phrases for drinks, bowls, and general objects.',
		focus: ['number + measure + noun', '个', '杯', '碗'],
		scenario: [['林娜', '一杯茶，两碗米饭。', 'Yì bēi chá, liǎng wǎn mǐfàn.', 'One cup of tea and two bowls of rice.'], ['店员', '好的。', 'Hǎo de.', 'Okay.']],
		notice: ['A measure word normally appears between a number and a noun.', '两 commonly replaces 二 before measure words.'],
		explanation: ['个 is a common general measure word, but many nouns have conventional classifiers.', 'Use 杯 for cupfuls and 碗 for bowlfuls in this lesson.'],
		vocabulary: [['个', 'gè', 'general measure word'], ['杯', 'bēi', 'cup; measure word'], ['碗', 'wǎn', 'bowl; measure word'], ['米饭', 'mǐfàn', 'cooked rice']],
		choice: { prompt: 'Which phrase means “two cups of tea”?', options: [['correct', '两杯茶'], ['no-measure', '二茶'], ['wrong-order', '茶两杯']], answer: 'correct', rationale: 'The normal order is number + measure word + noun.' },
		arrange: { prompt: 'Build “one cup of tea.”', tiles: ['茶', '一', '杯', '个'], answer: ['一', '杯', '茶'], translation: 'one cup of tea', rationale: '杯 classifies the cupful before 茶.' },
		production: { mode: 'speak', prompt: 'Request one cup of tea and two bowls of rice as noun phrases.', modelAnswer: '一杯茶，两碗米饭。', modelReading: 'Yì bēi chá, liǎng wǎn mǐfàn.', checklist: ['Measure word after each number', '两 used before 碗', 'Noun follows the measure word'] },
		transferPrompt: 'Create three new quantity phrases using 个, 杯, and 碗 with suitable nouns.', transferSupport: '一个…；一杯…；两碗…。'
	}),
	lesson({
		id: 'zh-16-ordering', unitId: 'mandarin-food-places', title: 'Ordering food and drink', shortTitle: 'Ordering',
		canDo: 'Place a simple order and acknowledge the server’s confirmation.',
		focus: ['我要…', '请给我…', '好的'],
		scenario: [['顾客', '请给我一杯茶和一碗面。', 'Qǐng gěi wǒ yì bēi chá hé yì wǎn miàn.', 'Please give me one tea and one bowl of noodles.'], ['店员', '好的。', 'Hǎo de.', 'Okay.']],
		notice: ['请给我… is a direct polite request in a service context.', '和 links noun items in the order.'],
		explanation: ['我要… states what you want; 请给我… frames the same content as a request.', 'Keep each number–measure–noun group intact.'],
		vocabulary: [['请', 'qǐng', 'please'], ['给', 'gěi', 'give; for'], ['面', 'miàn', 'noodles'], ['和', 'hé', 'and']],
		choice: { prompt: 'Which opening explicitly marks a polite request?', options: [['please', '请给我…'], ['want', '我要…'], ['identity', '我是…']], answer: 'please', rationale: '请 explicitly marks the request as polite.' },
		arrange: { prompt: 'Build “Please give me one cup of tea.”', tiles: ['一杯茶', '给', '请', '我'], answer: ['请', '给', '我', '一杯茶'], translation: 'Please give me one cup of tea.', rationale: 'The request frame is 请 + 给 + recipient + item.' },
		production: { mode: 'speak', prompt: 'Order one drink and one food item with appropriate measure words.', modelAnswer: '请给我一杯茶和一碗面。', modelReading: 'Qǐng gěi wǒ yì bēi chá hé yì wǎn miàn.', checklist: ['Request begins with 请给我', 'Both items have measure words', '和 links the two items'] },
		transferPrompt: 'Place a new two-item order and respond when one requested item is unavailable.', transferSupport: '请给我…和…。没有…吗？'
	}),
	lesson({
		id: 'zh-17-prices', unitId: 'mandarin-food-places', title: 'Prices and payment', shortTitle: 'Prices',
		canDo: 'Ask a price, understand a whole-yuan answer, and confirm the total.',
		focus: ['多少钱', '块', '一共', 'price numbers'],
		scenario: [['顾客', '这个多少钱？', 'Zhège duōshao qián?', 'How much is this?'], ['店员', '二十八块。一共四十块。', 'Èrshíbā kuài. Yígòng sìshí kuài.', 'Twenty-eight yuan. Forty yuan in total.']],
		notice: ['多少钱 asks “how much money.”', '块 is a common spoken unit corresponding to one yuan.'],
		explanation: ['一共 introduces the total across multiple items.', 'Prices retain the same tens-and-units number structure learned for age.'],
		vocabulary: [['多少', 'duōshao', 'how many; how much'], ['钱', 'qián', 'money'], ['块', 'kuài', 'yuan; colloquial money unit'], ['一共', 'yígòng', 'altogether']],
		choice: { prompt: 'What does 一共四十块 state?', options: [['total', 'The total is forty yuan'], ['single', 'One item is fourteen yuan'], ['time', 'It is 4:00']], answer: 'total', rationale: '一共 marks the total amount.' },
		arrange: { prompt: 'Build “How much is this?”', tiles: ['多少钱', '这个', '吗', '是'], answer: ['这个', '多少钱'], translation: 'How much is this?', rationale: '多少钱 functions directly as the price predicate.' },
		production: { mode: 'speak', prompt: 'Ask the price of one item and confirm a total of forty yuan.', modelAnswer: '这个多少钱？二十八块。一共四十块，对吗？', modelReading: 'Zhège duōshao qián? Èrshíbā kuài. Yígòng sìshí kuài, duì ma?', checklist: ['Price question uses 多少钱', 'Amount ends with 块', 'Total introduced with 一共'] },
		transferPrompt: 'Ask and answer prices of 16, 35, and 72 yuan, then state a combined total.', transferSupport: '这个多少钱？…块。一共…块。'
	}),
	lesson({
		id: 'zh-18-location', unitId: 'mandarin-food-places', title: 'Asking where a place is', shortTitle: 'Location',
		canDo: 'Ask where a place is and understand a simple location relative to another place.',
		focus: ['在哪儿', '在', '旁边', '前面'],
		scenario: [['林娜', '洗手间在哪儿？', 'Xǐshǒujiān zài nǎr?', 'Where is the restroom?'], ['店员', '在餐厅旁边。', 'Zài cāntīng pángbiān.', 'It is beside the restaurant.']],
		notice: ['在 introduces location; 哪儿 asks for an unknown place.', 'Relative-location words follow the reference place: 餐厅旁边.'],
		explanation: ['The full pattern is subject + 在 + place. The subject may be omitted when obvious.', '边 expressions locate something relative to a known landmark.'],
		vocabulary: [['洗手间', 'xǐshǒujiān', 'restroom'], ['哪儿', 'nǎr', 'where'], ['餐厅', 'cāntīng', 'restaurant'], ['旁边', 'pángbiān', 'beside']],
		choice: { prompt: 'What relationship does 旁边 express?', options: [['beside', 'Beside; next to'], ['inside', 'Inside'], ['behind', 'Behind']], answer: 'beside', rationale: '旁边 means beside or next to.' },
		arrange: { prompt: 'Build “Where is the restroom?”', tiles: ['在哪儿', '洗手间', '吗', '是'], answer: ['洗手间', '在哪儿'], translation: 'Where is the restroom?', rationale: 'The unknown location is expressed with 在哪儿.' },
		production: { mode: 'speak', prompt: 'Ask for the restroom and give a location beside the restaurant.', modelAnswer: '洗手间在哪儿？在餐厅旁边。', modelReading: 'Xǐshǒujiān zài nǎr? Zài cāntīng pángbiān.', checklist: ['Question uses 在哪儿', 'Answer begins with 在', 'Reference place precedes 旁边'] },
		transferPrompt: 'Ask for a station, shop, or school and answer using 前面 or 旁边.', transferSupport: '…在哪儿？在…前面／旁边。'
	}),
	lesson({
		id: 'zh-19-service-mission', unitId: 'mandarin-food-places', title: 'Mission: order and ask for a location', shortTitle: 'Service exchange', kind: 'mission', durationMinutes: 20,
		canDo: 'Complete a service exchange with an order, price confirmation, and location question.',
		focus: ['integrated order', 'total confirmation', 'location repair'],
		scenario: [['顾客', '请给我一杯茶和一碗面。一共多少钱？', 'Qǐng gěi wǒ yì bēi chá hé yì wǎn miàn. Yígòng duōshao qián?', 'Please give me one tea and one bowl of noodles. How much is it altogether?'], ['店员', '一共三十五块。洗手间在门旁边。', 'Yígòng sānshíwǔ kuài. Xǐshǒujiān zài mén pángbiān.', 'Thirty-five yuan total. The restroom is beside the door.']],
		notice: ['The total question can omit an already established subject.', 'A location answer should repeat the landmark if the setting is noisy or ambiguous.'],
		explanation: ['This mission combines quantity, request, price, and location patterns.', 'Closed checks verify form; the final task remains a self-assessed communicative response.'],
		vocabulary: [['门', 'mén', 'door'], ['一共', 'yígòng', 'altogether'], ['还要', 'hái yào', 'also want'], ['谢谢', 'xièxie', 'thank you']],
		choice: { prompt: 'Which question asks for the total price?', options: [['total', '一共多少钱？'], ['location', '洗手间在哪儿？'], ['identity', '你是谁？']], answer: 'total', rationale: '一共多少钱 asks how much everything costs together.' },
		arrange: { prompt: 'Build “The restroom is beside the door.”', tiles: ['门', '在', '洗手间', '旁边'], answer: ['洗手间', '在', '门', '旁边'], translation: 'The restroom is beside the door.', rationale: 'The reference place 门 precedes 旁边.' },
		production: { mode: 'speak', prompt: 'Order two items, ask the total, then ask where the restroom is.', modelAnswer: '请给我一杯茶和一碗面。一共多少钱？洗手间在哪儿？', modelReading: 'Qǐng gěi wǒ yì bēi chá hé yì wǎn miàn. Yígòng duōshao qián? Xǐshǒujiān zài nǎr?', checklist: ['Two quantified items ordered', 'Total requested with 一共多少钱', 'Location requested with 在哪儿', 'Request remains intelligible without reading support'] },
		transferPrompt: 'Repeat the exchange with different items, a different total, and a different destination.', transferSupport: '请给我…；一共多少钱？…在哪儿？'
	}),
	lesson({
		id: 'zh-20-family-photo', unitId: 'mandarin-family-home', title: 'Identifying family members', shortTitle: 'Family photo',
		canDo: 'Identify one person in a family photo and state that person’s relationship to you.',
		focus: ['这是谁', '我 + family noun', '他／她'],
		scenario: [['王明', '这是谁？', 'Zhè shì shéi?', 'Who is this?'], ['林娜', '这是我姐姐。她在上海工作。', 'Zhè shì wǒ jiějie. Tā zài Shànghǎi gōngzuò.', 'This is my older sister. She works in Shanghai.']],
		notice: ['谁 asks for a person’s identity; 这 refers to the person shown in the photo.', '的 is commonly omitted between a pronoun and a close family relationship: 我姐姐.'],
		explanation: ['这是… identifies the person. In careful or contrastive speech, 我的姐姐 is also possible.', 'The location phrase 在上海 precedes the action verb 工作 in this example.'],
		vocabulary: [['谁', 'shéi', 'who'], ['姐姐', 'jiějie', 'older sister'], ['她', 'tā', 'she; her'], ['工作', 'gōngzuò', 'work']],
		choice: { prompt: 'What information does 这是谁 request?', options: [['person', 'The person’s identity'], ['place', 'The person’s location'], ['age', 'The person’s age']], answer: 'person', rationale: '谁 means “who” and asks for a person’s identity.' },
		reviewChoices: [{ prompt: 'Which phrase naturally identifies your own older sister?', options: [['sister', '我姐姐'], ['teacher', '我老师'], ['younger', '我妹妹']], answer: 'sister', rationale: '我姐姐 means “my older sister”; 的 is commonly omitted with close kinship terms.' }],
		arrange: { prompt: 'Build “This is my older sister.”', tiles: ['我姐姐', '这', '谁', '是'], answer: ['这', '是', '我姐姐'], translation: 'This is my older sister.', rationale: '这 is the subject, 是 identifies, and 我姐姐 supplies the relationship.' },
		production: { mode: 'speak', prompt: 'Identify one person in a photo and say where that person works or lives.', modelAnswer: '这是我姐姐。她在上海工作。', modelReading: 'Zhè shì wǒ jiějie. Tā zài Shànghǎi gōngzuò.', checklist: ['Identification begins with 这是', 'Relationship follows 我', 'Location precedes the activity verb'] },
		transferPrompt: 'Identify a different family member and replace Shanghai and work with new information.', transferSupport: '这是我…。他／她在…工作／住。'
	}),
	lesson({
		id: 'zh-21-family-existence', unitId: 'mandarin-family-home', title: 'Saying who is in your family', shortTitle: 'Who is in the family',
		canDo: 'Ask whether someone has siblings and give a positive or negative counted answer.',
		focus: ['有／没有', '兄弟姐妹', 'number + 个 + person'],
		scenario: [['林娜', '你有兄弟姐妹吗？', 'Nǐ yǒu xiōngdì jiěmèi ma?', 'Do you have any siblings?'], ['王明', '我有一个妹妹。', 'Wǒ yǒu yí ge mèimei.', 'I have one younger sister.']],
		notice: ['有 expresses possession or existence. Its negative form is 没有, not 不有.', '个 appears between the number and 妹妹 in the counted answer.'],
		explanation: ['The subject comes before 有: 我有… means “I have…”. A yes–no question can add 吗 without changing the internal order.', '一 is written with first tone in citation form but is normally pronounced with second tone before fourth-tone 个.'],
		vocabulary: [['有', 'yǒu', 'have; exist'], ['没有', 'méiyǒu', 'not have; not exist'], ['兄弟姐妹', 'xiōngdì jiěmèi', 'siblings'], ['妹妹', 'mèimei', 'younger sister']],
		choice: { prompt: 'Which form means “do not have”?', options: [['meiyou', '没有'], ['buyou', '不有'], ['bushi', '不是']], answer: 'meiyou', rationale: '没有 is the standard negative of 有.' },
		reviewChoices: [{ prompt: 'Which sentence says “I have one younger sister”?', options: [['one', '我有一个妹妹。'], ['no-classifier', '我有一妹妹。'], ['negative', '我没有妹妹。']], answer: 'one', rationale: 'The counted noun phrase uses 一 + 个 + 妹妹 after 有.' }],
		arrange: { prompt: 'Build “I have one younger sister.”', tiles: ['一个', '我', '有', '妹妹'], answer: ['我', '有', '一个', '妹妹'], translation: 'I have one younger sister.', rationale: 'The order is possessor + 有 + number–measure phrase + noun.' },
		production: { mode: 'speak', prompt: 'Ask about siblings and answer positively or negatively with one detail.', modelAnswer: '你有兄弟姐妹吗？我有一个妹妹。', modelReading: 'Nǐ yǒu xiōngdì jiěmèi ma? Wǒ yǒu yí ge mèimei.', checklist: ['Question uses 有…吗', 'Negative answer uses 没有 when needed', 'Counted person includes 个'] },
		transferPrompt: 'Give a new answer with no siblings or with a different number and relationship.', transferSupport: '我没有兄弟姐妹。／我有…个…。'
	}),
	lesson({
		id: 'zh-22-home-rooms', unitId: 'mandarin-family-home', title: 'Rooms and location at home', shortTitle: 'Rooms at home',
		canDo: 'Ask how many rooms a home has and locate a person, animal, or object inside it.',
		focus: ['你家有几个…', '在 + place + 里', '几 + measure word'],
		scenario: [['王明', '你家有几个房间？', 'Nǐ jiā yǒu jǐ ge fángjiān?', 'How many rooms does your home have?'], ['林娜', '有三个。猫在客厅里。', 'Yǒu sān ge. Māo zài kètīng li.', 'It has three. The cat is in the living room.']],
		notice: ['几 comes before the measure word 个 when asking for an expected small number.', 'The location pattern is subject + 在 + place; 里 specifies the inside of the room.'],
		explanation: ['The answer can omit 房间 because the question already establishes what is being counted.', '在 expresses where people, animals, and objects are located; Mandarin does not require separate animate and inanimate existence verbs.'],
		vocabulary: [['家', 'jiā', 'home; family'], ['房间', 'fángjiān', 'room'], ['几个', 'jǐ ge', 'how many'], ['猫', 'māo', 'cat'], ['客厅', 'kètīng', 'living room']],
		choice: { prompt: 'How many rooms are in the example home?', options: [['three', 'Three'], ['one', 'One'], ['five', 'Five']], answer: 'three', rationale: '有三个 states that there are three.' },
		reviewChoices: [{ prompt: 'Which sentence correctly puts the cat in the living room?', options: [['location', '猫在客厅里。'], ['reversed', '客厅在猫里。'], ['identity', '猫是客厅。']], answer: 'location', rationale: 'The located subject comes before 在, followed by 客厅里.' }],
		arrange: { prompt: 'Build “The cat is in the living room.”', tiles: ['猫', '客厅里', '有', '在'], answer: ['猫', '在', '客厅里'], translation: 'The cat is in the living room.', rationale: 'The location pattern is subject + 在 + place.' },
		production: { mode: 'speak', prompt: 'State how many rooms a home has and locate one person, animal, or object.', modelAnswer: '我家有三个房间。猫在客厅里。', modelReading: 'Wǒ jiā yǒu sān ge fángjiān. Māo zài kètīng li.', checklist: ['Room count uses 个', 'Location uses 在', 'Place follows 在'] },
		transferPrompt: 'Change the room count and locate a different person or object in another room.', transferSupport: '我家有…个房间。…在…里。'
	}),
	lesson({
		id: 'zh-23-family-home-mission', unitId: 'mandarin-family-home', title: 'Mission: describe a family and home', shortTitle: 'Family and home mission', kind: 'mission', durationMinutes: 20,
		canDo: 'Give a short connected description of family size, relationships, residence, and one home location.',
		focus: ['几口人', '父母', '住在', '家里有…'],
		scenario: [['林娜', '你家有几口人？', 'Nǐ jiā yǒu jǐ kǒu rén?', 'How many people are in your family?'], ['王明', '我家有四口人：我父母、我姐姐和我。我们住在北京。家里有一只猫。', 'Wǒ jiā yǒu sì kǒu rén: wǒ fùmǔ, wǒ jiějie hé wǒ. Wǒmen zhù zài Běijīng. Jiā li yǒu yì zhī māo.', 'There are four people in my family: my parents, my older sister, and me. We live in Beijing. There is a cat at home.']],
		notice: ['口 is a conventional measure word for members of a household; 个 is not used in this fixed family-count question.', '住在 places the location after the verb, while 家里有 introduces what exists at home.'],
		explanation: ['A connected description can move from family count to relationships, residence, and a home detail without repeating every noun.', '只 is a common measure word for many animals, including cats in this context.'],
		vocabulary: [['口', 'kǒu', 'measure word for household members'], ['父母', 'fùmǔ', 'parents'], ['我们', 'wǒmen', 'we; us'], ['住', 'zhù', 'live; reside'], ['只', 'zhī', 'measure word for many animals']],
		choice: { prompt: 'How many people are in Wang Ming’s family description?', options: [['four', 'Four'], ['three', 'Three'], ['five', 'Five']], answer: 'four', rationale: '我家有四口人 gives the family count as four.' },
		reviewChoices: [{ prompt: 'Which phrase correctly states “We live in Beijing”?', options: [['live', '我们住在北京。'], ['reversed', '我们在住北京。'], ['exist', '我们有北京。']], answer: 'live', rationale: '住在 is followed by the place of residence.' }],
		arrange: { prompt: 'Build “There is a cat at home.”', tiles: ['一只猫', '有', '家里', '在'], answer: ['家里', '有', '一只猫'], translation: 'There is a cat at home.', rationale: 'The location frame comes first, followed by 有 and the existing noun phrase.' },
		production: { mode: 'speak', prompt: 'Describe a real or invented family and home in at least four connected statements.', modelAnswer: '我家有四口人。我有一个姐姐。我们住在北京。我家有三个房间。', modelReading: 'Wǒ jiā yǒu sì kǒu rén. Wǒ yǒu yí ge jiějie. Wǒmen zhù zài Běijīng. Wǒ jiā yǒu sān ge fángjiān.', checklist: ['Family count uses 口', 'At least one relationship is named', 'Residence uses 住在', 'One home detail uses 有 or 在'] },
		transferPrompt: 'Repeat the description with a different family size, city, room count, and home-location detail.', transferSupport: '我家有…口人。我有…。我们住在…。家里有…。'
	}),
	lesson({
		id: 'zh-24-likes', unitId: 'mandarin-leisure-weather', title: 'Talking about things you like', shortTitle: 'Likes and interests',
		canDo: 'Ask what someone likes doing and give one specific preference.',
		focus: ['喜欢 + noun or verb phrase', '做什么', 'question and answer'],
		scenario: [['林娜', '你喜欢做什么？', 'Nǐ xǐhuan zuò shénme?', 'What do you like doing?'], ['王明', '我喜欢看电影。', 'Wǒ xǐhuan kàn diànyǐng.', 'I like watching movies.']],
		notice: ['喜欢 comes before the thing or activity that is liked.', '什么 occupies the object position after 做 in the question.'],
		explanation: ['喜欢 can take a noun or a verb phrase without an added infinitive marker.', 'Replace 看电影 with a familiar activity to make a new answer.'],
		vocabulary: [['喜欢', 'xǐhuan', 'like'], ['做', 'zuò', 'do'], ['什么', 'shénme', 'what'], ['看电影', 'kàn diànyǐng', 'watch a movie']],
		choice: { prompt: 'Which sentence says “I like watching movies”?', options: [['like', '我喜欢看电影。'], ['watch', '我看喜欢电影。'], ['question', '我喜欢什么？']], answer: 'like', rationale: '喜欢 precedes the activity 看电影.' },
		arrange: { prompt: 'Build “I like watching movies.”', tiles: ['我', '喜欢', '看电影', '什么'], answer: ['我', '喜欢', '看电影'], translation: 'I like watching movies.', rationale: 'The order is subject + 喜欢 + activity.' },
		production: { mode: 'speak', prompt: 'Ask what someone likes doing and answer with a different activity.', modelAnswer: '你喜欢做什么？我喜欢听音乐。', modelReading: 'Nǐ xǐhuan zuò shénme? Wǒ xǐhuan tīng yīnyuè.', checklist: ['Question uses 做什么', 'Answer places 喜欢 before the activity', 'Activity is specific'] },
		transferPrompt: 'Replace the movie activity with a different interest and ask a new person the same question.', transferSupport: '你喜欢做什么？我喜欢…。'
	}),
	lesson({
		id: 'zh-25-weather', unitId: 'mandarin-leisure-weather', title: 'Describing today’s weather', shortTitle: 'Today’s weather',
		canDo: 'Ask about today’s weather and give a short description with two details.',
		focus: ['天气怎么样', '很 + adjective', 'adjective predicate'],
		scenario: [['王明', '今天天气怎么样？', 'Jīntiān tiānqì zěnmeyàng?', 'How is the weather today?'], ['林娜', '很暖和，也很晴朗。', 'Hěn nuǎnhuo, yě hěn qínglǎng.', 'It is warm and also clear.']],
		notice: ['怎么样 asks for a description of the weather.', 'A Mandarin adjective can serve as the predicate without 是; 很 commonly appears before it in a neutral description.'],
		explanation: ['Do not insert 是 before 暖和 in this pattern. The adjective itself describes the subject.', '也 adds a second parallel description and appears before the second adjective phrase.'],
		vocabulary: [['今天', 'jīntiān', 'today'], ['天气', 'tiānqì', 'weather'], ['暖和', 'nuǎnhuo', 'warm'], ['晴朗', 'qínglǎng', 'clear; sunny']],
		choice: { prompt: 'Which sentence naturally says “It is warm”?', options: [['warm', '天气很暖和。'], ['copula', '天气是暖和。'], ['object', '天气有暖和。']], answer: 'warm', rationale: 'The adjective phrase 很暖和 acts as the predicate without 是.' },
		arrange: { prompt: 'Build “The weather is very warm today.”', tiles: ['今天', '天气', '很暖和', '是'], answer: ['今天', '天气', '很暖和'], translation: 'The weather is very warm today.', rationale: 'The time and topic come before the adjective predicate.' },
		production: { mode: 'speak', prompt: 'Ask about the weather and answer with two conditions.', modelAnswer: '今天天气怎么样？很冷，也有风。', modelReading: 'Jīntiān tiānqì zěnmeyàng? Hěn lěng, yě yǒu fēng.', checklist: ['Question ends in 怎么样', 'Answer omits 是 before an adjective', 'Two weather details are given'] },
		transferPrompt: 'Change both weather details and the day while keeping the question and description complete.', transferSupport: '…天气怎么样？很…，也…。'
	}),
	lesson({
		id: 'zh-26-weekend-past', unitId: 'mandarin-leisure-weather', title: 'Reporting a completed weekend activity', shortTitle: 'What you did',
		canDo: 'Ask what someone did over the weekend and report one completed activity.',
		focus: ['做什么了', 'completed-action 了', 'time frame'],
		scenario: [['林娜', '周末你做什么了？', 'Zhōumò nǐ zuò shénme le?', 'What did you do over the weekend?'], ['王明', '我去公园散步了。', 'Wǒ qù gōngyuán sànbù le.', 'I went for a walk in the park.']],
		notice: ['Sentence-final 了 presents the weekend activity as a completed event in this exchange.', 'The destination 公园 follows 去, and the activity 散步 completes the event description.'],
		explanation: ['了 does not encode past time by itself in every sentence. Here, 周末 supplies the time frame and 了 marks a completed change or event.', 'A new answer can replace the destination and activity while keeping the completed-event frame.'],
		vocabulary: [['周末', 'zhōumò', 'weekend'], ['公园', 'gōngyuán', 'park'], ['散步', 'sànbù', 'take a walk'], ['了', 'le', 'completed-event particle in this pattern']],
		choice: { prompt: 'Which line reports a completed weekend activity?', options: [['completed', '我去公园散步了。'], ['habit', '我每天去公园。'], ['future', '我明天去公园。']], answer: 'completed', rationale: 'The weekend context and final 了 present the walk as completed.' },
		arrange: { prompt: 'Build “I went for a walk in the park.”', tiles: ['我', '去公园', '散步了', '喜欢'], answer: ['我', '去公园', '散步了'], translation: 'I went for a walk in the park.', rationale: 'The destination and activity follow the subject, with 了 completing the event.' },
		production: { mode: 'speak', prompt: 'Ask about the weekend and answer with one completed activity.', modelAnswer: '周末你做什么了？我看电影了。', modelReading: 'Zhōumò nǐ zuò shénme le? Wǒ kàn diànyǐng le.', checklist: ['Question includes the weekend frame', 'Answer names a completed activity', '了 appears in the completed-event pattern'] },
		transferPrompt: 'Replace the park walk with a different completed activity and a different past time expression.', transferSupport: '…你做什么了？我…了。'
	}),
	lesson({
		id: 'zh-27-weekend-mission', unitId: 'mandarin-leisure-weather', title: 'Mission: make a weather-aware plan', shortTitle: 'Weekend plan', kind: 'mission', durationMinutes: 20,
		canDo: 'Use a forecast to suggest an activity, accept it, and confirm a meeting time.',
		focus: ['明天天气很好', '一起…吧', '几点见'],
		scenario: [['王明', '明天天气很好。我们一起去公园吧。', 'Míngtiān tiānqì hěn hǎo. Wǒmen yìqǐ qù gōngyuán ba.', 'The weather will be good tomorrow. Let’s go to the park together.'], ['林娜', '好啊。我们几点见？三点见。', 'Hǎo a. Wǒmen jǐ diǎn jiàn? Sān diǎn jiàn.', 'Sure. What time shall we meet? Let’s meet at three.']],
		notice: ['吧 softens the statement into a suggestion for shared action.', '几点 asks for the meeting time; the reply can omit the already established subject.'],
		explanation: ['The weather statement gives a practical reason for the suggestion.', 'An accepted suggestion should be followed by a concrete time or place so the plan is complete.'],
		vocabulary: [['明天', 'míngtiān', 'tomorrow'], ['一起', 'yìqǐ', 'together'], ['吧', 'ba', 'suggestion particle'], ['见', 'jiàn', 'meet; see']],
		choice: { prompt: 'Which line makes the suggestion?', options: [['suggest', '我们一起去公园吧。'], ['weather', '明天天气很好。'], ['time', '我们几点见？']], answer: 'suggest', rationale: '一起…吧 proposes a shared activity.' },
		arrange: { prompt: 'Build “Let’s go to the park together.”', tiles: ['我们', '一起', '去公园', '吧', '了'], answer: ['我们', '一起', '去公园', '吧'], translation: 'Let’s go to the park together.', rationale: 'The shared subject and adverb come before the activity, with 吧 marking the suggestion.' },
		production: { mode: 'speak', prompt: 'State the weather, suggest an activity, then accept and set a time.', modelAnswer: '明天天气很好。我们一起去公园吧。好啊。三点见。', modelReading: 'Míngtiān tiānqì hěn hǎo. Wǒmen yìqǐ qù gōngyuán ba. Hǎo a. Sān diǎn jiàn.', checklist: ['Weather supports the activity', 'Suggestion ends in 吧', 'Response accepts or declines', 'Plan includes a specific time'] },
		transferPrompt: 'Change the forecast, activity, and meeting time while keeping the suggestion and confirmation complete.', transferSupport: '明天天气…。我们一起…吧。好啊。…点见。'
	})
].map((item, index) => ({ ...item, sequence: index + 1 }));

const units: CourseUnit[] = [
	{ id: 'mandarin-launchpad', sequence: 0, title: 'Pinyin and sound system', nativeTitle: '拼音和语音', strapline: 'Pinyin initials, finals, tones, and connected-speech changes.', canDo: 'Use Pinyin to decode beginner syllables and preserve contrasts that distinguish words.', mission: 'Read an unfamiliar beginner word from characters plus Pinyin and identify its initial, final, and tone.', lessonIds: lessons.filter((item) => item.unitId === 'mandarin-launchpad').map((item) => item.id) },
	{ id: 'mandarin-introductions', sequence: 1, title: 'Introductions and identity', nativeTitle: '介绍自己', strapline: 'Names, identity, questions, numbers, and a complete first meeting.', canDo: 'Introduce yourself, exchange one personal detail, and return a matching question.', mission: 'Complete a first meeting with a name, identity, age or origin, and one follow-up question.', lessonIds: lessons.filter((item) => item.unitId === 'mandarin-introductions').map((item) => item.id) },
	{ id: 'mandarin-daily', sequence: 2, title: 'Daily routine and time', nativeTitle: '日常和时间', strapline: 'Dates, clock time, routine descriptions, frequency, and scheduling.', canDo: 'Describe a short routine and negotiate a specific day and time.', mission: 'Propose, revise, and confirm a meeting time.', lessonIds: lessons.filter((item) => item.unitId === 'mandarin-daily').map((item) => item.id) },
	{ id: 'mandarin-food-places', sequence: 3, title: 'Food, prices, and places', nativeTitle: '点餐和地点', strapline: 'Measure words, orders, prices, totals, and simple locations.', canDo: 'Order common items, confirm a price, and ask where a place is.', mission: 'Complete an order and obtain one location inside the same service exchange.', lessonIds: lessons.filter((item) => item.unitId === 'mandarin-food-places').map((item) => item.id) },
	{ id: 'mandarin-family-home', sequence: 4, title: 'Family and home', nativeTitle: '家庭和住处', strapline: 'Relationships, possession, household counts, rooms, and locations at home.', canDo: 'Identify family members, state who is in a household, describe a home, and locate a person, animal, or object.', mission: 'Give a connected description of a family and home with accurate measure words and location patterns.', lessonIds: lessons.filter((item) => item.unitId === 'mandarin-family-home').map((item) => item.id) },
	{ id: 'mandarin-leisure-weather', sequence: 5, title: 'Leisure, weather, and plans', nativeTitle: '爱好、天气和计划', strapline: 'Preferences, simple weather, completed activities, and concrete weekend plans.', canDo: 'Discuss an interest, describe the weather, report a completed activity, and make a specific plan.', mission: 'Use the weather to suggest an activity, respond, and confirm when to meet.', lessonIds: lessons.filter((item) => item.unitId === 'mandarin-leisure-weather').map((item) => item.id) }
];

export const mandarinA1Course: LanguageCourse = {
	id: 'mandarin-a1',
	slug: 'mandarin',
	title: 'Mandarin foundations: Pinyin to A1',
	languageName: 'Mandarin',
	nativeName: '普通话',
	glyph: '语',
	language: 'zh',
	htmlLanguage: 'zh-Hans',
	studyLanguage: 'zh',
	speechLanguage: 'zh',
	readingLabel: 'Pinyin',
	level: 'Launchpad–A1',
	description: 'A 28-lesson introductory Mandarin course covering Pinyin, tones, characters, everyday exchanges, family and home descriptions, leisure and weather, retrieval, open production, and transfer checks.',
	designPromise: 'Each lesson connects characters to Pinyin and meaning, checks a constrained target, requires original use, and ends with reduced support.',
	units,
	lessons
};
