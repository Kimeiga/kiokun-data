<script lang="ts">
	import { onMount } from 'svelte';
	import type {
		IdsForwardLookup,
		CharacterWords,
		CharacterGlosses,
		Question
	} from '$lib/types';
	import { generateQuestion, checkAnswer, needsOrdering, getGloss } from '$lib/quizLogic';

	let idsForward: IdsForwardLookup;
	let characterWords: CharacterWords;
	let characterGlosses: CharacterGlosses;
	let loading = true;
	let error = '';

	let currentQuestion: Question | null = null;
	let selectedIndices: number[] = [];
	let feedback: { correct: boolean; message: string } | null = null;
	let showingFeedback = false;

	onMount(async () => {
		try {
			const [idsRes, wordsRes, glossesRes] = await Promise.all([
fetch('/data/ids_forward.json'),
fetch('/data/character_words.json'),
fetch('/data/character_glosses.json')
]);

			idsForward = await idsRes.json();
			characterWords = await wordsRes.json();
			characterGlosses = await glossesRes.json();

			loading = false;
			nextQuestion();
		} catch (e) {
			error = 'Failed to load data: ' + (e as Error).message;
			loading = false;
		}
	});

	function nextQuestion() {
		selectedIndices = [];
		feedback = null;
		showingFeedback = false;
		currentQuestion = generateQuestion(idsForward, characterWords, characterGlosses);
	}

	function handleOptionClick(index: number) {
		if (showingFeedback) return;

		if (currentQuestion && needsOrdering(currentQuestion.type)) {
			const existingIndex = selectedIndices.indexOf(index);
			if (existingIndex !== -1) {
				selectedIndices = selectedIndices.filter((i) => i !== index);
			} else {
				selectedIndices = [...selectedIndices, index];
			}
		} else {
			evaluateAnswer(index);
		}
	}

	function evaluateAnswer(answer: number | number[]) {
		if (!currentQuestion) return;

		const correct = checkAnswer(currentQuestion, answer);
		showingFeedback = true;

		let message = '';
		if (currentQuestion.character && currentQuestion.components) {
			const charGloss = getGloss(currentQuestion.character, characterGlosses);
			const componentGlosses = currentQuestion.components
				.map((c) => getGloss(c, characterGlosses))
				.join(' + ');
			message = `Character: ${currentQuestion.character} (${charGloss})\nComponents: ${currentQuestion.components.join(' + ')}\nComponent glosses: ${componentGlosses}`;
		} else if (currentQuestion.type === 'character-to-real-word' && currentQuestion.character) {
			const correctAnswer = Array.isArray(currentQuestion.correctAnswer)
				? currentQuestion.correctAnswer[0]
				: currentQuestion.correctAnswer;
			message = `The word is: ${currentQuestion.options[correctAnswer]}`;
		}

		feedback = { correct, message };

		setTimeout(() => {
			nextQuestion();
		}, 2000);
	}

	function submitOrder() {
		if (selectedIndices.length === 0) return;
		evaluateAnswer(selectedIndices);
	}

	function getQuestionText(): string {
		if (!currentQuestion) return '';

		switch (currentQuestion.type) {
			case 'char-to-component-glosses':
				return `Given this character: ${currentQuestion.character}\n\nWhich component glosses (in order) make up this character?`;
			case 'char-gloss-to-component-chars':
				return `Given this character gloss: "${getGloss(currentQuestion.character!, characterGlosses)}"\n\nWhich component characters (in order) make up this character?`;
			case 'component-chars-to-char-gloss':
				return `Given these component characters: ${currentQuestion.components!.join(' + ')}\n\nWhat is the gloss of the character they form?`;
			case 'component-glosses-to-char':
				const glosses = currentQuestion.components!.map((c) => getGloss(c, characterGlosses)).join(' + ');
				return `Given these component glosses: ${glosses}\n\nWhich character do they form?`;
			case 'character-to-real-word':
				return `Given this character: ${currentQuestion.character}\n(Gloss: ${getGloss(currentQuestion.character!, characterGlosses)})\n\nWhich word is real? (All options contain ${currentQuestion.character})`;
		}
	}
</script>

