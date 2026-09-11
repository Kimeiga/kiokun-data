import { createReadStream } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const appDirectory = path.dirname(scriptDirectory);
const repositoryDirectory = path.dirname(appDirectory);

const frequencyPath = path.join(appDirectory, 'static', 'frequency_list.json');
const japaneseDictionaryPath = path.join(
	repositoryDirectory,
	'data',
	'jmdict-examples-eng-3.6.1.json'
);
const chineseDictionaryPath = path.join(
	repositoryDirectory,
	'data',
	'chinese_dictionary_word_2025-06-25.jsonl'
);
const outputPath = path.join(appDirectory, 'static', 'pronunciation_drill.json');
const HAN_SCRIPT_RE = /\p{Script=Han}/u;

function unique(values) {
	const seen = new Set();
	const result = [];
	for (const value of values) {
		const cleaned = String(value || '').trim();
		const key = cleaned
			.normalize('NFKC')
			.toLocaleLowerCase('en')
			.replace(/[\s\u200b-\u200d\ufeff]/gu, '');
		if (!cleaned || seen.has(key)) continue;
		seen.add(key);
		result.push(cleaned);
	}
	return result;
}

function uniqueJapaneseReadings(values) {
	const seen = new Set();
	const result = [];
	for (const value of values) {
		const cleaned = String(value || '').trim();
		const key = cleaned
			.normalize('NFKC')
			.replace(/[\u30a1-\u30f6]/g, (character) =>
				String.fromCharCode(character.charCodeAt(0) - 0x60)
			);
		if (!cleaned || seen.has(key)) continue;
		seen.add(key);
		result.push(cleaned);
	}
	return result;
}

function appliesTo(values, target) {
	return !Array.isArray(values) || values.length === 0 || values.includes('*') || values.includes(target);
}

function englishGlosses(entry, target, targetIsKana) {
	return (entry.sense || [])
		.filter((sense) =>
			targetIsKana
				? appliesTo(sense.appliesToKana, target)
				: appliesTo(sense.appliesToKanji, target)
		)
		.flatMap((sense) => sense.gloss || [])
		.filter((gloss) => !gloss.lang || gloss.lang === 'eng')
		.map((gloss) => gloss.text);
}

async function collectJapaneseDetails(targets) {
	const document = JSON.parse(await readFile(japaneseDictionaryPath, 'utf8'));
	const details = new Map();

	for (const entry of document.words || []) {
		const kanjiForms = (entry.kanji || []).map((form) => form.text).filter(Boolean);
		const kanaForms = (entry.kana || []).map((form) => form.text).filter(Boolean);
		const matchingTargets = unique([...kanjiForms, ...kanaForms]).filter((form) => targets.has(form));

		for (const target of matchingTargets) {
			const targetIsKana = kanaForms.includes(target) && !kanjiForms.includes(target);
			const readings = targetIsKana
				? (entry.kana || [])
					.filter((form) => form.text === target)
					.map((form) => form.text)
				: (entry.kana || [])
					.filter((form) => appliesTo(form.appliesToKanji, target))
					.map((form) => form.text);
			const current = details.get(target) || { readings: [], definitions: [] };
			current.readings = uniqueJapaneseReadings([...current.readings, ...readings]);
			current.definitions = unique([
				...current.definitions,
				...englishGlosses(entry, target, targetIsKana)
			]);
			details.set(target, current);
		}
	}

	return details;
}

async function collectChineseDetails(targets) {
	const details = new Map();
	const lines = readline.createInterface({
		input: createReadStream(chineseDictionaryPath, { encoding: 'utf8' }),
		crlfDelay: Infinity
	});

	for await (const line of lines) {
		if (!line.trim()) continue;
		const entry = JSON.parse(line);
		const target = entry.simp || entry.trad;
		if (!targets.has(target)) continue;

		const current = details.get(target) || { readings: [], definitions: [] };
		current.readings = unique([
			...current.readings,
			...(entry.items || []).map((item) => item.pinyin)
		]);
		current.definitions = unique([
			...current.definitions,
			...(entry.items || []).flatMap((item) => item.definitions || [])
		]);
		details.set(target, current);
	}

	return details;
}

function buildCards(language, words, details) {
	return words.map((word) => {
		const detail = details.get(word.word);
		const readings = language === 'ja'
			? uniqueJapaneseReadings([word.reading, ...(detail?.readings || [])])
			: unique([word.reading, ...(detail?.readings || [])]);
		if (readings.length === 0) {
			throw new Error(`${language}:${word.word} has no pronunciation`);
		}

		return {
			language,
			rank: word.rank,
			word: word.word,
			readings,
			definition: word.definition || detail?.definitions?.[0] || ''
		};
	});
}

const frequency = JSON.parse(await readFile(frequencyPath, 'utf8'));
const japaneseWords = (frequency.japanese || []).filter((word) => HAN_SCRIPT_RE.test(word.word));
const japaneseTargets = new Set(japaneseWords.map((word) => word.word));
const chineseTargets = new Set((frequency.chinese || []).map((word) => word.word));

const [japaneseDetails, chineseDetails] = await Promise.all([
	collectJapaneseDetails(japaneseTargets),
	collectChineseDetails(chineseTargets)
]);

const output = {
	version: 1,
	languages: {
		ja: buildCards('ja', japaneseWords, japaneseDetails),
		zh: buildCards('zh', frequency.chinese || [], chineseDetails)
	}
};

await writeFile(outputPath, `${JSON.stringify(output)}\n`, 'utf8');
console.log(
	`Generated ${output.languages.ja.length} Japanese and ${output.languages.zh.length} Mandarin pronunciation cards.`
);
