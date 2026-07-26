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
	let collapsedHeight = $state(72);

	$effect(() => {
		const element = namesContainer;
		const _names = names;
		if (!element || showAll || typeof ResizeObserver === "undefined") return;

		const measure = () => {
			const items = Array.from(element.querySelectorAll<HTMLElement>(".name-entry"));
			const row = measureFirstVisualRow(element, ".name-entry");
			if (row.height > 0) collapsedHeight = row.height;
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
		class="names-container"
		class:expanded={showAll}
		id="japanese-names-list"
		bind:this={namesContainer}
		style={`--collapsed-height: ${collapsedHeight}px`}
	>
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
		margin-bottom: var(--spacing-xs);
		position: relative;
	}

	.names-container {
		position: relative;
		max-height: var(--collapsed-height, 4.5rem);
		overflow: hidden;
	}

	.names-container.expanded {
		max-height: none;
	}

	.names-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--spacing-sm);
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
		padding: var(--spacing-sm) var(--spacing-md);
		break-inside: avoid;
	}

	.name-headwords {
		display: flex;
		gap: var(--spacing-sm);
		margin-bottom: var(--spacing-xs);
		align-items: baseline;
	}

	.kanji-forms {
		font-size: var(--font-size-body);
		font-family: var(--font-cjk);
		font-weight: 600;
		color: var(--primary-highlight);
	}

	.kana-forms {
		font-size: var(--font-size-subhead);
		font-family: var(--font-cjk);
		color: var(--reading-highlight);
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
		flex-wrap: wrap;
		font-size: var(--font-size-footnote);
	}

	.translation-text {
		color: var(--text-secondary);
	}

</style>
