<!--
  Figure: how a single word is addressed. Han-character count chooses a repo
  family; one hash both picks the repo within that family (hash % N) and the
  256-way subdirectory (hash & 0xFF). One word, resolved to one path — no index.
-->
<div class="d">
	<svg viewBox="0 0 900 360" role="img" aria-label="A word is routed by Han-count and a single hash into one repository and one of 256 subdirectories.">
		<defs>
			<marker id="ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
				<path d="M0 0 L10 5 L0 10 z" fill="var(--ink-faint)" />
			</marker>
		</defs>

		<!-- input word -->
		<g class="node">
			<rect x="24" y="150" width="120" height="60" rx="3" />
			<text x="84" y="178" class="jp">日本</text>
			<text x="84" y="198" class="sub">query</text>
		</g>
		<line x1="144" y1="180" x2="208" y2="180" class="wire" marker-end="url(#ar)" />

		<!-- han count -->
		<g class="node accentline">
			<rect x="208" y="150" width="150" height="60" rx="3" />
			<text x="283" y="175" class="lbl">count Han</text>
			<text x="283" y="196" class="mono">2 → han-2char</text>
		</g>

		<!-- hash -->
		<g class="node">
			<rect x="208" y="248" width="150" height="56" rx="3" />
			<text x="283" y="270" class="lbl">hash(word)</text>
			<text x="283" y="290" class="mono">h = h*31 + c</text>
		</g>
		<line x1="283" y1="210" x2="283" y2="248" class="wire thin" marker-end="url(#ar)" />

		<!-- split: repo pick + subdir pick from the SAME hash -->
		<line x1="358" y1="180" x2="430" y2="120" class="wire" marker-end="url(#ar)" />
		<line x1="358" y1="276" x2="430" y2="276" class="wire" marker-end="url(#ar)" />

		<g class="node">
			<rect x="430" y="92" width="184" height="58" rx="3" />
			<text x="522" y="114" class="lbl">repo = hash % 8</text>
			<text x="522" y="135" class="mono">kiokun2-dict-han-2char-<tspan class="hot">5</tspan></text>
		</g>
		<g class="node">
			<rect x="430" y="248" width="184" height="58" rx="3" />
			<text x="522" y="270" class="lbl">subdir = hash &amp; 0xff</text>
			<text x="522" y="291" class="mono">/<tspan class="hot">a3</tspan>/</text>
		</g>

		<line x1="614" y1="121" x2="690" y2="170" class="wire" marker-end="url(#ar)" />
		<line x1="614" y1="277" x2="690" y2="196" class="wire" marker-end="url(#ar)" />

		<!-- resolved path -->
		<g class="node seal">
			<rect x="690" y="150" width="186" height="64" rx="3" />
			<text x="783" y="176" class="path">…-han-2char-5</text>
			<text x="783" y="195" class="path">/a3/日本.json.deflate</text>
		</g>

		<!-- travelling packet -->
		<circle r="5.5" class="packet">
			<animateMotion dur="4.6s" repeatCount="indefinite"
				keyPoints="0;0.18;0.36;0.62;1" keyTimes="0;0.25;0.5;0.78;1" calcMode="spline"
				keySplines="0.5 0 0.5 1;0.5 0 0.5 1;0.5 0 0.5 1;0.5 0 0.5 1"
				path="M84 180 L283 180 L283 276 L522 276 L522 121 L783 182" />
		</circle>
	</svg>
</div>

<style>
	.d {
		container-type: inline-size;
	}
	svg {
		width: 100%;
		height: auto;
		display: block;
		font-family: var(--label);
	}
	rect {
		fill: var(--paper);
		stroke: var(--rule);
		stroke-width: 1.25;
	}
	.accentline rect {
		stroke: var(--shu-soft);
	}
	.seal rect {
		fill: color-mix(in oklch, var(--shu-wash) 60%, var(--paper));
		stroke: var(--shu);
	}
	text {
		fill: var(--ink-soft);
		text-anchor: middle;
		dominant-baseline: middle;
	}
	.jp {
		font-family: var(--display);
		font-size: 24px;
		font-weight: 600;
		fill: var(--ink);
	}
	.lbl {
		font-size: 13px;
		font-weight: 600;
		fill: var(--ink);
		letter-spacing: 0.02em;
	}
	.sub {
		font-size: 11px;
		fill: var(--ink-faint);
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.mono {
		font-size: 12.5px;
		font-feature-settings: 'tnum';
		fill: var(--ink-soft);
	}
	.path {
		font-size: 12px;
		fill: var(--ink);
	}
	.hot {
		fill: var(--shu);
		font-weight: 700;
	}
	.wire {
		stroke: var(--ink-faint);
		stroke-width: 1.5;
		fill: none;
	}
	.wire.thin {
		stroke-dasharray: 3 3;
	}
	.packet {
		fill: var(--shu);
		filter: drop-shadow(0 0 5px var(--shu-soft));
	}
	@media (prefers-reduced-motion: reduce) {
		.packet {
			display: none;
		}
	}
</style>
