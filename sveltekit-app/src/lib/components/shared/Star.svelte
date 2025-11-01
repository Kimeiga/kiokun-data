<script lang="ts">
	/**
	 * Star icon component for indicating priority/common words
	 * Based on 10ten-ja-reader's Star component
	 */
	export let style: 'full' | 'hollow' = 'hollow';
</script>

<svg
	width="12"
	height="12"
	viewBox="0 0 24 24"
	class="inline-block -translate-y-0.5"
	style="fill: {style === 'full' ? 'var(--star-full)' : 'none'}; 
         stroke: {style === 'full' ? 'var(--star-full)' : 'var(--star-hollow)'}; 
         stroke-width: 2;"
>
	<path
		d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
	/>
</svg>

