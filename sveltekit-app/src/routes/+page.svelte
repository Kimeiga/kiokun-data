<script lang="ts">
	import { onMount } from 'svelte';
	import Header from '$lib/components/Header.svelte';
	import HandwritingInput from '$lib/components/HandwritingInput.svelte';
	import FeaturedReels from '$lib/components/FeaturedReels.svelte';
	import { navigateOrSearch } from '$lib/utils/search-navigation';
	import { goto } from '$app/navigation';
	import SearchDropdown from '$lib/components/SearchDropdown.svelte';
	import { getDictionaryUrl } from '$lib/shard-utils';
	import { dev } from '$app/environment';

	let handwritingInput: HandwritingInput;
	let heroSearchInput: HTMLInputElement;
	let heroSearchValue = $state('');
	let handwritingOpen = $state(false);

	function handleHandwritingSelect(char: string) {
		heroSearchValue += char;
	}

	function toggleHandwriting() {
		handwritingOpen = !handwritingOpen;
	}

	async function doHeroSearch() {
		const word = heroSearchValue.trim();
		if (word) {
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
		if (heroSearchInput) {
			// Small delay helps mobile browsers honor the focus
			setTimeout(() => heroSearchInput.focus(), 100);
		}
	});

	async function handleHeroSearch(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			const word = heroSearchValue.trim();
			if (word) {
				await navigateOrSearch(word);
			}
		}
	}

	// Character of the Day + Word of the Day — deterministic daily picks
	let cotdChar = $state('');
	let cotdGloss = $state('');
	let wotdWord = $state('');
	let wotdGloss = $state('');

	// Curated pool of interesting multi-character words
	const wordPool = [
		{ w: '友達', g: 'friend' }, { w: '勉強', g: 'study' }, { w: '天気', g: 'weather' },
		{ w: '家族', g: 'family' }, { w: '約束', g: 'promise' }, { w: '冒険', g: 'adventure' },
		{ w: '努力', g: 'effort' }, { w: '希望', g: 'hope' }, { w: '自由', g: 'freedom' },
		{ w: '平和', g: 'peace' }, { w: '感謝', g: 'gratitude' }, { w: '挑戦', g: 'challenge' },
		{ w: '記憶', g: 'memory' }, { w: '幸福', g: 'happiness' }, { w: '運命', g: 'fate' },
		{ w: '冒頭', g: 'beginning' }, { w: '宇宙', g: 'universe' }, { w: '地球', g: 'earth' },
		{ w: '景色', g: 'scenery' }, { w: '季節', g: 'season' }, { w: '旅行', g: 'travel' },
		{ w: '健康', g: 'health' }, { w: '知識', g: 'knowledge' }, { w: '哲学', g: 'philosophy' },
		{ w: '芸術', g: 'art' }, { w: '言葉', g: 'word' }, { w: '夢中', g: 'absorbed' },
		{ w: '感動', g: 'emotion' }, { w: '永遠', g: 'eternity' }, { w: '瞬間', g: 'moment' },
	];

	function dayHash(seed: string): number {
		let hash = 0;
		for (let i = 0; i < seed.length; i++) {
			hash = ((hash << 5) - hash) + seed.charCodeAt(i);
			hash = hash & hash;
		}
		return Math.abs(hash);
	}

	onMount(async () => {
		try {
			if (!cachedGlosses) {
				const res = await fetch("/game_data/component_glosses.json");
				if (res.ok) cachedGlosses = await res.json();
			}
			if (cachedGlosses) {
				const charKeys = Object.keys(cachedGlosses).filter(k => k.length === 1 && k.charCodeAt(0) >= 0x4E00);
				const today = new Date();
				const dayStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
				const h = dayHash(dayStr);

				// Character of the Day
				for (let attempt = 0; attempt < 10; attempt++) {
					const char = charKeys[(h + attempt) % charKeys.length];
					const url = await getDictionaryUrl(char, dev, fetch);
					const resp = await fetch(url, { method: 'HEAD' });
					if (resp.ok) {
						cotdChar = char;
						cotdGloss = cachedGlosses![char] || '';
						break;
					}
				}

				// Word of the Day (use different seed so they're independent)
				const h2 = dayHash(dayStr + '-word');
				const pick = wordPool[h2 % wordPool.length];
				wotdWord = pick.w;
				wotdGloss = pick.g;
			}
		} catch {} }
	);

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
	];

	// English search suggestions
	const searchSuggestions = [
		'beautiful', 'water', 'love', 'eat', 'house', 'big',
		'happy', 'sun', 'mountain', 'friend', 'time', 'new'
	];

	// Sample sentences for each language
	const sampleSentences = {
		japanese: [
			{ text: '私は日本語を勉強しています', label: 'I am studying Japanese' },
			{ text: '今日は天気がいいですね', label: 'The weather is nice today' },
			{ text: '彼女は音楽が好きです', label: 'She likes music' },
		],
		chinese: [
			{ text: '我今天很开心', label: 'I am very happy today' },
			{ text: '中国人喜欢吃饭', label: 'Chinese people like to eat' },
			{ text: '明天下雨吗', label: 'Will it rain tomorrow?' },
		],
		korean: [
			{ text: '저는 한국어를 공부합니다', label: 'I study Korean' },
			{ text: '오늘 날씨가 좋습니다', label: 'The weather is nice today' },
			{ text: '음악을 듣고 있어요', label: 'I am listening to music' },
		]
	};

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
		{ name: 'Body', path: '/category/Humanity/Body', icon: '🫀' },
		{ name: 'Nature', path: '/category/Nature', icon: '🌿' },
		{ name: 'Numbers', path: '/category/Abstract/Quantity/Numbers', icon: '🔢' },
		{ name: 'Colors', path: '/category/Abstract/Attribute/Color', icon: '🎨' },
		{ name: 'Food', path: '/category/Humanity/Sustenance/Food', icon: '🍜' },
		{ name: 'Weather', path: '/category/Nature/Weather', icon: '🌤️' },
		{ name: 'Family', path: '/category/Humanity/Kinship', icon: '👨‍👩‍👧' },
	];
