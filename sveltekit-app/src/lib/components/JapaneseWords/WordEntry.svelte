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
	import PitchAccent from '../PitchAccent.svelte';

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
		<!-- Headword: kanji forms when present, otherwise the kana itself is
		     the headword (kana-only words like きっぱり). Exactly one common
		     star per headword form — the kana reading does NOT get its own
		     extra star when kanji are present (that produced a double star
		     on common jukugo). -->
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
		{:else if displayKana.length > 0}
			<span class="kana-headwords">
				{#each displayKana as kana, index}
					{#if index > 0}
						<span class="separator">、</span>
					{/if}
					<span class="kana-item">
						<span class="kana-text">{kana.text}</span>
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

		<!-- Audio pronunciation + Pitch accent + Homophones -->
		{#if speakText}
			<PitchAccent word={speakText} reading={displayKana.length > 0 ? displayKana[0].text : undefined} />
			<SpeakButton text={speakText} lang="ja" size={18} />
			{#if displayKana.length > 0}
				<a
					href="/homophones/japanese?q={encodeURIComponent(displayKana[0].text)}"
					class="homophone-link"
					title="See homophones for {displayKana[0].text}"
				>同音</a>
			{/if}
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
		margin-bottom: var(--spacing-lg);
	}

	.homophone-link {
		padding: 2px 6px;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-full);
		font-size: 10px;
		color: var(--text-muted);
		text-decoration: none;
		transition: border-color 0.15s, color 0.15s;
	}
	.homophone-link:hover { border-color: var(--accent); color: var(--accent); }

	.headwords {
		display: flex;
		align-items: baseline;
		gap: var(--spacing-sm);
		margin-bottom: var(--spacing-sm);
		flex-wrap: wrap;
	}

	.kanji-headwords {
		font-size: var(--font-size-title);
		font-family: var(--font-cjk);
		font-weight: 600;
		color: var(--primary-highlight, #2c3e50);
	}

	.kana-headwords {
		font-size: var(--font-size-body);
		font-family: var(--font-cjk);
		/* Kana-only words are headwords, not readings — use the primary
		   headword color (white in dark theme) rather than the red
		   reading-highlight. */
		color: var(--primary-highlight, #1a1a1a);
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

