<script lang="ts">
	import { onMount } from 'svelte';
	import { dataLoader } from '$lib/dataLoader';
	import { cardManager } from '$lib/cardManager';
	import type { GameState, Card } from '$lib/types';
	import GameInfo from '$lib/components/GameInfo.svelte';
	import KanjiHand from '$lib/components/KanjiHand.svelte';
	import DrawingKanjiCard from '$lib/components/DrawingKanjiCard.svelte';

	let gameState = $state<GameState | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Animation state
	interface AnimatingCard {
		card: Card;
		startX: number;
		startY: number;
		endX: number;
		endY: number;
		startRotation: number;
		endRotation: number;
		targetArea: 'hand' | 'staging';
	}
	let animatingCards = $state<AnimatingCard[]>([]);

	onMount(async () => {
		try {
			await dataLoader.load();
			gameState = cardManager.initializeGame();
			loading = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load game data';
			loading = false;
		}
	});

	// Handler for clicking cards in hand - moves to staging with animation
	function handleHandCardClick(card: Card, index: number) {
		if (!gameState) return;

		// Get the card's current position in the hand
		const handElement = document.querySelector('.hand-area .hand');
		if (!handElement) return;

		const cardElements = handElement.querySelectorAll('.card-wrapper');
		const cardElement = cardElements[index] as HTMLElement;
		if (!cardElement) return;

		const rect = cardElement.getBoundingClientRect();
		const startX = rect.left + rect.width / 2;
		const startY = rect.top + rect.height / 2;

		// Get the target position in the staging area
		const stagingElement = document.querySelector('.staging-area .hand');
		if (!stagingElement) return;

		const stagingRect = stagingElement.getBoundingClientRect();
		const stagingCardCount = gameState.stagingArea.length;

		// Calculate end position (will be at the end of staging area)
		const cardWidth = 100;
		const overlapAmount = cardWidth * 0.2;
		const visibleWidth = cardWidth - overlapAmount;
		const totalWidth = stagingCardCount * visibleWidth + cardWidth;
		const endX = stagingRect.left + stagingRect.width / 2 + (stagingCardCount * visibleWidth - totalWidth / 2);
		const endY = stagingRect.top + stagingRect.height / 2;

		// Add animation
		animatingCards = [...animatingCards, {
			card,
			startX,
			startY,
			endX,
			endY,
			startRotation: 0,
			endRotation: 0,
			targetArea: 'staging'
		}];

		// Update game state immediately (card will be invisible in hand during animation)
		gameState = cardManager.moveToStaging(gameState, [card]);
	}

	// Handler for clicking cards in staging - moves to hand with animation
	function handleStagingCardClick(card: Card, index: number) {
		if (!gameState) return;

		// Get the card's current position in staging
		const stagingElement = document.querySelector('.staging-area .hand');
		if (!stagingElement) return;

		const cardElements = stagingElement.querySelectorAll('.card-wrapper');
		const cardElement = cardElements[index] as HTMLElement;
		if (!cardElement) return;

		const rect = cardElement.getBoundingClientRect();
		const startX = rect.left + rect.width / 2;
		const startY = rect.top + rect.height / 2;

		// Get the target position in the hand
		const handElement = document.querySelector('.hand-area .hand');
		if (!handElement) return;

		const handRect = handElement.getBoundingClientRect();
		const handCardCount = gameState.hand.length;

		// Calculate end position (will be at the end of hand)
		const cardWidth = 100;
		const overlapAmount = cardWidth * 0.2;
		const visibleWidth = cardWidth - overlapAmount;
		const totalWidth = handCardCount * visibleWidth + cardWidth;
		const endX = handRect.left + handRect.width / 2 + (handCardCount * visibleWidth - totalWidth / 2);
		const endY = handRect.top + handRect.height / 2;

		// Add animation
		animatingCards = [...animatingCards, {
			card,
			startX,
			startY,
			endX,
			endY,
			startRotation: 0,
			endRotation: 0,
			targetArea: 'hand'
		}];

		// Update game state immediately (card will be invisible in staging during animation)
		gameState = cardManager.moveToHand(gameState, [card]);
	}

	// Handler for reordering cards in staging
	function handleStagingReorder(newOrder: Card[]) {
		if (!gameState) return;
		gameState = { ...gameState, stagingArea: newOrder };
	}

	// Handler for reordering cards in hand
	function handleHandReorder(newOrder: Card[]) {
		if (!gameState) return;
		gameState = { ...gameState, hand: newOrder };
	}

	// Handler for dragging from hand to staging
	function handleHandDragEnd(card: Card, index: number, event: PointerEvent) {
		if (!gameState) return;

		// Check if the drag ended over the staging area
		const stagingElement = document.querySelector('.staging-area');
		if (!stagingElement) return;

		const stagingRect = stagingElement.getBoundingClientRect();
		const isOverStaging =
			event.clientX >= stagingRect.left &&
			event.clientX <= stagingRect.right &&
			event.clientY >= stagingRect.top &&
			event.clientY <= stagingRect.bottom;

		if (isOverStaging) {
			// Move card to staging
			handleHandCardClick(card, index);
		}
	}

	// Handler for dragging from staging to hand
	function handleStagingDragEnd(card: Card, index: number, event: PointerEvent) {
		if (!gameState) return;

		// Check if the drag ended over the hand area
		const handElement = document.querySelector('.hand-area');
		if (!handElement) return;

		const handRect = handElement.getBoundingClientRect();
		const isOverHand =
			event.clientX >= handRect.left &&
			event.clientX <= handRect.right &&
			event.clientY >= handRect.top &&
			event.clientY <= handRect.bottom;

		if (isOverHand) {
			// Move card to hand
			handleStagingCardClick(card, index);
		}
	}

	// Handler for hint button
	function handleHintClick() {
		if (!gameState) return;

		console.log('🔍 Looking for valid combinations in hand:', gameState.hand.map(c => c.character).join(', '));

		// Find valid combinations
		const combinations = cardManager.findValidCombinations(gameState.hand);

		console.log('📋 Found', combinations.length, 'valid combinations');
		if (combinations.length > 0) {
			combinations.forEach((combo, i) => {
				console.log(`  ${i + 1}. ${combo.word} (${combo.language}) - cards: ${combo.cards.map(c => c.character).join(', ')}`);
			});
		}

		if (combinations.length === 0) {
			console.log('❌ No valid combinations found!');
			alert('No valid word combinations found in your hand. Try drawing more cards or combining components!');
			return;
		}

		// Use the first combination found
		const hint = combinations[0];
		console.log('💡 Using hint:', hint.word, '(' + hint.language + ')');

		// Move the cards to staging area
		gameState = cardManager.moveToStaging(gameState, hint.cards);
	}

	// Handler for animation completion
	function handleAnimationComplete(card: Card) {
		animatingCards = animatingCards.filter(a => a.card.id !== card.id);
	}

	function handlePlayClick() {
		if (!gameState || gameState.stagingArea.length === 0) return;

		const validation = cardManager.validateWord(gameState.stagingArea);
		if (validation.valid) {
			gameState = cardManager.playCards(gameState, gameState.stagingArea);
		}
	}

	function handleDiscardClick() {
		if (!gameState || gameState.stagingArea.length === 0) return;
		gameState = cardManager.discardCards(gameState, gameState.stagingArea);
	}

	// Derived state
	const stagingValidation = $derived.by(() => {
		if (!gameState || gameState.stagingArea.length === 0) return null;
		return cardManager.validateWord(gameState.stagingArea);
	});

	// Get placeholder card IDs (cards that are currently animating)
	const placeholderCardIds = $derived(animatingCards.map(a => a.card.id).join(','));
