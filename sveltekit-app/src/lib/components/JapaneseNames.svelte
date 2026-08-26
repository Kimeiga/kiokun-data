<script lang="ts">
	// JapaneseNames component - displays Japanese name data from JMnedict
	// Based on 10ten-ja-reader's NameEntry component
	import Tag from "./shared/Tag.svelte";
	import SectionHeading from "./shared/SectionHeading.svelte";
	import ScrollWindow from "./shared/ScrollWindow.svelte";

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
	<SectionHeading id="names">Japanese Names</SectionHeading>
	<ScrollWindow
		class="mobile-full-bleed"
		id="japanese-names-list"
		maxHeight="min(34svh, 11rem)"
		ariaLabel={`Japanese names matching ${word}`}
	>
		<div class="names-container">
			<div class="names-grid">
				{#each names as name}
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
		</div>
	</ScrollWindow>
</div>

<style>
	.japanese-names {
		position: relative;
		min-width: 0;
		margin-bottom: var(--spacing-xs);
	}

	.names-container {
		width: 100%;
		min-width: 0;
	}

	.names-grid {
		display: grid;
		width: 100%;
		min-width: 0;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1px;
		border-block: 1px solid var(--border-light);
		background: transparent;
	}

	@media (min-width: 768px) {
		.names-grid {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}

	@media (min-width: 1200px) {
		.names-grid {
			grid-template-columns: repeat(6, minmax(0, 1fr));
		}
	}

	.name-entry {
		min-width: 0;
		padding: var(--spacing-sm);
		break-inside: avoid;
		background: var(--divider-cell-bg);
		outline: 1px solid var(--border-light);
		outline-offset: 0;
	}

	.name-headwords {
		display: flex;
		min-width: 0;
		gap: var(--spacing-xs);
		margin-bottom: var(--spacing-xs);
		align-items: baseline;
	}

	.kanji-forms {
		font-size: var(--font-size-body);
		font-family: var(--font-cjk);
		font-weight: 600;
		color: var(--primary-highlight);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.kana-forms {
		font-size: var(--font-size-subhead);
		font-family: var(--font-cjk);
		color: var(--reading-highlight);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.name-translations {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.translation-line {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
		min-width: 0;
		flex-wrap: wrap;
		font-size: var(--font-size-footnote);
	}

	.translation-text {
		color: var(--text-secondary);
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (max-width: 768px) {
		.name-entry {
			padding: 7px 6px;
		}

		.name-headwords {
			display: block;
			margin-bottom: 2px;
		}

		.kanji-forms,
		.kana-forms {
			display: block;
		}

		.translation-line :global(.tag) {
			display: block;
			max-width: 100%;
			margin: 1px 0 0;
			padding: 0;
			overflow: hidden;
			border: 0 !important;
			background: transparent !important;
			font-size: 10px;
			font-weight: 500;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}

	@media (max-width: 359px) {
		.names-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

</style>
