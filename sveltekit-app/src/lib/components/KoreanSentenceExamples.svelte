<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import SectionHeading from './shared/SectionHeading.svelte';
	import { getDictionaryUrl } from '$lib/shard-utils';
	import { dev } from '$app/environment';

	interface Props {
		word: string;
		containedInKorean?: string[]; // Korean words containing this character (for hanja lookup)
	}
	let { word, containedInKorean = [] }: Props = $props();

	interface Sentence { kr: string; en: string; }

	let sentences = $state<Sentence[]>([]);
	let loaded = $state(false);
	let selectedWord = $state<string | null>(null);
	let panelOpen = $state(false);
	let panelData = $state<any>(null);
	let panelLoading = $state(false);

	function simpleHash(str: string): number {
		let h = 0;
		for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
		return h;
	}

	// Look up sentence refs for a single word from the index
	async function lookupWord(w: string): Promise<Array<[number, number]>> {
		const shard = (simpleHash(w) & 0xFF).toString(16).padStart(2, '0');
		try {
			const resp = await fetch(`/kr_sentences/idx/${shard}.json`);
			if (!resp.ok) return [];
			const index = await resp.json();
			return index[w] || [];
		} catch { return []; }
	}

	// Fetch actual sentences from shard files given ref tuples [shardNum, sentenceIdx]
	async function fetchSentences(allRefs: Array<[number, number]>): Promise<Sentence[]> {
		// Group by shard
		const shardGroups: Record<number, number[]> = {};
		for (const [sn, si] of allRefs) {
			if (!shardGroups[sn]) shardGroups[sn] = [];
			shardGroups[sn].push(si);
		}
		const results: Sentence[] = [];
		const seen = new Set<string>(); // deduplicate
		for (const [sn, indices] of Object.entries(shardGroups)) {
			const r = await fetch(`/kr_sentences/${parseInt(sn).toString(16)}.json`);
			if (!r.ok) continue;
			const d = await r.json();
			for (const idx of indices) {
				if (d[idx]) {
					const key = d[idx][0];
					if (!seen.has(key)) {
						seen.add(key);
						results.push({ kr: d[idx][0], en: d[idx][1] });
					}
				}
			}
		}
		return results;
	}

	onMount(async () => {
		if (!word) return;
		try {
			// Direct lookup by the word itself
			let allRefs = await lookupWord(word);

			// If no direct results and we have contained Korean words, search those
			if (allRefs.length === 0 && containedInKorean.length > 0) {
				// Search up to 30 contained words (most common/frequent first) to limit requests
				const wordsToSearch = containedInKorean.slice(0, 30);
				// Batch: group by index shard to minimize fetches
				const shardCache: Record<string, Record<string, Array<[number, number]>>> = {};
				for (const kw of wordsToSearch) {
					const shard = (simpleHash(kw) & 0xFF).toString(16).padStart(2, '0');
					if (!shardCache[shard]) {
						try {
							const resp = await fetch(`/kr_sentences/idx/${shard}.json`);
							shardCache[shard] = resp.ok ? await resp.json() : {};
						} catch { shardCache[shard] = {}; }
					}
					const refs = shardCache[shard][kw];
					if (refs?.length) {
						allRefs.push(...refs);
					}
				}
			}

			if (allRefs.length === 0) { loaded = true; return; }

			sentences = await fetchSentences(allRefs);
		} catch {}
		finally { loaded = true; }
	});

	async function openPanel(w: string) {
		selectedWord = w;
		panelOpen = true;
		panelData = null;
		panelLoading = true;
		try {
			const url = await getDictionaryUrl(w, dev, fetch);
			const resp = await fetch(url);
			if (resp.ok) {
				const { inflateSync } = await import('fflate');
				panelData = JSON.parse(new TextDecoder().decode(inflateSync(new Uint8Array(await resp.arrayBuffer()))));
				if (panelData?.redirect) {
					const r2 = await fetch(await getDictionaryUrl(panelData.redirect, dev, fetch));
					if (r2.ok) panelData = JSON.parse(new TextDecoder().decode(inflateSync(new Uint8Array(await r2.arrayBuffer()))));
				}
			}
		} catch {} finally { panelLoading = false; }
	}

	function closePanel() { panelOpen = false; selectedWord = null; }
</script>

