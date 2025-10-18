<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	let noteText = $state('');
	let selectedFile = $state<File | null>(null);
	let uploading = $state(false);
	let error = $state<string | null>(null);
	let previewUrl = $state<string | null>(null);

	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];

		if (file) {
			// Validate file type
			if (!file.type.startsWith('image/')) {
				error = 'Please select an image file';
				return;
			}

			// Validate file size (max 5MB)
			if (file.size > 5 * 1024 * 1024) {
				error = 'File size must be less than 5MB';
				return;
			}

			selectedFile = file;
			error = null;

			// Create preview
			const reader = new FileReader();
			reader.onload = (e) => {
				previewUrl = e.target?.result as string;
			};
			reader.readAsDataURL(file);
		}
	}

	function clearFile() {
		selectedFile = null;
		previewUrl = null;
		error = null;
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();

		if (!noteText.trim()) {
			error = 'Please enter some text for your note';
			return;
		}

		try {
			uploading = true;
			error = null;

			let imageKey: string | null = null;

			// If there's a file, upload it first
			if (selectedFile) {
				// Step 1: Get presigned URL
				const uploadResponse = await fetch('/api/uploads', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						filename: selectedFile.name,
						contentType: selectedFile.type
					})
				});

				const uploadData = await uploadResponse.json();

				if (!uploadData.success) {
					throw new Error(uploadData.error || 'Failed to get upload URL');
				}

				// Step 2: Upload file to R2 using presigned URL
				const uploadResult = await fetch(uploadData.uploadUrl, {
					method: 'PUT',
					body: selectedFile,
					headers: {
						'Content-Type': selectedFile.type
					}
				});

				if (!uploadResult.ok) {
					throw new Error('Failed to upload file to R2');
				}

				imageKey = uploadData.key;
			}

			// Step 3: Create note in database
			const noteResponse = await fetch('/api/notes', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					text: noteText,
					image_key: imageKey
				})
			});

			const noteData = await noteResponse.json();

			if (!noteData.success) {
				throw new Error(noteData.error || 'Failed to create note');
			}

			// Success! Clear form and notify parent
			noteText = '';
			selectedFile = null;
			previewUrl = null;
			dispatch('noteCreated');
		} catch (err) {
			console.error(err);
			error = err instanceof Error ? err.message : 'Failed to create note';
		} finally {
			uploading = false;
		}
	}
</script>

<form onsubmit={handleSubmit}>
	<div class="form-group">
		<label for="note-text">Note Text</label>
		<textarea
			id="note-text"
			bind:value={noteText}
			placeholder="Enter your note here..."
			rows="4"
			disabled={uploading}
		></textarea>
	</div>

	<div class="form-group">
		<label for="note-image">Image (optional)</label>
		<input
			id="note-image"
			type="file"
			accept="image/*"
			onchange={handleFileSelect}
			disabled={uploading}
		/>

		{#if previewUrl}
			<div class="preview">
				<img src={previewUrl} alt="Preview" />
				<button type="button" class="clear-btn" onclick={clearFile} disabled={uploading}>
					Remove
				</button>
			</div>
		{/if}
	</div>

	{#if error}
		<div class="error-message">{error}</div>
	{/if}

	<button type="submit" class="submit-btn" disabled={uploading || !noteText.trim()}>
		{uploading ? 'Creating...' : 'Create Note'}
	</button>
</form>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	label {
		font-weight: 600;
		color: #2c3e50;
		font-size: 0.95rem;
	}

	textarea {
		padding: 12px;
		border: 2px solid #e0e0e0;
		border-radius: 8px;
		font-size: 1rem;
		font-family: inherit;
		resize: vertical;
		transition: border-color 0.2s;
	}

	textarea:focus {
		outline: none;
		border-color: #3498db;
	}

	textarea:disabled {
		background: #f5f5f5;
		cursor: not-allowed;
	}

	input[type='file'] {
		padding: 8px;
		border: 2px solid #e0e0e0;
		border-radius: 8px;
		font-size: 0.95rem;
		cursor: pointer;
	}

	input[type='file']:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.preview {
		margin-top: 12px;
		position: relative;
		display: inline-block;
	}

	.preview img {
		max-width: 200px;
		max-height: 200px;
		border-radius: 8px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.clear-btn {
		margin-top: 8px;
		padding: 6px 12px;
		background: #e74c3c;
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 0.85rem;
		cursor: pointer;
		transition: background 0.2s;
	}

	.clear-btn:hover:not(:disabled) {
		background: #c0392b;
	}

	.clear-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.error-message {
		padding: 12px;
		background: #fee;
		color: #e74c3c;
		border-radius: 8px;
		font-size: 0.9rem;
	}

	.submit-btn {
		padding: 14px 24px;
		background: #3498db;
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s;
	}

	.submit-btn:hover:not(:disabled) {
		background: #2980b9;
	}

	.submit-btn:disabled {
		background: #bdc3c7;
		cursor: not-allowed;
	}
</style>

