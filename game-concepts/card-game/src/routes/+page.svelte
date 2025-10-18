<script lang="ts">
	import Hand from '$lib/components/Hand.svelte';
	import AIHand from '$lib/components/AIHand.svelte';
	import SideAIHand from '$lib/components/SideAIHand.svelte';
	import DiscardPile from '$lib/components/DiscardPile.svelte';
	import Deck from '$lib/components/Deck.svelte';
	import DrawingCard from '$lib/components/DrawingCard.svelte';
	import { createDeck, shuffleDeck, type Card } from '$lib/types';
	import { onMount } from 'svelte';

	let deck = $state<Card[]>([]);
	let hand = $state<Card[]>([]);
	let aiHandTop = $state<Card[]>([]);
	let aiHandLeft = $state<Card[]>([]);
	let aiHandRight = $state<Card[]>([]);
	let discardPile = $state<Card[]>([]);
	let selectedCardId = $state<string | null>(null);
	let drawingCard = $state<Card | null>(null);
	let drawAnimation = $state<{
		startX: number;
		startY: number;
		endX: number;
		endY: number;
		startRotation: number;
		endRotation: number;
	} | null>(null);
	let placeholderCardId = $state<string | null>(null);

	// AI animation state
	let aiDrawingCard = $state<Card | null>(null);
	let aiDrawAnimation = $state<{
		startX: number;
		startY: number;
		endX: number;
		endY: number;
		startRotation: number;
		endRotation: number;
	} | null>(null);
	let aiPlaceholderCardId = $state<string | null>(null);
	let aiCurrentPlayer = $state<'top' | 'left' | 'right'>('top'); // Track which AI player is animating

	// Game state
	type Player = 'player' | 'left' | 'top' | 'right';
	type DealTarget = Player | 'discard';
	type GamePhase = 'idle' | 'dealing' | 'playing' | 'gameOver';
	let currentTurn = $state<Player>('player');
	let gamePhase = $state<GamePhase>('idle');
	let winner = $state<Player | null>(null);
	let dealingQueue = $state<Array<{ player: DealTarget; cardIndex: number }>>([]);
	let isDealingInProgress = $state(false);

	// Check if a card can be played on the discard pile
	function canPlayCard(card: Card, topCard: Card | undefined): boolean {
		if (!topCard) return true; // Can play any card on empty pile
		return card.suit === topCard.suit || card.rank === topCard.rank;
	}

	// Get eligible cards from a hand
	function getEligibleCards(cards: Card[]): Card[] {
		const topCard = discardPile[discardPile.length - 1];
		if (!topCard) return cards; // All cards eligible if pile is empty
		return cards.filter(card => canPlayCard(card, topCard));
	}

	// Initialize the game
	function initGame() {
		const newDeck = shuffleDeck(createDeck());
		deck = newDeck; // Start with full deck
		hand = [];
		aiHandTop = [];
		aiHandLeft = [];
		aiHandRight = [];
		discardPile = [];
		selectedCardId = null;
		drawingCard = null;
		drawAnimation = null;
		placeholderCardId = null;
		aiDrawingCard = null;
		aiDrawAnimation = null;
		aiPlaceholderCardId = null;
		currentTurn = 'player';
		gamePhase = 'idle';
		winner = null;
		dealingQueue = [];
		isDealingInProgress = false;
	}

	// Start the game by dealing cards
	function startGame() {
		initGame();
		gamePhase = 'dealing';

		// Build dealing queue: 7 cards to each player, clockwise starting with player
		const queue: Array<{ player: Player; cardIndex: number }> = [];
		for (let round = 0; round < 7; round++) {
			queue.push({ player: 'player', cardIndex: round });
			queue.push({ player: 'left', cardIndex: round });
			queue.push({ player: 'top', cardIndex: round });
			queue.push({ player: 'right', cardIndex: round });
		}
		// Add one card to discard pile
		queue.push({ player: 'discard', cardIndex: 0 } as any);

		dealingQueue = queue;
		processNextDeal();
	}

	// Process the next card in the dealing queue
	function processNextDeal() {
		if (dealingQueue.length === 0) {
			// Dealing complete, start playing
			// Wait for all animations to complete, then convert placeholders to real cards
			setTimeout(() => {
				convertPlaceholdersToRealCards();
				gamePhase = 'playing';
				currentTurn = 'player';
			}, 500); // Wait 500ms for last card to finish animating
			return;
		}

		const nextDeal = dealingQueue[0];
		dealingQueue = dealingQueue.slice(1);

		// Deal the card based on the player
		if (nextDeal.player === 'discard') {
			dealCardToDiscard();
		} else {
			dealCardToPlayer(nextDeal.player);
		}

		// Start the next card after a short stagger delay (100ms)
		setTimeout(() => {
			processNextDeal();
		}, 100);
	}

	// Convert all placeholder cards to real cards (remove dealing IDs)
	function convertPlaceholdersToRealCards() {
		// Remove "-dealing-..." suffix from all card IDs
		hand = hand.map(card => {
			if (card.id.includes('-dealing-')) {
				const originalId = card.id.split('-dealing-')[0];
				return { ...card, id: originalId };
			}
			return card;
		});

		aiHandLeft = aiHandLeft.map(card => {
			if (card.id.includes('-dealing-')) {
				const originalId = card.id.split('-dealing-')[0];
				return { ...card, id: originalId };
			}
			return card;
		});

		aiHandTop = aiHandTop.map(card => {
			if (card.id.includes('-dealing-')) {
				const originalId = card.id.split('-dealing-')[0];
				return { ...card, id: originalId };
			}
			return card;
		});

		aiHandRight = aiHandRight.map(card => {
			if (card.id.includes('-dealing-')) {
				const originalId = card.id.split('-dealing-')[0];
				return { ...card, id: originalId };
			}
			return card;
		});
	}

	// State for dealing animations - support multiple cards in flight
	let dealingCards = $state<Array<{
		id: string;
		card: Card;
		animation: {
			startX: number;
			startY: number;
			endX: number;
			endY: number;
			startRotation: number;
			endRotation: number;
		};
		placeholderId: string;
		toPlayer: Player | 'discard';
	}>>([]);

	// Track placeholder IDs that are being set up (before animation starts)
	let pendingPlaceholderIds = $state<string[]>([]);

	// Derived: Get all dealing placeholder IDs as comma-separated string
	const dealingPlaceholderIds = $derived([...dealingCards.map(d => d.placeholderId), ...pendingPlaceholderIds].join(','));

	// Deal a card to a specific player with animation
	function dealCardToPlayer(player: Player) {
		if (deck.length === 0) return;

		const newCard = deck[0];

		// Add a placeholder to the hand immediately
		// Player cards should be face-up, AI cards face-down
		const placeholder = { ...newCard, id: `${newCard.id}-dealing-${Date.now()}`, faceUp: player === 'player' };
		const placeholderId = placeholder.id;

		// Add placeholder ID to pending list BEFORE adding to hand (so it's invisible from the start)
		pendingPlaceholderIds = [...pendingPlaceholderIds, placeholderId];

		// Add to the appropriate hand
		if (player === 'player') {
			hand = [...hand, placeholder];
		} else if (player === 'left') {
			aiHandLeft = [...aiHandLeft, placeholder];
		} else if (player === 'top') {
			aiHandTop = [...aiHandTop, placeholder];
		} else {
			aiHandRight = [...aiHandRight, placeholder];
		}

		// Remove card from deck
		deck = deck.slice(1);

		// Wait for next frame so the hand re-renders with the placeholder
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				const deckElement = document.querySelector('.deck-container');
				let placeholderElement;

				if (player === 'player') {
					placeholderElement = document.querySelector(`[data-card-id="${placeholderId}"]`);
				} else {
					placeholderElement = document.querySelector(`[data-ai-card-id="${placeholderId}"]`);
				}

				if (!deckElement || !placeholderElement) {
					// Fallback: just replace the placeholder immediately
					const realCard: Card = { ...newCard, faceUp: false };
					if (player === 'player') {
						hand = hand.map((c) => (c.id === placeholderId ? realCard : c));
					} else if (player === 'left') {
						aiHandLeft = aiHandLeft.map((c) => (c.id === placeholderId ? realCard : c));
					} else if (player === 'top') {
						aiHandTop = aiHandTop.map((c) => (c.id === placeholderId ? realCard : c));
					} else if (player === 'right') {
						aiHandRight = aiHandRight.map((c) => (c.id === placeholderId ? realCard : c));
					}
					return;
				}

				const deckRect = deckElement.getBoundingClientRect();
				const placeholderRect = placeholderElement.getBoundingClientRect();

				const endX = placeholderRect.left + placeholderRect.width / 2 - 50;
				const endY = placeholderRect.top + placeholderRect.height / 2 - 70;

				// Calculate rotation
				const currentHand = player === 'player' ? hand : player === 'left' ? aiHandLeft : player === 'top' ? aiHandTop : aiHandRight;
				const futureHandLength = currentHand.length;
				const rightmostIndex = futureHandLength - 1;
				const maxRotation = 5;

				let endRotation = 0;
				if (player === 'player') {
					// Player hand rotation
					const rotationStep = futureHandLength > 1 ? (2 * maxRotation) / (futureHandLength - 1) : 0;
					endRotation = futureHandLength > 1 ? -maxRotation + rightmostIndex * rotationStep : 0;
				} else {
					// AI hand rotation
					const centerIndex = (futureHandLength - 1) / 2;
					const offsetFromCenter = rightmostIndex - centerIndex;
					let fanRotation = 0;
					if (futureHandLength > 1) {
						if (player === 'top') {
							fanRotation = -(offsetFromCenter / centerIndex) * maxRotation;
						} else if (player === 'left') {
							fanRotation = (offsetFromCenter / centerIndex) * maxRotation;
						} else {
							fanRotation = -(offsetFromCenter / centerIndex) * maxRotation;
						}
					}
					const baseRotation = player === 'left' ? -90 : player === 'right' ? 90 : 0;
					endRotation = baseRotation + fanRotation;
				}

				// Remove from pending list and add to the dealing cards array
				pendingPlaceholderIds = pendingPlaceholderIds.filter(id => id !== placeholderId);
				dealingCards = [...dealingCards, {
					id: placeholderId,
					card: { ...newCard, faceUp: false },
					animation: {
						startX: deckRect.left,
						startY: deckRect.top,
						endX,
						endY,
						startRotation: 0,
						endRotation
					},
					placeholderId,
					toPlayer: player
				}];
			});
		});
	}

	// Complete the dealing animation for a specific card
	function completeDealingAnimation(dealingId: string) {
		const dealingCardData = dealingCards.find(d => d.id === dealingId);
		if (!dealingCardData) return;

		const { card, placeholderId, toPlayer } = dealingCardData;

		// Handle discard pile separately
		if (toPlayer === 'discard') {
			// Add to discard pile face-up
			discardPile = [{ ...card, faceUp: true }];
			// Remove from dealing array
			dealingCards = dealingCards.filter(d => d.id !== dealingId);
			// Continue dealing
			processNextDeal();
			return;
		}

		// Keep the dealing ID for all cards during dealing
		// Player cards become face-up, AI cards stay face-down
		// All dealing IDs will be removed at the end in convertPlaceholdersToRealCards
		const realCard: Card = {
			...card,
			id: placeholderId, // Keep the dealing ID to preserve element identity
			faceUp: toPlayer === 'player' // Player cards face-up, AI cards face-down
		};

		// Update the appropriate hand
		if (toPlayer === 'player') {
			hand = hand.map((c) => (c.id === placeholderId ? realCard : c));
		} else if (toPlayer === 'left') {
			aiHandLeft = aiHandLeft.map((c) => (c.id === placeholderId ? realCard : c));
		} else if (toPlayer === 'top') {
			aiHandTop = aiHandTop.map((c) => (c.id === placeholderId ? realCard : c));
		} else if (toPlayer === 'right') {
			aiHandRight = aiHandRight.map((c) => (c.id === placeholderId ? realCard : c));
		}

		// Remove this card from the dealing array
		dealingCards = dealingCards.filter(d => d.id !== dealingId);
	}

	// Deal a card to the discard pile with animation
	function dealCardToDiscard() {
		if (deck.length === 0) return;

		const newCard = deck[0];
		const dealingId = `${newCard.id}-discard-${Date.now()}`;

		// Remove card from deck
		deck = deck.slice(1);

		// Wait for next frame to get DOM positions
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				const deckElement = document.querySelector('.deck-container');
				const discardElement = document.querySelector('.discard-pile-center');

				if (!deckElement || !discardElement) {
					// Fallback: just add the card immediately
					discardPile = [{ ...newCard, faceUp: true }];
					processNextDeal();
					return;
				}

				const deckRect = deckElement.getBoundingClientRect();
				const discardRect = discardElement.getBoundingClientRect();

				const endX = discardRect.left + discardRect.width / 2 - 50;
				const endY = discardRect.top + discardRect.height / 2 - 70;

				// Add to the dealing cards array
				dealingCards = [...dealingCards, {
					id: dealingId,
					card: { ...newCard, faceUp: false },
					animation: {
						startX: deckRect.left,
						startY: deckRect.top,
						endX,
						endY,
						startRotation: 0,
						endRotation: 0 // Discard pile cards are straight
					},
					placeholderId: dealingId,
					toPlayer: 'discard'
				}];
			});
		});
	}



	// Draw a card from the deck
	function handleDrawCard() {
		if (gamePhase !== 'playing' || currentTurn !== 'player') return;
		if (deck.length === 0 || drawingCard !== null) return;

		// Get the new card
		const newCard = deck[0];

		// Add a placeholder to the hand immediately so cards animate to make room
		const placeholder = { ...newCard, id: `${newCard.id}-drawing`, faceUp: false };
		placeholderCardId = placeholder.id;

		// Add placeholder ID to pending list BEFORE adding to hand (so it's invisible from the start)
		pendingPlaceholderIds = [...pendingPlaceholderIds, placeholderCardId];

		hand = [...hand, placeholder];

		// Remove card from deck
		deck = deck.slice(1);

		// Wait for next frame so the hand re-renders with the placeholder
		requestAnimationFrame(() => {
			// Wait one more frame to ensure the hand has fully positioned the cards
			requestAnimationFrame(() => {
				// Now find the actual placeholder card element in the DOM
				const deckElement = document.querySelector('.deck-container');
				const placeholderElement = document.querySelector(`[data-card-id="${placeholderCardId}"]`);

				if (!deckElement || !placeholderElement) return;

				const deckRect = deckElement.getBoundingClientRect();
				const placeholderRect = placeholderElement.getBoundingClientRect();

				// Get the center of the placeholder card
				const endX = placeholderRect.left + placeholderRect.width / 2 - 50; // -50 for card center offset
				const endY = placeholderRect.top + placeholderRect.height / 2 - 70; // -70 for card center offset

				// Calculate rotation for rightmost card (matches Hand.svelte logic)
				const futureHandLength = hand.length;
				const rightmostIndex = futureHandLength - 1;
				const maxRotation = 5;
				const rotationStep = futureHandLength > 1 ? (2 * maxRotation) / (futureHandLength - 1) : 0;
				const endRotation = futureHandLength > 1 ? -maxRotation + rightmostIndex * rotationStep : 0;

				// Remove from pending list now that animation is starting
				pendingPlaceholderIds = pendingPlaceholderIds.filter(id => id !== placeholderCardId);

				// Set up the drawing animation
				drawingCard = { ...newCard, faceUp: false };
				drawAnimation = {
					startX: deckRect.left,
					startY: deckRect.top,
					endX,
					endY,
					startRotation: 0, // Deck cards start at 0 degrees
					endRotation
				};
			});
		});
	}

	function handleDrawComplete() {
		if (drawingCard && placeholderCardId) {
			// Replace the placeholder with the real card (face up)
			const realCard: Card = { ...drawingCard, faceUp: true };
			hand = hand.map((c) => (c.id === placeholderCardId ? realCard : c));
			drawingCard = null;
			drawAnimation = null;
			placeholderCardId = null;

			// After drawing, turn ends
			if (gamePhase === 'playing') {
				advanceTurn();
			}
		}
	}

	// Handle card click (selection and play)
	function handleCardClick(card: Card, index: number) {
		if (gamePhase !== 'playing' || currentTurn !== 'player') return;

		const topCard = discardPile[discardPile.length - 1];
		if (!canPlayCard(card, topCard)) {
			// Card not eligible - maybe show feedback
			return;
		}

		// Play the card
		playCard(card, index);
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
		discardPile = [...discardPile, { ...card, faceUp: true }];
		// Clear selection
		selectedCardId = null;

		// Check for win
		if (hand.length === 0) {
			winner = 'player';
			gamePhase = 'gameOver';
			return;
		}

		// Advance to next turn
		advanceTurn();
	}

	// Advance to the next player's turn
	function advanceTurn() {
		const turnOrder: Player[] = ['player', 'left', 'top', 'right'];
		const currentIndex = turnOrder.indexOf(currentTurn);
		const nextIndex = (currentIndex + 1) % turnOrder.length;
		currentTurn = turnOrder[nextIndex];

		// If it's an AI turn, trigger AI play after a delay
		if (currentTurn !== 'player') {
			setTimeout(() => {
				playAITurn(currentTurn as 'left' | 'top' | 'right');
			}, 1000);
		}
	}

	// AI plays their turn
	function playAITurn(player: 'left' | 'top' | 'right') {
		if (gamePhase !== 'playing') return;

		const currentHand = player === 'left' ? aiHandLeft : player === 'top' ? aiHandTop : aiHandRight;
		const eligibleCards = getEligibleCards(currentHand);

		if (eligibleCards.length > 0) {
			// Play a random eligible card
			const randomCard = eligibleCards[Math.floor(Math.random() * eligibleCards.length)];
			playAICard(player, randomCard);
		} else {
			// No eligible cards, must draw
			drawAICard(player);
		}
	}

	// AI plays a specific card with animation
	function playAICard(player: 'left' | 'top' | 'right', card: Card) {
		const currentHand = player === 'left' ? aiHandLeft : player === 'top' ? aiHandTop : aiHandRight;
		const cardIndex = currentHand.findIndex((c) => c.id === card.id);
		if (cardIndex === -1) return;

		// Find the card element BEFORE removing it from hand
		const cardElement = document.querySelector(`[data-ai-card-id="${card.id}"]`);
		const discardElement = document.querySelector('.discard-pile');

		if (!cardElement || !discardElement) {
			// Fallback: play instantly without animation
			if (player === 'left') {
				aiHandLeft = aiHandLeft.filter((c) => c.id !== card.id);
			} else if (player === 'top') {
				aiHandTop = aiHandTop.filter((c) => c.id !== card.id);
			} else {
				aiHandRight = aiHandRight.filter((c) => c.id !== card.id);
			}
			discardPile = [...discardPile, { ...card, faceUp: true }];

			// Check for win
			const currentHand = player === 'left' ? aiHandLeft : player === 'top' ? aiHandTop : aiHandRight;
			if (currentHand.length === 0) {
				winner = player;
				gamePhase = 'gameOver';
				return;
			}

			advanceTurn();
			return;
		}

		const cardRect = cardElement.getBoundingClientRect();
		const discardRect = discardElement.getBoundingClientRect();

		// Calculate start and end positions
		const startX = cardRect.left + cardRect.width / 2 - 50;
		const startY = cardRect.top + cardRect.height / 2 - 70;
		const endX = discardRect.left + discardRect.width / 2 - 50;
		const endY = discardRect.top + discardRect.height / 2 - 70;

		// Calculate the card's current rotation in hand
		const handLength = currentHand.length;
		const maxRotation = 5;
		const centerIndex = (handLength - 1) / 2;
		const offsetFromCenter = cardIndex - centerIndex;

		// Calculate fan rotation
		let fanRotation = 0;
		if (handLength > 1) {
			if (player === 'top') {
				// Top player: inverted rotation
				fanRotation = -(offsetFromCenter / centerIndex) * maxRotation;
			} else if (player === 'left') {
				// Left player: normal rotation
				fanRotation = (offsetFromCenter / centerIndex) * maxRotation;
			} else {
				// Right player: inverted rotation
				fanRotation = -(offsetFromCenter / centerIndex) * maxRotation;
			}
		}

		// Calculate base rotation for side players
		const baseRotation = player === 'left' ? -90 : player === 'right' ? 90 : 0;
		const startRotation = baseRotation + fanRotation;

		// Remove from the appropriate AI hand
		if (player === 'left') {
			aiHandLeft = aiHandLeft.filter((c) => c.id !== card.id);
		} else if (player === 'top') {
			aiHandTop = aiHandTop.filter((c) => c.id !== card.id);
		} else {
			aiHandRight = aiHandRight.filter((c) => c.id !== card.id);
		}

		// Set up the playing animation (card will flip and rotate during flight)
		aiCurrentPlayer = player;
		aiDrawingCard = { ...card, faceUp: false };
		aiDrawAnimation = {
			startX,
			startY,
			endX,
			endY,
			startRotation, // Card starts at its current rotation in hand
			endRotation: 0 // Card ends face-up and straight
		};
	}

	// AI draws a card with animation
	function drawAICard(player: 'left' | 'top' | 'right') {
		if (deck.length === 0 || aiDrawingCard !== null) {
			// No cards left, skip turn
			advanceTurn();
			return;
		}

		// Track which player is drawing
		aiCurrentPlayer = player;

		// Get the new card
		const newCard = deck[0];

		// Add a placeholder to the AI hand immediately so cards animate to make room
		const placeholder = { ...newCard, id: `${newCard.id}-ai-drawing`, faceUp: false };
		aiPlaceholderCardId = placeholder.id;

		// Add placeholder ID to pending list BEFORE adding to hand (so it's invisible from the start)
		pendingPlaceholderIds = [...pendingPlaceholderIds, aiPlaceholderCardId];

		// Add to the appropriate hand
		if (player === 'top') {
			aiHandTop = [...aiHandTop, placeholder];
		} else if (player === 'left') {
			aiHandLeft = [...aiHandLeft, placeholder];
		} else {
			aiHandRight = [...aiHandRight, placeholder];
		}

		// Remove card from deck
		deck = deck.slice(1);

		// Wait for next frame so the AI hand re-renders with the placeholder
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				// Now find the actual placeholder card element in the DOM
				const deckElement = document.querySelector('.deck-container');
				const placeholderElement = document.querySelector(`[data-ai-card-id="${aiPlaceholderCardId}"]`);

				if (!deckElement || !placeholderElement) {
					// Fallback: replace placeholder immediately
					const realCard: Card = { ...newCard, faceUp: false };
					if (player === 'top') {
						aiHandTop = aiHandTop.map((c) => (c.id === aiPlaceholderCardId ? realCard : c));
					} else if (player === 'left') {
						aiHandLeft = aiHandLeft.map((c) => (c.id === aiPlaceholderCardId ? realCard : c));
					} else {
						aiHandRight = aiHandRight.map((c) => (c.id === aiPlaceholderCardId ? realCard : c));
					}
					aiPlaceholderCardId = null;
					advanceTurn();
					return;
				}

				const deckRect = deckElement.getBoundingClientRect();
				const placeholderRect = placeholderElement.getBoundingClientRect();

				// Get the center of the placeholder card
				const endX = placeholderRect.left + placeholderRect.width / 2 - 50;
				const endY = placeholderRect.top + placeholderRect.height / 2 - 70;

				// Calculate rotation based on player and position in hand
				const currentHand = player === 'top' ? aiHandTop : player === 'left' ? aiHandLeft : aiHandRight;
				const futureHandLength = currentHand.length;
				const rightmostIndex = futureHandLength - 1;
				const maxRotation = 5;
				const centerIndex = (futureHandLength - 1) / 2;
				const offsetFromCenter = rightmostIndex - centerIndex;

				// Calculate fan rotation
				let fanRotation = 0;
				if (futureHandLength > 1) {
					if (player === 'top') {
						// Top player: inverted rotation
						fanRotation = -(offsetFromCenter / centerIndex) * maxRotation;
					} else if (player === 'left') {
						// Left player: normal rotation
						fanRotation = (offsetFromCenter / centerIndex) * maxRotation;
					} else {
						// Right player: inverted rotation
						fanRotation = -(offsetFromCenter / centerIndex) * maxRotation;
					}
				}

				// Calculate base rotation for side players
				const baseRotation = player === 'left' ? -90 : player === 'right' ? 90 : 0;
				const endRotation = baseRotation + fanRotation;

				// Remove from pending list now that animation is starting
				pendingPlaceholderIds = pendingPlaceholderIds.filter(id => id !== aiPlaceholderCardId);

				// Set up the drawing animation
				aiDrawingCard = { ...newCard, faceUp: false };
				aiDrawAnimation = {
					startX: deckRect.left,
					startY: deckRect.top,
					endX,
					endY,
					startRotation: 0, // Deck cards start at 0 degrees
					endRotation
				};
			});
		});
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

	// AI draws a card from the deck
	function handleAIDrawCard(player: 'top' | 'left' | 'right' = 'top') {
		if (deck.length === 0 || aiDrawingCard !== null) return;

		// Track which player is drawing
		aiCurrentPlayer = player;

		// Get the new card
		const newCard = deck[0];

		// Add a placeholder to the AI hand immediately so cards animate to make room
		const placeholder = { ...newCard, id: `${newCard.id}-ai-drawing`, faceUp: false };
		aiPlaceholderCardId = placeholder.id;

		// Add to the appropriate hand
		if (player === 'top') {
			aiHandTop = [...aiHandTop, placeholder];
		} else if (player === 'left') {
			aiHandLeft = [...aiHandLeft, placeholder];
		} else {
			aiHandRight = [...aiHandRight, placeholder];
		}

		// Remove card from deck
		deck = deck.slice(1);

		// Wait for next frame so the AI hand re-renders with the placeholder
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				// Now find the actual placeholder card element in the DOM
				const deckElement = document.querySelector('.deck-container');
				const placeholderElement = document.querySelector(`[data-ai-card-id="${aiPlaceholderCardId}"]`);

				if (!deckElement || !placeholderElement) return;

				const deckRect = deckElement.getBoundingClientRect();
				const placeholderRect = placeholderElement.getBoundingClientRect();

				// Get the center of the placeholder card
				const endX = placeholderRect.left + placeholderRect.width / 2 - 50;
				const endY = placeholderRect.top + placeholderRect.height / 2 - 70;

				// Calculate rotation based on player and position in hand
				const currentHand = player === 'top' ? aiHandTop : player === 'left' ? aiHandLeft : aiHandRight;
				const futureHandLength = currentHand.length;
				const rightmostIndex = futureHandLength - 1;
				const maxRotation = 5;
				const centerIndex = (futureHandLength - 1) / 2;
				const offsetFromCenter = rightmostIndex - centerIndex;

				// Calculate fan rotation
				let fanRotation = 0;
				if (futureHandLength > 1) {
					if (player === 'top') {
						// Top player: inverted rotation
						fanRotation = -(offsetFromCenter / centerIndex) * maxRotation;
					} else if (player === 'left') {
						// Left player: normal rotation
						fanRotation = (offsetFromCenter / centerIndex) * maxRotation;
					} else {
						// Right player: inverted rotation
						fanRotation = -(offsetFromCenter / centerIndex) * maxRotation;
					}
				}

				// Calculate base rotation for side players
				const baseRotation = player === 'left' ? -90 : player === 'right' ? 90 : 0;
				const endRotation = baseRotation + fanRotation;

				// Set up the drawing animation
				aiDrawingCard = { ...newCard, faceUp: false };
				aiDrawAnimation = {
					startX: deckRect.left,
					startY: deckRect.top,
					endX,
					endY,
					startRotation: 0, // Deck cards start at 0 degrees
					endRotation
				};
			});
		});
	}

	function handleAIDrawComplete() {
		if (aiDrawingCard && aiPlaceholderCardId) {
			// Replace the placeholder with the real card (face down)
			const realCard: Card = { ...aiDrawingCard, faceUp: false };

			// Update the appropriate hand
			if (aiCurrentPlayer === 'top') {
				aiHandTop = aiHandTop.map((c) => (c.id === aiPlaceholderCardId ? realCard : c));
			} else if (aiCurrentPlayer === 'left') {
				aiHandLeft = aiHandLeft.map((c) => (c.id === aiPlaceholderCardId ? realCard : c));
			} else {
				aiHandRight = aiHandRight.map((c) => (c.id === aiPlaceholderCardId ? realCard : c));
			}

			aiDrawingCard = null;
			aiDrawAnimation = null;
			aiPlaceholderCardId = null;

			// After drawing, turn ends
			advanceTurn();
		}
	}

	// AI plays a random card to the discard pile
	function handleAIPlayCard(player: 'top' | 'left' | 'right' = 'top') {
		// Get the appropriate hand
		const currentHand = player === 'top' ? aiHandTop : player === 'left' ? aiHandLeft : aiHandRight;

		if (currentHand.length === 0) return;

		// Pick a random card
		const randomIndex = Math.floor(Math.random() * currentHand.length);
		const cardToPlay = currentHand[randomIndex];

		// Find the card element BEFORE removing it from hand
		const cardElement = document.querySelector(`[data-ai-card-id="${cardToPlay.id}"]`);

		if (!cardElement) {
			console.error('❌ Could not find AI card element:', cardToPlay.id);
			return;
		}

		const cardRect = cardElement.getBoundingClientRect();

		// Get discard pile position (target the actual card area, not the container with text)
		const discardElement = document.querySelector('.discard-pile');
		if (!discardElement) {
			console.error('❌ Could not find discard pile element');
			return;
		}

		const discardRect = discardElement.getBoundingClientRect();

		// Calculate start and end positions
		const startX = cardRect.left + cardRect.width / 2 - 50;
		const startY = cardRect.top + cardRect.height / 2 - 70;
		const endX = discardRect.left + discardRect.width / 2 - 50;
		const endY = discardRect.top + discardRect.height / 2 - 70;

		// Calculate the card's current rotation in hand
		const handLength = currentHand.length;
		const maxRotation = 5;
		const centerIndex = (handLength - 1) / 2;
		const offsetFromCenter = randomIndex - centerIndex;

		// Calculate fan rotation
		let fanRotation = 0;
		if (handLength > 1) {
			if (player === 'top') {
				// Top player: inverted rotation
				fanRotation = -(offsetFromCenter / centerIndex) * maxRotation;
			} else if (player === 'left') {
				// Left player: normal rotation
				fanRotation = (offsetFromCenter / centerIndex) * maxRotation;
			} else {
				// Right player: inverted rotation
				fanRotation = -(offsetFromCenter / centerIndex) * maxRotation;
			}
		}

		// Calculate base rotation for side players
		const baseRotation = player === 'left' ? -90 : player === 'right' ? 90 : 0;
		const startRotation = baseRotation + fanRotation;

		// Remove from the appropriate AI hand
		if (player === 'top') {
			aiHandTop = aiHandTop.filter((c) => c.id !== cardToPlay.id);
		} else if (player === 'left') {
			aiHandLeft = aiHandLeft.filter((c) => c.id !== cardToPlay.id);
		} else {
			aiHandRight = aiHandRight.filter((c) => c.id !== cardToPlay.id);
		}

		// Set up the playing animation (card will flip and rotate during flight)
		aiDrawingCard = { ...cardToPlay, faceUp: false };
		aiDrawAnimation = {
			startX,
			startY,
			endX,
			endY,
			startRotation, // Card starts at its current rotation in hand
			endRotation: 0 // Card ends face-up and straight
		};
	}

	function handleAIPlayComplete() {
		if (aiDrawingCard) {
			// Add to discard pile (face up)
			discardPile = [...discardPile, { ...aiDrawingCard, faceUp: true }];
			aiDrawingCard = null;
			aiDrawAnimation = null;

			// Check for win
			const currentHand = aiCurrentPlayer === 'left' ? aiHandLeft : aiCurrentPlayer === 'top' ? aiHandTop : aiHandRight;
			if (currentHand.length === 0) {
				winner = aiCurrentPlayer;
				gamePhase = 'gameOver';
				return;
			}

			// Advance to next turn
			advanceTurn();
		}
	}

	// Initialize and start game on mount
	onMount(() => {
		initGame();
		// Start the game automatically after a brief delay
		setTimeout(() => {
			startGame();
		}, 500);
	});
