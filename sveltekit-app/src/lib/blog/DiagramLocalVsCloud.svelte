<!--
  Figure: why generate in CI at all. Building locally means 435K files must
  climb a home uplink. Pushing code lets the runner generate and commit
  beside the repos — the heavy bytes never leave GitHub's network.
-->
<div class="vs">
	<div class="track old">
		<div class="end">
			<span class="who">your machine</span>
			<span class="load big">≈ 435K files · hundreds of MB</span>
		</div>
		<div class="pipe narrow" aria-hidden="true">
			<span class="crawl"></span>
			<span class="crawl c2"></span>
			<span class="pinch">home uplink</span>
		</div>
		<div class="end">
			<span class="who">GitHub</span>
			<span class="verdict slow">slow · the bytes are the bottleneck</span>
		</div>
	</div>

	<div class="track new">
		<div class="end">
			<span class="who">your machine</span>
			<span class="load tiny">git push · a few KB of Rust</span>
		</div>
		<div class="pipe wide" aria-hidden="true">
			<span class="zip"></span>
			<span class="pinch ok">runner builds &amp; commits in-network</span>
		</div>
		<div class="end">
			<span class="who seal">28 repos</span>
			<span class="verdict fast">fast · compute sits next to the data</span>
		</div>
	</div>
</div>

<style>
	.vs {
		display: grid;
		gap: clamp(1.1rem, 4vw, 2rem);
		font-family: var(--label);
		container-type: inline-size;
	}
	.track {
		display: grid;
		grid-template-columns: 1fr 2.1fr 1fr;
		align-items: center;
		gap: 0.7rem;
	}
	@container (max-width: 620px) {
		.track {
			grid-template-columns: 1fr;
			text-align: center;
		}
	}
	.end {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.who {
		font-weight: 600;
		font-size: 0.86rem;
		color: var(--ink);
	}
	.who.seal {
		color: var(--shu);
	}
	.load,
	.verdict {
		font-size: 0.72rem;
		color: var(--ink-faint);
		line-height: 1.4;
	}
	.load.big {
		color: var(--ink-soft);
		font-weight: 600;
	}
	.verdict.slow {
		color: var(--ink-faint);
	}
	.verdict.fast {
		color: var(--shu);
		font-weight: 600;
	}

	.pipe {
		position: relative;
		border-radius: 6px;
		background: var(--paper-3);
		overflow: hidden;
		display: grid;
		place-items: center;
	}
	.pipe.narrow {
		height: 12px;
	}
	.pipe.wide {
		height: 30px;
		background: color-mix(in oklch, var(--shu-wash) 45%, var(--paper-3));
	}
	.pinch {
		position: relative;
		z-index: 2;
		font-size: 0.64rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink-faint);
		background: color-mix(in oklch, var(--paper) 70%, transparent);
		padding: 0 0.4rem;
		border-radius: 3px;
	}
	.pinch.ok {
		color: var(--shu);
	}
	.crawl {
		position: absolute;
		top: 50%;
		left: 0;
		width: 26%;
		height: 4px;
		transform: translateY(-50%);
		border-radius: 3px;
		background: var(--ink-faint);
		opacity: 0.5;
		animation: crawl 5.4s linear infinite;
	}
	.crawl.c2 {
		animation-delay: 2.7s;
	}
	.zip {
		position: absolute;
		top: 50%;
		left: 0;
		width: 14%;
		height: 8px;
		transform: translateY(-50%);
		border-radius: 5px;
		background: linear-gradient(90deg, transparent, var(--shu));
		animation: zip 1.5s cubic-bezier(0.4, 0, 0.1, 1) infinite;
	}
	@keyframes crawl {
		0% {
			left: -28%;
		}
		100% {
			left: 100%;
		}
	}
	@keyframes zip {
		0% {
			left: -16%;
		}
		60%,
		100% {
			left: 100%;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.crawl,
		.zip {
			animation: none;
			left: 36%;
		}
		.crawl.c2 {
			display: none;
		}
	}
</style>
