<script lang="ts">
	import { onMount } from "svelte";
	import type { PageData } from "./$types";
	import type { CharacterLearningData } from "$lib/word-character-learning";
	import type { SemanticMnemonicCard as SemanticMnemonicCardType } from "$lib/types";
	import {
		buildCharacterHeaderForms,
		learnerGlossForEntry,
		normalizeLearnerGloss,
		type CharacterHeaderForm,
	} from "$lib/character-forms";
	import Header from "$lib/components/Header.svelte";
	import WordTable from "$lib/components/JapaneseWords/WordTable.svelte";
	import SectionHeading from "$lib/components/shared/SectionHeading.svelte";
	import SpeakButton from "$lib/components/shared/SpeakButton.svelte";
	import Tag from "$lib/components/shared/Tag.svelte";
	import SaveToStudy from "$lib/components/SaveToStudy.svelte";
	import { languageStore } from "$lib/stores/languages.svelte";
	import SentenceBar from "$lib/components/SentenceBar.svelte";
	import ShareButton from "$lib/components/ShareButton.svelte";
	import LazyComponent from "$lib/components/LazyComponent.svelte";
	import SenseExampleList from "$lib/components/SenseExampleList.svelte";
	import { dictionaryDefinitions } from "$lib/seo";
	import CharacterLearningSections from "$lib/components/CharacterLearningSections.svelte";

	const loadNotes = () => import("$lib/components/Notes.svelte");
	const loadJapaneseNames = () => import("$lib/components/JapaneseNames.svelte");
	const loadContains = () => import("$lib/Contains.svelte");
	const loadAppearsIn = () => import("$lib/AppearsIn.svelte");
	const loadArtifactMentions = () => import("$lib/components/ArtifactMentions.svelte");
	const loadReelsSection = () => import("$lib/components/ReelsSection.svelte");
	const loadChineseSentenceExamples = () => import("$lib/components/ChineseSentenceExamples.svelte");
	const loadKoreanSentenceExamples = () => import("$lib/components/KoreanSentenceExamples.svelte");

	let { data }: { data: PageData } = $props();

	function initialMnemonicCards(entry: any): SemanticMnemonicCardType[] {
		const cards = [
			entry?.semantic_mnemonic,
			...(entry?.semantic_mnemonic_variants || []),
		].filter((card): card is SemanticMnemonicCardType => Boolean(card));
		const seen = new Set<string>();
		return cards.filter((card) => {
			if (seen.has(card.character)) return false;
			seen.add(card.character);
			return true;
		});
	}

	function fallbackLearningData(entry: any): CharacterLearningData {
		return {
			simplifiedCharData: null,
			mnemonicCards: initialMnemonicCards(entry),
			support: {
				charGlosses: {},
				charTaxonomy: {},
				componentUses: {},
			},
		};
	}

	let characterLearningData = $state<CharacterLearningData>(
		data.characterLearningData || fallbackLearningData(data.data)
	);

	$effect(() => {
		const incoming = data.characterLearningData;
		if (!incoming || typeof (incoming as any).then !== 'function') {
			characterLearningData = incoming || fallbackLearningData(data.data);
			return;
		}

		const promise = incoming as unknown as Promise<CharacterLearningData>;
		let cancelled = false;
		characterLearningData = fallbackLearningData(data.data);

		Promise.resolve(promise)
			.then((loaded) => {
				if (!cancelled && loaded) characterLearningData = loaded;
			})
			.catch((err) => {
				if (!cancelled) console.error("Failed to load character learning data:", err);
			});

		return () => {
			cancelled = true;
		};
	});

	let charGlosses = $derived(characterLearningData.support.charGlosses);
	let charTaxonomy = $derived(characterLearningData.support.charTaxonomy);
	let mnemonicCards = $derived(
		characterLearningData.mnemonicCards.length > 0
			? characterLearningData.mnemonicCards
			: initialMnemonicCards(data.data)
	);

	let showChineseWords = $derived(!!data.data.chinese_words?.length && languageStore.preferences.chinese);
	let showJapaneseWords = $derived(!!data.data.japanese_words?.length && languageStore.preferences.japanese);
	let showKoreanWords = $derived(!!data.data.korean_words?.length && languageStore.preferences.korean);
	let twoPrimaryWordColumns = $derived(showChineseWords && showJapaneseWords);
	let containsWordForms = $derived.by(() => buildContainsWordForms(data.data, data.word));
	let sortedContainsWords = $derived.by(() => sortContainsWords(data.data.contains || [], data.word));
	let chineseSentenceLookupWords = $derived.by(() => buildChineseSentenceLookupWords(data.data, data.word));

	function sortContainsWords(words: any[], currentWord: string): any[] {
		return [...words].sort((a, b) => {
			const idxA = currentWord.indexOf(a.w);
			const idxB = currentWord.indexOf(b.w);
			// Characters found in the word sort first, by position; others go to end
			if (idxA === -1 && idxB === -1) return 0;
			if (idxA === -1) return 1;
			if (idxB === -1) return -1;
			return idxA - idxB;
		});
	}

	function buildContainsWordForms(entry: any, currentWord: string): string[] {
		const forms: string[] = [];
		const add = (form: string | undefined | null) => {
			if (form && !forms.includes(form)) forms.push(form);
		};

		for (const word of entry.chinese_words || []) {
			add(word.simp);
			add(word.trad);
		}

		for (const word of entry.japanese_words || []) {
			for (const kanji of word.kanji || []) {
				add(kanji.text);
			}
		}

		for (const word of entry.korean_words || []) {
			add(word.hanja);
			add(word.hanjaForm);
		}

		add(currentWord);
		add(entry.key);

		return forms;
	}

	function buildChineseSentenceLookupWords(entry: any, currentWord: string): string[] {
		const forms: string[] = [];
		const add = (form: string | undefined | null) => {
			if (form && !forms.includes(form)) forms.push(form);
		};

		add(currentWord);

		for (const word of entry.chinese_words || []) {
			add(word.simp);
			add(word.trad);
		}

		if ([...currentWord].length === 1) {
			add(entry.chinese_char?.char);
			for (const variant of entry.chinese_char?.simpVariants || []) add(variant);
			for (const variant of entry.chinese_char?.tradVariants || []) add(variant);
			add(entry.chinese_char?.hkChar);
		}

		return forms;
	}

	// Scroll to hash target on mount (for section permalinks)
	onMount(() => {
		const scrollToCurrentHash = () => {
			const hash = window.location.hash?.slice(1);
			if (!hash) return;
			let attempts = 0;
			const scrollToHash = () => {
				const el = document.getElementById(hash);
				if (el) {
					el.scrollIntoView({ behavior: 'smooth', block: 'start' });
					return;
				}
				if (attempts < 20) {
					attempts += 1;
					setTimeout(scrollToHash, 150);
				}
			};
			setTimeout(scrollToHash, 50);
		};

		scrollToCurrentHash();
		window.addEventListener('hashchange', scrollToCurrentHash);
		return () => window.removeEventListener('hashchange', scrollToCurrentHash);
	});

	// Get all character variants
	let traditionalChar = $derived(data.data.chinese_char?.char || data.word);
	let koreanChar = $derived(data.data.korean_char);
	let uniqueGloss = $derived(learnerGlossForEntry(data.data));

	interface HeaderReading {
		label: string;
		value: string;
		className: string;
		languageTag: string;
	}

	function uniqueReadings(values: Array<string | null | undefined>): string[] {
		return [...new Set(values.filter((value): value is string => Boolean(value)))];
	}

	function buildHeaderReadings(entry: any, korean: any): HeaderReading[] {
		const readings: HeaderReading[] = [];
		const add = (
			label: string,
			values: Array<string | null | undefined>,
			className: string,
			languageTag: string,
			separator = ", "
		) => {
			const unique = uniqueReadings(values);
			if (!unique.length) return;
			readings.push({
				label,
				value: unique.join(separator),
				className,
				languageTag
			});
		};

		const wordPinyins = new Set(
			entry.chinese_words?.flatMap(
				(word: any) =>
					word.items?.map((item: any) => item.pinyin).filter(Boolean) || []
			) || []
		);
		const frequencyPinyins = entry.chinese_char?.pinyinFrequencies || [];
		const filteredPinyins = frequencyPinyins.filter((item: any) =>
			wordPinyins.has(item.pinyin)
		);
		const displayPinyins =
			filteredPinyins.length > 0 ? filteredPinyins : frequencyPinyins;

		if (displayPinyins.length > 0) {
			add(
				"Mandarin",
				displayPinyins.map((item: any) => item.pinyin),
				"text-pinyin",
				"zh-Latn"
			);
		} else if (entry.chinese_char?.oldPronunciations?.length) {
			add(
				"Mandarin",
				entry.chinese_char.oldPronunciations.map((item: any) => item.pinyin),
				"text-pinyin",
				"zh-Latn"
			);
		} else {
			add(
				"Mandarin",
				entry.chinese_words?.flatMap(
					(word: any) =>
						word.items?.map((item: any) => item.pinyin).filter(Boolean) || []
				) || [],
				"text-pinyin",
				"zh-Latn"
			);
		}

		add(
			"Cantonese",
			entry.chinese_char?.cantonese || [],
			"text-cantonese",
			"yue-Latn"
		);

		const readingMeaning = entry.japanese_char?.readingMeaning;
		const japaneseReadings =
			readingMeaning?.groups?.flatMap((group: any) => group.readings || []) ||
			readingMeaning?.readings ||
			[];
		add(
			"Japanese on’yomi",
			japaneseReadings
				.filter((reading: any) => reading.type === "ja_on")
				.map((reading: any) => reading.value),
			"text-onyomi",
			"ja",
			"、"
		);
		add(
			"Japanese kun’yomi",
			japaneseReadings
				.filter((reading: any) => reading.type === "ja_kun")
				.map((reading: any) => reading.value),
			"text-kunyomi",
			"ja",
			"、"
		);

		add(
			"Korean",
			korean?.readings?.map((reading: any) => reading.hangul) || [],
			"text-korean",
			"ko"
		);

		return readings;
	}

	let headerReadings = $derived(buildHeaderReadings(data.data, koreanChar));
	let senseHighlights = $derived.by(() => {
		const primary = normalizeLearnerGloss(uniqueGloss).toLocaleLowerCase('en');
		return dictionaryDefinitions(data.data)
			.filter((definition) => normalizeLearnerGloss(definition).toLocaleLowerCase('en') !== primary)
			.slice(0, 4);
	});
	let headerForms = $derived.by(() =>
		buildCharacterHeaderForms({
			entry: data.data,
			word: data.word,
			cards: mnemonicCards,
			relatedContexts: data.relatedFormContexts,
		})
	);

	function hasDifferentFormMeaning(form: CharacterHeaderForm): boolean {
		return Boolean(
			form.meaning &&
			normalizeLearnerGloss(form.meaning).toLocaleLowerCase('en') !==
				normalizeLearnerGloss(uniqueGloss).toLocaleLowerCase('en')
		);
	}

	// Get taxonomy path for the character
	let taxonomy = $derived(
		charTaxonomy?.[traditionalChar] ||
		charTaxonomy?.[data.word] ||
		[]
	);

	// Homophones: words with the same reading
	interface HomophoneResult { word: string; pronunciation: string; is_common: boolean }
	interface HomophoneGroup { reading: string; words: HomophoneResult[] }
	let homophones: HomophoneGroup[] = $state([]);

	$effect(() => {
		const _word = data.word;
		const currentJapaneseForms = new Set<string>([
			data.word,
			...(data.data.japanese_words || []).flatMap((japaneseWord: any) => [
				...(japaneseWord.kanji || []).map((kanji: any) => kanji.text),
				...(japaneseWord.kana || []).map((kana: any) => kana.text),
			]),
		].filter(Boolean));
		homophones = [];

		// Extract unique Japanese readings
		const readings = new Set<string>();
		for (const jw of data.data.japanese_words || []) {
			for (const k of jw.kana || []) {
				if (k.text) readings.add(k.text);
			}
		}

		// Fetch homophones for each reading
		for (const reading of readings) {
			fetch(`/api/lookup-reading?q=${encodeURIComponent(reading)}&limit=20`)
				.then(r => r.ok ? r.json() : null)
				.then(result => {
					if (!result?.results?.length) return;
					const filtered = result.results.filter(
						(w: HomophoneResult) =>
							!currentJapaneseForms.has(w.word) &&
							w.word !== reading
					);
					if (filtered.length > 0) {
						homophones = [...homophones, { reading, words: filtered }];
					}
				})
				.catch(() => {});
		}
	});
