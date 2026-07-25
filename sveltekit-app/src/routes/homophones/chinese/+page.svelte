<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import Notes from '$lib/components/Notes.svelte';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	interface HomophoneWord {
		w: string;
		g: string[];
		p?: string; // pinyin display
		c: number;
	}

	interface HomophoneGroup {
		r: string; // reading key
		p?: string; // pinyin display
		w: HomophoneWord[];
	}

	let mode = $state<'words' | 'characters'>('words');
	let wordData = $state<HomophoneGroup[]>([]);
	let charData = $state<HomophoneGroup[]>([]);
	let loading = $state(true);
	let searchQuery = $state('');
	let minGroupSize = $state(2);

	onMount(async () => {
		const params = $page.url.searchParams;
		if (params.get('q')) searchQuery = params.get('q')!;
		if (params.get('mode') === 'characters') mode = 'characters';
		if (params.get('min')) minGroupSize = parseInt(params.get('min')!) || 2;

		const [wordResp, charResp] = await Promise.all([
			fetch('/homophones_zh_words.json'),
			fetch('/homophones_zh_chars.json'),
		]);
		wordData = await wordResp.json();
		charData = await charResp.json();
		loading = false;
		setTimeout(() => { initialized = true; }, 100);
	});

	let initialized = $state(false);
	let urlTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		if (!initialized) return;
		const q = searchQuery; const m = mode; const min = minGroupSize;
		if (urlTimer) clearTimeout(urlTimer);
		urlTimer = setTimeout(() => {
			const params = new URLSearchParams();
			if (q) params.set('q', q);
			if (m !== 'words') params.set('mode', m);
			if (min !== 2) params.set('min', String(min));
			const qs = params.toString();
			const target = qs ? `${$page.url.pathname}?${qs}` : $page.url.pathname;
			if (target !== $page.url.pathname + $page.url.search) history.replaceState(null, '', target);
		}, 300);
	});

	let data = $derived(mode === 'words' ? wordData : charData);

	let filtered = $derived.by(() => {
		let result = data;
		if (searchQuery.trim()) {
			const q = searchQuery.trim().toLowerCase();
			result = result.filter(g => {
				if (g.r.includes(q)) return true;
				if (g.p?.toLowerCase().includes(q)) return true;
				if (g.w.some(w => w.w.includes(q))) return true;
				if (g.w.some(w => w.g.some(gl => gl.toLowerCase().includes(q)))) return true;
				return false;
			});
		}
		result = result.filter(g => g.w.length >= minGroupSize);
		return result;
	});

	let pageNum = $state(0);
	const pageSize = 6;
	const groupPreviewSize = 8;
	let expandedGroups = $state<string[]>([]);
	let displayed = $derived(filtered.slice(0, (pageNum + 1) * pageSize));
	let hasMore = $derived(displayed.length < filtered.length);

	function groupWords(group: HomophoneGroup) {
		return expandedGroups.includes(group.r) ? group.w : group.w.slice(0, groupPreviewSize);
	}

	function toggleGroup(reading: string) {
		expandedGroups = expandedGroups.includes(reading)
			? expandedGroups.filter((item) => item !== reading)
			: [...expandedGroups, reading];
	}

	$effect(() => {
		searchQuery; minGroupSize; mode;
		pageNum = 0;
		expandedGroups = [];
	});
</script>

<Header currentWord="" />

