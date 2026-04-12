<script lang="ts">
	import { goto } from '$app/navigation';
	import SectionHeading from "./shared/SectionHeading.svelte";
	import { getDictionaryUrl } from '$lib/shard-utils';
	import { dev } from '$app/environment';
	import { segmentText, isWordToken } from '$lib/utils/segment';
	import type { JapaneseSense, KoreanWord } from "$lib/types";

	interface Props {
		japaneseSenses?: JapaneseSense[];
		koreanWords?: KoreanWord[];
	}

	let { japaneseSenses = [], koreanWords = [] }: Props = $props();

	interface ExampleItem {
		source: "ja" | "ko";
		text: string;
		translation?: string;
		tokens?: string[]; // Tokenized words for clickable display
	}

	let examples = $derived.by(() => {
		const items: ExampleItem[] = [];

		if (japaneseSenses) {
			for (const sense of japaneseSenses) {
				if (!sense.examples) continue;
				for (const ex of sense.examples) {
					const jpSentence = ex.sentences?.find(
						(s) => (s as any).land === "jpn" || s.lang === "jpn",
					);
					const engSentence = ex.sentences?.find(
						(s) => (s as any).land === "eng" || s.lang === "eng",
					);
					const displayText = jpSentence?.text;
					if (displayText) {
						items.push({
							source: "ja",
							text: displayText,
							translation: engSentence?.text,
							tokens: segmentText(displayText, 'japanese'),
						});
					}
				}
			}
		}

		if (koreanWords) {
			for (const word of koreanWords) {
				if (!word.examples) continue;
				for (const ex of word.examples) {
					if (ex.korean) {
						items.push({
							source: "ko",
							text: ex.korean,
							translation: ex.translation,
							tokens: ex.korean.split(/(\s+)/),
						});
					}
				}
			}
		}

		return items;
	});

	let displayCount = $state(8);
	let displayed = $derived(examples.slice(0, displayCount));
	let hasMore = $derived(displayCount < examples.length);

	// Dictionary panel
	let selectedWord = $state<string | null>(null);
	let panelOpen = $state(false);
	let panelData = $state<any>(null);
	let panelLoading = $state(false);

	async function openPanel(word: string) {
		// Strip punctuation
		const clean = word.replace(/[。、！？「」『』（）…・〜\s]/g, '');
		if (!clean) return;
		selectedWord = clean;
		panelOpen = true;
		panelData = null;
		panelLoading = true;
		try {
			const url = await getDictionaryUrl(clean, dev, fetch);
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

{#if examples.length > 0}
	<div class="sentence-examples" class:panel-open={panelOpen}>
		<div class="examples-main">
			<SectionHeading id="examples">Example Sentences ({examples.length})</SectionHeading>

			<div class="examples-list">
				{#each displayed as item}
					<div class="example-item">
						<div class="example-text">
							<span class="lang-tag">{item.source === "ja" ? "🇯🇵" : "🇰🇷"}</span>
							<span class="source-text" lang={item.source === "ja" ? "ja" : "ko"}>
								{#if item.tokens}
									{#each item.tokens as token}
										{#if isWordToken(token, item.source === "ja" ? "japanese" : "korean")}
											<button
												class="word-token"
												class:selected={selectedWord === token.replace(/[。、！？「」『』（）…・〜]/g, '')}
												onclick={() => openPanel(token)}
											>{token}</button>
										{:else}
											{token}
										{/if}
									{/each}
								{:else}
									{item.text}
								{/if}
							</span>
						</div>
						{#if item.translation}
							<div class="example-translation">{item.translation}</div>
						{/if}
					</div>
				{/each}
			</div>

			{#if hasMore}
				<button class="show-more-btn" onclick={() => (displayCount += 8)}>
					Show more ({examples.length - displayCount} remaining)
				</button>
			{/if}
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
						<p class="panel-status">Loading...</p>
					{:else if panelData?.japanese_words?.length}
						{#each panelData.japanese_words.slice(0, 3) as jw}
							{#if jw.kana?.[0]?.text}
								<div class="panel-reading">{jw.kana[0].text}</div>
							{/if}
							{#each (jw.sense || []).slice(0, 2) as sense}
								<ol class="panel-defs">
									{#each (sense.gloss || []).slice(0, 3) as g}
										<li>{g.text || g}</li>
									{/each}
								</ol>
							{/each}
						{/each}
					{:else if panelData?.chinese_words?.length}
						{#each panelData.chinese_words[0].items?.slice(0, 2) || [] as item}
							{#if item.pinyin}<span class="panel-pinyin">{item.pinyin}</span>{/if}
							<ol class="panel-defs">
								{#each item.definitions?.slice(0, 3) || [] as def}
									<li>{def}</li>
								{/each}
							</ol>
						{/each}
					{:else if panelData?.korean_words?.length}
						{#each panelData.korean_words.slice(0, 3) as kw}
							{#if kw.hangul}<div class="panel-reading">{kw.hangul}</div>{/if}
							<ol class="panel-defs">
								{#each kw.definitions || [] as def}
									<li>{def.text || def}</li>
								{/each}
							</ol>
						{/each}
					{:else}
						<p class="panel-status">No entry found</p>
					{/if}
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.sentence-examples {
		margin-bottom: var(--spacing-lg);
		position: relative;
	}

	@media (min-width: 769px) {
		.sentence-examples.panel-open {
			display: grid;
			grid-template-columns: 1fr 340px;
			gap: var(--spacing-lg);
		}
	}

	.examples-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	.example-item {
		padding: var(--spacing-sm) var(--spacing-md);
		background: var(--bg-secondary);
		border: 1px solid var(--border-light);
		border-radius: var(--radius-md);
	}

	.example-text {
		display: flex;
		align-items: baseline;
		gap: var(--spacing-sm);
	}

	.lang-tag {
		font-size: var(--font-size-caption2);
		color: var(--text-muted);
		background: var(--bg-tertiary);
		padding: 1px var(--spacing-xs);
		border-radius: var(--radius-sm);
		font-weight: 500;
		flex-shrink: 0;
	}

	.source-text {
		font-size: var(--font-size-body);
		color: var(--text-primary);
		font-family: var(--font-cjk);
		line-height: 1.6;
	}

	.word-token {
		background: none;
		border: none;
		padding: 0;
		margin: 0;
		font: inherit;
		color: inherit;
		cursor: pointer;
		border-bottom: 1px solid transparent;
		transition: border-color 0.15s, color 0.15s;
	}

	.word-token:hover {
		color: var(--accent);
		border-bottom-color: var(--accent);
	}

	.word-token.selected {
		color: var(--accent);
		border-bottom-color: var(--accent);
	}

	.example-translation {
		font-size: var(--font-size-caption1);
		color: var(--text-tertiary);
		margin-top: var(--spacing-xs);
		padding-left: calc(var(--spacing-sm) + 24px);
		line-height: 1.4;
	}

	.show-more-btn {
		display: block;
		width: 100%;
		padding: var(--spacing-xs) var(--spacing-md);
		margin-top: var(--spacing-sm);
		background: transparent;
		border: 1px solid var(--border-light);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		font-size: var(--font-size-caption1);
		cursor: pointer;
		transition: border-color 0.15s ease, color 0.15s ease;
	}

	.show-more-btn:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	/* Dictionary Panel */
	.panel-overlay {
		display: none;
	}

	@media (max-width: 768px) {
		.panel-overlay {
			display: block;
			position: fixed;
			inset: 0;
			background: rgba(0, 0, 0, 0.5);
			z-index: 40;
		}

		.dictionary-panel {
			position: fixed;
			bottom: 0;
			left: 0;
			right: 0;
			max-height: 50vh;
			z-index: 50;
			border-radius: var(--radius-lg) var(--radius-lg) 0 0;
			overflow-y: auto;
		}
	}

	@media (min-width: 769px) {
		.dictionary-panel {
			position: sticky;
			top: 80px;
			max-height: calc(100vh - 100px);
			overflow-y: auto;
			border-radius: var(--radius-md);
		}
	}

	.dictionary-panel {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		padding: var(--spacing-md);
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--spacing-sm);
	}

	.panel-word {
		font-size: var(--font-size-headline);
		font-family: var(--font-cjk);
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
	}

	.panel-actions {
		display: flex;
		gap: var(--spacing-xs);
	}

	.panel-open-btn, .panel-close-btn {
		padding: var(--spacing-xs) var(--spacing-sm);
		border: 1px solid var(--border-light);
		border-radius: var(--radius-sm);
		background: var(--bg-tertiary);
		color: var(--text-secondary);
		cursor: pointer;
		font-size: var(--font-size-caption1);
	}

	.panel-open-btn:hover, .panel-close-btn:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.panel-reading {
		font-family: var(--font-cjk);
		color: var(--color-pinyin);
		font-size: var(--font-size-subhead);
		margin-bottom: var(--spacing-xs);
	}

	.panel-pinyin {
		font-family: var(--font-mono);
		color: var(--color-pinyin);
		font-size: var(--font-size-caption1);
	}

	.panel-defs {
		padding-left: var(--spacing-lg);
		margin: var(--spacing-xs) 0;
		font-size: var(--font-size-caption1);
		color: var(--text-secondary);
	}

	.panel-status {
		color: var(--text-muted);
		font-size: var(--font-size-caption1);
	}

	@media (max-width: 768px) {
		.example-item {
			padding: var(--spacing-xs) var(--spacing-sm);
		}

		.example-translation {
			padding-left: calc(var(--spacing-xs) + 24px);
		}
	}
</style>
