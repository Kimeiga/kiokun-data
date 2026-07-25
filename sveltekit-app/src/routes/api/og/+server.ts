import type { RequestHandler } from './$types';
import notoSansLatinUrl from '@fontsource/noto-sans/files/noto-sans-latin-ext-400-normal.woff2?url';
import notoSansBasicLatinUrl from '@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff2?url';
import { parseOgCard, renderOgSvg } from '$lib/server/og-card';

const notoSansScUrl = '/fonts/noto-sans-sc-og.woff2';
const notoSansKrUrl = '/fonts/noto-sans-kr-og.woff2';

let rendererModule: Promise<typeof import('@cf-wasm/resvg/workerd')> | null = null;
let fontBuffers: Promise<Uint8Array[]> | null = null;

function loadRenderer() {
	if (!rendererModule) {
		rendererModule = import.meta.env.DEV
			? import('@cf-wasm/resvg/node')
			: import('@cf-wasm/resvg/workerd');
	}
	return rendererModule;
}

function loadFonts(requestUrl: URL): Promise<Uint8Array[]> {
	if (!fontBuffers) {
		fontBuffers = Promise.all(
			[notoSansBasicLatinUrl, notoSansLatinUrl, notoSansScUrl, notoSansKrUrl].map(async (fontUrl) => {
				const response = await fetch(new URL(fontUrl, requestUrl));
				if (!response.ok) throw new Error(`Unable to load OG font (${response.status})`);
				return new Uint8Array(await response.arrayBuffer());
			})
		);
	}
	return fontBuffers;
}

export const GET: RequestHandler = async ({ url, request, platform }) => {
	const cache = platform?.caches?.default;
	const cached = await cache?.match(request);
	if (cached) return cached;

	const card = parseOgCard(url.searchParams);
	const [{ Resvg }, fonts] = await Promise.all([
		loadRenderer(),
		loadFonts(new URL(request.url))
	]);
	const renderer = await Resvg.async(renderOgSvg(card), {
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
	const body = png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer;
	rendered.free();
	renderer.free();

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
