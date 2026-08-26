<script lang="ts">
	import CourseOverviewPage from '../japanese/+page.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<CourseOverviewPage {data} />
