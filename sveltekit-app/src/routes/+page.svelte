<script lang="ts">
	import { onMount } from 'svelte';
	import Header from '$lib/components/Header.svelte';
	import HandwritingInput from '$lib/components/HandwritingInput.svelte';
	import FeaturedReels from '$lib/components/FeaturedReels.svelte';
	import { navigateOrSearch } from '$lib/utils/search-navigation';
	import { goto } from '$app/navigation';
	import SearchDropdown from '$lib/components/SearchDropdown.svelte';
	import AnnotatedSentence from '$lib/components/AnnotatedSentence.svelte';
	import { getDictionaryUrl } from '$lib/shard-utils';
	import { dev } from '$app/environment';
	import type { RubySegment } from '$lib/utils/sentence-ruby';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let handwritingInput = $state<HandwritingInput>();
	let searchDropdown = $state<SearchDropdown>();
	let heroSearchInput = $state<HTMLInputElement>();
	let heroSearchValue = $state('');
	let handwritingOpen = $state(false);
	let searchDropdownOpen = $state(false);
	let searchActiveDescendant = $state('');
	let isNativeRuntime = $state(typeof window !== 'undefined' && window.location.protocol === 'capacitor:');

	function handleHandwritingSelect(char: string) {
		heroSearchValue += char;
		heroSearchInput?.focus();
	}

	function toggleHandwriting() {
		searchDropdown?.close();
		handwritingOpen = !handwritingOpen;
	}

	async function doHeroSearch() {
		const word = heroSearchValue.trim();
		if (word) {
			searchDropdown?.close();
			handwritingInput?.close();
			await navigateOrSearch(word);
		}
	}
	let cachedGlosses: Record<string, string> | null = null;

	async function goToRandomCharacter() {
		if (!cachedGlosses) {
			const res = await fetch("/game_data/component_glosses.json");
			if (!res.ok) return;
			cachedGlosses = await res.json();
		}
		const keys = Object.keys(cachedGlosses!);
		// Try up to 10 times to find a character with a dictionary entry
		for (let attempt = 0; attempt < 10; attempt++) {
			const char = keys[Math.floor(Math.random() * keys.length)];
			const url = await getDictionaryUrl(char, dev, fetch);
			const resp = await fetch(url, { method: 'HEAD' });
			if (resp.ok) {
				await goto(`/${char}`);
				return;
			}
		}
		// Fallback: just navigate and let the 404 page handle it
		const char = keys[Math.floor(Math.random() * keys.length)];
		await goto(`/${char}`);
	}

	// Programmatic focus to ensure it works on mobile browsers
	onMount(() => {
		isNativeRuntime = window.location.protocol === 'capacitor:';
			if (
				!isNativeRuntime &&
				heroSearchInput &&
				window.matchMedia('(min-width: 768px) and (pointer: fine)').matches
			) {
				const input = heroSearchInput;
				setTimeout(() => input.focus(), 100);
			}
		});

	async function handleHeroSearch(event: KeyboardEvent) {
		if (searchDropdown?.handleKeydown(event)) return;
		if (event.key === 'Enter') {
			event.preventDefault();
			await doHeroSearch();
		}
	}

	// Compare: characters where traditional, simplified Chinese, and Japanese shinjitai all differ
	const compareExamples = [
		{ trad: '龍', simp: '龙', jp: '竜', meaning: 'dragon' },
		{ trad: '圖', simp: '图', jp: '図', meaning: 'map' },
		{ trad: '鐵', simp: '铁', jp: '鉄', meaning: 'iron' },
		{ trad: '齒', simp: '齿', jp: '歯', meaning: 'tooth' },
		{ trad: '廣', simp: '广', jp: '広', meaning: 'wide' },
		{ trad: '實', simp: '实', jp: '実', meaning: 'real' },
		{ trad: '戰', simp: '战', jp: '戦', meaning: 'war' },
		{ trad: '驛', simp: '驿', jp: '駅', meaning: 'station' },
		{ trad: '氣', simp: '气', jp: '気', meaning: 'energy / qi' },
		{ trad: '樂', simp: '乐', jp: '楽', meaning: 'music / joy' },
		{ trad: '觀', simp: '观', jp: '観', meaning: 'to observe' },
		{ trad: '經', simp: '经', jp: '経', meaning: 'to pass through' },
		{ trad: '變', simp: '变', jp: '変', meaning: 'to change' },
		{ trad: '藝', simp: '艺', jp: '芸', meaning: 'art' },
		{ trad: '賣', simp: '卖', jp: '売', meaning: 'to sell' },
		{ trad: '讀', simp: '读', jp: '読', meaning: 'to read' },
	];

	// Shared words
	const sharedWords = [
		{ trad: '學校', simp: '学校', label: 'School' },
		{ trad: '音樂', simp: '音乐', label: 'Music' },
		{ trad: '時間', simp: '时间', label: 'Time' },
		{ trad: '自然', label: 'Nature' },
		{ trad: '人生', label: 'Life' },
		{ trad: '世界', label: 'World' },
		{ trad: '歷史', simp: '历史', label: 'History' },
		{ trad: '文化', label: 'Culture' },
		{ trad: '社會', simp: '社会', label: 'Society' },
		{ trad: '經濟', simp: '经济', label: 'Economy' },
		{ trad: '科學', simp: '科学', label: 'Science' },
		{ trad: '未來', simp: '未来', label: 'Future' },
		{ trad: '哲學', simp: '哲学', label: 'Philosophy' },
	];

	// English search suggestions
	const searchSuggestions = [
		'beautiful', 'water', 'love', 'eat', 'house', 'big',
		'happy', 'sun', 'mountain', 'friend', 'time'
	];

	type HomeSentenceLanguage = 'ja' | 'zh' | 'ko';

	interface HomeSampleSentence {
		text: string;
		label: string;
		pinyin?: string;
		rubySegments?: RubySegment[];
	}

	// Curated readings keep the homepage fully annotated in its initial HTML.
	const sampleSentences: Record<'japanese' | 'chinese' | 'korean', HomeSampleSentence[]> = {
		japanese: [
			{
				text: '私は日本語を勉強しています',
				label: 'I am studying Japanese',
				rubySegments: [
					{ text: '私', reading: 'わたし', isWord: true },
					{ text: 'は', isWord: true },
					{ text: '日本語', reading: 'にほんご', isWord: true },
					{ text: 'を', isWord: true },
					{ text: '勉強', reading: 'べんきょう', isWord: true },
					{ text: 'しています', isWord: true }
				]
			},
			{
				text: '今日は天気がいいですね',
				label: 'The weather is nice today',
				rubySegments: [
					{ text: '今日', reading: 'きょう', isWord: true },
					{ text: 'は', isWord: true },
					{ text: '天気', reading: 'てんき', isWord: true },
					{ text: 'がいいですね', isWord: true }
				]
			},
			{
				text: '彼女は音楽が好きです',
				label: 'She likes music',
				rubySegments: [
					{ text: '彼女', reading: 'かのじょ', isWord: true },
					{ text: 'は', isWord: true },
					{ text: '音楽', reading: 'おんがく', isWord: true },
					{ text: 'が', isWord: true },
					{ text: '好き', reading: 'すき', isWord: true },
					{ text: 'です', isWord: true }
				]
			}
		],
		chinese: [
			{ text: '我今天很开心', label: 'I am very happy today', pinyin: 'Wǒ jīntiān hěn kāixīn' },
			{ text: '中国人喜欢吃饭', label: 'Chinese people like to eat', pinyin: 'Zhōngguó rén xǐhuan chīfàn' },
			{ text: '明天下雨吗', label: 'Will it rain tomorrow?', pinyin: 'Míngtiān xiàyǔ ma' }
		],
		korean: [
			{
				text: '저는 한국어를 공부합니다',
				label: 'I study Korean',
				rubySegments: [
					{ text: '저는', reading: 'jeoneun', isWord: true },
					{ text: ' ', isWord: false },
					{ text: '한국어를', reading: 'hangugeoreul', isWord: true },
					{ text: ' ', isWord: false },
					{ text: '공부합니다', reading: 'gongbuhamnida', isWord: true }
				]
			},
			{
				text: '오늘 날씨가 좋습니다',
				label: 'The weather is nice today',
				rubySegments: [
					{ text: '오늘', reading: 'oneul', isWord: true },
					{ text: ' ', isWord: false },
					{ text: '날씨가', reading: 'nalssiga', isWord: true },
					{ text: ' ', isWord: false },
					{ text: '좋습니다', reading: 'josseumnida', isWord: true }
				]
			},
			{
				text: '음악을 듣고 있어요',
				label: 'I am listening to music',
				rubySegments: [
					{ text: '음악을', reading: 'eumageul', isWord: true },
					{ text: ' ', isWord: false },
					{ text: '듣고', reading: 'deutkko', isWord: true },
					{ text: ' ', isWord: false },
					{ text: '있어요', reading: 'isseoyo', isWord: true }
				]
			}
		]
	};

	const sentenceLanguages: Array<{
		flag: string;
		language: HomeSentenceLanguage;
		items: HomeSampleSentence[];
	}> = [
		{ flag: '🇯🇵', language: 'ja', items: sampleSentences.japanese },
		{ flag: '🇨🇳', language: 'zh', items: sampleSentences.chinese },
		{ flag: '🇰🇷', language: 'ko', items: sampleSentences.korean }
	];

	// Conjugated words
	const japaneseConjugated = [
		{ word: '食べている', base: '食べる', label: 'eating' },
		{ word: '行きました', base: '行く', label: 'went' },
		{ word: '見たい', base: '見る', label: 'want to see' },
		{ word: '美しかった', base: '美しい', label: 'was beautiful' },
	];

	const koreanConjugated = [
		{ word: '먹고있어요', base: '먹다', label: 'eating' },
		{ word: '갔습니다', base: '가다', label: 'went' },
		{ word: '보고싶어요', base: '보다', label: 'want to see' },
		{ word: '예뻐요', base: '예쁘다', label: 'is pretty' },
	];

	// Interesting homophones — readings with many different words
	const homophoneHighlights = [
		{ lang: '🇯🇵', reading: 'こうしょう', words: '交渉 · 高尚 · 公称 · 考証 · 口承 · 工匠', path: '/homophones/japanese?q=こうしょう' },
		{ lang: '🇯🇵', reading: 'きかん', words: '期間 · 機関 · 気管 · 帰還 · 季刊 · 基幹', path: '/homophones/japanese?q=きかん' },
		{ lang: '🇯🇵', reading: 'しこう', words: '思考 · 志向 · 嗜好 · 施行 · 至高 · 指向', path: '/homophones/japanese?q=しこう' },
		{ lang: '🇨🇳', reading: 'shì', words: '是 · 事 · 市 · 式 · 世 · 室', path: '/homophones/chinese?q=shì' },
		{ lang: '🇨🇳', reading: 'yī', words: '一 · 衣 · 医 · 依 · 伊 · 揖', path: '/homophones/chinese?q=yī' },
		{ lang: '🇨🇳', reading: 'jī', words: '机 · 鸡 · 基 · 积 · 击 · 激', path: '/homophones/chinese?q=jī' },
		{ lang: '🇰🇷', reading: '수', words: '水 · 手 · 数 · 首 · 守 · 樹', path: '/homophones/korean?q=수' },
		{ lang: '🇰🇷', reading: '사', words: '四 · 死 · 社 · 士 · 事 · 史', path: '/homophones/korean?q=사' },
		{ lang: '🇰🇷', reading: '장', words: '長 · 場 · 章 · 將 · 障 · 張', path: '/homophones/korean?q=장' },
	];

	// Category highlights
	const categoryHighlights = [
		{ name: 'Animals', path: '/category/Nature/Animals', icon: '🐾' },
		{ name: 'Body', path: '/category/Human/Body', icon: '🫀' },
		{ name: 'Nature', path: '/category/Nature', icon: '🌿' },
		{ name: 'Numbers', path: '/category/Abstract/Numbers', icon: '🔢' },
		{ name: 'Colors', path: '/category/Abstract/Colors', icon: '🎨' },
		{ name: 'Food', path: '/category/Objects/Food', icon: '🍜' },
		{ name: 'Weather', path: '/category/Nature/Weather', icon: '🌤️' },
		{ name: 'Family', path: '/category/Human/Relations/Family', icon: '👨‍👩‍👧' },
	];
