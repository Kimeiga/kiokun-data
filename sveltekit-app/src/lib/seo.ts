import type { DictionaryEntry } from './types';
import { learnerGlossForEntry } from './character-forms';

export type OgCardKind = 'character' | 'word' | 'sentence' | 'reel' | 'section';

export interface OgReading {
	label: string;
	value: string;
	color: 'pinyin' | 'cantonese' | 'onyomi' | 'kunyomi' | 'korean' | 'neutral';
}

export interface OgCardData {
	kind: OgCardKind;
	eyebrow?: string;
	title: string;
	subtitle?: string;
	forms?: string[];
	readings?: OgReading[];
	definitions?: string[];
	translation?: string;
}

export interface PageSeo {
	title: string;
	description: string;
	canonicalPath: string;
	og: OgCardData;
	robots?: string;
}

export type StructuredData = Record<string, unknown>;

const SITE_NAME = 'Kiokun';
const DEFAULT_DESCRIPTION =
	'Learn Chinese, Japanese, and Korean together with definitions, readings, stroke order, mnemonics, and real usage.';

function unique(values: Array<string | null | undefined>): string[] {
	return [...new Set(values.map((value) => cleanText(value || '')).filter(Boolean))];
}

export function cleanText(value: string): string {
	return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function truncate(value: string, length: number): string {
	const text = cleanText(value);
	if (text.length <= length) return text;
	return `${text.slice(0, Math.max(0, length - 1)).trimEnd()}…`;
}

function definitionFragments(values: string[]): string[] {
	return unique(
		values.flatMap((value) =>
			cleanText(value)
				.split(/\s*[;；]\s*/)
				.map((part) => part.replace(/^\d+[.)]\s*/, '').trim())
		)
	).filter(
		(value) =>
			value.length > 1 &&
			value.length <= 96 &&
			!/^(?:CL|classifier)\s*:/i.test(value)
	);
}

export function dictionaryDefinitions(entry: DictionaryEntry): string[] {
	const chinese =
		entry.chinese_words?.flatMap((word) =>
			word.items?.flatMap((item) => item.definitions || []) || []
		) || [];
	const japanese =
		entry.japanese_words?.flatMap((word) =>
			word.sense?.flatMap((sense) =>
				sense.gloss?.filter((gloss) => !gloss.lang || gloss.lang === 'eng').map((gloss) => gloss.text) || []
			) || []
		) || [];
	const japaneseCharacter =
		entry.japanese_char?.readingMeaning?.groups?.flatMap((group) =>
			group.meanings?.filter((meaning) => !meaning.lang || meaning.lang === 'en').map((meaning) => meaning.value) || []
		) || [];
	const korean =
		entry.korean_words?.flatMap((word) => word.definitions?.map((definition) => definition.text) || []) || [];
	const koreanCharacter = entry.korean_char?.meaningsEn || [];

	return definitionFragments([...chinese, ...japanese, ...japaneseCharacter, ...korean, ...koreanCharacter]);
}

export function dictionaryReadings(entry: DictionaryEntry): OgReading[] {
	const readings: OgReading[] = [];
	const add = (
		label: string,
		values: Array<string | null | undefined>,
		color: OgReading['color'],
		separator = ', '
	) => {
		const cleaned = unique(values);
		if (cleaned.length) readings.push({ label, value: cleaned.join(separator), color });
	};

	const pinyins = entry.chinese_char?.pinyinFrequencies?.map((item) => item.pinyin) || [];
	add(
		'Mandarin',
		pinyins.length
			? pinyins
			: entry.chinese_words?.flatMap((word) => word.items?.map((item) => item.pinyin) || []) || [],
		'pinyin'
	);
	add('Cantonese', entry.chinese_char?.cantonese || [], 'cantonese');

	const readingMeaning = entry.japanese_char?.readingMeaning;
	const japaneseReadings =
		readingMeaning?.groups?.flatMap((group) => group.readings || []) ||
		readingMeaning?.readings ||
		[];
	add(
		'Japanese on’yomi',
		japaneseReadings.filter((reading) => reading.type === 'ja_on').map((reading) => reading.value),
		'onyomi',
		'、'
	);
	add(
		'Japanese kun’yomi',
		japaneseReadings.filter((reading) => reading.type === 'ja_kun').map((reading) => reading.value),
		'kunyomi',
		'、'
	);
	add(
		'Korean',
		entry.korean_char?.readings?.map((reading) => reading.hangul) || [],
		'korean'
	);

	if (!readings.length) {
		add(
			'Chinese',
			entry.chinese_words?.flatMap((word) => word.items?.map((item) => item.pinyin) || []) || [],
			'pinyin'
		);
		add(
			'Japanese',
			entry.japanese_words?.flatMap((word) => word.kana?.map((kana) => kana.text) || []) || [],
			'onyomi',
			'、'
		);
		add('Korean', entry.korean_words?.map((word) => word.hangul) || [], 'korean');
	}

	return readings.slice(0, 5);
}

