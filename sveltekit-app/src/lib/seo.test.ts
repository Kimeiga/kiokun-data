import assert from 'node:assert/strict';
import { defaultSeoForUrl, ogImagePath, type OgCardData } from './seo';
import { parseOgCard, renderOgSvg } from './server/og-card';

const sentenceSeo = defaultSeoForUrl(
	new URL('https://kiokun.com/sentence?text=%E5%9C%B0%E5%9B%B3%E3%82%92%E8%A6%8B%E3%82%8B&lang=ja&en=look%20at%20a%20map&from=%E5%9C%96')
);
assert.equal(sentenceSeo.og.kind, 'sentence');
assert.equal(sentenceSeo.og.title, '地図を見る');
assert(!sentenceSeo.canonicalPath.includes('from='), 'transient navigation state must not enter canonicals');

const characterCard: OgCardData = {
	kind: 'character',
	eyebrow: 'Character dictionary',
	title: '圖',
	subtitle: 'map',
	forms: ['图', '図'],
	readings: [
		{ label: 'Mandarin', value: 'tú', color: 'pinyin' },
		{ label: 'Japanese on’yomi', value: 'ズ、ト', color: 'onyomi' }
	],
	definitions: ['picture', 'drawing']
};

const imageUrl = new URL(ogImagePath(characterCard), 'https://kiokun.com');
assert.equal(imageUrl.searchParams.get('v'), '1', 'OG cards must be versioned for immutable caching');
const roundTripped = parseOgCard(imageUrl.searchParams);
assert.deepEqual(roundTripped.forms, ['图', '図']);
assert.equal(roundTripped.readings?.[1]?.value, 'ズ、ト');

const svg = renderOgSvg({ ...roundTripped, title: '<圖 & map>' });
assert(svg.includes('width="1200"'));
assert(svg.includes('height="630"'));
assert(svg.includes('&lt;圖 &amp; map&gt;'));
assert(!svg.includes('<圖 & map>'), 'user-facing card text must be XML escaped');

const longWord = renderOgSvg({
	kind: 'word',
	title: '国際連合教育科学文化機関',
	subtitle: 'United Nations Educational, Scientific and Cultural Organization',
	readings: [{ label: 'Japanese', value: 'こくさいれんごうきょういくかがくぶんかきかん', color: 'onyomi' }],
	definitions: ['UNESCO']
});
assert(longWord.includes('font-size="76"'), 'long word titles should step down to a fitted size');

console.log('SEO and OG card tests passed.');
