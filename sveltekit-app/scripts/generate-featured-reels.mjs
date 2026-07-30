import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const appDirectory = path.resolve(scriptDirectory, '..');
const candidateCountPerLanguage = 16;

async function readVideoData(filename) {
	const raw = await readFile(path.join(appDirectory, 'static', filename), 'utf8');
	return JSON.parse(raw);
}

function collectCandidates(data, language) {
	const sampleWordByVideo = new Map();

	function sampleScore(word) {
		if (/^\d+$/.test(word)) return -100;
		const characters = [...word];
		const hasIdeograph = /\p{Script=Han}/u.test(word);
		const singleKana = characters.length === 1 && /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(word);
		return (hasIdeograph ? 100 : 0) + characters.length * 5 - (singleKana ? 75 : 0);
	}

	for (const [word, occurrences] of Object.entries(data.words ?? {})) {
		for (const occurrence of occurrences) {
			const current = sampleWordByVideo.get(occurrence.video_id);
			if (!current || sampleScore(word) > sampleScore(current)) {
				sampleWordByVideo.set(occurrence.video_id, word);
			}
		}
	}

	return Object.entries(data.videos ?? {})
		.filter(([, video]) => typeof video.thumbnail === 'string' && video.thumbnail.length > 0)
		.map(([videoId, video]) => ({
			video_id: videoId,
			thumbnail: video.thumbnail,
			language,
			sample_word: sampleWordByVideo.get(videoId)
		}))
		.sort((a, b) => a.video_id.localeCompare(b.video_id))
		.slice(0, candidateCountPerLanguage);
}

function interleave(left, right) {
	const result = [];
	const length = Math.max(left.length, right.length);

	for (let index = 0; index < length; index += 1) {
		if (left[index]) result.push(left[index]);
		if (right[index]) result.push(right[index]);
	}

	return result;
}

const [japaneseData, chineseData] = await Promise.all([
	readVideoData('video_data.json'),
	readVideoData('chinese_video_data.json')
]);

const reels = interleave(
	collectCandidates(japaneseData, 'ja'),
	collectCandidates(chineseData, 'zh')
);
const outputPath = path.join(appDirectory, 'src', 'lib', 'generated', 'featured-reels.json');

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({ reels }, null, 2)}\n`, 'utf8');

console.log(`Generated ${reels.length} featured reel candidates at ${outputPath}`);