function dictionaryForms(word: string, entry: DictionaryEntry): string[] {
	return unique([
		word,
		entry.chinese_char?.char,
		entry.chinese_char?.hkChar,
		...(entry.chinese_char?.simpVariants || []),
		...(entry.chinese_char?.tradVariants || []),
		entry.japanese_char?.literal,
		entry.korean_char?.character
	]).slice(0, 6);
}

export function buildDictionarySeo(word: string, entry: DictionaryEntry): PageSeo {
	const forms = dictionaryForms(word, entry);
	const isCharacter = [...word].length === 1;
	const primaryGloss = learnerGlossForEntry(entry);
	const definitions = dictionaryDefinitions(entry);
	const displayDefinitions = unique([primaryGloss, ...definitions]).slice(0, 5);
	const formSuffix = forms.filter((form) => form !== word).slice(0, 3).join('・');
	const subject = formSuffix ? `${word} (${formSuffix})` : word;
	const meaning = displayDefinitions.slice(0, 3).join(', ');
	const languageText = isCharacter ? 'character' : 'word';
	const title = truncate(
		`${subject}${meaning ? ` — ${meaning}` : ''} | ${SITE_NAME}`,
		68
	);
	const description = truncate(
		`${subject}${meaning ? ` means ${meaning}` : ''}. ${languageText[0].toUpperCase()}${languageText.slice(1)} readings, definitions, examples, and learning tools across Chinese, Japanese, and Korean.`,
		158
	);

	return {
		title,
		description,
		canonicalPath: `/${encodeURIComponent(word)}`,
		og: {
			kind: isCharacter ? 'character' : 'word',
			eyebrow: isCharacter ? 'Character dictionary' : 'Multilingual dictionary',
			title: word,
			subtitle: primaryGloss || definitions[0] || '',
			forms: forms.filter((form) => form !== word),
			readings: dictionaryReadings(entry),
			definitions: displayDefinitions.filter(
				(definition) => definition.toLocaleLowerCase('en') !== primaryGloss.toLocaleLowerCase('en')
			)
		}
	};
}

export function buildCustomWordSeo(word: string, customWord: any): PageSeo {
	let rawDefinitions: unknown = customWord?.definitions;
	if (typeof rawDefinitions === 'string') {
		try {
			rawDefinitions = JSON.parse(rawDefinitions);
		} catch {
			rawDefinitions = [rawDefinitions];
		}
	}
	const definitions = definitionFragments(
		Array.isArray(rawDefinitions) ? rawDefinitions.map(String) : []
	);
	const reading = cleanText(customWord?.reading || customWord?.pronunciation || '');
	const meaning = definitions.slice(0, 3).join(', ');
	return {
		title: truncate(`${word}${meaning ? ` — ${meaning}` : ''} | Kiokun`, 68),
		description: truncate(
			`${word}${reading ? ` (${reading})` : ''}${meaning ? ` means ${meaning}` : ''}. A learner-created dictionary entry on Kiokun.`,
			158
		),
		canonicalPath: `/${encodeURIComponent(word)}`,
		og: {
			kind: [...word].length === 1 ? 'character' : 'word',
			eyebrow: 'Learner dictionary',
			title: word,
			subtitle: definitions[0] || '',
			readings: reading ? [{ label: 'Reading', value: reading, color: 'neutral' }] : [],
			definitions: definitions.slice(1, 5)
		}
	};
}

