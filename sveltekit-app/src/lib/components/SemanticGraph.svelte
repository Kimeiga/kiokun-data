<script lang="ts">
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

	let expanded = $state(false);
	let hoveredNode: string | null = $state(null);

	interface GraphNode {
		id: string;
		label: string;
		x: number;
		y: number;
		level: number; // 0=center, 1=components, 2=related
	}

	interface GraphEdge {
		source: string;
		target: string;
	}

	let nodes: GraphNode[] = $state([]);
	let edges: GraphEdge[] = $state([]);

	const WIDTH = 400;
	const HEIGHT = 300;

	function buildGraph() {
		if (!components || components.length === 0) return;

		const nodeMap = new Map<string, GraphNode>();
		const edgeList: GraphEdge[] = [];

		const cx = WIDTH / 2, cy = HEIGHT / 2;
		nodeMap.set(targetChar, {
			id: targetChar,
			label: charGlosses?.[targetChar] || "",
			x: cx, y: cy,
			level: 0,
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
				level: 1,
			});
			edgeList.push({ source: comp, target: targetChar });
		});

		// Related nodes (level 2)
		validComponents.forEach((comp, compIdx) => {
			const uses = componentUses[comp];
			if (!uses) return;
			let relatedChars: string[] = [];
			for (const typeData of Object.values(uses)) {
				relatedChars = relatedChars.concat(typeData.chars);
			}
			const seen = new Set<string>();
			let count = 0;
			for (const ch of relatedChars) {
				if (seen.has(ch) || ch === targetChar || nodeMap.has(ch)) continue;
				const cp = ch.codePointAt(0) || 0;
				if (cp < 0x4e00 || cp > 0x9fff) continue;
				seen.add(ch);
				count++;
				if (count > 4) break;

				const baseAngle = angleStep * compIdx - Math.PI / 2;
				const spread = (count - 1) * 0.4 - 0.8;
				nodeMap.set(ch, {
					id: ch,
					label: charGlosses?.[ch] || "",
					x: cx + Math.cos(baseAngle + spread) * 140,
					y: cy + Math.sin(baseAngle + spread) * 140,
					level: 2,
				});
				edgeList.push({ source: comp, target: ch });
			}
		});

		// Simple force simulation
		const nodeArr = Array.from(nodeMap.values());
		for (let iter = 0; iter < 50; iter++) {
			const alpha = 1 - iter / 50;

			for (let i = 0; i < nodeArr.length; i++) {
				for (let j = i + 1; j < nodeArr.length; j++) {
					const dx = nodeArr[j].x - nodeArr[i].x;
					const dy = nodeArr[j].y - nodeArr[i].y;
					const dist = Math.sqrt(dx * dx + dy * dy) || 1;
					const force = (300 * alpha) / (dist * dist);
					const fx = (dx / dist) * force;
					const fy = (dy / dist) * force;
					nodeArr[j].x += fx; nodeArr[j].y += fy;
					nodeArr[i].x -= fx; nodeArr[i].y -= fy;
				}
			}

			for (const edge of edgeList) {
				const src = nodeArr.find(n => n.id === edge.source);
				const tgt = nodeArr.find(n => n.id === edge.target);
				if (!src || !tgt) continue;
				const dx = tgt.x - src.x;
				const dy = tgt.y - src.y;
				const dist = Math.sqrt(dx * dx + dy * dy) || 1;
				const targetDist = src.level === 0 || tgt.level === 0 ? 80 : 60;
				const force = (dist - targetDist) * 0.05 * alpha;
				const fx = (dx / dist) * force;
				const fy = (dy / dist) * force;
				src.x += fx; src.y += fy;
				tgt.x -= fx; tgt.y -= fy;
			}

			for (const node of nodeArr) {
				if (node.level === 0) {
					node.x = cx; node.y = cy;
				} else {
					node.x += (cx - node.x) * 0.01 * alpha;
					node.y += (cy - node.y) * 0.01 * alpha;
				}
			}
		}

		// Clamp to bounds
		for (const node of nodeArr) {
			node.x = Math.max(30, Math.min(WIDTH - 30, node.x));
			node.y = Math.max(30, Math.min(HEIGHT - 30, node.y));
		}

		nodes = nodeArr;
		edges = edgeList;
	}

	let hasContent = $derived(components && components.length > 0);

	$effect(() => {
		if (expanded && hasContent) {
			buildGraph();
		}
	});

	function nodeRadius(level: number): number {
		return level === 0 ? 22 : level === 1 ? 18 : 14;
	}

	function fontSize(level: number): number {
		return level === 0 ? 18 : level === 1 ? 15 : 12;
	}
