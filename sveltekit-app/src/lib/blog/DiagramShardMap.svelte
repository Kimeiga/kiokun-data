<!--
  Figure: the two-level fan-out. 30 repositories (28 active + 2 reserved),
  and inside any one of them, 256 hash subdirectories so no single folder
  ever holds tens of thousands of files.
-->
<script lang="ts">
	const families = [
		{ name: 'non-han', n: 4, note: '~11K each' },
		{ name: 'han-1char', n: 8, note: '~11K each' },
		{ name: 'han-2char', n: 8, note: '~13K each' },
		{ name: 'han-3plus', n: 8, note: '~12K each' },
		{ name: 'reserved', n: 2, note: 'idle' }
	];
	const cells = Array.from({ length: 256 }, (_, i) => i);
	const litSubdir = 0xa3; // the /a3/ from the routing figure
</script>

<div class="map">
	<div class="repos">
		<p class="eyebrow">30 repositories · one per shard</p>
		<div class="fams">
			{#each families as f}
				<div class="fam" class:idle={f.name === 'reserved'}>
					<div class="fam-head">
						<span class="fam-name">{f.name}</span>
						<span class="fam-note">{f.note}</span>
					</div>
					<div class="chips">
						{#each Array(f.n) as _, i}
							<span class="chip" class:hot={f.name === 'han-2char' && i === 4}>
								{i + 1}
							</span>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>

	<div class="zoom" aria-hidden="true">
		<div class="zoom-rail"></div>
		<div class="grid-wrap">
			<p class="eyebrow">inside <code>han-2char-5</code> · 256 subdirs (00–ff)</p>
			<div class="grid">
				{#each cells as c}
					<i class="cell" class:lit={c === litSubdir} title={c.toString(16).padStart(2, '0')}></i>
				{/each}
			</div>
			<p class="foot">
				<span class="swatch"></span> <code>/a3/</code> — the word's subdirectory.
				Every cell holds <b>~40–50 files</b>, never 45,000.
			</p>
		</div>
	</div>
</div>

<style>
	.map {
		display: grid;
		gap: clamp(1.4rem, 4vw, 2.4rem);
		container-type: inline-size;
	}
	@container (min-width: 720px) {
		.map {
			grid-template-columns: 1fr 1fr;
			align-items: start;
		}
	}
	.eyebrow {
		margin: 0 0 0.85rem;
		font-family: var(--label);
		font-size: 0.72rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--ink-faint);
	}
	.eyebrow code,
	.foot code {
		font-family: var(--label);
		font-weight: 600;
		color: var(--shu);
		background: none;
	}
	.fams {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}
	.fam-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 0.35rem;
	}
	.fam-name {
		font-family: var(--label);
		font-weight: 600;
		font-size: 0.86rem;
		color: var(--ink);
	}
	.fam-note {
		font-family: var(--label);
		font-size: 0.7rem;
		color: var(--ink-faint);
		letter-spacing: 0.04em;
	}
	.chips {
		display: flex;
		gap: 0.32rem;
		flex-wrap: wrap;
	}
	.chip {
		width: 1.65rem;
		height: 1.65rem;
		display: grid;
		place-items: center;
		font-family: var(--label);
		font-size: 0.74rem;
		color: var(--ink-soft);
		background: var(--paper);
		border: 1px solid var(--rule);
		border-radius: 2px;
	}
	.fam.idle .chip {
		color: var(--ink-faint);
		border-style: dashed;
		background: transparent;
	}
	.chip.hot {
		color: var(--paper);
		background: var(--shu);
		border-color: var(--shu);
		box-shadow: 0 0 0 3px var(--shu-wash);
	}
	.zoom {
		display: flex;
		gap: 0.9rem;
	}
	.zoom-rail {
		flex: none;
		width: 2px;
		background: linear-gradient(var(--shu), transparent);
		border-radius: 2px;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(16, 1fr);
		gap: 3px;
		max-width: 22rem;
	}
	.cell {
		aspect-ratio: 1;
		background: var(--paper-3);
		border-radius: 1.5px;
	}
	.cell.lit {
		background: var(--shu);
		box-shadow: 0 0 6px var(--shu-soft);
	}
	.foot {
		margin: 0.9rem 0 0;
		font-family: var(--label);
		font-size: 0.78rem;
		line-height: 1.6;
		color: var(--ink-faint);
		max-width: 24rem;
	}
	.foot b {
		color: var(--ink-soft);
	}
	.swatch {
		display: inline-block;
		width: 0.7rem;
		height: 0.7rem;
		background: var(--shu);
		border-radius: 1.5px;
		vertical-align: -1px;
	}
</style>
