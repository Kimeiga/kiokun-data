<script lang="ts">
	import { onMount } from "svelte";
	import SectionHeading from "$lib/components/shared/SectionHeading.svelte";
	import { languageStore } from "$lib/stores/languages.svelte";

	interface Props {
		word: string;
		japaneseSenses?: any[];
		hasChineseWords?: boolean;
		chineseSentenceLookupWords?: string[];
		hasKoreanSource?: boolean;
		containedInKorean?: string[];
		rootMargin?: string;
	}

	let {
		word,
		japaneseSenses = [],
		hasChineseWords = false,
		chineseSentenceLookupWords = [],
		hasKoreanSource = false,
		containedInKorean = [],
		rootMargin = "900px 0px",
	}: Props = $props();

	let anchor: HTMLDivElement | null = $state(null);
	let SentenceExamplesComponent = $state<any>(null);
	let ChineseSentenceExamplesComponent = $state<any>(null);
	let KoreanSentenceExamplesComponent = $state<any>(null);
	let loaded = $state(false);
	let loading = $state(false);
	let zhSentencesHaveContent = $state(false);
	let krSentencesHaveContent = $state(false);

	let jaSentencesHaveContent = $derived(
		!!japaneseSenses?.some((sense: any) => sense?.examples?.length)
	);
	let anySentencesVisible = $derived(
		(jaSentencesHaveContent && languageStore.preferences.japanese)
		|| (zhSentencesHaveContent && languageStore.preferences.chinese)
		|| (krSentencesHaveContent && languageStore.preferences.korean)
	);

	$effect(() => {
		const _word = word;
		zhSentencesHaveContent = false;
		krSentencesHaveContent = false;
	});

	async function load() {
		if (loaded || loading) return;
		loading = true;
		try {
			const imports: Promise<void>[] = [];

			if (japaneseSenses.length > 0) {
				imports.push(
					import("$lib/components/SentenceExamples.svelte").then((module) => {
						SentenceExamplesComponent = module.default;
					})
				);
			}

			if (hasChineseWords) {
				imports.push(
					import("$lib/components/ChineseSentenceExamples.svelte").then((module) => {
						ChineseSentenceExamplesComponent = module.default;
					})
				);
			}

			if (hasKoreanSource) {
				imports.push(
					import("$lib/components/KoreanSentenceExamples.svelte").then((module) => {
						KoreanSentenceExamplesComponent = module.default;
					})
				);
			}

			await Promise.all(imports);
			loaded = true;
		} catch (err) {
			console.error("Failed to lazy-load sentence sections:", err);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		const loadForHash = () => {
			if (window.location.hash === "#sentences") load();
		};

		if (window.location.hash === "#sentences") {
			load();
			window.addEventListener("hashchange", loadForHash);
			return () => window.removeEventListener("hashchange", loadForHash);
		}

		const el = anchor;
		if (!el || !("IntersectionObserver" in window)) {
			load();
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) {
					load();
					observer.disconnect();
				}
			},
			{ rootMargin }
		);

		observer.observe(el);
		window.addEventListener("hashchange", loadForHash);
		return () => {
			observer.disconnect();
			window.removeEventListener("hashchange", loadForHash);
		};
	});
</script>

{#if loaded}
	{#if anySentencesVisible}
		<SectionHeading id="sentences">Example Sentences</SectionHeading>
	{/if}
	<div
		class="word-sections-grid"
		style={anySentencesVisible ? 'margin-bottom: var(--spacing-lg);' : 'display: none;'}
	>
		{#if SentenceExamplesComponent && languageStore.preferences.japanese}
			<SentenceExamplesComponent
				{japaneseSenses}
				koreanWords={[]}
			/>
		{/if}

		{#if ChineseSentenceExamplesComponent && hasChineseWords && languageStore.preferences.chinese}
			<ChineseSentenceExamplesComponent
				{word}
				words={chineseSentenceLookupWords}
				bind:hasContent={zhSentencesHaveContent}
			/>
		{/if}

		{#if KoreanSentenceExamplesComponent && hasKoreanSource && languageStore.preferences.korean}
			<KoreanSentenceExamplesComponent
				{word}
				{containedInKorean}
				bind:hasContent={krSentencesHaveContent}
			/>
		{/if}
	</div>
{:else}
	<div bind:this={anchor} class="lazy-sentence-anchor" aria-hidden="true"></div>
{/if}

<style>
	.lazy-sentence-anchor {
		width: 100%;
		min-height: 1px;
	}

	.word-sections-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--spacing-lg);
	}

	@media (min-width: 768px) {
		.word-sections-grid {
			grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
			gap: var(--spacing-lg);
		}
	}
</style>
