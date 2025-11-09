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
		margin: 16px 0 12px 0;
		padding-top: 8px;
	}

	.section-heading-content {
		font-size: 13px;
		font-weight: 700;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
</style>

