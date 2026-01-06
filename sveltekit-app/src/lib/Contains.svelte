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
		<div class="characters-row">
			{#each displayedWords as preview}
				<a href="/{preview.w}" class="character-card">
					<div class="character">{preview.w}</div>
					{#if preview.p}
						<div class="pronunciation">{preview.p}</div>
					{/if}
					{#if preview.d}
						<div class="definition">{preview.d}</div>
					{/if}
				</a>
			{/each}
		</div>

		{#if hasMore}
			<div class="observer-target" bind:this={observerTarget}>
				<div class="remaining-count">
					{words.length - displayCount} more
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.characters-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.character-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		text-decoration: none;
		color: inherit;
		padding: 0.75rem 1rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-light);
		border-radius: 8px;
		min-width: 80px;
		transition: all 300ms ease;
	}

	.character-card:hover {
		background: var(--bg-tertiary);
		border-color: var(--accent);
		transform: translateY(-2px);
	}

	.character {
		font-size: 2rem;
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

	.pronunciation {
		font-size: 0.75rem;
		color: var(--color-pinyin);
		margin-top: 0.25rem;
		font-weight: 500;
	}

	.definition {
		font-size: 0.7rem;
		color: var(--text-tertiary);
		margin-top: 0.25rem;
		line-height: 1.3;
		max-width: 100px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.observer-target {
		margin-top: 1rem;
		padding: 8px;
		text-align: center;
	}

	.remaining-count {
		font-size: 11px;
		color: var(--text-muted);
		font-style: italic;
	}
</style>
