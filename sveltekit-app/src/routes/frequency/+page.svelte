<script lang="ts">
	import { onMount } from 'svelte';
	import Header from '$lib/components/Header.svelte';

	interface FrequencyWord {
		rank: number;
		word: string;
		reading: string;
		definition: string;
		common: boolean;
	}

	let japaneseWords: FrequencyWord[] = $state([]);
	let chineseWords: FrequencyWord[] = $state([]);
	let koreanWords: FrequencyWord[] = $state([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let activeTab: 'japanese' | 'chinese' | 'korean' = $state('japanese');
	const PAGE_SIZE = 30;
	let displayCount = $state(PAGE_SIZE);

	// Load frequency data from static file
	async function loadFrequencyData() {
		try {
			loading = true;
			error = null;

			// Fetch directly from static file instead of API endpoint
			// This works on Cloudflare Workers where fs.readFileSync is not available
			const response = await fetch('/frequency_list.json');
			if (!response.ok) {
				throw new Error(`Failed to load frequency data: ${response.status}`);
			}

			const data = await response.json();
			japaneseWords = data.japanese || [];
			chineseWords = data.chinese || [];
			koreanWords = data.korean || [];
		} catch (e) {
			error = e instanceof Error ? e.message : 'Unknown error';
			console.error('Failed to load frequency data:', e);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadFrequencyData();
	});

	function loadMore() {
		displayCount = Math.min(displayCount + PAGE_SIZE, 1000);
	}

	let displayedWords = $derived(
		activeTab === 'japanese'
			? japaneseWords.slice(0, displayCount)
			: activeTab === 'chinese'
				? chineseWords.slice(0, displayCount)
				: koreanWords.slice(0, displayCount)
	);

	let totalWords = $derived(
		activeTab === 'japanese'
			? japaneseWords.length
			: activeTab === 'chinese'
				? chineseWords.length
				: koreanWords.length
	);
</script>

<Header />

<main id="main-content" class="frequency-page learner-page learner-page--narrow">
	<div class="container">
		<div class="learner-intro">
			<h1>Word Frequency</h1>
		<p class="subtitle">
				Start with the words you are most likely to encounter. Rankings use Japanese corpus
				data and Chinese subtitle frequency.
		</p>
		</div>

		<!-- Tab switcher -->
		<div class="tabs" role="tablist" aria-label="Frequency language">
			<button
				class="tab"
				class:active={activeTab === 'japanese'}
				onclick={() => { activeTab = 'japanese'; displayCount = PAGE_SIZE; }}
				role="tab"
				aria-selected={activeTab === 'japanese'}
			>
				🇯🇵 Japanese ({japaneseWords.length})
			</button>
			<button
				class="tab"
				class:active={activeTab === 'chinese'}
				onclick={() => { activeTab = 'chinese'; displayCount = PAGE_SIZE; }}
				role="tab"
				aria-selected={activeTab === 'chinese'}
			>
				🇨🇳 Chinese ({chineseWords.length})
			</button>
			<button
				class="tab"
				class:active={activeTab === 'korean'}
				onclick={() => { activeTab = 'korean'; displayCount = PAGE_SIZE; }}
				role="tab"
				aria-selected={activeTab === 'korean'}
				disabled={koreanWords.length === 0}
				title={koreanWords.length === 0 ? 'Korean frequency data is coming soon' : undefined}
			>
				🇰🇷 Korean {koreanWords.length ? `(${koreanWords.length})` : '— Soon'}
			</button>
		</div>

		{#if loading}
			<div class="loading" role="status">Loading frequency data…</div>
		{:else if error}
			<div class="error" role="alert">Frequency data could not load. {error}</div>
		{:else}
			<div class="word-list" role="tabpanel">
				{#each displayedWords as word, i (word.word + '-' + i)}
					<a href="/{word.word}" class="word-card">
						<span class="rank">#{word.rank}</span>
						<span class="word-text">{word.word}</span>
						<span class="reading">{word.reading}</span>
						<span class="definition">{word.definition}</span>
						{#if word.common}
							<span class="common-badge">⭐</span>
						{/if}
					</a>
				{/each}
			</div>

			{#if displayCount < totalWords}
				<button class="load-more" onclick={loadMore}>
					Load more ({displayCount} / {totalWords})
				</button>
			{/if}
		{/if}
	</div>
</main>

<style>
	.frequency-page {
		min-height: calc(100dvh - var(--kiokun-header-height, 4.5rem));
	}

	.container {
		max-width: 800px;
		margin: 0 auto;
	}

	.subtitle {
		color: var(--text-secondary);
		font-size: var(--font-size-callout);
	}

	.tabs {
		display: flex;
		gap: var(--spacing-sm);
		margin-bottom: var(--spacing-xl);
		overflow-x: auto;
		padding-bottom: 0.2rem;
		scrollbar-width: thin;
	}

	.tab {
		min-height: 2.75rem;
		flex: 0 0 auto;
		padding: var(--spacing-sm) var(--spacing-lg);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-secondary);
		color: var(--text-primary);
		cursor: pointer;
		font-size: var(--font-size-callout);
		transition: background 0.15s ease, border-color 0.15s ease;
	}

	.tab:hover {
		background: var(--bg-tertiary);
	}

	.tab:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.tab.active {
		background: var(--accent);
		color: var(--accent-contrast);
		border-color: var(--accent);
	}

	.loading, .error {
		text-align: center;
		padding: calc(var(--spacing-xl) * 2);
		color: var(--text-secondary);
	}

	.error {
		color: var(--color-error, var(--accent));
	}

	.word-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	.word-card {
		display: grid;
		grid-template-columns: 3.5rem minmax(5rem, auto) minmax(6.5rem, auto) 1fr auto;
		gap: var(--spacing-md);
		align-items: center;
		padding: var(--spacing-md) var(--spacing-lg);
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		text-decoration: none;
		transition: background 0.15s ease, border-color 0.15s ease;
	}

	.word-card:hover {
		background: var(--bg-tertiary);
		border-color: var(--accent);
	}

	.rank {
		font-size: var(--font-size-footnote);
		color: var(--text-muted);
		font-weight: 600;
	}

	.word-text {
		font-size: var(--font-size-title);
		font-weight: 600;
		font-family: var(--font-cjk);
		color: var(--text-primary);
	}

	.reading {
		font-size: var(--font-size-callout);
		color: var(--color-onyomi, var(--accent));
		font-family: var(--font-cjk);
	}

	.definition {
		font-size: var(--font-size-callout);
		color: var(--text-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.common-badge {
		font-size: var(--font-size-callout);
	}

	.load-more {
		display: block;
		width: 100%;
		padding: var(--spacing-lg);
		margin-top: var(--spacing-xl);
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		cursor: pointer;
		font-size: var(--font-size-callout);
		transition: background 0.15s ease, border-color 0.15s ease;
	}

	.load-more:hover {
		background: var(--bg-tertiary);
		border-color: var(--accent);
	}

	@media (max-width: 768px) {
		.word-list {
			gap: var(--spacing-sm);
		}

		.word-card {
			grid-template-columns: 2.8rem minmax(3.5rem, auto) minmax(0, 1fr) auto;
			gap: var(--spacing-sm);
			padding: var(--spacing-md);
		}

		.rank {
			font-size: var(--font-size-caption1);
		}

		.word-text {
			font-size: var(--font-size-headline);
		}

		.reading {
			overflow: hidden;
			font-size: var(--font-size-footnote);
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.definition {
			grid-column: 1 / -1;
			font-size: var(--font-size-footnote);
			white-space: normal;
			line-height: 1.4;
		}

		.common-badge {
			font-size: var(--font-size-caption1);
		}

		.load-more {
			padding: var(--spacing-lg);
			margin-top: var(--spacing-lg);
			font-size: var(--font-size-footnote);
		}
	}
</style>
