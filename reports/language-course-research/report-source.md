# Building an Effective Kiokun Language Course

## Japanese course landscape, evidence review, and a reusable architecture for Mandarin, Cantonese, and Korean

**Audience:** Kiokun product, curriculum, linguistics, and engineering teams
**Research cutoff:** August 25, 2026
**Scope:** Independent adult learners using a primarily digital course. Japanese is the launch case; Mandarin, Cantonese, and Korean are transfer targets.
**Decision lens:** Observable improvement in delayed, novel, minimally scaffolded language use—not lesson completion, streaks, or marketing claims.

---

## Executive answer

Kiokun should not copy a single “best course.” No reviewed product combines all of the ingredients that the evidence and market review support: clear explanation, cumulative comprehensible input, mixed retrieval with spacing, pronunciation and literacy training, meaningful speaking and writing, trustworthy correction, and transfer tests.

The best design is a deliberate synthesis:

- Use **Irodori and Marugoto** as models for a real-world Can-do spine and culture in context.
- Use **GENKI and Human Japanese** as models for concise, progressive explanation.
- Use **Minna no Nihongo, Bunpro, WaniKani, MaruMori, and Pimsleur** as references for effortful retrieval and cumulative practice—but avoid isolated drill silos.
- Use **Satori Reader, Tadoku, NHK Easy Japanese, Erin’s Challenge, and Migaku** as models for supported reading/listening and the transition to learner-chosen media.
- Add the part nearly everyone underbuilds: **open speaking and writing with repair**, followed by delayed, unseen transfer assessment.

The recommended product is a shared course engine with language-specific packs. Its backbone is:

> Scenario → notice → explain → retrieve → pronounce/listen → produce → transfer → mission → spaced revisit.

Start with Japanese. Ship a small, instrumented A1 pilot before attempting four complete curricula: a script-and-sound launchpad plus four scenario units, approximately 24 core lessons, four communicative missions, and four graded reading/listening episodes. The goal of the pilot is not to prove that learners can finish Kiokun lessons; it is to determine whether they can understand and produce new language one and four weeks later.

## What this research can and cannot establish

This review deep-read 27 competitive Japanese resources: textbook sequences, institutional curricula, commercial apps, audio courses, grammar/kanji systems, and supported reading ecosystems. Product claims were checked against official pages and sample materials. Pedagogical judgments were then compared with official proficiency frameworks and meta-analytic second-language-acquisition evidence.

There are no trustworthy head-to-head outcome trials covering this field. Most named products have no independent causal study at all. Available studies are often vendor-funded, single-group, short, qualitative, or conducted in another language. Therefore:

- Grades below are **design-evidence judgments**, not measured effect sizes or promises of fluency.
- “Effective in role” asks whether a product is well designed for its stated job.
- “Standalone completeness” asks whether it can plausibly develop balanced independent use without major additions.
- Confidence reflects the quality of feature documentation and independent evidence—not popularity.

This is the correct level of certainty for product decisions. It is more defensible than treating app engagement, content volume, JLPT alignment, or publisher hour estimates as proof of learning.

## Evaluation rubric

The recommended Kiokun audit is a 100-point design rubric. The weights are a synthesis, not a validated psychometric scale.

| Dimension | Weight | What earns credit |
|---|---:|---|
| Observable skill coverage | 25 | Listening, speaking, reading, writing, interaction, register, and tasks with real outcomes |
| Retention design | 20 | Retrieval, spacing, cumulative review, corrective feedback, repair, and delayed checks |
| Comprehensible input | 15 | Graded reading; structured audiovisual input; captions and scaffolds that are later removed |
| Meaning-focused output | 15 | Original language, information or opinion gaps, feedback, retry, and spontaneous transfer |
| Language-specific phonology and literacy | 15 | Sound perception/production, script, orthography, morphology, pronunciation variation, and appropriate register |
| Effectiveness evidence | 10 | Baselines, delayed retention, unfamiliar-item transfer, spontaneous performance, and transparent limitations |

### Evidence behind the rubric

