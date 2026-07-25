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
			<img src={note.image_url} alt="Note attachment" loading="lazy" decoding="async" />
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
		background: var(--bg-secondary);
		border-radius: var(--radius-lg);
		border: 1px solid var(--border-light);
		overflow: hidden;
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.note-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px var(--shadow);
	}

	.note-image {
		width: 100%;
		height: 200px;
		overflow: hidden;
		background: var(--bg-tertiary);
	}

	.note-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.note-content {
		padding: var(--spacing-lg);
	}

	.note-text {
		margin: 0 0 var(--spacing-md) 0;
		font-size: 1rem;
		line-height: 1.6;
		color: var(--text-primary);
		word-wrap: break-word;
	}

	.note-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-top: var(--spacing-md);
		border-top: 1px solid var(--border-light);
	}

	.note-date {
		font-size: 0.85rem;
		color: var(--text-muted);
	}

	.delete-btn {
		padding: var(--spacing-xs) var(--spacing-sm);
		background: var(--color-error, #e74c3c);
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		font-size: 0.85rem;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.delete-btn:hover {
		background: color-mix(in srgb, var(--color-error, #e74c3c) 85%, black);
	}
</style>
