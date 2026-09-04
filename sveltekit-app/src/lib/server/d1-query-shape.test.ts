import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dictionaryLookup = readFileSync(new URL('./dictionary-lookup.ts', import.meta.url), 'utf8');
assert.match(dictionaryLookup, /WHERE pronunciation MATCH/);
assert.match(dictionaryLookup, /WHERE word MATCH/);
assert.doesNotMatch(dictionaryLookup, /WHERE language = 'japanese'\s+AND pronunciation = \?/);
assert.doesNotMatch(dictionaryLookup, /WHERE language = 'japanese'\s+AND word = \?/);

const searchApi = readFileSync(new URL('../../routes/api/search/+server.ts', import.meta.url), 'utf8');
assert.match(searchApi, /WHERE dictionary_search MATCH \?/);
assert.doesNotMatch(searchApi, /WHERE \(\$\{whereClause\}\)/);

const readingApi = readFileSync(new URL('../../routes/api/lookup-reading/+server.ts', import.meta.url), 'utf8');
assert.match(readingApi, /WHERE pronunciation MATCH/);

console.log('D1 dictionary hot paths use FTS MATCH before exact or prefix filtering.');
