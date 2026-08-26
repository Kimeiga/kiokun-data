import { japaneseDailyFoodLessons } from './japanese-a1-daily-food';
import { japaneseFoundationsLessons } from './japanese-a1-foundations';
import { japanesePlacesLessons } from './japanese-a1-places';
import type { JapaneseCourse, JapaneseLesson, JapaneseUnit } from './types';

const lessons: JapaneseLesson[] = [
	...japaneseFoundationsLessons,
	...japaneseDailyFoodLessons,
	...japanesePlacesLessons
].map((lesson, index) => ({ ...lesson, sequence: index + 1 }));

const units: JapaneseUnit[] = [
	{
		id: 'launchpad',
		sequence: 0,
		title: 'Script & sound launchpad',
		nativeTitle: '音と文字',
		strapline: 'Hiragana, katakana, voicing marks, combined kana, and Japanese timing.',
		canDo: 'Use kana charts to decode basic hiragana and katakana and distinguish key voicing and timing contrasts.',
		mission: 'Read and type unfamiliar beginner words while using romaji only as a reference.',
		lessonIds: lessons.filter((lesson) => lesson.unitId === 'launchpad').map((lesson) => lesson.id)
	},
	{
		id: 'introductions',
		sequence: 1,
		title: 'Introductions & relationship',
		nativeTitle: 'はじめまして',
		strapline: 'Polite first-meeting exchanges, personal details, and requests for repetition.',
		canDo: 'Introduce yourself, ask a matching question, choose polite language, and repair one misunderstanding.',
		mission: 'Complete a first meeting with a name, one personal detail, one question, and one repair turn.',
		lessonIds: lessons.filter((lesson) => lesson.unitId === 'introductions').map((lesson) => lesson.id)
	},
	{
		id: 'daily-time',
		sequence: 2,
		title: 'Daily routine & time',
		nativeTitle: '毎日と時間',
		strapline: 'Routine descriptions, clock time, frequency, and scheduling.',
		canDo: 'Describe a short routine, arrange a time, respond to a change, and confirm the result.',
		mission: 'Compare routines and negotiate one workable meeting time.',
		lessonIds: lessons.filter((lesson) => lesson.unitId === 'daily-time').map((lesson) => lesson.id)
	},
	{
		id: 'food-ordering',
		sequence: 3,
		title: 'Food & ordering',
		nativeTitle: '注文する',
		strapline: 'Menu reading, ordering, clarification, restrictions, and price confirmation.',
		canDo: 'Use a compact menu, order, answer a clarification, communicate a restriction, and confirm the total.',
		mission: 'Complete an order while resolving one unsuitable item.',
		lessonIds: lessons.filter((lesson) => lesson.unitId === 'food-ordering').map((lesson) => lesson.id)
	},
	{
		id: 'places-plans',
		sequence: 4,
		title: 'Places & plans',
		nativeTitle: '場所と予定',
		strapline: 'Locations, directions, invitations, negotiation, and plan confirmation.',
		canDo: 'Ask where a place is, follow simple directions, propose a plan, negotiate one detail, and confirm where and when.',
		mission: 'Invite someone, settle an exact plan, and navigate to the meeting point.',
		lessonIds: lessons.filter((lesson) => lesson.unitId === 'places-plans').map((lesson) => lesson.id)
	}
];

export const japaneseA1Course: JapaneseCourse = {
	id: 'japanese-a1',
	slug: 'japanese',
	title: 'Japanese foundations: Launchpad to A1',
	languageName: 'Japanese',
	nativeName: '日本語',
	glyph: '道',
	language: 'ja',
	htmlLanguage: 'ja',
	studyLanguage: 'ja',
	speechLanguage: 'ja',
	readingLabel: 'Reading',
	level: 'Launchpad–A1',
	description:
		'A 28-lesson introductory Japanese course for independent adults, covering script, sound, everyday exchanges, retrieval practice, open production, and transfer checks.',
	designPromise:
		'Each lesson contains an initial example, form-focused explanation, closed retrieval, open production, and a reduced-support transfer task.',
	units,
	lessons
};

const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));

export function getJapaneseA1Lesson(lessonId: string): JapaneseLesson | null {
	return lessonById.get(lessonId) ?? null;
}

export function getJapaneseA1Unit(unitId: string): JapaneseUnit | null {
	return units.find((unit) => unit.id === unitId) ?? null;
}

export function getAdjacentJapaneseA1Lessons(lessonId: string): {
	previous: JapaneseLesson | null;
	next: JapaneseLesson | null;
} {
	const index = lessons.findIndex((lesson) => lesson.id === lessonId);
	if (index < 0) return { previous: null, next: null };
	return {
		previous: lessons[index - 1] ?? null,
		next: lessons[index + 1] ?? null
	};
}
