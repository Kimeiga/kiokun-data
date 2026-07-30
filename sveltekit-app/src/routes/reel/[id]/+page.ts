import type { PageLoad } from './$types';
import { error, isHttpError } from '@sveltejs/kit';
import { buildReelSeo, type PageSeo } from '$lib/seo';

interface VideoInfo {
	url: string;
	thumbnail?: string | null;
	word_count: number;
	source_url?: string;
	author?: string;
	caption?: string;
	duration?: number;
}

interface TranscriptSegment {
	start_time: number;
	end_time: number;
	sentence: string;
	words: Array<string | { word?: string }>;
}

interface ReelIndexPayload {
	video: VideoInfo;
	transcript: TranscriptSegment[];
}

export interface ReelPageData {
	videoId: string;
	videoUrl: string;
	posterUrl: string | null;
	highlightWord: string | null;
	startTime: number;
	transcript: TranscriptSegment[];
	language: 'ja' | 'zh';
	sourceUrl: string | null;
	author: string | null;
	caption: string | null;
	duration: number | null;
	seo: PageSeo;
}

export const load: PageLoad<ReelPageData> = async ({ params, url, fetch }) => {
	const videoId = params.id;
	const highlightWord = url.searchParams.get('word');
	const requestedStartTime = Number.parseFloat(url.searchParams.get('t') || '0');
	const startTime = Number.isFinite(requestedStartTime) ? Math.max(0, requestedStartTime) : 0;
	const language: 'ja' | 'zh' = url.searchParams.get('lang') === 'zh' ? 'zh' : 'ja';
	const payloadUrl = `/reel-index/${language}/videos/${encodeURIComponent(videoId)}.json`;

	try {
		const response = await fetch(payloadUrl);
		if (response.status === 404) throw error(404, 'Reel not found');
		if (!response.ok) throw error(500, 'Failed to load reel');

		const { video, transcript = [] } = await response.json() as ReelIndexPayload;
		if (!video) throw error(404, 'Reel not found');

		const pageData = {
			videoId,
			videoUrl: `https://cdn.cosmos.so/${videoId}.mp4`,
			posterUrl: video.thumbnail ?? null,
			highlightWord,
			startTime,
			transcript,
			language,
			sourceUrl: video.source_url ?? null,
			author: video.author ?? null,
			caption: video.caption ?? null,
			duration: video.duration ?? null
		};

		return {
			...pageData,
			seo: buildReelSeo({
				id: videoId,
				language,
				caption: pageData.caption,
				author: pageData.author,
				transcript,
				highlightWord
			})
		};
	} catch (err) {
		if (isHttpError(err)) throw err;
		console.error('Failed to load reel:', err);
		throw error(500, 'Failed to load reel');
	}
};
