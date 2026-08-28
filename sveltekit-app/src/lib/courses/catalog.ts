import { cantoneseA1Course } from './cantonese-a1';
import { japaneseA1Course } from './japanese-a1';
import { koreanA1Course } from './korean-a1';
import { mandarinA1Course } from './mandarin-a1';
import type {
	ChoiceActivity,
	CourseDialogueLine,
	CourseLesson,
	CourseUnit,
	LanguageCourse,
	ScriptChart
} from './types';

export interface CourseCatalogEntry {
	slug: string;
	languageName: string;
	nativeName: string;
	glyph: string;
	language: LanguageCourse['language'];
	htmlLanguage: string;
	level: string;
	lessonCount: number;
	missionCount: number;
	preview: {
		lessonId: string;
		sequence: number;
		title: string;
		durationMinutes: number;
		canDo: string;
		chart: ScriptChart;
		dialogue: CourseDialogueLine;
		question: Pick<ChoiceActivity, 'prompt' | 'options' | 'answer' | 'rationale'>;
	};
}

export const languageCourses: LanguageCourse[] = [
	japaneseA1Course,
	mandarinA1Course,
	cantoneseA1Course,
	koreanA1Course
];

export function getCourseBySlug(slug: string): LanguageCourse | null {
	return languageCourses.find((course) => course.slug === slug) ?? null;
}

export function getCourseLesson(course: LanguageCourse, lessonId: string): CourseLesson | null {
	return course.lessons.find((lesson) => lesson.id === lessonId) ?? null;
}

export function getCourseUnit(course: LanguageCourse, unitId: string): CourseUnit | null {
	return course.units.find((unit) => unit.id === unitId) ?? null;
}

export function getAdjacentLessons(
	course: LanguageCourse,
	lessonId: string
): { previous: CourseLesson | null; next: CourseLesson | null } {
	const index = course.lessons.findIndex((lesson) => lesson.id === lessonId);
	if (index < 0) return { previous: null, next: null };
	return {
		previous: course.lessons[index - 1] ?? null,
		next: course.lessons[index + 1] ?? null
	};
}

export function getCourseCatalogEntry(course: LanguageCourse): CourseCatalogEntry {
	const foundationUnit = course.units[0];
	const foundationLessons = foundationUnit.lessonIds
		.map((lessonId) => getCourseLesson(course, lessonId))
		.filter((lesson): lesson is CourseLesson => Boolean(lesson));
	const previewLesson =
		foundationLessons.find((lesson) =>
			lesson.scriptCharts?.some((chart) => chart.rows.length >= 3)
		) ?? foundationLessons.find((lesson) => Boolean(lesson.scriptCharts?.length));

	if (!previewLesson?.scriptCharts?.[0]) {
		throw new Error(`${course.id} needs a foundation chart for its catalog preview`);
	}

	const question = previewLesson.activities.find(
		(activity): activity is ChoiceActivity => activity.type === 'choice'
	);
	const dialogue = previewLesson.scenario[0];

	if (!question || !dialogue) {
		throw new Error(`${previewLesson.id} needs an example and choice question for its catalog preview`);
	}

	const chart =
		previewLesson.scriptCharts.find((item) => item.rows.length >= 3) ??
		previewLesson.scriptCharts[0];

	return {
		slug: course.slug,
		languageName: course.languageName,
		nativeName: course.nativeName,
		glyph: course.glyph,
		language: course.language,
		htmlLanguage: course.htmlLanguage,
		level: course.level,
		lessonCount: course.lessons.length,
		missionCount: course.lessons.filter((lesson) => lesson.kind === 'mission').length,
		preview: {
			lessonId: previewLesson.id,
			sequence: previewLesson.sequence,
			title: previewLesson.title,
			durationMinutes: previewLesson.durationMinutes,
			canDo: previewLesson.canDo,
			chart: {
				...chart,
				rows: chart.rows.slice(0, 3)
			},
			dialogue,
			question: {
				prompt: question.prompt,
				options: question.options,
				answer: question.answer,
				rationale: question.rationale
			}
		}
	};
}

export function courseReadingColor(language: LanguageCourse['language']): string {
	if (language === 'zh') return 'var(--color-pinyin)';
	if (language === 'yue') return 'var(--color-cantonese)';
	if (language === 'ko') return 'var(--color-korean)';
	return 'var(--color-onyomi)';
}
