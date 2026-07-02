import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { inflateSync } from 'fflate';
import path from 'path';

const baseDir = '../output_dictionary';
const subdirs = readdirSync(baseDir).filter(d => /^[0-9a-f]{2}$/.test(d));

// Map: reading → [{kanji, reading, glosses, common}]
const readingMap = new Map();
let fileCount = 0;
let japaneseWordCount = 0;

for (const subdir of subdirs) {
  const dir = path.join(baseDir, subdir);
  let files;
  try { files = readdirSync(dir).filter(f => f.endsWith('.json.deflate')); } catch { continue; }

  for (const f of files) {
    fileCount++;
    if (fileCount % 50000 === 0) process.stderr.write(fileCount + ' files processed\n');

    try {
      const buf = readFileSync(path.join(dir, f));
      const data = JSON.parse(new TextDecoder().decode(inflateSync(new Uint8Array(buf))));

      if (!data.japanese_words?.length) continue;

      for (const jw of data.japanese_words) {
        const kanjiTexts = jw.kanji?.filter(k => k.text)?.map(k => k.text) || [];
        const kanaTexts = jw.kana?.filter(k => k.text)?.map(k => k.text) || [];
        const isCommon = jw.kanji?.some(k => k.common) || jw.kana?.some(k => k.common) || false;

        // Get first few glosses
        const glosses = [];
        for (const sense of (jw.sense || []).slice(0, 2)) {
          for (const g of (sense.gloss || []).slice(0, 3)) {
            if (g.text) glosses.push(g.text);
          }
        }

        const pos = jw.sense?.[0]?.partOfSpeech || [];

        // For each reading, create an entry
        for (const kana of kanaTexts) {
          if (!kana) continue;

          // Use kanji forms, or the kana itself if no kanji
          const forms = kanjiTexts.length > 0 ? kanjiTexts : [kana];

          for (const form of forms) {
            if (!readingMap.has(kana)) readingMap.set(kana, []);
            readingMap.get(kana).push({
              word: form,
              reading: kana,
              glosses,
              common: isCommon,
              pos: pos.slice(0, 2),
            });
            japaneseWordCount++;
          }
        }
      }
    } catch {}
  }
}

process.stderr.write(`Done: ${fileCount} files, ${japaneseWordCount} Japanese word entries\n`);

// Filter to actual homophones (2+ different words with same reading)
const homophones = {};
let groupCount = 0;

for (const [reading, entries] of readingMap) {
  // Deduplicate by word form
  const uniqueWords = new Map();
  for (const e of entries) {
    if (!uniqueWords.has(e.word)) {
      uniqueWords.set(e.word, e);
    }
  }

  if (uniqueWords.size >= 2) {
    homophones[reading] = [...uniqueWords.values()];
    groupCount++;
  }
}

process.stderr.write(`Homophone groups: ${groupCount}\n`);

// Split into words (multi-char) and characters (single-char)
const wordHomophones = {};
const charHomophones = {};
let wordGroups = 0, charGroups = 0;

for (const [reading, entries] of Object.entries(homophones)) {
  const multiChar = entries.filter(e => e.word.length > 1);
  const singleChar = entries.filter(e => e.word.length === 1);

  if (multiChar.length >= 2) {
    wordHomophones[reading] = multiChar;
    wordGroups++;
  }
  if (singleChar.length >= 2) {
    charHomophones[reading] = singleChar;
    charGroups++;
  }
}

process.stderr.write(`Word homophones: ${wordGroups} groups\n`);
process.stderr.write(`Character homophones: ${charGroups} groups\n`);

writeFileSync('/tmp/ja_word_homophones.json', JSON.stringify(wordHomophones));
writeFileSync('/tmp/ja_char_homophones.json', JSON.stringify(charHomophones));

// Stats
const wordEntries = Object.values(wordHomophones).flat();
const charEntries = Object.values(charHomophones).flat();
console.log(JSON.stringify({
  wordGroups,
  charGroups,
  wordEntries: wordEntries.length,
  charEntries: charEntries.length,
  commonWordGroups: Object.entries(wordHomophones).filter(([_, e]) => e.some(x => x.common)).length,
}));
