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
		width="14"
		height="14"
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
		width: 1.625rem;
		height: 1.625rem;
		margin: 0.2rem auto -0.125rem;
		padding: 0;
		place-items: center;
		border: 0;
		border-radius: 50%;
		background: var(--bg-secondary);
		color: var(--text-tertiary);
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			color 0.15s ease,
			transform 0.12s ease;
	}

	.disclosure-chevron:hover {
		background: var(--accent-light);
		color: var(--accent);
	}

	.disclosure-chevron:active {
		transform: scale(0.92);
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

	@media (pointer: coarse) {
		.disclosure-chevron {
			width: 2.75rem;
			height: 2.75rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.disclosure-chevron,
		svg {
			transition: none;
		}
	}
</style>
