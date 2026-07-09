<script lang="ts">
	import { onMount } from "svelte";
	import type { PageData } from "./$types";
	import type { CharacterLearningData } from "$lib/word-character-learning";
	import type { SemanticMnemonicCard as SemanticMnemonicCardType } from "$lib/types";
	import Header from "$lib/components/Header.svelte";
	import WordTable from "$lib/components/JapaneseWords/WordTable.svelte";
	import SectionHeading from "$lib/components/shared/SectionHeading.svelte";
	import SpeakButton from "$lib/components/shared/SpeakButton.svelte";
	import Tag from "$lib/components/shared/Tag.svelte";
	import SaveToStudy from "$lib/components/SaveToStudy.svelte";
	import { languageStore } from "$lib/stores/languages.svelte";
	import SentenceBar from "$lib/components/SentenceBar.svelte";
	import ShareButton from "$lib/components/ShareButton.svelte";
	import StudyModeToggle from "$lib/components/StudyModeToggle.svelte";
	import LazyComponent from "$lib/components/LazyComponent.svelte";
	import LazySentenceSections from "$lib/components/LazySentenceSections.svelte";

	const loadNotes = () => import("$lib/components/Notes.svelte");
	const loadJapaneseNames = () => import("$lib/components/JapaneseNames.svelte");
	const loadContains = () => import("$lib/Contains.svelte");
	const loadAppearsIn = () => import("$lib/AppearsIn.svelte");
	const loadArtifactMentions = () => import("$lib/components/ArtifactMentions.svelte");
	const loadReelsSection = () => import("$lib/components/ReelsSection.svelte");
	const loadCharacterLearningSections = () => import("$lib/components/CharacterLearningSections.svelte");

	// Study mode: tap-to-reveal interaction
	function handleStudyClick(event: MouseEvent) {
		const target = (event.target as HTMLElement).closest?.('.study-hide');
		if (target) {
			target.classList.toggle('revealed');
		}
	}

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

	let characterLearningData = $state<CharacterLearningData>(fallbackLearningData(data.data));

	$effect(() => {
		const promise = data.characterLearningData;
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


	let simplifiedChar = $derived(data.data.chinese_char?.simpVariants?.[0]);
	let japaneseChar = $derived(data.data.japanese_char?.literal);
	let koreanChar = $derived(data.data.korean_char);
	let hkChar = $derived(data.data.chinese_char?.hkChar);

	// Check if Korean Hanja form differs from traditional Chinese
	// Note: hanjaForm may contain Korean compatibility characters (U+F900-U+FAD9) which are
	// visually identical to standard CJK characters but have different Unicode codepoints.
	// We compare against korean_char.character (the canonical form) to determine if Korean
	// uses the same character, and only show a separate Korean box when hanjaForm actually
	// looks different (e.g., 龜 vs its Korean variant).
	let koreanHanjaForm = $derived(data.data.korean_char?.hanjaForm);
	let koreanCharacter = $derived(data.data.korean_char?.character);
	let krHasDifferentForm = $derived(
		koreanHanjaForm && koreanCharacter && koreanCharacter !== traditionalChar && koreanCharacter !== simplifiedChar && koreanCharacter !== japaneseChar
	);

	// Strip variant indicators (trad/simp/jp labels) from glosses
	function stripVariantIndicator(gloss: string): string {
		return gloss
			.replace(/\s*\(trad\/jp\)/gi, '')
			.replace(/\s*\(trad\)/gi, '')
			.replace(/\s*\(simp\)/gi, '')
			.replace(/\s*\(jp\)/gi, '')
			.trim();
	}

	// Get unique gloss from game data (falls back to existing gloss)
	let uniqueGloss = $derived(
		stripVariantIndicator(
			charGlosses?.[traditionalChar] ||
			charGlosses?.[data.word] ||
			data.data.chinese_char?.gloss ||
			''
		)
	);

	// Get taxonomy path for the character
	let taxonomy = $derived(
		charTaxonomy?.[traditionalChar] ||
		charTaxonomy?.[data.word] ||
		[]
	);

	// Simple comparisons to determine which characters are identical
	// If no simplified variant exists, the character is the same in simplified Chinese
	let simpSameAsTrad = $derived(!simplifiedChar || simplifiedChar === traditionalChar);
	let jpSameAsTrad = $derived(japaneseChar === traditionalChar);
	let jpSameAsSimp = $derived(!simplifiedChar ? jpSameAsTrad : japaneseChar === simplifiedChar);

	// Korean character comparisons - check if Korean uses the same character as traditional
	let krSameAsTrad = $derived(!koreanChar || koreanChar.character === traditionalChar);
	let krSameAsSimp = $derived(!koreanChar || !simplifiedChar ? krSameAsTrad : koreanChar.character === simplifiedChar);
	let krSameAsJp = $derived(!koreanChar || !japaneseChar ? krSameAsTrad : koreanChar.character === japaneseChar);

	// Hong Kong character variant - check if HK uses a different character form than all others
	let hkHasDifferentForm = $derived(
		hkChar &&
		hkChar !== traditionalChar &&
		hkChar !== simplifiedChar &&
		hkChar !== japaneseChar &&
		hkChar !== koreanCharacter
	);

	// Homophones: words with the same reading
	interface HomophoneResult { word: string; pronunciation: string; is_common: boolean }
	interface HomophoneGroup { reading: string; words: HomophoneResult[] }
	let homophones: HomophoneGroup[] = $state([]);

	$effect(() => {
		const _word = data.word;
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
					const filtered = result.results.filter((w: HomophoneResult) => w.word !== data.word && w.word !== reading);
					if (filtered.length > 0) {
						homophones = [...homophones, { reading, words: filtered }];
					}
				})
				.catch(() => {});
		}
	});
