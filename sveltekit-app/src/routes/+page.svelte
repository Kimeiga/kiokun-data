<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import { navigateOrSearch } from '$lib/utils/search-navigation';

	let searchValue = $state('');

	async function handleSearch(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			const word = searchValue.trim();
			if (word) {
				await navigateOrSearch(word);
			}
		}
	}

	// Shared characters - exist in both Chinese and Japanese
	// Format: { trad, simp?, jp?, label }
	// trad = traditional Chinese (primary display)
	// simp = simplified Chinese (if different from trad)
	// jp = Japanese form (if different from trad, rarely needed)
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
		{ trad: '雪', label: 'Snow' },
		{ trad: '星', label: 'Star' },
		{ trad: '光', label: 'Light' },
		{ trad: '道', label: 'Way' },
	];

	// Shared words - exist in both Chinese and Japanese with similar meanings
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
		{ trad: '家族', label: 'Family' },
		{ trad: '友人', label: 'Friend' },
		{ trad: '感情', label: 'Emotion' },
		{ trad: '希望', label: 'Hope' },
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

	// Conjugated Japanese words (verbs and adjectives)
	const japaneseConjugated = [
		{ word: '食べている', base: '食べる', label: 'eating (progressive)' },
		{ word: '行きました', base: '行く', label: 'went (past)' },
		{ word: '見たい', base: '見る', label: 'want to see' },
		{ word: '高くない', base: '高い', label: 'not expensive' },
		{ word: '美しかった', base: '美しい', label: 'was beautiful' },
		{ word: '静かな', base: '静か', label: 'quiet (adj)' },
	];

	// Conjugated Korean words (verbs and adjectives)
	const koreanConjugated = [
		{ word: '먹고있어요', base: '먹다', label: 'eating (progressive)' },
		{ word: '갔습니다', base: '가다', label: 'went (past)' },
		{ word: '보고싶어요', base: '보다', label: 'want to see' },
		{ word: '예뻐요', base: '예쁘다', label: 'is pretty' },
		{ word: '안녕하세요', base: '안녕하다', label: 'hello (polite)' },
		{ word: '좋아합니다', base: '좋아하다', label: 'like (formal)' },
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
	<title>Kiokun - Chinese & Japanese Dictionary</title>
	<meta
		name="description"
		content="A comprehensive Chinese and Japanese dictionary with stroke order, frequency data, and cross-references."
	/>
</svelte:head>

<Header currentWord="" />

<div class="home-container">
	<!-- Hero Section -->
	<section class="hero">
		<div class="hero-content">
			<h1 class="hero-title">
				<span class="gradient-text">Kiokun</span>
			</h1>
			<p class="hero-subtitle">Discover the shared vocabulary of Chinese & Japanese</p>

			<!-- Search Box -->
			<div class="search-container">
				<input
					type="text"
					class="hero-search"
					placeholder="Search for any character or word..."
					bind:value={searchValue}
					onkeydown={handleSearch}
				/>
				<div class="search-hint">Type any Chinese/Japanese character, word, or English meaning</div>
			</div>
		</div>
	</section>

	<!-- Unified Grid: Words & Characters side by side -->
	<div class="unified-grid">
		<!-- Words Section -->
		<section class="grid-section">
			<h2 class="section-header">Words</h2>
			<div class="card-grid">
				{#each sharedWords as item}
					<a href="/{item.trad}" class="unified-card">
						<span class="card-main">{item.trad}</span>
						{#if item.simp && item.simp !== item.trad}
							<span class="card-variants">{item.simp}</span>
						{/if}
						<span class="card-label">{item.label}</span>
					</a>
				{/each}
			</div>
		</section>

		<!-- Characters Section -->
		<section class="grid-section">
			<h2 class="section-header">Characters</h2>
			<div class="card-grid">
				{#each sharedCharacters as item}
					<a href="/{item.trad}" class="unified-card">
						<span class="card-main">{item.trad}</span>
						{#if item.simp && item.simp !== item.trad}
							<span class="card-variants">{item.simp}</span>
						{/if}
						<span class="card-label">{item.label}</span>
					</a>
				{/each}
			</div>
		</section>
	</div>

	<!-- English Search Section -->
	<section class="explore-section">
		<h2 class="section-title">🔍 Search by English</h2>
		<p class="section-subtitle">Find words by their English meaning</p>
		<div class="examples-grid">
			{#each searchSuggestions as term}
				<a href="/search?q={encodeURIComponent(term)}" class="search-chip">
					{term}
				</a>
			{/each}
		</div>
	</section>

	<!-- Try Sentences Section -->
	<section class="explore-section sentences-section">
		<h2 class="section-title">📝 Try Sentences</h2>
		<p class="section-subtitle">Click a sentence to see each word broken down</p>
		<div class="sentences-grid">
			<div class="sentence-language">
				<span class="lang-flag">🇯🇵</span>
				<div class="sentence-list">
					{#each sampleSentences.japanese as s}
						<button class="sentence-btn" onclick={() => navigateOrSearch(s.text)}>
							<span class="sentence-text">{s.text}</span>
							<span class="sentence-label">{s.label}</span>
						</button>
					{/each}
				</div>
			</div>
			<div class="sentence-language">
				<span class="lang-flag">🇨🇳</span>
				<div class="sentence-list">
					{#each sampleSentences.chinese as s}
						<button class="sentence-btn" onclick={() => navigateOrSearch(s.text)}>
							<span class="sentence-text">{s.text}</span>
							<span class="sentence-label">{s.label}</span>
						</button>
					{/each}
				</div>
			</div>
			<div class="sentence-language">
				<span class="lang-flag">🇰🇷</span>
				<div class="sentence-list">
					{#each sampleSentences.korean as s}
						<button class="sentence-btn" onclick={() => navigateOrSearch(s.text)}>
							<span class="sentence-text">{s.text}</span>
							<span class="sentence-label">{s.label}</span>
						</button>
					{/each}
				</div>
			</div>
		</div>
	</section>

	<!-- Conjugated Words Section -->
	<section class="explore-section conjugation-section">
		<h2 class="section-title">🔄 Conjugated Words</h2>
		<p class="section-subtitle">Try conjugated forms — we'll find the dictionary form</p>
		<div class="conjugation-grid">
			<div class="conjugation-language">
				<h3 class="conj-lang-header"><span class="lang-flag">🇯🇵</span> Japanese</h3>
				<div class="conj-list">
					{#each japaneseConjugated as c}
						<button class="conj-btn" onclick={() => navigateOrSearch(c.word)}>
							<span class="conj-word">{c.word}</span>
							<span class="conj-arrow">→</span>
							<span class="conj-base">{c.base}</span>
							<span class="conj-label">{c.label}</span>
						</button>
					{/each}
				</div>
			</div>
			<div class="conjugation-language">
				<h3 class="conj-lang-header"><span class="lang-flag">🇰🇷</span> Korean</h3>
				<div class="conj-list">
					{#each koreanConjugated as c}
						<button class="conj-btn" onclick={() => navigateOrSearch(c.word)}>
							<span class="conj-word">{c.word}</span>
							<span class="conj-arrow">→</span>
							<span class="conj-base">{c.base}</span>
							<span class="conj-label">{c.label}</span>
						</button>
					{/each}
				</div>
			</div>
		</div>
	</section>

	<!-- Bottom Two-Column Grid -->
	<div class="two-column-grid">
		<!-- Categories Section -->
		<section class="explore-section">
			<h2 class="section-title">📂 Browse by Category</h2>
			<div class="category-grid">
				{#each categoryHighlights as cat}
					<a href={cat.path} class="category-chip">
						<span class="category-icon">{cat.icon}</span>
						<span class="category-name">{cat.name}</span>
					</a>
				{/each}
			</div>
			<a href="/category" class="see-all-link">See all categories →</a>
		</section>

		<!-- Frequency Lists Section -->
		<section class="explore-section frequency-section">
			<h2 class="section-title">📊 Most Common</h2>
			<div class="frequency-buttons">
				<a href="/frequency" class="frequency-btn">
					<span class="flag">🇯🇵</span>
					<span class="btn-text">Japanese Top 1000</span>
				</a>
				<a href="/frequency" class="frequency-btn">
					<span class="flag">🇨🇳</span>
					<span class="btn-text">Chinese Top 1000</span>
				</a>
				<a href="/frequency" class="frequency-btn">
					<span class="flag">🇰🇷</span>
					<span class="btn-text">Korean Top 1000</span>
				</a>
			</div>
		</section>

		<!-- Study Section -->
		<section class="explore-section study-section">
			<h2 class="section-title">📚 Study & Learn</h2>
			<div class="frequency-buttons">
				<a href="/study" class="frequency-btn">
					<span class="flag">🔁</span>
					<span class="btn-text">Flashcard Review (SRS)</span>
				</a>
				<a href="/study/decks" class="frequency-btn">
					<span class="flag">📥</span>
					<span class="btn-text">Import JLPT / HSK / TOPIK Decks</span>
				</a>
			</div>
		</section>
	</div>

	<!-- Japanese Emoji Guide Link -->
	<section class="explore-section emoji-guide-section">
		<a href="/japanese-emoji" class="emoji-guide-link">
			<span class="emoji-icon">🇯🇵</span>
			<div class="emoji-guide-text">
				<h3>Japanese Emoji Guide</h3>
				<p>Learn the meaning of 🈹 🈵 ㊗️ and other Japanese cultural emoji</p>
			</div>
			<span class="arrow">→</span>
		</a>
	</section>
</div>

<style>
	.home-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 20px 60px;
	}

	/* Hero Section */
	.hero {
		padding: 50px 0 30px;
		text-align: center;
	}

	.hero-content {
		max-width: 800px;
		margin: 0 auto;
	}

	.hero-title {
		font-size: 56px;
		font-weight: 800;
		margin: 0 0 12px;
		line-height: 1.1;
	}

	.gradient-text {
		background: linear-gradient(135deg, var(--accent) 0%, #9b59b6 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.hero-subtitle {
		font-size: 18px;
		color: var(--text-secondary);
		margin: 0 0 24px;
		font-weight: 400;
	}

	/* Search Container */
	.search-container {
		margin: 0 auto;
		max-width: 550px;
	}

	.hero-search {
		width: 100%;
		padding: 16px 24px;
		font-size: 16px;
		border: 2px solid var(--border-color);
		border-radius: 50px;
		background: var(--bg-secondary);
		color: var(--text-primary);
		/* Sans-serif by default, CJK for actual typed content handled by browser */
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		transition: all 0.3s ease;
		box-shadow: 0 4px 20px var(--shadow);
	}

	.hero-search:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 4px 30px var(--shadow), 0 0 0 4px var(--accent-light);
	}

	.hero-search::placeholder {
		color: var(--text-muted);
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	.search-hint {
		margin-top: 8px;
		font-size: 12px;
		color: var(--text-muted);
	}

	/* Unified Grid Layout - Words & Characters side by side */
	.unified-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 40px;
		margin-top: 30px;
		padding: 0 20px;
	}

	.grid-section {
		display: flex;
		flex-direction: column;
	}

	.section-header {
		font-size: 18px;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0 0 16px;
		padding-bottom: 12px;
		border-bottom: 2px solid var(--border-color);
		text-align: center;
	}

	.card-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 10px;
	}

	.unified-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		aspect-ratio: 1;
		padding: 8px;
		background: var(--bg-secondary);
		border: 2px solid var(--border-color);
		border-radius: 12px;
		text-decoration: none;
		transition: all 0.2s ease;
		min-height: 80px;
	}

	.unified-card:hover {
		border-color: var(--accent);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px var(--shadow);
		background: var(--bg-tertiary);
	}

	.card-main {
		font-size: 28px;
		font-weight: 600;
		color: var(--text-primary);
		font-family: "Noto Serif TC", "Noto Serif SC", "Noto Serif JP", "MS Mincho", serif;
		line-height: 1.2;
	}

	.card-variants {
		font-size: 14px;
		color: var(--text-muted);
		font-family: "Noto Sans SC", "Noto Sans JP", sans-serif;
		margin-top: 2px;
	}

	.card-label {
		font-size: 10px;
		color: var(--text-secondary);
		margin-top: 4px;
		text-align: center;
		line-height: 1.2;
	}

	/* Two Column Grid Layout */
	.two-column-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 40px;
		margin-top: 20px;
	}

	/* Explore Sections */
	.explore-section {
		padding: 30px 0;
	}

	.section-title {
		font-size: 20px;
		font-weight: 700;
		text-align: center;
		margin: 0 0 16px;
		color: var(--text-primary);
	}

	.section-subtitle {
		text-align: center;
		font-size: 13px;
		color: var(--text-muted);
		margin: 0 0 16px;
	}

	/* Examples Grid */
	.examples-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		justify-content: center;
	}

	/* Search Chips */
	.search-chip {
		padding: 10px 20px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 20px;
		text-decoration: none;
		color: var(--text-primary);
		font-size: 14px;
		transition: all 0.2s ease;
	}

	.search-chip:hover {
		background: var(--accent);
		color: white;
		border-color: var(--accent);
		transform: translateY(-2px);
	}

	/* Sentences Section */
	.sentences-section {
		border-top: 1px solid var(--border-color);
		margin-top: 20px;
		padding-top: 30px;
	}

	.sentences-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 24px;
		margin-top: 16px;
	}

	.sentence-language {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.sentence-language .lang-flag {
		font-size: 24px;
		text-align: center;
	}

	.sentence-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.sentence-btn {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		padding: 12px 16px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 10px;
		cursor: pointer;
		transition: all 0.2s ease;
		text-align: left;
		width: 100%;
	}

	.sentence-btn:hover {
		border-color: var(--accent);
		transform: translateY(-1px);
		box-shadow: 0 2px 8px var(--shadow);
	}

	.sentence-text {
		font-size: 16px;
		color: var(--text-primary);
		font-family: "Noto Sans SC", "Noto Sans JP", "Noto Sans KR", sans-serif;
		line-height: 1.4;
	}

	.sentence-label {
		font-size: 11px;
		color: var(--text-muted);
		margin-top: 4px;
	}

	/* Conjugation Section */
	.conjugation-section {
		border-top: 1px solid var(--border-color);
		margin-top: 20px;
		padding-top: 30px;
	}

	.conjugation-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 40px;
		margin-top: 16px;
	}

	.conjugation-language {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.conj-lang-header {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		font-size: 16px;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
	}

	.conj-lang-header .lang-flag {
		font-size: 20px;
	}

	.conj-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.conj-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s ease;
		width: 100%;
	}

	.conj-btn:hover {
		border-color: var(--accent);
		transform: translateY(-1px);
		box-shadow: 0 2px 8px var(--shadow);
	}

	.conj-word {
		font-size: 16px;
		font-weight: 600;
		color: var(--accent);
		font-family: "Noto Sans SC", "Noto Sans JP", "Noto Sans KR", sans-serif;
	}

	.conj-arrow {
		color: var(--text-muted);
		font-size: 12px;
	}

	.conj-base {
		font-size: 14px;
		color: var(--text-primary);
		font-family: "Noto Sans SC", "Noto Sans JP", "Noto Sans KR", sans-serif;
	}

	.conj-label {
		font-size: 11px;
		color: var(--text-muted);
		margin-left: auto;
	}

	/* Category Grid */
	.category-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 10px;
	}

	.category-chip {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 12px 8px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 10px;
		text-decoration: none;
		transition: all 0.2s ease;
	}

	.category-chip:hover {
		border-color: var(--accent);
		transform: translateY(-1px);
		box-shadow: 0 2px 8px var(--shadow);
	}

	.category-icon {
		font-size: 24px;
	}

	.category-name {
		font-size: 11px;
		font-weight: 500;
		color: var(--text-primary);
		text-align: center;
	}

	.see-all-link {
		display: block;
		text-align: center;
		margin-top: 12px;
		font-size: 13px;
		color: var(--accent);
		text-decoration: none;
	}

	.see-all-link:hover {
		text-decoration: underline;
	}

	/* Frequency Section */
	.frequency-section {
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
	}

	.frequency-buttons {
		display: flex;
		flex-direction: column;
		gap: 12px;
		align-items: stretch;
	}

	.frequency-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 14px 20px;
		border-radius: 10px;
		text-decoration: none;
		font-weight: 600;
		transition: all 0.2s ease;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		color: var(--text-primary);
	}

	.frequency-btn:hover {
		background: var(--accent);
		color: white;
		border-color: var(--accent);
		transform: translateY(-2px);
	}

	.frequency-btn .flag {
		font-size: 18px;
	}

	.frequency-btn .btn-text {
		font-size: 14px;
	}

	/* Emoji Guide Link */
	.emoji-guide-section {
		padding-top: 0;
	}

	.emoji-guide-link {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 20px 24px;
		background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
		border: 2px solid var(--border-color);
		border-radius: 16px;
		text-decoration: none;
		transition: all 0.2s ease;
	}

	.emoji-guide-link:hover {
		border-color: var(--accent);
		transform: translateY(-2px);
		box-shadow: 0 4px 16px var(--shadow);
	}

	.emoji-guide-link .emoji-icon {
		font-size: 32px;
	}

	.emoji-guide-text {
		flex: 1;
	}

	.emoji-guide-text h3 {
		margin: 0 0 4px;
		font-size: 16px;
		font-weight: 600;
		color: var(--text-primary);
	}

	.emoji-guide-text p {
		margin: 0;
		font-size: 13px;
		color: var(--text-secondary);
	}

	.emoji-guide-link .arrow {
		font-size: 20px;
		color: var(--accent);
	}

	/* Responsive Design */
	@media (max-width: 1000px) {
		.unified-grid {
			grid-template-columns: 1fr;
			gap: 30px;
		}

		.card-grid {
			grid-template-columns: repeat(4, 1fr);
		}

		.sentences-grid {
			grid-template-columns: 1fr;
			gap: 20px;
		}

		.conjugation-grid {
			grid-template-columns: 1fr;
			gap: 24px;
		}
	}

	@media (max-width: 768px) {
		.home-container {
			padding: 0 var(--spacing-lg) 40px;
		}

		.unified-grid {
			gap: var(--spacing-xl);
			padding: 0;
		}

		.card-grid {
			grid-template-columns: repeat(4, 1fr);
			gap: 8px;
		}

		.unified-card {
			min-height: 70px;
			padding: 6px;
		}

		.card-main {
			font-size: 22px;
		}

		.card-variants {
			font-size: 12px;
		}

		.card-label {
			font-size: 9px;
		}

		.two-column-grid {
			grid-template-columns: 1fr;
			gap: 0;
		}

		.hero {
			padding: 40px 0 var(--spacing-xl);
		}

		.hero-title {
			font-size: 42px;
		}

		.hero-subtitle {
			font-size: var(--font-size-body);
			margin-bottom: var(--spacing-xl);
		}

		.hero-search {
			font-size: var(--font-size-body);
			padding: var(--spacing-lg) var(--spacing-xl);
		}

		.search-hint {
			font-size: var(--font-size-caption2);
		}

		.section-title {
			font-size: var(--font-size-headline);
		}

		.section-subtitle {
			font-size: var(--font-size-caption1);
		}

		.section-header {
			font-size: 16px;
		}

		.category-grid {
			grid-template-columns: repeat(4, 1fr);
			gap: var(--spacing-sm);
		}

		.category-chip {
			padding: var(--spacing-md) var(--spacing-sm);
		}

		.category-icon {
			font-size: 20px;
		}

		.category-name {
			font-size: var(--font-size-caption2);
		}

		.see-all-link {
			font-size: var(--font-size-caption1);
		}

		.frequency-btn {
			padding: var(--spacing-md) var(--spacing-lg);
		}

		.frequency-btn .flag {
			font-size: var(--font-size-callout);
		}

		.frequency-btn .btn-text {
			font-size: var(--font-size-subhead);
		}
	}

	@media (max-width: 480px) {
		.card-grid {
			grid-template-columns: repeat(4, 1fr);
			gap: 6px;
		}

		.unified-card {
			min-height: 60px;
			padding: 4px;
		}

		.card-main {
			font-size: 18px;
		}

		.card-variants {
			font-size: 10px;
		}

		.card-label {
			font-size: 8px;
		}

		.category-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>

