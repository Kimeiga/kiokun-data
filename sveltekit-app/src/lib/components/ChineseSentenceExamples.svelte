<script lang="ts">
	import AnnotatedSentence from '$lib/components/AnnotatedSentence.svelte';
	import DisclosureChevron from '$lib/components/shared/DisclosureChevron.svelte';
	import { buildChineseRubySegments } from '$lib/utils/sentence-ruby';
	import { animateDisclosureHeight } from '$lib/utils/disclosure-motion';

	interface Props { word: string; words?: string[]; hasContent?: boolean; }
	let { word, words = [], hasContent = $bindable(false) }: Props = $props();

	interface Sentence { simp: string; trad: string; en: string; py: string; }

	let sentences = $state<Sentence[]>([]);
	let loaded = $state(false);
	let showTraditional = $state(false);
	let expanded = $state(false);
	let exampleList: HTMLDivElement | null = $state(null);
	let collapsedHeight = $state(0);
	let requestId = 0;
	const COLLAPSED_COUNT = 4;
	let displayed = $derived(expanded ? sentences : sentences.slice(0, COLLAPSED_COUNT));

	$effect(() => { hasContent = loaded && sentences.length > 0; });

	$effect(() => {
		const element = exampleList;
		const _displayed = displayed;
		if (!element || expanded) return;
		const frame = requestAnimationFrame(() => {
			collapsedHeight = element.scrollHeight;
		});
		return () => cancelAnimationFrame(frame);
	});

	let lookupWords = $derived.by(() => {
		const forms: string[] = [];
		const add = (form: string | undefined | null) => {
			if (form && !forms.includes(form)) forms.push(form);
		};
		add(word);
		for (const form of words || []) add(form);
		return forms;
	});

	function simpleHash(str: string): number {
		let h = 0;
		for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
		return h;
	}

	async function loadSentences(forms: string[]) {
		const currentRequest = ++requestId;
		if (!forms.length) {
			sentences = [];
			loaded = true;
			return;
		}

		loaded = false;
		sentences = [];
		try {
			const refs: Array<[number, number]> = [];
			const seenRefs = new Set<string>();
			const indexCache = new Map<string, any>();

			for (const form of forms) {
				const indexShard = (simpleHash(form) & 0xFF).toString(16).padStart(2, '0');
				let index = indexCache.get(indexShard);
				if (!index) {
					const indexResp = await fetch(`/zh_sentences/idx/${indexShard}.json`);
					if (!indexResp.ok) continue;
					index = await indexResp.json();
					indexCache.set(indexShard, index);
				}

				for (const ref of index[form] || []) {
					const key = `${ref[0]}:${ref[1]}`;
					if (seenRefs.has(key)) continue;
					seenRefs.add(key);
					refs.push(ref);
				}
			}

			if (!refs.length) return;

			const shardGroups: Record<number, number[]> = {};
			for (const [shardNum, idx] of refs) {
				if (!shardGroups[shardNum]) shardGroups[shardNum] = [];
				shardGroups[shardNum].push(idx);
			}

			const results: Sentence[] = [];
			const seenSentences = new Set<string>();
			for (const [shardNum, indices] of Object.entries(shardGroups)) {
				const shardResp = await fetch(`/zh_sentences/${parseInt(shardNum).toString(16)}.json`);
				if (!shardResp.ok) continue;
				const shardData = await shardResp.json();
				for (const idx of indices) {
					if (shardData[idx]) {
						const [simp, trad, en, py] = shardData[idx];
						const sentenceKey = `${simp}\n${trad}\n${en}`;
						if (seenSentences.has(sentenceKey)) continue;
						seenSentences.add(sentenceKey);
						results.push({ simp, trad, en, py });
					}
				}
			}
			if (currentRequest === requestId) sentences = results;
		} catch {}
		finally {
			if (currentRequest === requestId) loaded = true;
		}
	}

	$effect(() => {
		loadSentences(lookupWords);
	});

	function toggleExpanded() {
		if (!expanded && exampleList) collapsedHeight = exampleList.scrollHeight;
		void animateDisclosureHeight({
			element: exampleList,
			nextExpanded: !expanded,
			collapsedHeight,
			setExpanded: (value) => expanded = value,
		});
	}
