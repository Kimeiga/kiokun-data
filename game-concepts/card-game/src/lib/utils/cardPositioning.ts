/**
 * Shared utility for calculating card positions in a hand layout
 * Used by both Hand.svelte and AIHand.svelte
 */

export interface CardPosition {
	xOffset: number;
	rotation: number;
}

export interface CardPositionOptions {
	/** Index of the card in the hand */
	index: number;
	/** Total number of cards in the hand */
	totalCards: number;
	/** Whether to invert the rotation (for AI hand) */
	invertRotation?: boolean;
	/** Viewport width (defaults to window.innerWidth or 1200) */
	viewportWidth?: number;
	/** Padding on each side of the screen (defaults to 200px) */
	sidePadding?: number;
	/** Maximum rotation angle in degrees (defaults to 5) */
	maxRotation?: number;
}

/**
 * Calculate the position and rotation for a card in a hand layout
 * 
 * Features:
 * - Cards start with 20% overlap (80px visible per card)
 * - Dynamically increases overlap if hand would exceed viewport width
 * - Minimum 10% visible per card (90% max overlap)
 * - Fan rotation based on distance from center
 * 
 * @param options - Card positioning options
 * @returns Position object with xOffset and rotation
 */
export function getCardPosition(options: CardPositionOptions): CardPosition {
	const {
		index,
		totalCards,
		invertRotation = false,
		viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200,
		sidePadding = 200,
		maxRotation = 5
	} = options;

	const cardWidth = 100;
	const maxHandWidth = viewportWidth - (sidePadding * 2);
	
	// Start with 20% overlap (80px visible per card)
	let visibleWidth = cardWidth * 0.8;
	let totalWidth = (totalCards - 1) * visibleWidth + cardWidth;
	
	// If too wide, increase overlap to fit
	if (totalWidth > maxHandWidth && totalCards > 1) {
		visibleWidth = (maxHandWidth - cardWidth) / (totalCards - 1);
		visibleWidth = Math.max(visibleWidth, cardWidth * 0.1); // Min 10px visible
		totalWidth = (totalCards - 1) * visibleWidth + cardWidth;
	}

	// Calculate horizontal offset from center
	const xOffset = index * visibleWidth - totalWidth / 2;

	// Calculate rotation based on distance from center
	const centerIndex = (totalCards - 1) / 2;
	const offsetFromCenter = index - centerIndex;
	const rotationMultiplier = invertRotation ? -1 : 1;
	const rotation = totalCards > 1 
		? rotationMultiplier * (offsetFromCenter / centerIndex) * maxRotation 
		: 0;

	return { xOffset, rotation };
}

