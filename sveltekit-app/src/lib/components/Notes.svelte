<script lang="ts">
	import { useSession } from "$lib/auth-client";
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
		user: {
			id: string;
			name: string;
			image: string | null;
		} | null;
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
	let uploadingImage = $state(false);
	let fileInput = $state<HTMLInputElement>();
	let hasAttemptedLoad = $state(false);

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
			console.error('Error loading notes:', err);
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

	async function uploadImage(file: File) {
		try {
			uploadingImage = true;
			error = "";

			const formData = new FormData();
			formData.append("image", file);

			const response = await fetch("/api/images/upload", {
				method: "POST",
				body: formData,
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || "Failed to upload image");
			}

			const data = await response.json();

			// Insert markdown image syntax at cursor position or end of text
			const imageMarkdown = `![${file.name}](${data.url})`;
			noteText = noteText + "\n\n" + imageMarkdown;

			return data.url;
		} catch (err) {
			error = err instanceof Error ? err.message : "Failed to upload image";
			console.error(err);
			return null;
		} finally {
			uploadingImage = false;
		}
	}

	function handleImageSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];

		if (file) {
			uploadImage(file);
		}

		// Reset input so same file can be selected again
		input.value = "";
	}

	function triggerImageUpload() {
		fileInput?.click();
	}

	// Wait for session to be ready, then load notes
	// Reload if session changes (user logs in/out)
	$effect(() => {
		const userId = $session.data?.user?.id;

		// Load notes when session is ready and we haven't loaded yet
		if ($session.data !== undefined) {
			if (!hasAttemptedLoad) {
				hasAttemptedLoad = true;
				loadNotes();
			} else if (notes.length > 0) {
				// Session changed after initial load - re-separate notes
				if (userId) {
					myNote = notes.find((n) => n.userId === userId) || null;
					otherNotes = notes.filter((n) => n.userId !== userId);
				} else {
					myNote = null;
					otherNotes = notes;
				}
			}
		}
	});
</script>

