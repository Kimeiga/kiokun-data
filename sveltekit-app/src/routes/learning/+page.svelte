<script lang="ts">
	const sections = [
		{
			href: '/learning-resources',
			icon: '🎓',
			title: 'Learning Resources',
			desc: 'Curated videos, guides and reading paths for Japanese, Chinese & Korean.'
		},
		{
			href: '/study',
			icon: '📚',
			title: 'Study',
			desc: 'Your spaced-repetition decks, review queue and progress stats.'
		},
		{
			href: '/artifacts',
			icon: '📦',
			title: 'Artifacts',
			desc: 'Saved sentences, mined cards and shareable study artifacts.'
		},
		{
			href: '/users',
			icon: '👥',
			title: 'Community',
			desc: 'Other learners, their public notes and shared collections.'
		}
	];
</script>

<svelte:head>
	<title>Learning — Kiokun</title>
	<meta name="description" content="Learning hub: resources, study tools, artifacts and community." />
</svelte:head>

<main class="mx-auto max-w-3xl px-4 py-10 md:py-16">
	<header class="mb-8 md:mb-12">
		<p class="text-sm font-medium tracking-widest uppercase text-accent mb-2">Learning</p>
		<h1 class="text-3xl md:text-4xl font-bold text-text-primary">Everything to keep learning</h1>
		<p class="mt-3 text-text-secondary max-w-xl">
			Resources, your study tools, saved artifacts and the community — gathered in one place.
		</p>
	</header>

	<div class="grid gap-3 sm:grid-cols-2">
		{#each sections as s}
			<a
				href={s.href}
				class="group flex flex-col gap-2 rounded-xl border border-border bg-bg-secondary p-5 no-underline transition-colors duration-150 hover:border-accent"
			>
				<span class="text-2xl">{s.icon}</span>
				<span
					class="text-lg font-semibold text-text-primary transition-colors group-hover:text-accent"
				>
					{s.title}
				</span>
				<span class="text-sm leading-relaxed text-text-secondary">{s.desc}</span>
			</a>
		{/each}
	</div>
</main>
