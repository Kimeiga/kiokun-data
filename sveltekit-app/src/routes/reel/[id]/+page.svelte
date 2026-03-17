<script lang="ts">
	import type { ReelPageData } from './+page';
	import Header from '$lib/components/Header.svelte';

	let { data }: { data: ReelPageData } = $props();
	let videoElement: HTMLVideoElement | undefined = $state();

	let languageFlag = $derived(data.language === 'zh' ? '🇨🇳' : '🇯🇵');

	function isWordInSentence(word: string, sentence: string, char: string): boolean {
		return sentence.includes(word) && word.includes(char);
	}

	function findMatchingWord(words: string[], char: string): string | undefined {
		return words.find(w => w.includes(char));
	}

	// Set video start time when element is ready
	$effect(() => {
		if (videoElement && data.startTime > 0) {
			videoElement.currentTime = data.startTime;
		}
	});

	function formatTime(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	function seekTo(time: number) {
		if (videoElement) {
			videoElement.currentTime = time;
			videoElement.play();
		}
	}
</script>

<svelte:head>
	<title>{languageFlag} Reel | Kiokun</title>
</svelte:head>

<Header />

<main class="container mx-auto px-4 py-6">
	<div class="flex flex-col md:flex-row gap-6 max-w-6xl mx-auto md:items-start">
		<!-- Left: Video player and metadata (sticky, offset for header) -->
		<div class="md:w-2/5 flex flex-col md:sticky md:top-20">
			<div class="w-full max-w-xs mx-auto rounded-lg overflow-hidden bg-black">
				<!-- svelte-ignore a11y_media_has_caption -->
				<video
					bind:this={videoElement}
					src={data.videoUrl}
					class="w-full h-auto"
					controls
					playsinline
				></video>
			</div>

			<!-- Video metadata -->
			<div class="w-full max-w-xs mx-auto mt-4 space-y-2">
				{#if data.author}
					<div class="flex items-center gap-2 text-sm">
						<span class="text-text-tertiary">Author:</span>
						<a
							href="https://www.instagram.com/{data.author.replace('@', '')}/"
							target="_blank"
							rel="noopener noreferrer"
							class="text-accent hover:underline font-medium"
						>{data.author}</a>
					</div>
				{/if}

				{#if data.sourceUrl}
					<div class="flex items-center gap-2 text-sm">
						<span class="text-text-tertiary">Source:</span>
						<a
							href={data.sourceUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="text-accent hover:underline flex items-center gap-1"
						>
							Instagram
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
							</svg>
						</a>
					</div>
				{/if}

				{#if data.duration}
					<div class="flex items-center gap-2 text-sm">
						<span class="text-text-tertiary">Duration:</span>
						<span class="text-text-secondary">{formatTime(data.duration)}</span>
					</div>
				{/if}

				{#if data.caption}
					<div class="text-sm mt-3 p-2 bg-bg-secondary rounded-lg">
						<span class="text-text-tertiary block mb-1">Description:</span>
						<p class="text-text-secondary text-xs leading-relaxed">{data.caption}</p>
					</div>
				{/if}
			</div>
		</div>

		<!-- Right: Interactive transcript -->
		<div class="md:w-3/5">
			<h2 class="text-lg font-semibold mb-4 text-text-primary">{languageFlag} Transcript</h2>
			
			{#if data.transcript.length === 0}
				<p class="text-text-tertiary">No transcript available for this video.</p>
			{:else}
				<div class="space-y-4">
					{#each data.transcript as segment}
						<div 
							class="p-3 rounded-lg bg-bg-secondary border border-border hover:border-accent transition-colors cursor-pointer"
							onclick={() => seekTo(segment.start_time)}
							role="button"
							tabindex="0"
							onkeydown={(e) => e.key === 'Enter' && seekTo(segment.start_time)}
						>
							<div class="text-xs text-text-tertiary mb-2">
								{formatTime(segment.start_time)} - {formatTime(segment.end_time)}
							</div>
							<p class="text-text-primary font-cjk text-lg leading-relaxed">
								{#each segment.sentence.split('') as char}
									{#if segment.words.some(w => isWordInSentence(w, segment.sentence, char))}
										{@const matchingWord = findMatchingWord(segment.words, char)}
										<a
											href="/{matchingWord}"
											class="text-accent hover:underline {matchingWord === data.highlightWord ? 'bg-accent/20 rounded px-1' : ''}"
											onclick={(e) => e.stopPropagation()}
										>{char}</a>
									{:else}
										{char}
									{/if}
								{/each}
							</p>
							<!-- Dictionary words in this segment -->
							<div class="mt-2 flex flex-wrap gap-2">
								{#each segment.words as word}
									<a 
										href="/{word}"
										class="text-sm px-2 py-1 rounded-full bg-bg-tertiary text-text-secondary hover:bg-accent hover:text-white transition-colors"
										class:bg-accent={word === data.highlightWord}
										class:text-white={word === data.highlightWord}
										onclick={(e) => e.stopPropagation()}
									>
										{word}
									</a>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<div class="mt-6">
				<a href="/" class="text-accent hover:underline">← Back to dictionary</a>
			</div>
		</div>
	</div>
</main>

