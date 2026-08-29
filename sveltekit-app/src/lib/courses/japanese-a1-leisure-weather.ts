import { lesson } from './authoring';
import type { JapaneseLesson } from './types';

export const japaneseLeisureWeatherLessons: JapaneseLesson[] = [
	lesson({
		id: 'u6-01-likes',
		unitId: 'leisure-weather',
		title: 'Talking about things you like',
		shortTitle: 'Likes and interests',
		canDo: 'Ask what kind of entertainment someone likes and give a specific preference.',
		focus: ['どんな + noun', 'noun + が好きです', 'question and answer'],
		scenario: [
			['美咲', 'どんな映画が好きですか。', 'どんな えいが が すき ですか。', 'What kind of movies do you like?'],
			['アミール', 'アニメ映画が好きです。', 'あにめ えいが が すき です。', 'I like animated movies.']
		],
		notice: [
			'どんな appears before a noun and asks what kind of item the speaker means.',
			'The preferred item is marked by が before 好きです.'
		],
		explanation: [
			'好き behaves like a な-adjective in Japanese. In this pattern, the thing liked takes が rather than を.',
			'The answer can replace 映画 with music, food, sports, or another familiar category.'
		],
		vocabulary: [
			['どんな', 'どんな', 'what kind of'],
			['映画', 'えいが', 'movie'],
			['好き', 'すき', 'liked; favorite'],
			['アニメ', 'アニメ', 'animation; anime']
		],
		choice: {
			prompt: 'Which particle marks the thing liked in this pattern?',
			options: [['ga', 'が'], ['wo', 'を'], ['ni', 'に']],
			answer: 'ga',
			rationale: 'The beginner preference pattern is noun + が好きです.'
		},
		arrange: {
			prompt: 'Build “I like animated movies.”',
			tiles: ['アニメ映画が', '好きです', 'どんな', '見ます'],
			answer: ['アニメ映画が', '好きです'],
			translation: 'I like animated movies.',
			rationale: 'The preferred item takes が and is followed by 好きです.'
		},
		production: {
			mode: 'speak',
			prompt: 'Ask about one category and answer with a specific preference.',
			modelAnswer: 'どんな音楽が好きですか。ジャズが好きです。',
			modelReading: 'どんな おんがく が すき ですか。じゃず が すき です。',
			checklist: ['Question uses どんな before a noun', 'Preferred item takes が', 'Answer ends politely']
		},
		transferPrompt: 'Change both the category and the specific preference without copying the movie example.',
		transferSupport: 'どんな…が好きですか。…が好きです。'
	}),
	lesson({
		id: 'u6-02-weather',
		unitId: 'leisure-weather',
		title: 'Describing today’s weather',
		shortTitle: 'Today’s weather',
		canDo: 'Ask about the weather and give a short description with one contrasting detail.',
		focus: ['天気はどうですか', '晴れです', 'い-adjective + です'],
		scenario: [
			['アミール', '今日の天気はどうですか。', 'きょう の てんき は どう ですか。', 'How is the weather today?'],
			['美咲', '晴れです。でも、少し暑いです。', 'はれ です。でも、すこし あつい です。', 'It is sunny. But it is a little hot.']
		],
		notice: [
			'どうですか asks for a description of the topic marked by は.',
			'暑い keeps its final い before です; です adds politeness but does not replace い.'
		],
		explanation: [
			'Weather nouns such as 晴れ can be followed by です. Weather adjectives such as 暑い and 寒い keep their adjective ending.',
			'少し softens the description, and でも introduces a contrasting second observation.'
		],
		vocabulary: [
			['今日', 'きょう', 'today'],
			['天気', 'てんき', 'weather'],
			['晴れ', 'はれ', 'clear weather; sunny'],
			['暑い', 'あつい', 'hot (weather)'],
			['少し', 'すこし', 'a little']
		],
		choice: {
			prompt: 'Which sentence correctly says that it is hot?',
			options: [['atsui', '暑いです。'], ['atsu', '暑です。'], ['hare', '晴れいです。']],
			answer: 'atsui',
			rationale: 'An い-adjective keeps its final い before polite です.'
		},
		arrange: {
			prompt: 'Build “It is a little hot.”',
			tiles: ['少し', '暑いです', '晴れ', 'どう'],
			answer: ['少し', '暑いです'],
			translation: 'It is a little hot.',
			rationale: 'The degree expression 少し comes before the adjective.'
		},
		production: {
			mode: 'speak',
			prompt: 'Ask about today’s weather and answer with two details.',
			modelAnswer: '今日の天気はどうですか。曇りです。少し寒いです。',
			modelReading: 'きょう の てんき は どう ですか。くもり です。すこし さむい です。',
			checklist: ['Question uses 天気はどうですか', 'Answer gives a weather noun or adjective', 'Adjective ending remains intact']
		},
		transferPrompt: 'Describe different weather and change the temperature detail to match the new situation.',
		transferSupport: '…の天気はどうですか。…です。少し…です。'
	}),
	lesson({
		id: 'u6-03-weekend-past',
		unitId: 'leisure-weather',
		title: 'Reporting a completed weekend activity',
		shortTitle: 'What you did',
		canDo: 'Ask what someone did during the weekend and report one completed activity.',
		focus: ['何をしましたか', 'verb stem + ました', 'time topic'],
		scenario: [
			['美咲', '週末、何をしましたか。', 'しゅうまつ、なに を しましたか。', 'What did you do over the weekend?'],
			['アミール', '映画を見ました。', 'えいが を みました。', 'I watched a movie.']
		],
		notice: [
			'しました is the polite past form of する and frames the question as a completed time period.',
			'見ました is the polite past form of 見る; the object remains marked by を.'
		],
		explanation: [
			'Polite past affirmative verbs end in ました. The verb stem differs by verb, so learn the past form with each frequent verb.',
			'A time expression such as 週末 or 昨日 can appear first without a particle when it frames the conversation.'
		],
		vocabulary: [
			['週末', 'しゅうまつ', 'weekend'],
			['何', 'なに', 'what'],
			['見る', 'みる', 'see; watch'],
			['映画', 'えいが', 'movie']
		],
		choice: {
			prompt: 'Which form reports a completed action politely?',
			options: [['past', '見ました'], ['present', '見ます'], ['negative', '見ません']],
			answer: 'past',
			rationale: 'The ました ending marks polite past affirmative action.'
		},
		arrange: {
			prompt: 'Build “I watched a movie.”',
			tiles: ['映画を', '見ました', '見ます', '週末は'],
			answer: ['映画を', '見ました'],
			translation: 'I watched a movie.',
			rationale: 'The object marked by を comes before the polite past verb.'
		},
		production: {
			mode: 'speak',
			prompt: 'Ask what someone did and answer with a completed activity.',
			modelAnswer: '週末、何をしましたか。友だちと勉強しました。',
			modelReading: 'しゅうまつ、なに を しましたか。ともだち と べんきょう しました。',
			checklist: ['Question uses 何をしましたか', 'Answer ends in ました', 'Activity includes any needed particle']
		},
		transferPrompt: 'Replace the weekend and movie with a different past time and a different completed activity.',
		transferSupport: '…、何をしましたか。…ました。'
	}),
	lesson({
		id: 'u6-04-weekend-mission',
		unitId: 'leisure-weather',
		title: 'Mission: make a weather-aware plan',
		shortTitle: 'Weekend plan',
		kind: 'mission',
		durationMinutes: 20,
		canDo: 'Use a forecast to invite someone, accept the invitation, and confirm a meeting time.',
		focus: ['明日は晴れです', '行きませんか', '会いましょう'],
		scenario: [
			['美咲', '明日は晴れです。いっしょに公園に行きませんか。', 'あした は はれ です。いっしょ に こうえん に いきませんか。', 'It will be sunny tomorrow. Would you like to go to the park together?'],
			['アミール', 'いいですね。三時に会いましょう。', 'いい ですね。さんじ に あいましょう。', 'That sounds good. Let’s meet at three.']
		],
		notice: [
			'A negative question with 行きませんか functions as a polite invitation in this context.',
			'会いましょう proposes a shared action; the meeting time is marked by に.'
		],
		explanation: [
			'Combine a relevant condition with an invitation: a weather statement provides the reason for the proposed activity.',
			'After accepting, confirm a concrete time or place so the exchange produces an actionable plan.'
		],
		vocabulary: [
			['明日', 'あした', 'tomorrow'],
			['公園', 'こうえん', 'park'],
			['いっしょに', 'いっしょに', 'together'],
			['会う', 'あう', 'meet']
		],
		choice: {
			prompt: 'Which line makes the invitation?',
			options: [['invite', 'いっしょに公園に行きませんか。'], ['weather', '明日は晴れです。'], ['confirm', '三時に会いましょう。']],
			answer: 'invite',
			rationale: '行きませんか invites the listener to go together.'
		},
		arrange: {
			prompt: 'Build “Let’s meet at three.”',
			tiles: ['三時に', '会いましょう', '行きませんか', '晴れです'],
			answer: ['三時に', '会いましょう'],
			translation: 'Let’s meet at three.',
			rationale: 'The time marked by に comes before the shared-action proposal.'
		},
		production: {
			mode: 'speak',
			prompt: 'State the weather, invite someone to an activity, then accept and confirm a time.',
			modelAnswer: '明日は晴れです。いっしょに公園に行きませんか。いいですね。三時に会いましょう。',
			modelReading: 'あした は はれ です。いっしょ に こうえん に いきませんか。いい ですね。さんじ に あいましょう。',
			checklist: ['Weather supports the activity', 'Invitation uses ませんか', 'Response accepts or declines', 'Plan includes a specific time']
		},
		transferPrompt: 'Change the forecast, activity, and meeting time while keeping the invitation and confirmation complete.',
		transferSupport: '明日は…です。いっしょに…ませんか。…時に会いましょう。'
	})
];
