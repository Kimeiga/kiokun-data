<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { parseSentenceFromURL } from '$lib/stores/sentence.svelte';
	import { resolveWordNavigationUrl } from '$lib/utils/search-navigation';

	interface Props {
		/** The currently displayed word (to highlight in the sentence) */
		currentWord?: string;
	}

	let { currentWord = '' }: Props = $props();

	// Parse sentence context from URL
	let sentenceContext = $derived(parseSentenceFromURL($page.url.searchParams));

	// Get tokens and words from context
	let tokens = $derived(sentenceContext?.tokenized.tokens ?? []);
	let words = $derived(tokens.filter(t => t.isWordLike));
	let language = $derived(sentenceContext?.tokenized.language ?? null);
	let sentence = $derived(sentenceContext?.sentence ?? '');

	// Check if we're in character-by-character mode
	let isCharMode = $derived($page.url.searchParams.get('c') === '1');
	let pendingToken = $state<string | null>(null);

	// Find the index of the current word in the words array
	let currentWordIndex = $derived.by(() => {
		if (!currentWord) return -1;
		return words.findIndex(w => w.segment === currentWord);
	});

	async function handleWordClick(word: string, index: number, tokenStart: number) {
		pendingToken = `${word}:${tokenStart}`;
		try {
			const url = await resolveWordNavigationUrl(word, fetch, {
				sentence,
				wordIndex: index,
				charMode: isCharMode
			});
			await goto(url);
		} finally {
			pendingToken = null;
		}
	}

	function handleClose() {
		// Navigate to current word without sentence params
		if (currentWord) {
			goto(`/${encodeURIComponent(currentWord)}`);
		} else {
			goto('/');
		}
	}

	// Language flag helper
	function getLanguageFlag(lang: string | null): string {
		switch (lang) {
			case 'ja': return '🇯🇵';
			case 'zh': return '🇨🇳';
			case 'ko': return '🇰🇷';
			default: return '📝';
		}
	}
</script>

{#if sentenceContext}
	<div class="sentence-bar">
		<div class="sentence-content">
			<span class="language-indicator">{getLanguageFlag(language)}</span>
			<div class="tokens-container">
				{#each tokens as token}
					{#if token.isWordLike}
						{@const wordIndex = words.findIndex(w => w.index === token.index)}
						<button
							class="word-token"
							class:active={token.segment === currentWord}
							class:visited={wordIndex < currentWordIndex && currentWordIndex >= 0}
							class:pending={pendingToken === `${token.segment}:${token.index}`}
							onclick={() => handleWordClick(token.segment, wordIndex, token.index)}
							title="Click to look up: {token.segment}"
						>
							{token.segment}
						</button>
					{:else}
						<span class="punctuation">{token.segment}</span>
					{/if}
				{/each}
			</div>
			<button
				class="close-button"
				onclick={handleClose}
				title="Close sentence reader"
				aria-label="Close sentence reader"
			>
				✕
			</button>
		</div>
	</div>
{/if}

<style>
	.sentence-bar {
		position: sticky;
		top: 60px; /* Below the header */
		z-index: 90;
		background: var(--bg-secondary, #1a1a2e);
		border-bottom: 1px solid var(--border, #333);
		padding: 0.75rem 1rem;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
	}

	.sentence-content {
		max-width: 1400px;
		margin: 0 auto;
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.language-indicator {
		font-size: 1.25rem;
		flex-shrink: 0;
	}

	.tokens-container {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.125rem;
		flex: 1;
		overflow-x: auto;
	}

	.word-token {
		background: transparent;
		border: none;
		padding: 0.25rem 0.5rem;
		margin: 0;
		font-size: 1.25rem;
		font-family: var(--font-cjk, 'Noto Sans SC', 'Noto Sans JP', sans-serif);
		color: var(--text-primary, #fff);
		cursor: pointer;
		border-radius: 0.25rem;
		transition: background 0.15s ease, color 0.15s ease;
	}

	.word-token:hover {
		background: var(--accent, #4a9eff);
		color: white;
	}

	.word-token.active {
		background: var(--accent, #4a9eff);
		color: white;
		font-weight: 600;
		box-shadow: 0 0 0 2px var(--accent, #4a9eff), 0 0 0 4px rgba(74, 158, 255, 0.3);
	}

	.word-token.pending {
		color: var(--accent, #4a9eff);
		cursor: wait;
		opacity: 0.72;
	}

	.word-token.visited {
		color: var(--text-tertiary, #888);
	}

	.punctuation {
		font-size: 1.25rem;
		color: var(--text-secondary, #aaa);
	}

	.close-button {
		background: transparent;
		border: 1px solid var(--border, #333);
		color: var(--text-secondary, #aaa);
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		flex-shrink: 0;
		transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
	}

	.close-button:hover {
		background: var(--bg-tertiary, #252540);
		color: var(--text-primary, #fff);
		border-color: var(--text-secondary, #aaa);
	}

	@media (max-width: 768px) {
		.sentence-bar {
			top: 52px;
			padding: 0.5rem 0.75rem;
		}

		.word-token,
		.punctuation {
			font-size: 1.1rem;
		}

		.word-token {
			padding: 0.2rem 0.4rem;
		}
	}
</style>
