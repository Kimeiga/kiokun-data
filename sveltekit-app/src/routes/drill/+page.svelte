<script lang="ts">
	import { onMount, tick } from 'svelte';
	import {
		cardKey,
		createDrillProgress,
		DRILL_MAX_LEVEL,
		DRILL_START_LEVEL,
		gradePronunciation,
		isPronunciationCardEligible,
		pickNextCard,
		romanizeJapaneseReading,
		updateDrillProgress,
		type DrillData,
		type DrillLanguage,
		type DrillProgress,
		type PronunciationCard
	} from '$lib/pronunciation-drill';

	interface HistoryEntry extends PronunciationCard {
		answer: string;
		correct: boolean;
		skipped?: boolean;
		answeredAt: string;
	}

	interface StoredSession {
		version: 1 | 2;
		history: HistoryEntry[];
		progress: DrillProgress;
		lastLanguage: DrillLanguage | null;
		currentKey?: string | null;
		answer?: string;
		revealed?: boolean | null;
		skipped?: boolean;
	}

	const STORAGE_KEY = 'kiokun:pronunciation-drill:v2';
	const LEGACY_STORAGE_KEY = 'kiokun:pronunciation-drill:v1';
	const LANGUAGE: Record<DrillLanguage, { flag: string; name: string; inputLabel: string }> = {
		ja: { flag: '🇯🇵', name: 'Japanese', inputLabel: 'Type the reading in romaji or kana' },
		zh: { flag: '🇨🇳', name: 'Mandarin', inputLabel: 'Type the reading in Pinyin' }
	};

	let drillData = $state<DrillData | null>(null);
	let current = $state<PronunciationCard | null>(null);
	let answer = $state('');
	let revealed = $state<boolean | null>(null);
	let skipped = $state(false);
	let history = $state<HistoryEntry[]>([]);
	let progress = $state<DrillProgress>(createDrillProgress());
	let lastLanguage = $state<DrillLanguage | null>(null);
	let loading = $state(true);
	let loadError = $state('');
	let answerFocused = $state(false);
	let drillShell = $state<HTMLElement | null>(null);
	let inputElement = $state<HTMLInputElement | null>(null);
	let historyDialog = $state<HTMLDialogElement | null>(null);
	let restoredCurrentKey: string | null = null;
	let restoredAnswer = '';
	let restoredRevealed: boolean | null = null;
	let restoredSkipped = false;

	const correctCount = $derived(history.filter((entry) => entry.correct).length);
	const accuracy = $derived(history.length ? Math.round((correctCount / history.length) * 100) : 0);
	const totalCards = $derived(
		(drillData?.languages.ja.length ?? 0) + (drillData?.languages.zh.length ?? 0)
	);
	const language = $derived(current ? LANGUAGE[current.language] : null);

	onMount(() => {
		restoreSession();
		void loadDrill();
		syncVisualViewport();

		const refocus = () => {
			if (!historyDialog?.open) void focusAnswer();
		};
		const persist = () => saveSession();
		const visualViewport = window.visualViewport;
		window.addEventListener('focus', refocus);
		window.addEventListener('resize', syncVisualViewport);
		window.addEventListener('pagehide', persist);
		visualViewport?.addEventListener('resize', syncVisualViewport);
		visualViewport?.addEventListener('scroll', syncVisualViewport);
		return () => {
			window.removeEventListener('focus', refocus);
			window.removeEventListener('resize', syncVisualViewport);
			window.removeEventListener('pagehide', persist);
			visualViewport?.removeEventListener('resize', syncVisualViewport);
			visualViewport?.removeEventListener('scroll', syncVisualViewport);
		};
	});

	function syncVisualViewport(): void {
		if (typeof window === 'undefined') return;
		const viewport = window.visualViewport;
		const height = Math.round(viewport?.height ?? window.innerHeight);
		const offsetTop = Math.round(viewport?.offsetTop ?? 0);
		drillShell?.style.setProperty('--drill-viewport-height', `${height}px`);
		drillShell?.style.setProperty('--drill-viewport-top', `${offsetTop}px`);
	}

	function restoreProgress(stored: StoredSession): DrillProgress {
		const fresh = createDrillProgress();
		const minimumLevel = stored.version === 1 ? DRILL_START_LEVEL : 0;
		const restoreLanguage = (language: DrillLanguage) => {
			const candidate = stored.progress?.[language];
			if (!candidate) return fresh[language];
			const level = Number.isFinite(candidate.level)
				? Math.max(minimumLevel, Math.min(DRILL_MAX_LEVEL, Math.trunc(candidate.level)))
				: fresh[language].level;
			const correctRun = Number.isFinite(candidate.correctRun)
				? Math.max(0, Math.min(2, Math.trunc(candidate.correctRun)))
				: 0;
			return { level, correctRun };
		};

		return { ja: restoreLanguage('ja'), zh: restoreLanguage('zh') };
	}

	function restoreSession(): void {
		try {
			const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
			if (!raw) return;
			const stored = JSON.parse(raw) as Partial<StoredSession>;
			if ((stored.version !== 1 && stored.version !== 2) || !Array.isArray(stored.history)) return;
			history = stored.history;
			if (stored.progress?.ja && stored.progress?.zh) {
				progress = restoreProgress(stored as StoredSession);
			}
			if (stored.lastLanguage === 'ja' || stored.lastLanguage === 'zh') {
				lastLanguage = stored.lastLanguage;
			}
			if (stored.version === 2) {
				restoredCurrentKey = typeof stored.currentKey === 'string' ? stored.currentKey : null;
				restoredAnswer = typeof stored.answer === 'string' ? stored.answer : '';
				restoredRevealed = typeof stored.revealed === 'boolean' ? stored.revealed : null;
				restoredSkipped = stored.skipped === true && restoredRevealed === false;
			}
		} catch {
			// A blocked or malformed local store should not prevent practice.
		}
	}

	function saveSession(): void {
		try {
			const session: StoredSession = {
				version: 2,
				history,
				progress,
				lastLanguage,
				currentKey: current ? cardKey(current) : null,
				answer,
				revealed,
				skipped
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
		} catch {
			// Practice remains usable when storage is unavailable.
		}
	}

	async function loadDrill(): Promise<void> {
		loading = true;
		loadError = '';
		try {
			const response = await fetch('/pronunciation_drill.json');
			if (!response.ok) throw new Error(`Pronunciation data failed (${response.status})`);
			const data = (await response.json()) as DrillData;
			if (data.version !== 1 || !data.languages?.ja || !data.languages?.zh) {
				throw new Error('Pronunciation data has an unsupported format');
			}
			drillData = data;
			if (!restoreCurrentCard()) chooseNextCard();
		} catch (error) {
			loadError = error instanceof Error ? error.message : 'Pronunciation data could not load';
		} finally {
			loading = false;
		}
	}

	function restoreCurrentCard(): boolean {
		if (!drillData || !restoredCurrentKey) return false;
		const card = [...drillData.languages.ja, ...drillData.languages.zh].find(
			(candidate) => cardKey(candidate) === restoredCurrentKey
		);
		if (!card || !isPronunciationCardEligible(card)) return false;

		current = card;
		lastLanguage = card.language;
		answer = restoredAnswer;
		revealed = restoredRevealed;
		skipped = restoredSkipped;
		saveSession();
		void focusAnswer();
		return true;
	}

	function chooseNextCard(): void {
		if (!drillData) return;
		const seen = new Set(history.map(cardKey));
		current = pickNextCard(drillData, seen, progress, lastLanguage);
		if (current) lastLanguage = current.language;
		answer = '';
		revealed = null;
		skipped = false;
		saveSession();
		void focusAnswer();
	}

	async function focusAnswer(): Promise<void> {
		await tick();
		inputElement?.focus({ preventScroll: true });
		if (revealed === null) inputElement?.select();
	}

	function handleAnswerFocus(): void {
		answerFocused = true;
		syncVisualViewport();
		requestAnimationFrame(syncVisualViewport);
	}

	function handleAnswerBlur(): void {
		answerFocused = false;
		requestAnimationFrame(syncVisualViewport);
	}

	function handleAnswerInput(event: Event): void {
		answer = (event.currentTarget as HTMLInputElement).value;
		saveSession();
	}

	function submitAnswer(event: SubmitEvent): void {
		event.preventDefault();
		if (!current) return;
		if (revealed !== null) {
			chooseNextCard();
			return;
		}

		const trimmedAnswer = answer.trim();
		const didSkip = !trimmedAnswer;
		const correct = !didSkip && gradePronunciation(current, trimmedAnswer);
		progress = updateDrillProgress(progress, current.language, correct);
		history = [
			{
				...current,
				answer: trimmedAnswer,
				correct,
				skipped: didSkip,
				answeredAt: new Date().toISOString()
			},
			...history
		];
		revealed = correct;
		skipped = didSkip;
		saveSession();
		void focusAnswer();
	}

	function displayReading(card: PronunciationCard, reading: string): string {
		if (card.language === 'zh') return reading;
		const romanized = romanizeJapaneseReading(reading);
		return romanized && romanized !== reading ? `${reading} (${romanized})` : reading;
	}

	function openHistory(): void {
		historyDialog?.showModal();
	}

	function closeHistory(): void {
		historyDialog?.close();
		void focusAnswer();
	}
</script>

<svelte:head>
	<title>Pronunciation drill | Kiokun</title>
	<meta
		name="description"
		content="Practice common Japanese and Mandarin word readings with an adaptive keyboard-first drill."
	/>
</svelte:head>

<main
	bind:this={drillShell}
	id="main-content"
	class="drill-shell"
	class:answer-focused={answerFocused}
>
	<header class="app-bar">
		<div class="language-marker" aria-live="polite">
			<span class="flag" aria-hidden="true">{language?.flag ?? '語'}</span>
			<span>{language?.name ?? 'Japanese + Mandarin'}</span>
		</div>
		<a class="drill-title" href="/learning">Pronunciation drill</a>
		<button class="history-button" type="button" onclick={openHistory}>
			History <span class="history-count">{history.length}</span>
		</button>
	</header>

	<section class="practice" aria-busy={loading}>
		<div class="prompt-stage">
			{#if loading}
				<p class="status-message" role="status">Loading words…</p>
			{:else if loadError}
				<div class="status-message error-state" role="alert">
					<p>{loadError}</p>
					<button type="button" onclick={() => void loadDrill()}>Try again</button>
				</div>
			{:else if current}
				<div class="word-block">
					<div class="prompt-word" lang={current.language === 'ja' ? 'ja' : 'zh-Hans'}>
						{current.word}
					</div>
					<div class="rank-label">Frequency #{current.rank}</div>
				</div>
			{:else}
				<div class="status-message complete-state">
					<p>You have seen all {totalCards.toLocaleString()} words.</p>
					<button type="button" onclick={openHistory}>Review history</button>
				</div>
			{/if}
		</div>

		{#if current}
			<form class="answer-zone" onsubmit={submitAnswer}>
				<label for="pronunciation-answer">
					<span class="input-flag" aria-hidden="true">{language?.flag}</span>
					{language?.inputLabel}
				</label>
				<input
					bind:this={inputElement}
					value={answer}
					id="pronunciation-answer"
					class:answer-correct={revealed === true}
					class:answer-wrong={revealed === false && !skipped}
					class:answer-skipped={skipped}
					type="text"
					name="pronunciation"
					autocomplete="off"
					autocapitalize="none"
					enterkeyhint="done"
					spellcheck="false"
					readonly={revealed !== null}
					aria-invalid={revealed === false && !skipped ? 'true' : undefined}
					onfocus={handleAnswerFocus}
					onblur={handleAnswerBlur}
					oninput={handleAnswerInput}
				/>

				{#if revealed === null}
					<p class="enter-hint">Enter to check. Leave blank if you don’t know.</p>
				{:else}
					<div
						class="feedback"
						class:correct={revealed}
						class:wrong={!revealed && !skipped}
						class:skipped
						aria-live="polite"
					>
						<p class="verdict">
							<span aria-hidden="true">{revealed ? '✓' : skipped ? '?' : '×'}</span>
							{revealed ? 'Correct' : skipped ? 'Not known yet' : 'Not quite'}
						</p>
						<div class="readings" aria-label="Accepted readings">
							{#each current.readings as reading}
								<span>{displayReading(current, reading)}</span>
							{/each}
						</div>
						<p class="definition">{current.definition}</p>
						<p class="enter-hint">Enter for the next word</p>
					</div>
				{/if}
			</form>
		{/if}
	</section>
</main>

<dialog bind:this={historyDialog} class="history-dialog" onclose={() => void focusAnswer()}>
	<div class="history-header">
		<div>
			<h2>History</h2>
			<p>{history.length} reviewed{history.length ? `, ${accuracy}% correct` : ''}</p>
		</div>
		<button type="button" onclick={closeHistory} aria-label="Close history">Close</button>
	</div>

	{#if history.length === 0}
		<p class="empty-history">Reviewed words will appear here.</p>
	{:else}
		<ol class="history-list">
			{#each history as entry, index (`${entry.language}:${entry.word}:${entry.answeredAt}:${index}`)}
				<li>
					<a href={`/${encodeURIComponent(entry.word)}`} target="_blank" rel="noreferrer">
						<span
							class="history-result"
							class:correct={entry.correct}
							class:wrong={!entry.correct && !entry.skipped}
							class:skipped={entry.skipped}
						>
							<span aria-hidden="true">{entry.correct ? '✓' : entry.skipped ? '?' : '×'}</span>
							<span class="sr-only">{entry.correct ? 'Correct' : entry.skipped ? 'Not known yet' : 'Incorrect'}</span>
						</span>
						<span class="history-word" lang={entry.language === 'ja' ? 'ja' : 'zh-Hans'}>{entry.word}</span>
						<span class="history-reading">
							{entry.readings.map((reading) => displayReading(entry, reading)).join(' · ')}
						</span>
						<span class="history-definition">{entry.definition}</span>
					</a>
				</li>
			{/each}
		</ol>
	{/if}
</dialog>

<style>
	:global(html:has(.drill-shell)),
	:global(body:has(.drill-shell)) {
		overflow: hidden;
		overscroll-behavior: none;
	}

	.drill-shell {
		--drill-success: #15803d;
		--drill-error: #c2413b;
		--drill-skip: #a16207;
		position: fixed;
		top: var(--drill-viewport-top, 0);
		left: 0;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		width: 100%;
		height: var(--drill-viewport-height, 100dvh);
		min-height: 0;
		overflow: hidden;
		overscroll-behavior: none;
		background: var(--bg-primary);
		color: var(--text-primary);
		font-family: var(--font-ui);
	}

	:global([data-theme='dark']) .drill-shell {
		--drill-success: #4ade80;
		--drill-error: #fb7185;
		--drill-skip: #facc15;
	}

	.app-bar {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
		align-items: center;
		min-height: 3.25rem;
		padding: max(0px, env(safe-area-inset-top)) 0.75rem 0;
		border-bottom: 1px solid var(--border-color);
		background: var(--bg-secondary);
		font-size: 0.78rem;
	}

	.language-marker,
	.history-button {
		min-width: 0;
	}

	.language-marker {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		justify-self: start;
		color: var(--text-secondary);
		white-space: nowrap;
	}

	.flag {
		font-size: 1.1rem;
		line-height: 1;
	}

	.drill-title {
		color: var(--text-primary);
		font-weight: 680;
		text-decoration: none;
		white-space: nowrap;
	}

	.history-button,
	.history-header button,
	.status-message button {
		position: relative;
		border: 0;
		background: transparent;
		color: var(--text-secondary);
		font: inherit;
		cursor: pointer;
	}

	.history-button {
		justify-self: end;
		padding: 0.65rem 0;
	}

	.history-button::before,
	.history-header button::before {
		position: absolute;
		inset: -0.45rem;
		content: '';
	}

	.history-button:focus-visible,
	.history-header button:focus-visible,
	.status-message button:focus-visible,
	.drill-title:focus-visible,
	.history-list a:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 3px;
	}

	.history-count {
		font-variant-numeric: tabular-nums;
		color: var(--text-muted);
	}

	.practice {
		display: grid;
		grid-template-rows: minmax(0, 1fr) auto;
		min-height: 0;
		width: min(100%, 42rem);
		margin: 0 auto;
		border-inline: 1px solid var(--border-color);
		background: var(--bg-secondary);
	}

	.prompt-stage {
		display: grid;
		min-height: 0;
		place-items: center;
		overflow-y: auto;
		padding: clamp(1.5rem, 8vh, 5rem) 1rem;
	}

	.word-block {
		max-width: 100%;
		text-align: center;
	}

	.prompt-word {
		max-width: 100%;
		font-family: var(--font-cjk);
		font-size: clamp(3.4rem, 18vw, 8rem);
		font-weight: 660;
		line-height: 1.1;
		letter-spacing: -0.04em;
		text-wrap: balance;
		overflow-wrap: anywhere;
	}

	.rank-label {
		margin-top: 0.9rem;
		color: var(--text-muted);
		font-size: 0.72rem;
		font-variant-numeric: tabular-nums;
	}

	.answer-zone {
		min-height: 10.5rem;
		padding: 1rem clamp(1rem, 4vw, 1.75rem) max(1rem, env(safe-area-inset-bottom));
		border-top: 1px solid var(--border-color);
		background: var(--bg-secondary);
	}

	.answer-zone label {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-bottom: 0.35rem;
		color: var(--text-secondary);
		font-size: 0.78rem;
	}

	.input-flag {
		font-size: 0.95rem;
		line-height: 1;
	}

	.answer-zone input {
		width: 100%;
		height: 3rem;
		padding: 0;
		border: 0;
		border-bottom: 2px solid var(--text-primary);
		border-radius: 0;
		outline: 0;
		background: transparent;
		color: var(--text-primary);
		font-family: var(--font-ui);
		font-size: 1.45rem;
		font-weight: 560;
	}

	.answer-zone input:focus {
		border-bottom-color: var(--accent);
	}

	.answer-zone input.answer-correct {
		border-bottom-color: var(--drill-success);
	}

	.answer-zone input.answer-wrong {
		border-bottom-color: var(--drill-error);
	}

	.answer-zone input.answer-skipped {
		border-bottom-color: var(--drill-skip);
	}

	.enter-hint {
		margin: 0.55rem 0 0;
		color: var(--text-muted);
		font-size: 0.72rem;
	}

	.feedback {
		padding-top: 0.8rem;
	}

	.verdict {
		margin: 0;
		font-size: 0.92rem;
		font-weight: 700;
	}

	.feedback.correct .verdict,
	.history-result.correct {
		color: var(--drill-success);
	}

	.feedback.wrong .verdict,
	.history-result.wrong {
		color: var(--drill-error);
	}

	.feedback.skipped .verdict,
	.history-result.skipped {
		color: var(--drill-skip);
	}

	.readings {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 0.8rem;
		margin-top: 0.45rem;
		font-family: var(--font-cjk);
		font-size: 0.95rem;
		font-weight: 620;
	}

	.readings span + span::before {
		margin-right: 0.8rem;
		color: var(--border-color);
		content: '/';
	}

	.definition {
		max-width: 60ch;
		margin: 0.4rem 0 0;
		color: var(--text-secondary);
		font-size: 0.88rem;
		line-height: 1.4;
	}

	.status-message {
		color: var(--text-secondary);
		text-align: center;
	}

	.status-message button {
		min-height: 2.75rem;
		margin-top: 0.5rem;
		padding: 0 1rem;
		border: 1px solid var(--border-color);
		color: var(--text-primary);
	}

	.error-state {
		color: var(--drill-error);
	}

	.history-dialog {
		width: min(32rem, 100vw);
		max-width: 100vw;
		height: min(44rem, 100dvh);
		max-height: 100dvh;
		margin: auto;
		padding: 0;
		border: 1px solid var(--border-color);
		border-radius: 2px;
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-family: var(--font-ui);
	}

	.history-dialog::backdrop {
		background: rgb(0 0 0 / 0.58);
	}

	.history-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 4rem;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--border-color);
	}

	.history-header h2,
	.history-header p {
		margin: 0;
	}

	.history-header h2 {
		font-size: 1rem;
	}

	.history-header p {
		margin-top: 0.15rem;
		color: var(--text-muted);
		font-size: 0.72rem;
	}

	.history-header button {
		padding: 0.65rem 0;
	}

	.empty-history {
		margin: 0;
		padding: 2rem 1rem;
		color: var(--text-secondary);
	}

	.history-list {
		max-height: calc(min(44rem, 100dvh) - 4rem);
		margin: 0;
		padding: 0;
		overflow-y: auto;
		list-style: none;
	}

	.history-list li {
		border-bottom: 1px solid var(--border-color);
	}

	.history-list a {
		display: grid;
		grid-template-columns: 1.25rem minmax(3.75rem, auto) minmax(0, 1fr);
		gap: 0.2rem 0.7rem;
		align-items: baseline;
		padding: 0.8rem 1rem;
		color: inherit;
		text-decoration: none;
	}

	.history-list a:hover {
		background: var(--surface-hover);
	}

	.history-result {
		grid-row: 1 / span 2;
		font-weight: 760;
	}

	.history-word {
		font-family: var(--font-cjk);
		font-size: 1.1rem;
		font-weight: 660;
	}

	.history-reading {
		min-width: 0;
		overflow: hidden;
		color: var(--text-secondary);
		font-family: var(--font-cjk);
		font-size: 0.78rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.history-definition {
		grid-column: 2 / -1;
		min-width: 0;
		overflow: hidden;
		color: var(--text-muted);
		font-size: 0.76rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	@media (max-width: 42rem) {
		.practice {
			border-inline: 0;
		}

		.language-marker span:last-child {
			display: none;
		}

		.history-dialog {
			height: 100dvh;
			border: 0;
		}

		.drill-shell.answer-focused .app-bar {
			min-height: 2.75rem;
		}

		.drill-shell.answer-focused .practice {
			grid-template-rows: minmax(6.5rem, 1fr) auto;
		}

		.drill-shell.answer-focused .prompt-stage {
			padding: 0.5rem 1rem;
			overflow: hidden;
		}

		.drill-shell.answer-focused .prompt-word {
			font-size: clamp(2.4rem, 14vw, 4.5rem);
			line-height: 1;
		}

		.drill-shell.answer-focused .rank-label {
			margin-top: 0.3rem;
		}

		.drill-shell.answer-focused .answer-zone {
			min-height: 7.75rem;
			padding-top: 0.65rem;
			padding-bottom: max(0.65rem, env(safe-area-inset-bottom));
		}

		.drill-shell.answer-focused .answer-zone input {
			height: 2.5rem;
		}

		.drill-shell.answer-focused .feedback {
			padding-top: 0.45rem;
		}

		.drill-shell.answer-focused .definition {
			display: -webkit-box;
			overflow: hidden;
			-webkit-box-orient: vertical;
			-webkit-line-clamp: 2;
			line-clamp: 2;
		}
	}

	@media (max-height: 34rem) {
		.prompt-stage {
			padding-block: 1rem;
		}

		.prompt-word {
			font-size: clamp(2.8rem, 14vh, 5rem);
		}

		.answer-zone {
			min-height: 8.5rem;
		}
	}
</style>
