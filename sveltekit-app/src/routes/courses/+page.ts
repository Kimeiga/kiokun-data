import { getCourseCatalogEntry, languageCourses } from '$lib/courses/catalog';
import type { PageLoad } from './$types';

export const load: PageLoad = () => {
	const courses = languageCourses.map(getCourseCatalogEntry);

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
