<script lang="ts">
	import { onMount } from 'svelte';
	import AnnotatedSentence from '$lib/components/AnnotatedSentence.svelte';
	import ScrollWindow from '$lib/components/shared/ScrollWindow.svelte';

	interface Props {
		word: string;
		containedInKorean?: string[]; // Korean words containing this character (for hanja lookup)
		hasContent?: boolean;
	}
	let { word, containedInKorean = [], hasContent = $bindable(false) }: Props = $props();

	interface Sentence { kr: string; en: string; }

	let sentences = $state<Sentence[]>([]);
	let loaded = $state(false);
	let sentenceGlosses = $state<Record<string, Record<string, string>>>({});
	const requestedGlosses = new Set<string>();

	$effect(() => { hasContent = loaded && sentences.length > 0; });

	$effect(() => {
		void loadWordGlosses(sentences.map((sentence) => sentence.kr));
	});

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

	async function loadWordGlosses(texts: string[]) {
		const pending = texts.filter((text) => text && !requestedGlosses.has(text));
		for (let index = 0; index < pending.length; index += 8) {
			const chunk = pending.slice(index, index + 8);
			for (const text of chunk) requestedGlosses.add(text);
			try {
				const response = await fetch('/api/korean-glosses', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ texts: chunk }),
				});
				if (!response.ok) {
					for (const text of chunk) requestedGlosses.delete(text);
					continue;
				}
				const payload = await response.json();
				sentenceGlosses = { ...sentenceGlosses, ...(payload.glosses || {}) };
			} catch {
				for (const text of chunk) requestedGlosses.delete(text);
			}
		}
	}
</script>

{#if loaded && sentences.length > 0}
	<div class="kr-examples">
		<div class="examples-main">
			<div class="column-header">Examples for this word ({sentences.length})</div>
			<ScrollWindow
				class="mobile-full-bleed"
				id="korean-sentence-examples"
				maxHeight="min(46svh, 28rem)"
				ariaLabel={`Korean example sentences for ${word}`}
			>
				<div class="example-list">
					{#each sentences as s}
						<a
							class="example-item"
							href="/sentence?text={encodeURIComponent(s.kr)}&lang=ko&en={encodeURIComponent(s.en)}&from={encodeURIComponent(word)}"
						>
							<div class="example-text" lang="ko">
								<AnnotatedSentence
									text={s.kr}
									language="ko"
									glosses={sentenceGlosses[s.kr] || {}}
									showGlosses
								/>
							</div>
							<div class="example-translation">{s.en}</div>
						</a>
					{/each}
				</div>
			</ScrollWindow>
		</div>
	</div>
{/if}

<style>
	.kr-examples { position: relative; margin-bottom: var(--spacing-xs); }
	.column-header { font-size: var(--font-size-caption1); font-weight: 600; color: var(--text-secondary); margin: var(--spacing-sm) 0 var(--spacing-xs); }
	.examples-main { min-width: 0; }
	.example-list { display: flex; flex-direction: column; border: 1px solid var(--border-light); }
	.example-item {
		display: block; padding: 10px var(--spacing-sm); background: var(--divider-cell-bg);
		text-decoration: none; transition: background-color 120ms ease;
	}
	.example-item + .example-item { border-block-start: 1px solid var(--border-light); }
	.example-item:hover { background: var(--divider-cell-hover); }
	.example-item:active { background: var(--divider-cell-active); }
	.example-item:focus-visible { position: relative; z-index: 1; outline: 2px solid var(--accent); outline-offset: -2px; }
	.example-text {
		font-size: 18px;
		font-family: var(--font-cjk);
		color: var(--text-primary);
		line-height: 2.75;
		padding-top: 0.55em;
	}
	.example-translation { font-size: var(--font-size-callout); color: var(--text-tertiary); margin-top: 2px; line-height: 1.4; }

	@media (max-width: 768px) {
		.example-item { padding-inline: 0.75rem; }
	}
</style>
