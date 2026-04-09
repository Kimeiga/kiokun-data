<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import SectionHeading from './shared/SectionHeading.svelte';
	import { getDictionaryUrl } from '$lib/shard-utils';
	import { dev } from '$app/environment';

	interface Props {
		word: string;
	}

	let { word }: Props = $props();

	interface Sentence {
		simp: string;
		trad: string;
		en: string;
		py: string;
		words?: string[]; // jieba-segmented words (generated client-side)
	}

	let sentences = $state<Sentence[]>([]);
	let loading = $state(false);
	let loaded = $state(false);
	let showTraditional = $state(false);

	// Dictionary panel
	let selectedWord = $state<string | null>(null);
	let panelOpen = $state(false);
	let panelData = $state<any>(null);
	let panelLoading = $state(false);

	function simpleHash(str: string): number {
		let h = 0;
		for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
		return h;
	}

	onMount(async () => {
		if (!word) return;
		loading = true;

		try {
			const indexShard = (simpleHash(word) & 0xFF).toString(16).padStart(2, '0');
			const indexResp = await fetch(`/zh_sentences/idx/${indexShard}.json`);
			if (!indexResp.ok) { loaded = true; loading = false; return; }

			const index = await indexResp.json();
			const refs = index[word];
			if (!refs || refs.length === 0) { loaded = true; loading = false; return; }

			const shardGroups: Record<number, number[]> = {};
			for (const [shardNum, idx] of refs) {
				if (!shardGroups[shardNum]) shardGroups[shardNum] = [];
				shardGroups[shardNum].push(idx);
			}

			const results: Sentence[] = [];
			for (const [shardNum, indices] of Object.entries(shardGroups)) {
				const shardResp = await fetch(`/zh_sentences/${parseInt(shardNum).toString(16)}.json`);
				if (!shardResp.ok) continue;
				const shardData = await shardResp.json();
				for (const idx of indices) {
					if (shardData[idx]) {
						const [simp, trad, en, py] = shardData[idx];
						results.push({ simp, trad, en, py });
					}
				}
			}

			// Segment sentences into clickable words using Intl.Segmenter
			for (const s of results) {
				try {
					const text = showTraditional ? s.trad : s.simp;
					const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });
					s.words = [...segmenter.segment(s.simp)].map(seg => seg.segment);
				} catch {
					s.words = s.simp.split('');
				}
			}

			sentences = results;
		} catch {
			// ignore
		} finally {
			loading = false;
			loaded = true;
		}
	});

	async function fetchDictEntry(w: string): Promise<any> {
		try {
			const url = await getDictionaryUrl(w, dev, fetch);
			const resp = await fetch(url);
			if (!resp.ok) return null;
			const { inflateSync } = await import('fflate');
			const data = JSON.parse(new TextDecoder().decode(inflateSync(new Uint8Array(await resp.arrayBuffer()))));
			return data.redirect ? fetchDictEntry(data.redirect) : data;
		} catch { return null; }
	}

	async function openPanel(w: string) {
		selectedWord = w;
		panelOpen = true;
		panelData = null;
		panelLoading = true;

		try {
			panelData = await fetchDictEntry(w);
			// Try compound splitting if not found
			if (!panelData && w.length >= 4) {
				for (let i = 2; i < w.length - 1; i++) {
					const [l, r] = await Promise.all([fetchDictEntry(w.slice(0, i)), fetchDictEntry(w.slice(i))]);
					if (l && r) {
						selectedWord = w.slice(0, i) + ' + ' + w.slice(i);
						panelData = { _compound: true, left: l, right: r, leftWord: w.slice(0, i), rightWord: w.slice(i) };
						break;
					}
				}
			}
		} catch { panelData = null; }
		finally { panelLoading = false; }
	}

	function closePanel() { panelOpen = false; selectedWord = null; panelData = null; }
	function navigateToWord() {
		if (selectedWord) {
			const w = selectedWord.includes(' + ') ? selectedWord.split(' + ')[0] : selectedWord;
			goto(`/${w}`);
		}
	}

	function isContentWord(w: string): boolean {
		return w.trim().length > 0 && !/^[.,;:!?。、！？「」『』（）\s]+$/.test(w);
	}
