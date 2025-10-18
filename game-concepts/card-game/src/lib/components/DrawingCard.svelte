<script lang="ts">
	import type { Card } from '$lib/types';
	import { isRed } from '$lib/types';
	import { onMount } from 'svelte';

	interface Props {
		card: Card;
		startX: number;
		startY: number;
		endX: number;
		endY: number;
		startRotation?: number; // Starting rotation - defaults to 0
		endRotation: number; // Ending rotation
		startFaceUp?: boolean; // Starting state - defaults to false (face-down)
		endFaceUp?: boolean; // Ending state - defaults to true (face-up)
		duration?: number; // Animation duration in ms - defaults to 800
		onComplete: () => void;
	}

	let {
		card,
		startX,
		startY,
		endX,
		endY,
		startRotation = 0,
		endRotation,
		startFaceUp = false,
		endFaceUp = true,
		duration = 800,
		onComplete
	}: Props = $props();

	let cardElement = $state<HTMLElement | null>(null);
	// Start with the initial face state
	let isFaceUp = $state(startFaceUp);

	const cardColor = $derived(isRed(card.suit) ? 'text-red-600' : 'text-black');

	onMount(() => {
		// Start animation after a brief delay
		setTimeout(() => {
			if (cardElement) {
				// Trigger both the position, rotation, and flip animations simultaneously
				cardElement.style.left = `${endX}px`;
				cardElement.style.top = `${endY}px`;
				cardElement.style.transform = `rotate(${endRotation}deg)`;

				// Flip to end state if different from start state
				if (startFaceUp !== endFaceUp) {
					isFaceUp = endFaceUp;
				}

				// Call onComplete when animation finishes
				setTimeout(() => {
					onComplete();
				}, duration);
			}
		}, 50);
	});
</script>

<div
	bind:this={cardElement}
	class="drawing-card"
	style:left="{startX}px"
	style:top="{startY}px"
	style:transform="rotate({startRotation}deg)"
	style:--duration="{duration}ms"
>
	<div class="card-inner {isFaceUp ? '' : 'flipped'}">
		<!-- Front of card -->
		<div class="card-face card-front">
			<div class="card-corner top-left {cardColor}">
				<div class="rank">{card.rank}</div>
				<div class="suit">{card.suit}</div>
			</div>
			<div class="card-center {cardColor}">
				<div class="suit-large">{card.suit}</div>
			</div>
			<div class="card-corner bottom-right {cardColor}">
				<div class="rank">{card.rank}</div>
				<div class="suit">{card.suit}</div>
			</div>
		</div>
		<!-- Back of card -->
		<div class="card-face card-back">
			<div class="card-pattern"></div>
		</div>
	</div>
</div>

<style>
	.drawing-card {
		position: fixed;
		width: 100px;
		height: 140px;
		perspective: 1000px;
		z-index: 2000;
		pointer-events: none;
		transition: left var(--duration, 800ms) cubic-bezier(0.34, 1.2, 0.64, 1),
			top var(--duration, 800ms) cubic-bezier(0.34, 1.2, 0.64, 1),
			transform var(--duration, 800ms) cubic-bezier(0.34, 1.2, 0.64, 1);
	}

	/* Component-specific styles - shared card styles are in app.css */

	.card-inner {
		/* Override transition duration for drawing animation */
		transition: transform var(--duration, 800ms);
	}

	.card-face {
		/* Slightly stronger shadow for cards in flight */
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
	}

	.top-left {
		align-self: flex-start;
	}
</style>

