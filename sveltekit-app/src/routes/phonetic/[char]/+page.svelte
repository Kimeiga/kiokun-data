<script lang="ts">
	import type { PageData } from './$types';
	import Header from '$lib/components/Header.svelte';

	let { data }: { data: PageData } = $props();

	// Group characters by their primary pinyin reading (syllable without tone for grouping)
	let grouped = $derived.by(() => {
		const groups: Record<string, typeof data.characters> = {};
		for (const ch of data.characters) {
			const key = ch.pinyin.length > 0 ? ch.pinyin[0] : 'unknown';
			if (!groups[key]) groups[key] = [];
			groups[key].push(ch);
		}
		// Sort groups by size (largest first), then alphabetically
		const sorted = Object.entries(groups).sort((a, b) => {
			if (a[0] === 'unknown') return 1;
			if (b[0] === 'unknown') return -1;
			return b[1].length - a[1].length || a[0].localeCompare(b[0]);
		});
		return sorted;
	});

	let totalCount = $derived(data.characters.length);
</script>

<Header currentWord={data.component} />

<main class="max-w-3xl mx-auto px-4 py-6">
	<!-- Back link -->
	<a
		href="/{data.component}"
		class="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-accent transition-colors mb-4"
	>
		&larr; Back to {data.component}
	</a>

	<!-- Header section -->
	<div class="text-center mb-8">
		<div class="text-6xl font-serif text-text-primary mb-2">{data.component}</div>
		{#if data.componentGloss}
			<div class="text-lg text-text-secondary">{data.componentGloss}</div>
		{/if}
		<div class="text-sm text-text-tertiary mt-2">
			Phonetic series &middot; {totalCount} character{totalCount !== 1 ? 's' : ''}
		</div>
	</div>

	<!-- Grouped by reading -->
	{#if grouped.length > 0}
		<div class="flex flex-col gap-6">
			{#each grouped as [reading, chars]}
				<div>
					<!-- Reading header -->
					<div class="flex items-center gap-2 mb-2">
						<span
							class="text-sm font-mono px-2 py-0.5 rounded"
							style="color: var(--color-pinyin, var(--accent)); background: var(--bg-secondary); border: 1px solid var(--border-light);"
						>
							{reading === 'unknown' ? 'no reading' : reading}
						</span>
						<span class="text-xs text-text-tertiary">
							{chars.length} character{chars.length !== 1 ? 's' : ''}
						</span>
					</div>

					<!-- Character cards -->
					<div class="flex flex-wrap gap-2">
						{#each chars as ch}
							<a
								href="/{ch.char}"
								class="flex items-center gap-2 px-3 py-2 rounded-lg no-underline transition-all duration-200 hover:scale-105"
								style="background: var(--bg-secondary); border: 1px solid var(--border-light);"
							>
								<span class="text-2xl font-serif" style="color: var(--text-primary);">
									{ch.char}
								</span>
								<div class="flex flex-col">
									{#if ch.pinyin.length > 0}
										<span class="text-xs font-mono" style="color: var(--color-pinyin, var(--accent));">
											{ch.pinyin.join(', ')}
										</span>
									{/if}
									{#if ch.gloss}
										<span class="text-xs" style="color: var(--text-secondary);">
											{ch.gloss}
										</span>
									{/if}
								</div>
							</a>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="text-center py-12 text-text-tertiary">
			No characters found in the phonetic series for {data.component}.
		</div>
	{/if}
</main>
