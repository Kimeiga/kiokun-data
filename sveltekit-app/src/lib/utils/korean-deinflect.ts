/**
 * Korean verb/adjective deinflection module
 * 
 * This module takes conjugated Korean words and returns possible dictionary forms
 * along with information about what conjugations were applied.
 * 
 * Korean conjugation patterns:
 * - Regular verbs: 먹다 (to eat) → 먹어요, 먹었어요
 * - 하다 verbs: 하다 (to do) → 해요, 했어요
 * - Irregular verbs: ㅂ, ㅅ, ㄷ, ㅡ, 르, ㄹ patterns
 */

// Reason enum - describes the type of conjugation that was undone
export enum KoreanReason {
  // Tense
  Past,
  Future,
  // Politeness levels
  Formal,        // -ㅂ니다/-습니다
  InformalPolite, // -아/어요
  InformalCasual, // -아/어
  // Negation
  Negative,      // 안, -지 않다
  NegativePolite,
  // Other forms
  Progressive,   // -고 있다
  Want,          // -고 싶다
  Imperative,    // -세요, -아/어라
  Propositive,   // -자
  Connective,    // -고, -아/어서
  Conditional,   // -면
  Reason,        // -니까
  Although,      // -지만
  Honorific,     // -시-
  Probable,      // -겠-
  Question,      // -까요?
}

// Conjugation info for display
export const KoreanReasonLabels: Record<KoreanReason, string> = {
  [KoreanReason.Past]: 'past',
  [KoreanReason.Future]: 'future',
  [KoreanReason.Formal]: 'formal',
  [KoreanReason.InformalPolite]: 'polite',
  [KoreanReason.InformalCasual]: 'casual',
  [KoreanReason.Negative]: 'negative',
  [KoreanReason.NegativePolite]: 'negative polite',
  [KoreanReason.Progressive]: 'progressive',
  [KoreanReason.Want]: 'want',
  [KoreanReason.Imperative]: 'imperative',
  [KoreanReason.Propositive]: 'propositive',
  [KoreanReason.Connective]: 'connective',
  [KoreanReason.Conditional]: 'conditional',
  [KoreanReason.Reason]: 'reason',
  [KoreanReason.Although]: 'although',
  [KoreanReason.Honorific]: 'honorific',
  [KoreanReason.Probable]: 'probable',
  [KoreanReason.Question]: 'question',
};

export interface KoreanCandidateWord {
  word: string;
  reasons: KoreanReason[];
}

// Hangul Unicode utilities
const HANGUL_START = 0xAC00;
const HANGUL_END = 0xD7A3;
const INITIAL_COUNT = 19;
const MEDIAL_COUNT = 21;
const FINAL_COUNT = 28;

// Check if character is Hangul syllable
function isHangul(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= HANGUL_START && code <= HANGUL_END;
}

// Decompose Hangul syllable into jamo indices (initial, medial, final)
function decomposeHangul(char: string): [number, number, number] | null {
  const code = char.charCodeAt(0);
  if (code < HANGUL_START || code > HANGUL_END) return null;
  
  const offset = code - HANGUL_START;
  const final = offset % FINAL_COUNT;
  const medial = Math.floor(offset / FINAL_COUNT) % MEDIAL_COUNT;
  const initial = Math.floor(offset / (FINAL_COUNT * MEDIAL_COUNT));
  
  return [initial, medial, final];
}

// Compose jamo indices into Hangul syllable
function composeHangul(initial: number, medial: number, final: number): string {
  const code = HANGUL_START + (initial * MEDIAL_COUNT + medial) * FINAL_COUNT + final;
  return String.fromCharCode(code);
}

// Remove final consonant (받침) from syllable
function removeFinal(char: string): string {
  const jamo = decomposeHangul(char);
  if (!jamo) return char;
  const [initial, medial] = jamo;
  return composeHangul(initial, medial, 0);
}

// Get the final consonant index (0 = no final)
function getFinal(char: string): number {
  const jamo = decomposeHangul(char);
  return jamo ? jamo[2] : 0;
}

// Change final consonant
function changeFinal(char: string, newFinal: number): string {
  const jamo = decomposeHangul(char);
  if (!jamo) return char;
  return composeHangul(jamo[0], jamo[1], newFinal);
}

