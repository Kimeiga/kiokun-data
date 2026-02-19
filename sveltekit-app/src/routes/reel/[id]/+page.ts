import type { PageLoad } from './$types';

export const ssr = false;

interface VideoOccurrence {
	video_id: string;
	start_time: number;
	end_time: number;
	sentence: string;
}

interface VideoData {
	videos: Record<string, { url: string; word_count: number }>;
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
}

export const load: PageLoad<ReelPageData> = async ({ params, url, fetch }) => {
	const videoId = params.id;
	const highlightWord = url.searchParams.get('word');
	const startTime = parseFloat(url.searchParams.get('t') || '0');

	const videoUrl = `https://cdn.cosmos.so/${videoId}.mp4`;

	// Load video data to build transcript
	const response = await fetch('/video_data.json');
	const videoData: VideoData = await response.json();

	// Build transcript from all word occurrences in this video
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

	// Sort segments by start time
	const transcript = Array.from(transcriptMap.values())
		.sort((a, b) => a.start_time - b.start_time);

	return {
		videoId,
		videoUrl,
		highlightWord,
		startTime,
		transcript
	};
};

