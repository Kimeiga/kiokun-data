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

export const japanesePlacesLessons: JapaneseLesson[] = [
	{
		id: 'u4-01-find-place',
		sequence: 20,
		unitId: 'places-plans',
		title: 'Asking for locations',
		shortTitle: 'Find a place',
		kind: 'core',
		durationMinutes: 15,
		canDo: 'Ask for a place and understand a simple location answer.',
		focus: ['X はどこですか', 'ここ・そこ・あそこ', 'X の隣'],
		scenario: [
			line('マヤ', '駅はどこですか。', 'えき は どこ ですか。', 'Where is the station?'),
			line('健', 'あそこです。コンビニの隣です。', 'あそこ です。こんびに の となり です。', 'It is over there. It is next to the convenience store.')
		],
		notice: [
			'どこ asks for a place. The place being located is marked by は.',
			'X の隣 means “next to X”; の connects the reference place to the location word.'
		],
		explanation: [
			'ここ is near the speaker, そこ near the listener, and あそこ away from both.',
			'Location answers can be short because the missing subject is already established.'
		],
		vocabulary: [
			word('駅', 'えき', 'station'),
			word('どこ', 'どこ', 'where'),
			word('あそこ', 'あそこ', 'over there'),
			word('隣', 'となり', 'next to; neighboring'),
			word('コンビニ', 'コンビニ', 'convenience store')
		],
		activities: [
			choice(
				'u401-location',
				'Where is the station?',
				[['next', 'Next to the convenience store'], ['inside', 'Inside the convenience store'], ['behind', 'Behind the speaker']],
				'next',
				'コンビニの隣 means next to the convenience store.'
			),
			arrange(
				'u401-build',
				'Build “Where is the station?”',
				['どこ', '駅', 'ですか', 'は'],
				['駅', 'は', 'どこ', 'ですか'],
				'Where is the station?',
				'The place is the topic before は; どこ fills the unknown location.'
			),
			typeIn(
				'u401-recall',
				'Type “It is over there.”',
				['あそこです'],
				'あそこです。',
				'The established place can be omitted from the answer.'
			),
			produce(
				'u401-speak',
				'speak',
				'Ask where a restroom is and give a simple landmark answer.',
				'トイレはどこですか。コンビニの隣です。',
				'といれ は どこ ですか。こんびに の となり です。',
				['Place + はどこですか', 'Reference place + の', 'Location word 隣']
			)
		],
		transferPrompt: 'Ask for a restroom and understand an answer that uses ここ or そこ instead of あそこ.',
		transferSupport: 'Replace 駅 with トイレ; listen for the distance word.'
	},
	{
		id: 'u4-02-directions',
		sequence: 21,
		unitId: 'places-plans',
		title: 'Two-step directions',
		shortTitle: 'Directions',
		kind: 'core',
		durationMinutes: 17,
		canDo: 'Follow a short direction containing one movement and one turn.',
		focus: ['まっすぐ行ってください', '右／左に曲がってください', 'て-form sequence'],
		scenario: [
			line('健', 'まっすぐ行ってください。', 'まっすぐ いって ください。', 'Please go straight.'),
			line('健', '二つ目の角を右に曲がってください。', 'ふたつめ の かど を みぎ に まがって ください。', 'Please turn right at the second corner.'),
			line('マヤ', '二つ目を右ですね。', 'ふたつめ を みぎ です ね。', 'The second one, to the right—correct?')
		],
		notice: [
			'The て-form connects the movement to ください, creating a polite instruction.',
			'Repeating the key landmark and direction checks understanding efficiently.'
		],
		explanation: [
			'Treat these as high-frequency direction chunks now. A later lesson can generalize て-form construction.',
			'に marks the direction of the turn: 右に, to the right.'
		],
		vocabulary: [
			word('まっすぐ', 'まっすぐ', 'straight ahead'),
			word('行って', 'いって', 'go and…', 'て-form of 行く', '行く'),
			word('角', 'かど', 'corner'),
			word('右', 'みぎ', 'right'),
			word('左', 'ひだり', 'left'),
			word('曲がって', 'まがって', 'turn and…', 'て-form of 曲がる', '曲がる')
		],
		activities: [
			choice(
				'u402-turn',
				'What action does 右に曲がってください request?',
				[['right', 'Turn right'], ['left', 'Turn left'], ['straight', 'Go straight']],
				'right',
				'右 is right and 曲がってください asks the listener to turn.'
			),
			arrange(
				'u402-build',
				'Build “Please go straight.”',
				['ください', 'まっすぐ', '行って', '右'],
				['まっすぐ', '行って', 'ください'],
				'Please go straight.',
				'Direction adverb + て-form + ください forms the instruction.'
			),
			produce(
				'u402-speak',
				'speak',
				'Give a two-step direction: go straight, then turn left.',
				'まっすぐ行ってください。それから、左に曲がってください。',
				'まっすぐ いって ください。それから、ひだり に まがって ください。',
				['First movement', 'Sequence marker それから', 'Left turn with に']
			)
		],
		transferPrompt: 'Follow the same two instructions when the turn direction and landmark change.',
		transferSupport: 'Hold the route in two chunks: movement, then turn.'
	},
	{
		id: 'u4-03-invite',
		sequence: 22,
		unitId: 'places-plans',
		title: 'Invitations',
		shortTitle: 'Make an invitation',
		kind: 'core',
		durationMinutes: 16,
		canDo: 'Invite someone to a familiar activity and respond positively or softly decline.',
		focus: ['一緒に X ませんか', 'いいですね', 'その日はちょっと…'],
		scenario: [
			line('マヤ', '日曜日、一緒に映画を見ませんか。', 'にちようび、いっしょ に えいが を みませんか。', 'Would you like to see a movie together on Sunday?'),
			line('健', 'いいですね。', 'いい です ね。', 'That sounds good.'),
			line('マヤ', 'では、二時はどうですか。', 'では、にじ は どう ですか。', 'Then how about two?')
		],
		notice: [
			'A negative question with ませんか functions as an invitation, not as a pessimistic statement.',
			'いいですね evaluates the idea positively and invites the planning to continue.'
		],
		explanation: [
			'Put the shared activity before ませんか. 一緒に makes “together” explicit.',
			'For a soft decline, name the difficult day or option with は and use ちょっと… before offering an alternative.'
		],
		vocabulary: [
			word('一緒に', 'いっしょに', 'together'),
			word('映画', 'えいが', 'movie'),
			word('見ませんか', 'みませんか', 'would you like to see/watch?', undefined, '見る'),
			word('日曜日', 'にちようび', 'Sunday'),
			word('いい', 'いい', 'good')
		],
		activities: [
			choice(
				'u403-function',
				'What is 日曜日、一緒に映画を見ませんか doing?',
				[['invite', 'Inviting someone to a movie'], ['refuse', 'Refusing a movie'], ['report', 'Reporting a weekly habit']],
				'invite',
				'The ませんか question is a conventional invitation.'
			),
			arrange(
				'u403-build',
				'Build “Would you like to see a movie together?”',
				['映画', '一緒に', 'を', '見ませんか'],
				['一緒に', '映画', 'を', '見ませんか'],
				'Would you like to see a movie together?',
				'一緒に frames the joint activity; 映画を is the object of 見る.'
			),
			produce(
				'u403-speak',
				'speak',
				'Invite someone to eat together on Saturday.',
				'土曜日、一緒にご飯を食べませんか。',
				'どようび、いっしょ に ごはん を たべませんか。',
				['Day named', '一緒に included', 'Activity ends in ませんか']
			)
		],
		transferPrompt: 'Respond to a new invitation with a soft decline and offer another day.',
		transferSupport: 'その日はちょっと…。___曜日はどうですか.'
	},
	{
		id: 'u4-04-confirm-plan',
		sequence: 23,
		unitId: 'places-plans',
		title: 'Confirming time and place',
		shortTitle: 'Confirm the plan',
		kind: 'reader',
		durationMinutes: 16,
		canDo: 'Read a short planning message and confirm the meeting place and time.',
		focus: ['X で会いましょう', 'message compression', 'ね for confirmation'],
		scenario: [
			line('メッセージ', '日曜日、二時に駅で会いましょう。', 'にちようび、にじ に えき で あいましょう。', 'Let’s meet at the station at two on Sunday.'),
			line('返信', 'はい。日曜日の二時、駅ですね。', 'はい。にちようび の にじ、えき です ね。', 'Yes. Sunday at two, at the station—right.')
		],
		notice: [
			'に marks the time; で marks the place where the meeting action happens.',
			'The reply repeats the critical details and uses ね to seek shared confirmation.'
		],
		explanation: [
			'会いましょう is a “let’s meet” proposal. It moves from an invitation to a concrete shared action.',
			'Real messages often omit particles and full sentences. Extract day, time, place, and action first.'
		],
		vocabulary: [
			word('会いましょう', 'あいましょう', 'let’s meet', undefined, '会う'),
			word('駅', 'えき', 'station'),
			word('日曜日', 'にちようび', 'Sunday'),
			word('返信', 'へんしん', 'reply'),
			word('予定', 'よてい', 'plan; schedule')
		],
		activities: [
			choice(
				'u404-place',
				'Where will they meet?',
				[['station', 'At the station'], ['cinema', 'At the cinema'], ['store', 'At a convenience store']],
				'station',
				'駅で marks the station as the meeting location.'
			),
			arrange(
				'u404-build',
				'Build “Let’s meet at the station at two.”',
				['会いましょう', '二時', '駅', 'に', 'で'],
				['二時', 'に', '駅', 'で', '会いましょう'],
				'Let’s meet at the station at two.',
				'Time takes に, activity location takes で, and the proposal ends the sentence.'
			),
			typeIn(
				'u404-confirm',
				'Confirm: “Sunday at two, at the station—right.”',
				['日曜日の二時駅ですね', 'にちようびのにじえきですね', '日曜日二時駅ですね'],
				'日曜日の二時、駅ですね。',
				'Punctuation is optional; the reply must preserve day, time, and place.'
			),
			produce(
				'u404-write',
				'write',
				'Write a new confirmation message with a different day, time, and meeting place.',
				'土曜日の三時、カフェですね。',
				'どようび の さんじ、かふぇ です ね。',
				['Day included', 'Time included', 'Place included', 'ね requests confirmation']
			)
		],
		transferPrompt: 'Read a new message with a different day, time, and place, then reply with all three details.',
		transferSupport: 'Underline day → time → place before writing the reply.'
	},
	{
		id: 'u4-05-plan-mission',
		sequence: 24,
		unitId: 'places-plans',
		title: 'Mission: planning and directions',
		shortTitle: 'Plans mission',
		kind: 'mission',
		durationMinutes: 22,
		canDo: 'Invite someone, negotiate one detail, confirm a plan, and ask for directions at the destination.',
		focus: ['invitation', 'negotiation', 'written confirmation', 'directions and repair'],
		scenario: [
			line('マヤ', '土曜日、一緒にご飯を食べませんか。', 'どようび、いっしょ に ごはん を たべませんか。', 'Would you like to eat together Saturday?'),
			line('健', 'いいですね。六時はどうですか。', 'いい です ね。ろくじ は どう ですか。', 'Sounds good. How about six?'),
			line('マヤ', '六時、大丈夫です。駅で会いましょう。', 'ろくじ、だいじょうぶ です。えき で あいましょう。', 'Six works. Let’s meet at the station.'),
			line('健', '駅のどこですか。', 'えき の どこ ですか。', 'Where in the station?')
		],
		notice: [
			'The last question exposes an ambiguity in “at the station.” Good planning repairs that before the meeting.',
			'Successful confirmation includes enough detail for both people to act independently.'
		],
		explanation: [
			'Complete the social outcome first, then test the plan: activity, day, time, exact place.',
			'When a location is too broad, ask X のどこですか, “where in X?”'
		],
		vocabulary: [
			word('入口', 'いりぐち', 'entrance'),
			word('改札', 'かいさつ', 'ticket gate'),
			word('前', 'まえ', 'front; in front of'),
			word('会います', 'あいます', 'meet', undefined, '会う'),
			word('一緒に', 'いっしょに', 'together')
		],
		activities: [
			choice(
				'u405-gap',
				'What information is still missing after “Let’s meet at the station”?',
				[['exact', 'The exact spot in the station'], ['country', 'Each person’s country'], ['price', 'The train fare']],
				'exact',
				'駅 names a broad place; the final question asks for a more precise meeting point.'
			),
			typeIn(
				'u405-place',
				'Propose: “Let’s meet in front of the ticket gate.”',
				['改札の前で会いましょう', 'かいさつのまえであいましょう'],
				'改札の前で会いましょう。',
				'改札の前 names the spot and で marks it as the meeting location.'
			),
			produce(
				'u405-mission',
				'speak',
				'Invite someone, negotiate a time, confirm an exact meeting place, then ask for and repeat one direction.',
				'日曜日、一緒に映画を見ませんか。いいですね。三時はどうですか。三時、大丈夫です。駅の改札の前で会いましょう。駅はどこですか。まっすぐ行って、右ですね。',
				'にちようび、いっしょ に えいが を みませんか。いい です ね。さんじ は どう ですか。さんじ、だいじょうぶ です。えき の かいさつ の まえ で あいましょう。えき は どこ ですか。まっすぐ いって、みぎ です ね。',
				['Activity and day agreed', 'Time negotiated', 'Exact place confirmed', 'Direction requested', 'Key direction repeated']
			)
		],
		transferPrompt: 'Run the whole mission with a different activity, rejected first time, precise landmark, and reversed turn.',
		transferSupport: 'Use the same outcome checklist, but replace every content detail.'
	}
];
