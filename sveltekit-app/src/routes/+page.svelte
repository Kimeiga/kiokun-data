<script lang="ts">
import { goto } from '$app/navigation';

let searchValue = $state('');

function handleSearch(event: KeyboardEvent) {
if (event.key === 'Enter') {
const word = searchValue.trim();
if (word) {
goto(`/${word}`);
}
}
}

const examples = ['好', '的', '和', '空', '地図', '日本'];
</script>

<svelte:head>
<title>Kiokun Dictionary</title>
</svelte:head>

<div class="container">
<div class="header">
<h1>📚 Kiokun Dictionary</h1>
<p>Chinese and Japanese Character Dictionary</p>
<input
type="text"
class="search-box"
placeholder="Enter a character or word (e.g., 好, 地図)"
bind:value={searchValue}
onkeypress={handleSearch}
/>
</div>

<div class="examples">
<h2>Try these examples:</h2>
<div class="example-grid">
{#each examples as example}
<a href="/{example}" class="example-card">
<div class="example-char">{example}</div>
</a>
{/each}
</div>
</div>
</div>

<style>
:global(body) {
margin: 0;
padding: 0;
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
line-height: 1.6;
color: #333;
background: #f8f9fa;
}

.container {
max-width: 1200px;
margin: 0 auto;
padding: 20px;
}

.header {
text-align: center;
margin-bottom: 40px;
background: white;
padding: 40px 30px;
border-radius: 12px;
box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.header h1 {
margin: 0 0 10px 0;
font-size: 2.5rem;
color: #2c3e50;
}

.header p {
margin: 0 0 30px 0;
font-size: 1.1rem;
color: #666;
}

.search-box {
width: 100%;
max-width: 400px;
padding: 15px 25px;
border: 2px solid #e9ecef;
border-radius: 30px;
font-size: 18px;
margin: 0 auto;
display: block;
text-align: center;
font-family: 'SimSun', 'MS Mincho', serif;
}

.search-box:focus {
outline: none;
border-color: #3498db;
box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.examples {
background: white;
padding: 30px;
border-radius: 12px;
box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
margin-bottom: 30px;
}

.examples h2 {
margin: 0 0 20px 0;
font-size: 1.5rem;
color: #2c3e50;
}

.example-grid {
display: grid;
grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
gap: 15px;
}

.example-card {
display: flex;
align-items: center;
justify-content: center;
padding: 30px;
background: #f8f9fa;
border: 2px solid #e9ecef;
border-radius: 12px;
text-decoration: none;
transition: all 0.2s;
}

.example-card:hover {
border-color: #3498db;
transform: translateY(-2px);
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.example-char {
font-size: 48px;
font-family: 'SimSun', 'MS Mincho', serif;
color: #2c3e50;
}
</style>
