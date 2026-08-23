import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { SentenceLanguage } from '$lib/sentence-analysis';

const LANGUAGES = new Set<SentenceLanguage>(['ja', 'zh', 'ko']);

export const POST: RequestHandler = async ({ request, platform }) => {
	const body = await request.json().catch(() => null);
	const text = typeof body?.text === 'string' ? body.text.trim() : '';
	const source = body?.source as SentenceLanguage;

	if (!text) throw error(400, 'text is required');
	if (text.length > 2_000) throw error(400, 'text must be 2,000 characters or fewer');
	if (!LANGUAGES.has(source)) throw error(400, 'source must be ja, zh, or ko');
	if (!platform?.env?.AI) throw error(503, 'Translation is not configured');

	try {
		const result = await platform.env.AI.run('@cf/meta/m2m100-1.2b', {
			text,
			source_lang: source,
			target_lang: 'en',
		}) as { translated_text?: string };
		const translation = result.translated_text?.trim();
		if (!translation) throw new Error('Translation model returned no text');

		return json(
			{ translation, provider: 'Cloudflare Workers AI · M2M100' },
			{ headers: { 'Cache-Control': 'private, max-age=86400' } }
		);
	} catch (cause) {
		console.error('Sentence translation failed:', cause);
		throw error(503, 'Translation is temporarily unavailable');
	}
};
