<script lang="ts">
	import { page } from '$app/stores';
	import Header from '$lib/components/Header.svelte';

	interface SearchResult {
		word: string;
		targetWord?: string;
		forms?: string[];
		language: string;
		languages?: string[];
		pronunciation: string;
		definitions: string[];
		is_common: boolean;
	}

	interface SearchResponse {
		query: string;
		results: SearchResult[];
		total: number;
	}

	interface CustomWordResult {
		id: string;
		word: string;
		language: string;
		definitions: string;
		pinyin?: string;
		kana?: string;
		hangul?: string;
		simplified?: string;
		traditional?: string;
		user?: { name: string } | null;
	}

	let query = $state('');
	let results: SearchResult[] = $state([]);
	let customResults = $state<CustomWordResult[]>([]);
	let loading = $state(false);
	let error = $state('');
	let total = $state(0);
	let visibleChinese = $state(8);
	let visibleJapanese = $state(8);
	let visibleKorean = $state(8);

	// Get query from URL parameter
	$effect(() => {
		const urlQuery = $page.url.searchParams.get('q');
		if (urlQuery && urlQuery !== query) {
			query = urlQuery;
			visibleChinese = 8;
			visibleJapanese = 8;
			visibleKorean = 8;
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
				const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&limit=60`);

			if (!response.ok) {
				throw new Error(`Search failed: ${response.statusText}`);
			}

			const data: SearchResponse = await response.json();
			results = data.results;
			total = data.total;

			// Also search custom words in parallel
			try {
				const customResp = await fetch(`/api/custom-words?q=${encodeURIComponent(searchQuery)}&limit=20`);
				if (customResp.ok) {
					customResults = await customResp.json();
				}
			} catch {
				customResults = [];
			}
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
	let koreanResults = $derived(results.filter(r => r.language === 'korean'));
</script>

<Header currentWord="" />

<main id="main-content" class="search-page learner-page learner-page--wide">
	<div class="search-header learner-intro">
		<h1>Search Results</h1>
		{#if query}
			<p class="search-query">
				Results across Chinese, Japanese, and Korean for <strong>{query}</strong>
			</p>
		{/if}
	</div>

	{#if loading}
		<div class="loading" role="status" aria-live="polite">
			<div class="spinner"></div>
			<p>Searching the dictionary…</p>
		</div>
	{:else if error}
		<div class="error-message" role="alert">
			<h2>Search is unavailable</h2>
			<p>{error}. Please try again.</p>
		</div>
	{:else if !query}
		<div class="empty-state">
			<p>Use the search field above to find a character, word, pronunciation, or meaning.</p>
		</div>
	{:else if results.length === 0}
		<div class="no-results">
			<h2>No results for “{query}”</h2>
			<p class="hint">Try a shorter spelling, a dictionary form, or an English meaning.</p>
		</div>
	{:else}
		<div class="results-header">
			<p>Found {total} {total === 1 ? 'result' : 'results'}</p>
		</div>

		<div class="results-container">
			<!-- Only show language columns that have results -->
			{#if chineseResults.length > 0}
				<div class="results-column">
					<h2 class="column-title section-bar-label mobile-full-bleed">Chinese 🇨🇳</h2>
					<div class="results-list divider-grid mobile-full-bleed">
						{#each chineseResults.slice(0, visibleChinese) as result}
							{@const targetWord = result.targetWord || result.word}
							<a href="/{targetWord}" class="result-card divider-cell">
								<div class="result-header">
									<span class="word">
										{(result.forms?.length ? result.forms.slice(0, 3) : [result.word]).join(' / ')}
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
					{#if visibleChinese < chineseResults.length}
						<button class="show-more" onclick={() => visibleChinese += 12}>
							Show more Chinese results <span>{visibleChinese} of {chineseResults.length}</span>
						</button>
					{/if}
				</div>
			{/if}

			{#if japaneseResults.length > 0}
				<div class="results-column">
					<h2 class="column-title section-bar-label mobile-full-bleed">Japanese 🇯🇵</h2>
					<div class="results-list divider-grid mobile-full-bleed">
						{#each japaneseResults.slice(0, visibleJapanese) as result}
							<a href="/{result.targetWord || result.word}" class="result-card divider-cell">
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
					{#if visibleJapanese < japaneseResults.length}
						<button class="show-more" onclick={() => visibleJapanese += 12}>
							Show more Japanese results <span>{visibleJapanese} of {japaneseResults.length}</span>
						</button>
					{/if}
				</div>
			{/if}

			{#if koreanResults.length > 0}
				<div class="results-column">
					<h2 class="column-title section-bar-label mobile-full-bleed">Korean 🇰🇷</h2>
					<div class="results-list divider-grid mobile-full-bleed">
						{#each koreanResults.slice(0, visibleKorean) as result}
							<a href="/{result.targetWord || result.word}" class="result-card divider-cell">
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
					{#if visibleKorean < koreanResults.length}
						<button class="show-more" onclick={() => visibleKorean += 12}>
							Show more Korean results <span>{visibleKorean} of {koreanResults.length}</span>
						</button>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Custom Word Results -->
		{#if customResults.length > 0}
			<div class="custom-results-section">
				<h2 class="column-title section-bar-label mobile-full-bleed" style="margin-top: var(--spacing-xl)">Community Words</h2>
				<div class="results-list divider-grid mobile-full-bleed">
					{#each customResults as cw}
						{@const defs = typeof cw.definitions === 'string' ? JSON.parse(cw.definitions) : cw.definitions}
						<a href="/{cw.word}" class="result-card divider-cell">
							<div class="result-header">
								<span class="word">
									{#if cw.language === 'zh' && cw.simplified && cw.traditional && cw.simplified !== cw.traditional}
										{cw.simplified} / {cw.traditional}
									{:else}
										{cw.word}
									{/if}
								</span>
								{#if cw.pinyin}
									<span class="pronunciation">[{cw.pinyin}]</span>
								{/if}
								{#if cw.kana && cw.word !== cw.kana}
									<span class="pronunciation">{cw.kana}</span>
								{/if}
								<span class="common-badge" style="background: var(--accent-light); color: var(--accent)">Community</span>
							</div>
							<div class="definitions">
								{#each defs.slice(0, 3) as definition, i}
									<div class="definition">{i + 1}. {definition}</div>
								{/each}
							</div>
						</a>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</main>

<style>
	.search-page {
		max-width: var(--content-wide);
	}

	.search-header {
		margin-bottom: var(--spacing-xl);
	}

	.search-header h1 {
		margin-bottom: 0;
		color: var(--text-primary);
	}

	.search-query {
		font-size: var(--font-size-body);
		color: var(--text-secondary);
	}

	.search-query strong {
		color: var(--accent);
	}

	.loading {
		text-align: center;
		padding: 4rem var(--spacing-xl);
	}

	.spinner {
		width: 40px;
		height: 40px;
		margin: 0 auto var(--spacing-xl);
		border: 3px solid var(--border-color);
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
		padding: 4rem var(--spacing-xl);
		color: var(--text-secondary);
	}

	.error-message h2,
	.no-results h2 {
		margin: 0 0 0.4rem;
		color: var(--text-primary);
		font-size: var(--font-size-headline);
	}

	.no-results .hint {
		margin-top: var(--spacing-md);
		font-size: var(--font-size-callout);
		color: var(--text-tertiary);
	}

	/* The column bars below are the divider; a rule at copy width would read
	   as a short line floating inside the full-width ruled surface. */
	.results-header {
		margin-bottom: var(--spacing-xl);
		padding-bottom: var(--spacing-md);
		color: var(--text-secondary);
	}

	.results-container {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
		gap: clamp(1.25rem, 3vw, 2rem);
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
		border-bottom: 1px solid var(--border-color);
	}

	.column-title.section-bar-label {
		margin-bottom: 0;
		/* Match the cards' gutter so the label lines up with the results. */
		padding-inline: var(--spacing-lg);
		border-bottom: 0;
		color: var(--section-bar-text);
		font-size: var(--font-size-subhead);
	}

	.results-list {
		grid-template-columns: 1fr;
	}

	.result-card {
		display: block;
		padding: var(--spacing-lg);
		background: var(--bg-secondary);
		border: 1px solid var(--border-light);
		border-radius: var(--radius-md);
		text-decoration: none;
		color: inherit;
		transition: background-color 0.15s ease, border-color 0.15s ease;
	}

	.result-card:hover {
		border-color: var(--accent);
		background: var(--surface-hover);
	}

	.show-more {
		display: flex;
		min-height: 44px;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.65rem 0.85rem;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-tertiary);
		color: var(--accent);
		font: inherit;
		font-size: var(--font-size-callout);
		font-weight: 650;
		cursor: pointer;
	}

	.show-more span {
		color: var(--text-muted);
		font-size: var(--font-size-caption1);
		font-weight: 500;
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
			padding-top: 1.1rem;
		}

		.results-header {
			margin-bottom: var(--spacing-lg);
			font-size: var(--font-size-footnote);
		}

		.results-container {
			grid-template-columns: 1fr;
			gap: 1.75rem;
		}

		.results-column {
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
