import json

with open('data/jmdict-examples-eng-3.6.1.json', 'r') as f:
    data = json.load(f)

words = data.get('words', [])

# Find all unique tags
all_tags = set()
for word in words[:10000]:
    for kanji in word.get('kanji', []):
        all_tags.update(kanji.get('tags', []))
    for kana in word.get('kana', []):
        all_tags.update(kana.get('tags', []))

print('All unique tags found in first 10000 words:')
print(sorted(all_tags))
print()

# Check if there's a 'priorities' field or similar
sample = words[100] if len(words) > 100 else words[0]
print('Sample word structure:')
print(json.dumps(sample, indent=2, ensure_ascii=False)[:2000])

