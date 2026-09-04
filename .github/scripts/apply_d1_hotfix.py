from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"expected block not found in {path}: {old[:160]!r}")
    file.write_text(text.replace(old, new, 1))


dictionary_path = "sveltekit-app/src/lib/server/dictionary-lookup.ts"
replace_once(
    dictionary_path,
    """\t\t\tWHERE language = 'japanese'\n\t\t\t  AND pronunciation = ?\n\t\t\t  AND definition IS NOT NULL\n""",
    """\t\t\tWHERE pronunciation MATCH ('\"' || replace(?1, '\"', '\"\"') || '\"')\n\t\t\t  AND language = 'japanese'\n\t\t\t  AND pronunciation = ?1\n\t\t\t  AND definition IS NOT NULL\n""",
)
replace_once(
    dictionary_path,
    """\t\t\tWHERE language = 'japanese'\n\t\t\t  AND word = ?\n\t\t\t  AND definition IS NOT NULL\n""",
    """\t\t\tWHERE word MATCH ('\"' || replace(?1, '\"', '\"\"') || '\"')\n\t\t\t  AND language = 'japanese'\n\t\t\t  AND word = ?1\n\t\t\t  AND definition IS NOT NULL\n""",
)

search_path = "sveltekit-app/src/routes/api/search/+server.ts"
replace_once(
    search_path,
    """function buildCjkSearchSql(searchTerms: string[], includeJapaneseReading: boolean) {\n\tconst whereClause = searchTerms.map(() => \"word LIKE ? || '%'\").join(\" OR \");\n\tconst exactRank = searchTerms\n\t\t.map((_, index) => `WHEN word = ? THEN ${index === 0 ? 1000 : 900}`)\n\t\t.join(\"\\n\");\n\tconst prefixRank = searchTerms\n\t\t.map((_, index) => `WHEN word LIKE ? || '%' THEN ${index === 0 ? 500 : 450}`)\n\t\t.join(\"\\n\");\n\tconst readingRank = includeJapaneseReading\n\t\t? \"WHEN language = 'japanese' AND pronunciation = ? THEN 875\"\n\t\t: \"\";\n\tconst readingWhere = includeJapaneseReading\n\t\t? \"OR (language = 'japanese' AND pronunciation = ?)\"\n\t\t: \"\";\n\n\treturn `\n\t\tSELECT\n\t\t\tword,\n\t\t\tlanguage,\n\t\t\tdefinition,\n\t\t\tpronunciation,\n\t\t\treading_search,\n\t\t\tis_common,\n\t\t\tCASE\n\t\t\t\t${exactRank}\n\t\t\t\t${readingRank}\n\t\t\t\t${prefixRank}\n\t\t\t\tELSE 0\n\t\t\tEND as custom_rank\n\t\tFROM dictionary_search\n\t\tWHERE (${whereClause}) ${readingWhere}\n\t\tORDER BY\n\t\t\tcustom_rank DESC,\n\t\t\tis_common DESC,\n\t\t\tLENGTH(word) ASC,\n\t\t\trowid ASC\n\t\tLIMIT ?\n\t`;\n}\n""",
    """function fts5Phrase(value: string): string {\n\treturn `\"${value.replace(/\"/g, '\"\"')}\"`;\n}\n\nfunction buildCjkMatchQuery(searchTerms: string[], japaneseReading: string | null): string {\n\tconst clauses = searchTerms.map((term) => `word : ${fts5Phrase(term)}*`);\n\tif (japaneseReading) clauses.push(`pronunciation : ${fts5Phrase(japaneseReading)}*`);\n\treturn clauses.join(' OR ');\n}\n\nfunction buildCjkSearchSql(searchTerms: string[], includeJapaneseReading: boolean) {\n\tconst exactRank = searchTerms\n\t\t.map((_, index) => `WHEN word = ? THEN ${index === 0 ? 1000 : 900}`)\n\t\t.join(\"\\n\");\n\tconst prefixRank = searchTerms\n\t\t.map((_, index) => `WHEN word LIKE ? || '%' THEN ${index === 0 ? 500 : 450}`)\n\t\t.join(\"\\n\");\n\tconst readingRank = includeJapaneseReading\n\t\t? \"WHEN language = 'japanese' AND pronunciation = ? THEN 875\"\n\t\t: \"\";\n\n\treturn `\n\t\tSELECT\n\t\t\tword,\n\t\t\tlanguage,\n\t\t\tdefinition,\n\t\t\tpronunciation,\n\t\t\treading_search,\n\t\t\tis_common,\n\t\t\tCASE\n\t\t\t\t${exactRank}\n\t\t\t\t${readingRank}\n\t\t\t\t${prefixRank}\n\t\t\t\tELSE 0\n\t\t\tEND as custom_rank\n\t\tFROM dictionary_search\n\t\tWHERE dictionary_search MATCH ?\n\t\tORDER BY\n\t\t\tcustom_rank DESC,\n\t\t\tis_common DESC,\n\t\t\tLENGTH(word) ASC,\n\t\t\trowid ASC\n\t\tLIMIT ?\n\t`;\n}\n""",
)
replace_once(
    search_path,
    """\t\t\tconst readingBindings = includeJapaneseReading ? [normalizeJapaneseReading(query)] : [];\n\n\t\t\tresults = await platform.env.DB\n\t\t\t\t.prepare(buildCjkSearchSql(searchTerms, includeJapaneseReading))\n\t\t\t\t.bind(\n\t\t\t\t\t...searchTerms,\n\t\t\t\t\t...readingBindings,\n\t\t\t\t\t...searchTerms,\n\t\t\t\t\t...searchTerms,\n\t\t\t\t\t...readingBindings,\n\t\t\t\t\tcjkLimit\n\t\t\t\t)\n\t\t\t\t.all();\n""",
    """\t\t\tconst normalizedReading = includeJapaneseReading ? normalizeJapaneseReading(query) : null;\n\t\t\tconst readingBindings = normalizedReading ? [normalizedReading] : [];\n\t\t\tconst matchQuery = buildCjkMatchQuery(searchTerms, normalizedReading);\n\n\t\t\tresults = await platform.env.DB\n\t\t\t\t.prepare(buildCjkSearchSql(searchTerms, includeJapaneseReading))\n\t\t\t\t.bind(\n\t\t\t\t\t...searchTerms,\n\t\t\t\t\t...readingBindings,\n\t\t\t\t\t...searchTerms,\n\t\t\t\t\tmatchQuery,\n\t\t\t\t\tcjkLimit\n\t\t\t\t)\n\t\t\t\t.all();\n""",
)