The [CEFR Companion Volume](https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-companion-volume-and-its-language-versions), [ACTFL Proficiency Guidelines 2024](https://www.actfl.org/uploads/files/general/Resources-Publications/ACTFL_Proficiency_Guidelines_2024.pdf), and [JF Standard guidebook](https://www.jfstandard.jpf.go.jp/pdf/web_whole_en.pdf) all support describing ability as action and performance rather than completed content. ACTFL also distinguishes rehearsed performance from general proficiency.

The instructional evidence is directionally consistent:

- A meta-analysis of 48 experiments and 3,411 learners supports distributed L2 practice and delayed retention, while not establishing expanding schedules as inherently superior to equal spacing ([Kim & Webb, 2022](https://doi.org/10.1111/lang.12479)).
- Retrieval and semantic elaboration strengthen form-meaning links better than massed repetition in the reviewed adult L2 vocabulary literature ([Rice & Tokowicz, 2020](https://doi.org/10.1017/S0272263119000500)).
- Corrective feedback has a durable positive average effect, although laboratory estimates tend to exceed classroom effects ([Li, 2010](https://doi.org/10.1111/j.1467-9922.2010.00561.x)).
- Explicit instruction generally outperforms implicit-only instruction for simple and complex features, but explanation still needs meaningful use ([Spada & Tomita, 2010](https://doi.org/10.1111/j.1467-9922.2010.00562.x)).
- Extensive reading improves multiple L2 outcomes when texts are accessible and learners have bounded choice with light accountability ([Sangers et al., 2025](https://doi.org/10.1007/s10648-025-10068-6)); an earlier 34-study meta-analysis also found positive pooled effects ([Nakanishi, 2015](https://doi.org/10.1002/tesq.157)).
- Same-language captions can improve listening and vocabulary, but uncaptioned transfer must be tested separately ([Montero Perez et al., 2013](https://doi.org/10.1016/j.system.2013.07.013)).
- Pronunciation instruction works, particularly when sustained and feedback-rich, but controlled-test gains can overstate spontaneous-speech gains ([Lee, Jang & Plonsky, 2015](https://doi.org/10.1093/applin/amu040)).
- High-variability phonetic training supports perceptual learning, retention, and some generalization across unfamiliar voices and contexts ([Uchihara, Karas & Thomson, 2025](https://doi.org/10.1017/S0272263125100879)).

The strongest single product rule follows: **measure delayed, novel, minimally scaffolded performance**. Immediate lesson accuracy, XP, streaks, and memorized dialogues can be useful leading indicators, but they are not the outcome.

## Market map: best Japanese resources by job

Grades are role-specific. A specialist may be excellent at its job and still be a poor standalone course.

| Resource | Best job | Effective in role | Standalone completeness | Confidence |
|---|---|---:|---:|---|
| Irodori | Free practical Can-do backbone | A | B+ | High |
| GENKI 3rd ed. | Balanced beginner textbook spine | A- | B+ | High |
| Marugoto | Communicative/cultural institutional sequence | A- | B | High |
| Tobira Beginning | Rich modern beginner sequence | A- | B+ | High |
| Human Japanese Universal | Low-friction digital explanation | A- | B | High on design |
| MaruMori | Integrated grammar, literacy, SRS, and reading | A- | B+ through N3 | High through N3 |
| NativShark | Deep contextual integrated path | A- | B+ | Medium during redesign |
| Busuu | Mainstream course with community output correction | B+ | B+ | Medium |
| LingoDeer | Explicit beginner/lower-intermediate app | B+ | B | Medium-high |
| Minna no Nihongo 3rd ed. | Intensive patterns and drills | A- teacher-led; B+ solo | B solo | High |
| Japanese From Zero! | Gentle, confidence-preserving start | B+ | B | Medium-high |
| Rocket Japanese | Broad audio-led foundation | B | B | Medium |
| Duolingo Japanese | Free access and habit formation | B- | C+ | Medium-low at new upper levels |
| QUARTET I/II | Four-skill intermediate bridge | A | A- | High |
| Tobira Intermediate | Rich content/project intermediate path | B+ now; A- potential | B- until Vol. II | High on availability |
| Satori Reader | Supported intermediate reading/listening | A | C alone | High |
| Tadoku | Extensive reading volume | A | D alone | High |
| Migaku | Transition from course material to native media | A- | C+ | Medium |
| JapanesePod101 | Large contextual audio/dialogue library | B+ | B- | Medium |
| NHK Easy Japanese | Compact free audio/travel starter | A- supplement | C alone | Medium-high |
| Erin’s Challenge | Authentic video, culture, and listening | A- supplement | D alone | High |
| Pimsleur Japanese | Early oral recall and pronunciation attention | A- | D+ | Medium |
| Glossika | Sentence automaticity after the basics | B+ | D+ | Low-medium |
| Bunpro | Contrastive grammar retrieval | A | D alone | High on features |
| WaniKani | Kanji/vocabulary retrieval | A | D alone | High on features |
| Tae Kim’s Guide | Concise free grammar reference | A- supplement | D+ | High |
| IMABI | Deep grammar/linguistics reference | A reference | D as course | High on scope |

## Detailed course judgments

### Best beginner and lower-intermediate spines

**Irodori — best free practical backbone.** Four free 18-lesson books now run from Starter A1 through Pre-Intermediate A2/B1. Lessons begin with real-life Can-dos, then use listening, shadowing, practical role-play, authentic or quasi-authentic texts, contextual grammar/kanji, scripts, answers, audio, and teacher guidance ([official overview](https://www.irodori.jpf.go.jp/en/about.html); [FAQ](https://www.irodori.jpf.go.jp/en/faq.html)). It is the clearest design reference for Kiokun’s scenario-first spine. Weaknesses are the PDF/audio user experience, limited personalization, and the lack of human correction for solo speaking and writing. Its licensing matters: Kiokun may study the pedagogy but should not commercially republish or adapt its content without permission ([Irodori terms](https://www.irodori.jpf.go.jp/en/privacy.html)).

**GENKI, Third Edition — best balanced English-language beginner textbook spine.** Across two books and workbooks, its 23 lessons integrate dialogue, grammar, listening, reading, writing, kana, approximately 317 kanji, and about 1,700 words. The publisher maps the volumes roughly to JLPT N5/A1 and N4/A2 and estimates about 200 classroom hours ([official introduction](https://genki3.japantimes.co.jp/en/intro/index.html)). It is unusually usable without a teacher, especially with downloadable audio, answers, apps, and aligned graded readers. The limitation is structural: pairwork prompts do not create feedback, and input volume is modest. A peer-reviewed review also questions sequencing, the connection between literacy and oracy, and measurable proficiency alignment while praising visuals, recurring characters, and output prompts ([Journal of Language Learning review](https://doi.org/10.5195/jll.2021.169)).

**Marugoto — strongest communicative and cultural institutional sequence.** Nine books span A1–B1. Early levels distinguish communicative activities from language-system work; later levels integrate the skills. Can-dos, visual/cultural content, projects, self-assessment, and reflection are first-class ([series structure](https://marugoto.jpf.go.jp/en/about/series/); [e-learning](https://marugoto.jpf.go.jp/en/e-learning/)). This is a better model for purpose and learner agency than most form-first courses. It needs an added retrieval system, clearer solo grammar support, and human or rubric-based feedback.

**Tobira: Beginning Japanese I/II — richest modern textbook alternative.** Lessons 0–20 combine dialogue and instructional video, audio, pronunciation, conversation, grammar, vocabulary, kanji, reading, listening, writing, and contemporary tasks. Four skill-specific workbooks add depth ([official course site](https://tobirabeginning.9640.jp/); [publisher catalogue](https://www.9640.jp/nihongo/en/search/?key=%3CTOBIRA%3A+Beginning+Japanese%3E&search=7)). It is broad and multimodal but expensive and fragmented as a six-book system; some answers and teacher resources are gated.

**Human Japanese Universal — best narrative digital explainer.** More than 85 sequential chapters and 4,000 recordings use conversational explanations, clickable examples, animations, quizzes, checkpoints, and controlled extra sentences. New examples are designed around previously introduced grammar and vocabulary ([how it works](https://www.humanjapanese.com/how-it-works); [FAQ](https://www.humanjapanese.com/faqs)). Since June 2026 it is bundled with Satori Reader, creating an unusually coherent explanation-to-reading path ([integration announcement](https://blog.satorireader.com/2026/06/05/satori-reader-updates-june-2026/)). It remains thin in spontaneous speaking, original writing, and validated exit assessment. Its terms prohibit publishing, commercializing, or data-mining its content; borrow the interaction pattern, not the material ([terms](https://www.humanjapanese.com/terms)).

**MaruMori — strongest integrated Japanese-specific system through N3.** It connects explanations, drills, SRS homework, reading built from taught material, vocabulary/kanji unlocks, audio, and mock exams in one path. N3 is complete; the publisher describes N2 as nearly complete and N1 as future, so the PRE-N5-to-N1 map is a roadmap rather than finished coverage ([curriculum and status](https://marumori.io/); [mock exams](https://marumori.io/tools/mock-exams)). It is a strong Kiokun architecture reference because content and review are connected. Its main gaps are open interaction, trustworthy speaking/writing correction, and mature upper-level coverage.

**NativShark — deepest integrated curriculum, with transition risk.** Its current product reports 989 units, more than 21,000 sentences, more than 1,100 lessons, 2,600+ kanji, full native audio, dialogues, drills, and custom review ([content volume](https://help.nativshark.com/ask/amount-of-content); [organization](https://help.nativshark.com/learn/content-organization)). It is unusually committed to contextual, natural language. However, new units have been paused while version 2.0 redesigns early units, kanji, review, and nonbeginner entry ([June 2026 update](https://help.nativshark.com/updates/june-2026-update)). That candid redesign confirms real weaknesses and creates product risk. No independent outcome study was found.

**Busuu — strongest mainstream feedback advantage.** Its Japanese path advertises 570+ lessons from A1–B2, separate script and travel material, review, certificates, and community corrections from Japanese speakers ([Japanese course](https://www.busuu.com/en/course/learn-japanese-online); [plans](https://www.busuu.com/en/premium-plans)). Original writing or speech submitted for correction is pedagogically more valuable than fixed-answer recognition, though community quality varies and some AI features are not clearly available in every language. A 2025 vendor-funded pre/post study included Japanese and reported oral improvement, but lacked an untreated control; treat it as moderate evidence, not causal proof ([study PDF](https://comparelanguageapps.com/reports/Busuu_2025_study.pdf)).

**LingoDeer — safer mainstream foundation than translation-first apps.** Its Japanese course emphasizes explicit grammar tips, native audio, offline lessons, listening, spelling, word order, and fill-in tasks, with claimed A1–B1 coverage ([course](https://www.lingodeer.com/language/japanese)). It explains Japanese structure rather than expecting discovery through translation patterns. Open production, interaction, and advanced input remain limited. A 2025 one-group beginner study reported test-score gains, but its lack of a control group makes causal confidence low ([study](https://doi.org/10.61132/fonologi.v3i2.1730)).

**Minna no Nihongo, Third Edition — best drill-intensive structural course.** Fifty lessons across Elementary I/II use Japanese-only main books plus separate translation/grammar notes and a large ecosystem of practice, listening, reading, kanji, and writing supplements ([third-edition overview](https://www.3anet.co.jp/en/minnanonihongo_dai3pan.html); [series guide](https://www.3anet.co.jp/en/series.html)). Pattern density and repetition are excellent, particularly with a teacher. Solo learners face procurement and context-switching friction, less integrated communicative progression, and little corrective feedback. The third-edition ecosystem is still rolling out; second- and third-edition supplements should not be mixed casually.

**Japanese From Zero! 1–5 — gentlest start.** The five books and companion platform use cumulative explanations, dialogues, practice, listening, games, quizzes, videos, and teacher-answered questions ([platform](https://www.fromzero.com/); [book collection](https://shop.fromzero.com/collections/japanese-from-zero-book-sets)). Its emotional design is a real strength for anxious beginners. The tradeoff is unusually slow script progression and no credible external endpoint behind terms such as “advanced” or “fluent.” Kiokun should copy its reassurance and pacing controls, not its delayed literacy ceiling.

**Rocket Japanese — broad foundation, not an advanced course.** Three levels mix audio lessons, language/culture explanations, writing lessons, speech-recognition phrases, and lifetime access ([course catalogue](https://www.rocketlanguages.com/japanese/courses)). It works for learners who like long-form guidance, but retrieval and graded input are less coherent than in the strongest Japanese-specific systems. The company’s “beginner to advanced” label conflicts with its own mapping of Level 1 to N5 and Levels 2–3 collectively to N4; Kiokun should never let content volume inflate proficiency claims.

**Duolingo Japanese — best access and habit layer, not established B2 attainment.** The free linear path offers bite-sized reading, writing, listening, and repetition. In April 2026 Duolingo announced Japanese content aligned through CEFR B2/Score 129 ([announcement](https://blog.duolingo.com/courses-teach-advanced-content/)). Curriculum alignment is not demonstrated learner attainment. An independent 13-week qualitative study of 29 non-kanji-background professionals found engagement and review strengths but insufficient grammar/kanji explanation and some unnatural or textbook-like expressions ([study](https://doi.org/10.14817/jlak.2026.88.5)). The new upper content was too recent for that study. Duolingo is a useful practice surface; Kiokun should not optimize the whole curriculum around streak mechanics.

### Intermediate bridges and authentic input

**QUARTET I/II — best complete intermediate spine.** Twelve thematic lessons integrate reading, writing, speaking, and listening; Volume I mainly targets N3 and Volume II N2, roughly B1 toward early B2. It teaches reading strategies, provides English grammar commentary, broad audio, workbooks, apps, and learner-accessible answer keys ([official overview](https://quartet.japantimes.co.jp/en/about/); [FAQ](https://quartet.japantimes.co.jp/en/faq/)). Dense lessons and absent live correction are the main limitations. It is the strongest current model for bridging a beginner sequence into substantial texts without abandoning output.

**Tobira Intermediate — rich, project-oriented, but not yet complete in revision.** Revised Volume I, released in 2025, refreshes lessons 1–8 with contemporary readings, cultural/social content, downloadable audio, worksheets, and expanded output projects ([official overview](https://tobiraweb.9640.jp/tobira-intermediate/)). Volume II was scheduled for September 10, 2026, after this report’s cutoff. Until then, the revised line is less reliable as a complete solo spine than Quartet; the older 2009 edition is complete but dated.

**Satori Reader — best supported reading/listening bridge.** The platform reports roughly 1,600 annotated episodes with contextual definitions, sentence translations, grammar notes, adjustable kanji/kana/furigana, native audio, and contextual flashcards ([features](https://www.satorireader.com/features); [pricing](https://www.satorireader.com/pricing)). It reduces lookup friction while preserving story context better than most readers. Because it is intentionally nonlinear, it does not supply a complete syllabus, speaking/writing progression, or unaided assessment. Kiokun should emulate its contextual sense selection and knowledge-aware display, then deliberately remove scaffolds.

**Tadoku — best extensive-reading ecosystem.** Free and commercial readers span Start and Levels 0–5 with controlled language, furigana, illustrations, audio, genres, and learner choice ([overview](https://tadoku.org/japanese/en/); [free library](https://tadoku.org/japanese/en/free-books-en/)). It is not a course, but every serious Kiokun path should include this kind of high-volume, genuinely easy reading. Add short retells or comprehension logs without turning pleasure reading into continuous testing.

**Migaku — strongest native-media transition mechanism.** Japanese Fundamentals and Academy Level 1 introduce frequent vocabulary and grammar with native audio; browser/mobile tools then provide contextual lookup, one-click audio/screenshot cards, SRS, and comprehension scoring for web/video content ([Japanese product](https://migaku.com/learn-japanese); [courses FAQ](https://migaku.com/faq/courses)). Its achievement is removing lookup and sentence-mining friction while keeping the source context. It is not yet a complete advanced sequence, and output correction is weak. Kiokun can go further because dictionary senses, character components, readings, frequency, examples, and learner state already live in the same data system.

**JapanesePod101 — strong guided audio library, easy to use passively.** Curated level pathways provide large numbers of audio/video lessons, transcripts, grammar notes, line-by-line dialogue, assessment, word bank, and review; higher tiers add teacher messaging and hand-graded work ([pricing and tiers](https://www.japanesepod101.com/pricing); [absolute beginner library](https://www.japanesepod101.com/lesson-library/absolute-beginner)). The independent 2026 qualitative study found more natural contextual listening and vocabulary than Duolingo, but weak compulsory practice, kanji teaching, review, and motivation. Use it as a listening/dialogue source model, not a one-button curriculum model.

**NHK Easy Japanese — excellent compact audio supplement.** Forty-eight short story-based lessons combine skits, key phrases, examples, speaking practice, answers, culture, downloadable audio/PDF, animation, and multilingual support ([Japan Foundation description](https://www.jpf.go.jp/j/project/japanese/teach/tsushin/news/201911.html)). It builds phrase confidence and listening but is far too small for durable A2 literacy or a complete course. Official listings differ on whether episodes are approximately three or ten minutes, so runtime should not be presented as a settled fact.

**Erin’s Challenge — best free authentic-video supplement.** Twenty-five lessons provide basic and faster advanced skits, key phrases, culture, vocabulary audio, scripts, manga, and downloadable materials ([about](https://www.erin.jpf.go.jp/en/about/)). The Japan Foundation explicitly says it is not a from-scratch grammar course. Its dual-level scenes are a valuable model for progressive listening, but it lacks a full sequence, spaced retrieval, and output correction.

### Specialist mechanisms worth borrowing carefully

**Bunpro — best dedicated grammar-retention layer.** It reports 900+ grammar items across N5–N1, 10,000+ example sentences, native audio, more than 120 graded readings, error-focused “ghost” reviews, and related-grammar comparison ([pricing/features](https://bunpro.jp/pricing); [official decks](https://bunpro.jp/decks/bunpro)). Typed/cloze recall is more diagnostic than recognition-only tapping. But constrained prompts can reject other valid Japanese—sometimes called “synonym hell.” Kiokun’s accepted-answer model needs sense-, context-, and grammar-aware alternatives, not a single hidden string.

**WaniKani — best kanji/vocabulary decision-reduction system.** Approximately 2,000 kanji and 6,000+ vocabulary are sequenced through components, mnemonics, typed recall, and adaptive SRS ([how it works](https://knowledge.wanikani.com/getting-started/how-wanikani-works/)). It reduces planning load and makes cumulative review unavoidable. It does not teach grammar, reading, listening, writing, or conversation as a course ([content boundaries](https://knowledge.wanikani.com/wanikani/wanikani-content/)). Its component-first order also delays some high-frequency utility. Kiokun should integrate character learning into words and texts rather than run a separate lifelong queue.

**Pimsleur Japanese — best early timed oral recall.** Five levels contain 150 core 30-minute audio lessons, plus reading and app activities. Graduated recall, anticipation, and listening-first attention can build confidence and faster retrieval ([Japanese course](https://www.pimsleur.com/learn-japanese/)). It remains inadequate for Japanese literacy, rich input, original composition, or interaction. A Pimsleur-funded Spanish study cannot establish Japanese outcomes; a scholarly review of its Cantonese design praised distributed recall but criticized scripted input and absent negotiation ([review](https://www.hpu.edu/research-publications/tesol-working-papers/2016/08ChoeTaiAnn.pdf)).

**Glossika — useful automaticity practice after the basics.** Native-audio sentences, SRS, dictation, recall, typing, and recording can increase listening volume and production speed ([Japanese product](https://ai.glossika.com/language/learn-japanese)). Explanations are thin, sentences are not personalized interaction, and reproduced fluency can be mistaken for generative ability. No controlled Japanese outcome study was found.

**Tae Kim’s Guide — concise grammar supplement, not a four-skill course.** The free guide sequences writing, basic, essential, special, and advanced grammar with examples and some exercises ([guide](https://guidetojapanese.org/learn/)). Its author explicitly directs learners elsewhere for listening, speaking, reading, and writing practice. It is a useful explanation reference but lacks audio, cumulative lexical recycling, assessment, and correction.

**IMABI — exceptional deep reference, poor first course.** Its table of contents spans hundreds of lessons from orthography and grammar through advanced, Classical, and Okinawan topics ([contents](https://imabi.org/table-of-contents-%E7%9B%AE%E6%AC%A1/)). Breadth is unmatched, but atomized long-form reference material is not a guided learning path. It lacks systematic audio, retrieval, assessment, and production feedback.

## What the market consistently misses

Across all 27 resources, the market fragments learning into separate products. Learners acquire a grammar SRS, a kanji SRS, a textbook, a reader, a podcast app, and a speaking tutor—each with its own sequence and knowledge model. This creates duplicated reviews, mismatched vocabulary, unnecessary lookup, and no reliable view of whether language transfers beyond familiar prompts.

The recurring weaknesses are:

1. **Recognition masquerades as production.** Selecting tiles or filling one expected blank does not establish spontaneous control.
2. **Content coverage masquerades as proficiency.** “B2 content,” “N1 roadmap,” thousands of sentences, or hundreds of hours do not show that learners perform at those levels.
3. **Speaking and writing are under-corrected.** Voice comparison and AI encouragement rarely provide an auditable error diagnosis and repair loop.
4. **Input and review are disconnected.** A learner reads one world and reviews decontextualized cards in another.
5. **Scaffolds are not faded.** Furigana, translations, captions, and hints remain available, so apparent comprehension can conceal dependence.
6. **Asian-language structure is treated as an add-on.** Script, sound change, tone, register, honorifics, and spoken/written differences require first-class models.
7. **Truth and presentation are mixed.** Generative explanations can sound fluent while silently selecting the wrong sense, pronunciation, grammar rule, or accepted answer.

This gap fits Kiokun unusually well because the product already organizes exact dictionary senses, readings, romanization, pitch-accent fields, frequency, examples, components, cross-language character data, learner notes, sentence analysis, and study state.

## Recommended Kiokun course architecture

### 1. Use observable Can-dos as the spine

Each unit should state a condition, situation, and observable action, for example: “Given a short menu and one follow-up question, order a meal, respond to a clarification, and confirm the total.” Grammar, vocabulary, characters, and pronunciation support that performance; they are not the unit outcome.

Use JF/CEFR Can-dos as references and write Kiokun-specific versions. Store skill, mode, domain, register, task conditions, permitted scaffolds, and success rubric. Treat level mappings as directional, versioned references rather than universal equivalences; ACTFL itself warns that its assessment-to-CEFR linking is not reversible ([official guidance](https://www.actfl.org/assessments/assigning-cefr-ratings-to-actfl-assessments)).

### 2. Give every lesson a complete learning loop

1. **Scenario and cold input:** a short dialogue, message, sign, or clip with a purpose.
2. **Notice:** replay or reread with selective captions, highlighting, and meaning checks.
3. **Explain:** a concise contrastive explanation tied to exact grammar rules and dictionary senses.
4. **Retrieve:** mixed receptive and productive prompts; typed, spoken, reordered, and contextual.
5. **Pronounce and listen:** multiple native voices, perception contrasts, production, feedback, and repair.
6. **Produce:** constrained recombination followed by an original response.
7. **Transfer:** a new speaker, wording, topic detail, or format with reduced scaffolding.
8. **Mission:** complete a real outcome, not merely “use today’s grammar.”
9. **Revisit:** schedule form, meaning, audio, literacy, and use at delays matched to the retention goal.

### 3. Run one adaptive review system

Do not create separate permanent silos for vocabulary, kanji, grammar, sentences, and pronunciation. A single queue should understand dependency and context. One word may generate different reviews: recognize it in audio, recall its form, choose the correct sense in a sentence, read its characters, produce it within a request, and distinguish it from a confusable alternative.

Cap new material and review load. Preserve the original sentence/audio source on every mined item. Prefer exact word anchors and verified pronunciation data. The scheduler should optimize for delayed success at a target horizon, not claim that one interval pattern is universally optimal.

### 4. Make scaffolding knowledge-aware and temporary

Kiokun can show furigana, kana, romaji, pinyin, Jyutping, translations, grammar hints, or slowed audio based on demonstrated knowledge. But every support needs a fade rule and an unassisted check. Romaji should be a short Japanese launch aid, not a permanent reading system. Captions should progress from target-language text to key-word hints to audio-only tests.

### 5. Make correction auditable

Use the existing “zero-error language teacher” direction: the model may help author candidates or explain already-certified facts, but it is not the authority. Every exercise should reference exact dictionary sense IDs, grammar-rule IDs, pronunciation records, register constraints, and an accepted-answer lattice. Deterministic grading should fail closed when evidence is missing or the target is mismatched.

Useful internal statuses are:

- `certified_correct`
- `target_mismatch`
- `unverified`
- `invalid_input`

For open speaking and writing, separate feedback into intelligibility, task completion, meaning, grammar, word choice/sense, pronunciation, script/orthography, and register. Ask the learner to repair and retry. Preserve the original, feedback, and revision for audit and research.

### 6. Connect courses to the existing Kiokun data graph

A practical content model is:

`Course → Level → Unit → Can-do → Lesson → Activity → Attempt`

Every lesson/activity can reference:

- `dictionarySenseIds`
- `grammarRuleIds`
- `pronunciationPatternIds`
- character/component IDs and exact word anchors
- frequency and JLPT/HSK/TOPIK reference metadata
- source, license, author, reviewer, and version
- native audio speaker metadata
- accepted answers and reasoned rejection classes
- scaffold policy and delayed-transfer assessment

This turns Kiokun’s dictionary into the truth layer beneath a curriculum, not a separate lookup destination.

## Japanese launch plan

### Level ladder

- **Launchpad:** kana decoding, mora timing, core sound contrasts, typing/input, survival interaction, and a rapidly fading romaji option.
- **A1:** predictable everyday exchanges with basic reading/listening and short original messages.
- **A2:** connected routine transactions, descriptions, plans, and graded narratives across varied speakers.
- **B1:** independent handling of familiar life/media topics, longer texts, explanations, and repair strategies.
- **B2 bridge:** increasingly authentic input, sustained interaction, argument/narrative, register control, and domain choice.

JLPT can remain a useful receptive checkpoint, but not the spine. The official JLPT FAQ says the test does not directly assess speaking or composition ([FAQ](https://www.jlpt.jp/e/faq/)). Since December 2025, JLPT provides CEFR reference levels only for passed total scores and only for the linguistic/receptive abilities it tests ([official reference](https://www.jlpt.jp/e/about/cefr_reference.html)). Kiokun must display that limitation next to every JLPT alignment.

### Recommended A1 pilot

Build a script-and-sound launchpad plus four units:

1. **Introductions and relationship:** identify yourself, ask basic questions, choose appropriate politeness, and repair a misunderstanding.
2. **Daily routine and time:** understand and describe a short routine; arrange a time; respond to a change.
3. **Food and ordering:** interpret a compact menu, order, answer a clarification, handle a restriction, and confirm.
4. **Places and plans:** understand simple directions/messages, propose a plan, negotiate one detail, and confirm where/when.

Target approximately 24 core lessons, four communicative missions, and four graded reader/listening episodes. Use at least three native voices across age/gender/register variation. Each unit should include one original writing task and one spoken task with correction and retry.

### Pilot evaluation

Run an 8–12 week beta with roughly 30–50 learners, sized as a product-learning pilot rather than a definitive efficacy trial. Measure:

- baseline ability and learner history;
- immediate lesson mastery;
- one-week and four-week delayed retention;
- unseen listening/reading using unfamiliar voices and wording;
- unscripted task completion and repair;
- intelligibility and register appropriateness;
- time-on-task, completion, review burden, and learner confidence;
- scaffold dependence, including audio-only and no-furigana performance.

Pre-register the core product questions and report attrition. A future efficacy study should add a comparison condition and blinded human scoring.

## Transfer to Mandarin, Cantonese, and Korean

Reuse the engine, not the Japanese syllabus. Each language needs a first-class phonology, literacy, grammar, and sociolinguistic pack.

### Mandarin

- Teach pinyin and lexical tone from the first session, including perception, production, tone sandhi, and unfamiliar-speaker checks.
- Link audio/pinyin, characters, components, morphemes, compounds, meanings, and contextual reading. Chinese L2 reading correlates with interacting phonological, morphological, and orthographic skills; visual mnemonics alone are not enough ([Chen & Zhao, 2022](https://doi.org/10.3389/fpsyg.2022.783964)).
- Support Simplified and Traditional forms without treating them as cosmetic font variants.
- Teach classifiers, aspect, word order, discourse particles, and spoken-written differences in tasks.
- Use the 2021 Chinese proficiency standard as a multidimensional reference: three stages/nine levels, four language elements, and listening, speaking, reading, writing, and translation—not vocabulary counts alone ([PRC Ministry of Education](https://www.moe.gov.cn/jyb_xwfb/gzdt_gzdt/s5987/202103/t20210329_523304.html)). Version legacy and revised HSK mappings separately.

### Cantonese

- Use Jyutping as a first-class field with initials, finals, and tone numbers 1–6 ([Linguistic Society of Hong Kong specification](https://lshk.org/jyutping-scheme/)). Never substitute pinyin or Mandarin audio because characters overlap.
- Train tone contrasts across multiple native voices, rates, syllables, words, and sentences.
- Store colloquial Cantonese form, pronunciation, meaning, and Standard Written Chinese form separately. Explicitly teach the spoken/written relationship and when each form is appropriate.
- Teach sentence-final particles, aspect, classifiers, and register as meaning-bearing choices.
- Because there is no single globally dominant Cantonese proficiency exam comparable to JLPT/TOPIK, use Kiokun Can-dos, ACTFL/CEFR descriptors, and direct performance assessment rather than inventing precise crosswalks.

### Korean

- Teach Hangul early, then systematically teach batchim, resyllabification, assimilation, tensification, and other spelling-pronunciation alternations in real words and speech.
- Integrate particles, agglutinative endings, clause chaining, spacing, speech levels, honorifics, and relationship-sensitive register.
- Align to the Korean Standard Curriculum’s communicative functions, context, pronunciation, culture, and formality ([official English curriculum PDF](https://m.korean.go.kr/common/download.do?c_file_name=6ce7e09f-5056-48c6-a798-a73c5d67ecd0.pdf&file_path=etcData&o_file_name=%ED%95%9C%EA%B5%AD%EC%96%B4+%ED%91%9C%EC%A4%80+%EA%B5%90%EC%9C%A1%EA%B3%BC%EC%A0%95%28%EB%AC%B8%ED%99%94%EC%B2%B4%EC%9C%A1%EA%B4%80%EA%B4%91%EB%B6%80%EA%B3%A0%EC%8B%9C+%EC%A0%9C2020-54%ED%98%B8%282020.11.27.%29%29_%EC%98%81%EB%AC%B8+Standard+Curriculum+for+Korean+Language_English.pdf)).
- Treat TOPIK as partial evidence. TOPIK I tests listening and reading; TOPIK II adds writing; speaking is separate ([NIIED format](https://www.niied.go.kr/web/NIIED/contents/niiedEng/eng_topikOverview)). Never imply untested skills from a score.

### Cross-language character transfer

Kiokun’s shared character graph can become a powerful optional feature for learners who already know another CJK language. Store shared meaning, divergent meaning, readings, graphic form differences, usage/register, and false-friend warnings. Small-sample evidence suggests shared Chinese characters can help Japanese vocabulary while false-cognate awareness predicts outcomes ([Zhang et al., 2021](https://doi.org/10.1080/01434632.2020.1865987)). Keep this feature optional; it should accelerate experienced learners, not burden true beginners.

## Content operations, licensing, and QA

### Clean-room rule

Benchmark pedagogical patterns; do not copy commercial wording, audio, images, dialogue, exercise sequences, or databases. Irodori and Human Japanese explicitly restrict commercial reuse. Other resources are similarly protected even when accessible online. Build original Kiokun content from licensed/native sources and the internal provenance graph.

### Authoring workflow

1. Define the Can-do and transfer assessment first.
2. Select certified grammar, senses, vocabulary, pronunciation, script, and register targets.
3. Draft original scenario input and task conditions.
4. Record native audio with speaker and license metadata.
5. Generate controlled and open activities from the certified target graph.
6. Validate accepted alternatives and rejection reasons.
7. Review linguistically, culturally, and instructionally.
8. Pilot for ambiguity, scaffold dependence, item difficulty, and delayed transfer.
9. Version and publish only signed-off records.

LLMs can accelerate candidate generation, variant detection, or learner-facing explanation. They should not silently create truth. When confidence or evidence is missing, Kiokun should say so and fail closed.

## Product metrics and decision gates

Primary metrics:

- delayed recall and recognition at defined horizons;
- success on unseen listening/reading;
- communicative mission completion;
- repair after feedback;
- intelligibility and register appropriateness;
- reading/listening speed and comprehension at controlled difficulty;
- retention by learner background and script familiarity.

Secondary metrics:

- completion, return, time-on-task, and review backlog;
- dictionary lookup and sentence-mining conversion;
- confidence and perceived usefulness;
- JLPT/HSK/TOPIK-aligned receptive checkpoints with explicit skill limits.

Guardrails:

- no unsupported “fluent,” “B2,” “advanced,” or hour-to-mastery promise;
- no single overall level inferred from a test that omits skills;
- no model-graded open response without traceable criteria and uncertainty;
- no pronunciation claim without native or verified evidence;
- no permanent scaffold without an unassisted transfer check;
- no SRS growth without workload caps and lapse diagnostics.

## Recommended roadmap

**Phase 0 — curriculum and truth layer (4–6 weeks).** Finalize the Japanese A1 Can-do map, content schema, evidence policy, accepted-answer model, audio standards, and pilot instruments. Prototype one complete unit before scaling authoring.

**Phase 1 — Japanese A1 pilot (8–12 weeks of product work plus learner beta).** Build the launchpad and four units, instrument delayed tests, and run the pilot. Improve the loop based on transfer and repair, not just completion.

**Phase 2 — Japanese A1 expansion and reader pipeline.** Expand the strongest unit pattern, add graded reading/listening, enable context-preserving sentence mining, and introduce knowledge-aware scaffolding.

**Phase 3 — one second language pack.** Choose Mandarin if the goal is to exploit Kiokun’s character/pinyin graph fastest; choose Cantonese if differentiation and Jyutping/spoken-written modeling are the strategic advantage; choose Korean if broader alphabetic onboarding and TOPIK demand matter more. Do not build all three simultaneously until the shared engine passes the Japanese pilot.

**Phase 4 — independent effectiveness study.** Run a pre-registered comparison with delayed and transfer outcomes. Publish null results and limitations. Transparent evidence would itself differentiate Kiokun in a market dominated by feature counts and testimonials.

## Final recommendation

Build **Japanese first**, with Irodori/Marugoto-style Can-dos, GENKI/Human Japanese-style explanation, MaruMori/Bunpro/WaniKani/Pimsleur-style retrieval mechanisms, Satori/Tadoku/NHK/Erin/Migaku-style input, and a Kiokun-native correction and provenance layer.

The moat is not more lessons. It is a single auditable learning graph that knows exactly what a learner encountered, what a word meant there, what support was shown, what they could retrieve later, what they could do with unfamiliar language, and where correction changed performance.

## Limitations

- Product features, coverage, prices, and release status can change after the August 25, 2026 cutoff.
- Official pages are strongest for product scope and weakest for causal effectiveness.
- Independent Japanese-specific outcome studies are rare; several cited studies are qualitative, vendor-funded, uncontrolled, or from other target languages.
- Meta-analyses summarize heterogeneous populations and tasks; they justify mechanisms, not guaranteed product effect sizes.
- This review sampled public course materials and documented flows; it did not complete every paid lesson or conduct original learner testing.
- Role grades should be re-audited after NativShark 2.0, Tobira Intermediate Volume II, MaruMori’s upper levels, and Duolingo’s newer upper Japanese path mature.
