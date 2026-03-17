<script lang="ts">
	import SectionHeading from "./shared/SectionHeading.svelte";

	interface OldPronunciation {
		dynasty: string;
		pinyin: string;
	}

	interface Props {
		oldPronunciations?: OldPronunciation[];
		modernPinyin?: string[];
		cantonese?: string[];
		japaneseOn?: string[];
		japaneseKun?: string[];
		koreanReadings?: string[];
		targetChar: string;
	}

	let {
		oldPronunciations,
		modernPinyin,
		cantonese,
		japaneseOn,
		japaneseKun,
		koreanReadings,
		targetChar,
	}: Props = $props();

	// Order dynasties chronologically
	const dynastyOrder: Record<string, number> = {
		"Old Chinese": 0,
		"Middle Chinese": 1,
		"Tang": 2,
		"Song": 3,
		"Yuan": 4,
		"Ming": 5,
		"Qing": 6,
	};

	let sortedPronunciations = $derived(
		(oldPronunciations || [])
			.slice()
			.sort(
				(a, b) =>
					(dynastyOrder[a.dynasty] ?? 99) -
					(dynastyOrder[b.dynasty] ?? 99),
			),
	);

	let hasContent = $derived(
		(sortedPronunciations.length > 0 ||
			(modernPinyin && modernPinyin.length > 0)) &&
			((japaneseOn && japaneseOn.length > 0) ||
				(koreanReadings && koreanReadings.length > 0)),
	);
</script>

{#if hasContent}
	<div class="etymology-trail">
		<SectionHeading id="etymology">Etymology Trail</SectionHeading>

		<div class="trail-container">
			<!-- Historical Chinese pronunciations -->
			{#if sortedPronunciations.length > 0}
				<div class="trail-section">
					<div class="section-label">Historical Chinese</div>
					<div class="timeline">
						{#each sortedPronunciations as pron}
							<div class="timeline-item">
								<span class="dynasty">{pron.dynasty}</span>
								<span class="reading chinese">{pron.pinyin}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Divergence point -->
			<div class="divergence">
				<div class="divergence-char">{targetChar}</div>
				<div class="divergence-lines">
					<div class="line left"></div>
					<div class="line center"></div>
					<div class="line right"></div>
				</div>
			</div>

			<!-- Modern readings across languages -->
			<div class="modern-readings">
				{#if modernPinyin && modernPinyin.length > 0}
					<div class="language-card">
						<span class="flag">🇨🇳</span>
						<span class="lang-label">Mandarin</span>
						<span class="reading chinese">{modernPinyin.join(", ")}</span>
					</div>
				{/if}

				{#if cantonese && cantonese.length > 0}
					<div class="language-card">
						<span class="flag">🇭🇰</span>
						<span class="lang-label">Cantonese</span>
						<span class="reading cantonese"
							>{cantonese.join(", ")}</span
						>
					</div>
				{/if}

				{#if japaneseOn && japaneseOn.length > 0}
					<div class="language-card">
						<span class="flag">🇯🇵</span>
						<span class="lang-label">On'yomi</span>
						<span class="reading japanese"
							>{japaneseOn.join("、")}</span
						>
					</div>
				{/if}

				{#if japaneseKun && japaneseKun.length > 0}
					<div class="language-card">
						<span class="flag">🇯🇵</span>
						<span class="lang-label">Kun'yomi</span>
						<span class="reading japanese"
							>{japaneseKun.join("、")}</span
						>
					</div>
				{/if}

				{#if koreanReadings && koreanReadings.length > 0}
					<div class="language-card">
						<span class="flag">🇰🇷</span>
						<span class="lang-label">Korean</span>
						<span class="reading korean"
							>{koreanReadings.join(", ")}</span
						>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.etymology-trail {
		margin-bottom: var(--spacing-lg);
	}

	.trail-container {
		padding: var(--spacing-md);
		background: var(--bg-secondary);
		border: 1px solid var(--border-light);
		border-radius: 6px;
	}

	.trail-section {
		margin-bottom: var(--spacing-md);
	}

	.section-label {
		font-size: var(--font-size-caption1);
		font-weight: 600;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.3px;
		margin-bottom: var(--spacing-xs);
	}

	.timeline {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
	}

	.timeline-item {
		display: flex;
		align-items: baseline;
		gap: var(--spacing-xs);
		padding: var(--spacing-xs) var(--spacing-sm);
		background: var(--bg-tertiary);
		border-radius: 4px;
		border: 1px solid var(--border-light);
	}

	.dynasty {
		font-size: var(--font-size-caption2);
		color: var(--text-tertiary);
	}

	.reading {
		font-size: var(--font-size-footnote);
		font-weight: 500;
	}

	.reading.chinese {
		color: var(--color-pinyin);
	}

	.reading.cantonese {
		color: var(--color-cantonese);
	}

	.reading.japanese {
		color: var(--color-onyomi);
		font-family: "Noto Serif JP", serif;
	}

	.reading.korean {
		color: var(--color-korean);
		font-family: "Noto Sans KR", sans-serif;
	}

	.divergence {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: var(--spacing-sm) 0;
	}

	.divergence-char {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--accent);
		font-family: "Noto Serif TC", serif;
	}

	.divergence-lines {
		display: flex;
		gap: var(--spacing-xl);
		margin-top: var(--spacing-xs);
	}

	.line {
		width: 1px;
		height: 12px;
		background: var(--border-light);
	}

	.modern-readings {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
	}

	.language-card {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
		padding: var(--spacing-xs) var(--spacing-sm);
		background: var(--bg-tertiary);
		border: 1px solid var(--border-light);
		border-radius: 4px;
		flex: 1;
		min-width: 120px;
	}

	.flag {
		font-size: var(--font-size-caption1);
	}

	.lang-label {
		font-size: var(--font-size-caption2);
		color: var(--text-tertiary);
		white-space: nowrap;
	}

	@media (max-width: 768px) {
		.modern-readings {
			flex-direction: column;
		}

		.language-card {
			min-width: unset;
		}
	}
</style>