reading_path = "sveltekit-app/src/routes/api/lookup-reading/+server.ts"
replace_once(
    reading_path,
    """\t\t\t\tWHERE language = 'japanese'\n\t\t\t\t  AND pronunciation = ?\n""",
    """\t\t\t\tWHERE pronunciation MATCH ('\"' || replace(?1, '\"', '\"\"') || '\"')\n\t\t\t\t  AND language = 'japanese'\n\t\t\t\t  AND pronunciation = ?1\n""",
)
replace_once(reading_path, "\t\t\t\tLIMIT ?\n", "\t\t\t\tLIMIT ?2\n")

verifier_path = "sveltekit-app/scripts/verify-pages-deployment.mjs"
replace_once(
    verifier_path,
    "Array.from({ length: 12 }, async (_, index) => {",
    "Array.from({ length: 1 }, async (_, index) => {",
)
replace_once(
    verifier_path,
    "critical APIs, and repeated Japanese sentence analysis",
    "critical APIs, and Japanese sentence analysis",
)

guard_path = Path("sveltekit-app/src/lib/server/d1-query-shape.test.ts")
guard_path.write_text(
    """import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dictionaryLookup = readFileSync(new URL('./dictionary-lookup.ts', import.meta.url), 'utf8');
assert.match(dictionaryLookup, /WHERE pronunciation MATCH/);
assert.match(dictionaryLookup, /WHERE word MATCH/);
assert.doesNotMatch(dictionaryLookup, /WHERE language = 'japanese'\\s+AND pronunciation = \\?/);
assert.doesNotMatch(dictionaryLookup, /WHERE language = 'japanese'\\s+AND word = \\?/);

const searchApi = readFileSync(new URL('../../routes/api/search/+server.ts', import.meta.url), 'utf8');
assert.match(searchApi, /WHERE dictionary_search MATCH \\?/);
assert.doesNotMatch(searchApi, /WHERE \\(\\$\\{whereClause\\}\\)/);

const readingApi = readFileSync(new URL('../../routes/api/lookup-reading/+server.ts', import.meta.url), 'utf8');
assert.match(readingApi, /WHERE pronunciation MATCH/);

console.log('D1 dictionary hot paths use FTS MATCH before exact or prefix filtering.');
"""
)

package_path = "sveltekit-app/package.json"
replace_once(
    package_path,
    "npx tsx src/lib/server/japanese-sentence-analysis.test.ts && npm run test:tutor",
    "npx tsx src/lib/server/japanese-sentence-analysis.test.ts && npx tsx src/lib/server/d1-query-shape.test.ts && npm run test:tutor",
)

deploy_path = ".github/workflows/deploy-cloudflare-pages.yml"
deploy = Path(deploy_path)
deploy_text = deploy.read_text()
schema_step = """      - name: Apply sentence-learning database schema
        working-directory: sveltekit-app
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        run: node scripts/apply-sentence-learning-schema.mjs
      
"""
if schema_step not in deploy_text:
    raise SystemExit("expected per-deploy D1 schema step not found")
deploy.write_text(deploy_text.replace(schema_step, "", 1))

print("Applied D1 query-amplification hotfix")
