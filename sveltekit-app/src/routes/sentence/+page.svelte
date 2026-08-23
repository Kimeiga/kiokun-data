<script lang="ts">
	import { page } from '$app/stores';
	import { useSession } from '$lib/auth-client';
	import Header from '$lib/components/Header.svelte';
	import JapaneseRubyText from '$lib/components/JapaneseRubyText.svelte';
	import Notes from '$lib/components/Notes.svelte';
	import SaveToStudy from '$lib/components/SaveToStudy.svelte';
	import SentenceBar from '$lib/components/SentenceBar.svelte';
	import {
		buildAnnotatedSentenceSegments,
		compactSentenceGloss,
		type AnnotatedSentenceSegment,
		type SentenceLanguage,
		type SentenceWordAnalysis,
	} from '$lib/sentence-analysis';
	import {
		buildChineseRubySegments,
		buildJapaneseRubySegments,
		buildKoreanRubySegments,
		type RubySegment,
	} from '$lib/utils/sentence-ruby';

	const session = useSession();

	let text = $derived($page.url.searchParams.get('text') || '');
	let providedTranslation = $derived($page.url.searchParams.get('en') || '');
	let lang = $derived.by((): SentenceLanguage => {
		const requested = $page.url.searchParams.get('lang');
		return requested === 'zh' || requested === 'ko' ? requested : 'ja';
	});
	let pinyin = $derived($page.url.searchParams.get('py') || '');
	let from = $derived($page.url.searchParams.get('from') || '');

	let langLabel = $derived(lang === 'ja' ? 'Japanese' : lang === 'zh' ? 'Chinese' : 'Korean');
	let langAttr = $derived(lang === 'ja' ? 'ja' : lang === 'zh' ? 'zh' : 'ko');
	let langFlag = $derived(lang === 'ja' ? '🇯🇵' : lang === 'zh' ? '🇨🇳' : '🇰🇷');

	let analyzedWords = $state<SentenceWordAnalysis[]>([]);
	let analysisLoading = $state(false);
	let analysisError = $state(false);
	let generatedTranslation = $state('');
	let translationProvider = $state('');
	let translationLoading = $state(false);
	let translationError = $state(false);
	let translationRequest = 0;

	let autoSaveSentences = $state(false);
	let settingsLoaded = $state(false);
	let settingsSaving = $state(false);
	let saveState = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let savedSentenceId = $state('');
	let signInHint = $state(false);
	let selectedWordKey = $state('');
	let lastAutoSavedKey = '';

	let baseDisplayTokens = $derived.by((): RubySegment[] => {
		if (!text) return [];
		if (lang === 'zh') return buildChineseRubySegments(text, pinyin);
		if (lang === 'ko') return buildKoreanRubySegments(text);
		return buildJapaneseRubySegments(text);
	});

	function fallbackWords(tokens: RubySegment[]): SentenceWordAnalysis[] {
		const words: SentenceWordAnalysis[] = [];
		let position = 0;
		for (const token of tokens) {
			if (token.isWord) {
				words.push({
					surfaceForm: token.text,
					wordSlug: token.text,
					position,
					dictionaryForm: null,
					reading: token.reading || null,
					gloss: null,
					conjugation: null,
				});
			}
			position += token.text.length;
		}
		return words;
	}

	let visibleWords = $derived(analyzedWords.length ? analyzedWords : fallbackWords(baseDisplayTokens));
	let displaySegments = $derived.by((): AnnotatedSentenceSegment[] =>
		buildAnnotatedSentenceSegments(text, visibleWords)
	);
	let displayTranslation = $derived(providedTranslation || generatedTranslation);

	function wordTarget(word: SentenceWordAnalysis): string {
		return word.dictionaryForm || word.wordSlug || word.surfaceForm;
	}

	function wordHref(target: string): string {
		return `/${encodeURIComponent(target)}`;
	}

	function wordKey(word: SentenceWordAnalysis, index: number): string {
		return `${word.position}:${word.surfaceForm}:${index}`;
	}

	function wordAriaLabel(segment: AnnotatedSentenceSegment): string {
		return [
			segment.text,
			segment.reading ? `reading ${segment.reading}` : '',
			segment.definition || '',
			'open dictionary entry',
		].filter(Boolean).join(', ');
	}

	async function loadAnalysis(currentText: string, currentLanguage: SentenceLanguage, signal: AbortSignal) {
		analysisLoading = true;
		analysisError = false;
		analyzedWords = [];
		try {
			const response = await fetch('/api/sentence/analyze', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text: currentText, language: currentLanguage }),
				signal,
			});
			if (!response.ok) throw new Error(`Sentence analysis failed (${response.status})`);
			const result = await response.json();
			if (!signal.aborted && text === currentText && lang === currentLanguage) {
				analyzedWords = result.words || [];
			}
		} catch (error) {
			if (!signal.aborted) analysisError = true;
		} finally {
			if (!signal.aborted) analysisLoading = false;
		}
	}

	$effect(() => {
		const currentText = text;
		const currentLanguage = lang;
		saveState = 'idle';
		savedSentenceId = '';
		selectedWordKey = '';
		lastAutoSavedKey = '';
		if (!currentText) {
			analyzedWords = [];
			analysisLoading = false;
			return;
		}

		const controller = new AbortController();
		void loadAnalysis(currentText, currentLanguage, controller.signal);
		return () => controller.abort();
	});

	async function loadTranslation() {
		const currentText = text;
		const currentLanguage = lang;
		const requestId = ++translationRequest;
		if (!currentText || providedTranslation) {
			generatedTranslation = '';
			translationProvider = '';
			translationLoading = false;
			translationError = false;
			return;
		}

		translationLoading = true;
		translationError = false;
		generatedTranslation = '';
		translationProvider = '';
		try {
			const response = await fetch('/api/translate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text: currentText, source: currentLanguage }),
			});
			if (!response.ok) throw new Error(`Translation failed (${response.status})`);
			const result = await response.json();
			if (requestId === translationRequest && text === currentText && lang === currentLanguage) {
				generatedTranslation = result.translation || '';
				translationProvider = result.provider || '';
			}
		} catch {
			if (requestId === translationRequest) translationError = true;
		} finally {
			if (requestId === translationRequest) translationLoading = false;
		}
	}

	$effect(() => {
		void text;
		void lang;
		void providedTranslation;
		void loadTranslation();
	});

	$effect(() => {
		const userId = $session.data?.user?.id;
		settingsLoaded = false;
		autoSaveSentences = false;
		if (!userId) return;

		let cancelled = false;
		fetch('/api/learning-settings')
			.then((response) => response.ok ? response.json() : Promise.reject())
			.then((settings) => {
				if (!cancelled) autoSaveSentences = Boolean(settings.autoSaveSentences);
			})
			.catch(() => {})
			.finally(() => {
				if (!cancelled) settingsLoaded = true;
			});
		return () => { cancelled = true; };
	});

	async function saveSentence(mode: 'manual' | 'auto') {
		if (!$session.data?.user) {
			if (mode === 'manual') {
				signInHint = true;
				window.setTimeout(() => signInHint = false, 3000);
			}
			return;
		}
		if (!text || saveState === 'saving') return;

		saveState = 'saving';
		try {
			const response = await fetch('/api/sentences', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					text,
					language: lang,
					translation: displayTranslation,
					pinyin,
					mode,
					words: visibleWords,
				}),
			});
			if (!response.ok) throw new Error(`Save failed (${response.status})`);
			const result = await response.json();
			savedSentenceId = result.id;
			saveState = 'saved';
		} catch {
			saveState = 'error';
		}
	}

	$effect(() => {
		const userId = $session.data?.user?.id;
		const key = `${userId || ''}:${lang}:${text}`;
		if (
			!userId ||
			!settingsLoaded ||
			!autoSaveSentences ||
			!text ||
			analysisLoading ||
			translationLoading ||
			lastAutoSavedKey === key
		) return;

		lastAutoSavedKey = key;
		void saveSentence('auto');
	});

	async function toggleAutoSave() {
		if (!$session.data?.user || settingsSaving) return;
		const next = !autoSaveSentences;
		settingsSaving = true;
		try {
			const response = await fetch('/api/learning-settings', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ autoSaveSentences: next }),
			});
			if (!response.ok) throw new Error(`Settings update failed (${response.status})`);
			autoSaveSentences = next;
			if (!next) lastAutoSavedKey = '';
		} finally {
			settingsSaving = false;
		}
	}