<div class="my-8 p-4 md:p-6 bg-primary-secondary rounded-lg max-w-full">
	<h3 class="m-0 mb-4 text-xl md:text-2xl text-text-primary">Notes</h3>

	{#if error}
		<div class="p-3 bg-red-50 text-red-700 rounded mb-4">{error}</div>
	{/if}

	{#if loading && notes.length === 0}
		<p class="text-text-muted italic my-4">Loading notes...</p>
	{:else}
		<!-- Current User's Note -->
		{#if $session.data?.user}
			{#if myNote && !isEditing}
				<div class="mb-8 p-4 bg-primary-tertiary rounded-md border border-border-light">
					<div class="flex justify-between items-center mb-3">
						<span class="font-semibold text-text-secondary text-sm">Your Note</span>
						<div class="note-actions">
							<button onclick={startEditing} class="edit-btn" title="Edit">Edit</button>
							<button onclick={deleteNote} class="delete-btn" title="Delete">Delete</button>
						</div>
					</div>
					<div class="text-text-primary leading-relaxed markdown-content">
						{@html renderMarkdown(myNote.noteText)}
					</div>
				</div>
			{:else if isEditing || !myNote}
				<div class="mb-8 p-4 bg-primary-tertiary rounded-md border border-border-light">
					<div class="flex justify-between items-center mb-3">
						<span class="font-semibold text-text-secondary text-sm">{myNote ? "Edit Your Note" : "Add Your Note"}</span>
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
						<input
							type="file"
							accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
							onchange={handleImageSelect}
							bind:this={fileInput}
							style="display: none;"
						/>
						<button
							onclick={triggerImageUpload}
							disabled={uploadingImage}
							class="image-btn"
							title="Upload image"
						>
							{uploadingImage ? "Uploading..." : "📷 Add Image"}
						</button>
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
				<div class="notes-list">
					{#each otherNotes as note (note.id)}
						<div class="note" class:admin={note.isAdmin}>
							<div class="note-header-with-avatar">
								<a href="/users/{note.userId}" class="user-avatar-link">
									{#if note.user?.image}
										<img src={note.user.image} alt={note.user.name} class="user-avatar" />
									{:else}
										<div class="user-avatar-placeholder">
											{note.user?.name?.charAt(0).toUpperCase() || '?'}
										</div>
									{/if}
								</a>
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
	.editor-tabs {
		@apply flex gap-2;
	}

	.tab {
		@apply px-3 py-1.5 bg-transparent border border-border rounded text-text-secondary cursor-pointer text-sm transition-all duration-200;
	}

	.tab.active {
		@apply text-white border-accent;
		background: var(--accent);
	}

	.tab:hover:not(.active):not(:disabled) {
		@apply bg-primary-secondary;
	}

	.markdown-hint {
		@apply mt-2 mb-3;
	}

	.markdown-hint p {
		@apply m-0 text-xs text-text-muted italic;
	}

	.preview-content {
		@apply min-h-[200px] p-3 bg-primary-secondary border border-border-light rounded mb-3;
	}

	.editor-actions {
		@apply flex gap-2;
	}

	.save-btn {
		@apply px-5 py-2 bg-[#4285f4] text-white border-none rounded cursor-pointer text-sm transition-colors duration-200;
	}

	.save-btn:hover:not(:disabled) {
		@apply bg-[#3367d6];
	}

	.cancel-btn {
		@apply px-5 py-2 bg-primary-secondary text-text-primary border border-border rounded cursor-pointer text-sm transition-all duration-200;
	}

	.cancel-btn:hover {
		@apply bg-primary-tertiary;
	}

	.image-btn {
		@apply px-5 py-2 bg-primary-secondary text-text-primary border border-border rounded cursor-pointer text-sm transition-all duration-200;
	}

	.image-btn:hover:not(:disabled) {
		@apply bg-primary-tertiary border-[#4285f4];
	}

	.image-btn:disabled {
		@apply opacity-50 cursor-not-allowed;
	}

	/* Other Users' Notes */
	.other-notes {
		@apply mt-8;
	}

	.notes-list {
		@apply flex flex-col gap-4;
	}

	.note {
		@apply p-4 bg-primary-tertiary rounded-md border border-border-light relative;
	}

	.note.admin {
		@apply border-[#4285f4];
		background: var(--accent-light);
	}

	.note-header-with-avatar {
		@apply flex items-center gap-2 mb-3;
	}

	.user-avatar-link {
		@apply no-underline block;
	}

	.user-avatar {
		@apply w-8 h-8 rounded-full object-cover border-2 border-border transition-colors duration-200;
	}

	.user-avatar-link:hover .user-avatar {
		@apply border-accent;
	}

	.user-avatar-placeholder {
		@apply w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-sm border-2 border-border transition-colors duration-200;
		background: var(--accent);
	}

	.user-avatar-link:hover .user-avatar-placeholder {
		@apply border-accent;
	}

	.admin-badge {
		@apply inline-block px-2 py-1 bg-[#4285f4] text-white text-xs rounded font-semibold;
	}

	.note-actions {
		@apply flex gap-2;
	}

	.edit-btn,
	.delete-btn {
		@apply px-2.5 py-1.5 text-sm border border-border bg-primary-secondary text-text-primary rounded cursor-pointer transition-all duration-200;
	}

	.edit-btn:hover {
		@apply bg-primary-tertiary border-[#4285f4] text-[#4285f4];
	}

	.delete-btn:hover {
		@apply bg-[#3a1a1a] border-[#c33] text-[#ff6666];
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
		@apply bg-primary-secondary p-4 rounded overflow-x-auto my-2;
	}

	.markdown-content :global(pre code) {
		@apply bg-transparent p-0;
	}

	.markdown-content :global(blockquote) {
		@apply border-l-4 border-border pl-4 my-2 text-text-secondary;
	}

	.markdown-content :global(a) {
		@apply text-accent no-underline;
	}

	.markdown-content :global(a:hover) {
		@apply underline;
	}

	.markdown-content :global(img) {
		@apply max-w-full h-auto rounded my-2;
	}

	textarea {
		@apply w-full p-3 border border-border rounded font-sans text-base resize-y min-h-[200px] box-border bg-primary-secondary text-text-primary leading-relaxed;
	}

	textarea:focus {
		@apply outline-none border-[#4285f4];
	}

	button:disabled {
		@apply opacity-50 cursor-not-allowed;
	}
</style>

