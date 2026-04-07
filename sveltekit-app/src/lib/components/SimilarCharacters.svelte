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
		<div class="similar-scroll" lang="zh">
			{#each similarChars as item}
				<a href="/{item.char}" class="similar-chip" title={item.gloss || item.char}>
					<span class="chip-char">{item.char}</span>
					{#if item.gloss}
						<span class="chip-gloss">{item.gloss}</span>
					{/if}
				</a>
			{/each}
		</div>
	</div>
{/if}

<style>
	.similar-section {
		margin-bottom: var(--spacing-lg);
	}

	.similar-scroll {
		display: flex;
		gap: var(--spacing-sm);
		overflow-x: auto;
		padding-bottom: var(--spacing-sm);
		scrollbar-width: thin;
		scrollbar-color: var(--border-color) transparent;
		-webkit-overflow-scrolling: touch;
	}

	.similar-scroll::-webkit-scrollbar {
		height: 4px;
	}
	.similar-scroll::-webkit-scrollbar-track {
		background: transparent;
	}
	.similar-scroll::-webkit-scrollbar-thumb {
		background: var(--border-color);
		border-radius: 2px;
	}

	.similar-chip {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex-shrink: 0;
		text-decoration: none;
		color: inherit;
		padding: var(--spacing-sm) var(--spacing-md);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-secondary);
		min-width: 60px;
		transition: border-color 0.15s, background 0.15s;
	}

	.similar-chip:hover {
		border-color: var(--accent);
		background: var(--bg-tertiary);
	}

	.chip-char {
		font-size: 24px;
		font-weight: 600;
		color: var(--text-primary);
		line-height: 1.2;
		font-family: var(--font-cjk);
	}

	.chip-gloss {
		font-size: 10px;
		color: var(--text-muted);
		margin-top: 2px;
		max-width: 70px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: center;
	}
</style>
