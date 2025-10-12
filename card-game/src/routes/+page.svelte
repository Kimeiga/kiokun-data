<script lang="ts">
	import Hand from '$lib/components/Hand.svelte';
	import DiscardPile from '$lib/components/DiscardPile.svelte';
	import { createDeck, shuffleDeck, type Card } from '$lib/types';

	let deck = $state<Card[]>([]);
	let hand = $state<Card[]>([]);
	let discardPile = $state<Card[]>([]);
	let selectedCardId = $state<string | null>(null);

	// Initialize the game
	function initGame() {
		const newDeck = shuffleDeck(createDeck());
		deck = newDeck.slice(7); // Remaining deck after dealing
		hand = newDeck.slice(0, 7); // Deal 7 cards to hand
		discardPile = [];
		selectedCardId = null;
	}

	// Handle card click (selection)
	function handleCardClick(card: Card, index: number) {
		if (selectedCardId === card.id) {
			// Deselect if clicking the same card
			selectedCardId = null;
		} else {
			// Select the card
			selectedCardId = card.id;
		}
	}

	// Handle card drag end (play card)
	function handleCardDragEnd(card: Card, index: number, event: PointerEvent) {
		// Check if the card was dropped over the discard pile
		const discardPileElement = document.querySelector('.discard-pile');
		if (discardPileElement) {
			const rect = discardPileElement.getBoundingClientRect();
			const isOverDiscard =
				event.clientX >= rect.left &&
				event.clientX <= rect.right &&
				event.clientY >= rect.top &&
				event.clientY <= rect.bottom;

			if (isOverDiscard) {
				playCard(card, index);
			}
		}
	}

	// Play a card to the discard pile
	function playCard(card: Card, index: number) {
		// Remove card from hand
		hand = hand.filter((c) => c.id !== card.id);
		// Add to discard pile
		discardPile = [...discardPile, card];
		// Clear selection
		selectedCardId = null;

		// Draw a new card if deck has cards
		if (deck.length > 0) {
			const newCard = deck[0];
			deck = deck.slice(1);
			// Animate the card flip as it's drawn
			newCard.faceUp = false;
			hand = [...hand, newCard];
			// Flip it face up after a short delay
			setTimeout(() => {
				newCard.faceUp = true;
				hand = [...hand];
			}, 300);
		}
	}

	// Play selected card when clicking discard pile
	function handleDiscardPileClick() {
		if (selectedCardId) {
			const cardIndex = hand.findIndex((c) => c.id === selectedCardId);
			if (cardIndex !== -1) {
				playCard(hand[cardIndex], cardIndex);
			}
		}
	}

	// Initialize on mount
	$effect(() => {
		initGame();
	});
</script>

<svelte:head>
	<title>Card Game</title>
	<meta name="description" content="A card game built with Svelte 5 and Framer Motion" />
</svelte:head>

<div class="game-container">
	<div class="game-header">
		<h1>Card Game</h1>
		<div class="game-info">
			<div class="info-item">
				<span class="label">Deck:</span>
				<span class="value">{deck.length} cards</span>
			</div>
			<div class="info-item">
				<span class="label">Hand:</span>
				<span class="value">{hand.length} cards</span>
			</div>
		</div>
		<button class="new-game-btn" onclick={initGame}>New Game</button>
	</div>

	<div class="game-board">
		<div class="center-area" onclick={handleDiscardPileClick}>
			<DiscardPile cards={discardPile} />
		</div>
	</div>

	<Hand
		cards={hand}
		{selectedCardId}
		onCardClick={handleCardClick}
		onCardDragEnd={handleCardDragEnd}
	/>

	<div class="instructions">
		<p><strong>How to play:</strong></p>
		<ul>
			<li>Hover over cards in your hand to see them better</li>
			<li>Click a card to select it, then click the discard pile to play it</li>
			<li>Or drag a card directly to the discard pile</li>
			<li>Any card can be played on any card</li>
			<li>A new card is drawn automatically when you play one</li>
		</ul>
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
		min-height: 100vh;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell,
			sans-serif;
	}

	.game-container {
		min-height: 100vh;
		padding: 20px;
		padding-bottom: 240px; /* Space for hand */
	}

	.game-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 40px;
		color: white;
		flex-wrap: wrap;
		gap: 20px;
	}

	h1 {
		margin: 0;
		font-size: 2.5rem;
		font-weight: 700;
		text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
	}

	.game-info {
		display: flex;
		gap: 30px;
	}

	.info-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}

	.label {
		font-size: 0.875rem;
		opacity: 0.8;
	}

	.value {
		font-size: 1.25rem;
		font-weight: 600;
	}

	.new-game-btn {
		padding: 12px 24px;
		background: white;
		color: #1e3c72;
		border: none;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.new-game-btn:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
	}

	.new-game-btn:active {
		transform: translateY(0);
	}

	.game-board {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 400px;
	}

	.center-area {
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.instructions {
		position: fixed;
		top: 20px;
		right: 20px;
		background: rgba(255, 255, 255, 0.95);
		padding: 20px;
		border-radius: 12px;
		max-width: 300px;
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
	}

	.instructions p {
		margin: 0 0 12px 0;
		color: #1e3c72;
	}

	.instructions ul {
		margin: 0;
		padding-left: 20px;
		color: #333;
	}

	.instructions li {
		margin-bottom: 8px;
		line-height: 1.5;
	}

	@media (max-width: 768px) {
		.instructions {
			position: static;
			margin: 20px auto;
			max-width: 100%;
		}

		h1 {
			font-size: 2rem;
		}
	}
</style>
