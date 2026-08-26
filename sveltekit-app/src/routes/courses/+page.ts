import { languageCourses } from '$lib/courses/catalog';
import type { PageLoad } from './$types';

export const load: PageLoad = () => {
	const courses = languageCourses.map((course) => ({
		slug: course.slug,
		title: course.title,
		languageName: course.languageName,
		nativeName: course.nativeName,
		glyph: course.glyph,
		language: course.language,
		htmlLanguage: course.htmlLanguage,
		level: course.level,
		description: course.description,
		lessonCount: course.lessons.length,
		missionCount: course.lessons.filter((lesson) => lesson.kind === 'mission').length,
		totalMinutes: course.lessons.reduce((sum, lesson) => sum + lesson.durationMinutes, 0),
		unitCount: course.units.length,
		foundation: {
			title: course.units[0].title,
			strapline: course.units[0].strapline
		}
	}));

	return {
		courses,
		seo: {
			title: 'Japanese, Mandarin, Cantonese, and Korean Courses | Kiokun',
			description:
				'Structured beginner courses for Japanese, Mandarin, Cantonese, and Korean, with script and sound foundations, practice, missions, and Kiokun dictionary integration.',
			canonicalPath: '/courses',
			og: {
				kind: 'section',
				eyebrow: 'Kiokun courses',
				title: 'Choose a language course',
				subtitle: 'Japanese · Mandarin · Cantonese · Korean'
			}
		}
	};
};