export function buildReelSeo(input: {
	id: string;
	language: 'ja' | 'zh';
	caption?: string | null;
	author?: string | null;
	transcript?: Array<{ sentence: string }>;
	highlightWord?: string | null;
}): PageSeo {
	const language = input.language === 'zh' ? 'Chinese' : 'Japanese';
	const excerpt = cleanText(
		input.caption ||
		input.transcript?.find((segment) => cleanText(segment.sentence))?.sentence ||
		''
	);
	const subject = input.highlightWord ? `${input.highlightWord} in context` : `${language} reel`;
	const title = truncate(`${subject}${input.author ? ` with ${input.author}` : ''} | Kiokun`, 68);
	const description = truncate(
		excerpt
			? `${excerpt} Learn from this ${language} video with an interactive word-by-word transcript.`
			: `Learn from a real ${language} video with an interactive word-by-word transcript.`,
		158
	);
	const params = new URLSearchParams({ lang: input.language });
	if (input.highlightWord) params.set('word', input.highlightWord);
	return {
		title,
		description,
		canonicalPath: `/reel/${encodeURIComponent(input.id)}?${params.toString()}`,
		og: {
			kind: 'reel',
			eyebrow: `${language} reel`,
			title: excerpt || subject,
			subtitle: input.author ? `Featuring ${input.author}` : 'Interactive transcript · tap any word'
		}
	};
}

export function buildCategorySeo(categoryPath: string[]): PageSeo {
	const category = categoryPath.length ? categoryPath[categoryPath.length - 1] : 'All categories';
	const breadcrumb = categoryPath.join(' → ');
	return {
		title: `${category} characters — Kiokun`,
		description: truncate(
			`Explore ${category.toLocaleLowerCase('en')} characters${breadcrumb ? ` in ${breadcrumb}` : ''}, with meanings, readings, and visual mnemonics.`,
			158
		),
		canonicalPath: categoryPath.length
			? `/category/${categoryPath.map(encodeURIComponent).join('/')}`
			: '/category',
		og: {
			kind: 'section',
			eyebrow: 'Character category',
			title: category,
			subtitle: breadcrumb || 'Chinese · Japanese · Korean'
		}
	};
}

function sectionSeo(pathname: string): PageSeo {
	const route = pathname.split('/').filter(Boolean)[0] || '';
	const sections: Record<string, [string, string]> = {
		'': [
			'Kiokun — Chinese, Japanese & Korean Dictionary',
			'A connected Chinese, Japanese, and Korean dictionary with readings, stroke order, etymology, frequency data, mnemonics, and real examples.'
		],
		search: ['Dictionary search — Kiokun', 'Search Chinese, Japanese, and Korean words and characters together.'],
		category: ['Character categories — Kiokun', 'Explore Chinese and Japanese characters by meaning and visual category.'],
		frequency: ['Word frequency lists — Kiokun', 'Browse common Chinese, Japanese, and Korean words by frequency.'],
		homophones: ['Homophones — Kiokun', 'Compare words that sound alike across Chinese, Japanese, and Korean.'],
		'japanese-emoji': ['Japanese emoji guide — Kiokun', 'Learn the language and culture behind Japanese emoji symbols.'],
		learning: ['Language learning — Kiokun', 'Learn Chinese, Japanese, and Korean through real content, homophones, study tools, and artifacts.'],
		'learning-resources': ['Language learning resources — Kiokun', 'Practical resources for learning natural Chinese, Japanese, and Korean.'],
		blog: ['The Kiokun Notebook', 'Notes on language learning, dictionary data, mnemonics, and multilingual technology.'],
		artifacts: ['Language artifacts — Kiokun', 'Explore annotated images, texts, and cultural artifacts through their language.'],
		users: ['Learner notes — Kiokun', 'Explore public character notes shared by Kiokun learners.'],
		reel: ['Language reels — Kiokun', 'Learn from short Chinese and Japanese videos with interactive transcripts.'],
		game: ['Character game — Kiokun', 'Practice Chinese and Japanese characters through visual connections.'],
		study: ['Study — Kiokun', 'Review saved Chinese, Japanese, and Korean words and characters.'],
		lists: ['My notes — Kiokun', 'Review and organize your saved character notes.'],
		'custom-words': ['Custom words — Kiokun', 'Create and study your own multilingual dictionary entries.']
	};
	const [title, description] = sections[route] || [
		`${route ? route.replace(/-/g, ' ') : 'Dictionary'} — Kiokun`,
		DEFAULT_DESCRIPTION
	];
	return {
		title,
		description,
		canonicalPath: pathname || '/',
		og: {
			kind: 'section',
			eyebrow: 'Kiokun',
			title: title.replace(/\s+[—|-]\s+Kiokun.*$/, ''),
			subtitle: description
		},
		robots: ['study', 'lists', 'custom-words', 'login', 'demo', 'test'].includes(route) ? 'noindex, nofollow' : undefined
	};
}

