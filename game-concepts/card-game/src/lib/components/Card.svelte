<script lang="ts">
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

<div
	class="card {isSelected ? 'selected' : ''} {isDragging ? 'dragging' : ''} {isHovered ? 'hovered' : ''}"
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

<style>
	.card {
		width: 100px;
		height: 140px;
		perspective: 1000px;
		cursor: pointer;
		user-select: none;
		touch-action: none;
		transition: filter 0.2s ease;
	}

	.card.hovered {
		filter: brightness(1.1);
	}

	/* Component-specific styles - shared card styles are in app.css */

	.card-face {
		/* Override box-shadow transition for interactive cards */
		transition: box-shadow 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.card.dragging .card-face {
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
	}

	.top-left {
		align-self: flex-start;
	}

	.card.selected {
		filter: brightness(1.2);
	}

	.card.dragging {
		z-index: 1000;
		cursor: grabbing;
	}
</style>

