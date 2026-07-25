<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { getDictionaryUrl } from '$lib/shard-utils';
	import { dev } from '$app/environment';
	import {
		buildChineseRubySegments,
		buildJapaneseRubySegments,
		buildKoreanRubySegments,
		enrichJapaneseRubySegments,
		type RubySegment
	} from '$lib/utils/sentence-ruby';
	import { findWordsWithDeinflection } from '$lib/utils/search-navigation';
	import Header from '$lib/components/Header.svelte';
	import SentenceBar from '$lib/components/SentenceBar.svelte';

	// Read sentence data from URL params
	let text = $derived($page.url.searchParams.get('text') || '');
	let translation = $derived($page.url.searchParams.get('en') || '');
	let lang = $derived(($page.url.searchParams.get('lang') || 'ja') as 'ja' | 'zh' | 'ko');
	let pinyin = $derived($page.url.searchParams.get('py') || '');
	let from = $derived($page.url.searchParams.get('from') || '');

	let baseDisplayTokens = $derived.by((): RubySegment[] => {
		if (!text) return [];
		if (lang === 'zh') return buildChineseRubySegments(text, pinyin);
		if (lang === 'ko') return buildKoreanRubySegments(text);
		return buildJapaneseRubySegments(text);
	});
	let enrichedDisplayTokens = $state<RubySegment[] | null>(null);

	$effect(() => {
		enrichedDisplayTokens = null;
		if (lang !== 'ja' || !text) return;

		let cancelled = false;
		const segments = baseDisplayTokens;
		enrichJapaneseRubySegments(segments, fetch).then((result) => {
			if (!cancelled) enrichedDisplayTokens = result;
		});

		return () => { cancelled = true; };
	});

	let displayTokens = $derived(enrichedDisplayTokens ?? baseDisplayTokens);
	let hasRuby = $derived(displayTokens.some((token) => token.reading));

	let langLabel = $derived(lang === 'ja' ? 'Japanese' : lang === 'zh' ? 'Chinese' : 'Korean');
	let langAttr = $derived(lang === 'ja' ? 'ja' : lang === 'zh' ? 'zh' : 'ko');
	let langFlag = $derived(lang === 'ja' ? '🇯🇵' : lang === 'zh' ? '🇨🇳' : '🇰🇷');

	// Dictionary panel
	let selectedWord = $state<string | null>(null);
	let panelOpen = $state(false);
	let panelData = $state<any>(null);
	let panelLoading = $state(false);
	let panelFallbackChars = $state<string[]>([]);

	function cleanWord(w: string): string {
		return w.replace(/[。、，！？「」『』“”‘’（）…・〜.,;:!?\s]/g, '');
	}

	function cjkChars(w: string): string[] {
		return Array.from(w).filter((char) =>
			/^[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]$/.test(char)
		);
	}

	let panelDeinflectInfo = $state<string | null>(null);

	async function openPanel(word: string) {
		const clean = cleanWord(word);
		if (!clean) return;
		selectedWord = clean;
		panelOpen = true;
		panelData = null;
		panelLoading = true;
		panelFallbackChars = [];
		panelDeinflectInfo = null;
		try {
			const { inflateSync } = await import('fflate');
			const url = await getDictionaryUrl(clean, dev, fetch);
			const dictFetch = url.startsWith('http') ? globalThis.fetch : fetch;
			const resp = await dictFetch(url);
			if (resp.ok) {
				panelData = JSON.parse(new TextDecoder().decode(inflateSync(new Uint8Array(await resp.arrayBuffer()))));
				if (panelData?.redirect) {
					const rUrl = await getDictionaryUrl(panelData.redirect, dev, fetch);
					const rFetch = rUrl.startsWith('http') ? globalThis.fetch : fetch;
					const r2 = await rFetch(rUrl);
					if (r2.ok) panelData = JSON.parse(new TextDecoder().decode(inflateSync(new Uint8Array(await r2.arrayBuffer()))));
				}
			} else {
				// Try deinflection (handles conjugated Korean/Japanese forms)
				const result = await findWordsWithDeinflection(clean, fetch);
				if (result?.primary) {
					const dUrl = await getDictionaryUrl(result.primary.dictionaryForm, dev, fetch);
					const dFetch = dUrl.startsWith('http') ? globalThis.fetch : fetch;
					const dResp = await dFetch(dUrl);
					if (dResp.ok) {
						panelData = JSON.parse(new TextDecoder().decode(inflateSync(new Uint8Array(await dResp.arrayBuffer()))));
						if (panelData?.redirect) {
							const rUrl = await getDictionaryUrl(panelData.redirect, dev, fetch);
							const rFetch = rUrl.startsWith('http') ? globalThis.fetch : fetch;
							const r2 = await rFetch(rUrl);
							if (r2.ok) panelData = JSON.parse(new TextDecoder().decode(inflateSync(new Uint8Array(await r2.arrayBuffer()))));
						}
						panelDeinflectInfo = result.primary.conjugationInfo
							? `${clean} → ${result.primary.dictionaryForm} (${result.primary.conjugationInfo})`
							: `${clean} → ${result.primary.dictionaryForm}`;
						selectedWord = result.primary.dictionaryForm;
					}
				}
			}
			if (!panelData) {
				const chars = cjkChars(clean);
				if (chars.length > 1) panelFallbackChars = chars;
			}
		} catch {} finally { panelLoading = false; }
	}

	function closePanel() { panelOpen = false; selectedWord = null; }

	function openSelectedWord() {
		if (selectedWord && panelData) goto(`/${encodeURIComponent(selectedWord)}`);
	}

	function isClickableToken(token: { text: string; isWord: boolean }): boolean {
		return token.isWord;
	}
