<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import { goto } from '$app/navigation';
	import { useSession } from '$lib/auth-client';
	import { getDictionaryUrl } from '$lib/shard-utils';
	import { dev } from '$app/environment';

	const session = useSession();

	let language = $state<'zh' | 'ja' | 'ko'>('zh');
	let saving = $state(false);
	let error = $state('');
	let conflictChecking = $state(false);

	// Chinese fields
	let simplified = $state('');
	let traditional = $state('');
	let pinyin = $state('');
	let jyutping = $state('');

	// Japanese fields
	let kanji = $state('');
	let kana = $state('');

	// Korean fields
	let hangul = $state('');
	let hanja = $state('');

	// Common fields
	let definitions = $state<string[]>(['']);
	let partOfSpeech = $state<string[]>([]);
	let notes = $state('');

	const allPartsOfSpeech = [
		'noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition',
		'conjunction', 'interjection', 'particle', 'classifier', 'prefix',
		'suffix', 'idiom', 'phrase', 'expression', 'slang'
	];

	// Derive the canonical word form
	let word = $derived.by(() => {
		if (language === 'zh') return traditional || simplified || '';
		if (language === 'ja') return kanji || kana || '';
		if (language === 'ko') return hangul || '';
		return '';
	});

	function addDefinition() {
		definitions = [...definitions, ''];
	}

	function removeDefinition(index: number) {
		definitions = definitions.filter((_, i) => i !== index);
	}

	function togglePOS(pos: string) {
		if (partOfSpeech.includes(pos)) {
			partOfSpeech = partOfSpeech.filter(p => p !== pos);
		} else {
			partOfSpeech = [...partOfSpeech, pos];
		}
	}

	async function checkConflict(): Promise<boolean> {
		if (!word) return false;
		conflictChecking = true;
		try {
			// Check if a dictionary entry exists for this word
			const url = await getDictionaryUrl(word, dev, fetch);
			const resp = await fetch(url, { method: 'HEAD' });
			if (resp.ok) {
				error = `"${word}" already exists as a dictionary entry. Custom words cannot conflict with existing entries.`;
				return true;
			}
		} catch {
			// Not found in dictionary, that's fine
		}
		conflictChecking = false;
		return false;
	}

	async function handleSubmit() {
		error = '';
		const filteredDefs = definitions.filter(d => d.trim());
		if (!word.trim()) {
			error = 'Please fill in the required word fields';
			return;
		}
		if (filteredDefs.length === 0) {
			error = 'At least one definition is required';
			return;
		}

		// Check for conflicts with existing dictionary entries
		const hasConflict = await checkConflict();
		if (hasConflict) return;

		saving = true;
		try {
			const body: Record<string, unknown> = {
				word: word.trim(),
				language,
				definitions: filteredDefs,
				partOfSpeech: partOfSpeech.length > 0 ? partOfSpeech : undefined,
				notes: notes.trim() || undefined,
			};

			if (language === 'zh') {
				body.simplified = simplified.trim() || undefined;
				body.traditional = traditional.trim() || undefined;
				body.pinyin = pinyin.trim() || undefined;
				body.jyutping = jyutping.trim() || undefined;
			} else if (language === 'ja') {
				body.kanji = kanji.trim() || undefined;
				body.kana = kana.trim() || undefined;
			} else if (language === 'ko') {
				body.hangul = hangul.trim() || undefined;
				body.hanja = hanja.trim() || undefined;
			}

			const resp = await fetch('/api/custom-words', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});

			if (!resp.ok) {
				const data = await resp.json().catch(() => ({ message: 'Failed to create word' }));
				throw new Error(data.message || `Error ${resp.status}`);
			}

			const data = await resp.json();
			await goto(`/${encodeURIComponent(data.word)}`);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create word';
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Create Custom Word - Kiokun</title>
</svelte:head>

<Header currentWord="" />

<main id="main-content" class="page">
	{#if !$session.data?.user}
		<div class="auth-prompt">
			<h1>Sign in Required</h1>
			<p>You need to sign in to create custom words.</p>
		</div>
	{:else}
		<h1 class="page-title">Create Custom Word</h1>

		{#if error}
			<div class="error-box">{error}</div>
		{/if}

		<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
			<!-- Language Selector -->
			<div class="field">
				<div class="label" id="custom-word-language-label">Language</div>
				<div class="lang-tabs segmented-grid mobile-full-bleed" role="group" aria-labelledby="custom-word-language-label">
					<button type="button" class="lang-tab segmented-cell" class:active={language === 'zh'} aria-pressed={language === 'zh'} onclick={() => language = 'zh'}>
						🇨🇳 Chinese
					</button>
					<button type="button" class="lang-tab segmented-cell" class:active={language === 'ja'} aria-pressed={language === 'ja'} onclick={() => language = 'ja'}>
						🇯🇵 Japanese
					</button>
					<button type="button" class="lang-tab segmented-cell" class:active={language === 'ko'} aria-pressed={language === 'ko'} onclick={() => language = 'ko'}>
						🇰🇷 Korean
					</button>
				</div>
			</div>

			<!-- Chinese Fields -->
			{#if language === 'zh'}
				<div class="field-row">
					<div class="field">
						<label class="label" for="traditional">Traditional *</label>
						<input id="traditional" type="text" class="input cjk-input" bind:value={traditional} placeholder="e.g. 經濟" required />
					</div>
					<div class="field">
						<label class="label" for="simplified">Simplified</label>
						<input id="simplified" type="text" class="input cjk-input" bind:value={simplified} placeholder="e.g. 经济" />
					</div>
				</div>
				<div class="field-row">
					<div class="field">
						<label class="label" for="pinyin">Pinyin</label>
						<input id="pinyin" type="text" class="input" bind:value={pinyin} placeholder="e.g. jīngjì" />
					</div>
					<div class="field">
						<label class="label" for="jyutping">Jyutping (Cantonese)</label>
						<input id="jyutping" type="text" class="input" bind:value={jyutping} placeholder="e.g. ging1 zai3" />
					</div>
				</div>
			{/if}

			<!-- Japanese Fields -->
			{#if language === 'ja'}
				<div class="field-row">
					<div class="field">
						<label class="label" for="kanji">Kanji</label>
						<input id="kanji" type="text" class="input cjk-input" bind:value={kanji} placeholder="e.g. 食べる" />
					</div>
					<div class="field">
						<label class="label" for="kana">Kana *</label>
						<input id="kana" type="text" class="input cjk-input" bind:value={kana} placeholder="e.g. たべる" required />
					</div>
				</div>
			{/if}

			<!-- Korean Fields -->
			{#if language === 'ko'}
				<div class="field-row">
					<div class="field">
						<label class="label" for="hangul">Hangul *</label>
						<input id="hangul" type="text" class="input cjk-input" bind:value={hangul} placeholder="e.g. 학교" required />
					</div>
					<div class="field">
						<label class="label" for="hanja">Hanja</label>
						<input id="hanja" type="text" class="input cjk-input" bind:value={hanja} placeholder="e.g. 學校" />
					</div>
				</div>
			{/if}

			<!-- Word Preview -->
			{#if word}
				<div class="preview">
					URL: <code>kiokun.com/{word}</code>
				</div>
			{/if}

			<!-- Part of Speech -->
			<div class="field">
				<div class="label" id="custom-word-pos-label">Part of Speech</div>
				<div class="pos-grid segmented-grid mobile-full-bleed" role="group" aria-labelledby="custom-word-pos-label">
					{#each allPartsOfSpeech as pos}
						<button
							type="button"
							class="pos-chip segmented-cell"
							class:selected={partOfSpeech.includes(pos)}
							aria-pressed={partOfSpeech.includes(pos)}
							onclick={() => togglePOS(pos)}
						>
							{pos}
						</button>
					{/each}
				</div>
			</div>

			<!-- Definitions -->
			<div class="field">
				<div class="label" id="custom-word-definitions-label">Definitions *</div>
				{#each definitions as def, i}
					<div class="def-row">
						<span class="def-num">{i + 1}.</span>
						<input
							type="text"
							class="input def-input"
							bind:value={definitions[i]}
							aria-label={`Definition ${i + 1}`}
							placeholder="Enter definition..."
						/>
						{#if definitions.length > 1}
							<button type="button" class="remove-btn" onclick={() => removeDefinition(i)}>×</button>
						{/if}
					</div>
				{/each}
				<div class="definition-actions divider-grid mobile-full-bleed">
					<button type="button" class="add-btn divider-cell" onclick={addDefinition}>+ Add Definition</button>
				</div>
			</div>

			<!-- Notes -->
			<div class="field">
				<label class="label" for="notes">Notes (optional)</label>
				<textarea id="notes" class="input textarea" bind:value={notes} placeholder="Additional notes, usage examples, etymology..." rows="3"></textarea>
			</div>

			<!-- Submit -->
			<div class="actions divider-grid mobile-full-bleed">
				<button type="submit" class="submit-btn divider-cell" disabled={saving || !word.trim()}>
					{saving ? 'Creating...' : 'Create Word'}
				</button>
				<a href="/" class="cancel-link divider-cell">Cancel</a>
			</div>
		</form>
	{/if}
</main>

<style>
	.page {
		max-width: 640px;
		margin: 0 auto;
		padding: var(--spacing-xl);
	}

	.page-title {
		font-size: var(--font-size-title);
		font-weight: 700;
		color: var(--text-primary);
		margin: 0 0 var(--spacing-xl);
	}

	.auth-prompt {
		text-align: center;
		padding: 60px var(--spacing-xl);
		color: var(--text-secondary);
	}

	.auth-prompt h1 {
		font-size: var(--font-size-headline);
		color: var(--text-primary);
		margin-bottom: var(--spacing-md);
	}

	.error-box {
		padding: var(--spacing-md) var(--spacing-lg);
		background: rgba(231, 76, 60, 0.1);
		border: 1px solid rgba(231, 76, 60, 0.3);
		border-radius: var(--radius-md);
		color: var(--color-error);
		margin-bottom: var(--spacing-xl);
		font-size: var(--font-size-body);
	}

	.field {
		margin-bottom: var(--spacing-xl);
		flex: 1;
	}

	.field-row {
		display: flex;
		gap: var(--spacing-lg);
	}

	.label {
		display: block;
		font-size: var(--font-size-subhead);
		font-weight: 600;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: var(--spacing-sm);
	}

	.input {
		width: 100%;
		padding: var(--spacing-md) var(--spacing-lg);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-size: var(--font-size-body);
		font-family: inherit;
		transition: border-color 0.15s;
	}

	.input:focus {
		outline: none;
		border-color: var(--accent);
	}

	.cjk-input {
		font-family: var(--font-cjk);
		font-size: var(--font-size-headline);
	}

	.textarea {
		resize: vertical;
		min-height: 80px;
	}

	.lang-tabs {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.lang-tab {
		flex: 1;
		padding: var(--spacing-md) var(--spacing-lg);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-secondary);
		color: var(--text-secondary);
		font-size: var(--font-size-body);
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
	}

	.lang-tab.active {
		border-color: var(--accent);
		color: var(--accent);
		background: var(--accent-light);
	}

	.preview {
		padding: var(--spacing-md) var(--spacing-lg);
		background: var(--bg-tertiary);
		border-radius: var(--radius-md);
		font-size: var(--font-size-callout);
		color: var(--text-secondary);
		margin-bottom: var(--spacing-xl);
	}

	.preview code {
		color: var(--accent);
		font-family: var(--font-mono);
	}

	.pos-grid {
		grid-auto-flow: row;
		grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
	}

	.pos-chip {
		padding: var(--spacing-sm) var(--spacing-md);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-full);
		background: var(--bg-secondary);
		color: var(--text-secondary);
		font-size: var(--font-size-callout);
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
	}

	.pos-chip.selected {
		border-color: var(--accent);
		color: var(--accent);
		background: var(--accent-light);
	}

	.def-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		margin-bottom: var(--spacing-sm);
	}

	.def-num {
		color: var(--text-muted);
		font-size: var(--font-size-callout);
		min-width: 20px;
	}

	.def-input {
		flex: 1;
	}

	.remove-btn {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		background: var(--bg-secondary);
		color: var(--text-muted);
		font-size: 18px;
		cursor: pointer;
		transition: color 0.15s, border-color 0.15s;
	}

	.remove-btn:hover {
		color: var(--color-error);
		border-color: var(--color-error);
	}

	.add-btn {
		width: 100%;
		min-height: 44px;
		padding: var(--spacing-sm) var(--spacing-md);
		border: 1px dashed var(--border-color);
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--accent);
		font-size: var(--font-size-callout);
		cursor: pointer;
		transition: border-color 0.15s;
	}

	.definition-actions { grid-template-columns: 1fr; }

	.add-btn:hover {
		border-color: var(--accent);
	}

	.actions {
		grid-template-columns: 1fr 1fr;
		padding-top: var(--spacing-lg);
	}

	.submit-btn {
		min-height: 44px;
		padding: var(--spacing-md) var(--spacing-xl);
		color: var(--accent);
		font-size: var(--font-size-body);
		font-weight: 600;
		cursor: pointer;
		transition: opacity 0.15s;
	}

	.submit-btn:hover:not(:disabled) {
		opacity: 0.9;
	}

	.submit-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.cancel-link {
		display: flex;
		min-height: 44px;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-md) var(--spacing-xl);
		color: var(--text-secondary);
		text-decoration: none;
		font-size: var(--font-size-body);
	}

	.cancel-link:hover {
		color: var(--text-primary);
	}

	@media (max-width: 768px) {
		.field-row {
			flex-direction: column;
			gap: 0;
		}

		.lang-tabs.segmented-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>
