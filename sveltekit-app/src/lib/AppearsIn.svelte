<script lang="ts">
	import SectionHeading from "./components/shared/SectionHeading.svelte";
	import { languageStore } from '$lib/stores/languages.svelte';

	interface WordPreview {
		w: string; // word
		p?: string; // pronunciation
		ct?: string; // cantonese pronunciation (jyutping)
		d?: string; // definition
		c?: boolean; // common (Japanese words only)
		jp?: string; // japanese pronunciation
		kr?: string; // korean pronunciation (hangul)
	}

	interface Props {
		chineseWords: WordPreview[];
		japaneseWords: WordPreview[];
		koreanWords?: WordPreview[];
	}

	let { chineseWords = [], japaneseWords = [], koreanWords = [] }: Props = $props();

	// Filter words based on language preferences
	let filteredChineseWords = $derived(languageStore.preferences.chinese ? chineseWords : []);
	let filteredJapaneseWords = $derived(languageStore.preferences.japanese ? japaneseWords : []);
	let filteredKoreanWords = $derived(languageStore.preferences.korean ? koreanWords : []);

	// State for pagination - start with 10 items
	let chineseDisplayCount = $state(10);
	let japaneseDisplayCount = $state(10);
	let koreanDisplayCount = $state(10);
	const pageSize = 10;

	// Intersection observer elements
	let chineseObserverTarget: HTMLElement | null = $state(null);
	let japaneseObserverTarget: HTMLElement | null = $state(null);
	let koreanObserverTarget: HTMLElement | null = $state(null);

	// Computed slices (use filtered words)
	let displayedChinese = $derived(filteredChineseWords.slice(0, chineseDisplayCount));
	let displayedJapanese = $derived(
		filteredJapaneseWords.slice(0, japaneseDisplayCount),
	);
	let displayedKorean = $derived(filteredKoreanWords.slice(0, koreanDisplayCount));

	// Check if there are more items to load (use filtered words)
	let hasMoreChinese = $derived(chineseDisplayCount < filteredChineseWords.length);
	let hasMoreJapanese = $derived(japaneseDisplayCount < filteredJapaneseWords.length);
	let hasMoreKorean = $derived(koreanDisplayCount < filteredKoreanWords.length);

	// Load more items (just increment display count - no fetching!)
	function loadMoreChinese() {
		if (!hasMoreChinese) return;
		chineseDisplayCount = Math.min(
			chineseDisplayCount + pageSize,
			filteredChineseWords.length,
		);
	}

	function loadMoreJapanese() {
		if (!hasMoreJapanese) return;
		japaneseDisplayCount = Math.min(
			japaneseDisplayCount + pageSize,
			filteredJapaneseWords.length,
		);
	}

	function loadMoreKorean() {
		if (!hasMoreKorean) return;
		koreanDisplayCount = Math.min(
			koreanDisplayCount + pageSize,
			filteredKoreanWords.length,
		);
	}

	// Set up intersection observers for infinite scroll
	$effect(() => {
		if (!chineseObserverTarget) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasMoreChinese) {
					loadMoreChinese();
				}
			},
			{
				root: null,
				rootMargin: "200px", // Start loading 200px before reaching the element
				threshold: 0.1,
			},
		);

		observer.observe(chineseObserverTarget);
		return () => observer.disconnect();
	});

	$effect(() => {
		if (!japaneseObserverTarget) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasMoreJapanese) {
					loadMoreJapanese();
				}
			},
			{
				root: null,
				rootMargin: "200px",
				threshold: 0.1,
			},
		);

		observer.observe(japaneseObserverTarget);
		return () => observer.disconnect();
	});

	$effect(() => {
		if (!koreanObserverTarget) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasMoreKorean) {
					loadMoreKorean();
				}
			},
			{
				root: null,
				rootMargin: "200px",
				threshold: 0.1,
			},
		);

		observer.observe(koreanObserverTarget);
		return () => observer.disconnect();
	});
</script>

