import type { RequestHandler } from './$types';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import wasmUrl from '@resvg/resvg-wasm/index_bg.wasm?url';
import notoSansScUrl from '@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-400-normal.woff2?url';
import notoSansKrUrl from '@fontsource/noto-sans-kr/files/noto-sans-kr-korean-400-normal.woff2?url';
import notoSansLatinUrl from '@fontsource/noto-sans/files/noto-sans-latin-ext-400-normal.woff2?url';
import notoSansBasicLatinUrl from '@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff2?url';
import { parseOgCard, renderOgSvg } from '$lib/server/og-card';

let wasmReady: Promise<void> | null = null;
let fontBuffers: Promise<Uint8Array[]> | null = null;

async function initializeRenderer(requestUrl: URL): Promise<Uint8Array[]> {
	if (!wasmReady) {
		wasmReady = initWasm(fetch(new URL(wasmUrl, requestUrl))).catch((error) => {
			// Vite hot reload can recreate this module while the WASM singleton stays initialized.
			if (error instanceof Error && error.message.includes('Already initialized')) return;
			throw error;
		});
	}
	if (!fontBuffers) {
		fontBuffers = Promise.all(
			[notoSansBasicLatinUrl, notoSansLatinUrl, notoSansScUrl, notoSansKrUrl].map(async (fontUrl) => {
				const response = await fetch(new URL(fontUrl, requestUrl));
				if (!response.ok) throw new Error(`Unable to load OG font (${response.status})`);
				return new Uint8Array(await response.arrayBuffer());
			})
		);
	}
	await wasmReady;
	return fontBuffers;
}

export const GET: RequestHandler = async ({ url, request, platform }) => {
	const cache = platform?.caches?.default;
	const cached = await cache?.match(request);
	if (cached) return cached;

	const card = parseOgCard(url.searchParams);
	const fonts = await initializeRenderer(new URL(request.url));
	const renderer = new Resvg(renderOgSvg(card), {
		font: {
			fontBuffers: fonts,
			defaultFontFamily: 'Noto Sans',
			sansSerifFamily: 'Noto Sans'
		},
		textRendering: 2,
		shapeRendering: 2,
		background: '#050505'
	});
	const rendered = renderer.render();
	const png = rendered.asPng();
	rendered.free();
	renderer.free();
	const body = png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer;

	const response = new Response(body, {
		headers: {
			'content-type': 'image/png',
			'cache-control': 'public, max-age=86400, s-maxage=31536000, immutable',
			'x-content-type-options': 'nosniff'
		}
	});
	if (cache && platform?.context) {
		platform.context.waitUntil(cache.put(request, response.clone()));
	}
	return response;
};
