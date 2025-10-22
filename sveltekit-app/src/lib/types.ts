
// JMnedict (Japanese Names Dictionary) Types
export interface OptimizedJmnedictName {
  i: string; // id
  k: OptimizedJmnedictKanji[]; // kanji
  n: OptimizedJmnedictKana[]; // kana  
  t: OptimizedJmnedictTranslation[]; // translation
}

export interface OptimizedJmnedictKanji {
  t: string; // text
  g?: string[]; // tags
}

export interface OptimizedJmnedictKana {
  t: string; // text
  g?: string[]; // tags
  a?: string[]; // applies_to_kanji
}

export interface OptimizedJmnedictTranslation {
  y: string[]; // name_type
  r?: string[]; // related
  t: OptimizedJmnedictTranslationText[]; // translation
}

export interface OptimizedJmnedictTranslationText {
  l?: string; // lang (empty for "eng")
  t: string; // text
}
