<script lang="ts">
	import { useSession } from '$lib/auth-client';
	import Header from '$lib/components/Header.svelte';
	import type { SentenceLanguage } from '$lib/sentence-analysis';

	interface SavedSentence {
		id: string;
		text: string;
		language: SentenceLanguage;
		translation: string | null;
		pinyin: string | null;
		saveMode: 'manual' | 'auto';
		updatedAt: string;
		wordCount: number;
	}

	const session = useSession();
	let sentences = $state<SavedSentence[]>([]);
	let loading = $state(true);
	let errorMessage = $state('');
	let deletingId = $state('');

	const flags: Record<SentenceLanguage, string> = { ja: '🇯🇵', zh: '🇨🇳', ko: '🇰🇷' };

	function sentenceHref(sentence: SavedSentence): string {
		const params = new URLSearchParams({
			text: sentence.text,
			lang: sentence.language,
		});
		if (sentence.translation) params.set('en', sentence.translation);
		if (sentence.pinyin) params.set('py', sentence.pinyin);
		return `/sentence?${params.toString()}`;
	}

	async function loadSentences() {
		if (!$session.data?.user) {
			loading = false;
			return;
		}
		loading = true;
		errorMessage = '';
		try {
			const response = await fetch('/api/sentences');
			if (!response.ok) throw new Error(`Saved sentences failed (${response.status})`);
			const result = await response.json();
			sentences = result.sentences || [];
		} catch {
			errorMessage = 'Saved sentences could not be loaded. Please try again.';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if ($session.data?.user) void loadSentences();
		else if (!$session.isPending) loading = false;
	});

	async function deleteSentence(sentence: SavedSentence) {
		if (!confirm(`Remove “${sentence.text}” from saved sentences?`)) return;
		deletingId = sentence.id;
		try {
			const response = await fetch('/api/sentences', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: sentence.id }),
			});
			if (!response.ok) throw new Error(`Delete failed (${response.status})`);
			sentences = sentences.filter((item) => item.id !== sentence.id);
		} catch {
			errorMessage = 'That sentence could not be removed. Please try again.';
		} finally {
			deletingId = '';
		}
	}
</script>

<svelte:head>
	<title>Saved Sentences · Kiokun</title>
</svelte:head>

<Header autofocus={false} />