</script>

<svelte:head>
	<title>{text ? `${text} — Sentence Reader` : 'Sentence Reader'} · Kiokun</title>
</svelte:head>

<Header autofocus={false} />

<main id="main-content" class="sentence-page">
	<h1 class="visually-hidden">{text || 'Sentence'} — {langLabel} sentence</h1>

	{#if !text}
		<section class="empty-reader" aria-labelledby="empty-reader-title">
			<h2 id="empty-reader-title">Paste a sentence to start reading</h2>
			<p>Use the search field above. Kiokun will separate the words, add readings, and look up concise meanings.</p>
		</section>
	{:else}
		<div class="reader-frame">
			{#if from}
				<a href="/{encodeURIComponent(from)}" class="back-link">← Back to {from}</a>
			{/if}

			<section class="sentence-card" aria-labelledby="sentence-heading">
				<div class="sentence-toolbar">
					<div class="sentence-identity">
						<span class="sentence-flag" aria-hidden="true">{langFlag}</span>
						<div>
							<h2 id="sentence-heading">Sentence reader</h2>
							<span>{langLabel}</span>
						</div>
					</div>

					<div class="sentence-actions">
						<div class="save-control">
							<button
								type="button"
								class="save-button"
								class:saved={saveState === 'saved'}
								disabled={saveState === 'saving' || saveState === 'saved' || Boolean(
									$session.data?.user && analysisLoading
								)}
								onclick={() => saveSentence('manual')}
								aria-describedby={signInHint ? 'save-hint' : undefined}
								aria-label={saveState === 'saving'
									? 'Saving sentence'
									: saveState === 'saved'
										? 'Sentence saved'
										: 'Save sentence'}
								title={saveState === 'saved' ? 'Sentence saved' : 'Save sentence'}
							>
								{#if saveState === 'saving'}
									<span class="spinner spinner--small" aria-hidden="true"></span>
								{:else if saveState === 'saved'}
									<span aria-hidden="true">✓</span>
								{:else}
									<span class="save-plus" aria-hidden="true">+</span>
								{/if}
							</button>
							{#if signInHint}
								<div id="save-hint" class="save-hint" role="status">Sign in to save sentences</div>
							{/if}
						</div>

						{#if $session.data?.user}
							<button
								type="button"
								class="autosave-toggle"
								class:active={autoSaveSentences}
								aria-pressed={autoSaveSentences}
								disabled={!settingsLoaded || settingsSaving}
								onclick={toggleAutoSave}
							>
								<span class="toggle-track" aria-hidden="true"><span></span></span>
								Auto-save
							</button>
						{/if}
					</div>
				</div>

				<div class="sentence-scroll">
					<div class="sentence-flow" lang={langAttr}>
						{#each displaySegments as segment}
							{#if segment.isWord && segment.target}
								<a
									class="annotated-token"
									class:has-reading={Boolean(segment.reading && lang !== 'ja')}
									href={wordHref(segment.target)}
									aria-label={wordAriaLabel(segment)}
								>
									{#if segment.reading && lang !== 'ja'}
										<span class="token-reading">{segment.reading}</span>
									{/if}
									<span class="token-surface">
										{#if segment.reading && lang === 'ja'}
											<JapaneseRubyText
												text={segment.text}
												reading={segment.reading}
												readingSize="0.48em"
											/>
										{:else}
											{segment.text}
										{/if}
									</span>
									<span class="token-definition">{segment.definition || ''}</span>
								</a>
							{:else}
								<span class="sentence-punctuation">{segment.text}</span>
							{/if}
						{/each}
					</div>

					<div class="translation-region" aria-live="polite">
						{#if displayTranslation}
							<p class="sentence-translation">{displayTranslation}</p>
							{#if generatedTranslation && translationProvider}
								<span class="translation-source">Machine translation · {translationProvider}</span>
							{/if}
						{:else if translationLoading}
							<div class="translation-status">
								<span class="spinner" aria-hidden="true"></span>
								<span>Translating to English…</span>
							</div>
						{:else if translationError}
							<div class="translation-status translation-status--error">
								<span>Translation is unavailable right now.</span>
								<button type="button" onclick={loadTranslation}>Try again</button>
							</div>
						{/if}
					</div>
				</div>
			</section>

			<section class="words-panel" aria-labelledby="words-heading">
				<div class="words-heading-row">
					<div>
						<h2 id="words-heading">Words</h2>
						<p>{visibleWords.length} {visibleWords.length === 1 ? 'entry' : 'entries'} · select a word to save it or add a note</p>
					</div>
					{#if savedSentenceId}
						<a href="/sentences">Saved sentences</a>
					{:else if saveState === 'error'}
						<button type="button" class="retry-save" onclick={() => saveSentence('manual')}>Retry save</button>
					{/if}
				</div>

				<div class="word-list" class:loading={analysisLoading}>
					{#each visibleWords as word, index (`${word.position}:${word.surfaceForm}:${index}`)}
						{@const currentWordKey = wordKey(word, index)}
						{@const isExpanded = selectedWordKey === currentWordKey}
						<div class="word-item" class:expanded={isExpanded}>
							<button
								type="button"
								class="word-row"
								aria-expanded={isExpanded}
								aria-controls={`word-detail-${index}`}
								onclick={() => (selectedWordKey = isExpanded ? '' : currentWordKey)}
							>
								<span class="word-primary">
									<span class="word-surface" lang={langAttr}>{word.surfaceForm}</span>
									{#if word.reading}
										<span class="word-reading">{word.reading}</span>
									{/if}
								</span>
								<span class="word-meaning">
									{#if word.gloss}
										{compactSentenceGloss(word.gloss, 72)}
									{:else if analysisLoading}
										<span class="meaning-skeleton" aria-label="Loading definition"></span>
									{:else}
										<span class="meaning-missing">No concise definition found</span>
									{/if}
									{#if word.dictionaryForm && word.dictionaryForm !== word.surfaceForm}
										<span class="dictionary-form">{word.surfaceForm} → {word.dictionaryForm}</span>
									{/if}
								</span>
								<span class="row-arrow" aria-hidden="true">›</span>
							</button>

							{#if isExpanded}
								<div class="word-detail" id={`word-detail-${index}`}>
									<div class="detail-summary">
										<strong>{wordTarget(word)}</strong>
										<p>{word.gloss || 'A concise definition was not found. Open the full entry to inspect every available dictionary source.'}</p>
										{#if word.conjugation}
											<span>{word.conjugation} form of {word.dictionaryForm || word.surfaceForm}</span>
										{/if}
									</div>
									<div class="detail-actions">
										<SaveToStudy
											word={wordTarget(word)}
											language={lang}
											showLabel={true}
											deck="searched-sentences"
											context={{ sentence: text, translation: displayTranslation }}
										/>
										<a href={wordHref(wordTarget(word))}>Open full entry <span aria-hidden="true">→</span></a>
									</div>
									{#if $session.data?.user}
										<Notes character={wordTarget(word)} compact={true} />
									{:else}
										<p class="inline-sign-in">Sign in to save this word or add a private note.</p>
									{/if}
								</div>
							{/if}
						</div>
					{/each}

					{#if analysisError}
						<div class="analysis-note" role="status">
							<p>Some definitions could not be loaded. Full dictionary entries are still available.</p>
							<button type="button" onclick={() => {
								const controller = new AbortController();
								void loadAnalysis(text, lang, controller.signal);
							}}>Retry definitions</button>
						</div>
					{/if}
				</div>
			</section>
		</div>
	{/if}
</main>

<SentenceBar />

<style>
	.sentence-page {
		width: min(100%, 66rem);
		height: calc(100svh - 3.75rem);
		margin: 0 auto;
		padding: var(--spacing-md) var(--spacing-lg) var(--spacing-lg);
	}

	.reader-frame {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
		height: 100%;
		min-height: 0;
	}

	.back-link {
		width: fit-content;
		color: var(--text-tertiary);
		font-size: var(--font-size-caption1);
		text-decoration: none;
	}

	.back-link:hover {
		color: var(--accent);
	}

	.sentence-card,
	.words-panel {
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		background: var(--bg-secondary);
	}

	.sentence-card {
		flex: 0 0 auto;
		min-height: 0;
		overflow: hidden;
	}

	.sentence-toolbar,
	.words-heading-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-md);
	}

	.sentence-toolbar {
		padding: var(--spacing-md) var(--spacing-lg);
		border-bottom: 1px solid var(--border-light);
	}

	.sentence-identity {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		min-width: 0;
	}

	.sentence-flag {
		font-size: 1.25rem;
	}

	.sentence-identity h2,
	.words-heading-row h2 {
		margin: 0;
		color: var(--text-primary);
		font-size: var(--font-size-body);
		font-weight: 700;
		line-height: 1.2;
	}

	.sentence-identity span:last-child,
	.words-heading-row p {
		color: var(--text-tertiary);
		font-size: var(--font-size-caption1);
	}

	.sentence-actions {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
	}

	.save-control {
		position: relative;
	}

	.save-button,
	.autosave-toggle {
		display: inline-flex;
		min-height: 2.75rem;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		padding: 0 var(--spacing-md);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-full);
		background: var(--bg-tertiary);
		color: var(--text-secondary);
		font-size: var(--font-size-caption1);
		font-weight: 650;
		cursor: pointer;
	}

	.save-button {
		width: 2.75rem;
		padding: 0;
		font-size: 1.1rem;
	}

	.save-plus {
		font-size: 1.45rem;
		font-weight: 400;
		line-height: 1;
	}

	.save-button:hover,
	.autosave-toggle:hover,
	.autosave-toggle.active {
		border-color: var(--accent);
		color: var(--accent);
	}

	.save-button.saved {
		border-color: color-mix(in srgb, var(--accent) 45%, var(--border-color));
		background: var(--accent-light);
		color: var(--accent);
	}

	.save-button:disabled,
	.autosave-toggle:disabled {
		cursor: default;
		opacity: 0.65;
	}

	.save-hint {
		position: absolute;
		z-index: 5;
		top: calc(100% + var(--spacing-xs));
		right: 0;
		width: max-content;
		max-width: 15rem;
		padding: var(--spacing-sm) var(--spacing-md);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-secondary);
		box-shadow: 0 6px 18px var(--shadow);
		color: var(--text-secondary);
		font-size: var(--font-size-caption1);
	}

	.toggle-track {
		width: 1.75rem;
		height: 1rem;
		padding: 2px;
		border-radius: var(--radius-full);
		background: var(--border-color);
		transition: background-color 150ms ease;
	}

	.toggle-track span {
		display: block;
		width: 0.75rem;
		height: 0.75rem;
		border-radius: 50%;
		background: var(--bg-secondary);
		transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.autosave-toggle.active .toggle-track {
		background: var(--accent);
	}

	.autosave-toggle.active .toggle-track span {
		transform: translateX(0.75rem);
	}

	.sentence-scroll {
		max-height: min(43svh, 24rem);
		overflow-y: auto;
		padding: clamp(var(--spacing-md), 2.2vw, var(--spacing-lg));
	}

	.sentence-flow {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		column-gap: 0.08em;
		row-gap: var(--spacing-xs);
		font-family: var(--font-cjk);
		font-size: clamp(1.35rem, 4vw, 2rem);
		line-height: 1.1;
	}

	.annotated-token {
		display: inline-grid;
		grid-template-rows: auto 0.85rem;
		justify-items: center;
		align-items: center;
		min-width: max-content;
		padding: 0.1rem 0.12rem;
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		text-decoration: none;
	}

	.annotated-token.has-reading {
		grid-template-rows: 0.85rem auto 0.85rem;
	}

	.annotated-token:hover {
		background: var(--accent-light);
		color: var(--accent);
	}

	.token-reading,
	.token-definition {
		display: flex;
		max-width: 11rem;
		min-height: 0.85rem;
		align-items: center;
		overflow: hidden;
		font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
		font-size: 0.65rem;
		line-height: 1;
		text-align: center;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.token-reading {
		color: var(--color-pinyin);
	}

	.token-definition {
		color: var(--text-tertiary);
	}

	.token-surface {
		white-space: nowrap;
	}

	.sentence-punctuation {
		align-self: flex-end;
		padding-bottom: 1.25rem;
		color: var(--text-tertiary);
		white-space: pre-wrap;
	}

	.translation-region {
		min-height: 2.25rem;
		margin-top: var(--spacing-md);
		padding-top: var(--spacing-sm);
		border-top: 1px solid var(--border-light);
	}

	.sentence-translation {
		max-width: 72ch;
		margin: 0;
		color: var(--text-secondary);
		font-size: var(--font-size-body);
		line-height: 1.5;
	}

	.translation-source {
		display: block;
		margin-top: var(--spacing-xs);
		color: var(--text-muted);
		font-size: var(--font-size-caption2);
	}

	.translation-status {
		display: flex;
		min-height: 2.25rem;
		align-items: center;
		gap: var(--spacing-sm);
		color: var(--text-tertiary);
		font-size: var(--font-size-caption1);
	}

	.translation-status--error {
		justify-content: space-between;
	}

	.translation-status button,
	.retry-save,
	.analysis-note button {
		min-height: 2.75rem;
		padding: 0 var(--spacing-md);
		border: 0;
		background: transparent;
		color: var(--accent);
		font-size: var(--font-size-caption1);
		font-weight: 650;
		cursor: pointer;
	}

	.spinner {
		width: 1rem;
		height: 1rem;
		flex: 0 0 auto;
		border: 2px solid var(--border-color);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 700ms linear infinite;
	}

	.spinner--small {
		width: 0.8rem;
		height: 0.8rem;
	}

	.words-panel {
		display: flex;
		flex: 1 1 12rem;
		min-height: 0;
		flex-direction: column;
		overflow: hidden;
	}

	.words-heading-row {
		flex: 0 0 auto;
		padding: var(--spacing-md) var(--spacing-lg);
		border-bottom: 1px solid var(--border-light);
	}

	.words-heading-row p {
		margin: 0.15rem 0 0;
	}

	.words-heading-row > a {
		display: inline-flex;
		min-height: 2.75rem;
		align-items: center;
		color: var(--accent);
		font-size: var(--font-size-caption1);
		font-weight: 650;
		text-decoration: none;
	}

	.word-list {
		min-height: 0;
		overflow-y: auto;
		scrollbar-gutter: stable;
	}

	.word-row {
		display: grid;
		width: 100%;
		grid-template-columns: minmax(7rem, 0.8fr) minmax(0, 2fr) auto;
		align-items: center;
		gap: var(--spacing-md);
		min-height: 3.6rem;
		padding: var(--spacing-sm) var(--spacing-lg);
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.word-row:hover,
	.word-row:focus-visible,
	.word-item.expanded .word-row {
		background: var(--surface-hover);
	}

	.word-row:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	.word-item {
		border-bottom: 1px solid var(--border-light);
	}

	.word-item.expanded {
		background: color-mix(in srgb, var(--bg-tertiary) 50%, transparent);
	}

	.word-primary {
		display: flex;
		min-width: 0;
		align-items: baseline;
		gap: var(--spacing-sm);
	}

	.word-surface {
		color: var(--text-primary);
		font-family: var(--font-cjk);
		font-size: var(--font-size-headline);
		font-weight: 650;
		white-space: nowrap;
	}

	.word-reading {
		overflow: hidden;
		color: var(--color-pinyin);
		font-size: var(--font-size-subhead);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.word-meaning {
		display: flex;
		min-width: 0;
		flex-direction: column;
		color: var(--text-secondary);
		font-size: var(--font-size-subhead);
		line-height: 1.35;
	}

	.meaning-missing {
		color: var(--text-muted);
	}

	.dictionary-form {
		color: var(--text-muted);
		font-size: var(--font-size-caption2);
	}

	.row-arrow {
		color: var(--text-muted);
		font-size: 1.5rem;
		transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.word-item.expanded .row-arrow {
		transform: rotate(90deg);
	}

	.word-detail {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: var(--spacing-md) var(--spacing-lg);
		padding: var(--spacing-md) var(--spacing-lg) var(--spacing-lg);
		border-top: 1px solid var(--border-light);
	}

	.detail-summary {
		min-width: 0;
	}

	.detail-summary strong {
		color: var(--text-primary);
		font-family: var(--font-cjk);
		font-size: var(--font-size-headline);
	}

	.detail-summary p {
		max-width: 70ch;
		margin: var(--spacing-xs) 0 0;
		color: var(--text-secondary);
		font-size: var(--font-size-subhead);
		line-height: 1.5;
	}

	.detail-summary span {
		display: block;
		margin-top: var(--spacing-xs);
		color: var(--text-tertiary);
		font-size: var(--font-size-caption1);
	}

	.detail-actions {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-sm);
	}

	.detail-actions > a {
		display: inline-flex;
		min-height: 2.75rem;
		align-items: center;
		padding: 0 var(--spacing-md);
		border: 1px solid var(--border-color);
		border-radius: 2px;
		color: var(--text-secondary);
		font-size: var(--font-size-caption1);
		font-weight: 650;
		text-decoration: none;
	}

	.detail-actions > a:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.word-detail :global(.notes-compact),
	.inline-sign-in {
		grid-column: 1 / -1;
	}

	.word-detail :global(.notes-compact) {
		padding: var(--spacing-md) 0 0;
		border-top: 1px solid var(--border-light);
		border-bottom: 0;
	}

	.inline-sign-in {
		margin: 0;
		padding-top: var(--spacing-md);
		border-top: 1px solid var(--border-light);
		color: var(--text-tertiary);
		font-size: var(--font-size-caption1);
	}

	.meaning-skeleton {
		display: block;
		width: min(17rem, 70%);
		height: 0.7rem;
		border-radius: var(--radius-full);
		background: var(--bg-tertiary);
		animation: pulse 1.2s ease-in-out infinite;
	}

	.analysis-note {
		padding: var(--spacing-lg);
		color: var(--text-secondary);
		text-align: center;
	}

	.analysis-note p {
		margin: 0;
		font-size: var(--font-size-subhead);
	}

	.empty-reader {
		max-width: 42rem;
		margin: 12svh auto 0;
		padding: var(--spacing-xl);
		text-align: center;
	}

	.empty-reader h2 {
		margin: 0;
		color: var(--text-primary);
		font-size: clamp(1.6rem, 4vw, 2.2rem);
		letter-spacing: -0.025em;
	}

	.empty-reader p {
		margin: var(--spacing-md) 0 0;
		color: var(--text-secondary);
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	@keyframes pulse {
		50% { opacity: 0.45; }
	}

	@media (max-width: 42rem) {
		.sentence-page {
			padding: var(--spacing-sm);
		}

		.reader-frame {
			gap: var(--spacing-sm);
		}

		.sentence-toolbar {
			align-items: flex-start;
			padding: var(--spacing-sm) var(--spacing-md);
		}

		.sentence-actions {
			align-items: flex-end;
			flex-direction: column;
			gap: var(--spacing-xs);
		}

		.save-button,
		.autosave-toggle {
			min-height: 2.75rem;
		}

		.save-button {
			width: 2.75rem;
			padding: 0;
		}

		.autosave-toggle {
			padding-inline: var(--spacing-sm);
		}

		.sentence-scroll {
			max-height: 38svh;
			padding: var(--spacing-md);
		}

		.sentence-flow {
			font-size: 1.4rem;
		}

		.words-heading-row {
			padding: var(--spacing-sm) var(--spacing-md);
		}

		.words-heading-row p {
			max-width: 24rem;
			line-height: 1.3;
		}

		.word-row {
			grid-template-columns: minmax(5.5rem, auto) minmax(0, 1fr) auto;
			gap: var(--spacing-sm);
			min-height: 3.75rem;
			padding-inline: var(--spacing-md);
		}

		.word-detail {
			grid-template-columns: 1fr;
			padding-inline: var(--spacing-md);
		}

		.detail-actions {
			align-items: stretch;
			flex-direction: column;
		}

		.detail-actions > a {
			justify-content: center;
		}

		.word-primary {
			align-items: flex-start;
			flex-direction: column;
			gap: 0;
		}

		.word-surface {
			font-size: 1.1rem;
		}

		.word-reading,
		.word-meaning {
			font-size: var(--font-size-caption1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.toggle-track,
		.toggle-track span,
		.row-arrow {
			transition: none;
		}

		.spinner,
		.meaning-skeleton {
			animation-duration: 1.8s;
		}
	}
</style>
