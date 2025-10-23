<script lang="ts">
	interface WordPreview {
		w: string; // word
		p?: string; // pronunciation
		d?: string; // definition
		c?: boolean; // common (Japanese words only)
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
	let displayedJapanese = $derived(japaneseWords.slice(0, japaneseDisplayCount));

	// Check if there are more items to load
	let hasMoreChinese = $derived(chineseDisplayCount < chineseWords.length);
	let hasMoreJapanese = $derived(japaneseDisplayCount < japaneseWords.length);

	// Load more items (just increment display count - no fetching!)
	function loadMoreChinese() {
		if (!hasMoreChinese) return;
		chineseDisplayCount = Math.min(chineseDisplayCount + pageSize, chineseWords.length);
	}

	function loadMoreJapanese() {
		if (!hasMoreJapanese) return;
		japaneseDisplayCount = Math.min(japaneseDisplayCount + pageSize, japaneseWords.length);
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
				rootMargin: '200px', // Start loading 200px before reaching the element
				threshold: 0.1
			}
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
				rootMargin: '200px',
				threshold: 0.1
			}
		);

		observer.observe(japaneseObserverTarget);
		return () => observer.disconnect();
	});
</script>

{#if chineseWords.length > 0 || japaneseWords.length > 0}
	<div class="appears-in-section">
		<h2 style="font-size: 24px; margin-bottom: 20px; color: var(--text-secondary);">Appears In</h2>

		<div class="two-column-layout">
			<!-- Chinese Words Column -->
			{#if chineseWords.length > 0}
				<div class="column">
					<h3 style="font-size: 18px; margin-bottom: 15px; color: var(--color-onyomi);">
						Chinese ({chineseWords.length})
					</h3>
					<div class="word-list">
						{#each displayedChinese as preview}
							<a href="/{preview.w}" class="word-card">
								<div class="word-header">
									<span class="word-text">{preview.w}</span>
									{#if preview.p}
										<span class="pronunciation">[{preview.p}]</span>
									{/if}
								</div>
								{#if preview.d}
									<div class="definition">{preview.d}</div>
								{/if}
							</a>
						{/each}
					</div>
					{#if hasMoreChinese}
						<div class="observer-target" bind:this={chineseObserverTarget}>
							<div class="remaining-count">
								{chineseWords.length - chineseDisplayCount} more items
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Japanese Words Column -->
			{#if japaneseWords.length > 0}
				<div class="column">
					<h3 style="font-size: 18px; margin-bottom: 15px; color: var(--color-pinyin);">
						Japanese ({japaneseWords.length})
					</h3>
					<div class="word-list">
						{#each displayedJapanese as preview}
							<a href="/{preview.w}" class="word-card">
								<div class="word-header">
									<span class="word-text">
										{#if preview.c}
											<span class="common-star" title="Common word">⭐</span>
										{/if}
										{preview.w}
									</span>
									{#if preview.p}
										<span class="pronunciation">[{preview.p}]</span>
									{/if}
								</div>
								{#if preview.d}
									<div class="definition">{preview.d}</div>
								{/if}
							</a>
						{/each}
					</div>
					{#if hasMoreJapanese}
						<div class="observer-target" bind:this={japaneseObserverTarget}>
							<div class="remaining-count">
								{japaneseWords.length - japaneseDisplayCount} more items
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.appears-in-section {
		margin-top: 40px;
		padding-top: 30px;
		border-top: 2px solid var(--border-color);
	}

	.two-column-layout {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 30px;
	}

	@media (max-width: 768px) {
		.two-column-layout {
			grid-template-columns: 1fr;
		}
	}

	.column {
		display: flex;
		flex-direction: column;
	}

	.word-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.word-card {
		display: block;
		padding: 12px 16px;
		background: var(--bg-secondary);
		border-radius: 8px;
		border: 1px solid var(--border-light);
		text-decoration: none;
		color: inherit;
		transition: all 0.2s ease;
	}

	.word-card:hover {
		background: var(--bg-tertiary);
		border-color: var(--accent);
		transform: translateY(-2px);
		box-shadow: 0 2px 8px var(--shadow);
	}

	.word-header {
		display: flex;
		align-items: baseline;
		gap: 8px;
		margin-bottom: 4px;
	}

	.word-text {
		font-size: 18px;
		font-weight: 600;
		font-family: 'MS Mincho', serif;
		color: var(--text-primary);
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.common-star {
		font-size: 14px;
		line-height: 1;
		opacity: 0.9;
	}

	.pronunciation {
		font-size: 14px;
		color: var(--text-secondary);
	}

	.definition {
		font-size: 14px;
		color: var(--text-tertiary);
		line-height: 1.4;
	}

	.observer-target {
		margin-top: 16px;
		padding: 20px;
		text-align: center;
	}

	.remaining-count {
		font-size: 13px;
		color: var(--text-muted);
		font-style: italic;
	}
</style>

