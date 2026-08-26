<script lang="ts">
	import SectionHeading from "./shared/SectionHeading.svelte";
	import ScrollWindow from "./shared/ScrollWindow.svelte";

	interface Props {
		targetChar: string;
		targetStrokeCount?: number;
		targetComponents?: string[];
		componentUses: Record<
			string,
			Record<string, { chars: string[]; count: number }>
		>;
		charGlosses?: Record<string, string>;
	}

	let { targetChar, targetStrokeCount, targetComponents, componentUses, charGlosses }: Props =
		$props();

	// Find similar characters: share at least one component with the target
	let similarChars = $derived.by(() => {
		if (!targetComponents || targetComponents.length === 0) return [];

		const candidates = new Map<string, { shared: string[]; score: number }>();

		for (const comp of targetComponents) {
			const uses = componentUses[comp];
			if (!uses) continue;

			for (const typeData of Object.values(uses)) {
				for (const ch of typeData.chars) {
					if (ch === targetChar) continue;
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

		return Array.from(candidates.entries())
			.map(([char, data]) => ({
				char,
				sharedComponents: data.shared,
				score: data.score,
				gloss: charGlosses?.[char] || '',
			}))
			.sort((a, b) => b.score - a.score)
			.slice(0, 20);
	});
</script>

{#if similarChars.length > 0}
	<div class="similar-section">
		<SectionHeading id="similar">Similar Characters</SectionHeading>
		<ScrollWindow
			class="mobile-full-bleed"
			id="similar-character-list"
			maxHeight="min(30svh, 10.5rem)"
			ariaLabel={`Characters similar to ${targetChar}`}
		>
			<div class="similar-scroll" lang="zh">
				{#each similarChars as item}
					<a
						href="/{item.char}"
						class="similar-chip"
						title={item.gloss || item.char}
					>
						<span class="chip-char">{item.char}</span>
						{#if item.gloss}
							<span class="chip-gloss">{item.gloss}</span>
						{/if}
					</a>
				{/each}
			</div>
		</ScrollWindow>
	</div>
{/if}

<style>
	.similar-section {
		margin-bottom: 0;
	}

	.similar-scroll {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(5.5rem, 1fr));
		gap: 1px;
		max-width: 100%;
		min-width: 0;
		border-block: 1px solid var(--border-light);
		background: transparent;
	}

	.similar-chip {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-decoration: none;
		color: inherit;
		min-width: 0;
		padding: var(--spacing-sm);
		background: var(--divider-cell-bg);
		outline: 1px solid var(--border-light);
		outline-offset: 0;
		transition: background-color 120ms ease;
	}

	.similar-chip:hover {
		background: var(--divider-cell-hover);
	}

	.similar-chip:active {
		background: var(--divider-cell-active);
	}

	.similar-chip:focus-visible {
		position: relative;
		z-index: 1;
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	.chip-char {
		font-size: 24px;
		font-weight: 600;
		color: var(--text-primary);
		line-height: 1.2;
		font-family: var(--font-cjk);
	}

	.chip-gloss {
		font-size: var(--font-size-caption2);
		color: var(--text-muted);
		margin-top: 2px;
		max-width: 70px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: center;
	}

	@media (max-width: 768px) {
		.similar-scroll {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}

	@media (max-width: 359px) {
		.similar-scroll {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>