</script>

{#if loaded && sentences.length > 0}
	{@const hasMoreSentences = sentences.length > COLLAPSED_COUNT}
	<div class="zh-examples">
		<div class="column-header-row">
			<span class="column-header">Examples for this word ({sentences.length})</span>
			<button class="script-toggle" onclick={() => showTraditional = !showTraditional} title={showTraditional ? 'Traditional Chinese' : 'Simplified Chinese'}>
				{showTraditional ? '🇹🇼' : '🇨🇳'}
			</button>
		</div>
		<div class="example-list mobile-full-bleed" id="chinese-sentence-examples" bind:this={exampleList}>
			{#each displayed as s}
				{@const sentenceText = showTraditional ? s.trad : s.simp}
				{@const rubySegments = buildChineseRubySegments(sentenceText, s.py)}
				{@const hasRuby = rubySegments.some((segment) => segment.reading)}
				<a
					class="example-item"
					href="/sentence?text={encodeURIComponent(sentenceText)}&lang=zh&en={encodeURIComponent(s.en)}&py={encodeURIComponent(s.py)}&from={encodeURIComponent(word)}"
				>
					<div class="example-text" lang={showTraditional ? 'zh-Hant' : 'zh-Hans'}>
						<AnnotatedSentence text={sentenceText} language="zh" pinyin={s.py} />
					</div>
					{#if !hasRuby}
						<div class="example-sub">{s.py}</div>
					{/if}
					<div class="example-translation">{s.en}</div>
				</a>
			{/each}
		</div>
		{#if hasMoreSentences}
			<DisclosureChevron
				{expanded}
				controls="chinese-sentence-examples"
				onclick={toggleExpanded}
				expandLabel={`Show ${sentences.length - COLLAPSED_COUNT} more Chinese examples`}
				collapseLabel="Show fewer Chinese examples"
			/>
		{/if}
	</div>
{/if}

<style>
	.zh-examples { position: relative; margin-bottom: var(--spacing-xs); }
	.column-header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--spacing-sm); }
	.column-header { font-size: var(--font-size-caption1); font-weight: 600; color: var(--text-secondary); }
	.script-toggle {
		position: relative;
		width: 1.75rem;
		height: 1.75rem;
		min-width: 1.75rem;
		min-height: 1.75rem;
		padding: 0;
		border: 1px solid var(--border-light);
		background: var(--divider-cell-bg); color: var(--text-muted);
		font-size: var(--font-size-caption1); cursor: pointer;
		transition: background-color 120ms ease, color 120ms ease;
	}
	.script-toggle::before { content: ""; position: absolute; inset: -0.5rem; }
	.script-toggle:hover { background: var(--divider-cell-hover); color: var(--accent); }
	.script-toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
	.example-list { display: flex; flex-direction: column; border-block: 1px solid var(--border-light); }
	.example-item {
		display: block; padding: var(--spacing-sm);
		background: var(--divider-cell-bg); text-decoration: none; transition: background-color 120ms ease;
	}
	.example-item + .example-item { border-block-start: 1px solid var(--border-light); }
	.example-item:hover { background: var(--divider-cell-hover); }
	.example-item:active { background: var(--divider-cell-active); }
	.example-item:focus-visible { position: relative; z-index: 1; outline: 2px solid var(--accent); outline-offset: -2px; }
	.example-text {
		font-size: var(--font-size-body);
		font-family: var(--font-cjk);
		color: var(--text-primary);
		line-height: 2.15;
		padding-top: 0.3em;
	}
	.example-sub { font-size: var(--font-size-caption1); color: var(--color-pinyin); margin-top: 1px; }
	.example-translation { font-size: var(--font-size-callout); color: var(--text-tertiary); margin-top: 2px; line-height: 1.4; }

	@media (max-width: 768px) {
		.example-item { padding-inline: 0.75rem; }
	}
</style>