<main>
	{#if loading}
		<div class="loading">📚 Loading data...</div>
	{:else if error}
		<div class="error">{error}</div>
	{:else if currentQuestion}
		<div class="quiz-container">
			<div class="question-header">
				<h2>{currentQuestion.type.replace(/-/g, ' ').toUpperCase()}</h2>
			</div>

			<div class="question-text">
				{getQuestionText()}
			</div>

			{#if feedback}
				<div class="feedback" class:correct={feedback.correct} class:wrong={!feedback.correct}>
					<div class="feedback-icon">{feedback.correct ? '✓' : '✗'}</div>
					<div class="feedback-text">
						<strong>{feedback.correct ? 'Correct!' : 'Wrong!'}</strong>
						<pre>{feedback.message}</pre>
					</div>
				</div>
			{/if}

			<div class="options">
				{#each currentQuestion.options as option, index}
					{@const orderNumber = selectedIndices.indexOf(index) + 1}
					<button
						class="option"
						class:selected={orderNumber > 0}
						class:disabled={showingFeedback}
						on:click={() => handleOptionClick(index)}
					>
						{#if orderNumber > 0}
							<span class="order-number">{orderNumber}</span>
						{/if}
						<span class="option-text">{option}</span>
					</button>
				{/each}
			</div>

			{#if needsOrdering(currentQuestion.type) && selectedIndices.length > 0 && !showingFeedback}
				<button class="submit-btn" on:click={submitOrder}>
					Submit Order ({selectedIndices.length} selected)
				</button>
			{/if}
		</div>
	{/if}
</main>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		min-height: 100vh;
	}

	main {
		max-width: 800px;
		margin: 0 auto;
		padding: 2rem;
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.loading,
	.error {
		text-align: center;
		font-size: 1.5rem;
		color: white;
	}

	.quiz-container {
		background: white;
		border-radius: 1rem;
		padding: 2rem;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
		width: 100%;
	}

	.question-header h2 {
		margin: 0 0 1rem 0;
		color: #667eea;
		font-size: 1rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.question-text {
		font-size: 1.5rem;
		margin-bottom: 2rem;
		white-space: pre-line;
		line-height: 1.6;
		color: #333;
	}

	.feedback {
		padding: 1rem;
		border-radius: 0.5rem;
		margin-bottom: 1.5rem;
		display: flex;
		gap: 1rem;
		align-items: flex-start;
	}

	.feedback.correct {
		background: #d4edda;
		border: 2px solid #28a745;
	}

	.feedback.wrong {
		background: #f8d7da;
		border: 2px solid #dc3545;
	}

	.feedback-icon {
		font-size: 2rem;
		line-height: 1;
	}

	.feedback.correct .feedback-icon {
		color: #28a745;
	}

	.feedback.wrong .feedback-icon {
		color: #dc3545;
	}

	.feedback-text {
		flex: 1;
	}

	.feedback-text strong {
		display: block;
		margin-bottom: 0.5rem;
		font-size: 1.2rem;
	}

	.feedback-text pre {
		margin: 0;
		font-family: inherit;
		white-space: pre-line;
		color: #666;
		font-size: 0.9rem;
	}

	.options {
		display: grid;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.option {
		padding: 1rem;
		border: 2px solid #e0e0e0;
		border-radius: 0.5rem;
		background: white;
		cursor: pointer;
		transition: all 0.2s;
		font-size: 1.1rem;
		text-align: left;
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.option:hover:not(.disabled) {
		border-color: #667eea;
		background: #f8f9ff;
		transform: translateX(4px);
	}

	.option.selected {
		border-color: #667eea;
		background: #e8ebff;
	}

	.option.disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.order-number {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		background: #667eea;
		color: white;
		border-radius: 50%;
		font-weight: bold;
		flex-shrink: 0;
	}

	.option-text {
		flex: 1;
	}

	.submit-btn {
		width: 100%;
		padding: 1rem;
		background: #667eea;
		color: white;
		border: none;
		border-radius: 0.5rem;
		font-size: 1.1rem;
		font-weight: bold;
		cursor: pointer;
		transition: background 0.2s;
	}

	.submit-btn:hover {
		background: #5568d3;
	}
</style>
