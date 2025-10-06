<script lang="ts">
	// Demo page that works without Cloudflare bindings
	let notes = $state([
		{
			id: 'demo-1',
			text: 'This is a demo note showing how the app works. In production, this would be stored in Cloudflare D1 database.',
			image_key: null,
			image_url: null,
			created_at: Date.now() - 3600000
		},
		{
			id: 'demo-2',
			text: 'This note demonstrates the image upload feature. In production, images would be stored in Cloudflare R2 object storage.',
			image_key: 'demo-image.jpg',
			image_url: 'https://via.placeholder.com/400x300/3498db/ffffff?text=Demo+Image',
			created_at: Date.now() - 7200000
		},
		{
			id: 'demo-3',
			text: 'You can create notes with or without images. The presigned URL system allows direct browser-to-R2 uploads for maximum performance.',
			image_key: null,
			image_url: null,
			created_at: Date.now() - 10800000
		}
	]);

	let noteText = $state('');
	let demoMode = $state(true);

	function formatDate(timestamp: number): string {
		const date = new Date(timestamp);
		return date.toLocaleString();
	}

	function handleSubmit(event: Event) {
		event.preventDefault();
		
		if (!noteText.trim()) {
			alert('Please enter some text for your note');
			return;
		}

		// Add demo note
		const newNote = {
			id: `demo-${Date.now()}`,
			text: noteText,
			image_key: null,
			image_url: null,
			created_at: Date.now()
		};

		notes = [newNote, ...notes];
		noteText = '';
		
		alert('✅ Demo note created! In production, this would be saved to Cloudflare D1.');
	}

	function handleDelete(id: string) {
		if (confirm('Delete this note?')) {
			notes = notes.filter(n => n.id !== id);
			alert('✅ Demo note deleted! In production, this would be removed from D1 and R2.');
		}
	}
</script>

<svelte:head>
	<title>Demo - Kiokun Notes</title>
</svelte:head>

