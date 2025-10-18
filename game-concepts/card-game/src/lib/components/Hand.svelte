<script lang="ts">
	import Card from './Card.svelte';
	import type { Card as CardType } from '$lib/types';
	import { getCardPosition } from '$lib/utils/cardPositioning';

	interface Props {
		cards: CardType[];
		onCardClick?: (card: CardType, index: number) => void;
		onCardDragStart?: (card: CardType, index: number, event: PointerEvent) => void;
		onCardDragEnd?: (card: CardType, index: number, event: PointerEvent) => void;
		onCardReorder?: (newOrder: CardType[]) => void;
		selectedCardId?: string | null;
		placeholderCardId?: string | null;
	}

	let {
		cards = [],
		onCardClick,
		onCardDragStart,
		onCardDragEnd,
		onCardReorder,
		selectedCardId = null,
		placeholderCardId = null
	}: Props = $props();

	// MODEL: The logical order of cards
	let cardOrder = $state<CardType[]>([]);

	// VIEW STATE: Visual interaction state
	let hoveredIndex = $state<number | null>(null);
	let draggingCardId = $state<string | null>(null);
	let dragPosition = $state({ x: 0, y: 0 }); // Position in container coordinates
	let dragOffset = $state({ x: 0, y: 0 }); // Offset from cursor to card center
	let initialDragPosition = $state({ x: 0, y: 0 });
	let dragTargetIndex = $state<number | null>(null); // Visual target position during drag
	let handContainerRef = $state<HTMLElement | null>(null);

	// Sync model with props - preserve order of existing cards
	$effect(() => {
		// Don't update cardOrder while dragging - let the drag logic handle it
		if (draggingCardId !== null) {
			console.log('⏸️  $effect PAUSED - dragging in progress');
			return;
		}

		console.log('▶️  $effect RUNNING');
		console.log('  cards.length:', cards.length);
		console.log('  cardOrder.length:', cardOrder.length);
		console.log('  cards IDs:', cards.map(c => c.id));
		console.log('  cardOrder IDs:', cardOrder.map(c => c.id));

		// If any card has a dealing ID, use the cards prop order directly
		// but still apply the same logic to preserve card identity
		const hasPlaceholders = cards.some(c => c.id.includes('-dealing-') || c.id.includes('-drawing'));

		if (hasPlaceholders) {
			console.log('  Has placeholders - using props order');
			// During dealing/drawing, maintain cards in the exact order from props
			// but use the same update logic to preserve card references
			const cardsInPropsOrder = cards.map(propsCard => {
				const existingCard = cardOrder.find(c => c.id === propsCard.id);
				return existingCard || propsCard;
			});

			// Only update if there's actually a change
			if (cardsInPropsOrder.length !== cardOrder.length ||
			    cardsInPropsOrder.some((c, i) => c.id !== cardOrder[i]?.id)) {
				console.log('  ✅ UPDATING cardOrder (placeholders)');
				cardOrder = cardsInPropsOrder;
			} else {
				console.log('  ⏭️  SKIPPING update (no change)');
			}
			return;
		}

		console.log('  No placeholders - normal update logic');

		// Check if the order has changed by comparing IDs
		const orderChanged = cards.length !== cardOrder.length ||
			cards.some((card, i) => card.id !== cardOrder[i]?.id);

		if (orderChanged) {
			console.log('  ✅ UPDATING cardOrder (order changed)');
			console.log('    Old order:', cardOrder.map(c => c.id));
			console.log('    New order:', cards.map(c => c.id));

			// Preserve existing card references to maintain Svelte's element identity
			const newOrder = cards.map(propsCard => {
				const existingCard = cardOrder.find(c => c.id === propsCard.id);
				return existingCard || propsCard;
			});

			cardOrder = newOrder;
		} else {
			console.log('  ⏭️  SKIPPING update (no change)');
		}
	});

	// Calculate card positions using shared utility
	// (removed duplicate code - now using getCardPosition from cardPositioning.ts)

	function handlePointerDown(card: CardType, index: number, event: PointerEvent) {
		const target = event.currentTarget as HTMLElement;
		const wrapper = target.parentElement as HTMLElement;
		const wrapperRect = wrapper.getBoundingClientRect();

		if (!handContainerRef) return;
		const containerRect = handContainerRef.getBoundingClientRect();

		console.log('🖱️ POINTER DOWN');
		console.log('  Card:', card.id);
		console.log('  Index:', index);
		console.log('  cardOrder IDs:', cardOrder.map(c => c.id));

		draggingCardId = card.id;
		dragTargetIndex = index; // Start at current position
		hoveredIndex = null;

		// Calculate card center in viewport coordinates
		const cardCenterX = wrapperRect.left + wrapperRect.width / 2;
		const cardCenterY = wrapperRect.top + wrapperRect.height / 2;

		// Calculate offset from cursor to card center
		// This allows us to "grab" the card from wherever we click
		dragOffset = {
			x: cardCenterX - event.clientX,
			y: cardCenterY - event.clientY
		};

		// Set initial drag position to current card center (in container coordinates)
		dragPosition = {
			x: cardCenterX - containerRect.left,
			y: cardCenterY - containerRect.top
		};

		initialDragPosition = {
			x: event.clientX,
			y: event.clientY
		};

		target.setPointerCapture(event.pointerId);
		onCardDragStart?.(card, index, event);
	}

	function handlePointerMove(event: PointerEvent) {
		if (draggingCardId !== null && handContainerRef) {
			const containerRect = handContainerRef.getBoundingClientRect();

			// Update drag position in container coordinates
			// Apply the offset so the card stays "grabbed" from where we clicked
			dragPosition = {
				x: event.clientX + dragOffset.x - containerRect.left,
				y: event.clientY + dragOffset.y - containerRect.top
			};

			// Calculate which position the card should be inserted at
			const relativeX = event.clientX - containerRect.left;

			const cardWidth = 100;
			const overlapAmount = cardWidth * 0.2;
			const visibleWidth = cardWidth - overlapAmount;

			// Find the current index of the dragged card
			const currentIndex = cardOrder.findIndex(c => c.id === draggingCardId);
			if (currentIndex === -1) return;

			// Calculate which slot the cursor is over
			const totalWidth = (cardOrder.length - 1) * visibleWidth + cardWidth;
			const startX = containerRect.width / 2 - totalWidth / 2;
			const targetIndex = Math.round((relativeX - startX) / visibleWidth);
			const clampedIndex = Math.max(0, Math.min(cardOrder.length - 1, targetIndex));

			// Just track the target index visually - don't reorder yet
			if (clampedIndex !== dragTargetIndex) {
				console.log('🎯 TARGET INDEX CHANGED:', currentIndex, '→', clampedIndex);
				dragTargetIndex = clampedIndex;
			}
		}
	}

	function handlePointerUp(card: CardType, index: number, event: PointerEvent) {
		if (draggingCardId === card.id) {
			console.log('🖱️ POINTER UP (on card)');
			console.log('  Card:', card.id);
			console.log('  cardOrder IDs:', cardOrder.map(c => c.id));

			// Release pointer capture
			const target = event.currentTarget as HTMLElement;
			if (target.hasPointerCapture(event.pointerId)) {
				target.releasePointerCapture(event.pointerId);
			}

			// Find the dragged card's current index
			const draggedIndex = cardOrder.findIndex(c => c.id === draggingCardId);

			// Check if it's a click or a drag
			const moveDistance = Math.sqrt(
				Math.pow(event.clientX - initialDragPosition.x, 2) +
					Math.pow(event.clientY - initialDragPosition.y, 2)
			);

			console.log('  Move distance:', moveDistance);

			if (moveDistance < 5) {
				// It's a click, not a drag
				console.log('  Treating as CLICK');
				onCardClick?.(card, draggedIndex);
			} else {
				// It's a drag - just end it
				console.log('  Treating as DRAG');
				onCardDragEnd?.(card, draggedIndex, event);
			}

			// Commit the reorder if the target index changed
			// Notify parent so it can update its state
			if (dragTargetIndex !== null && dragTargetIndex !== draggedIndex) {
				console.log('✅ COMMITTING REORDER');
				console.log('  From index:', draggedIndex);
				console.log('  To index:', dragTargetIndex);
				console.log('  Before:', cardOrder.map(c => c.id));

				const newOrder = [...cardOrder];
				const [movedCard] = newOrder.splice(draggedIndex, 1);
				newOrder.splice(dragTargetIndex, 0, movedCard);

				console.log('  After:', newOrder.map(c => c.id));

				// Notify parent of the new order
				onCardReorder?.(newOrder);
			}

			// Clear dragging state - CSS transition will animate card to new position
			console.log('✅ DRAG END - setting draggingCardId to null');
			console.log('  Final cardOrder IDs:', cardOrder.map(c => c.id));

			draggingCardId = null;
			dragTargetIndex = null;
			hoveredIndex = null;
		}
	}

	// Window-level pointer up handler as a safety net
	// This ensures we always release the drag even if the card's pointerup doesn't fire
	function handleWindowPointerUp(event: PointerEvent) {
		if (draggingCardId !== null) {
			console.log('🖱️ POINTER UP (on window - safety net)');

			// Find the card being dragged
			const draggedCard = cardOrder.find(c => c.id === draggingCardId);
			const draggedIndex = cardOrder.findIndex(c => c.id === draggingCardId);

			if (draggedCard && draggedIndex !== -1) {
				// Check if it's a click or a drag
				const moveDistance = Math.sqrt(
					Math.pow(event.clientX - initialDragPosition.x, 2) +
						Math.pow(event.clientY - initialDragPosition.y, 2)
				);

				console.log('  Move distance:', moveDistance);

				if (moveDistance < 5) {
					// It's a click, not a drag
					console.log('  Treating as CLICK');
					onCardClick?.(draggedCard, draggedIndex);
				} else {
					// It's a drag - just end it
					console.log('  Treating as DRAG');
					onCardDragEnd?.(draggedCard, draggedIndex, event);
				}

				// Commit the reorder if the target index changed
				// Notify parent so it can update its state
				if (dragTargetIndex !== null && dragTargetIndex !== draggedIndex) {
					console.log('✅ COMMITTING REORDER');
					console.log('  From index:', draggedIndex);
					console.log('  To index:', dragTargetIndex);
					console.log('  Before:', cardOrder.map(c => c.id));

					const newOrder = [...cardOrder];
					const [movedCard] = newOrder.splice(draggedIndex, 1);
					newOrder.splice(dragTargetIndex, 0, movedCard);

					console.log('  After:', newOrder.map(c => c.id));

					// Notify parent of the new order
					onCardReorder?.(newOrder);
				}

				// Clear dragging state - CSS transition will animate card to new position
				console.log('✅ DRAG END - setting draggingCardId to null');
				console.log('  Final cardOrder IDs:', cardOrder.map(c => c.id));

				draggingCardId = null;
				dragTargetIndex = null;
				hoveredIndex = null;
			}
		}
	}
