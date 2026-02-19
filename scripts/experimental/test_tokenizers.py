#!/usr/bin/env python3
"""Compare Japanese tokenizers on sample transcript."""

from sudachipy import dictionary, tokenizer
import fugashi

# Sample sentence from the video (with Kansai dialect!)
text = "私は妹大抵のことは許されるけどお姉ちゃんはダメ"

print("=" * 70)
print("SAMPLE:", text)
print("=" * 70)

# SudachiPy - Mode C (shortest units, best for dictionary lookup)
print("\n📘 SUDACHIPY (Mode C - shortest units):")
tokenizer_obj = dictionary.Dictionary().create()
mode = tokenizer.Tokenizer.SplitMode.C
tokens = tokenizer_obj.tokenize(text, mode)
for token in tokens:
    surface = token.surface()
    dict_form = token.dictionary_form()
    pos = token.part_of_speech()[0]
    print(f"  {surface:8} → {dict_form:8} ({pos})")

# SudachiPy - Mode A (longest units)
print("\n📗 SUDACHIPY (Mode A - longest units):")
mode = tokenizer.Tokenizer.SplitMode.A
tokens = tokenizer_obj.tokenize(text, mode)
for token in tokens:
    surface = token.surface()
    dict_form = token.dictionary_form()
    pos = token.part_of_speech()[0]
    print(f"  {surface:8} → {dict_form:8} ({pos})")

# MeCab/Fugashi
print("\n📙 MECAB (fugashi):")
tagger = fugashi.Tagger()
for word in tagger(text):
    surface = word.surface
    lemma = word.feature.lemma or word.surface
    pos = word.feature.pos1
    print(f"  {surface:8} → {lemma:8} ({pos})")

print("\n" + "=" * 70)
print("RECOMMENDATION: SudachiPy Mode C for dictionary matching")
print("  - Gives normalized forms (食べてる → 食べる)")
print("  - Modern dictionary with slang/casual words")
print("  - Handles Kansai dialect well")
print("=" * 70)

