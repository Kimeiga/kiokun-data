<script lang="ts">
	import AnnotatedSentence from "$lib/components/AnnotatedSentence.svelte";
	import ScrollWindow from "$lib/components/shared/ScrollWindow.svelte";

	type SentenceLanguage = "ja" | "ko" | "zh";

	interface SenseExample {
		text: string;
		translation?: string;
		pinyin?: string;
	}

	export let examples: SenseExample[] = [];
	export let language: SentenceLanguage;
	export let fromWord: string | undefined = undefined;

	let sentenceGlosses: Record<string, Record<string, string>> = {};
	const requestedGlosses = new Set<string>();
	$: usableExamples = examples.filter((example) => Boolean(example.text));
	$: if (language === "ko") void loadKoreanGlosses(usableExamples.map((example) => example.text));

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

	async function loadKoreanGlosses(texts: string[]) {
		const pending = texts.filter((text) => text && !requestedGlosses.has(text));
		if (pending.length === 0) return;
		for (let index = 0; index < pending.length; index += 8) {
			const chunk = pending.slice(index, index + 8);
			for (const text of chunk) requestedGlosses.add(text);
			try {
				const response = await fetch("/api/korean-glosses", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ texts: chunk }),
				});
				if (!response.ok) throw new Error("Korean gloss lookup failed");
				const payload = await response.json();
				sentenceGlosses = { ...sentenceGlosses, ...(payload.glosses || {}) };
			} catch {
				for (const text of chunk) requestedGlosses.delete(text);
			}
		}
	}
</script>

{#if usableExamples.length > 0}
	<div class="sense-examples">
		<div class="sense-example-label">
			{usableExamples.length === 1 ? "Example" : `Examples (${usableExamples.length})`}
		</div>
		<ScrollWindow
			viewportClass="sense-example-list"
			maxHeight="min(38svh, 19rem)"
			ariaLabel="Example sentences for this definition"
		>
			{#each usableExamples as example}
				<a
					class="sense-example"
					href={sentenceHref(example)}
					aria-label={`Open example sentence: ${example.text}`}
				>
					<span
						class="sense-example-source"
						lang={language === "zh" ? "zh" : language}
					>
						<AnnotatedSentence
							text={example.text}
							{language}
							pinyin={example.pinyin || ""}
							glosses={sentenceGlosses[example.text] || {}}
							showGlosses={language === "ko"}
						/>
					</span>
					{#if example.translation}
						<span class="sense-example-translation">{example.translation}</span>
					{/if}
				</a>
			{/each}
		</ScrollWindow>
	</div>
{/if}

<style>
	.sense-examples {
		margin-top: 0.45rem;
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
		border: 1px solid var(--border-light);
	}

	.sense-example {
		display: block;
		padding: 0.375rem 0.5rem;
		background: var(--divider-cell-bg);
		color: inherit;
		text-decoration: none;
		transition: background-color 120ms ease;
	}

	.sense-example + .sense-example {
		border-top: 1px solid var(--border-light);
	}

	.sense-example:hover,
	.sense-example:focus-visible {
		background: var(--divider-cell-hover);
	}

	.sense-example:active {
		background: var(--divider-cell-active);
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
		outline-offset: -2px;
	}

	.sense-example-translation {
		display: block;
		margin-top: 0.125rem;
		color: var(--text-tertiary);
		font-size: var(--font-size-callout);
		line-height: 1.4;
	}
</style>
