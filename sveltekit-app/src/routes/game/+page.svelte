<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { fly } from 'svelte/transition';
	import Engine from '@snap-engine/asset-base-svelte/Engine.svelte';
	import {
		ContainerProgressive as Container,
		ItemProgressive as Item
	} from '@snap-engine/snapsort-svelte';
	import type {
		ContainerProgressive as SnapSortContainer,
		SnapSortDomInsertEvent,
		SnapSortDomRemoveEvent
	} from '@snap-engine/snapsort';
	import { fetchUnifiedExercise, gradeUnifiedAnswer } from '$lib/game/api';
	import { languageStore } from '$lib/game/stores/language.svelte';
	import { chineseScriptStore } from '$lib/game/stores/chineseScript.svelte';
	import { convertChinese } from '$lib/game/chineseConverter';
	import { LANGUAGES, type UnifiedExercise, type TileData, type GradeResult, type ApiTile, type Language, type LanguageExercise } from '$lib/game/types';
	import DictionaryPopup from '$lib/game/DictionaryPopup.svelte';
	import SpeakButton from '$lib/components/shared/SpeakButton.svelte';

	const snapSortAnimation = {
		duration: 180,
		timing_function: 'cubic-bezier(0.2, 0, 0, 1)'
	};

	type TileZone = 'answer' | 'bank';
	type TileSound = 'pickup' | 'drop';

	let answerContainer: SnapSortContainer | undefined = $state();
	let bankContainer: SnapSortContainer | undefined = $state();

	const TILE_SOUND_PATHS: Record<TileSound, string> = {
		pickup: '/sounds/se-pickup.mp3',
		drop: '/sounds/se-drop.mp3'
	};
	const TILE_SOUND_VOLUME = 0.45;
	const TILE_DRAG_SOUND_MOVE_TOL = 6;
	let tileSoundPool: Record<TileSound, HTMLAudioElement[]> | null = null;

	function getTileSoundPool() {
		if (typeof Audio === 'undefined') return null;
		tileSoundPool ??= {
			pickup: createTileSoundPool('pickup'),
			drop: createTileSoundPool('drop')
		};
		return tileSoundPool;
	}

	function createTileSoundPool(sound: TileSound) {
		return Array.from({ length: 3 }, () => {
			const audio = new Audio(TILE_SOUND_PATHS[sound]);
			audio.preload = 'auto';
			audio.volume = TILE_SOUND_VOLUME;
			return audio;
		});
	}

	function playTileSound(sound: TileSound) {
		const pool = getTileSoundPool();
		if (!pool) return;

		const audio = pool[sound].find((candidate) => candidate.paused) ?? pool[sound][0];
		audio.pause();
		audio.currentTime = 0;
		void audio.play().catch(() => {
			// Browsers may reject audio before the first trusted interaction.
		});
	}

	function tileDragSound(node: HTMLElement) {
		let pointerId: number | null = null;
		let dragging = false;
		let startX = 0;
		let startY = 0;

		const cleanup = () => {
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onEnd);
			window.removeEventListener('pointercancel', onEnd);
		};

		const onDown = (event: PointerEvent) => {
			if (event.pointerType === 'mouse' && event.button !== 0) return;
			cleanup();
			pointerId = event.pointerId;
			dragging = false;
			startX = event.clientX;
			startY = event.clientY;
			window.addEventListener('pointermove', onMove);
			window.addEventListener('pointerup', onEnd);
			window.addEventListener('pointercancel', onEnd);
		};

		const onMove = (event: PointerEvent) => {
			if (event.pointerId !== pointerId) return;
			if (dragging) {
				event.preventDefault();
				return;
			}
			const distance = Math.hypot(event.clientX - startX, event.clientY - startY);
			if (distance <= TILE_DRAG_SOUND_MOVE_TOL) return;

			dragging = true;
			event.preventDefault();
			playTileSound('pickup');
		};

		const onEnd = (event: PointerEvent) => {
			if (event.pointerId !== pointerId) return;
			if (dragging) playTileSound('drop');
			pointerId = null;
			dragging = false;
			cleanup();
		};

		node.addEventListener('pointerdown', onDown);

		return {
			destroy() {
				cleanup();
				node.removeEventListener('pointerdown', onDown);
			}
		};
	}

	// --- Tap-to-define (Kiokun integration) ------------------------------------
	// Long-press a tile to look it up in the Kiokun dictionary; a short tap still
	// selects/deselects the tile as before.
	let lookupTarget = $state<string | null>(null);

	/**
	 * Strip duojp's display markup from a tile so it can be used as a dictionary
	 * query: drop (optional) allomorph markers, take the first slash alternative,
	 * and remove punctuation/whitespace. Particle-only fragments will simply
	 * resolve to "no entry" in the popup, which is handled gracefully.
	 */
	function normalizeForLookup(text: string): string {
		let t = text.replace(/\([^)]*\)/g, '');
		if (t.includes('/')) t = t.split('/')[0];
		return t
			.replace(/[\s。、，．！？!?.,…·「」『』（）()【】《》〈〉“”‘’"']/g, '')
			.trim();
	}

	function openLookup(rawText: string) {
		const w = normalizeForLookup(rawText);
		if (w) lookupTarget = w;
	}

	/**
	 * Svelte action: fire `onfire` after a stationary hold (~450ms) and swallow
	 * the click that follows so the tile's select/deselect doesn't also run.
	 * Movement (a drag) cancels the timer so drag-and-drop is unaffected.
	 */
	function longpress(node: HTMLElement, opts: { onfire: () => void }) {
		let current = opts;
		let timer: ReturnType<typeof setTimeout> | null = null;
		let fired = false;
		let moved = false;
		let sx = 0;
		let sy = 0;
		const HOLD_MS = 450;
		const MOVE_TOL = 10;

		const clear = () => {
			if (timer) {
				clearTimeout(timer);
				timer = null;
			}
		};
		const onDown = (e: PointerEvent) => {
			fired = false;
			moved = false;
			sx = e.clientX;
			sy = e.clientY;
			clear();
			timer = setTimeout(() => {
				fired = true;
				current.onfire();
			}, HOLD_MS);
		};
		const onMove = (e: PointerEvent) => {
			if (timer && (Math.abs(e.clientX - sx) > MOVE_TOL || Math.abs(e.clientY - sy) > MOVE_TOL)) {
				moved = true;
				clear();
			}
		};
		const onClickCapture = (e: MouseEvent) => {
			if (fired || moved) {
				e.stopPropagation();
				e.preventDefault();
				fired = false;
				moved = false;
			}
		};

		node.addEventListener('pointerdown', onDown);
		node.addEventListener('pointermove', onMove);
		node.addEventListener('pointerup', clear);
		node.addEventListener('pointercancel', clear);
		node.addEventListener('pointerleave', clear);
		node.addEventListener('click', onClickCapture, true);

		return {
			update(next: { onfire: () => void }) {
				current = next;
			},
			destroy() {
				clear();
				node.removeEventListener('pointerdown', onDown);
				node.removeEventListener('pointermove', onMove);
				node.removeEventListener('pointerup', clear);
				node.removeEventListener('pointercancel', clear);
				node.removeEventListener('pointerleave', clear);
				node.removeEventListener('click', onClickCapture, true);
			}
		};
	}

	let unifiedExercise: UnifiedExercise | null = $state(null);
	let answerTiles: TileData[] = $state([]);
	let bankTiles: TileData[] = $state([]);
	let result: GradeResult | null = $state(null);
	let loading = $state(true);

	// Store answer/bank state per language (ja, zh, ko, tr)
	// For Chinese, both simplified and traditional share the same 'zh' state
	type LanguageState = { answerTiles: TileData[]; bankTiles: TileData[] };
	let languageStates: Record<Language, LanguageState | null> = $state({
		ja: null,
		zh: null,
		ko: null,
		tr: null
	});

	// Get available languages for this exercise (used in template)
	const availableLanguages = $derived.by(() => {
		if (!unifiedExercise) return LANGUAGES;
		return LANGUAGES.filter(l => unifiedExercise!.exercises[l.code]);
	});

	// Get current language exercise
	const currentExercise: LanguageExercise | null = $derived.by(() => {
		if (!unifiedExercise) return null;
		return unifiedExercise.exercises[languageStore.value] ?? null;
	});

	// Helper to convert text for display (Chinese conversion, Korean allomorph styling)
	function displayText(text: string): string {
		if (languageStore.value === 'zh') {
			return convertChinese(text, chineseScriptStore.value);
		}
		return text;
	}

	// Render text with Korean/Turkish optional characters styled (semi-transparent)
	// Patterns: (X)Y -> X is optional, shown faded | X/Y -> both are alternatives
	function renderTileHtml(text: string): string {
		// For Korean and Turkish, handle allomorph patterns
		if (languageStore.value !== 'ko' && languageStore.value !== 'tr') {
			// For other languages, just escape and return
			return escapeHtml(displayText(text));
		}

		// Use language-specific CSS class prefix
		const prefix = languageStore.value === 'ko' ? 'ko' : 'tr';

		// Check for slash pattern (e.g., "이/가", "았/었", "ler/lar", "de/da")
		if (text.includes('/')) {
			const parts = text.split('/');
			if (parts.length === 2) {
				return `<span class="${prefix}-alt">${escapeHtml(parts[0])}</span><span class="${prefix}-slash">/</span><span class="${prefix}-alt">${escapeHtml(parts[1])}</span>`;
			}
		}

		// Check for parentheses pattern (e.g., "(으)면", "(이)에요", "(y)e/a", "(n)in/ın")
		if (text.includes('(') && text.includes(')')) {
			// Parse the pattern: optional part in parens, rest is required
			const match = text.match(/^\(([^)]+)\)(.+)$/);
			if (match) {
				const optional = match[1];
				const required = match[2];
				// Check if rest also contains a slash (e.g., "(y)e/a")
				if (required.includes('/')) {
					const reqParts = required.split('/');
					if (reqParts.length === 2) {
						return `<span class="${prefix}-optional">${escapeHtml(optional)}</span><span class="${prefix}-alt">${escapeHtml(reqParts[0])}</span><span class="${prefix}-slash">/</span><span class="${prefix}-alt">${escapeHtml(reqParts[1])}</span>`;
					}
				}
				return `<span class="${prefix}-optional">${escapeHtml(optional)}</span>${escapeHtml(required)}`;
			}
		}

		return escapeHtml(text);
	}

	// Simple HTML escape for safety
	function escapeHtml(text: string): string {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	}

	// Convert API tiles to internal TileData with stable IDs
	function apiTilesToTileData(apiTiles: ApiTile[]): TileData[] {
		return apiTiles.map((t, index) => ({
			id: `tile-${t.id}`,
			text: t.text,
			originalIndex: index
		}));
	}

	// Keep the current exercise + language in the URL (?id=…&lang=…) so a
	// question can be reloaded or shared exactly. Pure query change — no
	// navigation/reload.
	function syncUrl() {
		if (typeof window === 'undefined' || !unifiedExercise) return;
		const u = new URL(window.location.href);
		u.searchParams.set('id', String(unifiedExercise.exercise_id));
		u.searchParams.set('lang', languageStore.value);
		window.history.replaceState(window.history.state, '', u);
	}

	async function loadExercise(id?: number | string | null) {
		loading = true;
		result = null;
		answerTiles = [];
		// Reset all saved language states for new exercise
		languageStates = { ja: null, zh: null, ko: null, tr: null };
		try {
			unifiedExercise = await fetchUnifiedExercise(id);
			// Initialize tiles for current language
			const langExercise = unifiedExercise.exercises[languageStore.value];
			if (langExercise) {
				bankTiles = apiTilesToTileData(langExercise.tiles);
			} else {
				// Fallback to first available language
				const firstLang = Object.keys(unifiedExercise.exercises)[0] as Language;
				if (firstLang) {
					languageStore.set(firstLang);
					bankTiles = apiTilesToTileData(unifiedExercise.exercises[firstLang]!.tiles);
				}
			}
			// Sync AFTER language is finalized so ?lang= matches what's shown.
			syncUrl();
		} catch (e) {
			console.error('Failed to load exercise:', e);
		} finally {
			loading = false;
		}
	}

	// Save current language state
	function saveCurrentLanguageState() {
		const currentLang = languageStore.value;
		languageStates[currentLang] = {
			answerTiles: [...answerTiles],
			bankTiles: [...bankTiles]
		};
	}

	// Switch language client-side (no API call!)
	function switchToLanguage(lang: Language) {
		if (!unifiedExercise || !unifiedExercise.exercises[lang]) return;

		// Save current state before switching
		saveCurrentLanguageState();

		languageStore.set(lang);
		result = null;

		// Check if we have saved state for this language
		const savedState = languageStates[lang];
		if (savedState) {
			// Restore saved state
			answerTiles = [...savedState.answerTiles];
			bankTiles = [...savedState.bankTiles];
		} else {
			// Initialize fresh tiles for new language
			answerTiles = [];
			bankTiles = apiTilesToTileData(unifiedExercise.exercises[lang]!.tiles);
		}
		// Reflect the language in the shareable URL.
		syncUrl();
	}

	function containerForZone(zone: TileZone): SnapSortContainer | undefined {
		return zone === 'answer' ? answerContainer : bankContainer;
	}

	function updateTileZone(tileId: string, targetZone: TileZone, targetIndex: number) {
		const allTiles = [...answerTiles, ...bankTiles];
		const movedTile = allTiles.find((tile) => tile.id === tileId);
		if (!movedTile) return;

		const nextAnswerTiles = answerTiles.filter((tile) => tile.id !== tileId);
		const nextBankTiles = bankTiles.filter((tile) => tile.id !== tileId);
		const targetTiles = targetZone === 'answer' ? nextAnswerTiles : nextBankTiles;
		const destinationIndex = Math.max(0, Math.min(targetIndex, targetTiles.length));

		targetTiles.splice(destinationIndex, 0, movedTile);
		answerTiles = nextAnswerTiles;
		bankTiles = nextBankTiles;
	}

	function handleSnapSortDomInsert(event: SnapSortDomInsertEvent) {
		const itemId = event.itemMetadata.itemId;
		if (typeof itemId !== 'string') return;

		const targetZone = event.containerMetadata.zone;
		if (targetZone !== 'answer' && targetZone !== 'bank') return;

		updateTileZone(itemId, targetZone, event.index);
	}

	function handleSnapSortDomRemove(event: SnapSortDomRemoveEvent) {
		const itemId = event.itemMetadata.itemId;
		if (typeof itemId !== 'string') return;

		answerTiles = answerTiles.filter((tile) => tile.id !== itemId);
		bankTiles = bankTiles.filter((tile) => tile.id !== itemId);
	}

	function moveTileToZone(tile: TileData, targetZone: TileZone) {
		const sourceZone: TileZone = answerTiles.some((candidate) => candidate.id === tile.id)
			? 'answer'
			: 'bank';
		const sourceContainer = containerForZone(sourceZone);
		const targetContainer = containerForZone(targetZone);
		const fallbackIndex = targetZone === 'answer' ? answerTiles.length : bankTiles.length;

		if (sourceContainer && targetContainer) {
			const movedBySnapSort = sourceContainer.moveItem(tile.id, targetContainer, fallbackIndex);
			if (movedBySnapSort) return;
		}

		updateTileZone(tile.id, targetZone, fallbackIndex);
	}

	// Click-to-move: bank → answer (append to end)
	function selectTile(tile: TileData) {
		moveTileToZone(tile, 'answer');
	}

	// Click-to-move: answer → bank (return to bank)
	function deselectTile(tile: TileData) {
		moveTileToZone(tile, 'bank');
	}

	function handleTileKeydown(event: KeyboardEvent, tile: TileData, targetZone: TileZone) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		moveTileToZone(tile, targetZone);
	}

	// Reset: return all tiles to bank and clear saved state
	function resetTiles() {
		if (currentExercise) {
			bankTiles = apiTilesToTileData(currentExercise.tiles);
			answerTiles = [];
			// Also clear saved state for current language
			languageStates[languageStore.value] = null;
		}
	}

	function submit() {
		if (!currentExercise || answerTiles.length === 0) return;
		const userTokens = answerTiles.map((t) => t.text);
		// Client-side grading with Korean-aware token comparison
		result = gradeUnifiedAnswer(currentExercise, userTokens, languageStore.value);
	}

	// Listen-to-answer TTS. For JA/ZH/KO we reuse Kiokun's shared SpeakButton
	// (platform-aware voice-quality selection — matches the dictionary popup).
	// Turkish has no SpeakButton voice set, so it falls back to the basic
	// Web Speech path below.
	const answerSpeakLang = $derived(
		languageStore.value === 'ja' || languageStore.value === 'zh' || languageStore.value === 'ko'
			? (languageStore.value as 'ja' | 'zh' | 'ko')
			: null
	);

	const SPEECH_LANG: Record<Language, string> = {
		ja: 'ja-JP',
		zh: 'zh-CN',
		ko: 'ko-KR',
		tr: 'tr-TR'
	};
	let speaking = $state(false);

	function speakAnswer() {
		if (!currentExercise) return;
		if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

		// Cancel anything already queued so repeated clicks restart cleanly
		window.speechSynthesis.cancel();

		const utterance = new SpeechSynthesisUtterance(displayText(currentExercise.text));
		utterance.lang =
			languageStore.value === 'zh' && chineseScriptStore.value === 'traditional'
				? 'zh-TW'
				: SPEECH_LANG[languageStore.value];
		utterance.rate = 0.9;
		utterance.onstart = () => { speaking = true; };
		utterance.onend = () => { speaking = false; };
		utterance.onerror = () => { speaking = false; };
		window.speechSynthesis.speak(utterance);
	}

	// "Copy Ask" — copy the exercise context plus questions for an LLM.
	let debugCopied = $state(false);
	let askExtra = $state(''); // optional extra questions, one per line
	const DEFAULT_QUESTIONS = [
		'Is this an accurate, natural translation of the English?',
		'I built the "Current answer tiles" above. What did I get wrong, and what mistaken assumption led to it?',
		'Briefly explain the grammar of the correct answer so I understand the pattern.'
	];

	async function copyAsk() {
		if (!unifiedExercise || !currentExercise) return;

		const langCode = languageStore.value;
		const langNames: Record<string, string> = { ja: 'Japanese', zh: 'Chinese', ko: 'Korean', tr: 'Turkish' };

		const extra = askExtra
			.split('\n')
			.map((q) => q.trim())
			.filter(Boolean);
		const questions = [...DEFAULT_QUESTIONS, ...extra]
			.map((q, i) => `${i + 1}. ${q}`)
			.join('\n');

		const context = `## Debug Context for duojp Exercise

**English:** ${unifiedExercise.english}
**Language:** ${langNames[langCode]} (${langCode})
**Target text:** ${currentExercise.text}
**Expected tokens:** ${JSON.stringify(currentExercise.tokens)}

**Current answer tiles:** ${JSON.stringify(answerTiles.map(t => t.text))}
**Bank tiles:** ${JSON.stringify(bankTiles.map(t => t.text))}
**All tiles:** ${JSON.stringify(currentExercise.tiles.map(t => t.text))}

${result ? `**Last result:** ${result.correct ? 'Correct' : 'Incorrect'}
**Expected:** ${result.expected}` : ''}

**Exercise ID:** ${unifiedExercise.exercise_id}

## Questions

${questions}
`;

		try {
			await navigator.clipboard.writeText(context);
			debugCopied = true;
			setTimeout(() => { debugCopied = false; }, 2000);
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}

	// Set class on document for Traditional Chinese font selection
	$effect(() => {
		if (typeof document !== 'undefined') {
			document.documentElement.classList.toggle('zh-traditional', chineseScriptStore.value === 'traditional');
		}
	});

	onMount(() => {
		getTileSoundPool();
		// Resume a shared/reloaded question (?id=) in its shared language
		// (?lang=) if present; otherwise random in the current language.
		const params = new URLSearchParams(window.location.search);
		const sharedLang = params.get('lang');
		if (sharedLang === 'ja' || sharedLang === 'zh' || sharedLang === 'ko' || sharedLang === 'tr') {
			languageStore.set(sharedLang);
		}
		loadExercise(params.get('id'));
	});
</script>

<main>
	{#if loading}
		<div class="loading">Loading...</div>
	{:else if unifiedExercise && currentExercise}
		<section class="prompt">
			<p class="label">Translate this sentence:</p>
			<p class="english">{unifiedExercise.english}</p>
		</section>

		<!-- Language switcher - client-side, no reload! -->
		{#if availableLanguages.length > 0}
			<nav class="language-switcher">
				{#each availableLanguages as lang}
					<button
						class="lang-btn"
						class:active={lang.code === 'zh'
							? (languageStore.value === 'zh' && chineseScriptStore.value === 'simplified')
							: languageStore.value === lang.code}
						onclick={() => {
							switchToLanguage(lang.code);
							// When clicking China flag, set to simplified
							if (lang.code === 'zh') {
								chineseScriptStore.set('simplified');
							}
						}}
						title={lang.code === 'zh' ? 'Simplified Chinese' : lang.name}
					>
						{lang.flag}
					</button>
					<!-- Taiwan flag right after China flag -->
					{#if lang.code === 'zh'}
						<button
							class="lang-btn"
							class:active={languageStore.value === 'zh' && chineseScriptStore.value === 'traditional'}
							onclick={() => {
								if (languageStore.value !== 'zh') {
									switchToLanguage('zh');
								}
								chineseScriptStore.set('traditional');
							}}
							title="Traditional Chinese"
						>
							🇹🇼
						</button>
					{/if}
				{/each}
			</nav>
		{/if}

		<div class="snapsort-engine" data-lang={languageStore.value}>
			<Engine id="sentence-builder-snapsort">
				<Container
					className="sentence-builder-root"
					config={{ direction: 'column', name: 'sentence-builder-root', noDrop: true }}
					locked={true}
					metadata={{ purpose: 'sentence-builder' }}
				>
					<!-- Answer Area: Drop zone for building the sentence -->
					<Container
						className="answer-area answer-box"
						bind:container={answerContainer}
						config={{
							direction: 'row',
							name: 'sentence-answer',
							groupID: 'sentence-builder',
							dropArea: true,
							animation: {
								reorder: snapSortAnimation,
								drop: snapSortAnimation,
								clickMove: snapSortAnimation
							},
							callbacks: {
								onDomInsert: handleSnapSortDomInsert,
								onDomRemove: handleSnapSortDomRemove,
								afterDomMutation: tick
							}
						}}
						locked={true}
						metadata={{ zone: 'answer' }}
					>
						{#each answerTiles as tile (tile.id)}
							<Item className="tile-wrapper" metadata={{ itemId: tile.id }}>
								<div
									role="button"
									tabindex="0"
									class="tile selected"
									use:tileDragSound
									use:longpress={{ onfire: () => openLookup(tile.text) }}
									onclick={() => deselectTile(tile)}
									onkeydown={(event) => handleTileKeydown(event, tile, 'bank')}
									aria-label={displayText(tile.text)}
									title="Tap to remove · hold to define"
								>
									{@html renderTileHtml(tile.text)}
								</div>
							</Item>
						{/each}
						{#if answerTiles.length === 0}
							<span class="placeholder">Drag tiles here or click to add</span>
						{/if}
					</Container>

					<!-- Word Bank: Source tiles to pick from -->
					<Container
						className="tile-bank-container tile-bank"
						bind:container={bankContainer}
						config={{
							direction: 'row',
							mainAxisAlign: 'center',
							name: 'sentence-bank',
							groupID: 'sentence-builder',
							dropArea: true,
							animation: {
								reorder: snapSortAnimation,
								drop: snapSortAnimation,
								clickMove: snapSortAnimation
							},
							callbacks: {
								onDomInsert: handleSnapSortDomInsert,
								onDomRemove: handleSnapSortDomRemove,
								afterDomMutation: tick
							}
						}}
						locked={true}
						metadata={{ zone: 'bank' }}
					>
						{#each bankTiles as tile (tile.id)}
							<Item className="tile-wrapper" metadata={{ itemId: tile.id }}>
								<div
									role="button"
									tabindex="0"
									class="tile"
									use:tileDragSound
									use:longpress={{ onfire: () => openLookup(tile.text) }}
									onclick={() => selectTile(tile)}
									onkeydown={(event) => handleTileKeydown(event, tile, 'answer')}
									aria-label={displayText(tile.text)}
									title="Tap to add · hold to define"
								>
									{@html renderTileHtml(tile.text)}
								</div>
							</Item>
						{/each}
					</Container>
				</Container>
			</Engine>
			<p class="snapengine-credit">
				<a href="https://snap-engine-js.vercel.app/" target="_blank" rel="noreferrer">
					Powered by SnapEngineJS
				</a>
			</p>
		</div>

		<section class="actions">
			<button class="btn secondary" onclick={resetTiles} disabled={answerTiles.length === 0}>
				Reset
			</button>
			<button class="btn primary" onclick={submit} disabled={answerTiles.length === 0}>
				Check
			</button>
		</section>

		{#if result}
			<section class="result" class:correct={result.correct} class:incorrect={!result.correct} transition:fly={{ y: 20 }}>
				{#if result.correct}
					<div class="result-icon">✓</div>
					<p class="result-text">Correct! 🎉</p>
				{:else}
					<div class="result-icon">✗</div>
					<p class="result-text">Not quite right</p>
					<p class="expected">Expected: {displayText(result.expected)}</p>
				{/if}
				{#if currentExercise && answerSpeakLang}
					<span class="speak-answer-wrap">
						<SpeakButton
							text={displayText(currentExercise.text)}
							lang={answerSpeakLang}
							size={20}
							label="Listen"
							pill={true}
						/>
					</span>
				{:else}
					<button
						class="btn speak"
						class:speaking
						onclick={speakAnswer}
						title="Listen to the correct answer"
						aria-label="Listen to the correct answer"
					>
						🔊 Listen
					</button>
				{/if}
				<button class="btn next" onclick={() => loadExercise()}>Next Exercise →</button>
			</section>
		{/if}

		<!-- Copy Ask: context + standard + custom questions for an LLM -->
		<div class="ask-box">
			<input
				class="ask-input"
				type="text"
				bind:value={askExtra}
				placeholder="extra question for the LLM (optional)"
				onkeydown={(e) => e.key === 'Enter' && copyAsk()}
			/>
			<button class="debug-copy-btn" onclick={copyAsk} title="Copy context + questions for an LLM">
				{debugCopied ? '✓ Copied!' : '📋 Copy Ask'}
			</button>
		</div>
	{/if}

	<DictionaryPopup
		word={lookupTarget}
		lang={languageStore.value}
		onclose={() => (lookupTarget = null)}
	/>
</main>

<style>
	main {
		width: 100%;
		max-width: 600px;
		margin: 0 auto;
		padding: 1rem;
		box-sizing: border-box;
	}

	.language-switcher {
		display: flex;
		justify-content: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.lang-btn {
		padding: 0.4rem 0.6rem;
		border: 2px solid var(--border-color);
		border-radius: 8px;
		background: var(--bg-secondary);
		font-size: 1.2rem;
		cursor: pointer;
		transition: all 0.15s ease;
		opacity: 0.6;
	}

	.lang-btn:hover {
		opacity: 1;
		transform: scale(1.1);
	}

	.lang-btn.active {
		opacity: 1;
		border-color: var(--green-primary);
		background: var(--bg-tertiary);
	}

	.loading {
		text-align: center;
		color: var(--text-secondary);
		font-size: 1.2rem;
		padding: 2rem;
	}

	.prompt {
		background: var(--bg-secondary);
		padding: 1.5rem;
		border-radius: 16px;
		margin-bottom: 1.5rem;
		box-shadow: 0 2px 8px var(--shadow-color);
	}

	.label {
		color: var(--text-secondary);
		margin: 0 0 0.5rem;
		font-size: 0.9rem;
	}

	.english {
		font-size: 1.4rem;
		color: var(--text-primary);
		margin: 0;
		font-weight: 500;
	}

	/* Answer area - where user builds the sentence */
	.snapsort-engine {
		position: relative;
		width: 100%;
		max-width: 100%;
		min-width: 0;
		box-sizing: border-box;
	}

	.snapsort-engine :global(.sentence-builder-root) {
		width: 100%;
		max-width: 100%;
		min-width: 0;
		box-sizing: border-box;
		gap: 0;
	}

	.snapsort-engine :global(.answer-area) {
		width: 100%;
		max-width: 100%;
		min-width: 0;
		box-sizing: border-box;
		margin-bottom: 1.5rem;
	}

	.snapsort-engine :global(.answer-box) {
		position: relative;
		width: 100%;
		max-width: 100%;
		min-width: 0;
		min-height: 112px;
		box-sizing: border-box;
		background: var(--bg-secondary);
		border: 2px dashed var(--border-dashed);
		border-radius: 16px;
		padding: 0.75rem;
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: flex-start;
		align-content: flex-start;
		gap: 0.25rem;
		transition: border-color 0.2s, background-color 0.2s;
	}

	.placeholder {
		position: absolute;
		top: 1.25rem;
		left: 1.25rem;
		color: var(--text-muted);
		font-style: italic;
		padding: 0.5rem;
		pointer-events: none;
	}

	/* Word bank - source tiles */
	.snapsort-engine :global(.tile-bank-container) {
		width: 100%;
		background: var(--bg-tertiary);
		border-radius: 16px;
		padding: 0.75rem;
		margin-bottom: 1rem;
		box-sizing: border-box;
	}

	.snapsort-engine :global(.tile-bank) {
		width: 100%;
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		min-height: 60px;
		gap: 0.25rem;
		align-content: flex-start;
	}

	.snapengine-credit {
		margin: 0.35rem 0 1rem;
		color: var(--text-muted);
		font-size: 0.8rem;
		text-align: center;
	}

	.snapengine-credit a {
		color: inherit;
		text-decoration: none;
	}

	.snapengine-credit a:hover,
	.snapengine-credit a:focus-visible {
		text-decoration: underline;
	}

	.snapsort-engine :global(.answer-box .tile-wrapper),
	.snapsort-engine :global(.tile-bank .tile-wrapper) {
		display: inline-flex;
		padding: 0;
		align-items: center;
		justify-content: center;
		touch-action: none;
	}

	.snapsort-engine :global(.ghost) {
		background: var(--border-color);
		border-radius: 12px;
		opacity: 0.55;
	}

	/* Tile styling - base */
	.tile {
		padding: 0.6rem 1rem;
		border: 2px solid var(--tile-border);
		border-radius: 12px;
		background: var(--tile-bg);
		color: var(--text-primary);
		font-size: 1.1rem;
		line-height: 1.4;
		min-height: 1.4em;
		cursor: grab;
		transition: all 0.15s ease;
		box-shadow: 0 2px 0 var(--tile-shadow);
		font-family: 'Geist', sans-serif;
		user-select: none;
		-webkit-user-select: none;
		touch-action: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	/* Language-specific fonts for tiles */
	[data-lang='ja'] .tile {
		font-family: 'Zen Kaku Gothic New', 'Noto Sans JP', sans-serif;
	}

	[data-lang='zh'] .tile {
		font-family: 'Noto Sans SC', 'PingFang SC', sans-serif;
	}

	/* Traditional Chinese - check if user has Taiwan script selected */
	:global(.zh-traditional) [data-lang='zh'] .tile {
		font-family: 'Noto Sans TC', 'PingFang TC', sans-serif;
	}

	[data-lang='ko'] .tile {
		font-family: 'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif;
	}

	[data-lang='tr'] .tile {
		font-family: 'Geist', sans-serif;
	}

	.tile:hover {
		background: var(--bg-tertiary);
		transform: translateY(-1px);
	}

	.tile:active {
		cursor: grabbing;
		transform: translateY(2px);
		box-shadow: none;
	}

	.tile.selected {
		background: var(--blue-primary);
		color: white;
		border-color: var(--blue-dark);
		box-shadow: 0 2px 0 var(--blue-dark);
	}

	.tile.selected:hover {
		filter: brightness(1.1);
	}

	/* Korean allomorph styling - optional/alternative characters */
	.tile :global(.ko-optional) {
		opacity: 0.45;
	}

	.tile :global(.ko-alt) {
		opacity: 0.85;
	}

	.tile :global(.ko-slash) {
		opacity: 0.4;
		font-size: 0.85em;
		margin: 0 0.05em;
	}

	/* Adjust opacity for selected tiles (on blue background) */
	.tile.selected :global(.ko-optional) {
		opacity: 0.5;
	}

	.tile.selected :global(.ko-alt) {
		opacity: 0.9;
	}

	.tile.selected :global(.ko-slash) {
		opacity: 0.5;
	}

	/* Turkish allomorph styling - vowel harmony variants */
	.tile :global(.tr-optional) {
		opacity: 0.45;
	}

	.tile :global(.tr-alt) {
		opacity: 0.85;
	}

	.tile :global(.tr-slash) {
		opacity: 0.4;
		font-size: 0.85em;
		margin: 0 0.05em;
	}

	/* Adjust opacity for selected tiles (on blue background) */
	.tile.selected :global(.tr-optional) {
		opacity: 0.5;
	}

	.tile.selected :global(.tr-alt) {
		opacity: 0.9;
	}

	.tile.selected :global(.tr-slash) {
		opacity: 0.5;
	}

	/* Actions */
	.actions {
		display: flex;
		gap: 1rem;
		justify-content: center;
		margin-top: 1.5rem;
	}

	.btn {
		padding: 0.75rem 2rem;
		border: none;
		border-radius: 12px;
		font-size: 1rem;
		font-weight: 600;
		font-family: 'Geist', sans-serif;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn.primary {
		background: var(--green-primary);
		color: white;
		box-shadow: 0 4px 0 var(--green-dark);
	}

	.btn.primary:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.btn.primary:active:not(:disabled) {
		transform: translateY(4px);
		box-shadow: none;
	}

	.btn.secondary {
		background: var(--bg-secondary);
		color: var(--text-secondary);
		border: 2px solid var(--border-color);
		box-shadow: 0 4px 0 var(--border-color);
	}

	.btn.secondary:hover:not(:disabled) {
		background: var(--bg-tertiary);
	}

	.btn.secondary:active:not(:disabled) {
		transform: translateY(4px);
		box-shadow: none;
	}

	/* Result panel */
	.result {
		margin-top: 1.5rem;
		padding: 1.5rem;
		border-radius: 16px;
		text-align: center;
	}

	.result.correct {
		background: #d7ffb8;
		border: 2px solid var(--green-primary);
	}

	:global(.dark) .result.correct {
		background: rgba(74, 222, 128, 0.2);
	}

	.result.incorrect {
		background: #ffdfe0;
		border: 2px solid #ff4b4b;
	}

	:global(.dark) .result.incorrect {
		background: rgba(248, 113, 113, 0.2);
	}

	.result-icon {
		font-size: 2rem;
		margin-bottom: 0.5rem;
	}

	.result.correct .result-icon {
		color: var(--green-primary);
	}

	.result.incorrect .result-icon {
		color: #ff4b4b;
	}

	.result-text {
		font-size: 1.2rem;
		font-weight: 600;
		margin: 0 0 0.5rem;
		color: var(--text-primary);
	}

	.expected {
		color: var(--text-secondary);
		margin: 0.5rem 0 1rem;
		font-size: 1.1rem;
	}

	.btn.next {
		background: var(--blue-primary);
		color: white;
		box-shadow: 0 4px 0 var(--blue-dark);
	}

	.btn.next:hover {
		filter: brightness(1.1);
	}

	.btn.next:active {
		transform: translateY(4px);
		box-shadow: none;
	}

	/* Listen / TTS button */
	/* Kiokun SpeakButton (JA/ZH/KO): the shared component renders the whole
	   pill (icon + "Listen" label) as one click target via its `pill`/`label`
	   props. This wrapper only provides spacing from the Next button. */
	.speak-answer-wrap {
		display: inline-flex;
		margin-right: 0.75rem;
		vertical-align: middle;
	}

	.btn.speak {
		background: var(--bg-secondary);
		color: var(--text-primary);
		border: 2px solid var(--border-color);
		box-shadow: 0 4px 0 var(--border-color);
		margin-right: 0.75rem;
	}

	.btn.speak:hover {
		background: var(--bg-tertiary);
	}

	.btn.speak:active {
		transform: translateY(4px);
		box-shadow: none;
	}

	.btn.speak.speaking {
		border-color: var(--blue-primary);
		color: var(--blue-primary);
		animation: speak-pulse 1s ease-in-out infinite;
	}

	@keyframes speak-pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.6; }
	}

	/* Copy Ask - small, unobtrusive, bottom-left */
	.ask-box {
		position: fixed;
		bottom: 1rem;
		left: 1rem;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		max-width: min(22rem, calc(100vw - 2rem));
		opacity: 0.55;
		transition: opacity 0.2s;
		z-index: 50;
	}
	.ask-box:hover,
	.ask-box:focus-within {
		opacity: 1;
	}
	.ask-input {
		flex: 1;
		min-width: 0;
		padding: 0.45rem 0.6rem;
		font-size: 0.75rem;
		background: var(--bg-secondary);
		color: var(--text-primary);
		border: 1px solid var(--border-color);
		border-radius: 6px;
	}
	.ask-input::placeholder {
		color: var(--text-muted);
	}
	.debug-copy-btn {
		flex: none;
		padding: 0.45rem 0.7rem;
		font-size: 0.75rem;
		white-space: nowrap;
		background: var(--bg-tertiary);
		color: var(--text-muted);
		border: 1px solid var(--border-color);
		border-radius: 6px;
		cursor: pointer;
		transition: background 0.2s, color 0.2s;
	}

	.debug-copy-btn:hover {
		background: var(--bg-secondary);
		color: var(--text-primary);
	}
</style>
