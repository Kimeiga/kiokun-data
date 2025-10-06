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
					<div class="mora-wrapper">
						<div class="mora" class:high={isHigh} class:low={!isHigh}>
							{mora}
						</div>
						{#if i < pattern.length - 1}
							{@const nextIsHigh = pattern[i + 1].isHigh}
							<div class="connector" class:high-to-low={isHigh && !nextIsHigh} class:low-to-high={!isHigh && nextIsHigh} class:same-level={isHigh === nextIsHigh}></div>
						{/if}
						{#if isDropPoint && i < pattern.length - 1}
							<div class="drop-marker">↓</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/each}
</div>

<style>
	.pitch-accent-container {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin: 8px 0;
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
		display: flex;
		align-items: center;
		position: relative;
	}

	.mora-wrapper {
		position: relative;
		display: flex;
		align-items: center;
	}

	.mora {
		font-family: 'MS Mincho', serif;
		font-size: 16px;
		padding: 2px 4px;
		position: relative;
		z-index: 2;
	}

	.mora.high {
		border-top: 2px solid #e74c3c;
		color: #e74c3c;
	}

	.mora.low {
		border-bottom: 2px solid #3498db;
		color: #3498db;
	}

	.connector {
		width: 8px;
		height: 2px;
		position: relative;
		z-index: 1;
	}

	.connector.high-to-low {
		background: linear-gradient(to right, #e74c3c 0%, #e74c3c 30%, #3498db 70%, #3498db 100%);
		transform: rotate(-20deg);
		margin: 0 -2px;
	}

	.connector.low-to-high {
		background: linear-gradient(to right, #3498db 0%, #3498db 30%, #e74c3c 70%, #e74c3c 100%);
		transform: rotate(20deg);
		margin: 0 -2px;
	}

	.connector.same-level {
		background: #95a5a6;
	}

	.drop-marker {
		position: absolute;
		top: -20px;
		right: -4px;
		font-size: 12px;
		color: #e74c3c;
		font-weight: bold;
		z-index: 3;
	}
</style>
