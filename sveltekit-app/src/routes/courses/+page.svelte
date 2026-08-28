<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import CourseCatalogPreview from '$lib/courses/CourseCatalogPreview.svelte';
	import { courseReadingColor } from '$lib/courses/catalog';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const totalLessons = data.courses.reduce((sum, course) => sum + course.lessonCount, 0);
</script>

<Header currentWord="" />

<main id="main-content" class="courses-page">
	<section class="catalog-intro" aria-labelledby="courses-title">
		<div>
			<h1 id="courses-title">Beginner language courses</h1>
			<p>Japanese, Mandarin, Cantonese, and Korean from writing and sound through A1.</p>
		</div>
		<p class="intro-proof">
			The previews below use the same charts, examples, and questions as the lessons themselves.
		</p>
	</section>

	<section class="catalog" aria-labelledby="catalog-title">
		<div class="section-bar">
			<h2 id="catalog-title">Foundation-lesson previews</h2>
			<span>{totalLessons} lessons across {data.courses.length} courses</span>
		</div>

		<ol class="course-grid">
			{#each data.courses as course}
				<li style={'--course-' + course.language + ': ' + courseReadingColor(course.language)}>
					<CourseCatalogPreview {course} />
				</li>
			{/each}
		</ol>
	</section>

	<p class="catalog-note">
		Vocabulary in the lessons links to Kiokun dictionary entries. Progress is stored on the current device.
	</p>
</main>

<style>
	.courses-page {
		width: min(100%, 76rem);
		margin: 0 auto;
		padding: clamp(1.4rem, 3vw, 2.6rem) clamp(1rem, 3vw, 2rem) 4rem;
	}

	.catalog-intro {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(18rem, 25rem);
		align-items: end;
		gap: clamp(1.5rem, 6vw, 5rem);
		padding-bottom: clamp(1.5rem, 3vw, 2.4rem);
	}

	.catalog-intro h1,
	.catalog-intro p {
		margin: 0;
	}

	.catalog-intro h1 {
		max-width: 15ch;
		font-size: clamp(2.45rem, 5.4vw, 4.6rem);
		font-weight: 770;
		line-height: 0.98;
		letter-spacing: -0.04em;
	}

	.catalog-intro div > p {
		max-width: 58ch;
		margin-top: 0.9rem;
		color: var(--text-secondary);
		font-size: clamp(0.92rem, 1.5vw, 1.05rem);
		line-height: 1.5;
	}

	.intro-proof {
		max-width: 45ch;
		padding-top: 0.8rem;
		border-top: 1px solid var(--border-color);
		color: var(--text-secondary);
		font-size: 0.86rem;
		line-height: 1.5;
	}

	.catalog {
		border-top: 1px solid var(--border-color);
	}

	.section-bar {
		display: flex;
		min-height: 2.4rem;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.48rem 0.75rem;
		background: var(--section-bar-bg);
		color: var(--section-bar-text);
	}

	.section-bar h2 {
		margin: 0;
		font-size: 0.86rem;
		font-weight: 700;
	}

	.section-bar span {
		color: color-mix(in srgb, var(--section-bar-text) 76%, transparent);
		font-size: 0.7rem;
	}

	.course-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		margin: 0;
		padding: 0;
		border-left: 1px solid var(--border-color);
		list-style: none;
	}

	.course-grid > li {
		min-width: 0;
		border-right: 1px solid var(--border-color);
		border-bottom: 1px solid var(--border-color);
	}

	.catalog-note {
		max-width: 72ch;
		margin: 1rem 0 0;
		color: var(--text-tertiary);
		font-size: 0.72rem;
		line-height: 1.5;
	}

	@media (max-width: 850px) {
		.catalog-intro {
			grid-template-columns: 1fr;
			gap: 1.1rem;
		}

		.course-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 640px) {
		.courses-page {
			padding-inline: var(--spacing-lg);
		}

		.catalog-intro h1 {
			font-size: clamp(2.35rem, 12vw, 3.15rem);
			line-height: 1;
		}

		.section-bar {
			align-items: flex-start;
			flex-direction: column;
			gap: 0.12rem;
		}
	}
</style>
