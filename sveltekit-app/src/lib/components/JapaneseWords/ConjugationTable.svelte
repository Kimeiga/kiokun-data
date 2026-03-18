<script lang="ts">
	/**
	 * Displays a conjugation table for Japanese verbs
	 */
	import type { JapaneseSense } from '$lib/types';
	import { conjugate, isVerbPos, type ConjugationForm, type VerbType } from '$lib/utils/conjugate';

	export let senses: JapaneseSense[];
	export let dictionaryForm: string; // The verb in dictionary form

	// Determine if this word is a verb and get its type
	$: allPosTags = senses.flatMap(s => s.partOfSpeech || []);
	$: verbType = allPosTags.find((pos): pos is VerbType => isVerbPos(pos)) || null;
	$: conjugationTable = verbType ? conjugate(dictionaryForm, verbType) : null;

	// Toggle state for showing/hiding the table
	let expanded = false;

	// Group forms by category for display
	$: groupedForms = conjugationTable ? groupFormsByCategory(conjugationTable.forms) : {};

	function groupFormsByCategory(forms: ConjugationForm[]): Record<string, ConjugationForm[]> {
		const groups: Record<string, ConjugationForm[]> = {};
		for (const form of forms) {
			if (!groups[form.category]) {
				groups[form.category] = [];
			}
			groups[form.category].push(form);
		}
		return groups;
	}

	// Category display names
	const categoryNames: Record<string, string> = {
		'basic': 'Basic',
		'negative': 'Negative',
		'past': 'Past',
		'te': 'Te-form',
		'conditional': 'Conditional',
		'volitional': 'Volitional',
		'imperative': 'Imperative',
		'voice': 'Voice',
		'desire': 'Desire',
		'auxiliary': 'Auxiliary',
	};

	// Order of categories
	const categoryOrder = ['basic', 'negative', 'past', 'te', 'conditional', 'volitional', 'imperative', 'voice', 'desire', 'auxiliary'];
</script>

{#if verbType && conjugationTable}
	<div class="conjugation-section">
		<button
			class="toggle-button"
			on:click={() => expanded = !expanded}
			aria-expanded={expanded}
		>
			<span class="toggle-icon">{expanded ? '▼' : '▶'}</span>
			<span>Conjugation Table</span>
		</button>

		{#if expanded}
			<div class="conjugation-table">
				{#each categoryOrder as category}
					{#if groupedForms[category] && groupedForms[category].length > 0}
						<div class="form-group">
							<h4 class="group-title">{categoryNames[category] || category}</h4>
							<div class="forms-grid">
								{#each groupedForms[category] as form}
									<div class="form-row">
										<span class="form-name">{form.label}</span>
										<span class="form-value">{form.form}</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	.conjugation-section {
		margin-top: var(--spacing-lg);
		border-top: 1px solid var(--border-color, #e0e0e0);
		padding-top: var(--spacing-md);
	}

	.toggle-button {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		background: none;
		border: none;
		cursor: pointer;
		font-size: var(--font-size-footnote);
		color: var(--text-secondary, #666);
		padding: var(--spacing-xs) 0;
	}

	.toggle-button:hover {
		color: var(--text-primary, #333);
	}

	.toggle-icon {
		font-size: var(--font-size-caption2);
	}

	.conjugation-table {
		margin-top: var(--spacing-md);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
	}

	.form-group {
		background: var(--bg-secondary, #f5f5f5);
		border-radius: var(--radius-sm);
		padding: var(--spacing-md);
	}

	.group-title {
		font-size: var(--font-size-caption1);
		font-weight: 600;
		text-transform: uppercase;
		color: var(--text-secondary, #666);
		margin: 0 0 var(--spacing-sm) 0;
	}

	.forms-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: var(--spacing-sm);
	}

	.form-row {
		display: flex;
		justify-content: space-between;
		gap: var(--spacing-sm);
		padding: var(--spacing-xs) var(--spacing-sm);
		background: var(--bg-primary, #fff);
		border-radius: var(--radius-sm);
	}

	.form-name {
		font-size: var(--font-size-caption1);
		color: var(--text-secondary, #666);
	}

	.form-value {
		font-size: var(--font-size-subhead);
		font-family: "Noto Serif JP", "MS Mincho", serif;
		color: var(--text-primary, #333);
	}
</style>

