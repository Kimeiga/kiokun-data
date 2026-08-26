# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Kiokun primarily serves independent learners and polyglot readers who encounter Chinese, Japanese, Cantonese, or Korean text and need to move between scripts, readings, meanings, examples, components, and related words without losing context.

Language-tool builders and technically curious readers are a secondary audience. They use Kiokun's public research, artifacts, and implementation notes to inspect the data and model choices behind the product.

## Product Purpose

Kiokun is a serious CJK dictionary and learning system. It combines multilingual reference data with courses, sentence practice, saved study material, and transparent research.

Success means learners can inspect an unfamiliar word, character, or sentence from the relevant language angles; trust the distinctions and examples presented; continue into structured practice; and understand enough provenance to evaluate how the system reached its result.

## Positioning

Kiokun keeps dictionary records, scripts, pronunciations, examples, course material, sentence practice, study tools, and research evidence connected across Chinese, Japanese, Cantonese, and Korean. It is not a generic language-learning wrapper or a collection of disconnected monolingual tools.

## Operating Context

Learners typically arrive with a word, character, sentence, image, or learning goal. They search or draw text, inspect linked linguistic records, open examples and related forms, follow a structured course or translation exercise, and save useful material for later review.

Course learners begin with the relevant writing or sound system—kana, Pinyin, Jyutping, or Hangul—before moving into everyday exchanges, retrieval, original production, and reduced-support transfer tasks.

Builders and research readers inspect public engineering notes, raw outputs, model comparisons, and downloadable artifacts rather than relying on summary claims alone.

## Capabilities and Constraints

- Searchable learner-facing records connect simplified and traditional Chinese forms, Japanese forms and readings, Cantonese Jyutping, Korean readings, meanings, components, and examples where the underlying data supports them.
- Structured beginner courses cover Japanese, Mandarin, Cantonese, and Korean. The translation tutor currently practices Japanese and Mandarin.
- Artifact reading, sentence analysis, saved study material, and spaced review extend dictionary lookup into contextual learning.
- Kiokun is a web product. A Capacitor wrapper may package the same interface, but the product does not maintain a separate native visual language.
- Linguistic uncertainty, missing evidence, self-checked production, and machine-evaluated output must be labeled honestly. Completion, streaks, or model confidence must not be presented as proof of language proficiency.

## Brand Commitments

The product name is Kiokun. Its voice is careful, technical, objective, and transparent: a serious learning tool built by someone willing to show the machinery.

Avoid template SaaS gloss, vague AI claims, cute gamified clutter, motivational filler, and benchmark pages that hide raw outputs. Public research should read as clear engineering notes with the evidence close to each claim.

## Evidence on Hand

- The multilingual data pipeline and type definitions live under `src/`.
- The production web application and learner workflows live under `sveltekit-app/src/`.
- The four structured course definitions live under `sveltekit-app/src/lib/courses/`.
- Public research and implementation notes live under `sveltekit-app/src/routes/blog/` and related static research assets.
- The product contains real dictionary records, examples, course activities, and inspectable model outputs. No verified customer testimonials or controlled learning-outcome studies are recorded; future work must not invent them.

## Product Principles

- Show evidence and provenance near the claim they support.
- Preserve linguistic precision and cross-language relationships over decorative simplification.
- Connect reference, context, practice, and review instead of treating them as separate products.
- Keep dense information scannable without flattening uncertainty or nuance.
- Make data and model tradeoffs explicit, and prefer artifacts people can inspect or reproduce.

## Accessibility & Inclusion

Target WCAG AA contrast, keyboard-readable structure, visible focus, reduced-motion fallbacks, and CJK font stacks that preserve legibility across Chinese, Japanese, Cantonese, and Korean content. The interface must remain usable without relying on color alone and must not require horizontal page scrolling at narrow mobile widths.