</script>

<svelte:head>
	<title>Kiokun - Chinese, Japanese & Korean Dictionary</title>
	<meta
		name="description"
		content="A comprehensive CJK dictionary with stroke order, etymology, frequency data, and cross-references across Chinese, Japanese, and Korean."
	/>
</svelte:head>

<Header currentWord="" isHomePage={true} />

<main class="page">
	<!-- Hero -->
	<section class="hero">
		<h1 class="hero-title">Kiokun</h1>
		<p class="hero-sub">The shared vocabulary of Chinese, Japanese & Korean</p>
		<!-- Hero Search -->
		<div class="hero-search">
			<div class="hero-search-row">
				<!-- svelte-ignore a11y_autofocus -->
				<input
					type="text"
					class="hero-search-input"
					placeholder="Search characters, words, or sentences..."
					bind:value={heroSearchValue}
					bind:this={heroSearchInput}
					onkeydown={handleHeroSearch}
					autofocus
				/>
				<div class="hero-search-actions">
					<button
						onclick={goToRandomCharacter}
						class="hero-action-btn"
						title="Random Character"
					>
						🎲
					</button>
					<button
						onclick={toggleHandwriting}
						class="hero-action-btn"
						class:active={handwritingOpen}
						title="Draw Character"
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
						</svg>
					</button>
				</div>
			</div>
			<SearchDropdown bind:value={heroSearchValue} />
			<HandwritingInput bind:this={handwritingInput} bind:visible={handwritingOpen} onSelect={handleHandwritingSelect} />
		</div>
	</section>

	<!-- Daily Picks -->
	{#if cotdChar || wotdWord}
		<section class="section">
			<div class="daily-row">
				{#if cotdChar}
					<a href="/{cotdChar}" class="daily-card">
						<span class="daily-label">Character of the Day</span>
						<span class="daily-main">{cotdChar}</span>
						{#if cotdGloss}<span class="daily-gloss">{cotdGloss}</span>{/if}
					</a>
				{/if}
				{#if wotdWord}
					<a href="/{wotdWord}" class="daily-card">
						<span class="daily-label">Word of the Day</span>
						<span class="daily-main daily-word">{wotdWord}</span>
						{#if wotdGloss}<span class="daily-gloss">{wotdGloss}</span>{/if}
					</a>
				{/if}
			</div>
		</section>
	{/if}

	<!-- Characters — prominent, the core product. These are deliberately
	     characters that render differently across Traditional Chinese,
	     Simplified Chinese and Japanese, so the grid showcases the whole
	     point of a cross-CJK dictionary. -->
	<section class="section">
		<div class="section-head">
			<h2>Characters</h2>
			<p>One character, three writing systems</p>
		</div>
		<div class="compare-grid">
			{#each compareExamples as ex}
				<div class="compare-card">
					<div class="compare-chars">
						<a href="/{ex.trad}" class="compare-char" title="Traditional">
							<span class="compare-label">Traditional</span>
							<span class="compare-glyph">{ex.trad}</span>
						</a>
						<span class="compare-arrow">→</span>
						<a href="/{ex.simp}" class="compare-char" title="Simplified Chinese">
							<span class="compare-label">Simplified</span>
							<span class="compare-glyph">{ex.simp}</span>
						</a>
						<span class="compare-arrow">→</span>
						<a href="/{ex.jp}" class="compare-char" title="Japanese">
							<span class="compare-label">Japanese</span>
							<span class="compare-glyph">{ex.jp}</span>
						</a>
					</div>
					<span class="compare-meaning">{ex.meaning}</span>
				</div>
			{/each}
		</div>
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

	<!-- What's New -->
	<section class="section">
		<div class="section-head">
			<h2>What's New</h2>
			<p>Watch real content with interactive transcripts</p>
		</div>
		<FeaturedReels />
		<div class="whats-new-links">
			<a href="/users" class="link-more">Community →</a>
			<a href="/artifacts" class="link-more">Artifacts →</a>
		</div>
	</section>

	<!-- Sentences -->
	<section class="section">
		<div class="section-head">
			<h2>Try a Sentence</h2>
			<p>Click to see every word broken down</p>
		</div>
		<div class="sentences-grid">
			{#each [
				{ flag: '🇯🇵', items: sampleSentences.japanese },
				{ flag: '🇨🇳', items: sampleSentences.chinese },
				{ flag: '🇰🇷', items: sampleSentences.korean }
			] as lang}
				<div class="sent-col">
					<span class="sent-flag">{lang.flag}</span>
					{#each lang.items as s}
						<button class="sent-btn" onclick={() => navigateOrSearch(s.text)}>
							<span class="sent-text">{s.text}</span>
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
				<a href="/learning-resources" class="qlink">🎓 Learning Resources</a>
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
		padding: 12px 80px 12px 20px;
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
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: none;
		background: transparent;
		color: var(--text-tertiary);
		cursor: pointer;
		transition: color 0.15s ease, background 0.15s ease;
		font-size: 16px;
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
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 20px 16px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg, 12px);
		text-decoration: none;
		transition: border-color 0.15s;
		text-align: center;
	}
	.daily-card:hover { border-color: var(--accent); }
	.daily-label {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
		font-weight: 600;
	}
	.daily-main {
		font-size: 52px;
		font-family: var(--font-cjk);
		color: var(--text-primary);
		line-height: 1;
	}
	.daily-word { font-size: 36px; }
	.daily-gloss {
		font-size: var(--font-size-body);
		color: var(--text-secondary);
		text-transform: capitalize;
	}

	/* ===== Compare ===== */
	.compare-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 10px;
	}
	.compare-card {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 12px 16px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
	}
	.compare-chars { display: flex; align-items: center; gap: 6px; justify-content: center; }
	.compare-char {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-decoration: none;
		transition: color 0.15s;
	}
	.compare-char:hover .compare-glyph { color: var(--accent); }
	.compare-label { font-size: 9px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
	.compare-glyph { font-size: 28px; font-family: var(--font-cjk); color: var(--text-primary); line-height: 1.2; }
	.compare-arrow { color: var(--text-muted); font-size: 14px; }
	.compare-meaning { font-size: var(--font-size-caption1); color: var(--text-secondary); text-align: center; }

	/* ===== What's New ===== */
	.whats-new-links { display: flex; gap: 16px; margin-top: 12px; }

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
		font-size: var(--font-size-caption1);
		color: var(--text-tertiary);
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
		font-size: var(--font-size-caption1);
		color: var(--text-muted);
	}
	.word-label {
		font-size: var(--font-size-caption1);
		color: var(--text-tertiary);
	}

	/* ===== Search Chips ===== */
	.chip-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.search-chip {
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
		flex-direction: column;
		align-items: flex-start;
		padding: 10px 14px;
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
		line-height: 1.5;
	}
	.sent-label {
		font-size: var(--font-size-caption1);
		color: var(--text-muted);
		margin-top: 4px;
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
		font-size: var(--font-size-caption1);
		color: var(--text-muted);
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
		font-size: var(--font-size-caption1);
		font-weight: 500;
		color: var(--text-primary);
		text-align: center;
	}
	.link-more {
		display: block;
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
		display: block;
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
	}

	@media (max-width: 480px) {
		.cat-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