</script>

<svelte:head>
	<title>{langFlag} Sentence - Kiokun Dictionary</title>
</svelte:head>

<Header autofocus={false} />

<main class="sentence-page">
	<div class="sentence-container" class:panel-open={panelOpen}>
		<div class="sentence-main">
			<!-- Back link -->
			{#if from}
				<a href="/{from}" class="back-link">← Back to {from}</a>
			{/if}

			<!-- Sentence display -->
			<div class="sentence-card">
				<div class="sentence-flag">{langFlag}</div>
				<div class="sentence-text" class:withRuby={hasRuby} lang={langAttr}>
					{#each displayTokens as token}
						{#if isClickableToken(token)}
							<button
								class="word-token"
								class:selected={selectedWord === cleanWord(token.text)}
								onclick={() => openPanel(token.text)}
							>
								{#if token.reading}
									<ruby class="token-ruby"><rb>{token.text}</rb><rt>{token.reading}</rt></ruby>
								{:else}
									{token.text}
								{/if}
							</button>
						{:else}
							<span class="punct">
								{#if token.reading}
									<ruby class="token-ruby"><rb>{token.text}</rb><rt>{token.reading}</rt></ruby>
								{:else}
									{token.text}
								{/if}
							</span>
						{/if}
					{/each}
				</div>

				{#if pinyin && (lang !== 'zh' || !hasRuby)}
					<div class="sentence-pinyin">{pinyin}</div>
				{/if}

				{#if translation}
					<div class="sentence-translation">{translation}</div>
				{/if}
			</div>

			<p class="sentence-hint">Tap any word for its definition</p>
		</div>

		<!-- Dictionary Panel -->
		{#if panelOpen}
			<button
				type="button"
				class="panel-overlay"
				aria-label="Close dictionary panel"
				onclick={closePanel}
			></button>
			<div class="dictionary-panel">
				<div class="panel-header">
					<h3 class="panel-word">{selectedWord}</h3>
					<div class="panel-actions">
						{#if panelData}
							<button class="panel-open-btn" onclick={openSelectedWord}>Open →</button>
						{/if}
						<button class="panel-close-btn" onclick={closePanel}>×</button>
					</div>
				</div>
				<div class="panel-body">
					{#if panelDeinflectInfo}
						<div class="panel-deinflect">{panelDeinflectInfo}</div>
					{/if}
					{#if panelLoading}
						<p class="panel-status">Loading...</p>
					{:else if panelData?.japanese_words?.length}
						{#each panelData.japanese_words.slice(0, 3) as jw}
							{#if jw.kana?.[0]?.text}
								<div class="panel-reading">{jw.kana[0].text}</div>
							{/if}
							{#each (jw.sense || []).slice(0, 3) as sense}
								{#if sense.gloss?.length}
									<ol class="panel-defs">
										{#each sense.gloss.slice(0, 4) as g}
											<li>{g.text || g}</li>
										{/each}
									</ol>
								{/if}
							{/each}
						{/each}
					{:else if panelData?.chinese_words?.length}
						{#each panelData.chinese_words.slice(0, 2) as cw}
							{#each cw.items?.slice(0, 2) || [] as item}
								{#if item.pinyin}<div class="panel-pinyin">{item.pinyin}</div>{/if}
								<ol class="panel-defs">
									{#each item.definitions?.slice(0, 4) || [] as def}
										<li>{def}</li>
									{/each}
								</ol>
							{/each}
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
						{#if panelFallbackChars.length > 0}
							<div class="panel-fallback">
								<div class="panel-fallback-label">Try characters</div>
								<div class="panel-fallback-chips">
									{#each panelFallbackChars as char}
										<button class="panel-char-chip" onclick={() => openPanel(char)}>{char}</button>
									{/each}
								</div>
							</div>
						{:else if selectedWord}
							<a href="/search?q={encodeURIComponent(selectedWord)}" class="panel-search-link">Search for {selectedWord} →</a>
						{/if}
					{/if}
				</div>
			</div>
		{/if}
	</div>
</main>

<SentenceBar />

<style>
	.sentence-page {
		max-width: 900px;
		margin: 0 auto;
		padding: var(--spacing-lg) var(--spacing-md);
		min-height: calc(100vh - 120px);
	}

	.sentence-container {
		position: relative;
	}

	@media (min-width: 769px) {
		.sentence-container.panel-open {
			display: grid;
			grid-template-columns: 1fr 360px;
			gap: var(--spacing-xl);
			align-items: start;
		}
	}

	.back-link {
		display: inline-block;
		font-size: var(--font-size-caption1);
		color: var(--text-tertiary);
		text-decoration: none;
		margin-bottom: var(--spacing-md);
		transition: color 0.15s;
	}
	.back-link:hover { color: var(--accent); }

	.sentence-card {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: var(--spacing-xl) var(--spacing-lg);
	}

	.sentence-flag {
		font-size: 20px;
		margin-bottom: var(--spacing-sm);
	}

	.sentence-text {
		font-family: var(--font-cjk);
		font-size: 28px;
		line-height: 1.8;
		color: var(--text-primary);
		margin-bottom: var(--spacing-md);
	}
	.sentence-text.withRuby {
		line-height: 2.25;
		padding-top: 0.35em;
	}
	.sentence-text .token-ruby {
		margin-inline: 0.03em;
		line-height: 1.05;
		ruby-position: over;
		ruby-align: center;
		vertical-align: baseline;
	}
	.sentence-text rb {
		white-space: nowrap;
	}
	.sentence-text rt {
		font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
		font-size: 0.45em;
		font-weight: 500;
		line-height: 1;
		color: var(--color-pinyin);
		text-align: center;
		white-space: nowrap;
		user-select: none;
	}

	@media (max-width: 768px) {
		.sentence-text {
			font-size: 22px;
		}
	}

	.word-token {
		background: none;
		border: none;
		padding: 0 1px;
		margin: 0;
		font: inherit;
		color: inherit;
		cursor: pointer;
		border-bottom: 2px solid transparent;
		transition: border-color 0.15s, color 0.15s;
		border-radius: 2px;
	}

	.word-token:hover {
		color: var(--accent);
		border-bottom-color: var(--accent);
		background: var(--bg-tertiary);
	}

	.word-token.selected {
		color: var(--accent);
		border-bottom-color: var(--accent);
		background: var(--bg-tertiary);
	}

	.punct {
		color: var(--text-tertiary);
	}

	.sentence-pinyin {
		font-size: var(--font-size-subhead);
		color: var(--color-pinyin);
		margin-bottom: var(--spacing-sm);
		line-height: 1.6;
	}

	.sentence-translation {
		font-size: var(--font-size-body);
		color: var(--text-secondary);
		line-height: 1.5;
		padding-top: var(--spacing-sm);
		border-top: 1px solid var(--border-light);
	}

	.sentence-hint {
		margin-top: var(--spacing-md);
		font-size: var(--font-size-caption2);
		color: var(--text-muted);
		text-align: center;
	}

	/* Dictionary Panel */
	.panel-overlay { display: none; }

	@media (max-width: 768px) {
		.panel-overlay {
			appearance: none;
			display: block;
			position: fixed;
			inset: 0;
			width: 100%;
			height: 100%;
			margin: 0;
			padding: 0;
			border: 0;
			background: rgba(0, 0, 0, 0.5);
			z-index: 40;
			cursor: default;
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
		padding: var(--spacing-lg);
		box-shadow: 0 4px 20px rgba(0,0,0,0.2);
	}

	.panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-md); }
	.panel-word { font-size: 32px; font-family: var(--font-cjk); font-weight: 600; color: var(--text-primary); margin: 0; }
	.panel-actions { display: flex; gap: var(--spacing-xs); }
	.panel-open-btn, .panel-close-btn {
		padding: var(--spacing-xs) var(--spacing-sm);
		border: 1px solid var(--border-light);
		border-radius: var(--radius-sm);
		background: var(--bg-tertiary);
		color: var(--text-secondary);
		cursor: pointer;
		font-size: var(--font-size-caption1);
	}
	.panel-open-btn:hover, .panel-close-btn:hover { border-color: var(--accent); color: var(--accent); }
	.panel-reading { font-family: var(--font-cjk); color: var(--color-pinyin); font-size: var(--font-size-headline); margin-bottom: var(--spacing-xs); }
	.panel-pinyin { color: var(--color-pinyin); font-size: var(--font-size-subhead); margin-bottom: var(--spacing-xs); }
	.panel-defs { padding-left: var(--spacing-lg); margin: var(--spacing-xs) 0; font-size: var(--font-size-body); color: var(--text-secondary); line-height: 1.5; }
	.panel-status { color: var(--text-muted); font-size: var(--font-size-caption1); }
	.panel-deinflect { color: var(--text-tertiary); font-size: var(--font-size-caption1); margin-bottom: var(--spacing-xs); }
	.panel-search-link { font-size: var(--font-size-caption1); color: var(--accent); }
	.panel-fallback {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
		align-items: flex-start;
	}
	.panel-fallback-label {
		font-size: var(--font-size-caption1);
		color: var(--text-tertiary);
	}
	.panel-fallback-chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
	}
	.panel-char-chip {
		min-width: 2.25rem;
		height: 2.25rem;
		padding: 0 var(--spacing-sm);
		border: 1px solid var(--border-light);
		border-radius: var(--radius-sm);
		background: var(--bg-tertiary);
		color: var(--text-primary);
		font-family: var(--font-cjk);
		font-size: var(--font-size-headline);
		cursor: pointer;
	}
	.panel-char-chip:hover { border-color: var(--accent); color: var(--accent); }
</style>
