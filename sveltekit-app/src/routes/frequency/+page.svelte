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
	let loading = $state(true);
	let error = $state<string | null>(null);
	let activeTab: 'japanese' | 'chinese' = $state('japanese');
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
			: chineseWords.slice(0, displayCount)
	);

	let totalWords = $derived(
		activeTab === 'japanese' ? japaneseWords.length : chineseWords.length
	);
</script>

<svelte:head>
	<title>Frequency List - Kiokun Dictionary</title>
	<meta name="description" content="Most common Japanese and Chinese words ranked by frequency" />
</svelte:head>

<Header />

<main class="frequency-page">
	<div class="container">
		<h1>📊 Word Frequency List</h1>
		<p class="subtitle">
			The most common words ranked by frequency. Japanese words use JPDB corpus data, 
			Chinese words use movie subtitle frequency.
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
		padding: 20px;
	}

	.container {
		max-width: 800px;
		margin: 0 auto;
	}

	h1 {
		color: var(--text-primary);
		margin-bottom: 8px;
	}

	.subtitle {
		color: var(--text-secondary);
		margin-bottom: 24px;
		font-size: 14px;
	}

	.tabs {
		display: flex;
		gap: 8px;
		margin-bottom: 20px;
	}

	.tab {
		padding: 10px 20px;
		border: 1px solid var(--border-color);
		border-radius: 8px;
		background: var(--bg-secondary);
		color: var(--text-primary);
		cursor: pointer;
		font-size: 14px;
		transition: all 0.2s ease;
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
		padding: 40px;
		color: var(--text-secondary);
	}

	.error {
		color: #e74c3c;
	}

	.word-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.word-card {
		display: grid;
		grid-template-columns: 60px 80px 100px 1fr auto;
		gap: 12px;
		align-items: center;
		padding: 12px 16px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		text-decoration: none;
		transition: all 0.2s ease;
	}

	.word-card:hover {
		background: var(--bg-tertiary);
		border-color: var(--accent);
		transform: translateX(4px);
	}

	.rank {
		font-size: 12px;
		color: var(--text-muted);
		font-weight: 600;
	}

	.word-text {
		font-size: 20px;
		font-weight: 600;
		font-family: "Noto Serif TC", "Noto Serif SC", "Noto Serif JP", "MS Mincho", serif;
		color: var(--text-primary);
	}

	.reading {
		font-size: 14px;
		color: var(--color-onyomi, #e74c3c);
		font-family: "Noto Serif TC", "Noto Serif SC", "Noto Serif JP", "MS Mincho", serif;
	}

	.definition {
		font-size: 14px;
		color: var(--text-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.common-badge {
		font-size: 14px;
	}

	.load-more {
		display: block;
		width: 100%;
		padding: 16px;
		margin-top: 20px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		color: var(--text-primary);
		cursor: pointer;
		font-size: 14px;
		transition: all 0.2s ease;
	}

	.load-more:hover {
		background: var(--bg-tertiary);
		border-color: var(--accent);
	}

	@media (max-width: 768px) {
		.word-card {
			grid-template-columns: 50px 60px 1fr;
			gap: 8px;
			padding: 10px 12px;
		}

		.reading {
			display: none;
		}

		.definition {
			grid-column: 1 / -1;
			font-size: 12px;
		}

		.common-badge {
			position: absolute;
			right: 12px;
			top: 50%;
			transform: translateY(-50%);
		}

		.word-card {
			position: relative;
		}
	}
</style>

