/**
 * Japanese verb deinflection module
 * Adapted from 10ten-ja-reader (https://github.com/birchill/10ten-ja-reader)
 * 
 * This module takes conjugated Japanese words and returns possible dictionary forms
 * along with information about what conjugations were applied.
 */

// Reason enum - describes the type of conjugation that was undone
export enum Reason {
  PolitePastNegative,
  PoliteNegative,
  PoliteVolitional,
  Chau,
  Sugiru,
  PolitePast,
  Tara,
  Tari,
  Causative,
  PotentialOrPassive,
  Toku,
  Sou,
  Tai,
  Polite,
  Respectful,
  Humble,
  HumbleOrKansaiDialect,
  Past,
  Negative,
  Passive,
  Ba,
  Volitional,
  Potential,
  EruUru,
  CausativePassive,
  Te,
  Zu,
  Imperative,
  MasuStem,
  Adv,
  Noun,
  ImperativeNegative,
  Continuous,
  Ki,
  SuruNoun,
  ZaruWoEnai,
  NegativeTe,
  Irregular,
}

// Human-readable labels for each reason
export const reasonLabels: { [key in Reason]: string } = {
  [Reason.PolitePastNegative]: 'polite past negative',
  [Reason.PoliteNegative]: 'polite negative',
  [Reason.PoliteVolitional]: 'polite volitional',
  [Reason.Chau]: '-chau',
  [Reason.Sugiru]: '-sugiru',
  [Reason.PolitePast]: 'polite past',
  [Reason.Tara]: '-tara',
  [Reason.Tari]: '-tari',
  [Reason.Causative]: 'causative',
  [Reason.PotentialOrPassive]: 'potential or passive',
  [Reason.Toku]: '-te oku',
  [Reason.Sou]: '-sou',
  [Reason.Tai]: '-tai',
  [Reason.Polite]: 'polite',
  [Reason.Respectful]: 'respectful',
  [Reason.Humble]: 'humble',
  [Reason.HumbleOrKansaiDialect]: 'humble or Kansai dialect',
  [Reason.Past]: 'past',
  [Reason.Negative]: 'negative',
  [Reason.Passive]: 'passive',
  [Reason.Ba]: '-ba',
  [Reason.Volitional]: 'volitional',
  [Reason.Potential]: 'potential',
  [Reason.EruUru]: '-eru/-uru',
  [Reason.CausativePassive]: 'causative passive',
  [Reason.Te]: '-te',
  [Reason.Zu]: '-zu',
  [Reason.Imperative]: 'imperative',
  [Reason.MasuStem]: 'masu stem',
  [Reason.Adv]: 'adv',
  [Reason.Noun]: 'noun',
  [Reason.ImperativeNegative]: 'imperative negative',
  [Reason.Continuous]: 'continuous',
  [Reason.Ki]: '-ki',
  [Reason.SuruNoun]: '-suru',
  [Reason.ZaruWoEnai]: '"have no choice but to"',
  [Reason.NegativeTe]: 'negative -te',
  [Reason.Irregular]: 'irregular',
};

// Word type flags - used for bitwise operations
export enum WordType {
  IchidanVerb = 1 << 0, // ru-verbs
  GodanVerb = 1 << 1, // u-verbs
  IAdj = 1 << 2,
  KuruVerb = 1 << 3,
  SuruVerb = 1 << 4,
  SpecialSuruVerb = 1 << 5,
  NounVS = 1 << 6,
  All = (1 << 0) | (1 << 1) | (1 << 2) | (1 << 3) | (1 << 4) | (1 << 5) | (1 << 6),
  // Intermediate types
  Initial = 1 << 7, // original word before any deinflection (from-type only)
  TaTeStem = 1 << 8,
  DaDeStem = 1 << 9,
  MasuStem = 1 << 10,
  IrrealisStem = 1 << 11,
}

type DeinflectRule = {
  from: string;
  to: string;
  fromType: number;
  toType: number;
  reasons: Array<Reason>;
};

export interface CandidateWord {
  // The de-inflected candidate word
  word: string;
  // An optional sequence of reasons describing how |word| was derived
  reasonChains: Array<Array<Reason>>;
  // Bitfield of possible word types
  type: number;
}

// Map JMdict part-of-speech tags to WordType flags
export function posToWordType(pos: string[]): number {
  let type = 0;
  for (const p of pos) {
    if (p === 'v1' || p === 'v1_s' || p === 'vz') type |= WordType.IchidanVerb;
    if (p.startsWith('v5') || p.startsWith('v4')) type |= WordType.GodanVerb;
    if (p === 'adj_i' || p === 'adj_ix') type |= WordType.IAdj;
    if (p === 'vk') type |= WordType.KuruVerb;
    if (p === 'vs_i' || p === 'vs') type |= WordType.SuruVerb;
    if (p === 'vs_s' || p === 'vs_c') type |= WordType.SpecialSuruVerb;
    if (p === 'vs') type |= WordType.NounVS;
  }
  return type;
}

// Format reason chain into human-readable string
export function formatReasonChain(reasons: Reason[]): string {
  return reasons.map(r => reasonLabels[r]).join(' → ');
}

// Format all reason chains into a single string
export function formatReasonChains(chains: Reason[][]): string {
  if (chains.length === 0) return '';
  if (chains.length === 1) return formatReasonChain(chains[0]);
  return chains.map(c => formatReasonChain(c)).join(' or ');
}

