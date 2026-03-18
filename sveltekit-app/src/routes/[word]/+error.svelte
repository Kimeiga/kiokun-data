<script lang="ts">
	import { page } from '$app/stores';
	import Header from '$lib/components/Header.svelte';
	import SentenceBar from '$lib/components/SentenceBar.svelte';
</script>

<Header />
<SentenceBar currentWord={$page.params.word} />

<div class="min-h-[60vh] flex flex-col items-center justify-center px-4">
	<h1 class="text-6xl font-bold text-text-muted mb-4">
		{$page.status}
	</h1>
	<p class="text-xl text-text-secondary mb-8 text-center">
		{$page.error?.message || 'An error occurred'}
	</p>
	<a
		href="/"
		class="px-6 py-3 bg-accent hover:bg-accent/80 text-white rounded-lg transition-colors"
	>
		Go Home
	</a>
</div>

