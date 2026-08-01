<script lang="ts">
	import { splitJapaneseRubyParts } from '$lib/utils/japanese-ruby';

	interface Props {
		text: string;
		reading: string;
		readingSize?: string;
	}

	let { text, reading, readingSize = '0.75em' }: Props = $props();
	let parts = $derived(splitJapaneseRubyParts(text, reading));
</script>

<span class="japanese-ruby-text" style:--ruby-reading-size={readingSize}>
	{#each parts as part}
		{#if part.reading}
			<ruby><rb>{part.text}</rb><rt>{part.reading}</rt></ruby>
		{:else}
			<span>{part.text}</span>
		{/if}
	{/each}
</span>

<style>
	.japanese-ruby-text {
		display: inline;
		box-sizing: border-box;
		line-height: inherit;
		white-space: normal;
		vertical-align: baseline;
	}

	ruby {
		line-height: 1;
		ruby-align: center;
		ruby-position: over;
		vertical-align: baseline;
	}

	rb {
		white-space: nowrap;
	}

	rt {
		font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
		font-size: max(0.75rem, var(--ruby-reading-size));
		font-weight: 500;
		line-height: 1;
		color: var(--color-pinyin);
		text-align: center;
		white-space: nowrap;
		user-select: none;
	}
</style>