{#if loaded && sentences.length > 0}
	<div class="kr-examples" class:panel-open={panelOpen}>
		<div class="examples-main">
			<SectionHeading id="kr-examples">🇰🇷 Sentences ({sentences.length})</SectionHeading>
			<div class="example-list">
				{#each sentences as s}
					<div class="example-item">
						<div class="example-text">
							<span class="lang-tag">🇰🇷</span>
							<span class="source-text" lang="ko">
								{#each s.kr.split(/(\s+)/) as segment}
									{#if segment.trim()}
										<button class="word-token" class:selected={selectedWord === segment.replace(/[.,;:!?]/g, '')} onclick={() => openPanel(segment.replace(/[.,;:!?]/g, ''))}>{segment}</button>
									{:else}
										{segment}
									{/if}
								{/each}
							</span>
						</div>
						<div class="example-translation">{s.en}</div>
					</div>
				{/each}
			</div>
		</div>
		{#if panelOpen}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="panel-overlay" onclick={closePanel}></div>
			<div class="dictionary-panel">
				<div class="panel-header">
					<h3 class="panel-word">{selectedWord}</h3>
					<div class="panel-actions">
						<button class="panel-open-btn" onclick={() => { if(selectedWord) goto(`/${selectedWord}`); }}>Open →</button>
						<button class="panel-close-btn" onclick={closePanel}>×</button>
					</div>
				</div>
				<div class="panel-body">
					{#if panelLoading}
						<p class="ps">Loading...</p>
					{:else if panelData?.korean_words?.length}
						{#each panelData.korean_words.slice(0, 3) as kw}
							{#if kw.hangul}<div class="pr">{kw.hangul}</div>{/if}
							<ol class="pd">{#each kw.definitions || [] as def}<li>{def.text || def}</li>{/each}</ol>
						{/each}
					{:else if panelData?.chinese_words?.length}
						{#each panelData.chinese_words[0].items?.slice(0,2) || [] as item}
							{#if item.pinyin}<span class="pp">{item.pinyin}</span>{/if}
							<ol class="pd">{#each item.definitions?.slice(0,3) || [] as def}<li>{def}</li>{/each}</ol>
						{/each}
					{:else}
						<p class="ps">No entry found</p>
					{/if}
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.kr-examples { margin-top: var(--spacing-lg); position: relative; }
	@media (min-width: 769px) {
		.kr-examples.panel-open { display: grid; grid-template-columns: 1fr 340px; gap: var(--spacing-lg); }
		.kr-examples.panel-open .panel-overlay { display: none; }
	}
	.examples-main { min-width: 0; }
	.example-list { display: flex; flex-direction: column; gap: var(--spacing-sm); }
	.example-item { padding: var(--spacing-sm) var(--spacing-md); background: var(--bg-secondary); border: 1px solid var(--border-light); border-radius: var(--radius-md); }
	.example-text { display: flex; align-items: baseline; gap: var(--spacing-sm); }
	.lang-tag { font-size: var(--font-size-caption2); flex-shrink: 0; }
	.source-text { font-size: var(--font-size-body); font-family: var(--font-cjk); color: var(--text-primary); line-height: 1.6; }
	.example-translation { font-size: var(--font-size-caption1); color: var(--text-tertiary); margin-top: var(--spacing-xs); line-height: 1.4; padding-left: calc(var(--spacing-sm) + 20px); }
	.word-token { display: inline; background: none; border: none; border-bottom: 2px solid transparent; padding: 0 1px; margin: 0; font: inherit; color: inherit; cursor: pointer; transition: border-color 0.15s, color 0.15s; }
	.word-token:hover { border-bottom-color: var(--accent); color: var(--accent); }
	.word-token.selected { border-bottom-color: var(--accent); color: var(--accent); background: var(--accent-light); }
	.panel-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 200; }
	.dictionary-panel { background: var(--bg-secondary); border: 1px solid var(--border-color); z-index: 201; display: flex; flex-direction: column; overflow: hidden; }
	@media (min-width: 769px) { .dictionary-panel { border-radius: var(--radius-lg); position: sticky; top: 80px; max-height: calc(100vh - 100px); } }
	@media (max-width: 768px) { .dictionary-panel { position: fixed; bottom: 0; left: 0; right: 0; max-height: 60vh; border-radius: var(--radius-lg) var(--radius-lg) 0 0; box-shadow: 0 -4px 20px rgba(0,0,0,0.15); } }
	.panel-header { display: flex; justify-content: space-between; align-items: center; padding: var(--spacing-lg); border-bottom: 1px solid var(--border-color); }
	.panel-word { font-size: var(--font-size-title); font-weight: 700; color: var(--text-primary); margin: 0; font-family: var(--font-cjk); }
	.panel-actions { display: flex; gap: var(--spacing-sm); }
	.panel-open-btn { padding: var(--spacing-xs) var(--spacing-md); border: 1px solid var(--accent); border-radius: var(--radius-md); background: transparent; color: var(--accent); font-size: var(--font-size-caption1); cursor: pointer; }
	.panel-close-btn { width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-secondary); font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
	.panel-body { padding: var(--spacing-lg); overflow-y: auto; flex: 1; }
	.ps { color: var(--text-muted); font-size: var(--font-size-callout); }
	.pr { font-size: var(--font-size-body); color: var(--color-korean); margin-bottom: var(--spacing-sm); }
	.pp { font-size: var(--font-size-callout); color: var(--color-pinyin); display: block; margin-bottom: var(--spacing-xs); }
	.pd { margin: 0; padding-left: var(--spacing-xl); font-size: var(--font-size-body); color: var(--text-primary); line-height: 1.6; margin-bottom: var(--spacing-md); }
</style>
