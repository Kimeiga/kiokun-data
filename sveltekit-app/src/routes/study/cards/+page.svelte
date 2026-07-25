<script lang="ts">
	import { useSession } from "$lib/auth-client";
	import Header from "$lib/components/Header.svelte";

	const session = useSession();

	interface StudyCard {
		id: string;
		word: string;
		language: string;
		easeFactor: number;
		interval: number;
		repetitions: number;
		nextReview: string;
		lastReviewed: string | null;
	}

	let cards = $state<StudyCard[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let filterLanguage = $state<string>('all');
	let sortBy = $state<'word' | 'nextReview' | 'interval'>('nextReview');
	let actionLoading = $state<string | null>(null);

	const languageFlags: Record<string, string> = { ja: '🇯🇵', zh: '🇨🇳', ko: '🇰🇷' };

	async function loadCards() {
		if (!$session.data?.user) return;
		loading = true;
		error = null;
		
		try {
			const res = await fetch('/api/study');
			if (!res.ok) throw new Error('Failed to load cards');
			const data = await res.json();
			cards = data.cards || [];
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unknown error';
		} finally {
			loading = false;
		}
	}

	async function resetCard(word: string) {
		actionLoading = word;
		try {
			await fetch('/api/study', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ word, action: 'reset' }),
			});
			await loadCards();
		} finally {
			actionLoading = null;
		}
	}

	async function deleteCard(word: string) {
		if (!confirm(`Delete "${word}" from your study deck?`)) return;
		actionLoading = word;
		try {
			await fetch('/api/study', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ word }),
			});
			cards = cards.filter(c => c.word !== word);
		} finally {
			actionLoading = null;
		}
	}

	$effect(() => {
		if ($session.data?.user) {
			loadCards();
		} else if (!$session.isPending) {
			loading = false;
		}
	});

	let filteredCards = $derived(() => {
		let result = [...cards];
		if (filterLanguage !== 'all') {
			result = result.filter(c => c.language === filterLanguage);
		}
		result.sort((a, b) => {
			if (sortBy === 'word') return a.word.localeCompare(b.word);
			if (sortBy === 'interval') return b.interval - a.interval;
			return new Date(a.nextReview).getTime() - new Date(b.nextReview).getTime();
		});
		return result;
	});

	function formatDate(dateStr: string) {
		const date = new Date(dateStr);
		const now = new Date();
		const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
		if (diffDays <= 0) return 'Due now';
		if (diffDays === 1) return 'Tomorrow';
		if (diffDays < 7) return `In ${diffDays} days`;
		return date.toLocaleDateString();
	}
</script>

<svelte:head>
	<title>My Cards - Kiokun</title>
</svelte:head>

<Header currentWord="" />

<main id="main-content" class="min-h-screen bg-bg-primary pb-10 px-4">
	<div class="max-w-4xl mx-auto">
		<div class="flex items-center justify-between mb-6">
			<h1 class="text-3xl font-bold">📇 My Cards</h1>
			<a href="/study" class="px-4 py-2 border border-border rounded-lg hover:bg-bg-secondary text-sm">
				← Back to Study
			</a>
		</div>

		{#if !$session.data?.user && !$session.isPending}
			<div class="text-center py-12">
				<p class="text-base-content/70 mb-4">Sign in to manage your cards</p>
			</div>
		{:else if loading}
			<div class="flex justify-center py-12">
				<span class="loading loading-spinner loading-lg"></span>
			</div>
		{:else if error}
			<div class="text-center py-12">
				<p class="text-red-500 mb-4">{error}</p>
				<button onclick={loadCards} class="text-accent hover:underline">Try again</button>
			</div>
		{:else}
			<!-- Filters -->
			<div class="flex gap-4 mb-6 flex-wrap">
				<select bind:value={filterLanguage} class="select select-bordered select-sm">
					<option value="all">All Languages</option>
					<option value="ja">🇯🇵 Japanese</option>
					<option value="zh">🇨🇳 Chinese</option>
					<option value="ko">🇰🇷 Korean</option>
				</select>
				<select bind:value={sortBy} class="select select-bordered select-sm">
					<option value="nextReview">Sort by Due Date</option>
					<option value="word">Sort by Word</option>
					<option value="interval">Sort by Interval</option>
				</select>
				<span class="text-sm text-base-content/70 self-center">{filteredCards().length} cards</span>
			</div>

			<!-- Card list -->
			{#if filteredCards().length === 0}
				<div class="text-center py-12">
					<p class="text-base-content/70 mb-4">No cards yet.</p>
					<a href="/study/decks" class="text-accent hover:underline">Import a deck</a> or save words while browsing the dictionary.
				</div>
			{:else}
				<div class="space-y-2">
					{#each filteredCards() as card}
						<div class="flex items-center gap-4 p-3 bg-base-200 rounded-lg">
							<span class="text-xl">{languageFlags[card.language]}</span>
							<a href="/{card.word}" class="font-cjk text-xl hover:text-accent flex-1">{card.word}</a>
							<div class="text-sm text-base-content/70 hidden sm:block">
								<span class="mr-4">{formatDate(card.nextReview)}</span>
								<span class="text-xs">({card.interval}d interval)</span>
							</div>
							<div class="flex gap-1">
								<button
									onclick={() => resetCard(card.word)}
									disabled={actionLoading === card.word}
									class="btn btn-xs btn-ghost"
									title="Reset progress"
								>
									{#if actionLoading === card.word}
										<span class="loading loading-spinner loading-xs"></span>
									{:else}
										🔄
									{/if}
								</button>
								<button
									onclick={() => deleteCard(card.word)}
									disabled={actionLoading === card.word}
									class="btn btn-xs btn-ghost text-red-500"
									title="Delete card"
								>
									🗑️
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</main>
