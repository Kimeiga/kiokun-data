<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import { useSession } from '$lib/auth-client';

	const session = useSession();

	interface ArtifactListItem {
		id: string;
		userId: string;
		title: string;
		description: string | null;
		language: string;
		type: string;
		isPublic: boolean;
		createdAt: string;
		thumbnailUrl: string | null;
		sentenceCount: number;
		user: { id: string; name: string; image: string | null } | null;
	}

	let artifacts = $state<ArtifactListItem[]>([]);
	let loading = $state(true);
	let langFilter = $state('');
	let typeFilter = $state('');
	let visibility = $state(''); // '', 'mine'
	let requestController: AbortController | null = null;

	$effect(() => {
		loadArtifacts();
	});

	async function loadArtifacts() {
		requestController?.abort();
		const controller = new AbortController();
		requestController = controller;
		loading = true;
		try {
			const params = new URLSearchParams();
			if (langFilter) params.set('language', langFilter);
			if (typeFilter) params.set('type', typeFilter);
			if (visibility === 'mine' && $session.data?.user) {
				params.set('visibility', 'mine');
			}
			params.set('limit', '100');

			const resp = await fetch(`/api/artifacts?${params}`, { signal: controller.signal });
			if (resp.ok) {
				artifacts = await resp.json();
			}
		} catch (error) {
			if (!controller.signal.aborted) console.error('Failed to load artifacts', error);
		} finally {
			if (requestController === controller) {
				requestController = null;
				loading = false;
			}
		}
	}

	function langLabel(lang: string): string {
		return lang === 'zh' ? '🇨🇳' : lang === 'ja' ? '🇯🇵' : lang === 'ko' ? '🇰🇷' : lang;
	}

	function typeLabel(type: string): string {
		const labels: Record<string, string> = {
			packaging: '📦 Packaging',
			sign: '🪧 Sign',
			menu: '🍜 Menu',
			book: '📖 Book',
			media: '📺 Media',
			other: '📎 Other',
		};
		return labels[type] || type;
	}

	function typeEmoji(type: string): string {
		const emojis: Record<string, string> = {
			packaging: '📦', sign: '🪧', menu: '🍜', book: '📖', media: '📺', other: '📎',
		};
		return emojis[type] || '📎';
	}

	function timeAgo(dateStr: string): string {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
		if (diffDays === 0) return 'today';
		if (diffDays === 1) return 'yesterday';
		if (diffDays < 30) return `${diffDays}d ago`;
		const diffMonths = Math.floor(diffDays / 30);
		if (diffMonths < 12) return `${diffMonths}mo ago`;
		return `${Math.floor(diffMonths / 12)}y ago`;
	}
</script>

<Header currentWord="" />

