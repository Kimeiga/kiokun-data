<script lang="ts">
	import { onMount } from "svelte";
	import { goto } from "$app/navigation";
	import SectionHeading from "./shared/SectionHeading.svelte";

	interface Props {
		targetChar: string;
		components?: string[];
		componentUses: Record<
			string,
			Record<string, { chars: string[]; count: number }>
		>;
		charGlosses?: Record<string, string>;
	}

	let { targetChar, components, componentUses, charGlosses }: Props = $props();

	let canvasEl: HTMLCanvasElement | null = $state(null);
	let expanded = $state(false);
	let hoveredNode: string | null = $state(null);

	interface GraphNode {
		id: string;
		label: string;
		x: number;
		y: number;
		vx: number;
		vy: number;
		level: number; // 0=center, 1=components, 2=related
		type: string; // 'center', 'component', 'related'
	}

	interface GraphEdge {
		source: string;
		target: string;
	}

	let nodes: GraphNode[] = [];
	let edges: GraphEdge[] = [];

	function buildGraph() {
		if (!components || components.length === 0) return;

		const nodeMap = new Map<string, GraphNode>();
		const edgeList: GraphEdge[] = [];

		// Center node
		const cx = 200,
			cy = 150;
		nodeMap.set(targetChar, {
			id: targetChar,
			label: charGlosses?.[targetChar] || "",
			x: cx,
			y: cy,
			vx: 0,
			vy: 0,
			level: 0,
			type: "center",
		});

		// Component nodes (level 1)
		const validComponents = components.filter((c) => {
			const cp = c.codePointAt(0) || 0;
			return cp >= 0x4e00 && cp <= 0x9fff;
		});

		const angleStep = (2 * Math.PI) / Math.max(validComponents.length, 1);
		validComponents.forEach((comp, i) => {
			const angle = angleStep * i - Math.PI / 2;
			nodeMap.set(comp, {
				id: comp,
				label: charGlosses?.[comp] || "",
				x: cx + Math.cos(angle) * 80,
				y: cy + Math.sin(angle) * 80,
				vx: 0,
				vy: 0,
				level: 1,
				type: "component",
			});
			edgeList.push({ source: comp, target: targetChar });
		});

		// Related nodes (level 2): other chars sharing components
		validComponents.forEach((comp, compIdx) => {
			const uses = componentUses[comp];
			if (!uses) return;
			let relatedChars: string[] = [];
			for (const typeData of Object.values(uses)) {
				relatedChars = relatedChars.concat(typeData.chars);
			}
			// Deduplicate and filter
			const seen = new Set<string>();
			let count = 0;
			for (const ch of relatedChars) {
				if (seen.has(ch) || ch === targetChar || nodeMap.has(ch))
					continue;
				const cp = ch.codePointAt(0) || 0;
				if (cp < 0x4e00 || cp > 0x9fff) continue;
				seen.add(ch);
				count++;
				if (count > 4) break; // Limit per component

				const baseAngle = angleStep * compIdx - Math.PI / 2;
				const spread = ((count - 1) * 0.4 - 0.8) + Math.random() * 0.2;
				nodeMap.set(ch, {
					id: ch,
					label: charGlosses?.[ch] || "",
					x: cx + Math.cos(baseAngle + spread) * 140,
					y: cy + Math.sin(baseAngle + spread) * 140,
					vx: 0,
					vy: 0,
					level: 2,
					type: "related",
				});
				edgeList.push({ source: comp, target: ch });
			}
		});

		nodes = Array.from(nodeMap.values());
		edges = edgeList;
	}

	function simulate() {
		// Simple force simulation (no d3 dependency for lighter build)
		const iterations = 50;
		const cx = 200,
			cy = 150;

		for (let iter = 0; iter < iterations; iter++) {
			const alpha = 1 - iter / iterations;

			// Repulsion between all nodes
			for (let i = 0; i < nodes.length; i++) {
				for (let j = i + 1; j < nodes.length; j++) {
					const dx = nodes[j].x - nodes[i].x;
					const dy = nodes[j].y - nodes[i].y;
					const dist = Math.sqrt(dx * dx + dy * dy) || 1;
					const force = (300 * alpha) / (dist * dist);
					const fx = (dx / dist) * force;
					const fy = (dy / dist) * force;
					nodes[j].x += fx;
					nodes[j].y += fy;
					nodes[i].x -= fx;
					nodes[i].y -= fy;
				}
			}

			// Attraction along edges
			for (const edge of edges) {
				const src = nodes.find((n) => n.id === edge.source);
				const tgt = nodes.find((n) => n.id === edge.target);
				if (!src || !tgt) continue;
				const dx = tgt.x - src.x;
				const dy = tgt.y - src.y;
				const dist = Math.sqrt(dx * dx + dy * dy) || 1;
				const targetDist = src.level === 0 || tgt.level === 0 ? 80 : 60;
				const force = (dist - targetDist) * 0.05 * alpha;
				const fx = (dx / dist) * force;
				const fy = (dy / dist) * force;
				src.x += fx;
				src.y += fy;
				tgt.x -= fx;
				tgt.y -= fy;
			}

			// Center gravity
			for (const node of nodes) {
				if (node.level === 0) {
					node.x = cx;
					node.y = cy;
				} else {
					node.x += (cx - node.x) * 0.01 * alpha;
					node.y += (cy - node.y) * 0.01 * alpha;
				}
			}
		}

		// Clamp to canvas bounds
		for (const node of nodes) {
			node.x = Math.max(25, Math.min(375, node.x));
			node.y = Math.max(25, Math.min(275, node.y));
		}
	}

	function draw() {
		if (!canvasEl) return;
		const ctx = canvasEl.getContext("2d");
		if (!ctx) return;

		const dpr = window.devicePixelRatio || 1;
		canvasEl.width = 400 * dpr;
		canvasEl.height = 300 * dpr;
		ctx.scale(dpr, dpr);

		// Get theme colors
		const style = getComputedStyle(canvasEl);
		const bgColor = style.getPropertyValue("--bg-secondary").trim() || "#121212";
		const borderColor = style.getPropertyValue("--border-light").trim() || "#3a3a3c";
		const textPrimary = style.getPropertyValue("--text-primary").trim() || "#ffffff";
		const textSecondary = style.getPropertyValue("--text-secondary").trim() || "#b0b0b0";
		const accentColor = style.getPropertyValue("--accent").trim() || "#2ecc71";

		// Clear
		ctx.fillStyle = bgColor;
		ctx.fillRect(0, 0, 400, 300);

		// Draw edges
		ctx.strokeStyle = borderColor;
		ctx.lineWidth = 1;
		for (const edge of edges) {
			const src = nodes.find((n) => n.id === edge.source);
			const tgt = nodes.find((n) => n.id === edge.target);
			if (!src || !tgt) continue;
			ctx.beginPath();
			ctx.moveTo(src.x, src.y);
			ctx.lineTo(tgt.x, tgt.y);
			ctx.stroke();
		}

		// Draw nodes
		for (const node of nodes) {
			const isHovered = hoveredNode === node.id;
			const radius = node.level === 0 ? 22 : node.level === 1 ? 18 : 14;

			// Node circle
			ctx.beginPath();
			ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
			if (node.level === 0) {
				ctx.fillStyle = accentColor + "30";
				ctx.strokeStyle = accentColor;
				ctx.lineWidth = 2;
			} else if (node.level === 1) {
				ctx.fillStyle = isHovered ? accentColor + "20" : bgColor;
				ctx.strokeStyle = isHovered ? accentColor : borderColor;
				ctx.lineWidth = 1.5;
			} else {
				ctx.fillStyle = isHovered ? accentColor + "10" : bgColor;
				ctx.strokeStyle = isHovered ? accentColor : borderColor;
				ctx.lineWidth = 1;
			}
			ctx.fill();
			ctx.stroke();

			// Character text
			const fontSize = node.level === 0 ? 18 : node.level === 1 ? 15 : 12;
			ctx.font = `${fontSize}px "Noto Serif TC", "Noto Serif SC", serif`;
			ctx.fillStyle =
				node.level === 0 ? accentColor : isHovered ? accentColor : textPrimary;
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText(node.id, node.x, node.y);

			// Label below
			if (node.label && (node.level <= 1 || isHovered)) {
				ctx.font = `9px -apple-system, sans-serif`;
				ctx.fillStyle = textSecondary;
				ctx.fillText(
					node.label.length > 10
						? node.label.slice(0, 9) + "…"
						: node.label,
					node.x,
					node.y + radius + 10,
				);
			}
		}
	}

	function handleCanvasClick(e: MouseEvent) {
		if (!canvasEl) return;
		const rect = canvasEl.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		for (const node of nodes) {
			const radius = node.level === 0 ? 22 : node.level === 1 ? 18 : 14;
			const dx = node.x - x;
			const dy = node.y - y;
			if (dx * dx + dy * dy < radius * radius) {
				goto(`/${node.id}`);
				return;
			}
		}
	}

	function handleCanvasMove(e: MouseEvent) {
		if (!canvasEl) return;
		const rect = canvasEl.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		let found: string | null = null;
		for (const node of nodes) {
			const radius = node.level === 0 ? 22 : node.level === 1 ? 18 : 14;
			const dx = node.x - x;
			const dy = node.y - y;
			if (dx * dx + dy * dy < (radius + 4) * (radius + 4)) {
				found = node.id;
				break;
			}
		}
		if (found !== hoveredNode) {
			hoveredNode = found;
			canvasEl.style.cursor = found ? "pointer" : "default";
			draw();
		}
	}

	let hasContent = $derived(components && components.length > 0);

	$effect(() => {
		if (expanded && canvasEl && hasContent) {
			buildGraph();
			simulate();
			draw();
		}
	});
