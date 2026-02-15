/**
 * Japanese verb conjugation generator
 * Generates all conjugation forms from a dictionary form verb
 */

// Verb type enum - matches JMdict part-of-speech tags
export type VerbType =
  | 'v1' // Ichidan verb
  | 'v1_s' // Ichidan verb - kureru special class
  | 'v5u' // Godan verb - u ending
  | 'v5k' // Godan verb - ku ending
  | 'v5k_s' // Godan verb - iku/yuku special class
  | 'v5g' // Godan verb - gu ending
  | 'v5s' // Godan verb - su ending
  | 'v5t' // Godan verb - tsu ending
  | 'v5n' // Godan verb - nu ending
  | 'v5b' // Godan verb - bu ending
  | 'v5m' // Godan verb - mu ending
  | 'v5r' // Godan verb - ru ending
  | 'v5r_i' // Godan verb - ru irregular (aru, etc.)
  | 'v5aru' // Godan verb - aru special class (kudasaru, etc.)
  | 'v5uru' // Godan verb - uru special class
  | 'vk' // Kuru verb (irregular)
  | 'vs_i' // Suru verb - included
  | 'vs_s' // Suru verb - special class
  | 'vz' // -zuru Ichidan verb;

export interface ConjugationForm {
  form: string;
  label: string;
  category: string;
}

export interface ConjugationTable {
  dictionary: string;
  verbType: VerbType;
  forms: ConjugationForm[];
}

// Godan verb conjugation endings
const godanEndings: Record<string, { a: string; i: string; u: string; e: string; o: string; te: string; ta: string }> = {
  'u': { a: 'わ', i: 'い', u: 'う', e: 'え', o: 'お', te: 'って', ta: 'った' },
  'ku': { a: 'か', i: 'き', u: 'く', e: 'け', o: 'こ', te: 'いて', ta: 'いた' },
  'iku': { a: 'か', i: 'き', u: 'く', e: 'け', o: 'こ', te: 'って', ta: 'った' }, // special iku/yuku
  'gu': { a: 'が', i: 'ぎ', u: 'ぐ', e: 'げ', o: 'ご', te: 'いで', ta: 'いだ' },
  'su': { a: 'さ', i: 'し', u: 'す', e: 'せ', o: 'そ', te: 'して', ta: 'した' },
  'tsu': { a: 'た', i: 'ち', u: 'つ', e: 'て', o: 'と', te: 'って', ta: 'った' },
  'nu': { a: 'な', i: 'に', u: 'ぬ', e: 'ね', o: 'の', te: 'んで', ta: 'んだ' },
  'bu': { a: 'ば', i: 'び', u: 'ぶ', e: 'べ', o: 'ぼ', te: 'んで', ta: 'んだ' },
  'mu': { a: 'ま', i: 'み', u: 'む', e: 'め', o: 'も', te: 'んで', ta: 'んだ' },
  'ru': { a: 'ら', i: 'り', u: 'る', e: 'れ', o: 'ろ', te: 'って', ta: 'った' },
};

// Get the stem of a verb (remove final character(s))
function getStem(verb: string, verbType: VerbType): string {
  if (verbType === 'v1' || verbType === 'v1_s' || verbType === 'vz') {
    // Ichidan: remove る
    return verb.slice(0, -1);
  }
  if (verbType === 'vk') {
    // Kuru: 来る → 来 or くる → く
    return verb.slice(0, -2);
  }
  if (verbType === 'vs_i' || verbType === 'vs_s') {
    // Suru: する → '' or 勉強する → 勉強
    if (verb.endsWith('する')) return verb.slice(0, -2);
    if (verb.endsWith('ずる')) return verb.slice(0, -2);
    return verb;
  }
  // Godan: remove last character
  return verb.slice(0, -1);
}

// Get godan ending pattern
function getGodanPattern(verbType: VerbType): typeof godanEndings['u'] | null {
  switch (verbType) {
    case 'v5u': return godanEndings['u'];
    case 'v5k': return godanEndings['ku'];
    case 'v5k_s': return godanEndings['iku'];
    case 'v5g': return godanEndings['gu'];
    case 'v5s': return godanEndings['su'];
    case 'v5t': return godanEndings['tsu'];
    case 'v5n': return godanEndings['nu'];
    case 'v5b': return godanEndings['bu'];
    case 'v5m': return godanEndings['mu'];
    case 'v5r':
    case 'v5r_i':
    case 'v5aru':
    case 'v5uru': return godanEndings['ru'];
    default: return null;
  }
}

// Check if a part-of-speech tag is a verb type
export function isVerbPos(pos: string): pos is VerbType {
  return [
    'v1', 'v1_s', 'v5u', 'v5k', 'v5k_s', 'v5g', 'v5s', 'v5t', 'v5n',
    'v5b', 'v5m', 'v5r', 'v5r_i', 'v5aru', 'v5uru', 'vk', 'vs_i', 'vs_s', 'vz'
  ].includes(pos);
}

