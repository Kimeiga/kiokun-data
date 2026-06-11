<script module lang="ts">
	export const prerender = true;
</script>

<script lang="ts">
	import Reveal from '$lib/blog/Reveal.svelte';

	const largeRows = [
		{ model: 'Current deployed', avg: '1.52', wins: '0', severe: '142 / 142' },
		{ model: 'Claude Sonnet 4.6', avg: '4.47', wins: '33', severe: '2 / 142' },
		{ model: 'Gemini 3.1 Pro Preview', avg: '4.75', wins: '57', severe: '0 / 142' },
		{ model: 'Gemini 3.5 Flash', avg: '4.79', wins: '52', severe: '0 / 142' }
	];

	const smallRows = [
		{ model: 'Current deployed', avg: '1.37', wins: '0', severe: '68 / 68' },
		{ model: 'GPT-5.5', avg: '4.41', wins: '13', severe: '0 / 68' },
		{ model: 'Claude Sonnet 4.6', avg: '4.44', wins: '14', severe: '2 / 68' },
		{ model: 'Gemini 3.1 Pro Preview', avg: '4.51', wins: '15', severe: '0 / 68' },
		{ model: 'Gemini 3.5 Flash', avg: '4.56', wins: '26', severe: '0 / 68' }
	];

	const selectedRows = [
		{ lang: 'Japanese', selected: 98, consensus: 58 },
		{ lang: 'Chinese', selected: 9, consensus: 3 },
		{ lang: 'Korean', selected: 13, consensus: 1 },
		{ lang: 'Turkish', selected: 29, consensus: 9 }
	];

	const examples = [
		{
			lang: 'Japanese',
			en: 'It was raining and the game was called off.',
			current: '雨が降って試合はコールドゲームになった。',
			issue: 'called off means canceled. The current sentence turns it into a baseball called game.',
			replacement: '雨が降っていたので、試合は中止になりました。'
		},
		{
			lang: 'Chinese',
			en: 'Never do today what you can put off till tomorrow.',
			current: '别把今天能做的事拖到明天。',
			issue:
				'The polarity flips. The English is a cynical joke about procrastination; the Chinese becomes normal advice not to procrastinate.',
			replacement: '能拖到明天的事，今天绝不要做。'
		},
		{
			lang: 'Korean',
			en: "Where's the admission's office?",
			current: '입원 수속 창구 어디예요?',
			issue:
				'The current translation assumes hospital admission. In this corpus context, the safer reading is a school admissions office.',
			replacement: '입학처가 어디에 있나요?'
		},
		{
			lang: 'Turkish',
			en: "There's a secret path on the left.",
			current: 'Bebek gibi uyuyor.',
			issue: 'Completely unrelated: it says someone is sleeping like a baby.',
			replacement: 'Solda gizli bir patika var.'
		}
	];

	const triedModels = [
		{
			name: 'Gemini 3.5 Flash',
			note:
				'Best practical default in these runs. It was fast, natural, had zero severe errors in the large strict consensus set, and won the GPT-inclusive smaller set.'
		},
		{
			name: 'Gemini 3.1 Pro Preview',
			note:
				'Very close to Flash. It often chose slightly more formal or polished renderings and actually had more wins than Flash in the large strict set, but a slightly lower average.'
		},
		{
			name: 'GPT-5.5',
			note:
				'Strong, but not the winner in the completed GPT-inclusive sample. The large run hit OpenAI quota before GPT-5.5 generation could run.'
		},
		{
			name: 'Claude Sonnet 4.6',
			note:
				'Careful and often elegant, especially in Japanese. It also served as one of the blind judges, but as a candidate it trailed the Gemini pair on average.'
		},
		{
			name: 'GPT-5.4 mini',
			note:
				'Good Japanese in exploratory tests, but the combined-language prompt left some Turkish items untranslated.'
		},
		{
			name: 'Claude Haiku 4.5',
			note:
				'Too brittle for this task in the exploratory run; it left Japanese untranslated in one combined prompt.'
		},
		{
			name: 'Gemini 3 Flash Preview, Gemini 2.5 Flash',
			note:
				'Usable, but weaker than the newer Flash/Pro pair on modal verbs and idioms in the spot checks.'
		},
		{
			name: 'Cloudflare Qwen3 30B and Mistral Small 3.1',
			note:
				'Plausible for some sentences, but not enough to beat the top closed models. They were useful sanity checks for cheaper/open-ish deployment paths.'
		},
		{
			name: 'Cloudflare Llama 3.1 8B, GLM 4.7 Flash, Gemma, M2M100',
			note:
				'M2M100 was fast but too literal, including translating \"Give me a ring\" as a physical ring. GLM/Gemma had output stability problems in the exploratory tests.'
		}
	];

	const dataLinks = [
		{
			label: 'Large strict summary',
			local: '/research/translation-model-eval/large-strict-summary.json',
			github:
				'https://github.com/Kimeiga/kiokun-data/blob/main/sveltekit-app/static/research/translation-model-eval/large-strict-summary.json'
		},
		{
			label: 'Large strict details',
			local: '/research/translation-model-eval/large-strict-details.json',
			github:
				'https://github.com/Kimeiga/kiokun-data/blob/main/sveltekit-app/static/research/translation-model-eval/large-strict-details.json'
		},
		{
			label: 'Large strict consensus CSV',
			local: '/research/translation-model-eval/large-strict-consensus-current-bad.csv',
			github:
				'https://github.com/Kimeiga/kiokun-data/blob/main/sveltekit-app/static/research/translation-model-eval/large-strict-consensus-current-bad.csv'
		},
		{
			label: 'GPT-inclusive small summary',
			local: '/research/translation-model-eval/small-gpt-summary.json',
			github:
				'https://github.com/Kimeiga/kiokun-data/blob/main/sveltekit-app/static/research/translation-model-eval/small-gpt-summary.json'
		},
		{
			label: 'GPT-inclusive small details',
			local: '/research/translation-model-eval/small-gpt-details.json',
			github:
				'https://github.com/Kimeiga/kiokun-data/blob/main/sveltekit-app/static/research/translation-model-eval/small-gpt-details.json'
		},
		{
			label: 'Exploratory 24-sentence outputs',
			local: '/research/translation-model-eval/exploratory-24-sentence-candidates.json',
			github:
				'https://github.com/Kimeiga/kiokun-data/blob/main/sveltekit-app/static/research/translation-model-eval/exploratory-24-sentence-candidates.json'
		}
	];
