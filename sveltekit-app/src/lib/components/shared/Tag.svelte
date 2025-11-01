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
		padding: 2px 6px;
		border-radius: 3px;
		border: 1px solid;
		font-size: 11px;
		font-weight: 600;
		white-space: nowrap;
		margin-right: 4px;
		transition: all 0.2s ease;
	}

	/* Default grey color for POS tags */
	.tag:not(.has-color) {
		background: transparent;
		border-color: rgba(0, 0, 0, 0.3);
		color: var(--text-color, #2c3e50);
	}

	/* Dark mode support for default tags */
	:global(.dark) .tag:not(.has-color) {
		border-color: rgba(255, 255, 255, 0.4);
		color: var(--text-color, #ecf0f1);
	}
</style>

