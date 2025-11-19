<script lang="ts">
	// JapaneseNames component - displays Japanese name data from JMnedict
	// Based on 10ten-ja-reader's NameEntry component
	import Tag from "./shared/Tag.svelte";
	import SectionHeading from "./shared/SectionHeading.svelte";

	interface JmnedictName {
		id: string;
		kanji: Array<{ text: string; tags?: string[] }>;
		kana: Array<{
			text: string;
			tags?: string[];
			appliesToKanji?: string[];
		}>;
		translation: Array<{
			type: string[];
			related?: string[];
			translation: Array<{ lang?: string; text: string }>;
		}>;
	}

	interface Props {
		names: JmnedictName[];
		word: string;
	}

	let { names, word }: Props = $props();

	// Pagination state
	let showAll = $state(false);
	let initialCount = 4; // Show first row (4 items on desktop)

	// Computed displayed names
	let displayedNames = $derived(
		showAll ? names : names.slice(0, initialCount),
	);
	let hasMore = $derived(names.length > initialCount);

	// Type display names (English labels for tags)
	const typeLabels: Record<string, string> = {
		surname: "surname",
		fem: "female given name",
		masc: "male given name",
		given: "given name",
		place: "place name",
		unclass: "unclassified name",
		company: "company name",
		product: "product name",
		work: "work of art",
		person: "full name of a particular person",
		station: "railway station",
	};

	// Map types to tag types for coloring
	function getTagType(type: string): "fem" | "masc" | "place" | "pos" {
		if (type === "fem") return "fem";
		if (type === "masc") return "masc";
		if (type === "place") return "place";
		return "pos"; // default grey
	}
</script>

<div class="japanese-names">
	<SectionHeading>Japanese Names</SectionHeading>
	<div class="names-grid">
		{#each displayedNames as name}
			<div class="name-entry">
				<!-- Kanji and Kana on same line -->
				<div class="name-headwords" lang="ja">
					{#if name.kanji.length > 0}
						<span class="kanji-forms">
							{name.kanji.map((k) => k.text).join("、")}
						</span>
					{/if}
					<span class="kana-forms">
						{name.kana.map((k) => k.text).join("、")}
					</span>
				</div>

				<!-- Translations with inline tags -->
				<div class="name-translations">
					{#each name.translation as trans}
						<div class="translation-line">
							<span class="translation-text">
								{trans.translation
									.map((t) => t.text)
									.join(", ")}
							</span>
							{#each trans.type as type}
								<Tag
									type={getTagType(type)}
									text={typeLabels[type] || type}
									langTag="en"
								/>
							{/each}
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>

	{#if hasMore && !showAll}
		<button class="see-more-btn" onclick={() => (showAll = true)}>
			See More ({names.length - initialCount} more)
		</button>
	{/if}
</div>

<style>
	.japanese-names {
		margin-bottom: 20px;
	}

	.names-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0;
	}

	/* 2 columns on tablet */
	@media (min-width: 768px) {
		.names-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	/* 4 columns on desktop */
	@media (min-width: 1200px) {
		.names-grid {
			grid-template-columns: repeat(4, 1fr);
		}
	}

	.name-entry {
		padding: 10px 12px;
		break-inside: avoid;
		border-bottom: 1px solid var(--border-light);
	}

	.name-headwords {
		display: flex;
		gap: 10px;
		margin-bottom: 4px;
		align-items: baseline;
	}

	.kanji-forms {
		font-size: 1.2rem;
		font-family: var(--font-cjk);
		font-weight: 600;
		color: var(--primary-highlight);
	}

	.kana-forms {
		font-size: 1rem;
		font-family: var(--font-cjk);
		color: var(--reading-highlight);
	}

	.name-translations {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.translation-line {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
		font-size: 0.9rem;
	}

	.translation-text {
		color: var(--text-secondary);
	}

	.see-more-btn {
		display: block;
		width: 100%;
		padding: 10px;
		margin-top: 12px;
		background: transparent;
		border: 1px solid var(--border-color);
		border-radius: 6px;
		color: var(--text-secondary);
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.see-more-btn:hover {
		background: var(--hover-bg);
		border-color: var(--primary-highlight);
		color: var(--primary-highlight);
	}
</style>
