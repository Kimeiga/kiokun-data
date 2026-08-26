import { error } from '@sveltejs/kit';
import { getAdjacentLessons, getCourseLesson, getCourseUnit } from '$lib/courses/catalog';
import { japaneseA1Course } from '$lib/courses/japanese-a1';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const course = japaneseA1Course;
	const basePath = '/courses/' + course.slug;
	const lesson = getCourseLesson(course, params.lessonId);
	if (!lesson) throw error(404, 'Japanese lesson not found');

	const unit = getCourseUnit(course, lesson.unitId);
	if (!unit) throw error(500, 'Japanese course unit not found');

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
			description: lesson.canDo + ' Learn through a scenario, explanation, retrieval, original use, and a reduced-support transfer check.',
			canonicalPath: basePath + '/' + lesson.id,
			og: {
				kind: 'section',
				eyebrow: course.languageName + ' ' + course.level + ' · Lesson ' + lesson.sequence,
				title: lesson.title,
				subtitle: lesson.canDo
			}
		}
	};
};
