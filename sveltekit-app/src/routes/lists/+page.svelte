<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import { useSession } from '$lib/auth-client';
	import DOMPurify from 'isomorphic-dompurify';
	import { marked } from 'marked';

	interface Note {
		id: string;
		userId: string;
		character: string;
		noteText: string;
		isAdmin: boolean;
		createdAt: Date;
		updatedAt: Date;
	}

	const session = useSession();
	let notes = $state<Note[]>([]);
	let filteredNotes = $state<Note[]>([]);
	let loading = $state(true);
	let error = $state('');
	let searchQuery = $state('');
	let sortBy = $state<'updated' | 'created' | 'character'>('updated');
	let hasLoadedOnce = $state(false);

	// Configure marked for security
	marked.setOptions({
		breaks: true,
		gfm: true,
	});

	// Render markdown safely
	function renderMarkdown(text: string): string {
		const html = marked.parse(text) as string;
		return DOMPurify.sanitize(html);
	}

	async function loadNotes() {
		try {
			loading = true;
			error = '';
			const response = await fetch('/api/user/notes');

			if (!response.ok) {
				if (response.status === 401) {
					error = 'Please sign in to view your notes';
					return;
				}
				throw new Error('Failed to load notes');
			}

			notes = await response.json();
			filterAndSortNotes();
			hasLoadedOnce = true;
		} catch (err) {
			error = 'Failed to load notes';
			console.error('Error loading notes:', err);
		} finally {
			loading = false;
		}
	}

	function filterAndSortNotes() {
		let result = [...notes];

		// Filter by search query
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			result = result.filter(
				(note) =>
					note.character.toLowerCase().includes(query) ||
					note.noteText.toLowerCase().includes(query)
			);
		}

		// Sort
		result.sort((a, b) => {
			if (sortBy === 'updated') {
				return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
			} else if (sortBy === 'created') {
				return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
			} else {
				// Sort by character
				return a.character.localeCompare(b.character);
			}
		});

		filteredNotes = result;
	}

	function formatDate(date: Date): string {
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	}

	// Load notes when session becomes available
	$effect(() => {
		if ($session.data?.user && !hasLoadedOnce) {
			loadNotes();
		} else if (!$session.data?.user) {
			loading = false;
			error = 'Please sign in to view your notes';
			notes = [];
			filteredNotes = [];
			hasLoadedOnce = false;
		}
	});

	// Re-filter when search query or sort changes
	$effect(() => {
		searchQuery;
		sortBy;
		filterAndSortNotes();
	});
</script>

<svelte:head>
	<title>My Notes - Kiokun</title>
	<meta name="description" content="View and manage all your character notes" />
</svelte:head>

<Header currentWord="" />

