<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import Header from '$lib/components/Header.svelte';
	import { getDictionaryUrl } from '$lib/shard-utils';
	import { dev } from '$app/environment';

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

	// Map of traditional → simplified for Chinese results
	let simplifiedForms = $state<Record<string, string>>({});

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

			// Fetch simplified forms for Chinese results
			loadSimplifiedForms(data.results.filter(r => r.language === 'chinese'));
		} catch (err) {
			error = err instanceof Error ? err.message : 'Search failed';
			results = [];
		} finally {
			loading = false;
		}
	}

	// Fetch dictionary entries for Chinese results to get simplified forms
	async function loadSimplifiedForms(chineseResults: SearchResult[]) {
		const uniqueWords = [...new Set(chineseResults.map(r => r.word))];
		const forms: Record<string, string> = {};

		await Promise.all(uniqueWords.map(async (word) => {
			try {
				const url = await getDictionaryUrl(word, dev, fetch);
				const response = await fetch(url);
				if (!response.ok) return;

				const buffer = await response.arrayBuffer();
				const decompressed = await new Response(
					new Blob([buffer]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
				).text();
				const entry = JSON.parse(decompressed);

				// Extract simplified form from chinese_words
				if (entry.chinese_words?.length > 0) {
					const cw = entry.chinese_words[0];
					if (cw.simp && cw.simp !== word) {
						forms[word] = cw.simp;
					}
				}
			} catch {
				// Ignore failures
			}
		}));

		simplifiedForms = { ...simplifiedForms, ...forms };
	}

	// Separate results by language
	let japaneseResults = $derived(results.filter(r => r.language === 'japanese'));
	let chineseResults = $derived(results.filter(r => r.language === 'chinese'));
	let koreanResults = $derived(results.filter(r => r.language === 'korean'));
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
			<!-- Only show language columns that have results -->
			{#if chineseResults.length > 0}
				<div class="results-column">
					<h2 class="column-title">Chinese 🇨🇳</h2>
					<div class="results-list">
						{#each chineseResults as result}
							<a href="/{result.word}" class="result-card">
								<div class="result-header">
									<span class="word">
										{#if simplifiedForms[result.word]}
											{simplifiedForms[result.word]} / {result.word}
										{:else}
											{result.word}
										{/if}
									</span>
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
			{/if}

			{#if japaneseResults.length > 0}
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
			{/if}

			{#if koreanResults.length > 0}
				<div class="results-column">
					<h2 class="column-title">Korean 🇰🇷</h2>
					<div class="results-list">
						{#each koreanResults as result}
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
			{/if}
		</div>
	{/if}
</div>

<style>
	.search-page {
		max-width: 1400px;
		margin: 0 auto;
		padding: var(--spacing-xl);
	}

	.search-header {
		margin-bottom: var(--spacing-xl);
	}

	.search-header h1 {
		font-size: var(--font-size-title);
		margin-bottom: var(--spacing-md);
		color: var(--text-primary);
	}

	.search-query {
		font-size: var(--font-size-headline);
		color: var(--text-secondary);
	}

	.search-query strong {
		color: var(--accent);
	}

	.loading {
		text-align: center;
		padding: 60px var(--spacing-xl);
	}

	.spinner {
		width: 40px;
		height: 40px;
		margin: 0 auto var(--spacing-xl);
		border: 4px solid var(--border);
		border-top-color: var(--accent);
		border-radius: var(--radius-full);
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
		padding: 60px var(--spacing-xl);
		color: var(--text-secondary);
	}

	.no-results .hint {
		margin-top: var(--spacing-md);
		font-size: var(--font-size-callout);
		color: var(--text-tertiary);
	}

	.results-header {
		margin-bottom: var(--spacing-xl);
		padding-bottom: var(--spacing-md);
		border-bottom: 1px solid var(--border);
		color: var(--text-secondary);
	}

	.results-container {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: var(--spacing-xl);
	}

	.results-column {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-lg);
	}

	.column-title {
		font-size: var(--font-size-headline);
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: var(--spacing-md);
		padding-bottom: var(--spacing-sm);
		border-bottom: 2px solid var(--border);
	}

	.results-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-lg);
	}

	.result-card {
		display: block;
		padding: var(--spacing-xl);
		background: var(--bg-secondary);
		border: 1px solid var(--border-light);
		border-radius: var(--radius-md);
		text-decoration: none;
		color: inherit;
		transition: background 0.15s ease, border-color 0.15s ease;
	}

	.result-card:hover {
		border-color: var(--accent);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		transform: translateY(-2px);
	}

	.result-header {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-md);
		flex-wrap: wrap;
	}

	.word {
		font-size: var(--font-size-title);
		font-weight: bold;
		color: var(--text-primary);
	}

	.pronunciation {
		font-size: var(--font-size-body);
		color: var(--text-secondary);
	}

	.common-badge {
		font-size: var(--font-size-footnote);
		padding: var(--spacing-xs) var(--spacing-sm);
		border-radius: var(--radius-sm);
		background: var(--accent);
		color: white;
		font-weight: 500;
	}

	.definitions {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	.definition {
		color: var(--text-primary);
		line-height: 1.5;
	}

	.more-definitions {
		color: var(--text-tertiary);
		font-size: var(--font-size-callout);
		font-style: italic;
		margin-top: var(--spacing-xs);
	}

	@media (max-width: 768px) {
		.search-page {
			padding: var(--spacing-lg);
		}

		.results-header {
			margin-bottom: var(--spacing-lg);
			font-size: var(--font-size-footnote);
		}

		.results-container {
			grid-template-columns: 1fr;
		}

		.results-column {
			gap: var(--spacing-md);
		}

		.results-list {
			gap: var(--spacing-md);
		}

		.result-card {
			padding: var(--spacing-lg);
		}

		.result-header {
			gap: var(--spacing-sm);
		}

		.word {
			font-size: var(--font-size-headline);
		}

		.pronunciation {
			font-size: var(--font-size-footnote);
		}

		.common-badge {
			font-size: var(--font-size-caption2);
		}

		.definitions {
			gap: var(--spacing-xs);
		}

		.definition {
			font-size: var(--font-size-footnote);
		}

		.more-definitions {
			font-size: var(--font-size-caption1);
		}

		.no-results .hint {
			font-size: var(--font-size-caption1);
		}
	}
</style>

