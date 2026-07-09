<script lang="ts">
	import type { ReelPageData } from './+page';
	import Header from '$lib/components/Header.svelte';
	import { getDictionaryUrl } from '$lib/shard-utils';
	import { deinflect, formatReasonChains } from '$lib/utils/deinflect';
	import { dev } from '$app/environment';
	import { goto } from '$app/navigation';

	interface TranscriptToken {
		text: string;
		word?: string;
		lookupIndex?: number;
	}

	interface TextValue {
		text: string;
	}

	let { data }: { data: ReelPageData } = $props();
	let videoElement: HTMLVideoElement | undefined = $state();
	let transcriptScroller: HTMLDivElement | undefined = $state();

	let languageFlag = $derived(data.language === 'zh' ? '🇨🇳' : '🇯🇵');
	let currentTime = $state(data.startTime);
	let initializedVideoId = $state<string | null>(null);
	let activeSegmentIndex = $derived(getActiveSegmentIndex(currentTime));
	let activeWordIndex = $derived(getActiveWordIndex(activeSegmentIndex, currentTime));
	let lastAutoScrolledIndex = -1;
	let timeSyncFrame: number | null = null;
	let pendingAlignFrame: number | null = null;

	// Dictionary panel state
	let selectedWord = $state<string | null>(null);
	let panelOpen = $state(false);
	let panelData = $state<any>(null);
	let panelLoading = $state(false);
	let panelLookupWord = $state<string | null>(null);
	let panelInflection = $state<string | null>(null);

	$effect(() => {
		if (videoElement && initializedVideoId !== data.videoId) {
			initializedVideoId = data.videoId;
			lastAutoScrolledIndex = -1;
			videoElement.currentTime = data.startTime;
			currentTime = data.startTime;
			alignSoon(getActiveSegmentIndex(data.startTime), 'auto');
		}
	});

	$effect(() => {
		const index = activeSegmentIndex;
		const scroller = transcriptScroller;
		if (!scroller || index < 0 || index === lastAutoScrolledIndex) return;

		alignSoon(index);
	});

	$effect(() => {
		return () => {
			cancelTimeSync();
			if (pendingAlignFrame !== null) {
				cancelAnimationFrame(pendingAlignFrame);
				pendingAlignFrame = null;
			}
		};
	});

	function setVideoInlineAttributes(node: HTMLVideoElement) {
		node.setAttribute('playsinline', '');
		node.setAttribute('webkit-playsinline', '');
	}

	function alignActiveSegment(index: number, behavior: ScrollBehavior = 'smooth') {
		const scroller = transcriptScroller;
		const active = scroller?.querySelector<HTMLElement>(`[data-segment-index="${index}"]`);
		if (!scroller || !active) return;

		const scrollerRect = scroller.getBoundingClientRect();
		const activeRect = active.getBoundingClientRect();
		const videoRect = videoElement?.getBoundingClientRect();
		const desktop = window.matchMedia('(min-width: 769px)').matches;
		const targetCenter = desktop && videoRect
			? videoRect.top + videoRect.height / 2
			: scrollerRect.top + scrollerRect.height / 2;
		const activeCenter = activeRect.top + activeRect.height / 2;

		scroller.scrollTo({
			top: scroller.scrollTop + activeCenter - targetCenter,
			behavior
		});
	}

	function formatTime(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	function seekTo(time: number) {
		if (videoElement) {
			videoElement.currentTime = time;
			currentTime = time;
			forceAlignCurrentSegment();
			void videoElement.play().catch(() => {});
		}
	}

	function seekToTranscriptSegment(time: number) {
		if (window.matchMedia('(min-width: 769px)').matches) {
			seekTo(time);
		}
	}

	function syncCurrentTime() {
		if (videoElement) currentTime = videoElement.currentTime;
	}

	function syncCurrentTimeAndAlign() {
		syncCurrentTime();
		alignCurrentSegmentIfChanged();
	}

	function forceSyncCurrentTimeAndAlign() {
		syncCurrentTime();
		forceAlignCurrentSegment();
	}

	function alignCurrentSegmentIfChanged() {
		const index = getActiveSegmentIndex(currentTime);
		if (index !== lastAutoScrolledIndex) alignSoon(index);
	}

	function forceAlignCurrentSegment() {
		alignSoon(getActiveSegmentIndex(currentTime));
	}

	function alignSoon(index = getActiveSegmentIndex(currentTime), behavior: ScrollBehavior = 'smooth') {
		if (index < 0) return;
		lastAutoScrolledIndex = index;
		if (pendingAlignFrame !== null) cancelAnimationFrame(pendingAlignFrame);
		pendingAlignFrame = requestAnimationFrame(() => {
			pendingAlignFrame = null;
			alignActiveSegment(index, behavior);
		});
	}

	function startTimeSync() {
		if (timeSyncFrame !== null) return;
		const tick = () => {
			const previousIndex = getActiveSegmentIndex(currentTime);
			syncCurrentTime();
			const nextIndex = getActiveSegmentIndex(currentTime);
			if (nextIndex !== previousIndex && nextIndex !== lastAutoScrolledIndex) {
				alignSoon(nextIndex);
			}
			if (videoElement && !videoElement.paused && !videoElement.ended) {
				timeSyncFrame = requestAnimationFrame(tick);
			} else {
				timeSyncFrame = null;
			}
		};
		timeSyncFrame = requestAnimationFrame(tick);
	}

	function stopTimeSync() {
		cancelTimeSync();
		forceSyncCurrentTimeAndAlign();
	}

	function cancelTimeSync() {
		if (timeSyncFrame !== null) {
			cancelAnimationFrame(timeSyncFrame);
			timeSyncFrame = null;
		}
	}

	function goBack() {
		if (window.history.length > 1) {
			window.history.back();
		} else {
			goto('/');
		}
	}

	function isNativeControlAreaClick(event: MouseEvent, video: HTMLVideoElement): boolean {
		const rect = video.getBoundingClientRect();
		const controlHeight = Math.min(64, rect.height * 0.22);
		return event.clientY >= rect.bottom - controlHeight;
	}

	function preventVideoSurfaceToggle(event: MouseEvent) {
		const video = event.currentTarget as HTMLVideoElement;
		if (isNativeControlAreaClick(event, video)) return;

		const wasPaused = video.paused;
		event.preventDefault();
		event.stopPropagation();

		requestAnimationFrame(() => {
			if (wasPaused && !video.paused) {
				video.pause();
			} else if (!wasPaused && video.paused) {
				void video.play().catch(() => {});
			}
		});
	}

	function getActiveSegmentIndex(time: number): number {
		if (data.transcript.length === 0) return -1;

		let latestStarted = -1;
		for (let i = 0; i < data.transcript.length; i++) {
			const segment = data.transcript[i];
			if (time >= segment.start_time) {
				latestStarted = i;
				continue;
			}
			if (time < segment.start_time) break;
		}
		return latestStarted >= 0 ? latestStarted : 0;
	}

	function lookupWordsForSegment(index: number): string[] {
		const segment = data.transcript[index];
		if (!segment) return [];
		return displayWordsForSegment(segment).filter(isLookupToken);
	}

	function getActiveWordIndex(segmentIndex: number, time: number): number {
		const segment = data.transcript[segmentIndex];
		if (!segment) return -1;

		const words = lookupWordsForSegment(segmentIndex);
		if (words.length === 0) return -1;

		const duration = Math.max(segment.end_time - segment.start_time, 0.1);
		const progress = Math.min(Math.max((time - segment.start_time) / duration, 0), 0.999);
		return Math.floor(progress * words.length);
	}

	function isLookupToken(token: string): boolean {
		return /[\p{L}\p{N}]/u.test(token);
	}

	function wordText(rawWord: string | { word?: string }): string {
		return typeof rawWord === 'string' ? rawWord : rawWord.word ?? '';
	}

	function shouldMergeJapaneseSuffix(previous: string, suffix: string): boolean {
		if (data.language !== 'ja') return false;
		if (!previous || !suffix) return false;
		if (!['て', 'で', 'たら', 'だら', 'たり', 'だり'].includes(suffix)) return false;

		// Avoid merging noun + particle cases like バー + で. These endings are
		// common Japanese verb stem endings before -て/-で/-たら/-たり.
		return /[いきぎしじちっにびみりん来]$/u.test(previous);
	}

	function displayWordsForSegment(segment: ReelPageData['transcript'][number]): string[] {
		const rawWords = segment.words.map(wordText).map((word) => word.trim()).filter(Boolean);
		const merged: string[] = [];

		for (const word of rawWords) {
			const previous = merged[merged.length - 1];
			if (previous && shouldMergeJapaneseSuffix(previous, word)) {
				merged[merged.length - 1] = previous + word;
			} else {
				merged.push(word);
			}
		}

		return merged;
	}

	function escapeRegex(value: string): string {
		return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	function findWordRange(sentence: string, word: string, cursor: number): { start: number; end: number } | null {
		const exactIndex = sentence.indexOf(word, cursor);
		if (exactIndex >= 0) return { start: exactIndex, end: exactIndex + word.length };

		const spacedPattern = Array.from(word).map(escapeRegex).join('\\s*');
		const spacedMatch = new RegExp(spacedPattern, 'u').exec(sentence.slice(cursor));
		if (!spacedMatch || spacedMatch.index < 0) return null;

		const start = cursor + spacedMatch.index;
		return { start, end: start + spacedMatch[0].length };
	}

	function segmentTokens(segment: ReelPageData['transcript'][number]): TranscriptToken[] {
		if (!segment.words.length) return [{ text: segment.sentence }];

		const tokens: TranscriptToken[] = [];
		let cursor = 0;
		let lookupIndex = 0;

		for (const word of displayWordsForSegment(segment)) {
			const range = findWordRange(segment.sentence, word, cursor);
			if (range) {
				if (range.start > cursor) {
					tokens.push({ text: segment.sentence.slice(cursor, range.start) });
				}
				const isWord = isLookupToken(word);
				tokens.push({
					text: word,
					word: isWord ? word : undefined,
					lookupIndex: isWord ? lookupIndex : undefined
				});
				if (isWord) lookupIndex += 1;
				cursor = range.end;
			} else {
				const isWord = isLookupToken(word);
				tokens.push({
					text: word,
					word: isWord ? word : undefined,
					lookupIndex: isWord ? lookupIndex : undefined
				});
				if (isWord) lookupIndex += 1;
			}
		}

		if (cursor < segment.sentence.length) {
			tokens.push({ text: segment.sentence.slice(cursor) });
		}

		return tokens.length ? tokens : [{ text: segment.sentence }];
	}

	// Dictionary panel — same pattern as artifact detail page
	async function fetchDictEntry(word: string): Promise<any> {
		const urls = [await getDictionaryUrl(word, dev, fetch)];
		if (dev) urls.push(await getDictionaryUrl(word, false, fetch));

		for (const url of [...new Set(urls)]) {
			try {
				const resp = await fetch(url);
				if (!resp.ok) continue;
				const { inflateSync } = await import('fflate');
				const compressed = new Uint8Array(await resp.arrayBuffer());
				const decompressed = inflateSync(compressed);
				return JSON.parse(new TextDecoder().decode(decompressed));
			} catch {
				continue;
			}
		}
		return null;
	}

	function formatInflectionLabel(surface: string, dictionaryForm: string, conjugationInfo: string): string {
		if (/[てで]$/u.test(surface) && conjugationInfo.includes('-te')) {
			return `Command/request て-form of ${dictionaryForm}`;
		}
		return `${conjugationInfo} of ${dictionaryForm}`;
	}

	async function fetchJapaneseDeinflectedEntry(surface: string): Promise<{ entry: any; word: string; label: string } | null> {
		const candidates = deinflect(surface)
			.filter((candidate) => candidate.word !== surface && candidate.reasonChains.length > 0)
			.sort((left, right) => {
				const leftLen = left.reasonChains.reduce((sum, chain) => sum + chain.length, 0);
				const rightLen = right.reasonChains.reduce((sum, chain) => sum + chain.length, 0);
				return leftLen - rightLen;
			});

		const seen = new Set<string>();
		for (const candidate of candidates) {
			if (seen.has(candidate.word)) continue;
			seen.add(candidate.word);

			let entry = await fetchDictEntry(candidate.word);
			if (entry?.redirect) entry = await fetchDictEntry(entry.redirect);
			if (!entry) continue;

			const conjugationInfo = formatReasonChains(candidate.reasonChains);
			return {
				entry,
				word: candidate.word,
				label: formatInflectionLabel(surface, candidate.word, conjugationInfo)
			};
		}

		return null;
	}

	async function openWordPanel(word: string) {
		if (!isLookupToken(word)) return;
		videoElement?.pause();
		selectedWord = word;
		panelLookupWord = word;
		panelInflection = null;
		panelOpen = true;
		panelData = null;
		panelLoading = true;

		try {
			let entry = await fetchDictEntry(word);

			// Follow redirects
			if (entry?.redirect) entry = await fetchDictEntry(entry.redirect);

			// Deconjugation fallback for Japanese
			if (!entry && data.language === 'ja') {
				const deinflected = await fetchJapaneseDeinflectedEntry(word);
				if (deinflected) {
					entry = deinflected.entry;
					panelLookupWord = deinflected.word;
					panelInflection = deinflected.label;
				}
			}

			// Compound splitting fallback
			if (!entry && word.length >= 4) {
				for (let i = 2; i < word.length - 1; i++) {
					const [l, r] = await Promise.all([fetchDictEntry(word.slice(0, i)), fetchDictEntry(word.slice(i))]);
					if (l && r) {
						panelLookupWord = word.slice(0, i);
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
		panelLookupWord = null;
		panelInflection = null;
	}

	function navigateToWord() {
		const word = panelLookupWord ?? selectedWord;
		if (word) {
			if (panelData) goto(`/${encodeURIComponent(word)}`);
			else goto(`/search?q=${encodeURIComponent(word)}`);
		}
	}

	function isSelectedToken(word: string): boolean {
		return selectedWord === word;
	}
</script>

<svelte:head>
	<title>{languageFlag} Reel | Kiokun</title>
</svelte:head>

<div class="reel-header">
	<Header />
</div>

<main class="layout" class:panel-open={panelOpen}>
	<button type="button" class="reel-back-button" aria-label="Back" onclick={goBack}>
		<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
			<path d="m15 18-6-6 6-6" />
		</svg>
	</button>
	<div class="main-content">
		<div class="reel-grid">
			<!-- Left: Video player -->
			<div class="video-col">
				<div class="video-wrapper">
					<!-- svelte-ignore a11y_media_has_caption -->
					<video
						bind:this={videoElement}
						src={data.videoUrl}
						poster={data.posterUrl ?? undefined}
						class="video-player"
						use:setVideoInlineAttributes
						controls
						preload="metadata"
						playsinline
						onclick={preventVideoSurfaceToggle}
						ontimeupdate={syncCurrentTimeAndAlign}
						onplay={startTimeSync}
						onplaying={startTimeSync}
						onpause={stopTimeSync}
						onended={stopTimeSync}
						onseeking={forceSyncCurrentTimeAndAlign}
						onseeked={forceSyncCurrentTimeAndAlign}
						onloadedmetadata={forceSyncCurrentTimeAndAlign}
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
				{#if data.transcript.length === 0}
					<p class="empty">No transcript available.</p>
				{:else}
					<div class="transcript-scroll" bind:this={transcriptScroller}>
						<div class="segments">
							{#each data.transcript as segment, segmentIndex}
								<div
									class="segment"
									class:active={segmentIndex === activeSegmentIndex}
									class:past={segmentIndex < activeSegmentIndex}
									class:future={segmentIndex > activeSegmentIndex}
									data-segment-index={segmentIndex}
									onclick={() => seekToTranscriptSegment(segment.start_time)}
									role="button"
									tabindex="0"
									onkeydown={(e) => e.key === 'Enter' && seekToTranscriptSegment(segment.start_time)}
								>
									<span class="segment-time">{formatTime(segment.start_time)}</span>
									<div class="segment-text">
										{#each segmentTokens(segment) as token}
											{#if token.word}
												<button
													class="word-token"
													class:selected={isSelectedToken(token.word ?? '')}
													class:current={segmentIndex === activeSegmentIndex && token.lookupIndex === activeWordIndex}
													onclick={(e) => { e.stopPropagation(); openWordPanel(token.word ?? ''); }}
												>{token.text}</button>
											{:else}
												<span class="non-word">{token.text}</span>
											{/if}
										{/each}
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Dictionary Panel -->
	{#if panelOpen}
		<button type="button" class="panel-overlay" aria-label="Close dictionary" onclick={closePanel}></button>
		<div class="dictionary-panel">
			<div class="panel-header">
				<h3 class="panel-word">{selectedWord}</h3>
				<div class="panel-actions">
					{#if panelData}
						<button class="panel-open-btn" onclick={navigateToWord}>Open →</button>
					{/if}
					<button class="panel-close-btn" onclick={closePanel}>×</button>
				</div>
			</div>
			<div class="panel-body">
				{#if panelLoading}
					<p class="panel-status">Loading...</p>
				{:else}
					{#if panelInflection}
						<div class="panel-inflection">{panelInflection}</div>
					{/if}
					{#if panelData?._compound}
						{#each [{ word: panelData.leftWord, data: panelData.left }, { word: panelData.rightWord, data: panelData.right }] as part}
							<div class="compound-part">
								<h4 class="compound-word">{part.word}</h4>
								{#if part.data.japanese_words?.length > 0}
									{#each part.data.japanese_words.slice(0, 1) as jw}
										{#if jw.kana?.length > 0}
											<div class="panel-reading">{jw.kana.map((k: TextValue) => k.text).join(', ')}</div>
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
									<div class="panel-reading">{jw.kana.map((k: TextValue) => k.text).join(', ')}</div>
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
									<div class="panel-reading">{jw.kana.map((k: TextValue) => k.text).join(', ')}</div>
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
				{/if}
			</div>
		</div>
	{/if}
</main>

<style>
	.layout {
		max-width: 1440px;
		margin: 0 auto;
		padding: clamp(16px, 2vw, 28px);
		position: relative;
	}

	@media (min-width: 769px) {
		.layout {
			--desktop-reel-max-height: calc(100vh - 96px);
		}
		.layout.panel-open {
			max-width: 1540px;
			display: grid;
			grid-template-columns: minmax(0, 1fr) 380px;
			gap: var(--spacing-xl);
			align-items: start;
		}
		.layout.panel-open .panel-overlay { display: none; }
	}

	.main-content { min-width: 0; }

	.reel-grid {
		display: grid;
		grid-template-columns: minmax(340px, 520px) minmax(420px, 1fr);
		gap: clamp(36px, 5vw, 80px);
		align-items: center;
		min-height: calc(100vh - 120px);
	}

	.video-col {
		position: sticky;
		top: 72px;
		align-self: center;
	}
	.video-wrapper {
		width: min(100%, calc(var(--desktop-reel-max-height, calc(100vh - 150px)) * 9 / 16));
		max-width: 520px;
		aspect-ratio: 9 / 16;
		margin-inline: auto;
		border-radius: var(--radius-md);
		background: black;
		box-shadow: 0 12px 36px rgba(0, 0, 0, 0.18);
	}
	.video-player {
		width: 100%;
		height: 100%;
		max-height: var(--desktop-reel-max-height, calc(100vh - 150px));
		aspect-ratio: 9 / 16;
		object-fit: cover;
		background: black;
		border-radius: var(--radius-md);
		display: block;
		transform: translateZ(0);
		-webkit-transform: translateZ(0);
	}

	.video-meta {
		width: min(100%, calc(var(--desktop-reel-max-height, calc(100vh - 150px)) * 9 / 16));
		max-width: 520px;
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
		margin: var(--spacing-md) auto 0;
		font-size: var(--font-size-caption1);
	}
	.meta-link { color: var(--accent); text-decoration: none; }
	.meta-link:hover { text-decoration: underline; }
	.meta-duration { color: var(--text-muted); }

	.transcript-col {
		min-width: 0;
		position: sticky;
		top: 72px;
		height: calc(100vh - 96px);
		display: flex;
		flex-direction: column;
	}
	.empty { color: var(--text-muted); }

	.transcript-scroll {
		min-height: 0;
		flex: 1;
		overflow-y: auto;
		scroll-behavior: smooth;
		scroll-padding-block: 45%;
		-webkit-overflow-scrolling: touch;
	}

	.transcript-scroll::-webkit-scrollbar { width: 8px; }
	.transcript-scroll::-webkit-scrollbar-thumb {
		background: var(--border-color);
		border-radius: var(--radius-full);
	}

	.segments {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
		padding-block: 38vh;
	}

	.segment {
		display: flex;
		gap: var(--spacing-md);
		padding: var(--spacing-md) var(--spacing-lg);
		border-radius: var(--radius-md);
		background: transparent;
		border: 1px solid transparent;
		cursor: pointer;
		opacity: 0.58;
		transition: opacity 0.18s, border-color 0.18s, background-color 0.18s, transform 0.18s;
	}
	.segment.past { opacity: 0.32; }
	.segment.future { opacity: 0.5; }
	.segment.active {
		opacity: 1;
		background: var(--bg-secondary);
		border-color: var(--border-color);
		transform: translateX(0);
		box-shadow: 0 8px 28px rgba(0, 0, 0, 0.06);
	}
	.segment:hover { border-color: var(--accent); opacity: 1; }

	.segment-time {
		font-size: var(--font-size-caption1); color: var(--text-muted);
		flex-shrink: 0; padding-top: 6px; min-width: 38px;
	}

	.segment-text {
		font-size: var(--font-size-headline); line-height: 1.8;
		font-family: var(--font-cjk); color: var(--text-primary);
		display: block;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.word-token {
		display: inline; background: none; border: none;
		border-bottom: 2px solid transparent;
		padding: 0 1px; margin: 0; font: inherit; color: inherit;
		cursor: pointer; transition: border-color 0.15s, color 0.15s;
	}
	.word-token:hover { border-bottom-color: var(--accent); color: var(--accent); }
	.word-token.selected,
	.word-token.current {
		border-bottom-color: var(--accent);
		color: var(--accent);
		background: var(--accent-light);
	}
	.non-word { display: inline; }

	/* Dictionary Panel — same as artifact page */
	.panel-overlay {
		position: fixed;
		inset: 0;
		padding: 0;
		border: none;
		background: rgba(0,0,0,0.3);
		z-index: 200;
		cursor: pointer;
	}
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
	.panel-inflection {
		margin-bottom: var(--spacing-md);
		padding: var(--spacing-sm) var(--spacing-md);
		border-radius: var(--radius-sm);
		background: var(--accent-light);
		color: var(--accent);
		font-size: var(--font-size-callout);
		font-weight: 600;
	}
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

	.reel-back-button {
		display: none;
	}

	@media (max-width: 768px) {
		.reel-header { display: none; }

				.layout {
					--reel-home-clearance: max(54px, calc(env(safe-area-inset-bottom) + 22px));
					--reel-control-clearance: calc(var(--reel-home-clearance) + 96px);
					max-width: none;
					height: 100vh;
					min-height: 100vh;
				height: 100dvh;
				min-height: 100dvh;
				height: 100svh;
				min-height: 100svh;
				margin: 0;
				padding: 0;
				overflow: hidden;
				background: #000;
			}

		.reel-back-button {
			position: fixed;
			top: calc(env(safe-area-inset-top) + 12px);
			left: 12px;
			z-index: 20;
			display: flex;
			align-items: center;
			justify-content: center;
			width: 46px;
			height: 46px;
			border: 1px solid rgba(255, 255, 255, 0.16);
			border-radius: 999px;
			background: rgba(0, 0, 0, 0.48);
			color: #fff;
			box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
			backdrop-filter: blur(10px);
		}

			.main-content,
			.reel-grid {
				height: 100vh;
				min-height: 100vh;
				height: 100dvh;
				min-height: 100dvh;
				height: 100svh;
				min-height: 100svh;
			}

		.reel-grid {
			display: block;
			position: relative;
		}

				.video-col {
					position: absolute;
					inset: 0 0 var(--reel-home-clearance) 0;
					height: auto;
					min-height: 0;
					align-self: stretch;
					transform: none;
				}

		.video-wrapper {
			width: 100%;
			max-width: none;
			height: 100%;
			border-radius: 0;
			box-shadow: none;
		}

		.video-player {
			width: 100%;
			height: 100%;
			max-height: none;
			border-radius: 0;
			object-fit: cover;
		}

		.video-meta {
			width: auto;
			max-width: none;
			position: absolute;
			top: calc(env(safe-area-inset-top) + 12px);
			left: 12px;
			right: 12px;
			z-index: 5;
			margin: 0;
			color: white;
			text-shadow: 0 1px 8px rgba(0, 0, 0, 0.8);
		}

		.video-meta .meta-link,
		.video-meta .meta-duration {
			color: rgba(255, 255, 255, 0.86);
		}

		.transcript-col {
			position: absolute;
			top: auto;
			left: 0;
			right: 0;
			bottom: var(--reel-control-clearance);
			z-index: 6;
			height: min(34svh, 300px);
			padding: 0 16px;
			pointer-events: none;
			background: linear-gradient(
				to bottom,
				rgba(0, 0, 0, 0),
				rgba(0, 0, 0, 0.18) 22%,
				rgba(0, 0, 0, 0.18) 78%,
				rgba(0, 0, 0, 0)
			);
		}

		.transcript-scroll {
			height: 100%;
			pointer-events: auto;
			scroll-padding-block: 42%;
			scrollbar-width: none;
		}

		.transcript-scroll::-webkit-scrollbar { display: none; }

		.segments {
			gap: 2px;
			padding-block: 12svh;
		}

		.segment {
			display: block;
			padding: 4px 9px;
			color: rgba(255, 255, 255, 0.72);
			text-shadow: 0 2px 10px rgba(0, 0, 0, 0.86);
			background: transparent;
			border-color: transparent;
			box-shadow: none;
			opacity: 0.5;
		}

		.segment.past { opacity: 0.3; }
		.segment.future { opacity: 0.48; }

		.segment.active {
			color: white;
			opacity: 1;
			background: rgba(0, 0, 0, 0.26);
			border-color: rgba(255, 255, 255, 0.12);
			box-shadow: none;
			backdrop-filter: blur(4px);
			padding: 7px 10px;
		}

		.segment-time { display: none; }

		.segment-text {
			font-size: 16px;
			line-height: 1.35;
			text-align: center;
			color: inherit;
		}

		.segment.active .segment-text {
			font-size: 18px;
			line-height: 1.45;
		}

		.word-token:hover,
		.word-token.selected,
		.word-token.current {
			color: #fff;
			border-bottom-color: rgba(255, 255, 255, 0.88);
			background: rgba(255, 255, 255, 0.16);
		}

		.dictionary-panel {
			z-index: 210;
			background: var(--bg-secondary);
		}
	}
</style>
