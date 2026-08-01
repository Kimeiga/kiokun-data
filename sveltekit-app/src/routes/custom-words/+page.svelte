<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import { useSession } from '$lib/auth-client';
	import { goto } from '$app/navigation';

	const session = useSession();

	interface CustomWord {
		id: string;
		userId: string;
		word: string;
		language: string;
		simplified?: string;
		traditional?: string;
		pinyin?: string;
		kanji?: string;
		kana?: string;
		hangul?: string;
		hanja?: string;
		partOfSpeech?: string;
		definitions: string;
		createdAt: string;
		user?: { id: string; name: string; image: string | null } | null;
	}

	let words = $state<CustomWord[]>([]);
	let loading = $state(true);
	let langFilter = $state<string>('');
	let showMine = $state(false);

	$effect(() => {
		loadWords();
	});

	async function loadWords() {
		loading = true;
		try {
			const params = new URLSearchParams();
			if (langFilter) params.set('language', langFilter);
			if (showMine && $session.data?.user) params.set('userId', $session.data.user.id);
			params.set('limit', '100');

			const resp = await fetch(`/api/custom-words?${params}`);
			if (resp.ok) {
				words = await resp.json();
			}
		} catch {
			// ignore
		} finally {
			loading = false;
		}
	}

	async function deleteWord(id: string, word: string) {
		if (!confirm(`Delete "${word}"?`)) return;
		try {
			const resp = await fetch(`/api/custom-words/${id}`, { method: 'DELETE' });
			if (resp.ok) {
				words = words.filter(w => w.id !== id);
			}
		} catch {
			// ignore
		}
	}

	function canDelete(cw: CustomWord): boolean {
		const userId = $session.data?.user?.id;
		if (!userId) return false;
		return cw.userId === userId || !!($session.data?.user as any);
		// Note: isAdmin is only available server-side. For simplicity,
		// the API enforces the actual permission check.
	}

	function langLabel(lang: string): string {
		return lang === 'zh' ? '🇨🇳' : lang === 'ja' ? '🇯🇵' : lang === 'ko' ? '🇰🇷' : lang;
	}
</script>

<svelte:head>
	<title>Custom Words - Kiokun</title>
</svelte:head>

<Header currentWord="" />

<main id="main-content" class="page">
	<div class="page-header">
		<h1>Custom Words</h1>
	</div>
	{#if $session.data?.user}
		<div class="page-actions divider-grid mobile-full-bleed">
			<a href="/custom-words/new" class="create-btn divider-cell">+ Create Word</a>
		</div>
	{/if}

	<!-- Filters -->
	<div class="filters segmented-grid mobile-full-bleed">
		<button class="filter-btn segmented-cell" class:active={!langFilter} aria-pressed={!langFilter} onclick={() => { langFilter = ''; loadWords(); }}>All</button>
		<button class="filter-btn segmented-cell" class:active={langFilter === 'zh'} aria-pressed={langFilter === 'zh'} onclick={() => { langFilter = 'zh'; loadWords(); }}>🇨🇳 Chinese</button>
		<button class="filter-btn segmented-cell" class:active={langFilter === 'ja'} aria-pressed={langFilter === 'ja'} onclick={() => { langFilter = 'ja'; loadWords(); }}>🇯🇵 Japanese</button>
		<button class="filter-btn segmented-cell" class:active={langFilter === 'ko'} aria-pressed={langFilter === 'ko'} onclick={() => { langFilter = 'ko'; loadWords(); }}>🇰🇷 Korean</button>
		{#if $session.data?.user}
			<button class="filter-btn segmented-cell" class:active={showMine} aria-pressed={showMine} onclick={() => { showMine = !showMine; loadWords(); }}>My Words</button>
		{/if}
	</div>

	{#if loading}
		<p class="status">Loading...</p>
	{:else if words.length === 0}
		<p class="status">No custom words yet. {$session.data?.user ? 'Be the first to create one!' : 'Sign in to create custom words.'}</p>
	{:else}
		<div class="word-grid divider-grid mobile-full-bleed">
			{#each words as cw (cw.id)}
				{@const defs = typeof cw.definitions === 'string' ? JSON.parse(cw.definitions) : cw.definitions}
				<div class="word-card divider-cell">
					<a href="/{cw.word}" class="word-link">
						<div class="word-top">
							<span class="word-lang">{langLabel(cw.language)}</span>
							<span class="word-text">{cw.word}</span>
							{#if cw.pinyin}<span class="word-reading">[{cw.pinyin}]</span>{/if}
							{#if cw.kana && cw.kana !== cw.word}<span class="word-reading">{cw.kana}</span>{/if}
						</div>
						<div class="word-def">{defs[0]}</div>
					</a>
					<div class="word-meta">
						{#if cw.user}
							<span class="word-author">by {cw.user.name}</span>
						{/if}
						{#if $session.data?.user && cw.userId === $session.data.user.id}
							<button class="delete-btn" onclick={() => deleteWord(cw.id, cw.word)}>Delete</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</main>

<style>
	.page { max-width: 960px; margin: 0 auto; padding: var(--spacing-xl); }
	.page-header { margin-bottom: var(--spacing-xl); }
	.page-header h1 { font-size: var(--font-size-title); font-weight: 700; color: var(--text-primary); margin: 0; }

	.create-btn {
		display: flex;
		min-height: 44px;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-md) var(--spacing-xl);
		color: var(--accent);
		font-size: var(--font-size-body);
		font-weight: 600;
		text-decoration: none;
		transition: opacity 0.15s;
	}
	.page-actions { grid-template-columns: 1fr; margin-bottom: var(--spacing-sm); }

	.filters { margin-bottom: var(--spacing-xl); }
	.filter-btn {
		padding: var(--spacing-sm) var(--spacing-lg);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-full);
		background: var(--bg-secondary);
		color: var(--text-secondary);
		font-size: var(--font-size-callout);
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
	}
	.filter-btn.active { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }

	.status { text-align: center; padding: 40px; color: var(--text-secondary); }

	.word-grid { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }

	.word-card {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		overflow: hidden;
		transition: border-color 0.15s;
	}
	.word-card:hover { border-color: var(--accent); }

	.word-link { display: block; padding: var(--spacing-lg); text-decoration: none; color: inherit; }

	.word-top { display: flex; align-items: baseline; gap: var(--spacing-sm); margin-bottom: var(--spacing-sm); flex-wrap: wrap; }
	.word-lang { font-size: var(--font-size-body); }
	.word-text { font-size: var(--font-size-headline); font-weight: 600; color: var(--text-primary); font-family: var(--font-cjk); }
	.word-reading { font-size: var(--font-size-callout); color: var(--accent); }
	.word-def { font-size: var(--font-size-body); color: var(--text-secondary); line-height: 1.5; }

	.word-meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-sm) var(--spacing-lg);
		border-top: 1px solid var(--border-color);
		font-size: var(--font-size-caption1);
	}
	.word-author { color: var(--text-muted); }

	.delete-btn {
		padding: var(--spacing-xs) var(--spacing-sm);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		background: var(--bg-secondary);
		color: var(--text-muted);
		font-size: var(--font-size-caption1);
		cursor: pointer;
		transition: color 0.15s, border-color 0.15s;
	}
	.delete-btn:hover { color: var(--color-error); border-color: var(--color-error); }

	@media (max-width: 768px) {
		.word-grid { grid-template-columns: 1fr; }
	}
</style>
