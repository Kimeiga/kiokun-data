<script lang="ts">
	import { onMount } from 'svelte';
	import Header from '$lib/components/Header.svelte';
	import { courseReadingColor } from '$lib/courses/catalog';
	import {
		completedLessonIds,
		emptyCourseProgress,
		loadCourseProgress
	} from '$lib/courses/progress';
	import type { CourseProgress } from '$lib/courses/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const course = data.course;
	const basePath = data.basePath;
	const totalMinutes = course.lessons.reduce((sum, lesson) => sum + lesson.durationMinutes, 0);
	const missionCount = course.lessons.filter((lesson) => lesson.kind === 'mission').length;

	let progress = $state<CourseProgress>(emptyCourseProgress());
	let loaded = $state(false);
	let completed = $derived(completedLessonIds(progress));
	let completedCount = $derived(completed.size);
	let nextLesson = $derived(
		course.lessons.find((lesson) => !completed.has(lesson.id)) ?? course.lessons[course.lessons.length - 1]
	);

	onMount(() => {
		progress = loadCourseProgress(window.localStorage, course.id);
		loaded = true;
	});

	function unitProgress(lessonIds: string[]): number {
		return lessonIds.filter((lessonId) => completed.has(lessonId)).length;
	}

	function kindLabel(kind: string): string {
		if (kind === 'sound') return 'Sound';
		if (kind === 'script') return 'Script';
		if (kind === 'reader') return 'Reader';
		if (kind === 'mission') return 'Mission';
		return 'Lesson';
	}
</script>

<Header currentWord="" />

<main
	id="main-content"
	class="course-page"
	style={'--course-reading-color: ' + courseReadingColor(course.language)}
