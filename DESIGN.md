# Kiokun interface system

Kiokun is a dense multilingual reference tool. Its interface should feel direct, calm, and information-first: the language content leads, while the chrome stays compact and predictable.

## Spatial system

- Section boundaries use full-width charcoal bars with light text. They are navigation landmarks, not decorative headlines.
- Adjacent reference/browse sections stack with **no page-background gap between them**. External whitespace is not a section separator; the section bar or single ruled boundary is the separator. Reserve page-level whitespace for intros/heroes, true media composition, editing workspaces, and task transitions.
- A top-level section bar attaches directly to both the section above and its first content row below. Do not leave page-background space before a bar or between a bar and the grid, prose block, description, or control it introduces; explanatory copy becomes a compact ruled row when needed.
- Readability comes from padding **inside** cells/prose rows and from line-height, not from gutters between neighboring sections. A dense sheet may still have 8–12px internal cell padding even when its next section bar touches its closing rule.
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

## Long repeated lists

- When a disclosure only means “show more items of the same kind,” prefer a bounded scroll window instead of expanding the page. Examples include sentence examples, names, similar characters, and character-use lists.
- Scroll windows keep all items in one ruled surface, use vertical scrolling, and show a subtle inset/fade at the bottom while more content remains. Once the user scrolls, a matching top affordance may appear to communicate hidden content above.
- The scroll affordance is not a button and must not cover or intercept the list’s links. The scroll region itself remains keyboard-scrollable when it actually overflows.
- Do not replace semantic disclosures with scroll windows when expansion changes the meaning, explanation depth, or task state rather than simply revealing more peer items.

## Rule ownership

- Every normal divider is painted exactly once. True grids use zero CSS gap: the parent surface owns the logical start edges (top/left in LTR) and every real cell owns its logical end edges (right/bottom in LTR).
- End-edge cell ownership is required for ragged final rows. The last real item must draw its own closing right and bottom edges instead of relying on a parent border across empty grid tracks.
- Structural grid lines use borders inside `border-box`, not outlines. Outlines are reserved for focus indication so full-bleed mobile edges cannot be clipped by page overflow.
- When two independently implemented ruled surfaces must touch, overlap the shared 1px boundary or remove one owner; never display two coincident or closely spaced hairlines.

## Type and hierarchy

- Dictionary headwords lead at 17px or larger in dense lists.
- Dense-list definitions use 14px. Pronunciations use 12–13px, with the primary reading protected from truncation and secondary readings yielding first.
- Sentence source text is at least 16px; Korean source text is 18px where pronunciation and word glosses are present.
- Auxiliary labels may use 11–12px. Body definitions and translations should not fall below 14px.
- On narrow screens, preserve access to meaningful stateful controls by shortening/truncating their labels before hiding the control itself.

## Motion

- Semantic disclosure content expands and collapses with a short measured-height transition. The chevron rotates in the same interval.
- Repeated peer-item lists use scroll windows instead of disclosure animation when a bounded viewport preserves context better.
- Motion must preserve layout continuity and respect `prefers-reduced-motion`.
- Avoid generic entrance animation; reference content should be immediately stable and scannable.

## Responsive behavior

- Dense cross-language word lists use two columns on normal mobile widths and one below 360px when necessary.
- Short Japanese-name entries use three columns on normal mobile widths, increasing on larger viewports.
- Related matrices may collapse from multiple columns to one on phones, but their groups should remain one continuous ruled surface rather than acquiring mobile-only gutters.
- Bounded scroll windows should use viewport-relative maximum heights on phones so they never dominate the whole screen.
- Content must not require horizontal page scrolling at 320px.
