<script lang="ts">
	import { fade } from "svelte/transition";

	let {
		visible = $bindable(false),
		onSelect,
	}: {
		visible?: boolean;
		onSelect?: (char: string) => void;
	} = $props();

	let canvasEl: HTMLCanvasElement | undefined = $state();
	let ctx: CanvasRenderingContext2D | null = $state(null);
	let isDrawing = $state(false);
	let candidates = $state<string[]>([]);
	let isRecognizing = $state(false);

	let strokes = $state<{ x: number[]; y: number[]; t: number[] }[]>([]);
	let currentStroke: { x: number[]; y: number[]; t: number[] } | null = $state(null);

	const CANVAS_SIZE = 200;

	export function open() {
		visible = true;
	}

	export function close() {
		visible = false;
		clearCanvas();
	}

	function getStrokeColor(): string {
		if (typeof document === "undefined") return "#3498db";
		const style = getComputedStyle(document.documentElement);
		return style.getPropertyValue("--accent").trim() || "#3498db";
	}

	$effect(() => {
		if (visible && canvasEl) {
			ctx = canvasEl.getContext("2d");
			drawGrid();
		}
	});

	function drawGrid() {
		if (!ctx) return;
		ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

		const gridColor =
			typeof document !== "undefined"
				? getComputedStyle(document.documentElement).getPropertyValue("--border-color").trim() ||
					"#e0e0e0"
				: "#e0e0e0";

		ctx.strokeStyle = gridColor;
		ctx.lineWidth = 0.5;
		ctx.setLineDash([4, 4]);

		ctx.beginPath();
		ctx.moveTo(CANVAS_SIZE / 2, 0);
		ctx.lineTo(CANVAS_SIZE / 2, CANVAS_SIZE);
		ctx.stroke();

		ctx.beginPath();
		ctx.moveTo(0, CANVAS_SIZE / 2);
		ctx.lineTo(CANVAS_SIZE, CANVAS_SIZE / 2);
		ctx.stroke();

		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(CANVAS_SIZE, CANVAS_SIZE);
		ctx.stroke();

		ctx.beginPath();
		ctx.moveTo(CANVAS_SIZE, 0);
		ctx.lineTo(0, CANVAS_SIZE);
		ctx.stroke();

		ctx.setLineDash([]);
		redrawStrokes();
	}

	function redrawStrokes() {
		if (!ctx) return;
		const color = getStrokeColor();
		ctx.strokeStyle = color;
		ctx.lineWidth = 4;
		ctx.lineCap = "round";
		ctx.lineJoin = "round";

		for (const stroke of strokes) {
			if (stroke.x.length < 2) continue;
			ctx.beginPath();
			ctx.moveTo(stroke.x[0], stroke.y[0]);
			for (let i = 1; i < stroke.x.length; i++) {
				ctx.lineTo(stroke.x[i], stroke.y[i]);
			}
			ctx.stroke();
		}
	}

	function getPos(e: MouseEvent | TouchEvent): { x: number; y: number } | null {
		if (!canvasEl) return null;
		const rect = canvasEl.getBoundingClientRect();
		const scaleX = CANVAS_SIZE / rect.width;
		const scaleY = CANVAS_SIZE / rect.height;

		if ("touches" in e) {
			if (e.touches.length === 0) return null;
			const touch = e.touches[0];
			return {
				x: (touch.clientX - rect.left) * scaleX,
				y: (touch.clientY - rect.top) * scaleY,
			};
		}
		return {
			x: (e.clientX - rect.left) * scaleX,
			y: (e.clientY - rect.top) * scaleY,
		};
	}

	function startStroke(e: MouseEvent | TouchEvent) {
		e.preventDefault();
		const pos = getPos(e);
		if (!pos || !ctx) return;

		isDrawing = true;
		currentStroke = { x: [pos.x], y: [pos.y], t: [0] };

		ctx.strokeStyle = getStrokeColor();
		ctx.lineWidth = 4;
		ctx.lineCap = "round";
		ctx.lineJoin = "round";
		ctx.beginPath();
		ctx.moveTo(pos.x, pos.y);
	}

	function moveStroke(e: MouseEvent | TouchEvent) {
		if (!isDrawing || !currentStroke || !ctx) return;
		e.preventDefault();
		const pos = getPos(e);
		if (!pos) return;

		currentStroke.x.push(pos.x);
		currentStroke.y.push(pos.y);
		const elapsed = currentStroke.x.length * 10;
		currentStroke.t.push(elapsed);

		ctx.lineTo(pos.x, pos.y);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(pos.x, pos.y);
	}

	function endStroke(e: MouseEvent | TouchEvent) {
		if (!isDrawing || !currentStroke) return;
		e.preventDefault();
		isDrawing = false;

		strokes.push({ ...currentStroke });
		strokes = [...strokes];
		currentStroke = null;

		recognize();
	}

	async function recognize() {
		if (strokes.length === 0) return;
		isRecognizing = true;

		try {
			const response = await fetch("/api/handwriting", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ strokes }),
			});

			if (response.ok) {
				const data = await response.json();
				candidates = data.candidates || [];
			}
		} catch (err) {
			console.error("Recognition failed:", err);
		} finally {
			isRecognizing = false;
		}
	}

	function selectCandidate(char: string) {
		onSelect?.(char);
		clearCanvas();
	}

	function clearCanvas() {
		strokes = [];
		currentStroke = null;
		candidates = [];
		isDrawing = false;
		if (ctx) {
			drawGrid();
		}
	}

	function undoStroke() {
		if (strokes.length === 0) return;
		strokes = strokes.slice(0, -1);
		if (ctx) {
			drawGrid();
		}
		if (strokes.length > 0) {
			recognize();
		} else {
			candidates = [];
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === "Escape") {
			close();
		}
	}