>
	<section class="course-hero">
		<div class="hero-index" aria-hidden="true">
			<span lang={course.htmlLanguage}>{course.nativeName}</span>
			<strong>A1</strong>
		</div>
		<div class="hero-copy">
			<p class="eyebrow">{course.languageName} · {course.level}</p>
			<h1>{course.title}</h1>
			<p class="dek">{course.description}</p>
			<div class="hero-actions">
				<a class="primary-cta" href={basePath + '/' + nextLesson.id}>
					{completedCount > 0 ? 'Continue course' : 'Start course'}
					<span aria-hidden="true">→</span>
				</a>
				<span class="progress-copy" aria-live="polite">
					{#if loaded}
						{completedCount} of {course.lessons.length} lessons complete
					{:else}
						Progress stays on this device
					{/if}
				</span>
			</div>
		</div>
		<dl class="course-facts">
			<div>
				<dt>Lessons</dt>
				<dd>{course.lessons.length}</dd>
			</div>
			<div>
				<dt>Missions</dt>
				<dd>{missionCount}</dd>
			</div>
			<div>
				<dt>Core time</dt>
				<dd>{Math.round(totalMinutes / 60)}h</dd>
			</div>
		</dl>
	</section>

	<section class="course-thesis" aria-labelledby="course-thesis-title">
		<p class="section-number">Course method</p>
		<h2 id="course-thesis-title">Lesson structure</h2>
		<p>{course.designPromise}</p>
		<ol class="learning-loop">
			<li><span>Example</span><small>Initial {course.languageName} text or dialogue.</small></li>
			<li><span>Analysis</span><small>Relevant forms and contrasts.</small></li>
			<li><span>Explanation</span><small>Grammar, script, or sound rule.</small></li>
			<li><span>Practice</span><small>Closed retrieval and open production.</small></li>
			<li><span>Transfer</span><small>New wording with reduced support.</small></li>
		</ol>
	</section>

	<section class="units" aria-labelledby="units-title">
		<div class="section-heading">
			<div>
				<p class="section-number">Course map</p>
				<h2 id="units-title">Units and lessons</h2>
			</div>
			<p>Every lesson remains open. The sequence is recommended, not locked.</p>
		</div>

		<div class="unit-list">
			{#each course.units as unit}
				<article class="unit-card">
					<header class="unit-header">
						<div class="unit-number">{String(unit.sequence).padStart(2, '0')}</div>
						<div>
							<p class="native-title" lang={course.htmlLanguage}>{unit.nativeTitle}</p>
							<h3>{unit.title}</h3>
							<p>{unit.strapline}</p>
						</div>
						<div class="unit-progress">
							<strong>{unitProgress(unit.lessonIds)}/{unit.lessonIds.length}</strong>
							<span>complete</span>
						</div>
					</header>

					<div class="can-do">
						<span>Can-do</span>
						<p>{unit.canDo}</p>
					</div>

					<ol class="lesson-list">
						{#each unit.lessonIds as lessonId}
							{@const lesson = course.lessons.find((candidate) => candidate.id === lessonId)}
							{#if lesson}
								<li class:complete={completed.has(lesson.id)} class:mission={lesson.kind === 'mission'}>
									<a href={basePath + '/' + lesson.id}>
										<span class="lesson-status" aria-hidden="true">
											{completed.has(lesson.id) ? '✓' : String(lesson.sequence).padStart(2, '0')}
										</span>
										<span class="lesson-name">
											<strong>{lesson.shortTitle}</strong>
											<small>{kindLabel(lesson.kind)} · {lesson.durationMinutes} min</small>
										</span>
										<span class="lesson-arrow" aria-hidden="true">→</span>
									</a>
								</li>
							{/if}
						{/each}
					</ol>

					<footer>
						<span>Outcome</span>
						<p>{unit.mission}</p>
					</footer>
				</article>
			{/each}
		</div>
	</section>

	<section class="course-notes">
		<div>
			<p class="section-number">Kiokun integration</p>
			<h2>Dictionary and study integration</h2>
		</div>
		<div class="notes-grid">
			<p>
				Every taught word opens its Kiokun entry, preserving readings, exact meanings,
				examples, characters, and cross-language connections.
			</p>
			<p>
				Signed-in learners can save vocabulary and its lesson sentence into the existing
				spaced-review queue. Open speaking and writing are labeled as self-checked, never
				pretended to be machine-certified.
			</p>
			<p>
				Closed answers use explicit accepted targets and fail visibly when input is empty or
				mismatched. Completion measures attempts and outcomes—not points or streaks.
			</p>
		</div>
	</section>
</main>

<style>
	.course-page {
		width: min(100%, 76rem);
		margin: 0 auto;
		padding: clamp(1.25rem, 4vw, 3rem) clamp(1rem, 3vw, 2rem) 5rem;
	}

	.course-hero {
		display: grid;
		grid-template-columns: 8.5rem minmax(0, 1fr);
		gap: clamp(1.25rem, 4vw, 3.5rem);
		align-items: stretch;
		padding-bottom: clamp(2rem, 6vw, 4.5rem);
		border-bottom: 1px solid var(--border-color);
	}

	.hero-index {
		display: flex;
		min-height: 18rem;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 0.75rem;
		border: 1px solid var(--border-color);
		border-top: 5px solid var(--accent);
		background: var(--bg-secondary);
	}

	.hero-index span {
		font-family: var(--font-cjk);
		font-size: clamp(1.6rem, 3vw, 2.2rem);
		font-weight: 680;
		letter-spacing: 0.18em;
		writing-mode: vertical-rl;
	}

	.hero-index strong {
		color: var(--accent);
		font-size: 1.7rem;
		letter-spacing: -0.04em;
	}

	.hero-copy {
		max-width: 47rem;
		align-self: center;
	}

	.eyebrow,
	.section-number {
		margin: 0 0 0.65rem;
		color: var(--accent);
		font-size: 0.73rem;
		font-weight: 780;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	h1 {
		max-width: 13ch;
		margin: 0;
		font-size: clamp(2.55rem, 7vw, 5.3rem);
		font-weight: 760;
		line-height: 0.96;
		letter-spacing: -0.065em;
	}

	.dek {
		max-width: 43rem;
		margin: 1.5rem 0 0;
		color: var(--text-secondary);
		font-size: clamp(1.05rem, 2.1vw, 1.28rem);
		line-height: 1.55;
	}

	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1rem;
		margin-top: 1.6rem;
	}

	.primary-cta {
		display: inline-flex;
		min-height: 3rem;
		align-items: center;
		gap: 1.4rem;
		padding: 0.65rem 0.9rem;
		border: 1px solid var(--accent);
		background: var(--accent);
		color: var(--accent-contrast);
		font-weight: 720;
		text-decoration: none;
	}

	.progress-copy {
		color: var(--text-tertiary);
		font-size: 0.82rem;
	}

	.course-facts {
		grid-column: 2;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		max-width: 35rem;
		gap: 1px;
		margin: 0;
		border: 1px solid var(--border-color);
		background: var(--border-color);
	}

	.course-facts div {
		padding: 0.8rem;
		background: var(--bg-secondary);
	}

	.course-facts dt {
		color: var(--text-tertiary);
		font-size: 0.67rem;
		font-weight: 720;
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}

	.course-facts dd {
		margin: 0.2rem 0 0;
		font-size: 1.45rem;
		font-weight: 740;
	}

	.course-thesis,
	.units,
	.course-notes {
		padding-top: clamp(2.5rem, 7vw, 5rem);
	}

	.course-thesis h2,
	.section-heading h2,
	.course-notes h2 {
		max-width: 20ch;
		margin: 0;
		font-size: clamp(1.8rem, 4vw, 3rem);
		line-height: 1.08;
		letter-spacing: -0.045em;
	}

	.course-thesis > p:not(.section-number) {
		max-width: 48rem;
		margin: 1rem 0 0;
		color: var(--text-secondary);
		font-size: 1.03rem;
	}

	.learning-loop {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		margin: 2rem 0 0;
		padding: 0;
		border-top: 1px solid var(--border-color);
		list-style: none;
	}

	.learning-loop li {
		position: relative;
		padding: 1rem 1rem 1rem 0;
	}

	.learning-loop li::before {
		position: absolute;
		top: -0.28rem;
		left: 0;
		width: 0.5rem;
		height: 0.5rem;
		border: 2px solid var(--bg-primary);
		border-radius: 50%;
		background: var(--accent);
		content: '';
	}

	.learning-loop span,
	.learning-loop small {
		display: block;
	}

	.learning-loop span {
		font-weight: 720;
	}

	.learning-loop small {
		margin-top: 0.3rem;
		color: var(--text-tertiary);
		font-size: 0.78rem;
		line-height: 1.4;
	}

	.section-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 2rem;
		margin-bottom: 1.5rem;
	}

	.section-heading > p {
		max-width: 24rem;
		margin: 0;
		color: var(--text-tertiary);
		font-size: 0.88rem;
	}

	.unit-list {
		display: grid;
		gap: 1.25rem;
	}

	.unit-card {
		border: 1px solid var(--border-color);
		background: var(--bg-secondary);
	}

	.unit-header {
		display: grid;
		grid-template-columns: 3rem minmax(0, 1fr) auto;
		gap: 1rem;
		align-items: start;
		padding: clamp(1rem, 3vw, 1.5rem);
		border-bottom: 1px solid var(--border-color);
	}

	.unit-number {
		color: var(--accent);
		font-family: var(--font-mono);
		font-size: 0.8rem;
		font-weight: 720;
	}

	.native-title {
		margin: 0 0 0.2rem;
		color: var(--course-reading-color);
		font-family: var(--font-cjk);
		font-size: 0.82rem;
		font-weight: 620;
		letter-spacing: 0.08em;
	}

	.unit-header h3 {
		margin: 0;
		font-size: clamp(1.25rem, 2.5vw, 1.65rem);
		letter-spacing: -0.025em;
	}

	.unit-header p:not(.native-title) {
		max-width: 43rem;
		margin: 0.4rem 0 0;
		color: var(--text-secondary);
		font-size: 0.9rem;
	}

	.unit-progress {
		min-width: 4.5rem;
		text-align: right;
	}

	.unit-progress strong,
	.unit-progress span {
		display: block;
	}

	.unit-progress strong {
		font-size: 1.1rem;
	}

	.unit-progress span {
		color: var(--text-muted);
		font-size: 0.68rem;
		text-transform: uppercase;
	}

	.can-do {
		display: grid;
		grid-template-columns: 6rem minmax(0, 1fr);
		gap: 1rem;
		padding: 0.85rem clamp(1rem, 3vw, 1.5rem);
		border-bottom: 1px solid var(--border-color);
		background: var(--bg-primary);
	}

	.can-do span,
	.unit-card footer span {
		color: var(--text-tertiary);
		font-size: 0.68rem;
		font-weight: 760;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.can-do p,
	.unit-card footer p {
		margin: 0;
		color: var(--text-secondary);
		font-size: 0.86rem;
	}

	.lesson-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.lesson-list li + li {
		border-top: 1px solid var(--border-color);
	}

	.lesson-list li.mission {
		background: color-mix(in srgb, var(--accent-light) 30%, transparent);
	}

	.lesson-list a {
		display: grid;
		grid-template-columns: 2.3rem minmax(0, 1fr) auto;
		gap: 0.8rem;
		align-items: center;
		min-height: 4rem;
		padding: 0.6rem clamp(1rem, 3vw, 1.5rem);
		color: var(--text-primary);
		text-decoration: none;
		transition: background-color 130ms ease;
	}

	.lesson-list a:hover {
		background: var(--surface-hover);
	}

	.lesson-status {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.75rem;
	}

	.complete .lesson-status {
		color: var(--accent);
		font-size: 1rem;
	}

	.lesson-name strong,
	.lesson-name small {
		display: block;
	}

	.lesson-name strong {
		font-size: 0.95rem;
	}

	.lesson-name small {
		margin-top: 0.1rem;
		color: var(--text-tertiary);
		font-size: 0.72rem;
	}

	.lesson-arrow {
		color: var(--text-muted);
	}

	.unit-card footer {
		display: grid;
		grid-template-columns: 6rem minmax(0, 1fr);
		gap: 1rem;
		padding: 0.85rem clamp(1rem, 3vw, 1.5rem);
		border-top: 1px solid var(--border-color);
	}

	.course-notes {
		display: grid;
		grid-template-columns: minmax(14rem, 0.8fr) minmax(0, 1.2fr);
		gap: clamp(2rem, 6vw, 5rem);
	}

	.notes-grid {
		display: grid;
		gap: 0;
		border-top: 1px solid var(--border-color);
	}

	.notes-grid p {
		margin: 0;
		padding: 1rem 0;
		border-bottom: 1px solid var(--border-color);
		color: var(--text-secondary);
		font-size: 0.93rem;
	}

	a:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 3px;
	}

	@media (max-width: 720px) {
		.course-hero {
			grid-template-columns: 4.5rem minmax(0, 1fr);
			gap: 1rem;
		}

		.hero-index {
			min-height: 15rem;
		}

		.hero-index span {
			font-size: 1.4rem;
		}

		.course-facts {
			grid-column: 1 / -1;
			max-width: none;
		}

		.learning-loop {
			grid-template-columns: 1fr;
			border-top: 0;
		}

		.learning-loop li {
			padding: 0 0 1.25rem 1rem;
			border-left: 1px solid var(--border-color);
		}

		.learning-loop li::before {
			top: 0.25rem;
			left: -0.28rem;
		}

		.section-heading,
		.course-notes {
			display: grid;
			grid-template-columns: 1fr;
		}

		.unit-header {
			grid-template-columns: 2.2rem minmax(0, 1fr);
		}

		.unit-progress {
			grid-column: 2;
			text-align: left;
		}
	}

	@media (max-width: 430px) {
		.course-page {
			padding-inline: 0.8rem;
		}

		.course-hero {
			grid-template-columns: 1fr;
		}

		.hero-index {
			display: grid;
			min-height: 0;
			grid-template-columns: 1fr auto;
			border-top-width: 3px;
		}

		.hero-index span {
			letter-spacing: 0.08em;
			writing-mode: horizontal-tb;
		}

		h1 {
			font-size: clamp(2.5rem, 14vw, 3.6rem);
		}

		.course-facts {
			grid-column: 1;
		}

		.can-do,
		.unit-card footer {
			grid-template-columns: 1fr;
			gap: 0.3rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.lesson-list a {
			transition: none;
		}
	}
</style>
