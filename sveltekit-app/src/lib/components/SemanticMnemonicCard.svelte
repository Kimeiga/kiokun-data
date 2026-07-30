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

	let visualKeyword = $derived.by(() => {
		if (!card) return "";
		if (card.mnemonic_keyword) return card.mnemonic_keyword;

		const visualComponents = card.visual_components?.length
			? card.visual_components
			: card.components || [];
		const selfComponent = visualComponents.find(
			(component) =>
				component.character === card.character &&
				component.gloss.trim().toLocaleLowerCase("en") !==
					card.meaning.trim().toLocaleLowerCase("en")
		);
		return selfComponent?.gloss || "";
	});

	let lexicalMeaning = $derived(card?.lexical_gloss || card?.meaning || "");
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
			{#if visualKeyword && lexicalMeaning}
				<div class="semantic-layers">
					<div>
						<span class="semantic-layer-label">Visual keyword</span>
						<span lang="en">{visualKeyword}</span>
					</div>
					<div>
						<span class="semantic-layer-label">Dictionary meaning</span>
						<span lang="en">{lexicalMeaning}</span>
					</div>
					<p class="semantic-layer-note">
						The visual keyword is a shape-based memory label used when this form appears inside other characters.
					</p>
				</div>
			{/if}
			<div class="mnemonic-equation" lang="zh">{card.equation}</div>
			<p class="mnemonic-text">{card.mnemonic}</p>

			{#if card.alias_of}
				<a class="alias-link" href="/{card.alias_of}">
					Variant of <span lang="zh">{card.alias_of}</span>
				</a>
			{/if}
		</div>
	</div>
{/if}

<style>
	.semantic-mnemonic-section {
		margin-bottom: 0;
	}

	.semantic-mnemonic {
		padding: 0;
	}

	.variant-label {
		color: var(--text-secondary);
		font-size: var(--font-size-caption2);
		font-weight: 700;
		letter-spacing: 0;
		margin-bottom: var(--spacing-xs);
	}

	.semantic-layers {
		display: grid;
		gap: 0.2rem;
		margin-bottom: var(--spacing-xs);
		color: var(--text-secondary);
		font-size: var(--font-size-caption1);
		line-height: 1.45;
	}

	.semantic-layer-label {
		display: inline-block;
		min-width: 8.5rem;
		margin-right: 0.4rem;
		color: var(--text-secondary);
		font-weight: 650;
	}

	.semantic-layer-note {
		margin: 0.15rem 0 0;
		color: var(--text-secondary);
		font-size: var(--font-size-caption1);
		line-height: 1.4;
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
		color: var(--text-primary);
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
</style>
