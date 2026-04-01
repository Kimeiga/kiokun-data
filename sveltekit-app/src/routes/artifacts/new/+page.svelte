<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import { useSession } from '$lib/auth-client';
	import { goto } from '$app/navigation';

	const session = useSession();

	let title = $state('');
	let description = $state('');
	let language = $state('ja');
	let type = $state('packaging');
	let isPublic = $state(true);
	let saving = $state(false);
	let errorMsg = $state('');

	// Image + text pairs
	interface ImageEntry {
		url: string;
		filename: string;
		text: string; // the transcript pasted by user
	}
	let imageEntries = $state<ImageEntry[]>([]);
	let uploading = $state(false);
	let dragOver = $state(false);
	let fileInput = $state<HTMLInputElement>();
	let lightboxUrl = $state<string | null>(null);

	// Global paste handler — images go to upload, text goes to focused textarea
	function handlePaste(event: ClipboardEvent) {
		if (!$session.data?.user) return;
		const items = event.clipboardData?.items;
		if (!items) return;

		const imageFiles: File[] = [];
		for (const item of items) {
			if (item.type.startsWith('image/')) {
				const file = item.getAsFile();
				if (file) imageFiles.push(file);
			}
		}

		if (imageFiles.length > 0) {
			event.preventDefault();
			for (const file of imageFiles) {
				uploadFile(file);
			}
		}
		// If no images, let the default paste behavior fill the focused textarea
	}

	async function uploadFile(file: File) {
		const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
		if (!allowedTypes.includes(file.type)) {
			errorMsg = 'Only JPEG, PNG, GIF, and WebP images are allowed.';
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			errorMsg = 'Image must be under 5MB.';
			return;
		}

		uploading = true;
		errorMsg = '';

		try {
			const formData = new FormData();
			formData.append('image', file);

			const resp = await fetch('/api/images/upload', {
				method: 'POST',
				body: formData,
			});

			if (!resp.ok) throw new Error('Failed to upload image');

			const data = await resp.json();
			imageEntries = [...imageEntries, { url: data.url, filename: data.filename, text: '' }];
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Failed to upload image';
		} finally {
			uploading = false;
		}
	}

	async function handleFiles(files: FileList | null) {
		if (!files) return;
		for (const file of files) {
			await uploadFile(file);
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragOver = false;
		handleFiles(event.dataTransfer?.files ?? null);
	}

	function removeImage(index: number) {
		imageEntries = imageEntries.filter((_, i) => i !== index);
	}

	function triggerFileInput() {
		fileInput?.click();
	}

	async function createArtifact() {
		if (!title.trim()) {
			errorMsg = 'Title is required';
			return;
		}

		saving = true;
		errorMsg = '';

		try {
			// 1. Create the artifact
			const resp = await fetch('/api/artifacts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: title.trim(),
					description: description.trim() || null,
					language,
					type,
					isPublic,
				}),
			});

			if (!resp.ok) {
				const data = await resp.json().catch(() => ({}));
				throw new Error(data.message || 'Failed to create artifact');
			}

			const { id: artifactId } = await resp.json();

			// 2. For each image entry, associate image + create sentences from text
			for (const entry of imageEntries) {
				// Associate image
				const imgResp = await fetch(`/api/artifacts/${artifactId}/images`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ imageUrl: entry.url }),
				});

				let imageId: string | null = null;
				if (imgResp.ok) {
					const imgData = await imgResp.json();
					imageId = imgData.id;
				}

				// Create sentences from the text (split by newlines)
				if (entry.text.trim() && imageId) {
					const lines = entry.text.trim().split(/\n+/).filter(l => l.trim());
					for (const line of lines) {
						await fetch(`/api/artifacts/${artifactId}/sentences`, {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								originalText: line.trim(),
								imageId,
							}),
						});
					}
				}
			}

			await goto(`/artifacts/${artifactId}`);
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Failed to create artifact';
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>New Artifact - Kiokun</title>
</svelte:head>

<svelte:window onpaste={handlePaste} />

<Header currentWord="" />

