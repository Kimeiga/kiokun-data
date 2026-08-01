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
	const pageSize = 8;
	const groupPreviewSize = 20;
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
		searchQuery; minGroupSize;
		pageNum = 0;
		expandedGroups = [];
	});
</script>

<Header currentWord="" />

<main id="main-content" class="page learner-page">
	<div class="learner-intro">
		<h1>Korean Homophones</h1>
		<p class="subtitle">Compare Hanja that share the same Hangul reading.</p>
	</div>

	<div class="filters">
		<input type="search" class="search-input" aria-label="Search Korean homophones" placeholder="Search by hangul, hanja, or meaning…" bind:value={searchQuery} />
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
		<p class="status" role="status">Loading homophones…</p>
	{:else if filtered.length === 0}
		<p class="status">No homophones match your filters.</p>
	{:else}
		<div class="groups mobile-full-bleed">
			{#each displayed as group (group.r)}
				<div class="group-card">
					<div class="group-header">
						<span class="group-reading">{group.r}</span>
						<span class="group-count">{group.w.length} characters</span>
					</div>
					<Notes character={`ko:${group.r}`} compact />
					<div class="group-words">
						{#each groupWords(group) as word}
							<a href="/{word.w}" class="word-entry" lang="ko">
								<span class="word-hanja">{word.w}</span>
								{#if word.g.length > 0}
									<span class="word-gloss">{word.g.join('; ')}</span>
								{/if}
							</a>
						{/each}
					</div>
					{#if group.w.length > groupPreviewSize}
						<button class="group-expand" aria-expanded={expandedGroups.includes(group.r)} onclick={() => toggleGroup(group.r)}>
							{expandedGroups.includes(group.r) ? 'Show fewer characters' : `Show all ${group.w.length} characters`}
						</button>
					{/if}
				</div>
			{/each}
		</div>
		{#if hasMore}
			<div class="load-more-grid divider-grid mobile-full-bleed">
				<button class="load-more divider-cell" onclick={() => pageNum++}>Load more ({filtered.length - displayed.length} remaining)</button>
			</div>
		{/if}
	{/if}
</main>

<style>
	.page { max-width: var(--content-standard); }
	h1 { font-size: var(--font-size-title); font-weight: 700; color: var(--text-primary); margin: 0; }
	.subtitle { font-size: var(--font-size-body); color: var(--text-secondary); margin: var(--spacing-xs) 0 0; }
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
	.group-reading { font-size: var(--font-size-headline); font-weight: 600; color: var(--color-korean); font-family: var(--font-cjk); }
	.group-count { font-size: var(--font-size-caption1); color: var(--text-muted); }
	.group-words { display: flex; flex-wrap: wrap; gap: 1px; background: transparent; }
	.word-entry { display: flex; min-width: 70px; min-height: 68px; flex-direction: column; align-items: center; justify-content: center; padding: var(--spacing-md); background: var(--bg-secondary); outline: 1px solid var(--border-color); outline-offset: 0; text-decoration: none; transition: background 0.15s; }
	.word-entry:hover { background: var(--bg-tertiary); }
	.word-hanja { font-size: 28px; font-weight: 600; color: var(--text-primary); font-family: var(--font-cjk); }
	.word-gloss { font-size: 10px; color: var(--text-muted); text-align: center; margin-top: 2px; max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.group-expand { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 44px; padding: var(--spacing-sm) var(--spacing-md); border: 0; border-top: 1px solid var(--border-color); background: var(--bg-tertiary); color: var(--accent); font: inherit; font-weight: 600; cursor: pointer; }
	.group-expand:hover { background: var(--accent-light); }
	.load-more { display: block; width: 100%; padding: var(--spacing-lg); margin-top: var(--spacing-lg); border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-secondary); color: var(--accent); font-size: var(--font-size-body); cursor: pointer; }
	.load-more:hover { background: var(--bg-tertiary); }
	.load-more-grid { grid-template-columns: 1fr; margin-top: var(--spacing-lg); }
	.load-more-grid .load-more { margin-top: 0; }
	@media (max-width: 640px) { .word-entry { min-width: 62px; padding: var(--spacing-sm); } .word-hanja { font-size: 22px; } }
</style>
