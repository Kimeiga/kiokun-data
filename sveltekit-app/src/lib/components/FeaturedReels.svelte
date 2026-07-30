<script lang="ts">
	import featuredReelData from '$lib/generated/featured-reels.json';

	interface ReelItem {
		video_id: string;
		thumbnail: string;
		language: 'ja' | 'zh';
		sample_word?: string;
	}

	const reels = (featuredReelData.reels as ReelItem[]).slice(0, 8);
</script>

{#if reels.length > 0}
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
						<img
							src={reel.thumbnail}
							alt={reel.sample_word
								? `${reel.sample_word} — ${reel.language === 'zh' ? 'Chinese' : 'Japanese'} video`
								: `${reel.language === 'zh' ? 'Chinese' : 'Japanese'} video`}
							loading="lazy"
							decoding="async"
						/>
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
		padding: 1.5rem 0 0;
		border-top: 1px solid var(--border-color);
		margin-top: 0;
	}

	.section-title {
		font-size: 20px;
		font-weight: 700;
		text-align: left;
		margin: 0 0 8px;
		color: var(--text-primary);
	}

	.section-subtitle {
		text-align: left;
		font-size: var(--font-size-callout);
		color: var(--text-secondary);
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
		border: 1px solid var(--border-color);
		transition: border-color 0.15s ease;
	}

	.reel-card:hover {
		border-color: var(--accent);
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
			display: grid;
			grid-auto-columns: minmax(8.5rem, 42%);
			grid-auto-flow: column;
			grid-template-columns: none;
			gap: 8px;
			overflow-x: auto;
			padding-bottom: 0.65rem;
			scroll-padding-inline: 1px;
			scroll-snap-type: x proximity;
			scrollbar-width: thin;
		}

		.reel-card {
			scroll-snap-align: start;
		}
	}
</style>
