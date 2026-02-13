#!/usr/bin/env python3
"""
Add Korean word frequency data to KRDICT term banks.

This script downloads Korean frequency data from hermitdave/FrequencyWords
and updates the score field (index 4) in KRDICT term bank files.

Uses lemmatization to match conjugated forms in frequency data to
dictionary base forms (e.g., 먹어 → 먹다, 예뻐 → 예쁘다).

The score represents frequency rank: lower rank = more common word.
A score of 0 means no frequency data available.

Output: Updated data/krdict-en/term_bank_*.json files
"""

import json
import re
import urllib.request
from pathlib import Path


# Paths
KRDICT_DIR = Path("data/krdict-en")
FREQUENCY_URL = "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2016/ko/ko_50k.txt"
FREQUENCY_CACHE = Path("data/korean_frequency_50k.txt")


# Korean verb/adjective conjugation endings (most common patterns)
# These are stripped to find potential base forms
VERB_ENDINGS = [
    # Polite/formal endings
    '습니다', '습니까', '세요', '셔요', '시오', '십시오',
    '었습니다', '았습니다', '였습니다', '겠습니다',
    # Casual endings
    '어요', '아요', '여요', '에요', '예요',
    '었어요', '았어요', '였어요',
    '어', '아', '여', '었어', '았어', '였어',
    # Connective endings
    '으면', '면', '으니', '니', '으니까', '니까',
    '어서', '아서', '여서', '으려고', '려고',
    '으면서', '면서', '으며', '며',
    '고', '지', '는데', '은데', 'ㄴ데',
    # Modifier endings
    '는', '은', 'ㄴ', '을', 'ㄹ', '던',
    # Other common endings
    '겠어', '겠어요', '겠다', '었다', '았다', '였다',
    '지만', '지요', '죠', '네', '네요', '군', '군요',
    '자', '자고', '래', '래요',
]

# Irregular verb stem changes (common patterns)
IRREGULAR_MAPPINGS = {
    # ㅂ irregular: 돕 → 도와, 춥 → 추워
    '워': '우',  # 추워 → 추우 → 춥다
    '와': '오',  # 도와 → 도오 → 돕다
    # ㄷ irregular: 듣 → 들어
    '들어': '듣',
    '걸어': '걷',
    # ㅅ irregular: 짓 → 지어
    '지어': '짓',
    '나아': '낫',
    # ㅎ irregular: 빨갛 → 빨개
    '래': '랗',
    '레': '렇',
    # ㄹ irregular: 살 → 사는
    # 르 irregular: 모르 → 몰라
    '몰라': '모르',
    '빨라': '빠르',
    '골라': '고르',
}


def download_frequency_data():
    """Download Korean frequency data if not cached."""
    if FREQUENCY_CACHE.exists():
        print(f"  📁 Using cached frequency data: {FREQUENCY_CACHE}")
        with open(FREQUENCY_CACHE, 'r', encoding='utf-8') as f:
            return f.read()

    print(f"  📥 Downloading frequency data from {FREQUENCY_URL}...")
    with urllib.request.urlopen(FREQUENCY_URL) as response:
        data = response.read().decode('utf-8')

    # Cache the data
    FREQUENCY_CACHE.parent.mkdir(parents=True, exist_ok=True)
    with open(FREQUENCY_CACHE, 'w', encoding='utf-8') as f:
        f.write(data)
    print(f"  💾 Cached to: {FREQUENCY_CACHE}")

    return data


