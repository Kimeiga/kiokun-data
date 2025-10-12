<script lang="ts">
	import Card from './Card.svelte';
	import type { Card as CardType } from '$lib/types';
	import { flip } from 'svelte/animate';

	interface Props {
		cards: CardType[];
		onCardClick?: (card: CardType, index: number) => void;
		onCardDragStart?: (card: CardType, index: number, event: PointerEvent) => void;
		onCardDragEnd?: (card: CardType, index: number, event: PointerEvent) => void;
		selectedCardId?: string | null;
	}

	let {
		cards = [],
		onCardClick,
		onCardDragStart,
		onCardDragEnd,
		selectedCardId = null
	}: Props = $props();

	// MODEL: The logical order of cards
	let cardOrder = $state<CardType[]>([]);

	// VIEW STATE: Visual interaction state
	let hoveredIndex = $state<number | null>(null);
	let draggingCardId = $state<string | null>(null);
	let releasingCardId = $state<string | null>(null);
	let justReleasedCardId = $state<string | null>(null); // Card that just finished releasing (disable transition for 1 frame)
	let cursorPosition = $state({ x: 0, y: 0 });
	let releaseTargetPosition = $state({ x: 0, y: 0 });
	let initialDragPosition = $state({ x: 0, y: 0 });
	let handContainerRef = $state<HTMLElement | null>(null);

	// Sync model with props
	$effect(() => {
		cardOrder = [...cards];
	});

	// Calculate card positions based on model
	function getCardPosition(index: number, totalCards: number) {
		const cardWidth = 100;
		const overlapAmount = cardWidth * 0.2; // 20% overlap (80px visible per card)
		const visibleWidth = cardWidth - overlapAmount;

		// Calculate total width needed
		const totalWidth = (totalCards - 1) * visibleWidth + cardWidth;

		// Calculate position from left edge of hand container
		const xOffset = index * visibleWidth - totalWidth / 2;

		// Add slight rotation for fan effect
		const centerIndex = (totalCards - 1) / 2;
		const offsetFromCenter = index - centerIndex;
		const maxRotation = 5;
		const rotation = totalCards > 1 ? (offsetFromCenter / centerIndex) * maxRotation : 0;

		return { xOffset, rotation };
	}

	function handlePointerDown(card: CardType, index: number, event: PointerEvent) {
		// Get the card wrapper to see its current position
		const target = event.currentTarget as HTMLElement;
		const wrapper = target.parentElement as HTMLElement;
		const rect = wrapper.getBoundingClientRect();
		const cardCenterY = rect.top + rect.height / 2;

		draggingCardId = card.id; // Set dragging immediately
		hoveredIndex = null; // Clear hover state

		// Set cursor position to where the card's center currently is
		// This way the card won't move when we start dragging
		cursorPosition = {
			x: event.clientX,
			y: cardCenterY
		};

		initialDragPosition = {
			x: event.clientX,
			y: event.clientY
		};

		// Set pointer capture for smooth dragging
		target.setPointerCapture(event.pointerId);

		onCardDragStart?.(card, index, event);
	}

	function handlePointerMove(event: PointerEvent) {
		if (draggingCardId !== null && handContainerRef) {
			// Update cursor position - card center will follow cursor
			cursorPosition = {
				x: event.clientX,
				y: event.clientY
			};

			// Calculate which position the card should be inserted at
			const handRect = handContainerRef.getBoundingClientRect();
			const relativeX = event.clientX - handRect.left;

			const cardWidth = 100;
			const overlapAmount = cardWidth * 0.2;
			const visibleWidth = cardWidth - overlapAmount;

			// Find the current index of the dragged card
			const currentIndex = cardOrder.findIndex(c => c.id === draggingCardId);
			if (currentIndex === -1) return;

			// Calculate which slot the cursor is over
			const totalWidth = (cardOrder.length - 1) * visibleWidth + cardWidth;
			const startX = handRect.width / 2 - totalWidth / 2;
			const targetIndex = Math.round((relativeX - startX) / visibleWidth);
			const clampedIndex = Math.max(0, Math.min(cardOrder.length - 1, targetIndex));

			// Reorder the model if the target position changed
			if (clampedIndex !== currentIndex) {
				const newOrder = [...cardOrder];
				const [draggedCard] = newOrder.splice(currentIndex, 1);
				newOrder.splice(clampedIndex, 0, draggedCard);
				cardOrder = newOrder;
			}
		}
	}

	function handlePointerUp(card: CardType, index: number, event: PointerEvent) {
		if (draggingCardId === card.id) {
			// Release pointer capture
			const target = event.currentTarget as HTMLElement;
			if (target.hasPointerCapture(event.pointerId)) {
				target.releasePointerCapture(event.pointerId);
			}

			// Check if it's a click or a drag
			const moveDistance = Math.sqrt(
				Math.pow(event.clientX - initialDragPosition.x, 2) +
					Math.pow(event.clientY - initialDragPosition.y, 2)
			);

			if (moveDistance < 5) {
				// It's a click, not a drag
				onCardClick?.(card, index);
				draggingCardId = null;
				hoveredIndex = null; // Clear hover state on click too
			} else {
				// It's a drag - calculate target position in viewport coordinates
				if (handContainerRef) {
					const position = getCardPosition(index, cardOrder.length);
					const handRect = handContainerRef.getBoundingClientRect();
					const cardHeight = 140;
					const handHeight = 200;

					// Calculate the center of where the card should be
					// We use translateY(-50%) which is -70px for a 140px card
					// So we need to add 70px to get the actual top position
					const cardCenterY = handRect.top + (handHeight - cardHeight) / 2 + cardHeight / 2;

					releaseTargetPosition = {
						x: handRect.left + handRect.width / 2 + position.xOffset,
						y: cardCenterY
					};
				}

				releasingCardId = card.id;
				draggingCardId = null;
				hoveredIndex = null; // Clear hover state on release

				// After transition completes, clear releasing state
				setTimeout(() => {
					if (releasingCardId === card.id) {
						justReleasedCardId = card.id; // Mark as just released (no transition for 1 frame)
						releasingCardId = null;

						// Clear justReleased flag after next frame
						requestAnimationFrame(() => {
							justReleasedCardId = null;
						});
					}
				}, 300); // Match the transition duration

				onCardDragEnd?.(card, index, event);
			}
		}
	}

	// Window-level pointer up handler as a safety net
	// This ensures we always release the drag even if the card's pointerup doesn't fire
	function handleWindowPointerUp(event: PointerEvent) {
		if (draggingCardId !== null) {
			// Find the card being dragged
			const draggedCard = cardOrder.find(c => c.id === draggingCardId);
			const draggedIndex = cardOrder.findIndex(c => c.id === draggingCardId);

			if (draggedCard && draggedIndex !== -1) {
				// Check if it's a click or a drag
				const moveDistance = Math.sqrt(
					Math.pow(event.clientX - initialDragPosition.x, 2) +
						Math.pow(event.clientY - initialDragPosition.y, 2)
				);

				if (moveDistance < 5) {
					// It's a click, not a drag
					onCardClick?.(draggedCard, draggedIndex);
					draggingCardId = null;
					hoveredIndex = null; // Clear hover state on click too
				} else {
					// It's a drag - calculate target position in viewport coordinates
					if (handContainerRef) {
						const position = getCardPosition(draggedIndex, cardOrder.length);
						const handRect = handContainerRef.getBoundingClientRect();
						const cardHeight = 140;
						const handHeight = 200;

						// Calculate the center of where the card should be
						// We use translateY(-50%) which is -70px for a 140px card
						// So we need to add 70px to get the actual top position
						const cardCenterY = handRect.top + (handHeight - cardHeight) / 2 + cardHeight / 2;

						releaseTargetPosition = {
							x: handRect.left + handRect.width / 2 + position.xOffset,
							y: cardCenterY
						};
					}

					releasingCardId = draggedCard.id;
					draggingCardId = null;
					hoveredIndex = null; // Clear hover state on release

					// After transition completes, clear releasing state
					setTimeout(() => {
						if (releasingCardId === draggedCard.id) {
							justReleasedCardId = draggedCard.id; // Mark as just released (no transition for 1 frame)
							releasingCardId = null;

							// Clear justReleased flag after next frame
							requestAnimationFrame(() => {
								justReleasedCardId = null;
							});
						}
					}, 300); // Match the transition duration

					onCardDragEnd?.(draggedCard, draggedIndex, event);
				}
			}
		}
	}
