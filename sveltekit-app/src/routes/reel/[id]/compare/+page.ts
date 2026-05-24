import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export interface TranscriptSegment {
	start_time: number;
	end_time: number;
	text: string;
	confidence?: number;
	notes?: string;
}

export interface TranscriptTrack {
	id: string;
	label: string;
	source: string;
	kind: string;
	segments: TranscriptSegment[];
}

export interface ComparisonPageData {
	videoId: string;
	videoUrl: string;
	sourceUrl?: string;
	author?: string;
	duration: number;
	tracks: TranscriptTrack[];
	notes?: string[];
}

export const load: PageLoad<ComparisonPageData> = async ({ params, fetch }) => {
	const response = await fetch(`/reel-transcription-tests/${params.id}.json`);
	if (!response.ok) {
		error(404, 'No transcription comparison data found for this reel');
	}

	return response.json();
};