</script>

<svelte:window onpointermove={handlePointerMove} onpointerup={handleWindowPointerUp} />

<div class="hand-container">
	<div class="hand" bind:this={handContainerRef}>
		{#each cardOrder as card, index (card.id)}
			{@const isDragging = draggingCardId === card.id}
			{@const isAnyCardDragging = draggingCardId !== null}
			{@const isPlaceholder = placeholderCardId ? placeholderCardId.split(',').includes(card.id) : false}

			{@const visualIndex = (() => {
				// Calculate visual index based on drag target
				if (!isAnyCardDragging || dragTargetIndex === null) return index;

				const draggedIndex = cardOrder.findIndex(c => c.id === draggingCardId);
				if (draggedIndex === -1) return index;

				// If this is the dragged card, use the target index
				if (isDragging) return dragTargetIndex;

				// If this card is between the dragged card's original and target positions, shift it
				if (draggedIndex < dragTargetIndex) {
					// Dragging right: cards between original and target shift left
					if (index > draggedIndex && index <= dragTargetIndex) return index - 1;
				} else if (draggedIndex > dragTargetIndex) {
					// Dragging left: cards between target and original shift right
					if (index >= dragTargetIndex && index < draggedIndex) return index + 1;
				}

				return index;
			})()}

			{@const position = getCardPosition({ index: visualIndex, totalCards: cardOrder.length })}
			{@const containerWidth = handContainerRef?.getBoundingClientRect().width ?? 0}
			{@const containerHeight = handContainerRef?.getBoundingClientRect().height ?? 200}
			{@const restX = containerWidth / 2 + position.xOffset}
			{@const restY = containerHeight / 2}

			<div
				class="card-wrapper"
				class:dragging={isDragging}
				class:hovered={hoveredIndex === index && !isDragging}
				data-card-id={card.id}
				style:position="absolute"
				style:left={isDragging ? `${dragPosition.x}px` : `${restX}px`}
				style:top={isDragging ? `${dragPosition.y}px` : `${restY}px`}
				style:transform={isDragging ? `translateX(-50px) translateY(-70px)` : `translateX(-50px) translateY(${-70 + (hoveredIndex === index ? -20 : 0)}px) rotate(${position.rotation}deg)`}
				style:z-index={isDragging ? 1000 : index}
				style:opacity={isPlaceholder ? 0 : 1}
				style:transition={isDragging ? 'none' : 'left 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), top 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'}
				style:pointer-events={isAnyCardDragging && !isDragging ? 'none' : 'auto'}
			>
				<Card
					{card}
					isHovered={hoveredIndex === index && !isDragging}
					isSelected={selectedCardId === card.id}
					isDragging={isDragging}
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
		z-index: 10; /* Higher than discard pile (z-index: 1) so dragging cards appear on top */
	}

	.hand {
		position: relative;
		width: 100%;
		max-width: 1200px;
		height: 200px;
		pointer-events: auto;
		z-index: 10; /* Higher than discard pile (z-index: 5) so dragging cards appear on top */
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

