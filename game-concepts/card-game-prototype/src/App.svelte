<script>
  import { Motion } from 'svelte-motion';
  import Card from './Card.svelte';
  
  // Create a standard 52-card deck
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const suitColors = { '♠': 'black', '♥': 'red', '♦': 'red', '♣': 'black' };
  
  function createDeck() {
    const deck = [];
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({
          id: `${rank}${suit}`,
          rank,
          suit,
          color: suitColors[suit]
        });
      }
    }
    return shuffle(deck);
  }
  
  function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  
  // Game state using Svelte 5 runes
  let deck = $state(createDeck());
  let hand = $state([]);
  let discardPile = $state([]);
  let selectedCard = $state(null);
  let draggedCard = $state(null);
  
  // Deal initial hand
  $effect(() => {
    if (hand.length === 0 && deck.length > 0) {
      dealCards(7);
    }
  });
  
  function dealCards(count) {
    const newCards = deck.slice(0, count);
    deck = deck.slice(count);
    hand = [...hand, ...newCards];
  }
  
  function handleCardClick(card) {
    if (selectedCard?.id === card.id) {
      // Deselect if clicking the same card
      selectedCard = null;
    } else {
      selectedCard = card;
    }
  }
  
  function handleDiscardClick() {
    if (selectedCard) {
      playCardToDiscard(selectedCard);
    }
  }
  
  function playCardToDiscard(card) {
    // Remove from hand
    hand = hand.filter(c => c.id !== card.id);
    // Add to discard pile
    discardPile = [...discardPile, card];
    // Deselect
    selectedCard = null;
  }
  
  function handleDragStart(card) {
    draggedCard = card;
  }
  
  function handleDragEnd() {
    draggedCard = null;
  }
  
  function handleCardDrop(targetCard) {
    if (draggedCard && draggedCard.id !== targetCard.id) {
      // Play the dragged card onto the target card (to discard)
      playCardToDiscard(draggedCard);
    }
  }
  
  function handleDiscardDrop() {
    if (draggedCard) {
      playCardToDiscard(draggedCard);
    }
  }
  
  function drawCard() {
    if (deck.length > 0) {
      dealCards(1);
    }
  }
  
  function resetGame() {
    deck = createDeck();
    hand = [];
    discardPile = [];
    selectedCard = null;
    draggedCard = null;
  }
</script>

<div class="game-container">
  <!-- Deck -->
  <div class="deck-area">
    <button class="deck" onclick={drawCard} disabled={deck.length === 0}>
      <div class="card-back">
        <div class="pattern"></div>
      </div>
      <div class="deck-count">{deck.length}</div>
    </button>
  </div>
  
  <!-- Discard Pile -->
  <div class="discard-area">
    <div 
      class="discard-pile"
      class:has-cards={discardPile.length > 0}
      onclick={handleDiscardClick}
      role="button"
      tabindex="0"
    >
      {#if discardPile.length > 0}
        <Card 
          card={discardPile[discardPile.length - 1]} 
          ondrop={() => handleDiscardDrop()}
        />
      {:else}
        <div class="empty-pile">Discard Pile</div>
      {/if}
    </div>
  </div>
  
  <!-- Hand -->
  <div class="hand-area">
    <div class="hand">
      {#each hand as card, i (card.id)}
        <Card 
          {card}
          index={i}
          totalCards={hand.length}
          isSelected={selectedCard?.id === card.id}
          isDragging={draggedCard?.id === card.id}
          onclick={() => handleCardClick(card)}
          ondragstart={() => handleDragStart(card)}
          ondragend={() => handleDragEnd()}
          ondrop={() => handleCardDrop(card)}
        />
      {/each}
    </div>
  </div>
  
  <!-- Controls -->
  <div class="controls">
    <button onclick={resetGame}>New Game</button>
    <div class="info">
      <span>Hand: {hand.length}</span>
      <span>Deck: {deck.length}</span>
      <span>Discard: {discardPile.length}</span>
    </div>
  </div>
</div>

<style>
  .game-container {
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    padding: 20px;
    position: relative;
  }
  
  .deck-area {
    position: absolute;
    top: 50%;
    left: 100px;
    transform: translateY(-50%);
  }
  
  .deck {
    width: 120px;
    height: 168px;
    background: none;
    border: none;
    cursor: pointer;
    position: relative;
    transition: transform 0.2s;
  }
  
  .deck:hover:not(:disabled) {
    transform: translateY(-10px);
  }
  
  .deck:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .card-back {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #c41e3a 0%, #8b0000 100%);
    border: 3px solid #ffd700;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  }
  
  .pattern {
    width: 80%;
    height: 80%;
    background-image: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 10px,
      rgba(255, 255, 255, 0.1) 10px,
      rgba(255, 255, 255, 0.1) 20px
    );
  }
  
  .deck-count {
    position: absolute;
    bottom: -25px;
    left: 50%;
    transform: translateX(-50%);
    color: white;
    font-weight: bold;
    font-size: 18px;
  }
  
  .discard-area {
    position: absolute;
    top: 50%;
    right: 100px;
    transform: translateY(-50%);
  }
  
  .discard-pile {
    width: 120px;
    height: 168px;
    border: 3px dashed rgba(255, 255, 255, 0.3);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .discard-pile:hover {
    border-color: rgba(255, 255, 255, 0.6);
    background: rgba(255, 255, 255, 0.05);
  }
  
  .discard-pile.has-cards {
    border: none;
  }
  
  .empty-pile {
    color: rgba(255, 255, 255, 0.5);
    font-size: 14px;
    text-align: center;
  }
  
  .hand-area {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    width: 90%;
    max-width: 1200px;
  }
  
  .hand {
    display: flex;
    justify-content: center;
    align-items: flex-end;
    height: 220px;
    position: relative;
  }
  
  .controls {
    position: absolute;
    top: 20px;
    right: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-end;
  }
  
  .controls button {
    padding: 10px 20px;
    background: rgba(255, 255, 255, 0.2);
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 8px;
    color: white;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .controls button:hover {
    background: rgba(255, 255, 255, 0.3);
    border-color: rgba(255, 255, 255, 0.5);
  }
  
  .info {
    display: flex;
    flex-direction: column;
    gap: 5px;
    color: white;
    font-size: 14px;
    background: rgba(0, 0, 0, 0.3);
    padding: 10px 15px;
    border-radius: 8px;
  }
</style>

