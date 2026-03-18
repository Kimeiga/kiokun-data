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
	let displayCount = $state(100);

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
		displayCount = Math.min(displayCount + 100, 1000);
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

<svelte:head>
	<title>Frequency List - Kiokun Dictionary</title>
	<meta name="description" content="Most common Japanese, Chinese, and Korean words ranked by frequency" />
</svelte:head>

<Header />

<main class="frequency-page">
	<div class="container">
		<h1>📊 Word Frequency List</h1>
		<p class="subtitle">
			The most common words ranked by frequency. Japanese words use JPDB corpus data,
			Chinese words use movie subtitle frequency, Korean words use subtitle frequency.
		</p>

		<!-- Tab switcher -->
		<div class="tabs">
			<button
				class="tab"
				class:active={activeTab === 'japanese'}
				onclick={() => { activeTab = 'japanese'; displayCount = 100; }}
			>
				🇯🇵 Japanese ({japaneseWords.length})
			</button>
			<button
				class="tab"
				class:active={activeTab === 'chinese'}
				onclick={() => { activeTab = 'chinese'; displayCount = 100; }}
			>
				🇨🇳 Chinese ({chineseWords.length})
			</button>
			<button
				class="tab"
				class:active={activeTab === 'korean'}
				onclick={() => { activeTab = 'korean'; displayCount = 100; }}
			>
				🇰🇷 Korean ({koreanWords.length})
			</button>
		</div>

		{#if loading}
			<div class="loading">Loading frequency data...</div>
		{:else if error}
			<div class="error">{error}</div>
		{:else}
			<div class="word-list">
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
		min-height: 100vh;
		background: var(--bg-primary);
		padding: var(--spacing-xl);
	}

	.container {
		max-width: 800px;
		margin: 0 auto;
	}

	h1 {
		color: var(--text-primary);
		margin-bottom: var(--spacing-sm);
	}

	.subtitle {
		color: var(--text-secondary);
		margin-bottom: var(--spacing-xl);
		font-size: var(--font-size-callout);
	}

	.tabs {
		display: flex;
		gap: var(--spacing-sm);
		margin-bottom: var(--spacing-xl);
	}

	.tab {
		padding: var(--spacing-md) var(--spacing-xl);
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

	.tab.active {
		background: var(--accent);
		color: white;
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
		grid-template-columns: 60px 80px 100px 1fr auto;
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
		transform: translateX(var(--spacing-xs));
	}

	.rank {
		font-size: var(--font-size-footnote);
		color: var(--text-muted);
		font-weight: 600;
	}

	.word-text {
		font-size: var(--font-size-title);
		font-weight: 600;
		font-family: "Noto Serif TC", "Noto Serif SC", "Noto Serif JP", "MS Mincho", serif;
		color: var(--text-primary);
	}

	.reading {
		font-size: var(--font-size-callout);
		color: var(--color-onyomi, var(--accent));
		font-family: "Noto Serif TC", "Noto Serif SC", "Noto Serif JP", "MS Mincho", serif;
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
			grid-template-columns: 50px 60px 1fr;
			gap: var(--spacing-sm);
			padding: var(--spacing-md);
			position: relative;
		}

		.rank {
			font-size: var(--font-size-caption1);
		}

		.word-text {
			font-size: var(--font-size-headline);
		}

		.reading {
			display: none;
		}

		.definition {
			grid-column: 1 / -1;
			font-size: var(--font-size-footnote);
		}

		.common-badge {
			position: absolute;
			right: var(--spacing-md);
			top: 50%;
			transform: translateY(-50%);
			font-size: var(--font-size-caption1);
		}

		.load-more {
			padding: var(--spacing-lg);
			margin-top: var(--spacing-lg);
			font-size: var(--font-size-footnote);
		}
	}
</style>

