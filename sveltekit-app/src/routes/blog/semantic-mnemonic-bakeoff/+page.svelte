<script lang="ts">
	import Reveal from '$lib/blog/Reveal.svelte';
	import type { BakeoffCharacter, MnemonicOutput, ModelResult, MnemonicBakeoffData } from './+page';

	let { data }: { data: MnemonicBakeoffData } = $props();

	const okResults = data.results.filter((result) => result.ok);
	const topScore = Math.max(...okResults.map((result) => result.score ?? 0));
	const bestResult = okResults.find((result) => result.score === topScore);
	const fullyValidResults = okResults.filter(
		(result) => result.valid_count === data.characters.length && (result.problem_count ?? 0) === 0
	);
	const bestFullyValid = [...fullyValidResults].sort(
		(a, b) => (b.score ?? 0) - (a.score ?? 0)
	)[0];
	const fastestFullyValid = [...fullyValidResults].sort(
		(a, b) => a.elapsed_seconds - b.elapsed_seconds
	)[0];

	let selectedProvider = $state('all');
	let selectedCharacter = $state(data.characters[0]?.character ?? 'all');
	let showFailures = $state(false);
	let showAllInputs = $state(false);

	const providerOptions = [
		{ id: 'all', label: 'All providers' },
		{ id: 'google', label: 'Google' },
		{ id: 'anthropic', label: 'Anthropic' },
		{ id: 'openai', label: 'OpenAI' },
		{ id: 'cloudflare', label: 'Cloudflare' }
	];

	const dataLinks = [
		{
			label: 'Expanded 22-character benchmark JSON',
			href: '/research/mnemonics/semantic_mnemonic_benchmark_22.json',
			github:
				'https://github.com/Kimeiga/kiokun-data/blob/main/sveltekit-app/static/research/mnemonics/semantic_mnemonic_benchmark_22.json',
			note: 'The primary dataset for this page: 22 high-signal characters across Gemini, Claude, Gemma, OpenAI, and Cloudflare attempts.'
		},
		{
			label: 'Original two-character smoke test JSON',
			href: '/research/mnemonics/semantic_mnemonic_bakeoff.json',
			github:
				'https://github.com/Kimeiga/kiokun-data/blob/main/sveltekit-app/static/research/mnemonics/semantic_mnemonic_bakeoff.json',
			note: 'The first narrow run over 連 and 憂, kept for comparison with the wider test.'
		},
		{
			label: 'Generated 1000-card JSON',
			href: '/research/mnemonics/semantic_mnemonics_1000.json',
			github:
				'https://github.com/Kimeiga/kiokun-data/blob/main/sveltekit-app/static/research/mnemonics/semantic_mnemonics_1000.json',
			note: 'The first large batch produced after choosing the practical default model.'
		},
		{
			label: 'Model report markdown',
			href: '/research/mnemonics/semantic_mnemonic_model_report.md',
			github:
				'https://github.com/Kimeiga/kiokun-data/blob/main/sveltekit-app/static/research/mnemonics/semantic_mnemonic_model_report.md',
			note: 'The earlier compact report from the first mnemonic model pass.'
		}
	];

	const modelNotes: Record<string, { tag: string; note: string }> = {
		'gemini-3.5-flash': {
			tag: 'Strong, batch-sensitive',
			note:
				'Scored well and stayed fast, but the 8-card benchmark batch had one strict component miss. A smaller-batch follow-up passed cleanly, so batch size matters.'
		},
		'gemini-3-pro-preview': {
			tag: 'Unavailable',
			note:
				'The configured preview model ID returned 404 in this run, so it was not part of the quality comparison.'
		},
		'gemini-3-flash-preview': {
			tag: 'JSON failure',
			note:
				'Started producing useful-looking cards, then broke the JSON contract. In a batch pipeline, that makes the run unusable without retry logic.'
		},
		'gemini-2.5-flash': {
			tag: 'Fastest clean run',
			note:
				'Finished the corrected 22-character run with zero validator problems and the fastest clean elapsed time, though its prose score trailed the leaders.'
		},
		'gemini-3.1-pro-preview': {
			tag: 'Top corrected score',
			note:
				'Won the corrected benchmark and passed all strict checks, but was slower than the Flash models and sits in a less practical tier for bulk generation.'
		},
		'gemini-3.1-flash-lite': {
			tag: 'Fast but leaky',
			note:
				'Very fast, but missed required component/gloss mentions often enough that it is not a safe default for mnemonic cards.'
		},
		'gemini-2.5-flash-lite': {
			tag: 'Parser-clean, card-brittle',
			note:
				'Returned parseable card objects, but failed the strict mnemonic contract across the benchmark.'
		},
		'gemini-2.5-pro': {
			tag: 'Clean and strong',
			note:
				'Produced a zero-problem run with a high score. It remains a quality contender when cost and latency are less important.'
		},
		'claude-sonnet-5': {
			tag: 'High prose score',
			note:
				'Scored near the top and tends to write good sentences, but missed one strict component mention in the corrected benchmark.'
		},
		'claude-opus-4-8': {
			tag: 'Clean and concise',
			note:
				'Passed all strict checks with a strong score and good elapsed time for a frontier model.'
		},
		'claude-haiku-4-5-20251001': {
			tag: 'Wrong card grammar',
			note:
				'Fast and parseable, but it did not preserve the required equation/component grammar.'
		},
		'gemma-4-31b-it': {
			tag: 'Format failure',
			note:
				'The model responded with task commentary instead of parseable JSON. That is expensive to recover from in a batch pipeline.'
		},
		'gemma-4-26b-a4b-it': {
			tag: 'Format failure',
			note:
				'Also failed the JSON contract. It may be usable with a different harness, but not in this strict output path.'
		},
		'gpt-5.5': {
			tag: 'Empty normalized output',
			note:
				'Returned an API response, but the normalized output contained no usable card objects for this harness. This needs prompt/API debugging before quality comparison.'
		},
		'gpt-5.5-pro': {
			tag: 'Empty normalized output',
			note:
				'Like GPT-5.5, it returned without usable normalized card objects. The score reflects harness failure, not a fair prose-quality judgment.'
		},
		'gpt-5.4': {
			tag: 'Quota failure',
			note: 'The local key hit quota before this model could be scored.'
		},
		'gpt-5.4-mini': {
			tag: 'Quota failure',
			note: 'The local key hit quota before this model could be scored.'
		},
		'gpt-5.4-nano': {
			tag: 'Quota failure',
			note: 'The local key hit quota before this model could be scored.'
		},
		'Workers AI text-generation discovery': {
			tag: 'Auth failure',
			note:
				'Cloudflare credentials were present, but Workers AI model discovery returned HTTP 403, so no Cloudflare model was scored.'
		}
	};

	function formatScore(score: number | undefined): string {
		return typeof score === 'number' ? score.toFixed(3) : '—';
	}

	function formatTime(seconds: number | undefined): string {
		return typeof seconds === 'number' ? `${seconds.toFixed(2)}s` : '—';
	}

	function formatCoverage(value: number | undefined): string {
		return typeof value === 'number' ? `${Math.round(value * 100)}%` : '—';
	}

	function providerLabel(provider: string): string {
		if (provider === 'google') return 'Google';
		if (provider === 'anthropic') return 'Anthropic';
		if (provider === 'openai') return 'OpenAI';
		if (provider === 'cloudflare') return 'Cloudflare';
		return provider;
	}

	function componentsText(components: Array<{ character: string; gloss: string }> | undefined): string {
		return (components ?? [])
			.map((component) => `${component.character} ${component.gloss}`)
			.join(' + ');
	}

	function equationFor(item: BakeoffCharacter): string {
		return `${componentsText(item.components)} = ${item.character} ${item.meaning}`;
	}

	function outputFor(result: ModelResult, character: string): MnemonicOutput | undefined {
		return result.outputs?.find((output) => output.character === character);
	}

	function validationFor(result: ModelResult, character: string) {
		return result.validations?.find((item) => item.card?.character === character);
	}

	function problemCount(result: ModelResult): number {
		return (result.validations ?? []).reduce(
			(total, validation) => total + (validation.problems?.length ?? 0),
			0
		);
	}

	function averageStyleScore(result: ModelResult): string {
		const scores = (result.validations ?? [])
			.map((validation) => validation.style_score)
			.filter((score): score is number => typeof score === 'number');
		if (!scores.length) return '—';
		return (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2);
	}

	function noteFor(result: ModelResult): { tag: string; note: string } {
		return (
			modelNotes[result.model] ?? {
				tag: result.ok ? 'Scored' : 'Run failed',
				note: result.ok
					? 'No hand-written note was attached to this model.'
					: 'The run did not produce comparable card output.'
			}
		);
	}

	function charactersForSelection(): BakeoffCharacter[] {
		if (selectedCharacter === 'all') return data.characters;
		return data.characters.filter((item) => item.character === selectedCharacter);
	}

	function visibleResults(): ModelResult[] {
		return data.results.filter((result) => {
			const providerMatch = selectedProvider === 'all' || result.provider === selectedProvider;
			const statusMatch = showFailures || result.ok;
			return providerMatch && statusMatch;
		});
	}
