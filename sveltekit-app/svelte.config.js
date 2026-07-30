import adapterCloudflare from '@sveltejs/adapter-cloudflare';
import adapterStatic from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const isCapacitor = process.env.KIOKUN_CAPACITOR === '1';

const cloudflareAdapter = adapterCloudflare({
	// Keep _routes.json compact. Expanding <files> and <prerendered> creates
	// hundreds of entries and exceeds Cloudflare Pages' 100-rule limit.
	routes: {
		include: ['/*'],
		exclude: [
			'<build>',
			'/.well-known/*',
			'/assets/*',
			'/category_data/*',
			'/fonts/*',
			'/game_data/*',
			'/kr_sentences/*',
			'/pitch/*',
			'/reel-transcription-tests/*',
			'/research/*',
			'/reel-index/*',
			'/sounds/*',
			'/zh_sentences/*',
			'/blog/japanese-reel-stt-benchmark.json',
			'/apple-touch-icon.png',
			'/chinese_video_data.json',
			'/favicon-16x16.png',
			'/favicon-32x32.png',
			'/favicon.png',
			'/frequency_list.json',
			'/homophones_ja_chars.json',
			'/homophones_ja_words.json',
			'/homophones_kr_words.json',
			'/homophones_zh_chars.json',
			'/homophones_zh_words.json',
			'/icon-192.png',
			'/icon-512.png',
			'/japanese_labels.json',
			'/logo.svg',
			'/manifest.json',
			'/maskable-icon-512.png',
			'/og-image.png',
			'/reel_transcripts.json',
			'/reel_transcripts_full.json',
			'/reel_transcripts_zh.json',
			'/reel_transcripts_zh_full.json',
			'/robots.txt',
			'/video_data.json',
			'/blog',
			'/blog/japanese-reel-stt-benchmark',
			'/blog/semantic-mnemonic-bakeoff',
			'/blog/the-data-engine',
			'/blog/translation-model-bakeoff'
		]
	}
});

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://kit.svelte.dev/docs/integrations#preprocessors
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		adapter: isCapacitor
			? adapterStatic({
					pages: 'build-capacitor',
					assets: 'build-capacitor',
					fallback: 'index.html',
					strict: false
				})
			: cloudflareAdapter,
		serviceWorker: {
			register: !isCapacitor
		}
	}
};

export default config;
