<script lang="ts">
	import { Motion } from 'svelte-motion';
	import type { Card } from '$lib/types';
	import { isRed } from '$lib/types';

	interface Props {
		card: Card;
		isHovered?: boolean;
		isSelected?: boolean;
		isDragging?: boolean;
		onPointerDown?: (e: PointerEvent) => void;
		onPointerUp?: (e: PointerEvent) => void;
		onPointerEnter?: (e: PointerEvent) => void;
		onPointerLeave?: (e: PointerEvent) => void;
		style?: string;
	}

	let {
		card,
		isHovered = false,
		isSelected = false,
		isDragging = false,
		onPointerDown,
		onPointerUp,
		onPointerEnter,
		onPointerLeave,
		style = ''
	}: Props = $props();

	const cardColor = $derived(isRed(card.suit) ? 'text-red-600' : 'text-black');
</script>

<Motion
	let:motion
	animate={{
		filter: isHovered ? 'brightness(1.1)' : 'brightness(1)'
	}}
	transition={{
		type: 'spring',
		stiffness: 300,
		damping: 20
	}}
>
	<div
		use:motion
		class="card {isSelected ? 'selected' : ''} {isDragging ? 'dragging' : ''}"
		{style}
		role="button"
		tabindex="0"
		onpointerdown={onPointerDown}
		onpointerup={onPointerUp}
		onpointerenter={onPointerEnter}
		onpointerleave={onPointerLeave}
	>
		<div class="card-inner {card.faceUp ? '' : 'flipped'}">
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
</Motion>

<style>
	.card {
		width: 100px;
		height: 140px;
		perspective: 1000px;
		cursor: pointer;
		user-select: none;
		touch-action: none;
	}

	.card-inner {
		position: relative;
		width: 100%;
		height: 100%;
		transition: transform 0.6s;
		transform-style: preserve-3d;
	}

	.card-inner.flipped {
		transform: rotateY(180deg);
	}

	.card-face {
		position: absolute;
		width: 100%;
		height: 100%;
		backface-visibility: hidden;
		border-radius: 8px;
		border: 2px solid #333;
		background: white;
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
		transition: box-shadow 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.card.dragging .card-face {
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
	}

	.card-front {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 8px;
	}

	.card-back {
		transform: rotateY(180deg);
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	}

	.card-pattern {
		width: 100%;
		height: 100%;
		background-image: repeating-linear-gradient(
				45deg,
				transparent,
				transparent 10px,
				rgba(255, 255, 255, 0.1) 10px,
				rgba(255, 255, 255, 0.1) 20px
			),
			repeating-linear-gradient(
				-45deg,
				transparent,
				transparent 10px,
				rgba(255, 255, 255, 0.1) 10px,
				rgba(255, 255, 255, 0.1) 20px
			);
		border-radius: 6px;
	}

	.card-corner {
		display: flex;
		flex-direction: column;
		align-items: center;
		font-weight: bold;
		line-height: 1;
	}

	.top-left {
		align-self: flex-start;
	}

	.bottom-right {
		align-self: flex-end;
		transform: rotate(180deg);
	}

	.rank {
		font-size: 18px;
	}

	.suit {
		font-size: 16px;
	}

	.card-center {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.suit-large {
		font-size: 48px;
	}

	.card.selected {
		filter: brightness(1.2);
	}

	.card.dragging {
		z-index: 1000;
		cursor: grabbing;
	}
</style>

