<script lang="ts">
	import { page } from '$app/stores';
	import { defaultSeoForUrl, ogImagePath, type PageSeo } from '$lib/seo';

	let seo = $derived((($page.data as { seo?: PageSeo }).seo) || defaultSeoForUrl($page.url));
	let origin = $derived($page.url.protocol === 'http:' || $page.url.protocol === 'https:' ? $page.url.origin : 'https://kiokun.com');
	let canonicalUrl = $derived(new URL(seo.canonicalPath, origin).toString());
	let imageUrl = $derived(new URL(ogImagePath(seo.og), origin).toString());
</script>

<svelte:head>
	<title>{seo.title}</title>
	<meta name="description" content={seo.description} />
	<meta name="robots" content={seo.robots || 'index, follow'} />
	<link rel="canonical" href={canonicalUrl} />

	<meta property="og:type" content={seo.og.kind === 'reel' ? 'video.other' : 'website'} />
	<meta property="og:site_name" content="Kiokun" />
	<meta property="og:locale" content="en_US" />
	<meta property="og:title" content={seo.title} />
	<meta property="og:description" content={seo.description} />
	<meta property="og:url" content={canonicalUrl} />
	<meta property="og:image" content={imageUrl} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:type" content="image/png" />
	<meta property="og:image:alt" content={`${seo.og.title} — ${seo.og.subtitle || seo.description}`} />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={seo.title} />
	<meta name="twitter:description" content={seo.description} />
	<meta name="twitter:image" content={imageUrl} />
	<meta name="twitter:image:alt" content={`${seo.og.title} — ${seo.og.subtitle || seo.description}`} />
</svelte:head>
