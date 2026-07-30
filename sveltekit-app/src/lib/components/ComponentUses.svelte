<script lang="ts">
	import type { ComponentTypeData } from "$lib/character-support";
	import DisclosureChevron from "$lib/components/shared/DisclosureChevron.svelte";
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

	let expanded = $state(false);
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

		return [...byCharacter.values()];
	});

	let visibleUses = $derived(
		expanded ? characterUses : characterUses.slice(0, collapsedMaxChars)
	);
	let needsCollapse = $derived(characterUses.length > collapsedMaxChars);

	function roleLabel(roles: string[]): string {
		return roles.map((role) => typeDisplayNames[role] || role).join(" · ");
	}
</script>

{#if characterUses.length > 0}
	<section class="component-uses" aria-labelledby="used-in-characters">
		<SectionHeading id="used-in-characters">Used in characters</SectionHeading>
		<p class="section-intro">
			Characters that use <span lang="zh">{targetChar}</span> as a building block.
		</p>

		<div class="character-grid" id="component-use-list">
			{#each visibleUses as use (use.character)}
				<a class="character-card" href="/{use.character}">
					<span class="character" lang="zh">{use.character}</span>
					<span class="character-copy">
						{#if charGlosses[use.character]}
							<span class="gloss" lang="en">{charGlosses[use.character]}</span>
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
				onclick={() => (expanded = !expanded)}
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
		margin: calc(-1 * var(--spacing-xs)) 0 var(--spacing-md);
		color: var(--text-secondary);
		font-size: var(--font-size-caption1);
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
		gap: var(--spacing-sm);
	}

	.character-card {
		display: flex;
		align-items: center;
		min-width: 0;
		min-height: 4.5rem;
		gap: var(--spacing-sm);
		padding: var(--spacing-sm);
		border: 1px solid var(--border-light);
		border-radius: var(--radius-md);
		background: var(--bg-secondary);
		color: inherit;
		text-decoration: none;
		transition: border-color 0.15s ease, background 0.15s ease;
	}

	.character-card:hover {
		border-color: var(--accent);
		background: var(--bg-tertiary);
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
		color: var(--text-tertiary);
		font-size: var(--font-size-caption2);
		line-height: 1.25;
	}

	@media (max-width: 520px) {
		.character-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.character-card {
			min-height: 4rem;
		}

		.character {
			font-size: 1.75rem;
		}
	}
</style>
