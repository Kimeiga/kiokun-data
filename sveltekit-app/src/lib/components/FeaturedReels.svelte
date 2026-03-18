<script lang="ts">
	import { onMount } from 'svelte';

	interface VideoInfo {
		url: string;
		thumbnail: string | null;
		word_count: number;
	}

	interface VideoData {
		videos: Record<string, VideoInfo>;
		words: Record<string, Array<{ video_id: string; start_time: number }>>;
	}

	interface ReelItem {
		video_id: string;
		thumbnail: string | null;
		language: 'ja' | 'zh';
		sample_word?: string;
	}

	let reels: ReelItem[] = $state([]);
	let loading = $state(true);

	// Shuffle array using Fisher-Yates
	function shuffle<T>(array: T[]): T[] {
		const arr = [...array];
		for (let i = arr.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[arr[i], arr[j]] = [arr[j], arr[i]];
		}
		return arr;
	}

	onMount(async () => {
		try {
			const [jaResponse, zhResponse] = await Promise.all([
				fetch('/video_data.json'),
				fetch('/chinese_video_data.json')
			]);

			const allReels: ReelItem[] = [];

			if (jaResponse.ok) {
				const jaData: VideoData = await jaResponse.json();
				const jaVideos = Object.entries(jaData.videos)
					.filter(([_, info]) => info.thumbnail)
					.map(([id, info]) => ({
						video_id: id,
						thumbnail: info.thumbnail,
						language: 'ja' as const,
						sample_word: findSampleWord(jaData.words, id)
					}));
				allReels.push(...jaVideos);
			}

			if (zhResponse.ok) {
				const zhData: VideoData = await zhResponse.json();
				const zhVideos = Object.entries(zhData.videos)
					.filter(([_, info]) => info.thumbnail)
					.map(([id, info]) => ({
						video_id: id,
						thumbnail: info.thumbnail,
						language: 'zh' as const,
						sample_word: findSampleWord(zhData.words, id)
					}));
				allReels.push(...zhVideos);
			}

			// Shuffle and take 8 random reels
			reels = shuffle(allReels).slice(0, 8);
		} catch (err) {
			console.error('Failed to load featured reels:', err);
		} finally {
			loading = false;
		}
	});

	function findSampleWord(words: VideoData['words'], videoId: string): string | undefined {
		for (const [word, occurrences] of Object.entries(words)) {
			if (occurrences.some(o => o.video_id === videoId)) {
				return word;
			}
		}
		return undefined;
	}
</script>

{#if !loading && reels.length > 0}
	<section class="featured-reels">
		<h2 class="section-title">Learn from Videos</h2>
		<p class="section-subtitle">Watch real content with interactive transcripts</p>
		
		<div class="reels-grid">
			{#each reels as reel (reel.video_id)}
				<a
					href="/reel/{reel.video_id}?lang={reel.language}"
					class="reel-card"
				>
					<div class="reel-thumbnail">
						{#if reel.thumbnail}
							<img src={reel.thumbnail} alt="Video thumbnail" loading="lazy" />
						{:else}
							<div class="thumbnail-placeholder">🎬</div>
						{/if}
						<span class="lang-badge">{reel.language === 'zh' ? '🇨🇳' : '🇯🇵'}</span>
					</div>
					{#if reel.sample_word}
						<span class="sample-word">{reel.sample_word}</span>
					{/if}
				</a>
			{/each}
		</div>
	</section>
{/if}

<style>
	.featured-reels {
		padding: 30px 0;
		border-top: 1px solid var(--border-color);
		margin-top: 20px;
	}

	.section-title {
		font-size: 20px;
		font-weight: 700;
		text-align: center;
		margin: 0 0 8px;
		color: var(--text-primary);
	}

	.section-subtitle {
		text-align: center;
		font-size: 13px;
		color: var(--text-muted);
		margin: 0 0 20px;
	}

	.reels-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 12px;
	}

	.reel-card {
		display: flex;
		flex-direction: column;
		text-decoration: none;
		border-radius: var(--radius-lg);
		overflow: hidden;
		background: var(--bg-secondary);
		border: 2px solid var(--border-color);
		transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
	}

	.reel-card:hover {
		border-color: var(--accent);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px var(--shadow);
	}

	.reel-thumbnail {
		position: relative;
		aspect-ratio: 9 / 16;
		overflow: hidden;
		background: var(--bg-tertiary);
	}

	.reel-thumbnail img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.thumbnail-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 32px;
		background: var(--bg-tertiary);
	}

	.lang-badge {
		position: absolute;
		top: 6px;
		right: 6px;
		font-size: 14px;
		background: rgba(0, 0, 0, 0.6);
		border-radius: var(--radius-sm);
		padding: 2px 4px;
	}

	.sample-word {
		padding: 8px;
		text-align: center;
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary);
		font-family: "Noto Sans SC", "Noto Sans JP", sans-serif;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	@media (max-width: 768px) {
		.reels-grid {
			grid-template-columns: repeat(4, 1fr);
			gap: 8px;
		}

		.sample-word {
			font-size: 12px;
			padding: 6px;
		}

		.lang-badge {
			font-size: 12px;
		}
	}

	@media (max-width: 480px) {
		.reels-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 8px;
		}
	}
</style>