<div class="container">
	<div class="page-header">
		<h1>📝 My Notes</h1>
		<p class="subtitle">All your character notes in one place</p>
	</div>

	{#if loading}
		<div class="loading">Loading your notes...</div>
	{:else if error}
		<div class="error-message">
			<p>{error}</p>
			{#if !$session.data?.user}
				<p class="hint">Sign in using the button in the top right corner</p>
			{/if}
		</div>
	{:else if notes.length === 0}
		<div class="empty-state">
			<div class="empty-icon">📭</div>
			<h2>No notes yet</h2>
			<p>Start adding notes to characters to see them here!</p>
			<p class="hint">Search for any character and add a note on its page</p>
		</div>
	{:else}
		<!-- Controls -->
		<div class="controls">
			<div class="search-container">
				<input
					type="text"
					class="search-input"
					placeholder="Search notes..."
					bind:value={searchQuery}
				/>
			</div>

			<div class="sort-container">
				<label for="sort">Sort by:</label>
				<select id="sort" bind:value={sortBy} class="sort-select">
					<option value="updated">Last Updated</option>
					<option value="created">Date Created</option>
					<option value="character">Character</option>
				</select>
			</div>

			<div class="count">
				{filteredNotes.length} {filteredNotes.length === 1 ? 'note' : 'notes'}
				{#if searchQuery.trim()}
					(filtered from {notes.length})
				{/if}
			</div>
		</div>

		<!-- Notes Grid -->
		{#if filteredNotes.length === 0}
			<div class="no-results">
				<p>No notes match your search</p>
			</div>
		{:else}
			<div class="notes-grid">
				{#each filteredNotes as note (note.id)}
					<a href="/{note.character}" class="note-card">
						<div class="note-header">
							<div class="character">{note.character}</div>
							<div class="date">{formatDate(note.updatedAt)}</div>
						</div>
						<div class="note-content markdown-content">
							{@html renderMarkdown(note.noteText)}
						</div>
					</a>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 40px 20px;
	}

	.page-header {
		text-align: center;
		margin-bottom: 40px;
	}

	.page-header h1 {
		font-size: 48px;
		margin: 0 0 12px 0;
		color: var(--text-primary);
	}

	.subtitle {
		font-size: 18px;
		color: var(--text-secondary);
		margin: 0;
	}

	.loading,
	.error-message,
	.empty-state,
	.no-results {
		text-align: center;
		padding: 60px 20px;
		color: var(--text-secondary);
	}

	.error-message {
		color: #e74c3c;
	}

	.hint {
		margin-top: 12px;
		font-size: 14px;
		color: var(--text-muted);
	}

	.empty-state {
		padding: 80px 20px;
	}

	.empty-icon {
		font-size: 64px;
		margin-bottom: 20px;
	}

	.empty-state h2 {
		color: var(--text-primary);
		margin: 0 0 12px 0;
	}

	.empty-state p {
		margin: 8px 0;
	}

	.controls {
		display: flex;
		gap: 20px;
		align-items: center;
		margin-bottom: 30px;
		flex-wrap: wrap;
	}

	.search-container {
		flex: 1;
		min-width: 250px;
	}

	.search-input {
		width: 100%;
		padding: 10px 16px;
		border: 2px solid var(--border-color);
		border-radius: 8px;
		font-size: 16px;
		background: var(--bg-secondary);
		color: var(--text-primary);
		transition: all 0.2s ease;
	}

	.search-input:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-light);
	}

	.sort-container {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.sort-container label {
		color: var(--text-secondary);
		font-size: 14px;
	}

	.sort-select {
		padding: 8px 12px;
		border: 2px solid var(--border-color);
		border-radius: 8px;
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-size: 14px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.sort-select:focus {
		outline: none;
		border-color: var(--accent);
	}

	.count {
		color: var(--text-secondary);
		font-size: 14px;
		white-space: nowrap;
	}

	.notes-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 20px;
	}

	.note-card {
		display: block;
		background: var(--bg-secondary);
		border: 2px solid var(--border-color);
		border-radius: 12px;
		padding: 20px;
		cursor: pointer;
		transition: all 0.2s ease;
		text-decoration: none;
		color: inherit;
	}

	.note-card:hover {
		border-color: var(--accent);
		box-shadow: 0 4px 12px var(--shadow-hover);
		transform: translateY(-2px);
	}

	.note-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
		padding-bottom: 12px;
		border-bottom: 1px solid var(--border-color);
	}

	.character {
		font-size: 32px;
		font-weight: 600;
		font-family: 'MS Mincho', serif;
		color: var(--text-primary);
	}

	.date {
		font-size: 12px;
		color: var(--text-muted);
	}

	.note-content {
		color: var(--text-primary);
		line-height: 1.6;
		max-height: 200px;
		overflow: hidden;
		position: relative;
	}

	.note-content::after {
		content: '';
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 40px;
		background: linear-gradient(to bottom, transparent, var(--bg-secondary));
	}

	/* Markdown content styling */
	:global(.markdown-content p) {
		margin: 0 0 8px 0;
	}

	:global(.markdown-content p:last-child) {
		margin-bottom: 0;
	}

	:global(.markdown-content strong) {
		font-weight: 600;
		color: var(--text-primary);
	}

	:global(.markdown-content em) {
		font-style: italic;
	}

	:global(.markdown-content code) {
		background: var(--bg-tertiary);
		padding: 2px 6px;
		border-radius: 4px;
		font-family: 'Courier New', monospace;
		font-size: 0.9em;
	}

	:global(.markdown-content a) {
		color: var(--accent);
		text-decoration: none;
	}

	:global(.markdown-content a:hover) {
		text-decoration: underline;
	}

	@media (max-width: 768px) {
		.page-header h1 {
			font-size: 36px;
		}

		.controls {
			flex-direction: column;
			align-items: stretch;
		}

		.search-container {
			min-width: 100%;
		}

		.sort-container {
			justify-content: space-between;
		}

		.notes-grid {
			grid-template-columns: 1fr;
		}
	}
</style>

