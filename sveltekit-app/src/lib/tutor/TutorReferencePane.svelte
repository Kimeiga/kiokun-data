<script lang="ts">
	import { lookupWord, summarizeEntry, type EntrySummary } from '$lib/dictionary/lookup';
	import SpeakButton from '$lib/components/shared/SpeakButton.svelte';
	import type { TutorLanguage } from './types';

	interface SearchResult {
		word: string;
		targetWord?: string;
	}

	let {
		query,
		language,
		context,
		onclose
	}: {
		query: string;
		language: TutorLanguage;
		context: string;
		onclose: () => void;
	} = $props();

	type Phase = 'loading' | 'ready' | 'empty' | 'error';
	let phase = $state<Phase>('loading');
	let summary = $state<EntrySummary | null>(null);
	let resolvedWord = $state('');
	let conjugationInfo = $state('');
	let requestId = 0;

	async function exactLookup(word: string) {
		// Use Kiokun's same-origin dictionary proxy in every environment. The broader
		// dictionary pages use a local shard server during development, but the tutor
		// should work from a plain `vite dev` session as well as in production.
		let result = await lookupWord(word, fetch, false);
		let conjugation = '';
		if (result.status === 'redirect') {
			conjugation = result.conjugationInfo;
			result = await lookupWord(result.to, fetch, false);
		}
		return { result, conjugation };
	}

	async function searchLookup(word: string) {
		try {
			const response = await fetch(`/api/search?q=${encodeURIComponent(word)}&limit=1`);
			if (!response.ok) return null;
			const payload = await response.json() as { results?: SearchResult[] };
			const match = payload.results?.[0];
			return match?.targetWord || match?.word || null;
		} catch {
			return null;
		}
	}

	async function resolveReference(word: string) {
		const id = ++requestId;
		phase = 'loading';
		summary = null;
		conjugationInfo = '';

		try {
			let candidate = word;
			let { result, conjugation } = await exactLookup(candidate);

			if (result.status === 'notfound') {
				const searched = await searchLookup(word);
				if (searched) {
					candidate = searched;
					({ result, conjugation } = await exactLookup(candidate));
				}
			}

			if (id !== requestId) return;
			if (result.status !== 'ok') {
				phase = 'empty';
				return;
			}

			const nextSummary = summarizeEntry(result.data, language);
			if (!nextSummary) {
				phase = 'empty';
				return;
			}

			summary = nextSummary;
			resolvedWord = candidate;
			conjugationInfo = conjugation;
			phase = 'ready';
		} catch {
			if (id === requestId) phase = 'error';
		}
	}

	$effect(() => {
		const value = query.trim();
		if (value) void resolveReference(value);
	});

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<aside class="reference-pane" aria-label="Kiokun dictionary reference">
	<header class="reference-header">
		<strong>Kiokun reference</strong>
		<button type="button" onclick={onclose} aria-label="Close dictionary reference">×</button>
	</header>

	<div class="reference-scroll" aria-live="polite">
		{#if phase === 'loading'}
			<div class="reference-status">
				<span class="lookup-mark" aria-hidden="true"></span>
				<p>Looking up <strong>{query}</strong>…</p>
			</div>
		{:else if phase === 'ready' && summary}
			<section class="entry-heading">
				<div>
					<h2 lang={summary.lang === 'other' ? undefined : summary.lang}>{summary.headword}</h2>
					{#if summary.reading}<p>{summary.reading}</p>{/if}
				</div>
				<div class="entry-tools">
					<span>{summary.lang === 'ja' ? 'Japanese' : summary.lang === 'zh' ? 'Mandarin' : 'Korean'}</span>
					{#if summary.lang !== 'other'}
						<SpeakButton text={summary.headword.split(' / ')[0]} lang={summary.lang} size={20} />
					{/if}
				</div>
			</section>

			{#if conjugationInfo}<p class="conjugation-note">Found through {conjugationInfo}</p>{/if}

			<section class="definition-section">
				<h3>Meanings</h3>
				<ol>
					{#each summary.definitions.slice(0, 8) as definition}
						<li>{definition}</li>
					{/each}
				</ol>
			</section>

			<section class="context-section">
				<h3>In this sentence</h3>
				<p>{context}</p>
			</section>

			<a class="full-entry" href={summary.fullHref ?? `/${encodeURIComponent(resolvedWord)}`}>
				Open the full entry <span aria-hidden="true">→</span>
			</a>
		{:else}
			<div class="reference-empty">
				<span>Selected text</span>
				<h2>{query}</h2>
				<p>
					{phase === 'error'
						? 'The dictionary could not be reached. Your sentence is still available in the practice pane.'
						: 'No exact Kiokun entry was found for this selection. Try a shorter word or search the full dictionary.'}
				</p>
				<a href={`/search?q=${encodeURIComponent(query)}`}>Search Kiokun <span aria-hidden="true">→</span></a>
			</div>
		{/if}
	</div>
</aside>

<style>
	.reference-pane {
		display: grid;
		min-width: 0;
		min-height: 0;
		grid-template-rows: 3.6rem minmax(0, 1fr);
		border-top: 1px solid var(--border-color);
		background: var(--bg-secondary);
		color: var(--text-primary);
	}

	.reference-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 1rem 0 1.25rem;
		background: var(--section-bar-bg);
		color: var(--section-bar-text);
		font-size: var(--font-size-subhead);
	}

	.reference-header button {
		display: grid;
		width: 2.75rem;
		height: 2.75rem;
		place-items: center;
		border: 0;
		background: transparent;
		color: inherit;
		cursor: pointer;
		font-size: 1.7rem;
		font-weight: 300;
	}

	.reference-header button:hover,
	.reference-header button:focus-visible {
		background: color-mix(in srgb, currentColor 12%, transparent);
	}

	.reference-scroll {
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.entry-heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.5rem 1.25rem;
		border-bottom: 1px solid var(--border-color);
	}

	.entry-heading h2,
	.reference-empty h2 {
		margin: 0;
		font-family: var(--font-cjk);
		font-size: clamp(2rem, 4vw, 3rem);
		font-weight: 680;
		letter-spacing: -0.03em;
		line-height: 1.15;
	}

	.entry-heading p {
		margin: 0.35rem 0 0;
		color: var(--accent);
		font-size: var(--font-size-subhead);
	}

	.entry-tools {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		color: var(--text-muted);
		font-size: var(--font-size-caption1);
	}

	.conjugation-note {
		margin: 0;
		padding: 0.65rem 1.25rem;
		border-bottom: 1px solid var(--border-color);
		color: var(--text-secondary);
		font-size: var(--font-size-caption1);
	}

	.definition-section,
	.context-section {
		padding: 1.2rem 1.25rem 1.4rem;
		border-bottom: 1px solid var(--border-color);
	}

	.definition-section h3,
	.context-section h3 {
		margin: 0 0 0.8rem;
		font-size: var(--font-size-subhead);
	}

	.definition-section ol {
		display: grid;
		gap: 0.55rem;
		margin: 0;
		padding-left: 1.35rem;
	}

	.definition-section li,
	.context-section p {
		font-size: var(--font-size-callout);
		line-height: 1.55;
	}

	.context-section {
		background: var(--accent-light);
	}

	.context-section p {
		margin: 0;
	}

	.full-entry,
	.reference-empty a {
		display: flex;
		min-height: 3.25rem;
		align-items: center;
		justify-content: space-between;
		padding: 0 1.25rem;
		border-bottom: 1px solid var(--border-color);
		color: var(--text-primary);
		font-size: var(--font-size-subhead);
		font-weight: 700;
		text-decoration: none;
	}

	.full-entry:hover,
	.reference-empty a:hover {
		background: var(--surface-hover);
		color: var(--accent);
	}

	.reference-status,
	.reference-empty {
		padding: 2rem 1.25rem;
	}

	.reference-status {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		color: var(--text-secondary);
	}

	.reference-status p {
		margin: 0;
	}

	.lookup-mark {
		width: 1rem;
		height: 1rem;
		border: 2px solid var(--border-color);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: lookup-spin 700ms linear infinite;
	}

	.reference-empty > span {
		color: var(--text-muted);
		font-size: var(--font-size-caption1);
	}

	.reference-empty h2 {
		margin-top: 0.65rem;
	}

	.reference-empty p {
		max-width: 52ch;
		margin: 1.5rem 0;
		color: var(--text-secondary);
		font-size: var(--font-size-callout);
		line-height: 1.6;
	}

	.reference-empty a {
		width: fit-content;
		padding-inline: 0;
		gap: 2rem;
	}

	@keyframes lookup-spin {
		to { transform: rotate(360deg); }
	}

	@media (min-width: 760px) and (min-aspect-ratio: 1 / 1) {
		.reference-pane {
			border-top: 0;
			border-left: 1px solid var(--border-color);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.lookup-mark { animation: none; }
	}
</style>
