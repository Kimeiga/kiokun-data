<script lang="ts">
	import SectionHeading from "./shared/SectionHeading.svelte";

	// Match the actual Component type from chinese_char_types.rs
	interface Component {
		character: string;  // This is the field name in the Rust type
		componentType?: string[];
		hint?: string;
		pinyin?: string;
		meaning?: string;
	}

	interface Props {
		components: any[] | null | undefined;  // Use any[] to be flexible with the input
		targetChar: string;
		targetGloss?: string;
		charGlosses?: Record<string, string>;  // Curated character glosses
	}

	let { components, targetChar, targetGloss, charGlosses }: Props = $props();

	// Clean gloss by removing language markers and "variant of" patterns
	function cleanGloss(gloss: string | undefined): string {
		if (!gloss) return "";

		// Remove "variant of X|Y[pinyin]" patterns (e.g., "variant of 並|并[bìng]")
		// This regex matches: "variant of" + any chars until we hit a space followed by a lowercase letter
		// or until the end of string
		let cleaned = gloss.replace(/^variant of\s+[^,;]+(\s*\[[^\]]+\])?\s*/i, "");

		// Remove language markers like (Trad), (JP), (Simp)
		cleaned = cleaned.replace(/\s*\((Trad|JP|Simp)\)\s*/gi, "");

		return cleaned.trim();
	}

	// Build the equation parts
	let equationParts = $derived.by(() => {
		if (!components || components.length === 0) return null;

		// Filter out string components and get meanings
		const validComponents = components
			.filter(c => typeof c !== 'string')
			.map(c => {
				const char = c.character;
				// Priority: component meaning from dictionary > charGlosses (game data)
				// BUT: if the dictionary meaning is empty after cleaning (e.g., "variant of..."),
				// fall back to the curated gloss from charGlosses
				const cleanedDictGloss = cleanGloss(c.meaning);
				const finalGloss = cleanedDictGloss || charGlosses?.[char] || "";
				return { char, gloss: finalGloss };
			})
			.filter(c => c.gloss);  // Only include components with glosses

		if (validComponents.length === 0) return null;

		return {
			components: validComponents,
			result: {
				char: targetChar,
				gloss: cleanGloss(targetGloss)
			}
		};
	});
</script>

{#if equationParts}
	<div class="character-equation">
		<SectionHeading>Character Equation</SectionHeading>
		
		<div class="equation-container">
			<div class="equation-parts">
				{#each equationParts.components as comp, i}
					{#if i > 0}
						<span class="operator">+</span>
					{/if}
					<a href="/{comp.char}" class="equation-part">
						<span class="part-gloss">{comp.gloss}</span>
						<span class="part-char">{comp.char}</span>
					</a>
				{/each}
				
				<span class="operator equals">=</span>
				
				<div class="equation-result">
					<span class="result-gloss">{equationParts.result.gloss || "?"}</span>
					<span class="result-char">{equationParts.result.char}</span>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.character-equation {
		margin-bottom: 1.5rem;
	}

	.equation-container {
		padding: 1rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-light);
		border-radius: 8px;
	}

	.equation-parts {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		font-size: var(--font-size-body);
	}

	.equation-part {
		display: inline-flex;
		align-items: baseline;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-light);
		border-radius: 6px;
		text-decoration: none;
		transition: all 0.2s ease;
	}

	.equation-part:hover {
		background: var(--bg-primary);
		border-color: var(--accent);
		transform: translateY(-1px);
	}

	.part-gloss {
		color: var(--text-secondary);
		font-size: var(--font-size-subhead);
	}

	.part-char {
		font-family: "Noto Serif TC", "Noto Serif SC", "Noto Serif JP", "MS Mincho", serif;
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.operator {
		color: var(--text-tertiary);
		font-size: 1.25rem;
		font-weight: 600;
		padding: 0 0.25rem;
	}

	.operator.equals {
		font-size: 1.5rem;
		padding: 0 0.5rem;
	}

	.equation-result {
		display: inline-flex;
		align-items: baseline;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: var(--accent-light);
		border: 2px solid var(--accent);
		border-radius: 6px;
	}

	.result-gloss {
		color: var(--text-primary);
		font-size: var(--font-size-subhead);
		font-weight: 600;
	}

	.result-char {
		font-family: "Noto Serif TC", "Noto Serif SC", "Noto Serif JP", "MS Mincho", serif;
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--accent);
	}

	@media (max-width: 768px) {
		.equation-parts {
			font-size: var(--font-size-callout);
			gap: 0.5rem;
		}

		.part-char {
			font-size: 1.25rem;
		}

		.result-char {
			font-size: 1.5rem;
		}

		.operator {
			font-size: 1rem;
		}

		.operator.equals {
			font-size: 1.25rem;
		}
	}
</style>