</script>

<svelte:head>
	<title>{data.word} - Kiokun Dictionary</title>
	<meta name="description" content={data.data.chinese_char?.gloss
		? `${data.word}: ${data.data.chinese_char.gloss}. Chinese and Japanese dictionary entry with stroke order, readings, and definitions.`
		: `${data.word} - Chinese and Japanese dictionary entry with stroke order, readings, and definitions.`} />

	<!-- Open Graph -->
	<meta property="og:title" content={`${data.word} - Kiokun Dictionary`} />
	<meta property="og:description" content={data.data.chinese_char?.gloss
		? `${data.word}: ${data.data.chinese_char.gloss}. Chinese and Japanese dictionary entry with stroke order, readings, and definitions.`
		: `${data.word} - Chinese and Japanese dictionary entry with stroke order, readings, and definitions.`} />
	<meta property="og:url" content={`https://kiokun.pages.dev/${encodeURIComponent(data.word)}`} />

	<!-- Twitter Card -->
	<meta name="twitter:title" content={`${data.word} - Kiokun Dictionary`} />
	<meta name="twitter:description" content={data.data.chinese_char?.gloss
		? `${data.word}: ${data.data.chinese_char.gloss}. Chinese and Japanese dictionary entry with stroke order, readings, and definitions.`
		: `${data.word} - Chinese and Japanese dictionary entry with stroke order, readings, and definitions.`} />
</svelte:head>

<Header currentWord={data.conjugatedFrom || data.word} />
<SentenceBar currentWord={data.word} />

