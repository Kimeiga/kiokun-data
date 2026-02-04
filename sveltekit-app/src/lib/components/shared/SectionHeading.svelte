<script lang="ts">
	let { children }: { children: any } = $props();
</script>

<div class="section-heading">
	<div class="section-heading-content">
		{@render children()}
	</div>
</div>

<style>
	.section-heading {
		border-top: 1px solid var(--border-color);
		margin: var(--spacing-lg) 0 var(--spacing-md) 0;
		padding-top: var(--spacing-sm);
	}

	.section-heading-content {
		font-size: var(--font-size-footnote);
		font-weight: 700;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	@media (max-width: 768px) {
		.section-heading {
			margin: var(--spacing-md) 0 var(--spacing-sm) 0;
			padding-top: var(--spacing-xs);
		}

		.section-heading-content {
			font-size: var(--font-size-caption1);
			letter-spacing: 0.3px;
		}
	}
</style>

