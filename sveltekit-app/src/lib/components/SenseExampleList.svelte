<script lang="ts">
	import AnnotatedSentence from "$lib/components/AnnotatedSentence.svelte";
	import DisclosureChevron from "$lib/components/shared/DisclosureChevron.svelte";

	type SentenceLanguage = "ja" | "ko" | "zh";

	interface SenseExample {
		text: string;
		translation?: string;
		pinyin?: string;
	}

	export let examples: SenseExample[] = [];
	export let language: SentenceLanguage;
	export let fromWord: string | undefined = undefined;

	let expanded = false;
	$: usableExamples = examples.filter((example) => Boolean(example.text));
	$: displayedExamples = expanded ? usableExamples : usableExamples.slice(0, 1);
	$: hasMore = usableExamples.length > 1;

	function sentenceHref(example: SenseExample): string {
		const params = new URLSearchParams({
			text: example.text,
			lang: language,
		});
		if (example.translation) params.set("en", example.translation);
		if (example.pinyin) params.set("py", example.pinyin);
		if (fromWord) params.set("from", fromWord);
		return `/sentence?${params.toString()}`;
	}
</script>

{#if usableExamples.length > 0}
	<div class="sense-examples">
		<div class="sense-example-label">
			{usableExamples.length === 1 ? "Example" : "Examples"}
		</div>
		<div class="sense-example-list">
			{#each displayedExamples as example}
				<a
					class="sense-example"
					href={sentenceHref(example)}
					aria-label={`Open example sentence: ${example.text}`}
				>
					<span
						class="sense-example-source"
						lang={language === "zh" ? "zh" : language}
					>
						<AnnotatedSentence text={example.text} {language} pinyin={example.pinyin || ""} />
					</span>
					{#if example.translation}
						<span class="sense-example-translation">{example.translation}</span>
					{/if}
				</a>
			{/each}
		</div>
		{#if hasMore}
			<div class="sense-example-disclosure">
				<DisclosureChevron
					{expanded}
					onclick={() => expanded = !expanded}
					expandLabel={`Show ${usableExamples.length - 1} more examples for this definition`}
					collapseLabel="Show fewer examples for this definition"
				/>
			</div>
		{/if}
	</div>
{/if}

<style>
	.sense-examples {
		margin-top: 0.45rem;
		padding-left: 0.625rem;
		border-left: 1px solid var(--border-light);
	}

	.sense-example-label {
		margin-bottom: 0.125rem;
		color: var(--text-tertiary);
		font-size: var(--font-size-caption1);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.sense-example-list {
		display: flex;
		flex-direction: column;
	}

	.sense-example {
		display: block;
		padding: 0.25rem 0;
		color: inherit;
		text-decoration: none;
	}

	.sense-example + .sense-example {
		border-top: 1px solid var(--border-light);
	}

	.sense-example-source {
		display: block;
		color: var(--text-primary);
		font-family: var(--font-cjk);
		font-size: var(--font-size-body);
		line-height: 1.8;
		transition: color 0.15s ease;
	}

	.sense-example:hover .sense-example-source {
		color: var(--accent);
	}

	.sense-example:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
		border-radius: var(--radius-sm);
	}

	.sense-example-translation {
		display: block;
		margin-top: 0.125rem;
		color: var(--text-tertiary);
		font-size: var(--font-size-callout);
		line-height: 1.4;
	}

	.sense-example-disclosure {
		width: fit-content;
	}

	@media (prefers-reduced-motion: reduce) {
		.sense-example-source {
			transition: none;
		}
	}
</style>
