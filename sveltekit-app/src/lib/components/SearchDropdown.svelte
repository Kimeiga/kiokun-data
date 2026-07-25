<script lang="ts">
	import { goto } from '$app/navigation';

	interface Props {
		value: string;
		inputId?: string;
		listboxId?: string;
		open?: boolean;
		activeDescendant?: string;
		onNavigate?: () => void;
	}

	let {
		value = $bindable(),
		inputId = 'site-search',
		listboxId = 'site-search-results',
		open = $bindable(false),
		activeDescendant = $bindable(''),
		onNavigate
	}: Props = $props();

	interface SearchResult {
		word: string;
		targetWord?: string;
		forms?: string[];
		language: string;
		languages?: string[];
		pronunciation: string;
		definitions: string[];
	}

	let results = $state<SearchResult[]>([]);
	let loading = $state(false);
	let loadError = $state(false);
	let selectedIndex = $state(-1);
	let debounceTimer: number | null = null;
	let abortController: AbortController | null = null;
	let inputFocused = $state(false);
	let dismissedValue = $state('');
	let lastFetchedQuery = '';

	function optionId(index: number): string {
		return `${listboxId}-option-${index}`;
	}

	function setSelectedIndex(index: number): void {
		selectedIndex = index;
		activeDescendant = index >= 0 ? optionId(index) : '';
	}

	export function close(): void {
		open = false;
		dismissedValue = value.trim();
		setSelectedIndex(-1);
		abortController?.abort();
		abortController = null;
	}

	export function handleFocus(): void {
		inputFocused = true;
		dismissedValue = '';
		if ((results.length > 0 || loading || loadError) && value.trim()) {
			open = true;
		}
	}

	export function handleBlur(): void {
		inputFocused = false;
		window.setTimeout(() => {
			if (!inputFocused) close();
		}, 120);
	}

	export function handleKeydown(event: KeyboardEvent): boolean {
		if (event.key === 'Escape' && open) {
			event.preventDefault();
			close();
			return true;
		}

		if (!open || results.length === 0) return false;

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			setSelectedIndex(Math.min(selectedIndex + 1, results.length - 1));
			return true;
		}

		if (event.key === 'ArrowUp') {
			event.preventDefault();
			setSelectedIndex(Math.max(selectedIndex - 1, -1));
			return true;
		}

		if (event.key === 'Enter' && selectedIndex >= 0) {
			event.preventDefault();
			const result = results[selectedIndex];
			navigateTo(result.targetWord || result.word, result.word);
			return true;
		}

		return false;
	}

	$effect(() => {
		const query = value.trim();
		if (!query) {
			results = [];
			loading = false;
			loadError = false;
			lastFetchedQuery = '';
			close();
			return;
		}

		if (query === dismissedValue || query === lastFetchedQuery) return;

		if (debounceTimer) window.clearTimeout(debounceTimer);
		abortController?.abort();

		debounceTimer = window.setTimeout(async () => {
			const requestQuery = query;
			const controller = new AbortController();
			abortController = controller;
			loading = true;
			loadError = false;
			if (inputFocused) open = true;

			try {
				const response = await fetch(
					`/api/search?q=${encodeURIComponent(requestQuery)}&limit=8`,
					{ signal: controller.signal }
				);
				if (!response.ok) throw new Error(`Search failed (${response.status})`);

				const data = await response.json();
				if (controller.signal.aborted || value.trim() !== requestQuery) return;

				results = data.results || [];
				lastFetchedQuery = requestQuery;
				setSelectedIndex(-1);
				open = inputFocused && results.length > 0;
			} catch (error) {
				if (controller.signal.aborted) return;
				results = [];
				loadError = true;
				open = inputFocused;
			} finally {
				if (abortController === controller) abortController = null;
				if (!controller.signal.aborted) loading = false;
			}
		}, 180);

		return () => {
			if (debounceTimer) window.clearTimeout(debounceTimer);
		};
	});

	function navigateTo(targetWord: string, displayWord = targetWord): void {
		value = displayWord;
		close();
		onNavigate?.();
		void goto(`/${encodeURIComponent(targetWord)}`);
	}

	function langFlag(lang: string): string {
		return lang === 'chinese' ? '🇨🇳' : lang === 'japanese' ? '🇯🇵' : lang === 'korean' ? '🇰🇷' : '';
	}

	function displayForms(result: SearchResult): string {
		const forms = result.forms?.filter(Boolean) || [];
		return forms.length > 1 ? forms.slice(0, 3).join(' · ') : result.word;
	}
