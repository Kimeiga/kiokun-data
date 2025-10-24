<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import Header from '$lib/components/Header.svelte';

	interface SearchResult {
		word: string;
		language: string;
		pronunciation: string;
		definitions: string[];
		is_common: boolean;
	}

	interface SearchResponse {
		query: string;
		results: SearchResult[];
		total: number;
	}

	let query = $state('');
	let results: SearchResult[] = $state([]);
	let loading = $state(false);
	let error = $state('');
	let total = $state(0);

	// Get query from URL parameter
	$effect(() => {
		const urlQuery = $page.url.searchParams.get('q');
		if (urlQuery && urlQuery !== query) {
			query = urlQuery;
			performSearch(urlQuery);
		}
	});

	async function performSearch(searchQuery: string) {
		if (!searchQuery || searchQuery.trim().length === 0) {
			results = [];
			error = '';
			return;
		}

		loading = true;
		error = '';

		try {
			const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&limit=100`);

			if (!response.ok) {
				throw new Error(`Search failed: ${response.statusText}`);
			}

			const data: SearchResponse = await response.json();
			results = data.results;
			total = data.total;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Search failed';
			results = [];
		} finally {
			loading = false;
		}
	}

	// Separate results by language
	let japaneseResults = $derived(results.filter(r => r.language === 'japanese'));
	let chineseResults = $derived(results.filter(r => r.language === 'chinese'));
</script>

<svelte:head>
	<title>Search: {query || 'Dictionary'} - Kiokun</title>
</svelte:head>

<Header currentWord="" />

<div class="search-page">
	<div class="search-header">
		<h1>Search Results</h1>
		{#if query}
			<p class="search-query">
				Searching for: <strong>{query}</strong>
			</p>
		{/if}
	</div>

	{#if loading}
		<div class="loading">
			<div class="spinner"></div>
			<p>Searching...</p>
		</div>
	{:else if error}
		<div class="error-message">
			<p>❌ {error}</p>
		</div>
	{:else if !query}
		<div class="empty-state">
			<p>Enter a search term to find dictionary entries</p>
		</div>
	{:else if results.length === 0}
		<div class="no-results">
			<p>No results found for "{query}"</p>
			<p class="hint">Try searching for English words that might appear in definitions</p>
		</div>
	{:else}
		<div class="results-header">
			<p>Found {total} {total === 1 ? 'result' : 'results'}</p>
		</div>

		<div class="results-container">
			<!-- Japanese results column -->
			<div class="results-column">
				<h2 class="column-title">Japanese 🇯🇵</h2>
				<div class="results-list">
					{#each japaneseResults as result}
						<a href="/{result.word}" class="result-card">
							<div class="result-header">
								<span class="word">{result.word}</span>
								{#if result.pronunciation}
									<span class="pronunciation">[{result.pronunciation}]</span>
								{/if}
								{#if result.is_common}
									<span class="common-badge">Common</span>
								{/if}
							</div>
							<div class="definitions">
								{#each result.definitions.slice(0, 3) as definition, i}
									<div class="definition">
										{i + 1}. {definition}
									</div>
								{/each}
								{#if result.definitions.length > 3}
									<div class="more-definitions">
										+{result.definitions.length - 3} more {result.definitions.length - 3 === 1 ? 'definition' : 'definitions'}
									</div>
								{/if}
							</div>
						</a>
					{/each}
				</div>
			</div>

			<!-- Chinese results column -->
			<div class="results-column">
				<h2 class="column-title">Chinese 🇨🇳</h2>
				<div class="results-list">
					{#each chineseResults as result}
						<a href="/{result.word}" class="result-card">
							<div class="result-header">
								<span class="word">{result.word}</span>
								{#if result.pronunciation}
									<span class="pronunciation">[{result.pronunciation}]</span>
								{/if}
								{#if result.is_common}
									<span class="common-badge">Common</span>
								{/if}
							</div>
							<div class="definitions">
								{#each result.definitions.slice(0, 3) as definition, i}
									<div class="definition">
										{i + 1}. {definition}
									</div>
								{/each}
								{#if result.definitions.length > 3}
									<div class="more-definitions">
										+{result.definitions.length - 3} more {result.definitions.length - 3 === 1 ? 'definition' : 'definitions'}
									</div>
								{/if}
							</div>
						</a>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.search-page {
		max-width: 1400px;
		margin: 0 auto;
		padding: 20px;
	}

	.search-header {
		margin-bottom: 30px;
	}

	.search-header h1 {
		font-size: 32px;
		margin-bottom: 10px;
		color: var(--color-text);
	}

	.search-query {
		font-size: 18px;
		color: var(--color-text-secondary);
	}

	.search-query strong {
		color: var(--color-primary);
	}

	.loading {
		text-align: center;
		padding: 60px 20px;
	}

	.spinner {
		width: 40px;
		height: 40px;
		margin: 0 auto 20px;
		border: 4px solid var(--color-border);
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.error-message,
	.empty-state,
	.no-results {
		text-align: center;
		padding: 60px 20px;
		color: var(--color-text-secondary);
	}

	.no-results .hint {
		margin-top: 10px;
		font-size: 14px;
		color: var(--color-text-tertiary);
	}

	.results-header {
		margin-bottom: 20px;
		padding-bottom: 10px;
		border-bottom: 1px solid var(--color-border);
		color: var(--color-text-secondary);
	}

	.results-container {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 30px;
	}

	.results-column {
		display: flex;
		flex-direction: column;
		gap: 15px;
	}

	.column-title {
		font-size: 20px;
		font-weight: 600;
		color: var(--color-text);
		margin-bottom: 10px;
		padding-bottom: 8px;
		border-bottom: 2px solid var(--color-border);
	}

	.results-list {
		display: flex;
		flex-direction: column;
		gap: 15px;
	}

	.result-card {
		display: block;
		padding: 20px;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		text-decoration: none;
		color: inherit;
		transition: all 0.2s ease;
	}

	:global(body.light-theme) .result-card {
		background: rgba(0, 0, 0, 0.02);
		border: 1px solid rgba(0, 0, 0, 0.08);
	}

	.result-card:hover {
		border-color: var(--color-primary);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		transform: translateY(-2px);
	}

	.result-header {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 12px;
		flex-wrap: wrap;
	}

	.word {
		font-size: 24px;
		font-weight: bold;
		color: white;
	}

	:global(body.light-theme) .word {
		color: black;
	}

	.pronunciation {
		font-size: 16px;
		color: var(--color-kunyomi);
	}

	.common-badge {
		font-size: 12px;
		padding: 2px 8px;
		border-radius: 4px;
		background: var(--color-primary);
		color: white;
		font-weight: 500;
	}

	.definitions {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.definition {
		color: white;
		line-height: 1.5;
	}

	:global(body.light-theme) .definition {
		color: black;
	}

	.more-definitions {
		color: var(--color-text-tertiary);
		font-size: 14px;
		font-style: italic;
		margin-top: 4px;
	}

	@media (max-width: 768px) {
		.search-page {
			padding: 15px;
		}

		.search-header h1 {
			font-size: 24px;
		}

		.word {
			font-size: 20px;
		}

		.results-container {
			grid-template-columns: 1fr;
			gap: 30px;
		}

		.column-title {
			font-size: 18px;
		}
	}
</style>

