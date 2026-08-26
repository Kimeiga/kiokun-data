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

		<!-- Pronunciation and the two frequent inline actions. -->
		{#if speakText}
			{#if displayKana.length > 0}
				<span class="pronunciation-slot" lang="ja">
					<span class="kana-pronunciation">{displayKana[0].text}</span>
					<PitchAccent word={speakText} reading={displayKana[0].text} />
				</span>
			{/if}
			<SpeakButton text={speakText} lang="ja" size={18} compact />
			<SaveToStudy word={speakText} language="ja" size="sm" />
		{/if}
	</div>

	<!-- Definitions -->
	<Definitions senses={word.sense} />

	{#if displayKana.length > 0}
		<a
			href="/homophones/japanese?q={encodeURIComponent(displayKana[0].text)}&id={encodeURIComponent(word.id)}"
			class="homophone-link"
			title="See homophones for {displayKana[0].text}"
		>
			<span>Homophones</span>
			<span class="homophone-reading" lang="ja">{displayKana[0].text}</span>
		</a>
	{/if}

	<!-- Conjugation Table (for verbs) -->
	<ConjugationTable
		senses={word.sense}
		dictionaryForm={displayKanji.length > 0 ? displayKanji[0].text : (displayKana.length > 0 ? displayKana[0].text : '')}
	/>
</div>

<style>
	.homophone-link {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 2rem;
		/* Overlaps the sense list's closing rule so the two hairlines land on
		   the same pixel instead of stacking a few pixels apart. */
		margin-top: -1px;
		padding: var(--spacing-xs) var(--spacing-sm);
		border-block: 1px solid var(--border-light);
		background: var(--divider-cell-bg);
		font-size: var(--font-size-caption1);
		font-weight: 600;
		color: var(--text-secondary);
		text-decoration: none;
		transition: background-color 120ms ease, color 120ms ease;
	}

	.homophone-link:hover,
	.homophone-link:focus-visible {
		background: var(--divider-cell-hover);
		color: var(--accent);
	}

	.homophone-reading {
		font-size: var(--font-size-footnote);
		font-weight: 500;
	}

	.headwords {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto auto;
		align-items: center;
		gap: var(--spacing-xs);
		margin-bottom: var(--spacing-sm);
	}

	.kanji-headwords {
		min-width: 0;
		font-size: var(--font-size-title);
		font-family: var(--font-cjk);
		font-weight: 600;
		color: var(--primary-highlight, #2c3e50);
	}

	.kana-headwords {
		min-width: 0;
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

	.pronunciation-slot {
		display: inline-grid;
		align-items: center;
		font-family: var(--font-cjk);
		font-size: 16px;
		line-height: 1.3;
	}

	.pronunciation-slot > .kana-pronunciation,
	.pronunciation-slot > :global(.pitch-anchor) {
		grid-area: 1 / 1;
	}

	.kana-pronunciation {
		color: var(--reading-highlight, #e74c3c);
	}

	.pronunciation-slot:has(:global(.pitch-display)) .kana-pronunciation {
		visibility: hidden;
	}

	.headwords :global(.pitch-display) {
		margin-left: 0;
		font-size: 16px;
	}

	.headwords :global(.pitch-label) {
		display: none;
	}

	.headwords :global(.speak-button.compact) {
		position: relative;
		width: 1.75rem;
		height: 1.75rem;
		min-width: 1.75rem !important;
		min-height: 1.75rem !important;
		padding: 0;
	}

	.headwords :global(.speak-button.compact)::before,
	.headwords :global(.relative.inline-block > button)::before {
		content: "";
		position: absolute;
		inset: -0.5rem;
	}

	.headwords :global(.relative.inline-block) {
		width: 1.75rem;
		height: 1.75rem;
	}

	.headwords :global(.relative.inline-block > button) {
		position: relative;
		width: 1.75rem !important;
		height: 1.75rem !important;
		min-width: 1.75rem !important;
		min-height: 1.75rem !important;
		padding: 0 !important;
	}

	@media (max-width: 359px) {
		.headwords {
			grid-template-columns: minmax(0, 1fr) auto auto;
		}

		.headwords :global(.pitch-anchor) {
			grid-column: 1 / -1;
			grid-row: 2;
		}
	}
</style>
