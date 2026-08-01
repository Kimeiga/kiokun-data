<script lang="ts">
	import type { ComponentTypeData } from "$lib/character-support";
	import {
		cleanCharacterUseGloss,
		sortCharacterUses
	} from "$lib/component-use-ranking";
	import DisclosureChevron from "$lib/components/shared/DisclosureChevron.svelte";
	import SectionHeading from "$lib/components/shared/SectionHeading.svelte";
	import { animateDisclosureHeight } from "$lib/utils/disclosure-motion";

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

	let expanded = $state(false);
	let characterGrid: HTMLDivElement | null = $state(null);
	let collapsedHeight = $state(0);
	const collapsedMaxChars = 8;

	const typeDisplayNames: Record<string, string> = {
		mnemonic: "Mnemonic building block",
		meaning: "Meaning component",
		sound: "Sound component",
		iconic: "Iconic component",
		simplified: "Simplified component",
		distinguishing: "Distinguishing component",
		remnant: "Remnant component",
		deleted: "Deleted component",
		unknown: "Unclassified component",
	};
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

	let visibleUses = $derived(
		expanded ? characterUses : characterUses.slice(0, collapsedMaxChars)
	);
	let needsCollapse = $derived(characterUses.length > collapsedMaxChars);

	$effect(() => {
		const element = characterGrid;
		const _visibleUses = visibleUses;
		if (!element || expanded) return;
		const frame = requestAnimationFrame(() => {
			collapsedHeight = element.scrollHeight;
		});
		return () => cancelAnimationFrame(frame);
	});

	function roleLabel(roles: string[]): string {
		return roles.map((role) => typeDisplayNames[role] || role).join(" · ");
	}

	function toggleExpanded() {
		if (!expanded && characterGrid) collapsedHeight = characterGrid.scrollHeight;
		void animateDisclosureHeight({
			element: characterGrid,
			nextExpanded: !expanded,
			collapsedHeight,
			setExpanded: (value) => expanded = value,
		});
	}
</script>

{#if characterUses.length > 0}
	<section class="component-uses" aria-labelledby="used-in-characters">
		<SectionHeading id="used-in-characters">Used in characters</SectionHeading>
		<p class="section-intro">
			Characters that use <span lang="zh">{targetChar}</span> as a building block.
		</p>

		<div class="character-grid" id="component-use-list" bind:this={characterGrid}>
			{#each visibleUses as use (use.character)}
				<a class="character-card" href="/{use.character}">
					<span class="character" lang="zh">{use.character}</span>
					<span class="character-copy">
						{#if charGlosses[use.character]}
							<span class="gloss" lang="en">{cleanCharacterUseGloss(charGlosses[use.character])}</span>
						{/if}
						<span class="role">{roleLabel(use.roles)}</span>
					</span>
				</a>
			{/each}
		</div>

		{#if needsCollapse}
			<DisclosureChevron
				{expanded}
				controls="component-use-list"
				onclick={toggleExpanded}
				expandLabel={`Show all ${characterUses.length} containing characters`}
				collapseLabel="Show fewer containing characters"
			/>
		{/if}
	</section>
{/if}

<style>
	.component-uses {
		margin-bottom: var(--spacing-lg);
	}

	.section-intro {
		margin: 0;
		padding: var(--spacing-sm) 0 var(--spacing-md);
		color: var(--text-secondary);
		font-size: var(--font-size-callout);
		line-height: 1.45;
	}

	.section-intro span {
		color: var(--text-primary);
		font-family: var(--font-cjk);
		font-weight: 700;
	}

	.character-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
		gap: 1px;
		border-block: 1px solid var(--border-light);
		background: var(--border-light);
	}

	.character-card {
		display: flex;
		align-items: center;
		min-width: 0;
		min-height: 4.5rem;
		gap: var(--spacing-sm);
		padding: var(--spacing-sm);
		background: var(--divider-cell-bg);
		color: inherit;
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
		flex: 0 0 auto;
		font-family: var(--font-cjk);
		font-size: 2rem;
		line-height: 1;
	}

	.character-copy {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 0.15rem;
	}

	.gloss {
		overflow: hidden;
		color: var(--text-primary);
		font-size: var(--font-size-callout);
		font-weight: 650;
		line-height: 1.25;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.role {
		color: var(--text-secondary);
		font-size: var(--font-size-caption1);
		line-height: 1.25;
	}

	@media (max-width: 520px) {
		.character-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			margin-inline: -0.75rem;
		}

		.character-card {
			min-height: 4rem;
		}

		.character {
			font-size: 1.75rem;
		}
	}
</style>
