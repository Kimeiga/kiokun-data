import type { RequestHandler } from './$types';
import { languageCourses } from '$lib/courses/catalog';

const SITE_URL = 'https://kiokun.com';

const publicPaths = [
	'/',
	'/courses',
	'/learning',
	'/tutor',
	'/frequency',
	'/homophones/chinese',
	'/homophones/japanese',
	'/homophones/korean',
	'/japanese-emoji',
	'/artifacts',
	'/users',
	'/game',
	'/blog',
	'/blog/the-data-engine',
	'/blog/japanese-reel-stt-benchmark',
	'/blog/semantic-mnemonic-bakeoff',
	'/blog/translation-model-bakeoff',
	'/learning-resources/japanese/scripting-japan',
	...languageCourses.flatMap((course) => [
		'/courses/' + course.slug,
		...course.lessons.map((lesson) => '/courses/' + course.slug + '/' + lesson.id)
	])
];

function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

export const GET: RequestHandler = () => {
	const urls = publicPaths
		.map((path) => `<url><loc>${escapeXml(`${SITE_URL}${path}`)}</loc></url>`)
		.join('');
	const body = `<?xml version="1.0" encoding="UTF-8"?>` +
		`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;

	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600, s-maxage=86400'
		}
	});
};
