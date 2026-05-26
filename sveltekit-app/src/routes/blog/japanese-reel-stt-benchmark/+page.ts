import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const prerender = true;

export interface TranscriptSegment {
	start_time: number;
	end_time: number;
	text: string;
	confidence?: number;
	notes?: string;
	language_code?: string;
}

export interface TranscriptTrack {
	id: string;
	label: string;
	source: string;
	kind: string;
	segments: TranscriptSegment[];
}

export interface BenchmarkData {
	videoId: string;
	videoUrl: string;
	sourceUrl?: string;
	author?: string;
	duration: number;
	tracks: TranscriptTrack[];
	notes?: string[];
}

export const load: PageLoad<BenchmarkData> = async ({ fetch }) => {
	const response = await fetch('/blog/japanese-reel-stt-benchmark.json');
	if (!response.ok) {
		error(404, 'Japanese STT benchmark data not found');
	}

	return response.json();
};
