<script lang="ts">
	import SectionHeading from "./components/shared/SectionHeading.svelte";

	interface WordPreview {
		w: string; // word
		p?: string; // pronunciation
		d?: string; // definition
		c?: boolean; // common (Japanese words only)
		jp?: string; // japanese pronunciation
		fr?: number; // frequency rank (JPDB)
	}

	interface Props {
		chineseWords: WordPreview[];
		japaneseWords: WordPreview[];
	}

	let { chineseWords = [], japaneseWords = [] }: Props = $props();

	// State for pagination - start with 10 items
	let chineseDisplayCount = $state(10);
	let japaneseDisplayCount = $state(10);
	const pageSize = 10;

	// Intersection observer elements
	let chineseObserverTarget: HTMLElement | null = $state(null);
	let japaneseObserverTarget: HTMLElement | null = $state(null);

	// Computed slices
	let displayedChinese = $derived(chineseWords.slice(0, chineseDisplayCount));
	let displayedJapanese = $derived(
		japaneseWords.slice(0, japaneseDisplayCount),
	);

	// Check if there are more items to load
	let hasMoreChinese = $derived(chineseDisplayCount < chineseWords.length);
	let hasMoreJapanese = $derived(japaneseDisplayCount < japaneseWords.length);

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
</script>

{#if chineseWords.length > 0 || japaneseWords.length > 0}
	<div class="mb-4">
		<div class="two-column-layout">
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
		</div>
	</div>
{/if}

<style>
	.two-column-layout {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
	}

	@media (max-width: 768px) {
		.two-column-layout {
			/* Keep two columns on mobile since we have ~200 words */
			grid-template-columns: 1fr 1fr;
			gap: 0.5rem;
		}
	}

	.column {
		display: flex;
		flex-direction: column;
	}

	.word-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.word-card {
		display: block;
		padding: 10px 12px;
		background: var(--bg-secondary);
		border-radius: 6px;
		border: 1px solid var(--border-light);
		text-decoration: none;
		color: inherit;
		transition: all 0.2s ease;
	}

	@media (max-width: 768px) {
		.word-card {
			padding: 6px 8px;
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
		gap: 6px;
		margin-bottom: 2px;
		flex-wrap: wrap;
	}

	@media (max-width: 768px) {
		.word-header {
			gap: 4px;
			margin-bottom: 1px;
		}
	}

	.word-text {
		font-size: 1.1rem;
		font-weight: 600;
		font-family: "MS Mincho", serif;
		color: var(--text-primary);
		display: flex;
		align-items: center;
		gap: 4px;
	}

	@media (max-width: 768px) {
		.word-text {
			font-size: 0.95rem;
		}
	}

	.frequency-rank {
		font-size: 0.7rem;
		color: var(--text-muted);
		background: var(--bg-tertiary);
		padding: 1px 4px;
		border-radius: 3px;
		font-weight: 500;
		white-space: nowrap;
	}

	@media (max-width: 768px) {
		.frequency-rank {
			font-size: 0.6rem;
			padding: 1px 3px;
		}
	}

	.common-star {
		font-size: 12px;
		line-height: 1;
		opacity: 0.9;
	}

	@media (max-width: 768px) {
		.common-star {
			font-size: 10px;
		}
	}

	.pronunciation {
		font-size: 0.9rem;
		color: var(--text-secondary);
	}

	@media (max-width: 768px) {
		.pronunciation {
			font-size: 0.75rem;
		}
	}

	.definition {
		font-size: 0.85rem;
		color: var(--text-tertiary);
		line-height: 1.3;
	}

	@media (max-width: 768px) {
		.definition {
			font-size: 0.7rem;
			line-height: 1.2;
		}
	}

	.observer-target {
		margin-top: 12px;
		padding: 10px;
		text-align: center;
	}

	@media (max-width: 768px) {
		.observer-target {
			margin-top: 8px;
			padding: 6px;
		}
	}

	.remaining-count {
		font-size: 12px;
		color: var(--text-muted);
		font-style: italic;
	}

	@media (max-width: 768px) {
		.remaining-count {
			font-size: 10px;
		}
	}
</style>
