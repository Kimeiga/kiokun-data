<script lang="ts">
	import SpeakButton from '$lib/components/shared/SpeakButton.svelte';
	import { gradeArrangement, gradeChoice, gradeShortAnswer } from './grading';
	import type { AnswerStatus, CourseActivity } from './types';

	let {
		activity,
		initialStatus,
		onAttempt,
		language = 'ja',
		speechLanguage = 'ja'
	}: {
		activity: CourseActivity;
		initialStatus?: AnswerStatus;
		onAttempt: (activityId: string, status: AnswerStatus) => void;
		language?: string;
		speechLanguage?: 'zh' | 'yue' | 'ja' | 'ko';
	} = $props();

	let status = $state<AnswerStatus | undefined>(initialStatus);
	let selectedChoice = $state('');
	let selectedTileIndexes = $state<number[]>([]);
	let typedAnswer = $state('');
	let modelVisible = $state(false);
	let checkedCriteria = $state<boolean[]>([]);

	$effect(() => {
		if (initialStatus && !status) status = initialStatus;
	});

	let selectedTiles = $derived(
		activity.type === 'arrange'
			? selectedTileIndexes.map((index) => activity.tiles[index])
			: []
	);

	function saveStatus(nextStatus: AnswerStatus): void {
		status = nextStatus;
		onAttempt(activity.id, nextStatus);
	}

	function submitClosed(): void {
		if (activity.type === 'choice') {
			saveStatus(gradeChoice(activity, selectedChoice));
		} else if (activity.type === 'arrange') {
			saveStatus(gradeArrangement(activity, selectedTiles));
		} else if (activity.type === 'short-answer') {
			saveStatus(gradeShortAnswer(activity, typedAnswer));
		}
	}

	function addTile(index: number): void {
		if (!selectedTileIndexes.includes(index)) selectedTileIndexes = [...selectedTileIndexes, index];
	}

	function removeTile(position: number): void {
		selectedTileIndexes = selectedTileIndexes.filter((_, index) => index !== position);
		status = undefined;
	}

	function toggleCriterion(index: number): void {
		const next = [...checkedCriteria];
		next[index] = !next[index];
		checkedCriteria = next;
	}

	function saveProductionCheck(): void {
		if (activity.type !== 'production') return;
		if (!modelVisible || !activity.checklist.every((_, index) => checkedCriteria[index])) {
			saveStatus('invalid_input');
			return;
		}
		saveStatus('unverified');
	}

	function resetAttempt(): void {
		status = undefined;
		selectedChoice = '';
		selectedTileIndexes = [];
		typedAnswer = '';
		modelVisible = false;
		checkedCriteria = [];
	}

	function feedbackLabel(currentStatus: AnswerStatus): string {
		if (currentStatus === 'certified_correct') return 'Checked: this matches the accepted target.';
		if (currentStatus === 'target_mismatch') return 'Not yet: this does not match the lesson target.';
		if (currentStatus === 'unverified') return 'Self-check saved. Open responses are not automatically certified.';
		return activity.type === 'production'
			? 'Reveal the model and check every criterion after your attempt.'
			: 'Add an answer before checking.';
	}
</script>

