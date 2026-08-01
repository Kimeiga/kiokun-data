<script lang="ts">
	import type { PageData } from './$types';
	import Header from '$lib/components/Header.svelte';

	let { data }: { data: PageData } = $props();

	function cleanGloss(gloss: string): string {
		return gloss
			.replace(/\(trad\/jp\)/gi, '🇹🇼🇯🇵')
			.replace(/\(trad\)/gi, '🇹🇼')
			.replace(/\(simp\)/gi, '🇨🇳')
			.replace(/\(jp\)/gi, '🇯🇵')
			.trim();
	}

	// Group characters by their primary pinyin reading
	// Use data.component as a reactive key to ensure regrouping on navigation
	let grouped = $derived.by(() => {
		const _key = data.component; // track for reactivity
		const groups: Record<string, typeof data.characters> = {};
		for (const ch of data.characters) {
			const key = ch.pinyin.length > 0 ? ch.pinyin[0] : 'none';
			if (!groups[key]) groups[key] = [];
			groups[key].push(ch);
		}
		const sorted = Object.entries(groups).sort((a, b) => {
			if (a[0] === 'none') return 1;
			if (b[0] === 'none') return -1;
			return b[1].length - a[1].length || a[0].localeCompare(b[0]);
		});
		return sorted;
	});

	let totalCount = $derived(data.characters.length);
</script>

<Header currentWord={data.component} />

<main id="main-content" class="max-w-3xl mx-auto px-4 py-6">
	<!-- Back link -->
	<a
		href="/{data.component}"
		class="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-accent transition-colors mb-4"
	>
		&larr; Back to {data.component}
	</a>

	<!-- Header section -->
	<div class="text-center mb-8">
		<h1 class="text-6xl font-serif text-text-primary mb-2">
			{data.component}<span class="visually-hidden"> phonetic series</span>
		</h1>
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
					<div class="character-grid divider-grid mobile-full-bleed">
						{#each chars as ch}
							{@const hasEntry = ch.pinyin.length > 0 || ch.gloss}
							{#if hasEntry}
								<a
									href="/{ch.char}"
									class="divider-cell flex items-center gap-2 px-3 py-2 no-underline"
								>
									<span class="text-2xl font-serif" style="color: var(--text-primary);" lang="zh">
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
												{cleanGloss(ch.gloss)}
											</span>
										{/if}
									</div>
								</a>
							{:else}
								<span
									class="divider-cell flex items-center gap-2 px-3 py-2 opacity-40"
									title="No dictionary entry"
								>
									<span class="text-2xl font-serif" style="color: var(--text-primary);" lang="zh">
										{ch.char}
									</span>
								</span>
							{/if}
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

<style>
	.character-grid { grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr)); }

	@media (max-width: 640px) {
		.character-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	}
</style>
