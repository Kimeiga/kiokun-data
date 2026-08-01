<script lang="ts">
	import { marked } from 'marked';
	import Header from '$lib/components/Header.svelte';

	interface User {
		id: string;
		name: string;
		image: string | null;
	}

	interface Note {
		id: string;
		userId: string;
		character: string;
		noteText: string;
		isAdmin: boolean;
		createdAt: Date;
		updatedAt: Date;
	}

	interface UserNotesResponse {
		user: User;
		notes: Note[];
		pagination: {
			page: number;
			pageSize: number;
			total: number;
			totalPages: number;
		};
	}

	let { data }: { data: { userId: string } } = $props();

	let userData: User | null = $state(null);
	let notes: Note[] = $state([]);
	let loading = $state(true);
	let error = $state('');
	let searchQuery = $state('');
	let sortBy = $state<'updated' | 'created' | 'character'>('updated');
	let currentPage = $state(1);
	let totalNotes = $state(0);
	let totalPages = $state(1);
	let pageLoading = $state(false);
	let domPurify = $state<typeof import('dompurify').default | null>(null);

	let userId = $derived(data.userId);

	function renderMarkdown(text: string): string {
		const html = marked.parse(text) as string;
		return domPurify?.sanitize(html) ?? '';
	}

	async function loadUserNotes(signal: AbortSignal) {
		try {
			pageLoading = userData !== null;
			loading = userData === null;
			error = '';
			const search = new URLSearchParams({
				page: String(currentPage),
				pageSize: '50',
				sort: sortBy
			});
			if (searchQuery.trim()) search.set('q', searchQuery.trim());
			const response = await fetch(`/api/users/${userId}/notes?${search}`, { signal });

			if (!response.ok) {
				if (response.status === 404) {
					error = 'User not found';
					return;
				}
				throw new Error('Failed to load user notes');
			}

			const data: UserNotesResponse = await response.json();
			if (!domPurify) {
				const { default: DOMPurify } = await import('dompurify');
				domPurify = DOMPurify;
			}
			userData = data.user;
			notes = data.notes;
			currentPage = data.pagination.page;
			totalNotes = data.pagination.total;
			totalPages = data.pagination.totalPages;
		} catch (err) {
			if (err instanceof DOMException && err.name === 'AbortError') return;
			error = 'Failed to load user notes';
			console.error('Error loading user notes:', err);
		} finally {
			loading = false;
			pageLoading = false;
		}
	}

	function updateSearch(event: Event) {
		searchQuery = (event.currentTarget as HTMLInputElement).value;
		currentPage = 1;
	}

	function updateSort(event: Event) {
		sortBy = (event.currentTarget as HTMLSelectElement).value as typeof sortBy;
		currentPage = 1;
	}

	function formatDate(date: Date): string {
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	}

	$effect(() => {
		const activeUserId = userId;
		const query = searchQuery;
		const sort = sortBy;
		const page = currentPage;
		if (!activeUserId || !sort || page < 1) return;

		const controller = new AbortController();
		const timer = window.setTimeout(
			() => void loadUserNotes(controller.signal),
			query.trim() ? 250 : 0
		);

		return () => {
			window.clearTimeout(timer);
			controller.abort();
		};
	});
</script>

<svelte:head>
	<title>{userData ? `${userData.name}'s Notes` : 'User Notes'} - Kiokun</title>
</svelte:head>

<Header currentWord="" />

