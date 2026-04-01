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

	$effect(() => {
		loadArtifacts();
	});

	async function loadArtifacts() {
		loading = true;
		try {
			const params = new URLSearchParams();
			if (langFilter) params.set('language', langFilter);
			if (typeFilter) params.set('type', typeFilter);
			if (visibility === 'mine' && $session.data?.user) {
				params.set('visibility', 'mine');
			}
			params.set('limit', '100');

			const resp = await fetch(`/api/artifacts?${params}`);
			if (resp.ok) {
				artifacts = await resp.json();
			}
		} catch {
			// ignore
		} finally {
			loading = false;
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

<svelte:head>
	<title>Artifacts - Kiokun</title>
</svelte:head>

<Header currentWord="" />

<div class="page">
	<div class="page-header">
		<div>
			<h1>Artifacts</h1>
			<p class="subtitle">Real-world language encounters from packaging, signs, menus, and more</p>
		</div>
		{#if $session.data?.user}
			<a href="/artifacts/new" class="create-btn">+ New Artifact</a>
		{/if}
	</div>

	<!-- Filters -->
	<div class="filter-rows">
		<div class="filters">
			<button class="filter-btn" class:active={!langFilter} onclick={() => { langFilter = ''; loadArtifacts(); }}>All Languages</button>
			<button class="filter-btn" class:active={langFilter === 'zh'} onclick={() => { langFilter = 'zh'; loadArtifacts(); }}>🇨🇳 Chinese</button>
			<button class="filter-btn" class:active={langFilter === 'ja'} onclick={() => { langFilter = 'ja'; loadArtifacts(); }}>🇯🇵 Japanese</button>
			<button class="filter-btn" class:active={langFilter === 'ko'} onclick={() => { langFilter = 'ko'; loadArtifacts(); }}>🇰🇷 Korean</button>
		</div>
		<div class="filters">
			<button class="filter-btn" class:active={!typeFilter} onclick={() => { typeFilter = ''; loadArtifacts(); }}>All Types</button>
			<button class="filter-btn" class:active={typeFilter === 'packaging'} onclick={() => { typeFilter = 'packaging'; loadArtifacts(); }}>📦 Packaging</button>
			<button class="filter-btn" class:active={typeFilter === 'sign'} onclick={() => { typeFilter = 'sign'; loadArtifacts(); }}>🪧 Sign</button>
			<button class="filter-btn" class:active={typeFilter === 'menu'} onclick={() => { typeFilter = 'menu'; loadArtifacts(); }}>🍜 Menu</button>
			<button class="filter-btn" class:active={typeFilter === 'book'} onclick={() => { typeFilter = 'book'; loadArtifacts(); }}>📖 Book</button>
			<button class="filter-btn" class:active={typeFilter === 'media'} onclick={() => { typeFilter = 'media'; loadArtifacts(); }}>📺 Media</button>
			{#if $session.data?.user}
				<span class="filter-separator"></span>
				<button class="filter-btn" class:active={visibility === 'mine'} onclick={() => { visibility = visibility === 'mine' ? '' : 'mine'; loadArtifacts(); }}>My Artifacts</button>
			{/if}
		</div>
	</div>

	{#if loading}
		<p class="status">Loading...</p>
	{:else if artifacts.length === 0}
		<p class="status">No artifacts yet. {$session.data?.user ? 'Create the first one!' : 'Sign in to create artifacts.'}</p>
	{:else}
		<div class="artifact-grid">
			{#each artifacts as artifact (artifact.id)}
				<a href="/artifacts/{artifact.id}" class="artifact-card">
					{#if artifact.thumbnailUrl}
						<div class="card-image">
							<img src={artifact.thumbnailUrl} alt={artifact.title} />
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
</div>

<style>
	.page { max-width: 960px; margin: 0 auto; padding: var(--spacing-xl); }
	.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--spacing-xl); gap: var(--spacing-lg); }
	.page-header h1 { font-size: var(--font-size-title); font-weight: 700; color: var(--text-primary); margin: 0; }
	.subtitle { font-size: var(--font-size-body); color: var(--text-secondary); margin: var(--spacing-xs) 0 0; }

	.create-btn {
		padding: var(--spacing-md) var(--spacing-xl);
		background: var(--accent);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		font-size: var(--font-size-body);
		font-weight: 600;
		text-decoration: none;
		transition: opacity 0.15s;
		white-space: nowrap;
	}
	.create-btn:hover { opacity: 0.9; }

	.filter-rows { display: flex; flex-direction: column; gap: var(--spacing-sm); margin-bottom: var(--spacing-xl); }
	.filters { display: flex; gap: var(--spacing-sm); flex-wrap: wrap; align-items: center; }
	.filter-btn {
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
	.filter-separator { width: 1px; height: 20px; background: var(--border-color); margin: 0 var(--spacing-xs); }

	.status { text-align: center; padding: 40px; color: var(--text-secondary); }

	.artifact-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--spacing-lg); }

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
	.artifact-card:hover { border-color: var(--accent); box-shadow: 0 2px 8px var(--shadow); }

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
		.page-header { flex-direction: column; }
		.artifact-grid { grid-template-columns: 1fr; }
	}
</style>
