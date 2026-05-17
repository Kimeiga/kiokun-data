<!--
  Figure: the build. A push to kiokun-data fans into a 28-way GitHub Actions
  matrix; every lane compiles the Rust generator, emits its shard, and
  orphan-force-pushes to its own repo. All 28 lanes run at once.
-->
<script lang="ts">
	const lanes = Array.from({ length: 28 }, (_, i) => i);
</script>

<div class="pipe">
	<ol class="stage src">
		<li class="step">
			<span class="k">git push</span>
			<span class="v"><code>src/** · Cargo.toml</code></span>
		</li>
		<li class="step">
			<span class="k">trigger</span>
			<span class="v">paths-filtered workflow</span>
		</li>
	</ol>

	<div class="fan" aria-hidden="true">
		<svg viewBox="0 0 60 220" preserveAspectRatio="none">
			{#each [20, 70, 110, 150, 200] as y}
				<path d="M0 110 C 30 110, 30 {y}, 60 {y}" />
			{/each}
		</svg>
	</div>

	<div class="matrix">
		<p class="cap">matrix · 28 shards · max-parallel: 28</p>
		<div class="lanes">
			{#each lanes as i}
				<div class="lane" style="--i:{i}">
					<span class="fill"></span>
					<span class="tick t1"></span>
					<span class="tick t2"></span>
					<span class="tick t3"></span>
				</div>
			{/each}
		</div>
		<div class="legend">
			<span><i class="d d1"></i> cargo build</span>
			<span><i class="d d2"></i> build_dictionary --mode</span>
			<span><i class="d d3"></i> orphan → force-push</span>
		</div>
	</div>

	<div class="fan rev" aria-hidden="true">
		<svg viewBox="0 0 60 220" preserveAspectRatio="none">
			{#each [20, 70, 110, 150, 200] as y}
				<path d="M0 {y} C 30 {y}, 30 110, 60 110" />
			{/each}
		</svg>
	</div>

	<ol class="stage out">
		<li class="step seal">
			<span class="k">28 repos</span>
			<span class="v"><code>kiokun2-dict-*</code></span>
		</li>
		<li class="step">
			<span class="k">raw / jsDelivr</span>
			<span class="v">global CDN</span>
		</li>
		<li class="step">
			<span class="k">browser</span>
			<span class="v">one fetch → word</span>
		</li>
	</ol>
</div>

<style>
	.pipe {
		display: grid;
		grid-template-columns: auto 36px 1fr 36px auto;
		align-items: center;
		gap: 0.4rem;
		container-type: inline-size;
		font-family: var(--label);
	}
	@container (max-width: 680px) {
		.pipe {
			grid-template-columns: 1fr;
			gap: 1rem;
		}
		.fan {
			display: none;
		}
	}
	.stage {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}
	.step {
		background: var(--paper);
		border: 1px solid var(--rule);
		border-radius: 3px;
		padding: 0.55rem 0.7rem;
		min-width: 9.5rem;
	}
	.step.seal {
		border-color: var(--shu);
		background: color-mix(in oklch, var(--shu-wash) 55%, var(--paper));
	}
	.k {
		display: block;
		font-weight: 600;
		font-size: 0.82rem;
		color: var(--ink);
	}
	.v {
		display: block;
		font-size: 0.72rem;
		color: var(--ink-faint);
		margin-top: 0.15rem;
	}
	code {
		font-family: var(--label);
		color: var(--shu);
		font-weight: 600;
	}
	.fan svg {
		width: 100%;
		height: 220px;
	}
	.fan path {
		fill: none;
		stroke: var(--rule);
		stroke-width: 1.25;
	}
	.cap {
		margin: 0 0 0.5rem;
		font-size: 0.7rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--ink-faint);
		text-align: center;
	}
	.lanes {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 4px 1.4rem;
	}
	@container (max-width: 680px) {
		.lanes {
			grid-template-columns: 1fr;
		}
	}
	.lane {
		position: relative;
		height: 9px;
		background: var(--paper-3);
		border-radius: 5px;
		overflow: hidden;
	}
	.fill {
		position: absolute;
		inset: 0;
		transform: translateX(-100%);
		background: linear-gradient(90deg, var(--shu-soft), var(--shu));
		animation: run 3.4s cubic-bezier(0.5, 0, 0.2, 1) infinite;
		animation-delay: calc(var(--i) * 42ms);
	}
	.tick {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 1px;
		background: color-mix(in oklch, var(--paper) 55%, transparent);
	}
	.t1 {
		left: 38%;
	}
	.t2 {
		left: 66%;
	}
	.t3 {
		left: 88%;
	}
	@keyframes run {
		0% {
			transform: translateX(-100%);
		}
		70% {
			transform: translateX(0);
		}
		100% {
			transform: translateX(0);
		}
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1.1rem;
		justify-content: center;
		margin-top: 0.8rem;
		font-size: 0.72rem;
		color: var(--ink-faint);
	}
	.d {
		display: inline-block;
		width: 0.6rem;
		height: 0.6rem;
		border-radius: 50%;
		vertical-align: 0;
		margin-right: 0.3rem;
	}
	.d1 {
		background: var(--shu-soft);
	}
	.d2 {
		background: color-mix(in oklch, var(--shu) 70%, var(--shu-soft));
	}
	.d3 {
		background: var(--shu);
	}
	@media (prefers-reduced-motion: reduce) {
		.fill {
			animation: none;
			transform: translateX(-8%);
		}
	}
</style>
