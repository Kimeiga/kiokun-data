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
	}

	let stats = $state<Stats | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	const languageFlags: Record<string, string> = { ja: '🇯🇵', zh: '🇨🇳', ko: '🇰🇷' };
	const languageNames: Record<string, string> = { ja: 'Japanese', zh: 'Chinese', ko: 'Korean' };

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

<main class="min-h-screen bg-base-100 pt-20 pb-10 px-4">
	<div class="max-w-4xl mx-auto">
		<div class="flex items-center justify-between mb-6">
			<h1 class="text-3xl font-bold">📊 Study Statistics</h1>
			<a href="/study" class="px-4 py-2 border border-border rounded-lg hover:bg-bg-secondary text-sm">
				← Back to Study
			</a>
		</div>

		{#if !$session.data?.user && !$session.isPending}
			<div class="text-center py-12">
				<p class="text-base-content/70 mb-4">Sign in to view your statistics</p>
				<a href="/" class="text-accent hover:underline">Go to homepage</a>
			</div>
		{:else if loading}
			<div class="flex justify-center py-12">
				<span class="loading loading-spinner loading-lg"></span>
			</div>
		{:else if error}
			<div class="text-center py-12">
				<p class="text-red-500 mb-4">{error}</p>
				<button onclick={loadStats} class="text-accent hover:underline">Try again</button>
			</div>
		{:else if stats}
			<!-- Overview Cards -->
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
				<div class="card bg-base-200 shadow-sm">
					<div class="card-body p-4 text-center">
						<div class="text-4xl font-bold text-accent">{stats.totalCards}</div>
						<div class="text-sm text-base-content/70">Total Cards</div>
					</div>
				</div>
				<div class="card bg-base-200 shadow-sm">
					<div class="card-body p-4 text-center">
						<div class="text-4xl font-bold text-warning">{stats.dueToday}</div>
						<div class="text-sm text-base-content/70">Due Today</div>
					</div>
				</div>
				<div class="card bg-base-200 shadow-sm">
					<div class="card-body p-4 text-center">
						<div class="text-4xl font-bold text-success">{stats.streak}</div>
						<div class="text-sm text-base-content/70">Day Streak 🔥</div>
					</div>
				</div>
				<div class="card bg-base-200 shadow-sm">
					<div class="card-body p-4 text-center">
						<div class="text-4xl font-bold text-info">{stats.totalReviews}</div>
						<div class="text-sm text-base-content/70">Total Reviews</div>
					</div>
				</div>
			</div>

			<!-- Card Progress -->
			<div class="card bg-base-200 shadow-sm mb-8">
				<div class="card-body">
					<h2 class="card-title mb-4">Card Progress</h2>
					<div class="flex gap-2 mb-2">
						{#if stats.totalCards > 0}
							<div class="bg-gray-400 h-4 rounded-l" style="width: {(stats.cardsNew / stats.totalCards) * 100}%"></div>
							<div class="bg-blue-500 h-4" style="width: {(stats.cardsLearning / stats.totalCards) * 100}%"></div>
							<div class="bg-green-500 h-4 rounded-r" style="width: {(stats.cardsMature / stats.totalCards) * 100}%"></div>
						{:else}
							<div class="bg-gray-300 h-4 w-full rounded"></div>
						{/if}
					</div>
					<div class="flex gap-4 text-sm">
						<div class="flex items-center gap-2">
							<div class="w-3 h-3 bg-gray-400 rounded"></div>
							<span>New ({stats.cardsNew})</span>
						</div>
						<div class="flex items-center gap-2">
							<div class="w-3 h-3 bg-blue-500 rounded"></div>
							<span>Learning ({stats.cardsLearning})</span>
						</div>
						<div class="flex items-center gap-2">
							<div class="w-3 h-3 bg-green-500 rounded"></div>
							<span>Mature ({stats.cardsMature})</span>
						</div>
					</div>
				</div>
			</div>

			<!-- By Language -->
			<div class="card bg-base-200 shadow-sm mb-8">
				<div class="card-body">
					<h2 class="card-title mb-4">Cards by Language</h2>
					{#if Object.keys(stats.byLanguage).length > 0}
						<div class="grid gap-3 sm:grid-cols-3">
							{#each Object.entries(stats.byLanguage) as [lang, count]}
								<div class="flex items-center gap-3 p-3 bg-base-100 rounded-lg">
									<span class="text-2xl">{languageFlags[lang] || '🌐'}</span>
									<div>
										<div class="font-semibold">{languageNames[lang] || lang}</div>
										<div class="text-sm text-base-content/70">{count} cards</div>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-base-content/70">No cards yet. <a href="/study/decks" class="text-accent hover:underline">Import a deck</a> to get started!</p>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</main>

