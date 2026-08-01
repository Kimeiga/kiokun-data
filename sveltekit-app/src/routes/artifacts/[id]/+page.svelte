<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import Header from '$lib/components/Header.svelte';
	import { useSession } from '$lib/auth-client';
	import { getDictionaryUrl } from '$lib/shard-utils';
	import { dev } from '$app/environment';
	import { segmentText, isWordToken } from '$lib/utils/segment';

	const session = useSession();

	interface SentenceWord {
		id: string;
		sentenceId: string;
		wordSlug: string;
		surfaceForm: string;
		position: number;
		dictionaryForm: string | null;
		reading: string | null;
		gloss: string | null;
		conjugation: string | null;
	}

	interface Sentence {
		id: string;
		artifactId: string;
		originalText: string;
		translation: string | null;
		sortOrder: number;
		words: SentenceWord[];
	}

	interface ArtifactImage {
		id: string;
		artifactId: string;
		imageUrl: string;
		sortOrder: number;
	}

	interface ArtifactDetail {
		id: string;
		userId: string;
		title: string;
		description: string | null;
		language: string;
		type: string;
		isPublic: boolean;
		createdAt: string;
		updatedAt: string;
		user: { id: string; name: string; image: string | null } | null;
		images: ArtifactImage[];
		sentences: Sentence[];
	}

	let artifact = $state<ArtifactDetail | null>(null);
	let loading = $state(true);
	let errorMsg = $state('');

	// Sentence input
	let newSentenceText = $state('');
	let newSentenceTranslation = $state('');
	let addingSentence = $state(false);

	// Annotation toggles — readings and glosses are precomputed in sentence_words
	let showReadings = $state(true);
	let showGlosses = $state(true);

	// Image upload
	let uploadingImage = $state(false);
	let fileInput = $state<HTMLInputElement>();
	let lightboxUrl = $state<string | null>(null);

	// Paste handler for Cmd+V image paste on the detail page
	function handlePaste(event: ClipboardEvent) {
		if (!isOwner() || !artifact) return;
		const items = event.clipboardData?.items;
		if (!items) return;

		for (const item of items) {
			if (item.type.startsWith('image/')) {
				const file = item.getAsFile();
				if (file) {
					event.preventDefault();
					uploadImageFile(file);
				}
			}
		}
	}

	async function uploadImageFile(file: File) {
		if (!artifact) return;
		uploadingImage = true;
		try {
			const formData = new FormData();
			formData.append('image', file);
			const resp = await fetch(`/api/artifacts/${artifact.id}/images`, {
				method: 'POST',
				body: formData,
			});
			if (resp.ok) await loadArtifact();
		} catch {
			// ignore
		} finally {
			uploadingImage = false;
		}
	}

	// Dictionary panel state
	let selectedWord = $state<string | null>(null);
	let panelOpen = $state(false);
	let panelData = $state<any>(null);
	let panelLoading = $state(false);

	// Edit mode
	let isEditing = $state(false);
	let editTitle = $state('');
	let editDescription = $state('');
	let editLanguage = $state('');
	let editType = $state('');
	let editIsPublic = $state(true);

	const artifactId = $derived($page.params.id);

	$effect(() => {
		if (artifactId) loadArtifact();
	});

	async function loadArtifact() {
		loading = true;
		errorMsg = '';
		try {
			const resp = await fetch(`/api/artifacts/${artifactId}`);
			if (!resp.ok) {
				if (resp.status === 404) {
					errorMsg = 'Artifact not found';
				} else {
					errorMsg = 'Failed to load artifact';
				}
				return;
			}
			artifact = await resp.json();
		} catch {
			errorMsg = 'Failed to load artifact';
		} finally {
			loading = false;
		}
	}

	function isOwner(): boolean {
		return !!($session.data?.user && artifact && $session.data.user.id === artifact.userId);
	}

	// ===== Sentence Management =====

	async function addSentence() {
		if (!newSentenceText.trim() || !artifact) return;
		addingSentence = true;

		try {
			const resp = await fetch(`/api/artifacts/${artifact.id}/sentences`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					originalText: newSentenceText.trim(),
					translation: newSentenceTranslation.trim() || null,
				}),
			});

			if (resp.ok) {
				newSentenceText = '';
				newSentenceTranslation = '';
				await loadArtifact();
			}
		} catch {
			// ignore
		} finally {
			addingSentence = false;
		}
	}

	async function addSentenceForImage(imageId: string) {
		if (!newSentenceText.trim() || !artifact) return;
		addingSentence = true;

		try {
			const lines = newSentenceText.trim().split(/\n+/).filter(l => l.trim());

			for (const line of lines) {
				await fetch(`/api/artifacts/${artifact.id}/sentences`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						originalText: line.trim(),
						imageId,
					}),
				});
			}

			newSentenceText = '';
			await loadArtifact();
		} catch {
			// ignore
		} finally {
			addingSentence = false;
		}
	}

	async function deleteSentence(sentenceId: string) {
		if (!artifact || !confirm('Delete this sentence?')) return;

		try {
			await fetch(`/api/artifacts/${artifact.id}/sentences`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sentenceId }),
			});
			await loadArtifact();
		} catch {
			// ignore
		}
	}

	// ===== Image Upload =====

	function triggerImageUpload() {
		fileInput?.click();
	}

	async function handleImageUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file || !artifact) return;

		uploadingImage = true;
		try {
			const formData = new FormData();
			formData.append('image', file);

			const resp = await fetch(`/api/artifacts/${artifact.id}/images`, {
				method: 'POST',
				body: formData,
			});

			if (resp.ok) {
				await loadArtifact();
			}
		} catch {
			// ignore
		} finally {
			uploadingImage = false;
			input.value = '';
		}
	}

	async function deleteImage(imageId: string) {
		if (!artifact || !confirm('Delete this image?')) return;
		try {
			await fetch(`/api/artifacts/${artifact.id}/images`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ imageId }),
			});
			await loadArtifact();
		} catch {
			// ignore
		}
	}

	// ===== Dictionary Panel =====

	async function fetchDictEntry(word: string): Promise<any> {
		try {
			const url = await getDictionaryUrl(word, dev, fetch);
			const resp = await fetch(url);
			if (!resp.ok) return null;
			const { inflateSync } = await import('fflate');
			const compressed = new Uint8Array(await resp.arrayBuffer());
			const decompressed = inflateSync(compressed);
			const json = new TextDecoder().decode(decompressed);
			const data = JSON.parse(json);
			// Follow redirects (e.g., simplified → traditional)
			if (data.redirect) {
				return await fetchDictEntry(data.redirect);
			}
			return data;
		} catch {
			return null;
		}
	}

	// Japanese verb deconjugation: try common dictionary forms
	// e.g., 剥が → 剥がす, 取り除い → 取り除く
	function guessJapaneseDictionaryForms(stem: string): string[] {
		const guesses: string[] = [];
		const lastChar = stem.slice(-1);

		// Godan verb stems: map stem ending → dictionary ending
		const godanMap: Record<string, string[]> = {
			'か': ['く'], 'き': ['く'], 'い': ['く', 'いる', 'う'],
			'が': ['がす', 'がる', 'ぐ'], 'ぎ': ['ぐ'],
			'さ': ['す'], 'し': ['す', 'する'],
			'た': ['つ'], 'ち': ['つ'],
			'な': ['ぬ'], 'に': ['ぬ'],
			'ば': ['ぶ'], 'び': ['ぶ'],
			'ま': ['む'], 'み': ['む'],
			'ら': ['る'], 'り': ['る'],
			'わ': ['う'],
			'っ': ['る', 'つ', 'う'], // 残っ → 残る, 持っ → 持つ
			'え': ['える'], 'け': ['ける'], 'せ': ['せる'],
			'て': ['てる'], 'ね': ['ねる'], 'べ': ['べる'],
			'め': ['める'], 'れ': ['れる'],
		};

		const endings = godanMap[lastChar];
		if (endings) {
			const stemBase = stem.slice(0, -1);
			for (const ending of endings) {
				guesses.push(stemBase + ending);
			}
		}

		// Also try the stem itself + common suffixes
		guesses.push(stem + 'る', stem + 'す', stem + 'く', stem + 'む');

		return guesses;
	}

	async function openWordPanel(wordSlug: string) {
		selectedWord = wordSlug;
		panelOpen = true;
		panelData = null;
		panelLoading = true;

		try {
			// 1. Try direct lookup
			let data = await fetchDictEntry(wordSlug);

			// 2. If not found and it's Japanese, try deconjugation
			if (!data && artifact?.language === 'ja') {
				const guesses = guessJapaneseDictionaryForms(wordSlug);
				for (const guess of guesses) {
					data = await fetchDictEntry(guess);
					if (data) {
						// Found via deconjugation — update display to show dictionary form
						selectedWord = wordSlug + ' → ' + guess;
						break;
					}
				}
			}

			// 3. If still not found, try compound splitting
			if (!data && wordSlug.length >= 2) {
				for (let i = 1; i < wordSlug.length; i++) {
					const left = wordSlug.slice(0, i);
					const right = wordSlug.slice(i);
					if (left.length < 2 && right.length < 2) continue;

					const [leftData, rightData] = await Promise.all([
						fetchDictEntry(left),
						fetchDictEntry(right),
					]);

					if (leftData && rightData) {
						selectedWord = left + ' + ' + right;
						// Merge both entries for display — use the left one as primary,
						// store both so the panel can show combined definitions
						panelData = { _compound: true, left: leftData, right: rightData, leftWord: left, rightWord: right };
						break;
					}
				}
				if (!panelData) panelData = data;
			} else {
				panelData = data;
			}
		} catch {
			panelData = null;
		} finally {
			panelLoading = false;
		}
	}

	function closePanel() {
		panelOpen = false;
		selectedWord = null;
		panelData = null;
	}

	function navigateToWord() {
		if (selectedWord) {
			if (panelData) goto(`/${encodeURIComponent(selectedWord)}`);
			else goto(`/search?q=${encodeURIComponent(selectedWord)}`);
		}
	}

	// ===== Rendering Helpers =====

	// Check if text is all kana (hiragana or katakana) — no need to show reading above these
	function isAllKana(text: string): boolean {
		return /^[\u3040-\u309F\u30A0-\u30FF\u31F0-\u31FF\u3200-\u32FF\uFF65-\uFF9Fー]+$/.test(text);
	}

	// Should we show a reading annotation for this token?
	function shouldShowReading(token: RenderToken): boolean {
		if (!token.reading) return false;
		// Skip if the surface form is already kana (reading would be redundant)
		if (isAllKana(token.text)) return false;
		// Skip if reading equals the surface form
		if (token.reading === token.text) return false;
		return true;
	}

	interface RenderToken {
		text: string;
		isWord: boolean;
		wordSlug: string | null;
		dictionaryForm: string | null;
		reading: string | null;
		gloss: string | null;
		conjugation: string | null;
	}

	function renderSentenceTokens(sentence: Sentence): RenderToken[] {
		const { originalText, words } = sentence;

		if (words.length === 0) {
			const segments = segmentText(originalText, artifact?.language || 'ja');
			return segments.map(seg => ({
				text: seg,
				isWord: isWordToken(seg),
				wordSlug: isWordToken(seg) ? seg : null,
				dictionaryForm: null,
				reading: null,
				gloss: null,
				conjugation: null,
			}));
		}

		const tokens: RenderToken[] = [];
		let cursor = 0;

		const sortedWords = [...words].sort((a, b) => a.position - b.position);

		for (const w of sortedWords) {
			if (w.position > cursor) {
				tokens.push({ text: originalText.slice(cursor, w.position), isWord: false, wordSlug: null, dictionaryForm: null, reading: null, gloss: null, conjugation: null });
			}
			tokens.push({
				text: w.surfaceForm,
				isWord: true,
				wordSlug: w.wordSlug,
				dictionaryForm: w.dictionaryForm || null,
				reading: w.reading || null,
				gloss: w.gloss || null,
				conjugation: w.conjugation || null,
			});
			cursor = w.position + w.surfaceForm.length;
		}

		if (cursor < originalText.length) {
			tokens.push({ text: originalText.slice(cursor), isWord: false, wordSlug: null, dictionaryForm: null, reading: null, gloss: null, conjugation: null });
		}

		return tokens;
	}

	function getDefinitionPreview(data: any): string {
		if (!data) return '';

		// Try Chinese definitions first
		if (data.chinese_words?.length > 0) {
			const cw = data.chinese_words[0];
			for (const item of cw.items || []) {
				if (item.definitions?.length > 0) {
					return item.definitions[0];
				}
			}
		}

		// Try Japanese definitions
		if (data.japanese_words?.length > 0) {
			const jw = data.japanese_words[0];
			for (const sense of jw.sense || []) {
				for (const gloss of sense.gloss || []) {
					if (gloss.text) return gloss.text;
				}
			}
		}

		// Try Korean definitions
		if (data.korean_words?.length > 0) {
			const kw = data.korean_words[0];
			if (kw.definitions?.length > 0) {
				return kw.definitions[0].text || '';
			}
		}

		return '';
	}

	function getPronunciation(data: any): string {
		if (!data) return '';

		if (data.chinese_words?.length > 0) {
			return data.chinese_words[0].pinyinSearchString || '';
		}

		if (data.japanese_words?.length > 0) {
			const jw = data.japanese_words[0];
			if (jw.kana?.length > 0) return jw.kana[0].text;
		}

		return '';
	}

	// ===== Edit Mode =====

	function startEditing() {
		if (!artifact) return;
		editTitle = artifact.title;
		editDescription = artifact.description || '';
		editLanguage = artifact.language;
		editType = artifact.type;
		editIsPublic = artifact.isPublic;
		isEditing = true;
	}

	async function saveEdits() {
		if (!artifact) return;
		try {
			const resp = await fetch(`/api/artifacts/${artifact.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: editTitle.trim(),
					description: editDescription.trim() || null,
					language: editLanguage,
					type: editType,
					isPublic: editIsPublic,
				}),
			});
			if (resp.ok) {
				isEditing = false;
				await loadArtifact();
			}
		} catch {
			// ignore
		}
	}

	async function deleteArtifact() {
		if (!artifact || !confirm('Delete this artifact and all its sentences? This cannot be undone.')) return;
		try {
			const resp = await fetch(`/api/artifacts/${artifact.id}`, { method: 'DELETE' });
			if (resp.ok) {
				await goto('/artifacts');
			}
		} catch {
			// ignore
		}
	}

	function langLabel(lang: string): string {
		return lang === 'zh' ? '🇨🇳 Chinese' : lang === 'ja' ? '🇯🇵 Japanese' : lang === 'ko' ? '🇰🇷 Korean' : lang;
	}

	function typeLabel(type: string): string {
		const labels: Record<string, string> = {
			packaging: '📦 Packaging', sign: '🪧 Sign', menu: '🍜 Menu',
			book: '📖 Book', media: '📺 Media', other: '📎 Other',
		};
		return labels[type] || type;
	}
</script>

<svelte:window onpaste={handlePaste} />

<svelte:head>
	<title>{artifact?.title || 'Artifact'} - Kiokun</title>
</svelte:head>

<Header currentWord="" />

<main id="main-content" class="layout" class:panel-open={panelOpen}>
	<div class="main-content">
		{#if loading}
			<p class="status">Loading...</p>
		{:else if errorMsg}
			<p class="status">{errorMsg}</p>
		{:else if artifact}
			<!-- Artifact Header -->
			<div class="artifact-header">
				{#if isEditing}
					<div class="edit-form">
						<input type="text" bind:value={editTitle} class="edit-input title-input" placeholder="Title" />
						<textarea bind:value={editDescription} class="edit-input" rows="2" placeholder="Description"></textarea>
						<div class="edit-row">
							<select bind:value={editLanguage} class="edit-input">
								<option value="zh">🇨🇳 Chinese</option>
								<option value="ja">🇯🇵 Japanese</option>
								<option value="ko">🇰🇷 Korean</option>
							</select>
							<select bind:value={editType} class="edit-input">
								<option value="packaging">📦 Packaging</option>
								<option value="sign">🪧 Sign</option>
								<option value="menu">🍜 Menu</option>
								<option value="book">📖 Book</option>
								<option value="media">📺 Media</option>
								<option value="other">📎 Other</option>
							</select>
						</div>
						<label class="toggle-label">
							<input type="checkbox" bind:checked={editIsPublic} />
							<span>{editIsPublic ? 'Public' : 'Private'}</span>
						</label>
						<div class="edit-actions segmented-grid">
							<button class="btn-secondary segmented-cell" onclick={() => isEditing = false}>Cancel</button>
							<button class="btn-primary segmented-cell" onclick={saveEdits}>Save</button>
						</div>
					</div>
				{:else}
					<div class="header-top">
						<div>
							<div class="header-badges">
								<span class="badge">{langLabel(artifact.language)}</span>
								<span class="badge">{typeLabel(artifact.type)}</span>
								{#if !artifact.isPublic}
									<span class="badge badge-private">🔒 Private</span>
								{/if}
							</div>
							<h1>{artifact.title}</h1>
							{#if artifact.description}
								<p class="description">{artifact.description}</p>
							{/if}
							<div class="header-meta">
								{#if artifact.user}
									<span>by {artifact.user.name}</span>
								{/if}
							</div>
						</div>
						{#if isOwner()}
							<div class="header-actions segmented-grid">
								<button class="btn-secondary segmented-cell" onclick={startEditing}>Edit</button>
								<button class="btn-danger segmented-cell" onclick={deleteArtifact}>Delete</button>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Images & Text Section -->
			<section class="section">
				<div class="section-header">
					<h2>Images & Text</h2>
					<div class="annotation-toggles segmented-grid">
						<button
							class="toggle-pill segmented-cell"
							class:active={showReadings}
							aria-pressed={showReadings}
							onclick={() => showReadings = !showReadings}
						>
							{showReadings ? 'Readings on' : 'Readings off'}
						</button>
						<button
							class="toggle-pill segmented-cell"
							class:active={showGlosses}
							aria-pressed={showGlosses}
							onclick={() => showGlosses = !showGlosses}
						>
							{showGlosses ? 'Glosses on' : 'Glosses off'}
						</button>
					</div>
					{#if isOwner()}
						<button class="btn-secondary btn-sm" onclick={triggerImageUpload} disabled={uploadingImage}>
							{uploadingImage ? 'Uploading...' : '+ Add Photo'}
						</button>
						<input
							type="file"
							accept="image/jpeg,image/png,image/gif,image/webp"
							bind:this={fileInput}
							onchange={handleImageUpload}
							style="display: none;"
						/>
					{/if}
				</div>

				{#if artifact.images.length > 0}
					<div class="image-text-list">
						{#each artifact.images as img (img.id)}
							{@const imageSentences = artifact.sentences.filter((s: any) => s.imageId === img.id)}
							<div class="image-text-row">
								<div class="it-image">
									<button class="gallery-click" onclick={() => lightboxUrl = img.imageUrl} title="View full size">
										<img src={img.imageUrl} alt={`Image from ${artifact.title}`} loading="lazy" decoding="async" />
									</button>
									{#if isOwner()}
										<button class="img-delete" onclick={() => deleteImage(img.id)} title="Delete image">x</button>
									{/if}
								</div>
								<div class="it-text">
									{#if imageSentences.length > 0}
										{#each imageSentences as sentence (sentence.id)}
											<div class="sentence-card">
												<div class="sentence-text">
													{#each renderSentenceTokens(sentence) as token}
														{#if token.isWord}
															<span class="annotated-word">
																{#if showReadings && shouldShowReading(token)}
																	<span class="word-reading">{token.reading}</span>
																{/if}
																<button
																	class="word-token"
																	class:selected={selectedWord === token.wordSlug}
																	onclick={() => openWordPanel(token.wordSlug!)}
																>{token.text}</button>
																{#if showGlosses}
																	<span class="word-gloss">{token.gloss || ''}{#if token.conjugation && token.dictionaryForm} ({token.dictionaryForm}){/if}</span>
																{/if}
															</span>
														{:else}
															<span class="non-word">{token.text}</span>
														{/if}
													{/each}
												</div>
												{#if sentence.translation}
													<div class="sentence-translation">{sentence.translation}</div>
												{/if}
												{#if isOwner()}
													<button class="sentence-delete" onclick={() => deleteSentence(sentence.id)}>Remove</button>
												{/if}
											</div>
										{/each}
									{:else}
										<p class="empty-text-sm">No text yet for this image</p>
									{/if}
									{#if isOwner()}
										<div class="add-sentence-inline">
											<textarea
												bind:value={newSentenceText}
												placeholder="Paste text from this image..."
												class="sentence-input"
												rows="2"
											></textarea>
											<button
												class="btn-primary btn-sm"
												onclick={() => addSentenceForImage(img.id)}
												disabled={addingSentence || !newSentenceText.trim()}
											>
												{addingSentence ? 'Adding...' : 'Add'}
											</button>
										</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<p class="empty-text">No photos yet{isOwner() ? ' — paste or upload photos to get started' : ''}</p>
				{/if}

				<!-- Standalone sentences (not tied to any image) -->
				{#if artifact.sentences.filter((s: any) => !s.imageId).length > 0}
					<div class="section-header" style="margin-top: var(--spacing-xl);">
						<h3>Other Sentences</h3>
					</div>
					<div class="sentences-list divider-grid mobile-full-bleed">
						{#each artifact.sentences.filter((s: any) => !s.imageId) as sentence (sentence.id)}
							<div class="sentence-card divider-cell">
								<div class="sentence-text">
									{#each renderSentenceTokens(sentence) as token}
										{#if token.isWord}
											<button
												class="word-token"
												class:selected={selectedWord === token.wordSlug}
												onclick={() => openWordPanel(token.wordSlug!)}
											>{token.text}</button>
										{:else}
											<span class="non-word">{token.text}</span>
										{/if}
									{/each}
								</div>
								{#if sentence.translation}
									<div class="sentence-translation">{sentence.translation}</div>
								{/if}
								{#if isOwner()}
									<button class="sentence-delete" onclick={() => deleteSentence(sentence.id)}>Remove</button>
								{/if}
							</div>
						{/each}
					</div>
				{/if}

				{#if isOwner()}
					<div class="add-sentence-form">
						<textarea
							bind:value={newSentenceText}
							placeholder="Add a sentence not tied to a specific image..."
							class="sentence-input"
							rows="2"
						></textarea>
						<button
							class="btn-primary btn-sm"
							onclick={addSentence}
							disabled={addingSentence || !newSentenceText.trim()}
						>
							{addingSentence ? 'Adding...' : 'Add Sentence'}
						</button>
					</div>
				{/if}
			</section>
		{/if}
	</div>

	<!-- Dictionary Side Panel (desktop) / Bottom Sheet (mobile) -->
	{#if panelOpen}
		<button
			type="button"
			class="panel-overlay"
			aria-label="Close dictionary panel"
			onclick={closePanel}
		></button>
		<div class="dictionary-panel">
			<div class="panel-header">
				<h3 class="panel-word">{selectedWord}</h3>
				<div class="panel-header-actions">
					{#if panelData}
						<button class="panel-navigate" onclick={navigateToWord} title="Open full word page">Open →</button>
					{/if}
					<button class="panel-close" onclick={closePanel}>×</button>
				</div>
			</div>
			<div class="panel-body">
				{#if panelLoading}
					<p class="panel-loading">Loading...</p>
				{:else if panelData?._compound}
					<!-- Compound word: show both parts -->
					{#each [{ word: panelData.leftWord, data: panelData.left }, { word: panelData.rightWord, data: panelData.right }] as part}
						<div class="compound-part">
							<h4 class="compound-word">{part.word}</h4>
							{#if part.data.japanese_words?.length > 0}
								{#each part.data.japanese_words.slice(0, 1) as jw}
									{#if jw.kana?.length > 0}
										<div class="panel-reading">{jw.kana.map((k: any) => k.text).join(', ')}</div>
									{/if}
									{#each jw.sense?.slice(0, 2) || [] as sense}
										<ol class="panel-defs">
											{#each sense.gloss || [] as gloss}
												<li>{gloss.text}</li>
											{/each}
										</ol>
									{/each}
								{/each}
							{/if}
							{#if part.data.chinese_words?.length > 0}
								{#each part.data.chinese_words[0].items?.slice(0, 1) || [] as item}
									{#if item.pinyin}<span class="panel-pinyin">{item.pinyin}</span>{/if}
									<ol class="panel-defs">
										{#each item.definitions?.slice(0, 3) || [] as def}
											<li>{def}</li>
										{/each}
									</ol>
								{/each}
							{/if}
						</div>
					{/each}
				{:else if panelData}
					<!-- Chinese definitions -->
					{#if panelData.chinese_words?.length > 0}
						{#each panelData.chinese_words as cw}
							{#each cw.items || [] as item, i}
								{#if item.definitions?.length}
									<div class="panel-sense">
										{#if item.pinyin}
											<span class="panel-pinyin">{item.pinyin}</span>
										{/if}
										<ol class="panel-defs">
											{#each item.definitions as def}
												<li>{def}</li>
											{/each}
										</ol>
									</div>
								{/if}
							{/each}
						{/each}
					{/if}

					<!-- Japanese definitions -->
					{#if panelData.japanese_words?.length > 0}
						{#each panelData.japanese_words.slice(0, 3) as jw}
							{#if jw.kana?.length > 0}
								<div class="panel-reading">
									{jw.kana.map((k: any) => k.text).join(', ')}
								</div>
							{/if}
							{#each jw.sense?.slice(0, 3) || [] as sense}
								<div class="panel-sense">
									{#if sense.partOfSpeech?.length > 0}
										<span class="panel-pos">{sense.partOfSpeech.join(', ')}</span>
									{/if}
									<ol class="panel-defs">
										{#each sense.gloss || [] as gloss}
											<li>{gloss.text}</li>
										{/each}
									</ol>
								</div>
							{/each}
						{/each}
					{/if}

					<!-- Korean definitions -->
					{#if panelData.korean_words?.length > 0}
						{#each panelData.korean_words.slice(0, 3) as kw}
							<div class="panel-sense">
								{#if kw.hangul}
									<span class="panel-reading">{kw.hangul}</span>
								{/if}
								<ol class="panel-defs">
									{#each kw.definitions || [] as def}
										<li>{def.text}</li>
									{/each}
								</ol>
							</div>
						{/each}
					{/if}

					{#if !panelData.chinese_words?.length && !panelData.japanese_words?.length && !panelData.korean_words?.length}
						<p class="panel-empty">No dictionary entry found</p>
					{/if}
				{:else}
					<p class="panel-empty">No dictionary entry found for "{selectedWord}"</p>
					<p class="panel-hint">You can still <button class="link-btn" onclick={navigateToWord}>search for it</button></p>
				{/if}
			</div>
		</div>
	{/if}
</main>

<!-- Image Lightbox -->
{#if lightboxUrl}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="lightbox" onclick={() => lightboxUrl = null} onkeydown={(e) => { if (e.key === 'Escape') lightboxUrl = null; }}>
		<button class="lightbox-close" onclick={() => lightboxUrl = null}>x</button>
		<img src={lightboxUrl} alt="Full size" class="lightbox-img" />
	</div>
{/if}

<style>
	.layout {
		max-width: 960px;
		margin: 0 auto;
		padding: var(--spacing-xl);
		position: relative;
	}

	/* When panel is open on desktop, shrink main content */
	@media (min-width: 769px) {
		.layout.panel-open {
			max-width: 1280px;
			display: grid;
			grid-template-columns: 1fr 380px;
			gap: var(--spacing-xl);
		}
		.layout.panel-open .panel-overlay { display: none; }
	}

	.main-content { min-width: 0; }

	.status { text-align: center; padding: 40px; color: var(--text-secondary); }

	/* Header */
	.artifact-header {
		margin-bottom: var(--spacing-xl);
		padding-bottom: var(--spacing-xl);
		border-bottom: 1px solid var(--border-color);
	}
	.header-top { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--spacing-lg); }
	.header-badges { display: flex; gap: var(--spacing-sm); margin-bottom: var(--spacing-md); flex-wrap: wrap; }
	.badge {
		padding: var(--spacing-xs) var(--spacing-md);
		background: var(--bg-tertiary);
		border-radius: var(--radius-full);
		font-size: var(--font-size-caption1);
		color: var(--text-secondary);
	}
	.badge-private { background: rgba(231, 76, 60, 0.1); color: var(--color-error); }

	h1 { font-size: var(--font-size-title); font-weight: 700; color: var(--text-primary); margin: 0; font-family: var(--font-cjk); }
	.description { font-size: var(--font-size-body); color: var(--text-secondary); margin: var(--spacing-sm) 0 0; line-height: 1.5; }
	.header-meta { font-size: var(--font-size-caption1); color: var(--text-muted); margin-top: var(--spacing-sm); }
	.header-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); flex-shrink: 0; }

	/* Edit form */
	.edit-form { display: flex; flex-direction: column; gap: var(--spacing-md); }
	.edit-input {
		width: 100%;
		padding: var(--spacing-md);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-primary);
		color: var(--text-primary);
		font-size: var(--font-size-body);
		font-family: inherit;
		box-sizing: border-box;
	}
	.edit-input:focus { outline: none; border-color: var(--accent); }
	.title-input { font-size: var(--font-size-headline); font-weight: 600; }
	.edit-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md); }
	.edit-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	.toggle-label { display: flex; align-items: center; gap: var(--spacing-sm); font-size: var(--font-size-body); color: var(--text-primary); cursor: pointer; }
	.toggle-label input { width: 18px; height: 18px; accent-color: var(--accent); }

	/* Buttons */
	.btn-primary {
		padding: var(--spacing-md) var(--spacing-xl);
		background: var(--accent);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		font-size: var(--font-size-callout);
		font-weight: 600;
		cursor: pointer;
		transition: opacity 0.15s;
	}
	.btn-primary:hover { opacity: 0.9; }
	.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
	.btn-secondary {
		padding: var(--spacing-sm) var(--spacing-lg);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-secondary);
		color: var(--text-secondary);
		font-size: var(--font-size-callout);
		cursor: pointer;
		transition: border-color 0.15s;
	}
	.btn-secondary:hover { border-color: var(--text-secondary); }
	.btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
	.btn-danger {
		padding: var(--spacing-sm) var(--spacing-lg);
		border: 1px solid var(--color-error);
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-error);
		font-size: var(--font-size-callout);
		cursor: pointer;
		transition: background 0.15s;
	}
	.btn-danger:hover { background: rgba(231, 76, 60, 0.1); }
	.btn-sm { padding: var(--spacing-sm) var(--spacing-lg); font-size: var(--font-size-caption1); }

	/* Sections */
	.section { margin-bottom: var(--spacing-xl); }
	.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-lg); }
	.section-header h2 { font-size: var(--font-size-headline); font-weight: 600; color: var(--text-primary); margin: 0; }
	.empty-text { color: var(--text-muted); font-size: var(--font-size-callout); }

	/* Image + Text Rows */
	.image-text-list { display: flex; flex-direction: column; gap: var(--spacing-xl); }

	.image-text-row {
		display: grid;
		grid-template-columns: 240px 1fr;
		gap: var(--spacing-lg);
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		padding: var(--spacing-lg);
	}

	.it-image {
		position: relative;
		border-radius: var(--radius-md);
		overflow: hidden;
		aspect-ratio: 4/3;
	}
	.it-text { display: flex; flex-direction: column; gap: var(--spacing-sm); }

	.empty-text-sm { color: var(--text-muted); font-size: var(--font-size-caption1); margin: 0; }

	.add-sentence-inline {
		display: flex; gap: var(--spacing-sm); margin-top: var(--spacing-sm);
	}
	.add-sentence-inline .sentence-input { flex: 1; font-size: var(--font-size-callout); }

	.gallery-click {
		display: block; width: 100%; height: 100%; padding: 0; border: none; background: none; cursor: pointer;
	}
	.gallery-click img { width: 100%; height: 100%; object-fit: cover; border-radius: var(--radius-md); }
	.img-delete {
		position: absolute;
		top: var(--spacing-sm);
		right: var(--spacing-sm);
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: rgba(0,0,0,0.6);
		color: white;
		border: none;
		font-size: 18px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity 0.15s;
	}
	.it-image:hover .img-delete,
	.img-delete:focus-visible { opacity: 1; }

	/* Sentences */
	.sentences-list { grid-template-columns: 1fr; }

	.sentence-card {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		padding: var(--spacing-lg);
		position: relative;
	}

	.sentence-text {
		font-size: var(--font-size-headline);
		line-height: 1.4;
		font-family: var(--font-cjk);
		color: var(--text-primary);
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 2px 0;
	}

	/* Annotation toggles */
	.annotation-toggles { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: stretch; }
	.toggle-pill {
		padding: 4px 12px;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-full);
		background: var(--bg-secondary);
		color: var(--text-muted);
		font-size: var(--font-size-caption1);
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s, background 0.15s;
	}
	.toggle-pill.active { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }
	/* Annotated words */
	.annotated-word {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		vertical-align: bottom;
		margin: 0 1px;
	}
	.word-reading {
		font-size: 10px;
		color: var(--color-pinyin);
		line-height: 1.2;
		min-height: 13px;
		white-space: nowrap;
	}
	.word-gloss {
		font-size: 9px;
		color: var(--text-muted);
		line-height: 1.2;
		min-height: 11px;
		max-width: 80px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: center;
	}

	.word-token {
		display: inline;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		padding: 0 1px;
		margin: 0;
		font: inherit;
		color: inherit;
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
		border-radius: 2px;
	}
	.word-token:hover {
		border-bottom-color: var(--accent);
		color: var(--accent);
	}
	.word-token.selected {
		border-bottom-color: var(--accent);
		color: var(--accent);
		background: var(--accent-light);
	}

	.non-word { display: inline; align-self: flex-end; }

	.sentence-translation {
		font-size: var(--font-size-body);
		color: var(--text-secondary);
		margin-top: var(--spacing-sm);
		font-style: italic;
	}

	.sentence-delete {
		position: absolute;
		top: var(--spacing-sm);
		right: var(--spacing-sm);
		padding: var(--spacing-xs) var(--spacing-sm);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		background: var(--bg-secondary);
		color: var(--text-muted);
		font-size: var(--font-size-caption1);
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.15s, color 0.15s;
	}
	.sentence-card:hover .sentence-delete { opacity: 1; }
	.sentence-delete:hover { color: var(--color-error); border-color: var(--color-error); }

	/* Add Sentence Form */
	.add-sentence-form {
		margin-top: var(--spacing-lg);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
		padding: var(--spacing-lg);
		border: 1px dashed var(--border-color);
		border-radius: var(--radius-md);
	}
	.sentence-input {
		width: 100%;
		padding: var(--spacing-md);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-primary);
		color: var(--text-primary);
		font-size: var(--font-size-body);
		font-family: inherit;
		box-sizing: border-box;
	}
	.sentence-input { font-family: var(--font-cjk); font-size: var(--font-size-headline); }
	.sentence-input:focus { outline: none; border-color: var(--accent); }

	/* Dictionary Panel */
	.panel-overlay {
		appearance: none;
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		padding: 0;
		border: 0;
		background: rgba(0,0,0,0.3);
		z-index: 200;
		cursor: default;
	}

	.dictionary-panel {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		z-index: 201;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* Desktop: right sidebar */
	@media (min-width: 769px) {
		.dictionary-panel {
			border-radius: var(--radius-lg);
			position: sticky;
			top: 80px;
			max-height: calc(100vh - 100px);
		}
	}

	/* Mobile: bottom sheet */
	@media (max-width: 768px) {
		.dictionary-panel {
			position: fixed;
			bottom: 0;
			left: 0;
			right: 0;
			max-height: 60vh;
			border-radius: var(--radius-lg) var(--radius-lg) 0 0;
			box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
		}
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-lg);
		border-bottom: 1px solid var(--border-color);
		flex-shrink: 0;
	}
	.panel-word {
		font-size: var(--font-size-title);
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
		font-family: var(--font-cjk);
	}
	.panel-header-actions { display: flex; gap: var(--spacing-sm); align-items: center; }
	.panel-navigate {
		padding: var(--spacing-xs) var(--spacing-md);
		border: 1px solid var(--accent);
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--accent);
		font-size: var(--font-size-caption1);
		cursor: pointer;
		transition: background 0.15s;
	}
	.panel-navigate:hover { background: var(--accent-light); }
	.panel-close {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: 1px solid var(--border-color);
		background: var(--bg-secondary);
		color: var(--text-secondary);
		font-size: 20px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: border-color 0.15s;
	}
	.panel-close:hover { border-color: var(--text-secondary); }

	.panel-body {
		padding: var(--spacing-lg);
		overflow-y: auto;
		flex: 1;
	}
	.panel-loading, .panel-empty { color: var(--text-muted); font-size: var(--font-size-callout); }
	.panel-reading { font-size: var(--font-size-body); color: var(--accent); margin-bottom: var(--spacing-sm); }
	.panel-pinyin { font-size: var(--font-size-callout); color: var(--color-pinyin); display: block; margin-bottom: var(--spacing-xs); }
	.panel-pos { font-size: var(--font-size-caption1); color: var(--text-muted); font-style: italic; display: block; margin-bottom: var(--spacing-xs); }
	.panel-sense { margin-bottom: var(--spacing-md); }
	.compound-part {
		padding-bottom: var(--spacing-md);
		margin-bottom: var(--spacing-md);
		border-bottom: 1px solid var(--border-color);
	}
	.compound-part:last-child { border-bottom: none; margin-bottom: 0; }
	.compound-word { font-size: var(--font-size-headline); font-family: var(--font-cjk); color: var(--accent); margin: 0 0 var(--spacing-xs); font-weight: 600; }
	.panel-defs {
		margin: 0;
		padding-left: var(--spacing-xl);
		font-size: var(--font-size-body);
		color: var(--text-primary);
		line-height: 1.6;
	}
	.panel-hint { font-size: var(--font-size-caption1); color: var(--text-muted); }
	.link-btn {
		background: none;
		border: none;
		color: var(--accent);
		cursor: pointer;
		font: inherit;
		text-decoration: underline;
		padding: 0;
	}

	/* Lightbox */
	.lightbox {
		position: fixed; inset: 0; z-index: 1000;
		background: rgba(0,0,0,0.85);
		display: flex; align-items: center; justify-content: center;
		cursor: pointer;
	}
	.lightbox-img { max-width: 90vw; max-height: 90vh; object-fit: contain; border-radius: var(--radius-md); cursor: default; }
	.lightbox-close {
		position: absolute; top: 16px; right: 16px;
		width: 36px; height: 36px; border-radius: 50%;
		background: rgba(255,255,255,0.15); color: white;
		border: none; font-size: 18px; cursor: pointer;
		display: flex; align-items: center; justify-content: center;
	}
	.lightbox-close:hover { background: rgba(255,255,255,0.3); }

	@media (max-width: 768px) {
		.header-top { flex-direction: column; }
		.header-actions { margin-top: var(--spacing-md); }
		.edit-row { grid-template-columns: 1fr; }
		.image-text-row { grid-template-columns: 1fr; }
		.it-image { aspect-ratio: 16/9; }
		.add-sentence-inline { flex-direction: column; }
	}
</style>
