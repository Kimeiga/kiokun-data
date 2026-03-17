<script lang="ts">
	/**
	 * Reusable tag component for displaying labels with color coding
	 * Based on 10ten-ja-reader's Tag component
	 */
	export let type: 'pos' | 'misc' | 'field' | 'dial' | 'fem' | 'masc' | 'place';
	export let text: string;
	export let langTag: string = 'en';

	const colorMap: Record<string, string> = {
		fem: 'pink',
		masc: 'blue',
		place: 'green',
		field: 'green',
		misc: 'blue',
		dial: 'pink'
		// pos tags use default grey color (no entry)
	};

	const color = colorMap[type];
</script>

{#if text}
	<span
		class="tag"
		class:has-color={!!color}
		style={color
			? `
			background: var(--tag-${color}-bg);
			border-color: var(--tag-${color}-border);
			color: var(--tag-${color}-text);
		`
			: ''}
		lang={langTag}
	>
		{text}
	</span>
{/if}

<style>
	.tag {
		display: inline-block;
		padding: 1px 5px;
		border-radius: 3px;
		border: 1px solid;
		font-size: var(--font-size-caption2);
		font-weight: 600;
		white-space: nowrap;
		margin-right: var(--spacing-xs);
		transition: all 0.2s ease;
	}

	/* Default grey color for POS tags - uses CSS variables that adapt to theme */
	.tag:not(.has-color) {
		background: var(--tag-pos-bg);
		border-color: var(--tag-border);
		color: var(--tag-pos-text);
	}
</style>

