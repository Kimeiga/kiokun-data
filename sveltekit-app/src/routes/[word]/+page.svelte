<script lang="ts">
	import { onMount } from "svelte";
	import type { PageData } from "./$types";
	import type { ChineseComponent } from "$lib/types";
	import Header from "$lib/components/Header.svelte";
	import Contains from "$lib/Contains.svelte";
	import AppearsIn from "$lib/AppearsIn.svelte";
	import JapaneseNames from "$lib/components/JapaneseNames.svelte";
	import Notes from "$lib/components/Notes.svelte";
	import CharacterEquation from "$lib/components/CharacterEquation.svelte";
	import WordTable from "$lib/components/JapaneseWords/WordTable.svelte";
	import SectionHeading from "$lib/components/shared/SectionHeading.svelte";
	import SpeakButton from "$lib/components/shared/SpeakButton.svelte";
	import Tag from "$lib/components/shared/Tag.svelte";
	import SaveToStudy from "$lib/components/SaveToStudy.svelte";
	import { getDictionaryUrl } from "$lib/shard-utils";
	import { dev } from "$app/environment";
	import { languageStore } from "$lib/stores/languages.svelte";
	import SentenceBar from "$lib/components/SentenceBar.svelte";
	import ReelsSection from "$lib/components/ReelsSection.svelte";
	// EtymologyTrail removed - not providing enough value for most users
	import SimilarCharacters from "$lib/components/SimilarCharacters.svelte";
	import SentenceExamples from "$lib/components/SentenceExamples.svelte";
	import ArtifactMentions from "$lib/components/ArtifactMentions.svelte";
	import ChineseSentenceExamples from "$lib/components/ChineseSentenceExamples.svelte";
	import KoreanSentenceExamples from "$lib/components/KoreanSentenceExamples.svelte";
	import SemanticMnemonicCard from "$lib/components/SemanticMnemonicCard.svelte";
	import ShareButton from "$lib/components/ShareButton.svelte";
	import StudyModeToggle from "$lib/components/StudyModeToggle.svelte";

	// Study mode: tap-to-reveal interaction
	function handleStudyClick(event: MouseEvent) {
		const target = (event.target as HTMLElement).closest?.('.study-hide');
		if (target) {
			target.classList.toggle('revealed');
		}
	}

	let { data }: { data: PageData } = $props();

	const showClaudeMnemonics = false;

	// Async sentence components report whether they actually have content
	let zhSentencesHaveContent = $state(false);
	let krSentencesHaveContent = $state(false);
	let jaSentencesHaveContent = $derived(
		!!data.data.japanese_words?.some((w: any) => w.sense?.some((s: any) => s.examples?.length))
	);
	let anySentencesVisible = $derived(
		(jaSentencesHaveContent && languageStore.preferences.japanese)
		|| (zhSentencesHaveContent && languageStore.preferences.chinese)
		|| (krSentencesHaveContent && languageStore.preferences.korean)
	);
	let showChineseWords = $derived(!!data.data.chinese_words?.length && languageStore.preferences.chinese);
	let showJapaneseWords = $derived(!!data.data.japanese_words?.length && languageStore.preferences.japanese);
	let showKoreanWords = $derived(!!data.data.korean_words?.length && languageStore.preferences.korean);
	let twoPrimaryWordColumns = $derived(showChineseWords && showJapaneseWords);
	let containsWordForms = $derived.by(() => buildContainsWordForms(data.data, data.word));
	let sortedContainsWords = $derived.by(() => sortContainsWords(data.data.contains || [], data.word));

	function sortContainsWords(words: any[], currentWord: string): any[] {
		return [...words].sort((a, b) => {
			const idxA = currentWord.indexOf(a.w);
			const idxB = currentWord.indexOf(b.w);
			// Characters found in the word sort first, by position; others go to end
			if (idxA === -1 && idxB === -1) return 0;
			if (idxA === -1) return 1;
			if (idxB === -1) return -1;
			return idxA - idxB;
		});
	}

	function buildContainsWordForms(entry: any, currentWord: string): string[] {
		const forms: string[] = [];
		const add = (form: string | undefined | null) => {
			if (form && !forms.includes(form)) forms.push(form);
		};

		for (const word of entry.chinese_words || []) {
			add(word.simp);
			add(word.trad);
		}

		for (const word of entry.japanese_words || []) {
			for (const kanji of word.kanji || []) {
				add(kanji.text);
			}
		}

		for (const word of entry.korean_words || []) {
			add(word.hanja);
			add(word.hanjaForm);
		}

		add(currentWord);
		add(entry.key);

		return forms;
	}

	function componentChar(component: string | ChineseComponent): string | null {
		if (typeof component === "string") return component;
		return component.character || component.char || null;
	}

	function componentChars(components: Array<string | ChineseComponent> | undefined): string[] {
		return (components || [])
			.map(componentChar)
			.filter((char): char is string => Boolean(char));
	}

	// Scroll to hash target on mount (for section permalinks)
	onMount(() => {
		const hash = window.location.hash?.slice(1);
		if (hash) {
			// Delay slightly to allow child components to render
			setTimeout(() => {
				const el = document.getElementById(hash);
				if (el) {
					el.scrollIntoView({ behavior: 'smooth', block: 'start' });
				}
			}, 300);
		}
	});

	// Get all character variants
	let traditionalChar = $derived(data.data.chinese_char?.char || data.word);


	let simplifiedChar = $derived(data.data.chinese_char?.simpVariants?.[0]);
	let japaneseChar = $derived(data.data.japanese_char?.literal);
	let koreanChar = $derived(data.data.korean_char);
	let hkChar = $derived(data.data.chinese_char?.hkChar);

	// Check if Korean Hanja form differs from traditional Chinese
	// Note: hanjaForm may contain Korean compatibility characters (U+F900-U+FAD9) which are
	// visually identical to standard CJK characters but have different Unicode codepoints.
	// We compare against korean_char.character (the canonical form) to determine if Korean
	// uses the same character, and only show a separate Korean box when hanjaForm actually
	// looks different (e.g., 龜 vs its Korean variant).
	let koreanHanjaForm = $derived(data.data.korean_char?.hanjaForm);
	let koreanCharacter = $derived(data.data.korean_char?.character);
	let krHasDifferentForm = $derived(
		koreanHanjaForm && koreanCharacter && koreanCharacter !== traditionalChar && koreanCharacter !== simplifiedChar && koreanCharacter !== japaneseChar
	);

	// Strip variant indicators (trad/simp/jp labels) from glosses
	function stripVariantIndicator(gloss: string): string {
		return gloss
			.replace(/\s*\(trad\/jp\)/gi, '')
			.replace(/\s*\(trad\)/gi, '')
			.replace(/\s*\(simp\)/gi, '')
			.replace(/\s*\(jp\)/gi, '')
			.trim();
	}

	// Clean a component gloss for display in component cards.
	// Strips variant markers but keeps position tags like "(side)" since they're descriptive.
	function cleanComponentGloss(gloss: string): string {
		return stripVariantIndicator(gloss);
	}

	// Decide whether a dictionary meaning is useful to show alongside the curated gloss.
	// Filters out useless entries like "radical number 9" and exact duplicates of the gloss.
	function isUsefulMeaning(dictMeaning: string, curatedGloss: string): boolean {
		if (!dictMeaning) return false;
		const lower = dictMeaning.trim().toLowerCase();
		if (/^radical number \d+/.test(lower)) return false;
		if (curatedGloss && lower === curatedGloss.trim().toLowerCase()) return false;
		return true;
	}

	// Get unique gloss from game data (falls back to existing gloss)
	let uniqueGloss = $derived(
		stripVariantIndicator(
			data.charGlosses?.[traditionalChar] ||
			data.charGlosses?.[data.word] ||
			data.data.chinese_char?.gloss ||
			''
		)
	);

	// Get taxonomy path for the character
	let taxonomy = $derived(
		data.charTaxonomy?.[traditionalChar] ||
		data.charTaxonomy?.[data.word] ||
		[]
	);

	// Simple comparisons to determine which characters are identical
	// If no simplified variant exists, the character is the same in simplified Chinese
	let simpSameAsTrad = $derived(!simplifiedChar || simplifiedChar === traditionalChar);
	let jpSameAsTrad = $derived(japaneseChar === traditionalChar);
	let jpSameAsSimp = $derived(!simplifiedChar ? jpSameAsTrad : japaneseChar === simplifiedChar);

	// Korean character comparisons - check if Korean uses the same character as traditional
	let krSameAsTrad = $derived(!koreanChar || koreanChar.character === traditionalChar);
	let krSameAsSimp = $derived(!koreanChar || !simplifiedChar ? krSameAsTrad : koreanChar.character === simplifiedChar);
	let krSameAsJp = $derived(!koreanChar || !japaneseChar ? krSameAsTrad : koreanChar.character === japaneseChar);

	// Hong Kong character variant - check if HK uses a different character form than all others
	let hkHasDifferentForm = $derived(
		hkChar &&
		hkChar !== traditionalChar &&
		hkChar !== simplifiedChar &&
		hkChar !== japaneseChar &&
		hkChar !== koreanCharacter
	);

	// Count how many unique character boxes we'll show
	let characterBoxCount = $derived.by(() => {
		let count = traditionalChar ? 1 : 0;
		if (simplifiedChar && !simpSameAsTrad) count++;
		if (japaneseChar && !jpSameAsTrad && !jpSameAsSimp) count++;
		// Korean Hanja variant only if it differs from all others
		if (krHasDifferentForm) count++;
		// Hong Kong variant only if it differs from all others
		if (hkHasDifferentForm) count++;
		return count;
	});
	let isSingleCharacter = $derived(characterBoxCount === 1);

	// Parse IDS (Ideographic Description Sequence) into component characters.
	// IDS uses U+2FF0..U+2FFB as operators followed by their operand characters.
	function parseIds(ids: string | undefined | null): string[] {
		if (!ids) return [];
		// Remove any entity reference (&CDP-89F6;, &GT-K00822;, &U+XXXX;, &#123;)
		const cleaned = ids.replace(/&[^;]+;/g, '');
		const result: string[] = [];
		// Iterate over code points (handles surrogates)
		for (const ch of cleaned) {
			const code = ch.codePointAt(0) || 0;
			if (code >= 0x2FF0 && code <= 0x2FFB) continue; // skip IDC operators
			if (ch.trim()) result.push(ch);
		}
		return result;
	}

	// Build synthetic component objects from an IDS string (for Japanese shinjitai that lack full component data)
	function componentsFromIds(ids: string | undefined | null, glossesMap: Record<string, string>) {
		const chars = parseIds(ids);
		return chars.map((char) => ({
			character: char,
			meaning: glossesMap?.[char] || '',
			type: [],
		}));
	}

	// Compare component glosses to determine if variants share a mnemonic.
	// When glosses differ, we show separate character equations.
	function componentsAreEquivalent(compsA: any[] | undefined, compsB: any[] | undefined, glossesMap: Record<string, string>): boolean {
		if (!compsA || !compsB) return true;
		if (compsA.length === 0 || compsB.length === 0) return true;

		const normalize = (g: string) =>
			g.replace(/\s*\((simp|trad\/jp|trad|jp)\)/gi, '')
			 .replace(/[🇨🇳🇹🇼🇯🇵]/g, '')
			 .trim()
			 .toLowerCase();

		const getChar = (c: any) => typeof c === 'string' ? c : (c.character || c.char || '');
		const getGloss = (c: any) => {
			const char = getChar(c);
			return normalize(glossesMap?.[char] || c.meaning || '');
		};

		const glossesA = compsA.map(getGloss).filter(Boolean).sort();
		const glossesB = compsB.map(getGloss).filter(Boolean).sort();

		if (glossesA.length !== glossesB.length) return false;
		return glossesA.every((g, i) => g === glossesB[i]);
	}

	// Japanese components from the trad entry's japanese_char.ids field
	let japaneseComponents = $derived.by(() => {
		const ids = (data.data.japanese_char as any)?.ids;
		if (!ids) return undefined;
		const comps = componentsFromIds(ids, data.charGlosses);
		return comps.length > 0 ? comps : undefined;
	});

	// State for character data and component mappings.
	// Initialized from server-preloaded data; reset via $effect when navigating to a new word.
	let simplifiedCharData: any = $state(data.simplifiedCharData || null);

	// Reset ALL page-level state when navigating to a new character (client-side navigation).
	// Without this, previous page data leaks into the new page (stale simp data, stroke maps, etc.)
	$effect(() => {
		// Track data.word to trigger on navigation
		const _word = data.word;
		simplifiedCharData = data.simplifiedCharData || null;
		componentStrokeMap = new Map();
		simpComponentStrokeMap = new Map();
		tradUsedSequentialFallback = false;
		simpUsedSequentialFallback = false;
	});
	let componentStrokeMap: Map<string, number[]> = $state(new Map()); // For traditional/main character
	let simpComponentStrokeMap: Map<string, number[]> = $state(new Map()); // For simplified character
	let tradUsedSequentialFallback = $state(false); // True if traditional used sequential fallback (unreliable)
	let simpUsedSequentialFallback = $state(false); // True if simplified used sequential fallback (unreliable)

	// Homophones: words with the same reading
	interface HomophoneResult { word: string; pronunciation: string; is_common: boolean }
	interface HomophoneGroup { reading: string; words: HomophoneResult[] }
	let homophones: HomophoneGroup[] = $state([]);

	$effect(() => {
		const _word = data.word;
		homophones = [];

		// Extract unique Japanese readings
		const readings = new Set<string>();
		for (const jw of data.data.japanese_words || []) {
			for (const k of jw.kana || []) {
				if (k.text) readings.add(k.text);
			}
		}

		// Fetch homophones for each reading
		for (const reading of readings) {
			fetch(`/api/lookup-reading?q=${encodeURIComponent(reading)}&limit=20`)
				.then(r => r.ok ? r.json() : null)
				.then(result => {
					if (!result?.results?.length) return;
					const filtered = result.results.filter((w: HomophoneResult) => w.word !== data.word && w.word !== reading);
					if (filtered.length > 0) {
						homophones = [...homophones, { reading, words: filtered }];
					}
				})
				.catch(() => {});
		}
	});

	// Equivalence states (declared after simplifiedCharData since they read from it)
	let tradSimpEquivalent = $derived(
		componentsAreEquivalent(
			data.data.chinese_char?.components,
			simplifiedCharData?.components,
			data.charGlosses
		)
	);

	let tradJpEquivalent = $derived.by(() =>
		componentsAreEquivalent(
			data.data.chinese_char?.components,
			japaneseComponents,
			data.charGlosses
		)
	);

	let simpJpEquivalent = $derived.by(() =>
		componentsAreEquivalent(
			simplifiedCharData?.components,
			japaneseComponents,
			data.charGlosses
		)
	);

	// Helper to load component mappings from makemeahanzi's matches field
	// The matches field maps each stroke to its component index
	// e.g., for 图: [[0],[0],[1],[1],[1],[1],[1],[0]] means strokes 0,1,7 belong to component 0 (囗), strokes 2-6 to component 1 (冬)
	function loadMakemeahanziMappings(
		char: string,
		targetMap: "trad" | "simp",
	): boolean {
		console.log(`[MAKEMEAHANZI] Checking for matches data for ${char} (${targetMap})`);

		// Get the makemeahanzi image data
		const makemeahanziImage = targetMap === "trad"
			? data.data.chinese_char?.images?.find((img: any) => img.source === 'makemeahanzi')
			: simplifiedCharData?.images?.find((img: any) => img.source === 'makemeahanzi');

		const matches = makemeahanziImage?.data?.matches;
		if (!matches || !Array.isArray(matches)) {
			console.log(`[MAKEMEAHANZI] No matches field found for ${char}`);
			return false;
		}

		// Get our components list
		const components = targetMap === "trad"
			? data.data.chinese_char?.components
			: simplifiedCharData?.components;

		if (!components || components.length === 0) {
			console.log(`[MAKEMEAHANZI] No components in our data for ${char}`);
			return false;
		}

		console.log(`[MAKEMEAHANZI] Found matches for ${char}:`, matches);
		console.log(`[MAKEMEAHANZI] Components:`, components.map((c: any) => typeof c === 'string' ? c : c.character || c.char));

		// Build component index -> stroke indices mapping
		const componentToStrokes = new Map<number, number[]>();

		matches.forEach((strokeMatch: number[] | null, strokeIndex: number) => {
			if (strokeMatch && strokeMatch.length > 0) {
				// The match array indicates which component(s) this stroke belongs to
				// Usually it's a single number like [0] or [1], but can be nested for complex chars
				// We take the first element as the component index
				const componentIndex = strokeMatch[0];
				if (!componentToStrokes.has(componentIndex)) {
					componentToStrokes.set(componentIndex, []);
				}
				componentToStrokes.get(componentIndex)!.push(strokeIndex);
			}
		});

		console.log(`[MAKEMEAHANZI] Component index -> strokes:`, Object.fromEntries(componentToStrokes));

		// Now map component characters to their stroke indices
		const newMap = new Map<string, number[]>();

		// Count how many components makemeahanzi has vs how many we have
		const makemeahanziComponentCount = componentToStrokes.size;
		const ourComponentCount = components.length;

		console.log(`[MAKEMEAHANZI] Component count comparison: ours=${ourComponentCount}, makemeahanzi=${makemeahanziComponentCount}`);

		// Handle mismatch: our data has fewer components than makemeahanzi's decomposition
		// This happens when our components are "higher-level" abstractions (e.g., 子 instead of 乛+亅)
		// In this case, we need to merge makemeahanzi's components into ours
		if (ourComponentCount < makemeahanziComponentCount) {
			// Collect ALL strokes from all makemeahanzi components
			const allStrokes: number[] = [];
			componentToStrokes.forEach((strokes) => {
				allStrokes.push(...strokes);
			});
			allStrokes.sort((a, b) => a - b);

			if (ourComponentCount === 1) {
				// Simple case: assign all strokes to our single component
				const compChar = typeof components[0] === 'string' ? components[0] : components[0].character || components[0].char || components[0];
				newMap.set(compChar, allStrokes);
				console.log(`[MAKEMEAHANZI] ✓ Single component "${compChar}" gets ALL strokes (makemeahanzi has ${makemeahanziComponentCount} components) → strokes ${allStrokes.join(', ')}`);
			} else {
				// Multiple components but fewer than makemeahanzi: distribute strokes proportionally
				// This is a heuristic - we divide strokes roughly evenly among our components
				const strokesPerComponent = Math.ceil(allStrokes.length / ourComponentCount);
				let strokeIndex = 0;

				components.forEach((comp: any) => {
					const compChar = typeof comp === 'string' ? comp : comp.character || comp.char || comp;
					const endIndex = Math.min(strokeIndex + strokesPerComponent, allStrokes.length);
					const assignedStrokes = allStrokes.slice(strokeIndex, endIndex);

					if (assignedStrokes.length > 0) {
						newMap.set(compChar, assignedStrokes);
						console.log(`[MAKEMEAHANZI] ✓ Component "${compChar}" (proportional distribution) → strokes ${assignedStrokes.join(', ')}`);
					}
					strokeIndex = endIndex;
				});
			}
		} else {
			// Normal case: component counts match or we have more - use index-based mapping
			components.forEach((comp: any, index: number) => {
				const compChar = typeof comp === 'string' ? comp : comp.character || comp.char || comp;
				const strokes = componentToStrokes.get(index) || [];
				if (strokes.length > 0) {
					newMap.set(compChar, strokes);
					console.log(`[MAKEMEAHANZI] ✓ Component "${compChar}" (index ${index}) → strokes ${strokes.join(', ')}`);
				} else {
					console.log(`[MAKEMEAHANZI] ⚠️ Component "${compChar}" (index ${index}) has no strokes mapped`);
				}
			});
		}

		if (newMap.size > 0) {
			// Clear the sequential fallback flag since we have accurate data
			if (targetMap === "trad") {
				tradUsedSequentialFallback = false;
				componentStrokeMap = newMap;
			} else {
				simpUsedSequentialFallback = false;
				simpComponentStrokeMap = newMap;
			}
			console.log(`[MAKEMEAHANZI] Successfully loaded mappings from matches field`);
			return true;
		}

		return false;
	}

	// Helper to load KanjiVG data and extract component mappings (fallback for Japanese)
	async function loadComponentMappings(
		char: string,
		targetMap: "trad" | "simp",
	) {
		console.log(`[COMPONENT-MAP] Loading mappings for ${char} (${targetMap})`);

		// First, try to use makemeahanzi's matches field (most accurate for Chinese)
		if (loadMakemeahanziMappings(char, targetMap)) {
			console.log(`[COMPONENT-MAP] Used makemeahanzi matches for ${char}`);
			return;
		}

		// Fall back to KanjiVG for Japanese characters or if makemeahanzi matches not available
		console.log(`[COMPONENT-MAP] Falling back to KanjiVG for ${char}`);
		try {
			const codepoint = char
				.codePointAt(0)
				?.toString(16)
				.padStart(5, "0");
			if (codepoint) {
				const svgUrl = `https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${codepoint}.svg`;
				console.log(`[COMPONENT-MAP] Fetching KanjiVG: ${svgUrl}`);
				const svgResponse = await fetch(svgUrl);
				if (svgResponse.ok) {
					const svgText = await svgResponse.text();
					const parser = new DOMParser();
					const doc = parser.parseFromString(
						svgText,
						"image/svg+xml",
					);

					// Extract component-to-stroke mappings from kvg:element attributes
					// Use kvg:number to distinguish multiple instances of the same element
					// e.g., 囗 with number="1" is outer enclosure, number="2" is inner
					const newMap = new Map<string, number[]>();
					const instanceCountMap = new Map<string, Set<string>>(); // Track which instance numbers exist for each element
					const paths = doc.querySelectorAll('path[id^="kvg:"]');
					const totalStrokes = paths.length;
					console.log(`[COMPONENT-MAP] Total strokes in KanjiVG: ${totalStrokes}`);

					paths.forEach((path, strokeIndex) => {
						// Find the CLOSEST parent group with kvg:element attribute
						let currentElement = path.parentElement;
						while (
							currentElement &&
							currentElement.tagName === "g"
						) {
							const element =
								currentElement.getAttribute("kvg:element");
							if (element) {
								// Check for kvg:number to distinguish multiple instances
								const instanceNumber = currentElement.getAttribute("kvg:number");

								// Create a unique key that includes instance number if present
								// e.g., "囗" becomes "囗#1" or "囗#2"
								const mapKey = instanceNumber ? `${element}#${instanceNumber}` : element;

								if (!newMap.has(mapKey)) {
									newMap.set(mapKey, []);
								}
								const strokes = newMap.get(mapKey)!;
								if (!strokes.includes(strokeIndex)) {
									strokes.push(strokeIndex);
								}

								// Track which instance numbers exist for this element
								if (instanceNumber) {
									if (!instanceCountMap.has(element)) {
										instanceCountMap.set(element, new Set());
									}
									instanceCountMap.get(element)!.add(instanceNumber);
								}

								break;
							}
							currentElement = currentElement.parentElement;
						}
					});

					// Post-process: create convenience mappings for elements
					// If an element has multiple numbered instances (e.g., 囗#1 and 囗#2),
					// map the bare element name to instance #1 (typically the outer/primary one)
					for (const [element, instances] of instanceCountMap.entries()) {
						if (instances.size > 1 && newMap.has(`${element}#1`)) {
							// Multiple instances exist - map bare name to #1 (outer/primary)
							console.log(`[COMPONENT-MAP] Element "${element}" has ${instances.size} instances (#${[...instances].join(', #')}), using #1 as primary`);
							newMap.set(element, newMap.get(`${element}#1`)!);
						} else if (instances.size === 1) {
							// Only one numbered instance - use it directly
							const num = [...instances][0];
							if (newMap.has(`${element}#${num}`) && !newMap.has(element)) {
								newMap.set(element, newMap.get(`${element}#${num}`)!);
							}
						}
					}

					console.log(`[COMPONENT-MAP] KanjiVG elements found:`, [...newMap.keys()]);
					console.log(`[COMPONENT-MAP] KanjiVG stroke mappings:`, Object.fromEntries(newMap));

					if (newMap.size > 0) {
						// Get our data's components to check if all are mapped
						const ourComponents =
							targetMap === "trad"
								? data.data.chinese_char?.components
								: simplifiedCharData?.components;

						const ourComponentChars = ourComponents?.map((comp: any) =>
							typeof comp === "string"
								? comp
								: comp.character || comp.char || comp
						) || [];
						console.log(`[COMPONENT-MAP] Our data's components:`, ourComponentChars);

						if (ourComponents && ourComponents.length > 0) {
							// Check if any of our components are missing from KanjiVG
							for (const comp of ourComponents) {
								const compChar =
									typeof comp === "string"
										? comp
										: comp.character || comp.char || comp;

								if (!newMap.has(compChar)) {
									console.log(`[COMPONENT-MAP] ⚠️ Component "${compChar}" NOT found in KanjiVG - calculating complement`);
									// Component not found in KanjiVG - calculate as complement
									// Find all strokes NOT assigned to other known components
									const assignedStrokes = new Set<number>();
									for (const otherComp of ourComponents) {
										const otherChar =
											typeof otherComp === "string"
												? otherComp
												: otherComp.character ||
													otherComp.char ||
													otherComp;
										if (
											otherChar !== compChar &&
											newMap.has(otherChar)
										) {
											console.log(`[COMPONENT-MAP]   - "${otherChar}" has strokes:`, newMap.get(otherChar));
											for (const idx of newMap.get(
												otherChar,
											)!) {
												assignedStrokes.add(idx);
											}
										}
									}
									console.log(`[COMPONENT-MAP]   - Already assigned strokes:`, [...assignedStrokes].sort((a,b) => a-b));

									// All strokes not assigned to other components belong to this one
									const complementStrokes: number[] = [];
									for (let i = 0; i < totalStrokes; i++) {
										if (!assignedStrokes.has(i)) {
											complementStrokes.push(i);
										}
									}
									console.log(`[COMPONENT-MAP]   - Complement strokes for "${compChar}":`, complementStrokes);
									if (complementStrokes.length > 0) {
										newMap.set(compChar, complementStrokes);
									} else {
										console.warn(`[COMPONENT-MAP] ❌ No complement strokes found for "${compChar}"!`);
									}
								} else {
									console.log(`[COMPONENT-MAP] ✓ Component "${compChar}" found in KanjiVG with strokes:`, newMap.get(compChar));
								}
							}
						}

						console.log(`[COMPONENT-MAP] Final stroke mappings:`, Object.fromEntries(newMap));

						if (targetMap === "trad") {
							componentStrokeMap = newMap;
						} else {
							simpComponentStrokeMap = newMap;
						}
					} else {
						console.log(`[COMPONENT-MAP] No KanjiVG elements found, falling back to sequential`);
						// Fallback to sequential mapping if KanjiVG map is empty
						await loadSequentialComponentMappings(char, targetMap);
					}
				} else {
					console.log(`[COMPONENT-MAP] KanjiVG fetch failed (${svgResponse.status}), falling back to sequential`);
					await loadSequentialComponentMappings(char, targetMap);
				}
			}
		} catch (e) {
			console.error(
				`[COMPONENT-MAP] Failed to load KanjiVG data for component mapping for ${char}:`,
				e,
			);
			await loadSequentialComponentMappings(char, targetMap);
		}
	}

	// Fallback: Map components sequentially based on their stroke counts
	async function loadSequentialComponentMappings(
		char: string,
		targetMap: "trad" | "simp",
	) {
		console.log(`[SEQUENTIAL] Using sequential fallback for ${char} (${targetMap})`);

		// Mark that we're using sequential fallback (which is unreliable for enclosure characters)
		if (targetMap === "trad") {
			tradUsedSequentialFallback = true;
		} else {
			simpUsedSequentialFallback = true;
		}

		try {
			// Get components list from data
			// Note: This assumes components are listed in writing order, which is often but not always true
			const components =
				targetMap === "trad"
					? data.data.chinese_char?.components
					: simplifiedCharData?.components;

			if (!components || components.length === 0) {
				console.log(`[SEQUENTIAL] No components found in data`);
				return;
			}

			const newMap = new Map<string, number[]>();
			let currentStrokeIndex = 0;

			for (const comp of components) {
				// Extract character string if comp is an object
				const compChar =
					typeof comp === "string"
						? comp
						: comp.char || comp.character || comp;

				// Fetch stroke count for component
				try {
					const response = await fetch(
						`https://cdn.jsdelivr.net/npm/hanzi-writer-data@latest/${compChar}.json`,
					);
					if (response.ok) {
						const compData = await response.json();
						const strokeCount = compData.strokes.length;

						const strokeIndices = [];
						for (let i = 0; i < strokeCount; i++) {
							strokeIndices.push(currentStrokeIndex + i);
						}

						newMap.set(compChar, strokeIndices);
						console.log(`[SEQUENTIAL] "${compChar}": ${strokeCount} strokes → indices ${strokeIndices.join(', ')}`);
						currentStrokeIndex += strokeCount;
					} else {
						console.warn(`[SEQUENTIAL] Failed to fetch stroke data for "${compChar}" (${response.status})`);
					}
				} catch (err) {
					console.warn(`[SEQUENTIAL] Error fetching stroke data for "${compChar}":`, err);
				}
			}

			console.log(`[SEQUENTIAL] Final mappings:`, Object.fromEntries(newMap));

			if (newMap.size > 0) {
				if (targetMap === "trad") {
					componentStrokeMap = newMap;
				} else {
					simpComponentStrokeMap = newMap;
				}
			} else {
				console.warn(`[SEQUENTIAL] No mappings generated!`);
			}
		} catch (e) {
			console.error(
				`[SEQUENTIAL] Failed sequential mapping for ${char}:`,
				e,
			);
		}
	}

	// Initialize Hanzi Writer for stroke animations
	let writerInstance: any = null;

	async function initHanziWriter() {
		if (typeof window === "undefined") return;

		// Dynamically import Hanzi Writer
		const HanziWriter = (await import("hanzi-writer")).default;

		const strokeColor =
			getComputedStyle(document.documentElement)
				.getPropertyValue("--color-stroke")
				.trim() || "#2c3e50";
		const outlineColor =
			getComputedStyle(document.documentElement)
				.getPropertyValue("--color-outline")
				.trim() || "#e0e0e0";

		// Custom charDataLoader to use Japanese data for Japanese characters
		// Falls back to Chinese data, then KanjiVG if neither is available
		const charDataLoader = (
			char: string,
			onComplete: (data: any) => void,
			onErrorOriginal: (error: any) => void,
		) => {
			// Wrap onError to restore fallback content
			const onError = (error: any) => {
				const fallback = targetFallbacks.get(char);
				if (fallback) {
					// Find the target element and restore its content
					const targets = ['trad-writer-target', 'simp-writer-target', 'jp-writer-target'];
					for (const id of targets) {
						const el = document.getElementById(id);
						if (el && el.innerHTML === '') {
							el.innerHTML = fallback;
							break;
						}
					}
				}
				onErrorOriginal(error);
			};
			// Determine if this is a Japanese character by checking if the char matches japaneseChar
			const isJapanese = char === japaneseChar;

			if (isJapanese) {
				// Try Japanese data first, fall back to Chinese data, then KanjiVG
				fetch(
					`https://cdn.jsdelivr.net/npm/hanzi-writer-data-jp@0/${char}.json`,
				)
					.then((res) => {
						if (!res.ok) throw new Error(`HTTP ${res.status}`);
						return res.json();
					})
					.then(onComplete)
					.catch(() => {
						// Fall back to Chinese data if Japanese data is not available
						fetch(
							`https://cdn.jsdelivr.net/npm/hanzi-writer-data@latest/${char}.json`,
						)
							.then((res) => {
								if (!res.ok)
									throw new Error(`HTTP ${res.status}`);
								return res.json();
							})
							.then(onComplete)
							.catch(() => {
								// Final fallback: try to load KanjiVG SVG
								loadKanjiVGFallback(char, (error) => {
									console.warn(
										`No stroke data available for character: ${char}`,
										error,
									);
									onError(error);
								});
							});
					});
			} else {
				// Use Chinese data for Chinese characters, fall back to KanjiVG
				fetch(
					`https://cdn.jsdelivr.net/npm/hanzi-writer-data@latest/${char}.json`,
				)
					.then((res) => {
						if (!res.ok) throw new Error(`HTTP ${res.status}`);
						return res.json();
					})
					.then(onComplete)
					.catch(() => {
						// Fallback: try KanjiVG SVG for rare characters
						loadKanjiVGFallback(char, (error) => {
							console.warn(
								`No stroke data available for character: ${char}`,
								error,
							);
							onError(error);
						});
					});
			}
		};

		// Fallback function to load and animate KanjiVG SVG for Japanese characters
		const loadKanjiVGFallback = async (
			char: string,
			onError: (error: any) => void,
		) => {
			try {
				// Get Unicode codepoint in hex format (e.g., 図 → 56f3)
				const codepoint = char
					.codePointAt(0)
					?.toString(16)
					.padStart(5, "0");
				if (!codepoint) throw new Error("Invalid character");

				// Try to load KanjiVG SVG from GitHub
				const svgUrl = `https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${codepoint}.svg`;
				const response = await fetch(svgUrl);

				if (!response.ok) throw new Error(`HTTP ${response.status}`);

				const svgText = await response.text();

				// Find the target element and inject the SVG
				// Check traditional first since Japanese/Korean may share the same character
				const targetId =
					char === traditionalChar
						? "trad-writer-target"
						: char === simplifiedChar
							? "simp-writer-target"
							: "jp-writer-target";
				const target = document.getElementById(targetId);

				if (target) {
					// Parse the SVG text to extract only the SVG element
					const parser = new DOMParser();
					const doc = parser.parseFromString(
						svgText,
						"image/svg+xml",
					);
					const svg = doc.querySelector("svg");

					if (svg) {
						// Clear the target and append the parsed SVG
						target.innerHTML = "";
						target.appendChild(svg);

						// Style the SVG to fit the container
						svg.setAttribute("width", "100");
						svg.setAttribute("height", "100");
						svg.style.display = "block";
						svg.id = `kanjivg-${codepoint}`;

						// Hide stroke numbers (they're in a separate group with id containing "StrokeNumbers")
						const strokeNumbersGroup = svg.querySelector(
							'[id*="StrokeNumbers"]',
						);
						if (strokeNumbersGroup) {
							strokeNumbersGroup.style.display = "none";
						}

						// Clone all paths to create gray background strokes
						const paths = svg.querySelectorAll("path");
						const pathsArray = Array.from(paths);

						pathsArray.forEach((path) => {
							// Create a gray background clone
							const bgPath = path.cloneNode(
								true,
							) as SVGPathElement;
							bgPath.style.fill = "none";
							bgPath.style.stroke = outlineColor;
							bgPath.style.strokeWidth = "3";
							bgPath.style.strokeLinecap = "round";
							bgPath.style.strokeLinejoin = "round";
							bgPath.removeAttribute("id"); // Remove ID to avoid duplicates

							// Insert the background path before the original
							path.parentNode?.insertBefore(bgPath, path);

							// Style the animated foreground path
							path.style.fill = "none";
							path.style.stroke = strokeColor;
							path.style.strokeWidth = "3";
							path.style.strokeLinecap = "round";
							path.style.strokeLinejoin = "round";

							// Get path length for stroke-dasharray animation
							const length = path.getTotalLength();
							path.style.strokeDasharray = `${length}`;
							path.style.strokeDashoffset = `${length}`;
						});

						// Auto-loop animation function
						const animateStrokes = () => {
							pathsArray.forEach((path, index) => {
								// Animate each stroke sequentially
								setTimeout(() => {
									path.style.transition =
										"stroke-dashoffset 0.5s ease-in-out";
									path.style.strokeDashoffset = "0";
								}, index * 600); // 500ms animation + 100ms delay between strokes
							});

							// Reset and loop after all strokes are drawn
							const totalDuration =
								pathsArray.length * 600 + 1000; // Add 1s pause at end
							setTimeout(() => {
								pathsArray.forEach((path) => {
									path.style.transition = "none";
									const length = path.getTotalLength();
									path.style.strokeDashoffset = `${length}`;
								});
								// Restart animation after a brief moment
								setTimeout(animateStrokes, 100);
							}, totalDuration);
						};

						// Start the animation loop
						animateStrokes();
					}
				}
			} catch (error) {
				console.error("KanjiVG fallback failed:", error);
				onError(error);
			}
		};

		const isMobile = window.innerWidth < 768;
		const writerSize = isMobile ? 80 : 100;

		const writerConfig = {
			width: writerSize,
			height: writerSize,
			padding: isMobile ? 3 : 5,
			showOutline: true,
			strokeAnimationSpeed: 3,
			delayBetweenStrokes: 200,
			delayBetweenLoops: 1000,
			strokeColor,
			outlineColor,
			drawingColor: strokeColor,
			strokeFadeDuration: 500,
			charDataLoader: charDataLoader,
		};

		// Track targets that need fallback restoration on error
		const targetFallbacks = new Map<string, string>();

		// Helper to animate a character with fallback on error
		function animateChar(targetId: string, char: string) {
			const target = document.getElementById(targetId);
			if (!target) return;
			targetFallbacks.set(char, target.innerHTML);
			target.innerHTML = "";
			try {
				const writer = HanziWriter.create(target, char, writerConfig);
				writer.loopCharacterAnimation();
			} catch {
				target.innerHTML = targetFallbacks.get(char) || "";
			}
		}

		// Animate traditional character (always if exists)
		if (traditionalChar) {
			animateChar("trad-writer-target", traditionalChar);
		}

		// Animate simplified character (only if different from traditional)
		if (simplifiedChar && simplifiedChar !== traditionalChar) {
			animateChar("simp-writer-target", simplifiedChar);
		}

		// Animate Japanese character (only if different from both trad and simp)
		if (japaneseChar && japaneseChar !== traditionalChar && japaneseChar !== simplifiedChar) {
			animateChar("jp-writer-target", japaneseChar);
		}

		// Load component mappings for traditional character
		if (traditionalChar) {
			tradUsedSequentialFallback = false;
			loadComponentMappings(traditionalChar, "trad");
		}

		// Load component stroke mappings for the simplified character.
		// simplifiedCharData is already preloaded by the +page.ts load function,
		// so we just need to compute the stroke-to-component mapping from its images.
		if (simplifiedChar && simplifiedChar !== traditionalChar && simplifiedCharData?.components?.length) {
			simpUsedSequentialFallback = false;
			loadComponentMappings(simplifiedChar, "simp");
		}
	}

	// Re-run animation when data changes
	$effect(() => {
		if (data.word) {
			// Small delay to ensure DOM is updated
			setTimeout(() => {
				initHanziWriter();
			}, 50);
		}
	});


	function getPartOfSpeechLabel(pos: string): string {
		if (!data.labels?.partOfSpeech) return pos;
		return data.labels.partOfSpeech[pos] || pos;
	}

	function getMiscLabel(misc: string): string {
		if (!data.labels?.misc) return misc;
		return data.labels.misc[misc] || misc;
	}

	function getKanjiTagLabel(tag: string): string {
		if (!data.labels?.tag) return tag;
		return data.labels.tag[tag] || tag;
	}
