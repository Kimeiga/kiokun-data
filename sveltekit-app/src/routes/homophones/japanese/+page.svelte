<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import Notes from '$lib/components/Notes.svelte';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	interface HomophoneWord {
		w: string;  // word
		g: string[]; // glosses
		c: number;  // common (1/0)
		p?: string[]; // part of speech
		a?: number; // pitch accent (downstep position, 0 = heiban)
	}

	interface HomophoneGroup {
		r: string;  // reading
		w: HomophoneWord[];
	}

	let mode = $state<'words' | 'characters'>('words');
	let wordData = $state<HomophoneGroup[]>([]);
	let charData = $state<HomophoneGroup[]>([]);
	let loading = $state(true);

	// Filters — initialize from URL params
	let searchQuery = $state('');
	let minGroupSize = $state(2);
	let syllableCount = $state(0);
	let commonOnly = $state(false);

	let initialized = $state(false);

	onMount(async () => {
		const params = $page.url.searchParams;
		if (params.get('q')) searchQuery = params.get('q')!;
		if (params.get('mode') === 'characters') mode = 'characters';
		if (params.get('min')) minGroupSize = parseInt(params.get('min')!) || 2;
		if (params.get('syllables')) syllableCount = parseInt(params.get('syllables')!) || 0;
		if (params.get('common') === '1') commonOnly = true;

		const [wordResp, charResp] = await Promise.all([
			fetch('/homophones_ja_words.json'),
			fetch('/homophones_ja_chars.json'),
		]);
		wordData = await wordResp.json();
		charData = await charResp.json();
		loading = false;
		// Delay URL sync to avoid triggering during initial render
		setTimeout(() => { initialized = true; }, 100);
	});

	// Debounced URL sync — only after initialization, prevents loops
	let urlSyncTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		if (!initialized) return;
		// Read reactive deps
		const q = searchQuery;
		const m = mode;
		const min = minGroupSize;
		const syl = syllableCount;
		const com = commonOnly;

		if (urlSyncTimer) clearTimeout(urlSyncTimer);
		urlSyncTimer = setTimeout(() => {
			const params = new URLSearchParams();
			if (q) params.set('q', q);
			if (m !== 'words') params.set('mode', m);
			if (min !== 2) params.set('min', String(min));
			if (syl > 0) params.set('syllables', String(syl));
			if (com) params.set('common', '1');

			const qs = params.toString();
			const target = qs ? `${$page.url.pathname}?${qs}` : $page.url.pathname;
			const current = $page.url.pathname + $page.url.search;
			if (target !== current) {
				history.replaceState(null, '', target);
			}
		}, 300);
	});

	// Romaji → hiragana conversion for search
	function romajiToHiragana(input: string): string {
		const map: Record<string, string> = {
			'a':'あ','i':'い','u':'う','e':'え','o':'お',
			'ka':'か','ki':'き','ku':'く','ke':'け','ko':'こ',
			'sa':'さ','si':'し','shi':'し','su':'す','se':'せ','so':'そ',
			'ta':'た','ti':'ち','chi':'ち','tu':'つ','tsu':'つ','te':'て','to':'と',
			'na':'な','ni':'に','nu':'ぬ','ne':'ね','no':'の',
			'ha':'は','hi':'ひ','hu':'ふ','fu':'ふ','he':'へ','ho':'ほ',
			'ma':'ま','mi':'み','mu':'む','me':'め','mo':'も',
			'ya':'や','yu':'ゆ','yo':'よ',
			'ra':'ら','ri':'り','ru':'る','re':'れ','ro':'ろ',
			'wa':'わ','wo':'を','n':'ん',
			'ga':'が','gi':'ぎ','gu':'ぐ','ge':'げ','go':'ご',
			'za':'ざ','zi':'じ','ji':'じ','zu':'ず','ze':'ぜ','zo':'ぞ',
			'da':'だ','di':'ぢ','du':'づ','de':'で','do':'ど',
			'ba':'ば','bi':'び','bu':'ぶ','be':'べ','bo':'ぼ',
			'pa':'ぱ','pi':'ぴ','pu':'ぷ','pe':'ぺ','po':'ぽ',
			'kya':'きゃ','kyu':'きゅ','kyo':'きょ',
			'sha':'しゃ','shu':'しゅ','sho':'しょ',
			'cha':'ちゃ','chu':'ちゅ','cho':'ちょ',
			'nya':'にゃ','nyu':'にゅ','nyo':'にょ',
			'hya':'ひゃ','hyu':'ひゅ','hyo':'ひょ',
			'mya':'みゃ','myu':'みゅ','myo':'みょ',
			'rya':'りゃ','ryu':'りゅ','ryo':'りょ',
			'gya':'ぎゃ','gyu':'ぎゅ','gyo':'ぎょ',
			'ja':'じゃ','ju':'じゅ','jo':'じょ',
			'bya':'びゃ','byu':'びゅ','byo':'びょ',
			'pya':'ぴゃ','pyu':'ぴゅ','pyo':'ぴょ',
		};
		let result = '';
		let remaining = input.toLowerCase();
		while (remaining.length > 0) {
			let matched = false;
			for (const len of [3, 2, 1]) {
				const chunk = remaining.slice(0, len);
				if (map[chunk]) {
					result += map[chunk];
					remaining = remaining.slice(len);
					matched = true;
					break;
				}
			}
			if (!matched) {
				result += remaining[0];
				remaining = remaining.slice(1);
			}
		}
		return result;
	}

	function countMorae(reading: string): number {
		let count = 0;
		for (let i = 0; i < reading.length; i++) {
			const c = reading.charCodeAt(i);
			if ('ゃゅょャュョぁぃぅぇぉァィゥェォ'.includes(reading[i])) continue;
			if (reading[i] === 'っ' || reading[i] === 'ッ') { count++; continue; }
			if ((c >= 0x3040 && c <= 0x309F) || (c >= 0x30A0 && c <= 0x30FF)) count++;
		}
		return count;
	}

	// Render pitch accent as visual pattern
	// accent=0: heiban (flat, rises after first mora and stays high)
	// accent=1: atamadaka (high first, drops after first mora)
	// accent=N: nakadaka/odaka (drops after Nth mora)
	function renderPitchPattern(reading: string, accent: number): { char: string; high: boolean }[] {
		const morae: string[] = [];
		for (let i = 0; i < reading.length; i++) {
			const next = reading[i + 1];
			if (next && 'ゃゅょャュョ'.includes(next)) {
				morae.push(reading[i] + next);
				i++;
			} else {
				morae.push(reading[i]);
			}
		}

		return morae.map((char, i) => {
			let high: boolean;
			if (accent === 0) {
				// Heiban: low-high-high-high...
				high = i > 0;
			} else if (accent === 1) {
				// Atamadaka: high-low-low-low...
				high = i === 0;
			} else {
				// Nakadaka/Odaka: low-high-...-high-low-low
				high = i > 0 && i < accent;
			}
			return { char, high };
		});
	}

	function pitchLabel(accent: number, moraCount: number): string {
		if (accent === 0) return '平板';  // heiban
		if (accent === 1) return '頭高';  // atamadaka
		if (accent === moraCount) return '尾高'; // odaka
		return '中高'; // nakadaka
	}

	let data = $derived(mode === 'words' ? wordData : charData);

	let filtered = $derived.by(() => {
		let result = data;

		if (searchQuery.trim()) {
			const q = searchQuery.trim().toLowerCase();
			const hiraganaQ = romajiToHiragana(q);
			const isLatin = /^[a-z]+$/i.test(q);

			result = result.filter(g => {
				if (g.r.includes(isLatin ? hiraganaQ : q)) return true;
				if (g.w.some(w => w.w.includes(q))) return true;
				if (g.w.some(w => w.g.some(gl => gl.toLowerCase().includes(q)))) return true;
				return false;
			});
		}

		result = result.filter(g => g.w.length >= minGroupSize);

		if (syllableCount > 0) {
			result = result.filter(g => countMorae(g.r) === syllableCount);
		}

		if (commonOnly) {
			result = result.filter(g => g.w.some(w => w.c));
		}

		return result;
	});

	let pageNum = $state(0);
	const pageSize = 50;
	let displayed = $derived(filtered.slice(0, (pageNum + 1) * pageSize));
	let hasMore = $derived(displayed.length < filtered.length);

	$effect(() => {
		searchQuery; minGroupSize; syllableCount; commonOnly; mode;
		pageNum = 0;
	});
