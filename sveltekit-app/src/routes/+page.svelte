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

	// Character examples - Japanese column
	const japaneseCharacters = [
		{ char: '愛', label: 'Love' },
		{ char: '心', label: 'Heart' },
		{ char: '夢', label: 'Dream' },
		{ char: '空', label: 'Sky' },
		{ char: '花', label: 'Flower' },
		{ char: '雨', label: 'Rain' },
		{ char: '月', label: 'Moon' },
		{ char: '星', label: 'Star' },
		{ char: '海', label: 'Sea' },
		{ char: '山', label: 'Mountain' },
	];

	// Character examples - Chinese column
	const chineseCharacters = [
		{ char: '好', label: 'Good' },
		{ char: '美', label: 'Beautiful' },
		{ char: '龙', label: 'Dragon' },
		{ char: '福', label: 'Fortune' },
		{ char: '春', label: 'Spring' },
		{ char: '风', label: 'Wind' },
		{ char: '云', label: 'Cloud' },
		{ char: '雪', label: 'Snow' },
		{ char: '光', label: 'Light' },
		{ char: '道', label: 'Way/Tao' },
	];

	// Word examples - Japanese column
	const japaneseWords = [
		{ char: '日本', label: 'Japan' },
		{ char: '東京', label: 'Tokyo' },
		{ char: '学校', label: 'School' },
		{ char: '食べる', label: 'To eat' },
		{ char: '可愛い', label: 'Cute' },
		{ char: '勉強', label: 'Study' },
		{ char: '桜', label: 'Cherry blossom' },
		{ char: '侍', label: 'Samurai' },
	];

	// Word examples - Chinese column
	const chineseWords = [
		{ char: '中国', label: 'China' },
		{ char: '北京', label: 'Beijing' },
		{ char: '朋友', label: 'Friend' },
		{ char: '谢谢', label: 'Thank you' },
		{ char: '你好', label: 'Hello' },
		{ char: '学习', label: 'Study' },
		{ char: '电脑', label: 'Computer' },
		{ char: '手机', label: 'Phone' },
	];

	// English search suggestions - expanded
	const searchSuggestions = [
		'beautiful', 'water', 'love', 'eat', 'house', 'big',
		'happy', 'sun', 'mountain', 'friend', 'time', 'new'
	];

	// Category highlights - expanded for grid
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
			<p class="hero-subtitle">Your Unified Chinese & Japanese Dictionary</p>

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

	<!-- Four-Column Layout: JP Chars | CN Chars | JP Words | CN Words -->
	<div class="four-column-grid">
		<div class="column">
			<div class="column-header">
				<span class="flag-small">🇯🇵</span>
				<span>Characters</span>
			</div>
			{#each japaneseCharacters as example}
				<a href="/{example.char}" class="example-chip">
					<span class="example-char">{example.char}</span>
					<span class="example-label">{example.label}</span>
				</a>
			{/each}
		</div>

		<div class="column">
			<div class="column-header">
				<span class="flag-small">🇨🇳</span>
				<span>Characters</span>
			</div>
			{#each chineseCharacters as example}
				<a href="/{example.char}" class="example-chip">
					<span class="example-char">{example.char}</span>
					<span class="example-label">{example.label}</span>
				</a>
			{/each}
		</div>

		<div class="column">
			<div class="column-header">
				<span class="flag-small">🇯🇵</span>
				<span>Words</span>
			</div>
			{#each japaneseWords as example}
				<a href="/{example.char}" class="example-chip">
					<span class="example-char">{example.char}</span>
					<span class="example-label">{example.label}</span>
				</a>
			{/each}
		</div>

		<div class="column">
			<div class="column-header">
				<span class="flag-small">🇨🇳</span>
				<span>Words</span>
			</div>
			{#each chineseWords as example}
				<a href="/{example.char}" class="example-chip">
					<span class="example-char">{example.char}</span>
					<span class="example-label">{example.label}</span>
				</a>
			{/each}
		</div>
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

	/* Four Column Grid Layout */
	.four-column-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 24px;
		margin-top: 30px;
		padding: 0 20px;
	}

	.column {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.column-header {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 14px;
		font-weight: 600;
		color: var(--text-secondary);
		padding-bottom: 10px;
		border-bottom: 1px solid var(--border-color);
		margin-bottom: 4px;
	}

	.flag-small {
		font-size: 16px;
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

	.example-chip {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 14px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 10px;
		text-decoration: none;
		transition: all 0.2s ease;
	}

	.example-chip:hover {
		border-color: var(--accent);
		transform: translateY(-1px);
		box-shadow: 0 2px 8px var(--shadow);
	}

	.example-char {
		font-size: 20px;
		font-weight: 600;
		color: var(--text-primary);
		font-family: "Noto Serif TC", "Noto Serif SC", "Noto Serif JP", "MS Mincho", serif;
	}

	.example-label {
		font-size: 11px;
		color: var(--text-secondary);
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

	/* Responsive Design */
	@media (max-width: 1000px) {
		.four-column-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 20px;
		}
	}

	@media (max-width: 768px) {
		.home-container {
			padding: 0 var(--spacing-lg) 40px;
		}

		.four-column-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: var(--spacing-lg);
			padding: 0;
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

		.column-header {
			font-size: var(--font-size-subhead);
			padding-bottom: var(--spacing-sm);
		}

		.example-chip {
			padding: var(--spacing-sm) var(--spacing-md);
			gap: var(--spacing-sm);
		}

		.example-char {
			font-size: var(--font-size-headline);
		}

		.example-label {
			font-size: var(--font-size-caption2);
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
		.four-column-grid {
			grid-template-columns: 1fr 1fr;
			gap: var(--spacing-md);
		}

		.category-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>

