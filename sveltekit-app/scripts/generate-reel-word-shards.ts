import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reelShardForWord } from '../src/lib/reel-shards';

interface VideoOccurrence {
	video_id: string;
	start_time: number;
	end_time: number;
	sentence: string;
}

interface VideoInfo {
	url: string;
	thumbnail?: string | null;
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
	words: Array<string | { word?: string }>;
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const appDirectory = path.resolve(scriptDirectory, '..');
const outputDirectory = path.join(appDirectory, 'static', 'reel-index');

async function generateLanguageIndex(
	language: 'ja' | 'zh',
	filename: string,
	transcriptFilename: string
) {
	const sourcePath = path.join(appDirectory, 'static', filename);
	const [data, fullTranscripts] = await Promise.all([
		readFile(sourcePath, 'utf8').then((raw) => JSON.parse(raw) as VideoData),
		readFile(path.join(appDirectory, 'static', transcriptFilename), 'utf8')
			.then((raw) => JSON.parse(raw) as Record<string, TranscriptSegment[]>)
	]);
	const publishableVideos = Object.fromEntries(
		Object.entries(data.videos).filter(([, video]) =>
			Boolean(video.source_url?.trim() || video.author?.trim())
		)
	);
	const publishableVideoIds = new Set(Object.keys(publishableVideos));
	const shards = new Map<string, Record<string, VideoOccurrence[]>>();
	const fallbackTranscripts = new Map<string, Map<string, TranscriptSegment>>();

	for (const [word, occurrences] of Object.entries(data.words)) {
		const publishableOccurrences = occurrences.filter((occurrence) =>
			publishableVideoIds.has(occurrence.video_id)
		);
		if (!publishableOccurrences.length) continue;

		const shard = reelShardForWord(word);
		const shardWords = shards.get(shard) ?? {};
		shardWords[word] = publishableOccurrences;
		shards.set(shard, shardWords);

		for (const occurrence of publishableOccurrences) {
			if (fullTranscripts[occurrence.video_id]?.length) continue;
			const videoSegments = fallbackTranscripts.get(occurrence.video_id) ?? new Map();
			const segmentKey = `${occurrence.start_time}-${occurrence.end_time}`;
			const segment = videoSegments.get(segmentKey) ?? {
				start_time: occurrence.start_time,
				end_time: occurrence.end_time,
				sentence: occurrence.sentence,
				words: []
			};
			if (!segment.words.includes(word)) segment.words.push(word);
			videoSegments.set(segmentKey, segment);
			fallbackTranscripts.set(occurrence.video_id, videoSegments);
		}
	}

	const languageDirectory = path.join(outputDirectory, language);
	await mkdir(languageDirectory, { recursive: true });
	await Promise.all(
		Array.from({ length: 256 }, (_, index) => index.toString(16).padStart(2, '0')).map((shard) =>
			writeFile(
				path.join(languageDirectory, `${shard}.json`),
				`${JSON.stringify({ words: shards.get(shard) ?? {} })}\n`,
				'utf8'
			)
		)
	);
	await writeFile(
		path.join(languageDirectory, 'videos.json'),
		`${JSON.stringify({ videos: publishableVideos })}\n`,
		'utf8'
	);

	const videoDirectory = path.join(languageDirectory, 'videos');
	await mkdir(videoDirectory, { recursive: true });
	await Promise.all(
		Object.entries(publishableVideos).map(([videoId, video]) => {
			const transcript = fullTranscripts[videoId]?.length
				? fullTranscripts[videoId]
				: [...(fallbackTranscripts.get(videoId)?.values() ?? [])]
					.sort((left, right) => left.start_time - right.start_time);
			return writeFile(
				path.join(videoDirectory, `${videoId}.json`),
				`${JSON.stringify({ video, transcript })}\n`,
				'utf8'
			);
		})
	);

	const sourceBytes = Buffer.byteLength(JSON.stringify(data));
	const largestShard = Math.max(
		...[...shards.values()].map((words) => Buffer.byteLength(JSON.stringify({ words })))
	);
	console.log(
		`${language}: ${Object.keys(data.words).length} words across ${shards.size} shards ` +
			`(largest ${Math.round(largestShard / 1024)} KB; source ${Math.round(sourceBytes / 1024)} KB; ` +
			`${Object.keys(data.videos).length - publishableVideoIds.size} unattributed videos excluded)`
	);
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await Promise.all([
	generateLanguageIndex('ja', 'video_data.json', 'reel_transcripts_full.json'),
	generateLanguageIndex('zh', 'chinese_video_data.json', 'reel_transcripts_zh_full.json')
]);
