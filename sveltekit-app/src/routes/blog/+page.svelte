<script module lang="ts">
	export const prerender = true;
</script>

<script lang="ts">
	import Reveal from '$lib/blog/Reveal.svelte';

	const posts = [
		{
			slug: 'japanese-reel-stt-benchmark',
			kicker: 'Speech Recognition',
			title: 'Japanese reel transcription is a timing problem',
			deck:
				'Twenty ASR, OCR, and multimodal runs on one noisy Japanese reel, with synced transcripts and the failure modes grouped by what broke.',
			read: '18 min',
			n: 2
		},
		{
			slug: 'translation-model-bakeoff',
			kicker: 'Translation Quality',
			title: 'The sentence translation bakeoff',
			deck:
				'GPT-5.5, Claude, Gemini, and Cloudflare models against the bad example sentences already hiding in Kiokun.',
			read: '16 min',
			n: 3
		},
		{
			slug: 'semantic-mnemonic-bakeoff',
			kicker: 'Mnemonic Research',
			title: 'The mnemonic model bakeoff',
			deck:
				'Gemini, Claude, Gemma, OpenAI, and Cloudflare attempts at writing Kiokun-style kanji mnemonics, with every output published.',
			read: '14 min',
			n: 4
		},
		{
			slug: 'the-data-engine',
			kicker: 'Infrastructure',
			title: 'The dictionary that hosts itself',
			deck:
				'435,000 files, no storage bill, and a build that runs without me — a hash and a git push.',
			read: '12 min',
			n: 1
		}
	];
</script>

<svelte:head>
	<title>The Kiokun Notebook</title>
</svelte:head>

<main>
	<header class="head">
		<Reveal as="div">
			<p class="brand">記憶</p>
			<h1>The Kiokun Notebook</h1>
			<p class="sub">
				Working notes on the machinery behind a Chinese · Japanese · Korean dictionary —
				data, type, and the unglamorous plumbing that makes it free.
			</p>
		</Reveal>
	</header>

	<Reveal as="ul">
		<ul class="list">
			{#each posts as p}
				<li>
					<a href={`/blog/${p.slug}`}>
						<span class="idx">{String(p.n).padStart(2, '0')}</span>
						<span class="body">
							<span class="kick">{p.kicker}</span>
							<span class="t">{p.title}</span>
							<span class="d">{p.deck}</span>
							<span class="meta">{p.read} read <span class="arrow">→</span></span>
						</span>
					</a>
				</li>
			{/each}
		</ul>
	</Reveal>

	<footer>
		<a href="/">← Back to the dictionary</a>
	</footer>
</main>

<style>
	main {
		max-width: 44rem;
		margin-inline: auto;
		padding: clamp(2.5rem, 9vw, 7rem) var(--gutter) 6rem;
	}
	.brand {
		font-family: var(--display);
		font-size: 1.4rem;
		color: var(--shu);
		margin: 0 0 1.4rem;
		letter-spacing: 0.1em;
	}
	h1 {
		margin: 0;
		font-family: var(--display);
		font-weight: 600;
		font-size: clamp(2.25rem, 6vw, 4.1rem);
		line-height: 1.06;
		letter-spacing: -0.025em;
		color: var(--ink);
	}
	.sub {
		margin: 1.5rem 0 0;
		max-width: 30rem;
		font-size: clamp(1.05rem, 2.2vw, 1.3rem);
		line-height: 1.55;
		color: var(--ink-soft);
	}
	.list {
		list-style: none;
		margin: clamp(3rem, 9vw, 5.5rem) 0 0;
		padding: 0;
		border-top: 1px solid var(--rule);
	}
	.list li {
		border-bottom: 1px solid var(--rule);
	}
	.list a {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: clamp(1rem, 4vw, 2.6rem);
		padding: clamp(1.6rem, 4vw, 2.4rem) 0.4rem;
		text-decoration: none;
		color: inherit;
		transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
	}
	.list a:hover {
		transform: translateX(0.7rem);
	}
	.idx {
		font-family: var(--display);
		font-size: 1.05rem;
		color: var(--ink-faint);
		font-variant-numeric: tabular-nums;
		padding-top: 0.45rem;
	}
	.list a:hover .idx {
		color: var(--shu);
	}
	.body {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.kick {
		font-family: var(--label);
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--shu);
	}
	.t {
		font-family: var(--display);
		font-weight: 600;
		font-size: clamp(1.28rem, 2.6vw, 1.85rem);
		line-height: 1.12;
		letter-spacing: -0.015em;
		color: var(--ink);
	}
	.d {
		font-size: 1.05rem;
		line-height: 1.55;
		color: var(--ink-soft);
		max-width: 30rem;
	}
	.meta {
		margin-top: 0.35rem;
		font-family: var(--label);
		font-size: 0.78rem;
		letter-spacing: 0.05em;
		color: var(--ink-faint);
	}
	.arrow {
		display: inline-block;
		transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
	}
	.list a:hover .arrow {
		transform: translateX(6px);
		color: var(--shu);
	}
	footer {
		margin-top: 3.5rem;
		font-family: var(--label);
		font-size: 0.8rem;
	}
	footer a {
		color: var(--ink-faint);
		text-decoration: none;
	}
	footer a:hover {
		color: var(--shu);
	}
	@media (prefers-reduced-motion: reduce) {
		.list a,
		.arrow {
			transition: none;
		}
	}
</style>
