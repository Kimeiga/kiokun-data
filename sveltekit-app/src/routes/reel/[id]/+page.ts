import type { PageLoad } from './$types';

// SSR enabled: fetches static JSON which SvelteKit serves on the server

interface VideoOccurrence {
	video_id: string;
	start_time: number;
	end_time: number;
	sentence: string;
}

interface VideoInfo {
	url: string;
	word_count: number;
	source_url?: string;
	author?: string;
	caption?: string;
	duration?: number;
}

interface VideoData {
	videos: Record<string, VideoInfo>;
	words: Record<string, VideoOccurrence[]>;
}

interface TranscriptSegment {
	start_time: number;
	end_time: number;
	sentence: string;
	words: string[];
}

export interface ReelPageData {
	videoId: string;
	videoUrl: string;
	highlightWord: string | null;
	startTime: number;
	transcript: TranscriptSegment[];
	language: 'ja' | 'zh';
	// Metadata from Instagram
	sourceUrl: string | null;
	author: string | null;
	caption: string | null;
	duration: number | null;
}

export const load: PageLoad<ReelPageData> = async ({ params, url, fetch }) => {
	const videoId = params.id;
	const highlightWord = url.searchParams.get('word');
	const startTime = parseFloat(url.searchParams.get('t') || '0');
	const language = (url.searchParams.get('lang') === 'zh' ? 'zh' : 'ja') as 'ja' | 'zh';

	const videoUrl = `https://cdn.cosmos.so/${videoId}.mp4`;

	// Load video data based on language
	const dataFile = language === 'zh' ? '/chinese_video_data.json' : '/video_data.json';
	const transcriptFile = language === 'zh' ? null : '/reel_transcripts_full.json';

	const [dataResponse, transcriptResponse] = await Promise.all([
		fetch(dataFile),
		transcriptFile ? fetch(transcriptFile).catch(() => null) : Promise.resolve(null),
	]);
	const videoData: VideoData = await dataResponse.json();
	const allTranscripts = transcriptResponse ? await transcriptResponse.json().catch(() => ({})) : {};

	// Use full STT transcripts if available, otherwise fall back to word occurrences
	let transcript: TranscriptSegment[];

	const sttTranscript = allTranscripts[videoId];
	if (sttTranscript && sttTranscript.length > 0) {
		// Full GCP STT transcript — every word is present
		transcript = sttTranscript.map((seg: any) => ({
			start_time: seg.start_time,
			end_time: seg.end_time,
			sentence: seg.sentence,
			words: seg.words || [],
		}));
	} else {
		// Fallback: build transcript from word occurrences
		const transcriptMap = new Map<string, TranscriptSegment>();

		for (const [word, occurrences] of Object.entries(videoData.words)) {
			for (const occ of occurrences) {
				if (occ.video_id === videoId) {
					const key = `${occ.start_time}-${occ.end_time}`;
					if (!transcriptMap.has(key)) {
						transcriptMap.set(key, {
							start_time: occ.start_time,
							end_time: occ.end_time,
							sentence: occ.sentence,
							words: []
						});
					}
					const segment = transcriptMap.get(key)!;
					if (!segment.words.includes(word)) {
						segment.words.push(word);
					}
				}
			}
		}

		transcript = Array.from(transcriptMap.values())
			.sort((a, b) => a.start_time - b.start_time);
	}

	// Get video metadata
	const videoInfo = videoData.videos[videoId];

	return {
		videoId,
		videoUrl,
		highlightWord,
		startTime,
		transcript,
		language,
		sourceUrl: videoInfo?.source_url ?? null,
		author: videoInfo?.author ?? null,
		caption: videoInfo?.caption ?? null,
		duration: videoInfo?.duration ?? null
	};
};

