<script lang="ts">
	import { onMount } from 'svelte';
	import Header from '$lib/components/Header.svelte';
	import SaveToStudy from '$lib/components/SaveToStudy.svelte';
	import CourseActivity from '$lib/courses/CourseActivity.svelte';
	import CourseDialogue from '$lib/courses/CourseDialogue.svelte';
	import KanaChart from '$lib/courses/KanaChart.svelte';
	import { courseReadingColor } from '$lib/courses/catalog';
	import { isPassingStatus } from '$lib/courses/grading';
	import {
		emptyCourseProgress,
		loadCourseProgress,
		markLessonComplete,
		recordActivityAttempt,
		saveCourseProgress
	} from '$lib/courses/progress';
	import type { AnswerStatus, CourseProgress } from '$lib/courses/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const course = data.course;

	let scaffold = $state<'guided' | 'reading' | 'target'>('target');
	let transferSupportVisible = $state(false);
	let progress = $state<CourseProgress>(emptyCourseProgress());
	let loaded = $state(false);

	let showReading = $derived(scaffold !== 'target');
	let showTranslation = $derived(scaffold === 'guided');
	let activityStatuses = $derived(progress.lessons[data.lesson.id]?.activities ?? {});
	let allActivitiesPassed = $derived(
		data.lesson.activities.every((activity) =>
			isPassingStatus(activityStatuses[activity.id]?.status)
		)
	);
	let lessonCompleted = $derived(Boolean(progress.lessons[data.lesson.id]?.completedAt));
	let unitLessons = $derived(
		data.unit.lessonIds
			.map((lessonId) => course.lessons.find((lesson) => lesson.id === lessonId))
			.filter((lesson) => Boolean(lesson))
	);

	onMount(() => {
		progress = loadCourseProgress(window.localStorage, course.id);
		loaded = true;
	});

	function recordAttempt(activityId: string, status: AnswerStatus): void {
		progress = recordActivityAttempt(progress, data.lesson.id, activityId, status);
		saveCourseProgress(window.localStorage, progress, course.id);
	}

	function completeLesson(): void {
		if (!allActivitiesPassed) return;
		progress = markLessonComplete(progress, data.lesson.id);
		saveCourseProgress(window.localStorage, progress, course.id);
	}

	function lessonKindLabel(kind: string): string {
		if (kind === 'sound') return 'Sound lab';
		if (kind === 'script') return 'Script lab';
		if (kind === 'reader') return 'Reader';
		if (kind === 'mission') return 'Communicative mission';
		return 'Core lesson';
	}
</script>

<Header currentWord="" />

<main
	id="main-content"
	class="lesson-shell"
	style={'--course-reading-color: ' + courseReadingColor(course.language)}
