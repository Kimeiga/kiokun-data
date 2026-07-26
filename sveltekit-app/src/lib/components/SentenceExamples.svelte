<script lang="ts">
	import type { JapaneseSense, KoreanWord } from "$lib/types";
	import AnnotatedSentence from "$lib/components/AnnotatedSentence.svelte";
	import DisclosureChevron from "$lib/components/shared/DisclosureChevron.svelte";
	import { japaneseExamplesForSense } from "$lib/japanese-examples";

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
		if (japaneseSenses) {
			for (const sense of japaneseSenses) {
				// The first source-linked example is displayed beside its definition.
				for (const example of japaneseExamplesForSense(sense).slice(1)) {
					items.push({ source: "ja", text: example.text, translation: example.translation });
				}
			}
		}
		if (koreanWords) {
			for (const word of koreanWords) {
				if (!word.examples) continue;
				for (const ex of word.examples) {
					if (ex.korean) {
						items.push({ source: "ko", text: ex.korean, translation: ex.translation });
					}
				}
			}
		}
		return items;
	});

	let expanded = $state(false);
	let COLLAPSED_COUNT = 4;
	let displayed = $derived(expanded ? examples : examples.slice(0, COLLAPSED_COUNT));
	let hasMore = $derived(examples.length > COLLAPSED_COUNT);

</script>

{#if examples.length > 0}
	<div class="sentence-column">
		<div class="column-header">🇯🇵 ({examples.length})</div>

		<div class="examples-list" id="japanese-sentence-examples">
			{#each displayed as item}
				<a
					class="example-item"
					href="/sentence?text={encodeURIComponent(item.text)}&lang={item.source === 'ja' ? 'ja' : 'ko'}{item.translation ? '&en=' + encodeURIComponent(item.translation) : ''}"
				>
					<div class="example-text" lang={item.source === "ja" ? "ja" : "ko"}>
						<AnnotatedSentence text={item.text} language={item.source} />
					</div>
					{#if item.translation}
						<div class="example-translation">{item.translation}</div>
					{/if}
				</a>
			{/each}
		</div>

		{#if hasMore}
			<DisclosureChevron
				{expanded}
				controls="japanese-sentence-examples"
				onclick={() => expanded = !expanded}
				expandLabel={`Show ${examples.length - COLLAPSED_COUNT} more Japanese examples`}
				collapseLabel="Show fewer Japanese examples"
			/>
		{/if}

	</div>
{/if}

<style>
	.sentence-column {
		position: relative;
	}

	.column-header {
		font-size: var(--font-size-caption1);
		font-weight: 600;
		color: var(--text-secondary);
		margin-bottom: var(--spacing-sm);
	}

	.examples-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}

	.example-item {
		display: block;
		padding: var(--spacing-xs) var(--spacing-sm);
		background: var(--bg-secondary);
		border: 1px solid var(--border-light);
		border-radius: var(--radius-md);
		text-decoration: none;
		transition: border-color 0.15s;
	}

	.example-item:hover {
		border-color: var(--accent);
	}

	.example-text {
		font-size: var(--font-size-body);
		color: var(--text-primary);
		font-family: var(--font-cjk);
		line-height: 2.15;
		padding-top: 0.3em;
	}

	.example-translation {
		font-size: var(--font-size-caption1);
		color: var(--text-tertiary);
		margin-top: 2px;
		line-height: 1.4;
	}

</style>
