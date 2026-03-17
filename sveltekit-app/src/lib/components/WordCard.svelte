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

<div class="word-card bg-bg-secondary border border-border rounded-lg p-4 hover:shadow-lg transition-shadow">
	<!-- Word Header -->
	<div class="flex items-start justify-between mb-3">
		<div class="flex-1">
			<a 
				href="/{wordSlug}" 
				class="text-2xl font-bold text-accent hover:underline font-cjk"
			>
				{word}
			</a>
			{#if reading}
				<div class="text-sm text-text-secondary mt-1">{reading}</div>
			{/if}
		</div>
		<div class="flex items-center gap-2">
			{#if timestamp !== undefined && timestamp > 0}
				<span class="text-xs text-text-tertiary px-2 py-1 bg-bg-tertiary rounded">
					⏱️ {formatTimestamp(timestamp)}
				</span>
			{/if}
			<SpeakButton text={word} language="ja" size="sm" />
		</div>
	</div>

	<!-- Translation -->
	<div class="mb-3">
		<div class="text-sm font-semibold text-text-tertiary mb-1">Translation:</div>
		<div class="text-text-primary">{translation}</div>
	</div>

	<!-- Context Example -->
	{#if context}
		<div class="mt-3 pt-3 border-t border-border">
			<div class="text-sm font-semibold text-text-tertiary mb-1">Example from video:</div>
			<div class="text-sm text-text-secondary italic font-cjk">"{context}"</div>
		</div>
	{/if}

	<!-- Dictionary Link -->
	<div class="mt-3 pt-3 border-t border-border">
		<a 
			href="/{wordSlug}" 
			class="text-sm text-accent hover:underline inline-flex items-center gap-1"
		>
			📖 View full dictionary entry →
		</a>
	</div>
</div>

<style>
	.word-card {
		transition: all 0.2s ease;
	}

	.word-card:hover {
		transform: translateY(-2px);
	}
</style>

