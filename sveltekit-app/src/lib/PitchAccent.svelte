<script lang="ts">
	interface Props {
		kana: string;
		pitchAccents: number[];
	}

	let { kana, pitchAccents }: Props = $props();

	// Convert kana to mora (basic implementation)
	function kanaToMora(kana: string): string[] {
		const mora: string[] = [];
		let i = 0;
		
		while (i < kana.length) {
			const char = kana[i];
			const nextChar = kana[i + 1];
			
			// Check for small tsu (っ/ッ)
			if (char === 'っ' || char === 'ッ') {
				mora.push(char);
				i++;
				continue;
			}
			
			// Check for long vowels and combinations
			if (nextChar && isSmallKana(nextChar)) {
				mora.push(char + nextChar);
				i += 2;
			} else if (nextChar && isLongVowelMark(nextChar)) {
				mora.push(char + nextChar);
				i += 2;
			} else {
				mora.push(char);
				i++;
			}
		}
		
		return mora;
	}

	function isSmallKana(char: string): boolean {
		const smallKana = ['ゃ', 'ゅ', 'ょ', 'ャ', 'ュ', 'ョ', 'ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ', 'ァ', 'ィ', 'ゥ', 'ェ', 'ォ'];
		return smallKana.includes(char);
	}

	function isLongVowelMark(char: string): boolean {
		return char === 'ー';
	}

	// Generate pitch accent pattern for visualization
	function generatePitchPattern(mora: string[], pitchAccent: number): { mora: string; isHigh: boolean; isDropPoint: boolean }[] {
		const pattern: { mora: string; isHigh: boolean; isDropPoint: boolean }[] = [];
		
		if (pitchAccent === 0) {
			// Heiban (flat) - low first, then high for the rest
			mora.forEach((m, i) => {
				pattern.push({
					mora: m,
					isHigh: i > 0,
					isDropPoint: false
				});
			});
		} else {
			// Atamadaka (1) or Nakadaka/Odaka (2+)
			mora.forEach((m, i) => {
				const moraIndex = i + 1; // 1-based indexing for pitch accent
				pattern.push({
					mora: m,
					isHigh: moraIndex <= pitchAccent,
					isDropPoint: moraIndex === pitchAccent
				});
			});
		}
		
		return pattern;
	}

	const mora = $derived(kanaToMora(kana));
	const patterns = $derived(pitchAccents.map(accent => generatePitchPattern(mora, accent)));
</script>

<div class="pitch-accent-container">
	{#each patterns as pattern, patternIndex}
		<div class="pitch-pattern" class:multiple={patterns.length > 1}>
			{#if patterns.length > 1}
				<div class="pattern-number">{patternIndex + 1}</div>
			{/if}
			<div class="mora-container">
				{#each pattern as { mora, isHigh, isDropPoint }, i}
					<span
						class="mora"
						class:high={isHigh}
						class:low={!isHigh}
						class:has-right-connector={i < pattern.length - 1}
					>
						{mora}
					</span>
				{/each}
			</div>
		</div>
	{/each}
</div>

<style>
	.pitch-accent-container {
		display: inline-block;
		margin: 4px 0;
	}

	.pitch-pattern {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.pitch-pattern.multiple {
		padding: 4px 8px;
		background: #f8f9fa;
		border-radius: 4px;
		border: 1px solid #e9ecef;
	}

	.pattern-number {
		font-size: 12px;
		font-weight: 600;
		color: #6c757d;
		min-width: 16px;
	}

	.mora-container {
		display: inline-block;
		margin-bottom: 1px;
		--border-width: 1.5px;
	}

	.mora {
		margin: 0;
		text-align: center;
		font-size: 90%;
		border: 0;
		border-style: dotted;
		border-color: currentColor;
	}

	.mora.high {
		border-top-width: var(--border-width);
	}

	.mora.low {
		border-bottom-width: var(--border-width);
	}

	.mora.has-right-connector {
		border-right-width: var(--border-width);
	}
</style>