<article class="activity" class:passed={status === 'certified_correct' || status === 'unverified'}>
	<header>
		<p class="activity-type">
			{activity.type === 'production'
				? activity.mode === 'speak'
					? 'Open speaking'
					: 'Open writing'
				: activity.title}
		</p>
		<h3>{activity.prompt}</h3>
	</header>

	{#if activity.type === 'choice'}
		<div class="choice-list" role="radiogroup" aria-label={activity.prompt}>
			{#each activity.options as option}
				<button
					type="button"
					class:selected={selectedChoice === option.value}
					onclick={() => {
						selectedChoice = option.value;
						status = undefined;
					}}
					role="radio"
					aria-checked={selectedChoice === option.value}
				>
					<span class="choice-mark" aria-hidden="true"></span>
					{option.label}
				</button>
			{/each}
		</div>
	{:else if activity.type === 'arrange'}
		<div class="arrange-answer" aria-label="Your sentence">
			{#if selectedTiles.length === 0}
				<span class="empty-answer">Choose tiles to build the sentence</span>
			{:else}
				{#each selectedTiles as tile, position}
					<button type="button" onclick={() => removeTile(position)} title="Remove tile">{tile}</button>
				{/each}
			{/if}
		</div>
		<div class="tile-bank" aria-label="Available tiles">
			{#each activity.tiles as tile, index}
				<button
					type="button"
					disabled={selectedTileIndexes.includes(index)}
					onclick={() => addTile(index)}
				>
					{tile}
				</button>
			{/each}
		</div>
	{:else if activity.type === 'short-answer'}
		<label class="text-answer">
			<span>Your answer</span>
			<input
				type="text"
				lang={language}
				autocomplete="off"
				spellcheck="false"
				placeholder={activity.placeholder || 'Type your answer'}
				bind:value={typedAnswer}
				oninput={() => (status = undefined)}
			/>
		</label>
	{:else}
		<div class="production">
			<div class="production-instruction">
				<span aria-hidden="true">{activity.mode === 'speak' ? '声' : '文'}</span>
				<p>
					{activity.mode === 'speak'
						? 'Say your response before opening the comparison.'
						: 'Write your response somewhere you can revise it before opening the comparison.'}
				</p>
			</div>
			<button type="button" class="secondary-action" onclick={() => (modelVisible = !modelVisible)}>
				{modelVisible ? 'Hide comparison' : 'Show comparison'}
			</button>
			{#if modelVisible}
				<div class="model-answer">
					<div>
						<span class="model-label">One possible answer</span>
						<p lang={language}>{activity.modelAnswer}</p>
						<small lang={language}>{activity.modelReading}</small>
					</div>
					<SpeakButton text={activity.modelAnswer} lang={speechLanguage} compact />
				</div>
				<div class="checklist">
					{#each activity.checklist as criterion, index}
						<label>
							<input
								type="checkbox"
								checked={checkedCriteria[index] || false}
								onchange={() => toggleCriterion(index)}
							/>
							<span>{criterion}</span>
						</label>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<div class="activity-actions">
		{#if activity.type === 'production'}
			<button type="button" class="primary-action" onclick={saveProductionCheck}>Save self-check</button>
		{:else}
			<button type="button" class="primary-action" onclick={submitClosed}>Check answer</button>
		{/if}
		{#if status}
			<button type="button" class="reset-action" onclick={resetAttempt}>Try again</button>
		{/if}
	</div>

	{#if status}
		<div class="feedback {status}" role="status">
			<strong>{feedbackLabel(status)}</strong>
			{#if activity.type !== 'production' && status !== 'invalid_input'}
				<p>{activity.rationale}</p>
				{#if status === 'target_mismatch'}
					{#if activity.type === 'short-answer'}
						<p class="reference" lang={language}>Target: {activity.referenceAnswer}</p>
					{:else if activity.type === 'arrange'}
						<p class="reference" lang={language}>Target: {activity.answer.join('')}</p>
					{/if}
				{/if}
			{/if}
		</div>
	{/if}
</article>

<style>
	.activity {
		padding: clamp(1rem, 3vw, 1.5rem);
		border: 1px solid var(--border-color);
		background: var(--bg-secondary);
	}

	.activity.passed {
		border-color: color-mix(in srgb, var(--accent) 45%, var(--border-color));
		background: color-mix(in srgb, var(--accent-light) 24%, var(--bg-secondary));
	}

	.activity-type {
		margin: 0 0 0.35rem;
		color: var(--text-tertiary);
		font-size: 0.72rem;
		font-weight: 760;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	h3 {
		max-width: 44rem;
		margin: 0;
		font-size: clamp(1rem, 2.2vw, 1.15rem);
		line-height: 1.45;
	}

	.choice-list {
		display: grid;
		gap: 0.55rem;
		margin-top: 1.1rem;
	}

	.choice-list button {
		display: flex;
		min-height: 3rem;
		align-items: center;
		gap: 0.75rem;
		padding: 0.7rem 0.8rem;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		background: var(--bg-primary);
		color: var(--text-primary);
		text-align: left;
		cursor: pointer;
	}

	.choice-list button:hover,
	.choice-list button.selected {
		border-color: var(--accent);
		background: var(--accent-light);
	}

	.choice-mark {
		width: 0.8rem;
		height: 0.8rem;
		flex: 0 0 auto;
		border: 1px solid var(--text-tertiary);
		border-radius: 50%;
	}

	.choice-list button.selected .choice-mark {
		border: 3px solid var(--accent);
	}

	.arrange-answer {
		display: flex;
		min-height: 4.25rem;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.45rem;
		margin-top: 1.1rem;
		padding: 0.7rem;
		border: 1px dashed var(--border-color);
		background: var(--bg-primary);
	}

	.empty-answer {
		color: var(--text-muted);
		font-size: 0.88rem;
	}

	.arrange-answer button,
	.tile-bank button {
		min-height: 2.75rem;
		padding: 0.45rem 0.75rem;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-family: var(--font-cjk);
		cursor: pointer;
	}

	.tile-bank {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin-top: 0.65rem;
	}

	.tile-bank button:disabled {
		opacity: 0.28;
		cursor: default;
	}

	.text-answer {
		display: grid;
		gap: 0.4rem;
		margin-top: 1.1rem;
		color: var(--text-tertiary);
		font-size: 0.78rem;
		font-weight: 680;
	}

	.text-answer input {
		width: 100%;
		min-height: 3rem;
		padding: 0.65rem 0.8rem;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		outline: 0;
		background: var(--bg-primary);
		color: var(--text-primary);
		font-family: var(--font-cjk);
		font-size: 1.05rem;
	}

	.text-answer input:focus {
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-light);
	}

	.production {
		margin-top: 1.1rem;
	}

	.production-instruction {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		background: var(--bg-primary);
	}

	.production-instruction > span {
		display: grid;
		width: 2.35rem;
		height: 2.35rem;
		flex: 0 0 auto;
		place-items: center;
		border: 1px solid var(--accent);
		color: var(--accent);
		font-family: var(--font-cjk);
		font-weight: 720;
	}

	.production-instruction p {
		margin: 0;
		color: var(--text-secondary);
		font-size: 0.9rem;
	}

	.model-answer {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 0.75rem;
		padding: 0.9rem;
		border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border-color));
		background: var(--accent-light);
	}

	.model-label {
		color: var(--text-tertiary);
		font-size: 0.68rem;
		font-weight: 740;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.model-answer p {
		margin: 0.28rem 0;
		font-family: var(--font-cjk);
		font-size: 1.1rem;
		font-weight: 620;
	}

	.model-answer small {
		color: var(--course-reading-color, var(--color-onyomi));
		font-family: var(--font-cjk);
	}

	.checklist {
		display: grid;
		gap: 0.45rem;
		margin-top: 0.75rem;
	}

	.checklist label {
		display: flex;
		min-height: 2.75rem;
		align-items: center;
		gap: 0.65rem;
		color: var(--text-secondary);
		font-size: 0.88rem;
	}

	.checklist input {
		width: 1.1rem;
		height: 1.1rem;
		accent-color: var(--accent);
	}

	.activity-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
		margin-top: 1rem;
	}

	.primary-action,
	.secondary-action,
	.reset-action {
		min-height: 2.75rem;
		padding: 0.55rem 0.9rem;
		border-radius: var(--radius-sm);
		font-weight: 680;
		cursor: pointer;
	}

	.primary-action {
		border: 1px solid var(--accent);
		background: var(--accent);
		color: var(--accent-contrast);
	}

	.secondary-action {
		margin-top: 0.75rem;
		border: 1px solid var(--border-color);
		background: var(--bg-secondary);
		color: var(--text-primary);
	}

	.reset-action {
		border: 1px solid transparent;
		background: transparent;
		color: var(--text-secondary);
	}

	.feedback {
		margin-top: 0.9rem;
		padding: 0.8rem;
		border: 1px solid var(--border-color);
		background: var(--bg-primary);
		color: var(--text-secondary);
		font-size: 0.88rem;
	}

	.feedback.certified_correct,
	.feedback.unverified {
		border-color: color-mix(in srgb, var(--accent) 45%, var(--border-color));
	}

	.feedback.target_mismatch,
	.feedback.invalid_input {
		border-color: var(--color-error);
	}

	.feedback strong {
		color: var(--text-primary);
	}

	.feedback p {
		margin: 0.35rem 0 0;
	}

	.reference {
		font-family: var(--font-cjk);
		font-size: 1rem;
		font-weight: 620;
	}

	button:focus-visible,
	input:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
</style>
