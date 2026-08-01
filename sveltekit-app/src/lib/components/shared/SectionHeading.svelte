<script lang="ts">
	let {
		children,
		id,
		divided = true,
	}: {
		children: any;
		id?: string;
		divided?: boolean;
	} = $props();

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

<div class="section-heading" class:undivided={!divided} id={id}>
	<span class="section-heading-content">
		<h2 class="section-heading-title">{@render children()}</h2>
		{#if id}
			<button
				type="button"
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
	</span>
</div>

<style>
	.section-heading {
		min-height: 1.75rem;
		margin: var(--spacing-md) 0 0;
		border-block: 1px solid var(--border-color);
		background: var(--section-bar-bg);
		color: var(--section-bar-text);
	}

	.section-heading.undivided {
		margin-top: 0;
	}

	.section-heading-content {
		display: flex;
		min-height: 1.75rem;
		padding-inline: var(--spacing-md) 0;
		align-items: center;
		gap: 0;
		color: inherit;
		font-size: var(--font-size-subhead);
		font-weight: 650;
		letter-spacing: 0.01em;
	}

	.section-heading-title {
		margin: 0;
		color: inherit;
		font: inherit;
		letter-spacing: inherit;
	}

	.permalink-btn {
		all: unset;
		display: grid;
		width: 2.75rem;
		height: 2.75rem;
		flex: 0 0 2.75rem;
		margin: -0.5rem -0.75rem -0.5rem -0.5rem;
		place-items: center;
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.15s ease;
		font-size: 0.85em;
		color: inherit;
		line-height: 1;
	}

	.section-heading:hover .permalink-btn {
		opacity: 0.5;
	}

	.permalink-btn:hover {
		opacity: 1 !important;
	}

	.permalink-btn:focus-visible {
		opacity: 1 !important;
		border-radius: var(--radius-sm);
		outline: 2px solid var(--accent);
		outline-offset: -4px;
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
			min-height: 1.75rem;
			margin-top: var(--spacing-md);
			margin-inline: -0.75rem;
		}

		.section-heading.undivided {
			margin-top: 0;
		}

		.section-heading-content {
			min-height: 1.75rem;
			padding-left: 0.75rem;
			font-size: var(--font-size-subhead);
		}

		/* Always show on mobile since there's no hover */
		.permalink-btn {
			opacity: 0.35;
		}
	}
</style>
