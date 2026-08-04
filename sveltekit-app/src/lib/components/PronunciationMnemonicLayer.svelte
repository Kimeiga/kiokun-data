<script lang="ts">
	import SpeakButton from '$lib/components/shared/SpeakButton.svelte';
	import { filterPronunciationCards, groupPronunciationReadings } from '$lib/pronunciation-mnemonics';
	import { languageStore } from '$lib/stores/languages.svelte';
	import type { PronunciationMnemonicCard, PronunciationMnemonicReading } from '$lib/types';

	let { cards = [] }: { cards?: PronunciationMnemonicCard[] } = $props();
	let visibleCards = $derived(filterPronunciationCards(cards, languageStore.preferences));

	function readingLabel(reading: PronunciationMnemonicReading): string {
		if (reading.reading_type === 'on') return 'On';
		if (reading.reading_type === 'kun') return 'Kun';
		return 'Mandarin';
	}

	function toneLabel(reading: PronunciationMnemonicReading): string {
		return reading.tone === 5 ? 'neutral tone' : reading.tone ? `tone ${reading.tone}` : '';
	}
</script>

{#if visibleCards.length > 0}
	<div class="sound-layers" aria-label="Pronunciation sound layers">
		{#each visibleCards as pronunciationCard}
			{@const groups = groupPronunciationReadings(pronunciationCard)}
			<section class="sound-language" aria-label={pronunciationCard.language === 'zh' ? 'Mandarin pronunciation mnemonic' : 'Japanese pronunciation mnemonic'}>
				<header class="sound-language-header">
					<span>{pronunciationCard.language === 'zh' ? 'Mandarin sound layer' : 'Japanese sound layer'}</span>
					<span class="sound-language-note">
						{pronunciationCard.language === 'zh' ? 'Tone-marked pinyin' : 'On and Kun stay separate'}
					</span>
				</header>

				<div class="reading-grid">
					{#each groups.core as reading}
						<article class="reading-card">
							<div class="reading-heading">
								<span class="reading-kind">{readingLabel(reading)}</span>
								<strong lang={pronunciationCard.language === 'zh' ? 'zh-Latn-pinyin' : 'ja'}>{reading.display_reading}</strong>
								{#if reading.tone}<span class="tone-label">{toneLabel(reading)}</span>{/if}
							</div>
							<p class="sound-overlay">{reading.overlay}</p>
							{#if reading.phonetic_component}
								<p class="phonetic-note">
									<span class="phonetic-component" lang="zh">{reading.phonetic_component.character}</span>
									is the authentic sound-bearing component; the word below fixes its modern sound.
								</p>
							{/if}
							<div class="anchor-list">
								{#each reading.anchors as anchor}
									<div class="anchor-word">
										<div class="anchor-main">
											<span class="anchor-term" lang={pronunciationCard.language}>{anchor.word}</span>
											<span class="anchor-reading" lang={pronunciationCard.language === 'zh' ? 'zh-Latn-pinyin' : 'ja'}>（{anchor.reading}）</span>
											<SpeakButton text={anchor.word} lang={pronunciationCard.language} size={14} compact />
										</div>
										<div class="anchor-gloss" lang="en">{anchor.gloss}</div>
										{#if anchor.phonological_note}<div class="phonological-note">{anchor.phonological_note}</div>{/if}
									</div>
								{/each}
							</div>
						</article>
					{/each}
				</div>

				{#if groups.secondary.length > 0}
					<details class="more-readings">
						<summary>More readings</summary>
						<ul>
							{#each groups.secondary as reading}
								<li><span>{readingLabel(reading)}</span> <strong>{reading.display_reading}</strong> — {reading.usage_gloss}</li>
							{/each}
						</ul>
					</details>
				{/if}
			</section>
		{/each}
	</div>
{/if}

<style>
	.sound-layers {
		display: grid;
		gap: var(--spacing-sm);
		margin-top: var(--spacing-md);
		padding-top: var(--spacing-md);
		border-top: 1px solid var(--border-color);
	}

	.sound-language {
		min-width: 0;
	}

	.sound-language + .sound-language {
		padding-top: var(--spacing-sm);
		border-top: 1px solid var(--border-color);
	}

	.sound-language-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--spacing-sm);
		margin-bottom: var(--spacing-xs);
		color: var(--text-primary);
		font-size: var(--font-size-caption1);
		font-weight: 700;
	}

	.sound-language-note {
		color: var(--text-tertiary);
		font-size: var(--font-size-caption2);
		font-weight: 500;
	}

	.reading-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr));
		gap: 1px;
		border: 1px solid var(--border-color);
		background: var(--border-color);
	}

	.reading-card {
		min-width: 0;
		padding: var(--spacing-sm);
		background: var(--surface-primary, var(--background));
	}

	.reading-heading {
		display: flex;
		align-items: baseline;
		gap: 0.45rem;
		margin-bottom: 0.35rem;
	}

	.reading-heading strong {
		color: var(--text-primary);
		font-family: var(--font-cjk);
		font-size: 1.2rem;
		line-height: 1.2;
	}

	.reading-kind {
		padding: 0.1rem 0.35rem;
		border: 1px solid var(--border-color);
		color: var(--text-secondary);
		font-size: var(--font-size-caption2);
		font-weight: 700;
		line-height: 1.25;
	}

	.tone-label {
		color: var(--text-tertiary);
		font-size: var(--font-size-caption2);
	}

	.sound-overlay {
		margin: 0 0 var(--spacing-xs);
		color: var(--text-primary);
		font-size: var(--font-size-caption1);
		line-height: 1.5;
	}

	.phonetic-note,
	.phonological-note {
		margin: 0.25rem 0 0;
		color: var(--text-secondary);
		font-size: var(--font-size-caption2);
		line-height: 1.4;
	}

	.phonetic-component {
		color: var(--text-primary);
		font-family: var(--font-cjk);
		font-weight: 700;
	}

	.anchor-list {
		display: grid;
		gap: 0.35rem;
		margin-top: var(--spacing-xs);
	}

	.anchor-word {
		padding-top: 0.35rem;
		border-top: 1px solid var(--border-color);
	}

	.anchor-main {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.15rem;
	}

	.anchor-term {
		font-family: var(--font-cjk);
		font-weight: 700;
	}

	.anchor-reading,
	.anchor-gloss {
		color: var(--text-secondary);
		font-size: var(--font-size-caption1);
	}

	.more-readings {
		margin-top: var(--spacing-xs);
		color: var(--text-secondary);
		font-size: var(--font-size-caption1);
	}

	.more-readings summary {
		min-height: 44px;
		cursor: pointer;
		font-weight: 650;
	}

	.more-readings ul {
		margin: 0;
		padding-left: 1.2rem;
	}

	@media (max-width: 480px) {
		.sound-language-header {
			align-items: flex-start;
			flex-direction: column;
			gap: 0.1rem;
		}

		.reading-card {
			padding: 0.7rem;
		}
	}
</style>
