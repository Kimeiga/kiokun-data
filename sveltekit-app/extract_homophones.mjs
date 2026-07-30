import { createReadStream, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = dirname(fileURLToPath(import.meta.url));

function appliesTo(values, target) {
	return !values?.length || values.includes('*') || values.includes(target);
}

function preferredKanji(entry, kana) {
	const allowed = (entry.kanji || []).filter(
		(kanji) => kanji.text && appliesTo(kana.appliesToKanji, kanji.text)
	);
	const displayable = allowed.filter((kanji) => !kanji.tags?.includes('sK'));
	const candidates = displayable.length > 0 ? displayable : allowed;
	return candidates.find((kanji) => kanji.common) || candidates[0] || null;
}

function applicableSenses(entry, word, reading) {
	return (entry.sense || []).filter(
		(sense) =>
			appliesTo(sense.appliesToKana, reading) &&
			appliesTo(sense.appliesToKanji, word)
	);
}

function summarizeEntry(entry, kana, sourceOrder, pitchFor) {
	const kanji = preferredKanji(entry, kana);
	const word = kanji?.text || kana.text;
	const senses = applicableSenses(entry, word, kana.text);
	const glosses = [];

	for (const sense of senses) {
		for (const gloss of sense.gloss || []) {
			if (gloss.lang && gloss.lang !== 'eng') continue;
			if (!gloss.text || glosses.includes(gloss.text)) continue;
			glosses.push(gloss.text);
			if (glosses.length === 2) break;
		}
		if (glosses.length === 2) break;
	}

	const summary = {
		i: String(entry.id),
		w: word,
		g: glosses,
		c: kanji?.common || kana.common ? 1 : 0,
		p: (senses[0]?.partOfSpeech || []).slice(0, 2),
		o: sourceOrder,
	};
	const accent = pitchFor(word, kana.text);
	if (Number.isInteger(accent)) summary.a = accent;
	return summary;
}

export function addJapaneseEntry(readingMap, entry, sourceOrder = 0, pitchFor = () => undefined) {
	for (const kana of entry.kana || []) {
		if (!kana.text || kana.tags?.includes('sk')) continue;
		let entriesById = readingMap.get(kana.text);
		if (!entriesById) {
			entriesById = new Map();
			readingMap.set(kana.text, entriesById);
		}
		if (!entriesById.has(String(entry.id))) {
			entriesById.set(
				String(entry.id),
				summarizeEntry(entry, kana, sourceOrder, pitchFor)
			);
		}
	}
}

function sortEntries(entries) {
	return entries.sort((a, b) => b.c - a.c || a.o - b.o || a.w.localeCompare(b.w, 'ja'));
}

function publicEntry(entry) {
	const { o: _sourceOrder, ...result } = entry;
	return result;
}

function sortGroups(groups) {
	return groups.sort((a, b) => {
		const commonDifference =
			b.w.reduce((count, word) => count + word.c, 0) -
			a.w.reduce((count, word) => count + word.c, 0);
		return commonDifference || b.w.length - a.w.length || a.r.localeCompare(b.r, 'ja');
	});
}

/**
 * A homophone group requires two distinct JMdict entry IDs. Alternate kanji
 * spellings within one entry are represented by one preferred headword.
 */
export function buildHomophoneGroups(readingMap) {
	const wordGroups = [];
	const characterGroups = [];

	for (const [reading, entriesById] of readingMap) {
		const entries = [...entriesById.values()];
		const words = sortEntries(entries.filter((entry) => [...entry.w].length > 1));
		const characters = sortEntries(entries.filter((entry) => [...entry.w].length === 1));

		// Keep the existing learner-facing scope: word groups need at least one
		// common entry. Character groups intentionally retain uncommon kanji.
		if (words.length >= 2 && words.some((entry) => entry.c)) {
			wordGroups.push({ r: reading, w: words.map(publicEntry) });
		}
		if (characters.length >= 2) {
			characterGroups.push({ r: reading, w: characters.map(publicEntry) });
		}
	}

	return {
		wordGroups: sortGroups(wordGroups),
		characterGroups: sortGroups(characterGroups),
	};
}

export function createPitchLookup(pitchDirectory) {
	const pitchByWord = new Map();
	for (const filename of readdirSync(pitchDirectory).filter((name) => name.endsWith('.json'))) {
		const shard = JSON.parse(readFileSync(resolve(pitchDirectory, filename), 'utf8'));
		for (const [word, readings] of Object.entries(shard)) {
			pitchByWord.set(word, readings);
		}
	}

	return (word, reading) => {
		const readings = pitchByWord.get(word);
		if (!readings) return undefined;
		if (Number.isInteger(readings[reading])) return readings[reading];
		const fallback = Object.values(readings).find(Number.isInteger);
		return fallback;
	};
}

async function buildFromJmdict(sourcePath, pitchDirectory) {
	const readingMap = new Map();
	const pitchFor = createPitchLookup(pitchDirectory);
	const lines = createInterface({
		input: createReadStream(sourcePath, { encoding: 'utf8' }),
		crlfDelay: Infinity,
	});
	let sourceOrder = 0;

	for await (const line of lines) {
		let record = line.trim();
		if (!record.startsWith('{"id":')) continue;
		if (record.endsWith(',')) record = record.slice(0, -1);
		else if (record.endsWith(']')) record = record.slice(0, -1);

		addJapaneseEntry(readingMap, JSON.parse(record), sourceOrder++, pitchFor);
		if (sourceOrder % 50_000 === 0) {
			process.stderr.write(`${sourceOrder} JMdict entries processed\n`);
		}
	}

	return { sourceOrder, ...buildHomophoneGroups(readingMap) };
}

async function main() {
	const sourcePath = resolve(appDir, '../data/jmdict-examples-eng-3.6.1.json');
	const pitchDirectory = resolve(appDir, 'static/pitch');
	const wordOutput = resolve(appDir, 'static/homophones_ja_words.json');
	const characterOutput = resolve(appDir, 'static/homophones_ja_chars.json');
	const { sourceOrder, wordGroups, characterGroups } = await buildFromJmdict(
		sourcePath,
		pitchDirectory
	);

	writeFileSync(wordOutput, JSON.stringify(wordGroups));
	writeFileSync(characterOutput, JSON.stringify(characterGroups));
	process.stderr.write(
		`Done: ${sourceOrder} JMdict entries, ${wordGroups.length} word groups, ` +
			`${characterGroups.length} character groups\n`
	);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	await main();
}
