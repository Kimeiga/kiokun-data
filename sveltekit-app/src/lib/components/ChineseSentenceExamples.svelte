<script lang="ts">
	import { onMount } from 'svelte';

	interface Props { word: string; hasContent?: boolean; }
	let { word, hasContent = $bindable(false) }: Props = $props();

	interface Sentence { simp: string; trad: string; en: string; py: string; }

	let sentences = $state<Sentence[]>([]);
	let loaded = $state(false);
	let showTraditional = $state(false);
	let expanded = $state(false);

	$effect(() => { hasContent = loaded && sentences.length > 0; });

	function simpleHash(str: string): number {
		let h = 0;
		for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
		return h;
	}

	onMount(async () => {
		if (!word) return;
		try {
			const indexShard = (simpleHash(word) & 0xFF).toString(16).padStart(2, '0');
			const indexResp = await fetch(`/zh_sentences/idx/${indexShard}.json`);
			if (!indexResp.ok) { loaded = true; return; }

			const index = await indexResp.json();
			const refs = index[word];
			if (!refs?.length) { loaded = true; return; }

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
			sentences = results;
		} catch {}
		finally { loaded = true; }
	});
</script>

{#if loaded && sentences.length > 0}
	{@const COLLAPSED_COUNT = 4}
	{@const displayed = expanded ? sentences : sentences.slice(0, COLLAPSED_COUNT)}
	{@const hasMoreSentences = sentences.length > COLLAPSED_COUNT}
	<div class="zh-examples">
		<div class="column-header-row">
			<span class="column-header">🇨🇳 ({sentences.length})</span>
			<button class="script-toggle" onclick={() => showTraditional = !showTraditional} title={showTraditional ? 'Traditional Chinese' : 'Simplified Chinese'}>
				{showTraditional ? '🇹🇼' : '🇨🇳'}
			</button>
		</div>
		<div class="example-list">
			{#each displayed as s}
				<a
					class="example-item"
					href="/sentence?text={encodeURIComponent(showTraditional ? s.trad : s.simp)}&lang=zh&en={encodeURIComponent(s.en)}&py={encodeURIComponent(s.py)}&from={encodeURIComponent(word)}"
				>
					<div class="example-text" lang={showTraditional ? 'zh-Hant' : 'zh-Hans'}>
						{showTraditional ? s.trad : s.simp}
					</div>
					<div class="example-sub">{s.py}</div>
					<div class="example-translation">{s.en}</div>
				</a>
			{/each}
		</div>
		{#if hasMoreSentences}
			<button class="toggle-btn" onclick={() => expanded = !expanded}>
				{expanded ? 'Show less' : `Show more (${sentences.length - COLLAPSED_COUNT})`}
			</button>
		{/if}
	</div>
{/if}

<style>
	.zh-examples { position: relative; }
	.column-header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--spacing-sm); }
	.column-header { font-size: var(--font-size-caption1); font-weight: 600; color: var(--text-secondary); }
	.script-toggle {
		padding: var(--spacing-xs) var(--spacing-sm);
		border: 1px solid var(--border-light); border-radius: var(--radius-sm);
		background: var(--bg-tertiary); color: var(--text-muted);
		font-size: var(--font-size-caption1); cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
	}
	.script-toggle:hover { border-color: var(--accent); color: var(--accent); }
	.toggle-btn {
		display: block; width: 100%; padding: var(--spacing-xs); margin-top: var(--spacing-xs);
		background: transparent; border: 1px solid var(--border-light); border-radius: var(--radius-sm);
		color: var(--text-secondary); font-size: var(--font-size-caption2); cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
	}
	.toggle-btn:hover { border-color: var(--accent); color: var(--accent); }
	.example-list { display: flex; flex-direction: column; gap: var(--spacing-xs); }
	.example-item {
		display: block; padding: var(--spacing-xs) var(--spacing-sm);
		background: var(--bg-secondary); border: 1px solid var(--border-light);
		border-radius: var(--radius-md); text-decoration: none; transition: border-color 0.15s;
	}
	.example-item:hover { border-color: var(--accent); }
	.example-text { font-size: var(--font-size-body); font-family: var(--font-cjk); color: var(--text-primary); line-height: 1.6; }
	.example-sub { font-size: var(--font-size-caption2); color: var(--color-pinyin); margin-top: 1px; }
	.example-translation { font-size: var(--font-size-caption1); color: var(--text-tertiary); margin-top: 2px; line-height: 1.4; }
</style>
