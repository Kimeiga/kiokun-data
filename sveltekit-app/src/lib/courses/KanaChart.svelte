<script lang="ts">
	import type { ScriptChart } from './types';

	let { chart, language = 'ja' }: { chart: ScriptChart; language?: string } = $props();
</script>

<figure class="chart">
	<figcaption>
		<strong>{chart.title}</strong>
		<span>{chart.caption}</span>
	</figcaption>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div class="table-scroll" tabindex="0" role="region" aria-label={chart.title}>
		<table>
			<thead>
				<tr>
					<th scope="col">Row</th>
					{#each chart.columns as column}
						<th scope="col">{column}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each chart.rows as row}
					<tr>
						<th scope="row">{row.label}</th>
						{#each row.cells as cell}
							<td class:empty={!cell}>
								{#if cell}
									<span class="symbol" lang={language}>{cell.symbol}</span>
									<span class="romanization">{cell.romanization}</span>
									{#if cell.note}<small>{cell.note}</small>{/if}
								{:else}
									<span aria-hidden="true">—</span>
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</figure>

<style>
	.chart {
		min-width: 0;
		max-width: 100%;
		margin: 0;
		border: 1px solid var(--border-color);
		background: var(--bg-secondary);
	}

	figcaption {
		display: grid;
		grid-template-columns: minmax(8rem, 0.6fr) minmax(0, 1.4fr);
		gap: 1rem;
		padding: 0.85rem 1rem;
		border-bottom: 1px solid var(--border-color);
	}

	figcaption strong {
		font-size: 0.9rem;
	}

	figcaption span {
		color: var(--text-secondary);
		font-size: 0.78rem;
	}

	.table-scroll {
		width: 100%;
		max-width: 100%;
		overflow-x: auto;
	}

	table {
		width: 100%;
		min-width: 36rem;
		border-collapse: collapse;
		table-layout: fixed;
	}

	th,
	td {
		padding: 0.55rem 0.4rem;
		border-right: 1px solid var(--border-color);
		border-bottom: 1px solid var(--border-color);
		text-align: center;
		vertical-align: middle;
	}

	tr:last-child th,
	tr:last-child td {
		border-bottom: 0;
	}

	th:last-child,
	td:last-child {
		border-right: 0;
	}

	thead th,
	tbody th {
		background: var(--bg-primary);
		color: var(--text-tertiary);
		font-size: 0.68rem;
		font-weight: 730;
		letter-spacing: 0.04em;
	}

	tbody th {
		width: 3rem;
		font-family: var(--font-mono);
	}

	.symbol,
	.romanization,
	td small {
		display: block;
	}

	.symbol {
		font-family: var(--font-cjk);
		font-size: 1.25rem;
		font-weight: 650;
	}

	.romanization {
		margin-top: 0.05rem;
		color: var(--course-reading-color, var(--color-onyomi));
		font-size: 0.66rem;
	}

	td small {
		margin-top: 0.15rem;
		color: var(--text-muted);
		font-size: 0.58rem;
		line-height: 1.2;
	}

	td.empty {
		color: var(--text-muted);
	}

	.table-scroll:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	@media (max-width: 560px) {
		figcaption {
			grid-template-columns: 1fr;
			gap: 0.25rem;
		}
	}
</style>
