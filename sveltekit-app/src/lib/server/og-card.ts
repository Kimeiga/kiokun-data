import type { OgCardData, OgReading } from '../seo';

const WIDTH = 1200;
const HEIGHT = 630;
const COLORS: Record<OgReading['color'], string> = {
	pinyin: '#34d399',
	cantonese: '#fbbf24',
	onyomi: '#f87171',
	kunyomi: '#34d399',
	korean: '#c084fc',
	neutral: '#d4d4d4'
};

function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

function graphemes(value: string): string[] {
	try {
		const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
		return [...segmenter.segment(value)].map((item) => item.segment);
	} catch {
		return [...value];
	}
}

function glyphUnits(character: string): number {
	if (/\s/.test(character)) return 0.32;
	if (/[\u0000-\u024f]/.test(character)) return 0.56;
	return 1;
}

function textUnits(value: string): number {
	return graphemes(value).reduce((total, character) => total + glyphUnits(character), 0);
}

function fitFontSize(value: string, maxWidth: number, preferred: number, minimum: number): number {
	const units = Math.max(1, textUnits(value));
	return Math.max(minimum, Math.min(preferred, Math.floor(maxWidth / units)));
}

function wrapText(value: string, maxUnits: number, maxLines: number): string[] {
	const input = value.trim();
	if (!input) return [];
	const chars = graphemes(input);
	const lines: string[] = [];
	let cursor = 0;

	while (cursor < chars.length && lines.length < maxLines) {
		let end = cursor;
		let units = 0;
		let lastSpace = -1;

		while (end < chars.length) {
			const nextUnits = units + glyphUnits(chars[end]);
			if (end > cursor && nextUnits > maxUnits) break;
			units = nextUnits;
			if (/\s/.test(chars[end])) lastSpace = end;
			end += 1;
		}

		if (end >= chars.length) {
			lines.push(chars.slice(cursor).join('').trim());
			cursor = chars.length;
			break;
		}

		const breakAt = lastSpace >= cursor ? lastSpace + 1 : end;
		const line = chars.slice(cursor, breakAt).join('').trim();
		if (line) lines.push(line);
		cursor = Math.max(breakAt, cursor + 1);
		while (cursor < chars.length && /\s/.test(chars[cursor])) cursor += 1;
	}

	if (cursor < chars.length && lines.length) {
		let finalLine = lines[lines.length - 1].replace(/[.,;:!?，。；：！？…]*$/, '').trimEnd();
		while (finalLine.length > 1 && textUnits(`${finalLine}…`) > maxUnits) {
			finalLine = graphemes(finalLine).slice(0, -1).join('').trimEnd();
		}
		lines[lines.length - 1] = `${finalLine}…`;
	}
	return lines;
}

function textLines(
	lines: string[],
	x: number,
	startY: number,
	size: number,
	lineHeight: number,
	color = '#f5f5f5',
	weight = 600,
	anchor: 'start' | 'middle' = 'start'
): string {
	return lines
		.map(
			(line, index) =>
				`<text x="${x}" y="${startY + index * lineHeight}" fill="${color}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${escapeXml(line)}</text>`
		)
		.join('');
}

function brand(showLanguageTagline = true): string {
	return `
		<g transform="translate(64 552)">
			<rect width="42" height="42" rx="12" fill="url(#brandGradient)"/>
			<text x="21" y="30" fill="#fff" font-size="25" font-weight="700" text-anchor="middle">憶</text>
			<text x="58" y="29" fill="#f5f5f5" font-size="24" font-weight="700">Kiokun</text>
			${showLanguageTagline
				? '<text x="158" y="28" fill="#737373" font-size="19">Chinese · Japanese · Korean</text>'
				: '<text x="1072" y="29" fill="#8a8a8a" font-size="21" font-weight="500" text-anchor="end">kiokun.com</text>'}
		</g>
	`;
}