</script>

<svelte:head>
	<title>Japanese Homophones - Kiokun</title>
	<meta name="description" content="Browse Japanese homophones — words that sound the same but have different meanings and kanji. Includes pitch accent patterns." />
</svelte:head>

<Header currentWord="" />

<div class="page">
	<h1>Japanese Homophones</h1>
	<p class="subtitle">Words that sound the same but have different meanings</p>

	<!-- Mode Toggle -->
	<div class="mode-toggle">
		<button class="mode-btn" class:active={mode === 'words'} onclick={() => mode = 'words'}>
			Words <span class="mode-count">{wordData.length}</span>
		</button>
		<button class="mode-btn" class:active={mode === 'characters'} onclick={() => mode = 'characters'}>
			Characters <span class="mode-count">{charData.length}</span>
		</button>
	</div>

	<!-- Filters -->
	<div class="filters">
		<div class="filter-row">
			<input
				type="text"
				class="search-input"
				placeholder="Search by reading, kanji, romaji, or meaning..."
				bind:value={searchQuery}
			/>
		</div>
		<div class="filter-row">
			<label class="filter-item">
				<span class="filter-label">Min group</span>
				<select bind:value={minGroupSize} class="filter-select">
					<option value={2}>2+</option>
					<option value={3}>3+</option>
					<option value={5}>5+</option>
					<option value={10}>10+</option>
				</select>
			</label>
			<label class="filter-item">
				<span class="filter-label">Syllables</span>
				<select bind:value={syllableCount} class="filter-select">
					<option value={0}>Any</option>
					{#each [1,2,3,4,5,6] as n}
						<option value={n}>{n}</option>
					{/each}
				</select>
			</label>
			<label class="filter-item toggle">
				<input type="checkbox" bind:checked={commonOnly} />
				<span>Common only</span>
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
						<span class="group-count">{group.w.length} words</span>
					</div>
					<Notes character={`ja:${group.r}`} />
					<div class="group-words">
						{#each group.w as word}
							<a href="/{word.w}" class="word-entry" class:common={!!word.c}>
								<div class="word-top">
									<span class="word-kanji">{word.w}</span>
									{#if word.a !== undefined}
										<span class="pitch-badge" title={pitchLabel(word.a, countMorae(group.r)) + ' (accent: ' + word.a + ')'}>
											{#each renderPitchPattern(group.r, word.a) as mora}
												<span class="pitch-mora" class:high={mora.high}>{mora.char}</span>
											{/each}
											<span class="pitch-type">{pitchLabel(word.a, countMorae(group.r))}</span>
										</span>
									{/if}
								</div>
								<span class="word-gloss">{word.g.join('; ')}</span>
							</a>
						{/each}
					</div>
				</div>
			{/each}
		</div>

		{#if hasMore}
			<button class="load-more" onclick={() => pageNum++}>
				Load more ({filtered.length - displayed.length} remaining)
			</button>
		{/if}
	{/if}

	<div class="attribution">
		Pitch accent data from <a href="https://github.com/mifunetoshiro/kanjium" target="_blank" rel="noopener">Kanjium</a> (CC BY-SA 4.0)
	</div>
</div>

<style>
	.page { max-width: 960px; margin: 0 auto; padding: var(--spacing-xl); }
	h1 { font-size: var(--font-size-title); font-weight: 700; color: var(--text-primary); margin: 0; }
	.subtitle { font-size: var(--font-size-body); color: var(--text-secondary); margin: var(--spacing-xs) 0 var(--spacing-xl); }

	.mode-toggle { display: flex; gap: var(--spacing-sm); margin-bottom: var(--spacing-lg); }
	.mode-btn {
		padding: var(--spacing-sm) var(--spacing-xl);
		border: 1px solid var(--border-color); border-radius: var(--radius-full);
		background: var(--bg-secondary); color: var(--text-secondary);
		font-size: var(--font-size-body); cursor: pointer; transition: all 0.15s;
	}
	.mode-btn.active { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }
	.mode-count { font-size: var(--font-size-caption1); color: var(--text-muted); margin-left: var(--spacing-xs); }

	.filters { margin-bottom: var(--spacing-xl); display: flex; flex-direction: column; gap: var(--spacing-sm); }
	.filter-row { display: flex; gap: var(--spacing-md); align-items: center; flex-wrap: wrap; }
	.search-input {
		flex: 1; min-width: 240px; padding: var(--spacing-md);
		border: 1px solid var(--border-color); border-radius: var(--radius-md);
		background: var(--bg-tertiary); color: var(--text-primary);
		font-size: var(--font-size-body); font-family: inherit;
	}
	.search-input:focus { outline: none; border-color: var(--accent); }
	.filter-item { display: flex; align-items: center; gap: var(--spacing-xs); }
	.filter-label { font-size: var(--font-size-caption1); color: var(--text-secondary); }
	.filter-select {
		padding: var(--spacing-sm) var(--spacing-md);
		border: 1px solid var(--border-color); border-radius: var(--radius-md);
		background: var(--bg-secondary); color: var(--text-primary); font-size: var(--font-size-callout);
	}
	.filter-item.toggle { gap: var(--spacing-sm); font-size: var(--font-size-callout); color: var(--text-secondary); cursor: pointer; }
	.filter-item.toggle input { accent-color: var(--accent); }
	.result-count { font-size: var(--font-size-caption1); color: var(--text-muted); margin-left: auto; }

	.status { text-align: center; padding: 40px; color: var(--text-secondary); }

	.groups { display: flex; flex-direction: column; gap: var(--spacing-md); }
	.group-card {
		background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden;
	}
	.group-header {
		display: flex; justify-content: space-between; align-items: center;
		padding: var(--spacing-md) var(--spacing-lg);
		border-bottom: 1px solid var(--border-color); background: var(--bg-tertiary);
	}
	.group-reading { font-size: var(--font-size-headline); font-weight: 600; color: var(--accent); font-family: var(--font-cjk); }
	.group-count { font-size: var(--font-size-caption1); color: var(--text-muted); }

	.group-words {
		display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1px; background: var(--border-color);
	}
	.word-entry {
		display: flex; flex-direction: column; padding: var(--spacing-md) var(--spacing-lg);
		background: var(--bg-secondary); text-decoration: none; transition: background 0.15s;
	}
	.word-entry:hover { background: var(--bg-tertiary); }

	.word-top { display: flex; align-items: baseline; gap: var(--spacing-md); flex-wrap: wrap; }
	.word-kanji { font-size: var(--font-size-headline); font-weight: 600; font-family: var(--font-cjk); }
	.word-entry.common .word-kanji { color: var(--text-primary); }
	.word-entry:not(.common) .word-kanji { color: var(--text-tertiary); }

	/* Pitch accent display */
	.pitch-badge {
		display: inline-flex; align-items: flex-end; gap: 0; margin-left: auto;
		font-size: 11px; line-height: 1;
	}
	.pitch-mora {
		display: inline-block; padding: 1px 1px;
		border-top: 2px solid transparent;
		border-bottom: 2px solid transparent;
		color: var(--text-muted);
		font-family: var(--font-cjk);
		transition: color 0.15s;
	}
	.pitch-mora.high {
		border-top-color: var(--accent);
		border-bottom-color: transparent;
		color: var(--text-secondary);
	}
	.pitch-mora:not(.high) {
		border-bottom-color: var(--text-muted);
		border-top-color: transparent;
	}
	.pitch-type {
		font-size: 9px;
		color: var(--text-muted);
		margin-left: 4px;
		white-space: nowrap;
	}

	.word-gloss {
		font-size: var(--font-size-callout); color: var(--text-secondary); margin-top: 2px; line-height: 1.4;
	}

	.load-more {
		display: block; width: 100%; padding: var(--spacing-lg); margin-top: var(--spacing-lg);
		border: 1px solid var(--border-color); border-radius: var(--radius-md);
		background: var(--bg-secondary); color: var(--accent);
		font-size: var(--font-size-body); cursor: pointer; transition: background 0.15s;
	}
	.load-more:hover { background: var(--bg-tertiary); }

	.attribution {
		margin-top: var(--spacing-xl); padding-top: var(--spacing-lg);
		border-top: 1px solid var(--border-color);
		font-size: var(--font-size-caption1); color: var(--text-muted); text-align: center;
	}
	.attribution a { color: var(--accent); text-decoration: none; }
	.attribution a:hover { text-decoration: underline; }

	@media (max-width: 640px) {
		.group-words { grid-template-columns: 1fr; }
		.filter-row { flex-direction: column; align-items: stretch; }
		.result-count { margin-left: 0; }
	}
</style>
