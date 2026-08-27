# Kiokun introductory language courses

## Routes and scope

| Course | Route | Lessons | Foundation sequence |
| --- | --- | ---: | --- |
| Japanese | `/courses/japanese` | 32 | Hiragana and katakana charts, five vowels, kana rows, dakuten and handakuten, contracted sounds, ヴ, long vowels, small っ, and ん |
| Mandarin | `/courses/mandarin` | 24 | Pinyin syllables and four tones plus neutral tone, initials, palatal and sibilant contrasts, finals and ü, and common tone changes |
| Cantonese | `/courses/cantonese` | 24 | Jyutping structure, six tone categories, onsets and aspiration, finals and vowel length, stop codas, and syllabic nasals |
| Korean | `/courses/korean` | 24 | Hangul syllable blocks, basic consonants and vowels, plain/aspirated/tense series, compound vowels, batchim, linking, and initial word reading |

Each course then covers introductions, basic personal information, days and time, routines, scheduling, ordering, prices, locations, family relationships, possession or existence, household counts, and home descriptions. Lessons use the same explicit sequence: example, form-focused analysis, explanation, dictionary-linked vocabulary, closed retrieval, open production, and a reduced-support transfer task.

## Language-specific implementation

- Mandarin uses Simplified Chinese, Hanyu Pinyin, `zh-CN` speech, and Chinese dictionary/study records.
- Cantonese uses Traditional Chinese and LSHK Jyutping with tone numbers 1–6. Speech requests prefer `yue-HK` and fall back to `zh-HK`; dictionary/study records use the existing Chinese data model.
- Korean uses Hangul with Revised Romanization as temporary reading support, `ko-KR` speech, and Korean dictionary/study records.
- Course progress is stored separately for each course under `kiokun:course:<course-id>:progress:v1`.

## Source basis

The foundation order and notation conventions were checked against primary institutional sources:

- The Chinese Ministry of Education's [Hanyu Pinyin scheme](https://www.moe.gov.cn/jyb_sjzl/ziliao/A19/195802/t19580201_186000.html) defines the official Pinyin letter and tone-marking system used by the Mandarin launchpad.
- The Linguistic Society of Hong Kong's [Jyutping scheme](https://lshk.org/jyutping-scheme/) supplies the Cantonese initials, finals, and tone-number convention.
- The National Institute of Korean Language's [Hangeul principles](https://www.korean.go.kr/eng_hangeul/principle/001.html) explains letter composition into syllable blocks and the modern initial/vowel inventory.
- The King Sejong Institute's [standard curriculum](https://www.iksi.or.kr/lms/main/curriculum.do) separates a Hangul-focused introductory course from subsequent beginner instruction; Kiokun follows that dependency while using its own lesson content and practice model.

These sources establish script and notation facts, not permission to copy a commercial course. The lesson wording, examples, activities, sequencing decisions, and Kiokun integrations are original to this implementation.

The family-and-home expansion was checked against established beginner curricula for each language:

- The Japan Foundation's [Irodori Starter table of contents](https://www.irodori.jpf.go.jp/assets/data/starter/pdf/X_contents_en.pdf) places family, rooms, possession or existence, and location within its A1 sequence.
- [HSK Standard Course 1](https://www.hskstandardcourse.com/hsk-standard-course-level-1/hsk-standard-course-1-textbook/) includes family identification, family age, ability, and workplace location among its 15 beginner lessons.
- The Education University of Hong Kong's [Cantonese Self-learning Class](https://cantonese-self-learning-class.eduhk.hk/about) combines Jyutping foundations with structured daily-life units. The Chinese University of Hong Kong's elementary program explicitly includes [family and location topics](https://yccla.cuhk.edu.hk/_files/ugd/9e5885_1e0ca2e5d0624cedaec21e095d9aae3e.pdf).
- King Sejong Institute's beginner materials include location, possession, family, and practical communication after the separate Hangul introduction.

These sources support coverage decisions. They do not establish that Kiokun produces equivalent proficiency outcomes.

## Verification

`src/lib/courses/catalog.test.ts` checks the four-course catalog, lesson sequencing, unit references, activity identifiers, reference charts, lesson content requirements, and language-specific mappings. It also submits every option in all 120 multiple-choice questions. The test proves that each answer matches exactly one option, every distractor grades as `target_mismatch`, and empty submissions grade as `invalid_input`. `src/lib/courses/japanese-a1.test.ts` retains the deeper Japanese script and grading checks. Both course tests run from the default `npm test` command.
