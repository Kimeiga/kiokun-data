<script lang="ts">
	import SectionHeading from "./shared/SectionHeading.svelte";

	interface Props {
		targetChar: string;
		targetStrokeCount?: number;
		targetComponents?: string[];
		componentUses: Record<
			string,
			Record<string, { chars: string[]; count: number }>
		>;
	}

	let { targetChar, targetStrokeCount, targetComponents, componentUses }: Props =
		$props();

	// Find similar characters: share at least one component with the target
	let similarChars = $derived.by(() => {
		if (!targetComponents || targetComponents.length === 0) return [];

		const candidates = new Map<string, { shared: string[]; score: number }>();

		for (const comp of targetComponents) {
			const uses = componentUses[comp];
			if (!uses) continue;

			// Gather all characters that use this component (across all types)
			for (const typeData of Object.values(uses)) {
				for (const ch of typeData.chars) {
					if (ch === targetChar) continue;
					// Skip non-CJK characters (component_uses may have unusual chars)
					const cp = ch.codePointAt(0) || 0;
					if (cp < 0x4e00 || cp > 0x9fff) continue;

					if (!candidates.has(ch)) {
						candidates.set(ch, { shared: [comp], score: 1 });
					} else {
						const entry = candidates.get(ch)!;
						if (!entry.shared.includes(comp)) {
							entry.shared.push(comp);
							entry.score++;
						}
					}
				}
			}
		}

		// Sort by number of shared components (descending), take top 12
		return Array.from(candidates.entries())
			.map(([char, data]) => ({
				char,
				sharedComponents: data.shared,
				score: data.score,
			}))
			.sort((a, b) => b.score - a.score)
			.slice(0, 12);
	});
</script>

{#if similarChars.length > 0}
	<div class="similar-characters">
		<SectionHeading id="similar">Similar Characters</SectionHeading>

		<div class="similar-grid">
			{#each similarChars as item}
				<a href="/{item.char}" class="similar-card">
					<span class="similar-char">{item.char}</span>
					<span class="shared-info">
						{item.sharedComponents.join(" ")}
					</span>
				</a>
			{/each}
		</div>
	</div>
{/if}

<style>
	.similar-characters {
		margin-bottom: var(--spacing-lg);
	}

	.similar-grid {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
	}

	.similar-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		text-decoration: none;
		color: inherit;
		padding: var(--spacing-sm) var(--spacing-md);
		border-radius: 4px;
		min-width: 56px;
		transition: all 200ms ease;
	}

	.similar-card:hover {
		background: var(--bg-tertiary);
	}

	.similar-char {
		font-size: 1.4rem;
		font-weight: 600;
		color: var(--text-primary);
		line-height: 1.2;
		font-family: "Noto Serif TC", "Noto Serif SC", "Noto Serif JP", serif;
	}

	.shared-info {
		font-size: var(--font-size-caption2);
		color: var(--text-tertiary);
		margin-top: var(--spacing-xs);
		font-family: "Noto Serif TC", serif;
	}

	@media (max-width: 768px) {
		.similar-card {
			padding: var(--spacing-xs) var(--spacing-sm);
			min-width: 48px;
		}

		.similar-char {
			font-size: 1.2rem;
		}
	}
</style>
