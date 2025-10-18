<script lang="ts">
	import type { Card as CardType } from '$lib/types';
	import { getCardPosition } from '$lib/utils/cardPositioning';

	interface Props {
		cards: CardType[];
		placeholderCardId?: string | null;
	}

	let { cards = [], placeholderCardId = null }: Props = $props();
</script>

<div class="ai-hand-container">
	<div class="ai-hand">
		{#each cards as card, index (card.id)}
			{@const position = getCardPosition({ index, totalCards: cards.length, invertRotation: true })}
			{@const isPlaceholder = placeholderCardId ? placeholderCardId.split(',').includes(card.id) : false}
			{@const containerWidth = 800}
			{@const containerHeight = 200}
			{@const restX = containerWidth / 2 + position.xOffset}
			{@const restY = containerHeight / 2}

			<div
				class="card-wrapper"
				data-ai-card-id={card.id}
				style:position="absolute"
				style:left="{restX}px"
				style:top="{restY}px"
				style:transform="translateX(-50px) translateY(-70px) rotate({position.rotation}deg)"
				style:z-index={index}
				style:opacity={isPlaceholder ? 0 : 1}
			>
				<!-- Card back - using same structure as Card.svelte -->
				<div class="card">
					<div class="card-inner flipped">
						<div class="card-face card-back">
							<div class="card-pattern"></div>
						</div>
					</div>
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.ai-hand-container {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 200px;
		display: flex;
		justify-content: center;
		align-items: flex-start;
		pointer-events: none;
		z-index: 10;
	}

	.ai-hand {
		position: relative;
		width: 800px;
		height: 200px;
	}

	.card-wrapper {
		position: absolute;
		width: 100px;
		height: 140px;
		transition: left 1.5s cubic-bezier(0.34, 1.2, 0.64, 1), 
		            top 1.5s cubic-bezier(0.34, 1.2, 0.64, 1), 
		            transform 1.5s cubic-bezier(0.34, 1.2, 0.64, 1);
	}

	/* Component-specific styles - shared card styles are in app.css */

	.card {
		width: 100%;
		height: 100%;
		perspective: 1000px;
	}
</style>