<main id="main-content" class="page learner-page">
	<div class="page-header learner-intro">
		<div>
			<h1>Artifacts</h1>
			<p class="subtitle">Study words where they actually appear: packaging, signs, menus, books, and media.</p>
		</div>
	</div>
	{#if $session.data?.user}
		<div class="page-action-grid divider-grid mobile-full-bleed">
			<a href="/artifacts/new" class="create-btn divider-cell">+ New Artifact</a>
		</div>
	{/if}

	<!-- Filters -->
	<div class="filter-rows">
		<div class="filters segmented-grid mobile-full-bleed" role="group" aria-label="Filter by language">
			<button class="filter-btn segmented-cell" class:active={!langFilter} aria-pressed={!langFilter} onclick={() => langFilter = ''}>All Languages</button>
			<button class="filter-btn segmented-cell" class:active={langFilter === 'zh'} aria-pressed={langFilter === 'zh'} onclick={() => langFilter = 'zh'}>🇨🇳 Chinese</button>
			<button class="filter-btn segmented-cell" class:active={langFilter === 'ja'} aria-pressed={langFilter === 'ja'} onclick={() => langFilter = 'ja'}>🇯🇵 Japanese</button>
			<button class="filter-btn segmented-cell" class:active={langFilter === 'ko'} aria-pressed={langFilter === 'ko'} onclick={() => langFilter = 'ko'}>🇰🇷 Korean</button>
		</div>
		<div class="filters segmented-grid mobile-full-bleed" role="group" aria-label="Filter by artifact type">
			<button class="filter-btn segmented-cell" class:active={!typeFilter} aria-pressed={!typeFilter} onclick={() => typeFilter = ''}>All Types</button>
			<button class="filter-btn segmented-cell" class:active={typeFilter === 'packaging'} aria-pressed={typeFilter === 'packaging'} onclick={() => typeFilter = 'packaging'}>📦 Packaging</button>
			<button class="filter-btn segmented-cell" class:active={typeFilter === 'sign'} aria-pressed={typeFilter === 'sign'} onclick={() => typeFilter = 'sign'}>🪧 Sign</button>
			<button class="filter-btn segmented-cell" class:active={typeFilter === 'menu'} aria-pressed={typeFilter === 'menu'} onclick={() => typeFilter = 'menu'}>🍜 Menu</button>
			<button class="filter-btn segmented-cell" class:active={typeFilter === 'book'} aria-pressed={typeFilter === 'book'} onclick={() => typeFilter = 'book'}>📖 Book</button>
			<button class="filter-btn segmented-cell" class:active={typeFilter === 'media'} aria-pressed={typeFilter === 'media'} onclick={() => typeFilter = 'media'}>📺 Media</button>
			{#if $session.data?.user}
				<button class="filter-btn segmented-cell" class:active={visibility === 'mine'} aria-pressed={visibility === 'mine'} onclick={() => visibility = visibility === 'mine' ? '' : 'mine'}>My Artifacts</button>
			{/if}
		</div>
	</div>

	{#if loading}
		<p class="status" role="status">Loading artifacts…</p>
	{:else if artifacts.length === 0}
		<p class="status">No artifacts yet. {$session.data?.user ? 'Create the first one!' : 'Sign in to create artifacts.'}</p>
	{:else}
		<div class="artifact-grid divider-grid mobile-full-bleed">
			{#each artifacts as artifact (artifact.id)}
				<a href="/artifacts/{artifact.id}" class="artifact-card divider-cell">
					{#if artifact.thumbnailUrl}
						<div class="card-image">
							<img src={artifact.thumbnailUrl} alt="" loading="lazy" decoding="async" />
						</div>
					{:else}
						<div class="card-image card-image-placeholder">
							<span class="placeholder-emoji">{typeEmoji(artifact.type)}</span>
						</div>
					{/if}
					<div class="card-body">
						<div class="card-top">
							<span class="card-lang">{langLabel(artifact.language)}</span>
							<span class="card-type">{typeEmoji(artifact.type)}</span>
							{#if !artifact.isPublic}
								<span class="card-private" title="Private">🔒</span>
							{/if}
						</div>
						<h3 class="card-title">{artifact.title}</h3>
						{#if artifact.description}
							<p class="card-desc">{artifact.description}</p>
						{/if}
						<div class="card-meta">
							<span class="card-sentences">{artifact.sentenceCount} sentence{artifact.sentenceCount !== 1 ? 's' : ''}</span>
							<span class="card-dot">·</span>
							{#if artifact.user}
								<span class="card-author">{artifact.user.name}</span>
								<span class="card-dot">·</span>
							{/if}
							<span class="card-time">{timeAgo(artifact.createdAt)}</span>
						</div>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</main>

<style>
	.page { max-width: var(--content-standard); }
	.page-header { margin-bottom: var(--spacing-xl); }
	.page-header h1 { color: var(--text-primary); margin: 0; }
	.subtitle { font-size: var(--font-size-body); color: var(--text-secondary); margin: var(--spacing-xs) 0 0; }

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
		white-space: nowrap;
	}
	.page-action-grid { grid-template-columns: 1fr; margin-bottom: var(--spacing-sm); }

	.filter-rows { display: flex; flex-direction: column; gap: var(--spacing-sm); margin-bottom: var(--spacing-xl); }
	.filters { align-items: stretch; }
	.filter-btn {
		min-height: 44px;
		padding: var(--spacing-sm) var(--spacing-lg);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-full);
		background: var(--bg-secondary);
		color: var(--text-secondary);
		font-size: var(--font-size-caption1);
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
	}
	.filter-btn.active { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }

	.status { text-align: center; padding: 40px; color: var(--text-secondary); }

	.artifact-grid { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }

	.artifact-card {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		overflow: hidden;
		transition: border-color 0.15s, box-shadow 0.15s;
		text-decoration: none;
		color: inherit;
		display: flex;
		flex-direction: column;
	}

	.card-image {
		width: 100%;
		height: 160px;
		overflow: hidden;
		background: var(--bg-tertiary);
	}
	.card-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.card-image-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.placeholder-emoji { font-size: 3rem; opacity: 0.4; }

	.card-body { padding: var(--spacing-lg); flex: 1; display: flex; flex-direction: column; }
	.card-top { display: flex; align-items: center; gap: var(--spacing-sm); margin-bottom: var(--spacing-sm); }
	.card-lang { font-size: var(--font-size-body); }
	.card-type { font-size: var(--font-size-caption1); }
	.card-private { font-size: var(--font-size-caption1); }

	.card-title {
		font-size: var(--font-size-headline);
		font-weight: 600;
		color: var(--text-primary);
		margin: 0 0 var(--spacing-sm);
		font-family: var(--font-cjk);
	}
	.card-desc {
		font-size: var(--font-size-callout);
		color: var(--text-secondary);
		margin: 0 0 var(--spacing-md);
		line-height: 1.4;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.card-meta {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
		font-size: var(--font-size-caption1);
		color: var(--text-muted);
		margin-top: auto;
	}
	.card-dot { color: var(--border-color); }

	@media (max-width: 768px) {
		.page-header { margin-bottom: 1.25rem; }
		.artifact-grid { grid-template-columns: 1fr; }
	}
</style>