// Final consonant indices (받침)
const FINAL_NONE = 0;
const FINAL_GIYEOK = 1;    // ㄱ
const FINAL_NIEUN = 4;     // ㄴ
const FINAL_DIGEUT = 7;    // ㄷ
const FINAL_RIEUL = 8;     // ㄹ
const FINAL_MIEUM = 16;    // ㅁ
const FINAL_BIEUP = 17;    // ㅂ
const FINAL_SIOT = 19;     // ㅅ
const FINAL_SSANG_SIOT = 20; // ㅆ

// Medial vowel indices
const MEDIAL_A = 0;   // ㅏ
const MEDIAL_AE = 1;  // ㅐ
const MEDIAL_YA = 2;  // ㅑ
const MEDIAL_EO = 4;  // ㅓ
const MEDIAL_E = 5;   // ㅔ
const MEDIAL_YEO = 6; // ㅕ
const MEDIAL_O = 8;   // ㅗ
const MEDIAL_WA = 9;  // ㅘ
const MEDIAL_OE = 11; // ㅚ
const MEDIAL_U = 13;  // ㅜ
const MEDIAL_WEO = 14; // ㅝ
const MEDIAL_WI = 16; // ㅟ
const MEDIAL_EU = 18; // ㅡ
const MEDIAL_I = 20;  // ㅣ

// Check if string contains only Hangul
export function isHangulOnly(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    // Allow Hangul syllables and compatibility jamo
    if (!((code >= 0xAC00 && code <= 0xD7A3) || // Hangul syllables
          (code >= 0x1100 && code <= 0x11FF) || // Hangul jamo
          (code >= 0x3130 && code <= 0x318F))) { // Compatibility jamo
      return false;
    }
  }
  return str.length > 0;
}

// Deinflection rule type
type KoreanDeinflectRule = {
  from: string;
  to: string;
  reasons: KoreanReason[];
};

