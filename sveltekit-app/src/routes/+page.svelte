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

	const features = [
		{
			icon: '🇨🇳',
			title: 'Chinese Dictionary',
			description: 'Comprehensive Chinese character and word definitions with pinyin pronunciations'
		},
		{
			icon: '🇯🇵',
			title: 'Japanese Dictionary',
			description: 'Detailed Japanese kanji and word entries with multiple readings and pitch accents'
		},
		{
			icon: '✍️',
			title: 'Stroke Order',
			description: 'Animated stroke order diagrams to help you learn proper character writing'
		},
		{
			icon: '📊',
			title: 'Frequency Data',
			description: 'HSK levels, word frequency rankings from movies, books, and more'
		},
		{
			icon: '🔗',
			title: 'Cross-References',
			description: 'See which words contain a character and where characters appear in other words'
		},
		{
			icon: '🎯',
			title: 'Unified View',
			description: 'View Chinese and Japanese information for the same character side-by-side'
		}
	];

	const examples = [
		{ char: '好', label: 'Good' },
		{ char: '地図', label: 'Map' },
		{ char: '学習', label: 'Study' },
		{ char: '美', label: 'Beautiful' },
		{ char: '日本', label: 'Japan' },
		{ char: '中国', label: 'China' }
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
					autofocus
				/>
				<div class="search-hint">Try: 好, 地図, 学習, or any Chinese/Japanese character</div>
			</div>

			<!-- Example Characters -->
			<div class="examples">
				<span class="examples-label">Quick examples:</span>
				{#each examples as example}
					<a href="/{example.char}" class="example-chip">
						<span class="example-char">{example.char}</span>
						<span class="example-label">{example.label}</span>
					</a>
				{/each}
			</div>
		</div>
	</section>

	<!-- Features Section -->
	<section class="features">
		<h2 class="section-title">Features</h2>
		<div class="features-grid">
			{#each features as feature}
				<div class="feature-card">
					<div class="feature-icon">{feature.icon}</div>
					<h3 class="feature-title">{feature.title}</h3>
					<p class="feature-description">{feature.description}</p>
				</div>
			{/each}
		</div>
	</section>

	<!-- About Section -->
	<section class="about">
		<h2 class="section-title">About Kiokun</h2>
		<div class="about-content">
			<p>
				Kiokun is a comprehensive dictionary that combines Chinese and Japanese language resources
				into a single, unified interface. Whether you're learning Chinese characters (Hanzi) or
				Japanese kanji, Kiokun provides detailed information including:
			</p>
			<ul class="about-list">
				<li>Multiple pronunciations and readings</li>
				<li>Comprehensive definitions and example sentences</li>
				<li>Animated stroke order diagrams</li>
				<li>Frequency rankings from real-world usage</li>
				<li>Cross-references showing character relationships</li>
				<li>Historical character evolution images</li>
			</ul>
			<p>
				Perfect for students, teachers, translators, and anyone interested in Chinese and Japanese
				languages.
			</p>
		</div>
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
		padding: 80px 0 60px;
		text-align: center;
	}

	.hero-content {
		max-width: 800px;
		margin: 0 auto;
	}

	.hero-title {
		font-size: 72px;
		font-weight: 800;
		margin: 0 0 20px;
		line-height: 1.1;
	}

	.gradient-text {
		background: linear-gradient(135deg, var(--accent) 0%, #9b59b6 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.hero-subtitle {
		font-size: 24px;
		color: var(--text-secondary);
		margin: 0 0 40px;
		font-weight: 400;
	}

	/* Search Container */
	.search-container {
		margin: 40px 0;
	}

	.hero-search {
		width: 100%;
		max-width: 600px;
		padding: 20px 30px;
		font-size: 20px;
		border: 2px solid var(--border-color);
		border-radius: 50px;
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-family: 'SimSun', 'MS Mincho', serif;
		transition: all 0.3s ease;
		box-shadow: 0 4px 20px var(--shadow);
	}

	.hero-search:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 4px 30px var(--shadow), 0 0 0 4px var(--accent-light);
		transform: translateY(-2px);
	}

	.hero-search::placeholder {
		color: var(--text-muted);
	}

	.search-hint {
		margin-top: 12px;
		font-size: 14px;
		color: var(--text-muted);
	}

	/* Examples */
	.examples {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		justify-content: center;
		align-items: center;
		margin-top: 30px;
	}

	.examples-label {
		font-size: 14px;
		color: var(--text-secondary);
		font-weight: 600;
	}

	.example-chip {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 20px;
		text-decoration: none;
		transition: all 0.2s ease;
		box-shadow: 0 2px 8px var(--shadow);
	}

	.example-chip:hover {
		background: var(--bg-tertiary);
		border-color: var(--accent);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px var(--shadow);
	}

	.example-char {
		font-size: 20px;
		font-weight: 600;
		color: var(--text-primary);
		font-family: 'SimSun', 'MS Mincho', serif;
	}

	.example-label {
		font-size: 13px;
		color: var(--text-secondary);
	}

	/* Features Section */
	.features {
		padding: 60px 0;
	}

	.section-title {
		font-size: 36px;
		font-weight: 700;
		text-align: center;
		margin: 0 0 40px;
		color: var(--color-heading);
	}

	.features-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 30px;
	}

	.feature-card {
		padding: 30px;
		background: var(--bg-secondary);
		border-radius: 16px;
		border: 1px solid var(--border-color);
		transition: all 0.3s ease;
		box-shadow: 0 2px 10px var(--shadow);
	}

	.feature-card:hover {
		transform: translateY(-4px);
		box-shadow: 0 8px 24px var(--shadow);
		border-color: var(--accent);
	}

	.feature-icon {
		font-size: 48px;
		margin-bottom: 16px;
	}

	.feature-title {
		font-size: 20px;
		font-weight: 600;
		margin: 0 0 12px;
		color: var(--text-primary);
	}

	.feature-description {
		font-size: 15px;
		line-height: 1.6;
		color: var(--text-secondary);
		margin: 0;
	}

	/* About Section */
	.about {
		padding: 60px 0;
	}

	.about-content {
		max-width: 800px;
		margin: 0 auto;
		font-size: 16px;
		line-height: 1.8;
		color: var(--text-secondary);
	}

	.about-content p {
		margin: 0 0 20px;
	}

	.about-list {
		margin: 20px 0;
		padding-left: 24px;
	}

	.about-list li {
		margin: 8px 0;
		color: var(--text-secondary);
	}

	/* Responsive Design */
	@media (max-width: 768px) {
		.hero-title {
			font-size: 48px;
		}

		.hero-subtitle {
			font-size: 18px;
		}

		.hero-search {
			font-size: 16px;
			padding: 16px 24px;
		}

		.section-title {
			font-size: 28px;
		}

		.features-grid {
			grid-template-columns: 1fr;
		}

		.examples {
			flex-direction: column;
		}
	}
</style>

