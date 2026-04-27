<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import Notes from '$lib/components/Notes.svelte';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	interface HomophoneWord {
		w: string; // hanja character
		h: string; // hangul reading
		g: string[]; // English meanings
		c: number;
	}

	interface HomophoneGroup {
		r: string; // hangul reading
		w: HomophoneWord[];
	}

	let data = $state<HomophoneGroup[]>([]);
	let loading = $state(true);
	let searchQuery = $state('');
	let minGroupSize = $state(2);
	let initialized = $state(false);

	onMount(async () => {
		const params = $page.url.searchParams;
		if (params.get('q')) searchQuery = params.get('q')!;
		if (params.get('min')) minGroupSize = parseInt(params.get('min')!) || 2;

		const resp = await fetch('/homophones_kr_words.json');
		data = await resp.json();
		loading = false;
		setTimeout(() => { initialized = true; }, 100);
	});

	let urlTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		if (!initialized) return;
		const q = searchQuery; const min = minGroupSize;
		if (urlTimer) clearTimeout(urlTimer);
		urlTimer = setTimeout(() => {
			const params = new URLSearchParams();
			if (q) params.set('q', q);
			if (min !== 2) params.set('min', String(min));
			const qs = params.toString();
			const target = qs ? `${$page.url.pathname}?${qs}` : $page.url.pathname;
			if (target !== $page.url.pathname + $page.url.search) history.replaceState(null, '', target);
		}, 300);
	});

	let filtered = $derived.by(() => {
		let result = data;
		if (searchQuery.trim()) {
			const q = searchQuery.trim().toLowerCase();
			result = result.filter(g => {
				if (g.r.includes(q)) return true;
				if (g.w.some(w => w.w.includes(q))) return true;
				if (g.w.some(w => w.g.some(gl => gl.toLowerCase().includes(q)))) return true;
				return false;
			});
		}
		return result.filter(g => g.w.length >= minGroupSize);
	});

	let pageNum = $state(0);
	let displayed = $derived(filtered.slice(0, (pageNum + 1) * 50));
	let hasMore = $derived(displayed.length < filtered.length);
	$effect(() => { searchQuery; minGroupSize; pageNum = 0; });
</script>

<svelte:head>
	<title>Korean Homophones (Hanja) - Kiokun</title>
</svelte:head>

<Header currentWord="" />

<div class="page">
	<h1>Korean Homophones</h1>
	<p class="subtitle">Hanja characters that share the same hangul reading</p>

	<div class="filters">
		<input type="text" class="search-input" placeholder="Search by hangul, hanja, or meaning..." bind:value={searchQuery} />
		<div class="filter-row">
			<label class="filter-item">
				<span class="filter-label">Min group</span>
				<select bind:value={minGroupSize} class="filter-select">
					<option value={2}>2+</option><option value={5}>5+</option><option value={10}>10+</option><option value={20}>20+</option><option value={50}>50+</option>
				</select>
			</label>
			<span class="result-count">{filtered.length} groups</span>
		</div>
	</div>

	{#if loading}
		<p class="status">Loading homophones...</p>
	{:else if filtered.length === 0}
		<p class="status">No homophones match your filters.</p>
	{:else}
		<div class="groups">
			{#each displayed as group (group.r)}
				<div class="group-card">
					<div class="group-header">
						<span class="group-reading">{group.r}</span>
						<span class="group-count">{group.w.length} characters</span>
					</div>
					<Notes character={`ko:${group.r}`} compact />
					<div class="group-words">
						{#each group.w as word}
							<a href="/{word.w}" class="word-entry" lang="ko">
								<span class="word-hanja">{word.w}</span>
								{#if word.g.length > 0}
									<span class="word-gloss">{word.g.join('; ')}</span>
								{/if}
							</a>
						{/each}
					</div>
				</div>
			{/each}
		</div>
		{#if hasMore}
			<button class="load-more" onclick={() => pageNum++}>Load more ({filtered.length - displayed.length} remaining)</button>
		{/if}
	{/if}
</div>

<style>
	.page { max-width: 960px; margin: 0 auto; padding: var(--spacing-xl); }
	h1 { font-size: var(--font-size-title); font-weight: 700; color: var(--text-primary); margin: 0; }
	.subtitle { font-size: var(--font-size-body); color: var(--text-secondary); margin: var(--spacing-xs) 0 var(--spacing-xl); }
	.filters { margin-bottom: var(--spacing-xl); display: flex; flex-direction: column; gap: var(--spacing-sm); }
	.filter-row { display: flex; gap: var(--spacing-md); align-items: center; flex-wrap: wrap; }
	.search-input { width: 100%; padding: var(--spacing-md); border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-tertiary); color: var(--text-primary); font-size: var(--font-size-body); font-family: inherit; }
	.search-input:focus { outline: none; border-color: var(--accent); }
	.filter-item { display: flex; align-items: center; gap: var(--spacing-xs); }
	.filter-label { font-size: var(--font-size-caption1); color: var(--text-secondary); }
	.filter-select { padding: var(--spacing-sm) var(--spacing-md); border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-secondary); color: var(--text-primary); font-size: var(--font-size-callout); }
	.result-count { font-size: var(--font-size-caption1); color: var(--text-muted); margin-left: auto; }
	.status { text-align: center; padding: 40px; color: var(--text-secondary); }
	.groups { display: flex; flex-direction: column; gap: var(--spacing-md); }
	.group-card { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden; }
	.group-header { display: flex; justify-content: space-between; align-items: center; padding: var(--spacing-md) var(--spacing-lg); border-bottom: 1px solid var(--border-color); background: var(--bg-tertiary); }
	.group-reading { font-size: var(--font-size-headline); font-weight: 600; color: var(--color-korean); font-family: var(--font-cjk); }
	.group-count { font-size: var(--font-size-caption1); color: var(--text-muted); }
	.group-words { display: flex; flex-wrap: wrap; gap: 1px; background: var(--border-color); }
	.word-entry { display: flex; flex-direction: column; align-items: center; padding: var(--spacing-md); background: var(--bg-secondary); text-decoration: none; transition: background 0.15s; min-width: 70px; }
	.word-entry:hover { background: var(--bg-tertiary); }
	.word-hanja { font-size: 28px; font-weight: 600; color: var(--text-primary); font-family: var(--font-cjk); }
	.word-gloss { font-size: 10px; color: var(--text-muted); text-align: center; margin-top: 2px; max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.load-more { display: block; width: 100%; padding: var(--spacing-lg); margin-top: var(--spacing-lg); border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-secondary); color: var(--accent); font-size: var(--font-size-body); cursor: pointer; }
	.load-more:hover { background: var(--bg-tertiary); }
	@media (max-width: 640px) { .word-entry { min-width: 55px; padding: var(--spacing-sm); } .word-hanja { font-size: 22px; } }
</style>
