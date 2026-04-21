<script lang="ts">
	import { goto } from '$app/navigation';

	interface Props {
		value: string;
		onNavigate?: () => void;
	}

	let { value = $bindable(), onNavigate }: Props = $props();

	interface SearchResult {
		word: string;
		language: string;
		languages?: string[];
		pronunciation: string;
		definitions: string[];
	}

	let results = $state<SearchResult[]>([]);
	let showDropdown = $state(false);
	let loading = $state(false);
	let selectedIndex = $state(-1);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let inputFocused = $state(false);

	$effect(() => {
		const q = value.trim();
		if (q.length < 1) {
			results = [];
			showDropdown = false;
			return;
		}

		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(async () => {
			loading = true;
			try {
				const resp = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=8`);
				if (resp.ok) {
					const data = await resp.json();
					results = data.results || [];
					showDropdown = results.length > 0;
					selectedIndex = -1;
				}
			} catch {
				results = [];
			} finally {
				loading = false;
			}
		}, 200);
	});

	function navigateTo(word: string) {
		showDropdown = false;
		value = word;
		onNavigate?.();
		goto(`/${word}`);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!showDropdown || results.length === 0) return;

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			selectedIndex = Math.max(selectedIndex - 1, -1);
		} else if (event.key === 'Enter' && selectedIndex >= 0) {
			event.preventDefault();
			navigateTo(results[selectedIndex].word);
		} else if (event.key === 'Escape') {
			showDropdown = false;
		}
	}

	function handleBlur() {
		// Delay to allow click on dropdown item
		inputFocused = false;
		setTimeout(() => {
			if (!inputFocused) showDropdown = false;
		}, 200);
	}

	function handleFocus() {
		inputFocused = true;
		// Re-show dropdown if we have results
		if (results.length > 0 && value.trim().length > 0) {
			showDropdown = true;
		}
	}

	function langFlag(lang: string): string {
		return lang === 'chinese' ? '🇨🇳' : lang === 'japanese' ? '🇯🇵' : lang === 'korean' ? '🇰🇷' : '';
	}
</script>

<svelte:window onkeydown={handleKeydown} onfocusin={(e) => {
	if ((e.target as HTMLElement)?.matches?.('input[type="text"]')) handleFocus();
}} onclick={(e) => {
	const target = e.target as HTMLElement;
	if (showDropdown && !target.closest('.search-dropdown') && !target.closest('input[type="text"]')) {
		showDropdown = false;
	}
}} />

{#if showDropdown}
	<div class="search-dropdown">
		{#each results as r, i}
			<button
				class="dropdown-item"
				class:selected={i === selectedIndex}
				onmousedown={() => navigateTo(r.word)}
			>
				<span class="item-word">{r.word}</span>
				<span class="item-lang">{(r.languages || [r.language]).map(langFlag).join('')}</span>
				{#if r.pronunciation}
					<span class="item-reading">{r.pronunciation}</span>
				{/if}
				{#if r.definitions?.length}
					<span class="item-def">{r.definitions[0]}</span>
				{/if}
			</button>
		{/each}
		{#if loading}
			<div class="dropdown-loading">Searching...</div>
		{/if}
	</div>
{/if}

<style>
	.search-dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 0 0 var(--radius-md) var(--radius-md);
		box-shadow: 0 4px 12px rgba(0,0,0,0.15);
		z-index: 50;
		max-height: 320px;
		overflow-y: auto;
	}

	.dropdown-item {
		display: flex;
		align-items: baseline;
		gap: var(--spacing-sm);
		width: 100%;
		padding: var(--spacing-md) var(--spacing-lg);
		border: none;
		background: none;
		text-align: left;
		cursor: pointer;
		transition: background 0.1s;
		font-family: inherit;
	}
	.dropdown-item:hover, .dropdown-item.selected {
		background: var(--bg-tertiary);
	}
	.dropdown-item + .dropdown-item {
		border-top: 1px solid var(--border-color);
	}

	.item-word {
		font-size: var(--font-size-headline);
		font-weight: 600;
		color: var(--text-primary);
		font-family: var(--font-cjk);
		flex-shrink: 0;
	}
	.item-lang { font-size: 12px; flex-shrink: 0; }
	.item-reading {
		font-size: var(--font-size-caption1);
		color: var(--color-pinyin);
		flex-shrink: 0;
	}
	.item-def {
		font-size: var(--font-size-caption1);
		color: var(--text-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
		min-width: 0;
	}

	.dropdown-loading {
		padding: var(--spacing-md) var(--spacing-lg);
		font-size: var(--font-size-caption1);
		color: var(--text-muted);
	}
</style>