<div class="max-w-6xl mx-auto px-3 py-2 md:px-5 md:py-3">
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
				<div class="py-3 md:py-4">
					<!-- Compact Header: Characters + Pronunciations + Gloss in one line -->
					<div class="flex flex-col gap-4 mb-4">
						<!-- Top Row: Character Variants & Main Gloss -->
						<!-- Grid: chars left, gloss+pronunciations right -->
						<div class="grid grid-cols-[auto_1fr] gap-3 md:gap-4 items-start">
							<!-- Character Variants with Stroke Animations -->
							<div class="flex items-center gap-3 md:gap-4">
								<!-- Traditional Chinese (always shown if exists) -->
								{#if traditionalChar}
									<div class="flex flex-col items-center gap-2">
										<div
											id="trad-writer-target"
											class="w-[80px] h-[80px] md:w-[100px] md:h-[100px] flex items-center justify-center bg-bg-secondary rounded-xl shadow-lg border border-border"
										>
											<div lang="zh-Hant" class="text-5xl md:text-7xl font-bold font-cjk leading-none text-text-primary">
												{traditionalChar}
											</div>
										</div>
										<div class="text-xs md:text-base tracking-wide">
											🇹🇼{#if !hkHasDifferentForm}🇭🇰{/if}{#if simpSameAsTrad}🇨🇳{/if}{#if jpSameAsTrad}🇯🇵{/if}{#if koreanChar && krSameAsTrad && !krHasDifferentForm}🇰🇷{/if}
										</div>
									</div>
								{/if}

								<!-- Simplified Chinese (only if different from traditional) -->
								{#if simplifiedChar && !simpSameAsTrad}
									<div class="flex flex-col items-center gap-2">
										<div
											id="simp-writer-target"
											class="w-[80px] h-[80px] md:w-[100px] md:h-[100px] flex items-center justify-center bg-bg-secondary rounded-xl shadow-lg border border-border"
										>
											<div lang="zh-Hans" class="text-5xl md:text-7xl font-bold font-cjk leading-none text-text-primary">
												{simplifiedChar}
											</div>
										</div>
										<div class="text-xs md:text-base tracking-wide">
											🇨🇳{#if jpSameAsSimp}🇯🇵{/if}
										</div>
									</div>
								{/if}

								<!-- Japanese Kanji (only if different from both trad and simp) -->
								{#if japaneseChar && !jpSameAsTrad && !jpSameAsSimp}
									<div class="flex flex-col items-center gap-2">
										<div
											id="jp-writer-target"
											class="w-[80px] h-[80px] md:w-[100px] md:h-[100px] flex items-center justify-center bg-bg-secondary rounded-xl shadow-lg border border-border"
										>
											<div lang="ja" class="text-5xl md:text-7xl font-bold font-cjk leading-none text-text-primary">
												{japaneseChar}
											</div>
										</div>
										<div class="text-xs md:text-base tracking-wide">
											🇯🇵{#if koreanChar && krSameAsJp && !krHasDifferentForm}🇰🇷{/if}
										</div>
									</div>
								{/if}

								<!-- Korean Hanja (only if it has a distinct form from all others) -->
								{#if krHasDifferentForm && koreanHanjaForm}
									<div class="flex flex-col items-center gap-2">
										<div
											class="w-[80px] h-[80px] md:w-[100px] md:h-[100px] flex items-center justify-center bg-bg-secondary rounded-xl shadow-lg border border-border"
										>
											<div lang="ko" class="text-5xl md:text-7xl font-bold font-cjk leading-none text-text-primary">
												{koreanHanjaForm}
											</div>
										</div>
										<div class="text-xs md:text-base tracking-wide">
											🇰🇷
										</div>
									</div>
								{/if}

								<!-- Hong Kong variant (only if it has a distinct form from all others) -->
								{#if hkHasDifferentForm && hkChar}
									<div class="flex flex-col items-center gap-2">
										<div
											class="w-[80px] h-[80px] md:w-[100px] md:h-[100px] flex items-center justify-center bg-bg-secondary rounded-xl shadow-lg border border-border"
										>
											<div lang="zh-HK" class="text-5xl md:text-7xl font-bold font-cjk leading-none text-text-primary">
												{hkChar}
											</div>
										</div>
										<div class="text-xs md:text-base tracking-wide">
											🇭🇰
										</div>
									</div>
								{/if}
							</div>

							<!-- Main Meaning (Gloss) + Pronunciations -->
							{#if uniqueGloss || data.data.chinese_char?.gloss}
								<div class="min-w-0">
										<div class="character-title-row flex items-center gap-2 mb-1 md:mb-2">
											<h1
												class="text-xl md:text-4xl font-bold text-accent leading-tight flex-1 min-w-0"
											>
												<button
													type="button"
													class="character-title-button study-hide"
													onclick={handleStudyClick}
												>
													{uniqueGloss || stripVariantIndicator(data.data.chinese_char?.gloss || '')}
												</button>
											</h1>
										{#if data.data.chinese_char?.statistics?.hskLevel}
											<span class="level-badge hsk">HSK {data.data.chinese_char.statistics.hskLevel}</span>
										{/if}
										{#if data.data.japanese_char?.misc?.jlptLevel}
											<span class="level-badge jlpt">N{data.data.japanese_char.misc.jlptLevel}</span>
										{/if}
										<StudyModeToggle />
										<ShareButton title="{data.word} - Kiokun Dictionary" />
										<SaveToStudy
											word={data.word}
											language={data.data.chinese_char ? 'zh' : (data.data.japanese_char ? 'ja' : 'ko')}
											size="sm"
										/>
									</div>
									<!-- Taxonomy breadcrumb -->
									{#if taxonomy && taxonomy.length > 0}
										<div class="text-xs text-text-tertiary mb-2 flex items-center gap-1 flex-wrap">
											{#each taxonomy as category, i}
												<a
													href="/category/{taxonomy.slice(0, i + 1).join('/')}"
													class="text-text-secondary underline hover:text-accent transition-colors"
												>{category}</a>
												{#if i < taxonomy.length - 1}
													<span class="text-text-tertiary">→</span>
												{/if}
											{/each}
										</div>
									{/if}
									<!-- Pinyin/Readings Summary - always left-aligned -->
									<!-- svelte-ignore a11y_click_events_have_key_events -->
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<div class="flex flex-col gap-1 text-text-secondary text-sm md:text-base study-hide" onclick={handleStudyClick}>
										{#if data.data.chinese_char?.pinyinFrequencies && data.data.chinese_char.pinyinFrequencies.length > 0}
											{@const wordPinyins = new Set(
												data.data.chinese_words?.flatMap(
													(w) =>
														w.items
															?.map(
																(item) =>
																	item.pinyin,
															)
															.filter(Boolean),
												) || [],
											)}
											{@const filteredPinyins =
												data.data.chinese_char.pinyinFrequencies.filter(
													(pf) =>
														wordPinyins.has(
															pf.pinyin,
														),
												)}
											{@const displayPinyins = filteredPinyins.length > 0 ? filteredPinyins : data.data.chinese_char.pinyinFrequencies}
											<div class="font-mono text-pinyin">
												{displayPinyins
													.map((pf) => pf.pinyin)
													.join(", ")}
											</div>
										{:else if data.data.chinese_char?.oldPronunciations?.length}
											{@const pinyinFromOld = [...new Set(data.data.chinese_char.oldPronunciations.map((p) => p.pinyin).filter(Boolean))]}
											{#if pinyinFromOld.length > 0}
												<div class="font-mono text-pinyin">
													{pinyinFromOld.join(", ")}
												</div>
											{/if}
										{:else if data.data.chinese_words?.length}
											{@const pinyinFromWords = [...new Set(data.data.chinese_words.flatMap((w) => w.items?.map((item) => item.pinyin).filter(Boolean) || []))]}
											{#if pinyinFromWords.length > 0}
												<div class="font-mono text-pinyin">
													{pinyinFromWords.join(", ")}
												</div>
											{/if}
										{/if}
										<!-- Cantonese (Jyutping) readings from Unihan -->
										{#if data.data.chinese_char?.cantonese && data.data.chinese_char.cantonese.length > 0}
											<div class="font-mono text-cantonese">
												{data.data.chinese_char.cantonese.join(", ")}
											</div>
										{/if}
										{#if data.data.japanese_char?.readingMeaning}
											{@const allReadings =
												data.data.japanese_char
													.readingMeaning.groups?.[0]
													?.readings ||
												data.data.japanese_char
													.readingMeaning.readings ||
												[]}
											{@const onyomi = allReadings
												.filter(
													(r) => r.type === "ja_on",
												)
												.map((r) => r.value)}
											{@const kunyomi = allReadings
												.filter(
													(r) => r.type === "ja_kun",
												)
												.map((r) => r.value)}
											{#if onyomi.length > 0}
												<div class="font-cjk text-onyomi">
													{onyomi.join("、")}
												</div>
											{/if}
											{#if kunyomi.length > 0}
												<div class="font-cjk text-kunyomi">
													{kunyomi.join("、")}
												</div>
											{/if}
										{/if}
										{#if koreanChar && koreanChar.readings?.length > 0}
											<div class="font-cjk text-korean">
												{koreanChar.readings.map(r => r.hangul).join(", ")}
											</div>
										{/if}
									</div>
								</div>
							{/if}
						</div>
					</div>

						<LazyComponent
							loader={loadCharacterLearningSections}
							props={{
								data,
								support: characterLearningData.support,
								mnemonicCards,
								simplifiedCharData: characterLearningData.simplifiedCharData,
							}}
							rootMargin="1400px 0px"
							eager={true}
						/>
					</div>
				</div>
			{/if}

		<!-- Chinese, Japanese, and Korean Words -->
		{#if showChineseWords || showJapaneseWords || showKoreanWords}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="word-sections-grid study-hide" class:two-primary-word-grid={twoPrimaryWordColumns} onclick={handleStudyClick}>
				<!-- Chinese Words -->
				{#if data.data.chinese_words?.length && languageStore.preferences.chinese}
					<div class="word-section-chinese">
						<SectionHeading id="chinese">Chinese</SectionHeading>
						<div class="mb-4">
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
												<SpeakButton text={word.simp || word.trad || data.word} lang="zh" size={18} />
												<SaveToStudy word={word.simp || word.trad || data.word} language="zh" size="sm" />
											</div>
											<!-- Definitions -->
											{#if item.definitions && item.definitions.length > 0}
												<div
													class="chinese-definitions"
												>
													{item.definitions.join(
														"; ",
													)}
												</div>
											{/if}
										</div>
									{/each}
								{/if}
							{/each}
						</div>
					</div>
				{/if}

				<!-- Japanese Words -->
				{#if data.data.japanese_words?.length && languageStore.preferences.japanese}
					<div class="word-section-japanese">
						<SectionHeading id="japanese">Japanese</SectionHeading>
						<div class="mb-4" lang="ja">
							<WordTable
								words={data.data.japanese_words}
								accentDisplay="binary"
							/>
						</div>
					</div>
				{/if}

				<!-- Korean Words -->
				{#if data.data.korean_words?.length && languageStore.preferences.korean}
					<div class="word-section-korean" lang="ko">
						<SectionHeading id="korean">Korean</SectionHeading>
						<div class="mb-4">
							{#each data.data.korean_words as word}
								<div class="korean-word-entry">
									<!-- Hangul and Hanja -->
									<div class="korean-headwords">
										<span class="korean-word-text">{word.hangul}</span>
										{#if word.hanja}
											<span class="korean-hanja">[{word.hanja}]</span>
										{/if}
										<SpeakButton text={word.hangul} lang="ko" size={18} />
										<SaveToStudy word={word.hangul} language="ko" size="sm" />
									</div>
									<!-- Part of speech -->
									{#if word.pos}
										<div class="korean-pos-tags">
										<Tag type="pos" text={word.pos} langTag="en" />
									</div>
									{/if}
									<!-- Definitions -->
									{#if word.definitions && word.definitions.length > 0}
										<div class="korean-definitions">
											{word.definitions.map(d => d.text).join("; ")}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Homophones -->
		{#if homophones.length > 0}
			<SectionHeading id="homophones">Homophones</SectionHeading>
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

		<!-- Example Sentences — unified grid matching the definition columns layout -->
		<LazySentenceSections
			word={data.word}
			japaneseSenses={data.data.japanese_words?.flatMap((w: any) => w.sense) ?? []}
			hasChineseWords={!!data.data.chinese_words?.length}
			{chineseSentenceLookupWords}
			hasKoreanSource={!!(data.data.korean_words?.length || data.data.korean_char || data.data.contained_in_korean?.length)}
			containedInKorean={data.data.contained_in_korean?.map((w: any) => typeof w === 'string' ? w : w.w || '') || []}
			rootMargin="1200px 0px"
		/>

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
</div>

<style>
	/* Homophones */
	.homophones-section { margin-bottom: var(--spacing-lg); }

	.character-title-button {
		display: inline;
		max-width: 100%;
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		line-height: inherit;
		text-align: left;
		cursor: pointer;
	}

	.character-title-button:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 3px;
		border-radius: var(--radius-sm);
	}

	.homophone-group { margin-bottom: var(--spacing-sm); }
	.homophone-reading {
		font-size: var(--font-size-caption1);
		color: var(--text-tertiary);
		margin-bottom: var(--spacing-xs);
	}
	.homophone-list { display: flex; flex-wrap: wrap; gap: 6px; }
	.homophone-chip {
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
		padding: 2px 8px;
		border-radius: var(--radius-full);
		font-size: 11px;
		font-weight: 600;
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
		margin-bottom: var(--spacing-xl);
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
		font-size: var(--font-size-footnote);
		line-height: 1.5;
		color: var(--text-primary);
	}

	/* Korean word entry styling */
	.korean-word-entry {
		margin-bottom: var(--spacing-xl);
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
		font-size: var(--font-size-footnote);
		line-height: 1.5;
		color: var(--text-primary);
	}

	/* Mobile typography adjustments */
	@media (max-width: 768px) {
		.character-title-row {
			flex-wrap: wrap;
		}

		.character-title-row h1 {
			flex-basis: 100%;
		}

	}
</style>
