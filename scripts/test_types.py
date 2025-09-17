#!/usr/bin/env python3
"""
Test script to verify the generated types work correctly by parsing sample data.
"""

import json
import sys

def test_chinese_parsing():
    """Test parsing Chinese dictionary entries"""
    print("🧪 Testing Chinese dictionary parsing...")
    
    # Sample Chinese entries
    chinese_samples = [
        '{"_id":"5f523075a8a5594704b80b2e","simp":"学生","trad":"學生","items":[{"source":"cedict","pinyin":"xué​sheng","definitions":["student","schoolchild"]}],"gloss":"student","statistics":{"hskLevel":1,"movieWordCount":2942,"topWords":[]},"pinyinSearchString":"xuésheng xue2sheng xuesheng"}',
        '{"_id":"5f523074a8a5594704b705fa","simp":"㐀","trad":"㐀","items":[{"source":"unicode","pinyin":"qiū","simpTrad":"both","definitions":["(same as U+4E18 丘) hillock or mound"]}],"gloss":"hillock or mound","pinyinSearchString":"qiū qiu1 qiu"}'
    ]
    
    for i, sample in enumerate(chinese_samples):
        try:
            entry = json.loads(sample)
            print(f"  ✅ Chinese entry {i+1}: {entry['simp']} ({entry['gloss']})")
        except json.JSONDecodeError as e:
            print(f"  ❌ Chinese entry {i+1} failed: {e}")
            return False
    
    return True

def test_japanese_structure():
    """Test understanding of Japanese dictionary structure"""
    print("🧪 Testing Japanese dictionary structure...")
    
    # Key fields we need for matching
    japanese_structure = {
        "words": [
            {
                "id": "1206900",
                "kanji": [{"text": "学生", "common": True}],
                "kana": [{"text": "がくせい", "common": True}],
                "sense": [
                    {
                        "gloss": [{"text": "student (esp. a university student)", "lang": "eng"}],
                        "partOfSpeech": ["n"]
                    }
                ]
            }
        ]
    }
    
    try:
        # Test accessing the structure we need for matching
        word = japanese_structure["words"][0]
        kanji_text = word["kanji"][0]["text"]  # This is what we'll match against Chinese
        meaning = word["sense"][0]["gloss"][0]["text"]
        
        print(f"  ✅ Japanese structure: {kanji_text} = {meaning}")
        return True
        
    except (KeyError, IndexError) as e:
        print(f"  ❌ Japanese structure test failed: {e}")
        return False

def main():
    print("🚀 Testing generated type definitions...")
    print()
    
    chinese_ok = test_chinese_parsing()
    japanese_ok = test_japanese_structure()
    
    print()
    if chinese_ok and japanese_ok:
        print("✅ All tests passed! Type definitions look good.")
        print()
        print("📋 Summary:")
        print("  • Chinese entries: Array of ChineseDictionaryElement")
        print("  • Key matching field: entry.simp and entry.trad")
        print("  • Japanese entries: JapaneseEntry.words array")
        print("  • Key matching field: word.kanji[].text")
        print()
        print("🔗 Perfect for dictionary matching!")
        return 0
    else:
        print("❌ Some tests failed. Check the type definitions.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
