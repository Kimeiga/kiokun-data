<script lang="ts">
	import { goto } from "$app/navigation";
	import { fade } from "svelte/transition";

	let visible = $state(false);
	let canvasEl: HTMLCanvasElement | undefined = $state();
	let ctx: CanvasRenderingContext2D | null = $state(null);
	let isDrawing = $state(false);
	let candidates = $state<string[]>([]);
	let isRecognizing = $state(false);

	// Each stroke stores arrays of x, y, t values
	let strokes = $state<{ x: number[]; y: number[]; t: number[] }[]>([]);
	let currentStroke: { x: number[]; y: number[]; t: number[] } | null = $state(null);

	const CANVAS_SIZE = 250;

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

		// Draw light grid
		const gridColor =
			typeof document !== "undefined"
				? getComputedStyle(document.documentElement).getPropertyValue("--border-color").trim() ||
					"#e0e0e0"
				: "#e0e0e0";

		ctx.strokeStyle = gridColor;
		ctx.lineWidth = 0.5;
		ctx.setLineDash([4, 4]);

		// Center cross
		ctx.beginPath();
		ctx.moveTo(CANVAS_SIZE / 2, 0);
		ctx.lineTo(CANVAS_SIZE / 2, CANVAS_SIZE);
		ctx.stroke();

		ctx.beginPath();
		ctx.moveTo(0, CANVAS_SIZE / 2);
		ctx.lineTo(CANVAS_SIZE, CANVAS_SIZE / 2);
		ctx.stroke();

		// Diagonal guides
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(CANVAS_SIZE, CANVAS_SIZE);
		ctx.stroke();

		ctx.beginPath();
		ctx.moveTo(CANVAS_SIZE, 0);
		ctx.lineTo(0, CANVAS_SIZE);
		ctx.stroke();

		ctx.setLineDash([]);

		// Redraw all existing strokes
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

	function getPos(
		e: MouseEvent | TouchEvent
	): { x: number; y: number } | null {
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
		const startTime = Date.now();
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
		currentStroke.t.push(currentStroke.t.length > 0 ? Date.now() - (Date.now() - currentStroke.t[currentStroke.t.length - 1]) : 0);

		// Recalculate time relative to stroke start
		const elapsed = currentStroke.x.length * 10; // approximate timing
		currentStroke.t[currentStroke.t.length - 1] = elapsed;

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
		// Trigger reactivity by reassigning
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
		close();
		goto(`/${encodeURIComponent(char)}`);
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

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			close();
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
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
		transition:fade={{ duration: 150 }}
		onclick={handleBackdropClick}
	>
		<!-- Modal -->
		<div
			class="w-full max-w-[320px] rounded-2xl border border-border shadow-2xl overflow-hidden"
			style="background: var(--bg-secondary);"
		>
			<!-- Header -->
			<div
				class="flex items-center justify-between px-4 py-3 border-b border-border"
			>
				<h3
					class="text-base font-semibold m-0"
					style="color: var(--text-primary);"
				>
					Draw Character
				</h3>
				<button
					class="w-8 h-8 flex items-center justify-center rounded-full border-none cursor-pointer text-lg transition-colors duration-150"
					style="background: var(--bg-tertiary); color: var(--text-secondary);"
					onclick={close}
					aria-label="Close"
				>
					&times;
				</button>
			</div>

			<!-- Canvas area -->
			<div class="flex flex-col items-center px-4 pt-3 pb-2">
				<div
					class="rounded-xl border-2 border-border overflow-hidden touch-none"
					style="width: {CANVAS_SIZE}px; height: {CANVAS_SIZE}px; background: var(--bg-primary);"
				>
					<canvas
						bind:this={canvasEl}
						width={CANVAS_SIZE}
						height={CANVAS_SIZE}
						class="block cursor-crosshair"
						style="width: {CANVAS_SIZE}px; height: {CANVAS_SIZE}px;"
						onmousedown={startStroke}
						onmousemove={moveStroke}
						onmouseup={endStroke}
						onmouseleave={(e) => { if (isDrawing) endStroke(e); }}
						ontouchstart={startStroke}
						ontouchmove={moveStroke}
						ontouchend={endStroke}
					></canvas>
				</div>

				<!-- Action buttons -->
				<div class="flex gap-2 mt-3 w-full">
					<button
						class="flex-1 px-3 py-2 rounded-lg border border-border text-sm font-medium cursor-pointer transition-colors duration-150"
						style="background: var(--bg-tertiary); color: var(--text-primary);"
						onclick={undoStroke}
						disabled={strokes.length === 0}
						class:opacity-40={strokes.length === 0}
					>
						Undo
					</button>
					<button
						class="flex-1 px-3 py-2 rounded-lg border border-border text-sm font-medium cursor-pointer transition-colors duration-150"
						style="background: var(--bg-tertiary); color: var(--text-primary);"
						onclick={clearCanvas}
						disabled={strokes.length === 0}
						class:opacity-40={strokes.length === 0}
					>
						Clear
					</button>
				</div>
			</div>

			<!-- Candidates -->
			<div
				class="px-4 pb-4 pt-1"
			>
				<div
					class="flex gap-2 justify-center min-h-[48px] items-center"
				>
					{#if isRecognizing && candidates.length === 0}
						<span
							class="text-sm"
							style="color: var(--text-muted);"
						>
							Recognizing...
						</span>
					{:else if candidates.length > 0}
						{#each candidates as char}
							<button
								class="w-11 h-11 rounded-lg border-2 border-border text-xl font-bold cursor-pointer transition-colors duration-150"
								style="background: var(--bg-tertiary); color: var(--text-primary); border-color: var(--border-color);"
								onmouseenter={(e) => {
									e.currentTarget.style.borderColor = 'var(--accent)';
									e.currentTarget.style.color = 'var(--accent)';
								}}
								onmouseleave={(e) => {
									e.currentTarget.style.borderColor = 'var(--border-color)';
									e.currentTarget.style.color = 'var(--text-primary)';
								}}
								onclick={() => selectCandidate(char)}
							>
								{char}
							</button>
						{/each}
					{:else}
						<span
							class="text-sm"
							style="color: var(--text-muted);"
						>
							Draw a character above
						</span>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
