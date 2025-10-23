<script lang="ts">
	import { useSession } from "$lib/auth-client";
	import { onMount } from "svelte";

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
	let newNoteText = $state("");
	let loading = $state(false);
	let error = $state("");
	let editingNoteId = $state<string | null>(null);
	let editingText = $state("");
	let showAddNote = $state(false);

	async function loadNotes() {
		try {
			loading = true;
			const response = await fetch(`/api/notes/${encodeURIComponent(character)}`);
			if (!response.ok) throw new Error("Failed to load notes");
			notes = await response.json();
		} catch (err) {
			error = "Failed to load notes";
			console.error(err);
		} finally {
			loading = false;
		}
	}

	async function createNote() {
		if (!newNoteText.trim()) return;

		try {
			loading = true;
			error = "";
			const response = await fetch(`/api/notes/${encodeURIComponent(character)}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ noteText: newNoteText }),
			});

			if (!response.ok) throw new Error("Failed to create note");

			newNoteText = "";
			await loadNotes();
		} catch (err) {
			error = "Failed to create note";
			console.error(err);
		} finally {
			loading = false;
		}
	}

	async function updateNote(noteId: string) {
		if (!editingText.trim()) return;

		try {
			loading = true;
			error = "";
			const response = await fetch(`/api/notes/${encodeURIComponent(character)}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ noteId, noteText: editingText }),
			});

			if (!response.ok) throw new Error("Failed to update note");

			editingNoteId = null;
			editingText = "";
			await loadNotes();
		} catch (err) {
			error = "Failed to update note";
			console.error(err);
		} finally {
			loading = false;
		}
	}

	async function deleteNote(noteId: string) {
		if (!confirm("Are you sure you want to delete this note?")) return;

		try {
			loading = true;
			error = "";
			const response = await fetch(`/api/notes/${encodeURIComponent(character)}`, {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ noteId }),
			});

			if (!response.ok) throw new Error("Failed to delete note");

			await loadNotes();
		} catch (err) {
			error = "Failed to delete note";
			console.error(err);
		} finally {
			loading = false;
		}
	}

	function startEditing(note: Note) {
		editingNoteId = note.id;
		editingText = note.noteText;
	}

	function cancelEditing() {
		editingNoteId = null;
		editingText = "";
	}

	function canEditNote(note: Note): boolean {
		if (!$session.data?.user) return false;
		return note.userId === $session.data.user.id || note.isAdmin;
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
	{:else if notes.length === 0}
		<p class="no-notes">No notes yet. {$session.data?.user ? "Be the first to add one!" : "Sign in to add notes."}</p>
	{:else}
		<div class="notes-list">
			{#each notes as note (note.id)}
				<div class="note" class:admin={note.isAdmin}>
					<div class="note-header">
						{#if note.isAdmin}
							<span class="admin-badge">Admin</span>
						{/if}
						{#if canEditNote(note) && editingNoteId !== note.id}
							<div class="note-actions">
								<button onclick={() => startEditing(note)} class="edit-btn" title="Edit">Edit</button>
								<button onclick={() => deleteNote(note.id)} class="delete-btn" title="Delete">Delete</button>
							</div>
						{/if}
					</div>

					{#if editingNoteId === note.id}
						<div class="edit-form">
							<textarea bind:value={editingText} rows="3"></textarea>
							<div class="edit-actions">
								<button onclick={() => updateNote(note.id)} disabled={loading}>Save</button>
								<button onclick={cancelEditing} class="cancel">Cancel</button>
							</div>
						</div>
					{:else}
						<p class="note-text">{note.noteText}</p>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	{#if $session.data?.user}
		{#if !showAddNote}
			<button onclick={() => showAddNote = true} class="add-note-btn">
				+ Add Note
			</button>
		{:else}
			<div class="add-note">
				<textarea
					bind:value={newNoteText}
					placeholder="Write your note here..."
					rows="3"
				></textarea>
				<div class="add-note-actions">
					<button onclick={createNote} disabled={loading || !newNoteText.trim()}>
						{loading ? "Adding..." : "Submit"}
					</button>
					<button onclick={() => { showAddNote = false; newNoteText = ""; }} class="cancel">
						Cancel
					</button>
				</div>
			</div>
		{/if}
	{:else}
		<p class="sign-in-prompt">Sign in to add your own notes</p>
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
		color: var(--text-color, #333);
	}

	.error {
		padding: 0.75rem;
		background: #fee;
		color: #c33;
		border-radius: 4px;
		margin-bottom: 1rem;
	}

	.loading,
	.no-notes,
	.sign-in-prompt {
		color: var(--text-muted, #666);
		font-style: italic;
	}

	.notes-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.note {
		padding: 1rem;
		background: white;
		border-radius: 6px;
		border: 1px solid #e0e0e0;
		position: relative;
	}

	.note.admin {
		border-color: #4285f4;
		background: #f0f7ff;
	}

	.note-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
		min-height: 24px;
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

	.note-text {
		margin: 0;
		white-space: pre-wrap;
		color: var(--text-color, #333);
		line-height: 1.5;
	}

	.note-actions {
		display: flex;
		gap: 0.5rem;
	}

	.edit-btn,
	.delete-btn {
		padding: 0.3rem 0.6rem;
		font-size: 0.85rem;
		border: 1px solid #ddd;
		background: white;
		color: #333;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.edit-btn:hover {
		background: #f0f0f0;
		border-color: #4285f4;
		color: #4285f4;
	}

	.delete-btn:hover {
		background: #fee;
		border-color: #c33;
		color: #c33;
	}

	.edit-form {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.edit-actions,
	.add-note-actions {
		display: flex;
		gap: 0.5rem;
	}

	.edit-actions button,
	.add-note-actions button {
		padding: 0.4rem 0.8rem;
		font-size: 0.9rem;
		border: 1px solid #ddd;
		background: #4285f4;
		color: white;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.edit-actions button:hover:not(:disabled),
	.add-note-actions button:hover:not(:disabled) {
		background: #3367d6;
	}

	.edit-actions button.cancel,
	.add-note-actions button.cancel {
		background: white;
		color: #333;
		border-color: #ddd;
	}

	.edit-actions button.cancel:hover,
	.add-note-actions button.cancel:hover {
		background: #f5f5f5;
	}

	.add-note {
		padding-top: 1rem;
		border-top: 1px solid #e0e0e0;
		margin-top: 1rem;
	}

	.add-note-btn {
		width: 100%;
		padding: 0.6rem 1.2rem;
		background: #4285f4;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 0.95rem;
		cursor: pointer;
		transition: background 0.2s;
		text-align: center;
	}

	.add-note-btn:hover {
		background: #3367d6;
	}

	textarea {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-family: inherit;
		font-size: 0.95rem;
		resize: vertical;
		margin-bottom: 0.5rem;
		box-sizing: border-box;
	}

	textarea:focus {
		outline: none;
		border-color: #4285f4;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Dark mode */
	:global(.dark) .notes-section {
		background: #1a1a1a;
	}

	:global(.dark) .note {
		background: #2a2a2a;
		border-color: #444;
	}

	:global(.dark) .note.admin {
		background: #1a2a3a;
		border-color: #4285f4;
	}

	:global(.dark) .note-text,
	:global(.dark) h3 {
		color: #e0e0e0;
	}

	:global(.dark) .loading,
	:global(.dark) .no-notes,
	:global(.dark) .sign-in-prompt {
		color: #999;
	}

	:global(.dark) textarea {
		background: #2a2a2a;
		border-color: #444;
		color: #e0e0e0;
	}

	:global(.dark) .edit-btn,
	:global(.dark) .delete-btn {
		background: #2a2a2a;
		border-color: #444;
		color: #e0e0e0;
	}

	:global(.dark) .edit-btn:hover {
		background: #333;
		border-color: #4285f4;
		color: #4285f4;
	}

	:global(.dark) .delete-btn:hover {
		background: #3a1a1a;
		border-color: #c33;
		color: #ff6666;
	}

	:global(.dark) .edit-actions button.cancel,
	:global(.dark) .add-note-actions button.cancel {
		background: #2a2a2a;
		color: #e0e0e0;
		border-color: #444;
	}

	:global(.dark) .edit-actions button.cancel:hover,
	:global(.dark) .add-note-actions button.cancel:hover {
		background: #333;
	}

	:global(.dark) .add-note {
		border-top-color: #444;
	}
</style>

