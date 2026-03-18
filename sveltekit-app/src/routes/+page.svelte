<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import FeaturedReels from '$lib/components/FeaturedReels.svelte';
	import { navigateOrSearch } from '$lib/utils/search-navigation';

	// Shared characters - exist in both Chinese and Japanese
	const sharedCharacters = [
		{ trad: '愛', simp: '爱', label: 'Love' },
		{ trad: '心', label: 'Heart' },
		{ trad: '夢', simp: '梦', label: 'Dream' },
		{ trad: '空', label: 'Sky' },
		{ trad: '山', label: 'Mountain' },
		{ trad: '水', label: 'Water' },
		{ trad: '火', label: 'Fire' },
		{ trad: '風', simp: '风', label: 'Wind' },
		{ trad: '月', label: 'Moon' },
		{ trad: '日', label: 'Sun' },
		{ trad: '花', label: 'Flower' },
		{ trad: '雨', label: 'Rain' },
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

<Header currentWord="" autofocus={true} />

<main class="page">
	<!-- Hero -->
	<section class="hero">
		<h1 class="hero-title">Kiokun</h1>
		<p class="hero-sub">The shared vocabulary of Chinese, Japanese & Korean</p>
	</section>

	<!-- Characters — prominent, the core product -->
	<section class="section">
		<div class="section-head">
			<h2>Characters</h2>
		</div>
		<div class="char-grid">
			{#each sharedCharacters as item}
				<a href="/{item.trad}" class="char-card">
					<span class="char-main">{item.trad}</span>
					{#if item.simp && item.simp !== item.trad}
						<span class="char-alt">{item.simp}</span>
					{/if}
					<span class="char-label">{item.label}</span>
				</a>
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

	<!-- Featured Reels -->
	<FeaturedReels />

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
				<h2>Quick Links</h2>
			</div>
			<div class="quick-links">
				<a href="/frequency" class="qlink">🇯🇵 Japanese Top 1000</a>
				<a href="/frequency" class="qlink">🇨🇳 Chinese Top 1000</a>
				<a href="/frequency" class="qlink">🇰🇷 Korean Top 1000</a>
				<a href="/study" class="qlink">Flashcard Review (SRS)</a>
				<a href="/study/decks" class="qlink">Import JLPT / HSK / TOPIK</a>
				<a href="/japanese-emoji" class="qlink">Japanese Emoji Guide</a>
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

	/* ===== Character Grid ===== */
	.char-grid {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 10px;
	}
	.char-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 14px 8px 10px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		text-decoration: none;
		transition: border-color 0.15s, box-shadow 0.15s;
	}
	.char-card:hover {
		border-color: var(--accent);
		box-shadow: 0 2px 8px var(--shadow);
	}
	.char-main {
		font-size: 32px;
		font-weight: 600;
		color: var(--text-primary);
		font-family: "Noto Serif TC", "Noto Serif SC", "Noto Serif JP", serif;
		line-height: 1.1;
	}
	.char-alt {
		font-size: var(--font-size-caption1);
		color: var(--text-muted);
		margin-top: 2px;
	}
	.char-label {
		font-size: var(--font-size-caption1);
		color: var(--text-tertiary);
		margin-top: 4px;
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
		font-family: "Noto Serif TC", "Noto Serif SC", "Noto Serif JP", serif;
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
		font-family: "Noto Serif TC", "Noto Serif SC", "Noto Serif JP", serif;
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
		font-family: "Noto Serif TC", "Noto Serif SC", "Noto Serif JP", serif;
	}
	.conj-arrow {
		color: var(--text-muted);
		font-size: var(--font-size-caption1);
	}
	.conj-base {
		font-size: var(--font-size-callout);
		color: var(--text-primary);
		font-family: "Noto Serif TC", "Noto Serif SC", "Noto Serif JP", serif;
	}
	.conj-label {
		font-size: var(--font-size-caption1);
		color: var(--text-muted);
		margin-left: auto;
	}

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
		.char-grid {
			grid-template-columns: repeat(4, 1fr);
			gap: 8px;
		}
		.char-main {
			font-size: 24px;
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
		.char-grid {
			grid-template-columns: repeat(3, 1fr);
		}
		.cat-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