<main id="main-content" class="user-notes-page">
	<div class="container">
		{#if loading}
			<div class="loading">
				<p>Loading...</p>
			</div>
		{:else if error}
			<div class="error">
				<p>{error}</p>
				<a href="/users" class="back-link">← Back to Users</a>
			</div>
		{:else if userData}
			<div class="user-header">
				<a href="/users" class="back-link">← Back to Users</a>
				<div class="user-profile">
					<div class="user-avatar">
						{#if userData.image}
							<img src={userData.image} alt={userData.name} decoding="async" />
						{:else}
							<div class="avatar-placeholder">
								{userData.name.charAt(0).toUpperCase()}
							</div>
						{/if}
					</div>
					<div class="user-details">
						<h1>{userData.name}</h1>
						<p class="note-count">
							{totalNotes}
							{searchQuery
								? totalNotes === 1
									? 'matching note'
									: 'matching notes'
								: totalNotes === 1
									? 'note'
									: 'notes'}
						</p>
					</div>
				</div>
			</div>

			{#if totalNotes > 0 || searchQuery}
				<div class="controls">
					<label for="profile-note-search" class="visually-hidden">Search this learner's notes</label>
					<input
						id="profile-note-search"
						type="text"
						value={searchQuery}
						oninput={updateSearch}
						placeholder="Search notes..."
						class="search-input"
					/>
					<label for="profile-note-sort" class="visually-hidden">Sort notes</label>
					<select id="profile-note-sort" value={sortBy} onchange={updateSort} class="sort-select">
						<option value="updated">Recently Updated</option>
						<option value="created">Recently Created</option>
						<option value="character">Character</option>
					</select>
				</div>

				<div class="notes-list divider-grid mobile-full-bleed" aria-busy={pageLoading}>
					{#each notes as note}
						<article class="note-item divider-cell">
							<div class="note-header">
								<a class="character" href="/{note.character}" aria-label={`Open ${note.character} in the dictionary`}>
									{note.character}
								</a>
								<span class="date">{formatDate(note.updatedAt)}</span>
							</div>
							<div class="note-content markdown-content">
								{@html renderMarkdown(note.noteText)}
							</div>
						</article>
					{/each}
				</div>

				{#if notes.length === 0}
					<div class="empty">
						<p>No notes match your search</p>
					</div>
				{/if}

				{#if totalPages > 1}
					<nav class="pagination divider-grid mobile-full-bleed" aria-label="Profile notes pages">
						<button
							type="button"
							class="divider-cell"
							disabled={currentPage <= 1 || pageLoading}
							onclick={() => (currentPage -= 1)}
						>
							← Previous
						</button>
						<span aria-live="polite">Page {currentPage} of {totalPages}</span>
						<button
							type="button"
							class="divider-cell"
							disabled={currentPage >= totalPages || pageLoading}
							onclick={() => (currentPage += 1)}
						>
							Next →
						</button>
					</nav>
				{/if}
			{:else}
				<div class="empty">
					<p>This user hasn't created any notes yet</p>
				</div>
			{/if}
		{/if}
	</div>
</main>

<style>
	.user-notes-page {
		min-height: 100vh;
		background: var(--bg-primary);
		padding: calc(var(--spacing-xl) * 2) var(--spacing-lg);
	}

	.container {
		max-width: 900px;
		margin: 0 auto;
	}

	.loading,
	.error,
	.empty {
		text-align: center;
		padding: calc(var(--spacing-xl) * 3) var(--spacing-lg);
		color: var(--text-secondary);
	}

	.error {
		color: var(--color-error);
	}

	.back-link {
		display: inline-block;
		color: var(--accent);
		text-decoration: none;
		margin-bottom: var(--spacing-xl);
		font-weight: 500;
		transition: color 0.2s;
	}

	.back-link:hover {
		color: var(--text-primary);
	}

	.user-header {
		margin-bottom: calc(var(--spacing-xl) * 2);
	}

	.user-profile {
		display: flex;
		align-items: center;
		gap: var(--spacing-xl);
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: calc(var(--spacing-xl) * 2);
	}

	.user-avatar {
		width: 80px;
		height: 80px;
		border-radius: var(--radius-full);
		overflow: hidden;
		border: 3px solid var(--border-color);
		flex-shrink: 0;
	}

	.user-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.avatar-placeholder {
		width: 100%;
		height: 100%;
		background: var(--accent);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: var(--font-size-title);
		font-weight: bold;
	}

	.user-details h1 {
		font-size: var(--font-size-title);
		color: var(--text-primary);
		margin-bottom: var(--spacing-sm);
	}

	.note-count {
		color: var(--text-secondary);
		font-size: var(--font-size-headline);
	}

	.controls {
		display: flex;
		gap: var(--spacing-lg);
		margin-bottom: calc(var(--spacing-xl) * 2);
		flex-wrap: wrap;
	}

	.search-input {
		flex: 1;
		min-width: 200px;
		padding: var(--spacing-md) var(--spacing-lg);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-size: var(--font-size-body);
	}

	.search-input:focus {
		outline: none;
		border-color: var(--accent);
	}

	.sort-select {
		padding: var(--spacing-md) var(--spacing-lg);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-size: var(--font-size-body);
		cursor: pointer;
	}

	.sort-select:focus {
		outline: none;
		border-color: var(--accent);
	}

	.notes-list {
		grid-template-columns: 1fr;
	}

	.note-item {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: var(--spacing-xl);
		color: inherit;
		transition: background 0.15s ease, border-color 0.15s ease;
		display: block;
	}

	.note-item:focus-within {
		border-color: var(--accent);
	}

	.note-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--spacing-lg);
		padding-bottom: var(--spacing-md);
		border-bottom: 1px solid var(--border-color);
	}

	.character {
		display: inline-flex;
		min-width: 44px;
		min-height: 44px;
		align-items: center;
		font-size: var(--font-size-title);
		font-weight: bold;
		color: var(--accent);
		text-decoration: none;
	}

	.character:hover {
		text-decoration: underline;
	}

	.date {
		color: var(--text-secondary);
		font-size: var(--font-size-callout);
	}

	.note-content {
		min-width: 0;
		color: var(--text-primary);
		line-height: 1.6;
		overflow-wrap: anywhere;
	}

	.markdown-content :global(h1),
	.markdown-content :global(h2),
	.markdown-content :global(h3) {
		margin-top: var(--spacing-lg);
		margin-bottom: var(--spacing-sm);
		color: var(--text-primary);
	}

	.markdown-content :global(p) {
		margin-bottom: var(--spacing-md);
	}

	.markdown-content :global(code) {
		background: var(--bg-tertiary);
		padding: var(--spacing-xs) var(--spacing-sm);
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
	}

	.markdown-content :global(pre) {
		background: var(--bg-tertiary);
		padding: var(--spacing-lg);
		border-radius: var(--radius-md);
		overflow-x: auto;
		margin-bottom: var(--spacing-lg);
	}

	.markdown-content :global(a) {
		color: var(--accent);
		text-decoration: none;
		overflow-wrap: anywhere;
	}

	.markdown-content :global(a:hover) {
		text-decoration: underline;
	}

	.pagination {
		grid-template-columns: minmax(7rem, 1fr) auto minmax(7rem, 1fr);
		align-items: center;
		margin-top: calc(var(--spacing-xl) * 2);
		color: var(--text-secondary);
		font-size: var(--font-size-callout);
		text-align: center;
	}

	.pagination button {
		min-height: 44px;
		padding: var(--spacing-sm) var(--spacing-lg);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-secondary);
		color: var(--text-primary);
		font: inherit;
		cursor: pointer;
	}

	.pagination button:first-child {
		justify-self: start;
	}

	.pagination button:last-child {
		justify-self: end;
	}

	.pagination > span {
		display: flex;
		min-height: 44px;
		align-items: center;
		justify-content: center;
		padding-inline: var(--spacing-md);
		background: var(--divider-cell-bg);
	}

	.pagination button:hover:not(:disabled) {
		border-color: var(--accent);
		color: var(--accent);
	}

	.pagination button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	@media (max-width: 768px) {
		.user-profile {
			flex-direction: column;
			text-align: center;
		}

		.user-details h1 {
			font-size: var(--font-size-title);
		}

		.controls {
			flex-direction: column;
		}

		.search-input,
		.sort-select {
			width: 100%;
		}

		.pagination {
			grid-template-columns: 1fr 1fr;
		}

		.pagination span {
			grid-column: 1 / -1;
			grid-row: 1;
		}

		.pagination button {
			grid-row: 2;
			justify-self: stretch;
		}
	}
</style>