</script>

<main id="main-content">
<article>
	<header class="masthead">
		<a class="back" href="/blog">← Kiokun Notebook</a>
		<p class="kicker">Mnemonic Research</p>
		<h1>The mnemonic model bakeoff</h1>
		<p class="deck">
			We paid a handful of models to write the same 22 kanji mnemonics. The useful result
			was not just a leaderboard, but a map of what each model gets wrong when the card has
			to be short, visual, internally consistent, and mechanically parseable.
		</p>
		<p class="byline">
			<span>Kiokun Engineering</span><span class="dot">·</span><span>model evaluation</span
			><span class="dot">·</span><span>July 2, 2026</span>
		</p>
	</header>

	<div class="prose">
		<Reveal as="section">
			<p class="lede">
				<span class="dropcap">K</span>iokun's kanji cards are deliberately constrained.
				A mnemonic cannot simply be cute. It has to mention every visible component with
				the same canonical English gloss every time, make the final meaning feel inevitable,
				and avoid throwing pronunciation jokes into the semantic story. That is a narrow
				target for an LLM.
			</p>
			<p>
				This page publishes the actual outputs from the model test so the money spent on
				the bakeoff is not trapped in a private chat. The expanded prompt used 22
				high-signal characters: easy baselines like <code>連</code>, abstract cards like
				<code>憲</code>, awkward component data like <code>真</code> and <code>会</code>,
				and the Japanese/traditional pair <code>稲</code>/<code>稻</code>.
			</p>
			<p>
				The current data separates the visual decomposition used for the mnemonic from
				historical or phonosemantic component notes. For example, <code>愛</code> is judged
				from visible parts like <code>爫</code>, <code>冖</code>, <code>心</code>, and
				<code>夂</code>; older dictionary analysis can still be shown separately when it
				differs.
			</p>

			<div class="summary-strip" aria-label="Mnemonic bakeoff summary">
				<div>
					<span class="metric">{data.results.length}</span>
					<span class="label">model runs</span>
				</div>
				<div>
					<span class="metric">{data.characters.length}</span>
					<span class="label">characters</span>
				</div>
				<div>
					<span class="metric">{fullyValidResults.length}</span>
					<span class="label">zero-problem runs</span>
				</div>
				<div>
					<span class="metric">{formatTime(fastestFullyValid?.elapsed_seconds)}</span>
					<span class="label">fastest zero-problem</span>
				</div>
			</div>
		</Reveal>

		<Reveal as="section">
			<h2><span class="num">I</span> What was being judged</h2>
			<p>
				The prompt asked for a decomposition equation, one mnemonic sentence, and a hero
				image prompt. The validator checked the strict mechanical constraints: every
				component appears, every gloss appears beside its character, the final character is
				named with its meaning, and the output is valid JSON. A separate style score tried
				to reward short, concrete sentences over atmospheric prose.
			</p>

			<div class="input-grid">
				{#each (showAllInputs ? data.characters : data.characters.slice(0, 6)) as item}
					<div class="input-panel">
						<div class="char-head">
							<span class="han">{item.character}</span>
							<span>{item.meaning}</span>
						</div>
						<p class="equation">{item.gold_equation ?? equationFor(item)}</p>
						{#if item.historical_components?.length}
							<p class="historical">
								<span>historical</span>
								{componentsText(item.historical_components)}
							</p>
						{/if}
						{#if item.gold_mnemonic}
							<p class="gold">{item.gold_mnemonic}</p>
						{/if}
					</div>
				{/each}
			</div>
			{#if data.characters.length > 6}
				<button class="reveal-inputs" type="button" aria-expanded={showAllInputs} onclick={() => showAllInputs = !showAllInputs}>
					{showAllInputs ? 'Show fewer test characters' : `Browse all ${data.characters.length} test characters`}
				</button>
			{/if}

			<p class="note">
				This is a small targeted test, not a universal model benchmark. Its purpose was to
				choose a bulk generation model for Kiokun's mnemonic cards and expose the failure
				modes we would otherwise only notice after generating hundreds of bad cards. The
				original two-character smoke test is still linked below, but this 22-character run
				is the one the article now uses.
			</p>
		</Reveal>

		<Reveal as="section">
			<h2><span class="num">II</span> The decision</h2>
			<p>
				The corrected visual-decomposition run made the conclusion more nuanced.
				<b>Gemini 3.1 Pro Preview</b> had the highest combined score and passed every
				strict check. <b>Gemini 2.5 Flash</b> was the fastest zero-problem run.
				<b>Gemini 3.5 Flash</b> stayed close, but its 8-card batch had one strict miss,
				so bulk generation should use smaller batches if we keep it as the practical
				default.
			</p>
			<p class="decision">
				<b>Best score:</b> {bestResult?.name ?? '—'} ({formatScore(bestResult?.score)}).
				<b>Best zero-problem score:</b> {bestFullyValid?.name ?? '—'}
				({formatScore(bestFullyValid?.score)}).
				<b>Fastest zero-problem run:</b> {fastestFullyValid?.name ?? '—'}
				({formatTime(fastestFullyValid?.elapsed_seconds)}).
			</p>

			<div class="takeaways">
				<div>
					<h3>Strict format matters first</h3>
					<p>
						Gemma did not make the quality comparison because both tested Gemma 4 routes
						failed the JSON contract. For batch generation, an elegant idea outside the
						parser is not an output.
					</p>
				</div>
				<div>
					<h3>Bigger was not automatically cleaner</h3>
					<p>
						Gemini 3.1 Pro Preview won this corrected run, but Gemini 2.5 Flash was
						faster and still clean. The important skill was not model size by itself; it
						was obedience to a narrow card grammar.
					</p>
				</div>
				<div>
					<h3>The best prose was not always the best card</h3>
					<p>
						Claude Sonnet often wrote strong sentences, while the Gemini Flash models
						were faster. For production, that is a real tradeoff, not a single obvious
						winner.
					</p>
				</div>
			</div>
		</Reveal>

		<Reveal as="section">
			<h2><span class="num">III</span> Scoreboard</h2>
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th>Rank</th>
							<th>Model</th>
							<th>Provider</th>
							<th>Score</th>
							<th>Valid</th>
							<th>Coverage</th>
							<th>Style</th>
							<th>Problems</th>
							<th>Time</th>
						</tr>
					</thead>
					<tbody>
						{#each data.ranked as row, i}
							{@const result = data.results.find((item) => item.model === row.model)}
							<tr>
								<td>{i + 1}</td>
								<td>
									<strong>{row.name}</strong>
									<span><code>{row.model}</code></span>
								</td>
								<td>{providerLabel(row.provider)}</td>
								<td>{formatScore(row.score)}</td>
								<td>{row.valid_count ?? result?.valid_count ?? '—'}/{data.characters.length}</td>
								<td>{formatCoverage(row.coverage ?? result?.coverage)}</td>
								<td>{result ? averageStyleScore(result) : '—'}</td>
								<td>{result ? problemCount(result) : '—'}</td>
								<td>{formatTime(row.elapsed_seconds)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</Reveal>

		<Reveal as="section">
			<h2><span class="num">IV</span> Output explorer</h2>
			<p>
				The explorer below is the important part. Scores compress the result too much; the
				actual sentence shows whether the model made a usable memory card or merely passed
				the checklist.
			</p>

			<div class="controls" aria-label="Explorer filters">
				<div class="segmented" aria-label="Provider filter">
					{#each providerOptions as option}
						<button
							type="button"
							class:selected={selectedProvider === option.id}
							onclick={() => (selectedProvider = option.id)}
						>
							{option.label}
						</button>
					{/each}
				</div>

				<div class="segmented characters" aria-label="Character filter">
					<button
						type="button"
						class:selected={selectedCharacter === 'all'}
						onclick={() => (selectedCharacter = 'all')}
					>
						All characters
					</button>
					{#each data.characters as item}
						<button
							type="button"
							class:selected={selectedCharacter === item.character}
							onclick={() => (selectedCharacter = item.character)}
						>
							{item.character} {item.meaning}
						</button>
					{/each}
				</div>

				<label class="toggle">
					<input type="checkbox" bind:checked={showFailures} />
					<span>Show failed runs</span>
				</label>
			</div>

			<div class="model-list">
				{#each visibleResults() as result}
					{@const note = noteFor(result)}
					<section class="model-row" class:failed={!result.ok}>
						<header class="model-head">
							<div>
								<p class="provider">{providerLabel(result.provider)} · {note.tag}</p>
								<h3>{result.name}</h3>
								<p class="model-id"><code>{result.model}</code></p>
							</div>
							<div class="score-box">
								<span>{result.ok ? formatScore(result.score) : 'failed'}</span>
								<small>{formatTime(result.elapsed_seconds)}</small>
							</div>
						</header>

						<p class="model-note">{note.note}</p>

						{#if result.ok}
							<div class="outputs">
								{#each charactersForSelection() as item}
									{@const output = outputFor(result, item.character)}
									{@const validation = validationFor(result, item.character)}
									<div class="output-block">
										<h4>{item.character} <span>{item.meaning}</span></h4>
										<p class="input-components">
											<span>visual input</span>
											{componentsText(item.components)}
										</p>
										{#if item.historical_components?.length}
											<p class="input-components muted">
												<span>historical</span>
												{componentsText(item.historical_components)}
											</p>
										{/if}
										{#if output}
											<p class="equation">{output.equation}</p>
											<p class="mnemonic">{output.mnemonic}</p>
											{#if output.hero_image_prompt}
												<div class="image-prompt">
													<span>image prompt</span>
													<p>{output.hero_image_prompt}</p>
												</div>
											{/if}
											<div class="validation">
												<span>heuristic {validation?.heuristic_score?.toFixed(2) ?? '—'}</span>
												<span>style {validation?.style_score?.toFixed(2) ?? '—'}</span>
												{#if validation?.problems?.length}
													<span class="warn">{validation.problems.join('; ')}</span>
												{:else}
													<span>no validator problems</span>
												{/if}
											</div>
										{:else}
											<p class="error">No output for this character.</p>
										{/if}
									</div>
								{/each}
							</div>
						{:else}
							<p class="error">{result.error}</p>
						{/if}
					</section>
				{/each}
			</div>
		</Reveal>

		<Reveal as="section">
			<h2><span class="num">V</span> Download the data</h2>
			<p>
				The point of publishing this is that the raw attempts are more useful than a tidy
				conclusion. The same files are linked locally and on GitHub so the comparison can be
				inspected without trusting the article.
			</p>
			<div class="data-links">
				{#each dataLinks as link}
					<div class="data-link">
						<div>
							<h3>{link.label}</h3>
							<p>{link.note}</p>
						</div>
						<div class="link-actions">
							<a href={link.href}>local</a>
							<a href={link.github}>GitHub</a>
						</div>
					</div>
				{/each}
			</div>
		</Reveal>

		<Reveal as="footer">
			<a class="back foot" href="/blog">← More from the Kiokun Notebook</a>
		</Reveal>
	</div>
</article>
</main>

<style>
	article {
		padding: clamp(2rem, 7vw, 5.5rem) var(--gutter) 6rem;
	}
	.masthead,
	.prose {
		max-width: var(--measure);
		margin-inline: auto;
	}
	.masthead {
		margin-bottom: clamp(3rem, 8vw, 5.5rem);
	}
	.back {
		display: inline-block;
		margin-bottom: 2rem;
		font-family: var(--label);
		font-size: 0.78rem;
		color: var(--ink-faint);
		text-decoration: none;
	}
	.back:hover {
		color: var(--shu);
	}
	.kicker,
	.provider,
	.label {
		font-family: var(--label);
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--shu);
	}
	h1,
	h2,
	h3,
	h4,
	p {
		margin-top: 0;
	}
	h1 {
		margin-bottom: 1.2rem;
		font-family: var(--display);
		font-weight: 600;
		font-size: clamp(2.45rem, 7vw, 5.3rem);
		line-height: 1;
		letter-spacing: -0.025em;
		text-wrap: balance;
		color: var(--ink);
	}
	.deck {
		max-width: 42rem;
		font-size: clamp(1.1rem, 2.2vw, 1.35rem);
		line-height: 1.58;
		text-wrap: pretty;
		color: var(--ink-soft);
	}
	.byline {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
		margin-top: 1.5rem;
		font-family: var(--label);
		font-size: 0.78rem;
		color: var(--ink-faint);
	}
	.prose {
		display: grid;
		min-width: 0;
		gap: clamp(3rem, 7vw, 5rem);
	}
	:global(.prose > .reveal) {
		min-width: 0;
	}
	.prose p {
		font-size: 1.02rem;
		line-height: 1.72;
		color: var(--ink-soft);
		text-wrap: pretty;
	}
	.lede {
		font-size: clamp(1.08rem, 2vw, 1.26rem) !important;
		color: var(--ink-soft);
	}
	.dropcap {
		float: left;
		font-family: var(--display);
		font-size: 3.4rem;
		line-height: 0.85;
		margin: 0.12rem 0.42rem 0 0;
		color: var(--shu);
	}
	h2 {
		margin-bottom: 1.3rem;
		font-family: var(--display);
		font-size: clamp(1.65rem, 3.2vw, 2.45rem);
		font-weight: 600;
		line-height: 1.12;
		text-wrap: balance;
		color: var(--ink);
	}
	h3 {
		font-family: var(--display);
		font-weight: 600;
		color: var(--ink);
	}
	.num {
		color: var(--shu);
		font-variant-numeric: tabular-nums;
	}
	code {
		font-family: var(--mono);
		font-size: 0.92em;
	}
	.summary-strip {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 1px;
		margin: 2rem 0;
		border: 1px solid var(--rule);
		background: var(--rule);
	}
	.summary-strip > div {
		background: var(--paper-2);
		padding: 1rem;
	}
	.metric {
		display: block;
		font-family: var(--display);
		font-size: clamp(1.8rem, 4vw, 2.75rem);
		line-height: 1;
		color: var(--ink);
	}
	.label {
		display: block;
		margin-top: 0.45rem;
		color: var(--ink-faint);
	}
	.input-grid,
	.outputs,
	.takeaways {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}
	.takeaways {
		grid-template-columns: repeat(3, minmax(0, 1fr));
		margin-top: 1.7rem;
	}
	.input-panel,
	.output-block,
	.takeaways > div,
	.decision,
	.note,
	.data-link {
		border: 1px solid var(--rule);
		background: var(--paper-2);
	}
	.input-panel,
	.output-block,
	.takeaways > div,
	.decision,
	.note {
		padding: 1rem;
	}
	.decision,
	.note {
		max-width: 46rem;
	}
	.decision {
		color: var(--ink);
		background: color-mix(in srgb, var(--shu-wash) 55%, var(--paper-2));
	}
	.takeaways h3 {
		margin-bottom: 0.55rem;
		font-size: 1.05rem;
	}
	.takeaways p {
		margin-bottom: 0;
		font-size: 0.92rem;
		line-height: 1.58;
	}
	.char-head {
		display: flex;
		align-items: baseline;
		gap: 0.8rem;
		margin-bottom: 0.9rem;
		font-family: var(--label);
		color: var(--ink-faint);
	}
	.han {
		font-family: var(--display);
		font-size: 2.8rem;
		line-height: 1;
		color: var(--ink);
	}
	.equation {
		margin-bottom: 0.7rem;
		font-family: var(--mono);
		font-size: 0.9rem !important;
		line-height: 1.55 !important;
		color: var(--shu) !important;
	}
	.historical,
	.input-components {
		margin-bottom: 0.55rem;
		font-family: var(--mono);
		font-size: 0.78rem !important;
		line-height: 1.5 !important;
		color: var(--ink-faint) !important;
	}
	.historical span,
	.input-components span {
		display: inline-block;
		margin-right: 0.45rem;
		font-family: var(--label);
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.11em;
		text-transform: uppercase;
		color: var(--shu);
	}
	.input-components.muted span {
		color: var(--ink-faint);
	}
	.gold,
	.mnemonic {
		margin-bottom: 0;
		color: var(--ink) !important;
	}
	.table-wrap {
		max-width: 100%;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		border-top: 1px solid var(--rule);
		border-bottom: 1px solid var(--rule);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.92rem;
	}
	th,
	td {
		padding: 0.9rem;
		border-bottom: 1px solid var(--rule);
		text-align: left;
		vertical-align: top;
	}
	th {
		font-family: var(--label);
		font-size: 0.72rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--ink-faint);
		background: var(--paper-2);
	}
	tr:last-child td {
		border-bottom: none;
	}
	td strong,
	td span {
		display: block;
	}
	td span {
		margin-top: 0.2rem;
		color: var(--ink-faint);
		font-size: 0.82rem;
	}
	.controls {
		display: grid;
		gap: 0.85rem;
		margin: 1.5rem 0 1.8rem;
	}
	.segmented {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}
	.segmented.characters {
		flex-wrap: nowrap;
		overflow-x: auto;
		padding-bottom: 0.25rem;
		scrollbar-width: thin;
	}
	.segmented.characters button {
		flex: 0 0 auto;
		scroll-snap-align: start;
	}
	button {
		min-height: 44px;
		border: 1px solid var(--rule);
		border-radius: 6px;
		padding: 0 0.8rem;
		background: var(--paper-2);
		color: var(--ink-soft);
		font: inherit;
		font-family: var(--label);
		font-size: 0.78rem;
		cursor: pointer;
	}
	button.selected {
		border-color: var(--shu);
		background: var(--shu-wash);
		color: var(--ink);
	}
	.reveal-inputs {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		margin-top: 0.75rem;
		color: var(--shu);
	}
	.toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		width: fit-content;
		min-height: 44px;
		font-family: var(--label);
		font-size: 0.8rem;
		color: var(--ink-soft);
	}
	.toggle input {
		accent-color: var(--shu);
	}
	.model-list {
		display: grid;
		gap: 1.8rem;
	}
	.model-row {
		padding-top: 1.4rem;
		border-top: 1px solid var(--rule);
	}
	.model-row.failed {
		opacity: 0.86;
	}
	.model-head {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.9rem;
	}
	.model-head h3 {
		margin: 0.25rem 0;
		font-size: clamp(1.2rem, 2.5vw, 1.7rem);
	}
	.model-id,
	.model-note {
		margin: 0;
	}
	.model-id {
		color: var(--ink-faint);
	}
	.model-note {
		max-width: 48rem;
		margin-bottom: 1rem !important;
		font-size: 0.95rem !important;
		line-height: 1.62 !important;
	}
	.score-box {
		min-width: 5.8rem;
		text-align: right;
		font-family: var(--label);
		color: var(--ink);
	}
	.score-box span,
	.score-box small {
		display: block;
	}
	.score-box span {
		font-size: 1.25rem;
		font-weight: 600;
	}
	.score-box small {
		margin-top: 0.25rem;
		color: var(--ink-faint);
	}
	.output-block h4 {
		margin-bottom: 0.7rem;
		font-family: var(--display);
		font-size: 1.45rem;
	}
	.output-block h4 span {
		font-family: var(--label);
		font-size: 0.82rem;
		color: var(--ink-faint);
	}
	.image-prompt {
		margin-top: 0.85rem;
		padding-top: 0.8rem;
		border-top: 1px solid var(--rule);
	}
	.image-prompt span {
		display: block;
		margin-bottom: 0.4rem;
		font-family: var(--label);
		font-size: 0.7rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--ink-faint);
	}
	.image-prompt p {
		margin-bottom: 0;
		font-size: 0.9rem;
		line-height: 1.55;
		color: var(--ink-faint);
	}
	.validation {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin-top: 0.9rem;
	}
	.validation span {
		display: inline-flex;
		align-items: center;
		min-height: 1.65rem;
		padding: 0 0.55rem;
		border: 1px solid var(--rule);
		border-radius: 999px;
		font-family: var(--label);
		font-size: 0.7rem;
		color: var(--ink-faint);
		background: var(--paper);
	}
	.validation .warn {
		color: var(--shu);
		border-color: color-mix(in srgb, var(--shu) 45%, var(--rule));
	}
	.error {
		margin-bottom: 0;
		white-space: pre-wrap;
		font-family: var(--mono);
		font-size: 0.86rem !important;
		line-height: 1.55 !important;
		color: var(--shu) !important;
	}
	.data-links {
		display: grid;
		gap: 0.75rem;
	}
	.data-link {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 1rem;
		align-items: center;
		padding: 1rem;
	}
	.data-link h3 {
		margin-bottom: 0.25rem;
		font-size: 1rem;
	}
	.data-link p {
		margin-bottom: 0;
		font-size: 0.9rem;
		line-height: 1.55;
	}
	.link-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		justify-content: flex-end;
	}
	.link-actions a {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 44px;
		padding: 0 0.75rem;
		border: 1px solid var(--rule);
		border-radius: 6px;
		color: var(--ink);
		text-decoration: none;
		font-family: var(--label);
		font-size: 0.76rem;
	}
	.link-actions a:hover {
		border-color: var(--shu);
		color: var(--shu);
	}
	.foot {
		margin-bottom: 0;
	}
	@media (min-width: 1080px) {
		.summary-strip,
		.input-grid,
		.table-wrap,
		.controls,
		.model-list,
		.data-links,
		.takeaways {
			width: min(76rem, 92vw);
			margin-left: 50%;
			transform: translateX(-50%);
		}
	}
	@media (max-width: 780px) {
		.input-grid,
		.outputs,
		.takeaways,
		.data-link {
			grid-template-columns: 1fr;
		}
		.summary-strip {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.model-head {
			display: grid;
		}
		.score-box {
			text-align: left;
		}
		.link-actions {
			justify-content: flex-start;
		}
	}
</style>