// Build deinflection rules
// Format: [conjugated ending, dictionary ending, reasons]
const koreanDeinflectRules: KoreanDeinflectRule[] = [
  // =====================================
  // 하다 verbs (해요 체 - informal polite)
  // =====================================
  { from: '해요', to: '하다', reasons: [KoreanReason.InformalPolite] },
  { from: '했어요', to: '하다', reasons: [KoreanReason.Past, KoreanReason.InformalPolite] },
  { from: '했어', to: '하다', reasons: [KoreanReason.Past, KoreanReason.InformalCasual] },
  { from: '해', to: '하다', reasons: [KoreanReason.InformalCasual] },
  { from: '합니다', to: '하다', reasons: [KoreanReason.Formal] },
  { from: '했습니다', to: '하다', reasons: [KoreanReason.Past, KoreanReason.Formal] },
  { from: '하겠어요', to: '하다', reasons: [KoreanReason.Future, KoreanReason.InformalPolite] },
  { from: '할 거예요', to: '하다', reasons: [KoreanReason.Future, KoreanReason.InformalPolite] },
  { from: '하세요', to: '하다', reasons: [KoreanReason.Honorific, KoreanReason.InformalPolite] },
  { from: '하셨어요', to: '하다', reasons: [KoreanReason.Honorific, KoreanReason.Past, KoreanReason.InformalPolite] },
  { from: '하고', to: '하다', reasons: [KoreanReason.Connective] },
  { from: '해서', to: '하다', reasons: [KoreanReason.Reason] },
  { from: '하면', to: '하다', reasons: [KoreanReason.Conditional] },
  { from: '하지만', to: '하다', reasons: [KoreanReason.Although] },
  { from: '하지 않아요', to: '하다', reasons: [KoreanReason.NegativePolite] },
  { from: '안 해요', to: '하다', reasons: [KoreanReason.NegativePolite] },
  { from: '하고 싶어요', to: '하다', reasons: [KoreanReason.Want, KoreanReason.InformalPolite] },
  { from: '하고 있어요', to: '하다', reasons: [KoreanReason.Progressive, KoreanReason.InformalPolite] },
  { from: '하자', to: '하다', reasons: [KoreanReason.Propositive] },
  { from: '할까요', to: '하다', reasons: [KoreanReason.Question, KoreanReason.Future] },

  // =====================================
  // Regular verb endings (아/어요 체)
  // =====================================
  // Informal polite present (-아요/-어요)
  { from: '아요', to: '다', reasons: [KoreanReason.InformalPolite] },
  { from: '어요', to: '다', reasons: [KoreanReason.InformalPolite] },
  { from: '여요', to: '다', reasons: [KoreanReason.InformalPolite] },

  // Informal polite past (-았어요/-었어요)
  { from: '았어요', to: '다', reasons: [KoreanReason.Past, KoreanReason.InformalPolite] },
  { from: '었어요', to: '다', reasons: [KoreanReason.Past, KoreanReason.InformalPolite] },
  { from: '였어요', to: '다', reasons: [KoreanReason.Past, KoreanReason.InformalPolite] },

  // Informal casual present (-아/-어)
  { from: '아', to: '다', reasons: [KoreanReason.InformalCasual] },
  { from: '어', to: '다', reasons: [KoreanReason.InformalCasual] },
  { from: '여', to: '다', reasons: [KoreanReason.InformalCasual] },

  // Informal casual past (-았어/-었어)
  { from: '았어', to: '다', reasons: [KoreanReason.Past, KoreanReason.InformalCasual] },
  { from: '었어', to: '다', reasons: [KoreanReason.Past, KoreanReason.InformalCasual] },
  { from: '였어', to: '다', reasons: [KoreanReason.Past, KoreanReason.InformalCasual] },

  // Formal polite (-ㅂ니다/-습니다)
  { from: '습니다', to: '다', reasons: [KoreanReason.Formal] },
  { from: 'ㅂ니다', to: '다', reasons: [KoreanReason.Formal] },

  // Formal polite past (-았습니다/-었습니다)
  { from: '았습니다', to: '다', reasons: [KoreanReason.Past, KoreanReason.Formal] },
  { from: '었습니다', to: '다', reasons: [KoreanReason.Past, KoreanReason.Formal] },
  { from: '였습니다', to: '다', reasons: [KoreanReason.Past, KoreanReason.Formal] },

  // Future tense
  { from: '겠어요', to: '다', reasons: [KoreanReason.Future, KoreanReason.InformalPolite] },
  { from: '겠어', to: '다', reasons: [KoreanReason.Future, KoreanReason.InformalCasual] },
  { from: '겠습니다', to: '다', reasons: [KoreanReason.Future, KoreanReason.Formal] },

  // Connective forms
  { from: '고', to: '다', reasons: [KoreanReason.Connective] },
  { from: '아서', to: '다', reasons: [KoreanReason.Reason] },
  { from: '어서', to: '다', reasons: [KoreanReason.Reason] },
  { from: '여서', to: '다', reasons: [KoreanReason.Reason] },

  // Conditional (-면)
  { from: '면', to: '다', reasons: [KoreanReason.Conditional] },
  { from: '으면', to: '다', reasons: [KoreanReason.Conditional] },

  // Concessive (-지만)
  { from: '지만', to: '다', reasons: [KoreanReason.Although] },

  // Negative forms
  { from: '지 않아요', to: '다', reasons: [KoreanReason.NegativePolite] },
  { from: '지 않아', to: '다', reasons: [KoreanReason.Negative] },
  { from: '지 않습니다', to: '다', reasons: [KoreanReason.Negative, KoreanReason.Formal] },

  // Progressive (-고 있다)
  { from: '고 있어요', to: '다', reasons: [KoreanReason.Progressive, KoreanReason.InformalPolite] },
  { from: '고 있어', to: '다', reasons: [KoreanReason.Progressive, KoreanReason.InformalCasual] },
  { from: '고 있습니다', to: '다', reasons: [KoreanReason.Progressive, KoreanReason.Formal] },

  // Want (-고 싶다)
  { from: '고 싶어요', to: '다', reasons: [KoreanReason.Want, KoreanReason.InformalPolite] },
  { from: '고 싶어', to: '다', reasons: [KoreanReason.Want, KoreanReason.InformalCasual] },
  { from: '고 싶습니다', to: '다', reasons: [KoreanReason.Want, KoreanReason.Formal] },

  // Imperative
  { from: '세요', to: '다', reasons: [KoreanReason.Imperative, KoreanReason.Honorific] },
  { from: '으세요', to: '다', reasons: [KoreanReason.Imperative, KoreanReason.Honorific] },
  { from: '아라', to: '다', reasons: [KoreanReason.Imperative] },
  { from: '어라', to: '다', reasons: [KoreanReason.Imperative] },

  // Propositive (-자)
  { from: '자', to: '다', reasons: [KoreanReason.Propositive] },

  // Question forms
  { from: '아요?', to: '다', reasons: [KoreanReason.Question, KoreanReason.InformalPolite] },
  { from: '어요?', to: '다', reasons: [KoreanReason.Question, KoreanReason.InformalPolite] },
  { from: '습니까', to: '다', reasons: [KoreanReason.Question, KoreanReason.Formal] },
  { from: 'ㅂ니까', to: '다', reasons: [KoreanReason.Question, KoreanReason.Formal] },
  { from: '을까요', to: '다', reasons: [KoreanReason.Question, KoreanReason.Future] },
  { from: 'ㄹ까요', to: '다', reasons: [KoreanReason.Question, KoreanReason.Future] },

  // Honorific past
  { from: '셨어요', to: '다', reasons: [KoreanReason.Honorific, KoreanReason.Past, KoreanReason.InformalPolite] },
  { from: '셨어', to: '다', reasons: [KoreanReason.Honorific, KoreanReason.Past, KoreanReason.InformalCasual] },
  { from: '셨습니다', to: '다', reasons: [KoreanReason.Honorific, KoreanReason.Past, KoreanReason.Formal] },
];