// Get verb type from part-of-speech tags
export function getVerbType(posTags: string[]): VerbType | null {
  for (const pos of posTags) {
    if (isVerbPos(pos)) return pos;
  }
  return null;
}

// Generate all conjugation forms for a verb
export function conjugate(verb: string, verbType: VerbType): ConjugationTable {
  const forms: ConjugationForm[] = [];
  const stem = getStem(verb, verbType);
  
  if (verbType === 'v1' || verbType === 'v1_s' || verbType === 'vz') {
    // Ichidan verb conjugations
    forms.push(
      { form: verb, label: 'Dictionary', category: 'basic' },
      { form: stem + 'ます', label: 'Polite', category: 'basic' },
      { form: stem + 'ない', label: 'Negative', category: 'negative' },
      { form: stem + 'ません', label: 'Polite Negative', category: 'negative' },
      { form: stem + 'た', label: 'Past', category: 'past' },
      { form: stem + 'ました', label: 'Polite Past', category: 'past' },
      { form: stem + 'なかった', label: 'Past Negative', category: 'past' },
      { form: stem + 'ませんでした', label: 'Polite Past Negative', category: 'past' },
      { form: stem + 'て', label: 'Te-form', category: 'te' },
      { form: stem + 'ないで', label: 'Negative Te-form', category: 'te' },
      { form: stem + 'たら', label: 'Conditional (-tara)', category: 'conditional' },
      { form: stem + 'れば', label: 'Conditional (-ba)', category: 'conditional' },
      { form: stem + 'よう', label: 'Volitional', category: 'volitional' },
      { form: stem + 'ましょう', label: 'Polite Volitional', category: 'volitional' },
      { form: stem + 'ろ', label: 'Imperative', category: 'imperative' },
      { form: stem + 'るな', label: 'Imperative Negative', category: 'imperative' },
      { form: stem + 'られる', label: 'Potential', category: 'voice' },
      { form: stem + 'られる', label: 'Passive', category: 'voice' },
      { form: stem + 'させる', label: 'Causative', category: 'voice' },
      { form: stem + 'させられる', label: 'Causative Passive', category: 'voice' },
      { form: stem + 'たい', label: 'Want to (-tai)', category: 'desire' },
      { form: stem + 'そう', label: 'Seems like (-sou)', category: 'auxiliary' },
      { form: stem + 'すぎる', label: 'Too much (-sugiru)', category: 'auxiliary' },
    );
  } else if (verbType === 'vk') {
    // Kuru verb conjugations
    const prefix = stem; // Everything before くる/来る
    const ki = verb.endsWith('来る') ? '来' : 'き';
    const ko = verb.endsWith('来る') ? '来' : 'こ';

    forms.push(
      { form: verb, label: 'Dictionary', category: 'basic' },
      { form: prefix + ki + 'ます', label: 'Polite', category: 'basic' },
      { form: prefix + ko + 'ない', label: 'Negative', category: 'negative' },
      { form: prefix + ki + 'ません', label: 'Polite Negative', category: 'negative' },
      { form: prefix + ki + 'た', label: 'Past', category: 'past' },
      { form: prefix + ki + 'ました', label: 'Polite Past', category: 'past' },
      { form: prefix + ko + 'なかった', label: 'Past Negative', category: 'past' },
      { form: prefix + ki + 'ませんでした', label: 'Polite Past Negative', category: 'past' },
      { form: prefix + ki + 'て', label: 'Te-form', category: 'te' },
      { form: prefix + ko + 'ないで', label: 'Negative Te-form', category: 'te' },
      { form: prefix + ki + 'たら', label: 'Conditional (-tara)', category: 'conditional' },
      { form: prefix + ko + 'よう', label: 'Volitional', category: 'volitional' },
      { form: prefix + ki + 'ましょう', label: 'Polite Volitional', category: 'volitional' },
      { form: prefix + ko + 'い', label: 'Imperative', category: 'imperative' },
      { form: prefix + ko + 'られる', label: 'Potential', category: 'voice' },
      { form: prefix + ko + 'られる', label: 'Passive', category: 'voice' },
      { form: prefix + ko + 'させる', label: 'Causative', category: 'voice' },
    );
  } else if (verbType === 'vs_i' || verbType === 'vs_s') {
    // Suru verb conjugations
    const prefix = stem; // Everything before する

    forms.push(
      { form: verb, label: 'Dictionary', category: 'basic' },
      { form: prefix + 'します', label: 'Polite', category: 'basic' },
      { form: prefix + 'しない', label: 'Negative', category: 'negative' },
      { form: prefix + 'しません', label: 'Polite Negative', category: 'negative' },
      { form: prefix + 'した', label: 'Past', category: 'past' },
      { form: prefix + 'しました', label: 'Polite Past', category: 'past' },
      { form: prefix + 'しなかった', label: 'Past Negative', category: 'past' },
      { form: prefix + 'しませんでした', label: 'Polite Past Negative', category: 'past' },
      { form: prefix + 'して', label: 'Te-form', category: 'te' },
      { form: prefix + 'しないで', label: 'Negative Te-form', category: 'te' },
      { form: prefix + 'したら', label: 'Conditional (-tara)', category: 'conditional' },
      { form: prefix + 'すれば', label: 'Conditional (-ba)', category: 'conditional' },
      { form: prefix + 'しよう', label: 'Volitional', category: 'volitional' },
      { form: prefix + 'しましょう', label: 'Polite Volitional', category: 'volitional' },
      { form: prefix + 'しろ', label: 'Imperative', category: 'imperative' },
      { form: prefix + 'するな', label: 'Imperative Negative', category: 'imperative' },
      { form: prefix + 'できる', label: 'Potential', category: 'voice' },
      { form: prefix + 'される', label: 'Passive', category: 'voice' },
      { form: prefix + 'させる', label: 'Causative', category: 'voice' },
      { form: prefix + 'したい', label: 'Want to (-tai)', category: 'desire' },
    );
  } else {
    // Godan verb conjugations
    const pattern = getGodanPattern(verbType);
    if (pattern) {
      forms.push(
        { form: verb, label: 'Dictionary', category: 'basic' },
        { form: stem + pattern.i + 'ます', label: 'Polite', category: 'basic' },
        { form: stem + pattern.a + 'ない', label: 'Negative', category: 'negative' },
        { form: stem + pattern.i + 'ません', label: 'Polite Negative', category: 'negative' },
        { form: stem + pattern.ta, label: 'Past', category: 'past' },
        { form: stem + pattern.i + 'ました', label: 'Polite Past', category: 'past' },
        { form: stem + pattern.a + 'なかった', label: 'Past Negative', category: 'past' },
        { form: stem + pattern.i + 'ませんでした', label: 'Polite Past Negative', category: 'past' },
        { form: stem + pattern.te, label: 'Te-form', category: 'te' },
        { form: stem + pattern.a + 'ないで', label: 'Negative Te-form', category: 'te' },
        { form: stem + pattern.ta + 'ら', label: 'Conditional (-tara)', category: 'conditional' },
        { form: stem + pattern.e + 'ば', label: 'Conditional (-ba)', category: 'conditional' },
        { form: stem + pattern.o + 'う', label: 'Volitional', category: 'volitional' },
        { form: stem + pattern.i + 'ましょう', label: 'Polite Volitional', category: 'volitional' },
        { form: stem + pattern.e, label: 'Imperative', category: 'imperative' },
        { form: stem + pattern.u + 'な', label: 'Imperative Negative', category: 'imperative' },
        { form: stem + pattern.e + 'る', label: 'Potential', category: 'voice' },
        { form: stem + pattern.a + 'れる', label: 'Passive', category: 'voice' },
        { form: stem + pattern.a + 'せる', label: 'Causative', category: 'voice' },
        { form: stem + pattern.a + 'せられる', label: 'Causative Passive', category: 'voice' },
        { form: stem + pattern.i + 'たい', label: 'Want to (-tai)', category: 'desire' },
        { form: stem + pattern.i + 'そう', label: 'Seems like (-sou)', category: 'auxiliary' },
        { form: stem + pattern.i + 'すぎる', label: 'Too much (-sugiru)', category: 'auxiliary' },
      );
    }
  }

  return { dictionary: verb, verbType, forms };
}

// Get display label for verb type
export function getVerbTypeLabel(verbType: VerbType): string {
  const labels: Record<VerbType, string> = {
    'v1': 'Ichidan verb',
    'v1_s': 'Ichidan verb (kureru)',
    'v5u': 'Godan verb (-u)',
    'v5k': 'Godan verb (-ku)',
    'v5k_s': 'Godan verb (iku/yuku)',
    'v5g': 'Godan verb (-gu)',
    'v5s': 'Godan verb (-su)',
    'v5t': 'Godan verb (-tsu)',
    'v5n': 'Godan verb (-nu)',
    'v5b': 'Godan verb (-bu)',
    'v5m': 'Godan verb (-mu)',
    'v5r': 'Godan verb (-ru)',
    'v5r_i': 'Godan verb (-ru irregular)',
    'v5aru': 'Godan verb (-aru)',
    'v5uru': 'Godan verb (-uru)',
    'vk': 'Kuru verb',
    'vs_i': 'Suru verb',
    'vs_s': 'Suru verb (special)',
    'vz': 'Ichidan verb (-zuru)',
  };
  return labels[verbType] || verbType;
}
