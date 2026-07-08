<script lang="ts">
	import SectionHeading from "$lib/components/shared/SectionHeading.svelte";
	import type { SemanticMnemonicCard as SemanticMnemonicCardType } from "$lib/types";

	let {
		card,
		label,
		heading = "Mnemonic",
		showHeading = true,
	}: {
		card?: SemanticMnemonicCardType | null;
		label?: string;
		heading?: string;
		showHeading?: boolean;
	} = $props();
</script>

{#if card}
	<div class="semantic-mnemonic-section">
		{#if showHeading}
			<SectionHeading id="mnemonic">{heading}</SectionHeading>
		{/if}

		<div class="semantic-mnemonic">
			{#if label}
				<div class="variant-label">{label}</div>
			{/if}
			<div class="mnemonic-equation" lang="zh">{card.equation}</div>
			<p class="mnemonic-text">{card.mnemonic}</p>

			{#if card.alias_of}
				<a class="alias-link" href="/{card.alias_of}">
					Variant of <span lang="zh">{card.alias_of}</span>
				</a>
			{/if}

			{#if card.historical_components?.length}
				<div class="historical-mnemonic">
					<div class="historical-label">Historical components</div>
					<div class="historical-row" lang="zh">
						{#each card.historical_components as component}
							<span class="historical-part">
								<span class="historical-char">{component.character}</span>
								<span class="historical-gloss">{component.gloss}</span>
							</span>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.semantic-mnemonic-section {
		margin-bottom: var(--spacing-lg);
	}

	.semantic-mnemonic {
		border: 1px solid var(--border-light);
		border-radius: 8px;
		padding: var(--spacing-sm) var(--spacing-md);
		background: color-mix(in srgb, var(--accent-light) 42%, transparent);
	}

	.variant-label {
		color: var(--text-tertiary);
		font-size: var(--font-size-caption2);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.3px;
		margin-bottom: var(--spacing-xs);
	}

	.mnemonic-equation {
		font-family: var(--font-cjk);
		font-size: var(--font-size-callout);
		font-weight: 600;
		color: var(--text-primary);
		line-height: 1.5;
		margin-bottom: var(--spacing-xs);
	}

	.mnemonic-text {
		margin: 0;
		color: var(--text-secondary);
		font-size: var(--font-size-body);
		line-height: 1.65;
	}

	.alias-link {
		display: inline-flex;
		align-items: baseline;
		gap: 0.25em;
		margin-top: var(--spacing-sm);
		color: var(--accent);
		font-size: var(--font-size-caption1);
		text-decoration: none;
	}

	.alias-link:hover {
		text-decoration: underline;
	}

	.historical-mnemonic {
		margin-top: var(--spacing-md);
		padding-top: var(--spacing-sm);
		border-top: 1px solid var(--border-light);
	}

	.historical-label {
		color: var(--text-tertiary);
		font-size: var(--font-size-caption2);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.3px;
		margin-bottom: var(--spacing-xs);
	}

	.historical-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
	}

	.historical-part {
		display: inline-flex;
		align-items: baseline;
		gap: 0.25em;
		color: var(--text-secondary);
		font-size: var(--font-size-caption1);
	}

	.historical-char {
		font-family: var(--font-cjk);
		font-size: var(--font-size-callout);
		color: var(--text-primary);
	}

	.historical-gloss {
		color: var(--text-tertiary);
	}
</style>
