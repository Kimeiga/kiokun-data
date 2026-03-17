<script lang="ts">
	import { onMount } from 'svelte';
	import Header from '$lib/components/Header.svelte';

	interface Video {
		id: string;
		title: string;
		slug: string;
		videoUrl: string;
		videoId: string;
		thumbnailUrl: string;
		duration: number;
		publishedAt: number;
		summary: string;
		viewCount: number;
	}

	interface Source {
		id: string;
		name: string;
		description: string;
		thumbnailUrl: string | null;
	}

	let videos = $state<Video[]>([]);
	let source = $state<Source | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	onMount(async () => {
		try {
			const res = await fetch('/api/learning-resources/videos?source=scripting-japan&limit=50');
			if (!res.ok) throw new Error('Failed to fetch videos');
			
			const data = await res.json();
			source = data.source;
			videos = data.videos;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unknown error';
		} finally {
			loading = false;
		}
	});

	function formatDuration(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	function formatDate(timestamp: number): string {
		return new Date(timestamp * 1000).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>Scripting Japan - Learning Resources - Kiokun</title>
	<meta name="description" content="Learn natural Japanese through Scripting Japan videos" />
</svelte:head>

<Header currentWord="" />

<div class="max-w-6xl mx-auto px-4 py-8">
	<!-- Breadcrumb -->
	<nav class="text-sm mb-6 text-text-secondary">
		<a href="/learning-resources" class="hover:text-accent">Learning Resources</a>
		<span class="mx-2">/</span>
		<a href="/learning-resources/japanese" class="hover:text-accent">Japanese</a>
		<span class="mx-2">/</span>
		<span class="text-text-primary">Scripting Japan</span>
	</nav>

	{#if loading}
		<div class="text-center py-12">
			<div class="text-4xl mb-4">⏳</div>
			<p class="text-text-secondary">Loading videos...</p>
		</div>
	{:else if error}
		<div class="text-center py-12">
			<div class="text-4xl mb-4">❌</div>
			<p class="text-red-500">{error}</p>
		</div>
	{:else if source}
		<!-- Channel Header -->
		<div class="mb-8">
			<h1 class="text-4xl font-bold mb-3 text-text-primary">{source.name}</h1>
			<p class="text-lg text-text-secondary mb-4">{source.description}</p>
			<div class="flex items-center gap-4 text-sm text-text-tertiary">
				<span>📺 {videos.length} videos</span>
				<span>🎯 Natural Japanese</span>
				<span>🗣️ Street Interviews</span>
			</div>
		</div>

		<!-- Video Grid -->
		{#if videos.length === 0}
			<div class="text-center py-12">
				<div class="text-4xl mb-4">📭</div>
				<p class="text-text-secondary">No videos available yet. Check back soon!</p>
			</div>
		{:else}
			<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
				{#each videos as video}
					<a 
						href="/learning-resources/japanese/scripting-japan/{video.slug}"
						class="block bg-bg-secondary border border-border rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
					>
						<!-- Thumbnail -->
						<div class="relative aspect-video bg-bg-tertiary">
							<img 
								src={video.thumbnailUrl} 
								alt={video.title}
								class="w-full h-full object-cover"
							/>
							<div class="absolute bottom-2 right-2 px-2 py-1 bg-black bg-opacity-75 text-white text-xs rounded">
								{formatDuration(video.duration)}
							</div>
						</div>

						<!-- Content -->
						<div class="p-4">
							<h3 class="font-bold text-text-primary mb-2 line-clamp-2">
								{video.title}
							</h3>
							<p class="text-sm text-text-secondary mb-3 line-clamp-2">
								{video.summary}
							</p>
							<div class="flex items-center justify-between text-xs text-text-tertiary">
								<span>{formatDate(video.publishedAt)}</span>
								<span>👁️ {video.viewCount.toLocaleString()}</span>
							</div>
						</div>
					</a>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>

