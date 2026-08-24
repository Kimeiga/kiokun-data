# Publishing Kiokun artifacts from ChatGPT

Kiokun has two artifact paths:

1. User-created artifacts stored in the app database and R2.
2. Published learning artifacts stored in the repository, designed for things a learner sends to ChatGPT for transcription, breakdown, translation, and explanation.

The second path is intentionally repository-backed so ChatGPT can publish through the GitHub connector without needing the user's browser session, cookies, or a private Kiokun API key.

## Files

Published artifact data:

`static/published-artifacts/<slug>.json`

Published artifact images:

`static/published-artifact-images/<slug>/<filename>`

Generic renderer:

`src/routes/artifacts/published/[slug]/+page.svelte`

Public URL:

`https://kiokun.com/artifacts/published/<slug>`

Once the generic renderer exists, a normal publication should only add the JSON and any source images. Do not make a new Svelte route for every artifact.

## Content model

The JSON uses an ordered `blocks` array. Order is semantic: it is the order a learner should read the artifact.

Use these block types:

- `image`: source image plus a short factual caption when useful.
- `sentence`: original text, token-by-token reading and meaning, literal translation when helpful, natural translation, and one concise usage note when needed.
- `prose`: short exposition for pragmatics, grammar, cultural context, ambiguity, or a point that does not belong under a single token.

This lets a multi-image artifact be authored as:

`image → its sentence(s) → explanation → next image → its sentence(s)`

instead of forcing all images first and all explanations later.

## Sentence tokens

Each meaningful token should provide:

- `surface`: what appears in the source.
- `reading`: furigana/reading where it adds information. Do not repeat kana as its own reading unless there is a special pronunciation point.
- `meaning`: the compact contextual meaning, not a dictionary dump.
- `wordSlug`: the Kiokun dictionary target. Omit only for punctuation or text that should not be linked.

The renderer puts the reading above, surface form in the middle, and contextual meaning below. Clicking a linked surface form opens its Kiokun dictionary page.

Prefer linguistically useful groups over mechanically splitting every character. For example, keep `実名化` together unless the learning point is specifically `実名 + 化`.

## Editorial rules

Published artifacts are learning material, not filler content.

- Start from evidence actually present in the supplied image, text, audio transcript, or source URL.
- Never invent wording hidden by a crop, low resolution, or obstruction. Mark uncertainty or omit it.
- Never fabricate quotations, observations, numbers, links, or outcomes.
- Do not add a generic introduction or conclusion merely to make the artifact feel article-like.
- Do not use fake anecdotes, forced slang, random mistakes, or other "humanization" tricks.
- Prefer one precise pragmatic note to several broad paragraphs.
- Distinguish literal translation from natural translation only when the distinction teaches something.
- Explain particles and conjugations in context instead of listing every possible dictionary meaning.
- Preserve headline ellipsis, omitted particles, dialect, register, and awkwardness when those are part of the source.
- If a phrase is a meme, catchphrase, quotation, or set expression, explain the pragmatic force without overstating its universality.
- Do not publish a first-pass model draft blindly. Check transcription, tokenization, readings, translations, links, and source ordering before committing.

## Source handling

Keep the original source URL when the user supplied one. If the image is a screenshot of a source, crop browser chrome only when that improves the learning artifact and does not remove relevant language context.

Images committed to the repository should be reasonably compressed and should not contain unnecessary UI chrome.

## Publishing workflow from ChatGPT

When the user explicitly asks to publish immediately:

1. Inspect the current source and transcribe only grounded text.
2. Build the ordered artifact JSON.
3. Add the source image(s) under `static/published-artifact-images/`.
4. Commit the JSON/image changes through the GitHub connector.
5. Verify the deployment workflow for the commit.
6. Request the canonical `https://kiokun.com/artifacts/published/<slug>` URL independently before claiming the page is live.

For a substantial renderer/schema change, prefer an atomic commit containing the renderer, documentation, and first example artifact so the deployed state cannot contain half of the feature.

## Example shape

```json
{
  "title": "Example",
  "description": "One-sentence description.",
  "language": "ja",
  "sourceUrl": "https://example.com/source",
  "publishedAt": "2026-08-24",
  "blocks": [
    {
      "type": "image",
      "src": "/published-artifact-images/example/source.jpg",
      "alt": "Description of the source image"
    },
    {
      "type": "sentence",
      "original": "それは例です。",
      "literalTranslation": "That is an example.",
      "translation": "That's an example.",
      "tokens": [
        { "surface": "それ", "meaning": "that", "wordSlug": "それ" },
        { "surface": "は", "meaning": "topic", "wordSlug": "は" },
        { "surface": "例", "reading": "れい", "meaning": "example", "wordSlug": "例" },
        { "surface": "です", "meaning": "is (polite)", "wordSlug": "です" }
      ]
    }
  ]
}
```
