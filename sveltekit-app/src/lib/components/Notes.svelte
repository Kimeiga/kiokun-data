<script lang="ts">
	import { useSession } from "$lib/auth-client";
	import { onMount } from "svelte";
	import { marked } from "marked";
	import DOMPurify from "dompurify";

	interface Note {
		id: string;
		userId: string;
		character: string;
		noteText: string;
		isAdmin: boolean;
		createdAt: Date;
		updatedAt: Date;
	}

	interface Props {
		character: string;
	}

	let { character }: Props = $props();

	const session = useSession();
	let notes = $state<Note[]>([]);
	let myNote = $state<Note | null>(null); // Current user's note
	let otherNotes = $state<Note[]>([]); // Other users' notes
	let noteText = $state(""); // Text for creating/editing
	let loading = $state(false);
	let error = $state("");
	let isEditing = $state(false);
	let showPreview = $state(false);

	// Configure marked for security
	marked.setOptions({
		breaks: true, // Convert \n to <br>
		gfm: true, // GitHub Flavored Markdown
	});

	// Render markdown safely
	function renderMarkdown(text: string): string {
		const html = marked.parse(text) as string;
		return DOMPurify.sanitize(html);
	}

	async function loadNotes() {
		try {
			loading = true;
			const response = await fetch(`/api/notes/${encodeURIComponent(character)}`);
			if (!response.ok) throw new Error("Failed to load notes");
			notes = await response.json();

			// Separate current user's note from others
			if ($session.data?.user) {
				const currentUserId = $session.data.user.id;
				myNote = notes.find((n) => n.userId === currentUserId) || null;
				otherNotes = notes.filter((n) => n.userId !== currentUserId);
			} else {
				myNote = null;
				otherNotes = notes;
			}

			// If editing and we have a note, populate the text
			if (myNote && isEditing) {
				noteText = myNote.noteText;
			}
		} catch (err) {
			error = "Failed to load notes";
			console.error(err);
		} finally {
			loading = false;
		}
	}

	async function saveNote() {
		if (!noteText.trim()) return;

		try {
			loading = true;
			error = "";
			const response = await fetch(`/api/notes/${encodeURIComponent(character)}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ noteText }),
			});

			if (!response.ok) throw new Error("Failed to save note");

			isEditing = false;
			showPreview = false;
			await loadNotes();
		} catch (err) {
			error = "Failed to save note";
			console.error(err);
		} finally {
			loading = false;
		}
	}

	function startEditing() {
		isEditing = true;
		noteText = myNote?.noteText || "";
	}

	function cancelEditing() {
		isEditing = false;
		showPreview = false;
		noteText = myNote?.noteText || "";
	}

	async function deleteNote() {
		if (!confirm("Are you sure you want to delete your note?")) return;

		if (!myNote) return;

		try {
			loading = true;
			error = "";
			const response = await fetch(`/api/notes/${encodeURIComponent(character)}`, {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ noteId: myNote.id }),
			});

			if (!response.ok) throw new Error("Failed to delete note");

			noteText = "";
			isEditing = false;
			await loadNotes();
		} catch (err) {
			error = "Failed to delete note";
			console.error(err);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadNotes();
	});
</script>

<div class="notes-section">
	<h3>Notes</h3>

	{#if error}
		<div class="error">{error}</div>
	{/if}

	{#if loading && notes.length === 0}
		<p class="loading">Loading notes...</p>
	{:else}
		<!-- Current User's Note -->
		{#if $session.data?.user}
			{#if myNote && !isEditing}
				<div class="my-note">
					<div class="note-header">
						<span class="note-label">Your Note</span>
						<div class="note-actions">
							<button onclick={startEditing} class="edit-btn" title="Edit">Edit</button>
							<button onclick={deleteNote} class="delete-btn" title="Delete">Delete</button>
						</div>
					</div>
					<div class="note-content markdown-content">
						{@html renderMarkdown(myNote.noteText)}
					</div>
				</div>
			{:else if isEditing || !myNote}
				<div class="note-editor">
					<div class="editor-header">
						<span class="note-label">{myNote ? "Edit Your Note" : "Add Your Note"}</span>
						<div class="editor-tabs">
							<button
								class="tab"
								class:active={!showPreview}
								onclick={() => (showPreview = false)}
							>
								Write
							</button>
							<button
								class="tab"
								class:active={showPreview}
								onclick={() => (showPreview = true)}
								disabled={!noteText.trim()}
							>
								Preview
							</button>
						</div>
					</div>

					{#if !showPreview}
						<textarea
							bind:value={noteText}
							placeholder="Write your note here... (Markdown supported)"
							rows="8"
						></textarea>
						<div class="markdown-hint">
							<p>Markdown supported: **bold**, *italic*, [links](url), images, lists, etc.</p>
						</div>
					{:else}
						<div class="preview-content markdown-content">
							{@html renderMarkdown(noteText)}
						</div>
					{/if}

					<div class="editor-actions">
						<button onclick={saveNote} disabled={loading || !noteText.trim()} class="save-btn">
							{loading ? "Saving..." : "Save"}
						</button>
						{#if myNote}
							<button onclick={cancelEditing} class="cancel-btn">Cancel</button>
						{/if}
					</div>
				</div>
			{/if}
		{:else}
			<p class="sign-in-prompt">Sign in to add your own note</p>
		{/if}

		<!-- Other Users' Notes -->
		{#if otherNotes.length > 0}
			<div class="other-notes">
				<h4>Community Notes</h4>
				<div class="notes-list">
					{#each otherNotes as note (note.id)}
						<div class="note" class:admin={note.isAdmin}>
							<div class="note-header">
								{#if note.isAdmin}
									<span class="admin-badge">Admin</span>
								{/if}
							</div>
							<div class="note-content markdown-content">
								{@html renderMarkdown(note.noteText)}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	.notes-section {
		margin: 2rem 0;
		padding: 1.5rem;
		background: var(--bg-secondary, #f9f9f9);
		border-radius: 8px;
		max-width: 100%;
	}

	h3 {
		margin: 0 0 1rem 0;
		font-size: 1.3rem;
		color: var(--text-primary);
	}

	.error {
		padding: 0.75rem;
		background: #fee;
		color: #c33;
		border-radius: 4px;
		margin-bottom: 1rem;
	}

	.loading,
	.sign-in-prompt {
		color: var(--text-muted);
		font-style: italic;
		margin: 1rem 0;
	}

	/* My Note */
	.my-note {
		margin-bottom: 2rem;
		padding: 1rem;
		background: var(--bg-tertiary);
		border-radius: 6px;
		border: 1px solid var(--border-light);
	}

	.note-label {
		font-weight: 600;
		color: var(--text-secondary);
		font-size: 0.9rem;
	}

	.note-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.note-content {
		color: var(--text-primary);
		line-height: 1.6;
	}

	/* Note Editor */
	.note-editor {
		margin-bottom: 2rem;
		padding: 1rem;
		background: var(--bg-tertiary);
		border-radius: 6px;
		border: 1px solid var(--border-light);
	}

	.editor-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.editor-tabs {
		display: flex;
		gap: 0.5rem;
	}

	.tab {
		padding: 0.3rem 0.8rem;
		background: transparent;
		border: 1px solid var(--border-color);
		border-radius: 4px;
		color: var(--text-secondary);
		cursor: pointer;
		font-size: 0.85rem;
		transition: all 0.2s;
	}

	.tab.active {
		background: var(--accent);
		color: white;
		border-color: var(--accent);
	}

	.tab:hover:not(.active):not(:disabled) {
		background: var(--bg-secondary);
	}

	.markdown-hint {
		margin-top: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.markdown-hint p {
		margin: 0;
		font-size: 0.8rem;
		color: var(--text-muted);
		font-style: italic;
	}

	.preview-content {
		min-height: 200px;
		padding: 0.75rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-light);
		border-radius: 4px;
		margin-bottom: 0.75rem;
	}

	.editor-actions {
		display: flex;
		gap: 0.5rem;
	}

	.save-btn {
		padding: 0.5rem 1.2rem;
		background: #4285f4;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.9rem;
		transition: background 0.2s;
	}

	.save-btn:hover:not(:disabled) {
		background: #3367d6;
	}

	.cancel-btn {
		padding: 0.5rem 1.2rem;
		background: var(--bg-secondary);
		color: var(--text-primary);
		border: 1px solid var(--border-color);
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.9rem;
		transition: all 0.2s;
	}

	.cancel-btn:hover {
		background: var(--bg-tertiary);
	}

	/* Other Users' Notes */
	.other-notes {
		margin-top: 2rem;
		padding-top: 2rem;
		border-top: 1px solid var(--border-light);
	}

	.other-notes h4 {
		margin: 0 0 1rem 0;
		font-size: 1.1rem;
		color: var(--text-secondary);
	}

	.notes-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.note {
		padding: 1rem;
		background: var(--bg-tertiary);
		border-radius: 6px;
		border: 1px solid var(--border-light);
	}

	.note.admin {
		border-color: #4285f4;
		background: var(--accent-light);
	}

	.admin-badge {
		display: inline-block;
		padding: 0.2rem 0.5rem;
		background: #4285f4;
		color: white;
		font-size: 0.75rem;
		border-radius: 3px;
		font-weight: 600;
	}

	.note-actions {
		display: flex;
		gap: 0.5rem;
	}

	.edit-btn,
	.delete-btn {
		padding: 0.3rem 0.6rem;
		font-size: 0.85rem;
		border: 1px solid var(--border-color);
		background: var(--bg-secondary);
		color: var(--text-primary);
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.edit-btn:hover {
		background: var(--bg-tertiary);
		border-color: #4285f4;
		color: #4285f4;
	}

	.delete-btn:hover {
		background: #3a1a1a;
		border-color: #c33;
		color: #ff6666;
	}

	/* Markdown Content Styling */
	.markdown-content :global(h1),
	.markdown-content :global(h2),
	.markdown-content :global(h3) {
		margin-top: 1rem;
		margin-bottom: 0.5rem;
		color: var(--text-primary);
	}

	.markdown-content :global(h1) {
		font-size: 1.5rem;
	}

	.markdown-content :global(h2) {
		font-size: 1.3rem;
	}

	.markdown-content :global(h3) {
		font-size: 1.1rem;
	}

	.markdown-content :global(p) {
		margin: 0.5rem 0;
	}

	.markdown-content :global(ul),
	.markdown-content :global(ol) {
		margin: 0.5rem 0;
		padding-left: 1.5rem;
	}

	.markdown-content :global(code) {
		background: var(--bg-secondary);
		padding: 0.2rem 0.4rem;
		border-radius: 3px;
		font-family: 'Courier New', monospace;
		font-size: 0.9em;
	}

	.markdown-content :global(pre) {
		background: var(--bg-secondary);
		padding: 1rem;
		border-radius: 4px;
		overflow-x: auto;
		margin: 0.5rem 0;
	}

	.markdown-content :global(pre code) {
		background: none;
		padding: 0;
	}

	.markdown-content :global(blockquote) {
		border-left: 3px solid var(--border-color);
		padding-left: 1rem;
		margin: 0.5rem 0;
		color: var(--text-secondary);
	}

	.markdown-content :global(a) {
		color: var(--accent);
		text-decoration: none;
	}

	.markdown-content :global(a:hover) {
		text-decoration: underline;
	}

	.markdown-content :global(img) {
		max-width: 100%;
		height: auto;
		border-radius: 4px;
		margin: 0.5rem 0;
	}

	textarea {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid var(--border-color);
		border-radius: 4px;
		font-family: inherit;
		font-size: 0.95rem;
		resize: vertical;
		min-height: 200px;
		box-sizing: border-box;
		background: var(--bg-secondary);
		color: var(--text-primary);
		line-height: 1.6;
	}

	textarea:focus {
		outline: none;
		border-color: #4285f4;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>