</script>

<svelte:window onkeydown={visible ? handleKeydown : undefined} />

{#if visible}
	<div class="hw-panel" transition:fade={{ duration: 100 }}>
		<div class="hw-layout">
			<!-- Canvas -->
			<div class="hw-canvas-area">
				<div class="hw-canvas-wrap">
					<canvas
						bind:this={canvasEl}
						width={CANVAS_SIZE}
						height={CANVAS_SIZE}
						class="hw-canvas"
						onmousedown={startStroke}
						onmousemove={moveStroke}
						onmouseup={endStroke}
						onmouseleave={(e) => { if (isDrawing) endStroke(e); }}
						ontouchstart={startStroke}
						ontouchmove={moveStroke}
						ontouchend={endStroke}
					></canvas>
				</div>
				<div class="hw-actions">
					<button class="hw-btn" onclick={undoStroke} disabled={strokes.length === 0}>Undo</button>
					<button class="hw-btn" onclick={clearCanvas} disabled={strokes.length === 0}>Clear</button>
					<button class="hw-btn hw-btn-close" onclick={close}>Done</button>
				</div>
			</div>

			<!-- Candidates -->
			<div class="hw-candidates">
				{#if isRecognizing && candidates.length === 0}
					<span class="hw-hint">Recognizing...</span>
				{:else if candidates.length > 0}
					{#each candidates as char}
						<button class="hw-char" onclick={() => selectCandidate(char)}>{char}</button>
					{/each}
				{:else}
					<span class="hw-hint">Draw a character</span>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.hw-panel {
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg, 12px);
		background: var(--bg-secondary);
		padding: 12px;
		margin-top: 8px;
		box-shadow: 0 4px 12px rgba(0,0,0,0.1);
	}

	.hw-layout {
		display: flex;
		gap: 12px;
		align-items: flex-start;
	}

	.hw-canvas-area {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.hw-canvas-wrap {
		border: 2px solid var(--border-color);
		border-radius: 8px;
		overflow: hidden;
		touch-action: none;
		width: 200px;
		height: 200px;
		background: var(--bg-primary);
	}

	.hw-canvas {
		display: block;
		cursor: crosshair;
		width: 200px;
		height: 200px;
	}

	.hw-actions {
		display: flex;
		gap: 4px;
	}

	.hw-btn {
		flex: 1;
		padding: 4px 8px;
		border-radius: 6px;
		border: 1px solid var(--border-color);
		background: var(--bg-tertiary);
		color: var(--text-primary);
		font-size: 12px;
		cursor: pointer;
		transition: opacity 0.15s;
	}
	.hw-btn:disabled { opacity: 0.35; cursor: default; }
	.hw-btn-close { border-color: var(--accent); color: var(--accent); }

	.hw-candidates {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-content: flex-start;
		min-width: 0;
		flex: 1;
	}

	.hw-char {
		width: 44px;
		height: 44px;
		border-radius: 8px;
		border: 2px solid var(--border-color);
		background: var(--bg-tertiary);
		color: var(--text-primary);
		font-size: 22px;
		font-weight: 600;
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.hw-char:hover { border-color: var(--accent); color: var(--accent); }

	.hw-hint {
		color: var(--text-muted);
		font-size: 13px;
		padding: 8px;
	}

	/* Mobile: stack vertically */
	@media (max-width: 480px) {
		.hw-layout { flex-direction: column; }
		.hw-canvas-wrap { width: 100%; height: auto; aspect-ratio: 1; }
		.hw-canvas { width: 100%; height: 100%; }
		.hw-candidates { justify-content: center; }
	}
</style>
