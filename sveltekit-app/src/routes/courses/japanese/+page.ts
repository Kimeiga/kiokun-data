import { japaneseA1Course } from '$lib/courses/japanese-a1';
import type { PageLoad } from './$types';

export const load: PageLoad = () => {
	const course = japaneseA1Course;
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