def lemmatize_to_base_forms(word):
    """
    Generate possible dictionary base forms from a conjugated word.
    Returns a list of potential base forms (verb/adj end in 다, 하다).
    """
    candidates = [word]  # Original word is always a candidate

    # Try stripping each ending
    for ending in sorted(VERB_ENDINGS, key=len, reverse=True):
        if word.endswith(ending) and len(word) > len(ending):
            stem = word[:-len(ending)]
            if len(stem) >= 1:
                # Add basic forms
                candidates.append(stem + '다')
                candidates.append(stem + '하다')

                # Handle vowel contractions (가 → 가다, 서 → 서다)
                if stem:
                    candidates.append(stem + '다')

                # Try adding back consonants that may have been dropped
                # ㄹ drop: 사는 → 살다
                candidates.append(stem + 'ㄹ다')
                candidates.append(stem + '르다')

    # Handle 아/어 endings specifically (very common)
    if word.endswith('아') or word.endswith('어') or word.endswith('여'):
        stem = word[:-1]
        if stem:
            candidates.append(stem + '다')
            # ㅏ/ㅓ vowel harmony
            candidates.append(stem + '으다')

    # Handle irregular patterns
    for pattern, replacement in IRREGULAR_MAPPINGS.items():
        if word.endswith(pattern):
            stem = word[:-len(pattern)] + replacement
            candidates.append(stem + '다')

    # Handle 해 → 하다 pattern (very common)
    if '해' in word:
        candidates.append(word.replace('해', '하') + '다')
        candidates.append(word.replace('해', '하다'))

    # Handle 해요, 했어, 합니다 etc → 하다
    if word.endswith('해') or word.endswith('해요') or word.endswith('했어') or word.endswith('합니다'):
        # Extract the noun part before 하다
        for suffix in ['합니다', '했어요', '했어', '해요', '해']:
            if word.endswith(suffix):
                stem = word[:-len(suffix)]
                if stem:
                    candidates.append(stem + '하다')
                else:
                    candidates.append('하다')
                break

    return list(set(candidates))


def parse_frequency_data(raw_data):
    """Parse frequency data into word -> rank mapping with lemmatization.

    Format: word frequency_count (space-separated)
    We convert counts to ranks (1 = most common).

    For each conjugated form, we also map potential base forms to the same rank.
    """
    freq_map = {}
    lemma_map = {}  # base_form -> best_rank
    rank = 1

    for line in raw_data.strip().split('\n'):
        if not line.strip():
            continue
        parts = line.split()
        if len(parts) >= 2:
            word = parts[0]
            # Skip English words and special characters
            if word.isascii():
                continue

            # Direct match
            freq_map[word] = rank

            # Generate lemmatized forms
            for base_form in lemmatize_to_base_forms(word):
                if base_form not in lemma_map or lemma_map[base_form] > rank:
                    lemma_map[base_form] = rank

            rank += 1

    # Merge lemma_map into freq_map (use best rank)
    for base_form, base_rank in lemma_map.items():
        if base_form not in freq_map or freq_map[base_form] > base_rank:
            freq_map[base_form] = base_rank

    return freq_map


def update_term_bank(file_path, freq_map):
    """Update frequency scores in a term bank file."""
    with open(file_path, 'r', encoding='utf-8') as f:
        entries = json.load(f)

    updated = 0
    for entry in entries:
        word = entry[0]  # Korean word at index 0
        if word in freq_map:
            # Score is at index 4
            # Use negative rank so more common = higher score (Yomitan convention)
            entry[4] = -freq_map[word]
            updated += 1

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(entries, f, ensure_ascii=False)

    return len(entries), updated


def main():
    print("📊 Adding Korean frequency data to KRDICT (with lemmatization)...\n")

    # Download and parse frequency data
    print("📚 Loading frequency data...")
    raw_data = download_frequency_data()
    freq_map = parse_frequency_data(raw_data)
    print(f"  ✅ Loaded {len(freq_map)} word forms (including lemmatized bases)\n")

    # Process all term bank files
    print("📝 Updating term bank files...")
    total_entries = 0
    total_updated = 0

    term_banks = sorted(KRDICT_DIR.glob("term_bank_*.json"))
    for term_bank in term_banks:
        entries, updated = update_term_bank(term_bank, freq_map)
        total_entries += entries
        total_updated += updated
        print(f"  📄 {term_bank.name}: {updated}/{entries} entries updated")

    print(f"\n✅ Complete!")
    print(f"   Total entries: {total_entries}")
    print(f"   Updated with frequency: {total_updated} ({100*total_updated/total_entries:.1f}%)")
    print(f"   No frequency data: {total_entries - total_updated}")


if __name__ == '__main__':
    main()
