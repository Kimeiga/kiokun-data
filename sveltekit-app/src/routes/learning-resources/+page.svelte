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
		Learn natural Japanese through real conversations and content from YouTube channels
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

				<!-- Placeholder for future channels -->
				<div class="p-6 bg-bg-secondary border border-border border-dashed rounded-lg opacity-50">
					<div class="flex items-start gap-4">
						<div class="text-4xl">➕</div>
						<div class="flex-1">
							<h3 class="text-xl font-bold mb-2 text-text-primary">More Coming Soon</h3>
							<p class="text-text-secondary">
								Additional Japanese learning resources will be added here
							</p>
						</div>
					</div>
				</div>
			</div>
		</section>

		<!-- Future: Chinese, Korean sections -->
		<section class="opacity-50">
			<h2 class="text-2xl font-bold mb-4 text-text-primary">🇨🇳 Chinese</h2>
			<p class="text-text-secondary">Coming soon...</p>
		</section>

		<section class="opacity-50">
			<h2 class="text-2xl font-bold mb-4 text-text-primary">🇰🇷 Korean</h2>
			<p class="text-text-secondary">Coming soon...</p>
		</section>
	</div>

	<!-- Info Section -->
	<div class="mt-12 p-6 bg-hint-bg border border-hint-border rounded-lg">
		<h3 class="text-lg font-bold mb-2 text-hint-text">💡 How It Works</h3>
		<ul class="space-y-2 text-hint-text">
			<li>• Videos are automatically processed from YouTube channels</li>
			<li>• AI extracts natural slang and colloquial expressions</li>
			<li>• Each word links to the full dictionary entry</li>
			<li>• Learn Japanese as it's actually spoken in real conversations</li>
		</ul>
	</div>
</div>

<style>
	/* Add any custom styles here */
</style>