</script>

<svelte:head>
	<title>{data.word} - Kiokun Dictionary</title>
	<meta name="description" content={data.data.chinese_char?.gloss
		? `${data.word}: ${data.data.chinese_char.gloss}. Chinese and Japanese dictionary entry with stroke order, readings, and definitions.`
		: `${data.word} - Chinese and Japanese dictionary entry with stroke order, readings, and definitions.`} />

	<!-- Open Graph -->
	<meta property="og:title" content={`${data.word} - Kiokun Dictionary`} />
	<meta property="og:description" content={data.data.chinese_char?.gloss
		? `${data.word}: ${data.data.chinese_char.gloss}. Chinese and Japanese dictionary entry with stroke order, readings, and definitions.`
		: `${data.word} - Chinese and Japanese dictionary entry with stroke order, readings, and definitions.`} />
	<meta property="og:url" content={`https://kiokun.pages.dev/${encodeURIComponent(data.word)}`} />

	<!-- Twitter Card -->
	<meta name="twitter:title" content={`${data.word} - Kiokun Dictionary`} />
	<meta name="twitter:description" content={data.data.chinese_char?.gloss
		? `${data.word}: ${data.data.chinese_char.gloss}. Chinese and Japanese dictionary entry with stroke order, readings, and definitions.`
		: `${data.word} - Chinese and Japanese dictionary entry with stroke order, readings, and definitions.`} />
