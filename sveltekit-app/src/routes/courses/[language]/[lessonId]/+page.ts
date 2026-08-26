import { error } from '@sveltejs/kit';
import {
	getAdjacentLessons,
	getCourseBySlug,
	getCourseLesson,
	getCourseUnit
} from '$lib/courses/catalog';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const course = getCourseBySlug(params.language);
	if (!course) throw error(404, 'Language course not found');

	const lesson = getCourseLesson(course, params.lessonId);
	if (!lesson) throw error(404, course.languageName + ' lesson not found');

	const unit = getCourseUnit(course, lesson.unitId);
	if (!unit) throw error(500, course.languageName + ' course unit not found');

	const basePath = '/courses/' + course.slug;
	const adjacent = getAdjacentLessons(course, lesson.id);
	return {
		course,
		basePath,
		lesson,
		unit,
		previousLesson: adjacent.previous,
		nextLesson: adjacent.next,
		seo: {
			title: lesson.title + ' — ' + course.languageName + ' course | Kiokun',
			description:
				lesson.canDo +
				' Learn through a scenario, explanation, retrieval, original use, and a reduced-support transfer check.',
			canonicalPath: basePath + '/' + lesson.id,
			og: {
				kind: 'section',
				eyebrow:
					course.languageName + ' ' + course.level + ' · Lesson ' + lesson.sequence,
				title: lesson.title,
				subtitle: lesson.canDo
			}
		}
	};
};
