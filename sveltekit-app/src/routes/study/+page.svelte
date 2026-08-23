<script lang="ts">
	import Header from "$lib/components/Header.svelte";
	import SpeakButton from "$lib/components/SpeakButton.svelte";
	import { useSession } from "$lib/auth-client";
	import { previewIntervals, formatInterval, type ReviewRating } from "$lib/utils/srs";
	import { goto } from "$app/navigation";
	import { page } from "$app/stores";
	import { getDictionaryUrl } from "$lib/shard-utils";
	import { dev } from "$app/environment";
	import { decompressSync, strFromU8 } from "fflate";
	import type { DictionaryEntry } from "$lib/types";

	const session = useSession();

	interface StudyCard {
		id: string;
		word: string;
		language: string;
		easeFactor: number;
		interval: number;
		repetitions: number;
		nextReview: string;
		context: {
			sentence: string;
			translation: string | null;
			language: string;
		} | null;
	}

	interface CardInfo {
		pronunciation?: string;
		definition?: string;
		example?: string;
		exampleTranslation?: string;
		equation?: string; // e.g., "口 mouth + 自 one grain = 食 food"
		userNote?: string; // user's mnemonic note
	}

	let cards = $state<StudyCard[]>([]);
	let currentIndex = $state(0);
	let isFlipped = $state(false);
	let isLoading = $state(true);
	let isReviewing = $state(false);
	let error = $state<string | null>(null);
	let sessionComplete = $state(false);
	let reviewedCount = $state(0);
	let totalCardCount = $state<number | null>(null);
	let deckCounts = $state<Record<string, number>>({
		all: 0,
		'searched-words': 0,
		'searched-sentences': 0,
	});
	let selectedDeck = $derived.by(() => {
		const requested = $page.url.searchParams.get('deck');
		return requested === 'searched-words' || requested === 'searched-sentences'
			? requested
			: 'all';
	});
	const deckOptions = [
		{ id: 'all', label: 'All cards', description: 'Study everything together' },
		{ id: 'searched-words', label: 'Searched words', description: 'Entries you opened' },
		{ id: 'searched-sentences', label: 'Searched sentences', description: 'Words from saved sentences' },
	] as const;

	// Cache for dictionary data per word
	let cardInfoCache = $state<Map<string, CardInfo>>(new Map());
	let loadingInfo = $state<Set<string>>(new Set());

	// Current card
	let currentCard = $derived(cards[currentIndex]);
	let currentInfo = $derived(currentCard ? cardInfoCache.get(currentCard.word) : undefined);

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

	// Leech threshold: cards failed many times
	let isLeech = $derived(
		currentCard ? currentCard.repetitions === 0 && currentCard.easeFactor < 200 : false
	);

	// Load due cards on mount
	$effect(() => {
		const deck = selectedDeck;
		if ($session.data?.user) {
			loadDueCards(deck);
		} else if (!$session.isPending) {
			isLoading = false;
		}
	});

	// Prefetch dictionary data when current card changes
	$effect(() => {
		if (currentCard && !cardInfoCache.has(currentCard.word) && !loadingInfo.has(currentCard.word)) {
			fetchCardInfo(currentCard.word, currentCard.language);
		}
		// Also prefetch the next card
		const nextCard = cards[currentIndex + 1];
		if (nextCard && !cardInfoCache.has(nextCard.word) && !loadingInfo.has(nextCard.word)) {
			fetchCardInfo(nextCard.word, nextCard.language);
		}
	});

	async function fetchCardInfo(word: string, language: string) {
		loadingInfo = new Set([...loadingInfo, word]);
		try {
			const url = await getDictionaryUrl(word, dev);
			const response = await fetch(url);
			if (!response.ok) return;

			const compressed = await response.arrayBuffer();
			const decompressed = decompressSync(new Uint8Array(compressed));
			const jsonString = strFromU8(decompressed);
			const entry: DictionaryEntry = JSON.parse(jsonString);

			const info: CardInfo = {};

			if (language === 'zh' && entry.chinese_words?.length > 0) {
				const cw = entry.chinese_words[0];
				const item = cw.items?.[0];
				info.pronunciation = item?.pinyin;
				const defs = item?.definitions;
				if (defs?.length) {
					info.definition = defs.slice(0, 3).join('; ');
				}
			} else if (language === 'ja' && entry.japanese_words?.length > 0) {
				const jw = entry.japanese_words[0];
				const kana = jw.kana?.[0]?.text;
				info.pronunciation = kana;
				const sense = jw.sense?.[0];
				if (sense?.gloss?.length) {
					info.definition = sense.gloss
						.filter(g => g.lang === 'eng')
						.slice(0, 3)
						.map(g => g.text)
						.join('; ');
				}
				// Get example sentence if available
				// Note: data uses "land" not "lang" for the language field
				if (sense?.examples?.length) {
					const ex = sense.examples[0];
					const jpSentence = ex.sentences?.find((s: any) => s.land === 'jpn' || s.lang === 'jpn');
					const engSentence = ex.sentences?.find((s: any) => s.land === 'eng' || s.lang === 'eng');
					info.example = jpSentence?.text || ex.text;
					info.exampleTranslation = engSentence?.text;
				}
			} else if (language === 'ko' && entry.korean_words?.length) {
				const kw = entry.korean_words[0];
				info.pronunciation = kw.hangul;
				if (kw.definitions?.length) {
					info.definition = kw.definitions
						.slice(0, 3)
						.map(d => d.text)
						.join('; ');
				}
				if (kw.examples?.length) {
					info.example = kw.examples[0].korean;
					info.exampleTranslation = kw.examples[0].translation;
				}
			}

			// Also try Chinese fallback for Japanese/Korean characters
			if (!info.definition && entry.chinese_words?.length > 0) {
				const cw = entry.chinese_words[0];
				const item = cw.items?.[0];
				const defs = item?.definitions;
				if (defs?.length) {
					info.definition = defs.slice(0, 3).join('; ');
				}
				if (!info.pronunciation) {
					info.pronunciation = item?.pinyin;
				}
			}

			// Build character equation from components
			if (entry.chinese_char?.components?.length) {
				try {
					const glossResp = await fetch('/game_data/component_glosses.json');
					if (glossResp.ok) {
						const glosses = await glossResp.json();
						const parts = entry.chinese_char.components
							.filter((c: any) => typeof c !== 'string' && c.character)
							.map((c: any) => {
								const g = glosses[c.character] || c.meaning || '';
								return c.character + ' ' + g.replace(/\s*\((trad|simp|jp)\)/gi, '');
							})
							.filter((s: string) => s.trim().length > 2);
						if (parts.length > 0) {
							const targetGloss = glosses[word] || entry.chinese_char.gloss || '';
							info.equation = parts.join(' + ') + ' = ' + word + ' ' + targetGloss.replace(/\s*\((trad|simp|jp)\)/gi, '');
						}
					}
				} catch {}
			}

			// Fetch mnemonic note — prefer user's own, fall back to admin/official
			try {
				const noteResp = await fetch(`/api/notes/${encodeURIComponent(word)}`);
				if (noteResp.ok) {
					const notes = await noteResp.json();
					const myNote = $session.data?.user
						? notes.find((n: any) => n.userId === $session.data?.user?.id)
						: null;
					const adminNote = notes.find((n: any) => n.isAdmin);
					if (myNote) info.userNote = myNote.noteText;
					else if (adminNote) info.userNote = adminNote.noteText;
				}
			} catch {}

			cardInfoCache = new Map([...cardInfoCache, [word, info]]);
		} catch {
			// Silently fail - we'll just show the word without extra info
		} finally {
			const next = new Set(loadingInfo);
			next.delete(word);
			loadingInfo = next;
		}
	}

	async function loadDueCards(deck = selectedDeck) {
		isLoading = true;
		error = null;
		try {
			const deckQuery = deck === 'all' ? '' : `&deck=${encodeURIComponent(deck)}`;
			const [dueRes, allRes] = await Promise.all([
				fetch(`/api/study?due=true${deckQuery}`),
				fetch(`/api/study?due=false${deckQuery}`)
			]);

			if (!dueRes.ok || !allRes.ok) throw new Error("Failed to load cards");

			const [dueData, allData] = await Promise.all([dueRes.json(), allRes.json()]);

			cards = dueData.cards || [];
			totalCardCount = (allData.cards || []).length;
			deckCounts = allData.deckCounts || deckCounts;
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

			if (rating === "again") {
				const failedCard = cards[currentIndex];
				cards = [...cards.slice(0, currentIndex), ...cards.slice(currentIndex + 1), failedCard];
			} else {
				cards = [...cards.slice(0, currentIndex), ...cards.slice(currentIndex + 1)];
			}

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
		if (!currentCard || isReviewing || event.ctrlKey || event.metaKey || event.altKey) return;

		if ((event.key === ' ' || event.key === 'Enter') && !isFlipped) {
			event.preventDefault();
			flipCard();
			return;
		}

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

	function langFlag(lang: string): string {
		return lang === 'zh' ? '🇨🇳 Chinese' : lang === 'ja' ? '🇯🇵 Japanese' : '🇰🇷 Korean';
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	<title>Study - Kiokun</title>
</svelte:head>

<Header currentWord="" />

<main id="main-content" class="max-w-2xl mx-auto px-4 py-8">
	<div class="mb-6">
		<h1 class="text-3xl font-bold text-text-primary">Study</h1>
		{#if $session.data?.user}
			<div class="study-nav divider-grid mobile-full-bleed">
				<a href="/study/cards" class="divider-cell px-4 py-2 text-sm">
					My Cards
				</a>
				<a href="/study/stats" class="divider-cell px-4 py-2 text-sm">
					Stats
				</a>
				<a href="/study/decks" class="divider-cell px-4 py-2 text-sm">
					Import Decks
				</a>
			</div>
		{/if}
	</div>

	{#if $session.data?.user}
		<nav class="deck-filter divider-grid mobile-full-bleed" aria-label="Study deck">
			{#each deckOptions as deck}
				<a
					href={deck.id === 'all' ? '/study' : `/study?deck=${deck.id}`}
					class="divider-cell"
					class:active={selectedDeck === deck.id}
					aria-current={selectedDeck === deck.id ? 'page' : undefined}
				>
					<span class="deck-name">{deck.label}</span>
					<span class="deck-count">{deckCounts[deck.id] || 0}</span>
					<span class="deck-description">{deck.description}</span>
				</a>
			{/each}
		</nav>
	{/if}

	{#if !$session.data?.user && !$session.isPending}
		<div class="text-center py-12">
			<p class="text-text-secondary mb-4">Sign in to start studying</p>
			<a href="/" class="inline-flex min-h-11 items-center text-accent hover:underline">Go to homepage</a>
		</div>
	{:else if isLoading}
		<div class="text-center py-12">
			<div class="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full mx-auto"></div>
			<p class="text-text-secondary mt-4">Loading cards...</p>
		</div>
	{:else if error}
		<div class="text-center py-12">
			<p class="text-red-500 mb-4">{error}</p>
			<button onclick={() => loadDueCards()} class="text-accent hover:underline">Try again</button>
		</div>
	{:else if sessionComplete && totalCardCount === 0}
		<div class="text-center py-12">
			<h2 class="text-2xl font-bold text-text-primary mb-2">No Cards Yet</h2>
			<p class="text-text-secondary mb-6">
				{#if selectedDeck === 'searched-words'}
					Open dictionary entries to build this deck automatically.
				{:else if selectedDeck === 'searched-sentences'}
					Save a sentence to build this deck from its words.
				{:else}
					Start building your vocabulary by adding words to your study deck.
				{/if}
			</p>
			<div class="state-actions divider-grid mobile-full-bleed">
				<a href="/" class="divider-cell px-4 py-2 text-accent">Browse Dictionary</a>
				{#if selectedDeck === 'searched-sentences'}
					<a href="/sentences" class="divider-cell px-4 py-2">Saved Sentences</a>
				{/if}
				<a href="/study/decks" class="divider-cell px-4 py-2">Import Pre-made Decks</a>
			</div>
			<p class="text-text-tertiary text-sm mt-6">
				Look up any word and click the + button to add it to your deck
			</p>
		</div>
	{:else if sessionComplete}
		<div class="text-center py-12">
			<h2 class="text-2xl font-bold text-text-primary mb-2">All Caught Up!</h2>
			<p class="text-text-secondary mb-6">
				{#if reviewedCount > 0}
					You reviewed {reviewedCount} card{reviewedCount !== 1 ? 's' : ''} this session.
				{:else}
					No cards due for review right now. You have {totalCardCount} card{totalCardCount !== 1 ? 's' : ''} in your deck.
				{/if}
			</p>
			<div class="state-actions divider-grid mobile-full-bleed">
				<a href="/" class="divider-cell px-4 py-2 text-accent">Browse Dictionary</a>
				<a href="/study/cards" class="divider-cell px-4 py-2">Manage Cards</a>
				<button onclick={() => loadDueCards()} class="divider-cell px-4 py-2">Refresh</button>
			</div>
		</div>
	{:else if currentCard}
		<!-- Progress bar -->
		<div class="mb-4 flex items-center gap-3">
			<div class="text-sm text-text-tertiary flex-shrink-0">
				{currentIndex + 1}/{cards.length}
			</div>
			<div class="flex-1 h-1.5 bg-bg-secondary rounded-full overflow-hidden">
				<div
					class="h-full bg-accent rounded-full transition-[width] duration-300"
					style="width: {((reviewedCount) / (reviewedCount + cards.length)) * 100}%"
				></div>
			</div>
			<div class="text-sm text-text-tertiary flex-shrink-0">
				{reviewedCount} done
			</div>
		</div>

		<!-- Leech warning -->
		{#if isLeech}
			<div class="mb-3 px-3 py-2 rounded-lg bg-orange-900/20 border border-orange-800/30 text-orange-300 text-sm">
				This card may be a leech — consider adding a mnemonic or breaking it down.
				<a href="/{currentCard.word}" class="underline ml-1">Study entry</a>
			</div>
		{/if}

		<!-- Card Container -->
		<div
			class="card-container cursor-pointer mb-6"
			class:flipped={isFlipped}
			onclick={() => !isFlipped && flipCard()}
			onkeydown={(e) => e.key === ' ' && !isFlipped && flipCard()}
			role="button"
			tabindex="0"
		>
			<div class="card-inner">
				<!-- Front of card (word) -->
				<div class="card-face card-front">
					<div class="absolute top-4 right-4">
						<SpeakButton text={currentCard.word} language={currentCard.language as 'ja' | 'zh' | 'ko'} size="lg" />
					</div>
					<div class="text-6xl md:text-8xl font-cjk font-bold text-text-primary mb-3">
						{currentCard.word}
					</div>
					<div class="text-sm text-text-tertiary">
						{langFlag(currentCard.language)}
					</div>
					<div class="absolute bottom-4 text-xs text-text-tertiary">
						Tap to reveal
					</div>
				</div>

				<!-- Back of card (meaning) -->
				<div class="card-face card-back">
					<div class="absolute top-4 right-4 flex items-center gap-2">
						<SpeakButton text={currentCard.word} language={currentCard.language as 'ja' | 'zh' | 'ko'} size="lg" />
					</div>

					<a
						href="/{currentCard.word}"
						class="text-4xl md:text-5xl font-cjk font-bold text-accent hover:underline mb-2"
					>
						{currentCard.word}
					</a>

					{#if currentInfo}
						{#if currentInfo.pronunciation}
							<div class="text-lg text-text-secondary mb-2 font-mono">
								[{currentInfo.pronunciation}]
							</div>
						{/if}

						{#if currentInfo.definition}
							<div class="text-base text-text-primary text-center leading-relaxed max-w-md px-4">
								{currentInfo.definition}
							</div>
						{/if}

						{#if currentInfo.equation}
							<div class="mt-3 pt-3 border-t border-border/30 text-center max-w-md px-4">
								<div class="text-sm text-text-tertiary font-cjk">
									{currentInfo.equation}
								</div>
							</div>
						{/if}

						{#if currentInfo.userNote}
							<div class="mt-2 pt-2 border-t border-border/30 text-center max-w-md px-4">
								<div class="text-xs text-text-muted uppercase tracking-wider mb-1">Your mnemonic</div>
								<div class="text-sm text-text-secondary italic leading-relaxed">
									{currentInfo.userNote}
								</div>
							</div>
						{/if}

						{#if currentInfo.example}
							<div class="mt-2 pt-2 border-t border-border/30 text-center max-w-md px-4">
								<div class="text-sm font-cjk text-text-secondary">
									{currentInfo.example}
								</div>
								{#if currentInfo.exampleTranslation}
									<div class="text-xs text-text-tertiary mt-1">
										{currentInfo.exampleTranslation}
									</div>
								{/if}
							</div>
						{/if}
					{:else if loadingInfo.has(currentCard.word)}
						<div class="text-sm text-text-tertiary mt-2">Loading...</div>
					{:else}
						<div class="text-sm text-text-secondary mt-2">
							<a href="/{currentCard.word}" class="text-accent hover:underline">View full entry →</a>
						</div>
					{/if}

					{#if currentCard.context}
						<div class="source-context">
							<div class="source-label">From your sentence</div>
							<div class="source-sentence" lang={currentCard.context.language}>
								{currentCard.context.sentence}
							</div>
							{#if currentCard.context.translation}
								<div class="source-translation">{currentCard.context.translation}</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Rating Buttons (only shown when flipped) -->
		{#if isFlipped && intervals}
			<div class="rating-grid divider-grid mobile-full-bleed">
				<button
					onclick={() => submitReview('again')}
					disabled={isReviewing}
					class="rating-btn divider-cell rating-again disabled:opacity-50"
				>
					<span class="font-semibold">Again <kbd class="ml-1 px-1 bg-red-800 rounded text-xs">1</kbd></span>
					<span class="text-xs opacity-70">{intervals.again}</span>
				</button>
				<button
					onclick={() => submitReview('hard')}
					disabled={isReviewing}
					class="rating-btn divider-cell rating-hard disabled:opacity-50"
				>
					<span class="font-semibold">Hard <kbd class="ml-1 px-1 bg-orange-800 rounded text-xs">2</kbd></span>
					<span class="text-xs opacity-70">{intervals.hard}</span>
				</button>
				<button
					onclick={() => submitReview('good')}
					disabled={isReviewing}
					class="rating-btn divider-cell rating-good disabled:opacity-50"
				>
					<span class="font-semibold">Good <kbd class="ml-1 px-1 bg-green-800 rounded text-xs">3</kbd></span>
					<span class="text-xs opacity-70">{intervals.good}</span>
				</button>
				<button
					onclick={() => submitReview('easy')}
					disabled={isReviewing}
					class="rating-btn divider-cell rating-easy disabled:opacity-50"
				>
					<span class="font-semibold">Easy <kbd class="ml-1 px-1 bg-blue-800 rounded text-xs">4</kbd></span>
					<span class="text-xs opacity-70">{intervals.easy}</span>
				</button>
			</div>
		{:else}
			<div class="text-center text-text-tertiary">
				<kbd class="px-2 py-1 bg-bg-secondary rounded text-xs">Space</kbd> or tap card to flip
			</div>
		{/if}
	{/if}
</main>

<style>
	.study-nav,
	.state-actions,
	.rating-grid {
		grid-template-columns: repeat(3, minmax(0, 1fr));
		margin-top: var(--spacing-md);
	}

	.study-nav a,
	.state-actions > :global(*) {
		display: flex;
		min-height: 44px;
		align-items: center;
		justify-content: center;
		text-align: center;
		text-decoration: none;
	}

	.deck-filter {
		grid-template-columns: repeat(3, minmax(0, 1fr));
		margin-bottom: 1.25rem;
	}

	.deck-filter a {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.1rem 0.5rem;
		min-height: 4rem;
		padding: 0.65rem 0.8rem;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-secondary);
		color: var(--text-secondary);
		text-decoration: none;
	}

	.deck-filter a:hover,
	.deck-filter a.active {
		border-color: var(--accent);
	}

	.deck-filter a.active {
		background: var(--accent-light);
		color: var(--accent);
	}

	.deck-name {
		overflow: hidden;
		font-size: var(--font-size-subhead);
		font-weight: 700;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.deck-count {
		font-size: var(--font-size-subhead);
		font-variant-numeric: tabular-nums;
	}

	.deck-description {
		grid-column: 1 / -1;
		color: var(--text-tertiary);
		font-size: var(--font-size-caption2);
		line-height: 1.3;
	}

	.card-container {
		perspective: 1000px;
		height: 23rem;
	}

	.card-inner {
		position: relative;
		width: 100%;
		height: 100%;
		transition: transform 0.5s;
		transform-style: preserve-3d;
	}

	.flipped .card-inner {
		transform: rotateY(180deg);
	}

	.card-face {
		position: absolute;
		inset: 0;
		backface-visibility: hidden;
		border-radius: 1rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		overflow-y: auto;
	}

	.card-front {
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	.card-back {
		background: var(--bg-secondary);
		border: 1px solid var(--accent-dim, var(--border));
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		transform: rotateY(180deg);
	}

	.source-context {
		width: min(100%, 30rem);
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid color-mix(in srgb, var(--border-color) 70%, transparent);
		text-align: center;
	}

	.source-label {
		margin-bottom: 0.25rem;
		color: var(--text-tertiary);
		font-size: var(--font-size-caption2);
		font-weight: 700;
	}

	.source-sentence {
		color: var(--text-primary);
		font-family: var(--font-cjk);
		font-size: var(--font-size-body);
		line-height: 1.45;
	}

	.source-translation {
		margin-top: 0.25rem;
		color: var(--text-tertiary);
		font-size: var(--font-size-caption1);
		line-height: 1.4;
	}

	.rating-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.75rem;
		transition: background-color 0.15s;
		border: none;
		cursor: pointer;
	}

	.rating-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
	.rating-again { color: #fca5a5; }
	.rating-hard { color: #fdba74; }
	.rating-good { color: #86efac; }
	.rating-easy { color: #93c5fd; }

	@media (max-width: 640px) {
		.deck-filter {
			grid-template-columns: 1fr;
		}

		.study-nav,
		.state-actions {
			grid-template-columns: 1fr;
		}

		.card-container {
			height: 21rem;
		}
	}
</style>
