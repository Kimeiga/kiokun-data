import { cantoneseA1Course } from './cantonese-a1';
import { japaneseA1Course } from './japanese-a1';
import { koreanA1Course } from './korean-a1';
import { mandarinA1Course } from './mandarin-a1';
import type { CourseLesson, CourseUnit, LanguageCourse } from './types';

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

export function courseReadingColor(language: LanguageCourse['language']): string {
	if (language === 'zh') return 'var(--color-pinyin)';
	if (language === 'yue') return 'var(--color-cantonese)';
	if (language === 'ko') return 'var(--color-korean)';
	return 'var(--color-onyomi)';
}
