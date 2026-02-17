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
				<a href="/frequency" class="frequency-btn japanese">
					<span class="flag">🇯🇵</span>
					<span class="btn-text">Japanese Top 1000</span>
				</a>
				<a href="/frequency" class="frequency-btn chinese">
					<span class="flag">🇨🇳</span>
					<span class="btn-text">Chinese Top 1000</span>
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
		border: 2px solid transparent;
	}

	.frequency-btn.japanese {
		background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
		color: white;
	}

	.frequency-btn.chinese {
		background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
		color: white;
	}

	.frequency-btn:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 16px rgba(0,0,0,0.2);
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

