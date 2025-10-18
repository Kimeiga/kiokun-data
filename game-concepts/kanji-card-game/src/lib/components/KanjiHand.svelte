<script lang="ts">
	import KanjiCard from './KanjiCard.svelte';
	import type { Card } from '$lib/types';
	import { getCardPosition } from '$lib/utils/cardPositioning';
	import { tick } from 'svelte';

	interface Props {
		cards: Card[];
		onCardClick?: (card: Card, index: number) => void;
		onCardDragEnd?: (card: Card, index: number, event: PointerEvent) => void;
		onCardReorder?: (newOrder: Card[]) => void;
		placeholderCardId?: string | null;
		isStaging?: boolean; // Whether this is the staging area or regular hand
	}

	let {
		cards = [],
		onCardClick,
		onCardDragEnd,
		onCardReorder,
		placeholderCardId = null,
		isStaging = false
	}: Props = $props();

	// MODEL: The logical order of cards
	let cardOrder = $state<Card[]>([]);

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
			console.log('⚠️ $effect: Skipping cardOrder update - currently dragging');
			return;
		}

		// Check if the order has changed by comparing IDs
		const orderChanged = cards.length !== cardOrder.length ||
			cards.some((card, i) => card.id !== cardOrder[i]?.id);

		if (orderChanged) {
			console.log('🔄 $effect: Order changed, updating cardOrder from props');
			// Preserve existing card references to maintain Svelte's element identity
			const newOrder = cards.map(propsCard => {
				const existingCard = cardOrder.find(c => c.id === propsCard.id);
				return existingCard || propsCard;
			});

			cardOrder = newOrder;
			console.log('✅ $effect: cardOrder updated from props');
		}
	});

	function handlePointerDown(card: Card, index: number, event: PointerEvent) {
		const target = event.currentTarget as HTMLElement;
		const wrapper = target.parentElement as HTMLElement;
		const wrapperRect = wrapper.getBoundingClientRect();

		if (!handContainerRef) return;
		const containerRect = handContainerRef.getBoundingClientRect();

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
				dragTargetIndex = clampedIndex;
			}
		}
	}

	async function handlePointerUp(card: Card, index: number, event: PointerEvent) {
		if (draggingCardId === card.id) {
			console.log('🔄 handlePointerUp called for card:', card.id);

			// Release pointer capture
			const target = event.currentTarget as HTMLElement;
			if (target.hasPointerCapture(event.pointerId)) {
				target.releasePointerCapture(event.pointerId);
			}

			// Find the dragged card's current index
			const draggedIndex = cardOrder.findIndex(c => c.id === draggingCardId);
			console.log('📍 Dragged index:', draggedIndex, 'Target index:', dragTargetIndex);

			// Check if it's a click or a drag
			const moveDistance = Math.sqrt(
				Math.pow(event.clientX - initialDragPosition.x, 2) +
					Math.pow(event.clientY - initialDragPosition.y, 2)
			);
			console.log('📏 Move distance:', moveDistance);

			if (moveDistance < 5) {
				// It's a click, not a drag
				console.log('👆 Detected as CLICK');
				onCardClick?.(card, draggedIndex);
				// Clear state immediately for clicks
				draggingCardId = null;
				dragTargetIndex = null;
				hoveredIndex = null;
			} else {
				// It's a drag - notify parent
				console.log('🎯 Detected as DRAG');
				onCardDragEnd?.(card, draggedIndex, event);

				if (dragTargetIndex !== null && dragTargetIndex !== draggedIndex) {
				// Commit the reorder if the target index changed
				console.log('🔄 Reordering from index', draggedIndex, 'to', dragTargetIndex);

				const newOrder = [...cardOrder];
				const [movedCard] = newOrder.splice(draggedIndex, 1);
				newOrder.splice(dragTargetIndex, 0, movedCard);

				console.log('1️⃣ Updating local cardOrder...');
				// 1. Update local cardOrder FIRST (but keep isDragging true AND keep dragTargetIndex)
				cardOrder = newOrder;
				console.log('✅ Local cardOrder updated');

				console.log('2️⃣ Notifying parent...');
				// 2. Notify parent
				onCardReorder?.(newOrder);
				console.log('✅ Parent notified');

				console.log('3️⃣ Waiting for Svelte to re-render...');
				// 3. Wait for Svelte to re-render
				await tick();
				console.log('✅ Svelte re-rendered');

				console.log('4️⃣ Waiting for browser to paint...');
				// 4. Wait for browser to paint
				await new Promise(resolve => requestAnimationFrame(resolve));
				console.log('✅ Browser painted');

				console.log('5️⃣ Clearing drag state...');
				// 5. Clear drag state - the card will now animate to its new position
				draggingCardId = null;
				dragTargetIndex = null;
				hoveredIndex = null;
				console.log('✅ Drag state cleared');
				} else {
					// No reorder needed, clear state immediately
					console.log('⏭️ No reorder needed (same position)');
					draggingCardId = null;
					dragTargetIndex = null;
					hoveredIndex = null;
				}
			}
		}
	}

	// Window-level pointer up handler as a safety net
	async function handleWindowPointerUp(event: PointerEvent) {
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
					// Clear state immediately for clicks
					draggingCardId = null;
					dragTargetIndex = null;
					hoveredIndex = null;
				} else if (dragTargetIndex !== null && dragTargetIndex !== draggedIndex) {
					// Commit the reorder if the target index changed

					const newOrder = [...cardOrder];
					const [movedCard] = newOrder.splice(draggedIndex, 1);
					newOrder.splice(dragTargetIndex, 0, movedCard);

					// 1. Update local cardOrder FIRST (but keep isDragging true AND keep dragTargetIndex)
					cardOrder = newOrder;

					// 2. Notify parent
					onCardReorder?.(newOrder);

					// 3. Wait for Svelte to re-render
					await tick();

					// 4. Wait for browser to paint
					await new Promise(resolve => requestAnimationFrame(resolve));

					// 5. Clear drag state - the card will now animate to its new position
					draggingCardId = null;
					dragTargetIndex = null;
					hoveredIndex = null;
				} else {
					// No reorder needed, clear state immediately
					draggingCardId = null;
					dragTargetIndex = null;
					hoveredIndex = null;
				}
			}
		}
	}
