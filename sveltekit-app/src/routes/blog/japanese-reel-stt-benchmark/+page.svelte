<script lang="ts">
	import Reveal from '$lib/blog/Reveal.svelte';
	import type { BenchmarkData, TranscriptSegment, TranscriptTrack } from './+page';

	type GroupId = 'all' | 'winner' | 'bad-timing' | 'timed-errors' | 'hardsub' | 'local';

	interface ModelMeta {
		group: Exclude<GroupId, 'all'>;
		groupLabel: string;
		rank: number;
		grade: string;
		timing: string;
		verdict: string;
		role: string;
	}

	let { data }: { data: BenchmarkData } = $props();

	let videoElement: HTMLVideoElement | undefined = $state();
	let currentTime = $state(28.2);
	let selectedGroup: GroupId = $state('all');
	let hasPrimedVideo = $state(false);

	const keyMomentStart = 27.8;
	const keyMomentEnd = 30.8;

	const groupOptions: Array<{ id: GroupId; label: string; deck: string }> = [
		{ id: 'all', label: 'All', deck: 'Every run' },
		{ id: 'winner', label: 'Production', deck: 'Best synced output' },
		{ id: 'bad-timing', label: 'Bad timing', deck: 'Good text, poor segmentation' },
		{ id: 'timed-errors', label: 'Timed errors', deck: 'Usable clocks, weaker words' },
		{ id: 'hardsub', label: 'Hardsubs', deck: 'OCR and video prompts' },
		{ id: 'local', label: 'Local', deck: 'Open models on-device' }
	];

	const modelMeta: Record<string, ModelMeta> = {
		'app-stt': {
			group: 'winner',
			groupLabel: 'Production baseline',
			rank: 0,
			grade: 'A',
			timing: '27 line segments',
			verdict: 'The app transcript now mirrors the Gemini Flash audio-only result for this reel.',
			role: 'What users currently see in Kiokun.'
		},
		'gemini-25-flash-audio-only': {
			group: 'winner',
			groupLabel: 'Best result',
			rank: 1,
			grade: 'A',
			timing: '27 line segments',
			verdict: 'Best balance of Japanese text, phrase timing, and reel-style robustness.',
			role: 'Recommended default for short Japanese reels.'
		},
		'soniox-stt-async-v4': {
			group: 'bad-timing',
			groupLabel: 'Strong text, coarse timing',
			rank: 2,
			grade: 'B+',
			timing: '5 broad segments',
			verdict: 'Caught the hard line, but most of the reel is packed into a single giant block.',
			role: 'Useful as a full-transcript validator, not ideal for word-by-word reel UI.'
		},
		'openai-gpt-4o-mini-transcribe': {
			group: 'bad-timing',
			groupLabel: 'Good text, no alignment',
			rank: 3,
			grade: 'B+',
			timing: '1 full-length segment',
			verdict: 'Clean text for a cheap second opinion, but it needs a separate aligner.',
			role: 'Candidate for transcript cleanup or disagreement checks.'
		},
		'openai-gpt-4o-transcribe': {
			group: 'bad-timing',
			groupLabel: 'Good text, no alignment',
			rank: 4,
			grade: 'B',
			timing: '1 full-length segment',
			verdict: 'Good overall transcript, but the single segment makes it unusable by itself for synced captions.',
			role: 'Useful if paired with forced alignment.'
		},
		'openai-gpt-4o-transcribe-diarize': {
			group: 'timed-errors',
			groupLabel: 'Timed but fragile',
			rank: 5,
			grade: 'B-',
			timing: '26 timed segments',
			verdict: 'The timing is attractive, but it dropped part of the key phrase.',
			role: 'Not better than Flash for this kind of reel.'
		},
		'openai-whisper-1': {
			group: 'bad-timing',
			groupLabel: 'Coarse Whisper baseline',
			rank: 6,
			grade: 'C+',
			timing: '5 broad segments',
			verdict: 'The text is recognizable, but the first segment covers more than half the clip.',
			role: 'Baseline only.'
		},
		'elevenlabs-scribe-v2': {
			group: 'bad-timing',
			groupLabel: 'Coarse commercial ASR',
			rank: 7,
			grade: 'C+',
			timing: '4 broad segments',
			verdict: 'Found the shout line, but made obvious substitutions earlier.',
			role: 'Not a production win on this sample.'
		},
		'google-chirp3': {
			group: 'bad-timing',
			groupLabel: 'Single-block ASR',
			rank: 8,
			grade: 'C',
			timing: '1 full-length segment',
			verdict: 'The text was not strong here, including a bad miss on 叫んで.',
			role: 'Needs more samples before trusting it for reels.'
		},
		'qwen3-asr-1.7b': {
			group: 'local',
			groupLabel: 'Local open model',
			rank: 9,
			grade: 'C',
			timing: '16 aligned segments',
			verdict: 'The forced aligner worked, but the transcript had too many Japanese substitutions.',
			role: 'Promising tooling, not the winner on noisy reel speech.'
		},
		'mlx-whisper-large-v3-turbo': {
			group: 'local',
			groupLabel: 'Local Whisper',
			rank: 10,
			grade: 'C',
			timing: '22 timed segments',
			verdict: 'Fast local baseline, but it confused 橋 and 端 and warped several phrases.',
			role: 'Good for a privacy fallback, not accuracy leader.'
		},
		'gemini-25-flash-lite-audio-only': {
			group: 'timed-errors',
			groupLabel: 'Cheap but drifted',
			rank: 11,
			grade: 'C-',
			timing: '29 line segments',
			verdict: 'The shape looked good, but the content drifted at the important moment.',
			role: 'Cheaper, but too risky for production captions.'
		},
		'deepgram-nova3': {
			group: 'timed-errors',
			groupLabel: 'Segmented but tokenized badly',
			rank: 12,
			grade: 'D',
			timing: '10 broad segments',
			verdict: 'Japanese came back with strange spacing and substitutions.',
			role: 'Not competitive on this clip.'
		},
		'hf-kotoba-whisper-v2': {
			group: 'local',
			groupLabel: 'Japanese-tuned local model',
			rank: 13,
			grade: 'D',
			timing: '19 segments',
			verdict: 'It repeated and hallucinated around the middle of the reel.',
			role: 'Worth retesting with a cleaner setup, but this run failed.'
		},
		'reazonspeech-k2-v2': {
			group: 'local',
			groupLabel: 'Japanese local baseline',
			rank: 14,
			grade: 'D',
			timing: '5 segments',
			verdict: 'Missed large parts and collapsed the middle into one block.',
			role: 'Not useful for this reel without more tuning.'
		},
		'paddle-ppocrv5': {
			group: 'hardsub',
			groupLabel: 'OCR signal',
			rank: 15,
			grade: 'B as OCR',
			timing: '55 frame OCR ranges',
			verdict: 'Good for reading visible burned-in text, but it is not the spoken transcript.',
			role: 'Auxiliary signal for hardsubbed clips.'
		},
		'gemini-25-flash': {
			group: 'hardsub',
			groupLabel: 'Video prompt',
			rank: 16,
			grade: 'C+',
			timing: '30 segments',
			verdict: 'Video context helped with visible captions, but audio-only still won.',
			role: 'Useful for hardsub extraction experiments.'
		},
		'gemini-25-flash-fused': {
			group: 'hardsub',
			groupLabel: 'Audio plus hardsub prompt',
			rank: 17,
			grade: 'C+',
			timing: '35 segments',
			verdict: 'Fusing signals can recover on-screen text, but it also injects visual noise.',
			role: 'A fallback, not a default.'
		},
		'gemini-25-flash-lite': {
			group: 'hardsub',
			groupLabel: 'Lite video prompt',
			rank: 18,
			grade: 'D',
			timing: '44 segments',
			verdict: 'Too many uncertain or wrong subtitles.',
			role: 'Not reliable enough here.'
		},
		'gemini-25-flash-lite-fused': {
			group: 'hardsub',
			groupLabel: 'Lite fused prompt',
			rank: 19,
			grade: 'D',
			timing: '38 segments',
			verdict: 'Cheaper multimodal fusion drifted badly at the key line.',
			role: 'Not recommended.'
		}
	};

	function metaFor(track: TranscriptTrack): ModelMeta {
		return modelMeta[track.id] ?? {
			group: 'timed-errors',
			groupLabel: 'Untyped result',
			rank: 99,
			grade: '?',
			timing: `${track.segments.length} segments`,
			verdict: 'No manual note yet.',
			role: 'Needs review.'
		};
	}

	const annotatedTracks = $derived(
		data.tracks
			.map((track) => ({ track, meta: metaFor(track) }))
			.sort((a, b) => a.meta.rank - b.meta.rank || a.track.label.localeCompare(b.track.label))
	);

	const filteredTracks = $derived(
		annotatedTracks.filter(({ meta }) => selectedGroup === 'all' || meta.group === selectedGroup)
	);

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
	}

	function primeVideo() {
		if (!videoElement) return;
		if (!hasPrimedVideo) {
			videoElement.currentTime = keyMomentStart;
			currentTime = keyMomentStart;
			hasPrimedVideo = true;
		}
	}

	function seekTo(seconds: number) {
		if (videoElement) videoElement.currentTime = seconds;
		currentTime = seconds;
	}

	function scrub(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		seekTo(Number(input.value));
	}

	function activeIndex(track: TranscriptTrack, time: number): number {
		if (track.segments.length === 0) return -1;
		if (track.segments.length === 1) return 0;

		const exact = track.segments.findIndex((segment) => (
			time >= segment.start_time && time < segment.end_time
		));
		if (exact >= 0) return exact;

		let latest = 0;
		for (let index = 0; index < track.segments.length; index += 1) {
			if (track.segments[index].start_time <= time) latest = index;
			if (track.segments[index].start_time > time) break;
		}
		return latest;
	}

	function activeSegment(track: TranscriptTrack): TranscriptSegment | undefined {
		const index = activeIndex(track, currentTime);
		return index >= 0 ? track.segments[index] : undefined;
	}

	function fullTranscript(track: TranscriptTrack): string {
		return track.segments.map((segment) => segment.text).join(' ').replace(/\s+/g, ' ').trim();
	}

	function keyExcerpt(track: TranscriptTrack): string {
		const overlapping = track.segments.filter((segment) => (
			segment.start_time <= keyMomentEnd && segment.end_time >= keyMomentStart
		));
		if (overlapping.length) {
			return overlapping.map((segment) => segment.text).join(' / ');
		}
		const text = fullTranscript(track);
		const index = text.indexOf('叫');
		if (index < 0) return text.slice(0, 96);
		return text.slice(Math.max(0, index - 28), index + 42);
	}

	function groupCount(group: GroupId): number {
		if (group === 'all') return annotatedTracks.length;
		return annotatedTracks.filter(({ meta }) => meta.group === group).length;
	}
