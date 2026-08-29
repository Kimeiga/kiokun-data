import { getCourseBySlug, getCourseLesson } from '$lib/courses/catalog';
import type { CourseLesson } from '$lib/courses/types';

export type CourseRecommendationLanguage = 'ja' | 'zh' | 'ko';

export interface CourseLessonRecommendation {
	courseName: string;
	lessonTitle: string;
	lessonId: string;
	href: string;
	reason: string;
}

interface TopicRule {
	patterns: RegExp[];
	lessonIds: Record<CourseRecommendationLanguage, string>;
	reason: string;
}

const courseSlug: Record<CourseRecommendationLanguage, string> = {
	ja: 'japanese',
	zh: 'mandarin',
	ko: 'korean'
};

const fallbackLessonId: Record<CourseRecommendationLanguage, string> = {
	ja: 'lp-00-writing-systems',
	zh: 'zh-00-pinyin-tones',
	ko: 'ko-00-blocks'
};

const topicRules: TopicRule[] = [
	{
		patterns: [/\b(name|called)\b/i, /名前|叫什么|名字|이름/],
		lessonIds: { ja: 'u1-01-name', zh: 'zh-05-name', ko: 'ko-08-name' },
		reason: 'Review the course pattern for stating and asking about names.'
	},
	{
		patterns: [/\b(from|country|nationality|language)\b/i, /出身|から来|哪国|哪里人|나라|출신/],
		lessonIds: { ja: 'u1-03-origin-role', zh: 'zh-06-identity', ko: 'ko-10-origin' },
		reason: 'Review the course pattern for origin and personal background.'
	},
	{
		patterns: [/\b(family|mother|father|parent|sister|brother|wife|husband)\b/i, /家族|母|父|姉|兄|妹|弟|妈妈|爸爸|姐姐|哥哥|妹妹|弟弟|가족|어머니|아버지|언니|누나|형|오빠|동생/],
		lessonIds: { ja: 'u5-01-family-photo', zh: 'zh-20-family-photo', ko: 'ko-20-family-photo' },
		reason: 'Review the course vocabulary and patterns for identifying family members.'
	},
	{
		patterns: [/\b(home|house|room|apartment|living room|bedroom)\b/i, /家|部屋|リビング|房间|客厅|屋|집|방|거실/],
		lessonIds: { ja: 'u5-03-home-rooms', zh: 'zh-22-home-rooms', ko: 'ko-22-home-rooms' },
		reason: 'Review the course pattern for rooms and locations at home.'
	},
	{
		patterns: [/\b(weather|sunny|rain|rainy|snow|snowy|hot|cold|warm|windy|cloudy)\b/i, /天気|晴れ|暑い|寒い|天气|暖和|晴朗|下雨|날씨|따뜻|맑|추워|더워|비가/],
		lessonIds: { ja: 'u6-02-weather', zh: 'zh-25-weather', ko: 'ko-25-weather' },
		reason: 'Review the course pattern for asking about and describing weather.'
	},
	{
		patterns: [/\b(like|likes|liked|favorite|hobby|hobbies|interest)\b/i, /好き|趣味|喜欢|爱好|좋아|취미/],
		lessonIds: { ja: 'u6-01-likes', zh: 'zh-24-likes', ko: 'ko-24-hobbies' },
		reason: 'Review the course pattern for preferences and interests.'
	},
	{
		patterns: [/\b(yesterday|last night|last week|last weekend|did|went|watched|visited|bought|saw)\b/i, /昨日|週末|ました|だった|昨天|周末|了|주말|했어요|았어요|었어요/],
		lessonIds: { ja: 'u6-03-weekend-past', zh: 'zh-26-weekend-past', ko: 'ko-26-weekend-past' },
		reason: 'Review the course pattern for reporting a completed activity.'
	},
	{
		patterns: [/\b(let us|let's|shall we|together|meet|plan|tomorrow|invite)\b/i, /ませんか|ましょう|いっしょ|一起|吧|明天|갈까요|같이|내일|만나요/],
		lessonIds: { ja: 'u4-03-invite', zh: 'zh-27-weekend-mission', ko: 'ko-27-weekend-mission' },
		reason: 'Review the course pattern for suggesting an activity and making a plan.'
	},
	{
		patterns: [/\b(ask|asked|accept|accepted|refuse|decline|persuade)\b/i, /頼|引き受け|断る|劝|说服/],
		lessonIds: { ja: 'u4-03-invite', zh: 'zh-27-weekend-mission', ko: 'ko-27-weekend-mission' },
		reason: 'Review the course patterns for proposing, accepting, and declining an activity.'
	},
	{
		patterns: [/\b(how much|price|cost|costs|cheap|expensive|pay|buy|shop|store)\b/i, /いくら|円|買|多少钱|块|买|얼마|원|사요/],
		lessonIds: { ja: 'u3-04-restriction-total', zh: 'zh-17-prices', ko: 'ko-17-prices' },
		reason: 'Review the course pattern for prices and payment.'
	},
	{
		patterns: [/\b(food|eat|ate|drink|restaurant|menu|order|coffee|tea|rice|noodle)\b/i, /食べ|飲|注文|ご飯|茶|吃|喝|饭|面|먹|마시|식당|커피|차/],
		lessonIds: { ja: 'u3-02-order', zh: 'zh-16-ordering', ko: 'ko-16-ordering' },
		reason: 'Review the course pattern for ordering food and drink.'
	},
	{
		patterns: [/\b(where|station|train|driver|airport|restroom|bathroom|located|near|beside|behind|left|right)\b/i, /どこ|駅|電車|空港|右|左|在哪|哪里|末班车|司机|旁边|机场|화장실|어디|옆|공항/],
		lessonIds: { ja: 'u4-01-find-place', zh: 'zh-18-location', ko: 'ko-18-location' },
		reason: 'Review the course pattern for asking where a place is.'
	},
	{
		patterns: [/\b(time|o'clock|clock|morning|afternoon|evening|when|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, /何時|時|今日|曜日|几点|点|今天|星期|몇 시|오늘|요일/],
		lessonIds: { ja: 'u2-01-clock-time', zh: 'zh-11-clock-time', ko: 'ko-13-clock-time' },
		reason: 'Review the course pattern for dates and clock time.'
	},
	{
		patterns: [/\b(always|usually|often|sometimes|never|every day|routine)\b/i, /毎日|いつも|よく|ときどき|每天|常常|有时候|매일|자주|가끔/],
		lessonIds: { ja: 'u2-03-frequency', zh: 'zh-13-frequency-negation', ko: 'ko-14-routine' },
		reason: 'Review the course pattern for routines and frequency.'
	},
	{
		patterns: [/\b(not|never|no longer|cannot|can't|don't|doesn't|didn't|isn't|aren't)\b/i, /ない|ません|じゃない|不|没|不是|안 |못 |없|아니/],
		lessonIds: { ja: 'u2-03-frequency', zh: 'zh-13-frequency-negation', ko: 'ko-09-identity' },
		reason: 'Review the course pattern for making a negative statement.'
	}
];

const stopWords = new Set([
	'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'do', 'for', 'from', 'had',
	'has', 'have', 'he', 'her', 'him', 'his', 'i', 'in', 'is', 'it', 'me', 'my', 'of',
	'on', 'or', 'our', 'she', 'that', 'the', 'their', 'them', 'they', 'this', 'to', 'was',
	'we', 'were', 'what', 'which', 'who', 'will', 'with', 'you', 'your'
]);

function sourceWords(text: string): Set<string> {
	return new Set(
		text
			.toLocaleLowerCase('en')
			.match(/[a-z]+(?:'[a-z]+)?/g)
			?.filter((word) => word.length > 2 && !stopWords.has(word)) ?? []
	);
}

function lexicalScore(lesson: CourseLesson, english: string, target: string): number {
	if (lesson.kind === 'sound' || lesson.kind === 'script' || lesson.kind === 'mission') return 0;

	const words = sourceWords(english);
	const lessonEnglish = [
		lesson.title,
		lesson.canDo,
		...lesson.scenario.map((line) => line.translation),
		...lesson.vocabulary.map((item) => item.meaning)
	].join(' ').toLocaleLowerCase('en');

	let score = 0;
	for (const word of words) {
		if (lessonEnglish.includes(word)) score += 1;
	}
	for (const item of lesson.vocabulary) {
		if ([...item.word].length >= 2 && target.includes(item.word)) score += 4;
	}
	return score;
}

export function createCourseLessonRecommendation(
	language: CourseRecommendationLanguage,
	lessonId: string,
	reason: string
): CourseLessonRecommendation | null {
	const slug = courseSlug[language];
	const course = getCourseBySlug(slug);
	if (!course) return null;
	const lesson = getCourseLesson(course, lessonId);
	if (!lesson) return null;

	return {
		courseName: course.languageName,
		lessonTitle: lesson.title,
		lessonId: lesson.id,
		href: `/courses/${course.slug}/${lesson.id}`,
		reason
	};
}

export function recommendCourseLesson(
	language: CourseRecommendationLanguage,
	english: string,
	target: string
): CourseLessonRecommendation | null {
	const combined = `${english}\n${target}`;
	for (const rule of topicRules) {
		if (rule.patterns.some((pattern) => pattern.test(combined))) {
			return createCourseLessonRecommendation(language, rule.lessonIds[language], rule.reason);
		}
	}

	const course = getCourseBySlug(courseSlug[language]);
	const lexicalMatch = course?.lessons
		.map((lesson) => ({ lesson, score: lexicalScore(lesson, english, target) }))
		.filter(({ score }) => score >= 2)
		.sort((a, b) => b.score - a.score || a.lesson.sequence - b.lesson.sequence)[0];

	if (lexicalMatch) {
		return createCourseLessonRecommendation(
			language,
			lexicalMatch.lesson.id,
			'Review the course vocabulary and sentence pattern used in this exercise.'
		);
	}

	return createCourseLessonRecommendation(
		language,
		fallbackLessonId[language],
		'Review how this writing system represents the sounds in the sentence.'
	);
}
