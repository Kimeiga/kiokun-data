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
		<SectionHeading id="equation">Character Equation</SectionHeading>
		
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
		margin-bottom: var(--spacing-lg);
	}

	.equation-container {
		padding: var(--spacing-md);
		background: var(--bg-secondary);
		border: 1px solid var(--border-light);
		border-radius: var(--radius-md);
	}

	.equation-parts {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		flex-wrap: wrap;
		font-size: var(--font-size-footnote);
	}

	.equation-part {
		display: inline-flex;
		align-items: baseline;
		gap: var(--spacing-xs);
		padding: var(--spacing-xs) var(--spacing-sm);
		background: var(--bg-tertiary);
		border: 1px solid var(--border-light);
		border-radius: var(--radius-sm);
		text-decoration: none;
		transition: background 0.15s ease, border-color 0.15s ease;
	}

	.equation-part:hover {
		background: var(--bg-primary);
		border-color: var(--accent);
		transform: translateY(-1px);
	}

	.part-gloss {
		color: var(--text-secondary);
		font-size: var(--font-size-footnote);
	}

	.part-char {
		font-family: var(--font-cjk);
		font-size: var(--font-size-headline);
		font-weight: 600;
		color: var(--text-primary);
	}

	.operator {
		color: var(--text-tertiary);
		font-size: var(--font-size-body);
		font-weight: 600;
		padding: 0 2px;
	}

	.operator.equals {
		font-size: var(--font-size-headline);
		padding: 0 var(--spacing-xs);
	}

	.equation-result {
		display: inline-flex;
		align-items: baseline;
		gap: var(--spacing-xs);
		padding: var(--spacing-xs) var(--spacing-sm);
		background: var(--accent-light);
		border: 2px solid var(--accent);
		border-radius: var(--radius-sm);
	}

	.result-gloss {
		color: var(--text-primary);
		font-size: var(--font-size-footnote);
		font-weight: 600;
	}

	.result-char {
		font-family: var(--font-cjk);
		font-size: var(--font-size-title);
		font-weight: 700;
		color: var(--accent);
	}

	@media (max-width: 768px) {
		.equation-parts {
			gap: var(--spacing-xs);
		}
	}
</style>