>
	<aside class="lesson-rail" aria-label="Current unit lessons">
		<a class="course-back" href={data.basePath}>← Course map</a>
		<p class="rail-unit"><span>Unit {String(data.unit.sequence).padStart(2, '0')}</span>{data.unit.title}</p>
		<ol>
			{#each unitLessons as unitLesson}
				{#if unitLesson}
					<li class:current={unitLesson.id === data.lesson.id}>
						<a
							href={data.basePath + '/' + unitLesson.id}
							aria-current={unitLesson.id === data.lesson.id ? 'page' : undefined}
						>
							<span>{String(unitLesson.sequence).padStart(2, '0')}</span>
							{unitLesson.shortTitle}
						</a>
					</li>
				{/if}
			{/each}
		</ol>
	</aside>

	<article class="lesson">
		<header class="lesson-header">
			<div class="lesson-meta">
				<span>{lessonKindLabel(data.lesson.kind)}</span>
				<span>Lesson {data.lesson.sequence} of {course.lessons.length}</span>
				<span>{data.lesson.durationMinutes} min</span>
			</div>
			<h1>{data.lesson.title}</h1>
			<div class="can-do">
				<span>Can-do</span>
				<p>{data.lesson.canDo}</p>
			</div>
			<ul class="focus-list" aria-label="Lesson focus">
				{#each data.lesson.focus as focus}
					<li>{focus}</li>
				{/each}
			</ul>
		</header>

		<nav class="scaffold-lens" aria-label={course.languageName + ' support level'}>
			<div class="lens-copy">
				<span class="lens-mark" lang={course.htmlLanguage} aria-hidden="true">{course.glyph}</span>
				<div>
					<strong>Display support</strong>
					<small>Control reading and translation display.</small>
				</div>
			</div>
			<div class="lens-controls">
				<button
					type="button"
					class:active={scaffold === 'target'}
					aria-pressed={scaffold === 'target'}
					onclick={() => (scaffold = 'target')}
				>
					{course.languageName} only
				</button>
				<button
					type="button"
					class:active={scaffold === 'reading'}
					aria-pressed={scaffold === 'reading'}
					onclick={() => (scaffold = 'reading')}
				>
					+ {course.readingLabel.toLowerCase()}
				</button>
				<button
					type="button"
					class:active={scaffold === 'guided'}
					aria-pressed={scaffold === 'guided'}
					onclick={() => (scaffold = 'guided')}
				>
					+ meaning
				</button>
			</div>
		</nav>

		{#if data.lesson.scriptCharts?.length}
			<section class="lesson-section chart-section" aria-labelledby="charts-title">
				<div class="step">
					<span>00</span>
					<div>
						<p>Reference</p>
						<h2 id="charts-title">Sound and script reference</h2>
					</div>
				</div>
				<div class="chart-list">
					{#each data.lesson.scriptCharts as chart}
						<KanaChart {chart} language={course.htmlLanguage} />
					{/each}
				</div>
			</section>
		{/if}

		<section class="lesson-section encounter" aria-labelledby="encounter-title">
			<div class="step">
				<span>01</span>
				<div>
					<p>Initial example</p>
					<h2 id="encounter-title">Example text</h2>
				</div>
			</div>
			<CourseDialogue
				lines={data.lesson.scenario}
				{showReading}
				{showTranslation}
				language={course.htmlLanguage}
				speechLanguage={course.speechLanguage}
				languageName={course.languageName}
			/>
		</section>

		<section class="lesson-section" aria-labelledby="notice-title">
			<div class="step">
				<span>02</span>
				<div>
					<p>Notice</p>
					<h2 id="notice-title">Form and meaning</h2>
				</div>
			</div>
			<ul class="notice-list">
				{#each data.lesson.notice as notice}
					<li>{notice}</li>
				{/each}
			</ul>
		</section>

		<section class="lesson-section" aria-labelledby="explain-title">
			<div class="step">
				<span>03</span>
				<div>
					<p>Explain</p>
					<h2 id="explain-title">Explanation</h2>
				</div>
			</div>
			<div class="explanation">
				{#each data.lesson.explanation as paragraph}
					<p>{paragraph}</p>
				{/each}
			</div>
		</section>

		<section class="lesson-section" aria-labelledby="words-title">
			<div class="step">
				<span>04</span>
				<div>
					<p>Vocabulary</p>
					<h2 id="words-title">Dictionary references</h2>
				</div>
			</div>
			<div class="vocabulary-list">
				{#each data.lesson.vocabulary as vocabulary}
					<div class="vocabulary-row">
						<a
							class="vocabulary-word"
							href={'/' + encodeURIComponent(vocabulary.dictionaryAnchor || vocabulary.word)}
							lang={course.htmlLanguage}
						>
							<strong>{vocabulary.word}</strong>
							<span>{vocabulary.reading}</span>
						</a>
						<div class="vocabulary-meaning">
							<p>{vocabulary.meaning}</p>
							{#if vocabulary.note}<small>{vocabulary.note}</small>{/if}
						</div>
						<SaveToStudy
							word={vocabulary.dictionaryAnchor || vocabulary.word}
							language={course.studyLanguage}
							size="sm"
							showLabel
							context={{
								sentence: data.lesson.scenario[0].text,
								translation: data.lesson.scenario[0].translation
							}}
						/>
					</div>
				{/each}
			</div>
			<p class="study-note">
				Dictionary links work for everyone. Saving to spaced review requires a Kiokun account.
			</p>
		</section>

		<section class="lesson-section" aria-labelledby="practice-title">
			<div class="step">
				<span>05</span>
				<div>
					<p>Practice</p>
					<h2 id="practice-title">Retrieval and production</h2>
				</div>
			</div>
			<div class="activity-list">
				{#each data.lesson.activities as activity (activity.id)}
					<CourseActivity
						{activity}
						initialStatus={activityStatuses[activity.id]?.status}
						onAttempt={recordAttempt}
						language={course.htmlLanguage}
						speechLanguage={course.speechLanguage}
					/>
				{/each}
			</div>
		</section>

		<section class="lesson-section transfer" aria-labelledby="transfer-title">
			<div class="step">
				<span>06</span>
				<div>
					<p>Transfer</p>
					<h2 id="transfer-title">Reduced-support task</h2>
				</div>
			</div>
			<div class="transfer-card">
				<p>{data.lesson.transferPrompt}</p>
				<button
					type="button"
					class="support-toggle"
					aria-expanded={transferSupportVisible}
					onclick={() => (transferSupportVisible = !transferSupportVisible)}
				>
					{transferSupportVisible ? 'Hide support' : 'Show one support'}
				</button>
				{#if transferSupportVisible}
					<div class="transfer-support">{data.lesson.transferSupport}</div>
				{/if}
			</div>
		</section>

		<section class="completion" aria-labelledby="completion-title">
			<div>
				<p class="completion-label">Lesson outcome</p>
				<h2 id="completion-title">
					{lessonCompleted ? 'Lesson recorded as complete' : 'Lesson completion'}
				</h2>
				<p>
					{#if lessonCompleted}
						This lesson is complete on this device. Revisit it later with {course.languageName}-only support.
					{:else if allActivitiesPassed}
						Every required activity has a passing or explicitly self-checked result.
					{:else if loaded}
						Complete the checked tasks and save the open-response self-checks above.
					{:else}
						Loading lesson progress…
					{/if}
				</p>
			</div>
			<div class="completion-actions">
				<button
					type="button"
					class="complete-button"
					disabled={!allActivitiesPassed || lessonCompleted}
					onclick={completeLesson}
				>
					{lessonCompleted ? 'Lesson complete ✓' : 'Complete lesson'}
				</button>
				{#if lessonCompleted && data.nextLesson}
					<a class="next-button" href={data.basePath + '/' + data.nextLesson.id}>
						Next: {data.nextLesson.shortTitle} →
					</a>
				{:else if lessonCompleted}
					<a class="next-button" href={data.basePath}>Return to course map →</a>
				{/if}
			</div>
		</section>

		<nav class="lesson-pagination" aria-label="Lesson navigation">
			{#if data.previousLesson}
				<a class="previous" href={data.basePath + '/' + data.previousLesson.id}>
					<span>← Previous</span>
					<strong>{data.previousLesson.shortTitle}</strong>
				</a>
			{:else}
				<span></span>
			{/if}
			{#if data.nextLesson}
				<a class="next" href={data.basePath + '/' + data.nextLesson.id}>
					<span>Next →</span>
					<strong>{data.nextLesson.shortTitle}</strong>
				</a>
			{/if}
		</nav>
	</article>
</main>

<style>
	.lesson-shell {
		display: grid;
		grid-template-columns: minmax(11rem, 15rem) minmax(0, 51rem);
		gap: clamp(2rem, 6vw, 5rem);
		width: min(100%, 75rem);
		margin: 0 auto;
		padding: clamp(1.25rem, 4vw, 2.5rem) clamp(1rem, 3vw, 2rem) 5rem;
	}

	.lesson-rail {
		position: sticky;
		top: calc(var(--kiokun-header-height, 3.75rem) + 1.5rem);
		align-self: start;
	}

	.course-back {
		display: inline-block;
		margin-bottom: 1.5rem;
		color: var(--text-secondary);
		font-size: 0.8rem;
		font-weight: 680;
		text-decoration: none;
	}

	.rail-unit {
		margin: 0 0 0.75rem;
		font-size: 0.86rem;
		font-weight: 720;
		line-height: 1.35;
	}

	.rail-unit span {
		display: block;
		margin-bottom: 0.25rem;
		color: var(--accent);
		font-family: var(--font-mono);
		font-size: 0.67rem;
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}

	.lesson-rail ol {
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--border-color);
		list-style: none;
	}

	.lesson-rail li {
		border-bottom: 1px solid var(--border-color);
	}

	.lesson-rail li.current {
		background: var(--accent-light);
	}

	.lesson-rail a:not(.course-back) {
		display: grid;
		grid-template-columns: 1.7rem minmax(0, 1fr);
		gap: 0.45rem;
		padding: 0.65rem 0.35rem;
		color: var(--text-secondary);
		font-size: 0.78rem;
		line-height: 1.35;
		text-decoration: none;
	}

	.lesson-rail li.current a {
		color: var(--text-primary);
		font-weight: 700;
	}

	.lesson-rail a span {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.68rem;
	}

	.lesson {
		min-width: 0;
	}

	.lesson-header {
		padding-bottom: clamp(2rem, 6vw, 4rem);
	}

	.lesson-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem 1rem;
		margin-bottom: 1rem;
		color: var(--text-tertiary);
		font-size: 0.7rem;
		font-weight: 720;
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}

	.lesson-meta span:first-child {
		color: var(--accent);
	}

	h1 {
		max-width: 16ch;
		margin: 0;
		font-size: clamp(2.35rem, 6vw, 4.8rem);
		font-weight: 760;
		line-height: 0.98;
		letter-spacing: -0.06em;
	}

	.can-do {
		display: grid;
		grid-template-columns: 4.5rem minmax(0, 1fr);
		gap: 1rem;
		max-width: 46rem;
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border-color);
	}

	.can-do span {
		color: var(--accent);
		font-size: 0.7rem;
		font-weight: 780;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.can-do p {
		margin: 0;
		color: var(--text-secondary);
		font-size: 1rem;
	}

	.focus-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin: 1.2rem 0 0;
		padding: 0;
		list-style: none;
	}

	.focus-list li {
		padding: 0.25rem 0.5rem;
		border: 1px solid var(--border-color);
		color: var(--text-tertiary);
		font-size: 0.72rem;
	}

	.scaffold-lens {
		position: sticky;
		z-index: 20;
		top: calc(var(--kiokun-header-height, 3.75rem) + 0.6rem);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 2.5rem;
		padding: 0.7rem;
		border: 1px solid var(--border-color);
		border-color: color-mix(in srgb, var(--accent) 35%, var(--border-color));
		background: color-mix(in srgb, var(--bg-secondary) 94%, transparent);
		box-shadow: 0 8px 24px var(--shadow);
		backdrop-filter: blur(12px);
	}

	.lens-copy {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 0.7rem;
	}

	.lens-mark {
		display: grid;
		width: 2.2rem;
		height: 2.2rem;
		flex: 0 0 auto;
		place-items: center;
		border: 1px solid var(--accent);
		color: var(--accent);
		font-family: var(--font-cjk);
		font-weight: 720;
	}

	.lens-copy strong,
	.lens-copy small {
		display: block;
	}

	.lens-copy strong {
		font-size: 0.82rem;
	}

	.lens-copy small {
		color: var(--text-tertiary);
		font-size: 0.68rem;
	}

	.lens-controls {
		display: flex;
		flex: 0 0 auto;
		border: 1px solid var(--border-color);
	}

	.lens-controls button {
		min-height: 2.4rem;
		padding: 0.4rem 0.65rem;
		border: 0;
		border-right: 1px solid var(--border-color);
		background: var(--bg-primary);
		color: var(--text-secondary);
		font-size: 0.7rem;
		font-weight: 680;
		cursor: pointer;
	}

	.lens-controls button:last-child {
		border-right: 0;
	}

	.lens-controls button.active {
		background: var(--accent);
		color: var(--accent-contrast);
	}

	.lesson-section {
		padding: clamp(2rem, 6vw, 4rem) 0;
		border-top: 1px solid var(--border-color);
	}

	.lesson-section.encounter {
		border-top: 0;
	}

	.step {
		display: grid;
		grid-template-columns: 2.5rem minmax(0, 1fr);
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.step > span {
		padding-top: 0.25rem;
		color: var(--accent);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		font-weight: 720;
	}

	.step p {
		margin: 0 0 0.3rem;
		color: var(--text-tertiary);
		font-size: 0.68rem;
		font-weight: 760;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.step h2 {
		max-width: 23ch;
		margin: 0;
		font-size: clamp(1.45rem, 3.2vw, 2.25rem);
		line-height: 1.1;
		letter-spacing: -0.04em;
	}

	.notice-list {
		display: grid;
		gap: 0;
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--border-color);
		list-style: none;
	}

	.notice-list li {
		position: relative;
		padding: 1rem 0 1rem 2.5rem;
		border-bottom: 1px solid var(--border-color);
		color: var(--text-secondary);
	}

	.notice-list li::before {
		position: absolute;
		top: 1.25rem;
		left: 0;
		color: var(--accent);
		content: '↳';
		font-weight: 760;
	}

	.explanation {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1px;
		border: 1px solid var(--border-color);
		background: var(--border-color);
	}

	.chart-list {
		display: grid;
		min-width: 0;
		max-width: 100%;
		gap: 1rem;
	}

	.explanation p {
		margin: 0;
		padding: clamp(1rem, 3vw, 1.5rem);
		background: var(--bg-secondary);
		color: var(--text-secondary);
	}

	.vocabulary-list {
		border-top: 1px solid var(--border-color);
	}

	.vocabulary-row {
		display: grid;
		grid-template-columns: minmax(7rem, 0.8fr) minmax(10rem, 1.5fr) auto;
		gap: 1rem;
		align-items: center;
		min-height: 4.8rem;
		padding: 0.65rem 0;
		border-bottom: 1px solid var(--border-color);
	}

	.vocabulary-word {
		color: var(--text-primary);
		font-family: var(--font-cjk);
		text-decoration: none;
	}

	.vocabulary-word strong,
	.vocabulary-word span {
		display: block;
	}

	.vocabulary-word strong {
		font-size: 1.12rem;
	}

	.vocabulary-word span {
		color: var(--course-reading-color);
		font-size: 0.75rem;
	}

	.vocabulary-meaning p,
	.vocabulary-meaning small {
		display: block;
		margin: 0;
	}

	.vocabulary-meaning p {
		color: var(--text-secondary);
		font-size: 0.88rem;
	}

	.vocabulary-meaning small {
		margin-top: 0.15rem;
		color: var(--text-muted);
		font-size: 0.7rem;
	}

	.study-note {
		margin: 0.7rem 0 0;
		color: var(--text-muted);
		font-size: 0.72rem;
	}

	.activity-list {
		display: grid;
		gap: 0.9rem;
	}

	.transfer-card {
		padding: clamp(1rem, 3vw, 1.5rem);
		border: 1px solid var(--border-color);
		border-top: 3px solid var(--accent);
		background: var(--bg-secondary);
	}

	.transfer-card > p {
		max-width: 42rem;
		margin: 0;
		font-size: 1.05rem;
		font-weight: 630;
	}

	.support-toggle {
		min-height: 2.75rem;
		margin-top: 1rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border-color);
		background: var(--bg-primary);
		color: var(--text-primary);
		font-weight: 650;
		cursor: pointer;
	}

	.transfer-support {
		margin-top: 0.75rem;
		padding: 0.75rem;
		border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border-color));
		background: var(--accent-light);
		color: var(--text-secondary);
		font-size: 0.88rem;
	}

	.completion {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 2rem;
		align-items: center;
		margin-top: 1rem;
		padding: clamp(1.25rem, 4vw, 2rem);
		border: 1px solid var(--border-color);
		background: var(--bg-secondary);
	}

	.completion-label {
		margin: 0 0 0.3rem;
		color: var(--accent);
		font-size: 0.7rem;
		font-weight: 760;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.completion h2 {
		margin: 0;
		font-size: clamp(1.35rem, 3vw, 2rem);
		letter-spacing: -0.035em;
	}

	.completion p:not(.completion-label) {
		max-width: 40rem;
		margin: 0.45rem 0 0;
		color: var(--text-secondary);
		font-size: 0.86rem;
	}

	.completion-actions {
		display: grid;
		gap: 0.55rem;
		justify-items: stretch;
	}

	.complete-button,
	.next-button {
		display: inline-flex;
		min-height: 3rem;
		align-items: center;
		justify-content: center;
		padding: 0.6rem 0.9rem;
		border: 1px solid var(--accent);
		border-radius: var(--radius-sm);
		font-weight: 700;
		text-decoration: none;
	}

	.complete-button {
		background: var(--accent);
		color: var(--accent-contrast);
		cursor: pointer;
	}

	.complete-button:disabled {
		border-color: var(--border-color);
		background: var(--bg-tertiary);
		color: var(--text-muted);
		cursor: not-allowed;
	}

	.next-button {
		background: transparent;
		color: var(--accent);
	}

	.lesson-pagination {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
		margin-top: 2rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border-color);
	}

	.lesson-pagination a {
		display: block;
		padding: 0.7rem 0;
		color: var(--text-primary);
		text-decoration: none;
	}

	.lesson-pagination a.next {
		text-align: right;
	}

	.lesson-pagination span,
	.lesson-pagination strong {
		display: block;
	}

	.lesson-pagination span {
		color: var(--text-tertiary);
		font-size: 0.7rem;
		text-transform: uppercase;
	}

	.lesson-pagination strong {
		margin-top: 0.2rem;
		font-size: 0.9rem;
	}

	button:focus-visible,
	a:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 3px;
	}

	@media (max-width: 850px) {
		.lesson-shell {
			grid-template-columns: minmax(0, 1fr);
		}

		.lesson-rail {
			position: static;
		}

		.lesson-rail ol {
			display: flex;
			overflow-x: auto;
			scrollbar-width: thin;
		}

		.lesson-rail li {
			min-width: 9rem;
			border-right: 1px solid var(--border-color);
		}

		.lesson-rail li.current {
			box-shadow: none;
		}
	}

	@media (max-width: 650px) {
		.scaffold-lens {
			align-items: stretch;
			flex-direction: column;
		}

		.lens-controls {
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.lens-controls button {
			padding-inline: 0.3rem;
		}

		.explanation {
			grid-template-columns: 1fr;
		}

		.vocabulary-row {
			grid-template-columns: minmax(6rem, 0.8fr) minmax(0, 1.2fr);
		}

		.vocabulary-row :global(.relative) {
			grid-column: 1 / -1;
		}

		.completion {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 430px) {
		.lesson-shell {
			padding-inline: 0.8rem;
		}

		h1 {
			font-size: clamp(2.35rem, 13vw, 3.4rem);
		}

		.can-do {
			grid-template-columns: 1fr;
			gap: 0.35rem;
		}

		.step {
			grid-template-columns: 2rem minmax(0, 1fr);
			gap: 0.6rem;
		}

		.vocabulary-row {
			gap: 0.6rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.scaffold-lens {
			backdrop-filter: none;
		}
	}
</style>
