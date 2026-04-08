<script lang="ts">
	import SectionHeading from "./shared/SectionHeading.svelte";

	interface Props {
		components: any[] | null | undefined;
		targetChar: string;
		targetGloss?: string;
		charGlosses?: Record<string, string>;
	}

	let { components, targetChar, targetGloss, charGlosses }: Props = $props();

	function cleanGloss(gloss: string | undefined): string {
		if (!gloss) return "";
		let cleaned = gloss.replace(/^variant of\s+[^,;]+(\s*\[[^\]]+\])?\s*/i, "");
		cleaned = cleaned
			.replace(/\s*\(trad\/jp\)/gi, ' 🇹🇼🇯🇵')
			.replace(/\s*\(trad\)/gi, ' 🇹🇼')
			.replace(/\s*\(simp\)/gi, ' 🇨🇳')
			.replace(/\s*\(jp\)/gi, ' 🇯🇵');
		return cleaned.trim();
	}

	let equationParts = $derived.by(() => {
		if (!components || components.length === 0) return null;

		const validComponents = components
			.filter(c => typeof c !== 'string')
			.map(c => {
				const char = c.character;
				const cleanedDictGloss = cleanGloss(c.meaning);
				const finalGloss = cleanedDictGloss || charGlosses?.[char] || "";
				return { char, gloss: finalGloss };
			})
			.filter(c => c.gloss);

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
	<div class="character-equation" lang="zh">
		<div class="equation-parts">
			{#each equationParts.components as comp, i}
				{#if i > 0}
					<span class="op">+</span>
				{/if}
				<a href="/{comp.char}" class="eq-part">
					<span class="eq-char">{comp.char}</span>
					<span class="eq-gloss">{comp.gloss}</span>
				</a>
			{/each}

			<span class="op eq-equals">=</span>

			<div class="eq-result">
				<span class="eq-char result-char">{equationParts.result.char}</span>
				<span class="eq-gloss">{equationParts.result.gloss || "?"}</span>
			</div>
		</div>
	</div>
{/if}

<style>
	.character-equation {
		margin-bottom: var(--spacing-md);
	}

	.equation-parts {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
		flex-wrap: wrap;
	}

	.eq-part {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-decoration: none;
		transition: color 0.15s;
	}

	.eq-part:hover .eq-char {
		color: var(--accent);
	}

	.eq-char {
		font-family: var(--font-cjk);
		font-size: 28px;
		font-weight: 600;
		color: var(--text-primary);
		line-height: 1.2;
	}

	.eq-gloss {
		font-size: var(--font-size-caption1);
		color: var(--text-muted);
		margin-top: 1px;
	}

	.op {
		color: var(--text-tertiary);
		font-size: var(--font-size-headline);
		font-weight: 300;
	}

	.eq-equals {
		font-size: 28px;
	}

	.eq-result {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.result-char {
		color: var(--accent);
		font-size: 32px;
		font-weight: 700;
	}

	.eq-result .eq-gloss {
		color: var(--text-secondary);
		font-weight: 500;
	}
</style>