</svelte:head>

<Header currentWord={data.conjugatedFrom || data.word} />
<SentenceBar currentWord={data.word} />

<div class="max-w-6xl mx-auto px-3 py-2 md:px-5 md:py-3">
	<!-- Conjugation Info Box (shown when arriving via deinflection) -->
	{#if data.conjugatedFrom && data.conjugationInfo}
		<div class="mb-4 p-4 bg-info-bg border border-info-border rounded-lg">
			<div class="flex items-center gap-2 text-info-text">
				<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<div>
					<span class="font-medium">{data.conjugatedFrom}</span>
					<span class="mx-1">→</span>
					<span class="font-bold">{data.word}</span>
					<span class="ml-2 text-sm opacity-80">({data.conjugationInfo})</span>
				</div>
			</div>

			<!-- Alternative matches -->
			{#if data.conjugationAlternatives && data.conjugationAlternatives.length > 0}
				<div class="mt-3 pt-3 border-t border-info-border">
					<span class="text-sm text-info-muted">Could also be:</span>
					<div class="flex flex-wrap gap-2 mt-2">
						{#each data.conjugationAlternatives as alt}
							<a
								href="/{alt.word}?from={encodeURIComponent(data.conjugatedFrom)}&conj={encodeURIComponent(alt.conj)}"
								class="inline-flex items-center gap-1 text-sm px-3 py-1.5 bg-accent-light text-accent rounded-full hover:opacity-80 transition-opacity"
							>
								<span class="font-medium">{alt.word}</span>
								<span class="opacity-70">({alt.conj})</span>
							</a>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Custom Word Display -->
	{#if data.customWord}
		{@const cw = data.customWord}
		{@const defs = typeof cw.definitions === 'string' ? JSON.parse(cw.definitions) : cw.definitions}
		{@const pos = cw.partOfSpeech ? (typeof cw.partOfSpeech === 'string' ? JSON.parse(cw.partOfSpeech) : cw.partOfSpeech) : []}
		<div id="content">
			<div class="mb-4 p-3 rounded-lg bg-accent-light border border-accent/20">
				<div class="flex items-center gap-2 text-sm text-accent">
					<span>Community Word</span>
					{#if cw.user}
						<span class="text-text-muted">by</span>
						<a href="/users/{cw.userId}" class="text-accent hover:underline">{cw.user.name}</a>
					{/if}
				</div>
			</div>

			<div class="py-3 md:py-4">
				<div class="flex flex-col gap-2 mb-4">
					<div class="flex items-baseline gap-3 flex-wrap">
						{#if cw.language === 'zh'}
							<span class="custom-word-heading">
								{#if cw.simplified && cw.traditional && cw.simplified !== cw.traditional}
									{cw.simplified} / {cw.traditional}
								{:else}
									{cw.traditional || cw.simplified || cw.word}
								{/if}
							</span>
							{#if cw.pinyin}
								<span class="text-accent" style="font-size: var(--font-size-headline)">[{cw.pinyin}]</span>
							{/if}
							{#if cw.jyutping}
								<span class="text-cantonese" style="font-size: var(--font-size-body)">[{cw.jyutping}]</span>
							{/if}
						{:else if cw.language === 'ja'}
							<span class="custom-word-heading">{cw.kanji || cw.kana || cw.word}</span>
							{#if cw.kana && cw.kanji}
								<span class="text-accent" style="font-size: var(--font-size-headline)">{cw.kana}</span>
							{/if}
						{:else if cw.language === 'ko'}
							<span class="custom-word-heading">{cw.hangul || cw.word}</span>
							{#if cw.hanja}
								<span class="text-text-secondary" style="font-size: var(--font-size-headline)">[{cw.hanja}]</span>
							{/if}
						{/if}
						<SpeakButton text={cw.word} lang={cw.language === 'zh' ? 'zh' : cw.language === 'ja' ? 'ja' : 'ko'} size={20} />
					</div>

					{#if pos.length > 0}
						<div class="flex gap-2">
							{#each pos as p}
								<Tag type="pos" text={p} langTag="en" />
							{/each}
						</div>
					{/if}

					<div class="custom-word-defs">
						{#each defs as def, i}
							<div>{defs.length > 1 ? `${i + 1}. ` : ''}{def}</div>
						{/each}
					</div>

					{#if cw.notes}
						<div class="mt-2 text-text-secondary" style="font-size: var(--font-size-body); line-height: 1.6">
							{cw.notes}
						</div>
					{/if}
				</div>
			</div>

			<!-- Notes Section -->
			<Notes character={traditionalChar} />
		</div>
	{:else}
	<div id="content">
		<!-- Character Header -->
		{#if data.data.chinese_char || data.data.japanese_char}
			<div class="mb-0">
				<div class="py-3 md:py-4">
					<!-- Compact Header: Characters + Pronunciations + Gloss in one line -->
					<div class="flex flex-col gap-4 mb-4">
						<!-- Top Row: Character Variants & Main Gloss -->
						<!-- Grid: chars left, gloss+pronunciations right -->
						<div class="grid grid-cols-[auto_1fr] gap-3 md:gap-4 items-start">
							<!-- Character Variants with Stroke Animations -->
							<div class="flex items-center gap-3 md:gap-4">
								<!-- Traditional Chinese (always shown if exists) -->
								{#if traditionalChar}
									<div class="flex flex-col items-center gap-2">
										<div
											id="trad-writer-target"
											class="w-[80px] h-[80px] md:w-[100px] md:h-[100px] flex items-center justify-center bg-bg-secondary rounded-xl shadow-lg border border-border"
										>
											<div lang="zh-Hant" class="text-5xl md:text-7xl font-bold font-cjk leading-none text-text-primary">
												{traditionalChar}
											</div>
										</div>
										<div class="text-xs md:text-base tracking-wide">
											🇹🇼{#if !hkHasDifferentForm}🇭🇰{/if}{#if simpSameAsTrad}🇨🇳{/if}{#if jpSameAsTrad}🇯🇵{/if}{#if koreanChar && krSameAsTrad && !krHasDifferentForm}🇰🇷{/if}
										</div>
									</div>
								{/if}

								<!-- Simplified Chinese (only if different from traditional) -->
								{#if simplifiedChar && !simpSameAsTrad}
									<div class="flex flex-col items-center gap-2">
										<div
											id="simp-writer-target"
											class="w-[80px] h-[80px] md:w-[100px] md:h-[100px] flex items-center justify-center bg-bg-secondary rounded-xl shadow-lg border border-border"
										>
											<div lang="zh-Hans" class="text-5xl md:text-7xl font-bold font-cjk leading-none text-text-primary">
												{simplifiedChar}
											</div>
										</div>
										<div class="text-xs md:text-base tracking-wide">
											🇨🇳{#if jpSameAsSimp}🇯🇵{/if}
										</div>
									</div>
								{/if}

								<!-- Japanese Kanji (only if different from both trad and simp) -->
								{#if japaneseChar && !jpSameAsTrad && !jpSameAsSimp}
									<div class="flex flex-col items-center gap-2">
										<div
											id="jp-writer-target"
											class="w-[80px] h-[80px] md:w-[100px] md:h-[100px] flex items-center justify-center bg-bg-secondary rounded-xl shadow-lg border border-border"
										>
											<div lang="ja" class="text-5xl md:text-7xl font-bold font-cjk leading-none text-text-primary">
												{japaneseChar}
											</div>
										</div>
										<div class="text-xs md:text-base tracking-wide">
											🇯🇵{#if koreanChar && krSameAsJp && !krHasDifferentForm}🇰🇷{/if}
										</div>
									</div>
								{/if}

								<!-- Korean Hanja (only if it has a distinct form from all others) -->
								{#if krHasDifferentForm && koreanHanjaForm}
									<div class="flex flex-col items-center gap-2">
										<div
											class="w-[80px] h-[80px] md:w-[100px] md:h-[100px] flex items-center justify-center bg-bg-secondary rounded-xl shadow-lg border border-border"
										>
											<div lang="ko" class="text-5xl md:text-7xl font-bold font-cjk leading-none text-text-primary">
												{koreanHanjaForm}
											</div>
										</div>
										<div class="text-xs md:text-base tracking-wide">
											🇰🇷
										</div>
									</div>
								{/if}

								<!-- Hong Kong variant (only if it has a distinct form from all others) -->
								{#if hkHasDifferentForm && hkChar}
									<div class="flex flex-col items-center gap-2">
										<div
											class="w-[80px] h-[80px] md:w-[100px] md:h-[100px] flex items-center justify-center bg-bg-secondary rounded-xl shadow-lg border border-border"
										>
											<div lang="zh-HK" class="text-5xl md:text-7xl font-bold font-cjk leading-none text-text-primary">
												{hkChar}
											</div>
										</div>
										<div class="text-xs md:text-base tracking-wide">
											🇭🇰
										</div>
									</div>
								{/if}
							</div>

							<!-- Main Meaning (Gloss) + Pronunciations -->
							{#if uniqueGloss || data.data.chinese_char?.gloss}
								<div class="min-w-0">
									<div class="flex items-center gap-2 mb-1 md:mb-2">
										<h1
											class="text-xl md:text-4xl font-bold text-accent leading-tight flex-1 study-hide"
											onclick={handleStudyClick}
										>
											{uniqueGloss || stripVariantIndicator(data.data.chinese_char?.gloss || '')}
										</h1>
										{#if data.data.chinese_char?.statistics?.hskLevel}
											<span class="level-badge hsk">HSK {data.data.chinese_char.statistics.hskLevel}</span>
										{/if}
										{#if data.data.japanese_char?.misc?.jlptLevel}
											<span class="level-badge jlpt">N{data.data.japanese_char.misc.jlptLevel}</span>
										{/if}
										<StudyModeToggle />
										<ShareButton title="{data.word} - Kiokun Dictionary" />
										<SaveToStudy
											word={data.word}
											language={data.data.chinese_char ? 'zh' : (data.data.japanese_char ? 'ja' : 'ko')}
											size="sm"
										/>
									</div>
									<!-- Taxonomy breadcrumb -->
									{#if taxonomy && taxonomy.length > 0}
										<div class="text-xs text-text-tertiary mb-2 flex items-center gap-1 flex-wrap">
											{#each taxonomy as category, i}
												<a
													href="/category/{taxonomy.slice(0, i + 1).join('/')}"
													class="text-text-secondary underline hover:text-accent transition-colors"
												>{category}</a>
												{#if i < taxonomy.length - 1}
													<span class="text-text-tertiary">→</span>
												{/if}
											{/each}
										</div>
									{/if}
									<!-- Pinyin/Readings Summary - always left-aligned -->
									<!-- svelte-ignore a11y_click_events_have_key_events -->
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<div class="flex flex-col gap-1 text-text-secondary text-sm md:text-base study-hide" onclick={handleStudyClick}>
										{#if data.data.chinese_char?.pinyinFrequencies && data.data.chinese_char.pinyinFrequencies.length > 0}
											{@const wordPinyins = new Set(
												data.data.chinese_words?.flatMap(
													(w) =>
														w.items
															?.map(
																(item) =>
																	item.pinyin,
															)
															.filter(Boolean),
												) || [],
											)}
											{@const filteredPinyins =
												data.data.chinese_char.pinyinFrequencies.filter(
													(pf) =>
														wordPinyins.has(
															pf.pinyin,
														),
												)}
											{@const displayPinyins = filteredPinyins.length > 0 ? filteredPinyins : data.data.chinese_char.pinyinFrequencies}
											<div class="font-mono text-pinyin">
												{displayPinyins
													.map((pf) => pf.pinyin)
													.join(", ")}
											</div>
										{:else if data.data.chinese_char?.oldPronunciations?.length}
											{@const pinyinFromOld = [...new Set(data.data.chinese_char.oldPronunciations.map((p) => p.pinyin).filter(Boolean))]}
											{#if pinyinFromOld.length > 0}
												<div class="font-mono text-pinyin">
													{pinyinFromOld.join(", ")}
												</div>
											{/if}
										{:else if data.data.chinese_words?.length}
											{@const pinyinFromWords = [...new Set(data.data.chinese_words.flatMap((w) => w.items?.map((item) => item.pinyin).filter(Boolean) || []))]}
											{#if pinyinFromWords.length > 0}
												<div class="font-mono text-pinyin">
													{pinyinFromWords.join(", ")}
												</div>
											{/if}
										{/if}
										<!-- Cantonese (Jyutping) readings from Unihan -->
										{#if data.data.chinese_char?.cantonese && data.data.chinese_char.cantonese.length > 0}
											<div class="font-mono text-cantonese">
												{data.data.chinese_char.cantonese.join(", ")}
											</div>
										{/if}
										{#if data.data.japanese_char?.readingMeaning}
											{@const allReadings =
												data.data.japanese_char
													.readingMeaning.groups?.[0]
													?.readings ||
												data.data.japanese_char
													.readingMeaning.readings ||
												[]}
											{@const onyomi = allReadings
												.filter(
													(r) => r.type === "ja_on",
												)
												.map((r) => r.value)}
											{@const kunyomi = allReadings
												.filter(
													(r) => r.type === "ja_kun",
												)
												.map((r) => r.value)}
											{#if onyomi.length > 0}
												<div class="font-cjk text-onyomi">
													{onyomi.join("、")}
												</div>
											{/if}
											{#if kunyomi.length > 0}
												<div class="font-cjk text-kunyomi">
													{kunyomi.join("、")}
												</div>
											{/if}
										{/if}
										{#if koreanChar && koreanChar.readings?.length > 0}
											<div class="font-cjk text-korean">
												{koreanChar.readings.map(r => r.hangul).join(", ")}
											</div>
										{/if}
									</div>
								</div>
							{/if}
						</div>
					</div>

					<!-- Mnemonic Hint (on its own line below header) -->
					{#if showClaudeMnemonics && data.data.chinese_char?.hint}
						<div
							class="mb-3 p-2 rounded border"
							style="background: var(--color-hint-bg); border-color: var(--color-hint-border);"
						>
							<div class="text-sm leading-relaxed text-hint-text">
								{data.data.chinese_char.hint}
							</div>
						</div>
					{/if}

					<!-- Unified Components + Equation Section -->
					{#if (data.data.chinese_char?.components && data.data.chinese_char.components.length > 0) || (simplifiedCharData?.components && simplifiedCharData.components.length > 0) || japaneseComponents}
						{@const tradMakemeahanziImage =
							data.data.chinese_char?.images?.find(
								(img: any) =>
									img &&
									img.source === "makemeahanzi" &&
									img.data,
							)}
						{@const simpMakemeahanziImage =
							simplifiedCharData?.images?.find(
								(img: any) =>
									img &&
									img.source === "makemeahanzi" &&
									img.data,
							)}
						{@const hasTradComponents = data.data.chinese_char?.components && data.data.chinese_char.components.length > 0}
						{@const hasSimpComponents = simplifiedCharData?.components && simplifiedCharData.components.length > 0 && simplifiedChar}
						{@const showSimpColumn = hasSimpComponents && traditionalChar !== simplifiedChar && !tradSimpEquivalent}
						{@const hasJpComponents = japaneseComponents && japaneseComponents.length > 0}
						{@const showJpColumn = hasJpComponents && japaneseChar && japaneseChar !== traditionalChar && !tradJpEquivalent && (!showSimpColumn || !simpJpEquivalent)}
						{@const columnCount = (hasTradComponents ? 1 : 0) + (showSimpColumn ? 1 : 0) + (showJpColumn ? 1 : 0)}
						{@const showLabels = columnCount > 1}

						{#if columnCount > 0}
						<SectionHeading id="components">Components</SectionHeading>

						<div class="mb-4">
							<!-- Grid with 1-3 columns based on how many variants differ -->
							<div class={
								columnCount === 3 ? "grid grid-cols-1 md:grid-cols-3 gap-6" :
								columnCount === 2 ? "grid grid-cols-1 md:grid-cols-2 gap-6" :
								""
							}>
								<!-- Traditional column -->
								{#if hasTradComponents}
									<div class="flex flex-col gap-3">
										{#if showLabels}
											<div class="text-xs font-medium text-text-muted uppercase tracking-wider">
												Traditional ({traditionalChar})
											</div>
										{/if}
										<!-- Mini-equation at top of column -->
										<CharacterEquation
											components={data.data.chinese_char.components}
											targetChar={traditionalChar}
											targetGloss={uniqueGloss || data.data.chinese_char?.gloss}
											charGlosses={data.charGlosses}
										/>
										<!-- Detailed component cards -->
										{#each data.data.chinese_char.components as comp}
											{@const char = typeof comp === "string" ? comp : comp.character || comp.char || comp}
											{@const types = comp.componentType || comp.type || []}
											{@const hint = comp.hint}
											{@const pinyin = comp.pinyin}
											{@const dictMeaning = comp.meaning}
											{@const curatedGloss = cleanComponentGloss(data.charGlosses?.[char] || '')}
											{@const isMeaning = types.includes("meaning")}
											{@const isPhonetic = types.includes("phonetic") || types.includes("sound")}
											{@const isIconic = types.includes("iconic")}
											{@const highlightColor = isMeaning ? "#27ae60" : isPhonetic ? "#e74c3c" : isIconic ? "#3498db" : "#95a5a6"}
											{@const typeLabel = isMeaning ? "Meaning" : isPhonetic ? "Phonetic" : isIconic ? "Iconic" : ""}

											<div class="component-card flex items-start gap-2 py-2 px-3 rounded-lg w-full">
												<div class="relative w-[60px] h-[60px] flex-shrink-0">
													{#if tradMakemeahanziImage?.data?.strokes && !tradUsedSequentialFallback}
														{@const componentStrokes = componentStrokeMap.get(char) || []}
														<svg width="60" height="60" viewBox="0 0 1024 1024" class="absolute top-0 left-0">
															<g transform="scale(1, -1) translate(0, -900)">
																{#each tradMakemeahanziImage.data.strokes as stroke, i}
																	<path d={stroke} fill={componentStrokes.includes(i) ? highlightColor : "#4b5563"} class="transition-colors duration-300" />
																{/each}
															</g>
														</svg>
													{:else}
														<div class="w-full h-full flex items-center justify-center text-3xl font-serif text-text-primary">{char}</div>
													{/if}
												</div>
												<div class="flex flex-col justify-center min-w-0">
													<div class="flex items-center gap-2 mb-1">
														<a href="/{char}" class="text-2xl font-serif text-text-primary hover:text-accent-primary transition-colors">{char}</a>
														{#if typeLabel}
															<span class="text-xs px-2 py-0.5 rounded-full" style="background-color: {highlightColor}20; color: {highlightColor}; border: 1px solid {highlightColor}40;">
																{typeLabel} component
															</span>
														{/if}
													</div>
													{#if pinyin || curatedGloss}
														<div class="flex items-baseline gap-2 text-sm">
															{#if pinyin}<span class="font-mono text-accent-primary">{pinyin}</span>{/if}
															{#if curatedGloss}<span class="text-text-secondary">{curatedGloss}</span>{/if}
														</div>
													{/if}
													{#if dictMeaning && isUsefulMeaning(dictMeaning, curatedGloss)}
														<div class="text-xs text-text-tertiary">{dictMeaning}</div>
													{/if}
													{#if hint}
														<div class="text-xs text-text-tertiary mt-1 italic">{hint}</div>
													{/if}
													{#if isPhonetic}
														<a href="/phonetic/{char}" class="text-xs mt-1 hover:underline transition-colors" style="color: #e74c3c;">
															View phonetic series &rarr;
														</a>
													{/if}
												</div>
											</div>
										{/each}
									</div>
								{/if}

								<!-- Simplified column (only if significantly different from traditional) -->
								{#if showSimpColumn && hasSimpComponents}
									<div class="flex flex-col gap-3">
										{#if showLabels}
											<div class="text-xs font-medium text-text-muted uppercase tracking-wider">
												Simplified ({simplifiedChar})
											</div>
										{/if}
										<CharacterEquation
											components={simplifiedCharData.components}
											targetChar={simplifiedChar}
											targetGloss={simplifiedCharData.gloss || uniqueGloss}
											charGlosses={data.charGlosses}
										/>
										{#each simplifiedCharData.components as comp}
											{@const char = typeof comp === "string" ? comp : comp.character || comp.char || comp}
											{@const types = comp.componentType || comp.type || []}
											{@const hint = comp.hint}
											{@const pinyin = comp.pinyin}
											{@const dictMeaning = comp.meaning}
											{@const curatedGloss = cleanComponentGloss(data.charGlosses?.[char] || '')}
											{@const isMeaning = types.includes("meaning")}
											{@const isPhonetic = types.includes("phonetic") || types.includes("sound")}
											{@const isIconic = types.includes("iconic")}
											{@const isSimplified = types.includes("simplified")}
											{@const highlightColor = isMeaning ? "#27ae60" : isPhonetic ? "#e74c3c" : isIconic ? "#3498db" : isSimplified ? "#9b59b6" : "#95a5a6"}
											{@const typeLabel = isMeaning ? "Meaning" : isPhonetic ? "Phonetic" : isIconic ? "Iconic" : isSimplified ? "Simplified" : ""}

											<div class="component-card flex items-start gap-2 py-2 px-3 rounded-lg w-full">
												<div class="relative w-[60px] h-[60px] flex-shrink-0">
													{#if simpMakemeahanziImage?.data?.strokes && !simpUsedSequentialFallback}
														{@const componentStrokes = simpComponentStrokeMap.get(char) || []}
														<svg width="60" height="60" viewBox="0 0 1024 1024" class="absolute top-0 left-0">
															<g transform="scale(1, -1) translate(0, -900)">
																{#each simpMakemeahanziImage.data.strokes as stroke, i}
																	<path d={stroke} fill={componentStrokes.includes(i) ? highlightColor : "#4b5563"} class="transition-colors duration-300" />
																{/each}
															</g>
														</svg>
													{:else}
														<div class="w-full h-full flex items-center justify-center text-3xl font-serif text-text-primary">{char}</div>
													{/if}
												</div>
												<div class="flex flex-col justify-center min-w-0">
													<div class="flex items-center gap-2 mb-1">
														<a href="/{char}" class="text-2xl font-serif text-text-primary hover:text-accent-primary transition-colors">{char}</a>
														{#if typeLabel}
															<span class="text-xs px-2 py-0.5 rounded-full" style="background-color: {highlightColor}20; color: {highlightColor}; border: 1px solid {highlightColor}40;">
																{typeLabel} component
															</span>
														{/if}
													</div>
													{#if pinyin || curatedGloss}
														<div class="flex items-baseline gap-2 text-sm">
															{#if pinyin}<span class="font-mono text-accent-primary">{pinyin}</span>{/if}
															{#if curatedGloss}<span class="text-text-secondary">{curatedGloss}</span>{/if}
														</div>
													{/if}
													{#if dictMeaning && isUsefulMeaning(dictMeaning, curatedGloss)}
														<div class="text-xs text-text-tertiary">{dictMeaning}</div>
													{/if}
													{#if hint}
														<div class="text-xs text-text-tertiary mt-1 italic">{hint}</div>
													{/if}
													{#if isPhonetic}
														<a href="/phonetic/{char}" class="text-xs mt-1 hover:underline transition-colors" style="color: #e74c3c;">
															View phonetic series &rarr;
														</a>
													{/if}
												</div>
											</div>
										{/each}
									</div>
								{/if}

								<!-- Japanese column (IDS-derived components, simpler cards) -->
								{#if showJpColumn && hasJpComponents && japaneseComponents}
									<div class="flex flex-col gap-3">
										{#if showLabels}
											<div class="text-xs font-medium text-text-muted uppercase tracking-wider">
												Japanese ({japaneseChar})
											</div>
										{/if}
										<CharacterEquation
											components={japaneseComponents}
											targetChar={japaneseChar}
											targetGloss={uniqueGloss || data.data.chinese_char?.gloss}
											charGlosses={data.charGlosses}
										/>
										{#each japaneseComponents as comp}
											{@const char = comp.character}
											{@const curatedGloss = cleanComponentGloss(data.charGlosses?.[char] || comp.meaning || '')}

											<div class="component-card flex items-start gap-2 py-2 px-3 rounded-lg w-full">
												<div class="relative w-[60px] h-[60px] flex-shrink-0">
													<div class="w-full h-full flex items-center justify-center text-3xl font-serif text-text-primary">{char}</div>
												</div>
												<div class="flex flex-col justify-center min-w-0">
													<div class="flex items-center gap-2 mb-1">
														<a href="/{char}" class="text-2xl font-serif text-text-primary hover:text-accent-primary transition-colors">{char}</a>
													</div>
													{#if curatedGloss}
														<div class="text-sm text-text-secondary">{curatedGloss}</div>
													{/if}
												</div>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						</div>
					{/if}
					{/if}

					<SemanticMnemonicCard card={data.data.semantic_mnemonic} />

					<!-- Statistics section removed - data overlaps with word views -->

					<!-- Similar Characters -->
					{#if data.data.chinese_char?.components}
						{@const compChars = componentChars(data.data.chinese_char.components)}

						<!-- Notes above similar characters -->
						<Notes character={traditionalChar} />

						<SimilarCharacters
							targetChar={traditionalChar}
							targetStrokeCount={data.data.chinese_char.strokeCount}
							targetComponents={compChars}
							componentUses={data.componentUses}
							charGlosses={data.charGlosses}
						/>
					{:else}
						<Notes character={traditionalChar} />
					{/if}
				</div>
			</div>

			<!-- Historical Evolution (reference material, below the learning sections) -->
			{#if data.data.chinese_char?.images && data.data.chinese_char.images.filter((img: { url?: string }) => img.url).length > 0}
				{@const historicalImages = data.data.chinese_char.images.filter((img: { url?: string }) => img.url)}
				<div class="mb-3">
					<SectionHeading id="history">Historical Evolution</SectionHeading>
					<div class="flex gap-2 overflow-x-auto pb-2">
						{#each historicalImages as image}
							{#if image.url}
								<div class="historical-card">
									<img
										src={image.url}
										alt="{image.type || 'Historical'} {image.era || ''}"
										class="historical-image w-14 h-14 mx-auto object-contain"
										loading="lazy"
										onerror={(e) => {
											const target = e.currentTarget as HTMLImageElement;
											target.style.display = 'none';
											const fallback = target.nextElementSibling as HTMLElement;
											if (fallback) fallback.style.display = 'flex';
										}}
									/>
									<div class="hidden w-14 h-14 mx-auto items-center justify-center text-2xl font-cjk text-text-primary">
										{data.word}
									</div>
									<div class="text-[11px] font-medium text-text-secondary mt-1.5">
										{image.type || 'Unknown'}
									</div>
									{#if image.era}
										<div class="text-[9px] text-text-tertiary mt-0.5">
											{image.era}
										</div>
									{/if}
								</div>
							{/if}
						{/each}
						<div class="historical-card">
							<div class="w-14 h-14 mx-auto flex items-center justify-center text-3xl font-cjk text-text-primary">
								{data.word}
							</div>
							<div class="text-[11px] font-medium text-text-secondary mt-1.5">
								Regular
							</div>
							<div class="text-[9px] text-text-tertiary mt-0.5">
								Modern
							</div>
						</div>
					</div>
				</div>
			{/if}

			<!-- Comments (from Academia Sinica, etc.) -->
			{#if data.data.chinese_char?.comments && data.data.chinese_char.comments.length > 0}
				<div class="mb-3">
					{#each data.data.chinese_char.comments as comment}
						{#if comment && comment.source && comment.comment}
							<div
								class="p-2.5 rounded border mb-2"
								style="background: var(--bg-tertiary); border-color: var(--border-light);"
							>
								<div class="text-xs text-tertiary font-semibold mb-1">
									{comment.source}
								</div>
								<div class="text-sm leading-relaxed" style="color: var(--text-secondary);">
									{comment.comment}
								</div>
							</div>
						{/if}
					{/each}
				</div>
			{/if}
		{/if}

		<!-- Chinese, Japanese, and Korean Words -->
		{#if showChineseWords || showJapaneseWords || showKoreanWords}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="word-sections-grid study-hide" class:two-primary-word-grid={twoPrimaryWordColumns} onclick={handleStudyClick}>
				<!-- Chinese Words -->
				{#if data.data.chinese_words?.length && languageStore.preferences.chinese}
					<div class="word-section-chinese">
						<SectionHeading id="chinese">Chinese</SectionHeading>
						<div class="mb-4">
							{#each data.data.chinese_words as word}
								{#if word.items && word.items.length > 0}
									{@const itemsWithDefs = word.items.filter(
										(item) =>
											item.definitions &&
											item.definitions.length > 0,
									)}
									{#each itemsWithDefs as item}
										<div class="chinese-word-entry" lang="zh">
											<!-- Character and Pinyin -->
											<div class="chinese-headwords">
												<span class="chinese-word-text">
													{#if word.simp && word.trad && word.simp !== word.trad}
														<span lang="zh-Hans">{word.simp}</span> / <span lang="zh-Hant">{word.trad}</span>
													{:else}
														{word.trad || word.simp || data.word}
													{/if}
												</span>
												{#if item.pinyin}
													<span
														class="chinese-pronunciation"
													>
														[{item.pinyin}]
													</span>
												{/if}
												{#if item.jyutping}
													<span
														class="cantonese-pronunciation"
														title="Cantonese (Jyutping)"
													>
														[{item.jyutping}]
													</span>
												{/if}
												<SpeakButton text={word.simp || word.trad || data.word} lang="zh" size={18} />
												<SaveToStudy word={word.simp || word.trad || data.word} language="zh" size="sm" />
											</div>
											<!-- Definitions -->
											{#if item.definitions && item.definitions.length > 0}
												<div
													class="chinese-definitions"
												>
													{item.definitions.join(
														"; ",
													)}
												</div>
											{/if}
										</div>
									{/each}
								{/if}
							{/each}
						</div>
					</div>
				{/if}

				<!-- Japanese Words -->
				{#if data.data.japanese_words?.length && languageStore.preferences.japanese}
					<div class="word-section-japanese">
						<SectionHeading id="japanese">Japanese</SectionHeading>
						<div class="mb-4" lang="ja">
							<WordTable
								words={data.data.japanese_words}
								accentDisplay="binary"
							/>
						</div>
					</div>
				{/if}

				<!-- Korean Words -->
				{#if data.data.korean_words?.length && languageStore.preferences.korean}
					<div class="word-section-korean" lang="ko">
						<SectionHeading id="korean">Korean</SectionHeading>
						<div class="mb-4">
							{#each data.data.korean_words as word}
								<div class="korean-word-entry">
									<!-- Hangul and Hanja -->
									<div class="korean-headwords">
										<span class="korean-word-text">{word.hangul}</span>
										{#if word.hanja}
											<span class="korean-hanja">[{word.hanja}]</span>
										{/if}
										<SpeakButton text={word.hangul} lang="ko" size={18} />
										<SaveToStudy word={word.hangul} language="ko" size="sm" />
									</div>
									<!-- Part of speech -->
									{#if word.pos}
										<div class="korean-pos-tags">
										<Tag type="pos" text={word.pos} langTag="en" />
									</div>
									{/if}
									<!-- Definitions -->
									{#if word.definitions && word.definitions.length > 0}
										<div class="korean-definitions">
											{word.definitions.map(d => d.text).join("; ")}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Homophones -->
		{#if homophones.length > 0}
			<SectionHeading id="homophones">Homophones</SectionHeading>
			<div class="homophones-section">
				{#each homophones as group}
					<div class="homophone-group">
						{#if homophones.length > 1}
							<div class="homophone-reading">{group.reading}</div>
						{/if}
						<div class="homophone-list">
							{#each group.words as hp}
								<a href="/{hp.word}" class="homophone-chip" class:common={hp.is_common}>
									{hp.word}
								</a>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Notes Section — show here (after words) when there's no character data -->
		{#if !(data.data.chinese_char || data.data.japanese_char)}
			<Notes character={traditionalChar} />
		{/if}

		<!-- Example Sentences — unified grid matching the definition columns layout -->
		{#if anySentencesVisible}
			<SectionHeading id="sentences">Example Sentences</SectionHeading>
		{/if}
		<div class="word-sections-grid" style={anySentencesVisible ? 'margin-bottom: var(--spacing-lg);' : 'display: none;'}>
			{#if languageStore.preferences.japanese}
				<SentenceExamples
					japaneseSenses={data.data.japanese_words?.flatMap((w: any) => w.sense) ?? []}
					koreanWords={[]}
				/>
			{/if}

			{#if data.data.chinese_words?.length && languageStore.preferences.chinese}
				<ChineseSentenceExamples word={data.word} bind:hasContent={zhSentencesHaveContent} />
			{/if}

			{#if (data.data.korean_words?.length || data.data.korean_char || data.data.contained_in_korean?.length) && languageStore.preferences.korean}
				<KoreanSentenceExamples
					word={data.word}
					containedInKorean={data.data.contained_in_korean?.map((w: any) => typeof w === 'string' ? w : w.w || '') || []}
					bind:hasContent={krSentencesHaveContent}
				/>
			{/if}
		</div>

		<!-- Japanese Names Section -->
		{#if data.data.japanese_names && data.data.japanese_names.length > 0}
			<JapaneseNames names={data.data.japanese_names} word={data.word} />
		{/if}

		<!-- Contains Section (for multi-character words), sorted by position in word -->
		<Contains
			words={sortedContainsWords}
			wordForms={containsWordForms}
			charGlosses={data.charGlosses}
		/>

		<!-- Appears In Section -->
		<AppearsIn
			chineseWords={data.data.contained_in_chinese || []}
			japaneseWords={data.data.contained_in_japanese || []}
			koreanWords={data.data.contained_in_korean || []}
		/>

		<!-- Artifact Mentions -->
		<ArtifactMentions word={data.word} />

		<!-- Reels Sections (show both Japanese and Chinese if applicable) -->
		{#if data.data.japanese_words && data.data.japanese_words.length > 0}
			<ReelsSection word={data.word} language="ja" id="reels-ja" />
		{/if}
		{#if data.data.chinese_words && data.data.chinese_words.length > 0}
			<ReelsSection word={data.word} language="zh" id="reels-zh" />
		{/if}
	</div>
	{/if}
</div>

<style>
	/* Homophones */
	.homophones-section { margin-bottom: var(--spacing-lg); }
	.homophone-group { margin-bottom: var(--spacing-sm); }
	.homophone-reading {
		font-size: var(--font-size-caption1);
		color: var(--text-tertiary);
		margin-bottom: var(--spacing-xs);
	}
	.homophone-list { display: flex; flex-wrap: wrap; gap: 6px; }
	.homophone-chip {
		padding: 3px 10px;
		border-radius: var(--radius-full);
		border: 1px solid var(--border-color);
		font-size: var(--font-size-body);
		color: var(--text-primary);
		text-decoration: none;
		transition: border-color 0.15s, color 0.15s;
	}
	.homophone-chip:hover { border-color: var(--accent); color: var(--accent); }
	.homophone-chip.common { font-weight: 500; }

	/* Level badges */
	.level-badge {
		padding: 2px 8px;
		border-radius: var(--radius-full);
		font-size: 11px;
		font-weight: 600;
		white-space: nowrap;
		flex-shrink: 0;
	}
	.level-badge.hsk { background: var(--badge-hsk-bg); color: var(--badge-hsk-text); }
	.level-badge.jlpt { background: var(--accent-light); color: var(--accent); border: 1px solid var(--accent); }

	/* Custom word display */
	.custom-word-heading {
		font-size: var(--font-size-title);
		font-family: var(--font-cjk);
		font-weight: 700;
		color: var(--text-primary);
	}

	.custom-word-defs {
		font-size: var(--font-size-body);
		line-height: 1.6;
		color: var(--text-primary);
	}

	.text-cantonese {
		color: var(--color-cantonese);
	}

	/* Responsive column layout for Chinese, Japanese, and Korean word sections.
	   Adapts to 1, 2, or 3 columns based on how many languages have content. */
	.word-sections-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--spacing-lg);
	}

	@media (min-width: 768px) {
		.word-sections-grid {
			grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
			gap: var(--spacing-lg);
		}

		.word-sections-grid.two-primary-word-grid {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			align-items: start;
		}

		.word-sections-grid.two-primary-word-grid .word-section-korean {
			grid-column: 1 / -1;
		}
	}

	/* Chinese word entry styling to match Japanese word styling */
	.chinese-word-entry {
		margin-bottom: var(--spacing-xl);
	}

	.chinese-headwords {
		display: flex;
		align-items: baseline;
		gap: var(--spacing-sm);
		margin-bottom: var(--spacing-sm);
		flex-wrap: wrap;
	}

	.chinese-word-text {
		font-size: var(--font-size-title);
		font-family: var(--font-cjk);
		font-weight: 600;
		color: var(--primary-highlight, #2c3e50);
	}

	.chinese-pronunciation {
		font-size: var(--font-size-body);
		font-family: var(--font-cjk);
		color: var(--reading-highlight, #e74c3c);
	}

	.cantonese-pronunciation {
		font-size: var(--font-size-subhead);
		font-family: var(--font-cjk);
		color: var(--color-cantonese, #e67e22);
	}

	.chinese-definitions {
		font-size: var(--font-size-footnote);
		line-height: 1.5;
		color: var(--text-primary);
	}

	/* Korean word entry styling */
	.korean-word-entry {
		margin-bottom: var(--spacing-xl);
	}

	.korean-headwords {
		display: flex;
		align-items: baseline;
		gap: var(--spacing-sm);
		margin-bottom: var(--spacing-sm);
		flex-wrap: wrap;
	}

	.korean-word-text {
		font-size: var(--font-size-title);
		font-family: var(--font-cjk);
		font-weight: 600;
		color: var(--primary-highlight, #2c3e50);
	}

	.korean-hanja {
		font-size: var(--font-size-body);
		font-family: var(--font-cjk);
		color: var(--text-secondary, #666);
	}

	.korean-pos-tags {
		margin-bottom: var(--spacing-sm);
	}

	.korean-definitions {
		font-size: var(--font-size-footnote);
		line-height: 1.5;
		color: var(--text-primary);
	}

	/* Historical evolution cards */
	.historical-card {
		flex-shrink: 0;
		text-align: center;
		padding: 0.625rem;
		min-width: 70px;
		border-radius: var(--radius-sm);
		transition: background 0.15s ease;
	}

	.historical-card:hover {
		background: var(--bg-tertiary);
	}

	.component-card {
		transition: background 0.15s ease;
	}

	.component-card:hover {
		background: var(--bg-tertiary);
	}

	.historical-image {
		filter: invert(0);
		transition: filter 0.15s ease;
	}

	:global([data-theme='dark']) .historical-image {
		filter: invert(1);
	}

	/* Mobile typography adjustments */
	@media (max-width: 768px) {
		.historical-card {
			padding: var(--spacing-sm);
			min-width: 60px;
		}

		.historical-card .text-\[11px\] {
			font-size: var(--font-size-caption2);
		}

		.historical-card .text-\[9px\] {
			font-size: 9px;
		}
	}
</style>
