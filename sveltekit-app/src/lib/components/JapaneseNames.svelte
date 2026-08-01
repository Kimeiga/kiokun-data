<script lang="ts">
	// JapaneseNames component - displays Japanese name data from JMnedict
	// Based on 10ten-ja-reader's NameEntry component
	import Tag from "./shared/Tag.svelte";
	import SectionHeading from "./shared/SectionHeading.svelte";
	import DisclosureChevron from "./shared/DisclosureChevron.svelte";
	import {
		animateDisclosureHeight,
		measureFirstVisualRow,
	} from "$lib/utils/disclosure-motion";

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

	let showAll = $state(false);
	let namesContainer: HTMLDivElement | null = $state(null);
	let canExpand = $state(false);
	let visibleCollapsedCount = $state(3);
	let collapsedHeight = $state(72);

	$effect(() => {
		const element = namesContainer;
		const _names = names;
		if (!element || showAll || typeof ResizeObserver === "undefined") return;

		const measure = () => {
			const items = Array.from(element.querySelectorAll<HTMLElement>(".name-entry"));
			const row = measureFirstVisualRow(element, ".name-entry");
			if (row.height > 0) collapsedHeight = row.height;
			visibleCollapsedCount = row.count || items.length;
			canExpand = row.count < items.length;
		};
		const frame = requestAnimationFrame(measure);
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		for (const item of element.querySelectorAll(".name-entry")) {
			observer.observe(item);
		}

		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
		};
	});

	function toggleExpanded() {
		void animateDisclosureHeight({
			element: namesContainer,
			nextExpanded: !showAll,
			collapsedHeight,
			setExpanded: (value) => showAll = value,
		});
	}

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
	<div
		class="names-container mobile-full-bleed"
		class:expanded={showAll}
		id="japanese-names-list"
		bind:this={namesContainer}
		style={`--collapsed-height: ${collapsedHeight}px`}
	>
		<div class="names-grid">
			{#each names as name, index}
				<div class="name-entry" aria-hidden={!showAll && index >= visibleCollapsedCount}>
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

	{#if canExpand || showAll}
		<DisclosureChevron
			expanded={showAll}
			controls="japanese-names-list"
			onclick={toggleExpanded}
			expandLabel="Show all Japanese names"
			collapseLabel="Show fewer Japanese names"
		/>
	{/if}
</div>

<style>
	.japanese-names {
		position: relative;
		min-width: 0;
		margin-bottom: var(--spacing-xs);
	}

	.names-container {
		position: relative;
		width: 100%;
		min-width: 0;
		max-height: var(--collapsed-height, 4.5rem);
		overflow: hidden;
	}

	.names-container.expanded {
		max-height: none;
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
		.japanese-names {
			width: 100dvw;
			max-width: none;
			margin-inline: calc(50% - 50dvw);
		}

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