</script>

<Header currentWord={data.conjugatedFrom || data.word} />
<SentenceBar currentWord={data.word} />

<main id="main-content" class="max-w-6xl mx-auto px-3 py-2 md:px-5 md:py-3">
	<h1 class="visually-hidden">{data.word} dictionary entry</h1>
	<!-- Conjugation Info Box (shown when arriving via deinflection) -->
	{#if data.conjugatedFrom && data.conjugationInfo}
		<div class="mb-4 p-4 bg-info-bg border border-info-border rounded-lg">
			<div class="flex items-center gap-2 text-info-text">
				<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<div>
					<span class="font-medium">{data.conjugatedFrom}</span>
					<span class="mx-1">→</span>
					<span class="font-bold">{data.word}</span>
					<span class="ml-2 text-sm opacity-80">({data.conjugationInfo})</span>
				</div>
			</div>

			<!-- Alternative matches -->
			{#if data.conjugationAlternatives && data.conjugationAlternatives.length > 0}
				<div class="mt-3 pt-3 border-t border-info-border">
					<span class="text-sm text-info-muted">Could also be:</span>
					<div class="flex flex-wrap gap-2 mt-2">
						{#each data.conjugationAlternatives as alt}
							<a
								href="/{alt.word}?from={encodeURIComponent(data.conjugatedFrom)}&conj={encodeURIComponent(alt.conj)}"
								class="inline-flex items-center gap-1 text-sm px-3 py-1.5 bg-accent-light text-accent rounded-full hover:opacity-80 transition-opacity"
							>
								<span class="font-medium">{alt.word}</span>
								<span class="opacity-70">({alt.conj})</span>
							</a>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Custom Word Display -->
	{#if data.customWord}
		{@const cw = data.customWord}
		{@const defs = typeof cw.definitions === 'string' ? JSON.parse(cw.definitions) : cw.definitions}
		{@const pos = cw.partOfSpeech ? (typeof cw.partOfSpeech === 'string' ? JSON.parse(cw.partOfSpeech) : cw.partOfSpeech) : []}
		<div id="content">
			<div class="mb-4 p-3 rounded-lg bg-accent-light border border-accent/20">
				<div class="flex items-center gap-2 text-sm text-accent">
					<span>Community Word</span>
					{#if cw.user}
						<span class="text-text-muted">by</span>
						<a href="/users/{cw.userId}" class="text-accent hover:underline">{cw.user.name}</a>
					{/if}
				</div>
			</div>

			<div class="py-3 md:py-4">
				<div class="flex flex-col gap-2 mb-4">
					<div class="flex items-baseline gap-3 flex-wrap">
						{#if cw.language === 'zh'}
							<span class="custom-word-heading">
								{#if cw.simplified && cw.traditional && cw.simplified !== cw.traditional}
									{cw.simplified} / {cw.traditional}
								{:else}
									{cw.traditional || cw.simplified || cw.word}
								{/if}
							</span>
							{#if cw.pinyin}
								<span class="text-accent" style="font-size: var(--font-size-headline)">[{cw.pinyin}]</span>
							{/if}
							{#if cw.jyutping}
								<span class="text-cantonese" style="font-size: var(--font-size-body)">[{cw.jyutping}]</span>
							{/if}
						{:else if cw.language === 'ja'}
							<span class="custom-word-heading">{cw.kanji || cw.kana || cw.word}</span>
							{#if cw.kana && cw.kanji}
								<span class="text-accent" style="font-size: var(--font-size-headline)">{cw.kana}</span>
							{/if}
						{:else if cw.language === 'ko'}
							<span class="custom-word-heading">{cw.hangul || cw.word}</span>
							{#if cw.hanja}
								<span class="text-text-secondary" style="font-size: var(--font-size-headline)">[{cw.hanja}]</span>
							{/if}
						{/if}
						<SpeakButton text={cw.word} lang={cw.language === 'zh' ? 'zh' : cw.language === 'ja' ? 'ja' : 'ko'} size={20} />
					</div>

					{#if pos.length > 0}
						<div class="flex gap-2">
							{#each pos as p}
								<Tag type="pos" text={p} langTag="en" />
							{/each}
						</div>
					{/if}

					<div class="custom-word-defs">
						{#each defs as def, i}
							<div>{defs.length > 1 ? `${i + 1}. ` : ''}{def}</div>
						{/each}
					</div>

					{#if cw.notes}
						<div class="mt-2 text-text-secondary" style="font-size: var(--font-size-body); line-height: 1.6">
							{cw.notes}
						</div>
					{/if}
				</div>
			</div>

			<!-- Notes Section -->
			<LazyComponent
				loader={loadNotes}
				props={{ character: traditionalChar }}
				rootMargin="1200px 0px"
			/>
		</div>
	{:else}
	<div id="content">
		<!-- Character Header -->
		{#if data.data.chinese_char || data.data.japanese_char}
			<div class="mb-0">
				<div class="py-2 md:py-3">
					<!-- Compact Header: Characters + Pronunciations + Gloss in one line -->
					<div class="flex flex-col mb-2">
						<!-- Identity row: written forms + learner meaning -->
						<div class="character-identity-grid">
							<!-- Character Variants with Stroke Animations -->
							<div class="character-form-list">
								{#each headerForms as form}
									<div class="character-form">
										<div
											id={form.targetId}
											class="w-[80px] h-[80px] md:w-[100px] md:h-[100px] flex items-center justify-center bg-bg-secondary rounded-xl border border-border"
											aria-label={`${form.character}: ${form.roleLabel}`}
										>
											<div lang={form.languageTag} class="text-5xl md:text-7xl font-bold font-cjk leading-none text-text-primary">
												{form.character}
											</div>
										</div>
										<div
											class="min-h-5 text-xs md:text-base tracking-wide"
											title={form.roleLabel}
										>
											{form.flags}
										</div>
										{#if hasDifferentFormMeaning(form)}
											<div
												class="max-w-full text-center text-sm font-medium leading-tight text-accent"
												title={`Mnemonic keyword for ${form.character}`}
											>
												{form.meaning}
											</div>
										{/if}
									</div>
								{/each}
							</div>

							<!-- Main learner meaning and actions -->
							{#if uniqueGloss}
								<div class="character-summary">
										<div class="character-title-row flex items-center gap-1 mb-1">
										<h2
											class="text-xl md:text-4xl font-bold text-accent leading-tight flex-1 min-w-0"
										>
											{uniqueGloss}
										</h2>
										{#if data.data.chinese_char?.statistics?.hskLevel}
											<span class="level-badge hsk">HSK {data.data.chinese_char.statistics.hskLevel}</span>
										{/if}
										{#if data.data.japanese_char?.misc?.jlptLevel}
											<span class="level-badge jlpt">N{data.data.japanese_char.misc.jlptLevel}</span>
										{/if}
										<ShareButton title="{data.word} - Kiokun Dictionary" compact />
										<SaveToStudy
											word={data.word}
											language={data.data.chinese_char ? 'zh' : (data.data.japanese_char ? 'ja' : 'ko')}
											size="sm"
										/>
									</div>
									{#if data.data.semantic_mnemonic?.mnemonic_keyword && data.data.semantic_mnemonic?.lexical_gloss}
										<div class="mb-1 text-xs leading-snug text-text-secondary">
											<span class="font-semibold text-text-tertiary">Mnemonic keyword</span>
											<span aria-hidden="true"> · </span>
											<span class="font-semibold text-text-tertiary">Actual meanings:</span>
											{data.data.semantic_mnemonic.lexical_gloss}
										</div>
									{/if}
									<!-- Taxonomy breadcrumb -->
									{#if taxonomy && taxonomy.length > 0}
										<div class="taxonomy-breadcrumb text-xs text-text-tertiary mb-1 flex items-center gap-1 flex-wrap">
											{#each taxonomy as category, i}
												<a
													href="/category/{taxonomy.slice(0, i + 1).join('/')}"
													class="taxonomy-link text-text-secondary underline hover:text-accent transition-colors"
												>{category}</a>
												{#if i < taxonomy.length - 1}
													<span class="text-text-tertiary">→</span>
												{/if}
											{/each}
										</div>
									{/if}
									{#if senseHighlights.length > 0}
										<div class="character-sense-preview">
											{#each senseHighlights as sense, index}
												{#if index > 0}<span class="sense-separator" aria-hidden="true">·</span>{/if}
												<span>{sense}</span>
											{/each}
										</div>
									{/if}
								</div>
							{/if}

							{#if headerReadings.length > 0}
								<div
									class="character-readings"
									aria-label="Character readings"
								>
									{#each headerReadings as reading, index}
										{#if index > 0}
											<span class="reading-separator" aria-hidden="true">·</span>
										{/if}
										<span
											class="character-reading-group"
											aria-label={`${reading.label}: ${reading.value}`}
										>
											<span class="visually-hidden">{reading.label}: </span>
											<span
												class="character-reading-value font-cjk {reading.className}"
												lang={reading.languageTag}
											>
												{reading.value}
											</span>
										</span>
									{/each}
								</div>
							{/if}
						</div>
					</div>

						<CharacterLearningSections
							{data}
							support={characterLearningData.support}
							{mnemonicCards}
							simplifiedCharData={characterLearningData.simplifiedCharData}
							{headerForms}
						/>
					</div>
				</div>
			{/if}

		<!-- Chinese, Japanese, and Korean Words -->
		{#if showChineseWords || showJapaneseWords || showKoreanWords}
			<div class="word-sections-grid" class:two-primary-word-grid={twoPrimaryWordColumns}>
				<!-- Chinese Words -->
				{#if data.data.chinese_words?.length && languageStore.preferences.chinese}
					<div class="word-section-chinese">
						<SectionHeading id="chinese">Chinese</SectionHeading>
						<div>
							{#each data.data.chinese_words as word}
								{#if word.items && word.items.length > 0}
									{@const itemsWithDefs = word.items.filter(
										(item) =>
											item.definitions &&
											item.definitions.length > 0,
									)}
									{#each itemsWithDefs as item}
										<div class="chinese-word-entry" lang="zh">
											<!-- Character and Pinyin -->
											<div class="chinese-headwords">
												<span class="chinese-word-text">
													{#if word.simp && word.trad && word.simp !== word.trad}
														<span lang="zh-Hans">{word.simp}</span> / <span lang="zh-Hant">{word.trad}</span>
													{:else}
														{word.trad || word.simp || data.word}
													{/if}
												</span>
												{#if item.pinyin}
													<span
														class="chinese-pronunciation"
													>
														[{item.pinyin}]
													</span>
												{/if}
												{#if item.jyutping}
													<span
														class="cantonese-pronunciation"
														title="Cantonese (Jyutping)"
													>
														[{item.jyutping}]
													</span>
												{/if}
												<SpeakButton text={word.simp || word.trad || data.word} lang="zh" size={18} compact />
												<SaveToStudy word={word.simp || word.trad || data.word} language="zh" size="sm" />
											</div>
											<!-- Definitions -->
											{#if item.definitions && item.definitions.length > 0}
												<ol
													class="chinese-definitions"
													class:multiple={item.definitions.length > 1}
												>
													{#each item.definitions as definition}
														{@const matchedExamples = item.definitionExamples?.find(
															(record) => record.definition === definition,
														)?.examples || []}
														<li class="chinese-definition">
															<div>{definition}</div>
															{#if matchedExamples.length > 0}
																<SenseExampleList
																	examples={matchedExamples.map((example) => ({
																		text: example.simp || example.trad,
																		translation: example.en,
																		pinyin: example.pinyin,
																	}))}
																	language="zh"
																	fromWord={word.simp || word.trad}
																/>
															{/if}
														</li>
													{/each}
												</ol>
											{/if}
										</div>
									{/each}
								{/if}
							{/each}
						</div>
						<LazyComponent
							loader={loadChineseSentenceExamples}
							props={{
								word: data.word,
								words: chineseSentenceLookupWords,
							}}
							rootMargin="400px 0px"
						/>
					</div>
				{/if}

				<!-- Japanese Words -->
				{#if data.data.japanese_words?.length && languageStore.preferences.japanese}
					<div class="word-section-japanese">
						<SectionHeading id="japanese">Japanese</SectionHeading>
						<div lang="ja">
							<WordTable
								words={data.data.japanese_words}
							/>
						</div>
					</div>
				{/if}

				<!-- Korean Words -->
				{#if data.data.korean_words?.length && languageStore.preferences.korean}
					<div class="word-section-korean" lang="ko">
						<SectionHeading id="korean">Korean</SectionHeading>
						<div>
							{#each data.data.korean_words as word}
								{@const definitions = (word.definitions || []).filter(
									(definition) => definition.text && definition.text !== "Sentence"
								)}
								<div class="korean-word-entry">
									<!-- Hangul and Hanja -->
									<div class="korean-headwords">
										<span class="korean-word-text">{word.hangul}</span>
										{#if word.hanja}
											<span class="korean-hanja">[{word.hanja}]</span>
										{/if}
										<SpeakButton text={word.hangul} lang="ko" size={18} compact />
										<SaveToStudy word={word.hangul} language="ko" size="sm" />
									</div>
									<!-- Part of speech -->
									{#if word.pos}
										<div class="korean-pos-tags">
										<Tag type="pos" text={word.pos} langTag="en" />
									</div>
									{/if}
									<!-- Definitions -->
									{#if definitions.length > 0}
										<ol class="korean-definitions" class:multiple={definitions.length > 1}>
											{#each definitions as definition}
												<li class="korean-definition">
													<div>{definition.text}</div>
													{#if definition.examples?.length}
														<SenseExampleList
															examples={definition.examples.map((example) => ({
																text: example.korean,
																translation: example.translation,
															}))}
															language="ko"
															fromWord={word.hangul}
														/>
													{/if}
												</li>
											{/each}
										</ol>
									{/if}
									{#if word.examples?.length}
										<SenseExampleList
											examples={word.examples.map((example) => ({
												text: example.korean,
												translation: example.translation,
											}))}
											language="ko"
											fromWord={word.hangul}
										/>
									{/if}
								</div>
							{/each}
						</div>
						<LazyComponent
							loader={loadKoreanSentenceExamples}
							props={{
								word: data.word,
								containedInKorean: data.data.contained_in_korean?.map(
									(entry: any) => typeof entry === "string" ? entry : entry.w || ""
								) || [],
							}}
							rootMargin="400px 0px"
						/>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Homophones -->
		{#if homophones.length > 0}
			<SectionHeading id="homophones" divided={false}>Homophones</SectionHeading>
			<div class="homophones-section">
				{#each homophones as group}
					<div class="homophone-group">
						{#if homophones.length > 1}
							<div class="homophone-reading">{group.reading}</div>
						{/if}
						<div class="homophone-list">
							{#each group.words as hp}
								<a href="/{hp.word}" class="homophone-chip" class:common={hp.is_common}>
									{hp.word}
								</a>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Notes Section — show here (after words) when there's no character data -->
		{#if !(data.data.chinese_char || data.data.japanese_char)}
			<LazyComponent
				loader={loadNotes}
				props={{ character: traditionalChar }}
				rootMargin="1200px 0px"
			/>
		{/if}

		<!-- Japanese Names Section -->
		{#if data.data.japanese_names && data.data.japanese_names.length > 0}
			<LazyComponent
				loader={loadJapaneseNames}
				props={{ names: data.data.japanese_names, word: data.word }}
				rootMargin="1200px 0px"
			/>
		{/if}

		<!-- Contains Section (for multi-character words), sorted by position in word -->
		<LazyComponent
			loader={loadContains}
			props={{
				words: sortedContainsWords,
				wordForms: containsWordForms,
				charGlosses,
			}}
			rootMargin="1200px 0px"
		/>

		<!-- Appears In Section -->
		<LazyComponent
			loader={loadAppearsIn}
			props={{
				chineseWords: data.data.contained_in_chinese || [],
				japaneseWords: data.data.contained_in_japanese || [],
				koreanWords: data.data.contained_in_korean || [],
			}}
			rootMargin="1200px 0px"
		/>

		<!-- Artifact Mentions -->
		<LazyComponent
			loader={loadArtifactMentions}
			props={{ word: data.word }}
			rootMargin="1200px 0px"
		/>

		<!-- Reels Sections (show both Japanese and Chinese if applicable) -->
		{#if data.data.japanese_words && data.data.japanese_words.length > 0}
			<LazyComponent
				loader={loadReelsSection}
				props={{ word: data.word, language: "ja", id: "reels-ja" }}
				rootMargin="1200px 0px"
			/>
		{/if}
		{#if data.data.chinese_words && data.data.chinese_words.length > 0}
			<LazyComponent
				loader={loadReelsSection}
				props={{ word: data.word, language: "zh", id: "reels-zh" }}
				rootMargin="1200px 0px"
			/>
		{/if}
	</div>
	{/if}
</main>

<style>
	/* Homophones */
	.homophones-section { margin-bottom: var(--spacing-lg); }

	.homophone-group { margin-bottom: var(--spacing-sm); }
	.homophone-reading {
		font-size: var(--font-size-caption1);
		color: var(--text-tertiary);
		margin-bottom: var(--spacing-xs);
	}
	.homophone-list { display: flex; flex-wrap: wrap; gap: 6px; }
	.homophone-chip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 44px;
		min-height: 44px;
		padding: 3px 10px;
		border-radius: var(--radius-full);
		border: 1px solid var(--border-color);
		font-size: var(--font-size-body);
		color: var(--text-primary);
		text-decoration: none;
		transition: border-color 0.15s, color 0.15s;
	}
	.homophone-chip:hover { border-color: var(--accent); color: var(--accent); }
	.homophone-chip.common { font-weight: 500; }

	/* Level badges */
	.level-badge {
		padding: 1px 6px;
		border-radius: var(--radius-full);
		font-size: 10px;
		font-weight: 600;
		line-height: 1.3;
		white-space: nowrap;
		flex-shrink: 0;
	}
	.level-badge.hsk { background: var(--badge-hsk-bg); color: var(--badge-hsk-text); }
	.level-badge.jlpt { background: var(--accent-light); color: var(--accent); border: 1px solid var(--accent); }

	/* Custom word display */
	.custom-word-heading {
		font-size: var(--font-size-title);
		font-family: var(--font-cjk);
		font-weight: 700;
		color: var(--text-primary);
	}

	.custom-word-defs {
		font-size: var(--font-size-body);
		line-height: 1.6;
		color: var(--text-primary);
	}

	.text-cantonese {
		color: var(--color-cantonese);
	}

	.character-identity-grid {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: var(--spacing-sm) var(--spacing-lg);
	}

	.character-form-list {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 0.625rem;
	}

	.character-form {
		display: flex;
		width: 5.5rem;
		flex-direction: column;
		align-items: center;
		gap: 0.375rem;
	}

	@media (min-width: 768px) {
		.character-form-list {
			gap: 1rem;
		}

		.character-form {
			width: 6.75rem;
		}
	}

	.character-summary {
		min-width: 0;
		align-self: center;
	}

	.character-readings {
		grid-column: 1 / -1;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.25rem 0.55rem;
		color: var(--text-secondary);
	}

	.character-reading-group {
		min-width: 0;
		flex: 0 1 auto;
	}

	.reading-separator,
	.sense-separator {
		color: var(--text-tertiary);
	}

	.character-reading-value {
		min-width: 0;
		overflow-wrap: anywhere;
		font-size: clamp(1rem, 2.2vw, 1.25rem);
		font-weight: 600;
		line-height: 1.35;
	}

	.character-sense-preview {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.15rem 0.45rem;
		margin-bottom: var(--spacing-xs);
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--text-secondary);
		font-size: var(--font-size-caption1);
		font-family: inherit;
		line-height: 1.4;
		text-align: left;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	/* Responsive column layout for Chinese, Japanese, and Korean word sections.
	   Adapts to 1, 2, or 3 columns based on how many languages have content. */
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

		.word-sections-grid.two-primary-word-grid {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			align-items: start;
		}

		.word-sections-grid.two-primary-word-grid .word-section-korean {
			grid-column: 1 / -1;
		}
	}

	/* Chinese word entry styling to match Japanese word styling */
	.chinese-word-entry {
		margin-bottom: var(--spacing-md);
	}

	.chinese-headwords {
		display: flex;
		align-items: baseline;
		gap: var(--spacing-sm);
		margin-bottom: var(--spacing-sm);
		flex-wrap: wrap;
	}

	.chinese-word-text {
		font-size: var(--font-size-title);
		font-family: var(--font-cjk);
		font-weight: 600;
		color: var(--primary-highlight, #2c3e50);
	}

	.chinese-pronunciation {
		font-size: var(--font-size-body);
		font-family: var(--font-cjk);
		color: var(--reading-highlight, #e74c3c);
	}

	.cantonese-pronunciation {
		font-size: var(--font-size-subhead);
		font-family: var(--font-cjk);
		color: var(--color-cantonese, #e67e22);
	}

	.chinese-definitions {
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--font-size-footnote);
		line-height: 1.5;
		color: var(--text-primary);
	}

	.chinese-definitions.multiple {
		padding-left: 20px;
		list-style: decimal;
	}

	.chinese-definition {
		margin-bottom: var(--spacing-sm);
	}

	/* Korean word entry styling */
	.korean-word-entry {
		margin-bottom: var(--spacing-md);
	}

	.korean-headwords {
		display: flex;
		align-items: baseline;
		gap: var(--spacing-sm);
		margin-bottom: var(--spacing-sm);
		flex-wrap: wrap;
	}

	.korean-word-text {
		font-size: var(--font-size-title);
		font-family: var(--font-cjk);
		font-weight: 600;
		color: var(--primary-highlight, #2c3e50);
	}

	.korean-hanja {
		font-size: var(--font-size-body);
		font-family: var(--font-cjk);
		color: var(--text-secondary, #666);
	}

	.korean-pos-tags {
		margin-bottom: var(--spacing-sm);
	}

	.korean-definitions {
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--font-size-footnote);
		line-height: 1.5;
		color: var(--text-primary);
	}

	.korean-definitions.multiple {
		padding-left: 20px;
		list-style: decimal;
	}

	.korean-definition {
		margin-bottom: var(--spacing-sm);
	}

	/* Mobile typography adjustments */
	@media (max-width: 768px) {
		.character-identity-grid {
			grid-template-columns: minmax(0, 1fr);
			align-items: start;
			gap: var(--spacing-sm);
		}

		.character-form-list {
			gap: 0.625rem;
		}

		.character-summary {
			width: 100%;
		}

		.character-readings {
			grid-column: 1;
			gap: 0.2rem 0.45rem;
		}

		.character-title-row {
			flex-wrap: wrap;
		}

	}
</style>
