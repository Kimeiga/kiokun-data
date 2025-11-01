<script lang="ts">
	/**
	 * Container component for displaying multiple Japanese word entries
	 * Based on 10ten-ja-reader's WordTable component
	 */
	import type { JapaneseWord } from '$lib/types';
	import WordEntry from './WordEntry.svelte';

	export let words: JapaneseWord[];
	export let accentDisplay: 'none' | 'binary' | 'binary-hi-contrast' = 'binary';
</script>

<div class="word-table">
	{#each words as word (word.id)}
		<WordEntry {word} {accentDisplay} />
	{/each}
</div>

<style>
	.word-table {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
</style>

