export interface PublishedArtifactListItem {
	id: string;
	userId: string;
	title: string;
	description: string | null;
	language: string;
	type: string;
	isPublic: boolean;
	createdAt: string;
	updatedAt: string;
	thumbnailUrl: string | null;
	sentenceCount: number;
	user: { id: string; name: string; image: string | null } | null;
}

// Repository-backed artifacts published from ChatGPT live alongside DB-backed
// artifacts in the public catalog. Prefixing the id with `published/` makes the
// existing /artifacts/{id} card link resolve to the dedicated renderer without
// exposing a second list UI or special-case client code.
export const publishedArtifacts: PublishedArtifactListItem[] = [
	{
		id: 'published/anata-no-kansou-desu-yo-ne',
		userId: 'chatgpt-published',
		title: '「あなたの感想ですよね」— ひろゆき',
		description: 'A compact breakdown of ひろゆき\'s well-known line, with the smaller TV prompt visible in the source frame.',
		language: 'ja',
		type: 'media',
		isPublic: true,
		createdAt: '2026-08-24T17:12:40.000Z',
		updatedAt: '2026-08-24T17:48:00.000Z',
		thumbnailUrl: 'https://media1.tenor.com/m/mWxWctN5OAcAAAAC/hiroyuki-%E3%81%B2%E3%82%8D%E3%82%86%E3%81%8D.gif',
		sentenceCount: 2,
		user: null,
	},
];
