<script lang="ts">
	import SectionHeading from "./components/shared/SectionHeading.svelte";
	import { languageStore } from '$lib/stores/languages.svelte';
	import { orderContainsWords } from '$lib/contains-order';

	interface WordPreview {
		w: string; // word
		forms?: string[]; // variant display forms grouped into this card
		p?: string; // pronunciation (Chinese pinyin)
		ct?: string; // Cantonese pronunciation (Jyutping)
		jp?: string; // Japanese pronunciation (kana reading)
		jo?: string; // Japanese on'yomi (character previews)
		kr?: string; // Korean reading (Hangul)
		d?: string; // definition
		c?: boolean; // common Japanese word
		fr?: number; // frequency rank
	}

	interface Props {
		words?: WordPreview[];
		wordForms?: string[];
		charGlosses?: Record<string, string>;
	}

	let { words = [], wordForms = [], charGlosses = {} }: Props = $props();

	// Pagination state - start with 10 items
	let displayCount = $state(10);
	const pageSize = 10;

	let containsCards = $derived.by(() =>
		buildContainsCards(orderContainsWords(words, wordForms), wordForms)
	);

	// Computed slice
	let displayedWords = $derived(containsCards.slice(0, displayCount));
	let hasMore = $derived(displayCount < containsCards.length);

	// Intersection observer element
	let observerTarget: HTMLElement | null = $state(null);

	// Load more items (just increment display count - no fetching!)
	function loadMore() {
		if (!hasMore) return;
		displayCount = Math.min(displayCount + pageSize, containsCards.length);
	}

	function buildContainsCards(previews: WordPreview[], forms: string[]): WordPreview[] {
		const matchingForms = normalizedForms(forms);
		if (matchingForms.length < 2) return previews;

		const formChars = matchingForms.map((form) => [...form]);
		const length = formChars[0]?.length ?? 0;
		if (!length || formChars.some((chars) => chars.length !== length)) return previews;

		const used = new Set<WordPreview>();
		const cards: WordPreview[] = [];

		for (const preview of previews) {
			if (used.has(preview)) continue;

			if ([...preview.w].length === 1) {
				let position = -1;
				for (let index = 0; index < length; index += 1) {
					const variantsAtPosition = formChars.map((chars) => chars[index]);
					if (variantsAtPosition.includes(preview.w)) {
						position = index;
						break;
					}
				}
				if (position !== -1) {
					const variants = unique(formChars.map((chars) => chars[position]).filter(Boolean));
					const matches = previews.filter(
						(candidate) => [...candidate.w].length === 1 && variants.includes(candidate.w)
					);
					for (const match of matches) used.add(match);
					cards.push({
						...matches[0],
						forms: variants
					});
					continue;
				}
			}

			used.add(preview);
			cards.push(preview);
		}

		return cards.length > 0 ? cards : previews;
	}

	function normalizedForms(forms: string[]): string[] {
		return unique(forms.filter((form) => form && [...form].length > 0));
	}

	function unique<T>(items: T[]): T[] {
		return [...new Set(items)];
	}

	function displayText(preview: WordPreview): string {
		return preview.forms?.length ? preview.forms.join('/') : preview.w;
	}

	function displayDefinition(preview: WordPreview): string {
		const candidates = unique([preview.w, ...(preview.forms ?? [])]);
		for (const char of candidates) {
			const gloss = charGlosses[char];
			if (gloss) return cleanGloss(gloss);
		}
		return preview.d ?? '';
	}

	function cleanGloss(gloss: string): string {
		return gloss
			.replace(/\s*\((simp|trad\/jp|trad|jp)\)\s*$/i, '')
			.trim();
	}

	// Set up intersection observer for infinite scroll
	$effect(() => {
		if (!observerTarget) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasMore) {
					loadMore();
				}
			},
			{
				root: null,
				rootMargin: "200px", // Start loading 200px before reaching the element
				threshold: 0.1,
			},
		);

		observer.observe(observerTarget);
		return () => observer.disconnect();
	});
</script>

