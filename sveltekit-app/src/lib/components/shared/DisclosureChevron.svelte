<script lang="ts">
	let {
		expanded,
		onclick,
		controls,
		expandLabel = "Show more",
		collapseLabel = "Show less",
	}: {
		expanded: boolean;
		onclick: () => void;
		controls?: string;
		expandLabel?: string;
		collapseLabel?: string;
	} = $props();
</script>

<button
	type="button"
	class="disclosure-chevron"
	class:expanded
	{onclick}
	aria-expanded={expanded}
	aria-controls={controls}
	aria-label={expanded ? collapseLabel : expandLabel}
	title={expanded ? collapseLabel : expandLabel}
>
	<svg
		width="18"
		height="18"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d="m6 9 6 6 6-6" />
	</svg>
</button>

<style>
	.disclosure-chevron {
		position: relative;
		z-index: 1;
		display: grid;
		width: 2.125rem;
		height: 1.875rem;
		margin: -0.25rem auto 0;
		padding: 0;
		place-items: center;
		border: 1px solid var(--border-light);
		border-radius: var(--radius-full);
		background: var(--bg-primary);
		color: var(--text-tertiary);
		cursor: pointer;
		transition: border-color 0.15s ease, color 0.15s ease;
	}

	.disclosure-chevron:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.disclosure-chevron:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	svg {
		transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.expanded svg {
		transform: rotate(180deg);
	}
</style>
