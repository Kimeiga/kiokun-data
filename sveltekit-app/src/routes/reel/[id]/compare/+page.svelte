<script lang="ts">
	import type { ComparisonPageData, TranscriptSegment, TranscriptTrack } from './+page';

	let { data }: { data: ComparisonPageData } = $props();

	let videoElement: HTMLVideoElement | undefined = $state();
	let currentTime = $state(0);
	let videoDuration = $state(data.duration);

	let duration = $derived(videoDuration || data.duration || 0);

	function formatTime(seconds: number): string {
		const safeSeconds = Number.isFinite(seconds) ? Math.max(seconds, 0) : 0;
		const mins = Math.floor(safeSeconds / 60);
		const secs = Math.floor(safeSeconds % 60);
		const tenths = Math.floor((safeSeconds % 1) * 10);
		return `${mins}:${secs.toString().padStart(2, '0')}.${tenths}`;
	}

	function syncTime() {
		if (!videoElement) return;
		currentTime = videoElement.currentTime;
		if (Number.isFinite(videoElement.duration)) {
			videoDuration = videoElement.duration;
		}
	}

	function isNativeControlAreaClick(event: MouseEvent, video: HTMLVideoElement): boolean {
		const rect = video.getBoundingClientRect();
		const controlHeight = Math.min(64, rect.height * 0.22);
		return event.clientY >= rect.bottom - controlHeight;
	}

	function preventVideoSurfaceToggle(event: MouseEvent) {
		const video = event.currentTarget as HTMLVideoElement;
		if (isNativeControlAreaClick(event, video)) return;

		const wasPaused = video.paused;
		event.preventDefault();
		event.stopPropagation();

		requestAnimationFrame(() => {
			if (wasPaused && !video.paused) {
				video.pause();
			} else if (!wasPaused && video.paused) {
				void video.play().catch(() => {});
			}
		});
	}

	function seekTo(seconds: number) {
		if (!videoElement) return;
		videoElement.currentTime = seconds;
		currentTime = seconds;
	}

	function scrub(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		seekTo(Number(input.value));
	}

	function getActiveIndex(segments: TranscriptSegment[], time: number): number {
		if (!segments.length) return -1;

		const exactIndex = segments.findIndex((segment) => (
			time >= segment.start_time && time < segment.end_time
		));
		if (exactIndex >= 0) return exactIndex;

		let latestStarted = 0;
		for (let index = 0; index < segments.length; index += 1) {
			if (segments[index].start_time <= time) latestStarted = index;
			if (segments[index].start_time > time) break;
		}
		return latestStarted;
	}

	function visibleSegments(track: TranscriptTrack, activeIndex: number): TranscriptSegment[] {
		if (activeIndex < 0) return track.segments.slice(0, 5);
		const start = Math.max(activeIndex - 2, 0);
		const end = Math.min(activeIndex + 3, track.segments.length);
		return track.segments.slice(start, end);
	}

	function segmentOffset(track: TranscriptTrack, segment: TranscriptSegment): number {
		return track.segments.indexOf(segment);
	}

	function kindLabel(kind: string): string {
		const labels: Record<string, string> = {
			'audio-stt': 'Audio STT',
			'local-ocr': 'Local OCR',
			'video-llm': 'Video LLM'
		};
		return labels[kind] ?? kind;
	}
</script>

<svelte:head>
	<title>Transcript Compare | Kiokun</title>
</svelte:head>