{#if filteredChineseWords.length > 0 || filteredJapaneseWords.length > 0 || filteredKoreanWords.length > 0}
	{@const columnCount = (filteredChineseWords.length > 0 ? 1 : 0) + (filteredJapaneseWords.length > 0 ? 1 : 0) + (filteredKoreanWords.length > 0 ? 1 : 0)}
	<div class="mb-4">
		<div class="word-columns mobile-full-bleed" class:two-columns={columnCount === 2} class:three-columns={columnCount === 3}>
			<!-- Chinese Words Column -->
			{#if filteredChineseWords.length > 0}
				<div class="column chinese-column">
					<SectionHeading id="chinese-words" divided={false}
						>Chinese Words</SectionHeading
					>
					<div class="word-list">
						{#each displayedChinese as preview}
							<a href="/{preview.w}" class="word-card">
								<div class="word-header chinese-word-header">
									<span class="word-text">{preview.w}</span>
									{#if preview.p}
										<span class="pronunciation mandarin-pronunciation" title={preview.p}
											>{preview.p}</span
										>
									{/if}
									{#if preview.ct && languageStore.preferences.cantonese}
										<span class="cantonese-pronunciation" title="Cantonese (Jyutping)"
											>{preview.ct}</span
										>
									{/if}
								</div>
								{#if preview.d}
									<div class="definition-row">
										<div class="definition" title={preview.d}>{preview.d}</div>
									</div>
								{/if}
							</a>
						{/each}
					</div>
					{#if hasMoreChinese}
						<div
							class="observer-target"
							bind:this={chineseObserverTarget}
						>
							<div class="remaining-count">
								{filteredChineseWords.length - chineseDisplayCount} more
								items
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Japanese Words Column -->
			{#if filteredJapaneseWords.length > 0}
				<div class="column japanese-column">
					<SectionHeading id="japanese-words" divided={false}
						>Japanese Words</SectionHeading
					>
					<div class="word-list">
						{#each displayedJapanese as preview}
							<a href="/{preview.w}" class="word-card">
								<div class="word-header">
									<span class="word-text">
										{#if preview.c}
											<span
												class="common-star"
												title="Common word">⭐</span
											>
										{/if}
										{preview.w}
									</span>
									{#if preview.jp}
										<span class="pronunciation" title={preview.jp}
											>{preview.jp}</span
										>
									{:else if preview.p}
										<span class="pronunciation" title={preview.p}
											>{preview.p}</span
										>
									{/if}
								</div>
								{#if preview.d}
									<div class="definition-row">
										<div class="definition" title={preview.d}>{preview.d}</div>
									</div>
								{/if}
							</a>
						{/each}
					</div>
					{#if hasMoreJapanese}
						<div
							class="observer-target"
							bind:this={japaneseObserverTarget}
						>
							<div class="remaining-count">
								{filteredJapaneseWords.length - japaneseDisplayCount} more
								items
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Korean Words Column -->
			{#if filteredKoreanWords.length > 0}
				<div class="column korean-column">
					<SectionHeading id="korean-words" divided={false}
						>Korean Words</SectionHeading
					>
					<div class="word-list">
						{#each displayedKorean as preview}
							<a href="/{preview.w}" class="word-card">
								<div class="word-header">
									<span class="word-text">{preview.w}</span>
									{#if preview.kr}
										<span class="pronunciation" title={preview.kr}
											>{preview.kr}</span
										>
									{:else if preview.p}
										<span class="pronunciation" title={preview.p}
											>{preview.p}</span
										>
									{/if}
								</div>
								{#if preview.d}
									<div class="definition-row">
										<div class="definition" title={preview.d}>{preview.d}</div>
									</div>
								{/if}
							</a>
						{/each}
					</div>
					{#if hasMoreKorean}
						<div
							class="observer-target"
							bind:this={koreanObserverTarget}
						>
							<div class="remaining-count">
								{filteredKoreanWords.length - koreanDisplayCount} more
								items
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.word-columns {
		display: grid;
		grid-template-columns: 1fr;
		border-block: 1px solid var(--border-light);
		overflow: hidden;
	}

	.word-columns.two-columns {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.word-columns.three-columns {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.word-columns.two-columns > .column + .column,
	.word-columns.three-columns > .column + .column {
		border-inline-start: 1px solid var(--border-light);
	}

	.word-columns :global(.section-heading) {
		position: static;
		display: flex;
		left: auto;
		width: 100%;
		min-height: 2.25rem;
		margin: 0;
		margin-inline: 0;
		align-items: center;
		transform: none;
	}

	@media (max-width: 768px) {
		.word-columns.two-columns,
		.word-columns.three-columns {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.word-columns.three-columns > .korean-column {
			grid-column: 1 / -1;
			border-block-start: 1px solid var(--border-light);
			border-inline-start: 0;
		}

		.word-columns.three-columns > .korean-column .word-list {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.word-columns.three-columns > .korean-column .word-card:nth-child(even) {
			border-inline-start: 1px solid var(--border-light);
		}
	}

	@media (max-width: 359px) {
		.word-columns.two-columns,
		.word-columns.three-columns {
			grid-template-columns: minmax(0, 1fr);
		}

		.word-columns.two-columns > .column + .column,
		.word-columns.three-columns > .column + .column {
			border-block-start: 1px solid var(--border-light);
			border-inline-start: 0;
		}

		.word-columns.three-columns > .korean-column {
			grid-column: auto;
		}

		.word-columns.three-columns > .korean-column .word-list {
			display: flex;
		}

		.word-columns.three-columns > .korean-column .word-card:nth-child(even) {
			border-inline-start: 0;
		}
	}

	.column {
		display: flex;
		min-width: 0;
		flex-direction: column;
	}

	.word-list {
		display: flex;
		flex-direction: column;
	}

	.word-card {
		display: flex;
		height: 4.125rem;
		min-height: 4.125rem;
		padding: 8px 10px;
		background: var(--divider-cell-bg);
		border-block-start: 1px solid var(--border-light);
		text-decoration: none;
		color: inherit;
		flex-direction: column;
		justify-content: center;
		transition: background-color 120ms ease;
	}

	@media (max-width: 768px) {
		.word-card {
			padding: 7px 8px;
		}
	}

	@media (hover: hover) {
		.word-card:hover {
			background: var(--divider-cell-hover);
		}
	}

	.word-card:active {
		background: var(--divider-cell-active);
	}

	.word-card:focus-visible {
		position: relative;
		z-index: 1;
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	.word-header {
		display: flex;
		align-items: baseline;
		column-gap: 4px;
		min-width: 0;
		overflow: hidden;
		margin-bottom: 1px;
		flex-wrap: nowrap;
	}

	.chinese-word-header {
		overflow: visible;
	}

	.word-text {
		font-size: 17px;
		line-height: 1.25;
		font-weight: 600;
		font-family: var(--font-cjk);
		color: var(--text-primary);
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
		flex: 0 0 auto;
		white-space: nowrap;
	}

	.common-star {
		font-size: 12px;
		line-height: 1;
		opacity: 0.9;
	}

	.pronunciation {
		font-size: 13px;
		color: var(--text-secondary);
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.mandarin-pronunciation {
		flex: 0 0 auto;
		overflow: visible;
		text-overflow: clip;
	}

	.cantonese-pronunciation {
		font-size: 12px;
		color: var(--color-cantonese, #e67e22);
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1 1 auto;
	}

	.definition-row {
		display: flex;
		min-width: 0;
		align-items: baseline;
		gap: 4px;
	}

	.definition {
		font-size: var(--font-size-subhead);
		color: var(--text-tertiary);
		line-height: 1.35;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1 1 auto;
	}

	.observer-target {
		margin-top: var(--spacing-md);
		padding: var(--spacing-sm);
		text-align: center;
	}

	.remaining-count {
		font-size: var(--font-size-caption2);
		color: var(--text-muted);
		font-style: italic;
	}
</style>