{#if containsCards.length > 0}
	<SectionHeading id="contains">Contains</SectionHeading>

	<div class="mb-4">
		<div class="characters-row mobile-full-bleed">
			{#each displayedWords as preview}
				{@const showChinese = preview.p && languageStore.preferences.chinese}
				{@const showCantonese = preview.ct && languageStore.preferences.cantonese}
				{@const showJapanese = preview.jp && languageStore.preferences.japanese}
				{@const showJapaneseOn = preview.jo && preview.jo !== preview.jp && languageStore.preferences.japanese}
				{@const showKorean = preview.kr && languageStore.preferences.korean}
				<a href="/{preview.w}" class="character-card">
					<div class="character">{displayText(preview)}</div>
					{#if showChinese || showCantonese || showJapanese || showJapaneseOn || showKorean}
						<div class="pronunciations">
							{#if showChinese}
								<span class="chinese-reading">{preview.p}</span>
							{/if}
							{#if showCantonese}
								<span class="cantonese-reading">{preview.ct}</span>
							{/if}
							{#if showJapanese || showJapaneseOn}
								<span class="japanese-readings" lang="ja">
									{#if showJapanese}
										<span
											class:kunyomi-reading={showJapaneseOn}
											class="japanese-reading"
											aria-label={showJapaneseOn
												? `Japanese kun’yomi: ${preview.jp}`
												: `Japanese reading: ${preview.jp}`}
										>{preview.jp}</span>
									{/if}
									{#if showJapanese && showJapaneseOn}
										<span class="japanese-reading-separator" aria-hidden="true">·</span>
									{/if}
									{#if showJapaneseOn}
										<span
											class="japanese-onyomi-reading"
											aria-label={`Japanese on’yomi: ${preview.jo}`}
										>{preview.jo}</span>
									{/if}
								</span>
							{/if}
							{#if showKorean}
								<span class="korean-reading">{preview.kr}</span>
							{/if}
						</div>
					{/if}
					{#if displayDefinition(preview)}
						<div class="definition">{displayDefinition(preview)}</div>
					{/if}
				</a>
			{/each}
		</div>

		{#if hasMore}
			<div class="observer-target" bind:this={observerTarget}>
				<div class="remaining-count">
					{containsCards.length - displayCount} more
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.characters-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(6rem, 1fr));
		gap: 1px;
		border-block: 1px solid var(--border-light);
		background: transparent;
	}

	.character-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		text-decoration: none;
		color: inherit;
		min-width: 0;
		padding: var(--spacing-sm);
		background: var(--divider-cell-bg);
		outline: 1px solid var(--border-light);
		outline-offset: 0;
		transition: background-color 120ms ease;
	}

	.character-card:hover {
		background: var(--divider-cell-hover);
	}

	.character-card:active {
		background: var(--divider-cell-active);
	}

	.character-card:focus-visible {
		position: relative;
		z-index: 1;
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	.character {
		font-size: var(--font-size-title);
		font-weight: 600;
		color: var(--text-primary);
		line-height: 1.2;
		font-family:
			"Noto Sans CJK TC",
			"Noto Sans CJK SC",
			"Noto Sans CJK JP",
			"Source Han Sans TC",
			"Source Han Sans SC",
			"Source Han Sans JP",
			"Microsoft JhengHei",
			"Microsoft YaHei",
			"Meiryo",
			"Hiragino Sans",
			"Yu Gothic",
			sans-serif;
	}

	.pronunciations {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		margin-top: var(--spacing-xs);
	}

	.chinese-reading {
		font-size: var(--font-size-caption1);
		color: var(--color-pinyin);
		font-weight: 500;
	}

	.cantonese-reading {
		font-size: var(--font-size-caption2);
		color: var(--color-cantonese, #e67e22);
		font-weight: 400;
	}

	.japanese-reading {
		font-size: var(--font-size-caption2);
		color: var(--text-secondary);
		font-weight: 400;
	}

	.japanese-readings {
		display: inline-flex;
		align-items: baseline;
		gap: 0.3em;
	}

	.japanese-reading.kunyomi-reading {
		color: var(--color-kunyomi);
	}

	.japanese-onyomi-reading {
		font-size: var(--font-size-caption2);
		color: var(--color-onyomi);
		font-weight: 500;
	}

	.japanese-reading-separator {
		font-size: var(--font-size-caption2);
		color: var(--text-muted);
	}

	.korean-reading {
		font-size: var(--font-size-caption2);
		color: var(--color-korean, #7c3aed);
		font-weight: 400;
		font-family: var(--font-cjk);
	}

	.definition {
		font-size: var(--font-size-caption2);
		color: var(--text-tertiary);
		margin-top: var(--spacing-xs);
		line-height: 1.3;
		max-width: 100px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.observer-target {
		margin-top: var(--spacing-lg);
		padding: var(--spacing-sm);
		text-align: center;
	}

	.remaining-count {
		font-size: var(--font-size-caption2);
		color: var(--text-muted);
		font-style: italic;
	}

	@media (max-width: 768px) {
		.characters-row {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}

		.character-card {
			padding: var(--spacing-sm) var(--spacing-xs);
		}

		.character {
			font-size: var(--font-size-title);
		}
	}

	@media (max-width: 359px) {
		.characters-row {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>
