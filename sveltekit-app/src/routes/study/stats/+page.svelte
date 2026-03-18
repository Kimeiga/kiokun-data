<script lang="ts">
	import { useSession } from "$lib/auth-client";
	import Header from "$lib/components/Header.svelte";

	const session = useSession();

	interface Stats {
		totalCards: number;
		dueToday: number;
		dueThisWeek: number;
		cardsNew: number;
		cardsLearning: number;
		cardsMature: number;
		byLanguage: Record<string, number>;
		avgEaseFactor: number;
		streak: number;
		totalReviews: number;
		leechCount: number;
		leechWords: string[];
		forecast: number[];
	}

	let stats = $state<Stats | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	const languageFlags: Record<string, string> = { ja: '🇯🇵', zh: '🇨🇳', ko: '🇰🇷' };
	const languageNames: Record<string, string> = { ja: 'Japanese', zh: 'Chinese', ko: 'Korean' };

	const dayLabels = ['Today', 'Tomorrow', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];

	let maxForecast = $derived(stats ? Math.max(...stats.forecast, 1) : 1);

	async function loadStats() {
		if (!$session.data?.user) return;
		loading = true;
		error = null;

		try {
			const res = await fetch('/api/study/stats');
			if (!res.ok) throw new Error('Failed to load stats');
			stats = await res.json();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unknown error';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if ($session.data?.user) {
			loadStats();
		} else if (!$session.isPending) {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Study Statistics - Kiokun</title>
</svelte:head>

<Header currentWord="" />

<div class="max-w-4xl mx-auto px-4 py-8">
	<div class="flex items-center justify-between mb-6">
		<h1 class="text-3xl font-bold text-text-primary">Statistics</h1>
		<a href="/study" class="px-4 py-2 border border-border rounded-lg hover:bg-bg-secondary text-sm">
			Back to Study
		</a>
	</div>

	{#if !$session.data?.user && !$session.isPending}
		<div class="text-center py-12">
			<p class="text-text-secondary mb-4">Sign in to view your statistics</p>
			<a href="/" class="text-accent hover:underline">Go to homepage</a>
		</div>
	{:else if loading}
		<div class="text-center py-12">
			<div class="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full mx-auto"></div>
			<p class="text-text-secondary mt-4">Loading stats...</p>
		</div>
	{:else if error}
		<div class="text-center py-12">
			<p class="text-red-500 mb-4">{error}</p>
			<button onclick={loadStats} class="text-accent hover:underline">Try again</button>
		</div>
	{:else if stats && stats.totalCards === 0}
		<div class="text-center py-12">
			<h2 class="text-2xl font-bold text-text-primary mb-2">No Study Data Yet</h2>
			<p class="text-text-secondary mb-6">
				Start adding words to your study deck to track your progress.
			</p>
			<div class="flex gap-4 justify-center flex-wrap">
				<a href="/" class="px-4 py-2 bg-accent text-white rounded-lg hover:opacity-90">Browse Dictionary</a>
				<a href="/study/decks" class="px-4 py-2 border border-border rounded-lg hover:bg-bg-secondary">Import Pre-made Decks</a>
			</div>
		</div>
	{:else if stats}
		<!-- Overview Cards -->
		<div class="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
			<div class="stat-card">
				<div class="text-3xl font-bold text-accent">{stats.totalCards}</div>
				<div class="text-xs text-text-tertiary">Total Cards</div>
			</div>
			<div class="stat-card">
				<div class="text-3xl font-bold text-orange-400">{stats.dueToday}</div>
				<div class="text-xs text-text-tertiary">Due Today</div>
			</div>
			<div class="stat-card">
				<div class="text-3xl font-bold text-green-400">{stats.streak}</div>
				<div class="text-xs text-text-tertiary">Day Streak</div>
			</div>
			<div class="stat-card">
				<div class="text-3xl font-bold text-blue-400">{stats.totalReviews}</div>
				<div class="text-xs text-text-tertiary">Total Reviews</div>
			</div>
		</div>

		<!-- Card Progress -->
		<div class="section-card mb-6">
			<h2 class="text-lg font-semibold text-text-primary mb-3">Card Progress</h2>
			<div class="flex gap-0.5 mb-3 h-3 rounded-full overflow-hidden">
				{#if stats.totalCards > 0}
					<div class="bg-gray-500" style="width: {(stats.cardsNew / stats.totalCards) * 100}%"></div>
					<div class="bg-blue-500" style="width: {(stats.cardsLearning / stats.totalCards) * 100}%"></div>
					<div class="bg-green-500" style="width: {(stats.cardsMature / stats.totalCards) * 100}%"></div>
				{:else}
					<div class="bg-gray-700 w-full"></div>
				{/if}
			</div>
			<div class="flex gap-4 text-sm text-text-secondary">
				<div class="flex items-center gap-1.5">
					<div class="w-2.5 h-2.5 bg-gray-500 rounded-sm"></div>
					New ({stats.cardsNew})
				</div>
				<div class="flex items-center gap-1.5">
					<div class="w-2.5 h-2.5 bg-blue-500 rounded-sm"></div>
					Learning ({stats.cardsLearning})
				</div>
				<div class="flex items-center gap-1.5">
					<div class="w-2.5 h-2.5 bg-green-500 rounded-sm"></div>
					Mature ({stats.cardsMature})
				</div>
			</div>
		</div>

		<!-- 7-Day Forecast -->
		{#if stats.forecast}
			<div class="section-card mb-6">
				<h2 class="text-lg font-semibold text-text-primary mb-3">7-Day Forecast</h2>
				<div class="flex items-end gap-2 h-24">
					{#each stats.forecast as count, i}
						<div class="flex-1 flex flex-col items-center gap-1">
							<span class="text-xs text-text-tertiary">{count}</span>
							<div
								class="w-full rounded-t transition-[height] duration-300 {i === 0 ? 'bg-accent' : 'bg-accent/60'}"
								style="height: {Math.max((count / maxForecast) * 80, count > 0 ? 4 : 0)}px"
							></div>
							<span class="text-[10px] text-text-tertiary truncate w-full text-center">{dayLabels[i]}</span>
						</div>
					{/each}
				</div>
				<div class="text-xs text-text-tertiary mt-2">
					{stats.dueThisWeek} cards due this week
				</div>
			</div>
		{/if}

		<!-- Leeches -->
		{#if stats.leechCount > 0}
			<div class="section-card mb-6 border-orange-800/30">
				<h2 class="text-lg font-semibold text-orange-300 mb-2">Leeches ({stats.leechCount})</h2>
				<p class="text-sm text-text-tertiary mb-3">
					These cards keep being forgotten. Consider adding mnemonics or studying the full entry.
				</p>
				<div class="flex flex-wrap gap-2">
					{#each stats.leechWords as word}
						<a
							href="/{word}"
							class="px-3 py-1.5 bg-orange-900/20 border border-orange-800/30 rounded-lg text-orange-200 font-cjk text-lg hover:bg-orange-900/40 transition-colors"
						>
							{word}
						</a>
					{/each}
				</div>
			</div>
		{/if}

		<!-- By Language -->
		{#if Object.keys(stats.byLanguage).length > 0}
			<div class="section-card mb-6">
				<h2 class="text-lg font-semibold text-text-primary mb-3">Cards by Language</h2>
				<div class="grid gap-3 sm:grid-cols-3">
					{#each Object.entries(stats.byLanguage) as [lang, count]}
						<div class="flex items-center gap-3 p-3 bg-bg-secondary rounded-lg">
							<span class="text-2xl">{languageFlags[lang] || '🌐'}</span>
							<div>
								<div class="font-semibold text-text-primary">{languageNames[lang] || lang}</div>
								<div class="text-sm text-text-tertiary">{count} cards</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Avg Ease -->
		<div class="section-card">
			<div class="text-sm text-text-tertiary">
				Average ease factor: <span class="text-text-secondary font-mono">{stats.avgEaseFactor}</span>
				<span class="text-text-tertiary ml-1">(2.5 = normal, lower = harder)</span>
			</div>
		</div>
	{/if}
</div>

<style>
	.stat-card {
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		padding: 1rem;
		text-align: center;
	}

	.section-card {
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		padding: 1.25rem;
	}
</style>
