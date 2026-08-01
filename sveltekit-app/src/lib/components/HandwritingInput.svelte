<script lang="ts">
	import { tick } from "svelte";
	import { fade, fly } from "svelte/transition";

	let {
		visible = $bindable(false),
		onSelect,
	}: {
		visible?: boolean;
		onSelect?: (char: string) => void;
	} = $props();

	let canvasEl: HTMLCanvasElement | undefined = $state();
	let closeButton: HTMLButtonElement | undefined = $state();
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

	$effect(() => {
		if (!visible || typeof document === "undefined") return;

		const previousFocus = document.activeElement as HTMLElement | null;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		void tick().then(() => closeButton?.focus());

		return () => {
			document.body.style.overflow = previousOverflow;
			previousFocus?.focus();
		};
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
		close();
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
	<div class="hw-layer" transition:fade={{ duration: 120 }}>
		<button class="hw-backdrop" type="button" aria-label="Close handwriting input" onclick={close}></button>
		<div
			class="hw-panel"
			role="dialog"
			aria-modal="true"
			aria-labelledby="handwriting-title"
			aria-describedby="handwriting-help"
			transition:fly={{ y: 18, duration: 180 }}
		>
			<div class="hw-header">
				<div>
					<h2 id="handwriting-title">Draw a character</h2>
					<p id="handwriting-help">Chinese or Japanese · select the closest match</p>
				</div>
				<button bind:this={closeButton} class="hw-close" type="button" onclick={close} aria-label="Close">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
						<path d="m6 6 12 12M18 6 6 18"/>
					</svg>
				</button>
			</div>

			<div class="hw-layout">
				<div class="hw-canvas-area">
					<div class="hw-canvas-wrap">
						<canvas
							bind:this={canvasEl}
							width={CANVAS_SIZE}
							height={CANVAS_SIZE}
							class="hw-canvas"
							aria-label="Character drawing area"
							onmousedown={startStroke}
							onmousemove={moveStroke}
							onmouseup={endStroke}
							onmouseleave={(event) => { if (isDrawing) endStroke(event); }}
							ontouchstart={startStroke}
							ontouchmove={moveStroke}
							ontouchend={endStroke}
						></canvas>
					</div>
					<div class="hw-actions segmented-grid">
						<button class="hw-btn segmented-cell" type="button" onclick={undoStroke} disabled={strokes.length === 0}>Undo</button>
						<button class="hw-btn segmented-cell" type="button" onclick={clearCanvas} disabled={strokes.length === 0}>Clear</button>
					</div>
				</div>

				<div class="hw-results" aria-live="polite" aria-busy={isRecognizing}>
					<div class="hw-result-label">Matches</div>
					<div class="hw-candidates divider-grid">
						{#if isRecognizing && candidates.length === 0}
							<span class="hw-hint">Recognizing…</span>
						{:else if candidates.length > 0}
							{#each candidates as char}
								<button class="hw-char divider-cell" type="button" onclick={() => selectCandidate(char)} aria-label={`Use ${char}`}>
									{char}
								</button>
							{/each}
						{:else}
							<span class="hw-hint">Your matches will appear here.</span>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.hw-layer {
		position: fixed;
		z-index: 180;
		inset: 0;
		display: grid;
		place-items: end center;
		padding: 0.75rem;
		padding-bottom: max(0.75rem, env(safe-area-inset-bottom, 0px));
	}

	.hw-backdrop {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: 0;
		background: rgba(0, 0, 0, 0.6);
		cursor: default;
	}

	.hw-panel {
		position: relative;
		width: min(100%, 36rem);
		max-height: calc(100dvh - 1.5rem);
		overflow-y: auto;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		background: var(--bg-secondary);
		padding: 1rem;
		box-shadow: 0 22px 60px rgba(0, 0, 0, 0.35);
		overscroll-behavior: contain;
	}

	.hw-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.9rem;
	}

	.hw-header h2 {
		margin: 0;
		color: var(--text-primary);
		font-size: 1.05rem;
		font-weight: 750;
		line-height: 1.25;
	}

	.hw-header p {
		margin: 0.15rem 0 0;
		color: var(--text-secondary);
		font-size: var(--font-size-caption1);
		line-height: 1.4;
	}

	.hw-close {
		display: grid;
		width: 2.75rem;
		height: 2.75rem;
		flex: 0 0 auto;
		place-items: center;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-full);
		background: var(--bg-tertiary);
		color: var(--text-primary);
		cursor: pointer;
	}

	.hw-layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1rem;
		align-items: flex-start;
	}

	.hw-canvas-area {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.hw-canvas-wrap {
		width: min(100%, 18rem);
		aspect-ratio: 1;
		margin: 0 auto;
		overflow: hidden;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		touch-action: none;
		background: var(--bg-primary);
	}

	.hw-canvas {
		display: block;
		width: 100%;
		height: 100%;
		cursor: crosshair;
	}

	.hw-actions {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.hw-btn {
		flex: 1;
		min-height: 2.75rem;
		padding: 0.55rem 0.8rem;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-tertiary);
		color: var(--text-primary);
		font: inherit;
		font-size: var(--font-size-callout);
		cursor: pointer;
		transition: border-color 140ms ease, opacity 140ms ease;
	}

	.hw-btn:hover:not(:disabled) {
		border-color: var(--accent);
	}

	.hw-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.hw-results {
		min-width: 0;
	}

	.hw-result-label {
		margin-bottom: 0.45rem;
		color: var(--text-secondary);
		font-size: var(--font-size-caption1);
		font-weight: 700;
	}

	.hw-candidates {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(3.25rem, 1fr));
		align-content: flex-start;
		min-width: 0;
	}

	.hw-char {
		display: grid;
		width: 3.25rem;
		height: 3.25rem;
		place-items: center;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-tertiary);
		color: var(--text-primary);
		font-family: var(--font-cjk);
		font-size: 1.55rem;
		font-weight: 650;
		cursor: pointer;
		transition: border-color 140ms ease, color 140ms ease, background-color 140ms ease;
	}

	.hw-char:hover {
		border-color: var(--accent);
		background: var(--accent-light);
		color: var(--accent);
	}

	.hw-hint {
		color: var(--text-muted);
		font-size: var(--font-size-caption1);
		line-height: 1.45;
	}

	@media (min-width: 640px) {
		.hw-layer {
			place-items: center;
		}

		.hw-layout {
			grid-template-columns: 18rem minmax(0, 1fr);
		}

		.hw-panel {
			padding: 1.15rem;
		}
	}
</style>
