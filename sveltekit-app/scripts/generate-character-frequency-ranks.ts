import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

interface FrequencyEntry {
	word: string;
	rank: number;
}

interface FrequencyData {
	japanese: FrequencyEntry[];
	chinese: FrequencyEntry[];
}

interface ComponentUseEntry {
	chars?: string[];
}

interface DictionaryCharacterData {
	chinese_char?: {
		statistics?: {
			bookCharRank?: number;
			movieCharRank?: number;
		};
	};
	japanese_words?: Array<{
		frequencyRank?: number;
	}>;
}

const appDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(appDirectory, 'static', 'frequency_list.json');
const componentUsesPath = path.join(appDirectory, 'static', 'game_data', 'component_uses.json');
const dictionaryDirectory = path.resolve(appDirectory, '..', 'output_dictionary');
const outputPath = path.join(appDirectory, 'src', 'lib', 'generated-character-frequency-ranks.ts');
const data = JSON.parse(await readFile(sourcePath, 'utf8')) as FrequencyData;
const componentUses = JSON.parse(await readFile(componentUsesPath, 'utf8')) as Record<
	string,
	Record<string, ComponentUseEntry>
>;
const ranks = new Map<string, number>();
const componentCharacters = new Set<string>();

for (const entry of [...data.japanese, ...data.chinese]) {
	const characters = [...entry.word];
	for (const character of new Set(characters)) {
		if (!/\p{Script=Han}/u.test(character)) continue;
		// A direct single-character frequency is strongest. Characters found
		// only inside common words still receive a useful, lower-confidence
		// learner rank instead of falling back to Unicode order.
		const score = entry.rank + Math.max(0, characters.length - 1) * 2_000;
		ranks.set(character, Math.min(ranks.get(character) ?? Number.POSITIVE_INFINITY, score));
	}
}

for (const usesByRole of Object.values(componentUses)) {
	for (const uses of Object.values(usesByRole)) {
		for (const character of uses.chars || []) {
			if ([...character].length === 1 && /\p{Script=Han}/u.test(character)) {
				componentCharacters.add(character);
			}
		}
	}
}

const characters = [...componentCharacters];
const batchSize = 128;
let dictionaryRanksFound = 0;

for (let offset = 0; offset < characters.length; offset += batchSize) {
	const batch = characters.slice(offset, offset + batchSize);
	const results = await Promise.all(
		batch.map(async (character) => {
			const codePoint = character.codePointAt(0) || 0;
			const subdirectory = (codePoint & 0xff).toString(16).padStart(2, '0');
			const dictionaryPath = path.join(
				dictionaryDirectory,
				subdirectory,
				`${character}.json.deflate`
			);

			try {
				const compressed = await readFile(dictionaryPath);
				const dictionary = JSON.parse(
					inflateRawSync(compressed).toString('utf8')
				) as DictionaryCharacterData;
				const candidateRanks = [
					dictionary.chinese_char?.statistics?.bookCharRank,
					dictionary.chinese_char?.statistics?.movieCharRank,
					...(dictionary.japanese_words || []).map((word) => word.frequencyRank)
				].filter((rank): rank is number => Number.isFinite(rank) && rank! > 0);

				return candidateRanks.length > 0 ? Math.min(...candidateRanks) : null;
			} catch {
				return null;
			}
		})
	);

	for (let index = 0; index < batch.length; index += 1) {
		const rank = results[index];
		if (rank === null) continue;
		dictionaryRanksFound += 1;
		ranks.set(batch[index], Math.min(ranks.get(batch[index]) ?? Number.POSITIVE_INFINITY, rank));
	}
}

const orderedCharacters = [...ranks.entries()]
	.sort((left, right) => left[1] - right[1] || left[0].localeCompare(right[0]))
	.map(([character]) => character)
	.join('');

await writeFile(
	outputPath,
	`// Generated from the learner frequency list and per-character dictionary corpus ranks.\n` +
	`export const LEARNER_CHARACTER_FREQUENCY_ORDER = ${JSON.stringify(orderedCharacters)};\n`,
	'utf8'
);

console.log(
	`Wrote ${[...orderedCharacters].length} ranked characters (${dictionaryRanksFound} from dictionary corpora) to ${outputPath}`
);
