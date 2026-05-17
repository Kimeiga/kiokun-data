<script lang="ts">
	let {
		n,
		title,
		caption,
		bleed = false,
		children
	}: { n: number; title: string; caption?: string; bleed?: boolean; children: any } = $props();
</script>

<figure class="fig" class:bleed>
	<div class="frame">
		{@render children()}
	</div>
	<figcaption>
		<span class="seal" aria-hidden="true">
			<span class="seal-n">{String(n).padStart(2, '0')}</span>
		</span>
		<span class="cap">
			<b>{title}</b>{#if caption}&nbsp;— {caption}{/if}
		</span>
	</figcaption>
</figure>

<style>
	.fig {
		margin: clamp(2.4rem, 6vw, 4rem) 0;
	}
	.frame {
		background: var(--paper-2);
		border: 1px solid var(--rule);
		border-radius: 2px;
		padding: clamp(1rem, 4vw, 2.4rem);
		overflow: hidden;
	}
	/* Diagrams break out past the reading measure — they're the point. */
	.bleed .frame {
		margin-inline: calc(-1 * var(--gutter));
	}
	@media (min-width: 1080px) {
		.bleed {
			width: min(76rem, 92vw);
			margin-left: 50%;
			transform: translateX(-50%);
		}
	}
	figcaption {
		display: flex;
		align-items: baseline;
		gap: 0.7rem;
		margin-top: 0.95rem;
		font-family: var(--label);
		font-size: 0.8rem;
		line-height: 1.5;
		color: var(--ink-faint);
		letter-spacing: 0.01em;
	}
	.cap b {
		color: var(--ink-soft);
		font-weight: 600;
		font-variant: small-caps;
		letter-spacing: 0.06em;
	}
	/* Hand-stamped vermilion seal as the figure mark — a recurring motif. */
	.seal {
		flex: none;
		display: grid;
		place-items: center;
		width: 2.05rem;
		height: 2.05rem;
		color: var(--paper);
		background: var(--shu);
		border-radius: 3px;
		box-shadow: inset 0 0 0 1.5px color-mix(in oklch, var(--shu) 70%, black);
		transform: rotate(-3deg);
		font-family: var(--display);
		font-weight: 600;
	}
	.seal-n {
		font-size: 0.82rem;
		font-variant-numeric: tabular-nums;
		transform: rotate(3deg);
	}
</style>
