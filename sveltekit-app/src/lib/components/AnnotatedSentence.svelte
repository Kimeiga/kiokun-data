<script lang="ts">
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
	}

	let { text, language, pinyin = '' }: Props = $props();

	let enrichedSegments = $state<RubySegment[] | null>(null);

	let baseSegments = $derived.by((): RubySegment[] => {
		if (!text) return [];
		if (language === 'zh') return buildChineseRubySegments(text, pinyin);
		if (language === 'ko') return buildKoreanRubySegments(text);
		return buildJapaneseRubySegments(text);
	});

	$effect(() => {
		enrichedSegments = null;
		if (language !== 'ja' || !text) return;

		let cancelled = false;
		const segments = baseSegments;
		enrichJapaneseRubySegments(segments, fetch).then((result) => {
			if (!cancelled) enrichedSegments = result;
		});

		return () => { cancelled = true; };
	});

	let segments = $derived(enrichedSegments ?? baseSegments);
</script>

<span class="annotated-sentence">
	{#each segments as segment}
		{#if segment.reading}
			<ruby>{segment.text}<rt>{segment.reading}</rt></ruby>
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

	ruby {
		ruby-position: over;
	}

	rt {
		font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
		font-size: 0.6em;
		font-weight: 500;
		line-height: 1;
		color: var(--color-pinyin);
		user-select: none;
	}
</style>
