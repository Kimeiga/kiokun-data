<script lang="ts">
	import Header from '$lib/components/Header.svelte';
</script>

<Header currentWord="" />

<main id="main-content" class="learner-page">
	<div class="learner-intro">
		<h1>Learning</h1>
		<p>
			Choose a useful next step: learn from real speech, compare confusing sounds, inspect
			language in context, or review what you have saved.
		</p>
	</div>

	<div class="space-y-6">
		<section id="japanese" class="learning-section">
			<h2 class="section-bar-label mobile-full-bleed">🇯🇵 Japanese</h2>
			<div class="grid gap-4 md:grid-cols-2 divider-grid mobile-full-bleed">
				<a
					href="/learning-resources/japanese/scripting-japan"
					class="learning-card divider-cell block p-6 bg-bg-secondary border border-border rounded-lg"
				>
					<div class="flex items-start gap-4">
						<div class="text-4xl">🎥</div>
						<div class="flex-1">
							<h3 class="text-xl font-bold mb-2 text-text-primary">Scripting Japan</h3>
							<p class="text-text-secondary mb-3">
								Learn natural Japanese through real conversations and street interviews
							</p>
							<div class="flex flex-wrap items-center gap-2 text-sm text-text-tertiary">
								<span class="px-2 py-1 bg-bg-tertiary rounded">YouTube</span>
								<span class="px-2 py-1 bg-bg-tertiary rounded">Street Interviews</span>
								<span class="px-2 py-1 bg-bg-tertiary rounded">Natural Speech</span>
							</div>
						</div>
					</div>
				</a>

				<a
					href="/japanese-emoji"
					class="learning-card divider-cell block p-6 bg-bg-secondary border border-border rounded-lg"
				>
					<div class="flex items-start gap-4">
						<div class="text-4xl">😊</div>
						<div class="flex-1">
							<h3 class="text-xl font-bold mb-2 text-text-primary">Japanese Emoji</h3>
							<p class="text-text-secondary mb-3">
								Decode the Japanese language and culture behind familiar emoji symbols
							</p>
							<div class="flex items-center gap-2 text-sm text-text-tertiary">
								<span class="px-2 py-1 bg-bg-tertiary rounded">Emoji</span>
								<span class="px-2 py-1 bg-bg-tertiary rounded">Signs</span>
								<span class="px-2 py-1 bg-bg-tertiary rounded">Culture</span>
							</div>
						</div>
					</div>
				</a>
			</div>
		</section>

		<section class="learning-section">
			<h2 class="section-bar-label mobile-full-bleed">🔊 Homophones</h2>
			<div class="grid gap-4 md:grid-cols-3 divider-grid mobile-full-bleed">
				<a href="/homophones/japanese" class="learning-card divider-cell block p-5 bg-bg-secondary border border-border rounded-lg">
					<div class="text-2xl mb-2">🇯🇵</div>
					<h3 class="text-lg font-bold mb-1 text-text-primary">Japanese</h3>
					<p class="text-sm text-text-secondary">9,649 word groups with pitch accent patterns</p>
				</a>
				<a href="/homophones/chinese" class="learning-card divider-cell block p-5 bg-bg-secondary border border-border rounded-lg">
					<div class="text-2xl mb-2">🇨🇳</div>
					<h3 class="text-lg font-bold mb-1 text-text-primary">Chinese</h3>
					<p class="text-sm text-text-secondary">5,000 word groups by pinyin pronunciation</p>
				</a>
				<a href="/homophones/korean" class="learning-card divider-cell block p-5 bg-bg-secondary border border-border rounded-lg">
					<div class="text-2xl mb-2">🇰🇷</div>
					<h3 class="text-lg font-bold mb-1 text-text-primary">Korean</h3>
					<p class="text-sm text-text-secondary">585 hanja groups by hangul reading</p>
				</a>
			</div>
		</section>

		<section class="learning-section">
			<h2 class="section-bar-label mobile-full-bleed">📦 Artifacts</h2>
			<div class="divider-grid mobile-full-bleed">
			<a href="/artifacts" class="learning-card divider-cell block p-6 bg-bg-secondary border border-border rounded-lg">
				<h3 class="text-xl font-bold mb-2 text-text-primary">Language in the real world</h3>
				<p class="text-text-secondary">
					Upload photos of real-world text — product packaging, signs, menus — and study the
					vocabulary with an interactive reader. Every word is clickable with dictionary
					definitions.
				</p>
			</a>
			</div>
		</section>

		<section class="learning-section">
			<h2 class="section-bar-label mobile-full-bleed">📚 Study &amp; community</h2>
			<div class="grid gap-4 md:grid-cols-2 divider-grid mobile-full-bleed">
				<a href="/study" class="learning-card divider-cell block p-6 bg-bg-secondary border border-border rounded-lg">
					<div class="flex items-start gap-4">
						<div class="text-4xl">📚</div>
						<div class="flex-1">
							<h3 class="text-xl font-bold mb-2 text-text-primary">Study</h3>
							<p class="text-text-secondary">
								Your spaced-repetition decks, review queue and progress.
							</p>
						</div>
					</div>
				</a>
				<a href="/users" class="learning-card divider-cell block p-6 bg-bg-secondary border border-border rounded-lg">
					<div class="flex items-start gap-4">
						<div class="text-4xl">👥</div>
						<div class="flex-1">
							<h3 class="text-xl font-bold mb-2 text-text-primary">Community</h3>
							<p class="text-text-secondary">
								Other learners, their public notes and shared collections.
							</p>
						</div>
					</div>
				</a>
			</div>
		</section>

		<section class="learning-section">
			<h2 class="section-bar-label mobile-full-bleed">📓 Behind the scenes</h2>
			<div class="divider-grid mobile-full-bleed">
			<a href="/blog" class="learning-card divider-cell block p-6 bg-bg-secondary border border-border rounded-lg">
				<div class="flex items-start gap-4">
					<div class="text-4xl">📓</div>
					<div class="flex-1">
						<h3 class="text-xl font-bold mb-2 text-text-primary">The Kiokun Notebook</h3>
						<p class="text-text-secondary">
							The engineering blog — how Kiokun's cross-CJK dictionary data is built,
							sharded and served, with diagrams throughout.
						</p>
					</div>
				</div>
			</a>
			</div>
		</section>
	</div>
</main>

<style>
	/* The section bar is the divider; a second rule at copy width just reads
	   as a short line floating inside the full-width ruled surfaces. */
	.learning-section + .learning-section {
		margin-top: 2rem;
		padding-top: 2rem;
	}

	.learning-section h2 {
		letter-spacing: -0.015em;
	}

	.learning-card {
		color: inherit;
		text-decoration: none;
		transition: border-color 140ms ease, background-color 140ms ease;
	}

	.learning-card:hover {
		border-color: var(--accent);
		background: var(--surface-hover);
	}

	@media (max-width: 640px) {
		.learning-card {
			padding: 1rem;
		}

		.learning-section + .learning-section {
			margin-top: 1.5rem;
			padding-top: 1.5rem;
		}
	}
</style>
