<!--
THESIS: A living sentence workbench makes the learner’s language—not a chat transcript—the dominant object.
OWN-WORLD: Kiokun’s ruled surfaces, charcoal reference bars, compact utility labels, green confirmation, and red proofreader marks surround one borderless writing line.
STORY: Attempt the waiting translation, inspect only the troublesome span, revise, then study the grammar that made the answer work.
FIRST VIEWPORT: The standard Kiokun header leads directly into the prompt and oversized writing field; reference material splits right on wide screens and below on portrait screens.
FORM: An established-world extension of the approved sentence canvas; the task remains continuously interactive while evidence opens beside it.
-->
<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import Header from '$lib/components/Header.svelte';
	import TutorReferencePane from '$lib/tutor/TutorReferencePane.svelte';
	import { chooseNextTutorExercise } from '$lib/tutor/exercises';
	import type {
		TutorExercise,
		TutorIssue,
		TutorLearnerProfile,
		TutorRequest,
		TutorResult
	} from '$lib/tutor/types';

	type AnswerPart = { text: string; issue: TutorIssue | null; issueIndex: number | null };
	type SurfacePiece = { text: string; wordLike: boolean };

	const defaultProfile: TutorLearnerProfile = {
		level: 3,
		observedLevel: 'Intermediate',
		strengths: [],
		focus: [],
		completedExerciseIds: [],
		attempts: 0,
		correct: 0
	};
	const profileArrayLimit = 30;

	function profileStrings(value: unknown, limit = 5): string[] {
		return Array.isArray(value)
			? value
				.filter((item): item is string => typeof item === 'string')
				.map((item) => item.trim().slice(0, 100))
				.filter(Boolean)
				.slice(0, limit)
			: [];
	}

	function sanitizeStoredProfile(value: unknown): TutorLearnerProfile {
		const saved = value && typeof value === 'object' ? value as Record<string, unknown> : {};
		const focus = profileStrings(saved.focus);
		return {
			level: Math.max(2, Math.min(5, Number(saved.level) || defaultProfile.level)),
			observedLevel: typeof saved.observedLevel === 'string'
				? saved.observedLevel.trim().slice(0, 60) || defaultProfile.observedLevel
				: defaultProfile.observedLevel,
			strengths: profileStrings(saved.strengths),
			focus,
			completedExerciseIds: profileStrings(saved.completedExerciseIds, profileArrayLimit),
			attempts: Math.max(0, Math.min(10_000, Number(saved.attempts) || 0)),
			correct: Math.max(0, Math.min(10_000, Number(saved.correct) || 0))
		};
	}

	function loadProfile(): TutorLearnerProfile {
		if (!browser) return { ...defaultProfile };
		try {
			const saved = localStorage.getItem('kiokun-tutor-profile-v1');
			return saved ? sanitizeStoredProfile(JSON.parse(saved)) : { ...defaultProfile };
		} catch {
			return { ...defaultProfile };
		}
	}

	let profile: TutorLearnerProfile = loadProfile();
	let currentExercise: TutorExercise = chooseNextTutorExercise(profile, null);
	let answer = '';
	let result: TutorResult | null = null;
	let editing = true;
	let checking = false;
	let requestError = '';
	let attempt = 1;
	let priorHints: string[] = [];
	let expandedIssue: number | null = null;
	let completedCount = profile.completedExerciseIds.length;
	let referenceOpen = false;
	let referenceQuery = '';
	let profileOpen = false;
	let shortcutKey = 'Ctrl';

	$: answerParts = result ? makeAnswerParts(answer, result.issues) : [];
	$: directionLabel = currentExercise.direction === 'to_english'
		? `${currentExercise.language === 'ja' ? 'Japanese' : 'Mandarin'} → English`
		: `English → ${currentExercise.language === 'ja' ? 'Japanese' : 'Mandarin'}`;

	onMount(() => {
		shortcutKey = navigator.platform.includes('Mac') ? '⌘' : 'Ctrl';
		setTimeout(() => document.querySelector<HTMLTextAreaElement>('#tutor-answer')?.focus(), 80);
	});

	function persistProfile(next: TutorLearnerProfile) {
		profile = next;
		localStorage.setItem('kiokun-tutor-profile-v1', JSON.stringify(next));
	}

	function nthIndexOf(haystack: string, needle: string, occurrence: number): number {
		let from = 0;
		let found = -1;
		for (let count = 0; count < occurrence; count += 1) {
			found = haystack.indexOf(needle, from);
			if (found < 0) return -1;
			from = found + needle.length;
		}
		return found;
	}

	function makeAnswerParts(value: string, issues: TutorIssue[]): AnswerPart[] {
		const located = issues
			.map((issue, issueIndex) => ({ issue, issueIndex, start: nthIndexOf(value, issue.text, issue.occurrence) }))
			.filter((item) => item.start >= 0)
			.sort((a, b) => a.start - b.start);
		const parts: AnswerPart[] = [];
		let cursor = 0;
		for (const item of located) {
			if (item.start < cursor) continue;
			if (item.start > cursor) parts.push({ text: value.slice(cursor, item.start), issue: null, issueIndex: null });
			parts.push({ text: item.issue.text, issue: item.issue, issueIndex: item.issueIndex });
			cursor = item.start + item.issue.text.length;
		}
		if (cursor < value.length) parts.push({ text: value.slice(cursor), issue: null, issueIndex: null });
		return parts;
	}

	function segmentValue(value: string, locale: string): SurfacePiece[] {
		if (!value) return [];
		try {
			const segmenter = new Intl.Segmenter(locale, { granularity: 'word' });
			return [...segmenter.segment(value)].map((segment) => ({
				text: segment.segment,
				wordLike: Boolean(segment.isWordLike)
			}));
		} catch {
			return value.split(/(\s+)/u).filter(Boolean).map((text) => ({
				text,
				wordLike: !/^[\s.,!?。，！？、;:]+$/u.test(text)
			}));
		}
	}

	function segmentSurface(value: string): SurfacePiece[] {
		const locale = currentExercise.direction === 'from_english'
			? currentExercise.language
			: 'en';
		return segmentValue(value, locale);
	}

	function promptPieces(text: string, lookup?: string): SurfacePiece[] {
		if (lookup || currentExercise.direction === 'to_english') return [{ text, wordLike: true }];
		return segmentValue(text, 'en');
	}

	function openReference(surface: string, lookup?: string) {
		const source = lookup || surface;
		const cleaned = source.replace(/^[\s.,!?。，！？、;:]+|[\s.,!?。，！？、;:]+$/gu, '');
		if (!cleaned) return;
		referenceQuery = cleaned;
		referenceOpen = true;
	}

	function closeReference() {
		referenceOpen = false;
		setTimeout(() => document.querySelector<HTMLTextAreaElement>('#tutor-answer')?.focus(), 40);
	}

	function lookUpExpandedIssue() {
		if (result && expandedIssue !== null) openReference(result.issues[expandedIssue]?.text ?? '');
	}

	async function checkAnswer() {
		if (!editing || !answer.trim() || checking) return;
		checking = true;
		requestError = '';
		expandedIssue = null;

		const requestBody: TutorRequest = {
			exerciseId: currentExercise.id,
			answer,
			attempt,
			priorHints,
			profile
		};

		try {
			const response = await fetch('/api/tutor', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(requestBody)
			});
			const payload = await response.json();
			if (!response.ok) throw new Error(payload.message ?? 'The tutor could not check that answer.');

			result = payload as TutorResult;
			editing = false;
			priorHints = [...priorHints, result.hint].slice(-3);
			const alreadyComplete = profile.completedExerciseIds.includes(currentExercise.id);
			const completedIds = result.status === 'correct' && !alreadyComplete
				? [...profile.completedExerciseIds, currentExercise.id]
				: profile.completedExerciseIds;
			const nextLevel = Math.max(2, Math.min(5, profile.level + result.learnerUpdate.difficultyDelta));
			persistProfile({
				...profile,
				level: nextLevel,
				observedLevel: result.learnerUpdate.observedLevel,
				strengths: result.learnerUpdate.strengths,
				focus: result.learnerUpdate.focus,
				completedExerciseIds: completedIds,
				attempts: profile.attempts + 1,
				correct: profile.correct + (result.status === 'correct' && !alreadyComplete ? 1 : 0)
			});
		} catch (cause) {
			requestError = cause instanceof Error ? cause.message : 'The tutor could not check that answer.';
		} finally {
			checking = false;
		}
	}

	function reviseAnswer() {
		editing = true;
		attempt += 1;
		setTimeout(() => {
			const field = document.querySelector<HTMLTextAreaElement>('#tutor-answer');
			field?.focus();
			field?.setSelectionRange(field.value.length, field.value.length);
		}, 40);
	}

	function nextExercise() {
		currentExercise = chooseNextTutorExercise(profile, currentExercise.id);
		answer = '';
		result = null;
		editing = true;
		attempt = 1;
		priorHints = [];
		expandedIssue = null;
		requestError = '';
		completedCount += 1;
		closeReference();
		setTimeout(() => document.querySelector<HTMLTextAreaElement>('#tutor-answer')?.focus(), 80);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (editing && (event.metaKey || event.ctrlKey) && event.key === 'Enter') {
			event.preventDefault();
			void checkAnswer();
		}
		if (event.key === 'Escape') closeReference();
	}