export function defaultSeoForUrl(url: URL): PageSeo {
	if (
		url.pathname === '/artifacts/new' ||
		/^\/reel\/[^/]+\/compare\/?$/.test(url.pathname)
	) {
		const seo = sectionSeo(url.pathname);
		return { ...seo, robots: 'noindex, nofollow' };
	}

	if (url.pathname === '/sentence') {
		const text = cleanText(url.searchParams.get('text') || '');
		const translation = cleanText(url.searchParams.get('en') || '');
		const language = url.searchParams.get('lang') === 'zh'
			? 'Chinese'
			: url.searchParams.get('lang') === 'ko'
				? 'Korean'
				: 'Japanese';
		if (text) {
			const canonical = new URLSearchParams({ text, lang: (url.searchParams.get('lang') || 'ja') });
			if (translation) canonical.set('en', translation);
			return {
				title: truncate(`${text} — ${language} sentence | Kiokun`, 68),
				description: truncate(
					translation ? `${text} — ${translation}. Explore this ${language} sentence word by word.` : `Explore the ${language} sentence “${text}” word by word.`,
					158
				),
				canonicalPath: `/sentence?${canonical.toString()}`,
				og: {
					kind: 'sentence',
					eyebrow: `${language} sentence`,
					title: text,
					translation
				}
			};
		}
	}

	if (url.pathname === '/search') {
		const query = cleanText(url.searchParams.get('q') || url.searchParams.get('query') || '');
		if (query) {
			return {
				title: truncate(`${query} — dictionary search | Kiokun`, 68),
				description: truncate(`Search results for “${query}” across Chinese, Japanese, and Korean.`, 158),
				canonicalPath: `/search?q=${encodeURIComponent(query)}`,
				og: {
					kind: 'section',
					eyebrow: 'Dictionary search',
					title: query,
					subtitle: 'Chinese · Japanese · Korean'
				}
			};
		}
	}

	const segments = url.pathname.split('/').filter(Boolean);
	if (segments[0] === 'homophones' && segments[1]) {
		const language = segments[1][0].toUpperCase() + segments[1].slice(1);
		const pitch = segments[1] === 'japanese' ? ' Includes pitch-accent patterns.' : '';
		return {
			title: `${language} homophones — Kiokun`,
			description: `Compare ${language} words that sound alike but differ in spelling and meaning.${pitch}`,
			canonicalPath: `/${segments.map(encodeURIComponent).join('/')}`,
			og: {
				kind: 'section',
				eyebrow: `${language} sound guide`,
				title: 'Homophones',
				subtitle: 'Same sound · different characters · different meanings'
			}
		};
	}

	if (
		segments[0] === 'learning-resources' &&
		segments[1] === 'japanese' &&
		segments[2] === 'scripting-japan'
	) {
		const lesson = segments[3]
			? segments[3].replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
			: 'Scripting Japan';
		return {
			title: `${lesson} — Japanese learning | Kiokun`,
			description: `Learn natural Japanese through Scripting Japan videos, transcripts, vocabulary, and cultural context.`,
			canonicalPath: `/${segments.map(encodeURIComponent).join('/')}`,
			og: {
				kind: 'section',
				eyebrow: 'Japanese learning resource',
				title: lesson,
				subtitle: 'Natural Japanese through video and transcripts'
			}
		};
	}

	if (segments[0] === 'blog' && segments[1]) {
		const articles: Record<string, [string, string]> = {
			'japanese-reel-stt-benchmark': [
				'Japanese Reel Speech-to-Text Benchmark',
				'A practical benchmark of 20 speech-to-text, OCR, and multimodal models on one noisy Japanese reel.'
			],
			'the-data-engine': [
				'The Free Dictionary Engine',
				'How Kiokun hosts 435,000 dictionary files for $0, addresses any word with one hash, and rebuilds itself in the cloud.'
			],
			'semantic-mnemonic-bakeoff': [
				'The Mnemonic Model Bakeoff',
				'A comparison of Gemini, Claude, Gemma, OpenAI, and Cloudflare models for component-based character mnemonics.'
			],
			'translation-model-bakeoff': [
				'The Sentence Translation Bakeoff',
				'A model comparison for repairing bad Japanese, Chinese, Korean, and Turkish example-sentence translations.'
			]
		};
		const [title, description] = articles[segments[1]] || [
			segments[1].replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
			'Research and field notes from Kiokun on language learning, dictionary data, and multilingual technology.'
		];
		return {
			title: `${title} — Kiokun`,
			description,
			canonicalPath: `/${segments.map(encodeURIComponent).join('/')}`,
			og: {
				kind: 'section',
				eyebrow: 'The Kiokun Notebook',
				title,
				subtitle: description
			}
		};
	}

	if (segments[0] === 'artifacts' && segments[1] && segments[1] !== 'new') {
		return {
			title: 'Annotated language artifact — Kiokun',
			description: 'Explore an image, text, or cultural artifact through its Chinese, Japanese, or Korean language.',
			canonicalPath: `/artifacts/${encodeURIComponent(segments[1])}`,
			og: {
				kind: 'section',
				eyebrow: 'Language artifact',
				title: 'Language in context',
				subtitle: 'Words, characters, annotations, and cultural detail'
			}
		};
	}

	return sectionSeo(url.pathname);
}

