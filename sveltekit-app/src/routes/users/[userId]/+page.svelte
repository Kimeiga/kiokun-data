<script lang="ts">
	import { onMount } from 'svelte';
	import { marked } from 'marked';
	import DOMPurify from 'isomorphic-dompurify';
	import Header from '$lib/components/Header.svelte';

	interface User {
		id: string;
		name: string;
		email: string;
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
	}

	let { data }: { data: { userId: string } } = $props();

	let userData: User | null = $state(null);
	let notes: Note[] = $state([]);
	let loading = $state(true);
	let error = $state('');
	let searchQuery = $state('');
	let sortBy = $state<'updated' | 'created' | 'character'>('updated');

	let userId = $derived(data.userId);
	let filteredNotes = $derived(filterAndSortNotes(notes, searchQuery, sortBy));

	function filterAndSortNotes(allNotes: Note[], query: string, sort: string): Note[] {
		let filtered = allNotes;

		// Filter by search query
		if (query.trim()) {
			const lowerQuery = query.toLowerCase();
			filtered = filtered.filter(
				(note) =>
					note.character.includes(query) ||
					note.noteText.toLowerCase().includes(lowerQuery)
			);
		}

		// Sort
		const sorted = [...filtered];
		if (sort === 'updated') {
			sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
		} else if (sort === 'created') {
			sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
		} else if (sort === 'character') {
			sorted.sort((a, b) => a.character.localeCompare(b.character));
		}

		return sorted;
	}

	function renderMarkdown(text: string): string {
		const html = marked.parse(text) as string;
		return DOMPurify.sanitize(html);
	}

	async function loadUserNotes() {
		try {
			loading = true;
			error = '';
			const response = await fetch(`/api/users/${userId}/notes`);

			if (!response.ok) {
				if (response.status === 404) {
					error = 'User not found';
					return;
				}
				throw new Error('Failed to load user notes');
			}

			const data: UserNotesResponse = await response.json();
			userData = data.user;
			notes = data.notes;
		} catch (err) {
			error = 'Failed to load user notes';
			console.error('Error loading user notes:', err);
		} finally {
			loading = false;
		}
	}

	function formatDate(date: Date): string {
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	}

	onMount(() => {
		loadUserNotes();
	});
</script>

<svelte:head>
	<title>{userData ? `${userData.name}'s Notes` : 'User Notes'} - Kiokun</title>
</svelte:head>

<Header currentWord="" />

<main class="user-notes-page">
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
							<img src={userData.image} alt={userData.name} />
						{:else}
							<div class="avatar-placeholder">
								{userData.name.charAt(0).toUpperCase()}
							</div>
						{/if}
					</div>
					<div class="user-details">
						<h1>{userData.name}</h1>
						<p class="note-count">
							{notes.length} {notes.length === 1 ? 'note' : 'notes'}
						</p>
					</div>
				</div>
			</div>

			{#if notes.length > 0}
				<div class="controls">
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Search notes..."
						class="search-input"
					/>
					<select bind:value={sortBy} class="sort-select">
						<option value="updated">Recently Updated</option>
						<option value="created">Recently Created</option>
						<option value="character">Character</option>
					</select>
				</div>

				<div class="notes-list">
					{#each filteredNotes as note}
						<a href="/{note.character}" class="note-item">
							<div class="note-header">
								<span class="character">{note.character}</span>
								<span class="date">{formatDate(note.updatedAt)}</span>
							</div>
							<div class="note-content markdown-content">
								{@html renderMarkdown(note.noteText)}
							</div>
						</a>
					{/each}
				</div>

				{#if filteredNotes.length === 0}
					<div class="empty">
						<p>No notes match your search</p>
					</div>
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
		display: flex;
		flex-direction: column;
		gap: var(--spacing-lg);
	}

	.note-item {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: var(--spacing-xl);
		text-decoration: none;
		color: inherit;
		transition: background 0.15s ease, border-color 0.15s ease;
		display: block;
	}

	.note-item:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px var(--shadow-hover);
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
		font-size: var(--font-size-title);
		font-weight: bold;
		color: var(--text-primary);
	}

	.date {
		color: var(--text-secondary);
		font-size: var(--font-size-callout);
	}

	.note-content {
		color: var(--text-primary);
		line-height: 1.6;
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
	}

	.markdown-content :global(a:hover) {
		text-decoration: underline;
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
	}
</style>
