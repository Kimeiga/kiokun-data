<script lang="ts">
	import Header from '$lib/components/Header.svelte';
</script>

<svelte:head>
	<title>Learning Resources - Kiokun</title>
	<meta name="description" content="Learn Japanese through real content from YouTube channels" />
</svelte:head>

<Header currentWord="" />

<div class="max-w-4xl mx-auto px-4 py-8">
	<h1 class="text-4xl font-bold mb-4 text-text-primary">📚 Learning Resources</h1>
	<p class="text-lg text-text-secondary mb-8">
		Learn Chinese, Japanese & Korean through real content, example sentences, and homophones
	</p>

	<!-- Language Categories -->
	<div class="space-y-6">
		<section>
			<h2 class="text-2xl font-bold mb-4 text-text-primary">🇯🇵 Japanese</h2>
			<div class="grid gap-4 md:grid-cols-2">
				<!-- Scripting Japan Card -->
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

				<!-- Japanese Emoji Card -->
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

		<!-- Tools Section -->
		<section>
			<h2 class="text-2xl font-bold mb-4 text-text-primary">🔧 Tools</h2>
			<div class="grid gap-4 md:grid-cols-2">
				<a href="/homophones/japanese" class="block p-6 bg-bg-secondary border border-border rounded-lg hover:shadow-lg transition-shadow">
					<div class="flex items-start gap-4">
						<div class="text-4xl">🇯🇵</div>
						<div class="flex-1">
							<h3 class="text-xl font-bold mb-2 text-text-primary">Japanese Homophones</h3>
							<p class="text-text-secondary mb-3">9,649 groups of words that sound the same, with pitch accent</p>
							<div class="flex items-center gap-2 text-sm text-text-tertiary">
								<span class="px-2 py-1 bg-bg-tertiary rounded">Pitch Accent</span>
								<span class="px-2 py-1 bg-bg-tertiary rounded">9,649 Groups</span>
							</div>
						</div>
					</div>
				</a>
				<a href="/homophones/chinese" class="block p-6 bg-bg-secondary border border-border rounded-lg hover:shadow-lg transition-shadow">
					<div class="flex items-start gap-4">
						<div class="text-4xl">🇨🇳</div>
						<div class="flex-1">
							<h3 class="text-xl font-bold mb-2 text-text-primary">Chinese Homophones</h3>
							<p class="text-text-secondary mb-3">5,000 groups of words sharing the same pinyin pronunciation</p>
							<div class="flex items-center gap-2 text-sm text-text-tertiary">
								<span class="px-2 py-1 bg-bg-tertiary rounded">Pinyin</span>
								<span class="px-2 py-1 bg-bg-tertiary rounded">5,000 Groups</span>
							</div>
						</div>
					</div>
				</a>
				<a href="/homophones/korean" class="block p-6 bg-bg-secondary border border-border rounded-lg hover:shadow-lg transition-shadow">
					<div class="flex items-start gap-4">
						<div class="text-4xl">🇰🇷</div>
						<div class="flex-1">
							<h3 class="text-xl font-bold mb-2 text-text-primary">Korean Homophones</h3>
							<p class="text-text-secondary mb-3">585 groups of hanja sharing the same hangul reading</p>
							<div class="flex items-center gap-2 text-sm text-text-tertiary">
								<span class="px-2 py-1 bg-bg-tertiary rounded">Hanja</span>
								<span class="px-2 py-1 bg-bg-tertiary rounded">585 Groups</span>
							</div>
						</div>
					</div>
				</a>
				<a href="/artifacts" class="block p-6 bg-bg-secondary border border-border rounded-lg hover:shadow-lg transition-shadow">
					<div class="flex items-start gap-4">
						<div class="text-4xl">📦</div>
						<div class="flex-1">
							<h3 class="text-xl font-bold mb-2 text-text-primary">Artifacts</h3>
							<p class="text-text-secondary mb-3">Upload photos of real-world text (packaging, signs, menus) and study the vocabulary</p>
							<div class="flex items-center gap-2 text-sm text-text-tertiary">
								<span class="px-2 py-1 bg-bg-tertiary rounded">Interactive Reader</span>
								<span class="px-2 py-1 bg-bg-tertiary rounded">Image Upload</span>
							</div>
						</div>
					</div>
				</a>
			</div>
		</section>
	</div>

</div>

<style>
	/* Add any custom styles here */
</style>

