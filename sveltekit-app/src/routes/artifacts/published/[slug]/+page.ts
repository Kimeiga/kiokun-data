import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';
import type { PageSeo } from '$lib/seo';

type Token = {
	surface: string;
	reading?: string | null;
	meaning: string;
	wordSlug?: string | null;
};

type ImageBlock = {
	type: 'image';
	src: string;
	alt: string;
	caption?: string;
	width?: number;
	height?: number;
	mediaType?: string;
};

type SentenceBlock = {
	type: 'sentence';
	original: string;
	translation: string;
	literalTranslation?: string;
	note?: string;
	tokens: Token[];
};

type ProseBlock = {
	type: 'prose';
	heading?: string;
	body: string;
};

export type PublishedArtifact = {
	title: string;
	description?: string;
	seoTitle?: string;
	seoDescription?: string;
	language: string;
	sourceUrl?: string;
	publishedAt?: string;
	blocks: Array<ImageBlock | SentenceBlock | ProseBlock>;
};

export const load: PageLoad = async ({ params, fetch }) => {
	const response = await fetch(`/published-artifacts/${encodeURIComponent(params.slug)}.json`);
	if (response.status === 404) throw error(404, 'Artifact not found');
	if (!response.ok) throw error(500, 'Failed to load artifact');

	const artifact = (await response.json()) as PublishedArtifact;
	const hero = artifact.blocks.find((block): block is ImageBlock => block.type === 'image');
	const languageName = artifact.language === 'ja' ? 'Japanese' : artifact.language === 'zh' ? 'Chinese' : artifact.language === 'ko' ? 'Korean' : 'Language';
	const seo: PageSeo = {
		title: artifact.seoTitle || `${artifact.title} — ${languageName} breakdown | Kiokun`,
		description: artifact.seoDescription || artifact.description || `Learn ${artifact.title} with readings, a word-by-word breakdown, translation, and usage notes on Kiokun.`,
		canonicalPath: `/artifacts/published/${encodeURIComponent(params.slug)}`,
		og: {
			kind: 'section',
			eyebrow: `${languageName} artifact`,
			title: artifact.title,
			subtitle: artifact.seoDescription || artifact.description || `${languageName} breakdown and translation`
		}
	};

	return {
		artifact,
		seo,
		socialImage: hero
			? {
				url: hero.src,
				width: hero.width,
				height: hero.height,
				type: hero.mediaType,
				alt: hero.alt
			}
			: undefined
	};
};