</script>

<svelte:window onpointermove={handlePointerMove} onpointerup={handleWindowPointerUp} />

<div class="hand-container" class:staging={isStaging}>
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
				class:invisible={isPlaceholder}
				data-card-id={card.id}
				style:position="absolute"
				style:left={isDragging ? `${dragPosition.x}px` : `${restX}px`}
				style:top={isDragging ? `${dragPosition.y}px` : `${restY}px`}
				style:transform={isDragging ? `translateX(-50px) translateY(-70px)` : `translateX(-50px) translateY(${-70 + (hoveredIndex === index ? -20 : 0)}px) rotate(${position.rotation}deg)`}
				style:z-index={isDragging ? 1000 : index}
				style:transition={isDragging ? 'none' : 'left 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), top 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'}
				style:pointer-events={isAnyCardDragging && !isDragging ? 'none' : 'auto'}
			>
				<KanjiCard
					{card}
					isDragging={isDragging}
					onPointerDown={(e) => handlePointerDown(card, index, e)}
					onPointerUp={(e) => handlePointerUp(card, index, e)}
				/>
			</div>
		{/each}
	</div>
</div>

<style>
	.hand-container {
		position: relative;
		width: 100%;
		display: flex;
		justify-content: center;
		pointer-events: none;
		height: 200px;
	}

	.hand-container.staging {
		height: 180px;
	}

	.hand {
		position: relative;
		width: 100%;
		max-width: 1200px;
		height: 100%;
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

	.card-wrapper.invisible {
		opacity: 0;
		pointer-events: none;
	}
</style>

