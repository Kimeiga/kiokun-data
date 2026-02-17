<script lang="ts">
	import { page } from '$app/stores';
	import Header from '$lib/components/Header.svelte';
	import SentenceBar from '$lib/components/SentenceBar.svelte';
</script>

<Header />
<SentenceBar currentWord={$page.params.word} />

<div class="min-h-[60vh] flex flex-col items-center justify-center px-4">
	<h1 class="text-6xl font-bold text-gray-300 dark:text-gray-600 mb-4">
		{$page.status}
	</h1>
	<p class="text-xl text-gray-600 dark:text-gray-400 mb-8 text-center">
		{$page.error?.message || 'An error occurred'}
	</p>
	<a 
		href="/" 
		class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
	>
		Go Home
	</a>
</div>

