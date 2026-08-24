<script lang="ts">
	import { page } from '$app/stores';
	import { defaultSeoForUrl, ogImagePath, structuredDataForSeo, type PageSeo } from '$lib/seo';

	type SocialImage = {
		url: string;
		width?: number;
		height?: number;
		type?: string;
		alt?: string;
	};

	let seo = $derived((($page.data as { seo?: PageSeo }).seo) || defaultSeoForUrl($page.url));
	let origin = $derived($page.url.protocol === 'http:' || $page.url.protocol === 'https:' ? $page.url.origin : 'https://kiokun.com');
	let canonicalUrl = $derived(new URL(seo.canonicalPath, origin).toString());
	let socialImage = $derived((($page.data as { socialImage?: SocialImage }).socialImage) || null);
	let imageUrl = $derived(
		socialImage?.url
			? new URL(socialImage.url, origin).toString()
			: new URL(ogImagePath(seo.og), origin).toString()
	);
	let imageWidth = $derived(socialImage?.width || 1200);
	let imageHeight = $derived(socialImage?.height || 630);
	let imageType = $derived(socialImage?.type || 'image/png');
	let imageAlt = $derived(socialImage?.alt || `${seo.og.title} — ${seo.og.subtitle || seo.description}`);
	let structuredData = $derived(
		JSON.stringify(structuredDataForSeo(seo, canonicalUrl)).replace(/</g, '\\u003c')
	);
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
	<meta property="og:image:secure_url" content={imageUrl} />
	<meta property="og:image:width" content={String(imageWidth)} />
	<meta property="og:image:height" content={String(imageHeight)} />
	<meta property="og:image:type" content={imageType} />
	<meta property="og:image:alt" content={imageAlt} />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={seo.title} />
	<meta name="twitter:description" content={seo.description} />
	<meta name="twitter:image" content={imageUrl} />
	<meta name="twitter:image:alt" content={imageAlt} />
	{@html `<script type="application/ld+json">${structuredData}</script>`}
</svelte:head>
