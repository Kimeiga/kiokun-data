<script lang="ts">
	import type { GameState } from '$lib/types';

	interface Props {
		gameState: GameState;
	}

	let { gameState }: Props = $props();

	const anteNames = ['Small Blind', 'Big Blind', 'The Ante', 'The Showdown'];
</script>

<div class="game-info">
	<div class="info-section">
		<span class="label">💴 Currency:</span>
		<span class="value">¥{gameState.currency}</span>
	</div>

	<div class="info-section">
		<span class="label">🎯 Ante {gameState.ante}:</span>
		<span class="value">{anteNames[gameState.ante - 1] || 'Unknown'}</span>
	</div>

	<div class="info-section">
		<span class="label">📊 Score:</span>
		<span class="value">{gameState.score} / {gameState.targetScore}</span>
	</div>

	<div class="info-section">
		<span class="label">🎴 Hands:</span>
		<span class="value">{gameState.handsRemaining}</span>
	</div>

	<div class="info-section">
		<span class="label">🗑️ Discards:</span>
		<span class="value">{gameState.discardsRemaining}</span>
	</div>
</div>

<style>
	.game-info {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 32px;
		padding: 16px 24px;
		background: rgba(0, 0, 0, 0.3);
		border-bottom: 2px solid rgba(255, 255, 255, 0.1);
		color: white;
		font-family: monospace;
		font-size: 14px;
	}

	.info-section {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.label {
		opacity: 0.8;
	}

	.value {
		font-weight: bold;
	}
</style>

