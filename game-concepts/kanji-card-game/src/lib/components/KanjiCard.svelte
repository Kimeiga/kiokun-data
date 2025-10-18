<script lang="ts">
	import type { Card } from '$lib/types';

	interface Props {
		card: Card;
		isDragging?: boolean;
		isGold?: boolean;
		onClick?: () => void;
		onPointerDown?: (event: PointerEvent) => void;
		onPointerMove?: (event: PointerEvent) => void;
		onPointerUp?: (event: PointerEvent) => void;
		style?: string;
	}

	let {
		card,
		isDragging = false,
		isGold = false,
		onClick,
		onPointerDown,
		onPointerMove,
		onPointerUp,
		style = ''
	}: Props = $props();
</script>

<div
	class="kanji-card"
	class:dragging={isDragging}
	class:gold={isGold}
	{style}
	role="button"
	tabindex="0"
	onclick={onClick}
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			onClick?.();
		}
	}}
>
	<div class="stroke-count">{card.strokeCount}</div>
	<div class="card-content">
		<div class="character">{card.character}</div>
		{#if card.gloss}
			<div class="gloss">{card.gloss}</div>
		{/if}
	</div>
</div>

<style>
	.kanji-card {
		width: var(--card-width);
		height: var(--card-height);
		background: white;
		border-radius: var(--card-radius);
		box-shadow: var(--card-shadow);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		cursor: grab;
		transition: all var(--transition-speed) ease;
		user-select: none;
		position: relative;
	}

	.kanji-card:hover {
		box-shadow: var(--card-shadow-hover);
		transform: translateY(-4px);
	}

	.kanji-card.dragging {
		cursor: grabbing;
		box-shadow: 0 12px 24px rgba(0, 0, 0, 0.4);
		transform: scale(1.05);
		z-index: 1000;
	}

	.kanji-card.gold {
		background: linear-gradient(135deg, var(--gold) 0%, #ffed4e 100%);
		box-shadow: 0 0 20px var(--gold-glow);
		animation: goldShine 0.6s ease-in-out;
	}

	@keyframes goldShine {
		0% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.1);
		}
		100% {
			transform: scale(1);
		}
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

