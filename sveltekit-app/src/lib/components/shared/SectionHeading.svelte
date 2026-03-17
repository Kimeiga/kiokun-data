<script lang="ts">
	let { children, id }: { children: any; id?: string } = $props();

	let copied = $state(false);

	function copyPermalink() {
		if (!id) return;
		const url = `${window.location.origin}${window.location.pathname}#${id}`;
		navigator.clipboard.writeText(url).then(() => {
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 1500);
		});
	}
</script>

<div class="section-heading" id={id}>
	<div class="section-heading-content">
		{@render children()}
		{#if id}
			<button
				class="permalink-btn"
				class:copied
				onclick={copyPermalink}
				title="Copy link to section"
				aria-label="Copy permalink"
			>
				{#if copied}
					<span class="permalink-icon check">&#10003;</span>
				{:else}
					<span class="permalink-icon">#</span>
				{/if}
			</button>
		{/if}
	</div>
</div>

<style>
	.section-heading {
		border-top: 1px solid var(--border-color);
		margin: var(--spacing-md) 0 var(--spacing-sm) 0;
		padding-top: var(--spacing-xs);
	}

	.section-heading-content {
		font-size: var(--font-size-caption1);
		font-weight: 700;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.4px;
		display: flex;
		align-items: center;
		gap: 0.25em;
	}

	.permalink-btn {
		all: unset;
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.15s ease;
		font-size: 0.85em;
		color: var(--text-muted, var(--text-secondary));
		line-height: 1;
		padding: 0 0.15em;
	}

	.section-heading:hover .permalink-btn {
		opacity: 0.5;
	}

	.permalink-btn:hover {
		opacity: 1 !important;
	}

	.permalink-btn.copied {
		opacity: 1 !important;
	}

	.permalink-icon {
		font-weight: 400;
	}

	.permalink-icon.check {
		color: var(--color-success, #34c759);
	}

	@media (max-width: 768px) {
		.section-heading {
			margin: var(--spacing-sm) 0 var(--spacing-xs) 0;
			padding-top: var(--spacing-xs);
		}

		.section-heading-content {
			font-size: var(--font-size-caption2);
			letter-spacing: 0.3px;
		}

		/* Always show on mobile since there's no hover */
		.permalink-btn {
			opacity: 0.35;
		}
	}
</style>