</script>

{#if loaded && sentences.length > 0}
	<div class="zh-examples" class:panel-open={panelOpen}>
		<div class="examples-main">
			<div class="section-row">
				<SectionHeading id="zh-examples">🇨🇳 Example Sentences</SectionHeading>
				<button class="script-toggle" onclick={() => showTraditional = !showTraditional}>
					{showTraditional ? '繁體' : '简体'}
				</button>
			</div>
			<div class="example-list">
				{#each sentences as s}
					<div class="example-item">
						<div class="example-zh" lang={showTraditional ? 'zh-Hant' : 'zh-Hans'}>
							{#if s.words}
								{#each s.words as w}
									{#if isContentWord(w)}
										<button
											class="word-token"
											class:selected={selectedWord === w}
											onclick={() => openPanel(w)}
										>{showTraditional ? w : w}</button>
									{:else}
										<span>{w}</span>
									{/if}
								{/each}
							{:else}
								{showTraditional ? s.trad : s.simp}
							{/if}
						</div>
						<div class="example-py">{s.py}</div>
						<div class="example-en">{s.en}</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Dictionary Panel -->
		{#if panelOpen}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="panel-overlay" onclick={closePanel}></div>
			<div class="dictionary-panel">
				<div class="panel-header">
					<h3 class="panel-word">{selectedWord}</h3>
					<div class="panel-actions">
						<button class="panel-open-btn" onclick={navigateToWord}>Open →</button>
						<button class="panel-close-btn" onclick={closePanel}>×</button>
					</div>
				</div>
				<div class="panel-body">
					{#if panelLoading}
						<p class="panel-status">Loading...</p>
					{:else if panelData?._compound}
						{#each [{ word: panelData.leftWord, data: panelData.left }, { word: panelData.rightWord, data: panelData.right }] as part}
							<div class="compound-part">
								<h4 class="compound-word">{part.word}</h4>
								{#if part.data.chinese_words?.length > 0}
									{#each part.data.chinese_words[0].items?.slice(0, 1) || [] as item}
										{#if item.pinyin}<span class="panel-pinyin">{item.pinyin}</span>{/if}
										<ol class="panel-defs">{#each item.definitions?.slice(0, 3) || [] as def}<li>{def}</li>{/each}</ol>
									{/each}
								{/if}
							</div>
						{/each}
					{:else if panelData}
						{#if panelData.chinese_words?.length > 0}
							{#each panelData.chinese_words as cw}
								{#each cw.items || [] as item}
									{#if item.definitions?.length}
										<div class="panel-sense">
											{#if item.pinyin}<span class="panel-pinyin">{item.pinyin}</span>{/if}
											<ol class="panel-defs">{#each item.definitions as def}<li>{def}</li>{/each}</ol>
										</div>
									{/if}
								{/each}
							{/each}
						{/if}
						{#if panelData.japanese_words?.length > 0}
							<div class="panel-divider"></div>
							{#each panelData.japanese_words.slice(0, 2) as jw}
								{#if jw.kana?.length > 0}
									<div class="panel-reading">{jw.kana.map((k: any) => k.text).join(', ')}</div>
								{/if}
								{#each jw.sense?.slice(0, 2) || [] as sense}
									<div class="panel-sense">
										<ol class="panel-defs">{#each sense.gloss || [] as gloss}<li>{gloss.text}</li>{/each}</ol>
									</div>
								{/each}
							{/each}
						{/if}
					{:else}
						<p class="panel-status">No entry found for "{selectedWord}"</p>
						<p class="panel-hint"><button class="link-btn" onclick={navigateToWord}>Search for it</button></p>
					{/if}
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.zh-examples { margin-top: var(--spacing-lg); position: relative; }

	@media (min-width: 769px) {
		.zh-examples.panel-open { display: grid; grid-template-columns: 1fr 340px; gap: var(--spacing-lg); }
		.zh-examples.panel-open .panel-overlay { display: none; }
	}

	.examples-main { min-width: 0; }

	.section-row { display: flex; align-items: center; justify-content: space-between; }

	.script-toggle {
		padding: 4px 12px; border: 1px solid var(--border-color); border-radius: var(--radius-full);
		background: var(--bg-secondary); color: var(--text-secondary);
		font-size: var(--font-size-caption1); font-family: var(--font-cjk); cursor: pointer;
	}
	.script-toggle:hover { border-color: var(--accent); color: var(--accent); }

	.example-list { display: flex; flex-direction: column; gap: var(--spacing-md); }
	.example-item {
		padding: var(--spacing-md); background: var(--bg-secondary);
		border: 1px solid var(--border-color); border-radius: var(--radius-md);
	}
	.example-zh { font-size: var(--font-size-headline); font-family: var(--font-cjk); color: var(--text-primary); line-height: 1.8; }
	.example-py { font-size: var(--font-size-caption1); color: var(--color-pinyin); margin-top: 2px; }
	.example-en { font-size: var(--font-size-callout); color: var(--text-secondary); margin-top: var(--spacing-xs); }

	.word-token {
		display: inline; background: none; border: none;
		border-bottom: 2px solid transparent; padding: 0 1px; margin: 0;
		font: inherit; color: inherit; cursor: pointer; transition: border-color 0.15s, color 0.15s;
	}
	.word-token:hover { border-bottom-color: var(--accent); color: var(--accent); }
	.word-token.selected { border-bottom-color: var(--accent); color: var(--accent); background: var(--accent-light); }

	/* Panel */
	.panel-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 200; }
	.dictionary-panel {
		background: var(--bg-secondary); border: 1px solid var(--border-color);
		z-index: 201; display: flex; flex-direction: column; overflow: hidden;
	}
	@media (min-width: 769px) {
		.dictionary-panel { border-radius: var(--radius-lg); position: sticky; top: 80px; max-height: calc(100vh - 100px); }
	}
	@media (max-width: 768px) {
		.dictionary-panel {
			position: fixed; bottom: 0; left: 0; right: 0; max-height: 60vh;
			border-radius: var(--radius-lg) var(--radius-lg) 0 0; box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
		}
	}
	.panel-header { display: flex; justify-content: space-between; align-items: center; padding: var(--spacing-lg); border-bottom: 1px solid var(--border-color); flex-shrink: 0; }
	.panel-word { font-size: var(--font-size-title); font-weight: 700; color: var(--text-primary); margin: 0; font-family: var(--font-cjk); }
	.panel-actions { display: flex; gap: var(--spacing-sm); align-items: center; }
	.panel-open-btn { padding: var(--spacing-xs) var(--spacing-md); border: 1px solid var(--accent); border-radius: var(--radius-md); background: transparent; color: var(--accent); font-size: var(--font-size-caption1); cursor: pointer; }
	.panel-open-btn:hover { background: var(--accent-light); }
	.panel-close-btn { width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-secondary); font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
	.panel-body { padding: var(--spacing-lg); overflow-y: auto; flex: 1; }
	.panel-status { color: var(--text-muted); font-size: var(--font-size-callout); }
	.panel-reading { font-size: var(--font-size-body); color: var(--accent); margin-bottom: var(--spacing-sm); }
	.panel-pinyin { font-size: var(--font-size-callout); color: var(--color-pinyin); display: block; margin-bottom: var(--spacing-xs); }
	.panel-sense { margin-bottom: var(--spacing-md); }
	.panel-defs { margin: 0; padding-left: var(--spacing-xl); font-size: var(--font-size-body); color: var(--text-primary); line-height: 1.6; }
	.panel-divider { border-top: 1px solid var(--border-color); margin: var(--spacing-md) 0; }
	.panel-hint { font-size: var(--font-size-caption1); color: var(--text-muted); }
	.link-btn { background: none; border: none; color: var(--accent); cursor: pointer; font: inherit; text-decoration: underline; padding: 0; }
	.compound-part { padding-bottom: var(--spacing-md); margin-bottom: var(--spacing-md); border-bottom: 1px solid var(--border-color); }
	.compound-part:last-child { border-bottom: none; }
	.compound-word { font-size: var(--font-size-headline); font-family: var(--font-cjk); color: var(--accent); margin: 0 0 var(--spacing-xs); font-weight: 600; }
</style>
