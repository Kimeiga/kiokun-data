import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTokenizer, tokenizeJapanese } from '$lib/server/kuromoji-loader';

const MAX_SENTENCE_LENGTH = 2_000;
const WORD_CONTENT_RE = /[\p{Script=Han}\p{Script=Latin}\p{N}\u3040-\u30ff\u31f0-\u31ffー]/u;
const HAN_RE = /\p{Script=Han}/u;
const ALL_KANA_RE = /^[\u3040-\u30ff\u31f0-\u31ffー]+$/u;

function degradedRubyResponse(reason: string): Response {
	return json(
		{ tokens: [] },
		{
			headers: {
				'Cache-Control': 'no-store',
				'X-Kiokun-Degraded': reason
			}
		}
	);
}

export const POST: RequestHandler = async ({ request, platform }) => {
	const body = await request.json().catch(() => null);
	const text = typeof body?.text === 'string' ? body.text : '';

	if (!text.trim()) throw error(400, 'text is required');
	if (text.length > MAX_SENTENCE_LENGTH) {
		throw error(400, `text must be ${MAX_SENTENCE_LENGTH.toLocaleString()} characters or fewer`);
	}

	const bucket = platform?.env?.BUCKET;
	if (!bucket) return degradedRubyResponse('japanese-ruby-unavailable');

	try {
		const tokenizer = await getTokenizer(bucket);
		const tokens = tokenizeJapanese(tokenizer, text).map((token) => {
			const isWord = WORD_CONTENT_RE.test(token.surfaceForm);
			return {
				text: token.surfaceForm,
				reading:
					isWord && HAN_RE.test(token.surfaceForm) && !ALL_KANA_RE.test(token.surfaceForm)
						? token.reading
						: null,
				// Kuromoji positions are one-based.
				position: Math.max(0, token.position - 1),
				isWord
			};
		});

		return json(
			{ tokens },
			{
				headers: {
					'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800'
				}
			}
		);
	} catch (cause) {
		console.error('Japanese ruby analysis failed:', cause);
		// Ruby annotation is progressive enhancement. The browser already has a
		// lightweight tokenizer and dictionary-reading fallback, so return a valid
		// empty result instead of surfacing an optional dependency outage as a 503.
		return degradedRubyResponse('japanese-ruby-unavailable');
	}
};