// =====================================
// Vowel contraction rules
// =====================================
// These handle cases where stem vowels contract with endings
// e.g., 가다 + 아요 → 가요 (not 가아요)
//
// Contraction patterns:
// - ㅏ + 아 → ㅏ (가다 → 가요)
// - ㅗ + 아 → ㅘ (오다 → 와요)
// - ㅜ + 어 → ㅝ (주다 → 줘요)
// - ㅣ + 어 → ㅕ (기다 → 겨요) [less common]
// - ㅓ + 어 → ㅓ (서다 → 서요)
// - ㅡ + 어 → ㅓ (쓰다 → 써요) [ㅡ drops]
// - ㅔ/ㅐ + 어 → ㅐ/ㅔ (세다 → 세요)

type VowelContractionRule = {
  contractedMedal: number;  // The vowel in the contracted form
  originalMedal: number;    // The original stem vowel
  endingVowel: 'a' | 'eo';  // Whether the ending uses 아 or 어
};

const vowelContractionRules: VowelContractionRule[] = [
  // ㅏ + 아 → ㅏ (가다 + 아요 → 가요)
  { contractedMedal: MEDIAL_A, originalMedal: MEDIAL_A, endingVowel: 'a' },
  // ㅗ + 아 → ㅘ (오다 + 아요 → 와요)
  { contractedMedal: MEDIAL_WA, originalMedal: MEDIAL_O, endingVowel: 'a' },
  // ㅜ + 어 → ㅝ (주다 + 어요 → 줘요)
  { contractedMedal: MEDIAL_WEO, originalMedal: MEDIAL_U, endingVowel: 'eo' },
  // ㅓ + 어 → ㅓ (서다 + 어요 → 서요)
  { contractedMedal: MEDIAL_EO, originalMedal: MEDIAL_EO, endingVowel: 'eo' },
  // ㅣ + 어 → ㅕ (기다리다: 기다려요 - but this is complex)
  { contractedMedal: MEDIAL_YEO, originalMedal: MEDIAL_I, endingVowel: 'eo' },
  // ㅐ + 어 → ㅐ (보내다 + 어요 → 보내요)
  { contractedMedal: MEDIAL_AE, originalMedal: MEDIAL_AE, endingVowel: 'eo' },
  // ㅔ + 어 → ㅔ (세다 + 어요 → 세요)
  { contractedMedal: MEDIAL_E, originalMedal: MEDIAL_E, endingVowel: 'eo' },
];

/**
 * Try to apply ㅂ irregular reconstruction
 * When ㅂ irregular verbs conjugate: 춥다 → 추워 (ㅂ → 우)
 * We need to reverse: 추워 → 춥다
 */
