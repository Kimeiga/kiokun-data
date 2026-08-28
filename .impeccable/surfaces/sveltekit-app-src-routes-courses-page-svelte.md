---
version: 1
slug: "sveltekit-app-src-routes-courses-page-svelte"
primary_target: "sveltekit-app/src/routes/courses/+page.svelte"
related_targets: ["sveltekit-app/src/lib/courses/CourseCatalogPreview.svelte","sveltekit-app/src/lib/courses/catalog.ts","sveltekit-app/src/routes/courses/+page.ts"]
---

# Course catalog surface

## Purpose

The catalog should prove the quality of each course before asking the learner to choose one. Show real lesson material instead of describing the teaching method in marketing copy.

## First viewport

- Keep the introduction short and factual.
- Put a recognizable learning artifact near the top of every course preview.
- Use the actual foundation-lesson chart, example, question, outcome, duration, and counts from the course data.

## Visual structure

- Treat each course preview as a ruled specimen sheet, not a rounded marketing card.
- Reuse the existing Kiokun grid, section-bar, type, color, and light/dark tokens.
- Keep language color as a reading aid. Do not use it as a thick side accent.
- Preserve semantic headings, tables, regions, and navigation labels.

## Responsive behavior

- Show two course previews per row when space allows and one per row below 850px.
- Let lesson metadata and sample sections stack without horizontal page scrolling.
- Keep learner-facing examples, translations, and question options readable on small screens.

## Data contract

Build previews through `getCourseCatalogEntry`. Select a chart from the foundation unit with at least three rows when available, and include one real scenario line and one real multiple-choice question. The catalog test must fail if any course loses these source artifacts.

## Avoid

- Generic feature cards, methodology claims, testimonial-style copy, or decorative hero statistics.
- Handwritten preview content that can drift from the lesson.
- Hidden or tiny learner-facing text used only to make the layout fit.
