<script lang="ts">
	import { dev } from '$app/environment';
	import { fly, fade } from 'svelte/transition';
	import { lookupWord, lookupTurkish, summarizeEntry, type EntrySummary } from '$lib/dictionary/lookup';
	import SpeakButton from '$lib/components/shared/SpeakButton.svelte';
	import type { Language } from '$lib/game/types';

	interface Props {
		/** The token/word to define. Null/empty closes the popup. */
		word: string | null;
		/** Current game language (drives which entry section to prefer). */
		lang: Language;
		onclose: () => void;
	}

	let { word, lang, onclose }: Props = $props();

	// Flat reactive fields (not a discriminated union accessed via {@const}) —
	// the union form crashed under Svelte 5 because the template re-evaluated
	// `summary.reading` mid-transition while the derived const was undefined.
	type Phase = 'idle' | 'loading' | 'ok' | 'notfound';
	let phase = $state<Phase>('idle');
	let summary = $state<EntrySummary | null>(null);
	let resolvedWord = $state('');
	let conjugationInfo = $state<string | undefined>(undefined);
	let notfoundWord = $state('');

	// SpeakButton only supports zh/ja/ko (no Turkish TTS voice set).
	const speakLang = $derived(
		phase === 'ok' && summary && summary.lang !== 'other'
			? (summary.lang as 'zh' | 'ja' | 'ko')
			: null
	);

	let requestId = 0;

	async function resolve(w: string) {
		const id = ++requestId; // guard against out-of-order async results
		phase = 'loading';
		summary = null;
		conjugationInfo = undefined;

		// Turkish has no Kiokun entry — resolve from ozcuk's CDN instead.
		if (lang === 'tr') {
			const tr = await lookupTurkish(w, fetch);
			if (id !== requestId) return;
			if (!tr) {
				notfoundWord = w;
				phase = 'notfound';
				return;
			}
			summary = tr;
			resolvedWord = w;
			conjugationInfo = undefined;
			phase = 'ok';
			return;
		}

		let result = await lookupWord(w, fetch, dev);
		let conj: string | undefined;

		// Follow a single deinflection redirect (JA conjugation / KO particles).
		if (result.status === 'redirect') {
			conj = result.conjugationInfo;
			result = await lookupWord(result.to, fetch, dev);
		}
		if (id !== requestId) return; // a newer lookup superseded this one

		if (result.status !== 'ok') {
			notfoundWord = w;
			phase = 'notfound';
			return;
		}

		const s = summarizeEntry(result.data, lang);
		if (!s) {
			notfoundWord = w;
			phase = 'notfound';
			return;
		}
		summary = s;
		resolvedWord = result.word;
		conjugationInfo = conj;
		phase = 'ok';
	}

	// React to the word prop changing (tile tapped).
	$effect(() => {
		const w = word?.trim();
		if (w) {
			resolve(w);
		} else {
			requestId++;
			phase = 'idle';
			summary = null;
		}
	});

	function close() {
		onclose();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if word}
	<button
		type="button"
		class="dp-backdrop"
		aria-label="Close definition"
		transition:fade={{ duration: 150 }}
		onclick={close}
	></button>

	<div
		class="dp-sheet"
		role="dialog"
		aria-modal="true"
		aria-label="Dictionary definition"
		transition:fly={{ y: 240, duration: 220 }}
	>
		<header class="dp-head">
			<span class="dp-token">{word}</span>
			<button class="dp-close" onclick={close} aria-label="Close definition">✕</button>
		</header>

		{#if phase === 'loading'}
			<p class="dp-status">Looking up…</p>
		{:else if phase === 'notfound'}
			<p class="dp-status">
				No dictionary entry for <strong>{notfoundWord}</strong>.
				<br />
				<small>Particles and inflected fragments often have no standalone entry.</small>
			</p>
		{:else if phase === 'ok' && summary}
			<div class="dp-headword-row">
				<div>
					<div class="dp-headword">{summary.headword}</div>
					{#if summary.reading}<div class="dp-reading">{summary.reading}</div>{/if}
				</div>
				{#if speakLang}
					<SpeakButton
						text={summary.headword.split(' / ')[0].split(' (')[0]}
						lang={speakLang}
						size={20}
					/>
				{/if}
			</div>

			{#if conjugationInfo}
				<div class="dp-conj">via {conjugationInfo}</div>
			{/if}

			<ol class="dp-defs">
				{#each summary.definitions.slice(0, 6) as def}
					<li>{def}</li>
				{/each}
			</ol>

			<a
				class="dp-full"
				href={summary.fullHref ?? `/${encodeURIComponent(resolvedWord)}`}
				target="_blank"
				rel="noopener"
			>
				Full entry →
			</a>
		{/if}
	</div>
{/if}

<style>
	.dp-backdrop {
		position: fixed;
		inset: 0;
		border: none;
		padding: 0;
		margin: 0;
		appearance: none;
		background: rgba(0, 0, 0, 0.45);
		cursor: pointer;
		z-index: 1000;
	}

	.dp-sheet {
		position: fixed;
		left: 50%;
		bottom: 0;
		transform: translateX(-50%);
		width: min(560px, 100%);
		max-height: 70vh;
		overflow-y: auto;
		background: var(--bg-secondary, #fff);
		color: var(--text-primary, #18181b);
		border: 1px solid var(--border-color, #e4e4e7);
		border-bottom: none;
		border-radius: 18px 18px 0 0;
		box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.22);
		padding: 1.1rem 1.25rem 1.5rem;
		z-index: 1001;
	}

	@media (min-width: 720px) {
		.dp-sheet {
			left: auto;
			right: 1.25rem;
			bottom: 1.25rem;
			transform: none;
			border: 1px solid var(--border-color, #e4e4e7);
			border-radius: 16px;
			max-height: 75vh;
		}
	}

	.dp-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.dp-token {
		font-size: 0.85rem;
		color: var(--text-muted, #a1a1aa);
	}

	.dp-close {
		background: transparent;
		border: none;
		color: var(--text-muted, #a1a1aa);
		font-size: 1rem;
		cursor: pointer;
		padding: 0.25rem 0.5rem;
		border-radius: 6px;
	}
	.dp-close:hover {
		background: var(--bg-tertiary, #f4f4f5);
		color: var(--text-primary, #18181b);
	}

	.dp-status {
		color: var(--text-secondary, #52525b);
		font-size: 0.95rem;
		line-height: 1.5;
		padding: 0.5rem 0 0.75rem;
	}
	.dp-status small {
		color: var(--text-muted, #a1a1aa);
	}

	.dp-headword-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.dp-headword {
		font-size: 1.9rem;
		font-weight: 600;
		line-height: 1.2;
	}

	.dp-reading {
		color: var(--text-secondary, #52525b);
		font-size: 1rem;
		margin-top: 0.15rem;
	}

	.dp-conj {
		margin-top: 0.5rem;
		font-size: 0.8rem;
		color: var(--text-muted, #a1a1aa);
		font-style: italic;
	}

	.dp-defs {
		margin: 0.9rem 0 1.1rem;
		padding-left: 1.3rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.dp-defs li {
		font-size: 0.98rem;
		line-height: 1.45;
		color: var(--text-primary, #18181b);
	}

	.dp-full {
		display: inline-block;
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--blue-primary, #3b82f6);
		text-decoration: none;
	}
	.dp-full:hover {
		text-decoration: underline;
	}
</style>
