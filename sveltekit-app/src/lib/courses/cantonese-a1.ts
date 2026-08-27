import { lesson } from './authoring';
import type { CourseUnit, LanguageCourse, ScriptChart } from './types';

const toneChart: ScriptChart = {
	title: 'Jyutping tone numbers',
	caption: 'Standard Jyutping writes an ASCII tone number at the end of every syllable. The six numbers identify contrastive tone categories.',
	columns: ['1 high', '2 high rising', '3 mid', '4 low falling', '5 low rising', '6 low'],
	rows: [
		{ label: 'si', cells: [
			{ symbol: '詩', romanization: 'si1', note: 'poem' },
			{ symbol: '史', romanization: 'si2', note: 'history' },
			{ symbol: '試', romanization: 'si3', note: 'try' },
			{ symbol: '時', romanization: 'si4', note: 'time' },
			{ symbol: '市', romanization: 'si5', note: 'market; city' },
			{ symbol: '事', romanization: 'si6', note: 'matter' }
		] }
	]
};

const onsetChart: ScriptChart = {
	title: 'Jyutping onsets',
	caption: 'Onsets are written at the beginning of the syllable. Jyutping b/d/g and p/t/k are primarily unaspirated–aspirated pairs.',
	columns: ['onsets', 'contrast', 'examples'],
	rows: [
		{ label: 'lips', cells: [
			{ symbol: 'b p m f', romanization: 'b · p · m · f' },
			{ symbol: 'b / p', romanization: 'aspiration contrast' },
			{ symbol: '杯・跑・問・飯', romanization: 'bui1 · paau2 · man6 · faan6' }
		] },
		{ label: 'tongue', cells: [
			{ symbol: 'd t n l', romanization: 'd · t · n · l' },
			{ symbol: 'd / t', romanization: 'aspiration contrast' },
			{ symbol: '多・睇・你・嚟', romanization: 'do1 · tai2 · nei5 · lai4' }
		] },
		{ label: 'velar', cells: [
			{ symbol: 'g k ng h', romanization: 'g · k · ng · h' },
			{ symbol: 'g / k', romanization: 'aspiration contrast' },
			{ symbol: '家・佢・我・好', romanization: 'gaa1 · keoi5 · ngo5 · hou2' }
		] },
		{ label: 'rounded', cells: [
			{ symbol: 'gw kw w', romanization: 'gw · kw · w' },
			{ symbol: 'gw / kw', romanization: 'aspiration contrast' },
			{ symbol: '廣・葵・話', romanization: 'gwong2 · kwai4 · waa2' }
		] },
		{ label: 'front', cells: [
			{ symbol: 'z c s j', romanization: 'z · c · s · j' },
			{ symbol: 'z / c', romanization: 'aspiration contrast' },
			{ symbol: '早・茶・三・人', romanization: 'zou2 · caa4 · saam1 · jan4' }
		] }
	]
};

const finalChart: ScriptChart = {
	title: 'Common Jyutping finals',
	caption: 'A final contains the vowel nucleus and optional coda. Vowel length and the final consonant can distinguish words.',
	columns: ['open/diphthong', 'nasal coda', 'stop coda'],
	rows: [
		{ label: 'aa', cells: [
			{ symbol: 'aa aai aau', romanization: 'aa · aai · aau' },
			{ symbol: 'aam aan aang', romanization: '-m · -n · -ng' },
			{ symbol: 'aap aat aak', romanization: '-p · -t · -k' }
		] },
		{ label: 'a/e', cells: [
			{ symbol: 'a ai au e ei eu', romanization: 'short a and e groups' },
			{ symbol: 'am an ang em en eng', romanization: 'nasal groups' },
			{ symbol: 'ap at ak ep et ek', romanization: 'stop groups' }
		] },
		{ label: 'i/o/u', cells: [
			{ symbol: 'i iu o oi ou u ui', romanization: 'major vowel groups' },
			{ symbol: 'im in ing on ong un ung', romanization: 'nasal groups' },
			{ symbol: 'ip it ik ot ok ut uk', romanization: 'stop groups' }
		] },
		{ label: 'oe/eo/yu', cells: [
			{ symbol: 'oe eoi yu', romanization: 'rounded/front groups' },
			{ symbol: 'oeng eon yun', romanization: 'nasal groups' },
			{ symbol: 'oek eot yut', romanization: 'stop groups' }
		] }
	]
};

const checkedToneChart: ScriptChart = {
	title: 'Stop codas and checked tones',
	caption: 'Syllables ending in -p, -t, or -k are short and checked. Standard Jyutping still uses tone numbers 1, 3, or 6 rather than separate 7–9 labels.',
	columns: ['-p', '-t', '-k'],
	rows: [
		{ label: 'tone 1', cells: [
			{ symbol: '濕', romanization: 'sap1', note: 'wet' },
			{ symbol: '七', romanization: 'cat1', note: 'seven' },
			{ symbol: '色', romanization: 'sik1', note: 'colour' }
		] },
		{ label: 'tone 3', cells: [
			{ symbol: '夾', romanization: 'gaap3', note: 'clip; press' },
			{ symbol: '八', romanization: 'baat3', note: 'eight' },
			{ symbol: '角', romanization: 'gok3', note: 'corner' }
		] },
		{ label: 'tone 6', cells: [
			{ symbol: '十', romanization: 'sap6', note: 'ten' },
			{ symbol: '日', romanization: 'jat6', note: 'day' },
			{ symbol: '食', romanization: 'sik6', note: 'eat' }
		] }
	]
};

