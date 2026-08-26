<script lang="ts">
	import SpeakButton from '$lib/components/shared/SpeakButton.svelte';
	import type { CourseDialogueLine } from './types';

	let {
		lines,
		showReading,
		showTranslation,
		language = 'ja',
		speechLanguage = 'ja',
		languageName = 'Japanese'
	}: {
		lines: CourseDialogueLine[];
		showReading: boolean;
		showTranslation: boolean;
		language?: string;
		speechLanguage?: 'zh' | 'yue' | 'ja' | 'ko';
		languageName?: string;
	} = $props();
</script>

<div class="dialogue" aria-label="{languageName} dialogue">
	{#each lines as dialogueLine}
		<div class="turn">
			<div class="speaker">{dialogueLine.speaker}</div>
			<div class="line-copy">
				<div class="japanese-line" lang={language}>{dialogueLine.text}</div>
				{#if showReading}
					<div class="reading" lang={language}>{dialogueLine.reading}</div>
				{/if}
				{#if showTranslation}
					<div class="translation">{dialogueLine.translation}</div>
				{/if}
			</div>
			<SpeakButton text={dialogueLine.text} lang={speechLanguage} compact />
		</div>
	{/each}
</div>

<style>
	.dialogue {
		border-top: 1px solid var(--border-color);
	}

	.turn {
		display: grid;
		grid-template-columns: minmax(4.5rem, 0.7fr) minmax(0, 4fr) 2.75rem;
		gap: 1rem;
		align-items: start;
		padding: 1.15rem 0;
		border-bottom: 1px solid var(--border-color);
	}

	.speaker {
		padding-top: 0.28rem;
		color: var(--text-tertiary);
		font-size: 0.75rem;
		font-weight: 720;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.line-copy {
		min-width: 0;
	}

	.japanese-line {
		font-family: var(--font-cjk);
		font-size: clamp(1.22rem, 2.4vw, 1.55rem);
		font-weight: 620;
		line-height: 1.55;
		letter-spacing: 0.015em;
	}

	.reading {
		margin-top: 0.2rem;
		color: var(--course-reading-color, var(--color-onyomi));
		font-family: var(--font-cjk);
		font-size: 0.88rem;
		line-height: 1.5;
	}

	.translation {
		margin-top: 0.3rem;
		color: var(--text-secondary);
		font-size: 0.92rem;
		line-height: 1.45;
	}

	@media (max-width: 560px) {
		.turn {
			grid-template-columns: minmax(0, 1fr) 2.75rem;
			gap: 0.5rem;
		}

		.speaker {
			grid-column: 1 / -1;
			padding: 0;
		}
	}
</style>
