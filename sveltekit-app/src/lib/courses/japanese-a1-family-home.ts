import { lesson } from './authoring';
import type { JapaneseLesson } from './types';

export const japaneseFamilyHomeLessons: JapaneseLesson[] = [
	lesson({
		id: 'u5-01-family-photo',
		unitId: 'family-home',
		title: 'Identifying family members',
		shortTitle: 'Family photo',
		canDo: 'Identify one person in a family photo and state that person’s relationship to you.',
		focus: ['これは誰ですか', '私の + family noun', '姉 versus お姉さん'],
		scenario: [
			['アミール', 'これは誰ですか。', 'これ は だれ ですか。', 'Who is this?'],
			['美咲', '私の姉です。東京に住んでいます。', 'わたし の あね です。とうきょう に すんで います。', 'She is my older sister. She lives in Tokyo.']
		],
		notice: [
			'誰 asks for a person’s identity; これ identifies the person shown in the photo.',
			'の connects 私 to 姉 and marks the relationship as “my older sister.”'
		],
		explanation: [
			'Use 姉 for your own older sister when speaking to someone outside your family. お姉さん commonly refers to another person’s older sister or addresses an older sister.',
			'Place + に住んでいます states where someone lives. The person can be omitted after the photo establishes who is being discussed.'
		],
		vocabulary: [
			['誰', 'だれ', 'who'],
			['姉', 'あね', 'one’s own older sister'],
			['私', 'わたし', 'I; me'],
			['住む', 'すむ', 'live; reside']
		],
		choice: {
			prompt: 'What information does これは誰ですか request?',
			options: [['person', 'The person’s identity'], ['place', 'The person’s location'], ['age', 'The person’s age']],
			answer: 'person',
			rationale: '誰 means “who” and asks for a person’s identity.'
		},
		reviewChoices: [{
			prompt: 'Which phrase identifies your own older sister?',
			options: [['ane', '私の姉'], ['imouto', '私の妹'], ['ani', '私の兄']],
			answer: 'ane',
			rationale: '姉 is the standard noun for your own older sister when speaking outside the family.'
		}],
		arrange: {
			prompt: 'Build “She is my older sister.”',
			tiles: ['です', '私の', '姉', 'お姉さん'],
			answer: ['私の', '姉', 'です'],
			translation: 'She is my older sister.',
			rationale: '私の modifies 姉, and です completes the polite identification.'
		},
		production: {
			mode: 'speak',
			prompt: 'Identify one person in a photo and say where that person lives.',
			modelAnswer: '私の姉です。東京に住んでいます。',
			modelReading: 'わたし の あね です。とうきょう に すんで います。',
			checklist: ['Relationship uses 私の', 'Own-family noun is appropriate', 'Residence uses place + に住んでいます']
		},
		transferPrompt: 'Identify a different family member and replace Tokyo with a real or invented place.',
		transferSupport: '私の…です。…に住んでいます。'
	}),
	lesson({
		id: 'u5-02-family-existence',
		unitId: 'family-home',
		title: 'Saying who is in your family',
		shortTitle: 'Who is in the family',
		canDo: 'Ask whether someone has siblings and give a counted answer about your own family.',
		focus: ['兄弟がいますか', 'animate います', '一人・二人'],
		scenario: [
			['美咲', '兄弟がいますか。', 'きょうだい が いますか。', 'Do you have any siblings?'],
			['アミール', 'はい、弟が一人います。', 'はい、おとうと が ひとり います。', 'Yes, I have one younger brother.']
		],
		notice: [
			'います expresses the existence or presence of people and animals.',
			'一人 is the irregular reading for one person; 二人 is read ふたり.'
		],
		explanation: [
			'Japanese commonly expresses “have” by saying that a person or thing exists in someone’s family or situation.',
			'Use あります for most inanimate things. Choosing います or あります depends on what exists, not on the speaker.'
		],
		vocabulary: [
			['兄弟', 'きょうだい', 'siblings'],
			['弟', 'おとうと', 'one’s own younger brother'],
			['一人', 'ひとり', 'one person'],
			['いる', 'いる', 'exist; be present (animate)']
		],
		choice: {
			prompt: 'Which existence verb fits a younger brother?',
			options: [['imasu', 'います'], ['arimasu', 'あります'], ['desu', 'です only']],
			answer: 'imasu',
			rationale: 'People and animals normally take います.'
		},
		reviewChoices: [{
			prompt: 'Which sentence says “I have one younger brother”?',
			options: [['one', '弟が一人います。'], ['thing', '弟が一つあります。'], ['two', '弟が二人います。']],
			answer: 'one',
			rationale: 'One person is counted with 一人 and followed by the animate verb います.'
		}],
		arrange: {
			prompt: 'Build “I have one younger brother.”',
			tiles: ['一人', 'あります', '弟が', 'います'],
			answer: ['弟が', '一人', 'います'],
			translation: 'I have one younger brother.',
			rationale: 'The person marked by が is followed by the count and animate existence verb.'
		},
		production: {
			mode: 'speak',
			prompt: 'Ask about siblings and answer with a number and relationship.',
			modelAnswer: '兄弟がいますか。はい、弟が一人います。',
			modelReading: 'きょうだい が いますか。はい、おとうと が ひとり います。',
			checklist: ['Question ends in いますか', 'Answer names a relationship', 'People use the correct counter and います']
		},
		transferPrompt: 'Give a new answer with zero, one, or two siblings and use the matching number expression.',
		transferSupport: 'いません。／…が一人います。／…が二人います。'
	}),
	lesson({
		id: 'u5-03-home-rooms',
		unitId: 'family-home',
		title: 'Rooms and location at home',
		shortTitle: 'Rooms at home',
		canDo: 'Ask how many rooms a home has and locate a person or animal inside it.',
		focus: ['うちには…があります', 'いくつ・三つ', 'place + にいます'],
		scenario: [
			['アミール', 'うちには部屋がいくつありますか。', 'うち には へや が いくつ ありますか。', 'How many rooms does your home have?'],
			['美咲', '三つあります。猫はリビングにいます。', 'みっつ あります。ねこ は りびんぐ に います。', 'It has three. The cat is in the living room.']
		],
		notice: [
			'いくつ asks for a quantity when no specialized counter is required in this beginner pattern.',
			'部屋 takes あります, while 猫 takes います. Both location phrases use に.'
		],
		explanation: [
			'には combines the location particle に with topic は and frames the home as the setting under discussion.',
			'The general counter series is 一つ, 二つ, 三つ, and so on. The answer can omit 部屋 when the question already establishes it.'
		],
		vocabulary: [
			['家', 'うち', 'home', 'うち refers to one’s home in this lesson.', '家'],
			['部屋', 'へや', 'room'],
			['いくつ', 'いくつ', 'how many'],
			['猫', 'ねこ', 'cat'],
			['リビング', 'リビング', 'living room']
		],
		choice: {
			prompt: 'How many rooms are in the example home?',
			options: [['three', 'Three'], ['one', 'One'], ['five', 'Five']],
			answer: 'three',
			rationale: '三つあります states that there are three.'
		},
		reviewChoices: [{
			prompt: 'Which sentence correctly locates a cat in the living room?',
			options: [['animate', '猫はリビングにいます。'], ['inanimate', '猫はリビングにあります。'], ['identity', '猫はリビングです。']],
			answer: 'animate',
			rationale: 'A cat is animate, so its presence is expressed with います.'
		}],
		arrange: {
			prompt: 'Build “The cat is in the living room.”',
			tiles: ['リビングに', '猫は', 'あります', 'います'],
			answer: ['猫は', 'リビングに', 'います'],
			translation: 'The cat is in the living room.',
			rationale: 'The location marked by に precedes the animate existence verb います.'
		},
		production: {
			mode: 'speak',
			prompt: 'State how many rooms a home has and locate one person, animal, or object.',
			modelAnswer: '部屋が三つあります。猫はリビングにいます。',
			modelReading: 'へや が みっつ あります。ねこ は りびんぐ に います。',
			checklist: ['Room count uses つ', 'Location uses に', 'Existence verb matches animate or inanimate subject']
		},
		transferPrompt: 'Change the room count and locate an inanimate object with あります instead of います.',
		transferSupport: '部屋が…つあります。…は…にあります。'
	}),
	lesson({
		id: 'u5-04-family-home-mission',
		unitId: 'family-home',
		title: 'Mission: describe a family and home',
		shortTitle: 'Family and home mission',
		kind: 'mission',
		durationMinutes: 20,
		canDo: 'Give a short connected description of family size, relationships, residence, and one home location.',
		focus: ['何人', '両親と姉と私', '住んでいます', 'います／あります'],
		scenario: [
			['アミール', '家族は何人ですか。', 'かぞく は なんにん ですか。', 'How many people are in your family?'],
			['美咲', '四人です。両親と姉と私です。大阪のアパートに住んでいます。猫もいます。', 'よにん です。りょうしん と あね と わたし です。おおさか の あぱーと に すんで います。ねこ も います。', 'There are four of us: my parents, my older sister, and me. We live in an apartment in Osaka. We also have a cat.']
		],
		notice: [
			'何人 asks how many people; 四人 is read よにん rather than よんにん.',
			'と links the listed family members, and も adds the cat as another member of the description.'
		],
		explanation: [
			'A connected answer can move from family count to identities, residence, and one additional detail without repeating 私たちは in every sentence.',
			'The mission requires choosing います or あります from meaning rather than copying a single memorized pattern.'
		],
		vocabulary: [
			['家族', 'かぞく', 'family'],
			['何人', 'なんにん', 'how many people'],
			['両親', 'りょうしん', 'one’s parents'],
			['四人', 'よにん', 'four people'],
			['アパート', 'アパート', 'apartment']
		],
		choice: {
			prompt: 'How many people are in Misaki’s family description?',
			options: [['four', 'Four'], ['three', 'Three'], ['five', 'Five']],
			answer: 'four',
			rationale: '四人です gives the family count as four.'
		},
		reviewChoices: [{
			prompt: 'Which phrase correctly states residence in an Osaka apartment?',
			options: [['ni', '大阪のアパートに住んでいます。'], ['de', '大阪のアパートで住んでいます。'], ['wo', '大阪のアパートを住んでいます。']],
			answer: 'ni',
			rationale: 'The residence pattern uses place + に住んでいます.'
		}],
		arrange: {
			prompt: 'Build “We also have a cat.”',
			tiles: ['います', '猫も', 'あります', '猫が'],
			answer: ['猫も', 'います'],
			translation: 'We also have a cat.',
			rationale: 'も adds the cat, and an animal takes います.'
		},
		production: {
			mode: 'speak',
			prompt: 'Describe a real or invented family and home in at least four connected statements.',
			modelAnswer: '家族は四人です。両親と姉と私です。大阪に住んでいます。部屋が三つあります。',
			modelReading: 'かぞく は よにん です。りょうしん と あね と わたし です。おおさか に すんで います。へや が みっつ あります。',
			checklist: ['Family count uses 人', 'At least one relationship is named', 'Residence uses に住んでいます', 'One existence statement uses います or あります correctly']
		},
		transferPrompt: 'Repeat the description with a different family size, city, room count, and home-location detail.',
		transferSupport: '家族は…人です。…と…です。…に住んでいます。…があります／います。'
	})
];
