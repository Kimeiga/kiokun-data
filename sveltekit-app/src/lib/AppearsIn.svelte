<script lang="ts">
	import SectionHeading from "./components/shared/SectionHeading.svelte";

	interface WordPreview {
		w: string; // word
		p?: string; // pronunciation
		d?: string; // definition
		c?: boolean; // common (Japanese words only)
		jp?: string; // japanese pronunciation
		kr?: string; // korean pronunciation (hangul)
		fr?: number; // frequency rank (JPDB)
	}

	interface Props {
		chineseWords: WordPreview[];
		japaneseWords: WordPreview[];
		koreanWords?: WordPreview[];
	}

	let { chineseWords = [], japaneseWords = [], koreanWords = [] }: Props = $props();

	// State for pagination - start with 10 items
	let chineseDisplayCount = $state(10);
	let japaneseDisplayCount = $state(10);
	let koreanDisplayCount = $state(10);
	const pageSize = 10;

	// Intersection observer elements
	let chineseObserverTarget: HTMLElement | null = $state(null);
	let japaneseObserverTarget: HTMLElement | null = $state(null);
	let koreanObserverTarget: HTMLElement | null = $state(null);

	// Computed slices
	let displayedChinese = $derived(chineseWords.slice(0, chineseDisplayCount));
	let displayedJapanese = $derived(
		japaneseWords.slice(0, japaneseDisplayCount),
	);
	let displayedKorean = $derived(koreanWords.slice(0, koreanDisplayCount));

	// Check if there are more items to load
	let hasMoreChinese = $derived(chineseDisplayCount < chineseWords.length);
	let hasMoreJapanese = $derived(japaneseDisplayCount < japaneseWords.length);
	let hasMoreKorean = $derived(koreanDisplayCount < koreanWords.length);

	// Load more items (just increment display count - no fetching!)
	function loadMoreChinese() {
		if (!hasMoreChinese) return;
		chineseDisplayCount = Math.min(
			chineseDisplayCount + pageSize,
			chineseWords.length,
		);
	}

	function loadMoreJapanese() {
		if (!hasMoreJapanese) return;
		japaneseDisplayCount = Math.min(
			japaneseDisplayCount + pageSize,
			japaneseWords.length,
		);
	}

	function loadMoreKorean() {
		if (!hasMoreKorean) return;
		koreanDisplayCount = Math.min(
			koreanDisplayCount + pageSize,
			koreanWords.length,
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

{#if chineseWords.length > 0 || japaneseWords.length > 0 || koreanWords.length > 0}
	{@const columnCount = (chineseWords.length > 0 ? 1 : 0) + (japaneseWords.length > 0 ? 1 : 0) + (koreanWords.length > 0 ? 1 : 0)}
	<div class="mb-4">
		<div class="word-columns" class:two-columns={columnCount === 2} class:three-columns={columnCount === 3}>
			<!-- Chinese Words Column -->
			{#if chineseWords.length > 0}
				<div class="column">
					<SectionHeading
						>CHINESE WORDS ({chineseWords.length})</SectionHeading
					>
					<div class="word-list">
						{#each displayedChinese as preview}
							<a href="/{preview.w}" class="word-card">
								<div class="word-header">
									<span class="word-text">{preview.w}</span>
									{#if preview.p}
										<span class="pronunciation"
											>[{preview.p}]</span
										>
									{/if}
									{#if preview.fr}
										<span class="frequency-rank" title="JPDB frequency rank">#{preview.fr.toLocaleString()}</span>
									{/if}
								</div>
								{#if preview.d}
									<div class="definition">{preview.d}</div>
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
								{chineseWords.length - chineseDisplayCount} more
								items
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Japanese Words Column -->
			{#if japaneseWords.length > 0}
				<div class="column">
					<SectionHeading
						>JAPANESE WORDS ({japaneseWords.length})</SectionHeading
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
										<span class="pronunciation"
											>[{preview.jp}]</span
										>
									{:else if preview.p}
										<span class="pronunciation"
											>[{preview.p}]</span
										>
									{/if}
									{#if preview.fr}
										<span class="frequency-rank" title="JPDB frequency rank">#{preview.fr.toLocaleString()}</span>
									{/if}
								</div>
								{#if preview.d}
									<div class="definition">{preview.d}</div>
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
								{japaneseWords.length - japaneseDisplayCount} more
								items
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Korean Words Column -->
			{#if koreanWords.length > 0}
				<div class="column">
					<SectionHeading
						>KOREAN WORDS ({koreanWords.length})</SectionHeading
					>
					<div class="word-list">
						{#each displayedKorean as preview}
							<a href="/{preview.w}" class="word-card">
								<div class="word-header">
									<span class="word-text">{preview.w}</span>
									{#if preview.kr}
										<span class="pronunciation"
											>[{preview.kr}]</span
										>
									{:else if preview.p}
										<span class="pronunciation"
											>[{preview.p}]</span
										>
									{/if}
								</div>
								{#if preview.d}
									<div class="definition">{preview.d}</div>
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
								{koreanWords.length - koreanDisplayCount} more
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
		gap: var(--spacing-xl);
	}

	.word-columns.two-columns {
		grid-template-columns: 1fr 1fr;
	}

	.word-columns.three-columns {
		grid-template-columns: 1fr 1fr 1fr;
	}

	@media (max-width: 768px) {
		.word-columns.two-columns,
		.word-columns.three-columns {
			/* Keep two columns on mobile */
			grid-template-columns: 1fr 1fr;
			gap: var(--spacing-sm);
		}
	}

	.column {
		display: flex;
		flex-direction: column;
	}

	.word-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	.word-card {
		display: block;
		padding: var(--spacing-md);
		background: var(--bg-secondary);
		border-radius: 6px;
		border: 1px solid var(--border-light);
		text-decoration: none;
		color: inherit;
		transition: all 0.2s ease;
	}

	@media (max-width: 768px) {
		.word-card {
			padding: var(--spacing-sm);
			border-radius: 4px;
		}
	}

	.word-card:hover {
		background: var(--bg-tertiary);
		border-color: var(--accent);
		transform: translateY(-1px);
		box-shadow: 0 2px 6px var(--shadow);
	}

	.word-header {
		display: flex;
		align-items: baseline;
		gap: var(--spacing-sm);
		margin-bottom: 2px;
		flex-wrap: wrap;
	}

	@media (max-width: 768px) {
		.word-header {
			gap: var(--spacing-xs);
			margin-bottom: 1px;
		}
	}

	.word-text {
		font-size: var(--font-size-body);
		font-weight: 600;
		font-family: "Noto Serif TC", "Noto Serif SC", "Noto Serif JP", "MS Mincho", serif;
		color: var(--text-primary);
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
	}

	.frequency-rank {
		font-size: var(--font-size-caption2);
		color: var(--text-muted);
		background: var(--bg-tertiary);
		padding: 1px var(--spacing-xs);
		border-radius: 3px;
		font-weight: 500;
		white-space: nowrap;
	}

	.common-star {
		font-size: var(--font-size-caption1);
		line-height: 1;
		opacity: 0.9;
	}

	.pronunciation {
		font-size: var(--font-size-footnote);
		color: var(--text-secondary);
	}

	.definition {
		font-size: var(--font-size-caption1);
		color: var(--text-tertiary);
		line-height: 1.3;
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
