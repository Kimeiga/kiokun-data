<script lang="ts">
	import { useSession } from "$lib/auth-client";
	import Header from "$lib/components/Header.svelte";

	const session = useSession();

	// Define pre-made decks based on frequency lists
	const decks = [
		// Japanese JLPT levels
		{ id: 'jlpt-n5', name: 'JLPT N5', language: 'ja', start: 0, end: 100, description: 'Beginner - ~100 most common words' },
		{ id: 'jlpt-n4', name: 'JLPT N4', language: 'ja', start: 100, end: 300, description: 'Elementary - Words 101-300' },
		{ id: 'jlpt-n3', name: 'JLPT N3', language: 'ja', start: 300, end: 600, description: 'Intermediate - Words 301-600' },
		{ id: 'jlpt-n2', name: 'JLPT N2', language: 'ja', start: 600, end: 850, description: 'Upper Intermediate - Words 601-850' },
		{ id: 'jlpt-n1', name: 'JLPT N1', language: 'ja', start: 850, end: 1000, description: 'Advanced - Words 851-1000' },
		// Chinese HSK levels
		{ id: 'hsk-1', name: 'HSK 1', language: 'zh', start: 0, end: 150, description: 'Beginner - ~150 most common words' },
		{ id: 'hsk-2', name: 'HSK 2', language: 'zh', start: 150, end: 300, description: 'Elementary - Words 151-300' },
		{ id: 'hsk-3', name: 'HSK 3', language: 'zh', start: 300, end: 600, description: 'Intermediate - Words 301-600' },
		{ id: 'hsk-4', name: 'HSK 4', language: 'zh', start: 600, end: 1000, description: 'Upper Intermediate - Words 601-1000' },
		// Korean TOPIK levels
		{ id: 'topik-1', name: 'TOPIK I (1-2)', language: 'ko', start: 0, end: 300, description: 'Beginner - ~300 most common words' },
		{ id: 'topik-2', name: 'TOPIK II (3-4)', language: 'ko', start: 300, end: 700, description: 'Intermediate - Words 301-700' },
		{ id: 'topik-3', name: 'TOPIK II (5-6)', language: 'ko', start: 700, end: 1000, description: 'Advanced - Words 701-1000' },
	];

	let frequencyData: { japanese: any[]; chinese: any[]; korean: any[] } | null = $state(null);
	let loading = $state(true);
	let importing = $state<string | null>(null);
	let importResults = $state<Record<string, { imported: number; skipped: number }>>({});

	async function loadFrequencyData() {
		try {
			const res = await fetch('/frequency_list.json');
			frequencyData = await res.json();
		} catch (err) {
			console.error('Failed to load frequency data:', err);
		} finally {
			loading = false;
		}
	}

	async function importDeck(deck: typeof decks[0]) {
		if (!frequencyData || !$session.data?.user) return;

		importing = deck.id;
		try {
			const langKey = deck.language === 'ja' ? 'japanese' : deck.language === 'zh' ? 'chinese' : 'korean';
			const words = frequencyData[langKey]
				.slice(deck.start, deck.end)
				.map((w: any) => w.word);

			const res = await fetch('/api/study/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ words, language: deck.language }),
			});

			if (res.ok) {
				const result = await res.json();
				importResults[deck.id] = { imported: result.imported, skipped: result.skipped };
			}
		} catch (err) {
			console.error('Failed to import deck:', err);
		} finally {
			importing = null;
		}
	}

	$effect(() => {
		loadFrequencyData();
	});

	const languageFlags: Record<string, string> = { ja: '🇯🇵', zh: '🇨🇳', ko: '🇰🇷' };
	const languageNames: Record<string, string> = { ja: 'Japanese', zh: 'Chinese', ko: 'Korean' };
</script>

<Header currentWord="" />

<main class="min-h-screen bg-base-100 pt-20 pb-10 px-4">
	<div class="max-w-4xl mx-auto">
		<h1 class="text-3xl font-bold mb-2">📚 Study Decks</h1>
		<p class="text-base-content/70 mb-8">Import pre-made vocabulary decks based on frequency lists.</p>

		{#if !$session.data?.user}
			<div class="alert alert-warning">
				<span>Please sign in to import study decks.</span>
			</div>
		{:else if loading}
			<div class="flex justify-center py-12">
				<span class="loading loading-spinner loading-lg"></span>
			</div>
		{:else}
			{#each ['ja', 'zh', 'ko'] as lang}
				<div class="mb-8">
					<h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
						<span class="text-2xl">{languageFlags[lang]}</span>
						{languageNames[lang]}
					</h2>
					<div class="grid gap-4 sm:grid-cols-2">
						{#each decks.filter(d => d.language === lang) as deck}
							<div class="card bg-base-200 shadow-sm">
								<div class="card-body p-4">
									<h3 class="card-title text-lg">{deck.name}</h3>
									<p class="text-sm text-base-content/70">{deck.description}</p>
									<p class="text-xs text-base-content/50">{deck.end - deck.start} words</p>
									<div class="card-actions justify-end mt-2">
										{#if importResults[deck.id]}
											<span class="text-sm text-success">
												✓ {importResults[deck.id].imported} added
												{#if importResults[deck.id].skipped > 0}
													({importResults[deck.id].skipped} already in deck)
												{/if}
											</span>
										{:else}
											<button
												class="btn btn-primary btn-sm"
												onclick={() => importDeck(deck)}
												disabled={importing !== null}
											>
												{#if importing === deck.id}
													<span class="loading loading-spinner loading-xs"></span>
												{:else}
													Import
												{/if}
											</button>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/each}

			<div class="mt-8">
				<a href="/study" class="btn btn-outline">← Back to Study</a>
			</div>
		{/if}
	</div>
</main>

