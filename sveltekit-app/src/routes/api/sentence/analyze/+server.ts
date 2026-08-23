import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { analyzeSentence } from '$lib/server/sentence-analysis';
import type { SentenceLanguage } from '$lib/sentence-analysis';

const LANGUAGES = new Set<SentenceLanguage>(['ja', 'zh', 'ko']);

export const POST: RequestHandler = async ({ request, platform }) => {
	const body = await request.json().catch(() => null);
	const text = typeof body?.text === 'string' ? body.text.trim() : '';
	const language = body?.language as SentenceLanguage;

	if (!text) throw error(400, 'text is required');
	if (text.length > 2_000) throw error(400, 'text must be 2,000 characters or fewer');
	if (!LANGUAGES.has(language)) throw error(400, 'language must be ja, zh, or ko');

	const words = await analyzeSentence(
		text,
		language,
		platform?.env?.BUCKET,
		platform?.env?.DB
	);
	return json({ words });
};
