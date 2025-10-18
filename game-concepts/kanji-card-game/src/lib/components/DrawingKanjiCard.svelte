<script lang="ts">
	import type { Card } from '$lib/types';
	import { onMount } from 'svelte';

	interface Props {
		card: Card;
		startX: number;
		startY: number;
		endX: number;
		endY: number;
		startRotation?: number; // Starting rotation - defaults to 0
		endRotation: number; // Ending rotation
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
		duration = 800,
		onComplete
	}: Props = $props();

	let cardElement = $state<HTMLElement | null>(null);

	onMount(() => {
		// Start animation after a brief delay
		setTimeout(() => {
			if (cardElement) {
				// Trigger both the position and rotation animations simultaneously
				cardElement.style.left = `${endX}px`;
				cardElement.style.top = `${endY}px`;
				cardElement.style.transform = `translate(-50px, -70px) rotate(${endRotation}deg)`;

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
	style:transform="translate(-50px, -70px) rotate({startRotation}deg)"
	style:--duration="{duration}ms"
>
	<div class="kanji-card">
		<div class="stroke-count">{card.strokeCount}</div>
		<div class="card-content">
			<div class="character">{card.character}</div>
			{#if card.gloss}
				<div class="gloss">{card.gloss}</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.drawing-card {
		position: fixed;
		width: 100px;
		height: 140px;
		z-index: 2000;
		pointer-events: none;
		transition: left var(--duration, 800ms) cubic-bezier(0.34, 1.2, 0.64, 1),
			top var(--duration, 800ms) cubic-bezier(0.34, 1.2, 0.64, 1),
			transform var(--duration, 800ms) cubic-bezier(0.34, 1.2, 0.64, 1);
	}

	.kanji-card {
		width: 100px;
		height: 140px;
		background: white;
		border-radius: 8px;
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		user-select: none;
		position: relative;
	}

	.card-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 12px;
		width: 100%;
		height: 100%;
	}

	.character {
		font-size: 48px;
		font-weight: bold;
		line-height: 1;
	}

	.stroke-count {
		position: absolute;
		top: 4px;
		left: 6px;
		font-size: 11px;
		font-weight: 600;
		color: #999;
		background: rgba(255, 255, 255, 0.8);
		padding: 2px 4px;
		border-radius: 3px;
		line-height: 1;
	}

	.gloss {
		font-size: 10px;
		color: #666;
		text-align: center;
		max-width: 90%;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}
</style>