export function structuredDataForSeo(seo: PageSeo, canonicalUrl: string): StructuredData {
	const base = {
		'@context': 'https://schema.org',
		name: cleanText(seo.title.replace(/\s+[—|-]\s+Kiokun.*$/, '')),
		description: seo.description,
		url: canonicalUrl,
		inLanguage: 'en'
	};

	if (seo.canonicalPath === '/') {
		return {
			...base,
			'@type': 'WebSite',
			name: SITE_NAME,
			potentialAction: {
				'@type': 'SearchAction',
				target: {
					'@type': 'EntryPoint',
					urlTemplate: 'https://kiokun.com/search?q={search_term_string}'
				},
				'query-input': 'required name=search_term_string'
			}
		};
	}

	if (seo.og.kind === 'character' || seo.og.kind === 'word') {
		return {
			...base,
			'@type': 'WebPage',
			mainEntity: {
				'@type': 'DefinedTerm',
				name: seo.og.title,
				description: seo.og.subtitle || seo.description,
				inDefinedTermSet: {
					'@type': 'DefinedTermSet',
					name: 'Kiokun Chinese, Japanese & Korean Dictionary',
					url: 'https://kiokun.com/'
				}
			}
		};
	}

	if (seo.canonicalPath.startsWith('/blog/')) {
		return {
			...base,
			'@type': 'Article',
			headline: seo.og.title,
			author: { '@type': 'Organization', name: SITE_NAME },
			publisher: { '@type': 'Organization', name: SITE_NAME, url: 'https://kiokun.com/' }
		};
	}

	if (seo.og.kind === 'sentence' || seo.og.kind === 'reel') {
		return {
			...base,
			'@type': 'LearningResource',
			learningResourceType: seo.og.kind === 'sentence' ? 'Example sentence' : 'Interactive transcript',
			educationalUse: 'Language learning'
		};
	}

	return {
		...base,
		'@type': seo.canonicalPath.startsWith('/search') ? 'SearchResultsPage' : 'CollectionPage'
	};
}

export function ogImagePath(card: OgCardData): string {
	const params = new URLSearchParams({
		v: '2',
		kind: card.kind,
		title: truncate(card.title, 180)
	});
	if (card.eyebrow) params.set('eyebrow', truncate(card.eyebrow, 52));
	if (card.subtitle) params.set('subtitle', truncate(card.subtitle, 160));
	if (card.translation) params.set('translation', truncate(card.translation, 220));
	if (card.forms?.length) params.set('forms', card.forms.slice(0, 5).join('·'));
	if (card.definitions?.length) params.set('definitions', card.definitions.slice(0, 5).join('\u001f'));
	if (card.readings?.length) {
		params.set(
			'readings',
			card.readings
				.slice(0, 5)
				.map((reading) => `${reading.color}\u001e${reading.label}\u001e${reading.value}`)
				.join('\u001f')
		);
	}
	return `/api/og?${params.toString()}`;
}