const lessons = [
	lesson({
		id: 'yue-00-jyutping', unitId: 'cantonese-launchpad', title: 'Characters and Jyutping syllables', shortTitle: 'Jyutping structure', kind: 'sound', durationMinutes: 18,
		canDo: 'Interpret a basic Jyutping syllable as onset, final, and tone and connect it to a Traditional Chinese character.',
		focus: ['Traditional characters', 'onset + final + tone', 'ASCII tone numbers', 'colloquial writing'],
		scenario: [['Example', '你好', 'nei5 hou2', 'hello'], ['Example', '我講廣東話。', 'ngo5 gong2 gwong2 dung1 waa2.', 'I speak Cantonese.']],
		notice: ['Jyutping writes an onset, a final, and a tone number, such as n + ei + 5.', 'Cantonese course text uses Traditional Chinese and includes common colloquial characters such as 唔 and 喺.'],
		explanation: ['Jyutping is a pronunciation and input reference; ordinary Cantonese writing is character-based.', 'Tone numbers remain ordinary baseline ASCII digits because superscript formatting reduces legibility and is not part of the LSHK scheme.'],
		scriptCharts: [toneChart],
		vocabulary: [['你', 'nei5', 'you'], ['好', 'hou2', 'good'], ['我', 'ngo5', 'I; me'], ['廣東話', 'gwong2 dung1 waa2', 'Cantonese language']],
		choice: { prompt: 'What information does the 5 encode in nei5?', options: [['tone', 'The tone category'], ['vowel', 'The vowel'], ['character', 'The character shape']], answer: 'tone', rationale: 'The final ASCII digit identifies the Jyutping tone category.' },
		arrange: { prompt: 'Build Jyutping for 你.', tiles: ['n', 'ei', '5', '2'], answer: ['n', 'ei', '5'], translation: 'nei5', rationale: '你 is nei5: onset n, final ei, tone 5.' },
		production: { mode: 'speak', prompt: 'Read nei5 hou2 and ngo5 from Jyutping before looking at the characters.', modelAnswer: '你好。我。', modelReading: 'nei5 hou2. ngo5.', checklist: ['Every written tone number attempted', 'No English word stress substituted for tone', 'Final consonants and vowels remain audible'] },
		transferPrompt: 'Segment gong2, waa2, and dung1 into onset, final, and tone number.', transferSupport: 'g + ong + 2; w + aa + 2; d + ung + 1.'
	}),
	lesson({
		id: 'yue-01-tones', unitId: 'cantonese-launchpad', title: 'Six Jyutping tone categories', shortTitle: 'Six tones', kind: 'sound', durationMinutes: 18,
		canDo: 'Distinguish the six Jyutping tone categories on the same syllable and retain tone numbers while reading.',
		focus: ['tones 1–6', 'level versus contour', 'tone as lexical information'],
		scenario: [['Contrast', '詩・史・試', 'si1 · si2 · si3', 'poem · history · try'], ['Contrast', '時・市・事', 'si4 · si5 · si6', 'time · market/city · matter']],
		notice: ['The six numbers are category labels; they are not a simple low-to-high scale.', 'Tone can distinguish words even when onset and final are identical.'],
		explanation: ['Use a stable reference syllable such as si to compare categories before transferring them to new syllables.', 'Tone 1 is high, 3 is mid, and 6 is low; tones 2, 4, and 5 involve movement. Exact realization varies by speaker and context.'],
		scriptCharts: [toneChart],
		vocabulary: [['詩', 'si1', 'poem'], ['史', 'si2', 'history'], ['時', 'si4', 'time'], ['事', 'si6', 'matter; affair']],
		choice: { prompt: 'Which Jyutping form represents 市 “market; city”?', options: [['si5', 'si5'], ['si2', 'si2'], ['si6', 'si6']], answer: 'si5', rationale: '市 is the tone-5 member of this contrast set.' },
		arrange: { prompt: 'Build Jyutping for 事.', tiles: ['s', 'i', '6', '4'], answer: ['s', 'i', '6'], translation: 'si6', rationale: '事 is si6.' },
		production: { mode: 'speak', prompt: 'Read si1 through si6 in order, then repeat them in reverse order.', modelAnswer: '詩、史、試、時、市、事。', modelReading: 'si1, si2, si3, si4, si5, si6.', checklist: ['Six separate categories attempted', 'Tone number consulted for every syllable', 'Low tones kept distinct from high tones'] },
		transferPrompt: 'Read fu1 through fu6 using the LSHK reference sequence and compare each contour with the si series.', transferSupport: 'fu1 夫, fu2 虎, fu3 副, fu4 扶, fu5 婦, fu6 父.'
	}),
	lesson({
		id: 'yue-02-onsets', unitId: 'cantonese-launchpad', title: 'Jyutping onsets and aspiration', shortTitle: 'Onsets', kind: 'sound', durationMinutes: 17,
		canDo: 'Read the main Jyutping onsets and distinguish the aspirated pairs b/p, d/t, g/k, gw/kw, and z/c.',
		focus: ['aspiration', 'ng onset', 'gw/kw', 'z/c/j'],
		scenario: [['Contrast', '杯／跑', 'bui1 / paau2', 'cup / run'], ['Contrast', '家／佢', 'gaa1 / keoi5', 'home / he or she']],
		notice: ['Jyutping b, d, g, gw, and z are normally unaspirated; p, t, k, kw, and c are aspirated.', 'ng can begin a syllable, as in 我 ngo5. Jyutping j is similar to English y in “yes.”'],
		explanation: ['Test aspiration with a hand in front of the mouth while holding the same final and tone.', 'Do not infer Cantonese articulation from English letter names; use the complete syllable examples.'],
		scriptCharts: [onsetChart],
		vocabulary: [['杯', 'bui1', 'cup'], ['跑', 'paau2', 'run'], ['我', 'ngo5', 'I; me'], ['佢', 'keoi5', 'he; she; they']],
		choice: { prompt: 'Which onset is the aspirated partner of gw?', options: [['kw', 'kw'], ['w', 'w'], ['g', 'g']], answer: 'kw', rationale: 'gw and kw form an unaspirated–aspirated pair.' },
		arrange: { prompt: 'Build Jyutping for 我.', tiles: ['ng', 'o', '5', 'w'], answer: ['ng', 'o', '5'], translation: 'ngo5', rationale: '我 begins with the onset ng.' },
		production: { mode: 'speak', prompt: 'Contrast baa1/paa1, daai6/taai3, gaa1/kaa1, and gwaa1/kwaa1.', modelAnswer: '巴、趴；大、太；家、卡；瓜、誇。', modelReading: 'baa1, paa1; daai6, taai3; gaa1, kaa1; gwaa1, kwaa1.', checklist: ['Stronger air on aspirated members', 'ng treated as one onset', 'gw and kw begin with lip rounding'] },
		transferPrompt: 'Read 你, 我, 佢, 話, and 早 and identify the onset in each Jyutping form.', transferSupport: 'nei5: n; ngo5: ng; keoi5: k; waa2: w; zou2: z.'
	}),
	lesson({
		id: 'yue-03-finals', unitId: 'cantonese-launchpad', title: 'Jyutping finals and vowel length', shortTitle: 'Finals', kind: 'sound', durationMinutes: 18,
		canDo: 'Read common Jyutping finals and preserve vowel-length and nasal-coda contrasts.',
		focus: ['aa versus a', 'diphthongs', '-m/-n/-ng', 'rounded front vowels'],
		scenario: [['Contrast', '三／心', 'saam1 / sam1', 'three / heart'], ['Contrast', '新／星', 'san1 / sing1', 'new / star']],
		notice: ['Jyutping aa and a represent a length/quality contrast that can distinguish words.', 'Final -m, -n, and -ng close the syllable at different places in the mouth.'],
		explanation: ['Read the final as one unit instead of spelling it letter by letter.', 'The finals eo/eoi and oe/oeng require rounded front-vowel articulation and should not collapse into English o.'],
		scriptCharts: [finalChart],
		vocabulary: [['三', 'saam1', 'three'], ['心', 'sam1', 'heart'], ['新', 'san1', 'new'], ['星', 'sing1', 'star']],
		choice: { prompt: 'Which word has the long-aa final?', options: [['saam', '三 saam1'], ['sam', '心 sam1'], ['sing', '星 sing1']], answer: 'saam', rationale: 'The double a in saam1 records the long-aa final.' },
		arrange: { prompt: 'Build Jyutping for 三.', tiles: ['s', 'aa', 'm', '1', 'a'], answer: ['s', 'aa', 'm', '1'], translation: 'saam1', rationale: '三 contains long aa followed by m and tone 1.' },
		production: { mode: 'speak', prompt: 'Contrast saam1/sam1, san1/sang1, and seon3/soeng2.', modelAnswer: '三、心；新、生；信、想。', modelReading: 'saam1, sam1; san1, sang1; seon3, soeng2.', checklist: ['aa kept longer than a', '-n and -ng remain distinct', 'Rounded finals do not become English o'] },
		transferPrompt: 'Read 茶 caa4, 街 gaai1, 好 hou2, and 書 syu1 by treating each final as a single unit.', transferSupport: 'Finals: aa, aai, ou, yu.'
	}),
	lesson({
		id: 'yue-04-stop-codas', unitId: 'cantonese-launchpad', title: 'Stop codas and syllabic nasals', shortTitle: 'Stop codas', kind: 'sound', durationMinutes: 18,
		canDo: 'Read syllables ending in -p, -t, or -k and recognize syllabic m and ng.',
		focus: ['-p/-t/-k', 'checked tones 1/3/6', 'm4', 'ng4'],
		scenario: [['Examples', '濕・八・食', 'sap1 · baat3 · sik6', 'wet · eight · eat'], ['Examples', '唔・吳', 'm4 · ng4', 'not · surname Ng']],
		notice: ['Final -p, -t, and -k are short unreleased stops; do not add a vowel after them.', 'Checked syllables use tone numbers 1, 3, or 6 in standard Jyutping.'],
		explanation: ['Historical descriptions may label entering tones 7–9, but standard Jyutping maps them to 1, 3, and 6.', 'm4 and ng4 can form complete syllables without a written vowel.'],
		scriptCharts: [checkedToneChart],
		vocabulary: [['食', 'sik6', 'eat'], ['日', 'jat6', 'day'], ['唔', 'm4', 'not'], ['十', 'sap6', 'ten']],
		choice: { prompt: 'Which Jyutping form ends in a checked -k coda?', options: [['sik', '食 sik6'], ['si', '事 si6'], ['sam', '心 sam1']], answer: 'sik', rationale: 'sik6 ends with the stop coda -k.' },
		arrange: { prompt: 'Build Jyutping for 食.', tiles: ['s', 'i', 'k', '6', 'g'], answer: ['s', 'i', 'k', '6'], translation: 'sik6', rationale: '食 ends in unreleased -k and takes tone 6.' },
		production: { mode: 'speak', prompt: 'Read sap1, baat3, sik6, m4, and ng4 without adding final vowels.', modelAnswer: '濕、八、食、唔、吳。', modelReading: 'sap1, baat3, sik6, m4, ng4.', checklist: ['Stop codas remain unreleased', 'No vowel added after -p/-t/-k', 'm4 and ng4 produced as complete syllables'] },
		transferPrompt: 'Read 十, 七, 六, 唔, and 五 from Jyutping and classify the final of each.', transferSupport: 'sap6: -p; cat1: -t; luk6: -k; m4: syllabic m; ng5: syllabic ng.'
	}),
	lesson({
		id: 'yue-05-name', unitId: 'cantonese-introductions', title: 'Stating your name', shortTitle: 'Your name',
		canDo: 'Greet someone, state your name, and ask their name in colloquial Cantonese.',
		focus: ['我叫…', '你叫咩名呀', '呀'],
		scenario: [['阿明', '你好，我叫阿明。', 'nei5 hou2, ngo5 giu3 aa3 ming4.', 'Hello, my name is Ah Ming.'], ['嘉欣', '你好。你叫咩名呀？', 'nei5 hou2. nei5 giu3 me1 meng2 aa3?', 'Hello. What is your name?']],
		notice: ['叫 introduces someone’s name.', '咩 means “what” in colloquial Cantonese; sentence-final 呀 softens the question.'],
		explanation: ['我叫 + name is a direct introduction.', 'The prefix 阿 is common with familiar given names but is not required for every name.'],
		vocabulary: [['叫', 'giu3', 'be called'], ['咩', 'me1', 'what'], ['名', 'meng2', 'name'], ['呀', 'aa3', 'sentence-final particle']],
		choice: { prompt: 'What information does 你叫咩名呀 request?', options: [['name', 'A name'], ['time', 'A time'], ['price', 'A price']], answer: 'name', rationale: '咩名 means “what name.”' },
		arrange: { prompt: 'Build “My name is Ah Ming.”', tiles: ['阿明', '我', '叫', '係'], answer: ['我', '叫', '阿明'], translation: 'My name is Ah Ming.', rationale: 'The naming pattern is 我叫 + name.' },
		production: { mode: 'speak', prompt: 'Greet someone, state your name, and ask their name.', modelAnswer: '你好，我叫阿明。你叫咩名呀？', modelReading: 'nei5 hou2, ngo5 giu3 aa3 ming4. nei5 giu3 me1 meng2 aa3?', checklist: ['Greeting included', 'Name follows 叫', 'Question uses 咩名', 'Tone numbers consulted before speaking'] },
		transferPrompt: 'Replace 阿明 with your own name and answer the same question without reading the model.', transferSupport: '你好，我叫…'
	}),
	lesson({
		id: 'yue-06-identity', unitId: 'cantonese-introductions', title: 'Identity and origin', shortTitle: 'Origin',
		canDo: 'State or negate a noun identity with 係 and 唔係.',
		focus: ['A 係 B', '唔係', '香港人'],
		scenario: [['阿明', '我係香港人。', 'ngo5 hai6 hoeng1 gong2 jan4.', 'I am from Hong Kong.'], ['嘉欣', '我唔係香港人。我係加拿大人。', 'ngo5 m4 hai6 hoeng1 gong2 jan4. ngo5 hai6 gaa1 naa4 daai6 jan4.', 'I am not from Hong Kong. I am Canadian.']],
		notice: ['係 links a person or thing to a noun identity.', '唔 precedes 係 to negate the identity.'],
		explanation: ['Place + 人 forms many origin expressions.', '係 is not inserted before every adjective; this lesson uses noun identities only.'],
		vocabulary: [['係', 'hai6', 'be'], ['唔係', 'm4 hai6', 'be not'], ['香港', 'hoeng1 gong2', 'Hong Kong'], ['人', 'jan4', 'person']],
		choice: { prompt: 'Which sentence means “I am not from Hong Kong”?', options: [['negative', '我唔係香港人。'], ['positive', '我係香港人。'], ['question', '你係咪香港人呀？']], answer: 'negative', rationale: '唔係 negates the identity.' },
		arrange: { prompt: 'Build “I am from Hong Kong.”', tiles: ['香港人', '我', '係', '叫'], answer: ['我', '係', '香港人'], translation: 'I am from Hong Kong.', rationale: 'A 係 B identifies A as B.' },
		production: { mode: 'speak', prompt: 'State an origin and then give one contrasting negative statement.', modelAnswer: '我係加拿大人。我唔係香港人。', modelReading: 'ngo5 hai6 gaa1 naa4 daai6 jan4. ngo5 m4 hai6 hoeng1 gong2 jan4.', checklist: ['係 used for noun identity', '唔 precedes 係 in the negative', 'Place name remains intelligible'] },
		transferPrompt: 'Ask and answer 你係邊度人呀？ using a place not shown in the model.', transferSupport: '我係…人。'
	}),
	lesson({
		id: 'yue-07-questions', unitId: 'cantonese-introductions', title: 'Yes–no and information questions', shortTitle: 'Questions',
		canDo: 'Ask a yes–no question with 係咪 and a location-origin question with 邊度.',
		focus: ['係咪', '邊度', 'short answers', '呀'],
		scenario: [['嘉欣', '你係咪學生呀？', 'nei5 hai6 mai6 hok6 saang1 aa3?', 'Are you a student?'], ['阿明', '係呀。你呢？', 'hai6 aa3. nei5 ne1?', 'Yes. And you?']],
		notice: ['係咪 is the affirmative–negative question form of 係.', '邊度 means “where”; 呢 can return an established topic.'],
		explanation: ['Short answers can repeat 係 or 唔係.', 'Cantonese questions frequently include a sentence-final particle that signals stance or softens the exchange.'],
		vocabulary: [['係咪', 'hai6 mai6', 'is or is not; yes–no question'], ['邊度', 'bin1 dou6', 'where'], ['學生', 'hok6 saang1', 'student'], ['呢', 'ne1', 'topic-return particle']],
		choice: { prompt: 'Which expression asks “is or is not”?', options: [['haimai', '係咪'], ['bindou', '邊度'], ['mhai', '唔係']], answer: 'haimai', rationale: '係咪 forms the affirmative–negative question.' },
		arrange: { prompt: 'Build “Are you a student?”', tiles: ['學生', '你', '呀', '係咪'], answer: ['你', '係咪', '學生', '呀'], translation: 'Are you a student?', rationale: '係咪 precedes the noun identity, with 呀 at the end.' },
		production: { mode: 'speak', prompt: 'Ask whether someone is a student, answer, and return the question.', modelAnswer: '你係咪學生呀？係呀。你呢？', modelReading: 'nei5 hai6 mai6 hok6 saang1 aa3? hai6 aa3. nei5 ne1?', checklist: ['Question uses 係咪', 'Answer repeats 係 or 唔係', '你呢 returns the topic'] },
		transferPrompt: 'Replace 學生 with 老師 and complete the same three-turn exchange.', transferSupport: '你係咪老師呀？…你呢？'
	}),
	lesson({
		id: 'yue-08-numbers-age', unitId: 'cantonese-introductions', title: 'Numbers and age', shortTitle: 'Numbers and age',
		canDo: 'Understand basic Cantonese numbers and state an adult age with 歲.',
		focus: ['1–100', '十 patterns', '歲', '幾多歲'],
		scenario: [['阿明', '你幾多歲呀？', 'nei5 gei2 do1 seoi3 aa3?', 'How old are you?'], ['嘉欣', '我二十五歲。', 'ngo5 ji6 sap6 ng5 seoi3.', 'I am twenty-five years old.']],
		notice: ['二十五 is 2×10+5. Colloquial 廿 jaa6 also represents twenty in some contexts.', '歲 follows the number directly; do not insert 係.'],
		explanation: ['幾多 asks “how many/much” and combines with 歲 for age.', '兩 loeng5 commonly occurs before classifiers, while 二 ji6 is used in compound numbers such as 二十五.'],
		vocabulary: [['十', 'sap6', 'ten'], ['二十', 'ji6 sap6', 'twenty'], ['歲', 'seoi3', 'years old'], ['幾多', 'gei2 do1', 'how many; how much']],
		choice: { prompt: 'Which number is 二十五?', options: [['25', '25'], ['52', '52'], ['15', '15']], answer: '25', rationale: '二十 is twenty and 五 adds five.' },
		arrange: { prompt: 'Build “I am twenty-five years old.”', tiles: ['二十五', '我', '係', '歲'], answer: ['我', '二十五', '歲'], translation: 'I am twenty-five years old.', rationale: 'Age uses person + number + 歲 without 係.' },
		production: { mode: 'speak', prompt: 'Ask an adult’s age and give an age answer.', modelAnswer: '你幾多歲呀？我二十五歲。', modelReading: 'nei5 gei2 do1 seoi3 aa3? ngo5 ji6 sap6 ng5 seoi3.', checklist: ['Question uses 幾多歲', 'Number precedes 歲', 'No 係 inserted before age'] },
		transferPrompt: 'State the ages 18, 34, and 67 in full Cantonese sentences.', transferSupport: '十八、三十四、六十七 + 歲。'
	}),
	lesson({
		id: 'yue-09-intro-mission', unitId: 'cantonese-introductions', title: 'Mission: complete a first meeting', shortTitle: 'First meeting', kind: 'mission', durationMinutes: 18,
		canDo: 'Complete a short Cantonese first meeting with a name, identity, question, and follow-up.',
		focus: ['integrated introduction', 'short answers', 'tone-number preparation'],
		scenario: [['嘉欣', '你好，我叫嘉欣。我係學生。你呢？', 'nei5 hou2, ngo5 giu3 gaa1 jan1. ngo5 hai6 hok6 saang1. nei5 ne1?', 'Hello, my name is Ka Yan. I am a student. And you?'], ['阿明', '我叫阿明。我都係學生。', 'ngo5 giu3 aa3 ming4. ngo5 dou1 hai6 hok6 saang1.', 'My name is Ah Ming. I am also a student.']],
		notice: ['都 appears before 係 in “also” statements.', 'Prepare unfamiliar words from Jyutping rather than guessing pronunciation from the character.'],
		explanation: ['The mission combines checked forms without adding a new grammar target.', 'Particles such as 呀 and 呢 help the exchange sound complete but do not replace clear question structure.'],
		vocabulary: [['都', 'dou1', 'also; all'], ['老師', 'lou5 si1', 'teacher'], ['香港人', 'hoeng1 gong2 jan4', 'Hong Kong person'], ['加拿大人', 'gaa1 naa4 daai6 jan4', 'Canadian']],
		choice: { prompt: 'Where does 都 belong in “I am also a student”?', options: [['before-hai', 'Before 係'], ['after-student', 'After 學生'], ['before-subject', 'Before 我']], answer: 'before-hai', rationale: '都 normally precedes the predicate 係.' },
		arrange: { prompt: 'Build “I am also a student.”', tiles: ['學生', '都', '我', '係'], answer: ['我', '都', '係', '學生'], translation: 'I am also a student.', rationale: 'The order is subject + 都 + 係 + identity.' },
		production: { mode: 'speak', prompt: 'Give your name and identity, then ask one matching question.', modelAnswer: '你好，我叫嘉欣。我係學生。你係咪學生呀？', modelReading: 'nei5 hou2, ngo5 giu3 gaa1 jan1. ngo5 hai6 hok6 saang1. nei5 hai6 mai6 hok6 saang1 aa3?', checklist: ['Name stated with 叫', 'Identity stated with 係', 'Question uses 係咪', 'Jyutping tones prepared before speaking'] },
		transferPrompt: 'Repeat the meeting with a different occupation and origin, without copying the model nouns.', transferSupport: '我叫…；我係…；你係咪…呀？'
	}),
	lesson({
		id: 'yue-10-week-date', unitId: 'cantonese-daily', title: 'Days and dates', shortTitle: 'Days and dates',
		canDo: 'Ask and state a weekday or simple calendar date in Cantonese.',
		focus: ['今日', '星期', '月/號', '幾'],
		scenario: [['嘉欣', '今日星期幾呀？', 'gam1 jat6 sing1 kei4 gei2 aa3?', 'What day is it today?'], ['阿明', '今日星期三，八月二十號。', 'gam1 jat6 sing1 kei4 saam1, baat3 jyut6 ji6 sap6 hou6.', 'Today is Wednesday, August 20.']],
		notice: ['Weekdays use 星期 plus a number, with 星期日 or 禮拜日 for Sunday.', 'Dates move from larger to smaller units: month before day.'],
		explanation: ['幾 occupies the missing number position in the weekday question.', '號 is common for spoken calendar dates.'],
		vocabulary: [['今日', 'gam1 jat6', 'today'], ['星期', 'sing1 kei4', 'week; weekday'], ['月', 'jyut6', 'month'], ['號', 'hou6', 'day of month']],
		choice: { prompt: 'What day is 星期三?', options: [['wed', 'Wednesday'], ['tue', 'Tuesday'], ['sun', 'Sunday']], answer: 'wed', rationale: '星期三 corresponds to Wednesday.' },
		arrange: { prompt: 'Build “What day is it today?”', tiles: ['星期', '今日', '幾', '係咪'], answer: ['今日', '星期', '幾'], translation: 'What day is it today?', rationale: '幾 fills the unknown weekday-number position.' },
		production: { mode: 'speak', prompt: 'Ask for today’s weekday and answer with a weekday and date.', modelAnswer: '今日星期幾呀？今日星期三，八月二十號。', modelReading: 'gam1 jat6 sing1 kei4 gei2 aa3? gam1 jat6 sing1 kei4 saam1, baat3 jyut6 ji6 sap6 hou6.', checklist: ['Question uses 幾', 'Weekday uses 星期', 'Month precedes date'] },
		transferPrompt: 'State three different dates and weekdays using the large-to-small order.', transferSupport: '八月二十號，星期三。'
	}),
	lesson({
		id: 'yue-11-clock-time', unitId: 'cantonese-daily', title: 'Clock time', shortTitle: 'Clock time',
		canDo: 'Ask for the current time and state an hour and half hour.',
		focus: ['而家', '幾點', '點', '半'],
		scenario: [['阿明', '而家幾點呀？', 'ji4 gaa1 gei2 dim2 aa3?', 'What time is it now?'], ['嘉欣', '而家七點半。', 'ji4 gaa1 cat1 dim2 bun3.', 'It is 7:30 now.']],
		notice: ['點 marks the hour; 分 fan1 marks minutes.', '半 follows 點: 七點半 is half past seven.'],
		explanation: ['The time phrase moves from hour to minute.', '兩點 loeng5 dim2 is normally used for two o’clock.'],
		vocabulary: [['而家', 'ji4 gaa1', 'now'], ['點', 'dim2', 'o’clock'], ['分', 'fan1', 'minute'], ['半', 'bun3', 'half']],
		choice: { prompt: 'What time is 七點半?', options: [['730', '7:30'], ['715', '7:15'], ['630', '6:30']], answer: '730', rationale: '半 means half an hour after the stated hour.' },
		arrange: { prompt: 'Build “It is 7:30 now.”', tiles: ['七點', '而家', '半', '係'], answer: ['而家', '七點', '半'], translation: 'It is 7:30 now.', rationale: 'The simple time statement does not require 係.' },
		production: { mode: 'speak', prompt: 'Ask the time and answer with 7:30 and 9:15.', modelAnswer: '而家幾點呀？七點半。九點十五分。', modelReading: 'ji4 gaa1 gei2 dim2 aa3? cat1 dim2 bun3. gau2 dim2 sap6 ng5 fan1.', checklist: ['幾點 used in the question', '半 follows 點', 'Minute number follows the hour'] },
		transferPrompt: 'State 2:00, 6:20, and 10:30 without English word order.', transferSupport: '兩點；六點二十分；十點半。'
	}),
	lesson({
		id: 'yue-12-routine', unitId: 'cantonese-daily', title: 'Daily routine', shortTitle: 'Daily routine',
		canDo: 'Describe when one routine action happens with a time phrase before the verb.',
		focus: ['time + verb', '每日', '起身', '食早餐'],
		scenario: [['嘉欣', '我每日七點起身。', 'ngo5 mui5 jat6 cat1 dim2 hei2 san1.', 'I get up at seven every day.'], ['阿明', '我八點食早餐。', 'ngo5 baat3 dim2 sik6 zou2 caan1.', 'I eat breakfast at eight.']],
		notice: ['A time phrase normally appears before the verb.', '每日 establishes frequency and can precede a clock time.'],
		explanation: ['Cantonese verbs do not conjugate for person.', 'Time and aspect expressions provide information that English often places in verb morphology.'],
		vocabulary: [['每日', 'mui5 jat6', 'every day'], ['起身', 'hei2 san1', 'get up'], ['食', 'sik6', 'eat'], ['早餐', 'zou2 caan1', 'breakfast']],
		choice: { prompt: 'Where does 七點 normally appear in 我七點起身?', options: [['before-verb', 'Before 起身'], ['after-verb', 'After 起身'], ['sentence-end', 'Only at sentence end']], answer: 'before-verb', rationale: 'The time phrase normally precedes the verb.' },
		arrange: { prompt: 'Build “I get up at seven every day.”', tiles: ['起身', '七點', '每日', '我'], answer: ['我', '每日', '七點', '起身'], translation: 'I get up at seven every day.', rationale: 'The order is subject + frequency + time + verb.' },
		production: { mode: 'speak', prompt: 'Describe when you get up and when you eat breakfast.', modelAnswer: '我每日七點起身，八點食早餐。', modelReading: 'ngo5 mui5 jat6 cat1 dim2 hei2 san1, baat3 dim2 sik6 zou2 caan1.', checklist: ['Time precedes each verb', 'Two routine actions included', 'Stop coda in 食 sik6 remains unreleased'] },
		transferPrompt: 'Describe two different routine actions with new times.', transferSupport: '我…點…；我…點…。'
	}),
	lesson({
		id: 'yue-13-frequency-negation', unitId: 'cantonese-daily', title: 'Frequency and negation', shortTitle: 'Frequency and negation',
		canDo: 'State a frequent activity and describe an activity that does not happen much.',
		focus: ['成日', '有時', '唔多', 'frequency before verb'],
		scenario: [['阿明', '我成日飲茶。', 'ngo5 seng4 jat6 jam2 caa4.', 'I often drink tea.'], ['嘉欣', '我唔多飲咖啡。', 'ngo5 m4 do1 jam2 gaa3 fe1.', 'I do not drink much coffee.']],
		notice: ['Frequency expressions normally appear before the verb.', '唔多 + verb means the activity is not frequent or not done much.'],
		explanation: ['成日 can mean often or all the time depending on context and intonation.', '有時 means sometimes and also precedes the verb phrase.'],
		vocabulary: [['成日', 'seng4 jat6', 'often; all the time', 'Colloquial reading; sing4 jat6 also occurs'], ['有時', 'jau5 si4', 'sometimes'], ['唔多', 'm4 do1', 'not much; not often'], ['咖啡', 'gaa3 fe1', 'coffee']],
		choice: { prompt: 'Which sentence means “I do not drink much coffee”?', options: [['not-much', '我唔多飲咖啡。'], ['often', '我成日飲咖啡。'], ['identity', '我唔係咖啡。']], answer: 'not-much', rationale: '唔多 precedes the verb 飲.' },
		arrange: { prompt: 'Build “I sometimes drink tea.”', tiles: ['飲', '我', '茶', '有時'], answer: ['我', '有時', '飲', '茶'], translation: 'I sometimes drink tea.', rationale: 'The frequency phrase precedes the verb.' },
		production: { mode: 'speak', prompt: 'State one activity you often do and one you do not do much.', modelAnswer: '我成日飲茶。我唔多飲咖啡。', modelReading: 'ngo5 seng4 jat6 jam2 caa4. ngo5 m4 do1 jam2 gaa3 fe1.', checklist: ['Frequency phrase before verb', '唔多 placed before the negative activity', 'Two contrasting habits stated'] },
		transferPrompt: 'Describe three activities using 成日, 有時, and 唔多 exactly once each.', transferSupport: '我成日…；我有時…；我唔多…。'
	}),
	lesson({
		id: 'yue-14-schedule-mission', unitId: 'cantonese-daily', title: 'Mission: arrange a time', shortTitle: 'Arrange a time', kind: 'mission', durationMinutes: 18,
		canDo: 'Propose a day and time, respond to availability, and confirm the arrangement in Cantonese.',
		focus: ['…得唔得呀', '得/唔得', '咁…見', 'confirmation'],
		scenario: [['嘉欣', '星期六下晝三點得唔得呀？', 'sing1 kei4 luk6 haa6 zau3 saam1 dim2 dak1 m4 dak1 aa3?', 'Is Saturday at 3 p.m. okay?'], ['阿明', '得。咁星期六見。', 'dak1. gam2 sing1 kei4 luk6 gin3.', 'Yes. Then see you Saturday.']],
		notice: ['得唔得 asks whether a proposal works.', '咁 introduces the resulting plan: “then; in that case.”'],
		explanation: ['Time expressions move from larger units to smaller units: weekday, part of day, hour.', 'Repeat the final time when noise or multiple proposals could create ambiguity.'],
		vocabulary: [['得', 'dak1', 'work; be okay'], ['唔得', 'm4 dak1', 'not work; not okay'], ['下晝', 'haa6 zau3', 'afternoon'], ['見', 'gin3', 'see; meet']],
		choice: { prompt: 'Which order follows the normal large-to-small time sequence?', options: [['right', '星期六下晝三點'], ['reverse', '三點下晝星期六'], ['mixed', '下晝星期六三點']], answer: 'right', rationale: 'Weekday precedes part of day, which precedes the hour.' },
		arrange: { prompt: 'Build “Is Saturday at three okay?”', tiles: ['三點', '星期六', '呀', '得唔得'], answer: ['星期六', '三點', '得唔得', '呀'], translation: 'Is Saturday at three okay?', rationale: 'The time phrase precedes 得唔得呀.' },
		production: { mode: 'speak', prompt: 'Propose a day and time, accept or reject it, and confirm the final plan.', modelAnswer: '星期六下晝三點得唔得呀？得。咁星期六下晝三點見。', modelReading: 'sing1 kei4 luk6 haa6 zau3 saam1 dim2 dak1 m4 dak1 aa3? dak1. gam2 sing1 kei4 luk6 haa6 zau3 saam1 dim2 gin3.', checklist: ['Proposal includes day and time', 'Response is explicitly 得 or 唔得', 'Final confirmation repeats the agreed time'] },
		transferPrompt: 'Reject the first proposal, offer a replacement time, and confirm it.', transferSupport: '…得唔得呀？唔得。…得唔得呀？得。'
	}),
	lesson({
		id: 'yue-15-classifiers', unitId: 'cantonese-food-places', title: 'Quantities and classifiers', shortTitle: 'Classifiers',
		canDo: 'Use common number–classifier–noun phrases for drinks, bowls, and general objects.',
		focus: ['number + classifier + noun', '個', '杯', '碗'],
		scenario: [['嘉欣', '一杯茶，兩碗飯。', 'jat1 bui1 caa4, loeng5 wun2 faan6.', 'One cup of tea and two bowls of rice.'], ['店員', '好。', 'hou2.', 'Okay.']],
		notice: ['A classifier normally appears between a number and a noun.', '兩 loeng5 commonly appears before classifiers.'],
		explanation: ['個 is a common general classifier, while 杯 and 碗 classify servings.', 'Keep the classifier phrase together when placing it in a longer request.'],
		vocabulary: [['個', 'go3', 'general classifier'], ['杯', 'bui1', 'cup; classifier'], ['碗', 'wun2', 'bowl; classifier'], ['飯', 'faan6', 'cooked rice; meal']],
		choice: { prompt: 'Which phrase means “two cups of tea”?', options: [['correct', '兩杯茶'], ['no-classifier', '二茶'], ['wrong-order', '茶兩杯']], answer: 'correct', rationale: 'The normal order is number + classifier + noun.' },
		arrange: { prompt: 'Build “one cup of tea.”', tiles: ['茶', '一', '杯', '個'], answer: ['一', '杯', '茶'], translation: 'one cup of tea', rationale: '杯 classifies the cupful before 茶.' },
		production: { mode: 'speak', prompt: 'Request one cup of tea and two bowls of rice as noun phrases.', modelAnswer: '一杯茶，兩碗飯。', modelReading: 'jat1 bui1 caa4, loeng5 wun2 faan6.', checklist: ['Classifier after each number', '兩 used before 碗', 'Noun follows the classifier'] },
		transferPrompt: 'Create three new quantity phrases using 個, 杯, and 碗 with suitable nouns.', transferSupport: '一個…；一杯…；兩碗…。'
	}),
	lesson({
		id: 'yue-16-ordering', unitId: 'cantonese-food-places', title: 'Ordering food and drink', shortTitle: 'Ordering',
		canDo: 'Place a polite two-item order in a Cantonese service exchange.',
		focus: ['唔該', '我想要…', '同', 'classifiers'],
		scenario: [['顧客', '唔該，我想要一杯茶同一碗麵。', 'm4 goi1, ngo5 soeng2 jiu3 jat1 bui1 caa4 tung4 jat1 wun2 min6.', 'Excuse me, I would like one tea and one bowl of noodles.'], ['店員', '好，仲要唔要其他嘢？', 'hou2, zung6 jiu3 m4 jiu3 kei4 taa1 je5?', 'Okay. Would you like anything else?']],
		notice: ['唔該 marks a polite request or thanks for a service.', '同 links noun items in colloquial Cantonese.'],
		explanation: ['我想要… states what you would like. In a service setting, 唔該 helps open the request.', 'Keep every number–classifier–noun group intact.'],
		vocabulary: [['唔該', 'm4 goi1', 'please; thanks for a service'], ['想要', 'soeng2 jiu3', 'would like; want'], ['麵', 'min6', 'noodles'], ['同', 'tung4', 'and; with']],
		choice: { prompt: 'Which expression politely opens a service request?', options: [['mgoi', '唔該'], ['mhai', '唔係'], ['bindou', '邊度']], answer: 'mgoi', rationale: '唔該 is used for requests and service-related thanks.' },
		arrange: { prompt: 'Build “I would like one cup of tea.”', tiles: ['一杯茶', '想要', '我', '唔該'], answer: ['唔該', '我', '想要', '一杯茶'], translation: 'Please, I would like one cup of tea.', rationale: 'The request opens with 唔該, followed by subject + 想要 + item.' },
		production: { mode: 'speak', prompt: 'Order one drink and one food item with appropriate classifiers.', modelAnswer: '唔該，我想要一杯茶同一碗麵。', modelReading: 'm4 goi1, ngo5 soeng2 jiu3 jat1 bui1 caa4 tung4 jat1 wun2 min6.', checklist: ['Request opens with 唔該', 'Both items have classifiers', '同 links the two items'] },
		transferPrompt: 'Place a new two-item order and respond when asked whether you want anything else.', transferSupport: '唔該，我想要…同…。唔使喇，多謝。'
	}),
	lesson({
		id: 'yue-17-prices', unitId: 'cantonese-food-places', title: 'Prices and totals', shortTitle: 'Prices',
		canDo: 'Ask a price, understand a whole-dollar answer, and confirm the total.',
		focus: ['幾多錢', '蚊', '一共', 'price numbers'],
		scenario: [['顧客', '呢個幾多錢呀？', 'ni1 go3 gei2 do1 cin2 aa3?', 'How much is this?'], ['店員', '二十八蚊。一共四十蚊。', 'ji6 sap6 baat3 man1. jat1 gung6 sei3 sap6 man1.', 'Twenty-eight dollars. Forty dollars in total.']],
		notice: ['幾多錢 asks “how much money.”', '蚊 is the common colloquial unit for a dollar in Hong Kong Cantonese.'],
		explanation: ['一共 introduces a total across multiple items.', 'Price numbers use the same tens-and-units structure as other numbers.'],
		vocabulary: [['幾多', 'gei2 do1', 'how many; how much'], ['錢', 'cin2', 'money'], ['蚊', 'man1', 'dollar; colloquial unit'], ['一共', 'jat1 gung6', 'altogether']],
		choice: { prompt: 'What does 一共四十蚊 state?', options: [['total', 'The total is forty dollars'], ['single', 'One item is fourteen dollars'], ['time', 'It is 4:00']], answer: 'total', rationale: '一共 marks the total amount.' },
		arrange: { prompt: 'Build “How much is this?”', tiles: ['幾多錢', '呢個', '呀', '係'], answer: ['呢個', '幾多錢', '呀'], translation: 'How much is this?', rationale: '幾多錢 functions as the price question, with 呀 at the end.' },
		production: { mode: 'speak', prompt: 'Ask one price and confirm a total of forty dollars.', modelAnswer: '呢個幾多錢呀？二十八蚊。一共四十蚊，係咪呀？', modelReading: 'ni1 go3 gei2 do1 cin2 aa3? ji6 sap6 baat3 man1. jat1 gung6 sei3 sap6 man1, hai6 mai6 aa3?', checklist: ['Price question uses 幾多錢', 'Amount ends with 蚊', 'Total introduced with 一共'] },
		transferPrompt: 'Ask and answer prices of 16, 35, and 72 dollars, then state a combined total.', transferSupport: '呢個幾多錢呀？…蚊。一共…蚊。'
	}),
	lesson({
		id: 'yue-18-location', unitId: 'cantonese-food-places', title: 'Asking where a place is', shortTitle: 'Location',
		canDo: 'Ask where a place is and understand a simple location relative to a landmark.',
		focus: ['喺邊度', '喺', '隔離', '前面'],
		scenario: [['嘉欣', '洗手間喺邊度呀？', 'sai2 sau2 gaan1 hai2 bin1 dou6 aa3?', 'Where is the restroom?'], ['店員', '喺餐廳隔離。', 'hai2 caan1 teng1 gaak3 lei4.', 'It is beside the restaurant.']],
		notice: ['喺 introduces location; 邊度 asks for an unknown place.', 'Relative-location words follow the landmark: 餐廳隔離.'],
		explanation: ['The full pattern is subject + 喺 + place. The subject can be omitted when obvious.', '隔離 means beside or next to; 前面 means in front.'],
		vocabulary: [['洗手間', 'sai2 sau2 gaan1', 'restroom'], ['邊度', 'bin1 dou6', 'where'], ['餐廳', 'caan1 teng1', 'restaurant'], ['隔離', 'gaak3 lei4', 'beside; next to']],
		choice: { prompt: 'What relationship does 隔離 express?', options: [['beside', 'Beside; next to'], ['inside', 'Inside'], ['behind', 'Behind']], answer: 'beside', rationale: '隔離 means beside or next to.' },
		arrange: { prompt: 'Build “Where is the restroom?”', tiles: ['喺邊度', '洗手間', '呀', '係咪'], answer: ['洗手間', '喺邊度', '呀'], translation: 'Where is the restroom?', rationale: 'The unknown location is expressed with 喺邊度.' },
		production: { mode: 'speak', prompt: 'Ask for the restroom and give a location beside the restaurant.', modelAnswer: '洗手間喺邊度呀？喺餐廳隔離。', modelReading: 'sai2 sau2 gaan1 hai2 bin1 dou6 aa3? hai2 caan1 teng1 gaak3 lei4.', checklist: ['Question uses 喺邊度', 'Answer begins with 喺', 'Landmark precedes 隔離'] },
		transferPrompt: 'Ask for a station, shop, or school and answer using 前面 or 隔離.', transferSupport: '…喺邊度呀？喺…前面／隔離。'
	}),
	lesson({
		id: 'yue-19-service-mission', unitId: 'cantonese-food-places', title: 'Mission: order and ask for a location', shortTitle: 'Service exchange', kind: 'mission', durationMinutes: 20,
		canDo: 'Complete a Cantonese service exchange with an order, price confirmation, and location question.',
		focus: ['integrated order', 'total confirmation', 'location question'],
		scenario: [['顧客', '唔該，我想要一杯茶同一碗麵。一共幾多錢呀？', 'm4 goi1, ngo5 soeng2 jiu3 jat1 bui1 caa4 tung4 jat1 wun2 min6. jat1 gung6 gei2 do1 cin2 aa3?', 'Please, I would like one tea and one bowl of noodles. How much is it altogether?'], ['店員', '一共三十五蚊。洗手間喺門口隔離。', 'jat1 gung6 saam1 sap6 ng5 man1. sai2 sau2 gaan1 hai2 mun4 hau2 gaak3 lei4.', 'Thirty-five dollars total. The restroom is beside the entrance.']],
		notice: ['The total question can omit an already established subject.', 'A location answer should repeat the landmark when the setting is noisy or ambiguous.'],
		explanation: ['This mission combines classifiers, request framing, prices, and location.', 'Open production remains self-checked; the interface does not claim automatic Cantonese pronunciation certification.'],
		vocabulary: [['門口', 'mun4 hau2', 'doorway; entrance'], ['其他', 'kei4 taa1', 'other'], ['唔使', 'm4 sai2', 'no need'], ['多謝', 'do1 ze6', 'thank you']],
		choice: { prompt: 'Which question asks for the total price?', options: [['total', '一共幾多錢呀？'], ['location', '洗手間喺邊度呀？'], ['identity', '你係邊個呀？']], answer: 'total', rationale: '一共幾多錢 asks how much everything costs together.' },
		arrange: { prompt: 'Build “The restroom is beside the entrance.”', tiles: ['門口', '喺', '洗手間', '隔離'], answer: ['洗手間', '喺', '門口', '隔離'], translation: 'The restroom is beside the entrance.', rationale: 'The landmark 門口 precedes 隔離.' },
		production: { mode: 'speak', prompt: 'Order two items, ask the total, then ask where the restroom is.', modelAnswer: '唔該，我想要一杯茶同一碗麵。一共幾多錢呀？洗手間喺邊度呀？', modelReading: 'm4 goi1, ngo5 soeng2 jiu3 jat1 bui1 caa4 tung4 jat1 wun2 min6. jat1 gung6 gei2 do1 cin2 aa3? sai2 sau2 gaan1 hai2 bin1 dou6 aa3?', checklist: ['Two classified items ordered', 'Total requested with 一共幾多錢', 'Location requested with 喺邊度', 'Tone numbers prepared before speaking'] },
		transferPrompt: 'Repeat the exchange with different items, a different total, and a different destination.', transferSupport: '唔該，我想要…；一共幾多錢呀？…喺邊度呀？'
	}),
	lesson({
		id: 'yue-20-family-photo', unitId: 'cantonese-family-home', title: 'Identifying family members', shortTitle: 'Family photo',
		canDo: 'Identify one person in a family photo and state that person’s relationship to you.',
		focus: ['呢個係邊個呀', '我 + kinship noun', '佢'],
		scenario: [['陳生', '呢個係邊個呀？', 'Ni1 go3 hai6 bin1 go3 aa3?', 'Who is this?'], ['美玲', '呢個係我家姐。佢喺中環返工。', 'Ni1 go3 hai6 ngo5 gaa1 ze1. Keoi5 hai2 Zung1 Waan4 faan1 gung1.', 'This is my older sister. She works in Central.']],
		notice: ['邊個 asks “who”; 呢個 refers to the nearby person or image being indicated.', 'Cantonese normally places the kinship noun directly after 我: 我家姐.'],
		explanation: ['係 links the person being identified to the relationship. 呀 keeps the information question neutral and conversational.', '佢 can mean he, she, or that person; the surrounding context supplies gender when it matters.'],
		vocabulary: [['邊個', 'bin1 go3', 'who'], ['家姐', 'gaa1 ze1', 'older sister'], ['佢', 'keoi5', 'he; she; that person'], ['返工', 'faan1 gung1', 'go to work; work']],
		choice: { prompt: 'What information does 呢個係邊個呀 request?', options: [['person', 'The person’s identity'], ['place', 'The person’s location'], ['age', 'The person’s age']], answer: 'person', rationale: '邊個 means “who” and asks for a person’s identity.' },
		reviewChoices: [{ prompt: 'Which phrase means “my older sister”?', options: [['older', '我家姐'], ['younger', '我細妹'], ['brother', '我細佬']], answer: 'older', rationale: '家姐 is an older sister; 我 marks the relationship as “my.”' }],
		arrange: { prompt: 'Build “This is my older sister.”', tiles: ['我家姐', '呢個', '邊個', '係'], answer: ['呢個', '係', '我家姐'], translation: 'This is my older sister.', rationale: 'The identifying pattern is 呢個 + 係 + relationship.' },
		production: { mode: 'speak', prompt: 'Identify one person in a photo and say where that person works or lives.', modelAnswer: '呢個係我家姐。佢喺中環返工。', modelReading: 'Ni1 go3 hai6 ngo5 gaa1 ze1. Keoi5 hai2 Zung1 Waan4 faan1 gung1.', checklist: ['Identification uses 呢個係', 'Relationship follows 我', 'Location uses 喺'] },
		transferPrompt: 'Identify a different family member and replace Central and work with new information.', transferSupport: '呢個係我…。佢喺…返工／住。'
	}),
	lesson({
		id: 'yue-21-family-existence', unitId: 'cantonese-family-home', title: 'Saying who is in your family', shortTitle: 'Who is in the family',
		canDo: 'Ask whether someone has siblings and give a positive or negative counted answer.',
		focus: ['有冇', '冇', 'number + 個 + person'],
		scenario: [['美玲', '你有冇兄弟姊妹呀？', 'Nei5 jau5 mou5 hing1 dai6 zi2 mui6 aa3?', 'Do you have any siblings?'], ['陳生', '我有一個細佬。', 'Ngo5 jau5 jat1 go3 sai3 lou2.', 'I have one younger brother.']],
		notice: ['有冇 is the affirmative–negative question built from 有 and 冇.', '個 appears between the number and 細佬 in the counted answer.'],
		explanation: ['冇 is the ordinary spoken Cantonese negative of 有. Do not substitute Mandarin 沒有 inside this Cantonese pattern.', 'The subject comes before 有 or 冇: 我有… means “I have…,” and 我冇… means “I do not have…”.'],
		vocabulary: [['有冇', 'jau5 mou5', 'have or not; do you have'], ['冇', 'mou5', 'not have; not exist'], ['兄弟姊妹', 'hing1 dai6 zi2 mui6', 'siblings'], ['細佬', 'sai3 lou2', 'younger brother']],
		choice: { prompt: 'Which form means “do not have” in spoken Cantonese?', options: [['mou', '冇'], ['mhai', '唔係'], ['m', '唔']], answer: 'mou', rationale: '冇 is the negative form paired with 有.' },
		reviewChoices: [{ prompt: 'Which sentence says “I have one younger brother”?', options: [['one', '我有一個細佬。'], ['negative', '我冇細佬。'], ['older', '我有一個阿哥。']], answer: 'one', rationale: 'The answer uses 有 + 一個 + 細佬.' }],
		arrange: { prompt: 'Build “I have one younger brother.”', tiles: ['一個', '我', '有', '細佬'], answer: ['我', '有', '一個', '細佬'], translation: 'I have one younger brother.', rationale: 'The order is possessor + 有 + number–classifier phrase + noun.' },
		production: { mode: 'speak', prompt: 'Ask about siblings and answer positively or negatively with one detail.', modelAnswer: '你有冇兄弟姊妹呀？我有一個細佬。', modelReading: 'Nei5 jau5 mou5 hing1 dai6 zi2 mui6 aa3? Ngo5 jau5 jat1 go3 sai3 lou2.', checklist: ['Question uses 有冇', 'Negative answer uses 冇 when needed', 'Counted person includes 個'] },
		transferPrompt: 'Give a new answer with no siblings or with a different number and relationship.', transferSupport: '我冇兄弟姊妹。／我有…個…。'
	}),
	lesson({
		id: 'yue-22-home-rooms', unitId: 'cantonese-family-home', title: 'Rooms and location at home', shortTitle: 'Rooms at home',
		canDo: 'Ask how many rooms a home has and locate a person, animal, or object inside it.',
		focus: ['屋企有幾多間…', '喺 + place + 入面', 'classifiers 間 and 隻'],
		scenario: [['陳生', '你屋企有幾多間房呀？', 'Nei5 uk1 kei2 jau5 gei2 do1 gaan1 fong2 aa3?', 'How many rooms does your home have?'], ['美玲', '有三間。隻貓喺客廳入面。', 'Jau5 saam1 gaan1. Zek3 maau1 hai2 haak3 teng1 jap6 min6.', 'It has three. The cat is in the living room.']],
		notice: ['幾多 asks for a quantity, and 間 classifies rooms and other enclosed spaces.', 'The location pattern is subject + 喺 + place; 入面 specifies the inside.'],
		explanation: ['The short answer can omit 房 because the question already establishes what 間 counts.', '隻 is a common classifier for animals. Its use is independent of the location marker 喺.'],
		vocabulary: [['屋企', 'uk1 kei2', 'home'], ['房', 'fong2', 'room'], ['間', 'gaan1', 'classifier for rooms and enclosed spaces'], ['隻', 'zek3', 'classifier for many animals'], ['客廳', 'haak3 teng1', 'living room']],
		choice: { prompt: 'How many rooms are in the example home?', options: [['three', 'Three'], ['one', 'One'], ['five', 'Five']], answer: 'three', rationale: '有三間 states that there are three rooms.' },
		reviewChoices: [{ prompt: 'Which sentence correctly puts the cat in the living room?', options: [['location', '隻貓喺客廳入面。'], ['reversed', '客廳喺隻貓入面。'], ['identity', '隻貓係客廳。']], answer: 'location', rationale: 'The located subject comes before 喺, followed by 客廳入面.' }],
		arrange: { prompt: 'Build “The cat is in the living room.”', tiles: ['隻貓', '客廳入面', '有', '喺'], answer: ['隻貓', '喺', '客廳入面'], translation: 'The cat is in the living room.', rationale: 'The location pattern is subject + 喺 + place.' },
		production: { mode: 'speak', prompt: 'State how many rooms a home has and locate one person, animal, or object.', modelAnswer: '我屋企有三間房。隻貓喺客廳入面。', modelReading: 'Ngo5 uk1 kei2 jau5 saam1 gaan1 fong2. Zek3 maau1 hai2 haak3 teng1 jap6 min6.', checklist: ['Room count uses 間', 'Location uses 喺', 'Place follows 喺'] },
		transferPrompt: 'Change the room count and locate a different person or object in another room.', transferSupport: '我屋企有…間房。…喺…入面。'
	}),
	lesson({
		id: 'yue-23-family-home-mission', unitId: 'cantonese-family-home', title: 'Mission: describe a family and home', shortTitle: 'Family and home mission', kind: 'mission', durationMinutes: 20,
		canDo: 'Give a short connected description of family size, relationships, residence, and one home location.',
		focus: ['屋企有幾多個人', '屋企人', '住喺', '屋企有…'],
		scenario: [['美玲', '你屋企有幾多個人呀？', 'Nei5 uk1 kei2 jau5 gei2 do1 go3 jan4 aa3?', 'How many people are in your family?'], ['陳生', '我屋企有四個人：我阿爸、阿媽、家姐同我。我哋住喺九龍。屋企有一隻貓。', 'Ngo5 uk1 kei2 jau5 sei3 go3 jan4: ngo5 aa3 baa1, aa3 maa1, gaa1 ze1 tung4 ngo5. Ngo5 dei6 zyu6 hai2 Gau2 Lung4. Uk1 kei2 jau5 jat1 zek3 maau1.', 'There are four people in my family: my father, mother, older sister, and me. We live in Kowloon. There is a cat at home.']],
		notice: ['個 is the general classifier in this family-count question; 同 links the listed family members.', '住喺 is followed by the place of residence, while 屋企有 introduces what exists at home.'],
		explanation: ['A connected answer can move from family count to relationships, residence, and a home detail without repeating 我屋企 in every clause.', 'Written Cantonese records the spoken forms 阿爸, 阿媽, 我哋, 喺, and 屋企 used in this dialogue.'],
		vocabulary: [['屋企人', 'uk1 kei2 jan4', 'family members'], ['阿爸', 'aa3 baa1', 'father; dad'], ['阿媽', 'aa3 maa1', 'mother; mom'], ['我哋', 'ngo5 dei6', 'we; us'], ['住喺', 'zyu6 hai2', 'live at; live in']],
		choice: { prompt: 'How many people are in Chan’s family description?', options: [['four', 'Four'], ['three', 'Three'], ['five', 'Five']], answer: 'four', rationale: '我屋企有四個人 gives the family count as four.' },
		reviewChoices: [{ prompt: 'Which phrase correctly states “We live in Kowloon”?', options: [['live', '我哋住喺九龍。'], ['location-only', '我哋喺九龍。'], ['possess', '我哋有九龍。']], answer: 'live', rationale: '住喺 is followed by the place of residence.' }],
		arrange: { prompt: 'Build “There is a cat at home.”', tiles: ['一隻貓', '有', '屋企', '喺'], answer: ['屋企', '有', '一隻貓'], translation: 'There is a cat at home.', rationale: 'The location frame comes first, followed by 有 and the classified noun phrase.' },
		production: { mode: 'speak', prompt: 'Describe a real or invented family and home in at least four connected statements.', modelAnswer: '我屋企有四個人。我有一個家姐。我哋住喺九龍。我屋企有三間房。', modelReading: 'Ngo5 uk1 kei2 jau5 sei3 go3 jan4. Ngo5 jau5 jat1 go3 gaa1 ze1. Ngo5 dei6 zyu6 hai2 Gau2 Lung4. Ngo5 uk1 kei2 jau5 saam1 gaan1 fong2.', checklist: ['Family count uses 個人', 'At least one relationship is named', 'Residence uses 住喺', 'One home detail uses 有 or 喺'] },
		transferPrompt: 'Repeat the description with a different family size, district, room count, and home-location detail.', transferSupport: '我屋企有…個人。我有…。我哋住喺…。屋企有…。'
	})
].map((item, index) => ({ ...item, sequence: index + 1 }));

