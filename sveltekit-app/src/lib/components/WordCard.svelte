<script lang="ts">
	import SpeakButton from '$lib/components/shared/SpeakButton.svelte';

	interface WordCardProps {
		word: string;
		wordSlug: string;
		reading?: string;
		translation: string;
		context?: string;
		timestamp?: number;
	}

	let { word, wordSlug, reading, translation, context, timestamp }: WordCardProps = $props();

	function formatTimestamp(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}
</script>

<a href="/{wordSlug}" class="word-card">
	<div class="card-row">
		<span class="card-word">{word}</span>
		{#if reading}
			<span class="card-reading">{reading}</span>
		{/if}
		<span class="card-actions">
			{#if timestamp !== undefined && timestamp > 0}
				<span class="card-time">⏱ {formatTimestamp(timestamp)}</span>
			{/if}
			<SpeakButton text={word} lang="ja" size={16} />
		</span>
	</div>
	<div class="card-translation">{translation}</div>
	{#if context}
		<div class="card-context">"{context}"</div>
	{/if}
</a>

<style>
	.word-card {
		display: block;
		padding: 10px 14px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		text-decoration: none;
		color: inherit;
		transition: border-color 0.15s;
	}
	.word-card:hover {
		border-color: var(--accent);
	}

	.card-row {
		display: flex;
		align-items: baseline;
		gap: 8px;
		flex-wrap: wrap;
	}

	.card-word {
		font-size: var(--font-size-headline);
		font-weight: 600;
		color: var(--accent);
		font-family: var(--font-cjk);
	}

	.card-reading {
		font-size: var(--font-size-caption1);
		color: var(--text-secondary);
	}

	.card-actions {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}

	.card-time {
		font-size: var(--font-size-caption1);
		color: var(--text-muted);
	}

	.card-translation {
		font-size: var(--font-size-callout);
		color: var(--text-primary);
		margin-top: 2px;
		line-height: 1.4;
	}

	.card-context {
		font-size: var(--font-size-caption1);
		color: var(--text-muted);
		font-style: italic;
		font-family: var(--font-cjk);
		margin-top: 4px;
		line-height: 1.4;
	}
</style>