</script>

<svelte:head>
	<title>AI translation tutor — Kiokun</title>
	<meta name="description" content="Practice intermediate Japanese and Mandarin translation with precise, adaptive feedback grounded in Kiokun's dictionary." />
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<Header currentWord="" />

<div class:with-reference={referenceOpen} class="tutor-shell">
	<header class="tutor-bar">
		<div class="practice-name">
			<strong>Translation tutor</strong>
			<span>Japanese · Mandarin</span>
		</div>

		<button type="button" class="tutor-focus" onclick={() => profileOpen = !profileOpen} aria-expanded={profileOpen}>
			<span>Tutor focus</span>
			<strong>{profile.focus[0] ?? 'meaning in context'}</strong>
		</button>

		<div class="session-position" aria-label="Session position">
			<span>{currentExercise.levelLabel}</span>
			<span aria-hidden="true">·</span>
			<span>{completedCount + 1}</span>
		</div>

		{#if profileOpen}
			<aside class="profile-popover">
				<p class="profile-title">What your tutor is noticing</p>
				<dl>
					<div><dt>Working level</dt><dd>{profile.observedLevel}</dd></div>
					<div><dt>Current focus</dt><dd>{profile.focus.join(' · ') || 'Meaning in context'}</dd></div>
					<div><dt>Emerging strengths</dt><dd>{profile.strengths.length ? profile.strengths.join(' · ') : 'Still gathering evidence'}</dd></div>
				</dl>
				<p>Difficulty changes gradually. One answer never determines your level.</p>
			</aside>
		{/if}
	</header>

	<div class="practice-viewport">
		<main id="main-content" class="workbench">
			<section class="prompt-region" aria-labelledby="prompt-label">
				<div class="prompt-meta">
					<span id="prompt-label">Translate into {currentExercise.direction === 'to_english' ? 'English' : currentExercise.language === 'ja' ? 'Japanese' : 'Mandarin'}</span>
					<span>{directionLabel}</span>
				</div>
				<p class:english-prompt={currentExercise.direction === 'from_english'} class="source-sentence" lang={currentExercise.direction === 'to_english' ? currentExercise.language : 'en'}>
					{#each currentExercise.promptTokens as token}
						{#each promptPieces(token.text, token.lookup) as piece}
							{#if piece.wordLike}
								<button
									type="button"
									class:has-entry={Boolean(token.lookup)}
									class="surface-token"
									onclick={() => openReference(piece.text, token.lookup)}
									title={token.lookup ? 'Open in Kiokun' : 'Look up this word'}
								>{piece.text}</button>
							{:else}{piece.text}{/if}
						{/each}
					{/each}
				</p>
				<p class="source-help">Select any word to open its Kiokun entry.</p>
			</section>

			<section class="answer-region" aria-label="Your translation">
				{#if editing}
					<label class="visually-hidden" for="tutor-answer">Your translation</label>
					<textarea
						id="tutor-answer"
						bind:value={answer}
						lang={currentExercise.direction === 'from_english' ? currentExercise.language : 'en'}
						placeholder={currentExercise.direction === 'to_english' ? 'Write what it means…' : currentExercise.language === 'ja' ? '日本語で書いてください…' : '请用中文写…'}
						rows="3"
						maxlength="1200"
						spellcheck={currentExercise.direction === 'to_english'}
						aria-describedby="answer-instruction"
					></textarea>
					<div class:visible={answer.length > 0} class="writing-trace" aria-hidden="true"></div>
					<div class="answer-actions">
						<span id="answer-instruction">Press {shortcutKey} + Enter to check</span>
						<button type="button" class="check-button" onclick={checkAnswer} disabled={!answer.trim() || checking}>
							{#if checking}<span class="checking-mark" aria-hidden="true"></span> Reading your sentence{:else}Check answer <span aria-hidden="true">→</span>{/if}
						</button>
					</div>

					{#if result && result.status !== 'correct'}
						<div class="revision-memory">
							<span>Keep in mind</span>
							<p>{result.summary}</p>
						</div>
					{/if}
				{:else if result}
					<div class:correct={result.status === 'correct'} class:repairable={result.status === 'repairable'} class:retry={result.status === 'retry'} class="annotated-answer">
						<p class="answer-text" lang={currentExercise.direction === 'from_english' ? currentExercise.language : 'en'}>
							{#if result.status === 'repairable'}
								{#each answerParts as part}
									{#if part.issue && part.issueIndex !== null}
										<button
											type="button"
											class:active={expandedIssue === part.issueIndex}
											class="issue-mark"
											onclick={() => expandedIssue = expandedIssue === part.issueIndex ? null : part.issueIndex}
											aria-describedby={`issue-tip-${part.issueIndex}`}
										>
											{part.text}
											<span class="issue-tooltip" id={`issue-tip-${part.issueIndex}`} role="tooltip">{part.issue.tooltip}</span>
										</button>
									{:else}
										{#each segmentSurface(part.text) as piece}
											{#if piece.wordLike}<button type="button" class="surface-token" onclick={() => openReference(piece.text)}>{piece.text}</button>{:else}{piece.text}{/if}
										{/each}
									{/if}
								{/each}
							{:else}
								{#each segmentSurface(answer) as piece}
									{#if piece.wordLike}<button type="button" class="surface-token" onclick={() => openReference(piece.text)}>{piece.text}</button>{:else}{piece.text}{/if}
								{/each}
							{/if}
						</p>
						<span class="answer-verdict" aria-hidden="true">{result.status === 'correct' ? '✓' : '×'}</span>
					</div>

					<div class="result-summary" aria-live="polite">
						<strong>{result.status === 'correct' ? 'Correct' : result.status === 'repairable' ? 'Nearly there' : 'Try another approach'}</strong>
						<p>{result.summary}</p>
					</div>

					{#if result.status !== 'correct'}
						<button type="button" class="revise-button" onclick={reviseAnswer}>Revise your sentence <span aria-hidden="true">↗</span></button>
					{/if}

					{#if expandedIssue !== null && result.issues[expandedIssue]}
						<aside class="issue-detail" aria-live="polite">
							<div>
								<span>{result.issues[expandedIssue].category.replace('_', ' ')}</span>
								<p>{result.issues[expandedIssue].detail}</p>
							</div>
							<button type="button" onclick={lookUpExpandedIssue}>Look this up</button>
						</aside>
					{/if}

					{#if result.status === 'correct'}
						<section class="grammar-notes" aria-labelledby="grammar-title">
							<div class="section-rule"><h2 id="grammar-title">Why it works</h2></div>
							<div class="grammar-grid">
								{#each result.grammarPoints as point}
									<article>
										<button type="button" onclick={() => openReference(point.title)}>{point.title}</button>
										<p>{point.explanation}</p>
										<blockquote>{point.example}</blockquote>
									</article>
								{/each}
							</div>
							<button type="button" class="next-button" onclick={nextExercise}>Next sentence <span aria-hidden="true">→</span></button>
						</section>
					{/if}
				{/if}

				{#if requestError}
					<div class="request-error" role="alert">
						<strong>Check interrupted</strong>
						<span>{requestError}</span>
						<button type="button" onclick={checkAnswer}>Try again</button>
					</div>
				{/if}
			</section>

			{#if result && result.status !== 'correct'}
				<aside class="hint-dock" aria-live="polite">
					<span class="hint-label">A nudge, not the answer</span>
					<p>{result.hint}</p>
				</aside>
			{/if}
		</main>
	</div>

	{#if referenceOpen}
		<div class="reference-slot">
			<TutorReferencePane
				query={referenceQuery}
				language={currentExercise.language}
				context={currentExercise.context}
				onclose={closeReference}
			/>
		</div>
	{/if}
</div>

<style>
	.tutor-shell {
		--tutor-bar-height: 3.6rem;
		--tutor-error-text: #b42318;
		display: grid;
		height: calc(100svh - 3.75rem);
		min-height: 0;
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: var(--tutor-bar-height) minmax(0, 1fr);
		overflow: hidden;
		background: var(--bg-primary);
		color: var(--text-primary);
	}

	:global([data-theme='dark']) .tutor-shell { --tutor-error-text: #fca5a5; }

	.tutor-shell.with-reference {
		grid-template-rows: var(--tutor-bar-height) minmax(0, 1fr) 50svh;
	}

	.tutor-bar {
		position: relative;
		z-index: 20;
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		padding: 0 clamp(1rem, 4vw, 3.75rem);
		border-bottom: 1px solid var(--border-color);
		background: var(--bg-primary);
	}

	.practice-name {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		font-size: var(--font-size-subhead);
	}

	.practice-name span,
	.tutor-focus span,
	.session-position {
		color: var(--text-muted);
		font-size: var(--font-size-caption1);
	}

	.tutor-focus {
		display: flex;
		min-height: 2.75rem;
		align-items: baseline;
		gap: 0.6rem;
		padding: 0 1rem;
		border: 0;
		border-inline: 1px solid transparent;
		background: transparent;
		color: var(--text-primary);
		cursor: pointer;
	}

	.tutor-focus:hover,
	.tutor-focus[aria-expanded='true'] {
		border-color: var(--border-color);
		background: var(--bg-secondary);
	}

	.tutor-focus strong,
	.practice-name strong {
		font-size: var(--font-size-subhead);
		font-weight: 720;
	}

	.session-position {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.profile-popover {
		position: absolute;
		z-index: 30;
		top: calc(100% + 1px);
		left: 50%;
		width: min(27.5rem, calc(100vw - 2rem));
		padding: 1.25rem 1.5rem 1.4rem;
		border: 1px solid var(--border-color);
		background: var(--bg-secondary);
		box-shadow: 0 0.75rem 2rem var(--shadow);
		transform: translateX(-50%);
	}

	.profile-title {
		margin: 0 0 1rem;
		font-weight: 750;
	}

	.profile-popover dl { margin: 0; }

	.profile-popover dl div {
		display: grid;
		grid-template-columns: 7rem 1fr;
		padding: 0.65rem 0;
		border-top: 1px solid var(--border-color);
	}

	.profile-popover dt,
	.profile-popover > p:last-child {
		color: var(--text-muted);
		font-size: var(--font-size-caption1);
	}

	.profile-popover dd {
		margin: 0;
		font-size: var(--font-size-footnote);
	}

	.profile-popover > p:last-child {
		margin: 0.9rem 0 0;
		line-height: 1.5;
	}

	.practice-viewport {
		position: relative;
		min-width: 0;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.workbench {
		width: min(72.5rem, calc(100% - 3rem));
		margin: 0 auto;
		padding: clamp(2.4rem, 7vh, 4.9rem) 0 8rem;
	}

	.prompt-region,
	.answer-region {
		max-width: 60rem;
		margin-inline: auto;
	}

	.prompt-meta {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--text-muted);
		color: var(--text-muted);
		font-size: var(--font-size-caption1);
	}

	.prompt-meta span:first-child {
		color: var(--text-primary);
		font-weight: 720;
	}

	.source-sentence {
		margin: clamp(1.6rem, 4vh, 2.75rem) 0 0;
		font-family: var(--font-cjk);
		font-size: clamp(2rem, 4vw, 3.2rem);
		font-weight: 560;
		letter-spacing: -0.025em;
		line-height: 1.5;
		text-wrap: pretty;
	}

	.source-sentence.english-prompt {
		max-width: 26ch;
		font-size: clamp(2rem, 4vw, 3.35rem);
		line-height: 1.3;
	}

	.surface-token {
		position: relative;
		display: inline;
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
		text-align: inherit;
	}

	.surface-token::before {
		position: absolute;
		top: 50%;
		left: 50%;
		width: max(100%, 2.75rem);
		height: 2.75rem;
		content: '';
		transform: translate(-50%, -50%);
	}

	.surface-token:hover,
	.surface-token.has-entry {
		color: var(--accent);
		text-decoration: underline 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
		text-underline-offset: 0.45rem;
	}

	.source-help {
		margin: 0.9rem 0 0;
		color: var(--text-muted);
		font-size: var(--font-size-caption1);
	}

	.answer-region {
		position: relative;
		margin-top: clamp(3.5rem, 10vh, 7rem);
	}

	#tutor-answer {
		display: block;
		width: 100%;
		min-height: 10.6rem;
		padding: 0 0 1.75rem;
		overflow: hidden;
		border: 0;
		outline: 0;
		background: transparent;
		color: var(--text-primary);
		caret-color: var(--accent);
		font-family: var(--font-cjk);
		font-size: clamp(2.2rem, 5.5vw, 4.1rem);
		font-weight: 470;
		letter-spacing: -0.03em;
		line-height: 1.3;
		resize: none;
	}

	#tutor-answer::placeholder {
		color: var(--text-secondary);
		opacity: 1;
	}

	.writing-trace {
		width: 100%;
		height: 2px;
		background: var(--border-color);
		transform: scaleX(0.04);
		transform-origin: left;
		transition: transform 700ms cubic-bezier(0.16, 1, 0.3, 1), background 220ms ease;
	}

	.writing-trace.visible {
		background: var(--accent);
		transform: scaleX(1);
	}

	.answer-actions {
		display: flex;
		min-height: 4rem;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		color: var(--text-muted);
		font-size: var(--font-size-caption1);
	}

	.check-button,
	.next-button,
	.revise-button {
		min-height: 2.75rem;
		border: 0;
		background: transparent;
		color: var(--text-primary);
		cursor: pointer;
		font-weight: 760;
	}

	.check-button { padding-inline: 1.3rem 0.15rem; }

	.check-button span:not(.checking-mark),
	.next-button span,
	.revise-button span {
		display: inline-block;
		margin-left: 0.9rem;
		transition: transform 180ms ease;
	}

	.check-button:hover span:not(.checking-mark),
	.next-button:hover span,
	.revise-button:hover span { transform: translateX(0.25rem); }

	.check-button:disabled {
		cursor: default;
		opacity: 0.45;
	}

	.checking-mark {
		display: inline-block;
		width: 0.8rem;
		height: 0.8rem;
		margin-right: 0.55rem;
		border: 1.5px solid var(--border-color);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: tutor-spin 750ms linear infinite;
	}

	.revision-memory,
	.result-summary {
		display: grid;
		grid-template-columns: 7.9rem 1fr;
		padding: 1.1rem 0;
		border-top: 1px solid var(--border-color);
		color: var(--text-secondary);
		font-size: var(--font-size-footnote);
	}

	.revision-memory span {
		color: var(--tutor-error-text);
		font-weight: 700;
	}

	.revision-memory p,
	.result-summary p { margin: 0; }

	.annotated-answer {
		position: relative;
		min-height: 9.5rem;
		padding: 0 4.6rem 1.9rem 0;
		border-bottom: 2px solid var(--color-error);
	}

	.annotated-answer.correct { border-color: var(--accent); }

	.answer-text {
		margin: 0;
		font-family: var(--font-cjk);
		font-size: clamp(2.2rem, 5.5vw, 4.1rem);
		font-weight: 470;
		letter-spacing: -0.03em;
		line-height: 1.34;
	}

	.answer-verdict {
		position: absolute;
		top: 0.5rem;
		right: 0.25rem;
		display: grid;
		width: 3rem;
		height: 3rem;
		place-items: center;
		border: 1px solid currentColor;
		border-radius: 50%;
		color: var(--color-error);
		font-size: 1.75rem;
	}

	.annotated-answer.correct .answer-verdict { color: var(--accent); }

	.issue-mark {
		position: relative;
		display: inline;
		padding: 0 0.12rem 0.3rem;
		border: 0;
		background: color-mix(in srgb, var(--color-error) 13%, transparent);
		color: var(--color-error);
		cursor: help;
		font: inherit;
		text-decoration: underline wavy 1.5px;
		text-underline-offset: 0.5rem;
	}

	.issue-mark:hover,
	.issue-mark.active { background: color-mix(in srgb, var(--color-error) 22%, transparent); }

	.issue-tooltip {
		position: absolute;
		z-index: 12;
		bottom: calc(100% + 0.9rem);
		left: 50%;
		width: max-content;
		max-width: min(20.5rem, 76vw);
		padding: 0.65rem 0.75rem;
		border: 1px solid var(--color-error);
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-size: var(--font-size-caption1);
		font-weight: 520;
		line-height: 1.45;
		opacity: 0;
		pointer-events: none;
		transform: translate(-50%, 0.3rem);
		transition: opacity 120ms ease, transform 120ms ease;
	}

	.issue-mark:hover .issue-tooltip,
	.issue-mark:focus-visible .issue-tooltip,
	.issue-mark.active .issue-tooltip {
		opacity: 1;
		transform: translate(-50%, 0);
	}

	.result-summary { border-top: 0; }
	.result-summary strong { color: var(--accent); }
	.annotated-answer.repairable + .result-summary strong,
	.annotated-answer.retry + .result-summary strong { color: var(--tutor-error-text); }

	.result-summary p {
		max-width: 68ch;
		font-size: var(--font-size-callout);
		line-height: 1.6;
	}

	.issue-detail {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1.75rem;
		margin-top: 1.1rem;
		padding: 1.25rem 0 1.25rem 7.9rem;
		border-top: 1px solid var(--color-error);
		border-bottom: 1px solid var(--border-color);
	}

	.issue-detail span {
		color: var(--tutor-error-text);
		font-size: var(--font-size-caption2);
		font-weight: 740;
		text-transform: capitalize;
	}

	.issue-detail p {
		max-width: 65ch;
		margin: 0.45rem 0 0;
		line-height: 1.6;
	}

	.issue-detail > button {
		min-height: 2.75rem;
		flex: 0 0 auto;
		padding: 0;
		border: 0;
		border-bottom: 1px solid var(--text-muted);
		background: transparent;
		color: var(--text-primary);
		cursor: pointer;
		font-size: var(--font-size-caption1);
	}

	.revise-button,
	.next-button {
		display: block;
		margin: 1.6rem 0 0 auto;
	}

	.grammar-notes { margin-top: clamp(2.9rem, 7vh, 4.75rem); }
	.section-rule { border-top: 1px solid var(--text-muted); }

	.section-rule h2 {
		width: fit-content;
		margin: -0.8rem 0 0;
		padding-right: 1rem;
		background: var(--bg-primary);
		font-size: var(--font-size-body);
	}

	.grammar-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		margin-top: 1.9rem;
		border-top: 1px solid var(--border-color);
		border-left: 1px solid var(--border-color);
	}

	.grammar-grid article {
		min-height: 11.9rem;
		padding: 1.25rem;
		border-right: 1px solid var(--border-color);
		border-bottom: 1px solid var(--border-color);
	}

	.grammar-grid article > button {
		min-height: 2rem;
		padding: 0;
		border: 0;
		border-bottom: 1px solid var(--text-muted);
		background: transparent;
		color: var(--text-primary);
		cursor: pointer;
		font-weight: 760;
	}

	.grammar-grid p,
	.grammar-grid blockquote {
		font-size: var(--font-size-footnote);
		line-height: 1.55;
	}

	.grammar-grid p { color: var(--text-secondary); }

	.grammar-grid blockquote {
		margin: 1.1rem 0 0;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border-color);
	}

	.request-error {
		display: grid;
		grid-template-columns: 8.75rem 1fr auto;
		align-items: center;
		gap: 1rem;
		margin-top: 1.5rem;
		padding: 1rem 0;
		border-block: 1px solid var(--color-error);
		color: var(--tutor-error-text);
		font-size: var(--font-size-footnote);
	}

	.request-error button {
		min-height: 2.5rem;
		border: 0;
		border-bottom: 1px solid currentColor;
		background: transparent;
		color: inherit;
		cursor: pointer;
	}

	.hint-dock {
		position: sticky;
		z-index: 10;
		bottom: 1rem;
		display: grid;
		grid-template-columns: 10.6rem 1fr;
		align-items: center;
		margin-top: 3rem;
		padding: 1rem 1.4rem;
		border: 1px solid var(--color-hint-border);
		background: var(--color-hint-bg);
		color: var(--color-hint-text);
	}

	.hint-label {
		font-size: var(--font-size-caption2);
		font-weight: 780;
	}

	.hint-dock p {
		margin: 0;
		font-size: var(--font-size-subhead);
		line-height: 1.5;
	}

	.reference-slot {
		min-width: 0;
		min-height: 0;
		overflow: hidden;
	}

	.reference-slot :global(.reference-pane) { height: 100%; }

	@keyframes tutor-spin {
		to { transform: rotate(360deg); }
	}

	@media (min-width: 760px) {
		.tutor-shell { height: calc(100svh - 4.5rem); }
	}

	@media (min-width: 760px) and (min-aspect-ratio: 1 / 1) {
		.tutor-shell.with-reference {
			grid-template-columns: minmax(0, 1fr) minmax(22.5rem, 34vw);
			grid-template-rows: var(--tutor-bar-height) minmax(0, 1fr);
		}

		.tutor-bar { grid-column: 1 / -1; }
		.practice-viewport { grid-column: 1; grid-row: 2; }
		.reference-slot { grid-column: 2; grid-row: 2; }
	}

	@media (max-width: 760px) {
		.tutor-bar {
			grid-template-columns: 1fr auto;
			padding-inline: 1rem;
		}

		.practice-name span,
		.tutor-focus { display: none; }

		.workbench {
			width: calc(100% - 2rem);
			padding-top: 1.9rem;
			padding-bottom: 7rem;
		}

		.prompt-meta { gap: 1rem; }
		.prompt-meta span:last-child { text-align: right; }

		.source-sentence,
		.source-sentence.english-prompt {
			margin-top: 1.5rem;
			font-size: 1.88rem;
			line-height: 1.48;
		}

		.source-help { display: none; }
		.answer-region { margin-top: 4.25rem; }

		#tutor-answer {
			min-height: 10rem;
			font-size: 2.45rem;
			line-height: 1.35;
		}

		.answer-actions {
			align-items: flex-end;
		}

		.answer-actions > span {
			max-width: 7.5rem;
			line-height: 1.35;
		}

		.check-button { white-space: nowrap; }

		.annotated-answer {
			min-height: 8rem;
			padding-right: 2.9rem;
		}

		.answer-text { font-size: 2.38rem; }

		.answer-verdict {
			width: 2.25rem;
			height: 2.25rem;
			font-size: 1.35rem;
		}

		.result-summary,
		.revision-memory { display: block; }

		.result-summary strong,
		.revision-memory span {
			display: block;
			margin-bottom: 0.45rem;
		}

		.issue-detail {
			display: block;
			padding: 1rem 0;
		}

		.issue-detail > button { margin-top: 0.75rem; }
		.grammar-grid { grid-template-columns: 1fr; }
		.grammar-grid article { min-height: 0; }

		.request-error {
			display: flex;
			align-items: flex-start;
			flex-direction: column;
		}

		.hint-dock {
			bottom: 0.6rem;
			display: block;
			padding: 0.9rem 1rem;
		}

		.hint-label {
			display: block;
			margin-bottom: 0.3rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.writing-trace,
		.check-button span,
		.next-button span,
		.revise-button span,
		.issue-tooltip {
			transition: none;
		}

		.checking-mark { animation: none; }
	}
</style>
