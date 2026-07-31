<script lang="ts">
	import JapaneseRubyText from '$lib/components/JapaneseRubyText.svelte';
	import {
		buildChineseRubySegments,
		buildJapaneseRubySegments,
		buildKoreanRubySegments,
		enrichJapaneseRubySegments,
		type RubySegment
	} from '$lib/utils/sentence-ruby';

	interface Props {
		text: string;
		language: 'ja' | 'zh' | 'ko';
		pinyin?: string;
		rubySegments?: RubySegment[];
		readingSize?: string;
	}

	let {
		text,
		language,
		pinyin = '',
		rubySegments,
		readingSize = '0.75em'
	}: Props = $props();

	let enrichedSegments = $state<RubySegment[] | null>(null);

	let baseSegments = $derived.by((): RubySegment[] => {
		if (rubySegments?.length) return rubySegments;
		if (!text) return [];
		if (language === 'zh') return buildChineseRubySegments(text, pinyin);
		if (language === 'ko') return buildKoreanRubySegments(text);
		return buildJapaneseRubySegments(text);
	});

	$effect(() => {
		enrichedSegments = null;
		if (language !== 'ja' || !text || rubySegments?.length) return;

		let cancelled = false;
		const segments = baseSegments;
		enrichJapaneseRubySegments(segments, fetch).then((result) => {
			if (!cancelled) enrichedSegments = result;
		});

		return () => { cancelled = true; };
	});

	let segments = $derived(enrichedSegments ?? baseSegments);
</script>

<span class="annotated-sentence" style:--annotated-reading-size={readingSize}>
	{#each segments as segment}
		{#if segment.reading}
			{#if language === 'ja'}
				<JapaneseRubyText text={segment.text} reading={segment.reading} {readingSize} />
			{:else}
				<ruby class="word-ruby"><rb>{segment.text}</rb><rt>{segment.reading}</rt></ruby>
			{/if}
		{:else}
			<span>{segment.text}</span>
		{/if}
	{/each}
</span>

<style>
	.annotated-sentence {
		font: inherit;
		color: inherit;
	}

	.word-ruby {
		margin-inline: 0.03em;
		line-height: 1.05;
		ruby-position: over;
		ruby-align: center;
		vertical-align: baseline;
	}

	rb {
		white-space: nowrap;
	}

	rt {
		font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
		font-size: max(0.75rem, var(--annotated-reading-size));
		font-weight: 500;
		line-height: 1;
		letter-spacing: 0.01em;
		color: var(--color-pinyin);
		text-align: center;
		white-space: nowrap;
		user-select: none;
	}
</style>
