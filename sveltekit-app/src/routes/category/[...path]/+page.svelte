<script lang="ts">
	import type { PageData } from './$types';
	import Header from '$lib/components/Header.svelte';

	let { data }: { data: PageData } = $props();

	// Build the current category name
	let categoryName = $derived(
		data.categoryPath.length > 0 
			? data.categoryPath[data.categoryPath.length - 1] 
			: 'All Categories'
	);

	// Build breadcrumb for navigation
	let breadcrumbs = $derived(
		data.categoryPath.map((cat, i) => ({
			name: cat,
			path: '/category/' + data.categoryPath.slice(0, i + 1).join('/')
		}))
	);
</script>

<Header />

<main class="max-w-4xl mx-auto px-4 py-8">
	<!-- Breadcrumb navigation -->
	<nav class="text-sm text-text-tertiary mb-6 flex items-center gap-2 flex-wrap">
		<a href="/category" class="underline hover:text-accent transition-colors">📂 Categories</a>
		{#each breadcrumbs as crumb}
			<span>→</span>
			<a href={crumb.path} class="underline hover:text-accent transition-colors">{crumb.name}</a>
		{/each}
	</nav>

	<!-- Category title -->
	<h1 class="text-3xl md:text-4xl font-bold text-accent mb-6">{categoryName}</h1>

	<!-- Subcategories -->
	{#if data.subcategories.length > 0}
		<section class="mb-8">
			<h2 class="text-lg font-semibold text-text-secondary mb-4">Subcategories</h2>
			<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
				{#each data.subcategories as subcat}
					<a 
						href="/category/{[...data.categoryPath, subcat].join('/')}"
						class="p-3 rounded-lg bg-card-bg border border-card-border hover:border-accent hover:bg-card-hover transition-colors text-center"
					>
						<span class="text-text-primary font-medium">{subcat}</span>
					</a>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Characters in this category -->
	{#if data.characters.length > 0}
		<section>
			<h2 class="text-lg font-semibold text-text-secondary mb-4">
				Characters ({data.characters.length})
			</h2>
			<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
				{#each data.characters as entry}
					<a 
						href="/{entry.char}"
						class="p-3 rounded-lg bg-card-bg border border-card-border hover:border-accent hover:bg-card-hover transition-colors text-center group"
					>
						<div class="text-3xl font-cjk text-text-primary group-hover:text-accent transition-colors">
							{entry.char}
						</div>
						{#if entry.gloss}
							<div class="text-xs text-text-tertiary mt-1 truncate" title={entry.gloss}>
								{entry.gloss}
							</div>
						{/if}
					</a>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Empty state -->
	{#if data.subcategories.length === 0 && data.characters.length === 0}
		<div class="text-center text-text-tertiary py-12">
			<p>No characters found in this category.</p>
		</div>
	{/if}
</main>
