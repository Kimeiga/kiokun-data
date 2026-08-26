import { error } from '@sveltejs/kit';
import { getCourseBySlug } from '$lib/courses/catalog';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const course = getCourseBySlug(params.language);
	if (!course) throw error(404, 'Language course not found');

	const basePath = '/courses/' + course.slug;
	return {
		course,
		basePath,
		seo: {
			title: course.title + ' | Kiokun',
			description: course.description,
			canonicalPath: basePath,
			og: {
				kind: 'section',
				eyebrow: course.languageName + ' · ' + course.level,
				title: course.title,
				subtitle: course.level
			}
		}
	};
};