</script>

{#if hasContent}
	<div class="semantic-graph">
		<SectionHeading id="graph">Semantic Network</SectionHeading>

		{#if !expanded}
			<div class="expand-grid divider-grid mobile-full-bleed">
				<button class="expand-btn divider-cell" onclick={() => (expanded = true)}>
					Show character relationship graph
				</button>
			</div>
		{:else}
			<div class="graph-container">
				<svg viewBox="0 0 {WIDTH} {HEIGHT}" class="graph-svg">
					<!-- Edges -->
					{#each edges as edge}
						{@const src = nodes.find(n => n.id === edge.source)}
						{@const tgt = nodes.find(n => n.id === edge.target)}
						{#if src && tgt}
							<line
								x1={src.x} y1={src.y}
								x2={tgt.x} y2={tgt.y}
								class="edge"
							/>
						{/if}
					{/each}

					<!-- Nodes -->
					{#each nodes as node}
						{@const r = nodeRadius(node.level)}
						{@const isHovered = hoveredNode === node.id}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<g
							class="node level-{node.level}"
							class:hovered={isHovered}
							role="link"
							tabindex="0"
							aria-label={`Open ${node.id}${node.label ? `, ${node.label}` : ''}`}
							onclick={() => goto(`/${node.id}`)}
							onkeydown={(event) => {
								if (event.key === 'Enter' || event.key === ' ') {
									event.preventDefault();
									goto(`/${node.id}`);
								}
							}}
							onmouseenter={() => (hoveredNode = node.id)}
							onmouseleave={() => (hoveredNode = null)}
							style="cursor: pointer"
						>
							<circle cx={node.x} cy={node.y} {r} />
							<text
								x={node.x} y={node.y}
								dominant-baseline="central"
								text-anchor="middle"
								font-size={fontSize(node.level)}
								class="node-char"
							>
								{node.id}
							</text>
							{#if node.label && (node.level <= 1 || isHovered)}
								<text
									x={node.x} y={node.y + r + 12}
									dominant-baseline="central"
									text-anchor="middle"
									font-size="9"
									class="node-label"
								>
									{node.label.length > 10 ? node.label.slice(0, 9) + "…" : node.label}
								</text>
							{/if}
						</g>
					{/each}
				</svg>
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

	.expand-grid { grid-template-columns: 1fr; }

	.expand-btn {
		display: block;
		width: 100%;
		padding: var(--spacing-sm) var(--spacing-md);
		background: var(--bg-secondary);
		border: 1px solid var(--border-light);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		font-size: var(--font-size-footnote);
		cursor: pointer;
		transition: border-color 0.15s ease, color 0.15s ease;
	}

	.expand-btn:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.graph-container {
		background: var(--bg-secondary);
		border: 1px solid var(--border-light);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.graph-svg {
		width: 100%;
		height: auto;
		display: block;
	}

	.edge {
		stroke: var(--border-light, #3a3a3c);
		stroke-width: 1;
	}

	/* Node circles */
	.node.level-0 circle {
		fill: color-mix(in srgb, var(--accent) 20%, transparent);
		stroke: var(--accent);
		stroke-width: 2;
	}

	.node.level-1 circle {
		fill: var(--bg-secondary, #121212);
		stroke: var(--border-light, #3a3a3c);
		stroke-width: 1.5;
	}

	.node.level-1.hovered circle {
		fill: color-mix(in srgb, var(--accent) 12%, transparent);
		stroke: var(--accent);
	}

	.node.level-2 circle {
		fill: var(--bg-secondary, #121212);
		stroke: var(--border-light, #3a3a3c);
		stroke-width: 1;
	}

	.node.level-2.hovered circle {
		fill: color-mix(in srgb, var(--accent) 8%, transparent);
		stroke: var(--accent);
	}

	/* Node text */
	.node-char {
		fill: var(--text-primary, #fff);
		font-family: var(--font-cjk);
	}

	.node.level-0 .node-char {
		fill: var(--accent);
	}

	.node.hovered .node-char {
		fill: var(--accent);
	}

	.node-label {
		fill: var(--text-secondary, #b0b0b0);
		font-family: -apple-system, sans-serif;
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
