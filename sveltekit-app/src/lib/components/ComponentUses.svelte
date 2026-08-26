<script lang="ts">
	import type { ComponentTypeData } from "$lib/character-support";
	import {
		cleanCharacterUseGloss,
		sortCharacterUses
	} from "$lib/component-use-ranking";
	import ScrollWindow from "$lib/components/shared/ScrollWindow.svelte";
	import SectionHeading from "$lib/components/shared/SectionHeading.svelte";

	interface ComponentUsesData {
		[componentType: string]: ComponentTypeData;
	}

	interface CharacterUse {
		character: string;
		roles: string[];
	}

	let {
		targetChar,
		componentUses,
		charGlosses = {},
	}: {
		targetChar: string;
		componentUses: ComponentUsesData | null;
		charGlosses?: Record<string, string>;
	} = $props();

	const typeOrder = [
		"mnemonic",
		"meaning",
		"sound",
		"iconic",
		"simplified",
		"distinguishing",
		"remnant",
		"deleted",
		"unknown",
	];

	let characterUses = $derived.by(() => {
		if (!componentUses) return [];
		const byCharacter = new Map<string, CharacterUse>();
		const orderedTypes = [
			...typeOrder.filter((type) => componentUses[type]),
			...Object.keys(componentUses).filter((type) => !typeOrder.includes(type)).sort(),
		];

		for (const type of orderedTypes) {
			for (const character of componentUses[type]?.chars || []) {
				if (!character || character === targetChar) continue;
				const existing = byCharacter.get(character);
				if (existing) {
					existing.roles.push(type);
				} else {
					byCharacter.set(character, { character, roles: [type] });
				}
			}
		}

		return sortCharacterUses([...byCharacter.values()], charGlosses, typeOrder);
	});
</script>

{#if characterUses.length > 0}
	<section class="component-uses" aria-labelledby="used-in-characters">
		<SectionHeading id="used-in-characters" divided={false}>Used in characters</SectionHeading>

		<ScrollWindow
			class="mobile-full-bleed"
			viewportClass="character-grid"
			id="component-use-list"
			maxHeight="min(34svh, 14rem)"
			ariaLabel={`Characters that use ${targetChar}`}
		>
			{#each characterUses as use (use.character)}
				{@const gloss = cleanCharacterUseGloss(charGlosses[use.character] || "")}
				<a class="character-card" href="/{use.character}">
					<span class="character" lang="zh">{use.character}</span>
					{#if gloss}
						<span class="gloss" lang="en" title={gloss}>{gloss}</span>
					{/if}
				</a>
			{/each}
		</ScrollWindow>
	</section>
{/if}

<style>
	.component-uses {
		margin-bottom: var(--spacing-lg);
	}

	.character-grid {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 1px;
		border-block: 1px solid var(--border-light);
		background: transparent;
	}

	.character-card {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 0;
		min-height: 4.25rem;
		gap: 0.25rem;
		padding: 0.5rem 0.375rem;
		flex-direction: column;
		background: var(--divider-cell-bg);
		color: inherit;
		outline: 1px solid var(--border-light);
		outline-offset: 0;
		text-align: center;
		text-decoration: none;
		transition: background-color 120ms ease;
	}

	.character-card:hover {
		background: var(--divider-cell-hover);
	}

	.character-card:active {
		background: var(--divider-cell-active);
	}

	.character-card:focus-visible {
		position: relative;
		z-index: 1;
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	.character {
		font-family: var(--font-cjk);
		font-size: 2rem;
		line-height: 1;
	}

	.gloss {
		display: -webkit-box;
		min-width: 0;
		overflow: hidden;
		color: var(--text-primary);
		font-size: var(--font-size-caption1);
		font-weight: 550;
		line-height: 1.2;
		overflow-wrap: anywhere;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}

	@media (max-width: 520px) {
		.character-grid {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}

		.character {
			font-size: 1.75rem;
		}
	}

	@media (max-width: 359px) {
		.character-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>