</script>

<svelte:head>
	<title>The Sentence Translation Bakeoff - Kiokun</title>
	<meta
		name="description"
		content="A Kiokun model comparison for repairing bad Japanese, Chinese, Korean, and Turkish example-sentence translations."
	/>
</svelte:head>

<article>
	<header class="masthead">
		<a class="back" href="/blog">← Kiokun Notebook</a>
		<p class="kicker">Translation Quality</p>
		<h1>The sentence translation bakeoff</h1>
		<p class="deck">
			We tested GPT-5.5, Claude, Gemini, and Cloudflare-hosted models against the
			awkward example-sentence translations already hiding in Kiokun's game data.
		</p>
		<p class="byline">
			<span>Kiokun Engineering</span><span class="dot">·</span><span>model evaluation</span
			><span class="dot">·</span><span>June 11, 2026</span>
		</p>
	</header>

	<div class="prose">
		<Reveal as="section">
			<p class="lede">
				<span class="dropcap">T</span>he first question was simple: if Kiokun is going to
				regenerate example-sentence translations, should it just use the biggest GPT model?
				After a few hundred targeted examples, my answer is no. GPT-5.5 is good. It was not
				the best model in the completed GPT-inclusive sample, and the larger strict run put
				Gemini 3.5 Flash and Gemini 3.1 Pro Preview in the top tier.
			</p>
			<p>
				The practical recommendation is to use <b>Gemini 3.5 Flash</b> as the bulk
				regeneration default, keep <b>Gemini 3.1 Pro</b> as a reviewer or fallback, and run a
				separate QA pass for idioms, modal verbs, and rows where the current translation is
				obviously unrelated.
			</p>
		</Reveal>

		<Reveal as="section">
			<h2><span class="num">I</span> What was tested</h2>
			<p>
				The source was Kiokun's live <code>/game</code> sentence corpus, 216,039 English
				example sentences with Japanese, Chinese, Korean, and Turkish translations. The goal
				was not to benchmark easy sentences. It was to find translations that were already
				wrong, awkward, missing key nuance, or misleading for learners.
			</p>
			<p>
				I ran two useful datasets. The <b>GPT-inclusive small run</b> contains 34 rows where
				both GPT-5.5 and Claude agreed the current non-null translation was bad. The
				<b>large strict run</b> scanned 2,000 non-null target-language strings per language
				and produced 149 selected rows. After both blind judges agreed the current row was
				bad, 71 rows remained.
			</p>
			<p class="note">
				One boundary matters: OpenAI quota was exhausted during the large Turkish triage, so
				the large strict run compares Claude and Gemini variants only. GPT-5.5 is represented
				in the completed smaller run and in the exploratory spot checks.
			</p>
		</Reveal>

		<Reveal as="section">
			<h2><span class="num">II</span> The headline numbers</h2>
			<p>
				On the large strict consensus set, Gemini Flash had the highest average score.
				Gemini Pro had slightly more wins. Both had zero severe errors.
			</p>
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th>Model</th>
							<th>Avg score</th>
							<th>Wins</th>
							<th>Severe errors</th>
						</tr>
					</thead>
					<tbody>
						{#each largeRows as row}
							<tr>
								<td>{row.model}</td>
								<td>{row.avg}</td>
								<td>{row.wins}</td>
								<td>{row.severe}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p>
				The smaller GPT-inclusive run points the same direction. GPT-5.5 did well, but the
				two Gemini models scored higher, and Gemini Flash had the most wins.
			</p>
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th>Model</th>
							<th>Avg score</th>
							<th>Wins</th>
							<th>Severe errors</th>
						</tr>
					</thead>
					<tbody>
						{#each smallRows as row}
							<tr>
								<td>{row.model}</td>
								<td>{row.avg}</td>
								<td>{row.wins}</td>
								<td>{row.severe}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</Reveal>

		<Reveal as="section">
			<h2><span class="num">III</span> How bad rows were found</h2>
			<p>
				The scan deliberately over-sampled risk: phrasal verbs, modal verbs, polarity traps,
				idioms, suspiciously short target strings, malformed Japanese, and known bad examples
				from earlier manual checks. Missing translations and obvious untranslated-English
				rows were separated from the strict run because they are coverage problems, not
				model-quality comparisons.
			</p>
			<div class="table-wrap compact">
				<table>
					<thead>
						<tr>
							<th>Language</th>
							<th>Selected by triage</th>
							<th>Confirmed bad by both judges</th>
						</tr>
					</thead>
					<tbody>
						{#each selectedRows as row}
							<tr>
								<td>{row.lang}</td>
								<td>{row.selected}</td>
								<td>{row.consensus}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p>
				Japanese had the most confirmed bad existing strings. Chinese and Korean looked much
				cleaner once nulls and untranslated English were removed. Turkish had fewer bad rows
				than Japanese, but some were spectacularly unrelated.
			</p>
		</Reveal>

		<Reveal as="section">
			<h2><span class="num">IV</span> The mistakes were not subtle</h2>
			{#each examples as example}
				<div class="example">
					<p class="example-lang">{example.lang}</p>
					<p><b>English:</b> {example.en}</p>
					<p><b>Current:</b> <span class="bad">{example.current}</span></p>
					<p><b>Issue:</b> {example.issue}</p>
					<p><b>Replacement:</b> <span class="good">{example.replacement}</span></p>
				</div>
			{/each}
		</Reveal>

		<Reveal as="section">
			<h2><span class="num">V</span> What each model seemed good at</h2>
			<p>
				The differences were not just score noise. Gemini Flash tended to choose direct,
				learner-friendly sentences. Gemini Pro often sounded a little more formal and was
				very strong on exact meaning. Claude was careful and elegant, but it sometimes
				preferred a paraphrase that drifted from the source. GPT-5.5 was consistently good,
				but not dominant on the hard rows we tested.
			</p>
			<ul class="model-list">
				{#each triedModels as model}
					<li>
						<b>{model.name}</b>
						<span>{model.note}</span>
					</li>
				{/each}
			</ul>
		</Reveal>

		<Reveal as="section">
			<h2><span class="num">VI</span> Why Gemini Flash won</h2>
			<p>
				The task rewards a specific balance. The output has to be literal enough for a
				learner to reconstruct the English sentence, but natural enough not to teach
				translatese. Gemini Flash was strong at that middle register. It avoided severe
				errors in both main consensus sets, kept sentences short, and handled several idioms
				without over-explaining them.
			</p>
			<p>
				The margin over Gemini Pro is small. A bootstrap over the 71-row large consensus set
				put Flash as the best model in 71.3% of resamples and Pro in 28.7%. The 95% interval
				for Flash minus Pro was roughly -0.07 to +0.14 average score points, so the honest
				read is <em>Gemini top tier</em>, not a landslide.
			</p>
			<p>
				For production, I would regenerate with Flash, then send low-confidence rows,
				idiom-heavy rows, and rows involving modality through a second reviewer. The reviewer
				could be Gemini Pro, Claude, or GPT-5.5 depending on cost and availability.
			</p>
		</Reveal>

		<Reveal as="section">
			<h2><span class="num">VII</span> Download the data</h2>
			<p>
				The raw outputs are public so the comparison can be rerun, criticized, or extended.
				The local links work on the deployed site; the GitHub links point at the checked-in
				files.
			</p>
			<ul class="data-list">
				{#each dataLinks as link}
					<li>
						<span>{link.label}</span>
						<a href={link.local}>download</a>
						<a href={link.github}>GitHub</a>
					</li>
				{/each}
			</ul>
			<p class="note">
				These are model-judge results, not a substitute for native-speaker review. They are
				good enough to choose a regeneration strategy and to find bad rows quickly.
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
		font-family: var(--label);
		font-size: 0.78rem;
		letter-spacing: 0.06em;
		color: var(--ink-faint);
		text-decoration: none;
	}
	.back:hover {
		color: var(--shu);
	}
	.kicker,
	.example-lang {
		font-family: var(--label);
		font-size: 0.74rem;
		font-weight: 600;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--shu);
	}
	.kicker {
		margin: 2rem 0 0.8rem;
	}
	h1 {
		margin: 0;
		font-family: var(--display);
		font-weight: 600;
		font-size: clamp(2.35rem, 7vw, 4.4rem);
		line-height: 1.04;
		letter-spacing: 0;
		color: var(--ink);
	}
	.deck {
		margin: 1.3rem 0 0;
		font-size: clamp(1.15rem, 2.4vw, 1.45rem);
		line-height: 1.5;
		color: var(--ink-soft);
		max-width: 34rem;
	}
	.byline {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin: 2rem 0 0;
		font-family: var(--label);
		font-size: 0.78rem;
		color: var(--ink-faint);
	}
	.dot {
		color: var(--shu);
	}
	.prose {
		margin-top: clamp(3rem, 8vw, 5rem);
	}
	.prose :global(section) {
		margin-top: clamp(2.6rem, 7vw, 4.6rem);
	}
	.lede,
	p {
		font-size: 1.04rem;
		line-height: 1.75;
		color: var(--ink-soft);
	}
	.lede {
		color: var(--ink);
	}
	.dropcap {
		float: left;
		font-family: var(--display);
		font-size: 4.2rem;
		line-height: 0.84;
		padding: 0.12rem 0.45rem 0 0;
		color: var(--shu);
	}
	h2 {
		display: flex;
		gap: 0.9rem;
		align-items: baseline;
		margin: 0 0 1rem;
		font-family: var(--display);
		font-size: clamp(1.55rem, 4vw, 2.15rem);
		line-height: 1.15;
		letter-spacing: 0;
		color: var(--ink);
	}
	.num {
		font-family: var(--label);
		font-size: 0.78rem;
		letter-spacing: 0.16em;
		color: var(--shu);
	}
	code {
		font-family: var(--mono);
		font-size: 0.92em;
	}
	.note {
		padding-left: 1rem;
		border-left: 2px solid var(--shu);
		color: var(--ink);
	}
	.table-wrap {
		overflow-x: auto;
		margin: 1.5rem 0 2rem;
		border-top: 1px solid var(--rule);
		border-bottom: 1px solid var(--rule);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		min-width: 34rem;
	}
	th,
	td {
		padding: 0.85rem 0.6rem;
		text-align: left;
		border-bottom: 1px solid var(--rule);
		font-size: 0.96rem;
	}
	th {
		font-family: var(--label);
		font-size: 0.72rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink-faint);
	}
	tr:last-child td {
		border-bottom: 0;
	}
	.compact table {
		min-width: 26rem;
	}
	.example {
		margin: 1.25rem 0;
		padding: 1rem 0 1rem 1rem;
		border-left: 2px solid var(--rule);
	}
	.example p {
		margin: 0.35rem 0;
	}
	.example-lang {
		margin: 0 0 0.5rem;
	}
	.bad {
		color: var(--ink);
		text-decoration: underline;
		text-decoration-color: color-mix(in srgb, var(--shu) 55%, transparent);
		text-decoration-thickness: 0.12em;
		text-underline-offset: 0.18em;
	}
	.good {
		color: var(--ink);
		font-weight: 600;
	}
	.model-list,
	.data-list {
		list-style: none;
		margin: 1.4rem 0 0;
		padding: 0;
		border-top: 1px solid var(--rule);
	}
	.model-list li,
	.data-list li {
		display: grid;
		gap: 0.45rem;
		padding: 1rem 0;
		border-bottom: 1px solid var(--rule);
		color: var(--ink-soft);
	}
	.model-list b,
	.data-list span {
		color: var(--ink);
	}
	.data-list li {
		grid-template-columns: 1fr auto auto;
		align-items: center;
		gap: 1rem;
	}
	.data-list a {
		font-family: var(--label);
		font-size: 0.78rem;
		color: var(--shu);
		text-decoration: none;
	}
	.data-list a:hover {
		text-decoration: underline;
	}
	.foot {
		display: inline-block;
		margin-top: 3rem;
	}
	@media (max-width: 640px) {
		.data-list li {
			grid-template-columns: 1fr;
		}
		table {
			min-width: 30rem;
		}
	}
</style>
