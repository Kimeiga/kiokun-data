<script lang="ts">
	import { dev } from "$app/environment";
	import type {
		ChineseComponent,
		SemanticMnemonicCard as SemanticMnemonicCardType,
		SemanticMnemonicComponent,
	} from "$lib/types";
	import type { CharacterSupportData } from "$lib/character-support";
	import {
		learnerGlossForEntry,
		type CharacterHeaderForm,
	} from "$lib/character-forms";
	import CharacterEquation from "$lib/components/CharacterEquation.svelte";
	import SectionHeading from "$lib/components/shared/SectionHeading.svelte";
	import SemanticMnemonicCard from "$lib/components/SemanticMnemonicCard.svelte";
	import LazyComponent from "$lib/components/LazyComponent.svelte";

	const loadNotes = () => import("$lib/components/Notes.svelte");
	const loadSimilarCharacters = () => import("$lib/components/SimilarCharacters.svelte");

	let {
		data,
		support = { charGlosses: {}, charTaxonomy: {}, componentUses: {} },
		mnemonicCards = [],
		simplifiedCharData: loadedSimplifiedCharData = null,
		headerForms = [],
	}: {
		data: any;
		support?: CharacterSupportData;
		mnemonicCards?: SemanticMnemonicCardType[];
		simplifiedCharData?: any;
		headerForms?: CharacterHeaderForm[];
	} = $props();

	let charGlosses = $derived(support?.charGlosses || {});
	let componentUses = $derived(support?.componentUses || {});

	const showClaudeMnemonics = false;

	function componentChar(component: string | ChineseComponent): string | null {
		if (typeof component === "string") return component;
		return component.character || component.char || null;
	}

	function componentChars(components: Array<string | ChineseComponent> | undefined): string[] {
		return (components || [])
			.map(componentChar)
			.filter((char): char is string => Boolean(char));
	}

	function componentGloss(component: any, glossesMap: Record<string, string>): string {
		const char = componentChar(component);
		const types = typeof component === "string" ? [] : component.componentType || component.type || [];
		if (typeof component !== "string" && (component.visualMnemonic || types.includes("visual"))) {
			return component.visualGloss || component.gloss || component.meaning || "";
		}
		return char ? glossesMap?.[char] || component.meaning || component.gloss || "" : "";
	}

	function normalizedComponentChar(character: string): string {
		return character === "辶" ? "⻌" : character;
	}

	function semanticComponentSignature(components: SemanticMnemonicComponent[] | undefined): string {
		return (components || [])
			.map((component) =>
				`${normalizedComponentChar(component.character)}:${cleanComponentGloss(component.gloss || "").toLowerCase()}`
			)
			.sort()
			.join("|");
	}

	function isLikelyRenderableMnemonicComponent(component: SemanticMnemonicComponent): boolean {
		const character = component.character.trim();
		if (!character || character === "◎" || character.startsWith("&")) return false;
		return [...character].every((char) => (char.codePointAt(0) || 0) <= 0xffff);
	}

	function visibleHistoricalComponentsForCard(card: SemanticMnemonicCardType | undefined): SemanticMnemonicComponent[] {
		const historicalComponents = card?.historical_components || [];
		if (!historicalComponents.length) return [];
		if (historicalComponents.some((component) => !isLikelyRenderableMnemonicComponent(component))) return [];

		const visualComponents = card?.visual_components?.length
			? card.visual_components
			: card?.components || [];

		return semanticComponentSignature(historicalComponents) === semanticComponentSignature(visualComponents)
			? []
			: historicalComponents;
	}

	// Get all character variants
	let traditionalChar = $derived(data.data.chinese_char?.char || data.word);
	let simplifiedChar = $derived(data.data.chinese_char?.simpVariants?.[0]);
	let japaneseChar = $derived(data.data.japanese_char?.literal);

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

	function shouldShowComponentHint(hint: string | undefined, component: ChineseComponent): boolean {
		if (!hint) return false;
		if (component.visualMnemonic && /\b(shorthand|traditional character|simplified character|variant of)\b/i.test(hint)) {
			return false;
		}
		return true;
	}

	let uniqueGloss = $derived(learnerGlossForEntry(data.data));

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

		const getGloss = (c: any) => normalize(componentGloss(c, glossesMap));

		const glossesA = compsA.map(getGloss).filter(Boolean).sort();
		const glossesB = compsB.map(getGloss).filter(Boolean).sort();

		if (glossesA.length !== glossesB.length) return false;
		return glossesA.every((g, i) => g === glossesB[i]);
	}

	function mnemonicVariantLabel(card: SemanticMnemonicCardType): string {
		const form = headerForms.find((item) => item.character === card.character);
		return form ? `${form.roleLabel} (${card.character})` : card.character;
	}

	let semanticMnemonicCards = $derived.by(() => {
		const fallbackCards = [
			data.data.semantic_mnemonic,
			...(data.data.semantic_mnemonic_variants || []),
		].filter((card): card is SemanticMnemonicCardType => Boolean(card));
		const cards = mnemonicCards.length > 0 ? mnemonicCards : fallbackCards;

		const order = new Map<string, number>();
		[
			...headerForms.map((form) => form.character),
			[...data.word].length === 1 ? data.word : undefined,
			traditionalChar,
			simplifiedChar,
			japaneseChar,
		].forEach((char, index) => {
			if (char && !order.has(char)) order.set(char, index);
		});

		const seenChars = new Set<string>();
		const sortedCards = cards
			.filter((card) => {
				if (seenChars.has(card.character)) return false;
				seenChars.add(card.character);
				return true;
			})
			.sort((a, b) => (order.get(a.character) ?? 99) - (order.get(b.character) ?? 99));

		return sortedCards
			.map((card) => ({
				card,
				label: mnemonicVariantLabel(card),
			}));
	});

	// Japanese components from the trad entry's japanese_char.ids field
	let japaneseComponents = $derived.by(() => {
		const ids = (data.data.japanese_char as any)?.ids;
		if (!ids) return undefined;
		const comps = componentsFromIds(ids, charGlosses);
		return comps.length > 0 ? comps : undefined;
	});

	// State for character data and component mappings.
	// Initialized from the deferred learning payload; reset via $effect when navigating to a new word.
	let simplifiedCharData: any = $state(loadedSimplifiedCharData || data.simplifiedCharData || null);

	function mnemonicCardForCharacter(char: string | undefined | null): SemanticMnemonicCardType | undefined {
		if (!char) return undefined;
		return semanticMnemonicCards.find(({ card }) => card.character === char)?.card;
	}

	function componentsFromMnemonicCard(
		card: SemanticMnemonicCardType | undefined,
		fallbackComponents: ChineseComponent[] | undefined,
	): ChineseComponent[] | undefined {
		const components = card?.visual_components?.length ? card.visual_components : card?.components || [];
		if (!components.length) return undefined;
		const historicalComponents = visibleHistoricalComponentsForCard(card);

		return components.map((component, index) => {
			const fallback = fallbackComponents?.[index];
			const fallbackTypes =
				typeof fallback === "string" || !fallback
					? []
					: fallback.componentType || fallback.type || [];
			const historical = historicalComponents[index];
			const fallbackChar = fallback ? componentChar(fallback) : null;
			const historicalChar = historical?.character || fallbackChar || "";
			const historicalGloss =
				historical?.gloss ||
				(typeof fallback === "string" || !fallback ? "" : fallback.meaning || fallback.gloss || "");
			const visualChar = component.character;
			const visualGloss = component.gloss;
			const hasOriginalContext =
				Boolean(historicalChar) &&
				normalizedComponentChar(historicalChar) !== normalizedComponentChar(visualChar);
			const pinyin =
				typeof fallback === "string" || !fallback || hasOriginalContext
					? undefined
					: fallback.pinyin;

			return {
				character: visualChar,
				meaning: visualGloss,
				gloss: visualGloss,
				visualGloss,
				componentType: fallbackTypes,
				type: fallbackTypes,
				hint: typeof fallback === "string" || hasOriginalContext ? undefined : fallback?.hint,
				pinyin,
				phonetic: typeof fallback === "string" ? undefined : fallback?.phonetic,
				visualMnemonic: true,
				originalCharacter: hasOriginalContext ? historicalChar : undefined,
				originalGloss: hasOriginalContext ? historicalGloss : undefined,
				originalPinyin:
					hasOriginalContext && typeof fallback !== "string" ? fallback?.pinyin : undefined,
				originalHint:
					hasOriginalContext && typeof fallback !== "string" ? fallback?.hint : undefined,
				originalType: fallbackTypes,
			};
		});
	}

	function componentsForVariant(
		char: string | undefined | null,
		fallbackComponents: ChineseComponent[] | undefined,
	): ChineseComponent[] | undefined {
		return componentsFromMnemonicCard(mnemonicCardForCharacter(char), fallbackComponents) || fallbackComponents;
	}

	let tradDisplayComponents = $derived.by(() =>
		componentsForVariant(traditionalChar, data.data.chinese_char?.components)
	);
	let simpDisplayComponents = $derived.by(() =>
		componentsForVariant(simplifiedChar, simplifiedCharData?.components)
	);
	let jpDisplayComponents = $derived.by(() =>
		componentsForVariant(japaneseChar, japaneseComponents)
	);

	// Reset ALL page-level state when navigating to a new character (client-side navigation).
	// Without this, previous page data leaks into the new page (stale simp data, stroke maps, etc.)
	$effect(() => {
		// Track data.word to trigger on navigation
		const _word = data.word;
		simplifiedCharData = loadedSimplifiedCharData || data.simplifiedCharData || null;
		componentStrokeMap = new Map();
		simpComponentStrokeMap = new Map();
		tradUsedSequentialFallback = false;
		simpUsedSequentialFallback = false;
	});
	let componentStrokeMap: Map<string, number[]> = $state(new Map()); // For traditional/main character
	let simpComponentStrokeMap: Map<string, number[]> = $state(new Map()); // For simplified character
	let tradUsedSequentialFallback = $state(false); // True if traditional used sequential fallback (unreliable)
	let simpUsedSequentialFallback = $state(false); // True if simplified used sequential fallback (unreliable)

	// Equivalence states (declared after simplifiedCharData since they read from it)
	let tradSimpEquivalent = $derived(
		componentsAreEquivalent(
			tradDisplayComponents,
			simpDisplayComponents,
			charGlosses
		)
	);

	let tradJpEquivalent = $derived.by(() =>
		componentsAreEquivalent(
			tradDisplayComponents,
			jpDisplayComponents,
			charGlosses
		)
	);

	let simpJpEquivalent = $derived.by(() =>
		componentsAreEquivalent(
			simpDisplayComponents,
			jpDisplayComponents,
			charGlosses
		)
	);

	// Helper to load component mappings from makemeahanzi's matches field
	// The matches field maps each stroke to its component index
	// e.g., for 图: [[0],[0],[1],[1],[1],[1],[1],[0]] means strokes 0,1,7 belong to component 0 (囗), strokes 2-6 to component 1 (冬)
	function loadMakemeahanziMappings(
		char: string,
		targetMap: "trad" | "simp",
	): boolean {
		if (dev) console.log(`[MAKEMEAHANZI] Checking for matches data for ${char} (${targetMap})`);

		// Get the makemeahanzi image data
		const makemeahanziImage = targetMap === "trad"
			? data.data.chinese_char?.images?.find((img: any) => img.source === 'makemeahanzi')
			: simplifiedCharData?.images?.find((img: any) => img.source === 'makemeahanzi');

		const matches = makemeahanziImage?.data?.matches;
		if (!matches || !Array.isArray(matches)) {
			if (dev) console.log(`[MAKEMEAHANZI] No matches field found for ${char}`);
			return false;
		}

		// Get our components list
		const components = targetMap === "trad"
			? tradDisplayComponents
			: simpDisplayComponents;

		if (!components || components.length === 0) {
			if (dev) console.log(`[MAKEMEAHANZI] No components in our data for ${char}`);
			return false;
		}

		if (dev) console.log(`[MAKEMEAHANZI] Found matches for ${char}:`, matches);
		if (dev) console.log(`[MAKEMEAHANZI] Components:`, components.map((c: any) => typeof c === 'string' ? c : c.character || c.char));

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

		if (dev) console.log(`[MAKEMEAHANZI] Component index -> strokes:`, Object.fromEntries(componentToStrokes));

		// Now map component characters to their stroke indices
		const newMap = new Map<string, number[]>();

		// Count how many components makemeahanzi has vs how many we have
		const makemeahanziComponentCount = componentToStrokes.size;
		const ourComponentCount = components.length;

		if (dev) console.log(`[MAKEMEAHANZI] Component count comparison: ours=${ourComponentCount}, makemeahanzi=${makemeahanziComponentCount}`);

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
				const compChar = componentChar(components[0]);
				if (!compChar) return false;
				newMap.set(compChar, allStrokes);
				if (dev) console.log(`[MAKEMEAHANZI] ✓ Single component "${compChar}" gets ALL strokes (makemeahanzi has ${makemeahanziComponentCount} components) → strokes ${allStrokes.join(', ')}`);
			} else {
				// Multiple components but fewer than makemeahanzi: distribute strokes proportionally
				// This is a heuristic - we divide strokes roughly evenly among our components
				const strokesPerComponent = Math.ceil(allStrokes.length / ourComponentCount);
				let strokeIndex = 0;

				components.forEach((comp: any) => {
					const compChar = componentChar(comp);
					if (!compChar) return;
					const endIndex = Math.min(strokeIndex + strokesPerComponent, allStrokes.length);
					const assignedStrokes = allStrokes.slice(strokeIndex, endIndex);

					if (assignedStrokes.length > 0) {
						newMap.set(compChar, assignedStrokes);
						if (dev) console.log(`[MAKEMEAHANZI] ✓ Component "${compChar}" (proportional distribution) → strokes ${assignedStrokes.join(', ')}`);
					}
					strokeIndex = endIndex;
				});
			}
		} else {
			// Normal case: component counts match or we have more - use index-based mapping
			components.forEach((comp: any, index: number) => {
				const compChar = componentChar(comp);
				if (!compChar) return;
				const strokes = componentToStrokes.get(index) || [];
				if (strokes.length > 0) {
					newMap.set(compChar, strokes);
					if (dev) console.log(`[MAKEMEAHANZI] ✓ Component "${compChar}" (index ${index}) → strokes ${strokes.join(', ')}`);
				} else {
					if (dev) console.log(`[MAKEMEAHANZI] ⚠️ Component "${compChar}" (index ${index}) has no strokes mapped`);
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
			if (dev) console.log(`[MAKEMEAHANZI] Successfully loaded mappings from matches field`);
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

		// KanjiVG only contains Japanese forms. Chinese-only forms such as 图 can
		// legitimately be absent, so avoid an expected 404 and use the local
		// sequential fallback directly.
		const form = headerForms.find((item) => item.character === char);
		const isJapaneseForm =
			char === japaneseChar || Boolean(form?.roles.includes("japanese"));
		if (!isJapaneseForm) {
			await loadSequentialComponentMappings(char, targetMap);
			return;
		}

		// Fall back to KanjiVG for Japanese characters when makemeahanzi
		// component matches are unavailable.
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
								? tradDisplayComponents
								: simpDisplayComponents;

						const ourComponentChars = ourComponents?.map((comp: any) =>
							typeof comp === "string"
								? comp
								: comp.character || comp.char || comp
						) || [];
						console.log(`[COMPONENT-MAP] Our data's components:`, ourComponentChars);

						if (ourComponents && ourComponents.length > 0) {
							// Check if any of our components are missing from KanjiVG
							for (const comp of ourComponents) {
								const compChar = componentChar(comp);
								if (!compChar) continue;

								if (!newMap.has(compChar)) {
									console.log(`[COMPONENT-MAP] ⚠️ Component "${compChar}" NOT found in KanjiVG - calculating complement`);
									// Component not found in KanjiVG - calculate as complement
									// Find all strokes NOT assigned to other known components
									const assignedStrokes = new Set<number>();
									for (const otherComp of ourComponents) {
										const otherChar = componentChar(otherComp);
										if (!otherChar) continue;
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
					? tradDisplayComponents
					: simpDisplayComponents;

			if (!components || components.length === 0) {
				console.log(`[SEQUENTIAL] No components found in data`);
				return;
			}

			const newMap = new Map<string, number[]>();
			let currentStrokeIndex = 0;

			for (const comp of components) {
				// Extract character string if comp is an object
				const compChar = componentChar(comp);
				if (!compChar) continue;

				// Fetch stroke count for component
				try {
					const response = await fetch(
						`/api/stroke-data?char=${encodeURIComponent(compChar)}`,
					);
					if (response.ok && response.status !== 204) {
						const compData = await response.json();
						const strokeCount = compData.strokes.length;

						const strokeIndices = [];
						for (let i = 0; i < strokeCount; i++) {
							strokeIndices.push(currentStrokeIndex + i);
						}

						newMap.set(compChar, strokeIndices);
						console.log(`[SEQUENTIAL] "${compChar}": ${strokeCount} strokes → indices ${strokeIndices.join(', ')}`);
						currentStrokeIndex += strokeCount;
					} else if (response.status !== 204) {
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
				for (const form of headerForms) {
					if (form.character !== char) continue;
					const target = document.getElementById(form.targetId);
					const fallback = targetFallbacks.get(form.targetId);
					if (target && fallback && target.innerHTML === '') {
						target.innerHTML = fallback;
					}
				}
				onErrorOriginal(error);
			};
			const form = headerForms.find((item) => item.character === char);
			const hasChineseRole = form?.roles.some((role) =>
				['traditional', 'hong-kong', 'simplified'].includes(role)
			);
			// Prefer Japanese stroke data for the entry's KANJIDIC form (or a
			// Japanese-only form). A related form can carry a Japanese role
			// without existing in hanzi-writer-data-jp; Chinese data is then the
			// correct first source and avoids a noisy expected 404.
			const isJapanese =
				char === japaneseChar ||
				Boolean(form?.roles.includes('japanese') && !hasChineseRole);

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

				const targetId = headerForms.find(
					(form) => form.character === char
				)?.targetId;
				if (!targetId) throw new Error(`Missing stroke target for ${char}`);
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
						) as HTMLElement | null;
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
			targetFallbacks.set(targetId, target.innerHTML);
			target.innerHTML = "";
			try {
				const writer = HanziWriter.create(target, char, writerConfig);
				writer.loopCharacterAnimation();
			} catch {
				target.innerHTML = targetFallbacks.get(targetId) || "";
			}
		}

		for (const form of headerForms) {
			animateChar(form.targetId, form.character);
		}

		// Load component mappings for traditional character
		if (traditionalChar) {
			tradUsedSequentialFallback = false;
			loadComponentMappings(traditionalChar, "trad");
		}

			// Load component stroke mappings for the simplified character once its
			// deferred component data has arrived.
		if (simplifiedChar && simplifiedChar !== traditionalChar && simpDisplayComponents?.length) {
			simpUsedSequentialFallback = false;
			loadComponentMappings(simplifiedChar, "simp");
		}
	}

	// Re-run animation when data changes
	$effect(() => {
		const currentWord = data.word;
		const targetSignature = headerForms
			.map((form) => `${form.targetId}:${form.character}`)
			.join('|');
		if (!currentWord || !targetSignature) return;

		const timer = setTimeout(() => {
			initHanziWriter();
		}, 50);
		return () => clearTimeout(timer);
	});

</script>

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

	{#if semanticMnemonicCards.length > 0}
		<SectionHeading id="mnemonic">{semanticMnemonicCards.length > 1 ? "Mnemonics" : "Mnemonic"}</SectionHeading>
		<div class="semantic-mnemonic-grid" class:multi-mnemonic-grid={semanticMnemonicCards.length > 1}>
{#each semanticMnemonicCards as mnemonicItem}
	<SemanticMnemonicCard
		card={mnemonicItem.card}
		label={semanticMnemonicCards.length > 1 ? mnemonicItem.label : undefined}
		showHeading={false}
	/>
{/each}
		</div>
	{/if}

	<!-- Unified Components + Equation Section -->
	{#if (tradDisplayComponents && tradDisplayComponents.length > 0) || (simpDisplayComponents && simpDisplayComponents.length > 0) || jpDisplayComponents}
		{@const tradMakemeahanziImage =
(data.data.chinese_char?.images as any[] | undefined)?.find(
	(img: any) =>
		img &&
		img.source === "makemeahanzi" &&
		img.data,
)}
		{@const simpMakemeahanziImage =
(simplifiedCharData?.images as any[] | undefined)?.find(
	(img: any) =>
		img &&
		img.source === "makemeahanzi" &&
		img.data,
)}
		{@const hasTradComponents = tradDisplayComponents && tradDisplayComponents.length > 0}
		{@const hasSimpComponents = simpDisplayComponents && simpDisplayComponents.length > 0 && simplifiedChar}
		{@const showSimpColumn = hasSimpComponents && traditionalChar !== simplifiedChar && !tradSimpEquivalent}
		{@const hasJpComponents = jpDisplayComponents && jpDisplayComponents.length > 0}
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
{#if !mnemonicCardForCharacter(traditionalChar)}
	<CharacterEquation
		components={tradDisplayComponents}
		targetChar={traditionalChar}
		targetGloss={uniqueGloss || data.data.chinese_char?.gloss}
		charGlosses={charGlosses}
	/>
{/if}
<!-- Detailed component cards -->
{#each tradDisplayComponents as comp}
	{@const char = componentChar(comp) || ""}
	{@const types = comp.componentType || comp.type || []}
	{@const hint = comp.hint}
	{@const pinyin = comp.pinyin}
	{@const dictMeaning = comp.meaning}
	{@const curatedGloss = cleanComponentGloss(componentGloss(comp, charGlosses))}
	{@const originalChar = comp.originalCharacter || ""}
	{@const originalGloss = cleanComponentGloss(comp.originalGloss || "")}
	{@const isMeaning = types.includes("meaning")}
	{@const isPhonetic = types.includes("phonetic") || types.includes("sound")}
	{@const isIconic = types.includes("iconic")}
	{@const isVisual = types.includes("visual")}
	{@const highlightColor = isMeaning ? "#27ae60" : isPhonetic ? "#e74c3c" : isIconic ? "#3498db" : isVisual ? "#7c5cff" : "#95a5a6"}
	{@const typeLabel = isMeaning ? "Meaning" : isPhonetic ? "Phonetic" : isIconic ? "Iconic" : isVisual ? "Visual" : ""}

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
			<div class="component-title-row">
				<a href="/{char}" class="text-2xl font-serif text-text-primary hover:text-accent-primary transition-colors">{char}</a>
				{#if originalChar}
					<span class="component-origin-inline">
						(originally <a href="/{originalChar}">{originalChar}</a>{#if originalGloss}{' '}<span class="component-origin-gloss">{originalGloss}</span>{/if})
					</span>
				{/if}
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
			{#if shouldShowComponentHint(hint, comp)}
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
{#if !mnemonicCardForCharacter(simplifiedChar)}
	<CharacterEquation
		components={simpDisplayComponents}
		targetChar={simplifiedChar}
		targetGloss={simplifiedCharData.gloss || uniqueGloss}
		charGlosses={charGlosses}
	/>
{/if}
{#each simpDisplayComponents as comp}
	{@const char = componentChar(comp) || ""}
	{@const types = comp.componentType || comp.type || []}
	{@const hint = comp.hint}
	{@const pinyin = comp.pinyin}
	{@const dictMeaning = comp.meaning}
	{@const curatedGloss = cleanComponentGloss(componentGloss(comp, charGlosses))}
	{@const originalChar = comp.originalCharacter || ""}
	{@const originalGloss = cleanComponentGloss(comp.originalGloss || "")}
	{@const isMeaning = types.includes("meaning")}
	{@const isPhonetic = types.includes("phonetic") || types.includes("sound")}
	{@const isIconic = types.includes("iconic")}
	{@const isSimplified = types.includes("simplified")}
	{@const isVisual = types.includes("visual")}
	{@const highlightColor = isMeaning ? "#27ae60" : isPhonetic ? "#e74c3c" : isIconic ? "#3498db" : isSimplified ? "#9b59b6" : isVisual ? "#7c5cff" : "#95a5a6"}
	{@const typeLabel = isMeaning ? "Meaning" : isPhonetic ? "Phonetic" : isIconic ? "Iconic" : isSimplified ? "Simplified" : isVisual ? "Visual" : ""}

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
			<div class="component-title-row">
				<a href="/{char}" class="text-2xl font-serif text-text-primary hover:text-accent-primary transition-colors">{char}</a>
				{#if originalChar}
					<span class="component-origin-inline">
						(originally <a href="/{originalChar}">{originalChar}</a>{#if originalGloss}{' '}<span class="component-origin-gloss">{originalGloss}</span>{/if})
					</span>
				{/if}
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
			{#if shouldShowComponentHint(hint, comp)}
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
	{#if showJpColumn && hasJpComponents && jpDisplayComponents}
		<div class="flex flex-col gap-3">
{#if showLabels}
	<div class="text-xs font-medium text-text-muted uppercase tracking-wider">
		Japanese ({japaneseChar})
	</div>
{/if}
{#if !mnemonicCardForCharacter(japaneseChar)}
	<CharacterEquation
		components={jpDisplayComponents}
		targetChar={japaneseChar}
		targetGloss={uniqueGloss || data.data.chinese_char?.gloss}
		charGlosses={charGlosses}
	/>
{/if}
{#each jpDisplayComponents as comp}
	{@const char = comp.character}
	{@const curatedGloss = cleanComponentGloss(componentGloss(comp, charGlosses))}
	{@const originalChar = comp.originalCharacter || ""}
	{@const originalGloss = cleanComponentGloss(comp.originalGloss || "")}

	<div class="component-card flex items-start gap-2 py-2 px-3 rounded-lg w-full">
		<div class="relative w-[60px] h-[60px] flex-shrink-0">
			<div class="w-full h-full flex items-center justify-center text-3xl font-serif text-text-primary">{char}</div>
		</div>
		<div class="flex flex-col justify-center min-w-0">
			<div class="component-title-row">
				<a href="/{char}" class="text-2xl font-serif text-text-primary hover:text-accent-primary transition-colors">{char}</a>
				{#if originalChar}
					<span class="component-origin-inline">
						(originally <a href="/{originalChar}">{originalChar}</a>{#if originalGloss}{' '}<span class="component-origin-gloss">{originalGloss}</span>{/if})
					</span>
				{/if}
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

	<!-- Statistics section removed - data overlaps with word views -->

	<!-- Similar Characters -->
	{#if data.data.chinese_char?.components}
		{@const compChars = componentChars(data.data.chinese_char.components)}

		<!-- Notes above similar characters -->
		<LazyComponent
loader={loadNotes}
props={{ character: traditionalChar }}
rootMargin="1200px 0px"
		/>

		<LazyComponent
loader={loadSimilarCharacters}
props={{
	targetChar: traditionalChar,
	targetStrokeCount: data.data.chinese_char.strokeCount,
	targetComponents: compChars,
	componentUses: componentUses,
	charGlosses: charGlosses,
}}
rootMargin="1200px 0px"
		/>
	{:else}
		<LazyComponent
loader={loadNotes}
props={{ character: traditionalChar }}
rootMargin="1200px 0px"
		/>
	{/if}

<!-- Historical Evolution (reference material, below the learning sections) -->
{#if data.data.chinese_char?.images && data.data.chinese_char.images.filter((img: { url?: string }) => img.url).length > 0}
	{@const historicalImages = data.data.chinese_char.images.filter((img: { url?: string }) => img.url)}
	<div class="mb-3">
	<SectionHeading id="history">Historical Evolution</SectionHeading>
	<div class="historical-scroll flex gap-2 overflow-x-auto pb-2">
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

<style>
	.semantic-mnemonic-grid {
		display: grid;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-lg);
	}

	.semantic-mnemonic-grid.multi-mnemonic-grid {
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
		gap: var(--spacing-lg);
	}

	.component-title-row {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.35rem 0.5rem;
		margin-bottom: 0.125rem;
	}

	.component-origin-inline {
		color: var(--text-tertiary);
		font-size: var(--font-size-caption1);
		line-height: 1.35;
	}

	.component-origin-inline a {
		color: inherit;
		text-decoration: none;
	}

	.component-origin-inline a:hover {
		color: var(--accent);
		text-decoration: underline;
	}

	.component-origin-gloss {
		margin-left: 0.2em;
	}

	.historical-scroll {
		max-width: 100%;
		min-width: 0;
	}

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

	@media (max-width: 768px) {
		.historical-scroll {
			flex-wrap: wrap;
			overflow-x: visible;
		}

		.historical-card {
			flex: 1 1 68px;
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
