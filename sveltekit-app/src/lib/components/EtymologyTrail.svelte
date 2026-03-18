<script lang="ts">
	import SectionHeading from "./shared/SectionHeading.svelte";

	interface OldPronunciation {
		pinyin: string;
		source?: string;
		gloss?: string;
		MC?: string; // Middle Chinese
		OC?: string; // Old Chinese
		dynasty?: string; // legacy field
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

	// Check if we have Baxter-Sagart reconstructions
	let reconstructions = $derived(
		(oldPronunciations || []).filter((p) => p.OC || p.MC),
	);

	let hasHistorical = $derived(reconstructions.length > 0);
	let hasModern = $derived(
		(modernPinyin && modernPinyin.length > 0) ||
			(cantonese && cantonese.length > 0) ||
			(japaneseOn && japaneseOn.length > 0) ||
			(japaneseKun && japaneseKun.length > 0) ||
			(koreanReadings && koreanReadings.length > 0),
	);
	let hasContent = $derived(hasHistorical || hasModern);
</script>

{#if hasContent}
	<div class="etymology-trail">
		<SectionHeading id="etymology">Etymology Trail</SectionHeading>

		<div class="trail-container">
			<!-- Historical reconstructions -->
			{#if hasHistorical}
				<div class="trail-section">
					{#each reconstructions as pron}
						<div class="reconstruction">
							{#if pron.OC}
								<div class="recon-item">
									<span class="period">Old Chinese</span>
									<span class="recon-value">{pron.OC.trim()}</span>
								</div>
							{/if}
							{#if pron.MC}
								<div class="recon-item">
									<span class="period">Middle Chinese</span>
									<span class="recon-value">{pron.MC}</span>
								</div>
							{/if}
							{#if pron.gloss}
								<div class="recon-gloss">{pron.gloss}</div>
							{/if}
						</div>
					{/each}
					{#if reconstructions[0]?.source}
						<div class="source-label">
							Source: {reconstructions[0].source}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Divergence point -->
			{#if hasHistorical && hasModern}
				<div class="divergence">
					<div class="divergence-char">{targetChar}</div>
					<div class="divergence-arrow">↓</div>
				</div>
			{/if}

			<!-- Modern readings across languages -->
			{#if hasModern}
				<div class="modern-readings">
					{#if modernPinyin && modernPinyin.length > 0}
						<div class="language-card">
							<span class="flag">🇨🇳</span>
							<span class="lang-label">Mandarin</span>
							<span class="reading chinese"
								>{modernPinyin.join(", ")}</span
							>
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
			{/if}
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
		border-radius: var(--radius-md);
	}

	.trail-section {
		margin-bottom: var(--spacing-sm);
	}

	.reconstruction {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--spacing-sm);
		margin-bottom: var(--spacing-xs);
	}

	.recon-item {
		display: flex;
		align-items: baseline;
		gap: var(--spacing-xs);
		padding: var(--spacing-xs) var(--spacing-sm);
		background: var(--bg-tertiary);
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-light);
	}

	.period {
		font-size: var(--font-size-caption2);
		color: var(--text-tertiary);
		white-space: nowrap;
	}

	.recon-value {
		font-size: var(--font-size-footnote);
		font-weight: 500;
		color: var(--text-primary);
		font-family: monospace;
	}

	.recon-gloss {
		font-size: var(--font-size-caption1);
		color: var(--text-secondary);
		font-style: italic;
	}

	.source-label {
		font-size: var(--font-size-caption2);
		color: var(--text-muted);
		margin-top: var(--spacing-xs);
	}

	.divergence {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: var(--spacing-xs) 0;
	}

	.divergence-char {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--accent);
		font-family: "Noto Serif TC", serif;
	}

	.divergence-arrow {
		color: var(--text-tertiary);
		font-size: var(--font-size-caption1);
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
		border-radius: var(--radius-sm);
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

	@media (max-width: 768px) {
		.modern-readings {
			flex-direction: column;
		}

		.language-card {
			min-width: unset;
		}
	}
</style>
