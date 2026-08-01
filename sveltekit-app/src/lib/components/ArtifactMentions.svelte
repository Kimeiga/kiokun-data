<script lang="ts">
	import SectionHeading from './shared/SectionHeading.svelte';

	interface Props {
		word: string;
	}

	let { word }: Props = $props();

	interface ArtifactMention {
		id: string;
		title: string;
		language: string;
		type: string;
		user: { id: string; name: string } | null;
		sentences: { id: string; originalText: string; translation: string | null }[];
	}

	let mentions = $state<ArtifactMention[]>([]);
	let loading = $state(false);
	let hasLoaded = $state(false);

	$effect(() => {
		if (word) {
			loadMentions();
		}
	});

	async function loadMentions() {
		loading = true;
		try {
			const resp = await fetch(`/api/artifacts/by-word/${encodeURIComponent(word)}`);
			if (resp.ok) {
				mentions = await resp.json();
			}
		} catch {
			// ignore
		} finally {
			loading = false;
			hasLoaded = true;
		}
	}

	function typeEmoji(type: string): string {
		const emojis: Record<string, string> = {
			packaging: '📦', sign: '🪧', menu: '🍜', book: '📖', media: '📺', other: '📎',
		};
		return emojis[type] || '📎';
	}

	function highlightWord(text: string, target: string): string {
		// Simple highlight: wrap occurrences of the word
		const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		return text.replace(new RegExp(escaped, 'g'), `<mark>${target}</mark>`);
	}
</script>

{#if hasLoaded && mentions.length > 0}
	<div class="artifact-mentions" id="artifacts">
		<SectionHeading>Found In Artifacts</SectionHeading>
		<div class="mentions-list divider-grid mobile-full-bleed">
			{#each mentions as mention (mention.id)}
				<a href="/artifacts/{mention.id}" class="mention-card divider-cell">
					<div class="mention-header">
						<span class="mention-type">{typeEmoji(mention.type)}</span>
						<span class="mention-title">{mention.title}</span>
						{#if mention.user}
							<span class="mention-author">by {mention.user.name}</span>
						{/if}
					</div>
					{#each mention.sentences.slice(0, 2) as sentence}
						<div class="mention-sentence">
							{@html highlightWord(sentence.originalText, word)}
						</div>
						{#if sentence.translation}
							<div class="mention-translation">{sentence.translation}</div>
						{/if}
					{/each}
					{#if mention.sentences.length > 2}
						<span class="mention-more">+{mention.sentences.length - 2} more sentence{mention.sentences.length - 2 !== 1 ? 's' : ''}</span>
					{/if}
				</a>
			{/each}
		</div>
	</div>
{/if}

<style>
	.artifact-mentions { margin-top: var(--spacing-xl); }

	.mentions-list { grid-template-columns: 1fr; }

	.mention-card {
		display: block;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		padding: var(--spacing-lg);
		text-decoration: none;
		color: inherit;
		transition: border-color 0.15s;
	}
	.mention-card:hover { border-color: var(--accent); }

	.mention-header {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		margin-bottom: var(--spacing-sm);
	}
	.mention-type { font-size: var(--font-size-body); }
	.mention-title { font-size: var(--font-size-body); font-weight: 600; color: var(--text-primary); }
	.mention-author { font-size: var(--font-size-caption1); color: var(--text-muted); margin-left: auto; }

	.mention-sentence {
		font-size: var(--font-size-body);
		color: var(--text-primary);
		font-family: var(--font-cjk);
		line-height: 1.8;
	}
	.mention-sentence :global(mark) {
		background: var(--accent-light);
		color: var(--accent);
		padding: 0 2px;
		border-radius: 2px;
	}

	.mention-translation {
		font-size: var(--font-size-callout);
		color: var(--text-secondary);
		font-style: italic;
		margin-bottom: var(--spacing-sm);
	}

	.mention-more {
		font-size: var(--font-size-caption1);
		color: var(--text-muted);
	}
</style>
