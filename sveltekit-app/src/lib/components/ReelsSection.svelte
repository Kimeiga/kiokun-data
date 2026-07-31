<script module lang="ts">
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
		source_url?: string;
		author?: string;
	}

	const reelShardCache = new Map<string, Promise<Record<string, VideoOccurrence[]> | null>>();
	const videoMetadataCache = new Map<string, Promise<Record<string, VideoInfo> | null>>();

	function fetchJson<T>(url: string): Promise<T | null> {
		return fetch(url)
			.then((response) => response.ok ? response.json() as Promise<T> : null)
			.catch(() => null);
	}

	function loadReelShard(url: string) {
		let request = reelShardCache.get(url);
		if (!request) {
			request = fetchJson<{ words: Record<string, VideoOccurrence[]> }>(url)
				.then((data) => data?.words ?? null);
			reelShardCache.set(url, request);
		}
		return request;
	}

	function loadVideoMetadata(url: string) {
		let request = videoMetadataCache.get(url);
		if (!request) {
			request = fetchJson<{ videos: Record<string, VideoInfo> }>(url)
				.then((data) => data?.videos ?? null);
			videoMetadataCache.set(url, request);
		}
		return request;
	}
</script>

<script lang="ts">
	import SectionHeading from './shared/SectionHeading.svelte';
	import { reelShardForWord } from '$lib/reel-shards';

	let { word, language = 'ja', id }: { word: string; language?: 'ja' | 'zh'; id?: string } = $props();

	const BATCH_SIZE = 10;

	let videos: Record<string, VideoInfo> = $state({});
	let occurrences: VideoOccurrence[] = $state([]);
	let loading = $state(false);
	let visibleCount = $state(BATCH_SIZE);
	let shouldLoad = $state(false);
	let sectionEl: HTMLDivElement | null = $state(null);
	let loadRequestId = 0;

	function loadMore() {
		visibleCount = Math.min(visibleCount + BATCH_SIZE, occurrences.length);
	}

	let hasMore = $derived(visibleCount < occurrences.length);
	let remainingCount = $derived(occurrences.length - visibleCount);

	let indexLanguage = $derived(language === 'zh' ? 'zh' : 'ja');
	let shardFile = $derived(`/reel-index/${indexLanguage}/${reelShardForWord(word)}.json`);
	let videosFile = $derived(`/reel-index/${indexLanguage}/videos.json`);
	let languageFlag = $derived(language === 'zh' ? '🇨🇳' : '🇯🇵');
	let languageLabel = $derived(language === 'zh' ? 'Chinese' : 'Japanese');

	async function loadVideoData(expectedWord: string, expectedShard: string, expectedVideosFile: string) {
		const requestId = ++loadRequestId;
		loading = true;
		try {
			const shardWords = await loadReelShard(expectedShard);
			if (requestId !== loadRequestId || word !== expectedWord || shardFile !== expectedShard) return;

			const wordOccurrences = shardWords?.[expectedWord] ?? [];
			if (wordOccurrences.length > 0) {
				const metadata = await loadVideoMetadata(expectedVideosFile);
				if (requestId !== loadRequestId || word !== expectedWord || videosFile !== expectedVideosFile) return;
				videos = metadata ?? {};
				occurrences = wordOccurrences.filter((occurrence) => {
					const video = videos[occurrence.video_id];
					return Boolean(video?.source_url?.trim() || video?.author?.trim());
				});
			} else {
				occurrences = [];
			}
			visibleCount = BATCH_SIZE;
		} catch (err) {
			console.error(`Failed to load ${languageLabel} video data:`, err);
		} finally {
			if (requestId === loadRequestId) loading = false;
		}
	}

	// Reset when word or language changes. The data itself loads lazily below.
	$effect(() => {
		const _word = word;
		const _shardFile = shardFile;
		const _videosFile = videosFile;
		loadRequestId += 1;
		videos = {};
		occurrences = [];
		visibleCount = BATCH_SIZE;
		loading = false;
		shouldLoad = false;
	});

	$effect(() => {
		const el = sectionEl;
		if (!el || shouldLoad) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) {
					shouldLoad = true;
					observer.disconnect();
				}
			},
			{ rootMargin: '800px 0px' }
		);

		observer.observe(el);
		return () => observer.disconnect();
	});

	$effect(() => {
		if (!shouldLoad) return;
		const _word = word;
		const _shardFile = shardFile;
		const _videosFile = videosFile;
		void loadVideoData(_word, _shardFile, _videosFile);
	});

	function getThumbnailUrl(videoId: string): string | null {
		return videos[videoId]?.thumbnail ?? null;
	}

	function formatTime(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}
</script>

<div bind:this={sectionEl} class="reels-section-anchor" aria-hidden="true"></div>

{#if !loading && occurrences.length > 0}
	<div class="mb-6">
		<SectionHeading {id}>{languageFlag} Reels ({occurrences.length})</SectionHeading>
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
							decoding="async"
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

<style>
	.reels-section-anchor {
		width: 100%;
		height: 1px;
	}
</style>
