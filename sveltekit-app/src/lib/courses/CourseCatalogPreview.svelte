<script lang="ts">
	import type { CourseCatalogEntry } from './catalog';

	let { course }: { course: CourseCatalogEntry } = $props();
	let selectedChoice = $state('');
	let questionStatus = $state<'idle' | 'correct' | 'incorrect'>('idle');

	function selectChoice(): void {
		questionStatus = 'idle';
	}

	function checkChoice(): void {
		if (!selectedChoice) return;
		questionStatus = selectedChoice === course.preview.question.answer ? 'correct' : 'incorrect';
	}
</script>

<article class="course-sheet" style={'--course-color: ' + `var(--course-${course.language})`}>
	<header class="course-header">
		<div class="course-identity">
			<span class="course-glyph" lang={course.htmlLanguage} aria-hidden="true">{course.glyph}</span>
			<div>
				<h3>{course.languageName}</h3>
				<p lang={course.htmlLanguage}>{course.nativeName}</p>
			</div>
		</div>
		<p class="course-meta">
			<span>{course.level}</span>
			<span>{course.lessonCount} lessons</span>
			<span>{course.missionCount} missions</span>
		</p>
	</header>

	<div class="lesson-register">
		<span>Lesson {course.preview.sequence}</span>
		<strong>{course.preview.title}</strong>
		<span>{course.preview.durationMinutes} min</span>
	</div>

	<figure class="chart-preview">
		<figcaption>
			<strong>{course.preview.chart.title}</strong>
			<span>From the lesson</span>
		</figcaption>
		<div class="chart-frame">
			<table>
				<thead>
					<tr>
						<th scope="col">Row</th>
						{#each course.preview.chart.columns as column}
							<th scope="col">{column}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each course.preview.chart.rows as row}
						<tr>
							<th scope="row">{row.label}</th>
							{#each row.cells as cell}
								<td class:empty={!cell}>
									{#if cell}
										<strong class="chart-symbol" lang={course.htmlLanguage}>{cell.symbol}</strong>
										<span class="chart-reading">{cell.romanization}</span>
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

	<div class="lesson-samples">
		<section class="example-preview" aria-label="Example from the lesson">
			<span class="sample-label">Example · {course.preview.dialogue.speaker}</span>
			<strong lang={course.htmlLanguage}>{course.preview.dialogue.text}</strong>
			<span class="example-reading">{course.preview.dialogue.reading}</span>
			<span class="example-meaning">{course.preview.dialogue.translation}</span>
		</section>

		<section class="question-preview" aria-label="Question from the lesson">
			<span class="sample-label">Sample check</span>
			<p id={'catalog-question-' + course.language}>{course.preview.question.prompt}</p>
			<fieldset aria-labelledby={'catalog-question-' + course.language}>
				<legend>Choose one answer</legend>
				<div class="question-options">
					{#each course.preview.question.options as option}
						<label
							class:selected={selectedChoice === option.value}
							class:correct={questionStatus === 'correct' && selectedChoice === option.value}
							class:incorrect={questionStatus === 'incorrect' && selectedChoice === option.value}
						>
							<input
								type="radio"
								name={'catalog-question-' + course.language}
								value={option.value}
								bind:group={selectedChoice}
								onchange={selectChoice}
							/>
							<span class="option-mark" aria-hidden="true"></span>
							<span>{option.label}</span>
						</label>
					{/each}
				</div>
			</fieldset>
			<div class="question-actions">
				<button type="button" disabled={!selectedChoice} onclick={checkChoice}>Check answer</button>
				{#if questionStatus !== 'idle'}
					<p class:correct={questionStatus === 'correct'} role="status">
						{questionStatus === 'correct' ? 'Correct.' : 'Not yet. Try another answer.'}
					</p>
				{/if}
			</div>
			{#if questionStatus === 'correct'}
				<p class="question-rationale">{course.preview.question.rationale}</p>
			{/if}
		</section>
	</div>

	<footer class="course-footer">
		<p><span>After this lesson</span>{course.preview.canDo}</p>
		<nav aria-label={course.languageName + ' course links'}>
			<a class="lesson-link" href={'/courses/' + course.slug + '/' + course.preview.lessonId}>
				Open this lesson <span aria-hidden="true">→</span>
			</a>
			<a class="map-link" href={'/courses/' + course.slug}>View course map</a>
		</nav>
	</footer>
</article>

<style>
	.course-sheet {
		display: flex;
		min-width: 0;
		height: 100%;
		flex-direction: column;
		background: var(--bg-secondary);
	}

	.course-header {
		display: flex;
		min-height: 6.1rem;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1.1rem;
	}

	.course-identity {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 0.8rem;
	}

	.course-glyph {
		color: var(--course-color);
		font-family: var(--font-cjk);
		font-size: 3rem;
		font-weight: 760;
		line-height: 1;
	}

	.course-identity h3,
	.course-identity p,
	.course-meta {
		margin: 0;
	}

	.course-identity h3 {
		font-size: 1.2rem;
		letter-spacing: -0.02em;
	}

	.course-identity p {
		margin-top: 0.2rem;
		color: var(--text-tertiary);
		font-family: var(--font-cjk);
		font-size: 0.78rem;
	}

	.course-meta {
		display: grid;
		gap: 0.16rem;
		color: var(--text-tertiary);
		font-size: 0.72rem;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.course-meta span:first-child {
		color: color-mix(in srgb, var(--course-color) 75%, var(--text-primary));
		font-weight: 740;
	}

	.lesson-register {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.8rem;
		padding: 0.58rem 0.75rem;
		border-top: 1px solid var(--border-color);
		border-bottom: 1px solid var(--border-color);
		background: var(--bg-primary);
	}

	.lesson-register span {
		color: var(--text-tertiary);
		font-size: 0.7rem;
		font-variant-numeric: tabular-nums;
	}

	.lesson-register strong {
		overflow: hidden;
		font-size: 0.86rem;
		text-align: center;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.chart-preview {
		min-width: 0;
		margin: 0;
	}

	.chart-preview figcaption {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.72rem 0.8rem;
	}

	.chart-preview figcaption strong {
		font-size: 0.84rem;
	}

	.chart-preview figcaption span {
		color: var(--text-tertiary);
		font-size: 0.69rem;
	}

	.chart-frame {
		min-width: 0;
		border-top: 1px solid var(--border-color);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
	}

	th,
	td {
		padding: 0.48rem 0.28rem;
		border-right: 1px solid var(--border-color);
		border-bottom: 1px solid var(--border-color);
		text-align: center;
		vertical-align: middle;
	}

	tr > :last-child {
		border-right: 0;
	}

	thead th,
	tbody th {
		width: 3.6rem;
		background: var(--bg-primary);
		color: var(--text-tertiary);
		font-size: 0.68rem;
		font-weight: 700;
		line-height: 1.2;
	}

	thead th:not(:first-child) {
		width: auto;
	}

	.chart-symbol,
	.chart-reading,
	td small {
		display: block;
	}

	.chart-symbol {
		font-family: var(--font-cjk);
		font-size: 1.15rem;
		line-height: 1.2;
	}

	.chart-reading {
		margin-top: 0.12rem;
		color: color-mix(in srgb, var(--course-color) 76%, var(--text-primary));
		font-size: 0.7rem;
		line-height: 1.25;
	}

	td small {
		margin-top: 0.16rem;
		color: var(--text-tertiary);
		font-size: 0.62rem;
		line-height: 1.2;
	}

	td.empty {
		color: var(--text-tertiary);
	}

	.lesson-samples {
		display: grid;
		grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr);
		border-bottom: 1px solid var(--border-color);
	}

	.example-preview,
	.question-preview {
		min-width: 0;
		padding: 0.9rem;
	}

	.question-preview {
		border-left: 1px solid var(--border-color);
	}

	.sample-label {
		display: block;
		color: color-mix(in srgb, var(--course-color) 74%, var(--text-primary));
		font-size: 0.7rem;
		font-weight: 740;
	}

	.example-preview strong,
	.example-reading,
	.example-meaning {
		display: block;
	}

	.example-preview strong {
		margin-top: 0.55rem;
		font-family: var(--font-cjk);
		font-size: 1.05rem;
		line-height: 1.35;
	}

	.example-reading {
		margin-top: 0.25rem;
		color: color-mix(in srgb, var(--course-color) 70%, var(--text-primary));
		font-size: 0.78rem;
		line-height: 1.35;
	}

	.example-meaning {
		margin-top: 0.38rem;
		color: var(--text-secondary);
		font-size: 0.875rem;
		line-height: 1.35;
	}

	.question-preview p {
		margin: 0.48rem 0 0;
		font-size: 0.875rem;
		font-weight: 650;
		line-height: 1.35;
	}

	.question-preview fieldset {
		margin: 0.55rem 0 0;
		padding: 0;
		border: 0;
	}

	.question-preview legend {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		clip-path: inset(50%);
	}

	.question-options {
		border-top: 1px solid var(--border-color);
	}

	.question-options label {
		position: relative;
		display: flex;
		min-height: 2.75rem;
		align-items: center;
		gap: 0.45rem;
		padding: 0.45rem 0.25rem;
		border-bottom: 1px solid var(--border-color);
		color: var(--text-secondary);
		font-size: 0.875rem;
		line-height: 1.35;
		cursor: pointer;
	}

	.question-options input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.option-mark {
		width: 0.58rem;
		height: 0.58rem;
		flex: 0 0 auto;
		border: 1px solid var(--text-tertiary);
		border-radius: 50%;
	}

	.question-options label.selected .option-mark {
		border: 3px solid color-mix(in srgb, var(--course-color) 64%, var(--text-primary));
	}

	.question-options label.correct {
		color: var(--text-primary);
		font-weight: 700;
	}

	.question-options label.correct .option-mark {
		border-color: var(--accent);
	}

	.question-options label.incorrect .option-mark {
		border-color: var(--color-kanji);
	}

	.question-options label:focus-within {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	.question-actions {
		display: flex;
		min-height: 2.75rem;
		align-items: center;
		gap: 0.65rem;
		margin-top: 0.55rem;
	}

	.question-actions button {
		min-height: 2.2rem;
		padding: 0.4rem 0.7rem;
		border: 1px solid var(--border-color);
		border-radius: 2px;
		background: var(--bg-primary);
		color: var(--text-primary);
		font: inherit;
		font-size: 0.78rem;
		font-weight: 700;
		cursor: pointer;
	}

	.question-actions button:disabled {
		color: var(--text-tertiary);
		cursor: not-allowed;
	}

	.question-actions button:not(:disabled):hover {
		border-color: color-mix(in srgb, var(--course-color) 60%, var(--border-color));
	}

	.question-actions button:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 0.2rem;
	}

	.question-actions p,
	.question-rationale {
		margin: 0;
		font-size: 0.78rem;
		line-height: 1.4;
	}

	.question-actions p {
		color: var(--color-kanji);
		font-weight: 700;
	}

	.question-actions p.correct {
		color: var(--accent-dark);
	}

	.question-rationale {
		padding-top: 0.55rem;
		border-top: 1px solid var(--border-color);
		color: var(--text-secondary);
	}

	.course-footer {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 1rem;
		margin-top: auto;
		padding: 0.9rem 1rem;
	}

	.course-footer p {
		max-width: 48ch;
		margin: 0;
		color: var(--text-secondary);
		font-size: 0.84rem;
		line-height: 1.4;
	}

	.course-footer p span {
		display: block;
		margin-bottom: 0.22rem;
		color: var(--text-primary);
		font-weight: 720;
	}

	.course-footer nav {
		display: flex;
		align-items: center;
		gap: 1.5rem;
	}

	.course-footer a {
		position: relative;
		color: var(--text-secondary);
		font-size: 0.78rem;
		font-weight: 680;
		text-decoration: none;
	}

	.course-footer a::after {
		position: absolute;
		inset: -0.7rem -0.35rem;
		content: '';
	}

	.course-footer .lesson-link {
		color: color-mix(in srgb, var(--course-color) 60%, var(--text-primary));
	}

	.course-footer a:hover {
		text-decoration: underline;
		text-underline-offset: 0.2rem;
	}

	.course-footer a:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 0.25rem;
	}

	@media (max-width: 1180px) {
		.lesson-samples {
			grid-template-columns: 1fr;
		}

		.question-preview {
			border-top: 1px solid var(--border-color);
			border-left: 0;
		}
	}

	@media (max-width: 520px) {
		.course-header {
			min-height: 5.4rem;
			padding-inline: 0.85rem;
		}

		.course-glyph {
			font-size: 2.55rem;
		}

		.lesson-register {
			grid-template-columns: 1fr auto;
		}

		.lesson-register strong {
			grid-column: 1 / -1;
			grid-row: 2;
			text-align: left;
		}

		.lesson-register span:last-child {
			text-align: right;
		}

		th,
		td {
			padding-inline: 0.18rem;
		}

		thead th,
		tbody th {
			width: 2.7rem;
			font-size: 0.62rem;
		}

		.chart-symbol {
			font-size: 1rem;
		}

		.chart-reading {
			font-size: 0.7rem;
		}

		td small {
			display: none;
		}

		.course-footer {
			grid-template-columns: 1fr;
		}

		.course-footer nav {
			min-height: 2.2rem;
			justify-content: space-between;
		}
	}
</style>
