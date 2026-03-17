<script lang="ts">
	import SectionHeading from "./shared/SectionHeading.svelte";
	import type { JapaneseSense, KoreanWord } from "$lib/types";

	interface Props {
		japaneseSenses?: JapaneseSense[];
		koreanWords?: KoreanWord[];
	}

	let { japaneseSenses = [], koreanWords = [] }: Props = $props();

	interface ExampleItem {
		source: "ja" | "ko";
		text: string;
		translation?: string;
	}

	let examples = $derived.by(() => {
		const items: ExampleItem[] = [];

		// Extract Japanese examples from senses
		if (japaneseSenses) {
			for (const sense of japaneseSenses) {
				if (!sense.examples) continue;
				for (const ex of sense.examples) {
					const jpText = ex.text;
					const engSentence = ex.sentences?.find((s) => s.lang === "eng");
					if (jpText) {
						items.push({
							source: "ja",
							text: jpText,
							translation: engSentence?.text,
						});
					}
				}
			}
		}

		// Extract Korean examples
		if (koreanWords) {
			for (const word of koreanWords) {
				if (!word.examples) continue;
				for (const ex of word.examples) {
					if (ex.korean) {
						items.push({
							source: "ko",
							text: ex.korean,
							translation: ex.translation,
						});
					}
				}
			}
		}

		return items;
	});

	// Show up to 8 examples initially
	let displayCount = $state(8);
	let displayed = $derived(examples.slice(0, displayCount));
	let hasMore = $derived(displayCount < examples.length);
</script>

{#if examples.length > 0}
	<div class="sentence-examples">
		<SectionHeading id="examples">Example Sentences ({examples.length})</SectionHeading>

		<div class="examples-list">
			{#each displayed as item}
				<div class="example-item">
					<div class="example-text">
						<span class="lang-tag">{item.source === "ja" ? "JP" : "KR"}</span>
						<span class="source-text">{item.text}</span>
					</div>
					{#if item.translation}
						<div class="example-translation">{item.translation}</div>
					{/if}
				</div>
			{/each}
		</div>

		{#if hasMore}
			<button class="show-more-btn" onclick={() => (displayCount += 8)}>
				Show more ({examples.length - displayCount} remaining)
			</button>
		{/if}
	</div>
{/if}

<style>
	.sentence-examples {
		margin-bottom: var(--spacing-lg);
	}

	.examples-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	.example-item {
		padding: var(--spacing-sm) var(--spacing-md);
		background: var(--bg-secondary);
		border: 1px solid var(--border-light);
		border-radius: 6px;
	}

	.example-text {
		display: flex;
		align-items: baseline;
		gap: var(--spacing-sm);
	}

	.lang-tag {
		font-size: var(--font-size-caption2);
		color: var(--text-muted);
		background: var(--bg-tertiary);
		padding: 1px var(--spacing-xs);
		border-radius: 3px;
		font-weight: 500;
		flex-shrink: 0;
	}

	.source-text {
		font-size: var(--font-size-body);
		color: var(--text-primary);
		font-family: "Noto Serif TC", "Noto Serif SC", "Noto Serif JP", serif;
		line-height: 1.6;
	}

	.example-translation {
		font-size: var(--font-size-caption1);
		color: var(--text-tertiary);
		margin-top: var(--spacing-xs);
		padding-left: calc(var(--spacing-sm) + 24px);
		line-height: 1.4;
	}

	.show-more-btn {
		display: block;
		width: 100%;
		padding: var(--spacing-xs) var(--spacing-md);
		margin-top: var(--spacing-sm);
		background: transparent;
		border: 1px solid var(--border-light);
		border-radius: 4px;
		color: var(--text-secondary);
		font-size: var(--font-size-caption1);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.show-more-btn:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	@media (max-width: 768px) {
		.example-item {
			padding: var(--spacing-xs) var(--spacing-sm);
		}

		.example-translation {
			padding-left: calc(var(--spacing-xs) + 24px);
		}
	}
</style>