</script>

{#if loading}
	<div class="loading">
		<h1>Loading game data...</h1>
	</div>
{:else if error}
	<div class="error">
		<h1>Error: {error}</h1>
	</div>
{:else if gameState}
	<div class="game-container">
		<GameInfo {gameState} />

		<div class="play-area">
			<!-- Staging Area -->
			<div class="staging-area">
				<h3>Staging Area</h3>
				<KanjiHand
					cards={gameState.stagingArea}
					onCardClick={handleStagingCardClick}
					onCardDragEnd={handleStagingDragEnd}
					onCardReorder={handleStagingReorder}
					placeholderCardId={placeholderCardIds}
					isStaging={true}
				/>

				{#if gameState.stagingArea.length > 0}
					<div class="staging-actions">
						{#if stagingValidation?.valid}
							<button class="play-button" onclick={handlePlayClick}>
								Play for {stagingValidation.score} points
							</button>
						{/if}
						<button class="discard-button" onclick={handleDiscardClick}>Discard</button>
					</div>
				{/if}
			</div>

			<!-- Hand -->
			<div class="hand-area">
				<div class="hand-header">
					<h3>Your Hand</h3>
					<button class="hint-button" onclick={handleHintClick}>💡 Hint</button>
				</div>
				<KanjiHand
					cards={gameState.hand}
					onCardClick={handleHandCardClick}
					onCardDragEnd={handleHandDragEnd}
					onCardReorder={handleHandReorder}
					placeholderCardId={placeholderCardIds}
					isStaging={false}
				/>
			</div>
		</div>

		<!-- Animating cards -->
		{#each animatingCards as anim (anim.card.id)}
			<DrawingKanjiCard
				card={anim.card}
				startX={anim.startX}
				startY={anim.startY}
				endX={anim.endX}
				endY={anim.endY}
				startRotation={anim.startRotation}
				endRotation={anim.endRotation}
				duration={600}
				onComplete={() => handleAnimationComplete(anim.card)}
			/>
		{/each}
	</div>
{/if}

<style>
	.loading,
	.error {
		display: flex;
		justify-content: center;
		align-items: center;
		height: 100vh;
		color: white;
	}

	.game-container {
		display: flex;
		flex-direction: column;
		height: 100vh;
	}

	.play-area {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 32px;
		gap: 32px;
	}

	.staging-area {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
		background: rgba(255, 255, 255, 0.05);
		border-radius: 16px;
		padding: 24px;
		border: 2px dashed rgba(255, 255, 255, 0.2);
	}

	.staging-area h3 {
		color: white;
		margin: 0;
	}

	.staging-actions {
		display: flex;
		gap: 12px;
	}

	.play-button,
	.discard-button {
		padding: 12px 24px;
		border-radius: 8px;
		font-weight: bold;
		font-size: 16px;
		transition: all 0.2s;
	}

	.play-button {
		background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
		color: white;
	}

	.play-button:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(76, 175, 80, 0.4);
	}

	.discard-button {
		background: linear-gradient(135deg, #f44336 0%, #da190b 100%);
		color: white;
	}

	.discard-button:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(244, 67, 54, 0.4);
	}

	.hand-area {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
	}

	.hand-header {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.hand-area h3 {
		color: white;
		margin: 0;
	}

	.hint-button {
		padding: 8px 16px;
		border-radius: 8px;
		background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
		color: white;
		font-weight: bold;
		font-size: 14px;
		transition: all 0.2s;
		cursor: pointer;
	}

	.hint-button:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(255, 152, 0, 0.4);
	}
</style>