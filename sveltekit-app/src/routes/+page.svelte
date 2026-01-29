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

	// Character examples (single characters)
	const characterExamples = [
		{ char: '好', label: 'Good' },
		{ char: '美', label: 'Beautiful' },
		{ char: '食', label: 'Eat/Food' },
		{ char: '愛', label: 'Love' },
		{ char: '心', label: 'Heart' },
		{ char: '水', label: 'Water' },
		{ char: '火', label: 'Fire' },
		{ char: '木', label: 'Tree' },
	];

	// Word examples (multi-character)
	const wordExamples = [
		{ char: '日本', label: 'Japan 🇯🇵' },
		{ char: '中国', label: 'China 🇨🇳' },
		{ char: '学習', label: 'Study' },
		{ char: '食べる', label: 'To eat' },
		{ char: '朋友', label: 'Friend' },
		{ char: '勉強', label: 'Study' },
		{ char: '地図', label: 'Map' },
		{ char: '可愛い', label: 'Cute' },
	];

	// English search suggestions
	const searchSuggestions = ['beautiful', 'water', 'love', 'eat', 'house', 'big'];

	// Category highlights
	const categoryHighlights = [
		{ name: 'Animals', path: '/category/Nature/Animals', icon: '🐾' },
		{ name: 'Body Parts', path: '/category/Humanity/Body', icon: '🫀' },
		{ name: 'Nature', path: '/category/Nature', icon: '🌿' },
		{ name: 'Numbers', path: '/category/Abstract/Quantity/Numbers', icon: '🔢' },
		{ name: 'Colors', path: '/category/Abstract/Attribute/Color', icon: '🎨' },
		{ name: 'Food', path: '/category/Humanity/Sustenance/Food', icon: '🍜' },
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

	<!-- Characters Section -->
	<section class="explore-section">
		<h2 class="section-title">📝 Characters</h2>
		<div class="examples-grid">
			{#each characterExamples as example}
				<a href="/{example.char}" class="example-chip">
					<span class="example-char">{example.char}</span>
					<span class="example-label">{example.label}</span>
				</a>
			{/each}
		</div>
	</section>

	<!-- Words Section -->
	<section class="explore-section">
		<h2 class="section-title">📖 Words</h2>
		<div class="examples-grid">
			{#each wordExamples as example}
				<a href="/{example.char}" class="example-chip">
					<span class="example-char">{example.char}</span>
					<span class="example-label">{example.label}</span>
				</a>
			{/each}
		</div>
	</section>

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

	<!-- Categories Section -->
	<section class="explore-section">
		<h2 class="section-title">📂 Browse by Category</h2>
		<p class="section-subtitle">Explore characters organized by meaning</p>
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
		<h2 class="section-title">📊 Most Common Words</h2>
		<p class="section-subtitle">Learn the most frequently used words first</p>
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

<style>
	.home-container {
		max-width: 1000px;
		margin: 0 auto;
		padding: 0 20px 60px;
	}

	/* Hero Section */
	.hero {
		padding: 60px 0 40px;
		text-align: center;
	}

	.hero-content {
		max-width: 800px;
		margin: 0 auto;
	}

	.hero-title {
		font-size: 64px;
		font-weight: 800;
		margin: 0 0 16px;
		line-height: 1.1;
	}

	.gradient-text {
		background: linear-gradient(135deg, var(--accent) 0%, #9b59b6 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.hero-subtitle {
		font-size: 20px;
		color: var(--text-secondary);
		margin: 0 0 30px;
		font-weight: 400;
	}

	/* Search Container */
	.search-container {
		margin: 0 auto;
		max-width: 600px;
	}

	.hero-search {
		width: 100%;
		padding: 18px 28px;
		font-size: 18px;
		border: 2px solid var(--border-color);
		border-radius: 50px;
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-family: "Noto Serif TC", "Noto Serif SC", "Noto Serif JP", "MS Mincho", serif;
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
	}

	.search-hint {
		margin-top: 10px;
		font-size: 13px;
		color: var(--text-muted);
	}

	/* Explore Sections */
	.explore-section {
		padding: 40px 0 20px;
	}

	.section-title {
		font-size: 24px;
		font-weight: 700;
		text-align: center;
		margin: 0 0 16px;
		color: var(--text-primary);
	}

	.section-subtitle {
		text-align: center;
		font-size: 14px;
		color: var(--text-muted);
		margin: 0 0 20px;
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
		padding: 10px 16px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		text-decoration: none;
		transition: all 0.2s ease;
	}

	.example-chip:hover {
		background: var(--bg-tertiary);
		border-color: var(--accent);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px var(--shadow);
	}

	.example-char {
		font-size: 22px;
		font-weight: 600;
		color: var(--text-primary);
		font-family: "Noto Serif TC", "Noto Serif SC", "Noto Serif JP", "MS Mincho", serif;
	}

	.example-label {
		font-size: 12px;
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
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 12px;
		max-width: 700px;
		margin: 0 auto;
	}

	.category-chip {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 16px 12px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		text-decoration: none;
		transition: all 0.2s ease;
	}

	.category-chip:hover {
		background: var(--bg-tertiary);
		border-color: var(--accent);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px var(--shadow);
	}

	.category-icon {
		font-size: 28px;
	}

	.category-name {
		font-size: 13px;
		font-weight: 500;
		color: var(--text-primary);
	}

	.see-all-link {
		display: block;
		text-align: center;
		margin-top: 16px;
		font-size: 14px;
		color: var(--accent);
		text-decoration: none;
	}

	.see-all-link:hover {
		text-decoration: underline;
	}

	/* Frequency Section */
	.frequency-section {
		padding-bottom: 40px;
	}

	.frequency-buttons {
		display: flex;
		gap: 16px;
		justify-content: center;
		flex-wrap: wrap;
	}

	.frequency-btn {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 16px 28px;
		border-radius: 12px;
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
		transform: translateY(-3px);
		box-shadow: 0 6px 20px rgba(0,0,0,0.2);
	}

	.frequency-btn .flag {
		font-size: 20px;
	}

	.frequency-btn .btn-text {
		font-size: 15px;
	}

	/* Responsive Design */
	@media (max-width: 768px) {
		.hero-title {
			font-size: 48px;
		}

		.hero-subtitle {
			font-size: 16px;
		}

		.hero-search {
			font-size: 16px;
			padding: 14px 20px;
		}

		.section-title {
			font-size: 20px;
		}

		.examples-grid {
			gap: 8px;
		}

		.example-chip {
			padding: 8px 12px;
		}

		.example-char {
			font-size: 18px;
		}

		.category-grid {
			grid-template-columns: repeat(3, 1fr);
			gap: 8px;
		}

		.category-chip {
			padding: 12px 8px;
		}

		.category-icon {
			font-size: 24px;
		}

		.category-name {
			font-size: 11px;
		}

		.frequency-buttons {
			flex-direction: column;
			align-items: center;
		}

		.frequency-btn {
			width: 100%;
			max-width: 280px;
			justify-content: center;
		}
	}
</style>