<main id="main-content" class="comparison-page">
	<header class="page-header">
		<div>
			<a class="back-link" href="/reel/{data.videoId}">← Reel</a>
			<h1>Transcript Compare</h1>
			<p class="meta">
				{#if data.author}{data.author} · {/if}{data.tracks.length} tracks · {formatTime(duration)}
			</p>
		</div>
		{#if data.sourceUrl}
			<a class="source-link" href={data.sourceUrl} target="_blank" rel="noreferrer">Instagram</a>
		{/if}
	</header>

	<section class="workspace">
		<aside class="video-pane">
			<!-- svelte-ignore a11y_media_has_caption -->
			<video
				bind:this={videoElement}
				class="video-player"
				src={data.videoUrl}
				controls
				playsinline
				onclick={preventVideoSurfaceToggle}
				ontimeupdate={syncTime}
				onseeking={syncTime}
				onloadedmetadata={syncTime}
			></video>

			<div class="scrubber">
				<span>{formatTime(currentTime)}</span>
				<input
					type="range"
					min="0"
					max={duration}
					step="0.05"
					value={currentTime}
					aria-label="Scrub video"
					oninput={scrub}
				/>
				<span>{formatTime(duration)}</span>
			</div>
		</aside>

		<section class="tracks" aria-label="Transcript tracks">
			{#each data.tracks as track}
				{@const activeIndex = getActiveIndex(track.segments, currentTime)}
				{@const active = activeIndex >= 0 ? track.segments[activeIndex] : null}
				<article class="track-panel track-{track.kind}">
					<header class="track-header">
						<div>
							<h2>{track.label}</h2>
							<p>{track.source}</p>
						</div>
						<span class="kind">{kindLabel(track.kind)}</span>
					</header>

					<div class="active-readout">
						{#if active}
							<span class="time-range">{formatTime(active.start_time)}-{formatTime(active.end_time)}</span>
							<p>{active.text}</p>
							{#if active.confidence}
								<span class="confidence">conf {Math.round(active.confidence * 100)}%</span>
							{/if}
						{:else}
							<p>No active segment</p>
						{/if}
					</div>

					<div class="segment-list">
						{#each visibleSegments(track, activeIndex) as segment}
							{@const index = segmentOffset(track, segment)}
							<button
								type="button"
								class="segment-row"
								class:active={index === activeIndex}
								onclick={() => seekTo(segment.start_time)}
							>
								<span class="segment-time">{formatTime(segment.start_time)}</span>
								<span class="segment-text">{segment.text}</span>
							</button>
						{/each}
					</div>
				</article>
			{/each}
		</section>
	</section>

	{#if data.notes?.length}
		<footer class="notes">
			{#each data.notes as note}
				<p>{note}</p>
			{/each}
		</footer>
	{/if}
</main>

<style>
	.comparison-page {
		min-height: 100vh;
		padding: 24px;
		background: var(--bg-primary);
		color: var(--text-primary);
	}

	.page-header {
		max-width: 1520px;
		margin: 0 auto 20px;
		display: flex;
		justify-content: space-between;
		gap: 20px;
		align-items: flex-end;
	}

	.back-link,
	.source-link {
		color: var(--accent);
		text-decoration: none;
		font-size: var(--font-size-callout);
	}

	.back-link:hover,
	.source-link:hover {
		text-decoration: underline;
	}

	h1 {
		margin: 6px 0 0;
		font-size: clamp(28px, 4vw, 44px);
		line-height: 1.05;
		letter-spacing: 0;
	}

	.meta,
	.track-header p,
	.notes p {
		color: var(--text-muted);
		margin: 6px 0 0;
	}

	.workspace {
		max-width: 1520px;
		margin: 0 auto;
		display: grid;
		grid-template-columns: minmax(300px, 420px) minmax(0, 1fr);
		gap: 24px;
		align-items: start;
	}

	.video-pane {
		position: sticky;
		top: 24px;
	}

	.video-player {
		width: 100%;
		aspect-ratio: 9 / 16;
		max-height: calc(100vh - 150px);
		object-fit: cover;
		display: block;
		background: #000;
		border-radius: var(--radius-md);
		box-shadow: 0 12px 36px rgba(0, 0, 0, 0.16);
	}

	.scrubber {
		margin-top: 12px;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: 10px;
		align-items: center;
		font-size: var(--font-size-caption1);
		color: var(--text-muted);
	}

	.scrubber input {
		width: 100%;
		accent-color: var(--accent);
	}

	.tracks {
		display: grid;
		grid-template-columns: repeat(2, minmax(280px, 1fr));
		gap: 16px;
	}

	.track-panel {
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-secondary);
		overflow: hidden;
	}

	.track-header {
		min-height: 86px;
		padding: 16px;
		display: flex;
		justify-content: space-between;
		gap: 14px;
		border-bottom: 1px solid var(--border-color);
	}

	.track-header h2 {
		margin: 0;
		font-size: var(--font-size-headline);
		line-height: 1.2;
		letter-spacing: 0;
	}

	.track-header p {
		font-size: var(--font-size-caption1);
		line-height: 1.35;
	}

	.kind {
		height: 24px;
		padding: 4px 8px;
		border-radius: var(--radius-sm);
		background: var(--bg-tertiary);
		color: var(--text-secondary);
		font-size: var(--font-size-caption1);
		white-space: nowrap;
	}

	.active-readout {
		min-height: 170px;
		padding: 16px;
		border-bottom: 1px solid var(--border-color);
	}

	.time-range,
	.confidence {
		display: inline-block;
		color: var(--text-muted);
		font-size: var(--font-size-caption1);
	}

	.active-readout p {
		margin: 10px 0 8px;
		font-family: var(--font-cjk);
		font-size: clamp(22px, 2.2vw, 30px);
		line-height: 1.45;
		white-space: pre-wrap;
	}

	.segment-list {
		padding: 8px;
	}

	.segment-row {
		width: 100%;
		display: grid;
		grid-template-columns: 46px minmax(0, 1fr);
		gap: 10px;
		align-items: start;
		padding: 8px;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-secondary);
		text-align: left;
		cursor: pointer;
		opacity: 0.62;
	}

	.segment-row:hover {
		border-color: var(--accent);
		opacity: 1;
	}

	.segment-row.active {
		background: var(--accent-light);
		border-color: color-mix(in srgb, var(--accent) 32%, transparent);
		color: var(--text-primary);
		opacity: 1;
	}

	.segment-time {
		color: var(--text-muted);
		font-size: var(--font-size-caption1);
		padding-top: 3px;
	}

	.segment-text {
		font-family: var(--font-cjk);
		font-size: var(--font-size-callout);
		line-height: 1.55;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.notes {
		max-width: 1520px;
		margin: 20px auto 0;
		padding-top: 12px;
		border-top: 1px solid var(--border-color);
		font-size: var(--font-size-caption1);
	}

	@media (max-width: 1100px) {
		.workspace {
			grid-template-columns: 1fr;
		}

		.video-pane {
			position: static;
			max-width: 420px;
			margin: 0 auto;
			width: 100%;
		}
	}

	@media (max-width: 760px) {
		.comparison-page {
			padding: 16px;
		}

		.page-header {
			display: block;
		}

		.source-link {
			display: inline-block;
			margin-top: 10px;
		}

		.tracks {
			grid-template-columns: 1fr;
		}

		.active-readout {
			min-height: 140px;
		}
	}
</style>
