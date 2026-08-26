<script lang="ts">
	import CourseLessonPage from '../../japanese/[lessonId]/+page.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<CourseLessonPage {data} />
