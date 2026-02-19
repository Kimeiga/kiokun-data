<script lang="ts">
	import Header from "$lib/components/Header.svelte";
	import SpeakButton from "$lib/components/SpeakButton.svelte";
	import { useSession } from "$lib/auth-client";
	import { previewIntervals, formatInterval, type ReviewRating } from "$lib/utils/srs";
	import { goto } from "$app/navigation";

	const session = useSession();

	interface StudyCard {
		id: string;
		word: string;
		language: string;
		easeFactor: number;
		interval: number;
		repetitions: number;
		nextReview: string;
	}

	let cards = $state<StudyCard[]>([]);
	let currentIndex = $state(0);
	let isFlipped = $state(false);
	let isLoading = $state(true);
	let isReviewing = $state(false);
	let error = $state<string | null>(null);
	let sessionComplete = $state(false);
	let reviewedCount = $state(0);
	let totalCardCount = $state<number | null>(null); // Total cards user has (not just due)

	// Current card
	let currentCard = $derived(cards[currentIndex]);

	// Preview intervals for rating buttons
	let intervals = $derived(
		currentCard
			? previewIntervals({
					easeFactor: currentCard.easeFactor,
					interval: currentCard.interval,
					repetitions: currentCard.repetitions,
			  })
			: null
	);

	// Load due cards on mount
	$effect(() => {
		if ($session.data?.user) {
			loadDueCards();
		} else if (!$session.isPending) {
			isLoading = false;
		}
	});

	async function loadDueCards() {
		isLoading = true;
		error = null;
		try {
			// Fetch both due cards and total count in parallel
			const [dueRes, allRes] = await Promise.all([
				fetch("/api/study?due=true"),
				fetch("/api/study")
			]);

			if (!dueRes.ok || !allRes.ok) throw new Error("Failed to load cards");

			const [dueData, allData] = await Promise.all([dueRes.json(), allRes.json()]);

			cards = dueData.cards || [];
			totalCardCount = (allData.cards || []).length;
			currentIndex = 0;
			isFlipped = false;
			sessionComplete = cards.length === 0;
		} catch (e) {
			error = e instanceof Error ? e.message : "Unknown error";
		} finally {
			isLoading = false;
		}
	}

	async function submitReview(rating: ReviewRating) {
		if (!currentCard || isReviewing) return;
		isReviewing = true;

		try {
			const res = await fetch("/api/study/review", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ word: currentCard.word, rating }),
			});

			if (!res.ok) throw new Error("Failed to submit review");

			reviewedCount++;

			// If "again", card stays in session (move to end)
			if (rating === "again") {
				const failedCard = cards[currentIndex];
				cards = [...cards.slice(0, currentIndex), ...cards.slice(currentIndex + 1), failedCard];
			} else {
				// Remove reviewed card
				cards = [...cards.slice(0, currentIndex), ...cards.slice(currentIndex + 1)];
			}

			// Check if session complete
			if (cards.length === 0 || currentIndex >= cards.length) {
				if (cards.length === 0) {
					sessionComplete = true;
				} else {
					currentIndex = 0;
				}
			}

			isFlipped = false;
		} catch (e) {
			error = e instanceof Error ? e.message : "Unknown error";
		} finally {
			isReviewing = false;
		}
	}

	function flipCard() {
		isFlipped = true;
	}

	function handleKeydown(event: KeyboardEvent) {
		// Don't handle if we're not reviewing or if a modifier key is pressed
		if (!currentCard || isReviewing || event.ctrlKey || event.metaKey || event.altKey) return;

		// Space or Enter to flip card
		if ((event.key === ' ' || event.key === 'Enter') && !isFlipped) {
			event.preventDefault();
			flipCard();
			return;
		}

		// Number keys 1-4 to rate (only when flipped)
		if (isFlipped) {
			const ratingMap: Record<string, ReviewRating> = {
				'1': 'again',
				'2': 'hard',
				'3': 'good',
				'4': 'easy',
			};
			const rating = ratingMap[event.key];
			if (rating) {
				event.preventDefault();
				submitReview(rating);
			}
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	<title>Study - Kiokun</title>
</svelte:head>

<Header currentWord="" />

<div class="max-w-2xl mx-auto px-4 py-8">
	<div class="flex items-center justify-between mb-6">
		<h1 class="text-3xl font-bold text-text-primary">📚 Study</h1>
		{#if $session.data?.user}
			<div class="flex gap-2 flex-wrap">
				<a href="/study/cards" class="px-4 py-2 border border-border rounded-lg hover:bg-bg-secondary text-sm">
					📇 My Cards
				</a>
				<a href="/study/stats" class="px-4 py-2 border border-border rounded-lg hover:bg-bg-secondary text-sm">
					📊 Stats
				</a>
				<a href="/study/decks" class="px-4 py-2 border border-border rounded-lg hover:bg-bg-secondary text-sm">
					Import Decks
				</a>
			</div>
		{/if}
	</div>

	{#if !$session.data?.user && !$session.isPending}
		<div class="text-center py-12">
			<p class="text-text-secondary mb-4">Sign in to start studying</p>
			<a href="/" class="text-accent hover:underline">Go to homepage</a>
		</div>
	{:else if isLoading}
		<div class="text-center py-12">
			<div class="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full mx-auto"></div>
			<p class="text-text-secondary mt-4">Loading cards...</p>
		</div>
	{:else if error}
		<div class="text-center py-12">
			<p class="text-red-500 mb-4">{error}</p>
			<button onclick={loadDueCards} class="text-accent hover:underline">Try again</button>
		</div>
	{:else if sessionComplete && totalCardCount === 0}
		<!-- Empty state: User has no cards at all -->
		<div class="text-center py-12">
			<div class="text-6xl mb-4">📚</div>
			<h2 class="text-2xl font-bold text-text-primary mb-2">No Cards Yet!</h2>
			<p class="text-text-secondary mb-6">
				Start building your vocabulary by adding words to your study deck.
			</p>
			<div class="flex gap-4 justify-center flex-wrap">
				<a href="/" class="px-4 py-2 bg-accent text-white rounded-lg hover:opacity-90">Browse Dictionary</a>
				<a href="/study/decks" class="px-4 py-2 border border-border rounded-lg hover:bg-bg-secondary">Import Pre-made Decks</a>
			</div>
			<p class="text-text-tertiary text-sm mt-6">
				💡 Tip: Look up any word and click the ➕ button to add it to your deck
			</p>
		</div>
	{:else if sessionComplete}
		<!-- User has cards but none are due -->
		<div class="text-center py-12">
			<div class="text-6xl mb-4">🎉</div>
			<h2 class="text-2xl font-bold text-text-primary mb-2">All Caught Up!</h2>
			<p class="text-text-secondary mb-6">
				{#if reviewedCount > 0}
					You reviewed {reviewedCount} card{reviewedCount !== 1 ? 's' : ''} today.
				{:else}
					No cards due for review right now. You have {totalCardCount} card{totalCardCount !== 1 ? 's' : ''} in your deck.
				{/if}
			</p>
			<div class="flex gap-4 justify-center flex-wrap">
				<a href="/" class="px-4 py-2 bg-accent text-white rounded-lg hover:opacity-90">Browse Dictionary</a>
				<a href="/study/cards" class="px-4 py-2 border border-border rounded-lg hover:bg-bg-secondary">Manage Cards</a>
				<button onclick={loadDueCards} class="px-4 py-2 border border-border rounded-lg hover:bg-bg-secondary">Refresh</button>
			</div>
		</div>
	{:else if currentCard}
		<!-- Flashcard -->
		<div class="mb-4 text-sm text-text-tertiary">
			Card {currentIndex + 1} of {cards.length} • Reviewed: {reviewedCount}
		</div>

		<!-- Card Container -->
		<div
			class="relative h-64 perspective-1000 cursor-pointer mb-6"
			onclick={flipCard}
			onkeydown={(e) => e.key === ' ' && flipCard()}
			role="button"
			tabindex="0"
		>
			<div
				class="absolute inset-0 transition-transform duration-500 transform-style-3d"
				class:rotate-y-180={isFlipped}
			>
				<!-- Front of card (word) -->
				<div class="absolute inset-0 backface-hidden bg-bg-secondary rounded-2xl shadow-lg border border-border flex flex-col items-center justify-center p-6">
					<div class="absolute top-4 right-4">
						<SpeakButton text={currentCard.word} language={currentCard.language as 'ja' | 'zh' | 'ko'} size="lg" />
					</div>
					<div class="text-6xl md:text-8xl font-cjk font-bold text-text-primary mb-4">
						{currentCard.word}
					</div>
					<div class="text-sm text-text-tertiary">
						{currentCard.language === 'zh' ? '🇨🇳 Chinese' : currentCard.language === 'ja' ? '🇯🇵 Japanese' : '🇰🇷 Korean'}
					</div>
					<div class="absolute bottom-4 text-xs text-text-tertiary">
						Tap to reveal meaning
					</div>
				</div>

				<!-- Back of card (meaning) -->
				<div class="absolute inset-0 backface-hidden rotate-y-180 bg-accent/10 rounded-2xl shadow-lg border border-accent/30 flex flex-col items-center justify-center p-6">
					<div class="absolute top-4 right-4">
						<SpeakButton text={currentCard.word} language={currentCard.language as 'ja' | 'zh' | 'ko'} size="lg" />
					</div>
					<a
						href="/{currentCard.word}"
						class="text-6xl md:text-8xl font-cjk font-bold text-accent hover:underline mb-4"
					>
						{currentCard.word}
					</a>
					<div class="text-lg text-text-secondary text-center">
						View full entry →
					</div>
				</div>
			</div>
		</div>

		<!-- Rating Buttons (only shown when flipped) -->
		{#if isFlipped && intervals}
			<div class="grid grid-cols-4 gap-2">
				<button
					onclick={() => submitReview('again')}
					disabled={isReviewing}
					class="flex flex-col items-center p-3 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors disabled:opacity-50"
				>
					<span class="font-semibold">Again <kbd class="ml-1 px-1 bg-red-200 dark:bg-red-800 rounded text-xs">1</kbd></span>
					<span class="text-xs opacity-70">{intervals.again}</span>
				</button>
				<button
					onclick={() => submitReview('hard')}
					disabled={isReviewing}
					class="flex flex-col items-center p-3 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-800/50 transition-colors disabled:opacity-50"
				>
					<span class="font-semibold">Hard <kbd class="ml-1 px-1 bg-orange-200 dark:bg-orange-800 rounded text-xs">2</kbd></span>
					<span class="text-xs opacity-70">{intervals.hard}</span>
				</button>
				<button
					onclick={() => submitReview('good')}
					disabled={isReviewing}
					class="flex flex-col items-center p-3 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800/50 transition-colors disabled:opacity-50"
				>
					<span class="font-semibold">Good <kbd class="ml-1 px-1 bg-green-200 dark:bg-green-800 rounded text-xs">3</kbd></span>
					<span class="text-xs opacity-70">{intervals.good}</span>
				</button>
				<button
					onclick={() => submitReview('easy')}
					disabled={isReviewing}
					class="flex flex-col items-center p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors disabled:opacity-50"
				>
					<span class="font-semibold">Easy <kbd class="ml-1 px-1 bg-blue-200 dark:bg-blue-800 rounded text-xs">4</kbd></span>
					<span class="text-xs opacity-70">{intervals.easy}</span>
				</button>
			</div>
		{:else}
			<div class="text-center text-text-tertiary">
				<kbd class="px-2 py-1 bg-bg-secondary rounded text-xs">Space</kbd> or tap card to flip
			</div>
		{/if}
	{/if}
</div>

<style>
	.perspective-1000 {
		perspective: 1000px;
	}
	.transform-style-3d {
		transform-style: preserve-3d;
	}
	.backface-hidden {
		backface-visibility: hidden;
	}
	.rotate-y-180 {
		transform: rotateY(180deg);
	}
</style>

