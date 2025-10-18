<script lang="ts">
	import { Motion } from 'svelte-motion';
	import Card from './Card.svelte';
	import type { Card as CardType } from '$lib/types';

	interface Props {
		cards: CardType[];
		onCardPlayed?: (card: CardType) => void;
	}

	let { cards = [], onCardPlayed }: Props = $props();

	const topCard = $derived(cards.length > 0 ? cards[cards.length - 1] : null);
	let isHovered = $state(false);

	function handlePointerEnter() {
		isHovered = true;
	}

	function handlePointerLeave() {
		isHovered = false;
	}
</script>

<div class="discard-pile-container">
	<Motion
		let:motion
		animate={{
			scale: isHovered ? 1.05 : 1
		}}
		transition={{ type: 'spring', stiffness: 300, damping: 20 }}
	>
		<div
			use:motion
			class="discard-pile"
			class:empty={!topCard}
			class:hovered={isHovered}
			onpointerenter={handlePointerEnter}
			onpointerleave={handlePointerLeave}
		>
			{#if topCard}
				<div class="card-stack">
					<!-- Show a slight shadow of previous cards -->
					{#if cards.length > 1}
						<div class="shadow-card" style="transform: translate(-2px, -2px);"></div>
					{/if}
					{#if cards.length > 2}
						<div class="shadow-card" style="transform: translate(-4px, -4px);"></div>
					{/if}
					<Card card={topCard} />
				</div>
			{:else}
				<div class="empty-pile">
					<div class="empty-text">Discard Pile</div>
				</div>
			{/if}
		</div>
	</Motion>
	<div class="pile-info">
		{cards.length} card{cards.length !== 1 ? 's' : ''}
	</div>
</div>

<style>
	.discard-pile-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}

	.discard-pile {
		/* Match card size exactly - no extra space */
		width: 100px;
		height: 140px;
		position: relative;
		cursor: pointer;
	}

	.discard-pile.hovered {
		filter: brightness(1.1);
	}

	.card-stack {
		position: relative;
		width: 100%;
		height: 100%;
	}

	.shadow-card {
		position: absolute;
		width: 100px;
		height: 140px;
		background: rgba(0, 0, 0, 0.2);
		border-radius: 8px;
		/* Offset shadows behind the main card */
		top: -2px;
		left: -2px;
	}

	.empty-pile {
		width: 100px;
		height: 140px;
		border: 3px dashed #666;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.05);
	}

	.empty-text {
		color: #666;
		font-size: 14px;
		text-align: center;
		font-weight: 500;
	}

	.pile-info {
		color: #888;
		font-size: 14px;
		font-weight: 500;
	}
</style>

