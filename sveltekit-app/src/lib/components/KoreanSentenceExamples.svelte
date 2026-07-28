<script lang="ts">
	import { onMount } from 'svelte';
	import AnnotatedSentence from '$lib/components/AnnotatedSentence.svelte';
	import DisclosureChevron from '$lib/components/shared/DisclosureChevron.svelte';

	interface Props {
		word: string;
		containedInKorean?: string[]; // Korean words containing this character (for hanja lookup)
		hasContent?: boolean;
	}
	let { word, containedInKorean = [], hasContent = $bindable(false) }: Props = $props();

	interface Sentence { kr: string; en: string; }

	let sentences = $state<Sentence[]>([]);
	let loaded = $state(false);
	let expanded = $state(false);

	$effect(() => { hasContent = loaded && sentences.length > 0; });

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

</script>

{#if loaded && sentences.length > 0}
	{@const COLLAPSED_COUNT = 4}
	{@const displayed = expanded ? sentences : sentences.slice(0, COLLAPSED_COUNT)}
	{@const hasMoreSentences = sentences.length > COLLAPSED_COUNT}
	<div class="kr-examples">
		<div class="examples-main">
			<div class="column-header">Examples for this word ({sentences.length})</div>
			<div class="example-list" id="korean-sentence-examples">
				{#each displayed as s}
					<a
						class="example-item"
						href="/sentence?text={encodeURIComponent(s.kr)}&lang=ko&en={encodeURIComponent(s.en)}&from={encodeURIComponent(word)}"
					>
						<div class="example-text" lang="ko">
							<AnnotatedSentence text={s.kr} language="ko" />
						</div>
						<div class="example-translation">{s.en}</div>
					</a>
				{/each}
			</div>
			{#if hasMoreSentences}
				<DisclosureChevron
					{expanded}
					controls="korean-sentence-examples"
					onclick={() => expanded = !expanded}
					expandLabel={`Show ${sentences.length - COLLAPSED_COUNT} more Korean examples`}
					collapseLabel="Show fewer Korean examples"
				/>
			{/if}
		</div>
	</div>
{/if}

<style>
	.kr-examples { position: relative; }
	.column-header { font-size: var(--font-size-caption1); font-weight: 600; color: var(--text-secondary); margin-bottom: var(--spacing-sm); }
	.examples-main { min-width: 0; }
	.example-list { display: flex; flex-direction: column; gap: var(--spacing-xs); }
	.example-item {
		display: block; padding: var(--spacing-xs) var(--spacing-sm); background: var(--bg-secondary);
		border: 1px solid var(--border-light); border-radius: var(--radius-md);
		text-decoration: none; transition: border-color 0.15s;
	}
	.example-item:hover { border-color: var(--accent); }
	.example-text {
		font-size: var(--font-size-body);
		font-family: var(--font-cjk);
		color: var(--text-primary);
		line-height: 2.15;
		padding-top: 0.3em;
	}
	.example-translation { font-size: var(--font-size-caption1); color: var(--text-tertiary); margin-top: 2px; line-height: 1.4; }
</style>