</script>

<svelte:head>
	<title>Card Game</title>
	<meta name="description" content="A card game built with Svelte 5 and Framer Motion" />
</svelte:head>

<div class="game-container">
	<!-- AI Hands -->
	<AIHand cards={aiHandTop} placeholderCardId={[aiPlaceholderCardId, dealingPlaceholderIds].filter(Boolean).join(',')} />
	<SideAIHand cards={aiHandLeft} side="left" placeholderCardId={[aiPlaceholderCardId, dealingPlaceholderIds].filter(Boolean).join(',')} />
	<SideAIHand cards={aiHandRight} side="right" placeholderCardId={[aiPlaceholderCardId, dealingPlaceholderIds].filter(Boolean).join(',')} />

	<div class="game-header">
		<h1>Crazy Eights</h1>
		<div class="game-info">
			<div class="info-item">
				<span class="label">Deck:</span>
				<span class="value">{deck.length} cards</span>
			</div>
			<div class="info-item">
				<span class="label">Turn:</span>
				<span class="value">{currentTurn === 'player' ? 'Your Turn' : currentTurn === 'left' ? 'Left Player' : currentTurn === 'top' ? 'Top Player' : 'Right Player'}</span>
			</div>
			<div class="info-item">
				<span class="label">Phase:</span>
				<span class="value">{gamePhase}</span>
			</div>
		</div>
		{#if gamePhase === 'idle'}
			<button class="new-game-btn" onclick={startGame}>Start Game</button>
		{:else if gamePhase === 'gameOver'}
			<div class="game-over">
				<h2>🎉 {winner === 'player' ? 'You Win!' : `${winner} Player Wins!`}</h2>
				<button class="new-game-btn" onclick={() => startGame()}>Play Again</button>
			</div>
		{/if}
	</div>

	<!-- Discard pile centered -->
	<div class="discard-pile-center">
		<DiscardPile cards={discardPile} />
	</div>

	<!-- Deck positioned at bottom right -->
	<div class="deck-position">
		<Deck cardCount={deck.length} onClick={handleDrawCard} />
	</div>

	<!-- Player drawing card animation -->
	{#if drawingCard && drawAnimation}
		<DrawingCard
			card={drawingCard}
			startX={drawAnimation.startX}
			startY={drawAnimation.startY}
			endX={drawAnimation.endX}
			endY={drawAnimation.endY}
			startRotation={drawAnimation.startRotation}
			endRotation={drawAnimation.endRotation}
			startFaceUp={false}
			endFaceUp={true}
			onComplete={handleDrawComplete}
		/>
	{/if}

	<!-- AI drawing/playing card animation -->
	{#if aiDrawingCard && aiDrawAnimation}
		{@const isDrawing = !!aiPlaceholderCardId}
		<DrawingCard
			card={aiDrawingCard}
			startX={aiDrawAnimation.startX}
			startY={aiDrawAnimation.startY}
			endX={aiDrawAnimation.endX}
			endY={aiDrawAnimation.endY}
			startRotation={aiDrawAnimation.startRotation}
			endRotation={aiDrawAnimation.endRotation}
			startFaceUp={false}
			endFaceUp={!isDrawing}
			onComplete={aiPlaceholderCardId ? handleAIDrawComplete : handleAIPlayComplete}
		/>
	{/if}

	<!-- Dealing card animations - multiple cards can be in flight -->
	{#each dealingCards as dealingCardData (dealingCardData.id)}
		<DrawingCard
			card={dealingCardData.card}
			startX={dealingCardData.animation.startX}
			startY={dealingCardData.animation.startY}
			endX={dealingCardData.animation.endX}
			endY={dealingCardData.animation.endY}
			startRotation={dealingCardData.animation.startRotation}
			endRotation={dealingCardData.animation.endRotation}
			startFaceUp={false}
			endFaceUp={dealingCardData.toPlayer === 'player' || dealingCardData.toPlayer === 'discard'}
			duration={400}
			onComplete={() => completeDealingAnimation(dealingCardData.id)}
		/>
	{/each}

	<Hand
		cards={hand}
		{selectedCardId}
		placeholderCardId={[placeholderCardId, dealingPlaceholderIds].filter(Boolean).join(',')}
		onCardClick={handleCardClick}
		onCardDragEnd={handleCardDragEnd}
		onCardReorder={(newOrder) => { hand = newOrder; }}
	/>

	<div class="instructions">
		<p><strong>How to play:</strong></p>
		<ul>
			<li>Hover over cards in your hand to see them better</li>
			<li>Drag a card to the center discard pile to play it</li>
			<li>Click the deck (bottom right) to draw a card</li>
			<li>Use AI buttons to test AI drawing and playing cards</li>
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
		padding-top: 220px; /* Space for AI hand */
		padding-bottom: 240px; /* Space for player hand */
	}

	.game-over {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 15px;
	}

	.game-over h2 {
		color: white;
		font-size: 24px;
		margin: 0;
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

	.discard-pile-center {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 1; /* Lower than hand (z-index: 10) so dragging cards appear on top */
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

	.deck-position {
		position: fixed;
		bottom: 40px;
		right: 40px;
		z-index: 100;
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

		.deck-position {
			bottom: 200px;
			right: 20px;
		}
	}
</style>
