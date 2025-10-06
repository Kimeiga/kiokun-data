<script lang="ts">
	import PitchAccent from '$lib/PitchAccent.svelte';
</script>

<h1>Pitch Accent Test</h1>

<div style="margin: 20px;">
	<h2>Test 1: いち (pitch accent: 2)</h2>
	<PitchAccent kana="いち" pitchAccents={[2]} />
</div>

<div style="margin: 20px;">
	<h2>Test 2: にんたい (pitch accent: 1)</h2>
	<PitchAccent kana="にんたい" pitchAccents={[1]} />
</div>

<div style="margin: 20px;">
	<h2>Test 3: こんにちは (pitch accent: 0 - heiban)</h2>
	<PitchAccent kana="こんにちは" pitchAccents={[0]} />
</div>

<div style="margin: 20px;">
	<h2>Test 4: Multiple patterns</h2>
	<PitchAccent kana="はし" pitchAccents={[1, 2]} />
</div>