// Helper to convert katakana to hiragana
function kanaToHiragana(str: string): string {
  return str.replace(/[\u30A1-\u30F6]/g, (match) => {
    return String.fromCharCode(match.charCodeAt(0) - 0x60);
  });
}

// Romaji to hiragana conversion map
const romajiToHiraganaMap: Record<string, string> = {
  // Basic vowels
  'a': 'あ', 'i': 'い', 'u': 'う', 'e': 'え', 'o': 'お',
  // K-row
  'ka': 'か', 'ki': 'き', 'ku': 'く', 'ke': 'け', 'ko': 'こ',
  // S-row
  'sa': 'さ', 'si': 'し', 'shi': 'し', 'su': 'す', 'se': 'せ', 'so': 'そ',
  // T-row
  'ta': 'た', 'ti': 'ち', 'chi': 'ち', 'tu': 'つ', 'tsu': 'つ', 'te': 'て', 'to': 'と',
  // N-row
  'na': 'な', 'ni': 'に', 'nu': 'ぬ', 'ne': 'ね', 'no': 'の',
  // H-row
  'ha': 'は', 'hi': 'ひ', 'hu': 'ふ', 'fu': 'ふ', 'he': 'へ', 'ho': 'ほ',
  // M-row
  'ma': 'ま', 'mi': 'み', 'mu': 'む', 'me': 'め', 'mo': 'も',
  // Y-row
  'ya': 'や', 'yu': 'ゆ', 'yo': 'よ',
  // R-row
  'ra': 'ら', 'ri': 'り', 'ru': 'る', 're': 'れ', 'ro': 'ろ',
  // W-row
  'wa': 'わ', 'wo': 'を',
  // N
  'n': 'ん', "n'": 'ん',
  // G-row (voiced)
  'ga': 'が', 'gi': 'ぎ', 'gu': 'ぐ', 'ge': 'げ', 'go': 'ご',
  // Z-row (voiced)
  'za': 'ざ', 'zi': 'じ', 'ji': 'じ', 'zu': 'ず', 'ze': 'ぜ', 'zo': 'ぞ',
  // D-row (voiced)
  'da': 'だ', 'di': 'ぢ', 'du': 'づ', 'de': 'で', 'do': 'ど',
  // B-row (voiced)
  'ba': 'ば', 'bi': 'び', 'bu': 'ぶ', 'be': 'べ', 'bo': 'ぼ',
  // P-row (half-voiced)
  'pa': 'ぱ', 'pi': 'ぴ', 'pu': 'ぷ', 'pe': 'ぺ', 'po': 'ぽ',
  // Combo sounds
  'kya': 'きゃ', 'kyu': 'きゅ', 'kyo': 'きょ',
  'sha': 'しゃ', 'shu': 'しゅ', 'sho': 'しょ', 'sya': 'しゃ', 'syu': 'しゅ', 'syo': 'しょ',
  'cha': 'ちゃ', 'chu': 'ちゅ', 'cho': 'ちょ', 'tya': 'ちゃ', 'tyu': 'ちゅ', 'tyo': 'ちょ',
  'nya': 'にゃ', 'nyu': 'にゅ', 'nyo': 'にょ',
  'hya': 'ひゃ', 'hyu': 'ひゅ', 'hyo': 'ひょ',
  'mya': 'みゃ', 'myu': 'みゅ', 'myo': 'みょ',
  'rya': 'りゃ', 'ryu': 'りゅ', 'ryo': 'りょ',
  'gya': 'ぎゃ', 'gyu': 'ぎゅ', 'gyo': 'ぎょ',
  'ja': 'じゃ', 'ju': 'じゅ', 'jo': 'じょ', 'jya': 'じゃ', 'jyu': 'じゅ', 'jyo': 'じょ',
  'bya': 'びゃ', 'byu': 'びゅ', 'byo': 'びょ',
  'pya': 'ぴゃ', 'pyu': 'ぴゅ', 'pyo': 'ぴょ',
  // Small tsu (double consonant) handled separately
};

