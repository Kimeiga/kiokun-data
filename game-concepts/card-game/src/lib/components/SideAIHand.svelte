<script lang="ts">
	import type { Card as CardType } from '$lib/types';
	import { getCardPosition } from '$lib/utils/cardPositioning';

	interface Props {
		cards: CardType[];
		placeholderCardId?: string | null;
		side: 'left' | 'right';
	}

	let { cards = [], placeholderCardId = null, side }: Props = $props();

	// Base rotation: -90deg for left (cards point right), +90deg for right (cards point left)
	const baseRotation = side === 'left' ? -90 : 90;
</script>

<div class="side-ai-hand-container" class:left={side === 'left'} class:right={side === 'right'}>
	<div class="side-ai-hand">
		{#each cards as card, index (card.id)}
			{@const position = getCardPosition({
				index,
				totalCards: cards.length,
				invertRotation: side === 'right', // Right side fans opposite direction
				viewportWidth: typeof window !== 'undefined' ? window.innerHeight : 800,
				sidePadding: 100,
				maxRotation: 5
			})}
			{@const isPlaceholder = placeholderCardId ? placeholderCardId.split(',').includes(card.id) : false}
			{@const containerWidth = 200}
			{@const containerHeight = 600}
			{@const restX = containerWidth / 2}
			{@const restY = containerHeight / 2 + position.xOffset} <!-- Use xOffset as yOffset -->

			<div
				class="card-wrapper"
				data-ai-card-id={card.id}
				style:position="absolute"
				style:left="{restX}px"
				style:top="{restY}px"
				style:transform="translateX(-50px) translateY(-70px) rotate({baseRotation + position.rotation}deg)"
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
	.side-ai-hand-container {
		position: fixed;
		top: 50%;
		transform: translateY(-50%);
		width: 200px;
		height: 600px;
		display: flex;
		justify-content: center;
		align-items: center;
		pointer-events: none;
		z-index: 10;
	}

	.side-ai-hand-container.left {
		left: 0;
	}

	.side-ai-hand-container.right {
		right: 0;
	}

	.side-ai-hand {
		position: relative;
		width: 200px;
		height: 600px;
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