</script>

{#if hasContent}
	<div class="semantic-graph">
		<SectionHeading id="graph">Semantic Network</SectionHeading>

		{#if !expanded}
			<button class="expand-btn" onclick={() => (expanded = true)}>
				Show character relationship graph
			</button>
		{:else}
			<div class="graph-container">
				<canvas
					bind:this={canvasEl}
					width="400"
					height="300"
					class="graph-canvas"
					onclick={handleCanvasClick}
					onmousemove={handleCanvasMove}
					onmouseleave={() => {
						hoveredNode = null;
						draw();
					}}
				></canvas>
				<div class="graph-legend">
					<span class="legend-item center">● Target</span>
					<span class="legend-item component">● Component</span>
					<span class="legend-item related">● Related</span>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.semantic-graph {
		margin-bottom: var(--spacing-lg);
	}

	.expand-btn {
		display: block;
		width: 100%;
		padding: var(--spacing-sm) var(--spacing-md);
		background: var(--bg-secondary);
		border: 1px solid var(--border-light);
		border-radius: 4px;
		color: var(--text-secondary);
		font-size: var(--font-size-footnote);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.expand-btn:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.graph-container {
		background: var(--bg-secondary);
		border: 1px solid var(--border-light);
		border-radius: 6px;
		overflow: hidden;
	}

	.graph-canvas {
		width: 100%;
		height: 300px;
		display: block;
	}

	.graph-legend {
		display: flex;
		gap: var(--spacing-md);
		padding: var(--spacing-xs) var(--spacing-md);
		border-top: 1px solid var(--border-light);
		font-size: var(--font-size-caption2);
	}

	.legend-item {
		color: var(--text-tertiary);
	}

	.legend-item.center {
		color: var(--accent);
	}

	.legend-item.component {
		color: var(--text-primary);
	}

	.legend-item.related {
		color: var(--text-secondary);
	}
</style>
