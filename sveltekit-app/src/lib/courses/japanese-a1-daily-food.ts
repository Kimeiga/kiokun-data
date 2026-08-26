import type {
	ArrangeActivity,
	ChoiceActivity,
	CourseDialogueLine,
	CourseVocabularyItem,
	JapaneseLesson,
	ProductionActivity,
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

export const japaneseDailyFoodLessons: JapaneseLesson[] = [
	{
		id: 'u2-01-clock-time',
		sequence: 10,
		unitId: 'daily-time',
		title: 'Clock time',
		shortTitle: 'Clock time',
		kind: 'core',
		durationMinutes: 15,
		canDo: 'Ask what time it is and understand an hour or half-hour answer.',
		focus: ['今何時ですか', '時 and 分', '半'],
		scenario: [
			line('マヤ', '今、何時ですか。', 'いま、なんじ ですか。', 'What time is it now?'),
			line('健', '七時半です。', 'しちじはん です。', 'It is 7:30.')
		],
		notice: [
			'何 is read なん before 時: 何時, なんじ.',
			'半 means half past the hour; it replaces the need to say 三十分 in ordinary answers.'
		],
		explanation: [
			'Put the hour before 時 and minutes before 分. Several number readings change in clock expressions, so learn them with the full time.',
			'Use 今 to anchor the question to now. In context, 何時ですか alone can be enough.'
		],
		vocabulary: [
			word('今', 'いま', 'now'),
			word('何時', 'なんじ', 'what time'),
			word('七時', 'しちじ', 'seven o’clock'),
			word('半', 'はん', 'half'),
			word('分', 'ふん／ぷん', 'minute')
		],
		activities: [
			choice(
				'u201-time',
				'What time is 七時半?',
				[['730', '7:30'], ['700', '7:00'], ['630', '6:30']],
				'730',
				'七時 is seven o’clock and 半 adds half an hour.'
			),
			arrange(
				'u201-build',
				'Build “What time is it now?”',
				['ですか', '何時', '今', '半'],
				['今', '何時', 'ですか'],
				'What time is it now?',
				'The time word 今 comes before the question expression 何時ですか.'
			),
			typeIn(
				'u201-recall',
				'Type “It is 7:30.”',
				['七時半です', 'しちじはんです'],
				'七時半です。',
				'Kanji or kana is accepted.'
			),
			produce(
				'u201-speak',
				'speak',
				'Ask the time, then answer with a different hour or half-hour.',
				'今、何時ですか。九時半です。',
				'いま、なんじ ですか。くじはん です。',
				['Question uses 何時', 'Answer uses 時', 'Half-hour uses 半 when needed']
			)
		],
		transferPrompt: 'Answer 今、何時ですか with the actual current hour or a fictional half-hour.',
		transferSupport: 'Number + 時; add 半 for :30.'
	},
	{
		id: 'u2-02-routine',
		sequence: 11,
		unitId: 'daily-time',
		title: 'Daily routine statements',
		shortTitle: 'Daily routine',
		kind: 'core',
		durationMinutes: 16,
		canDo: 'Say when one everyday action happens.',
		focus: ['time + に', 'polite verbs', 'を as object marker'],
		scenario: [
			line('健', '七時に起きます。', 'しちじ に おきます。', 'I get up at seven.'),
			line('健', '八時に朝ご飯を食べます。', 'はちじ に あさごはん を たべます。', 'I eat breakfast at eight.')
		],
		notice: [
			'に marks the point in time when an event happens.',
			'を marks what the action affects: 朝ご飯を食べます.'
		],
		explanation: [
			'The polite non-past ending ます can describe habits or future actions. Context tells you which.',
			'Japanese usually omits “I” in a routine description because the speaker remains the understood topic.'
		],
		vocabulary: [
			word('起きます', 'おきます', 'get up', undefined, '起きる'),
			word('食べます', 'たべます', 'eat', undefined, '食べる'),
			word('朝ご飯', 'あさごはん', 'breakfast'),
			word('寝ます', 'ねます', 'sleep; go to bed', undefined, '寝る'),
			word('毎日', 'まいにち', 'every day')
		],
		activities: [
			choice(
				'u202-particle',
				'Which particle marks seven as the action time in 七時___起きます?',
				[['ni', 'に'], ['wo', 'を'], ['kara', 'から']],
				'ni',
				'に marks a specific time point.'
			),
			arrange(
				'u202-build',
				'Build “I eat breakfast at eight.”',
				['食べます', '八時', '朝ご飯', 'を', 'に'],
				['八時', 'に', '朝ご飯', 'を', '食べます'],
				'I eat breakfast at eight.',
				'Time + に comes before the object + を and the verb.'
			),
			produce(
				'u202-write',
				'write',
				'Write two true or fictional routine lines with different times.',
				'七時に起きます。十一時に寝ます。',
				'しちじ に おきます。じゅういちじ に ねます。',
				['Two time expressions', 'に after each time', 'A polite ます verb']
			)
		],
		transferPrompt: 'Describe the same action on a different day or at a different hour.',
		transferSupport: 'Keep に + verb; replace only the time.'
	},
	{
		id: 'u2-03-frequency',
		sequence: 12,
		unitId: 'daily-time',
		title: 'Frequency and negation',
		shortTitle: 'Frequency',
		kind: 'core',
		durationMinutes: 14,
		canDo: 'Add a simple frequency to a routine and understand a negative routine.',
		focus: ['よく・時々・あまり', 'ません negative', 'frequency before the verb'],
		scenario: [
			line('マヤ', 'よくコーヒーを飲みます。', 'よく こーひー を のみます。', 'I often drink coffee.'),
			line('健', 'わたしはあまり飲みません。', 'わたし は あまり のみません。', 'I do not drink it very often.')
		],
		notice: [
			'Frequency adverbs normally appear before the verb phrase.',
			'あまり pairs with a negative form: あまり飲みません.'
		],
		explanation: [
			'よく means often and 時々 means sometimes. These are useful approximations, not exact percentages.',
			'Change ます to ません for a polite present/future negative.'
		],
		vocabulary: [
			word('よく', 'よく', 'often'),
			word('時々', 'ときどき', 'sometimes'),
			word('あまり', 'あまり', 'not very; not often', 'Normally used with a negative'),
			word('飲みます', 'のみます', 'drink', undefined, '飲む'),
			word('コーヒー', 'コーヒー', 'coffee')
		],
		activities: [
			choice(
				'u203-pair',
				'Which ending normally completes あまりコーヒーを…?',
				[['negative', '飲みません'], ['positive', '飲みます'], ['identity', 'です']],
				'negative',
				'あまり conventionally pairs with a negative predicate.'
			),
			arrange(
				'u203-build',
				'Build “I sometimes drink tea.”',
				['飲みます', '時々', 'お茶', 'を'],
				['時々', 'お茶', 'を', '飲みます'],
				'I sometimes drink tea.',
				'The frequency comes before the object and verb.'
			),
			produce(
				'u203-speak',
				'speak',
				'Say one thing you often do and one thing you do not do very often.',
				'よく本を読みます。あまりテレビを見ません。',
				'よく ほん を よみます。あまり てれび を みません。',
				['よく with an affirmative verb', 'あまり with ません', 'Two different actions']
			)
		],
		transferPrompt: 'Change your two actions and say the contrast again without the model.',
		transferSupport: 'よく ___ます。あまり ___ません。'
	},
	{
		id: 'u2-04-arrange-change',
		sequence: 13,
		unitId: 'daily-time',
		title: 'Scheduling and changes',
		shortTitle: 'Arrange a time',
		kind: 'core',
		durationMinutes: 17,
		canDo: 'Propose a meeting time, respond, and suggest one change.',
		focus: ['X 時はどうですか', '大丈夫です', 'ちょっと… as soft difficulty'],
		scenario: [
			line('健', '土曜日の三時はどうですか。', 'どようび の さんじ は どう ですか。', 'How about Saturday at three?'),
			line('マヤ', '三時はちょっと…。四時はどうですか。', 'さんじ は ちょっと…。よじ は どう ですか。', 'Three is a little difficult… How about four?'),
			line('健', '四時、大丈夫です。', 'よじ、だいじょうぶ です。', 'Four works for me.')
		],
		notice: [
			'X はどうですか asks how a proposed option is.',
			'ちょっと… can leave the refusal unfinished; the hesitation is understood in polite conversation.'
		],
		explanation: [
			'Do not translate 大丈夫です mechanically as “I’m okay.” Here it means the proposed time works.',
			'After declining indirectly, offer a replacement to keep the planning task moving.'
		],
		vocabulary: [
			word('土曜日', 'どようび', 'Saturday'),
			word('どう', 'どう', 'how; what about'),
			word('ちょっと', 'ちょっと', 'a little; a bit', 'Can soften a refusal'),
			word('大丈夫', 'だいじょうぶ', 'all right; workable'),
			word('四時', 'よじ', 'four o’clock')
		],
		activities: [
			choice(
				'u204-response',
				'What does 四時、大丈夫です mean in this exchange?',
				[['works', 'Four o’clock works'], ['unsafe', 'Four o’clock is dangerous'], ['late', 'Four o’clock is late']],
				'works',
				'大丈夫 evaluates the proposed time as workable.'
			),
			arrange(
				'u204-build',
				'Build “How about four?”',
				['ですか', '四時', 'どう', 'は'],
				['四時', 'は', 'どう', 'ですか'],
				'How about four?',
				'The proposed option is marked by は before どうですか.'
			),
			produce(
				'u204-speak',
				'speak',
				'Decline three o’clock softly and propose five o’clock.',
				'三時はちょっと…。五時はどうですか。',
				'さんじ は ちょっと…。ごじ は どう ですか。',
				['Original time named', 'Soft ちょっと…', 'Replacement + はどうですか']
			)
		],
		transferPrompt: 'Your partner rejects five. Propose a different day or hour and get confirmation.',
		transferSupport: 'Change the option, not the planning frame.'
	},
	{
		id: 'u2-05-routine-mission',
		sequence: 14,
		unitId: 'daily-time',
		title: 'Mission: routines and scheduling',
		shortTitle: 'Routine mission',
		kind: 'mission',
		durationMinutes: 20,
		canDo: 'Exchange routine information, find a workable time, and confirm it.',
		focus: ['routine details', 'frequency', 'proposal', 'change and confirmation'],
		scenario: [
			line('マヤ', '土曜日は何時に起きますか。', 'どようび は なんじ に おきますか。', 'What time do you get up on Saturday?'),
			line('健', '九時に起きます。午後二時はどうですか。', 'くじ に おきます。ごご にじ は どう ですか。', 'I get up at nine. How about 2 p.m.?'),
			line('マヤ', '二時、大丈夫です。', 'にじ、だいじょうぶ です。', 'Two works.')
		],
		notice: [
			'The first question gathers information that helps make the later proposal.',
			'A successful mission ends with a shared, explicit time.'
		],
		explanation: [
			'Ask one genuine routine question before planning. Use the answer rather than jumping to a memorized proposal.',
			'If the first proposal fails, offer one alternative and confirm the final choice.'
		],
		vocabulary: [
			word('午後', 'ごご', 'p.m.; afternoon'),
			word('午前', 'ごぜん', 'a.m.; morning'),
			word('何時', 'なんじ', 'what time'),
			word('会います', 'あいます', 'meet', undefined, '会う')
		],
		activities: [
			choice(
				'u205-outcome',
				'What proves the planning part succeeded?',
				[['shared', 'Both people confirm the same time'], ['verbs', 'Both use three different verbs'], ['fast', 'The exchange is under ten seconds']],
				'shared',
				'The observable outcome is a mutually understood plan.'
			),
			typeIn(
				'u205-confirm',
				'Accept a proposal for 2 p.m.',
				['午後二時大丈夫です', 'ごごにじだいじょうぶです', '二時大丈夫です', 'にじだいじょうぶです'],
				'午後二時、大丈夫です。',
				'Punctuation and 午後 are optional when context already establishes the afternoon.'
			),
			produce(
				'u205-mission',
				'speak',
				'Ask about one routine, propose a meeting time, respond to one change, and confirm the final time.',
				'土曜日は何時に起きますか。九時に起きます。午後二時はどうですか。二時はちょっと…。三時はどうですか。三時、大丈夫です。',
				'どようび は なんじ に おきますか。くじ に おきます。ごご にじ は どう ですか。にじ は ちょっと…。さんじ は どう ですか。さんじ、だいじょうぶ です。',
				['One routine question', 'One time proposal', 'One changed option', 'One explicit confirmation']
			)
		],
		transferPrompt: 'Run the mission again for a weekday with a different routine and two unfamiliar times.',
		transferSupport: 'Preserve the outcome; vary every time and routine detail.'
	},
	{
		id: 'u3-01-menu',
		sequence: 15,
		unitId: 'food-ordering',
		title: 'Reading a menu',
		shortTitle: 'Menu basics',
		kind: 'reader',
		durationMinutes: 15,
		canDo: 'Identify three common menu items and their prices.',
		focus: ['katakana loanwords', '円 prices', 'ください'],
		scenario: [
			line('メニュー', 'ラーメン　八百円', 'らーめん　はっぴゃくえん', 'Ramen — ¥800'),
			line('メニュー', 'カレー　七百円', 'かれー　ななひゃくえん', 'Curry — ¥700'),
			line('メニュー', '水　百円', 'みず　ひゃくえん', 'Water — ¥100')
		],
		notice: [
			'Katakana often marks loanwords such as ラーメン and カレー.',
			'円 follows the number. 百 and 八百 have compressed sound changes: ひゃく, はっぴゃく.'
		],
		explanation: [
			'Read a menu for a decision, not for total translation: item, price, and any restriction are the high-value fields.',
			'The long vowel mark ー extends the preceding katakana vowel: レー in カレー.'
		],
		vocabulary: [
			word('ラーメン', 'ラーメン', 'ramen'),
			word('カレー', 'カレー', 'curry'),
			word('水', 'みず', 'water'),
			word('円', 'えん', 'yen'),
			word('メニュー', 'メニュー', 'menu')
		],
		activities: [
			choice(
				'u301-price',
				'Which item costs 七百円?',
				[['curry', 'カレー'], ['ramen', 'ラーメン'], ['water', '水']],
				'curry',
				'The menu line pairs カレー with 七百円.'
			),
			arrange(
				'u301-build',
				'Build “Ramen, please.”',
				['ください', 'ラーメン', '水'],
				['ラーメン', 'ください'],
				'Ramen, please.',
				'Item + ください is a direct, common counter request.'
			),
			typeIn(
				'u301-recall',
				'Type the menu word for water.',
				['水', 'みず'],
				'水',
				'Both the menu kanji and its kana reading are accepted.'
			),
			produce(
				'u301-read-new',
				'speak',
				'Read the three menu items and prices aloud, then say which one you would choose.',
				'ラーメン、八百円。カレー、七百円。水、百円。カレーをお願いします。',
				'らーめん、はっぴゃくえん。かれー、ななひゃくえん。みず、ひゃくえん。かれー を おねがいします。',
				['Item and price paired', 'Long katakana vowels held', 'One choice stated']
			)
		],
		transferPrompt: 'Scan a new three-line menu and choose the least expensive item without translating every symbol.',
		transferSupport: 'Find 円 first, then compare the numbers immediately before it.'
	},
	{
		id: 'u3-02-order',
		sequence: 16,
		unitId: 'food-ordering',
		title: 'Ordering food and drink',
		shortTitle: 'Order an item',
		kind: 'core',
		durationMinutes: 15,
		canDo: 'Order one item and one drink at a counter.',
		focus: ['X をお願いします', 'と for noun linking', 'これ'],
		scenario: [
			line('店員', 'ご注文は？', 'ごちゅうもん は？', 'What would you like to order?'),
			line('マヤ', 'ラーメンとお茶をお願いします。', 'らーめん と おちゃ を おねがいします。', 'Ramen and tea, please.'),
			line('店員', 'はい。', 'はい。', 'Certainly.')
		],
		notice: [
			'と links complete nouns as “and.”',
			'をお願いします makes a polite request for the selected item or service.'
		],
		explanation: [
			'X をお願いします is flexible and slightly more formal than X ください. Both are useful.',
			'If you cannot read an item name, point and use これをお願いします, “this one, please.”'
		],
		vocabulary: [
			word('注文', 'ちゅうもん', 'order'),
			word('お茶', 'おちゃ', 'tea'),
			word('これ', 'これ', 'this'),
			word('店員', 'てんいん', 'store or restaurant staff member'),
			word('お願いします', 'おねがいします', 'please', undefined, 'お願い')
		],
		activities: [
			choice(
				'u302-and',
				'Which particle links ラーメン and お茶?',
				[['to', 'と'], ['ni', 'に'], ['kara', 'から']],
				'to',
				'と joins the two requested nouns.'
			),
			arrange(
				'u302-build',
				'Build “This one, please.”',
				['これ', 'を', 'お願いします', 'は'],
				['これ', 'を', 'お願いします'],
				'This one, please.',
				'これ names the selected item and を marks it as the request object.'
			),
			produce(
				'u302-speak',
				'speak',
				'Order one food and one drink from the lesson vocabulary.',
				'カレーと水をお願いします。',
				'かれー と みず を おねがいします。',
				['Two items linked with と', 'を before お願いします', 'Polite, audible ending']
			)
		],
		transferPrompt: 'Order an unfamiliar pictured item by pointing rather than guessing its name.',
		transferSupport: 'Use これをお願いします.'
	},
	{
		id: 'u3-03-clarification',
		sequence: 17,
		unitId: 'food-ordering',
		title: 'Answering clarifying questions',
		shortTitle: 'Clarify the order',
		kind: 'core',
		durationMinutes: 16,
		canDo: 'Understand and answer a simple either-or clarification.',
		focus: ['A ですか、B ですか', 'A でお願いします', 'はい／いいえ limits'],
		scenario: [
			line('店員', '温かいお茶ですか、冷たいお茶ですか。', 'あたたかい おちゃ ですか、つめたい おちゃ ですか。', 'Hot tea or cold tea?'),
			line('マヤ', '冷たいお茶でお願いします。', 'つめたい おちゃ で おねがいします。', 'Cold tea, please.')
		],
		notice: [
			'The two alternatives are each followed by ですか.',
			'Answer with the chosen option, not only はい, because the question offers two choices.'
		],
		explanation: [
			'A でお願いします selects A as the form or option you want.',
			'Listen for contrast words before trying to parse the entire staff sentence.'
		],
		vocabulary: [
			word('温かい', 'あたたかい', 'warm; hot'),
			word('冷たい', 'つめたい', 'cold to the touch'),
			word('どちら', 'どちら', 'which of two; which way'),
			word('大きい', 'おおきい', 'large'),
			word('小さい', 'ちいさい', 'small')
		],
		activities: [
			choice(
				'u303-answer',
				'The staff asks 大きいですか、小さいですか. Which reply clearly selects small?',
				[['small', '小さいのでお願いします。'], ['yes', 'はい。'], ['no', 'いいえ。']],
				'small',
				'An either-or question needs the selected option in the answer.'
			),
			arrange(
				'u303-build',
				'Build “Cold tea, please.”',
				['お茶', '冷たい', 'で', 'お願いします'],
				['冷たい', 'お茶', 'で', 'お願いします'],
				'Cold tea, please.',
				'The selected noun phrase comes before でお願いします.'
			),
			produce(
				'u303-speak',
				'speak',
				'Answer a hot-or-cold clarification, then answer a large-or-small clarification.',
				'温かいのでお願いします。小さいのでお願いします。',
				'あたたかい ので おねがいします。ちいさい ので おねがいします。',
				['State the selected option', 'Use でお願いします', 'Two distinct answers']
			)
		],
		transferPrompt: 'Respond when the order of the two options is reversed.',
		transferSupport: 'Select by meaning; do not simply repeat the last option.'
	},
	{
		id: 'u3-04-restriction-total',
		sequence: 18,
		unitId: 'food-ordering',
		title: 'Food restrictions and totals',
		shortTitle: 'Restriction & total',
		kind: 'core',
		durationMinutes: 18,
		canDo: 'State one food restriction and check the total price.',
		focus: ['X は食べられません', '入っていますか', '全部でいくらですか'],
		scenario: [
			line('マヤ', '肉は食べられません。これは肉が入っていますか。', 'にく は たべられません。これは にく が はいっていますか。', 'I cannot eat meat. Does this contain meat?'),
			line('店員', 'いいえ、入っていません。', 'いいえ、はいっていません。', 'No, it does not.'),
			line('マヤ', '全部でいくらですか。', 'ぜんぶ で いくら ですか。', 'How much is it altogether?')
		],
		notice: [
			'X は食べられません states that X cannot be eaten by the speaker; it is useful as a whole safety phrase.',
			'入っていますか asks whether an ingredient is included or contained.'
		],
		explanation: [
			'For a real allergy, do not depend on one beginner sentence alone: carry a precise written allergy card and confirm with staff.',
			'全部で frames the price as the total for everything ordered.'
		],
		vocabulary: [
			word('肉', 'にく', 'meat'),
			word('食べられません', 'たべられません', 'cannot eat', undefined, '食べる'),
			word('入っています', 'はいっています', 'is contained; is included', undefined, '入る'),
			word('全部', 'ぜんぶ', 'all; altogether'),
			word('いくら', 'いくら', 'how much')
		],
		activities: [
			choice(
				'u304-safety',
				'What is the safest course for a serious allergy?',
				[['card', 'Use a precise allergy card and confirm with staff'], ['phrase', 'Rely on one memorized phrase only'], ['guess', 'Guess from the menu photo']],
				'card',
				'Beginner Japanese should not be the only safety control for a serious allergy.'
			),
			arrange(
				'u304-build',
				'Build “Does this contain meat?”',
				['肉', 'これは', '入っていますか', 'が'],
				['これは', '肉', 'が', '入っていますか'],
				'Does this contain meat?',
				'これは establishes the item; 肉が marks the ingredient being checked.'
			),
			typeIn(
				'u304-recall',
				'Ask “How much is it altogether?”',
				['全部でいくらですか', 'ぜんぶでいくらですか'],
				'全部でいくらですか。',
				'全部で sets the scope to the whole order.'
			),
			produce(
				'u304-speak',
				'speak',
				'State one restriction, ask whether an item contains it, then ask for the total.',
				'肉は食べられません。これは肉が入っていますか。全部でいくらですか。',
				'にく は たべられません。これは にく が はいっていますか。ぜんぶ で いくら ですか。',
				['Restriction named', 'Ingredient question asked', 'Total-price question asked']
			)
		],
		transferPrompt: 'Replace meat with another ingredient and ask the contained-ingredient question.',
		transferSupport: 'これは ___ が入っていますか.'
	},
	{
		id: 'u3-05-order-mission',
		sequence: 19,
		unitId: 'food-ordering',
		title: 'Mission: complete an order',
		shortTitle: 'Ordering mission',
		kind: 'mission',
		durationMinutes: 22,
		canDo: 'Read a menu, order, answer a clarification, handle one restriction, and confirm the total.',
		focus: ['menu scan', 'order request', 'clarification', 'restriction', 'total'],
		scenario: [
			line('店員', 'ご注文は？', 'ごちゅうもん は？', 'What would you like?'),
			line('あなた', 'カレーと冷たいお茶をお願いします。', 'かれー と つめたい おちゃ を おねがいします。', 'Curry and cold tea, please.'),
			line('店員', 'カレーは肉が入っています。', 'かれー は にく が はいっています。', 'The curry contains meat.'),
			line('あなた', 'では、ラーメンをお願いします。全部でいくらですか。', 'では、らーめん を おねがいします。ぜんぶ で いくら ですか。', 'Then ramen, please. How much is it altogether?')
		],
		notice: [
			'The learner changes the order after receiving new information; that repair is the mission’s central skill.',
			'では marks the consequence: “in that case, then…”'
		],
		explanation: [
			'Success is the correct final order and shared understanding, not preserving your first wording.',
			'Use short turns. Staff interaction rewards clear nouns, contrast, and confirmation.'
		],
		vocabulary: [
			word('では', 'では', 'then; in that case'),
			word('他', 'ほか', 'other; another'),
			word('会計', 'かいけい', 'bill; checkout'),
			word('お願いします', 'おねがいします', 'please', undefined, 'お願い')
		],
		activities: [
			choice(
				'u305-repair',
				'Why does the learner change the order?',
				[['meat', 'The first choice contains meat'], ['price', 'The tea is too expensive'], ['cold', 'The ramen is cold']],
				'meat',
				'The staff explicitly says the curry contains meat.'
			),
			typeIn(
				'u305-total',
				'Type the final total-price question.',
				['全部でいくらですか', 'ぜんぶでいくらですか'],
				'全部でいくらですか。',
				'This asks for the combined price after the order is settled.'
			),
			produce(
				'u305-mission',
				'speak',
				'Choose from a menu, order food and a drink, answer one clarification, state one restriction, change one item, and ask for the total.',
				'ラーメンとお茶をお願いします。冷たいお茶でお願いします。肉は食べられません。これは肉が入っていますか。では、これをお願いします。全部でいくらですか。',
				'らーめん と おちゃ を おねがいします。つめたい おちゃ で おねがいします。にく は たべられません。これは にく が はいっていますか。では、これ を おねがいします。ぜんぶ で いくら ですか。',
				['Food and drink ordered', 'Clarification answered', 'Restriction communicated', 'Order repaired', 'Total requested']
			)
		],
		transferPrompt: 'Repeat with an unfamiliar menu layout and a different unavailable or unsuitable item.',
		transferSupport: 'Keep the task sequence; change all item names and the source of the problem.'
	}
];
