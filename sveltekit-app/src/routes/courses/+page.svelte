<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import { courseReadingColor } from '$lib/courses/catalog';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const totalLessons = data.courses.reduce((sum, course) => sum + course.lessonCount, 0);
</script>

<Header currentWord="" />

<main id="main-content" class="courses-page">
	<section class="catalog-intro" aria-labelledby="courses-title">
		<div class="intro-copy">
			<h1 id="courses-title">Language courses</h1>
			<p>
				Choose Japanese, Mandarin, Cantonese, or Korean. Each course begins with its
				writing or sound system before moving into everyday exchanges, retrieval practice,
				original responses, and reduced-support missions.
			</p>
			<p class="catalog-summary">
				<span>{data.courses.length} courses</span>
				<span>{totalLessons} lessons</span>
				<span>Launchpad–A1</span>
			</p>
		</div>

		<ul class="script-register" aria-label="Available languages">
			{#each data.courses as course}
				<li style={'--course-color: ' + courseReadingColor(course.language)}>
					<span class="register-glyph" lang={course.htmlLanguage} aria-hidden="true">
						{course.glyph}
					</span>
					<span>
						<strong>{course.languageName}</strong>
						<small lang={course.htmlLanguage}>{course.nativeName}</small>
					</span>
				</li>
			{/each}
		</ul>
	</section>

	<section class="catalog" aria-labelledby="catalog-title">
		<div class="section-bar">
			<h2 id="catalog-title">Select a course</h2>
			<span>All lessons are available in sequence or individually.</span>
		</div>

		<ol class="course-list">
			{#each data.courses as course}
				<li style={'--course-color: ' + courseReadingColor(course.language)}>
					<a href={'/courses/' + course.slug} aria-label={'View ' + course.languageName + ' course'}>
						<span class="course-script">
							<strong lang={course.htmlLanguage}>{course.glyph}</strong>
							<small lang={course.htmlLanguage}>{course.nativeName}</small>
						</span>

						<span class="course-overview">
							<span class="course-label">{course.languageName} · {course.level}</span>
							<h3>{course.title}</h3>
							<span class="course-description">{course.description}</span>
							<span class="course-facts">
								<span><strong>{course.lessonCount}</strong> lessons</span>
								<span><strong>{course.missionCount}</strong> missions</span>
								<span><strong>{Math.round(course.totalMinutes / 60)}h</strong> core time</span>
							</span>
						</span>

						<span class="course-foundation">
							<small>Starts with</small>
							<strong>{course.foundation.title}</strong>
							<span>{course.foundation.strapline}</span>
						</span>

						<span class="course-action">
							<span>View course</span>
							<svg
								class="course-arrow"
								aria-hidden="true"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="M5 12h14M13 6l6 6-6 6" />
							</svg>
						</span>
					</a>
				</li>
			{/each}
		</ol>
	</section>

	<section class="method" aria-labelledby="method-title">
		<div class="method-heading">
			<h2 id="method-title">A consistent lesson sequence</h2>
			<p>
				The language changes; the learning sequence does not. This makes expectations clear
				when moving between courses.
			</p>
		</div>
		<ol class="method-steps">
			<li>
				<strong>Script and sound</strong>
				<span>Learn the relevant writing and pronunciation system first.</span>
			</li>
			<li>
				<strong>Examples and analysis</strong>
				<span>Inspect target forms in short dialogues and explanations.</span>
			</li>
			<li>
				<strong>Retrieval and production</strong>
				<span>Answer constrained checks, then write or speak an original response.</span>
			</li>
			<li>
				<strong>Transfer</strong>
				<span>Use the same language in a new prompt with less support.</span>
			</li>
		</ol>
	</section>

	<section class="integration" aria-labelledby="integration-title">
		<h2 id="integration-title">Kiokun integration</h2>
		<div class="integration-copy">
			<p>
				Taught words link to their Kiokun dictionary entries, including readings, meanings,
				examples, characters, and cross-language connections.
			</p>
			<p>
				Course progress stays on the current device. Saved vocabulary can enter the existing
				spaced-review workflow.
			</p>
		</div>
	</section>
</main>

<style>
	.courses-page {
		width: min(100%, 76rem);
		margin: 0 auto;
		padding: clamp(1.5rem, 4vw, 3.5rem) clamp(1rem, 3vw, 2rem) 5rem;
	}

	.catalog-intro {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(18rem, 24rem);
		gap: clamp(2rem, 7vw, 6rem);
		align-items: end;
		padding-bottom: clamp(2rem, 6vw, 4rem);
		border-bottom: 1px solid var(--border-color);
	}

	.intro-copy {
		max-width: 47rem;
	}

	h1 {
		max-width: 12ch;
		margin: 0;
		font-size: clamp(2.8rem, 7vw, 5.5rem);
		font-weight: 770;
		line-height: 0.98;
		letter-spacing: -0.04em;
	}

	.intro-copy > p:not(.catalog-summary) {
		max-width: 66ch;
		margin: 1.4rem 0 0;
		color: var(--text-secondary);
		font-size: clamp(1rem, 2vw, 1.16rem);
		line-height: 1.6;
	}

	.catalog-summary {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1rem;
		margin: 1.35rem 0 0;
		color: var(--text-tertiary);
		font-size: 0.82rem;
		font-variant-numeric: tabular-nums;
	}

	.catalog-summary span + span::before {
		margin-right: 1rem;
		color: var(--border-color);
		content: '/';
	}

	.script-register {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		margin: 0;
		padding: 0;
		border-inline-end: 1px solid var(--border-color);
		border-block-end: 1px solid var(--border-color);
		list-style: none;
	}

	.script-register li {
		display: flex;
		min-width: 0;
		min-height: 5.5rem;
		align-items: center;
		gap: 0.75rem;
		padding: 0.85rem;
		border-inline-start: 1px solid var(--border-color);
		border-block-start: 1px solid var(--border-color);
		background: var(--bg-secondary);
	}

	.register-glyph {
		color: var(--course-color);
		font-family: var(--font-cjk);
		font-size: 2.25rem;
		font-weight: 720;
		line-height: 1;
	}

	.script-register strong,
	.script-register small {
		display: block;
	}

	.script-register strong {
		font-size: 0.86rem;
	}

	.script-register small {
		margin-top: 0.15rem;
		color: var(--text-tertiary);
		font-family: var(--font-cjk);
		font-size: 0.75rem;
	}

	.catalog,
	.method,
	.integration {
		padding-top: clamp(2.75rem, 7vw, 5rem);
	}

	.section-bar {
		display: flex;
		min-height: 2.25rem;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.45rem 0.75rem;
		background: var(--section-bar-bg);
		color: var(--section-bar-text);
	}

	.section-bar h2 {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 700;
	}

	.section-bar span {
		color: color-mix(in srgb, var(--section-bar-text) 75%, transparent);
		font-size: 0.75rem;
	}

	.course-list {
		margin: 0;
		padding: 0;
		border: 1px solid var(--border-color);
		border-top: 0;
		list-style: none;
	}

	.course-list > li + li {
		border-top: 1px solid var(--border-color);
	}

	.course-list a {
		display: grid;
		grid-template-columns: 7rem minmax(17rem, 1.15fr) minmax(14rem, 0.85fr) 9rem;
		min-height: 13.5rem;
		color: var(--text-primary);
		text-decoration: none;
		transition: background-color 130ms ease;
	}

	.course-list a:hover {
		background: var(--surface-hover);
	}

	.course-list a:focus-visible {
		position: relative;
		z-index: 1;
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	.course-script,
	.course-overview,
	.course-foundation,
	.course-action {
		display: flex;
		min-width: 0;
		flex-direction: column;
		justify-content: center;
		padding: clamp(1rem, 2.5vw, 1.5rem);
	}

	.course-script {
		align-items: center;
		gap: 0.55rem;
		border-right: 1px solid var(--border-color);
		text-align: center;
	}

	.course-script strong {
		color: var(--course-color);
		font-family: var(--font-cjk);
		font-size: clamp(2.8rem, 5vw, 4rem);
		line-height: 1;
	}

	.course-script small {
		color: var(--text-tertiary);
		font-family: var(--font-cjk);
		font-size: 0.75rem;
	}

	.course-label,
	.course-foundation small {
		color: color-mix(in srgb, var(--course-color) 72%, var(--text-primary));
		font-size: 0.69rem;
		font-weight: 750;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.course-overview h3 {
		margin: 0.45rem 0 0;
		font-size: clamp(1.25rem, 2.2vw, 1.65rem);
		line-height: 1.14;
		letter-spacing: -0.02em;
	}

	.course-description {
		margin-top: 0.65rem;
		color: var(--text-secondary);
		font-size: 0.86rem;
		line-height: 1.5;
	}

	.course-facts {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem 0.9rem;
		margin-top: 1rem;
		color: var(--text-tertiary);
		font-size: 0.73rem;
		font-variant-numeric: tabular-nums;
	}

	.course-facts strong {
		color: var(--text-primary);
	}

	.course-foundation {
		border-left: 1px solid var(--border-color);
	}

	.course-foundation strong {
		margin-top: 0.45rem;
		font-size: 1rem;
		line-height: 1.25;
	}

	.course-foundation > span {
		margin-top: 0.5rem;
		color: var(--text-secondary);
		font-size: 0.8rem;
		line-height: 1.45;
	}

	.course-action {
		align-items: center;
		gap: 0.8rem;
		border-left: 1px solid var(--border-color);
		color: var(--accent);
		font-size: 0.82rem;
		font-weight: 720;
		text-align: center;
	}

	.course-arrow {
		width: 1.4rem;
		height: 1.4rem;
		flex: 0 0 auto;
		transition: transform 130ms ease;
	}

	.course-list a:hover .course-arrow {
		transform: translateX(0.2rem);
	}

	.method {
		display: grid;
		grid-template-columns: minmax(15rem, 0.65fr) minmax(0, 1.35fr);
		gap: clamp(2rem, 6vw, 5rem);
	}

	.method-heading h2,
	.integration h2 {
		max-width: 16ch;
		margin: 0;
		font-size: clamp(1.8rem, 4vw, 2.8rem);
		line-height: 1.08;
		letter-spacing: -0.035em;
	}

	.method-heading p {
		max-width: 45ch;
		margin: 1rem 0 0;
		color: var(--text-secondary);
		font-size: 0.92rem;
		line-height: 1.55;
	}

	.method-steps {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		margin: 0;
		padding: 0;
		border-inline-end: 1px solid var(--border-color);
		border-block-end: 1px solid var(--border-color);
		counter-reset: method;
		list-style: none;
	}

	.method-steps li {
		position: relative;
		min-height: 9rem;
		padding: 2.35rem 1rem 1rem;
		border-inline-start: 1px solid var(--border-color);
		border-block-start: 1px solid var(--border-color);
		counter-increment: method;
	}

	.method-steps li::before {
		position: absolute;
		top: 0.75rem;
		left: 1rem;
		color: var(--text-muted);
		content: counter(method, decimal-leading-zero);
		font-family: var(--font-mono);
		font-size: 0.68rem;
	}

	.method-steps strong,
	.method-steps span {
		display: block;
	}

	.method-steps strong {
		font-size: 0.95rem;
	}

	.method-steps span {
		margin-top: 0.45rem;
		color: var(--text-secondary);
		font-size: 0.82rem;
		line-height: 1.5;
	}

	.integration {
		display: grid;
		grid-template-columns: minmax(15rem, 0.65fr) minmax(0, 1.35fr);
		gap: clamp(2rem, 6vw, 5rem);
	}

	.integration-copy {
		border-top: 1px solid var(--border-color);
	}

	.integration-copy p {
		margin: 0;
		padding: 1rem 0;
		border-bottom: 1px solid var(--border-color);
		color: var(--text-secondary);
		font-size: 0.9rem;
		line-height: 1.55;
	}

	@media (max-width: 900px) {
		.catalog-intro {
			grid-template-columns: 1fr;
			gap: 2rem;
		}

		.script-register {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}

		.script-register li {
			min-height: 4.75rem;
		}

		.course-list a {
			grid-template-columns: 6rem minmax(0, 1fr) 8rem;
		}

		.course-overview {
			grid-column: 2;
		}

		.course-foundation {
			grid-column: 2;
			padding-top: 0;
			border-left: 0;
		}

		.course-action {
			grid-column: 3;
			grid-row: 1 / span 2;
		}
	}

	@media (max-width: 640px) {
		.courses-page {
			padding-inline: var(--spacing-lg);
		}

		.script-register {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.section-bar {
			align-items: flex-start;
			flex-direction: column;
			gap: 0.15rem;
		}

		.course-list a {
			grid-template-columns: 4.75rem minmax(0, 1fr);
			min-height: 0;
		}

		.course-script {
			grid-column: 1;
			grid-row: 1;
			padding-inline: 0.65rem;
		}

		.course-overview {
			grid-column: 2;
			grid-row: 1;
		}

		.course-foundation {
			grid-column: 1 / -1;
			grid-row: 2;
			padding-top: 1rem;
			border-top: 1px solid var(--border-color);
		}

		.course-action {
			grid-column: 1 / -1;
			grid-row: 3;
			min-height: 3.25rem;
			flex-direction: row;
			border-top: 1px solid var(--border-color);
			border-left: 0;
		}

		.method,
		.integration {
			grid-template-columns: 1fr;
		}

		.method-steps {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 380px) {
		.script-register {
			grid-template-columns: 1fr;
		}

		.catalog-summary span + span::before {
			display: none;
		}

		.catalog-summary {
			gap: 0.35rem 0.8rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.course-arrow {
			transition: none;
		}

		.course-list a:hover .course-arrow {
			transform: none;
		}
	}
</style>
