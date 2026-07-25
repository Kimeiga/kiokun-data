<script lang="ts">
	import Header from '$lib/components/Header.svelte';
</script>

<svelte:head>
	<title>Learning — Kiokun</title>
</svelte:head>

<Header currentWord="" />

<div class="max-w-4xl mx-auto px-4 py-8">
	<h1 class="text-4xl font-bold mb-4 text-text-primary">🎓 Learning</h1>
	<p class="text-lg text-text-secondary mb-8">
		Learn Chinese, Japanese &amp; Korean through real content, example sentences, homophones,
		your study deck, and saved artifacts.
	</p>

	<div class="space-y-6">
		<section>
			<h2 class="text-2xl font-bold mb-4 text-text-primary">🇯🇵 Japanese</h2>
			<div class="grid gap-4 md:grid-cols-2">
				<a
					href="/learning-resources/japanese/scripting-japan"
					class="block p-6 bg-bg-secondary border border-border rounded-lg hover:shadow-lg transition-shadow"
				>
					<div class="flex items-start gap-4">
						<div class="text-4xl">🎥</div>
						<div class="flex-1">
							<h3 class="text-xl font-bold mb-2 text-text-primary">Scripting Japan</h3>
							<p class="text-text-secondary mb-3">
								Learn natural Japanese through real conversations and street interviews
							</p>
							<div class="flex items-center gap-2 text-sm text-text-tertiary">
								<span class="px-2 py-1 bg-bg-tertiary rounded">YouTube</span>
								<span class="px-2 py-1 bg-bg-tertiary rounded">Street Interviews</span>
								<span class="px-2 py-1 bg-bg-tertiary rounded">Natural Speech</span>
							</div>
						</div>
					</div>
				</a>

				<a
					href="/japanese-emoji"
					class="block p-6 bg-bg-secondary border border-border rounded-lg hover:shadow-lg transition-shadow"
				>
					<div class="flex items-start gap-4">
						<div class="text-4xl">😊</div>
						<div class="flex-1">
							<h3 class="text-xl font-bold mb-2 text-text-primary">Japanese Emoji</h3>
							<p class="text-text-secondary mb-3">
								Explore Japanese emoticons (kaomoji) and their meanings
							</p>
							<div class="flex items-center gap-2 text-sm text-text-tertiary">
								<span class="px-2 py-1 bg-bg-tertiary rounded">Kaomoji</span>
								<span class="px-2 py-1 bg-bg-tertiary rounded">Emoticons</span>
								<span class="px-2 py-1 bg-bg-tertiary rounded">Culture</span>
							</div>
						</div>
					</div>
				</a>
			</div>
		</section>

		<section>
			<h2 class="text-2xl font-bold mb-4 text-text-primary">🔊 Homophones</h2>
			<div class="grid gap-4 md:grid-cols-3">
				<a href="/homophones/japanese" class="block p-5 bg-bg-secondary border border-border rounded-lg hover:shadow-lg transition-shadow">
					<div class="text-2xl mb-2">🇯🇵</div>
					<h3 class="text-lg font-bold mb-1 text-text-primary">Japanese</h3>
					<p class="text-sm text-text-secondary">9,649 word groups with pitch accent patterns</p>
				</a>
				<a href="/homophones/chinese" class="block p-5 bg-bg-secondary border border-border rounded-lg hover:shadow-lg transition-shadow">
					<div class="text-2xl mb-2">🇨🇳</div>
					<h3 class="text-lg font-bold mb-1 text-text-primary">Chinese</h3>
					<p class="text-sm text-text-secondary">5,000 word groups by pinyin pronunciation</p>
				</a>
				<a href="/homophones/korean" class="block p-5 bg-bg-secondary border border-border rounded-lg hover:shadow-lg transition-shadow">
					<div class="text-2xl mb-2">🇰🇷</div>
					<h3 class="text-lg font-bold mb-1 text-text-primary">Korean</h3>
					<p class="text-sm text-text-secondary">585 hanja groups by hangul reading</p>
				</a>
			</div>
		</section>

		<section>
			<h2 class="text-2xl font-bold mb-4 text-text-primary">📦 Artifacts</h2>
			<a href="/artifacts" class="block p-6 bg-bg-secondary border border-border rounded-lg hover:shadow-lg transition-shadow">
				<p class="text-text-secondary">
					Upload photos of real-world text — product packaging, signs, menus — and study the
					vocabulary with an interactive reader. Every word is clickable with dictionary
					definitions.
				</p>
			</a>
		</section>

		<section>
			<h2 class="text-2xl font-bold mb-4 text-text-primary">📚 Study &amp; community</h2>
			<div class="grid gap-4 md:grid-cols-2">
				<a href="/study" class="block p-6 bg-bg-secondary border border-border rounded-lg hover:shadow-lg transition-shadow">
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
				<a href="/users" class="block p-6 bg-bg-secondary border border-border rounded-lg hover:shadow-lg transition-shadow">
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

		<section>
			<h2 class="text-2xl font-bold mb-4 text-text-primary">📓 Behind the scenes</h2>
			<a href="/blog" class="block p-6 bg-bg-secondary border border-border rounded-lg hover:shadow-lg transition-shadow">
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
		</section>
	</div>
</div>
