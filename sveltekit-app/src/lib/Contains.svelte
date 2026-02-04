<script lang="ts">
	import SectionHeading from "./components/shared/SectionHeading.svelte";

	interface WordPreview {
		w: string; // word
		p?: string; // pronunciation (Chinese pinyin)
		jp?: string; // Japanese pronunciation (kana reading)
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
					{#if preview.p || preview.jp}
						<div class="pronunciations">
							{#if preview.p}
								<span class="chinese-reading">{preview.p}</span>
							{/if}
							{#if preview.jp}
								<span class="japanese-reading">{preview.jp}</span>
							{/if}
						</div>
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
		gap: var(--spacing-md);
	}

	.character-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		text-decoration: none;
		color: inherit;
		padding: var(--spacing-md) var(--spacing-lg);
		border-radius: 8px;
		min-width: 80px;
		transition: all 300ms ease;
	}

	.character-card:hover {
		background: var(--bg-tertiary);
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

	.japanese-reading {
		font-size: var(--font-size-caption2);
		color: var(--text-secondary);
		font-weight: 400;
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
			gap: var(--spacing-sm);
		}

		.character-card {
			padding: var(--spacing-sm) var(--spacing-md);
			min-width: 70px;
			border-radius: 6px;
		}

		.character {
			font-size: 1.75rem;
		}
	}
</style>
