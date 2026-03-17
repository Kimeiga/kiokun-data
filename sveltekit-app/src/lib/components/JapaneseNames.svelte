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
	<div class="names-container" class:expanded={showAll}>
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

		{#if !showAll && names.length > initialCount}
			<div class="gradient-overlay"></div>
		{/if}
	</div>

	{#if names.length > initialCount}
		<button
			class="toggle-btn"
			onclick={() => (showAll = !showAll)}
			aria-label={showAll ? "Collapse" : "Expand"}
		>
			<div class="arrow-icon" class:flipped={showAll}>
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

<style>
	.japanese-names {
		margin-bottom: var(--spacing-xl);
		position: relative;
	}

	.names-container {
		position: relative;
		max-height: 70px; /* Strictly 1 row */
		overflow: hidden;
		transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1); /* Faster, smoother easing */
	}

	.names-container.expanded {
		max-height: 600px; /* Reduced further to minimize "invisible" transition time */
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
		padding: var(--spacing-sm) var(--spacing-md);
		break-inside: avoid;
		border-bottom: 1px solid var(--border-light);
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

	.gradient-overlay {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 80px;
		background: linear-gradient(to bottom, transparent, var(--bg-primary));
		pointer-events: none;
	}

	.toggle-btn {
		display: flex;
		justify-content: center;
		align-items: center;
		width: 100%;
		padding: 8px;
		margin-top: -10px; /* Pull up slightly to overlap/connect */
		background: transparent;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		position: relative;
		z-index: 10;
		transition: color 0.2s;
	}

	.toggle-btn:hover {
		color: var(--accent);
	}

	.arrow-icon {
		transition: transform 0.3s ease;
	}

	.arrow-icon.flipped {
		transform: rotate(180deg);
	}
</style>
