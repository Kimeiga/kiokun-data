# Kiokun interface system

Kiokun is a dense multilingual reference tool. Its interface should feel direct, calm, and information-first: the language content leads, while the chrome stays compact and predictable.

## Spatial system

- Section boundaries use full-width charcoal bars with light text. They are navigation landmarks, not decorative headlines.
- A top-level section bar attaches directly to its first content row. Do not leave page-background space between a bar and the grid, prose block, description, or control it introduces; explanatory copy becomes a compact ruled row when needed.
- Nested labels inside a section should be quieter than the top-level landmark: prefer a tertiary-surface ruled header with normal text instead of stacking another charcoal bar immediately below a charcoal bar.
- Collections of related, tappable items use a single 1px divider grid. Cells supply their own 8–12px internal padding; nested cards, doubled gutters, and redundant outer padding are avoided.
- A matrix that compares languages, variants, examples, or related forms should have one parent surface. Do not split its columns or row groups into separately bordered islands with page-background gaps between them.
- Filters and tabs use the same ruled surface as a segmented grid. Selected cells use a quiet accent wash and a 2px inset edge, never a detached pill.
- A singular navigation or secondary action becomes the final full-width ruled row of its parent surface when space permits. Rounded buttons are reserved for the primary search field, compact semantic badges, circular icon controls, media controls, and platform-native overlays.
- Adjacent sibling destinations that function as one catalog (for example learning tools) share a boundary instead of becoming separate bordered cards with a gutter between them.
- Mobile sections may bleed through the page gutter so the divider grid uses the full viewport width. Text inside a cell remains aligned to the normal content gutter.
- The visible part of a compact control may be smaller than 44px, but its hit area must remain at least 44px through an invisible pseudo-element.
- Hover, focus, and pressed feedback change the cell surface without changing geometry.
- General cards use square or 2px corners and no decorative shadow. Elevation is reserved for content that actually overlays another surface.

## Rule ownership

- Every normal divider is painted exactly once. True grids use zero CSS gap: cells own their logical start edges (top/left in LTR) and the parent surface closes the logical end edges (right/bottom in LTR).
- Structural grid lines use borders inside `border-box`, not outlines. Outlines are reserved for focus indication so full-bleed mobile edges cannot be clipped by page overflow.
- When two independently implemented ruled surfaces must touch, overlap the shared 1px boundary or remove one owner; never display two coincident or closely spaced hairlines.

## Type and hierarchy

- Dictionary headwords lead at 17px or larger in dense lists.
- Dense-list definitions use 14px. Pronunciations use 12–13px, with the primary reading protected from truncation and secondary readings yielding first.
- Sentence source text is at least 16px; Korean source text is 18px where pronunciation and word glosses are present.
- Auxiliary labels may use 11–12px. Body definitions and translations should not fall below 14px.
- On narrow screens, preserve access to meaningful stateful controls by shortening/truncating their labels before hiding the control itself.

## Motion

- Disclosure content expands and collapses with a short measured-height transition. The chevron rotates in the same interval.
- Motion must preserve layout continuity and respect `prefers-reduced-motion`.
- Avoid generic entrance animation; reference content should be immediately stable and scannable.

## Responsive behavior

- Dense cross-language word lists use two columns on normal mobile widths and one below 360px when necessary.
- Short Japanese-name entries use three columns on normal mobile widths, increasing on larger viewports.
- Related matrices may collapse from multiple columns to one on phones, but their groups should remain one continuous ruled surface rather than acquiring mobile-only gutters.
- Content must not require horizontal page scrolling at 320px.