function tryBieupIrregular(stem: string): string[] {
  const results: string[] = [];
  if (stem.length < 2) return results;

  const lastChar = stem[stem.length - 1];
  const secondLast = stem[stem.length - 2];

  // Pattern: X워 → Xㅂ다 (e.g., 추워 → 춥다, 더워 → 덥다)
  if (lastChar === '워' || lastChar === '와') {
    const jamo = decomposeHangul(secondLast);
    if (jamo && jamo[2] === FINAL_NONE) {
      // Add ㅂ as final consonant to second-last syllable
      const newSecondLast = composeHangul(jamo[0], jamo[1], FINAL_BIEUP);
      results.push(stem.slice(0, -2) + newSecondLast + '다');
    }
  }

  // Pattern: X운/움 stems (쉬운 → 쉽다)
  if (lastChar === '운' || lastChar === '움') {
    const jamo = decomposeHangul(secondLast);
    if (jamo && jamo[2] === FINAL_NONE) {
      const newSecondLast = composeHangul(jamo[0], jamo[1], FINAL_BIEUP);
      results.push(stem.slice(0, -2) + newSecondLast + '다');
    }
  }

  return results;
}

/**
 * Try to apply ㄷ irregular reconstruction
 * When ㄷ irregular verbs conjugate: 걷다 → 걸어 (ㄷ → ㄹ)
 * We need to reverse: 걸어 → 걷다
 */
function tryDigeutIrregular(stem: string): string[] {
  const results: string[] = [];
  if (stem.length < 1) return results;

  const lastChar = stem[stem.length - 1];
  const jamo = decomposeHangul(lastChar);

  // If last character ends in ㄹ, try changing to ㄷ
  if (jamo && jamo[2] === FINAL_RIEUL) {
    const newLast = composeHangul(jamo[0], jamo[1], FINAL_DIGEUT);
    results.push(stem.slice(0, -1) + newLast + '다');
  }

  return results;
}

/**
 * Try to apply ㅅ irregular reconstruction
 * When ㅅ irregular verbs conjugate: 짓다 → 지어 (ㅅ drops)
 * We need to reverse: 지어 → 짓다
 */
function trySiotIrregular(stem: string): string[] {
  const results: string[] = [];
  if (stem.length < 1) return results;

  const lastChar = stem[stem.length - 1];
  const jamo = decomposeHangul(lastChar);

  // If last character has no final consonant, try adding ㅅ
  if (jamo && jamo[2] === FINAL_NONE) {
    const newLast = composeHangul(jamo[0], jamo[1], FINAL_SIOT);
    results.push(stem.slice(0, -1) + newLast + '다');
  }

  return results;
}

/**
 * Try to apply 르 irregular reconstruction
 * When 르 irregular verbs conjugate: 빠르다 → 빨라 (르 → ㄹ라/ㄹ러)
 * We need to reverse: 빨라 → 빠르다
 */
function tryReuIrregular(stem: string): string[] {
  const results: string[] = [];
  if (stem.length < 2) return results;

  const lastChar = stem[stem.length - 1];
  const secondLast = stem[stem.length - 2];

  // Pattern: Xㄹ라/Xㄹ러 → X르다
  if ((lastChar === '라' || lastChar === '러') && secondLast) {
    const jamo = decomposeHangul(secondLast);
    if (jamo && jamo[2] === FINAL_RIEUL) {
      // Remove ㄹ from second-last and add 르다
      const newSecondLast = composeHangul(jamo[0], jamo[1], FINAL_NONE);
      results.push(stem.slice(0, -2) + newSecondLast + '르다');
    }
  }

  return results;
}

/**
 * Try to reverse vowel contractions
 * When vowels contract: 가다 + 아요 → 가요 (not 가아요)
 * We need to reconstruct the stem
 *
 * @param word - The conjugated word ending in contracted vowel + 요/etc
 * @param ending - The ending to check for (e.g., '요', '서', etc)
 * @returns Array of possible dictionary forms
 */
function tryVowelContraction(word: string, ending: string): string[] {
  const results: string[] = [];

  // Word must end with the given ending
  if (!word.endsWith(ending)) return results;

  // Get the syllable before the ending
  const beforeEnding = word.slice(0, -ending.length);
  if (beforeEnding.length < 1) return results;

  const lastChar = beforeEnding[beforeEnding.length - 1];
  const jamo = decomposeHangul(lastChar);
  if (!jamo) return results;

  const [initial, medial, final] = jamo;

  // Check each vowel contraction rule
  for (const rule of vowelContractionRules) {
    if (medial === rule.contractedMedal) {
      // Reconstruct the original stem
      const originalStemChar = composeHangul(initial, rule.originalMedal, final);
      const stem = beforeEnding.slice(0, -1) + originalStemChar;
      results.push(stem + '다');
    }
  }

  return results;
}

/**
 * Main deinflection function
 * Returns an array of possible dictionary forms with conjugation info
 */
