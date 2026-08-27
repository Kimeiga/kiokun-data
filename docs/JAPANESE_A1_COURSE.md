# Japanese A1 course implementation

## Routes

- Course overview: `/courses/japanese`
- Lesson: `/courses/japanese/[lessonId]`

## Scope

The course contains 32 lessons in six units. The eight-lesson Launchpad establishes the writing and sound system before scenario-based A1 material:

1. Japanese writing systems and complete hiragana/katakana gojūon charts
2. Japanese vowel timing
3. Hiragana vowel through t rows
4. Hiragana n through w rows
5. Basic katakana and the long-vowel mark
6. Dakuten and handakuten
7. Contracted sounds, small katakana vowels, and ヴ
8. Long vowels, small っ, and ん

The remaining units cover introductions, daily routine and time, food ordering, places and plans, and family and home descriptions.

## Lesson model

Each lesson defines an observable can-do statement, an initial example, noticing guidance, an explanation, dictionary-linked vocabulary, closed-answer retrieval, open production, and a reduced-support transfer task. Script lessons can also provide one or more structured reference charts.

The course data is in `src/lib/courses/`. `types.ts` is the authoring contract, and `japanese-a1.ts` assembles the units and lesson sequence.

## Kiokun integration

Vocabulary items link to the existing Kiokun dictionary route. `SaveToStudy` adds an item and its lesson sentence to the existing authenticated study system. Course completion is currently local to the learner's browser under the versioned key `kiokun:course:japanese-a1:progress:v1`.

Closed-answer grading returns one of four explicit statuses:

- `certified_correct`
- `target_mismatch`
- `unverified`
- `invalid_input`

Speaking and other open responses remain `unverified` after the learner uses the supplied model and checklist. The interface does not claim automated pronunciation or free-form language assessment.

## Verification

`src/lib/courses/japanese-a1.test.ts` checks course structure, lesson requirements, unique identifiers, and deterministic grading behavior. It is included in the main `npm test` command.

## Additional language courses

Mandarin, Cantonese, and Korean now reuse the lesson and grading primitives while keeping language-specific launchpads. Mandarin and Cantonese establish their pronunciation systems and tones before scenario lessons; Korean establishes Hangul block construction and basic sound changes. See `docs/LANGUAGE_COURSES.md` for the shared catalog and source basis.
