<script lang="ts">
	interface Props {
		cardCount: number;
		onClick?: () => void;
	}

	let { cardCount, onClick }: Props = $props();

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onClick?.();
		}
	}
</script>

<div
	class="deck-container"
	role="button"
	tabindex="0"
	onclick={onClick}
	onkeydown={handleKeyDown}
>
	{#if cardCount > 0}
		<!-- Show multiple card backs stacked to give depth -->
		{#each Array(Math.min(cardCount, 3)) as _, i}
			<div
				class="deck-card"
				style:transform="translateY({-i * 2}px) translateX({-i * 1}px)"
				style:z-index={i}
			>
				<div class="card-back">
					<div class="card-pattern"></div>
				</div>
			</div>
		{/each}
		<div class="card-count">{cardCount}</div>
	{:else}
		<div class="empty-deck">
			<div class="empty-text">Empty</div>
		</div>
	{/if}
</div>

<style>
	.deck-container {
		position: relative;
		width: 100px;
		height: 140px;
		cursor: pointer;
		user-select: none;
		transition: transform 0.2s;
	}

	.deck-container:hover {
		transform: translateY(-4px);
	}

	.deck-container:active {
		transform: translateY(-2px);
	}

	.deck-card {
		position: absolute;
		width: 100px;
		height: 140px;
		top: 0;
		left: 0;
	}

	.card-back {
		width: 100%;
		height: 100%;
		border-radius: 8px;
		border: 2px solid #333;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
		transition: box-shadow 0.2s;
	}

	.deck-container:hover .card-back {
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
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

	.card-count {
		position: absolute;
		bottom: -24px;
		left: 50%;
		transform: translateX(-50%);
		background: rgba(255, 255, 255, 0.9);
		color: #1e3c72;
		padding: 4px 12px;
		border-radius: 12px;
		font-size: 14px;
		font-weight: 600;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	.empty-deck {
		width: 100%;
		height: 100%;
		border: 2px dashed rgba(255, 255, 255, 0.3);
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.05);
	}

	.empty-text {
		color: rgba(255, 255, 255, 0.5);
		font-size: 14px;
		font-weight: 600;
	}
</style>