</script>

<svelte:window
	onpointerdown={(event) => {
		const target = event.target as HTMLElement;
		if (
			open &&
			!target.closest(`#${listboxId}`) &&
			!target.closest(`#${inputId}`)
		) {
			close();
		}
	}}
/>

{#if open}
	<div
		id={listboxId}
		class="search-dropdown"
		role="listbox"
		aria-label="Dictionary suggestions"
	>
		{#each results as result, index}
			<button
				id={optionId(index)}
				type="button"
				role="option"
				aria-selected={index === selectedIndex}
				tabindex="-1"
				class="dropdown-item"
				class:selected={index === selectedIndex}
				onpointerdown={(event) => event.preventDefault()}
				onmouseenter={() => setSelectedIndex(index)}
				onclick={() => navigateTo(result.targetWord || result.word, result.word)}
			>
				<span class="item-primary">
					<span class="item-word">{displayForms(result)}</span>
					<span class="item-lang" aria-hidden="true">
						{(result.languages || [result.language]).map(langFlag).join('')}
					</span>
					{#if result.pronunciation}
						<span class="item-reading">{result.pronunciation}</span>
					{/if}
				</span>
				{#if result.definitions?.length}
					<span class="item-def">{result.definitions[0]}</span>
				{/if}
			</button>
		{/each}

		{#if loading}
			<div class="dropdown-status" role="status">
				<span class="status-dot" aria-hidden="true"></span>
				Searching…
			</div>
		{:else if loadError}
			<div class="dropdown-status dropdown-error" role="status">
				Suggestions are unavailable. Press Enter to search.
			</div>
		{/if}
	</div>
{/if}

<style>
	.search-dropdown {
		position: absolute;
		z-index: 120;
		top: calc(100% + 0.4rem);
		right: 0;
		left: 0;
		max-height: min(23rem, calc(100dvh - 5.5rem));
		overflow-y: auto;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		background: var(--bg-secondary);
		box-shadow: 0 16px 36px var(--shadow-hover);
		overscroll-behavior: contain;
	}

	.dropdown-item {
		display: grid;
		width: 100%;
		min-height: 3.5rem;
		grid-template-columns: minmax(0, 1fr);
		gap: 0.1rem;
		padding: 0.65rem 0.8rem;
		border: 0;
		background: transparent;
		color: var(--text-primary);
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition: background-color 120ms ease;
	}

	.dropdown-item + .dropdown-item {
		border-top: 1px solid var(--border-light);
	}

	.dropdown-item:hover,
	.dropdown-item.selected {
		background: var(--accent-light);
	}

	.item-primary {
		display: flex;
		min-width: 0;
		align-items: baseline;
		gap: 0.45rem;
	}

	.item-word {
		overflow: hidden;
		color: var(--text-primary);
		font-family: var(--font-cjk);
		font-size: 1.1rem;
		font-weight: 700;
		line-height: 1.25;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.item-lang {
		flex: 0 0 auto;
		font-size: 0.75rem;
	}

	.item-reading {
		min-width: 0;
		overflow: hidden;
		color: var(--color-pinyin);
		font-family: var(--font-cjk);
		font-size: var(--font-size-caption1);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.item-def {
		overflow: hidden;
		color: var(--text-secondary);
		font-size: var(--font-size-caption1);
		line-height: 1.35;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.dropdown-status {
		display: flex;
		min-height: 2.75rem;
		align-items: center;
		gap: 0.5rem;
		padding: 0.7rem 0.85rem;
		border-top: 1px solid var(--border-light);
		color: var(--text-secondary);
		font-size: var(--font-size-caption1);
	}

	.dropdown-error {
		color: var(--color-error);
	}

	.status-dot {
		width: 0.45rem;
		height: 0.45rem;
		border-radius: var(--radius-full);
		background: var(--accent);
		animation: search-pulse 800ms ease-in-out infinite alternate;
	}

	@keyframes search-pulse {
		to {
			opacity: 0.3;
			transform: scale(0.75);
		}
	}

	@media (max-width: 520px) {
		.search-dropdown {
			position: fixed;
			top: calc(var(--kiokun-header-height, 3.75rem) + env(safe-area-inset-top, 0px));
			right: 0.5rem;
			left: 0.5rem;
			max-height: min(26rem, calc(100dvh - var(--kiokun-header-height, 3.75rem) - 1rem));
			border-radius: var(--radius-lg);
		}
	}
</style>
