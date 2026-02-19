<script lang="ts">
	import { onMount } from 'svelte';
	import SectionHeading from './shared/SectionHeading.svelte';

	interface VideoOccurrence {
		video_id: string;
		start_time: number;
		end_time: number;
		sentence: string;
	}

	interface VideoInfo {
		url: string;
		thumbnail: string | null;
		word_count: number;
	}

	interface VideoData {
		videos: Record<string, VideoInfo>;
		words: Record<string, VideoOccurrence[]>;
	}

	let { word, language = 'ja' }: { word: string; language?: 'ja' | 'zh' } = $props();

	const BATCH_SIZE = 10;

	let videoData: VideoData | null = $state(null);
	let occurrences: VideoOccurrence[] = $state([]);
	let loading = $state(true);
	let visibleCount = $state(BATCH_SIZE);

	function loadMore() {
		visibleCount = Math.min(visibleCount + BATCH_SIZE, occurrences.length);
	}

	let hasMore = $derived(visibleCount < occurrences.length);
	let remainingCount = $derived(occurrences.length - visibleCount);

	// Determine which JSON file to load based on language
	let dataFile = $derived(language === 'zh' ? '/chinese_video_data.json' : '/video_data.json');
	let languageFlag = $derived(language === 'zh' ? '🇨🇳' : '🇯🇵');
	let languageLabel = $derived(language === 'zh' ? 'Chinese' : 'Japanese');

	onMount(async () => {
		try {
			const response = await fetch(dataFile);
			if (response.ok) {
				videoData = await response.json();
				occurrences = videoData?.words[word] || [];
			}
		} catch (err) {
			console.error(`Failed to load ${languageLabel} video data:`, err);
		} finally {
			loading = false;
		}
	});

	function getThumbnailUrl(videoId: string): string | null {
		return videoData?.videos[videoId]?.thumbnail ?? null;
	}

	function formatTime(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}
</script>

{#if !loading && occurrences.length > 0}
	<div class="mb-6">
		<SectionHeading>{languageFlag} Reels ({occurrences.length})</SectionHeading>
		<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
			{#each occurrences.slice(0, visibleCount) as occ}
				<a
					href="/reel/{occ.video_id}?word={encodeURIComponent(word)}&t={occ.start_time}&lang={language}"
					class="group relative aspect-[9/16] bg-bg-secondary rounded-lg overflow-hidden border border-border hover:border-accent transition-colors"
				>
					<!-- Static thumbnail image (much faster than loading video) -->
					{#if getThumbnailUrl(occ.video_id)}
						<img
							src={getThumbnailUrl(occ.video_id)}
							alt="Video thumbnail"
							class="absolute inset-0 w-full h-full object-cover"
							loading="lazy"
						/>
					{:else}
						<!-- Fallback placeholder -->
						<div class="absolute inset-0 bg-bg-tertiary flex items-center justify-center">
							<svg class="w-8 h-8 text-text-tertiary" fill="currentColor" viewBox="0 0 24 24">
								<path d="M8 5v14l11-7z" />
							</svg>
						</div>
					{/if}
					
					<!-- Overlay with sentence preview -->
					<div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
						<div class="absolute bottom-0 left-0 right-0 p-2">
							<p class="text-white text-xs line-clamp-3 font-cjk">
								{occ.sentence}
							</p>
							<p class="text-white/70 text-[10px] mt-1">
								@ {formatTime(occ.start_time)}
							</p>
						</div>
					</div>

					<!-- Play icon overlay -->
					<div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
						<div class="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
							<svg class="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
								<path d="M8 5v14l11-7z" />
							</svg>
						</div>
					</div>
				</a>
			{/each}
		</div>
		
		{#if hasMore}
			<div class="mt-4 text-center">
				<button
					onclick={loadMore}
					class="px-4 py-2 text-sm font-medium text-text-secondary bg-bg-secondary hover:bg-bg-tertiary border border-border rounded-lg transition-colors"
				>
					Load more ({remainingCount} remaining)
				</button>
			</div>
		{/if}
	</div>
{/if}

