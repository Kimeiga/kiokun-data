<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import Header from '$lib/components/Header.svelte';
	import WordCard from '$lib/components/WordCard.svelte';

	interface Video {
		id: string;
		title: string;
		slug: string;
		videoUrl: string;
		videoId: string;
		thumbnailUrl: string;
		duration: number;
		publishedAt: number;
		transcript: string;
		summary: string;
		viewCount: number;
	}

	interface ExtractedWord {
		id: string;
		word: string;
		wordSlug: string;
		reading: string;
		translation: string;
		context: string;
		timestamp: number;
		sortOrder: number;
	}

	let video = $state<Video | null>(null);
	let words = $state<ExtractedWord[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	const slug = $derived($page.params.slug);

	onMount(async () => {
		try {
			const res = await fetch(`/api/learning-resources/video/${slug}?source=scripting-japan`);
			if (!res.ok) throw new Error('Failed to fetch video');
			
			const data = await res.json();
			video = data.video;
			words = data.words;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unknown error';
		} finally {
			loading = false;
		}
	});

	function formatDate(timestamp: number): string {
		return new Date(timestamp * 1000).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function getYouTubeEmbedUrl(videoId: string): string {
		return `https://www.youtube.com/embed/${videoId}`;
	}
</script>

<svelte:head>
	<title>{video?.title || 'Loading...'} - Scripting Japan - Kiokun</title>
</svelte:head>

<Header currentWord="" />

<div class="max-w-6xl mx-auto px-4 py-8">
	<!-- Breadcrumb -->
	<nav class="text-sm mb-6 text-text-secondary">
		<a href="/learning-resources" class="hover:text-accent">Learning Resources</a>
		<span class="mx-2">/</span>
		<a href="/learning-resources/japanese" class="hover:text-accent">Japanese</a>
		<span class="mx-2">/</span>
		<a href="/learning-resources/japanese/scripting-japan" class="hover:text-accent">Scripting Japan</a>
		<span class="mx-2">/</span>
		<span class="text-text-primary">{video?.title || '...'}</span>
	</nav>

	{#if loading}
		<div class="text-center py-12">
			<div class="text-4xl mb-4">⏳</div>
			<p class="text-text-secondary">Loading video...</p>
		</div>
	{:else if error}
		<div class="text-center py-12">
			<div class="text-4xl mb-4">❌</div>
			<p class="text-red-500">{error}</p>
		</div>
	{:else if video}
		<div class="grid lg:grid-cols-3 gap-8">
			<!-- Main Content (Video + Summary) -->
			<div class="lg:col-span-2 space-y-6">
				<!-- Video Player -->
				<div class="aspect-video bg-black rounded-lg overflow-hidden">
					<iframe
						src={getYouTubeEmbedUrl(video.videoId)}
						title={video.title}
						frameborder="0"
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
						allowfullscreen
						class="w-full h-full"
					></iframe>
				</div>

				<!-- Video Info -->
				<div>
					<h1 class="text-3xl font-bold mb-3 text-text-primary">{video.title}</h1>
					<div class="flex items-center gap-4 text-sm text-text-tertiary mb-4">
						<span>📅 {formatDate(video.publishedAt)}</span>
						<span>👁️ {video.viewCount.toLocaleString()} views</span>
						<a 
							href={video.videoUrl} 
							target="_blank" 
							rel="noopener noreferrer"
							class="text-accent hover:underline"
						>
							Watch on YouTube →
						</a>
					</div>
					
					<!-- Summary -->
					<div class="p-4 bg-bg-secondary border border-border rounded-lg">
						<h2 class="text-lg font-bold mb-2 text-text-primary">📝 Summary</h2>
						<p class="text-text-secondary">{video.summary}</p>
					</div>
				</div>
			</div>

			<!-- Sidebar (Extracted Words) -->
			<div class="lg:col-span-1">
				<div class="sticky top-4">
					<h2 class="text-2xl font-bold mb-4 text-text-primary">
						🎯 Vocabulary ({words.length})
					</h2>
					
					{#if words.length === 0}
						<p class="text-text-secondary">No vocabulary extracted yet.</p>
					{:else}
						<div class="space-y-2 max-h-[800px] overflow-y-auto pr-2">
							{#each words as word}
								<WordCard 
									word={word.word}
									wordSlug={word.wordSlug}
									reading={word.reading}
									translation={word.translation}
									context={word.context}
									timestamp={word.timestamp}
								/>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
