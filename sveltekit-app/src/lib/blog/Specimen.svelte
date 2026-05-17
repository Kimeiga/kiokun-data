<!--
  A real specimen: the actual bytes of one dictionary file as stored on
  GitHub, and what they decompress to. Fetched live from the CDN while
  writing this; shown statically so it's prerender-safe and always exact.
  Word: ねこ — kiokun2-dict-non-han-3/86/ねこ.json.deflate (389 B → 2,726 B).
-->
<script lang="ts">
	const hex = [
		'd5 96 41 4b c3 30 14 c7 bf 4b 8e d2 43 d3 36 6b',
		'd3 8b 1f 40 f0 e4 4d 86 84 2d 9b d9 ba b4 34 19',
		'3a 46 0f bb 0b 0a 5e 1d 0e 71 7a 90 a2 e0 c9 cf',
		'33 36 f1 5b 98 b6 db 1c 92 dd c6 58 2e 25 f0 de'
	];
	const json = `{
  "key": "ねこ",
  "japanese_names": [
    {
      "id": "5004955",
      "kanji": [],
      "kana": [{ "text": "ねこ", "tags": [], "appliesToKanji": ["*"] }],
      "translation": [
        { "type": ["fem"], "related": [],
          "translation": [{ "lang": "eng", "text": "Neko" }] }
      ]
    },
    … 12 more readings (音子・根子・猫子 …) …
  ],
  "contains": [
    { "w": "ね", "jp": "ね", "d": "right?", "c": true,  "fr": 1301 },
    { "w": "こ", "jp": "こ", "d": "doing",  "c": false, "fr": 1719 }
  ]
}`;
</script>

<div class="spec">
	<div class="pane raw">
		<div class="pane-head">
			<span class="path">…/non-han-3/<b>86</b>/ねこ.json.deflate</span>
			<span class="size">389 B · raw deflate</span>
		</div>
		<pre aria-label="Raw deflate bytes, hexadecimal"><code
				>{#each hex as row}<span class="byte">{row}</span>
{/each}<span class="more">⋯ 389 bytes — opaque on disk and over the wire</span></code
			></pre>
	</div>

	<div class="seam" aria-hidden="true">
		<span class="op">inflate</span>
		<span class="ratio">7×</span>
	</div>

	<div class="pane out">
		<div class="pane-head">
			<span class="path">decompressed in the browser</span>
			<span class="size">2,726 B · JSON</span>
		</div>
		<pre aria-label="Decompressed JSON"><code>{json}</code></pre>
	</div>
</div>

<style>
	.spec {
		display: grid;
		gap: 0;
		container-type: inline-size;
	}
	.pane {
		border: 1px solid var(--rule);
		background: var(--paper-2);
	}
	.raw {
		border-radius: 6px 6px 0 0;
	}
	.out {
		border-radius: 0 0 6px 6px;
		border-top: none;
	}
	.pane-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 1rem;
		flex-wrap: wrap;
		padding: 0.55rem 0.9rem;
		border-bottom: 1px solid var(--rule);
		font-family: var(--label);
		font-size: 0.72rem;
		letter-spacing: 0.04em;
		color: var(--ink-faint);
	}
	.path b {
		color: var(--shu);
		font-weight: 600;
	}
	.size {
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}
	pre {
		margin: 0;
		padding: 0.9rem 1rem;
		overflow-x: auto;
	}
	code {
		font-family: var(--mono);
		font-size: 0.82rem;
		line-height: 1.55;
		white-space: pre;
		color: var(--ink-soft);
	}
	.raw code {
		color: var(--ink-faint);
		letter-spacing: 0.04em;
	}
	.byte {
		display: block;
	}
	.more {
		display: block;
		margin-top: 0.4rem;
		font-family: var(--label);
		font-size: 0.72rem;
		letter-spacing: 0.02em;
		color: var(--ink-faint);
		opacity: 0.8;
	}
	.out code :global(*) {
		color: inherit;
	}
	/* seam between the two panes — where decompression happens */
	.seam {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0.9rem;
		border-inline: 1px solid var(--rule);
		background: color-mix(in srgb, var(--shu) 9%, var(--paper-2));
		font-family: var(--label);
		font-size: 0.72rem;
	}
	.op {
		color: var(--shu);
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	.op::before {
		content: '↓ ';
	}
	.ratio {
		margin-left: auto;
		color: var(--ink-faint);
		font-variant-numeric: tabular-nums;
	}
</style>