</script>

<svelte:window onpointermove={handlePointerMove} onpointerup={handleWindowPointerUp} />

<div class="hand-container" bind:this={handContainerRef}>
	<div class="hand">
		{#each cardOrder as card, index (card.id)}
			{@const position = getCardPosition(index, cardOrder.length)}
			{@const isDragging = draggingCardId === card.id}
			{@const isReleasing = releasingCardId === card.id}
			{@const isJustReleased = justReleasedCardId === card.id}
			{@const isAnyCardDragging = draggingCardId !== null}

			<div
				class="card-wrapper"
				class:dragging={isDragging}
				class:releasing={isReleasing}
				class:hovered={hoveredIndex === index && !isDragging && !isReleasing}
				animate:flip={{ duration: 300 }}
				style:position={isDragging || isReleasing ? 'fixed' : 'absolute'}
				style:left={isDragging ? `${cursorPosition.x}px` : isReleasing ? `${releaseTargetPosition.x}px` : '50%'}
				style:top={isDragging ? `${cursorPosition.y}px` : isReleasing ? `${releaseTargetPosition.y}px` : 'auto'}
				style:transform={isDragging || isReleasing ? `translateX(-50px) translateY(-50%)` : `translateX(${position.xOffset - 50}px) translateY(${hoveredIndex === index ? -20 : 0}px) rotate(${position.rotation}deg)`}
				style:z-index={isDragging || isReleasing ? 1000 : index}
				style:transition={isDragging || isJustReleased ? 'none' : 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'}
				style:pointer-events={isAnyCardDragging && !isDragging ? 'none' : 'auto'}
			>
				<Card
					{card}
					isHovered={hoveredIndex === index && !isDragging && !isReleasing}
					isSelected={selectedCardId === card.id}
					isDragging={isDragging || isReleasing}
					onPointerDown={(e) => handlePointerDown(card, index, e)}
					onPointerUp={(e) => handlePointerUp(card, index, e)}
					onPointerEnter={() => !isAnyCardDragging && (hoveredIndex = index)}
					onPointerLeave={() => (hoveredIndex = null)}
				/>
			</div>
		{/each}
	</div>
</div>

<style>
	.hand-container {
		position: fixed;
		bottom: 20px;
		left: 0;
		right: 0;
		display: flex;
		justify-content: center;
		pointer-events: none;
		height: 200px;
	}

	.hand {
		position: relative;
		width: 100%;
		max-width: 1200px;
		height: 200px;
		pointer-events: auto;
	}

	.card-wrapper {
		cursor: pointer;
		user-select: none;
		touch-action: none;
		transform-origin: 50px 50%;
	}

	.card-wrapper.dragging {
		pointer-events: none;
	}
</style>

