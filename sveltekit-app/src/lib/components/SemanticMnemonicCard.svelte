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

	type LinkedTextPart = { text: string; character?: string };

	let linkTargets = $derived.by(() => {
		if (!card) return [];
		const components = card.visual_components?.length
			? card.visual_components
			: card.components || [];
		return [...new Set([
			...components.map((component) => component.character),
			card.character,
		].filter(Boolean))].sort((left, right) => [...right].length - [...left].length);
	});

	function linkMnemonicCharacters(text: string): LinkedTextPart[] {
		if (!text || linkTargets.length === 0) return text ? [{ text }] : [];
		const parts: LinkedTextPart[] = [];
		let plainText = "";

		for (let index = 0; index < text.length;) {
			const codePoint = text.codePointAt(index);
			const value = codePoint === undefined ? "" : String.fromCodePoint(codePoint);
			const character = linkTargets.find((target) => text.startsWith(target, index)) ||
				(/\p{Script=Han}/u.test(value) ? value : undefined);
			if (!character) {
				plainText += value;
				index += value.length || 1;
				continue;
			}

			if (plainText) {
				parts.push({ text: plainText });
				plainText = "";
			}
			parts.push({ text: character, character });
			index += character.length;
		}

		if (plainText) parts.push({ text: plainText });
		return parts;
	}
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
			<div class="mnemonic-equation" lang="zh">
				{#each linkMnemonicCharacters(card.equation) as part}
					{#if part.character}
						<a class="mnemonic-character-link" href="/{part.character}">{part.text}</a>
					{:else}{part.text}{/if}
				{/each}
			</div>
			<p class="mnemonic-text">
				{#each linkMnemonicCharacters(card.mnemonic) as part}
					{#if part.character}
						<a class="mnemonic-character-link" href="/{part.character}" lang="zh">{part.text}</a>
					{:else}{part.text}{/if}
				{/each}
			</p>

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

	.mnemonic-character-link {
		border-radius: 2px;
		color: inherit;
		text-decoration: none;
		text-underline-offset: 0.14em;
	}

	.mnemonic-character-link:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	@media (hover: hover) {
		.mnemonic-character-link:hover {
			color: var(--accent);
			text-decoration: underline;
		}
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
