<script lang="ts">
	import SectionHeading from "./components/shared/SectionHeading.svelte";

	interface WordPreview {
		w: string; // word
		p?: string; // pronunciation
		d?: string; // definition
	}

	let { words = [] }: { words: WordPreview[] } = $props();

	// Pagination state - start with 10 items
	let displayCount = $state(10);
	const pageSize = 10;

	// Computed slice
	let displayedWords = $derived(words.slice(0, displayCount));
	let hasMore = $derived(displayCount < words.length);

	// Intersection observer element
	let observerTarget: HTMLElement | null = $state(null);

	// Load more items (just increment display count - no fetching!)
	function loadMore() {
		if (!hasMore) return;
		displayCount = Math.min(displayCount + pageSize, words.length);
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

{#if words.length > 0}
	<SectionHeading>Contains</SectionHeading>

	<div class="mb-4">
		<div class="words-container">
			<!-- Chinese words column -->
			<div class="words-column">
				{#each displayedWords as preview}
					<a href="/{preview.w}" class="word-item">
						<div class="word-text">{preview.w}</div>
						{#if preview.p}
							<div class="pronunciation">[{preview.p}]</div>
						{/if}
						{#if preview.d}
							<div class="definition">{preview.d}</div>
						{/if}
					</a>
				{/each}
			</div>

			<!-- Japanese words column -->
			<div class="words-column">
				{#each displayedWords as preview}
					<a href="/{preview.w}" class="word-item">
						<div class="word-text">{preview.w}</div>
						{#if preview.p}
							<div class="pronunciation">[{preview.p}]</div>
						{/if}
						{#if preview.d}
							<div class="definition">{preview.d}</div>
						{/if}
					</a>
				{/each}
			</div>
		</div>

		{#if hasMore}
			<div class="observer-target" bind:this={observerTarget}>
				<div class="remaining-count">
					{words.length - displayCount} more items
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.words-container {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
	}

	/* Two columns on desktop */
	@media (min-width: 768px) {
		.words-container {
			grid-template-columns: 1fr 1fr;
			gap: 1.5rem;
		}
	}

	.words-column {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.word-item {
		text-decoration: none;
		color: inherit;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--border-color);
		transition: background-color 0.2s ease;
	}

	.word-item:hover {
		background-color: var(--bg-tertiary);
	}

	.word-item:last-child {
		border-bottom: none;
	}

	.word-text {
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 0.125rem;
	}

	.pronunciation {
		font-size: 0.85rem;
		color: var(--text-secondary);
		margin-bottom: 0.125rem;
	}

	.definition {
		font-size: 0.85rem;
		color: var(--text-tertiary);
		line-height: 1.3;
	}

	.observer-target {
		margin-top: 1.5rem;
		padding: 10px;
		text-align: center;
	}

	.remaining-count {
		font-size: 12px;
		color: var(--text-muted);
		font-style: italic;
	}
</style>
