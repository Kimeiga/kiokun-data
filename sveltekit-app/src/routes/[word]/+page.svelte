<script lang="ts">
	import { onMount } from "svelte";
	import type { PageData } from "./$types";
	import Header from "$lib/components/Header.svelte";
	import Contains from "$lib/Contains.svelte";
	import AppearsIn from "$lib/AppearsIn.svelte";
	import JapaneseNames from "$lib/components/JapaneseNames.svelte";
	import Notes from "$lib/components/Notes.svelte";
	import WordTable from "$lib/components/JapaneseWords/WordTable.svelte";
	import SectionHeading from "$lib/components/shared/SectionHeading.svelte";
	import { getDictionaryUrl } from "$lib/shard-utils";
	import { dev } from "$app/environment";

	let { data }: { data: PageData } = $props();

	// Get all character variants
	let traditionalChar = $derived(data.data.chinese_char?.char || data.word);
	let simplifiedChar = $derived(data.data.chinese_char?.simpVariants?.[0]);
	let japaneseChar = $derived(data.data.japanese_char?.literal);

	// State for character data and component mappings
	let simplifiedCharData: any = $state(null);
	let componentStrokeMap: Map<string, number[]> = $state(new Map()); // For traditional/main character
	let simpComponentStrokeMap: Map<string, number[]> = $state(new Map()); // For simplified character

	// Helper to load KanjiVG data and extract component mappings
	async function loadComponentMappings(
		char: string,
		targetMap: "trad" | "simp",
	) {
		console.log(`[COMPONENT-MAP] Loading mappings for ${char} (${targetMap})`);
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
			onError: (error: any) => void,
		) => {
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
				// Use Chinese data for Chinese characters
				fetch(
					`https://cdn.jsdelivr.net/npm/hanzi-writer-data@latest/${char}.json`,
				)
					.then((res) => {
						if (!res.ok) throw new Error(`HTTP ${res.status}`);
						return res.json();
					})
					.then(onComplete)
					.catch((error) => {
						// Silently fail for characters without stroke data (e.g., rare components)
						console.warn(
							`No stroke data available for character: ${char}`,
							error,
						);
						onError(error);
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
				const targetId =
					char === japaneseChar
						? "jp-writer-target"
						: char === simplifiedChar
							? "simp-writer-target"
							: "trad-writer-target";
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

		const writerConfig = {
			width: 100,
			height: 100,
			padding: 5,
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

		// Traditional character animation
		if (traditionalChar) {
			const tradTarget = document.getElementById("trad-writer-target");
			if (tradTarget) {
				// Clear the fallback character
				tradTarget.innerHTML = "";
				const writer = HanziWriter.create(
					tradTarget,
					traditionalChar,
					writerConfig,
				);
				writer.loopCharacterAnimation();
			}
			// Load component mappings for traditional character
			loadComponentMappings(traditionalChar, "trad");
		}

		// Simplified character animation
		if (simplifiedChar) {
			const simpTarget = document.getElementById("simp-writer-target");
			if (simpTarget) {
				// Clear the fallback character
				simpTarget.innerHTML = "";
				const writer = HanziWriter.create(
					simpTarget,
					simplifiedChar,
					writerConfig,
				);
				writer.loopCharacterAnimation();
			}

			// Load simplified character data for component breakdown
			try {
				const url = getDictionaryUrl(simplifiedChar, dev);
				const response = await fetch(url);
				if (response.ok) {
					const arrayBuffer = await response.arrayBuffer();
					const { inflateSync } = await import("fflate");
					const decompressed = inflateSync(
						new Uint8Array(arrayBuffer),
					);
					const jsonData = JSON.parse(
						new TextDecoder().decode(decompressed),
					);
					console.log("[SIMP CHAR] Full JSON data:", jsonData);

					// Check if this is a redirect entry
					if (jsonData.redirect) {
						console.log(
							"[SIMP CHAR] Following redirect to:",
							jsonData.redirect,
						);
						// Load the redirect target's data
						const redirectUrl = getDictionaryUrl(
							jsonData.redirect,
							dev,
						);
						const redirectResponse = await fetch(redirectUrl);
						if (redirectResponse.ok) {
							const redirectArrayBuffer =
								await redirectResponse.arrayBuffer();
							const redirectDecompressed = inflateSync(
								new Uint8Array(redirectArrayBuffer),
							);
							const redirectJsonData = JSON.parse(
								new TextDecoder().decode(redirectDecompressed),
							);
							simplifiedCharData = redirectJsonData.chinese_char;
							console.log(
								"[SIMP CHAR] Loaded redirect data for",
								jsonData.redirect,
								simplifiedCharData,
							);
						}
					} else {
						simplifiedCharData = jsonData.chinese_char;
						console.log(
							"[SIMP CHAR] Loaded data for",
							simplifiedChar,
							simplifiedCharData,
						);
					}

					// Load component mappings for simplified character
					loadComponentMappings(simplifiedChar, "simp");
				} else {
					console.error(
						`Failed to load char data for ${simplifiedChar}: ${response.status}`,
					);
				}
			} catch (e) {
				console.error(
					`Failed to load char data for ${simplifiedChar}`,
					e,
				);
			}
		}

		// Japanese character animation (try Hanzi Writer first, fallback to note if not available)
		if (japaneseChar) {
			const jpTarget = document.getElementById("jp-writer-target");
			if (jpTarget) {
				try {
					// Clear the fallback character
					jpTarget.innerHTML = "";
					const writer = HanziWriter.create(
						jpTarget,
						japaneseChar,
						writerConfig,
					);
					writer.loopCharacterAnimation();
				} catch (e) {
					// If Hanzi Writer doesn't have this character, keep the fallback
					console.error(
						"Failed to create Hanzi Writer for Japanese char:",
						e,
					);
				}
			}
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

{#if typeof window !== "undefined"}
	{console.log("[PAGE] Rendering page for:", data.word)}
{/if}

<svelte:head>
	<title>{data.word} - Kiokun Dictionary</title>
</svelte:head>

<Header currentWord={data.word} />

<div class="max-w-6xl mx-auto px-3 py-2 md:px-5 md:py-3">
	<div id="content">
		<!-- Character Header -->
		{#if data.data.chinese_char || data.data.japanese_char}
			<div class="mb-0">
				<div class="py-3 md:py-4">
					<!-- Compact Header: Characters + Pronunciations + Gloss in one line -->
					<div class="flex flex-col gap-6 mb-6">
						<!-- Top Row: Character Variants & Main Gloss -->
						<div
							class="flex flex-col md:flex-row md:items-start justify-between gap-6"
						>
							<!-- Character Variants with Stroke Animations -->
							<div class="flex items-center gap-6">
								<!-- Traditional Chinese Character -->
								{#if traditionalChar}
									<div
										class="flex flex-col items-center gap-2"
									>
										<div
											id="trad-writer-target"
											class="w-[100px] h-[100px] flex items-center justify-center bg-bg-secondary rounded-xl shadow-lg border border-border"
										>
											<!-- Fallback: show character until animation loads -->
											<div
												class="text-6xl md:text-7xl font-bold font-cjk leading-none text-text-primary"
											>
												{traditionalChar}
											</div>
										</div>
										<div
											class="text-[10px] uppercase tracking-wider font-bold text-text-tertiary"
										>
											Trad
										</div>
									</div>
								{/if}

								<!-- Simplified Chinese Character -->
								{#if simplifiedChar}
									<div
										class="flex flex-col items-center gap-2"
									>
										<div
											id="simp-writer-target"
											class="w-[100px] h-[100px] flex items-center justify-center bg-bg-secondary rounded-xl shadow-lg border border-border"
										>
											<!-- Fallback: show character until animation loads -->
											<div
												class="text-6xl md:text-7xl font-bold font-cjk leading-none text-text-primary"
											>
												{simplifiedChar}
											</div>
										</div>
										<div
											class="text-[10px] uppercase tracking-wider font-bold text-text-tertiary"
										>
											Simp
										</div>
									</div>
								{/if}

								<!-- Japanese Character -->
								{#if japaneseChar}
									<div
										class="flex flex-col items-center gap-2"
									>
										<div
											id="jp-writer-target"
											class="w-[100px] h-[100px] flex items-center justify-center bg-bg-secondary rounded-xl shadow-lg border border-border"
										>
											<!-- Fallback: show character until animation loads -->
											<div
												class="text-6xl md:text-7xl font-bold font-cjk leading-none text-text-primary"
											>
												{japaneseChar}
											</div>
										</div>
										<div
											class="text-[10px] uppercase tracking-wider font-bold text-text-tertiary"
										>
											Kanji
										</div>
									</div>
								{/if}
							</div>

							<!-- Main Meaning (Gloss) -->
							{#if data.data.chinese_char?.gloss}
								<div class="flex-1 md:text-right">
									<h1
										class="text-2xl md:text-4xl font-bold text-accent mb-2 leading-tight"
									>
										{data.data.chinese_char.gloss}
									</h1>
									<!-- Pinyin/Readings Summary -->
									<div
										class="flex flex-col md:items-end gap-1 text-text-secondary text-sm md:text-base"
									>
										{#if data.data.chinese_char?.pinyinFrequencies}
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
											{#if filteredPinyins.length > 0}
												<div
													class="font-mono text-pinyin"
												>
													{filteredPinyins
														.map((pf) => pf.pinyin)
														.join(", ")}
												</div>
											{/if}
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
												<div
													class="font-cjk text-onyomi"
												>
													{onyomi.join("、")}
												</div>
											{/if}
											{#if kunyomi.length > 0}
												<div
													class="font-cjk text-kunyomi"
												>
													{kunyomi.join("、")}
												</div>
											{/if}
										{/if}
									</div>
								</div>
							{/if}
						</div>
					</div>

					<!-- Mnemonic Hint (on its own line below header) -->
					{#if data.data.chinese_char?.hint}
						<div
							class="mb-5 p-2.5 rounded border-l-4 bg-hint-bg border-l-hint-border"
						>
							<div class="text-sm leading-relaxed text-hint-text">
								💡 {data.data.chinese_char.hint}
							</div>
						</div>
					{/if}

					<!-- Historical Evolution (Character form evolution through history) -->
					{#if data.data.chinese_char?.images && data.data.chinese_char.images.filter((img: { url?: string }) => img.url).length > 0}
						{@const historicalImages = data.data.chinese_char.images.filter((img: { url?: string }) => img.url)}
						<div class="mb-5">
							<SectionHeading>🏛️ Historical Evolution</SectionHeading>
							<div class="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border-subtle scrollbar-track-transparent">
								{#each historicalImages as image}
									{#if image.url}
										<div class="flex-shrink-0 text-center p-3 bg-bg-secondary rounded-lg border border-border-subtle min-w-[100px]">
											<img
												src={image.url}
												alt="{image.type || 'Historical'} {image.era || ''}"
												class="w-16 h-16 mx-auto object-contain bg-white rounded"
												loading="lazy"
												onerror={(e) => {
													const target = e.currentTarget as HTMLImageElement;
													target.style.display = 'none';
													const fallback = target.nextElementSibling as HTMLElement;
													if (fallback) fallback.style.display = 'flex';
												}}
											/>
											<div class="hidden w-16 h-16 mx-auto items-center justify-center text-3xl font-serif text-text-primary bg-bg-tertiary rounded">
												{data.word}
											</div>
											<div class="text-xs font-semibold text-text-secondary mt-2">
												{image.type || 'Unknown'}
											</div>
											{#if image.era}
												<div class="text-[10px] text-text-tertiary mt-0.5">
													{image.era}
												</div>
											{/if}
										</div>
									{/if}
								{/each}
								<!-- Modern form rendered with font -->
								<div class="flex-shrink-0 text-center p-3 bg-bg-secondary rounded-lg border border-border-subtle min-w-[100px]">
									<div class="w-16 h-16 mx-auto flex items-center justify-center text-4xl font-serif text-text-primary">
										{data.word}
									</div>
									<div class="text-xs font-semibold text-text-secondary mt-2">
										Regular
									</div>
									<div class="text-[10px] text-text-tertiary mt-0.5">
										Modern
									</div>
								</div>
							</div>
						</div>
					{/if}

					<!-- Comments (from Academia Sinica, etc.) -->
					{#if data.data.chinese_char?.comments && data.data.chinese_char.comments.length > 0}
						<div class="mb-5">
							{#each data.data.chinese_char.comments as comment}
								{#if comment && comment.source && comment.comment}
									<div
										class="p-2.5 rounded border-l-4 mb-2"
										style="background: var(--bg-tertiary); border-left-color: var(--border-light);"
									>
										<div
											class="text-xs text-tertiary font-semibold mb-1"
										>
											{comment.source}
										</div>
										<div
											class="text-sm leading-relaxed"
											style="color: var(--text-secondary);"
										>
											{comment.comment}
										</div>
									</div>
								{/if}
							{/each}
						</div>
					{/if}

					<!-- Components Section -->
					{#if data.data.chinese_char?.components && data.data.chinese_char.components.length > 0}
						{@const makemeahanziImage =
							data.data.chinese_char.images?.find(
								(img) =>
									img &&
									img.source === "makemeahanzi" &&
									img.data,
							)}
						<SectionHeading>🧩 Components</SectionHeading>
						<!-- Debug button to copy diagnostic info -->
						<button
							class="mb-4 px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
							onclick={() => {
								const debugInfo: Record<string, any> = {
									character: traditionalChar,
									simplified: simplifiedChar,
									japanese: japaneseChar,
									timestamp: new Date().toISOString(),
									componentStrokeMap: Object.fromEntries(componentStrokeMap),
									simpComponentStrokeMap: Object.fromEntries(simpComponentStrokeMap),
									ourComponents: data.data.chinese_char?.components?.map((comp: any) => ({
										raw: comp,
										extractedChar: typeof comp === "string" ? comp : comp.character || comp.char || comp,
										types: comp.componentType || comp.type || []
									})),
									makemeahanziStrokesCount: makemeahanziImage?.data?.strokes?.length ?? null,
									makemeahanziMedians: makemeahanziImage?.data?.medians?.length ?? null,
									japaneseCharData: data.data.japanese_char ?? null,
								};

								// Fetch KanjiVG for all variants
								const fetchKanjiVG = async (char: string, label: string) => {
									const cp = char?.codePointAt(0)?.toString(16).padStart(5, "0");
									if (!cp) return null;
									try {
										const r = await fetch(`https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${cp}.svg`);
										if (!r.ok) return { available: false };
										const svgText = await r.text();
										const parser = new DOMParser();
										const doc = parser.parseFromString(svgText, "image/svg+xml");
										const groups = doc.querySelectorAll('g[kvg\\:element]');
										const elements: Record<string, { paths: string[], number?: string }> = {};
										groups.forEach(g => {
											const el = g.getAttribute('kvg:element');
											const num = g.getAttribute('kvg:number');
											const paths = g.querySelectorAll(':scope > path[id^="kvg:"]');
											if (el) {
												const key = num ? `${el}#${num}` : el;
												elements[key] = {
													paths: Array.from(paths).map(p => p.getAttribute('id') || ''),
													number: num || undefined
												};
											}
										});
										return { available: true, elements, svgText };
									} catch { return { available: false }; }
								};

								Promise.all([
									fetchKanjiVG(traditionalChar, 'traditional'),
									fetchKanjiVG(simplifiedChar, 'simplified'),
									fetchKanjiVG(japaneseChar, 'japanese'),
								]).then(([trad, simp, jp]) => {
									debugInfo.kanjiVG = { traditional: trad, simplified: simp, japanese: jp };
									const text = JSON.stringify(debugInfo, null, 2);
									navigator.clipboard.writeText(text);
									alert('Debug info copied to clipboard!');
								});
							}}
						>
							🐛 Copy Debug Info
						</button>
						<div class="mb-4">
							<!-- Traditional Character Components -->
							<div class="mb-6">
								<div
									class="text-sm font-semibold mb-3 text-text-secondary"
								>
									Traditional (🇹🇼 {traditionalChar})
								</div>
								<div class="flex flex-row flex-wrap gap-3">
									{#each data.data.chinese_char.components as comp, _compIndex}
										{@const char =
											typeof comp === "string"
												? comp
												: comp.character ||
													comp.char ||
													comp}
										{@const types =
											comp.componentType ||
											comp.type ||
											[]}
										{@const hint = comp.hint}
										{@const pinyin = comp.pinyin}
										{@const meaning = comp.meaning}
										{@const isMeaning =
											types.includes("meaning")}
										{@const isPhonetic =
											types.includes("phonetic") ||
											types.includes("sound")}
										{@const isIconic =
											types.includes("iconic")}
										{@const highlightColor = isMeaning
											? "#27ae60"
											: isPhonetic
												? "#e74c3c"
												: isIconic
													? "#3498db"
													: "#95a5a6"}
										{@const typeLabel = isMeaning
											? "Meaning"
											: isPhonetic
												? "Phonetic"
												: isIconic
													? "Iconic"
													: ""}

										<div
											class="flex items-start gap-3 py-3 px-4 w-full md:w-auto bg-bg-secondary rounded-lg border border-border-subtle"
										>
											<!-- SVG with highlighted strokes -->
											<div
												class="relative w-[60px] h-[60px] flex-shrink-0"
											>
												{#if makemeahanziImage?.data?.strokes}
													{@const componentStrokes =
														componentStrokeMap.get(
															char,
														) || []}
													<svg
														width="60"
														height="60"
														viewBox="0 0 1024 1024"
														class="absolute top-0 left-0"
													>
														<g
															transform="scale(1, -1) translate(0, -900)"
														>
															{#each makemeahanziImage.data.strokes as stroke, i}
																<path
																	d={stroke}
																	fill={componentStrokes.includes(
																		i,
																	)
																		? highlightColor
																		: "#4b5563"}
																	class="transition-colors duration-300"
																/>
															{/each}
														</g>
													</svg>
												{:else}
													<div
														class="w-full h-full flex items-center justify-center text-3xl font-serif text-text-primary"
													>
														{char}
													</div>
												{/if}
											</div>

											<!-- Component Details -->
											<div
												class="flex flex-col justify-center min-w-0"
											>
												<!-- Character and Type Badge -->
												<div
													class="flex items-center gap-2 mb-1"
												>
													<a
														href="/{char}"
														class="text-2xl font-serif text-text-primary hover:text-accent-primary transition-colors"
														>{char}</a
													>
													{#if typeLabel}
														<span
															class="text-xs px-2 py-0.5 rounded-full"
															style="background-color: {highlightColor}20; color: {highlightColor}; border: 1px solid {highlightColor}40;"
														>
															{typeLabel} component
														</span>
													{/if}
												</div>

												<!-- Pinyin and Meaning -->
												{#if pinyin || meaning}
													<div
														class="flex items-baseline gap-2 text-sm"
													>
														{#if pinyin}
															<span
																class="font-mono text-accent-primary"
																>{pinyin}</span
															>
														{/if}
														{#if meaning}
															<span
																class="text-text-secondary"
																>{meaning}</span
															>
														{/if}
													</div>
												{/if}

												<!-- Hint/Etymology -->
												{#if hint}
													<div
														class="text-xs text-text-tertiary mt-1 italic"
													>
														{hint}
													</div>
												{/if}
											</div>
										</div>
									{/each}
								</div>
							</div>

							<!-- Simplified Character Components (if different) -->
							{#if simplifiedChar && simplifiedChar !== traditionalChar}
								<div class="mb-6">
									<div
										class="text-sm font-semibold mb-3 text-text-secondary"
									>
										Simplified (🇨🇳 {simplifiedChar})
									</div>
									{#if simplifiedCharData?.components && simplifiedCharData.components.length > 0}
										{@const simpMakemeahanziImage =
											simplifiedCharData.images?.find(
												(img) =>
													img &&
													img.source ===
														"makemeahanzi" &&
													img.data,
											)}
										<div
											class="flex flex-row flex-wrap gap-3"
										>
											{#each simplifiedCharData.components as comp, _compIndex}
												{@const char =
													typeof comp === "string"
														? comp
														: comp.character ||
															comp.char ||
															comp}
												{@const types =
													comp.componentType ||
													comp.type ||
													[]}
												{@const hint = comp.hint}
												{@const pinyin = comp.pinyin}
												{@const meaning = comp.meaning}
												{@const isMeaning =
													types.includes("meaning")}
												{@const isPhonetic =
													types.includes("phonetic") ||
													types.includes("sound")}
												{@const isIconic =
													types.includes("iconic")}
												{@const highlightColor =
													isMeaning
														? "#27ae60"
														: isPhonetic
															? "#e74c3c"
															: isIconic
																? "#3498db"
																: "#95a5a6"}
												{@const typeLabel = isMeaning
													? "Meaning"
													: isPhonetic
														? "Phonetic"
														: isIconic
															? "Iconic"
															: ""}

												<div
													class="flex items-start gap-3 py-3 px-4 w-full md:w-auto bg-bg-secondary rounded-lg border border-border-subtle"
												>
													<!-- SVG with highlighted strokes -->
													<div
														class="relative w-[60px] h-[60px] flex-shrink-0"
													>
														{#if simpMakemeahanziImage?.data?.strokes}
															{@const componentStrokes =
																simpComponentStrokeMap.get(
																	char,
																) || []}
															<svg
																width="60"
																height="60"
																viewBox="0 0 1024 1024"
																class="absolute top-0 left-0"
															>
																<g
																	transform="scale(1, -1) translate(0, -900)"
																>
																	{#each simpMakemeahanziImage.data.strokes as stroke, i}
																		<path
																			d={stroke}
																			fill={componentStrokes.includes(
																				i,
																			)
																				? highlightColor
																				: "#4b5563"}
																			class="transition-colors duration-300"
																		/>
																	{/each}
																</g>
															</svg>
														{:else}
															<div
																class="w-full h-full flex items-center justify-center text-3xl font-serif text-text-primary"
															>
																{char}
															</div>
														{/if}
													</div>

													<!-- Component Details -->
													<div
														class="flex flex-col justify-center min-w-0"
													>
														<!-- Character and Type Badge -->
														<div
															class="flex items-center gap-2 mb-1"
														>
															<a
																href="/{char}"
																class="text-2xl font-serif text-text-primary hover:text-accent-primary transition-colors"
																>{char}</a
															>
															{#if typeLabel}
																<span
																	class="text-xs px-2 py-0.5 rounded-full"
																	style="background-color: {highlightColor}20; color: {highlightColor}; border: 1px solid {highlightColor}40;"
																>
																	{typeLabel} component
																</span>
															{/if}
														</div>

														<!-- Pinyin and Meaning -->
														{#if pinyin || meaning}
															<div
																class="flex items-baseline gap-2 text-sm"
															>
																{#if pinyin}
																	<span
																		class="font-mono text-accent-primary"
																		>{pinyin}</span
																	>
																{/if}
																{#if meaning}
																	<span
																		class="text-text-secondary"
																		>{meaning}</span
																	>
																{/if}
															</div>
														{/if}

														<!-- Hint/Etymology -->
														{#if hint}
															<div
																class="text-xs text-text-tertiary mt-1 italic"
															>
																{hint}
															</div>
														{/if}
													</div>
												</div>
											{/each}
										</div>
									{:else}
										<div
											class="text-xs text-text-tertiary italic"
										>
											Component breakdown coming soon
										</div>
									{/if}
								</div>
							{/if}
						</div>
					{/if}

					<!-- Usage Statistics -->
					{#if data.data.chinese_char?.statistics}
						{@const stats = data.data.chinese_char.statistics}
						<SectionHeading>📊 Usage Statistics</SectionHeading>
						<div class="mb-4">
							<!-- HSK Level and Ranks -->
							<div
								style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 15px;"
							>
								{#if stats.hskLevel}
									<span class="badge badge-hsk"
										>HSK {stats.hskLevel}</span
									>
								{/if}
								{#if stats.movieWordRank}
									<span
										class="badge"
										style="background: var(--badge-movie-bg); color: var(--badge-movie-text);"
										>Movie Rank: #{stats.movieWordRank.toLocaleString()}</span
									>
								{/if}
								{#if stats.bookWordRank}
									<span
										class="badge"
										style="background: var(--badge-book-bg); color: var(--badge-book-text);"
										>Book Rank: #{stats.bookWordRank.toLocaleString()}</span
									>
								{/if}
							</div>

							<!-- Frequency Bars -->
							{#if stats.movieWordCountPercent || stats.bookWordCountPercent}
								<div style="margin-bottom: 20px;">
									<div
										style="font-size: 13px; font-weight: 600; margin-bottom: 8px; color: var(--text-tertiary);"
									>
										Frequency
									</div>

									{#if stats.movieWordCountPercent}
										{@const moviePercent = (
											stats.movieWordCountPercent * 100
										).toFixed(4)}
										<div style="margin-bottom: 8px;">
											<div
												style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px;"
											>
												<span
													>Movies: {stats.movieWordCount.toLocaleString()}
													occurrences</span
												>
												<span>{moviePercent}%</span>
											</div>
											<div
												style="background: var(--progress-bg); height: 8px; border-radius: 4px; overflow: hidden;"
											>
												<div
													style="background: var(--progress-movie); height: 100%; width: {Math.min(
														parseFloat(
															moviePercent,
														) * 10,
														100,
													)}%;"
												></div>
											</div>
										</div>
									{/if}

									{#if stats.bookWordCountPercent}
										{@const bookPercent = (
											stats.bookWordCountPercent * 100
										).toFixed(4)}
										<div style="margin-bottom: 8px;">
											<div
												style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px;"
											>
												<span
													>Books: {stats.bookWordCount.toLocaleString()}
													occurrences</span
												>
												<span>{bookPercent}%</span>
											</div>
											<div
												style="background: var(--progress-bg); height: 8px; border-radius: 4px; overflow: hidden;"
											>
												<div
													style="background: var(--progress-book); height: 100%; width: {Math.min(
														parseFloat(
															bookPercent,
														) * 10,
														100,
													)}%;"
												></div>
											</div>
										</div>
									{/if}
								</div>
							{/if}

							<!-- Top Words -->
							{#if stats.topWords && stats.topWords.length > 0}
								<div style="margin-top: 20px;">
									<div
										style="font-size: 13px; font-weight: 600; margin-bottom: 10px; color: var(--text-tertiary);"
									>
										Top Words Containing This Character
									</div>
									<div
										style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px;"
									>
										{#each stats.topWords.slice(0, 12) as topWord}
											{@const sharePercent = (
												topWord.share * 100
											).toFixed(1)}
											<div
												style="position: relative; padding: 8px 12px; background: var(--bg-secondary); border: 1px solid var(--border-light); border-radius: 6px; font-size: 13px; overflow: hidden;"
											>
												<!-- Background progress bar -->
												<div
													style="position: absolute; top: 0; left: 0; height: 100%; width: {topWord.share *
														100}%; background: var(--progress-word-bg); opacity: 0.6; z-index: 0;"
												></div>
												<!-- Content -->
												<div
													style="position: relative; z-index: 1;"
												>
													<div
														style="display: flex; justify-content: space-between; align-items: center;"
													>
														<span
															style="font-weight: 600; color: var(--color-heading);"
															>{topWord.word}</span
														>
														<span
															style="font-size: 11px; color: var(--badge-movie-text); font-weight: 600;"
															>{sharePercent}%</span
														>
													</div>
													{#if topWord.gloss}
														<div
															style="font-size: 11px; color: var(--text-tertiary); margin-top: 2px;"
														>
															{topWord.gloss}
														</div>
													{/if}
												</div>
											</div>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Chinese and Japanese Words - Two Column Layout on Desktop -->
		{#if (data.data.chinese_words && data.data.chinese_words.length > 0) || (data.data.japanese_words && data.data.japanese_words.length > 0)}
			<div class="word-sections-grid">
				<!-- Chinese Words -->
				{#if data.data.chinese_words && data.data.chinese_words.length > 0}
					<div>
						<SectionHeading>Chinese</SectionHeading>
						<div class="mb-4">
							{#each data.data.chinese_words as word}
								{#if word.items && word.items.length > 0}
									{@const itemsWithDefs = word.items.filter(
										(item) =>
											item.definitions &&
											item.definitions.length > 0,
									)}
									{#each itemsWithDefs as item}
										<div class="chinese-word-entry">
											<!-- Character and Pinyin -->
											<div class="chinese-headwords">
												<span class="chinese-word-text">
													{data.word}
												</span>
												{#if item.pinyin}
													<span
														class="chinese-pronunciation"
													>
														[{item.pinyin}]
													</span>
												{/if}
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
				{#if data.data.japanese_words && data.data.japanese_words.length > 0}
					<div>
						<SectionHeading>Japanese</SectionHeading>
						<div class="mb-4">
							<WordTable
								words={data.data.japanese_words}
								accentDisplay="binary"
							/>
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Notes Section -->
		<Notes character={data.word} />

		<!-- Japanese Names Section -->
		{#if data.data.japanese_names && data.data.japanese_names.length > 0}
			<JapaneseNames names={data.data.japanese_names} word={data.word} />
		{/if}

		<!-- Contains Section (for multi-character words) -->
		<Contains words={data.data.contains || []} />

		<!-- Appears In Section -->
		<AppearsIn
			chineseWords={data.data.contained_in_chinese || []}
			japaneseWords={data.data.contained_in_japanese || []}
		/>
	</div>
</div>

<style>
	/* Custom styles that are hard to express in Tailwind or use CSS variables */
	.pos-tag {
		@apply inline-block px-2 py-0.5 rounded text-[11px] font-semibold mr-2 transition-all duration-300;
		background: var(--tag-pos-bg);
		color: var(--tag-pos-text);
	}

	.badge {
		@apply px-3 py-1.5 rounded-full text-xs font-semibold uppercase;
	}

	.badge-hsk {
		@apply transition-all duration-300;
		background: var(--badge-hsk-bg);
		color: var(--badge-hsk-text);
	}

	/* Two-column layout for Chinese and Japanese word sections on desktop */
	.word-sections-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0;
	}

	@media (min-width: 768px) {
		.word-sections-grid {
			grid-template-columns: 1fr 1fr;
			gap: 2rem;
		}
	}

	/* Chinese word entry styling to match Japanese word styling */
	.chinese-word-entry {
		margin-bottom: 30px;
	}

	.chinese-headwords {
		display: flex;
		align-items: baseline;
		gap: 12px;
		margin-bottom: 12px;
		flex-wrap: wrap;
	}

	.chinese-word-text {
		font-size: 32px;
		font-family: "MS Mincho", serif;
		font-weight: 600;
		color: var(--primary-highlight, #2c3e50);
	}

	.chinese-pronunciation {
		font-size: 20px;
		font-family: "MS Mincho", serif;
		color: var(--reading-highlight, #e74c3c);
	}

	.chinese-definitions {
		font-size: 16px;
		line-height: 1.6;
		color: var(--text-primary);
	}
</style>
