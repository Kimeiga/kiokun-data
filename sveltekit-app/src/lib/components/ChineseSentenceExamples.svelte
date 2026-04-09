<script lang="ts">
	import { onMount } from 'svelte';
	import SectionHeading from './shared/SectionHeading.svelte';

	interface Props {
		word: string;
	}

	let { word }: Props = $props();

	interface Sentence {
		simp: string;
		trad: string;
		en: string;
		py: string;
	}

	let sentences = $state<Sentence[]>([]);
	let loading = $state(false);
	let loaded = $state(false);
	let showTraditional = $state(false);

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

			sentences = results;
		} catch {
			// ignore
		} finally {
			loading = false;
			loaded = true;
		}
	});
</script>

{#if loaded && sentences.length > 0}
	<div class="zh-examples">
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
						{showTraditional ? s.trad : s.simp}
					</div>
					<div class="example-py">{s.py}</div>
					<div class="example-en">{s.en}</div>
				</div>
			{/each}
		</div>
	</div>
{/if}

<style>
	.zh-examples { margin-top: var(--spacing-lg); }

	.section-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.script-toggle {
		padding: 4px 12px;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-full);
		background: var(--bg-secondary);
		color: var(--text-secondary);
		font-size: var(--font-size-caption1);
		font-family: var(--font-cjk);
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
	}
	.script-toggle:hover { border-color: var(--accent); color: var(--accent); }

	.example-list { display: flex; flex-direction: column; gap: var(--spacing-md); }

	.example-item {
		padding: var(--spacing-md);
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
	}

	.example-zh {
		font-size: var(--font-size-headline);
		font-family: var(--font-cjk);
		color: var(--text-primary);
		line-height: 1.6;
	}

	.example-py {
		font-size: var(--font-size-caption1);
		color: var(--color-pinyin);
		margin-top: 2px;
	}

	.example-en {
		font-size: var(--font-size-callout);
		color: var(--text-secondary);
		margin-top: var(--spacing-xs);
	}
</style>