function base(content: string, showLanguageTagline = true): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" font-family="'Noto Sans', 'Noto Sans SC', 'Noto Sans KR', sans-serif">
		<defs>
			<linearGradient id="brandGradient" x1="0" y1="0" x2="1" y2="1">
				<stop offset="0" stop-color="#c084fc"/>
				<stop offset="0.5" stop-color="#fb7185"/>
				<stop offset="1" stop-color="#fb923c"/>
			</linearGradient>
		</defs>
		<rect width="1200" height="630" fill="#050505"/>
		<rect x="24" y="24" width="1152" height="582" rx="30" fill="#0a0a0a" stroke="#292929" stroke-width="2"/>
		${brand(showLanguageTagline)}
		${content}
	</svg>`;
}

function readingRail(readings: OgReading[], x: number, y: number, maxWidth: number): string {
	if (!readings.length) return '';
	let cursorX = x;
	let cursorY = y;
	const pieces: string[] = [];

	for (const reading of readings.slice(0, 5)) {
		const label = readingLabel(reading.label);
		const rawValue = reading.value.length > 32 ? `${reading.value.slice(0, 31)}…` : reading.value;
		const value = rawValue;
		const width = Math.min(maxWidth, Math.max(116, textUnits(value) * 22 + 32));
		if (cursorX > x && cursorX + width > x + maxWidth) {
			cursorX = x;
			cursorY += 72;
		}
		pieces.push(`
			<g transform="translate(${cursorX} ${cursorY})">
				<text x="0" y="0" fill="#737373" font-size="16" font-weight="600">${escapeXml(label)}</text>
				<text x="0" y="30" fill="${COLORS[reading.color]}" font-size="25" font-weight="600">${escapeXml(value)}</text>
			</g>
		`);
		cursorX += width + 22;
	}
	return pieces.join('');
}

function definitionList(definitions: string[], x: number, y: number, width: number, maxItems = 3): string {
	const pieces: string[] = [];
	let cursorY = y;
	for (const definition of definitions.slice(0, maxItems)) {
		const lines = wrapText(definition, width / 25, 2);
		if (!lines.length || cursorY > 510) continue;
		pieces.push(`<circle cx="${x + 5}" cy="${cursorY - 7}" r="4" fill="#34d399"/>`);
		pieces.push(textLines(lines, x + 23, cursorY, 24, 31, '#d4d4d4', 400));
		cursorY += lines.length * 31 + 13;
	}
	return pieces.join('');
}

function readingLabel(label: string): string {
	return label.includes('on’yomi')
		? 'ON’YOMI'
		: label.includes('kun’yomi')
			? 'KUN’YOMI'
			: label.replace('Japanese ', '').toUpperCase();
}

function wordReadingStack(readings: OgReading[], x: number, y: number, maxWidth: number): string {
	const visible = readings.slice(0, 3);
	const maxValueLines = visible.length >= 3 ? 1 : 2;
	let cursorY = y;
	const pieces: string[] = [];

	for (const reading of visible) {
		const valueGraphemes = graphemes(reading.value);
		const value =
			valueGraphemes.length > 52 ? `${valueGraphemes.slice(0, 51).join('')}…` : reading.value;
		const valueSize = 30;
		const lines = wrapText(value, maxWidth / valueSize, maxValueLines);
		if (!lines.length) continue;
		pieces.push(
			`<text x="${x}" y="${cursorY}" fill="#8a8a8a" font-size="18" font-weight="650" letter-spacing="1">${escapeXml(readingLabel(reading.label))}</text>`
		);
		pieces.push(textLines(lines, x, cursorY + 31, valueSize, 34, COLORS[reading.color], 600));
		cursorY += 39 + lines.length * 34;
	}
	return pieces.join('');
}

function meaningKey(value: string): string {
	return value
		.toLocaleLowerCase('en')
		.replace(/^(?:a|an|the|to)\s+/, '')
		.replace(/[^\p{L}\p{N}]+/gu, '');
}

function wordMeanings(card: OgCardData, x: number, y: number, width: number): string {
	const meanings: string[] = [];
	const seen = new Set<string>();
	for (const meaning of [card.subtitle || '', ...(card.definitions || [])]) {
		const trimmed = meaning.trim();
		const key = meaningKey(trimmed);
		if (!trimmed || !key || seen.has(key)) continue;
		seen.add(key);
		meanings.push(trimmed);
	}
	if (!meanings.length) return '';

	const primary = meanings[0];
	const primaryUnits = textUnits(primary);
	const primaryPreferred = primaryUnits <= 16 ? 52 : primaryUnits <= 30 ? 44 : 38;
	const primarySize = Math.max(
		34,
		Math.min(primaryPreferred, Math.floor((width * 5) / Math.max(1, primaryUnits)))
	);
	const primaryLines = wrapText(primary, width / primarySize, 5);
	const primaryLineHeight = Math.round(primarySize * 1.12);
	const primaryEndY = y + Math.max(0, primaryLines.length - 1) * primaryLineHeight;
	const secondaryStartY = primaryEndY + 67;
	const secondarySize = 28;
	const secondaryLineHeight = 36;
	let cursorY = secondaryStartY;
	const pieces = [textLines(primaryLines, x, y, primarySize, primaryLineHeight, '#34d399', 650)];

	for (const meaning of meanings.slice(1, 4)) {
		const availableLines = Math.max(1, Math.min(5, Math.floor((500 - cursorY) / secondaryLineHeight) + 1));
		const lines = wrapText(meaning, (width - 24) / secondarySize, availableLines);
		if (!lines.length || cursorY > 500) continue;
		pieces.push(`<circle cx="${x + 5}" cy="${cursorY - 8}" r="4" fill="#34d399"/>`);
		pieces.push(textLines(lines, x + 24, cursorY, secondarySize, secondaryLineHeight, '#d4d4d4', 450));
		cursorY += lines.length * secondaryLineHeight + 24;
	}

	return pieces.join('');
}

function characterCard(card: OgCardData): string {
	const titleSize = fitFontSize(card.title, 294, 260, 150);
	const subtitle = card.subtitle || card.definitions?.[0] || '';
	const subtitleSize = fitFontSize(subtitle, 650, 68, 42);
	const forms = (card.forms || []).slice(0, 5);

	return base(`
		<rect x="56" y="64" width="370" height="458" rx="28" fill="#111" stroke="#303030" stroke-width="2"/>
		<text x="241" y="${304 + titleSize * 0.12}" fill="#f5f5f5" font-size="${titleSize}" font-weight="600" text-anchor="middle">${escapeXml(card.title)}</text>
		${forms.length ? `<text x="241" y="474" fill="#a3a3a3" font-size="34" text-anchor="middle">${escapeXml(forms.join(' · '))}</text>` : ''}

		<text x="480" y="88" fill="#737373" font-size="18" font-weight="700" letter-spacing="2">${escapeXml((card.eyebrow || 'CHARACTER DICTIONARY').toUpperCase())}</text>
		${textLines(wrapText(subtitle, 650 / subtitleSize, 2), 480, 164, subtitleSize, Math.round(subtitleSize * 1.08), '#34d399', 700)}
		${readingRail(card.readings || [], 480, 282, 640)}
		${definitionList(card.definitions || [], 480, 440, 620, 2)}
	`);
}

function wordCard(card: OgCardData): string {
	const leftX = 64;
	const leftWidth = 620;
	const rightX = 758;
	const rightWidth = 378;
	const titleChars = graphemes(card.title).length;
	const preferred = titleChars <= 4 ? 110 : titleChars <= 8 ? 96 : titleChars <= 14 ? 76 : 60;
	const maxTitleLines = titleChars <= 14 ? 2 : 3;
	const titleSize = Math.max(
		48,
		Math.min(preferred, Math.floor((leftWidth * maxTitleLines) / Math.max(1, textUnits(card.title))))
	);
	const titleLines = wrapText(card.title, leftWidth / titleSize, maxTitleLines);
	const titleLineHeight = Math.round(titleSize * 1.04);
	const titleStartY = titleLines.length === 1 ? 180 : titleLines.length === 2 ? 138 : 104;
	const titleEndY = titleStartY + (titleLines.length - 1) * titleLineHeight;
	const readingY = Math.max(282, titleEndY + 62);

	return base(`
		<line x1="716" y1="64" x2="716" y2="510" stroke="#292929" stroke-width="1"/>
		${textLines(titleLines, leftX, titleStartY, titleSize, titleLineHeight, '#f5f5f5', 650)}
		${wordReadingStack(card.readings || [], leftX, readingY, leftWidth)}
		${wordMeanings(card, rightX, 124, rightWidth)}
	`, false);
}

function sentenceCard(card: OgCardData): string {
	const titleSize = fitFontSize(card.title, 1060, 66, 42);
	const lines = wrapText(card.title, 1060 / titleSize, 4);
	const translationY = 152 + lines.length * Math.round(titleSize * 1.18);
	const translation = card.translation || card.subtitle || '';
	return base(`
		<text x="64" y="82" fill="#34d399" font-size="18" font-weight="700" letter-spacing="2">${escapeXml((card.eyebrow || 'SENTENCE').toUpperCase())}</text>
		${textLines(lines, 64, 154, titleSize, Math.round(titleSize * 1.18), '#f5f5f5', 600)}
		${translation ? textLines(wrapText(translation, 1060 / 31, 3), 64, Math.min(440, translationY + 24), 31, 42, '#a3a3a3', 400) : ''}
	`);
}

function reelCard(card: OgCardData): string {
	const title = card.title || 'Learn from a real conversation';
	return base(`
		<circle cx="136" cy="156" r="58" fill="#34d399"/>
		<path d="M122 122 L122 190 L172 156 Z" fill="#050505"/>
		<text x="224" y="94" fill="#737373" font-size="18" font-weight="700" letter-spacing="2">${escapeXml((card.eyebrow || 'LANGUAGE REEL').toUpperCase())}</text>
		${textLines(wrapText(title, 900 / 58, 4), 224, 166, 58, 70, '#f5f5f5', 650)}
		${card.subtitle ? textLines(wrapText(card.subtitle, 1050 / 28, 2), 64, 466, 28, 38, '#a3a3a3', 400) : ''}
	`);
}

function sectionCard(card: OgCardData): string {
	const size = fitFontSize(card.title, 1060, 82, 52);
	const lines = wrapText(card.title, 1060 / size, 3);
	return base(`
		<rect x="64" y="72" width="72" height="8" rx="4" fill="#34d399"/>
		<text x="64" y="124" fill="#737373" font-size="18" font-weight="700" letter-spacing="2">${escapeXml((card.eyebrow || 'KIOKUN').toUpperCase())}</text>
		${textLines(lines, 64, 220, size, Math.round(size * 1.12), '#f5f5f5', 650)}
		${card.subtitle ? textLines(wrapText(card.subtitle, 1040 / 30, 3), 64, 430, 30, 41, '#a3a3a3', 400) : ''}
	`);
}

export function renderOgSvg(card: OgCardData): string {
	if (card.kind === 'character') return characterCard(card);
	if (card.kind === 'word') return wordCard(card);
	if (card.kind === 'sentence') return sentenceCard(card);
	if (card.kind === 'reel') return reelCard(card);
	return sectionCard(card);
}

export function parseOgCard(searchParams: URLSearchParams): OgCardData {
	const kind = searchParams.get('kind');
	const safeKind: OgCardData['kind'] =
		kind === 'character' || kind === 'word' || kind === 'sentence' || kind === 'reel'
			? kind
			: 'section';
	const readings = (searchParams.get('readings') || '')
		.split('\u001f')
		.map((item) => {
			const [color, label, value] = item.split('\u001e');
			if (!value) return null;
			const safeColor = color in COLORS ? (color as OgReading['color']) : 'neutral';
			return { color: safeColor, label, value };
		})
		.filter((reading): reading is OgReading => Boolean(reading));

	return {
		kind: safeKind,
		title: (searchParams.get('title') || 'Kiokun').slice(0, 180),
		eyebrow: searchParams.get('eyebrow')?.slice(0, 52),
		subtitle: searchParams.get('subtitle')?.slice(0, 160),
		translation: searchParams.get('translation')?.slice(0, 220),
		forms: (searchParams.get('forms') || '').split('·').filter(Boolean).slice(0, 5),
		definitions: (searchParams.get('definitions') || '').split('\u001f').filter(Boolean).slice(0, 5),
		readings
	};
}