<main id="main-content" class="page learner-page">
	<div class="learner-intro">
		<h1>Chinese Homophones</h1>
		<p class="subtitle">Compare words and characters that share a Mandarin pronunciation.</p>
	</div>

	<div class="mode-toggle" role="tablist" aria-label="Homophone data">
		<button class="mode-btn" class:active={mode === 'words'} role="tab" aria-selected={mode === 'words'} onclick={() => mode = 'words'}>
			Words <span class="mode-count">{wordData.length}</span>
		</button>
		<button class="mode-btn" class:active={mode === 'characters'} role="tab" aria-selected={mode === 'characters'} onclick={() => mode = 'characters'}>
			Characters <span class="mode-count">{charData.length}</span>
		</button>
	</div>

	<div class="filters">
		<input type="search" class="search-input" aria-label="Search Chinese homophones" placeholder="Search by pinyin, hanzi, or meaning…" bind:value={searchQuery} />
		<div class="filter-row">
			<label class="filter-item">
				<span class="filter-label">Min group</span>
				<select bind:value={minGroupSize} class="filter-select">
					<option value={2}>2+</option><option value={3}>3+</option><option value={5}>5+</option><option value={10}>10+</option>
				</select>
			</label>
			<span class="result-count">{filtered.length} groups</span>
		</div>
	</div>

	{#if loading}
		<p class="status" role="status">Loading homophones…</p>
	{:else if filtered.length === 0}
		<p class="status">No homophones match your filters.</p>
	{:else}
		<div class="groups">
			{#each displayed as group (group.r)}
				<div class="group-card">
					<div class="group-header">
						<span class="group-reading">{group.p || group.r}</span>
						<span class="group-count">{group.w.length} words</span>
					</div>
					<Notes character={`zh:${group.r}`} compact />
					<div class="group-words">
						{#each groupWords(group) as word}
							<a href="/{word.w}" class="word-entry">
								<span class="word-kanji">{word.w}</span>
								{#if word.p}<span class="word-pinyin">[{word.p}]</span>{/if}
								<span class="word-gloss">{word.g.join('; ')}</span>
							</a>
						{/each}
					</div>
					{#if group.w.length > groupPreviewSize}
						<button class="group-expand" aria-expanded={expandedGroups.includes(group.r)} onclick={() => toggleGroup(group.r)}>
							{expandedGroups.includes(group.r) ? 'Show fewer words' : `Show all ${group.w.length} words`}
						</button>
					{/if}
				</div>
			{/each}
		</div>
		{#if hasMore}
			<button class="load-more" onclick={() => pageNum++}>Load more ({filtered.length - displayed.length} remaining)</button>
		{/if}
	{/if}
</main>

<style>
	.page { max-width: var(--content-standard); }
	h1 { font-size: var(--font-size-title); font-weight: 700; color: var(--text-primary); margin: 0; }
	.subtitle { font-size: var(--font-size-body); color: var(--text-secondary); margin: var(--spacing-xs) 0 0; }
	.mode-toggle { display: flex; gap: var(--spacing-sm); margin-bottom: var(--spacing-lg); }
	.mode-btn { min-height: 44px; padding: var(--spacing-sm) var(--spacing-xl); border: 1px solid var(--border-color); border-radius: var(--radius-full); background: var(--bg-secondary); color: var(--text-secondary); font-size: var(--font-size-body); cursor: pointer; transition: border-color 0.15s, background 0.15s, color 0.15s; }
	.mode-btn.active { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }
	.mode-count { font-size: var(--font-size-caption1); color: var(--text-muted); margin-left: var(--spacing-xs); }
	.filters { margin-bottom: var(--spacing-xl); display: flex; flex-direction: column; gap: var(--spacing-sm); }
	.filter-row { display: flex; gap: var(--spacing-md); align-items: center; flex-wrap: wrap; }
	.search-input { width: 100%; min-height: 48px; padding: var(--spacing-md); border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-tertiary); color: var(--text-primary); font-size: var(--font-size-body); font-family: inherit; }
	.search-input:focus { outline: none; border-color: var(--accent); }
	.filter-item { display: flex; align-items: center; gap: var(--spacing-xs); }
	.filter-label { font-size: var(--font-size-caption1); color: var(--text-secondary); }
	.filter-select { min-height: 44px; padding: var(--spacing-sm) var(--spacing-md); border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-secondary); color: var(--text-primary); font-size: var(--font-size-callout); }
	.result-count { font-size: var(--font-size-caption1); color: var(--text-muted); margin-left: auto; }
	.status { text-align: center; padding: 40px; color: var(--text-secondary); }
	.groups { display: flex; flex-direction: column; gap: var(--spacing-md); }
	.group-card { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden; }
	.group-header { display: flex; justify-content: space-between; align-items: center; padding: var(--spacing-md) var(--spacing-lg); border-bottom: 1px solid var(--border-color); background: var(--bg-tertiary); }
	.group-reading { font-size: var(--font-size-headline); font-weight: 600; color: var(--color-pinyin); }
	.group-count { font-size: var(--font-size-caption1); color: var(--text-muted); }
	.group-words { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1px; background: var(--border-color); }
	.word-entry { display: flex; min-height: 68px; flex-direction: column; padding: var(--spacing-md) var(--spacing-lg); background: var(--bg-secondary); text-decoration: none; transition: background 0.15s; }
	.word-entry:hover { background: var(--bg-tertiary); }
	.word-kanji { font-size: var(--font-size-headline); font-weight: 600; color: var(--text-primary); font-family: var(--font-cjk); }
	.word-pinyin { font-size: var(--font-size-caption1); color: var(--color-pinyin); }
	.word-gloss { font-size: var(--font-size-callout); color: var(--text-secondary); margin-top: 2px; line-height: 1.4; }
	.group-expand { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 44px; padding: var(--spacing-sm) var(--spacing-md); border: 0; border-top: 1px solid var(--border-color); background: var(--bg-tertiary); color: var(--accent); font: inherit; font-weight: 600; cursor: pointer; }
	.group-expand:hover { background: var(--accent-light); }
	.load-more { display: block; width: 100%; padding: var(--spacing-lg); margin-top: var(--spacing-lg); border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-secondary); color: var(--accent); font-size: var(--font-size-body); cursor: pointer; }
	.load-more:hover { background: var(--bg-tertiary); }
	@media (max-width: 640px) { .group-words { grid-template-columns: 1fr; } }
</style>