</script>

<svelte:head>
	<title>Japanese Reel STT Benchmark — Kiokun</title>
	<meta
		name="description"
		content="A practical benchmark of 20 speech-to-text, OCR, and multimodal models on one noisy Japanese reel, with synced transcripts and model-by-model notes."
	/>
</svelte:head>

<article>
	<header class="masthead">
		<a class="back" href="/blog">← Kiokun Notebook</a>
		<p class="kicker">Speech Recognition</p>
		<h1>Japanese reel transcription is a timing problem, not just a text problem</h1>
		<p class="deck">
			I ran twenty ASR, OCR, and multimodal variants against one short Japanese reel.
			The winner was not the model with the cleanest paragraph. It was the one that
			kept casual speech and line timing intact at the same time.
		</p>
		<p class="byline">
			<span>Kiokun Engineering</span><span class="dot">·</span><span>Japanese STT</span
			><span class="dot">·</span><span>May 26, 2026</span>
		</p>
	</header>

	<section class="hero-lab">
		<div class="video-column">
			<!-- svelte-ignore a11y_media_has_caption -->
			<video
				bind:this={videoElement}
				class="video"
				src={data.videoUrl}
				controls
				playsinline
				onloadedmetadata={primeVideo}
				ontimeupdate={syncTime}
				onseeking={syncTime}
			></video>
			<div class="scrubber">
				<span>{formatTime(currentTime)}</span>
				<input
					type="range"
					min="0"
					max={data.duration}
					step="0.05"
					value={currentTime}
					aria-label="Scrub benchmark video"
					oninput={scrub}
				/>
				<span>{formatTime(data.duration)}</span>
			</div>
			<div class="jump-row" aria-label="Jump points">
				<button type="button" onclick={() => seekTo(0.8)}>setup</button>
				<button type="button" onclick={() => seekTo(27.8)}>叫んで</button>
				<button type="button" onclick={() => seekTo(35.2)}>ユニコーン</button>
			</div>
		</div>

		<div class="finding-panel">
			<p class="eyebrow">Result</p>
			<h2>Gemini 2.5 Flash audio-only is the current production default.</h2>
			<p>
				It was the only run that gave Kiokun what the reel UI actually needs:
				a strong Japanese transcript, natural line boundaries, and enough timing
				granularity for the active word strip to move smoothly through the video.
			</p>
			<div class="winner-line">
				<span>{formatTime(keyMomentStart)}</span>
				<strong>え、とりあえず叫んで、叫んで。</strong>
			</div>
			<p class="small">
				This is a one-reel field test, not a universal leaderboard. The point is the
				shape of the failures: models often got either the words or the timing, but
				not both.
			</p>
		</div>
	</section>

	<div class="prose">
		<Reveal as="section">
			<p class="lede">
				<span class="dropcap">R</span>eels are hostile to ordinary speech recognition.
				The audio is short, compressed, casual, and often mixed with background music.
				The speech is clipped and context-dependent. For Kiokun, raw text is not enough:
				the transcript has to scroll line by line, expose clickable Japanese words, and
				stay aligned as a learner scrubs the video.
			</p>
			<p>
				That changes the benchmark. A model that returns one beautiful paragraph is
				less useful than a slightly messier model with phrase-level timing. A hardsub
				reader can be accurate for on-screen captions and still miss what was spoken
				between captions. A local model can expose token timestamps and still lose the
				meaning if it hears <em>橋</em> as <em>端</em>.
			</p>
		</Reveal>

		<Reveal as="section">
			<h2><span class="num">I</span> The test clip</h2>
			<p>
				The clip is a Japanese comedy-style conversation about trying to meet at
				Miyashita Park. The key stress test is around 28 seconds, where the speaker says
				<em>え、とりあえず叫んで、叫んで。</em> Models that split <em>叫んで</em> badly,
				replace it with another verb, or put the line in a giant 30-second block are
				not good enough for the reel interface.
			</p>
			<p>
				I tested hosted ASR APIs, local ASR models, OCR on the burned-in subtitles, and
				video or fused prompts that could see both the frames and the audio. The table
				below is deliberately qualitative. For this product, the practical score is:
				Can it drive the UI without another alignment or cleanup pass?
			</p>
		</Reveal>
	</div>

	<section class="scoreboard" aria-label="Model ranking">
		<div class="score-head">
			<p class="eyebrow">20 runs</p>
			<h2>What each model was good for</h2>
		</div>
		<div class="score-grid">
			{#each annotatedTracks as { track, meta }}
				<article class="score-row">
					<span class="rank">{meta.rank === 0 ? 'app' : `#${meta.rank}`}</span>
					<div>
						<h3>{track.label}</h3>
						<p>{meta.verdict}</p>
					</div>
					<span class="grade">{meta.grade}</span>
					<span class="timing">{meta.timing}</span>
				</article>
			{/each}
		</div>
	</section>

	<div class="prose">
		<Reveal as="section">
			<h2><span class="num">II</span> The failure groups matter more than the brand names</h2>
			<p>
				The cleanest split was not between cloud and local models. It was between
				<em>aligned transcripts</em> and <em>paragraph transcripts</em>. OpenAI
				<code>gpt-4o-transcribe</code>, OpenAI <code>gpt-4o-mini-transcribe</code>,
				Google Chirp 3, Soniox, ElevenLabs, Whisper, and Reazon all had some version
				of the same product problem: too much of the reel was returned as one large
				block. That may be fine for a notes app. It is not fine for a word-by-word
				learning overlay.
			</p>
			<p>
				The second failure group had timing but weak Japanese. Qwen3-ASR with its forced
				aligner did produce timestamps locally, which is impressive, but the text had
				errors like <em>中小的</em>, <em>怖い家</em>, and <em>ハマクシル</em>. MLX Whisper,
				Kotoba-Whisper, Deepgram, and Flash-Lite had similar trouble: the clock moved,
				but the words were not reliable enough.
			</p>
			<p>
				The third group was the hardsub path. OCR and video models can read visible text,
				and that is valuable when captions are burned into the reel. But hardsubs are
				not the same as a complete transcript. They include overlay text, omit spoken
				filler, and can pull the model toward what is visible rather than what is audible.
			</p>
		</Reveal>
	</div>

	<section class="interactive">
		<div class="interactive-head">
			<div>
				<p class="eyebrow">Interactive transcripts</p>
				<h2>Scrub the video, then compare the active line</h2>
			</div>
			<div class="filters" aria-label="Model groups">
				{#each groupOptions as option}
					<button
						type="button"
						class:active={selectedGroup === option.id}
						onclick={() => (selectedGroup = option.id)}
					>
						<span>{option.label}</span>
						<small>{option.deck} · {groupCount(option.id)}</small>
					</button>
				{/each}
			</div>
		</div>

		<div class="model-grid">
			{#each filteredTracks as { track, meta }}
				{@const active = activeSegment(track)}
				<article class={`model-card group-${meta.group}`}>
					<header>
						<div>
							<p class="model-group">{meta.groupLabel}</p>
							<h3>{track.label}</h3>
						</div>
						<span class="badge">{meta.grade}</span>
					</header>
					<p class="role">{meta.role}</p>
					<div class="active-line">
						<span>{active ? `${formatTime(active.start_time)}-${formatTime(active.end_time)}` : 'no line'}</span>
						<p>{active?.text ?? 'No active segment at this timestamp.'}</p>
					</div>
					<div class="key-line">
						<span>Key moment</span>
						<p>{keyExcerpt(track)}</p>
					</div>
					<details>
						<summary>Full transcript ({track.segments.length} segments)</summary>
						<p>{fullTranscript(track)}</p>
					</details>
				</article>
			{/each}
		</div>
	</section>

	<div class="prose">
		<Reveal as="section">
			<h2><span class="num">III</span> What this says about Japanese STT right now</h2>
			<p>
				For clean Japanese audio, many modern ASR models are good. For short-form
				Japanese speech, the harder problem is the product shape around the transcript:
				casual contractions, slang, speaker interruptions, background music, and
				timestamps that are useful at line or word level. The best model for a podcast
				transcript is not automatically the best model for an educational reel.
			</p>
			<p>
				The result also changes how I would design the production pipeline. I would not
				start by sending every frame to a video model. I would run an audio-first model
				that can produce phrase timings, keep OCR as a secondary signal for hardsubs,
				and reserve a second ASR model for disagreement checks on high-value clips.
				When a provider returns only one paragraph, it needs forced alignment before it
				can power the Kiokun overlay.
			</p>
			<blockquote>
				For this reel, the winning feature was not "knows Japanese." It was "knows
				Japanese and stays synced while people yell over a compressed social video."
			</blockquote>
		</Reveal>

		<Reveal as="section">
			<h2><span class="num">IV</span> The practical stack</h2>
			<p>
				Current default: <b>Gemini 2.5 Flash audio-only</b>. It gives the best blend of
				accuracy and timing on the sample. The app transcript for this reel now uses it.
			</p>
			<p>
				Useful secondary checks: <b>Soniox</b> and <b>OpenAI gpt-4o-mini-transcribe</b>.
				Soniox had strong text but coarse segmentation. OpenAI mini had a good paragraph
				but no useful timing. Either can help flag disagreements, but neither should
				directly drive the scrolling transcript UI without alignment.
			</p>
			<p>
				Hardsub route: <b>PaddleOCR first</b>, then a hosted vision/OCR fallback only
				for low-confidence frames. OCR is a good way to recover burned-in Japanese text,
				but it should be treated as evidence, not the final spoken transcript.
			</p>
			<p>
				Local route: <b>Qwen3-ASR is the one to watch</b>. The forced aligner is the most
				interesting piece of local tooling tested here. The text was not good enough on
				this clip, but the alignment story is much stronger than plain Whisper-style
				paragraph output.
			</p>
		</Reveal>

		<Reveal as="footer">
			<a class="back foot" href="/blog">← More from the Kiokun Notebook</a>
		</Reveal>
	</div>
</article>

<style>
	article {
		padding: clamp(2rem, 7vw, 5.5rem) var(--gutter) 6rem;
	}

	.masthead,
	.prose {
		max-width: var(--measure);
		margin-inline: auto;
	}

	.back {
		display: inline-block;
		margin-bottom: 2.2rem;
		font-family: var(--label);
		font-size: 0.8rem;
		color: var(--ink-faint);
		text-decoration: none;
	}

	.back:hover {
		color: var(--shu);
	}

	.kicker,
	.eyebrow,
	.model-group {
		margin: 0;
		font-family: var(--label);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--shu);
	}

	h1,
	h2,
	h3 {
		font-family: var(--display);
		letter-spacing: 0;
		color: var(--ink);
	}

	h1 {
		margin: 0.8rem 0 0;
		font-size: clamp(2.5rem, 7.5vw, 5.9rem);
		line-height: 0.98;
		font-weight: 650;
	}

	.deck {
		margin: 1.5rem 0 0;
		max-width: 44rem;
		font-size: clamp(1.08rem, 2.2vw, 1.36rem);
		line-height: 1.55;
		color: var(--ink-soft);
	}

	.byline {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
		margin: 1.3rem 0 0;
		font-family: var(--label);
		font-size: 0.8rem;
		color: var(--ink-faint);
	}

	.hero-lab,
	.scoreboard,
	.interactive {
		max-width: 76rem;
		margin: clamp(3rem, 8vw, 5.5rem) auto;
	}

	.hero-lab {
		display: grid;
		grid-template-columns: minmax(260px, 380px) minmax(0, 1fr);
		gap: clamp(1.5rem, 5vw, 4rem);
		align-items: center;
	}

	.video-column {
		width: 100%;
	}

	.video {
		display: block;
		width: 100%;
		aspect-ratio: 9 / 16;
		max-height: 72vh;
		object-fit: cover;
		background: #000;
		border-radius: 8px;
		box-shadow: 0 24px 70px rgba(0, 0, 0, 0.22);
	}

	.scrubber {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: 0.75rem;
		align-items: center;
		margin-top: 0.9rem;
		font-family: var(--label);
		font-size: 0.78rem;
		color: var(--ink-faint);
	}

	.scrubber input {
		width: 100%;
		accent-color: var(--shu);
	}

	.jump-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.85rem;
	}

	button {
		font: inherit;
	}

	.jump-row button,
	.filters button {
		border: 1px solid var(--rule);
		background: var(--paper);
		color: var(--ink-soft);
		border-radius: 8px;
		cursor: pointer;
	}

	.jump-row button {
		padding: 0.5rem 0.75rem;
		font-family: var(--label);
		font-size: 0.78rem;
	}

	.jump-row button:hover,
	.filters button:hover,
	.filters button.active {
		border-color: var(--shu);
		color: var(--ink);
		background: var(--shu-wash);
	}

	.finding-panel {
		border-top: 1px solid var(--rule);
		border-bottom: 1px solid var(--rule);
		padding: clamp(1.4rem, 4vw, 2.2rem) 0;
	}

	.finding-panel h2,
	.score-head h2,
	.interactive-head h2 {
		margin: 0.7rem 0 0;
		font-size: clamp(1.8rem, 4.5vw, 3.2rem);
		line-height: 1.05;
	}

	.finding-panel p,
	.prose p,
	.prose blockquote {
		font-size: 1.05rem;
		line-height: 1.72;
		color: var(--ink-soft);
	}

	.winner-line {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 0.8rem;
		margin: 1.4rem 0;
		padding: 1rem;
		background: var(--paper-2);
		border: 1px solid var(--rule);
		border-radius: 8px;
	}

	.winner-line span {
		font-family: var(--mono);
		color: var(--ink-faint);
	}

	.winner-line strong {
		font-size: clamp(1.2rem, 3vw, 1.8rem);
		line-height: 1.45;
		color: var(--ink);
	}

	.small {
		font-size: 0.93rem !important;
	}

	.prose {
		margin-top: clamp(3rem, 8vw, 5rem);
	}

	.lede {
		font-size: clamp(1.15rem, 2.3vw, 1.35rem) !important;
		color: var(--ink) !important;
	}

	.dropcap {
		float: left;
		font-family: var(--display);
		font-size: 4.6rem;
		line-height: 0.82;
		padding: 0.12rem 0.5rem 0 0;
		color: var(--shu);
	}

	.prose h2 {
		margin: 0 0 1rem;
		font-size: clamp(1.7rem, 4vw, 2.7rem);
		line-height: 1.08;
	}

	.num {
		display: inline-block;
		margin-right: 0.65rem;
		color: var(--shu);
		font-size: 0.82em;
	}

	.prose code {
		font-family: var(--mono);
		font-size: 0.92em;
		background: var(--paper-2);
		border: 1px solid var(--rule);
		border-radius: 6px;
		padding: 0.08rem 0.3rem;
	}

	.prose blockquote {
		margin: 1.8rem 0;
		padding: 1rem 0 1rem 1.2rem;
		border-left: 3px solid var(--shu);
		color: var(--ink);
	}

	.scoreboard {
		border-top: 1px solid var(--rule);
		border-bottom: 1px solid var(--rule);
		padding: clamp(1.4rem, 4vw, 2rem) 0;
	}

	.score-head {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: end;
		margin-bottom: 1rem;
	}

	.score-grid {
		display: grid;
		gap: 0.5rem;
	}

	.score-row {
		display: grid;
		grid-template-columns: 3rem minmax(0, 1fr) 4rem 8.5rem;
		gap: 1rem;
		align-items: center;
		padding: 0.85rem 0;
		border-top: 1px solid color-mix(in srgb, var(--rule) 72%, transparent);
	}

	.score-row h3,
	.model-card h3 {
		margin: 0;
		font-size: 1.05rem;
		line-height: 1.25;
	}

	.score-row p {
		margin: 0.2rem 0 0;
		color: var(--ink-soft);
		line-height: 1.45;
	}

	.rank,
	.grade,
	.timing {
		font-family: var(--label);
		font-size: 0.78rem;
		color: var(--ink-faint);
	}

	.grade {
		justify-self: start;
		min-width: 2.5rem;
		padding: 0.25rem 0.45rem;
		border: 1px solid var(--rule);
		border-radius: 6px;
		text-align: center;
		color: var(--ink);
	}

	.timing {
		justify-self: end;
		text-align: right;
	}

	.interactive {
		padding-top: clamp(1rem, 4vw, 2rem);
	}

	.interactive-head {
		display: grid;
		grid-template-columns: minmax(0, 0.9fr) minmax(360px, 1.3fr);
		gap: clamp(1rem, 4vw, 2rem);
		align-items: end;
		margin-bottom: 1.2rem;
	}

	.filters {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.5rem;
	}

	.filters button {
		padding: 0.65rem 0.75rem;
		text-align: left;
	}

	.filters span,
	.filters small {
		display: block;
	}

	.filters span {
		font-weight: 700;
		color: var(--ink);
	}

	.filters small {
		margin-top: 0.2rem;
		font-size: 0.72rem;
		color: var(--ink-faint);
	}

	.model-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}

	.model-card {
		border: 1px solid var(--rule);
		border-radius: 8px;
		background: var(--paper);
		padding: 1rem;
	}

	.model-card header {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: start;
	}

	.badge {
		flex: 0 0 auto;
		border: 1px solid var(--rule);
		border-radius: 999px;
		padding: 0.25rem 0.55rem;
		font-family: var(--label);
		font-size: 0.72rem;
		color: var(--ink);
		background: var(--paper-2);
	}

	.role {
		margin: 0.75rem 0 0;
		color: var(--ink-soft);
		line-height: 1.5;
	}

	.active-line,
	.key-line {
		margin-top: 0.9rem;
		padding: 0.85rem;
		border-radius: 8px;
		background: var(--paper-2);
	}

	.active-line span,
	.key-line span {
		display: block;
		font-family: var(--mono);
		font-size: 0.72rem;
		color: var(--ink-faint);
	}

	.active-line p,
	.key-line p {
		margin: 0.45rem 0 0;
		font-size: 1.02rem;
		line-height: 1.55;
		color: var(--ink);
		overflow-wrap: anywhere;
	}

	.key-line {
		background: color-mix(in srgb, var(--shu-wash) 58%, var(--paper));
	}

	details {
		margin-top: 0.85rem;
		border-top: 1px solid var(--rule);
		padding-top: 0.8rem;
	}

	summary {
		cursor: pointer;
		font-family: var(--label);
		font-size: 0.78rem;
		color: var(--ink-soft);
	}

	details p {
		margin: 0.75rem 0 0;
		max-height: 18rem;
		overflow: auto;
		font-size: 0.95rem;
		line-height: 1.7;
		color: var(--ink-soft);
		white-space: pre-wrap;
	}

	.foot {
		margin-top: 1.5rem;
	}

	@media (max-width: 980px) {
		.hero-lab,
		.interactive-head {
			grid-template-columns: 1fr;
		}

		.video-column {
			max-width: 380px;
			margin-inline: auto;
		}

		.model-grid,
		.filters {
			grid-template-columns: 1fr;
		}

		.score-row {
			grid-template-columns: 2.8rem minmax(0, 1fr) 3.5rem;
		}

		.timing {
			grid-column: 2 / -1;
			justify-self: start;
			text-align: left;
		}
	}

	@media (max-width: 640px) {
		article {
			padding-inline: 1rem;
		}

		.score-head {
			display: block;
		}

		.score-row {
			grid-template-columns: 2.5rem minmax(0, 1fr);
		}

		.grade,
		.timing {
			grid-column: 2;
			justify-self: start;
		}
	}
</style>