// Convert romaji to hiragana
function romajiToHiragana(str: string): string {
  let result = '';
  let i = 0;
  const lower = str.toLowerCase();

  while (i < lower.length) {
    // Check for double consonant (small tsu)
    if (i < lower.length - 1 &&
        lower[i] === lower[i + 1] &&
        'kstpgzdbcfhjmrw'.includes(lower[i])) {
      result += 'っ';
      i++;
      continue;
    }

    // Try 3-char, then 2-char, then 1-char matches
    let matched = false;
    for (const len of [3, 2, 1]) {
      const chunk = lower.slice(i, i + len);
      if (romajiToHiraganaMap[chunk]) {
        result += romajiToHiraganaMap[chunk];
        i += len;
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Keep original character if no match
      result += str[i];
      i++;
    }
  }

  return result;
}

// Check if string contains only romaji characters
function isRomaji(str: string): boolean {
  return /^[a-zA-Z']+$/.test(str);
}

// Normalize input: convert katakana and romaji to hiragana
export function normalizeToHiragana(str: string): string {
  if (isRomaji(str)) {
    return romajiToHiragana(str);
  }
  return kanaToHiragana(str);
}

// Deinflection rules data
// Format: [from, to, fromType, toType, reasons]
// prettier-ignore
const deinflectRuleData: Array<
  [from: string, to: string, fromType: number, toType: number, reasons: Array<Reason>]
> = [
  // -------------- 7 --------------
  ['ていらっしゃい', '', WordType.Initial, WordType.TaTeStem, [Reason.Respectful, Reason.Continuous, Reason.Imperative]],
  ['ていらっしゃる', '', WordType.GodanVerb, WordType.TaTeStem, [Reason.Respectful, Reason.Continuous]],
  ['でいらっしゃい', '', WordType.Initial, WordType.DaDeStem, [Reason.Respectful, Reason.Continuous, Reason.Imperative]],
  ['でいらっしゃる', '', WordType.GodanVerb, WordType.DaDeStem, [Reason.Respectful, Reason.Continuous]],
  // -------------- 6 --------------
  ['いらっしゃい', 'いらっしゃる', WordType.MasuStem, WordType.GodanVerb, [Reason.MasuStem]],
  ['いらっしゃい', 'いらっしゃる', WordType.Initial, WordType.GodanVerb, [Reason.Imperative]],
  ['くありません', 'い', WordType.Initial, WordType.IAdj, [Reason.PoliteNegative]],
  ['ざるをえない', '', WordType.IAdj, WordType.IrrealisStem, [Reason.ZaruWoEnai]],
  ['ざるを得ない', '', WordType.IAdj, WordType.IrrealisStem, [Reason.ZaruWoEnai]],
  ['ませんでした', '', WordType.Initial, WordType.MasuStem, [Reason.PolitePastNegative]],
  ['てらっしゃい', '', WordType.Initial, WordType.TaTeStem, [Reason.Respectful, Reason.Continuous, Reason.Imperative]],
  ['てらっしゃい', 'てらっしゃる', WordType.MasuStem, WordType.GodanVerb, [Reason.MasuStem]],
  ['てらっしゃる', '', WordType.GodanVerb, WordType.TaTeStem, [Reason.Respectful, Reason.Continuous]],
  ['でらっしゃい', '', WordType.Initial, WordType.DaDeStem, [Reason.Respectful, Reason.Continuous, Reason.Imperative]],
  ['でらっしゃい', 'でらっしゃる', WordType.MasuStem, WordType.GodanVerb, [Reason.MasuStem]],
  ['でらっしゃる', '', WordType.GodanVerb, WordType.DaDeStem, [Reason.Respectful, Reason.Continuous]],
  // -------------- 5 --------------
  ['おっしゃい', 'おっしゃる', WordType.MasuStem, WordType.GodanVerb, [Reason.MasuStem]],
  ['おっしゃい', 'おっしゃる', WordType.Initial, WordType.GodanVerb, [Reason.Imperative]],
  ['ざるえない', '', WordType.IAdj, WordType.IrrealisStem, [Reason.ZaruWoEnai]],
  ['ざる得ない', '', WordType.IAdj, WordType.IrrealisStem, [Reason.ZaruWoEnai]],
  ['ざるをえぬ', '', WordType.IAdj, WordType.IrrealisStem, [Reason.ZaruWoEnai]],
  ['ざるを得ぬ', '', WordType.IAdj, WordType.IrrealisStem, [Reason.ZaruWoEnai]],
  // -------------- 4 --------------
  ['かったら', 'い', WordType.Initial, WordType.IAdj, [Reason.Tara]],
  ['かったり', 'い', WordType.Initial, WordType.IAdj, [Reason.Tari]],
  ['ください', 'くださる', WordType.MasuStem, WordType.GodanVerb, [Reason.MasuStem]],
  ['ください', 'くださる', WordType.Initial, WordType.GodanVerb, [Reason.Imperative]],
  ['こさせる', 'くる', WordType.IchidanVerb, WordType.KuruVerb, [Reason.Causative]],
  ['こられる', 'くる', WordType.IchidanVerb, WordType.KuruVerb, [Reason.PotentialOrPassive]],
  ['さないで', 'する', WordType.Initial, WordType.SpecialSuruVerb, [Reason.Irregular, Reason.NegativeTe]],
  ['ざるえぬ', '', WordType.IAdj, WordType.IrrealisStem, [Reason.ZaruWoEnai]],
  ['ざる得ぬ', '', WordType.IAdj, WordType.IrrealisStem, [Reason.ZaruWoEnai]],
  ['しないで', 'する', WordType.Initial, WordType.SuruVerb, [Reason.NegativeTe]],
  ['しさせる', 'する', WordType.IchidanVerb, WordType.SpecialSuruVerb, [Reason.Irregular, Reason.Causative]],
  ['しられる', 'する', WordType.IchidanVerb, WordType.SpecialSuruVerb, [Reason.Irregular, Reason.PotentialOrPassive]],
  ['せさせる', 'する', WordType.IchidanVerb, WordType.SpecialSuruVerb, [Reason.Irregular, Reason.Causative]],
  ['せられる', 'する', WordType.IchidanVerb, WordType.SpecialSuruVerb, [Reason.Irregular, Reason.PotentialOrPassive]],
  ['ぜさせる', 'ずる', WordType.IchidanVerb, WordType.SpecialSuruVerb, [Reason.Irregular, Reason.Causative]],
  ['ぜられる', 'ずる', WordType.IchidanVerb, WordType.SpecialSuruVerb, [Reason.Irregular, Reason.PotentialOrPassive]],
  ['たゆたう', 'たゆたう', WordType.TaTeStem, WordType.GodanVerb, []],
  ['たゆとう', 'たゆとう', WordType.TaTeStem, WordType.GodanVerb, []],
  ['のたまう', 'のたまう', WordType.TaTeStem, WordType.GodanVerb, []],
  ['のたもう', 'のたもう', WordType.TaTeStem, WordType.GodanVerb, []],
  ['ましたら', '', WordType.Initial, WordType.MasuStem, [Reason.Polite, Reason.Tara]],
  ['ましたり', '', WordType.Initial, WordType.MasuStem, [Reason.Polite, Reason.Tari]],
  ['ましょう', '', WordType.Initial, WordType.MasuStem, [Reason.PoliteVolitional]],
  // -------------- 3 --------------
  ['いたす', '', WordType.GodanVerb, WordType.MasuStem, [Reason.Humble]],
  ['いたす', '', WordType.GodanVerb, WordType.NounVS, [Reason.SuruNoun, Reason.Humble]],
  ['かった', 'い', WordType.Initial, WordType.IAdj, [Reason.Past]],
  ['下さい', '下さる', WordType.MasuStem, WordType.GodanVerb, [Reason.MasuStem]],
  ['下さい', '下さる', WordType.Initial, WordType.GodanVerb, [Reason.Imperative]],
  ['くない', 'い', WordType.IAdj, WordType.IAdj, [Reason.Negative]],
  ['ければ', 'い', WordType.Initial, WordType.IAdj, [Reason.Ba]],
  ['こよう', 'くる', WordType.Initial, WordType.KuruVerb, [Reason.Volitional]],
  ['これる', 'くる', WordType.IchidanVerb, WordType.KuruVerb, [Reason.Potential]],
  ['来れる', '来る', WordType.IchidanVerb, WordType.KuruVerb, [Reason.Potential]],
  ['來れる', '來る', WordType.IchidanVerb, WordType.KuruVerb, [Reason.Potential]],
  ['ござい', 'ござる', WordType.MasuStem, WordType.GodanVerb, [Reason.MasuStem]],
  ['ご座い', 'ご座る', WordType.MasuStem, WordType.GodanVerb, [Reason.MasuStem]],
  ['御座い', '御座る', WordType.MasuStem, WordType.GodanVerb, [Reason.MasuStem]],
  ['させる', 'る', WordType.IchidanVerb, WordType.IchidanVerb | WordType.KuruVerb, [Reason.Causative]],
  ['させる', 'する', WordType.IchidanVerb, WordType.SuruVerb, [Reason.Causative]],
  ['さない', 'する', WordType.IAdj, WordType.SpecialSuruVerb, [Reason.Irregular, Reason.Negative]],
  ['される', '', WordType.IchidanVerb, WordType.IrrealisStem, [Reason.CausativePassive]],
  ['される', 'する', WordType.IchidanVerb, WordType.SuruVerb, [Reason.Passive]],
  ['しうる', 'する', WordType.Initial, WordType.SuruVerb, [Reason.EruUru]],
  ['しえる', 'する', WordType.IchidanVerb, WordType.SuruVerb, [Reason.EruUru]],
  ['しない', 'する', WordType.IAdj, WordType.SuruVerb, [Reason.Negative]],
  ['しよう', 'する', WordType.Initial, WordType.SuruVerb, [Reason.Volitional]],
  ['じゃう', '', WordType.GodanVerb, WordType.DaDeStem, [Reason.Chau]],
  ['すぎる', 'い', WordType.IchidanVerb, WordType.IAdj, [Reason.Sugiru]],
  ['すぎる', '', WordType.IchidanVerb, WordType.MasuStem, [Reason.Sugiru]],
  ['過ぎる', 'い', WordType.IchidanVerb, WordType.IAdj, [Reason.Sugiru]],
  ['過ぎる', '', WordType.IchidanVerb, WordType.MasuStem, [Reason.Sugiru]],
  ['ずれば', 'ずる', WordType.Initial, WordType.SpecialSuruVerb, [Reason.Irregular, Reason.Ba]],
  ['たまう', 'たまう', WordType.TaTeStem, WordType.GodanVerb, []],
  ['たもう', 'たもう', WordType.TaTeStem, WordType.GodanVerb, []],
  ['揺蕩う', '揺蕩う', WordType.TaTeStem, WordType.GodanVerb, []],
  ['ちゃう', '', WordType.GodanVerb, WordType.TaTeStem, [Reason.Chau]],
  ['ている', '', WordType.IchidanVerb, WordType.TaTeStem, [Reason.Continuous]],
  ['ておる', '', WordType.GodanVerb, WordType.TaTeStem, [Reason.HumbleOrKansaiDialect, Reason.Continuous]],
  ['でいる', '', WordType.IchidanVerb, WordType.DaDeStem, [Reason.Continuous]],
  ['でおる', '', WordType.GodanVerb, WordType.DaDeStem, [Reason.HumbleOrKansaiDialect, Reason.Continuous]],
  ['できる', 'する', WordType.IchidanVerb, WordType.SuruVerb, [Reason.Potential]],
  ['ないで', '', WordType.Initial, WordType.IrrealisStem, [Reason.NegativeTe]],
  ['なさい', '', WordType.Initial, WordType.MasuStem, [Reason.Respectful, Reason.Imperative]],
  ['なさい', 'なさる', WordType.MasuStem, WordType.GodanVerb, [Reason.MasuStem]],
  ['なさい', 'なさる', WordType.Initial, WordType.GodanVerb, [Reason.Imperative]],
  ['なさる', '', WordType.GodanVerb, WordType.MasuStem, [Reason.Respectful]],
  ['なさる', '', WordType.GodanVerb, WordType.NounVS, [Reason.SuruNoun, Reason.Respectful]],
  ['になる', '', WordType.GodanVerb, WordType.MasuStem, [Reason.Respectful]],
  ['になる', '', WordType.GodanVerb, WordType.NounVS, [Reason.SuruNoun, Reason.Respectful]],
  ['ました', '', WordType.Initial, WordType.MasuStem, [Reason.PolitePast]],
  ['まして', '', WordType.Initial, WordType.MasuStem, [Reason.Polite, Reason.Te]],
  ['ません', '', WordType.Initial, WordType.MasuStem, [Reason.PoliteNegative]],
  ['られる', 'る', WordType.IchidanVerb, WordType.IchidanVerb | WordType.KuruVerb, [Reason.PotentialOrPassive]],
  // -------------- 2 --------------
  ['致す', '', WordType.GodanVerb, WordType.MasuStem, [Reason.Humble]],
  ['致す', '', WordType.GodanVerb, WordType.NounVS, [Reason.SuruNoun, Reason.Humble]],
  ['えば', 'う', WordType.Initial, WordType.GodanVerb, [Reason.Ba]],
  ['える', 'う', WordType.IchidanVerb, WordType.GodanVerb, [Reason.Potential]],
  ['得る', '', WordType.IchidanVerb, WordType.MasuStem, [Reason.EruUru]],
  ['おう', 'う', WordType.Initial, WordType.GodanVerb, [Reason.Volitional]],
  ['仰い', '仰る', WordType.MasuStem, WordType.GodanVerb, [Reason.MasuStem]],
  ['仰い', '仰る', WordType.Initial, WordType.GodanVerb, [Reason.Imperative]],
  ['くて', 'い', WordType.Initial, WordType.IAdj, [Reason.Te]],
  ['けば', 'く', WordType.Initial, WordType.GodanVerb, [Reason.Ba]],
  ['げば', 'ぐ', WordType.Initial, WordType.GodanVerb, [Reason.Ba]],
  ['ける', 'く', WordType.IchidanVerb, WordType.GodanVerb, [Reason.Potential]],
  ['げる', 'ぐ', WordType.IchidanVerb, WordType.GodanVerb, [Reason.Potential]],
  ['こい', 'くる', WordType.Initial, WordType.KuruVerb, [Reason.Imperative]],
  ['こう', 'く', WordType.Initial, WordType.GodanVerb, [Reason.Volitional]],
  ['ごう', 'ぐ', WordType.Initial, WordType.GodanVerb, [Reason.Volitional]],
  ['しろ', 'する', WordType.Initial, WordType.SuruVerb, [Reason.Imperative]],
  ['さず', 'する', WordType.Initial, WordType.SpecialSuruVerb, [Reason.Irregular, Reason.Zu]],
  ['すぎ', 'い', WordType.Initial, WordType.IAdj, [Reason.Sugiru]],
  ['すぎ', '', WordType.Initial, WordType.MasuStem, [Reason.Sugiru]],
  ['過ぎ', 'い', WordType.Initial, WordType.IAdj, [Reason.Sugiru]],
  ['過ぎ', '', WordType.Initial, WordType.MasuStem, [Reason.Sugiru]],
  ['する', '', WordType.SuruVerb, WordType.NounVS, [Reason.SuruNoun]],
  ['せず', 'する', WordType.Initial, WordType.SuruVerb, [Reason.Zu]],
  ['せぬ', 'する', WordType.Initial, WordType.SuruVerb, [Reason.Negative]],
  ['せん', 'する', WordType.Initial, WordType.SuruVerb, [Reason.Negative]],
  ['せば', 'す', WordType.Initial, WordType.GodanVerb, [Reason.Ba]],
  ['せば', 'する', WordType.Initial, WordType.SpecialSuruVerb, [Reason.Irregular, Reason.Ba]],
  ['せよ', 'する', WordType.Initial, WordType.SuruVerb, [Reason.Imperative]],
  ['せる', 'す', WordType.IchidanVerb, WordType.GodanVerb, [Reason.Potential]],
  ['せる', '', WordType.IchidanVerb, WordType.IrrealisStem, [Reason.Causative]],
  ['ぜず', 'ずる', WordType.Initial, WordType.SpecialSuruVerb, [Reason.Irregular, Reason.Zu]],
  ['ぜぬ', 'ずる', WordType.Initial, WordType.SpecialSuruVerb, [Reason.Irregular, Reason.Negative]],
  ['ぜよ', 'ずる', WordType.Initial, WordType.SpecialSuruVerb, [Reason.Irregular, Reason.Imperative]],
  ['そう', '', WordType.Initial, WordType.MasuStem, [Reason.Sou]],
  ['そう', 'い', WordType.Initial, WordType.IAdj, [Reason.Sou]],
  ['そう', 'す', WordType.Initial, WordType.GodanVerb, [Reason.Volitional]],
  ['そう', 'する', WordType.Initial, WordType.SpecialSuruVerb, [Reason.Irregular, Reason.Volitional]],
  ['たい', '', WordType.IAdj, WordType.MasuStem, [Reason.Tai]],
  ['たら', '', WordType.Initial, WordType.TaTeStem, [Reason.Tara]],
  ['だら', '', WordType.Initial, WordType.DaDeStem, [Reason.Tara]],
  ['たり', '', WordType.Initial, WordType.TaTeStem, [Reason.Tari]],
  ['だり', '', WordType.Initial, WordType.DaDeStem, [Reason.Tari]],
  ['てば', 'つ', WordType.Initial, WordType.GodanVerb, [Reason.Ba]],
  ['てる', 'つ', WordType.IchidanVerb, WordType.GodanVerb, [Reason.Potential]],
  ['てる', '', WordType.IchidanVerb, WordType.TaTeStem, [Reason.Continuous]],
  ['でる', '', WordType.IchidanVerb, WordType.DaDeStem, [Reason.Continuous]],
  ['とう', 'つ', WordType.Initial, WordType.GodanVerb, [Reason.Volitional]],
  ['とく', '', WordType.GodanVerb, WordType.TaTeStem, [Reason.Toku]],
  ['とる', '', WordType.GodanVerb, WordType.TaTeStem, [Reason.HumbleOrKansaiDialect, Reason.Continuous]],
  ['どく', '', WordType.GodanVerb, WordType.DaDeStem, [Reason.Toku]],
  ['どる', '', WordType.GodanVerb, WordType.DaDeStem, [Reason.HumbleOrKansaiDialect, Reason.Continuous]],
  ['ない', '', WordType.IAdj, WordType.IrrealisStem, [Reason.Negative]],
  ['ねば', 'ぬ', WordType.Initial, WordType.GodanVerb, [Reason.Ba]],
  ['ねる', 'ぬ', WordType.IchidanVerb, WordType.GodanVerb, [Reason.Potential]],
  ['のう', 'ぬ', WordType.Initial, WordType.GodanVerb, [Reason.Volitional]],
  ['べば', 'ぶ', WordType.Initial, WordType.GodanVerb, [Reason.Ba]],
  ['べる', 'ぶ', WordType.IchidanVerb, WordType.GodanVerb, [Reason.Potential]],
  ['ぼう', 'ぶ', WordType.Initial, WordType.GodanVerb, [Reason.Volitional]],
  ['ます', '', WordType.Initial, WordType.MasuStem, [Reason.Polite]],
  ['ませ', '', WordType.Initial, WordType.MasuStem, [Reason.Polite, Reason.Imperative]],
  ['めば', 'む', WordType.Initial, WordType.GodanVerb, [Reason.Ba]],
  ['める', 'む', WordType.IchidanVerb, WordType.GodanVerb, [Reason.Potential]],
  ['もう', 'む', WordType.Initial, WordType.GodanVerb, [Reason.Volitional]],
  ['よう', 'る', WordType.Initial, WordType.IchidanVerb | WordType.KuruVerb, [Reason.Volitional]],
  ['れば', 'る', WordType.Initial, WordType.IchidanVerb | WordType.GodanVerb | WordType.KuruVerb | WordType.SuruVerb, [Reason.Ba]],
  ['れる', 'る', WordType.IchidanVerb, WordType.IchidanVerb | WordType.GodanVerb, [Reason.Potential]],
  ['れる', '', WordType.IchidanVerb, WordType.IrrealisStem, [Reason.Passive]],
  ['ろう', 'る', WordType.Initial, WordType.GodanVerb, [Reason.Volitional]],
  // Irregular て-form stems
  ['いっ', 'いく', WordType.TaTeStem, WordType.GodanVerb, []],
  ['おう', 'おう', WordType.TaTeStem, WordType.GodanVerb, []],
  ['こう', 'こう', WordType.TaTeStem, WordType.GodanVerb, []],
  ['そう', 'そう', WordType.TaTeStem, WordType.GodanVerb, []],
  ['とう', 'とう', WordType.TaTeStem, WordType.GodanVerb, []],
  ['行っ', '行く', WordType.TaTeStem, WordType.GodanVerb, []],
  ['逝っ', '逝く', WordType.TaTeStem, WordType.GodanVerb, []],
  ['往っ', '往く', WordType.TaTeStem, WordType.GodanVerb, []],
  ['請う', '請う', WordType.TaTeStem, WordType.GodanVerb, []],
  ['乞う', '乞う', WordType.TaTeStem, WordType.GodanVerb, []],
  ['恋う', '恋う', WordType.TaTeStem, WordType.GodanVerb, []],
  ['問う', '問う', WordType.TaTeStem, WordType.GodanVerb, []],
  ['負う', '負う', WordType.TaTeStem, WordType.GodanVerb, []],
  ['沿う', '沿う', WordType.TaTeStem, WordType.GodanVerb, []],
  ['添う', '添う', WordType.TaTeStem, WordType.GodanVerb, []],
  ['副う', '副う', WordType.TaTeStem, WordType.GodanVerb, []],
  ['厭う', '厭う', WordType.TaTeStem, WordType.GodanVerb, []],
  ['給う', '給う', WordType.TaTeStem, WordType.GodanVerb, []],
  ['賜う', '賜う', WordType.TaTeStem, WordType.GodanVerb, []],
  ['宣う', '宣う', WordType.TaTeStem, WordType.GodanVerb, []],
  ['曰う', '曰う', WordType.TaTeStem, WordType.GodanVerb, []],
  // -------------- 1 --------------
  ['い', 'う', WordType.MasuStem, WordType.GodanVerb, [Reason.MasuStem]],
  ['い', 'く', WordType.TaTeStem, WordType.GodanVerb, []],
  ['い', 'ぐ', WordType.DaDeStem, WordType.GodanVerb, []],
  ['い', 'る', WordType.Initial, WordType.KuruVerb, [Reason.Imperative]],
  ['え', 'う', WordType.Initial, WordType.GodanVerb, [Reason.Imperative]],
  ['か', 'く', WordType.IrrealisStem, WordType.GodanVerb, []],
  ['が', 'ぐ', WordType.IrrealisStem, WordType.GodanVerb, []],
  ['き', 'い', WordType.Initial, WordType.IAdj, [Reason.Ki]],
  ['き', 'く', WordType.MasuStem, WordType.GodanVerb, [Reason.MasuStem]],
  ['き', 'くる', WordType.TaTeStem, WordType.KuruVerb, []],
  ['き', 'くる', WordType.MasuStem, WordType.KuruVerb, [Reason.MasuStem]],
  ['ぎ', 'ぐ', WordType.MasuStem, WordType.GodanVerb, [Reason.MasuStem]],
  ['く', 'い', WordType.Initial, WordType.IAdj, [Reason.Adv]],
  ['け', 'く', WordType.Initial, WordType.GodanVerb, [Reason.Imperative]],
  ['げ', 'ぐ', WordType.Initial, WordType.GodanVerb, [Reason.Imperative]],
  ['こ', 'くる', WordType.IrrealisStem, WordType.KuruVerb, []],
  ['さ', 'い', WordType.Initial, WordType.IAdj, [Reason.Noun]],
  ['さ', 'す', WordType.IrrealisStem, WordType.GodanVerb, []],
  ['し', 'す', WordType.MasuStem, WordType.GodanVerb, [Reason.MasuStem]],
  ['し', 'する', WordType.MasuStem, WordType.SuruVerb, [Reason.MasuStem]],
  ['し', 'す', WordType.TaTeStem, WordType.GodanVerb, []],
  ['し', 'する', WordType.TaTeStem, WordType.SuruVerb, []],
  ['ず', '', WordType.Initial, WordType.IrrealisStem, [Reason.Zu]],
  ['せ', 'す', WordType.Initial, WordType.GodanVerb, [Reason.Imperative]],
  ['せ', 'する', WordType.Initial, WordType.SpecialSuruVerb, [Reason.Irregular, Reason.Imperative]],
  ['た', 'つ', WordType.IrrealisStem, WordType.GodanVerb, []],
  ['た', '', WordType.Initial, WordType.TaTeStem, [Reason.Past]],
  ['だ', '', WordType.Initial, WordType.DaDeStem, [Reason.Past]],
  ['ち', 'つ', WordType.MasuStem, WordType.GodanVerb, [Reason.MasuStem]],
  ['っ', 'う', WordType.TaTeStem, WordType.GodanVerb, []],
  ['っ', 'つ', WordType.TaTeStem, WordType.GodanVerb, []],
  ['っ', 'る', WordType.TaTeStem, WordType.GodanVerb, []],
  ['て', '', WordType.Initial, WordType.TaTeStem, [Reason.Te]],
  ['て', 'つ', WordType.Initial, WordType.GodanVerb, [Reason.Imperative]],
  ['で', '', WordType.Initial, WordType.DaDeStem, [Reason.Te]],
  ['な', 'ぬ', WordType.IrrealisStem, WordType.GodanVerb, []],
  ['な', '', WordType.Initial, WordType.IchidanVerb | WordType.GodanVerb | WordType.KuruVerb | WordType.SuruVerb, [Reason.ImperativeNegative]],
  ['に', 'ぬ', WordType.MasuStem, WordType.GodanVerb, [Reason.MasuStem]],
  ['ぬ', '', WordType.Initial, WordType.IrrealisStem, [Reason.Negative]],
  ['ね', 'ぬ', WordType.Initial, WordType.GodanVerb, [Reason.Imperative]],
  ['ば', 'ぶ', WordType.IrrealisStem, WordType.GodanVerb, []],
  ['び', 'ぶ', WordType.MasuStem, WordType.GodanVerb, [Reason.MasuStem]],
  ['べ', 'ぶ', WordType.Initial, WordType.GodanVerb, [Reason.Imperative]],
  ['ま', 'む', WordType.IrrealisStem, WordType.GodanVerb, []],
  ['み', 'む', WordType.MasuStem, WordType.GodanVerb, [Reason.MasuStem]],
  ['め', 'む', WordType.Initial, WordType.GodanVerb, [Reason.Imperative]],
  ['よ', 'る', WordType.Initial, WordType.IchidanVerb, [Reason.Imperative]],
  ['ら', 'る', WordType.IrrealisStem, WordType.GodanVerb, []],
  ['り', 'る', WordType.MasuStem, WordType.GodanVerb, [Reason.MasuStem]],
  ['れ', 'る', WordType.Initial, WordType.GodanVerb, [Reason.Imperative]],
  ['ろ', 'る', WordType.Initial, WordType.IchidanVerb, [Reason.Imperative]],
  ['わ', 'う', WordType.IrrealisStem, WordType.GodanVerb, []],
  ['ん', 'ぬ', WordType.DaDeStem, WordType.GodanVerb, []],
  ['ん', 'ぶ', WordType.DaDeStem, WordType.GodanVerb, []],
  ['ん', 'む', WordType.DaDeStem, WordType.GodanVerb, []],
  ['ん', '', WordType.Initial, WordType.IrrealisStem, [Reason.Negative]],
];

interface DeinflectRuleGroup {
  rules: Array<DeinflectRule>;
  fromLen: number;
}

const deinflectRuleGroups: Array<DeinflectRuleGroup> = [];

function getDeinflectRuleGroups() {
  if (!deinflectRuleGroups.length) {
    let prevLen = -1;
    let ruleGroup: DeinflectRuleGroup;

    for (const [from, to, fromType, toType, reasons] of deinflectRuleData) {
      const rule: DeinflectRule = { from, to, fromType, toType, reasons };

      if (prevLen !== rule.from.length) {
        prevLen = rule.from.length;
        ruleGroup = { rules: [], fromLen: prevLen };
        deinflectRuleGroups.push(ruleGroup);
      }
      ruleGroup!.rules.push(rule);
    }
  }

  return deinflectRuleGroups;
}

// Returns an array of possible de-inflected versions of |word|.
export function deinflect(word: string): Array<CandidateWord> {
  let result: Array<CandidateWord> = [];
  const resultIndex: { [index: string]: number } = {};
  const ruleGroups = getDeinflectRuleGroups();

  // Normalize input: convert romaji/katakana to hiragana for consistent matching
  const normalizedWord = normalizeToHiragana(word);
  const wasNormalized = normalizedWord !== word;

  const original: CandidateWord = {
    word: normalizedWord,
    // Initially, the type of word is unknown, so we set the type mask to
    // match all rules except stems, that don't make sense on their own.
    type: 0xffff ^ (WordType.TaTeStem | WordType.DaDeStem | WordType.IrrealisStem),
    reasonChains: [],
  };
  result.push(original);
  resultIndex[normalizedWord] = 0;

  // If input was normalized, also add the original word as a candidate
  if (wasNormalized && resultIndex[word] === undefined) {
    result.push({
      word,
      type: 0xffff ^ (WordType.TaTeStem | WordType.DaDeStem | WordType.IrrealisStem),
      reasonChains: [],
    });
    resultIndex[word] = result.length - 1;
  }

  let i = 0;
  do {
    const thisCandidate = result[i];

    // Don't deinflect masu-stem results of Ichidan verbs any further since
    // they should already be the plain form.
    if (
      thisCandidate.type & WordType.IchidanVerb &&
      thisCandidate.reasonChains.length === 1 &&
      thisCandidate.reasonChains[0].length === 1 &&
      thisCandidate.reasonChains[0][0] === Reason.MasuStem
    ) {
      continue;
    }

    const currentWord = thisCandidate.word;
    const type = thisCandidate.type;

    // Ichidan verbs have only one stem, which is the plain form minus the
    // final る. Since the stem is shorter than the plain form, to avoid
    // adding multiple entries for all possible stem variations to the rule
    // data array, we forward the stem to the plain form programmatically.
    if (type & (WordType.MasuStem | WordType.TaTeStem | WordType.IrrealisStem)) {
      const reason = [];

      // Add the "masu" reason only if the word is solely the masu stem.
      if (type & WordType.MasuStem && !thisCandidate.reasonChains.length) {
        reason.push([Reason.MasuStem]);
      }

      // Ichidan verbs attach the auxiliary verbs られる and させる instead of
      // れる and せる for the passive and causative forms to their stem.
      const inapplicableForm =
        type & WordType.IrrealisStem &&
        (thisCandidate.reasonChains[0][0] == Reason.Passive ||
          thisCandidate.reasonChains[0][0] == Reason.Causative ||
          thisCandidate.reasonChains[0][0] == Reason.CausativePassive);

      if (!inapplicableForm) {
        result.push({
          word: currentWord + 'る',
          type: WordType.IchidanVerb | WordType.KuruVerb,
          reasonChains: [...thisCandidate.reasonChains, ...reason],
        });
      }
    }

    for (const ruleGroup of ruleGroups) {
      if (ruleGroup.fromLen > currentWord.length) {
        continue;
      }

      const ending = currentWord.slice(-ruleGroup.fromLen);
      const hiraganaEnding = kanaToHiragana(ending);

      for (const rule of ruleGroup.rules) {
        if (!(type & rule.fromType)) {
          continue;
        }

        if (ending !== rule.from && hiraganaEnding !== rule.from) {
          continue;
        }

        const newWord =
          currentWord.substring(0, currentWord.length - rule.from.length) + rule.to;
        if (!newWord.length) {
          continue;
        }

        // Continue if the rule introduces a duplicate in the reason chain
        const ruleReasons = new Set(rule.reasons);
        if (thisCandidate.reasonChains.flat().some((r) => ruleReasons.has(r))) {
          continue;
        }

        // If we already have a candidate for this word with the same 'to' type(s),
        // expand the possible reasons by starting a new reason chain.
        if (resultIndex[newWord]) {
          const candidate = result[resultIndex[newWord]];
          if (candidate.type === rule.toType) {
            if (rule.reasons.length) {
              // Start a new reason chain
              candidate.reasonChains.unshift([...rule.reasons]);
            }
            continue;
          }
        }
        resultIndex[newWord] = result.length;

        // Deep clone multidimensional array
        const reasonChains = [];
        for (const array of thisCandidate.reasonChains) {
          reasonChains.push([...array]);
        }

        // Add reason if not a pure forwarding rule
        if (rule.reasons.length) {
          if (reasonChains.length) {
            const firstReasonChain = reasonChains[0];

            // Rather having causative + passive, combine the two rules
            if (
              rule.reasons[0] === Reason.Causative &&
              firstReasonChain.length &&
              firstReasonChain[0] === Reason.PotentialOrPassive
            ) {
              firstReasonChain.splice(0, 1, Reason.CausativePassive);
            } else if (
              // Add the "masu" reason only if the word is solely the masu stem.
              rule.reasons[0] === Reason.MasuStem &&
              firstReasonChain.length
            ) {
              // Do nothing
            } else {
              firstReasonChain.unshift(...rule.reasons);
            }
          } else {
            reasonChains.push([...rule.reasons]);
          }
        }

        const candidate: CandidateWord = {
          reasonChains,
          type: rule.toType,
          word: newWord,
        };

        result.push(candidate);
      }
    }
  } while (++i < result.length);

  // Post-process to filter out any lingering intermediate forms
  result = result.filter((r) => r.type & WordType.All);

  return result;
}