export function koreanDeinflect(word: string): KoreanCandidateWord[] {
  const results: KoreanCandidateWord[] = [];
  const seen = new Set<string>();

  // Add original word as a candidate
  if (!seen.has(word)) {
    results.push({ word, reasons: [] });
    seen.add(word);
  }

  // Try each deinflection rule
  for (const rule of koreanDeinflectRules) {
    if (word.endsWith(rule.from)) {
      const stem = word.slice(0, -rule.from.length);
      const candidate = stem + rule.to;

      if (candidate.length > 0 && !seen.has(candidate)) {
        results.push({ word: candidate, reasons: rule.reasons });
        seen.add(candidate);
      }

      // Try irregular reconstructions on the stem
      const irregularBases = [
        ...tryBieupIrregular(stem),
        ...tryDigeutIrregular(stem),
        ...trySiotIrregular(stem),
        ...tryReuIrregular(stem),
      ];

      for (const irregular of irregularBases) {
        if (!seen.has(irregular)) {
          results.push({ word: irregular, reasons: rule.reasons });
          seen.add(irregular);
        }
      }
    }
  }

  // Try vowel contraction deinflection
  // e.g., 가요 → 가다, 와요 → 오다, 줘요 → 주다
  const vowelContractionEndings = [
    { ending: '요', reasons: [KoreanReason.InformalPolite] },
    { ending: '서', reasons: [KoreanReason.Reason] },
    { ending: '', reasons: [KoreanReason.InformalCasual] },
  ];

  for (const vc of vowelContractionEndings) {
    const contractionCandidates = tryVowelContraction(word, vc.ending);
    for (const candidate of contractionCandidates) {
      if (!seen.has(candidate)) {
        results.push({ word: candidate, reasons: vc.reasons });
        seen.add(candidate);
      }
    }
  }

  // Also try past tense vowel contractions: 갔어요 → 가다
  // The past marker ㅆ is added to contracted forms
  // Check for past tense patterns ending in 었어요/았어요 with contraction
  // e.g., 갔어요 (가 + 았어요 contracted)
  if (word.endsWith('어요') || word.endsWith('어')) {
    const beforeEnding = word.endsWith('어요') ? word.slice(0, -2) : word.slice(0, -1);
    if (beforeEnding.length >= 1) {
      const lastChar = beforeEnding[beforeEnding.length - 1];
      const jamo = decomposeHangul(lastChar);
      // If it ends in ㅆ (past marker), try to reconstruct
      if (jamo && jamo[2] === FINAL_SSANG_SIOT) {
        // Now apply vowel contraction rules to find original stem
        for (const rule of vowelContractionRules) {
          if (jamo[1] === rule.contractedMedal) {
            const originalStemChar = composeHangul(jamo[0], rule.originalMedal, FINAL_NONE);
            const candidate = beforeEnding.slice(0, -1) + originalStemChar + '다';
            if (!seen.has(candidate)) {
              results.push({ word: candidate, reasons: [KoreanReason.Past, KoreanReason.InformalPolite] });
              seen.add(candidate);
            }
          }
        }
      }
    }
  }

  // Special handling for 하다 compound verbs
  // e.g., 공부했어요 → 공부하다
  if (word.includes('했') || word.includes('해') || word.includes('합')) {
    // Try to find 하다 compound
    const hadaPatterns = [
      { from: '했어요', to: '하다' },
      { from: '했어', to: '하다' },
      { from: '해요', to: '하다' },
      { from: '해', to: '하다' },
      { from: '합니다', to: '하다' },
      { from: '했습니다', to: '하다' },
    ];

    for (const pattern of hadaPatterns) {
      if (word.endsWith(pattern.from)) {
        const base = word.slice(0, -pattern.from.length) + pattern.to;
        if (!seen.has(base)) {
          results.push({
            word: base,
            reasons: pattern.from.includes('었') || pattern.from.includes('았')
              ? [KoreanReason.Past, KoreanReason.InformalPolite]
              : [KoreanReason.InformalPolite]
          });
          seen.add(base);
        }
      }
    }
  }

  return results;
}

/**
 * Format Korean reasons into a human-readable string
 */
export function formatKoreanReasons(reasons: KoreanReason[]): string {
  if (reasons.length === 0) return '';
  return reasons.map(r => KoreanReasonLabels[r]).join('+');
}

