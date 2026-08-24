<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let artifact = $derived(data.artifact);

	type Token = {
		surface: string;
		reading?: string | null;
		meaning: string;
		wordSlug?: string | null;
	};

	function dictionaryHref(token: Token): string | null {
		if (!token.wordSlug) return null;
		return `/${encodeURIComponent(token.wordSlug)}`;
	}
</script>

<Header />

<main class="artifact-page">
	<header class="artifact-header">
		<div class="eyebrow">Japanese artifact</div>
		<h1>{artifact.title}</h1>
		{#if artifact.description}
			<p class="dek">{artifact.description}</p>
		{/if}
		<div class="meta">
			{#if artifact.publishedAt}<span>{artifact.publishedAt}</span>{/if}
			{#if artifact.sourceUrl}
				<a href={artifact.sourceUrl} target="_blank" rel="noreferrer">Source ↗</a>
			{/if}
		</div>
	</header>

	<article class="blocks">
		{#each artifact.blocks as block}
			{#if block.type === 'image'}
				<figure class="image-block">
					<img
						src={block.src}
						alt={block.alt}
						width={block.width}
						height={block.height}
						loading="eager"
						fetchpriority="high"
						decoding="async"
					/>
					{#if block.caption}<figcaption>{block.caption}</figcaption>{/if}
				</figure>
			{:else if block.type === 'sentence'}
				<section class="sentence-block" lang="ja">
					<div class="sentence-label">{block.original}</div>
					<div class="tokens" aria-label={`Word-by-word breakdown of ${block.original}`}>
						{#each block.tokens as token}
							{@const href = dictionaryHref(token)}
							<div class="token-group">
								<div class="reading">{token.reading || '\u00a0'}</div>
								{#if href}
									<a class="surface" href={href}>{token.surface}</a>
								{:else}
									<span class="surface">{token.surface}</span>
								{/if}
								<div class="meaning" lang="en">{token.meaning}</div>
							</div>
						{/each}
					</div>

					<div class="translation" lang="en">
						{#if block.literalTranslation}
							<div><span>Literal</span>{block.literalTranslation}</div>
						{/if}
						<div><span>Natural</span>{block.translation}</div>
					</div>
					{#if block.note}<p class="sentence-note" lang="en">{block.note}</p>{/if}
				</section>
			{:else}
				<section class="prose-block" lang="en">
					{#if block.heading}<h2>{block.heading}</h2>{/if}
					<p>{block.body}</p>
				</section>
			{/if}
		{/each}
	</article>
</main>

<style>
	:global(body) {
		margin: 0;
		background: var(--background, #0d0f12);
		color: var(--foreground, #f4f4f2);
	}

	.artifact-page {
		width: min(920px, calc(100% - 32px));
		margin: 0 auto;
		padding: 56px 0 96px;
	}

	.artifact-header {
		max-width: 760px;
		margin-bottom: 34px;
	}

	.eyebrow {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		opacity: 0.52;
		margin-bottom: 10px;
	}

	h1 {
		font-size: clamp(30px, 5vw, 48px);
		line-height: 1.08;
		letter-spacing: -0.035em;
		margin: 0;
	}

	.dek {
		font-size: 17px;
		line-height: 1.6;
		opacity: 0.74;
		margin: 14px 0 0;
	}

	.meta {
		display: flex;
		gap: 14px;
		align-items: center;
		margin-top: 14px;
		font-size: 13px;
		opacity: 0.58;
	}

	.meta a { color: inherit; text-decoration: underline; text-underline-offset: 3px; }

	.blocks {
		display: grid;
		gap: 22px;
	}

	.image-block {
		margin: 0;
		border-radius: 16px;
		overflow: hidden;
		background: color-mix(in srgb, currentColor 5%, transparent);
	}

	.image-block img {
		display: block;
		width: 100%;
		height: auto;
	}

	.image-block figcaption {
		padding: 10px 14px 12px;
		font-size: 12px;
		opacity: 0.6;
	}

	.sentence-block,
	.prose-block {
		border: 1px solid color-mix(in srgb, currentColor 13%, transparent);
		background: color-mix(in srgb, currentColor 4%, transparent);
		border-radius: 16px;
		padding: 22px;
	}

	.sentence-label {
		font-size: clamp(21px, 4vw, 29px);
		font-weight: 650;
		letter-spacing: -0.02em;
		margin-bottom: 20px;
	}

	.tokens {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: flex-start;
	}

	.token-group {
		display: grid;
		grid-template-rows: 17px auto auto;
		text-align: center;
		min-width: 50px;
		padding: 4px 7px 7px;
		border-radius: 9px;
		background: color-mix(in srgb, currentColor 4%, transparent);
	}

	.reading {
		font-size: 11px;
		line-height: 17px;
		opacity: 0.54;
	}

	.surface {
		font-size: 21px;
		line-height: 1.25;
		font-weight: 650;
		color: inherit;
		text-decoration: none;
		border-bottom: 1px dotted color-mix(in srgb, currentColor 34%, transparent);
	}

	a.surface:hover { border-bottom-style: solid; }

	.meaning {
		max-width: 110px;
		font-size: 10px;
		line-height: 1.25;
		opacity: 0.58;
		margin-top: 5px;
	}

	.translation {
		display: grid;
		gap: 8px;
		margin-top: 20px;
		padding-top: 16px;
		border-top: 1px solid color-mix(in srgb, currentColor 11%, transparent);
		font-size: 15px;
		line-height: 1.5;
	}

	.translation div {
		display: grid;
		grid-template-columns: 58px 1fr;
		gap: 10px;
	}

	.translation span {
		font-size: 10px;
		font-weight: 750;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		opacity: 0.42;
		padding-top: 4px;
	}

	.sentence-note,
	.prose-block p {
		font-size: 15px;
		line-height: 1.7;
		margin: 16px 0 0;
		opacity: 0.78;
	}

	.prose-block h2 {
		font-size: 18px;
		margin: 0;
	}

	.prose-block p:first-child { margin-top: 0; }

	@media (max-width: 600px) {
		.artifact-page { width: min(100% - 20px, 920px); padding-top: 28px; }
		.sentence-block, .prose-block { padding: 16px; border-radius: 13px; }
		.image-block { border-radius: 13px; }
		.token-group { min-width: 44px; padding-inline: 5px; }
		.surface { font-size: 19px; }
		.meaning { font-size: 9px; max-width: 84px; }
	}
</style>
