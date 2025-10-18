<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	interface Props {
		note: {
			id: string;
			text: string;
			image_key?: string;
			image_url?: string;
			created_at: number;
		};
	}

	let { note }: Props = $props();

	const dispatch = createEventDispatcher();

	function formatDate(timestamp: number): string {
		const date = new Date(timestamp);
		return date.toLocaleString();
	}

	function handleDelete() {
		if (confirm('Are you sure you want to delete this note?')) {
			dispatch('delete');
		}
	}
</script>

<div class="note-card">
	{#if note.image_url}
		<div class="note-image">
			<img src={note.image_url} alt="Note attachment" />
		</div>
	{/if}

	<div class="note-content">
		<p class="note-text">{note.text}</p>
		<div class="note-footer">
			<span class="note-date">{formatDate(note.created_at)}</span>
			<button class="delete-btn" onclick={handleDelete}>Delete</button>
		</div>
	</div>
</div>

<style>
	.note-card {
		background: white;
		border-radius: 12px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		overflow: hidden;
		transition: transform 0.2s, box-shadow 0.2s;
	}

	.note-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	.note-image {
		width: 100%;
		height: 200px;
		overflow: hidden;
		background: #f0f0f0;
	}

	.note-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.note-content {
		padding: 20px;
	}

	.note-text {
		margin: 0 0 15px 0;
		font-size: 1rem;
		line-height: 1.6;
		color: #333;
		word-wrap: break-word;
	}

	.note-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-top: 15px;
		border-top: 1px solid #eee;
	}

	.note-date {
		font-size: 0.85rem;
		color: #999;
	}

	.delete-btn {
		padding: 6px 12px;
		background: #e74c3c;
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 0.85rem;
		cursor: pointer;
		transition: background 0.2s;
	}

	.delete-btn:hover {
		background: #c0392b;
	}
</style>

