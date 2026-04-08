<script lang="ts">
	import type { ReelPageData } from './+page';
	import Header from '$lib/components/Header.svelte';
	import { getDictionaryUrl } from '$lib/shard-utils';
	import { dev } from '$app/environment';
	import { goto } from '$app/navigation';

	let { data }: { data: ReelPageData } = $props();
	let videoElement: HTMLVideoElement | undefined = $state();

	let languageFlag = $derived(data.language === 'zh' ? '🇨🇳' : '🇯🇵');

	// Dictionary panel state
	let selectedWord = $state<string | null>(null);
	let panelOpen = $state(false);
	let panelData = $state<any>(null);
	let panelLoading = $state(false);

	$effect(() => {
		if (videoElement && data.startTime > 0) {
			videoElement.currentTime = data.startTime;
		}
	});

	function formatTime(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	function seekTo(time: number) {
		if (videoElement) {
			videoElement.currentTime = time;
			videoElement.play();
		}
	}

	function isFullTranscript(words: string[]): boolean {
		return words.length >= 3 && words.every(w => w.length <= 6);
	}

	// Dictionary panel — same pattern as artifact detail page
	async function fetchDictEntry(word: string): Promise<any> {
		try {
			const url = await getDictionaryUrl(word, dev, fetch);
			const resp = await fetch(url);
			if (!resp.ok) return null;
			const { inflateSync } = await import('fflate');
			const compressed = new Uint8Array(await resp.arrayBuffer());
			const decompressed = inflateSync(compressed);
			return JSON.parse(new TextDecoder().decode(decompressed));
		} catch { return null; }
	}

	function guessJapaneseDictionaryForms(stem: string): string[] {
		const guesses: string[] = [];
		const last = stem.slice(-1);
		const map: Record<string, string[]> = {
			'か':['く'],'き':['く'],'い':['く','いる','う'],
			'が':['がす','がる','ぐ'],'ぎ':['ぐ'],
			'さ':['す'],'し':['す','する'],
			'っ':['る','つ','う'],
			'え':['える'],'け':['ける'],'せ':['せる'],
			'め':['める'],'れ':['れる'],
			'ら':['る'],'り':['る'],
		};
		const endings = map[last];
		if (endings) {
			const base = stem.slice(0, -1);
			for (const e of endings) guesses.push(base + e);
		}
		guesses.push(stem + 'る', stem + 'す', stem + 'く');
		return guesses;
	}

	async function openWordPanel(word: string) {
		selectedWord = word;
		panelOpen = true;
		panelData = null;
		panelLoading = true;

		try {
			let entry = await fetchDictEntry(word);

			// Follow redirects
			if (entry?.redirect) entry = await fetchDictEntry(entry.redirect);

			// Deconjugation fallback for Japanese
			if (!entry && data.language === 'ja') {
				for (const guess of guessJapaneseDictionaryForms(word)) {
					entry = await fetchDictEntry(guess);
					if (entry?.redirect) entry = await fetchDictEntry(entry.redirect);
					if (entry) { selectedWord = word + ' → ' + guess; break; }
				}
			}

			// Compound splitting fallback
			if (!entry && word.length >= 4) {
				for (let i = 2; i < word.length - 1; i++) {
					const [l, r] = await Promise.all([fetchDictEntry(word.slice(0, i)), fetchDictEntry(word.slice(i))]);
					if (l && r) {
						selectedWord = word.slice(0, i) + ' + ' + word.slice(i);
						entry = { _compound: true, left: l, right: r, leftWord: word.slice(0, i), rightWord: word.slice(i) };
						break;
					}
				}
			}

			panelData = entry;
		} catch {
			panelData = null;
		} finally {
			panelLoading = false;
		}
	}

	function closePanel() {
		panelOpen = false;
		selectedWord = null;
		panelData = null;
	}

	function navigateToWord() {
		if (selectedWord) {
			const word = selectedWord.includes(' → ') ? selectedWord.split(' → ')[1] : selectedWord.includes(' + ') ? selectedWord.split(' + ')[0] : selectedWord;
			goto(`/${word}`);
		}
	}

	// Check if word is all kana (for old-format matching)
	function isWordInSentence(word: string, sentence: string, char: string): boolean {
		return sentence.includes(word) && word.includes(char);
	}
	function findMatchingWord(words: string[], char: string): string | undefined {
		return words.find(w => w.includes(char));
	}
</script>

<svelte:head>
	<title>{languageFlag} Reel | Kiokun</title>
</svelte:head>

<Header />

<main class="layout" class:panel-open={panelOpen}>
	<div class="main-content">
		<div class="reel-grid">
			<!-- Left: Video player -->
			<div class="video-col">
				<div class="video-wrapper">
					<!-- svelte-ignore a11y_media_has_caption -->
					<video
						bind:this={videoElement}
						src={data.videoUrl}
						class="video-player"
						controls
						playsinline
					></video>
				</div>

				<div class="video-meta">
					{#if data.author}
						<span class="meta-item">
							<a href="https://www.instagram.com/{data.author.replace('@', '')}/" target="_blank" rel="noopener noreferrer" class="meta-link">{data.author}</a>
						</span>
					{/if}
					{#if data.sourceUrl}
						<a href={data.sourceUrl} target="_blank" rel="noopener noreferrer" class="meta-link">Instagram ↗</a>
					{/if}
					{#if data.duration}
						<span class="meta-duration">{formatTime(data.duration)}</span>
					{/if}
				</div>
			</div>

			<!-- Right: Transcript -->
			<div class="transcript-col">
				<h2 class="transcript-heading">{languageFlag} Transcript</h2>

				{#if data.transcript.length === 0}
					<p class="empty">No transcript available.</p>
				{:else}
					<div class="segments">
						{#each data.transcript as segment}
							<div class="segment" onclick={() => seekTo(segment.start_time)} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && seekTo(segment.start_time)}>
								<span class="segment-time">{formatTime(segment.start_time)}</span>
								<div class="segment-text">
									{#if isFullTranscript(segment.words)}
										{#each segment.words as word}
											{#if word.trim()}
												<button
													class="word-token"
													class:selected={selectedWord?.split(' → ')[0] === word || selectedWord?.split(' + ')[0] === word}
													onclick={(e) => { e.stopPropagation(); openWordPanel(word); }}
												>{word}</button>
											{/if}
										{/each}
									{:else}
										{#each segment.sentence.split('') as char}
											{#if segment.words.some(w => isWordInSentence(w, segment.sentence, char))}
												{@const matchingWord = findMatchingWord(segment.words, char)}
												<button
													class="word-token"
													class:selected={selectedWord === matchingWord}
													onclick={(e) => { e.stopPropagation(); if (matchingWord) openWordPanel(matchingWord); }}
												>{char}</button>
											{:else}
												<span class="non-word">{char}</span>
											{/if}
										{/each}
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
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
							{#if part.data.japanese_words?.length > 0}
								{#each part.data.japanese_words.slice(0, 1) as jw}
									{#if jw.kana?.length > 0}
										<div class="panel-reading">{jw.kana.map((k) => k.text).join(', ')}</div>
									{/if}
									{#each jw.sense?.slice(0, 2) || [] as sense}
										<ol class="panel-defs">
											{#each sense.gloss || [] as gloss}
												<li>{gloss.text}</li>
											{/each}
										</ol>
									{/each}
								{/each}
							{/if}
							{#if part.data.chinese_words?.length > 0}
								{#each part.data.chinese_words[0].items?.slice(0, 1) || [] as item}
									{#if item.pinyin}<span class="panel-pinyin">{item.pinyin}</span>{/if}
									<ol class="panel-defs">
										{#each item.definitions?.slice(0, 3) || [] as def}
											<li>{def}</li>
										{/each}
									</ol>
								{/each}
							{/if}
						</div>
					{/each}
				{:else if panelData}
					<!-- Show reel's language first -->
					{#if data.language === 'ja'}
						{#if panelData.japanese_words?.length > 0}
							{#each panelData.japanese_words.slice(0, 3) as jw}
								{#if jw.kana?.length > 0}
									<div class="panel-reading">{jw.kana.map((k) => k.text).join(', ')}</div>
								{/if}
								{#each jw.sense?.slice(0, 3) || [] as sense}
									<div class="panel-sense">
										{#if sense.partOfSpeech?.length > 0}
											<span class="panel-pos">{sense.partOfSpeech.join(', ')}</span>
										{/if}
										<ol class="panel-defs">
											{#each sense.gloss || [] as gloss}<li>{gloss.text}</li>{/each}
										</ol>
									</div>
								{/each}
							{/each}
						{/if}
						{#if panelData.chinese_words?.length > 0}
							<div class="panel-divider"></div>
							{#each panelData.chinese_words as cw}
								{#each cw.items || [] as item}
									{#if item.definitions?.length}
										<div class="panel-sense">
											{#if item.pinyin}<span class="panel-pinyin">{item.pinyin}</span>{/if}
											<ol class="panel-defs">
												{#each item.definitions as def}<li>{def}</li>{/each}
											</ol>
										</div>
									{/if}
								{/each}
							{/each}
						{/if}
					{:else}
						{#if panelData.chinese_words?.length > 0}
							{#each panelData.chinese_words as cw}
								{#each cw.items || [] as item}
									{#if item.definitions?.length}
										<div class="panel-sense">
											{#if item.pinyin}<span class="panel-pinyin">{item.pinyin}</span>{/if}
											<ol class="panel-defs">
												{#each item.definitions as def}<li>{def}</li>{/each}
											</ol>
										</div>
									{/if}
								{/each}
							{/each}
						{/if}
						{#if panelData.japanese_words?.length > 0}
							<div class="panel-divider"></div>
							{#each panelData.japanese_words.slice(0, 3) as jw}
								{#if jw.kana?.length > 0}
									<div class="panel-reading">{jw.kana.map((k) => k.text).join(', ')}</div>
								{/if}
								{#each jw.sense?.slice(0, 3) || [] as sense}
									<div class="panel-sense">
										{#if sense.partOfSpeech?.length > 0}
											<span class="panel-pos">{sense.partOfSpeech.join(', ')}</span>
										{/if}
										<ol class="panel-defs">
											{#each sense.gloss || [] as gloss}<li>{gloss.text}</li>{/each}
										</ol>
									</div>
								{/each}
							{/each}
						{/if}
					{/if}
					{#if panelData.korean_words?.length > 0}
						<div class="panel-divider"></div>
						{#each panelData.korean_words.slice(0, 3) as kw}
							<div class="panel-sense">
								{#if kw.hangul}<span class="panel-reading">{kw.hangul}</span>{/if}
								<ol class="panel-defs">
									{#each kw.definitions || [] as def}<li>{def.text}</li>{/each}
								</ol>
							</div>
						{/each}
					{/if}
					{#if !panelData.chinese_words?.length && !panelData.japanese_words?.length && !panelData.korean_words?.length}
						<p class="panel-status">No dictionary entry found</p>
					{/if}
				{:else}
					<p class="panel-status">No entry found for "{selectedWord}"</p>
					<p class="panel-hint"><button class="link-btn" onclick={navigateToWord}>Search for it</button></p>
				{/if}
			</div>
		</div>
	{/if}
</main>

<style>
	.layout { max-width: 960px; margin: 0 auto; padding: var(--spacing-lg); position: relative; }

	@media (min-width: 769px) {
		.layout.panel-open { max-width: 1280px; display: grid; grid-template-columns: 1fr 380px; gap: var(--spacing-xl); }
		.layout.panel-open .panel-overlay { display: none; }
	}

	.main-content { min-width: 0; }

	.reel-grid { display: grid; grid-template-columns: 280px 1fr; gap: var(--spacing-xl); align-items: start; }

	.video-col { position: sticky; top: 80px; }
	.video-wrapper { border-radius: var(--radius-md); overflow: hidden; background: black; }
	.video-player { width: 100%; height: auto; display: block; }

	.video-meta { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); margin-top: var(--spacing-md); font-size: var(--font-size-caption1); }
	.meta-link { color: var(--accent); text-decoration: none; }
	.meta-link:hover { text-decoration: underline; }
	.meta-duration { color: var(--text-muted); }

	.transcript-col { min-width: 0; }
	.transcript-heading { font-size: var(--font-size-headline); font-weight: 600; color: var(--text-primary); margin: 0 0 var(--spacing-lg); }
	.empty { color: var(--text-muted); }

	.segments { display: flex; flex-direction: column; gap: var(--spacing-sm); }

	.segment {
		display: flex; gap: var(--spacing-md); padding: var(--spacing-md);
		border-radius: var(--radius-md); background: var(--bg-secondary);
		border: 1px solid var(--border-color); cursor: pointer;
		transition: border-color 0.15s;
	}
	.segment:hover { border-color: var(--accent); }

	.segment-time {
		font-size: var(--font-size-caption1); color: var(--text-muted);
		flex-shrink: 0; padding-top: 4px; min-width: 36px;
	}

	.segment-text {
		font-size: var(--font-size-headline); line-height: 1.8;
		font-family: var(--font-cjk); color: var(--text-primary);
		display: flex; flex-wrap: wrap; align-items: baseline;
	}

	.word-token {
		display: inline; background: none; border: none;
		border-bottom: 2px solid transparent;
		padding: 0 1px; margin: 0; font: inherit; color: inherit;
		cursor: pointer; transition: border-color 0.15s, color 0.15s;
	}
	.word-token:hover { border-bottom-color: var(--accent); color: var(--accent); }
	.word-token.selected { border-bottom-color: var(--accent); color: var(--accent); background: var(--accent-light); }
	.non-word { display: inline; }

	/* Dictionary Panel — same as artifact page */
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
			border-radius: var(--radius-lg) var(--radius-lg) 0 0;
			box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
		}
	}

	.panel-header {
		display: flex; justify-content: space-between; align-items: center;
		padding: var(--spacing-lg); border-bottom: 1px solid var(--border-color); flex-shrink: 0;
	}
	.panel-word { font-size: var(--font-size-title); font-weight: 700; color: var(--text-primary); margin: 0; font-family: var(--font-cjk); }
	.panel-actions { display: flex; gap: var(--spacing-sm); align-items: center; }
	.panel-open-btn {
		padding: var(--spacing-xs) var(--spacing-md); border: 1px solid var(--accent);
		border-radius: var(--radius-md); background: transparent; color: var(--accent);
		font-size: var(--font-size-caption1); cursor: pointer;
	}
	.panel-open-btn:hover { background: var(--accent-light); }
	.panel-close-btn {
		width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--border-color);
		background: var(--bg-secondary); color: var(--text-secondary); font-size: 20px;
		cursor: pointer; display: flex; align-items: center; justify-content: center;
	}

	.panel-body { padding: var(--spacing-lg); overflow-y: auto; flex: 1; }
	.panel-status { color: var(--text-muted); font-size: var(--font-size-callout); }
	.panel-reading { font-size: var(--font-size-body); color: var(--accent); margin-bottom: var(--spacing-sm); }
	.panel-pinyin { font-size: var(--font-size-callout); color: var(--color-pinyin); display: block; margin-bottom: var(--spacing-xs); }
	.panel-pos { font-size: var(--font-size-caption1); color: var(--text-muted); font-style: italic; display: block; margin-bottom: var(--spacing-xs); }
	.panel-sense { margin-bottom: var(--spacing-md); }
	.panel-divider { border-top: 1px solid var(--border-color); margin: var(--spacing-md) 0; }
	.panel-defs { margin: 0; padding-left: var(--spacing-xl); font-size: var(--font-size-body); color: var(--text-primary); line-height: 1.6; }
	.panel-hint { font-size: var(--font-size-caption1); color: var(--text-muted); }
	.link-btn { background: none; border: none; color: var(--accent); cursor: pointer; font: inherit; text-decoration: underline; padding: 0; }

	.compound-part { padding-bottom: var(--spacing-md); margin-bottom: var(--spacing-md); border-bottom: 1px solid var(--border-color); }
	.compound-part:last-child { border-bottom: none; margin-bottom: 0; }
	.compound-word { font-size: var(--font-size-headline); font-family: var(--font-cjk); color: var(--accent); margin: 0 0 var(--spacing-xs); font-weight: 600; }

	@media (max-width: 768px) {
		.reel-grid { grid-template-columns: 1fr; }
		.video-col { position: static; }
		.video-wrapper { max-width: 300px; margin: 0 auto; }
	}
</style>
