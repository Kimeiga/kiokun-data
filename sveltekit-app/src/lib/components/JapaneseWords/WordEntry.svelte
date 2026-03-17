<script lang="ts">
	/**
	 * Main component for displaying a Japanese word entry
	 * Based on 10ten-ja-reader's WordEntry component
	 */
	import type { JapaneseWord } from '$lib/types';
	import Star from '../shared/Star.svelte';
	import HeadwordInfo from './HeadwordInfo.svelte';
	import Reading from './Reading.svelte';
	import Definitions from './Definitions.svelte';
	import SpeakButton from '../shared/SpeakButton.svelte';
	import ConjugationTable from './ConjugationTable.svelte';
	import SaveToStudy from '../SaveToStudy.svelte';

	export let word: JapaneseWord;
	export let accentDisplay: 'none' | 'binary' | 'binary-hi-contrast' = 'binary';

	// Filter kanji headwords - keep original dictionary order
	const displayKanji = word.kanji.filter((k) => !k.tags.includes('sK')); // Remove search-only kanji

	// Filter kana headwords - keep original dictionary order
	const displayKana = word.kana.filter((k) => !k.tags.includes('sk')); // Remove search-only kana

	// Get the text to speak - prefer kanji if available, otherwise use kana
	$: speakText = displayKanji.length > 0 ? displayKanji[0].text : (displayKana.length > 0 ? displayKana[0].text : '');
</script>

<div class="word-entry">
	<div class="headwords">
		<!-- Kanji headwords -->
		{#if displayKanji.length > 0}
			<span class="kanji-headwords">
				{#each displayKanji as kanji, index}
					{#if index > 0}
						<span class="separator">、</span>
					{/if}
					<span class="kanji-item">
						<span class="kanji-text">{kanji.text}</span>
						{#if kanji.tags.length > 0}
							<HeadwordInfo info={kanji.tags} />
						{/if}
						{#if kanji.common}
							<Star style="full" />
						{/if}
					</span>
				{/each}
			</span>
		{/if}

		<!-- Kana headwords -->
		{#if displayKana.length > 0}
			<span class="kana-headwords">
				{#each displayKana as kana, index}
					{#if index > 0}
						<span class="separator">、</span>
					{/if}
					<span class="kana-item">
						<span class="kana-text">
							<Reading
								kana={kana.text}
								pitchAccents={kana.pitchAccents}
								{accentDisplay}
							/>
						</span>
						{#if kana.tags.length > 0}
							<HeadwordInfo info={kana.tags} />
						{/if}
						{#if kana.common}
							<Star style="full" />
						{/if}
					</span>
				{/each}
			</span>
		{/if}

		<!-- Audio pronunciation -->
		{#if speakText}
			<SpeakButton text={speakText} lang="ja" size={18} />
			<SaveToStudy word={speakText} language="ja" size="sm" />
		{/if}
	</div>

	<!-- Definitions -->
	<Definitions senses={word.sense} />

	<!-- Conjugation Table (for verbs) -->
	<ConjugationTable
		senses={word.sense}
		dictionaryForm={displayKanji.length > 0 ? displayKanji[0].text : (displayKana.length > 0 ? displayKana[0].text : '')}
	/>
</div>

<style>
	.word-entry {
		margin-bottom: var(--spacing-xl);
	}

	.headwords {
		display: flex;
		align-items: baseline;
		gap: var(--spacing-sm);
		margin-bottom: var(--spacing-sm);
		flex-wrap: wrap;
	}

	.kanji-headwords {
		font-size: var(--font-size-headline);
		font-family: "Noto Serif TC", "Noto Serif SC", "Noto Serif JP", "MS Mincho", serif;
		font-weight: 600;
		color: var(--primary-highlight, #2c3e50);
	}

	.kana-headwords {
		font-size: var(--font-size-body);
		font-family: "Noto Serif TC", "Noto Serif SC", "Noto Serif JP", "MS Mincho", serif;
		color: var(--reading-highlight, #e74c3c);
	}

	.separator {
		opacity: 0.6;
	}

	.kanji-item,
	.kana-item {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-xs);
	}
</style>