<div class="page">
	{#if !$session.data?.user}
		<p class="status">Please sign in to create artifacts.</p>
	{:else}
		<div class="form-card">
			<h1>New Artifact</h1>
			<p class="subtitle">Record a real-world language encounter</p>

			{#if errorMsg}
				<div class="error-msg">{errorMsg}</div>
			{/if}

			<div class="field">
				<label for="title">Title</label>
				<input
					id="title"
					type="text"
					bind:value={title}
					placeholder="e.g., Matcha Pocky Box, Ramen Shop Menu"
					class="input"
				/>
			</div>

			<div class="field">
				<label for="description">Description <span class="optional">(optional)</span></label>
				<textarea
					id="description"
					bind:value={description}
					placeholder="Where did you find this? Any context..."
					class="input textarea"
					rows="2"
				></textarea>
			</div>

			<div class="row">
				<div class="field">
					<label for="language">Language</label>
					<select id="language" bind:value={language} class="input">
						<option value="zh">🇨🇳 Chinese</option>
						<option value="ja">🇯🇵 Japanese</option>
						<option value="ko">🇰🇷 Korean</option>
					</select>
				</div>

				<div class="field">
					<label for="type">Type</label>
					<select id="type" bind:value={type} class="input">
						<option value="packaging">📦 Packaging</option>
						<option value="sign">🪧 Sign</option>
						<option value="menu">🍜 Menu</option>
						<option value="book">📖 Book</option>
						<option value="media">📺 Media</option>
						<option value="other">📎 Other</option>
					</select>
				</div>
			</div>

			<!-- Image + Text Entries -->
			<div class="field">
				<label>Photos & Text</label>

				{#if imageEntries.length > 0}
					<div class="image-entries">
						{#each imageEntries as entry, i}
							<div class="image-entry">
								<div class="entry-image">
									<button class="entry-img-btn" onclick={() => lightboxUrl = entry.url} title="View full size">
										<img src={entry.url} alt="Photo {i + 1}" />
									</button>
									<button class="entry-remove" onclick={() => removeImage(i)} title="Remove image">x</button>
								</div>
								<div class="entry-text">
									<textarea
										bind:value={entry.text}
										placeholder="Paste the text from this image here...&#10;Each line becomes a separate sentence.&#10;All words will be clickable in the dictionary."
										rows="5"
										class="entry-textarea"
									></textarea>
								</div>
							</div>
						{/each}
					</div>
				{/if}

				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="drop-zone"
					class:drag-over={dragOver}
					class:compact={imageEntries.length > 0}
					onclick={triggerFileInput}
					ondrop={handleDrop}
					ondragover={(e) => { e.preventDefault(); dragOver = true; }}
					ondragleave={() => dragOver = false}
					role="button"
					tabindex="0"
					onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') triggerFileInput(); }}
				>
					{#if uploading}
						<span class="drop-text">Uploading...</span>
					{:else}
						<span class="drop-icon">{imageEntries.length > 0 ? '+' : '📷'}</span>
						<span class="drop-text">
							{imageEntries.length > 0 ? 'Add another photo' : 'Drop, paste, or click to upload photos'}
						</span>
						{#if imageEntries.length === 0}
							<span class="drop-hint">Cmd+V to paste from clipboard · JPEG, PNG, GIF, WebP up to 5MB</span>
						{/if}
					{/if}
				</div>

				<input
					type="file"
					accept="image/jpeg,image/png,image/gif,image/webp"
					multiple
					bind:this={fileInput}
					onchange={(e) => handleFiles((e.target as HTMLInputElement).files)}
					style="display: none;"
				/>
			</div>

			<div class="field">
				<label class="toggle-label">
					<input type="checkbox" bind:checked={isPublic} />
					<span>Public</span>
					<span class="toggle-hint">{isPublic ? 'Visible to everyone on the Artifacts page' : 'Only visible to you'}</span>
				</label>
			</div>

			<div class="actions">
				<a href="/artifacts" class="cancel-btn">Cancel</a>
				<button class="save-btn" onclick={createArtifact} disabled={saving || uploading || !title.trim()}>
					{saving ? 'Creating...' : 'Create Artifact'}
				</button>
			</div>
		</div>
	{/if}
</div>

<!-- Image Lightbox -->
{#if lightboxUrl}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="lightbox" onclick={() => lightboxUrl = null} onkeydown={(e) => { if (e.key === 'Escape') lightboxUrl = null; }}>
		<button class="lightbox-close" onclick={() => lightboxUrl = null}>x</button>
		<img src={lightboxUrl} alt="Full size preview" class="lightbox-img" />
	</div>
{/if}

<style>
	.page { max-width: 720px; margin: 0 auto; padding: var(--spacing-xl); }
	.status { text-align: center; padding: 40px; color: var(--text-secondary); }

	.form-card {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: var(--spacing-xl);
	}

	h1 { font-size: var(--font-size-title); font-weight: 700; color: var(--text-primary); margin: 0; }
	.subtitle { font-size: var(--font-size-body); color: var(--text-secondary); margin: var(--spacing-xs) 0 var(--spacing-xl); }

	.error-msg {
		padding: var(--spacing-md);
		background: rgba(231, 76, 60, 0.1);
		border: 1px solid var(--color-error);
		border-radius: var(--radius-md);
		color: var(--color-error);
		font-size: var(--font-size-callout);
		margin-bottom: var(--spacing-lg);
	}

	.field { margin-bottom: var(--spacing-lg); }
	.field label { display: block; font-size: var(--font-size-callout); font-weight: 600; color: var(--text-primary); margin-bottom: var(--spacing-sm); }
	.optional { font-weight: 400; color: var(--text-muted); }

	.input {
		width: 100%;
		padding: var(--spacing-md);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-primary);
		color: var(--text-primary);
		font-size: var(--font-size-body);
		font-family: inherit;
		transition: border-color 0.15s;
		box-sizing: border-box;
	}
	.input:focus { outline: none; border-color: var(--accent); }
	.textarea { resize: vertical; }
	.row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-lg); }

	/* Image + Text entries */
	.image-entries { display: flex; flex-direction: column; gap: var(--spacing-lg); margin-bottom: var(--spacing-lg); }

	.image-entry {
		display: grid;
		grid-template-columns: 200px 1fr;
		gap: var(--spacing-lg);
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		padding: var(--spacing-md);
	}

	.entry-image {
		position: relative;
		border-radius: var(--radius-md);
		overflow: hidden;
		aspect-ratio: 4/3;
	}
	.entry-img-btn {
		display: block; width: 100%; height: 100%; padding: 0; border: none; background: none; cursor: pointer;
	}
	.entry-img-btn img { width: 100%; height: 100%; object-fit: cover; border-radius: var(--radius-md); }
	.entry-remove {
		position: absolute; top: 6px; right: 6px;
		width: 24px; height: 24px; border-radius: 50%;
		background: rgba(0,0,0,0.6); color: white;
		border: none; font-size: 14px; cursor: pointer;
		display: flex; align-items: center; justify-content: center;
	}

	.entry-text { display: flex; flex-direction: column; }
	.entry-textarea {
		width: 100%;
		flex: 1;
		padding: var(--spacing-md);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-size: var(--font-size-body);
		font-family: var(--font-cjk);
		line-height: 1.8;
		resize: vertical;
		box-sizing: border-box;
	}
	.entry-textarea:focus { outline: none; border-color: var(--accent); }
	.entry-textarea::placeholder { font-family: inherit; font-size: var(--font-size-caption1); color: var(--text-muted); }

	/* Drop zone */
	.drop-zone {
		display: flex; flex-direction: column; align-items: center; justify-content: center;
		padding: var(--spacing-xl) var(--spacing-lg);
		border: 2px dashed var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-primary);
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s;
		gap: var(--spacing-xs);
	}
	.drop-zone:hover, .drop-zone.drag-over { border-color: var(--accent); background: var(--accent-light); }
	.drop-zone.compact { padding: var(--spacing-lg) var(--spacing-md); }
	.drop-icon { font-size: 28px; color: var(--text-muted); }
	.drop-zone.compact .drop-icon { font-size: 20px; }
	.drop-text { font-size: var(--font-size-callout); color: var(--text-secondary); }
	.drop-hint { font-size: var(--font-size-caption1); color: var(--text-muted); }

	.toggle-label { display: flex; align-items: center; gap: var(--spacing-sm); cursor: pointer; font-weight: 400 !important; }
	.toggle-label input[type="checkbox"] { width: 18px; height: 18px; accent-color: var(--accent); }
	.toggle-hint { font-size: var(--font-size-caption1); color: var(--text-muted); font-weight: 400; }

	.actions { display: flex; justify-content: flex-end; gap: var(--spacing-md); margin-top: var(--spacing-xl); }
	.cancel-btn {
		padding: var(--spacing-md) var(--spacing-xl); border: 1px solid var(--border-color);
		border-radius: var(--radius-md); background: var(--bg-secondary); color: var(--text-secondary);
		font-size: var(--font-size-body); text-decoration: none; transition: border-color 0.15s;
	}
	.cancel-btn:hover { border-color: var(--text-secondary); }
	.save-btn {
		padding: var(--spacing-md) var(--spacing-xl); background: var(--accent); color: white;
		border: none; border-radius: var(--radius-md); font-size: var(--font-size-body);
		font-weight: 600; cursor: pointer; transition: opacity 0.15s;
	}
	.save-btn:hover { opacity: 0.9; }
	.save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

	/* Lightbox */
	.lightbox {
		position: fixed; inset: 0; z-index: 1000;
		background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; cursor: pointer;
	}
	.lightbox-img { max-width: 90vw; max-height: 90vh; object-fit: contain; border-radius: var(--radius-md); cursor: default; }
	.lightbox-close {
		position: absolute; top: 16px; right: 16px; width: 36px; height: 36px; border-radius: 50%;
		background: rgba(255,255,255,0.15); color: white; border: none; font-size: 18px; cursor: pointer;
		display: flex; align-items: center; justify-content: center;
	}
	.lightbox-close:hover { background: rgba(255,255,255,0.3); }

	@media (max-width: 600px) {
		.row { grid-template-columns: 1fr; }
		.image-entry { grid-template-columns: 1fr; }
		.entry-image { aspect-ratio: 16/9; }
	}
</style>