<div class="container">
	<header class="header">
		<h1>📝 Kiokun Notes - Demo Mode</h1>
		<p>This is a demo showing the UI without requiring Cloudflare setup</p>
		<div class="demo-badge">
			🎭 Demo Mode - No backend required
		</div>
	</header>

	<main>
		<section class="upload-section">
			<h2>Create a New Note</h2>
			<form onsubmit={handleSubmit}>
				<div class="form-group">
					<label for="note-text">Note Text</label>
					<textarea
						id="note-text"
						bind:value={noteText}
						placeholder="Enter your note here..."
						rows="4"
					></textarea>
				</div>

				<div class="demo-notice">
					ℹ️ Image upload is disabled in demo mode. In production, you can upload images to Cloudflare R2.
				</div>

				<button type="submit" class="submit-btn" disabled={!noteText.trim()}>
					Create Demo Note
				</button>
			</form>
		</section>

		<section class="notes-section">
			<h2>Recent Notes ({notes.length})</h2>

			<div class="notes-grid">
				{#each notes as note (note.id)}
					<div class="note-card">
						{#if note.image_url}
							<div class="note-image">
								<img src={note.image_url} alt="Note attachment" />
							</div>
						{/if}

						<div class="note-content">
							<p class="note-text">{note.text}</p>
							<div class="note-footer">
								<span class="note-date">{formatDate(note.created_at)}</span>
								<button class="delete-btn" onclick={() => handleDelete(note.id)}>
									Delete
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</section>

		<section class="info-section">
			<h2>About This Demo</h2>
			<div class="info-content">
				<p><strong>This is a demo version</strong> that works without Cloudflare setup.</p>
				
				<h3>To use the full version with Cloudflare:</h3>
				<ol>
					<li>Create a Cloudflare D1 database: <code>wrangler d1 create kiokun-notes-db</code></li>
					<li>Create a Cloudflare R2 bucket: <code>wrangler r2 bucket create kiokun-images</code></li>
					<li>Update <code>wrangler.toml</code> with your database ID</li>
					<li>Create <code>.dev.vars</code> with your R2 credentials</li>
					<li>Run migrations: <code>wrangler d1 execute kiokun-notes-db --local --file=./migrations/0001_init.sql</code></li>
					<li>Start the dev server: <code>npm run dev</code></li>
					<li>Visit <code>/</code> (not <code>/demo</code>)</li>
				</ol>

				<h3>Features in production:</h3>
				<ul>
					<li>✅ Persistent storage in Cloudflare D1 (5 GB free)</li>
					<li>✅ Image uploads to Cloudflare R2 (10 GB free)</li>
					<li>✅ Presigned URLs for direct browser-to-R2 uploads</li>
					<li>✅ Auto-deploy from GitHub to Cloudflare Pages</li>
					<li>✅ Global edge network for fast performance</li>
				</ul>

				<p><strong>Total free storage: 15 GB</strong> - Best in class!</p>
			</div>
		</section>
	</main>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
			sans-serif;
		background: #f5f5f5;
		color: #333;
	}

	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 20px;
	}

	.header {
		text-align: center;
		margin-bottom: 40px;
		padding: 40px 20px;
		background: white;
		border-radius: 12px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.header h1 {
		margin: 0 0 10px 0;
		font-size: 2.5rem;
		color: #2c3e50;
	}

	.header p {
		margin: 0 0 15px 0;
		font-size: 1.1rem;
		color: #666;
	}

	.demo-badge {
		display: inline-block;
		padding: 8px 16px;
		background: #f39c12;
		color: white;
		border-radius: 20px;
		font-size: 0.9rem;
		font-weight: 600;
	}

	.upload-section {
		background: white;
		padding: 30px;
		border-radius: 12px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		margin-bottom: 40px;
	}

	.upload-section h2 {
		margin: 0 0 20px 0;
		font-size: 1.5rem;
		color: #2c3e50;
	}

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

	.demo-notice {
		padding: 12px;
		background: #fff3cd;
		border: 1px solid #ffc107;
		border-radius: 8px;
		color: #856404;
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

	.notes-section h2 {
		margin: 0 0 20px 0;
		font-size: 1.5rem;
		color: #2c3e50;
	}

	.notes-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 20px;
	}

	.note-card {
		background: white;
		border-radius: 12px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		overflow: hidden;
		transition: transform 0.2s, box-shadow 0.2s;
	}

	.note-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	.note-image {
		width: 100%;
		height: 200px;
		overflow: hidden;
		background: #f0f0f0;
	}

	.note-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.note-content {
		padding: 20px;
	}

	.note-text {
		margin: 0 0 15px 0;
		font-size: 1rem;
		line-height: 1.6;
		color: #333;
		word-wrap: break-word;
	}

	.note-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-top: 15px;
		border-top: 1px solid #eee;
	}

	.note-date {
		font-size: 0.85rem;
		color: #999;
	}

	.delete-btn {
		padding: 6px 12px;
		background: #e74c3c;
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 0.85rem;
		cursor: pointer;
		transition: background 0.2s;
	}

	.delete-btn:hover {
		background: #c0392b;
	}

	.info-section {
		background: white;
		padding: 30px;
		border-radius: 12px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		margin-top: 40px;
	}

	.info-section h2 {
		margin: 0 0 20px 0;
		font-size: 1.5rem;
		color: #2c3e50;
	}

	.info-section h3 {
		margin: 20px 0 10px 0;
		font-size: 1.2rem;
		color: #34495e;
	}

	.info-content {
		line-height: 1.8;
	}

	.info-content code {
		padding: 2px 6px;
		background: #f5f5f5;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
		font-family: 'Monaco', 'Courier New', monospace;
		font-size: 0.9em;
	}

	.info-content ol, .info-content ul {
		margin: 10px 0;
		padding-left: 30px;
	}

	.info-content li {
		margin: 8px 0;
	}
</style>

