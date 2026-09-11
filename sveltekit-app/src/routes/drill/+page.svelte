<script lang="ts">
	import { onMount, tick } from 'svelte';
	import {
		cardKey,
		createDrillProgress,
		gradePronunciation,
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
		answeredAt: string;
	}

	interface StoredSession {
		version: 1;
		history: HistoryEntry[];
		progress: DrillProgress;
		lastLanguage: DrillLanguage | null;
	}

	const STORAGE_KEY = 'kiokun:pronunciation-drill:v1';
	const LANGUAGE: Record<DrillLanguage, { flag: string; name: string; inputLabel: string }> = {
		ja: { flag: '🇯🇵', name: 'Japanese', inputLabel: 'Type the reading in romaji or kana' },
		zh: { flag: '🇨🇳', name: 'Mandarin', inputLabel: 'Type the reading in Pinyin' }
	};

	let drillData = $state<DrillData | null>(null);
	let current = $state<PronunciationCard | null>(null);
	let answer = $state('');
	let revealed = $state<boolean | null>(null);
	let history = $state<HistoryEntry[]>([]);
	let progress = $state<DrillProgress>(createDrillProgress());
	let lastLanguage = $state<DrillLanguage | null>(null);
	let loading = $state(true);
	let loadError = $state('');
	let inputElement = $state<HTMLInputElement | null>(null);
	let historyDialog = $state<HTMLDialogElement | null>(null);

	const correctCount = $derived(history.filter((entry) => entry.correct).length);
	const accuracy = $derived(history.length ? Math.round((correctCount / history.length) * 100) : 0);
	const totalCards = $derived(
		(drillData?.languages.ja.length ?? 0) + (drillData?.languages.zh.length ?? 0)
	);
	const language = $derived(current ? LANGUAGE[current.language] : null);

	onMount(() => {
		restoreSession();
		void loadDrill();

		const refocus = () => {
			if (!historyDialog?.open) void focusAnswer();
		};
		window.addEventListener('focus', refocus);
		return () => window.removeEventListener('focus', refocus);
	});

	function restoreSession(): void {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return;
			const stored = JSON.parse(raw) as Partial<StoredSession>;
			if (stored.version !== 1 || !Array.isArray(stored.history)) return;
			history = stored.history;
			if (stored.progress?.ja && stored.progress?.zh) progress = stored.progress;
			if (stored.lastLanguage === 'ja' || stored.lastLanguage === 'zh') {
				lastLanguage = stored.lastLanguage;
			}
		} catch {
			// A blocked or malformed local store should not prevent practice.
		}
	}

	function saveSession(): void {
		try {
			const session: StoredSession = { version: 1, history, progress, lastLanguage };
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
			chooseNextCard();
		} catch (error) {
			loadError = error instanceof Error ? error.message : 'Pronunciation data could not load';
		} finally {
			loading = false;
		}
	}

	function chooseNextCard(): void {
		if (!drillData) return;
		const seen = new Set(history.map(cardKey));
		current = pickNextCard(drillData, seen, progress, lastLanguage);
		if (current) lastLanguage = current.language;
		answer = '';
		revealed = null;
		void focusAnswer();
	}

	async function focusAnswer(): Promise<void> {
		await tick();
		inputElement?.focus({ preventScroll: true });
		if (!revealed) inputElement?.select();
	}

	function submitAnswer(event: SubmitEvent): void {
		event.preventDefault();
		if (!current) return;
		if (revealed !== null) {
			chooseNextCard();
			return;
		}

		const trimmedAnswer = answer.trim();
		if (!trimmedAnswer) return;

		const correct = gradePronunciation(current, trimmedAnswer);
		progress = updateDrillProgress(progress, current.language, correct);
		history = [
			{
				...current,
				answer: trimmedAnswer,
				correct,
				answeredAt: new Date().toISOString()
			},
			...history
		];
		revealed = correct;
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

<main id="main-content" class="drill-shell">
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
				<label for="pronunciation-answer">{language?.inputLabel}</label>
				<input
					bind:this={inputElement}
					bind:value={answer}
					id="pronunciation-answer"
					class:answer-correct={revealed === true}
					class:answer-wrong={revealed === false}
					type="text"
					name="pronunciation"
					autocomplete="off"
					autocapitalize="none"
					spellcheck="false"
					readonly={revealed !== null}
					aria-invalid={revealed === false ? 'true' : undefined}
				/>

				{#if revealed === null}
					<p class="enter-hint">Enter to check</p>
				{:else}
					<div class="feedback" class:correct={revealed} class:wrong={!revealed} aria-live="polite">
						<p class="verdict"><span aria-hidden="true">{revealed ? '✓' : '×'}</span> {revealed ? 'Correct' : 'Not quite'}</p>
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
			<p>{history.length} answered{history.length ? `, ${accuracy}% correct` : ''}</p>
		</div>
		<button type="button" onclick={closeHistory} aria-label="Close history">Close</button>
	</div>

	{#if history.length === 0}
		<p class="empty-history">Answered words will appear here.</p>
	{:else}
		<ol class="history-list">
			{#each history as entry, index (`${entry.language}:${entry.word}:${entry.answeredAt}:${index}`)}
				<li>
					<a href={`/${encodeURIComponent(entry.word)}`} target="_blank" rel="noreferrer">
						<span class="history-result" class:correct={entry.correct} class:wrong={!entry.correct}>
							<span aria-hidden="true">{entry.correct ? '✓' : '×'}</span>
							<span class="sr-only">{entry.correct ? 'Correct' : 'Incorrect'}</span>
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
	:global(body:has(.drill-shell)) {
		overflow: hidden;
	}

	.drill-shell {
		--drill-success: #15803d;
		--drill-error: #c2413b;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		width: 100%;
		height: 100vh;
		height: 100dvh;
		min-height: 100svh;
		overflow: hidden;
		background: var(--bg-primary);
		color: var(--text-primary);
		font-family: var(--font-ui);
	}

	:global([data-theme='dark']) .drill-shell {
		--drill-success: #4ade80;
		--drill-error: #fb7185;
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
		display: block;
		margin-bottom: 0.35rem;
		color: var(--text-secondary);
		font-size: 0.78rem;
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