const units: CourseUnit[] = [
	{ id: 'cantonese-launchpad', sequence: 0, title: 'Jyutping and sound system', nativeTitle: '粵拼同語音', strapline: 'Jyutping structure, six tone categories, onsets, finals, and stop codas.', canDo: 'Use Jyutping to decode beginner Cantonese syllables and preserve tone and coda contrasts.', mission: 'Read an unfamiliar beginner word from characters plus Jyutping and identify its onset, final, and tone.', lessonIds: lessons.filter((item) => item.unitId === 'cantonese-launchpad').map((item) => item.id) },
	{ id: 'cantonese-introductions', sequence: 1, title: 'Introductions and identity', nativeTitle: '自我介紹', strapline: 'Names, identity, questions, numbers, and a complete first meeting.', canDo: 'Introduce yourself, exchange one personal detail, and ask a matching question.', mission: 'Complete a first meeting with a name, identity, age or origin, and one follow-up question.', lessonIds: lessons.filter((item) => item.unitId === 'cantonese-introductions').map((item) => item.id) },
	{ id: 'cantonese-daily', sequence: 2, title: 'Daily routine and time', nativeTitle: '日常同時間', strapline: 'Dates, clock time, routine descriptions, frequency, and scheduling.', canDo: 'Describe a short routine and negotiate a specific day and time.', mission: 'Propose, revise, and confirm a meeting time.', lessonIds: lessons.filter((item) => item.unitId === 'cantonese-daily').map((item) => item.id) },
	{ id: 'cantonese-food-places', sequence: 3, title: 'Food, prices, and places', nativeTitle: '點餐同地方', strapline: 'Classifiers, service requests, prices, totals, and simple locations.', canDo: 'Order common items, confirm a price, and ask where a place is.', mission: 'Complete an order and obtain one location in the same service exchange.', lessonIds: lessons.filter((item) => item.unitId === 'cantonese-food-places').map((item) => item.id) },
	{ id: 'cantonese-family-home', sequence: 4, title: 'Family and home', nativeTitle: '屋企人同屋企', strapline: 'Relationships, possession, household counts, rooms, and locations at home.', canDo: 'Identify family members, state who is in a household, describe a home, and locate a person, animal, or object.', mission: 'Give a connected description of a family and home with Cantonese classifiers and location patterns.', lessonIds: lessons.filter((item) => item.unitId === 'cantonese-family-home').map((item) => item.id) }
];

export const cantoneseA1Course: LanguageCourse = {
	id: 'cantonese-a1',
	slug: 'cantonese',
	title: 'Cantonese foundations: Jyutping to A1',
	languageName: 'Cantonese',
	nativeName: '廣東話',
	glyph: '粵',
	language: 'yue',
	htmlLanguage: 'yue-Hant-HK',
	studyLanguage: 'zh',
	speechLanguage: 'yue',
	readingLabel: 'Jyutping',
	level: 'Launchpad–A1',
	description: 'A 24-lesson introductory Cantonese course covering Jyutping, tones, Traditional Chinese, everyday exchanges, family and home descriptions, retrieval, open production, and transfer checks.',
	designPromise: 'Each lesson connects Traditional Chinese to Jyutping and meaning, checks a constrained target, requires original use, and ends with reduced support.',
	units,
	lessons
};
