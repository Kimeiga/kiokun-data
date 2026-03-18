<script lang="ts">
	import SectionHeading from "./shared/SectionHeading.svelte";

	interface ComponentTypeData {
		chars: string[];
		count: number;
		verified: number;
	}

	interface ComponentUsesData {
		[componentType: string]: ComponentTypeData;
	}

	interface Props {
		componentUses: ComponentUsesData | null;
	}

	let { componentUses }: Props = $props();

	// Collapse/expand state
	let expanded = $state(false);
	const collapsedMaxChars = 20; // Show first N characters per type when collapsed

	// Display names for component types, in preferred order
	const typeDisplayNames: Record<string, string> = {
		meaning: "Meaning component",
		sound: "Sound component",
		iconic: "Iconic component",
		simplified: "Simplified component",
		distinguishing: "Distinguishing component",
		remnant: "Remnant component",
		deleted: "Deleted component",
		unknown: "Unknown component"
	};

	// Order of types for display
	const typeOrder = ["meaning", "sound", "iconic", "simplified", "distinguishing", "remnant", "deleted", "unknown"];

	// Get sorted types that exist in the data
	let sortedTypes = $derived.by(() => {
		if (!componentUses) return [];
		return typeOrder.filter(type => componentUses[type] && componentUses[type].count > 0);
	});

	// Calculate total character count
	let totalCount = $derived.by(() => {
		if (!componentUses) return 0;
		return Object.values(componentUses).reduce((sum, data) => sum + data.count, 0);
	});

	// Calculate total verified count
	let totalVerified = $derived.by(() => {
		if (!componentUses) return 0;
		return Object.values(componentUses).reduce((sum, data) => sum + data.verified, 0);
	});

	// Check if content needs collapsing (more than collapsedMaxChars in any type)
	let needsCollapse = $derived.by(() => {
		if (!componentUses) return false;
		return Object.values(componentUses).some(data => data.chars.length > collapsedMaxChars);
	});
</script>

{#if componentUses && totalCount > 0}
	<div class="component-uses">
		<SectionHeading>COMPONENT USES ({totalCount} characters, {totalVerified} verified)</SectionHeading>

		<div class="component-types-container" class:expanded>
			<div class="component-types">
				{#each sortedTypes as componentType (componentType)}
					{@const data = componentUses[componentType]}
					{@const displayName = typeDisplayNames[componentType] || componentType}
					{@const displayChars = expanded ? data.chars : data.chars.slice(0, collapsedMaxChars)}
					{@const hasMore = data.chars.length > collapsedMaxChars}
					<div class="component-type-section">
						<div class="type-header">
							<span class="type-name">{displayName}</span>
							<span class="type-count">in {data.count} characters ({data.verified} verified)</span>
						</div>
						<div class="char-grid">
							{#each displayChars as char (char)}
								<a href="/{char}" class="char-link" title={char}>{char}</a>
							{/each}
							{#if !expanded && hasMore}
								<span class="more-indicator">+{data.chars.length - collapsedMaxChars} more</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>

			{#if !expanded && needsCollapse}
				<div class="gradient-overlay"></div>
			{/if}
		</div>

		{#if needsCollapse}
			<button
				class="toggle-btn"
				onclick={() => (expanded = !expanded)}
				aria-label={expanded ? "Collapse" : "Expand"}
			>
				<div class="arrow-icon" class:flipped={expanded}>
					<svg
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M6 9L12 15L18 9"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</div>
			</button>
		{/if}
	</div>
{/if}

<style>
	.component-uses {
		margin-bottom: var(--spacing-lg);
		position: relative;
	}

	.component-types-container {
		position: relative;
		max-height: 200px;
		overflow: hidden;
		transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.component-types-container.expanded {
		max-height: 5000px;
	}

	.component-types {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-lg);
	}

	.component-type-section {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	.type-header {
		display: flex;
		align-items: baseline;
		gap: var(--spacing-sm);
		flex-wrap: wrap;
	}

	.type-name {
		font-weight: 600;
		color: var(--text-primary);
		font-size: var(--font-size-callout);
	}

	.type-count {
		font-size: var(--font-size-footnote);
		color: var(--text-muted);
	}

	.char-grid {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-xs);
		align-items: center;
	}

	.char-link {
		font-family: "Noto Serif TC", "Noto Serif SC", "Noto Serif JP", "MS Mincho", serif;
		font-size: var(--font-size-headline);
		text-decoration: none;
		color: var(--text-primary);
		padding: 2px 4px;
		border-radius: var(--radius-sm);
		transition: background 0.15s ease, color 0.15s ease;
	}

	.char-link:hover {
		background: var(--bg-tertiary);
		color: var(--accent);
	}

	.more-indicator {
		font-size: var(--font-size-footnote);
		color: var(--text-muted);
		font-style: italic;
		padding: 2px 6px;
	}

	.gradient-overlay {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 60px;
		background: linear-gradient(to bottom, transparent, var(--bg-primary));
		pointer-events: none;
	}

	.toggle-btn {
		display: flex;
		justify-content: center;
		align-items: center;
		width: 100%;
		padding: 8px;
		margin-top: 8px;
		background: transparent;
		border: 1px solid var(--border-light);
		border-radius: var(--radius-sm);
		cursor: pointer;
		color: var(--text-secondary);
		transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
	}

	.toggle-btn:hover {
		background: var(--bg-secondary);
		border-color: var(--accent);
		color: var(--accent);
	}

	.arrow-icon {
		transition: transform 0.3s ease;
	}

	.arrow-icon.flipped {
		transform: rotate(180deg);
	}

	@media (max-width: 768px) {
		.component-types-container {
			max-height: 150px;
		}

		.char-link {
			padding: 1px 3px;
		}
	}
</style>

