// Field mappings for expanding compressed dictionary JSON

/** Top-level field mappings */
export const TOP_LEVEL_MAP = {
  k: 'key',
  r: 'redirect',
  cw: 'chinese_words',
  cc: 'chinese_char',
  jw: 'japanese_words',
  jc: 'japanese_char',
  rjw: 'related_japanese_words',
  jn: 'japanese_names',
  ct: 'contains',
  cic: 'contained_in_chinese',
  cij: 'contained_in_japanese',
} as const;

/** JMnedict (Japanese Names) field mappings */
export const JMNEDICT_NAME_MAP = {
  i: 'id',
  k: 'kanji',
  n: 'kana',
  t: 'translation',
} as const;

export const JMNEDICT_KANJI_MAP = {
  t: 'text',
  g: 'tags',
} as const;

export const JMNEDICT_KANA_MAP = {
  t: 'text',
  g: 'tags',
  a: 'applies_to_kanji',
} as const;

export const JMNEDICT_TRANSLATION_MAP = {
  y: 'name_type',
  r: 'related',
  t: 'translation',
} as const;

export const JMNEDICT_TRANSLATION_TEXT_MAP = {
  l: 'lang',
  t: 'text',
} as const;

/** Japanese word field mappings */
export const JAPANESE_WORD_MAP = {
  k: 'kanji',
  ka: 'kana',
  s: 'sense',
} as const;

export const KANJI_MAP = {
  c: 'common',
  t: 'text',
  tag: 'tags',
  p: 'pitch_accents',
} as const;

export const KANA_MAP = {
  c: 'common',
  t: 'text',
  tag: 'tags',
  a: 'applies_to_kanji',
  p: 'pitch_accents',
} as const;

/** Expand an object using a field mapping */
function expandObject(obj: any, mapping: Record<string, string>): any {
  if (!obj || typeof obj !== 'object') return obj;

  const result: any = {};
  for (const key in obj) {
    const mappedKey = mapping[key] || key;
    result[mappedKey] = obj[key];
  }
  return result;
}

/** Main expand function for dictionary data */
export function expandFields(data: any): any {
  if (!data || typeof data !== 'object') return data;
  
  // Expand top-level fields
  const expanded = expandObject(data, TOP_LEVEL_MAP);
  
  // Expand japanese_words (JMdict)
  if (expanded.japanese_words && Array.isArray(expanded.japanese_words)) {
    expanded.japanese_words = expanded.japanese_words.map((word: any) => {
      const expandedWord = expandObject(word, JAPANESE_WORD_MAP);

      // Expand kanji array
      if (expandedWord.kanji && Array.isArray(expandedWord.kanji)) {
        expandedWord.kanji = expandedWord.kanji.map((k: any) => expandObject(k, KANJI_MAP));
      }

      // Expand kana array
      if (expandedWord.kana && Array.isArray(expandedWord.kana)) {
        expandedWord.kana = expandedWord.kana.map((k: any) => expandObject(k, KANA_MAP));
      }

      // Note: sense array is not expanded as it contains complex nested structures
      // that are already in the correct format

      return expandedWord;
    });
  }

  // Expand japanese_names (JMnedict)
  if (expanded.japanese_names && Array.isArray(expanded.japanese_names)) {
    expanded.japanese_names = expanded.japanese_names.map((name: any) => {
      const expandedName = expandObject(name, JMNEDICT_NAME_MAP);

      // Expand kanji array
      if (expandedName.kanji && Array.isArray(expandedName.kanji)) {
        expandedName.kanji = expandedName.kanji.map((k: any) => expandObject(k, JMNEDICT_KANJI_MAP));
      }

      // Expand kana array
      if (expandedName.kana && Array.isArray(expandedName.kana)) {
        expandedName.kana = expandedName.kana.map((k: any) => expandObject(k, JMNEDICT_KANA_MAP));
      }

      // Expand translation array
      if (expandedName.translation && Array.isArray(expandedName.translation)) {
        expandedName.translation = expandedName.translation.map((t: any) => {
          const expandedTranslation = expandObject(t, JMNEDICT_TRANSLATION_MAP);

          // Expand translation text array
          if (expandedTranslation.translation && Array.isArray(expandedTranslation.translation)) {
            expandedTranslation.translation = expandedTranslation.translation.map((tt: any) =>
              expandObject(tt, JMNEDICT_TRANSLATION_TEXT_MAP)
            );
          }

          return expandedTranslation;
        });
      }

      return expandedName;
    });
  }

  return expanded;
}
