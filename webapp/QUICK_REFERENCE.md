# Quick Reference: Most Common Japanese Dictionary Tags

## Part of Speech (Most Common)

| Tag | Full Name | Example |
|-----|-----------|---------|
| `n` | noun (common) | 本 (book) |
| `v1` | Ichidan verb | 食べる (to eat) |
| `v5r` | Godan verb with 'ru' ending | 走る (to run) |
| `v5u` | Godan verb with 'u' ending | 買う (to buy) |
| `v5k` | Godan verb with 'ku' ending | 書く (to write) |
| `v5s` | Godan verb with 'su' ending | 話す (to speak) |
| `v5t` | Godan verb with 'tsu' ending | 待つ (to wait) |
| `v5m` | Godan verb with 'mu' ending | 読む (to read) |
| `v5b` | Godan verb with 'bu' ending | 遊ぶ (to play) |
| `v5g` | Godan verb with 'gu' ending | 泳ぐ (to swim) |
| `v5n` | Godan verb with 'nu' ending | 死ぬ (to die) |
| `vi` | intransitive verb | 落ちる (to fall) |
| `vt` | transitive verb | 開ける (to open) |
| `vs` | suru verb | 勉強する (to study) |
| `vk` | kuru verb | 来る (to come) |
| `adj-i` | i-adjective | 高い (tall/expensive) |
| `adj-na` | na-adjective | 静か (quiet) |
| `adj-no` | no-adjective | 私の (my) |
| `adv` | adverb | とても (very) |
| `prt` | particle | は、が、を |
| `conj` | conjunction | そして (and) |
| `int` | interjection | ああ (ah) |
| `pn` | pronoun | 私 (I) |
| `exp` | expression | お願いします (please) |
| `ctr` | counter | 本、枚、匹 |
| `aux` | auxiliary | です、ます |

## Misc Tags (Most Common)

| Tag | Full Name | When to Use |
|-----|-----------|-------------|
| `uk` | usually written using kana alone | Word typically written in hiragana/katakana |
| `hon` | honorific (sonkeigo) | Respectful language |
| `hum` | humble (kenjougo) | Humble language |
| `pol` | polite (teineigo) | Polite language |
| `arch` | archaic | Old/historical usage |
| `col` | colloquialism | Casual/informal speech |
| `sl` | slang | Slang term |
| `vulg` | vulgar | Rude/crude language |
| `male` | male language | Typically used by men |
| `fem` | female language | Typically used by women |
| `form` | formal/literary | Formal or written language |
| `id` | idiomatic | Idiomatic expression |
| `rare` | rare | Rarely used |
| `obs` | obsolete | No longer used |
| `dated` | dated | Old-fashioned |
| `fam` | familiar | Casual/intimate |
| `joc` | jocular | Humorous/joking |
| `on-mim` | onomatopoeia | Sound word |
| `yoji` | yojijukugo | 4-character idiom |

## Field/Domain Tags (Most Common)

| Tag | Full Name | Example Words |
|-----|-----------|---------------|
| `comp` | computing | コンピューター、ソフトウェア |
| `med` | medicine | 病院、手術 |
| `law` | law | 法律、裁判 |
| `bus` | business | 会社、契約 |
| `sports` | sports | サッカー、野球 |
| `food` | food/cooking | 料理、レシピ |
| `music` | music | 音楽、楽器 |
| `math` | mathematics | 数学、方程式 |
| `Buddh` | Buddhism | 仏教用語 |
| `baseb` | baseball | 野球用語 |
| `sumo` | sumo | 相撲用語 |
| `MA` | martial arts | 武道用語 |

## Kanji/Kana Tags

| Tag | Full Name | Meaning |
|-----|-----------|---------|
| `ateji` | ateji | Kanji used for sound only |
| `gikun` | gikun/jukujikun | Special kanji reading |
| `iK` | irregular kanji | Unusual kanji usage |
| `ik` | irregular kana | Unusual kana usage |
| `oK` | out-dated kanji | Old kanji form |
| `ok` | out-dated kana | Old kana form |
| `rK` | rarely-used kanji | Rare kanji form |
| `rk` | rarely-used kana | Rare kana form |
| `io` | irregular okurigana | Unusual okurigana |

## Dialect Tags

| Tag | Full Name | Region |
|-----|-----------|--------|
| `ksb` | Kansai-ben | Kansai region (Osaka, Kyoto) |
| `osb` | Osaka-ben | Osaka |
| `kyb` | Kyoto-ben | Kyoto |
| `ktb` | Kantou-ben | Kantou region (Tokyo) |
| `hob` | Hokkaido-ben | Hokkaido |
| `kyu` | Kyuushuu-ben | Kyushu |
| `thb` | Touhoku-ben | Tohoku |

## Language Source (Most Common)

| Tag | Language | Example |
|-----|----------|---------|
| `eng` | English | コンピューター (computer) |
| `fre` | French | レストラン (restaurant) |
| `ger` | German | アルバイト (part-time job) |
| `por` | Portuguese | パン (bread) |
| `chi` | Chinese | 拉麺 (ramen) |
| `kor` | Korean | キムチ (kimchi) |
| `ita` | Italian | ピザ (pizza) |
| `spa` | Spanish | タコス (tacos) |

## Gloss Types

| Tag | Full Name | Usage |
|-----|-----------|-------|
| `literal` | literally | Literal meaning |
| `figurative` | figurative | Figurative meaning |
| `explanation` | explanation | Explanatory note |
| `trademark` | trademark | Brand name |

## Usage Tips

1. **Most entries have**: `n` (noun) or verb type + `uk` (usually kana)
2. **Verbs always have**: transitivity marker (`vi`/`vt`) or special type (`vs`/`vk`)
3. **Polite language**: Look for `hon`, `hum`, or `pol` tags
4. **Loanwords**: Check for language source tags (`eng`, `fre`, etc.)
5. **Dialects**: Regional words have dialect tags (`ksb`, `osb`, etc.)
6. **Formality**: `form` (formal), `col` (casual), `sl` (slang), `vulg` (rude)

## Color Coding Suggestion

```css
/* Part of speech - neutral gray */
.pos-tag { background: #e9ecef; color: #6c757d; }

/* Misc tags - yellow/warning */
.misc-tag { background: #fff3cd; color: #856404; }

/* Field tags - blue/info */
.field-tag { background: #e3f2fd; color: #1976d2; }

/* Dialect tags - purple */
.dialect-tag { background: #f3e5f5; color: #7b1fa2; }

/* Language source - orange */
.lang-tag { background: #fff3e0; color: #e65100; }

/* Kanji/kana tags - pink */
.kanji-tag { background: #fce4ec; color: #c2185b; }
```

This creates a visual hierarchy that helps learners quickly identify tag types!

