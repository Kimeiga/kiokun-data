import assert from 'node:assert/strict';
import { proxyDictionaryBytes } from './dictionary-proxy';
import { GET as dictionaryGET } from '../../routes/api/dictionary/+server';
import { GET as characterSupportGET } from '../../routes/api/character-support/+server';
import { POST as sentenceRubyPOST } from '../../routes/api/sentence/ruby/+server';

async function testDictionaryFallback(): Promise<void> {
	const requests: string[] = [];
	const response = await proxyDictionaryBytes({
		word: '逃',
		fetchFn: (async (input: RequestInfo | URL) => {
			const url = String(input);
			requests.push(url);
			if (url.includes('raw.githubusercontent.com')) throw new TypeError('network unavailable');
			return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
		}) as typeof fetch,
		request: new Request('https://kiokun.com/api/dictionary?word=%E9%80%83&v=build-1')
	});

	assert.equal(response.status, 200);
	assert.equal(requests.length, 2);
	assert.match(requests[1], /cdn\.jsdelivr\.net/);
}

async function testStableDictionaryCacheKey(): Promise<void> {
	let matchedUrl = '';
	let writtenUrl = '';
	const writes: Promise<unknown>[] = [];
	const cache = {
		match(request: Request) {
			matchedUrl = request.url;
			return Promise.resolve(undefined);
		},
		put(request: Request) {
			writtenUrl = request.url;
			return Promise.resolve();
		}
	};

	const response = await proxyDictionaryBytes({
		word: '逃',
		fetchFn: (async () => new Response(new Uint8Array([1]), { status: 200 })) as typeof fetch,
		platform: {
			caches: { default: cache },
			context: { waitUntil: (promise: Promise<unknown>) => writes.push(promise) }
		} as unknown as App.Platform,
		request: new Request(
			'https://kiokun.com/api/dictionary?word=%E9%80%83&v=build-2&optional=1'
		)
	});

	await Promise.all(writes);
	assert.equal(response.status, 200);
	assert.equal(matchedUrl, 'https://kiokun.com/api/dictionary?word=%E9%80%83');
	assert.equal(writtenUrl, matchedUrl);
}

async function testOptionalDictionaryDegradesQuietly(): Promise<void> {
	const response = await dictionaryGET({
		url: new URL('https://kiokun.com/api/dictionary?word=%E7%89%A2%E7%8D%84&optional=1'),
		fetch: (async () => new Response('unavailable', { status: 503 })) as typeof fetch,
		request: new Request('https://kiokun.com/api/dictionary?word=%E7%89%A2%E7%8D%84&optional=1')
	} as never);

	assert.equal(response.status, 204);
	assert.equal(response.headers.get('cache-control'), 'no-store');
	assert.equal(response.headers.get('x-kiokun-degraded'), 'dictionary-upstream');
}

async function testOptionalEnrichmentDegradesQuietly(): Promise<void> {
	const supportResponse = await characterSupportGET({
		url: new URL('https://kiokun.com/api/character-support?char=%E9%80%83'),
		fetch: (async () => new Response('unavailable', { status: 503 })) as typeof fetch
	} as never);
	assert.equal(supportResponse.status, 200);
	assert.deepEqual(await supportResponse.json(), {
		charGlosses: {},
		charTaxonomy: {},
		componentUses: {}
	});
	assert.equal(supportResponse.headers.get('x-kiokun-degraded'), 'character-support');

	const rubyResponse = await sentenceRubyPOST({
		request: new Request('https://kiokun.com/api/sentence/ruby', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ text: '逃げる' })
		}),
		platform: { env: {} }
	} as never);
	assert.equal(rubyResponse.status, 200);
	assert.deepEqual(await rubyResponse.json(), { tokens: [] });
	assert.equal(rubyResponse.headers.get('x-kiokun-degraded'), 'japanese-ruby-unavailable');
}

await testDictionaryFallback();
await testStableDictionaryCacheKey();
await testOptionalDictionaryDegradesQuietly();
await testOptionalEnrichmentDegradesQuietly();

console.log('navigation resilience tests passed');
