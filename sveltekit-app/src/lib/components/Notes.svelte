<script lang="ts">
	import { dev } from "$app/environment";
	import { useSession } from "$lib/auth-client";
	import { onMount } from "svelte";
	import { marked } from "marked";
	import DOMPurify from "dompurify";
	import SectionHeading from "./shared/SectionHeading.svelte";

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
		compact?: boolean;
	}

	let { character, compact = false }: Props = $props();

	const showClaudeMnemonics = false;

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
	let isExpanded = $state(false); // Track if the note box is expanded
	let isNativeRuntime = $state(typeof window !== "undefined" && window.location.protocol === "capacitor:");
	const localUserId = "local-device";
	let currentUserId = $derived($session.data?.user?.id ?? (isNativeRuntime ? localUserId : null));
	let canEditNotes = $derived(Boolean($session.data?.user) || isNativeRuntime);

	onMount(() => {
		isNativeRuntime = window.location.protocol === "capacitor:";
	});

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

	function isLegacyClaudeNote(note: Note): boolean {
		const name = note.user?.name?.trim().toLowerCase() || "";
		const userId = note.userId?.trim().toLowerCase() || "";
		return note.isAdmin || name === "claude" || userId === "claude" || userId.includes("claude");
	}

	let visibleCommunityNotes = $derived(otherNotes.filter((note) => !isLegacyClaudeNote(note)));
	let adminNote = $derived(
		showClaudeMnemonics ? otherNotes.find((note) => note.isAdmin) || null : null
	);
	let shouldRenderNotes = $derived(
		canEditNotes || loading || Boolean(error) || Boolean(adminNote) || visibleCommunityNotes.length > 0
	);

	async function loadNotes() {
		if (dev && !isNativeRuntime && !$session.data?.user) {
			notes = [];
			myNote = null;
			otherNotes = [];
			error = "";
			return;
		}

		try {
			loading = true;
			const response = await fetch(`/api/notes/${encodeURIComponent(character)}`);
			if (!response.ok) throw new Error("Failed to load notes");
			notes = await response.json();

			// Separate current user's note from others
			if (currentUserId) {
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
		isExpanded = true; // Expand when editing existing note
	}

	function cancelEditing() {
		isEditing = false;
		showPreview = false;
		noteText = myNote?.noteText || "";
		isExpanded = false;
	}

	function handleFocus() {
		isExpanded = true;
	}

	function handleBlur() {
		// Only collapse if there's no text and we're not editing an existing note
		if (!noteText.trim() && !myNote) {
			isExpanded = false;
		}
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
		if (isNativeRuntime) return null;

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

	// Handle paste events for image upload
	function handlePaste(event: ClipboardEvent) {
		if (isNativeRuntime) return;

		const items = event.clipboardData?.items;
		if (!items) return;

		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			if (item.type.indexOf('image') !== -1) {
				event.preventDefault();
				const file = item.getAsFile();
				if (file) {
					uploadImage(file);
				}
				break;
			}
		}
	}

	// Handle drag and drop for image upload
	let isDragging = $state(false);

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragging = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
		if (isNativeRuntime) return;

		const files = event.dataTransfer?.files;
		if (!files || files.length === 0) return;

		const file = files[0];
		if (file.type.indexOf('image') !== -1) {
			uploadImage(file);
		}
	}

	// Track the character prop to detect client-side navigation
	let lastCharacter = $state('');

	// Load notes when character changes or session becomes ready
	$effect(() => {
		const userId = $session.data?.user?.id;
		const native = isNativeRuntime;
		const readyToLoad = native || $session.data !== undefined;
		// Track character to reload on client-side navigation
		const currentChar = character;

		if (readyToLoad) {
			if (!hasAttemptedLoad || currentChar !== lastCharacter) {
				// Reset state when navigating to a different word
				if (currentChar !== lastCharacter) {
					notes = [];
					myNote = null;
					otherNotes = [];
					noteText = "";
					isEditing = false;
					showPreview = false;
					isExpanded = false;
					error = "";
				}
				hasAttemptedLoad = true;
				lastCharacter = currentChar;
				loadNotes();
			} else if (notes.length > 0) {
				// Session changed after initial load - re-separate notes
				const activeUserId = userId ?? (native ? localUserId : null);
				if (activeUserId) {
					myNote = notes.find((n) => n.userId === activeUserId) || null;
					otherNotes = notes.filter((n) => n.userId !== activeUserId);
				} else {
					myNote = null;
					otherNotes = notes;
				}
			}
		}
	});
</script>

{#if shouldRenderNotes}
	<div class:notes-compact={compact}>
	<SectionHeading id="notes">Notes</SectionHeading>

	<div class="mb-2">
		{#if error}
			<div class="p-3 bg-red-50 text-red-700 rounded mb-4">{error}</div>
		{/if}

		{#if loading && notes.length === 0}
			<p class="text-text-muted italic my-4">Loading notes...</p>
		{:else}
			<!-- Current User's Note -->
			{#if canEditNotes}
				{#if myNote && !isEditing}
					<div class="mb-3">
						<div class="flex justify-between items-center mb-2">
							<span class="font-semibold text-text-secondary text-xs">Your Note</span>
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
					<div class="mb-3 note-editor" class:expanded={isExpanded}>
						<div class="flex justify-between items-center mb-3">
							<div class="flex items-center gap-3">
								<span class="font-medium text-text-tertiary text-xs">{myNote ? "Edit Your Note" : "Add Your Note"}</span>
								{#if isExpanded}
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
								{/if}
							</div>
							{#if isExpanded}
								<div class="editor-actions">
									<input
										type="file"
										accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
										onchange={handleImageSelect}
										bind:this={fileInput}
										style="display: none;"
									/>
									{#if $session.data?.user && !isNativeRuntime}
										<button
											onclick={triggerImageUpload}
											disabled={uploadingImage}
											class="image-btn"
											title="Upload image"
										>
											{uploadingImage ? "..." : "📷"}
										</button>
									{/if}
									<button onclick={saveNote} disabled={loading || !noteText.trim()} class="save-btn">
										{loading ? "Saving..." : "Save"}
									</button>
									{#if myNote}
										<button onclick={cancelEditing} class="cancel-btn">Cancel</button>
									{/if}
								</div>
							{/if}
						</div>

						{#if !showPreview}
							<div
								class="textarea-wrapper"
								class:dragging={isDragging}
								role="group"
								aria-label="Note editor image drop zone"
								ondragover={handleDragOver}
								ondragleave={handleDragLeave}
								ondrop={handleDrop}
							>
								<textarea
									bind:value={noteText}
									placeholder="Write your note here... (Markdown supported)"
									rows={isExpanded ? 8 : 2}
									onfocus={handleFocus}
									onblur={handleBlur}
									onpaste={handlePaste}
								></textarea>
								{#if isDragging}
									<div class="drag-overlay">
										📷 Drop image here
									</div>
								{/if}
							</div>
						{:else}
							<div class="preview-content markdown-content">
								{@html renderMarkdown(noteText)}
							</div>
						{/if}
					</div>
				{/if}
			{/if}

			<!-- Official mnemonic (admin note) — shown without attribution -->
			{#if adminNote}
				<div class="official-mnemonic">
					<div class="markdown-content">
						{@html renderMarkdown(adminNote.noteText)}
					</div>
				</div>
			{/if}

			<!-- Community Notes (non-admin, excluding legacy generated notes) -->
			{#if visibleCommunityNotes.length > 0}
				<div class="notes-list">
					{#each visibleCommunityNotes as note (note.id)}
						<div class="note mb-3">
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
							</div>
							<div class="note-content markdown-content">
								{@html renderMarkdown(note.noteText)}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
	</div>
{/if}

<style lang="postcss">
	.notes-compact {
		padding: 0 var(--spacing-lg) var(--spacing-md);
		border-bottom: 1px solid var(--border-light);
	}
	.notes-compact :global(.notes-list) {
		border-top: none;
		padding-top: 0;
	}
	.note-editor:not(.expanded) {
		cursor: text;
	}

	.note-editor:not(.expanded):hover {
		@apply border-accent;
	}

	.editor-tabs {
		@apply flex gap-2;
	}

	.tab {
		@apply px-3 py-1.5 bg-transparent border border-border rounded text-text-secondary cursor-pointer text-sm transition-colors duration-200;
	}

	.tab.active {
		@apply text-white border-accent;
		background: var(--accent);
	}

	.tab:hover:not(.active):not(:disabled) {
		@apply bg-primary-secondary;
	}

	.preview-content {
		@apply min-h-[200px] p-3 bg-primary-secondary border border-border-light rounded;
	}

	.editor-actions {
		@apply flex gap-2 items-center;
	}

	.save-btn {
		@apply px-5 py-2 bg-[#4285f4] text-white border-none rounded cursor-pointer text-sm transition-colors duration-200;
	}

	.save-btn:hover:not(:disabled) {
		@apply bg-[#3367d6];
	}

	.cancel-btn {
		@apply px-5 py-2 bg-primary-secondary text-text-primary border border-border rounded cursor-pointer text-sm transition-colors duration-200;
	}

	.cancel-btn:hover {
		@apply bg-primary-tertiary;
	}

	.image-btn {
		@apply px-5 py-2 bg-primary-secondary text-text-primary border border-border rounded cursor-pointer text-sm transition-colors duration-200;
	}

	.image-btn:hover:not(:disabled) {
		@apply bg-primary-tertiary border-[#4285f4];
	}

	.image-btn:disabled {
		@apply opacity-50 cursor-not-allowed;
	}

	/* Other Users' Notes */
	.official-mnemonic {
		font-size: 14px;
		color: var(--text-primary);
		line-height: 1.6;
		margin-bottom: var(--spacing-sm);
	}

	.notes-list {
		@apply flex flex-col gap-2;
		margin-top: var(--spacing-sm);
		padding-top: var(--spacing-sm);
		border-top: 1px solid var(--border-light);
	}

	.note {
		@apply relative;
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

	.note-actions {
		@apply flex gap-2;
	}

	.edit-btn,
	.delete-btn {
		@apply px-2.5 py-1.5 text-sm border border-border bg-primary-secondary text-text-primary rounded cursor-pointer transition-colors duration-200;
	}

	.edit-btn:hover {
		@apply bg-primary-tertiary border-[#4285f4] text-[#4285f4];
	}

	.delete-btn:hover {
		@apply bg-[#3a1a1a] border-[#c33] text-[#ff6666];
	}

	/* Markdown Content Styling */
	/* Rendered note display is 14px; the textarea is 16px (iOS no-zoom). */
	.markdown-content {
		font-size: 14px;
	}

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
		font-family: var(--font-mono);
		font-size: 0.9em;
	}

	.markdown-content :global(pre) {
		@apply bg-primary-secondary p-4 rounded overflow-x-auto my-2;
	}

	.markdown-content :global(pre code) {
		@apply bg-transparent p-0;
	}

	.markdown-content :global(blockquote) {
		@apply border border-border rounded px-4 py-3 my-2 text-text-secondary bg-primary-secondary;
	}

	.markdown-content :global(a) {
		@apply text-accent no-underline;
	}

	.markdown-content :global(a:hover) {
		@apply underline;
	}

	.markdown-content :global(img) {
		@apply max-w-full h-auto rounded my-2;
		max-height: 400px;
		object-fit: contain;
	}

	/* Textarea wrapper for drag and drop */
	.textarea-wrapper {
		@apply relative;
	}

	.textarea-wrapper.dragging {
		@apply border-2 border-dashed border-accent rounded;
	}

	.drag-overlay {
		@apply absolute inset-0 flex items-center justify-center bg-primary-secondary bg-opacity-90 text-accent font-semibold text-lg rounded pointer-events-none;
		z-index: 10;
	}

	textarea {
		@apply w-full p-3 border border-border rounded font-sans resize-y box-border bg-primary-secondary text-text-primary leading-relaxed;
		/* 16px while editing so iOS Safari doesn't auto-zoom on focus
		   (it zooms any focused field below 16px). Display is 14px. */
		font-size: 16px;
	}

	textarea:focus {
		@apply outline-none border-[#4285f4];
	}

	button:disabled {
		@apply opacity-50 cursor-not-allowed;
	}
</style>