<main id="main-content" class="learner-page saved-page">
	<header class="learner-intro saved-intro">
		<div>
			<h1>Saved sentences</h1>
			<p>Reopen your searches with their readings, translation, and linked word analysis intact.</p>
		</div>
		<a href="/study?deck=searched-sentences">Study sentence words</a>
	</header>

	{#if !$session.data?.user && !$session.isPending}
		<section class="empty-state">
			<h2>Sign in to keep a sentence library</h2>
			<p>Saved and auto-saved searches will appear here on every device.</p>
		</section>
	{:else if loading}
		<div class="status" role="status">
			<span class="spinner" aria-hidden="true"></span>
			Loading saved sentences…
		</div>
	{:else if errorMessage}
		<div class="status status--error" role="alert">
			<span>{errorMessage}</span>
			<button type="button" onclick={loadSentences}>Try again</button>
		</div>
	{:else if sentences.length === 0}
		<section class="empty-state">
			<h2>No saved sentences yet</h2>
			<p>Paste a sentence into search, then choose Save. You can also turn on auto-save from the reader.</p>
			<a href="/">Search a sentence</a>
		</section>
	{:else}
		<div class="sentence-library">
			<div class="library-heading">
				<h2>{sentences.length} {sentences.length === 1 ? 'sentence' : 'sentences'}</h2>
				<span>Newest first</span>
			</div>

			<div class="sentence-list">
				{#each sentences as sentence (sentence.id)}
					<article class="saved-sentence">
						<a class="sentence-link" href={sentenceHref(sentence)}>
							<span class="sentence-meta">
								<span aria-hidden="true">{flags[sentence.language]}</span>
								<span>{sentence.wordCount} {sentence.wordCount === 1 ? 'word' : 'words'}</span>
								{#if sentence.saveMode === 'auto'}<span>Auto-saved</span>{/if}
							</span>
							<span class="sentence-text" lang={sentence.language}>{sentence.text}</span>
							{#if sentence.translation}
								<span class="sentence-translation">{sentence.translation}</span>
							{/if}
						</a>
						<button
							type="button"
							class="delete-button"
							disabled={deletingId === sentence.id}
							onclick={() => deleteSentence(sentence)}
							aria-label={`Remove ${sentence.text} from saved sentences`}
						>
							{deletingId === sentence.id ? 'Removing…' : 'Remove'}
						</button>
					</article>
				{/each}
			</div>
		</div>
	{/if}
</main>

<style>
	.saved-page {
		max-width: 58rem;
	}

	.saved-intro {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--spacing-xl);
	}

	.saved-intro > a,
	.empty-state > a {
		display: inline-flex;
		min-height: 2.75rem;
		flex: 0 0 auto;
		align-items: center;
		padding: 0 var(--spacing-lg);
		border-radius: var(--radius-full);
		background: var(--accent);
		color: var(--accent-contrast);
		font-size: var(--font-size-subhead);
		font-weight: 700;
		text-decoration: none;
	}

	.sentence-library {
		overflow: hidden;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		background: var(--bg-secondary);
	}

	.library-heading {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--spacing-md);
		padding: var(--spacing-md) var(--spacing-lg);
		border-bottom: 1px solid var(--border-light);
	}

	.library-heading h2 {
		margin: 0;
		font-size: var(--font-size-body);
	}

	.library-heading span {
		color: var(--text-tertiary);
		font-size: var(--font-size-caption1);
	}

	.saved-sentence {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		border-bottom: 1px solid var(--border-light);
	}

	.saved-sentence:last-child {
		border-bottom: 0;
	}

	.sentence-link {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: var(--spacing-xs);
		padding: var(--spacing-md) var(--spacing-lg);
		color: inherit;
		text-decoration: none;
	}

	.sentence-link:hover {
		background: var(--surface-hover);
	}

	.sentence-meta {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		color: var(--text-tertiary);
		font-size: var(--font-size-caption1);
	}

	.sentence-text {
		color: var(--text-primary);
		font-family: var(--font-cjk);
		font-size: clamp(1.1rem, 2.4vw, 1.35rem);
		line-height: 1.45;
	}

	.sentence-translation {
		overflow: hidden;
		color: var(--text-secondary);
		font-size: var(--font-size-subhead);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.delete-button,
	.status button {
		min-height: 2.75rem;
		margin-right: var(--spacing-md);
		padding: 0 var(--spacing-md);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--text-tertiary);
		font-size: var(--font-size-caption1);
		cursor: pointer;
	}

	.delete-button:hover,
	.status button:hover {
		border-color: var(--color-error);
		color: var(--color-error);
	}

	.delete-button:disabled {
		cursor: wait;
		opacity: 0.6;
	}

	.status,
	.empty-state {
		display: flex;
		min-height: 15rem;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-sm);
		color: var(--text-secondary);
		text-align: center;
	}

	.empty-state {
		flex-direction: column;
	}

	.empty-state h2,
	.empty-state p {
		margin: 0;
	}

	.empty-state p {
		max-width: 52ch;
	}

	.status--error {
		flex-direction: column;
	}

	.spinner {
		width: 1.1rem;
		height: 1.1rem;
		border: 2px solid var(--border-color);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 700ms linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	@media (max-width: 38rem) {
		.saved-intro {
			align-items: flex-start;
			flex-direction: column;
		}

		.saved-sentence {
			grid-template-columns: minmax(0, 1fr);
		}

		.delete-button {
			width: fit-content;
			margin: 0 var(--spacing-md) var(--spacing-md);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.spinner { animation-duration: 1.8s; }
	}
</style>