</script>

<Header currentWord="" isHomePage={true} />

<main id="main-content" class="page">
	<!-- Hero -->
	<section class="hero">
		<h1 class="hero-title">Kiokun</h1>
		<p class="hero-sub">The shared vocabulary of Chinese, Japanese & Korean</p>
		<!-- Hero Search -->
		<form
			class="hero-search"
			role="search"
			onsubmit={(event) => {
				event.preventDefault();
				void doHeroSearch();
			}}
		>
			<div class="hero-search-row">
				<!-- svelte-ignore a11y_autofocus -->
				<input
					id="hero-search"
					name="q"
					type="text"
					role="combobox"
					class="hero-search-input"
					placeholder="Search characters, words, or sentences..."
					aria-label="Search the dictionary"
					aria-autocomplete="list"
					aria-controls="hero-search-results"
					aria-expanded={searchDropdownOpen}
					aria-activedescendant={searchActiveDescendant || undefined}
					autocomplete="off"
					enterkeyhint="search"
					bind:value={heroSearchValue}
					bind:this={heroSearchInput}
					onkeydown={handleHeroSearch}
					onfocus={() => searchDropdown?.handleFocus()}
					onblur={() => searchDropdown?.handleBlur()}
				/>
				<div class="hero-search-actions">
					{#if heroSearchValue.trim()}
						<button type="submit" class="hero-action-btn search" title="Search" aria-label="Search">
							<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
								<circle cx="11" cy="11" r="8"/>
								<path d="m21 21-4.3-4.3"/>
							</svg>
						</button>
					{:else}
						<button
							type="button"
							onclick={goToRandomCharacter}
							class="hero-action-btn"
							title="Random character"
							aria-label="Open a random character"
						>
							🎲
						</button>
					{/if}
					<button
						type="button"
						onclick={toggleHandwriting}
						class="hero-action-btn"
						class:active={handwritingOpen}
						title="Draw a character"
						aria-label="Draw a character"
						aria-expanded={handwritingOpen}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
						</svg>
					</button>
				</div>
			</div>
			<SearchDropdown
				bind:this={searchDropdown}
				bind:value={heroSearchValue}
				bind:open={searchDropdownOpen}
				bind:activeDescendant={searchActiveDescendant}
				inputId="hero-search"
				listboxId="hero-search-results"
				onNavigate={() => handwritingInput?.close()}
			/>
			<HandwritingInput bind:this={handwritingInput} bind:visible={handwritingOpen} onSelect={handleHandwritingSelect} />
		</form>
	</section>

	<!-- Daily Picks -->
	{#if data.dailyPicks}
		<section class="section">
			<div class="daily-row">
				<a href="/{data.dailyPicks.character.value}" class="daily-card">
					<span class="daily-text">
						<span class="daily-label">Character of the Day</span>
						<span class="daily-gloss">{data.dailyPicks.character.gloss}</span>
					</span>
					<span class="daily-main">{data.dailyPicks.character.value}</span>
				</a>
				<a href="/{data.dailyPicks.word.value}" class="daily-card">
					<span class="daily-text">
						<span class="daily-label">Word of the Day</span>
						<span class="daily-gloss">{data.dailyPicks.word.gloss}</span>
					</span>
					<span class="daily-main daily-word">{data.dailyPicks.word.value}</span>
				</a>
			</div>
		</section>
	{:else}
		<section class="section" aria-busy="true" aria-label="Loading daily picks">
			<div class="daily-row">
				{#each [0, 1] as _}
					<div class="daily-card daily-card-skeleton" aria-hidden="true">
						<span class="daily-skeleton-copy">
							<span class="daily-skeleton-line daily-skeleton-label"></span>
							<span class="daily-skeleton-line daily-skeleton-gloss"></span>
						</span>
						<span class="daily-skeleton-glyph"></span>
					</div>
				{/each}
			</div>
			<span class="visually-hidden">Loading character and word of the day</span>
		</section>
	{/if}

	<!-- Characters — prominent, the core product. These are deliberately
	     characters that render differently across Traditional Chinese,
	     Simplified Chinese and Japanese, so the grid showcases the whole
	     point of a cross-CJK dictionary. -->
	<section class="section">
		<div class="section-head">
			<h2>Characters</h2>
		</div>
		<div class="cjk-grid">
			{#each compareExamples as ex}
				<a href="/{ex.trad}" class="cjk-card">
					<span class="cjk-row">
						<span class="cjk-glyph">{ex.trad}</span>
						<span class="cjk-sep">/</span>
						<span class="cjk-glyph">{ex.simp}</span>
						<span class="cjk-sep">/</span>
						<span class="cjk-glyph">{ex.jp}</span>
					</span>
					<span class="cjk-meaning">{ex.meaning}</span>
				</a>
			{/each}
		</div>
		<a href="/category" class="link-more">Browse all character categories →</a>
	</section>

	<!-- Words — secondary, denser -->
	<section class="section">
		<div class="section-head">
			<h2>Words</h2>
		</div>
		<div class="word-list">
			{#each sharedWords as item}
				<a href="/{item.trad}" class="word-chip">
					<span class="word-main">{item.trad}</span>
					{#if item.simp && item.simp !== item.trad}
						<span class="word-alt">{item.simp}</span>
					{/if}
					<span class="word-label">{item.label}</span>
				</a>
			{/each}
		</div>
	</section>

	<!-- Search by English -->
	<section class="section">
		<div class="section-head">
			<h2>Search by English</h2>
			<p>Find characters and words by meaning</p>
		</div>
		<div class="chip-row">
			{#each searchSuggestions as term}
				<a href="/search?q={encodeURIComponent(term)}" class="search-chip">{term}</a>
			{/each}
		</div>
	</section>

	<!-- Featured videos (heading intentionally omitted) -->
	<section class="section">
		<FeaturedReels />
		<div class="whats-new-links">
			<a href="/users" class="link-more">Community →</a>
			<a href="/artifacts" class="link-more">Artifacts →</a>
		</div>
	</section>

	<!-- Sentences -->
	<section class="section" aria-labelledby="try-sentence-heading">
		<div class="section-head">
			<h2 id="try-sentence-heading">Try a Sentence</h2>
			<p>Click to see every word broken down</p>
		</div>
		<div class="sentences-grid">
			{#each sentenceLanguages as lang}
				<div class="sent-col">
					<span class="sent-flag">{lang.flag}</span>
					{#each lang.items as s}
						<button type="button" class="sent-btn" onclick={() => navigateOrSearch(s.text)}>
							<span class="sent-text">
								<AnnotatedSentence
									text={s.text}
									language={lang.language}
									pinyin={s.pinyin}
									rubySegments={s.rubySegments}
									readingSize="12px"
								/>
							</span>
							<span class="sent-label">{s.label}</span>
						</button>
					{/each}
				</div>
			{/each}
		</div>
	</section>

	<!-- Conjugation -->
	<section class="section">
		<div class="section-head">
			<h2>Conjugated Forms</h2>
			<p>We find the dictionary form automatically</p>
		</div>
		<div class="conj-grid">
			{#each [
				{ flag: '🇯🇵', label: 'Japanese', items: japaneseConjugated },
				{ flag: '🇰🇷', label: 'Korean', items: koreanConjugated }
			] as lang}
				<div class="conj-col">
					<h3 class="conj-lang">{lang.flag} {lang.label}</h3>
					{#each lang.items as c}
						<button class="conj-btn" onclick={() => navigateOrSearch(c.word)}>
							<span class="conj-word">{c.word}</span>
							<span class="conj-arrow">→</span>
							<span class="conj-base">{c.base}</span>
							<span class="conj-label">{c.label}</span>
						</button>
					{/each}
				</div>
			{/each}
		</div>
	</section>

	<!-- Homophones -->
	<section class="section">
		<div class="section-head">
			<h2>Homophones</h2>
			<p>Same sound, different meaning — a key challenge in CJK languages</p>
		</div>
		<div class="homo-grid">
			{#each homophoneHighlights as h}
				<a href={h.path} class="homo-card">
					<div class="homo-top">
						<span class="homo-flag">{h.lang}</span>
						<span class="homo-reading">{h.reading}</span>
					</div>
					<span class="homo-words">{h.words}</span>
				</a>
			{/each}
		</div>
		<div class="homo-links">
			<a href="/homophones/japanese" class="link-more">Japanese homophones →</a>
			<a href="/homophones/chinese" class="link-more">Chinese homophones →</a>
			<a href="/homophones/korean" class="link-more">Korean homophones →</a>
		</div>
	</section>

	<!-- Bottom row: Categories + Quick links -->
	<div class="bottom-row">
		<section class="section compact">
			<div class="section-head">
				<h2>Browse by Category</h2>
			</div>
			<div class="cat-grid">
				{#each categoryHighlights as cat}
					<a href={cat.path} class="cat-chip">
						<span class="cat-icon">{cat.icon}</span>
						<span class="cat-name">{cat.name}</span>
					</a>
				{/each}
			</div>
			<a href="/category" class="link-more">See all categories →</a>
		</section>

		<section class="section compact">
			<div class="section-head">
				<h2>Explore</h2>
			</div>
			<div class="quick-links">
				<a href="/learning" class="qlink">🎓 Learning Resources</a>
				<a href="/artifacts" class="qlink">📦 Artifacts</a>
				<a href="/frequency" class="qlink">📊 Frequency Lists</a>
				<a href="/study" class="qlink">📚 Flashcard Review (SRS)</a>
				<a href="/study/decks" class="qlink">📥 Import JLPT / HSK / TOPIK</a>
				<a href="/users" class="qlink">👥 Community</a>
			</div>
		</section>
	</div>
</main>


<style>
	/* ===== Page ===== */
	.page {
		max-width: 960px;
		margin: 0 auto;
		padding: 0 var(--spacing-xl) 60px;
	}

	/* ===== Hero ===== */
	.hero {
		padding: 48px 0 24px;
		text-align: center;
	}
	.hero-title {
		font-size: 48px;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: var(--accent);
		margin: 0;
		line-height: 1;
	}
	.hero-sub {
		font-size: var(--font-size-body);
		color: var(--text-secondary);
		margin: 12px 0 0;
	}

	.hero-search {
		position: relative;
		max-width: 560px;
		margin: 24px auto 0;
	}

	.hero-search-row {
		display: flex;
		align-items: center;
		gap: 6px;
		position: relative;
	}

	.hero-search-input {
		flex: 1;
		min-width: 0;
		min-height: 52px;
		padding: 12px 104px 12px 20px;
		border: 1px solid var(--border-light);
		border-radius: var(--radius-full);
		font-size: var(--font-size-body);
		background: var(--bg-tertiary);
		color: var(--text-primary);
		font-family: inherit;
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}

	.hero-search-input:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-light);
	}

	.hero-search-input::placeholder {
		color: var(--text-muted);
	}

	.hero-search-actions {
		position: absolute;
		right: 6px;
		top: 50%;
		transform: translateY(-50%);
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.hero-action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		border: none;
		background: transparent;
		color: var(--text-tertiary);
		cursor: pointer;
		transition: color 0.15s ease, background 0.15s ease;
		font-size: 16px;
	}

	.hero-action-btn.search {
		background: var(--accent);
		color: var(--bg-primary);
	}

	.hero-action-btn:hover {
		color: var(--accent);
		background: var(--accent-light);
	}

	.hero-action-btn:active {
		transform: scale(0.92);
	}
	.hero-action-btn.active {
		background: var(--accent);
		color: white;
	}

	/* ===== Daily Picks ===== */
	.daily-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	.daily-card {
		display: flex;
		min-height: 72px;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 18px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg, 12px);
		text-decoration: none;
		transition: border-color 0.15s;
	}
	.daily-card:hover { border-color: var(--accent); }
	.daily-text {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}
	.daily-label {
		font-size: var(--font-size-caption1);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-secondary);
		font-weight: 600;
	}
	.daily-main {
		font-size: 36px;
		font-family: var(--font-cjk);
		color: var(--text-primary);
		line-height: 1;
		flex-shrink: 0;
	}
	.daily-word { font-size: 28px; }
	.daily-gloss {
		font-size: var(--font-size-callout);
		color: var(--text-secondary);
		text-transform: capitalize;
	}
	.daily-card-skeleton {
		position: relative;
		overflow: hidden;
		pointer-events: none;
		contain: paint;
	}
	.daily-card-skeleton::after {
		position: absolute;
		inset: 0;
		content: '';
		background: linear-gradient(
			90deg,
			transparent 0%,
			color-mix(in srgb, var(--text-primary) 8%, transparent) 50%,
			transparent 100%
		);
		transform: translateX(-100%);
		animation: daily-shimmer 1.4s ease-in-out infinite;
	}
	.daily-skeleton-copy {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 7px;
	}
	.daily-skeleton-line,
	.daily-skeleton-glyph {
		display: block;
		background: var(--bg-tertiary);
	}
	.daily-skeleton-line {
		height: 10px;
		border-radius: 3px;
	}
	.daily-skeleton-label {
		width: min(148px, 74%);
	}
	.daily-skeleton-gloss {
		width: min(96px, 52%);
		height: 14px;
	}
	.daily-skeleton-glyph {
		width: 36px;
		height: 36px;
		border-radius: 6px;
		flex-shrink: 0;
	}
	@keyframes daily-shimmer {
		to {
			transform: translateX(100%);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.daily-card-skeleton::after {
			animation: none;
		}
	}

	/* ===== Characters (cross-CJK glyphs) ===== */
	.cjk-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--spacing-md);
	}
	.cjk-card {
		display: flex;
		min-width: 0;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 7px;
		padding: 16px 8px 12px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		text-decoration: none;
		transition: border-color 0.15s, box-shadow 0.15s;
	}
	.cjk-row {
		display: flex;
		min-width: 0;
		max-width: 100%;
		align-items: center;
		justify-content: center;
		gap: 10px;
	}
	.cjk-meaning {
		font-size: var(--font-size-callout);
		color: var(--text-secondary);
		text-align: center;
		line-height: 1.3;
	}
	.cjk-card:hover {
		border-color: var(--accent);
		box-shadow: 0 2px 8px var(--shadow);
	}
	.cjk-glyph {
		font-size: 30px;
		font-family: var(--font-cjk);
		color: var(--text-primary);
		line-height: 1.1;
	}
	.cjk-card:hover .cjk-glyph {
		color: var(--accent);
	}
	.cjk-sep {
		font-size: 18px;
		color: var(--text-muted);
		opacity: 0.55;
		font-weight: 300;
		user-select: none;
	}


	/* ===== Sections ===== */
	.section {
		padding: 32px 0 0;
	}
	.section.compact {
		padding: 0;
	}
	.section-head {
		margin-bottom: 16px;
	}
	.section-head h2 {
		font-size: var(--font-size-headline);
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
	}
	.section-head p {
		font-size: var(--font-size-callout);
		color: var(--text-secondary);
		margin: 4px 0 0;
	}

	/* ===== Word List ===== */
	.word-list {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.word-chip {
		display: inline-flex;
		min-height: 44px;
		align-items: baseline;
		gap: 6px;
		padding: 8px 14px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-full);
		text-decoration: none;
		transition: border-color 0.15s, box-shadow 0.15s;
	}
	.word-chip:hover {
		border-color: var(--accent);
		box-shadow: 0 2px 8px var(--shadow);
	}
	.word-main {
		font-size: var(--font-size-body);
		font-weight: 600;
		color: var(--text-primary);
		font-family: var(--font-cjk);
	}
	.word-alt {
		font-size: var(--font-size-callout);
		color: var(--text-secondary);
	}
	.word-label {
		font-size: var(--font-size-callout);
		color: var(--text-secondary);
	}

	/* ===== Search Chips ===== */
	.chip-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.search-chip {
		display: inline-flex;
		min-height: 44px;
		align-items: center;
		padding: 8px 16px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-full);
		text-decoration: none;
		color: var(--text-primary);
		font-size: var(--font-size-callout);
		transition: border-color 0.15s, color 0.15s;
	}
	.search-chip:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	/* ===== Sentences ===== */
	.sentences-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 20px;
	}
	.sent-col {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.sent-flag {
		font-size: 20px;
	}
	.sent-btn {
		display: flex;
		min-height: 78px;
		flex-direction: column;
		align-items: flex-start;
		padding: 16px 14px 10px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		cursor: pointer;
		text-align: left;
		width: 100%;
		transition: border-color 0.15s;
	}
	.sent-btn:hover {
		border-color: var(--accent);
	}
	.sent-text {
		font-size: var(--font-size-callout);
		color: var(--text-primary);
		font-family: var(--font-cjk);
		line-height: 1.8;
	}
	.sent-text :global(.word-ruby) {
		margin-inline: 0.14em;
	}
	.sent-label {
		font-size: var(--font-size-callout);
		color: var(--text-secondary);
		margin-top: 2px;
	}

	/* ===== Conjugation ===== */
	.conj-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 32px;
	}
	.conj-col {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.conj-lang {
		font-size: var(--font-size-callout);
		font-weight: 600;
		color: var(--text-primary);
		margin: 0 0 4px;
	}
	.conj-btn {
		display: flex;
		min-height: 44px;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		cursor: pointer;
		width: 100%;
		transition: border-color 0.15s;
	}
	.conj-btn:hover {
		border-color: var(--accent);
	}
	.conj-word {
		font-size: var(--font-size-callout);
		font-weight: 600;
		color: var(--accent);
		font-family: var(--font-cjk);
	}
	.conj-arrow {
		color: var(--text-muted);
		font-size: var(--font-size-caption1);
	}
	.conj-base {
		font-size: var(--font-size-callout);
		color: var(--text-primary);
		font-family: var(--font-cjk);
	}
	.conj-label {
		font-size: var(--font-size-callout);
		color: var(--text-secondary);
		margin-left: auto;
	}

	/* ===== Homophones ===== */
	.homo-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 10px;
	}
	.homo-card {
		display: flex;
		min-height: 72px;
		flex-direction: column;
		gap: 4px;
		padding: 12px 16px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		text-decoration: none;
		transition: border-color 0.15s;
	}
	.homo-card:hover { border-color: var(--accent); }
	.homo-top { display: flex; align-items: center; gap: 8px; }
	.homo-flag { font-size: 14px; }
	.homo-reading { font-size: var(--font-size-headline); font-weight: 600; color: var(--accent); font-family: var(--font-cjk); }
	.homo-words { font-size: var(--font-size-caption1); color: var(--text-secondary); font-family: var(--font-cjk); }
	.homo-links { display: flex; gap: 16px; margin-top: 12px; flex-wrap: wrap; }

	/* ===== Bottom Row ===== */
	.bottom-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 32px;
		padding-top: 32px;
		border-top: 1px solid var(--border-color);
		margin-top: 32px;
	}

	/* ===== Categories ===== */
	.cat-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 8px;
	}
	.cat-chip {
		display: flex;
		min-height: 72px;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 10px 6px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		text-decoration: none;
		transition: border-color 0.15s;
	}
	.cat-chip:hover {
		border-color: var(--accent);
	}
	.cat-icon {
		font-size: 20px;
	}
	.cat-name {
		font-size: var(--font-size-callout);
		font-weight: 500;
		color: var(--text-primary);
		text-align: center;
	}
	.whats-new-links {
		display: flex;
		gap: 16px;
		margin-top: 12px;
	}
	.link-more {
		display: inline-flex;
		min-height: 44px;
		align-items: center;
		margin-top: 10px;
		font-size: var(--font-size-caption1);
		color: var(--accent);
		text-decoration: none;
	}
	.link-more:hover {
		text-decoration: underline;
	}

	/* ===== Quick Links ===== */
	.quick-links {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.qlink {
		display: flex;
		min-height: 44px;
		align-items: center;
		padding: 10px 14px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		text-decoration: none;
		font-size: var(--font-size-callout);
		font-weight: 500;
		color: var(--text-primary);
		transition: border-color 0.15s, color 0.15s;
	}
	.qlink:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	/* ===== Responsive ===== */
	@media (max-width: 768px) {
		.page {
			padding: 0 var(--spacing-lg) 40px;
		}
		.hero {
			padding: 32px 0 16px;
		}
		.hero-title {
			font-size: 36px;
		}
		.sentences-grid {
			grid-template-columns: 1fr;
			gap: 16px;
		}
		.conj-grid {
			grid-template-columns: 1fr;
			gap: 20px;
		}
		.bottom-row {
			grid-template-columns: 1fr;
			gap: 24px;
		}
		.cjk-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: var(--spacing-lg);
		}
	}

	@media (max-width: 480px) {
		.daily-card {
			min-height: 110px;
		}
		.cat-grid {
			grid-template-columns: repeat(2, 1fr);
		}
		.cjk-card:nth-child(n + 9) {
			display: none;
		}
		.cjk-card {
			padding-inline: 6px;
		}
		.cjk-row {
			gap: clamp(4px, 1.8vw, 8px);
		}
		.cjk-glyph {
			font-size: clamp(20px, 6.25vw, 24px);
		}
		.cjk-sep {
			font-size: clamp(12px, 4vw, 16px);
		}
	}

	@media (max-width: 340px) {
		.daily-row {
			grid-template-columns: 1fr;
		}
		.daily-card {
			min-height: 72px;
		}
	}
</style>
