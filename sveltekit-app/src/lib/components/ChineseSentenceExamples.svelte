<script lang="ts">
	import { onMount } from 'svelte';
	import SectionHeading from './shared/SectionHeading.svelte';

	interface Props {
		word: string;
	}

	let { word }: Props = $props();

	interface Sentence {
		zh: string;
		en: string;
		py: string;
	}

	let sentences = $state<Sentence[]>([]);
	let loading = $state(false);
	let loaded = $state(false);

	function simpleHash(str: string): number {
		let h = 0;
		for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
		return h;
	}

	onMount(async () => {
		if (!word) return;
		loading = true;

		try {
			// Load index shard for this word
			const indexShard = (simpleHash(word) & 0xFF).toString(16).padStart(2, '0');
			const indexResp = await fetch(`/zh_sentences/idx/${indexShard}.json`);
			if (!indexResp.ok) { loaded = true; loading = false; return; }

			const index = await indexResp.json();
			const refs = index[word]; // [[shardNum, indexInShard], ...]
			if (!refs || refs.length === 0) { loaded = true; loading = false; return; }

			// Group refs by shard to minimize fetches
			const shardGroups: Record<number, number[]> = {};
			for (const [shardNum, idx] of refs) {
				if (!shardGroups[shardNum]) shardGroups[shardNum] = [];
				shardGroups[shardNum].push(idx);
			}

			// Fetch needed shards
			const results: Sentence[] = [];
			for (const [shardNum, indices] of Object.entries(shardGroups)) {
				const shardResp = await fetch(`/zh_sentences/${parseInt(shardNum).toString(16)}.json`);
				if (!shardResp.ok) continue;
				const shardData = await shardResp.json();
				for (const idx of indices) {
					if (shardData[idx]) {
						const [zh, en, py] = shardData[idx];
						results.push({ zh, en, py });
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
		<SectionHeading id="zh-examples">🇨🇳 Example Sentences</SectionHeading>
		<div class="example-list">
			{#each sentences as s}
				<div class="example-item">
					<div class="example-zh" lang="zh">{s.zh}</div>
					<div class="example-py">{s.py}</div>
					<div class="example-en">{s.en}</div>
				</div>
			{/each}
		</div>
	</div>
{/if}

<style>
	.zh-examples { margin-top: var(--spacing-lg); }

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
