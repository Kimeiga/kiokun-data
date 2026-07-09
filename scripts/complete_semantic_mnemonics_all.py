#!/usr/bin/env python3
"""Build a complete best-available semantic mnemonic artifact.

This merges:
- the reviewed 1000-card Gemini 3.5 artifact,
- the paid 10k Gemini artifact where it looks clean,
- local deterministic completions for missing or obviously awkward cards.

The local completions are intentionally conservative: they preserve Kiokun's
canonical character/gloss pairs and prioritize validity/coverage over cleverness.
"""

from __future__ import annotations

import json
import re
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import semantic_mnemonics as sm


ROOT = Path(__file__).resolve().parents[1]
RESEARCH_DIR = ROOT / "sveltekit-app" / "static" / "research" / "mnemonics"
GAME_DATA_DIR = ROOT / "sveltekit-app" / "static" / "game_data"

PAID_10K_PATH = RESEARCH_DIR / "semantic_mnemonics_10000.json"
REVIEWED_1000_PATH = RESEARCH_DIR / "semantic_mnemonics_1000_refined_pairs_gemini35.json"
OUTPUT_PATH = RESEARCH_DIR / "semantic_mnemonics_all_best_available.json"
EVAL_PATH = RESEARCH_DIR / "semantic_mnemonics_all_best_available_eval.json"


AWKWARD_RE = re.compile(
    r"\b(?:"
    r"the character combines|this character|component|radical|represents|depicts|"
    r"in one visual image|one visual image|"
    r"perfect|hardworking|wise|brave|lazy|properly|exactly|sacred|mysterious|"
    r"magical|ghostly|terrifying|creepy|spies|spy|criminal|prisoner|slave|"
    r"butcher|battlefield|enemy|warrior|commander|soldier|"
    r"gouge out an eye|gasp as if|dim-witted traveler|natural instinct|"
    r"gold starts to lose its luster|"
    r"</?b>|<[^>]+>"
    r")\b",
    re.IGNORECASE,
)

GENERIC_MNEMONIC_RE = re.compile(
    r"\b(?:in one [a-z -]*image|reveals|points toward)\b",
    re.IGNORECASE,
)

MANUAL_QUALITY_SOURCE = "codex_manual_quality_patch_2026_07_08"

BAD_STYLE_RE = re.compile(
    r"\b(?:serves as|symbolizes|teaches us|reminds us|society|polite|poor|"
    r"absolute|supreme|fierce|sneaky|corrupt|malicious)\b",
    re.IGNORECASE,
)

LOCAL_GLOSS_OVERRIDES = {
    "买": "buy",
    "爱": "love",
    "訁": "speech",
    "髟": "long hair",
    "女": "woman",
    "𥩲": "raise",
    "爫": "reaching hand",
    "⺤": "grasping hand",
    "亽": "food cover",
    "车": "vehicle",
    "幺": "thread",
    "乛": "hook mark",
    "乚": "turning hook",
    "曰": "speech",
    "犬": "dog",
    "头": "head",
    "⻌": "movement",
    "丨": "line",
    "㐬": "stream",
    "𫶧": "flow tail",
    "氏": "clan",
    "旡": "choked breath",
    "雚": "stork",
    "亀": "turtle",
    "龟": "turtle",
    "臤": "firm grip",
    "𰀡": "firm grip",
    "钅": "metal",
    "纟": "silk",
    "娲": "Nuwa",
    "媧": "Nuwa",
    "叱": "scold",
    "𠮟": "scold",
    "澪": "water route",
    "椙": "Japanese cedar",
    "礒": "rocky shore",
    "笘": "writing slate",
    "鯵": "horse mackerel",
    "鰺": "horse mackerel",
    "鲹": "horse mackerel",
    "梛": "nagi tree",
    "俥": "rickshaw",
    "溂": "lively",
    "鳰": "grebe",
    "﨟": "court rank",
    "欌": "cabinet",
    "慓": "nimble",
    "摋": "strike",
    "蹸": "trample",
    "鐚": "small coin",
    "铁": "iron",
    "錬": "refine",
    "笒": "bamboo flute",
    "倧": "progenitor",
    "栮": "mushroom",
    "堗": "heated floor",
    "辡": "dispute",
    "㚻": "sexual misconduct",
    "㓺": "cut punishment",
    "㔀": "branding punishment",
    "黥": "tattoo punishment",
    "津": "ferry",
    "犯": "offense",
    "温": "warm",
    "焼": "roast",
    "陽": "sunlight",
    "整": "arrange",
    "跡": "trace",
    "阪": "slope",
    "边": "edge",
    "图": "map",
    "圖": "map",
    "図": "map",
    "臺": "platform",
    "问": "ask",
    "東": "east",
    "东": "east",
}


EXTRA_LEARNER_TARGETS: dict[str, dict[str, str]] = {
    "𠮟": {
        "evidence": "Joyo exact glyph and JPDB top 100k word coverage",
        "alias_of": "叱",
        "alias_reason": "Unicode Z-variant of 叱; keep exact glyph for Japanese learner searches",
    },
    "澪": {"evidence": "JPDB top 100k and jinmeiyo/name coverage"},
    "椙": {"evidence": "KANJIDIC frequency-ranked exact glyph coverage"},
    "礒": {
        "evidence": "KANJIDIC frequency-ranked exact glyph coverage",
        "alias_of": "磯",
        "alias_reason": "Japanese place/name spelling near 磯; keep exact glyph because shape differs",
    },
    "笘": {"evidence": "KANJIDIC frequency-ranked exact glyph coverage"},
    "鯵": {
        "evidence": "JPDB top 100k exact glyph coverage",
        "alias_of": "鰺",
        "alias_reason": "Common Japanese spelling variant of 鰺; keep exact glyph for learner searches",
    },
    "梛": {"evidence": "jinmeiyo/name coverage"},
    "俥": {"evidence": "JPDB top 100k exact glyph coverage"},
    "溂": {"evidence": "JPDB top 100k exact glyph coverage, especially 溌溂"},
    "鳰": {"evidence": "JPDB top 100k exact glyph coverage"},
    "欌": {"evidence": "KRDICT Hanja headword coverage, especially 欌籠 and 陳列欌"},
    "慓": {"evidence": "KRDICT Hanja headword coverage in 慓毒 compounds"},
    "摋": {"evidence": "KRDICT Hanja variant coverage in 抹殺/抹摋 compounds"},
    "蹸": {"evidence": "KRDICT Hanja variant coverage in 蹂躪/蹂躙/蹂蹸 compounds"},
    "笒": {"evidence": "KRDICT Hanja headword coverage in 大笒"},
    "倧": {"evidence": "KRDICT Hanja headword coverage in 大倧敎"},
    "栮": {"evidence": "KRDICT Hanja headword coverage in 洋松栮"},
    "堗": {"evidence": "KRDICT Hanja variant coverage in 溫突/溫堗"},
}


VARIANT_ALIAS_TARGETS: dict[str, dict[str, str]] = {
    "﨑": {"alias_of": "崎", "reason": "Japanese compatibility glyph used in names"},
    "﨟": {
        "alias_of": "臘",
        "meaning": "court rank",
        "reason": "Japanese compatibility glyph seen in JPDB words such as 上﨟 and 中﨟",
    },
    "侮": {"alias_of": "侮", "reason": "Japanese compatibility glyph"},
    "勤": {"alias_of": "勤", "reason": "Japanese compatibility glyph"},
    "卑": {"alias_of": "卑", "reason": "Japanese compatibility glyph"},
    "墨": {"alias_of": "墨", "reason": "Japanese compatibility glyph"},
    "層": {"alias_of": "層", "reason": "Japanese compatibility glyph"},
    "悔": {"alias_of": "悔", "reason": "Japanese compatibility glyph"},
    "梅": {"alias_of": "梅", "reason": "Japanese compatibility glyph"},
    "煮": {"alias_of": "煮", "reason": "Japanese compatibility glyph"},
    "琢": {"alias_of": "琢", "reason": "Japanese compatibility glyph"},
    "碑": {"alias_of": "碑", "reason": "Japanese compatibility glyph"},
    "祐": {"alias_of": "祐", "reason": "Japanese compatibility glyph"},
    "祖": {"alias_of": "祖", "reason": "Japanese compatibility glyph"},
    "禍": {"alias_of": "禍", "reason": "Japanese compatibility glyph"},
    "穀": {"alias_of": "穀", "reason": "Japanese compatibility glyph"},
    "練": {"alias_of": "練", "reason": "Japanese compatibility glyph"},
    "署": {"alias_of": "署", "reason": "Japanese compatibility glyph"},
    "者": {"alias_of": "者", "reason": "Japanese compatibility glyph"},
    "臭": {"alias_of": "臭", "reason": "Japanese compatibility glyph"},
    "賓": {"alias_of": "賓", "reason": "Japanese compatibility glyph"},
    "贈": {"alias_of": "贈", "reason": "Japanese compatibility glyph"},
    "響": {"alias_of": "響", "reason": "Japanese compatibility glyph"},
}


AUTO_COMPATIBILITY_ALIAS_RANGES = (
    (0xF900, 0xFAFF),
    (0x2F800, 0x2FA1F),
)


TARGETED_COMPONENT_OVERRIDES: dict[str, list[dict[str, str]]] = {
    # These are learner-facing visual repairs, not historical-etymology swaps.
    # The default source remains IDS. Entries here either expand an IDS component
    # into its IDS children, repair an unresolved IDS entity, or avoid surfacing
    # a likely-missing glyph where a render-safe visual equivalent is clearer.
    "㐬": [
        {"character": "𠫓", "gloss": "newborn"},
        {"character": "川", "gloss": "river"},
    ],
    "㠩": [
        {"character": "𠃊", "gloss": "hidden area"},
        {"character": "人", "gloss": "person"},
        {"character": "川", "gloss": "river"},
    ],
    "亀": [
        {"character": "亀", "gloss": "turtle"},
    ],
    "侃": [
        {"character": "亻", "gloss": "person (side)"},
        {"character": "口", "gloss": "mouth"},
        {"character": "川", "gloss": "river"},
    ],
    "发": [
        {"character": "𠃋", "gloss": "arm"},
        {"character": "丿", "gloss": "slash"},
        {"character": "丶", "gloss": "dot"},
        {"character": "又", "gloss": "hand"},
    ],
    "后": [
        {"character": "丿", "gloss": "slash"},
        {"character": "一", "gloss": "one"},
        {"character": "口", "gloss": "mouth"},
    ],
    "図": [
        {"character": "囗", "gloss": "enclosure"},
        {"character": "㐅", "gloss": "cross"},
    ],
    "姦": [
        {"character": "女", "gloss": "woman"},
        {"character": "女", "gloss": "woman"},
        {"character": "女", "gloss": "woman"},
    ],
    "学": [
        {"character": "⺍", "gloss": "small"},
        {"character": "冖", "gloss": "cover"},
        {"character": "子", "gloss": "child"},
    ],
    "害": [
        {"character": "宀", "gloss": "roof"},
        {"character": "丰", "gloss": "abundant"},
        {"character": "口", "gloss": "mouth"},
    ],
    "巟": [
        {"character": "亡", "gloss": "deceased"},
        {"character": "川", "gloss": "river"},
    ],
    "整": [
        {"character": "束", "gloss": "bundle"},
        {"character": "攵", "gloss": "tap"},
        {"character": "正", "gloss": "correct"},
    ],
    "替": [
        {"character": "夫", "gloss": "husband"},
        {"character": "夫", "gloss": "husband"},
        {"character": "曰", "gloss": "speech"},
    ],
    "東": [
        {"character": "日", "gloss": "day"},
        {"character": "木", "gloss": "tree"},
    ],
    "樂": [
        {"character": "幺", "gloss": "thread"},
        {"character": "白", "gloss": "white"},
        {"character": "幺", "gloss": "thread"},
        {"character": "木", "gloss": "tree"},
    ],
    "气": [
        {"character": "气", "gloss": "steam"},
    ],
    "温": [
        {"character": "氵", "gloss": "water (drops)"},
        {"character": "日", "gloss": "day"},
        {"character": "皿", "gloss": "dish"},
    ],
    "當": [
        {"character": "尚", "gloss": "esteem"},
        {"character": "田", "gloss": "rice field"},
    ],
    "發": [
        {"character": "癶", "gloss": "legs"},
        {"character": "弓", "gloss": "bow"},
        {"character": "殳", "gloss": "hand tool"},
    ],
    "紧": [
        {"character": "丨", "gloss": "line"},
        {"character": "丨", "gloss": "line"},
        {"character": "又", "gloss": "hand"},
        {"character": "糸", "gloss": "silk"},
    ],
    "質": [
        {"character": "斤", "gloss": "axe"},
        {"character": "斤", "gloss": "axe"},
        {"character": "貝", "gloss": "shellfish"},
    ],
    "鳥": [
        {"character": "鳥", "gloss": "bird"},
    ],
    "龍": [
        {"character": "龍", "gloss": "dragon"},
    ],
    "𫶧": [
        {"character": "川", "gloss": "river"},
    ],
    "鐵": [
        {"character": "金", "gloss": "gold"},
        {"character": "十", "gloss": "ten"},
        {"character": "戜", "gloss": "scrape"},
    ],
}


TARGETED_MNEMONIC_OVERRIDES: dict[str, str] = {
    "㐬": "A 𠫓 newborn sign flows into a 川 river tail, forming 㐬 stream.",
    "㠩": "A 人 person in a 𠃊 hidden area beside a 川 river faces 㠩 vast space.",
    "亀": "The shell and head of 亀 turtle curl into the old shape of 亀 turtle.",
    "侃": "A 亻 person (side) keeps a steady 口 mouth and 川 river stance, becoming 侃 upright and strong.",
    "买": "A 乛 hook mark over 头 head tags the item you 买 buy.",
    "買": "An ⺫ eye (side) looks over 貝 shellfish money before 買 buy.",
    "易": "A 日 day that is 勿 not harsh makes work 易 easy.",
    "发": "A 𠃋 arm with 又 hand flicks a 丿 slash and 丶 dot outward to 发 emit.",
    "發": "癶 legs carry a 弓 bow and 殳 hand tool forward, ready to 發 send out.",
    "発": "癶 legs push 二 two lines above 儿 human legs forward, making 発 send out.",
    "連": "A 車 vehicle drives along 辶 movement to 連 connect places together.",
    "连": "A 车 vehicle follows ⻌ movement between places to 连 connect them.",
    "图": "A 囗 enclosure marks 冬 winter territory on a 图 map.",
    "圖": "A 囗 enclosure marks a 啚 remote place, making 圖 map.",
    "図": "A 囗 enclosure with a 㐅 cross marks the spot on 図 map.",
    "边": "辶 movement driven by 力 power reaches the outer 边 edge.",
    "邊": "辶 movement follows 自 oneself through a 穴 hole toward 方 direction, arriving at 邊 border.",
    "地": "土 earth is 也 also the place under each step, forming 地 ground.",
    "後": "A 彳 step leaves a 幺 thread behind a 夊 trailing foot, marking 後 after.",
    "物": "A 牜 ox marked 勿 not merely alive becomes one 物 thing.",
    "彼": "A 彳 step moves toward a separate 皮 covering, pointing to 彼 the other.",
    "面": "A 丆 reading mark above 囬 return to or from faces forward as 面 face-to-face.",
    "味": "A 口 mouth tasting what is 未 not yet known discovers 味 flavor.",
    "死": "A 歹 harmful mark beside a 匕 ancient spoon leaves only 死 death.",
    "能": "A 䏍 small worm survives under a 𫧇 seal form, showing 能 ability.",
    "特": "A 牜 ox kept at a 寺 temple is set apart as 特 special.",
    "藤": "艹 grass (top) growing from the 滕 ancient state becomes 藤 rattan.",
    "悪": "A 亜 Asia shape presses on the 心 heart, turning into 悪 harmful.",
    "恶": "亚 second presses down on 心 heart, turning 恶 bad.",
    "惡": "亞 Asia presses down on 心 heart, turning 惡 harmful.",
    "状": "A 丬 piece of wood beside a 犬 dog marks the visible 状 state of affairs.",
    "姦": "A 女 woman, another 女 woman, and a third 女 woman crowd together into 姦 adultery.",
    "学": "A ⺍ small lesson under a 冖 cover guides a 子 child as they 学 study.",
    "害": "Under a 宀 roof, an 丰 abundant 口 mouth spreads words that cause 害 harm.",
    "残": "A 歹 harmful break leaves 戋 tiny remains as 残 incomplete.",
    "質": "A 斤 axe and another 斤 axe test a 貝 shellfish, proving 質 quality.",
    "路": "A 𧾷 foot (side) reaches 各 each stop along 路 path.",
    "踢": "A 𧾷 foot finds an 易 easy opening and snaps into 踢 kick.",
    "景": "日 day lights the 京 capital, creating 景 scenery.",
    "津": "氵 water (drops) beside 聿 writing marks a 津 ferry.",
    "域": "土 earth bounded by 或 form becomes 域 domain.",
    "犯": "A 犭 dog (side) breaks a 㔾 seal, making 犯 offense.",
    "陸": "A ⻖ mound (left) beside 坴 clod of earth rises into 陸 land.",
    "温": "氵 water (drops) warmed by 日 day over a 皿 dish becomes 温 warm.",
    "焼": "火 fire around a 尭 legendary ancient makes 焼 roast.",
    "陽": "A ⻖ mound (left) receives 昜 out light, becoming 陽 sunlight.",
    "整": "A 束 bundle struck by 攵 tap becomes 正 correct, so 整 arrange follows.",
    "跡": "A 𧾷 foot (side) repeated 亦 likewise leaves 跡 trace.",
    "阪": "A ⻖ mound (left) turned by 反 against becomes 阪 slope.",
    "講": "言 say fills a 冓 secluded place, becoming 講 lecture.",
    "微": "A 彳 step touched by 攵 tap becomes barely felt as 微 tiny.",
    "替": "A 夫 husband and another 夫 husband exchange 曰 speech, making 替 replace.",
    "踏": "A 𧾷 foot (side) landing on 沓 crowded steps becomes 踏 trample.",
    "融": "A 鬲 cauldron warms until 虫 insects soften into 融 melt.",
    "惑": "An 或 form unsettles the 心 heart, making 惑 be bewildered.",
    "荒": "艹 grass (top) overtakes 巟 watery waste, creating 荒 wasteland.",
    "鏡": "金 gold polished under 竟 unexpectedly reflects as 鏡 mirror.",
    "幼": "A 幺 thread with little 力 power remains 幼 young.",
    "躍": "A 𧾷 foot (side) springs like 翟 pheasant into 躍 leap.",
    "巟": "A 亡 deceased sign drains into a 川 river, leaving 巟 watery waste.",
    "會": "亼 assemble gathers 口 mouth voices beneath ⺌ small (top) marks on a 日 day, making 會 meet.",
    "会": "A 𠆢 person roof shelters 云 utter words as people 会 meet.",
    "見": "A 目 eye on 儿 human legs moves around to 見 see.",
    "见": "A 目 eye on 儿 human legs moves forward to 见 observe.",
    "观": "A 又 hand frames 见 observe so you 观 see.",
    "觀": "A 雚 stork with 見 see watches carefully to 觀 observe.",
    "観": "A 見 see action held steady becomes 観 observe.",
    "樂": "A 幺 thread and another 幺 thread flank 白 white notes on a 木 tree frame, becoming 樂 music.",
    "楽": "A 白 white note resting by a 木 tree starts simple 楽 music.",
    "乐": "The compact 乐 happy mark holds a cheerful sound as 乐 happy.",
    "龙": "The compact 龙 dragon curls into the shape of 龙 dragon.",
    "龍": "The upright body, horns, and tail of 龍 dragon coil into 龍 dragon.",
    "气": "A 气 steam cloud curls upward as 气 steam.",
    "氣": "气 steam rising from 米 rice fills the room with 氣 spirit.",
    "體": "骨 skeleton given 豊 plentiful substance becomes 體 body.",
    "臺": "吉 lucky under 冖 cover reaches 至 until the structure becomes 臺 platform.",
    "裡": "衤 clothing (side) wraps 里 li so the contents stay 裡 inside.",
    "萬": "艹 grass (top) spreads over 禺 district until the count reaches 萬 ten thousand.",
    "万": "A 一 one line above a 人 person marks a huge 万 ten thousand count.",
    "與": "𦥑 mortar holds 一 one offering divided into 八 eight parts by 丿 slash, ready to 與 offer.",
    "为": "又 hand guides a 象 elephant by the lead to 为 handle.",
    "為": "又 hand guides a 象 elephant through each motion to 為 act.",
    "問": "Standing at the 門 gate, you open your 口 mouth to 問 ask.",
    "问": "A 门 gate with a 口 mouth at it gives a place to 问 ask.",
    "語": "When 言 say meets what 吾 I know, it becomes 語 language.",
    "语": "讠 speech carries what 吾 I say, forming 语 words.",
    "稲": "禾 standing grain under 爫 reaching hand beside 旧 old fields becomes 稲 rice growing in field.",
    "稻": "禾 standing grain bends as 舀 dip gathers water, becoming 稻 unhulled rice.",
    "紧": "A 丨 line and another 丨 line brace a 又 hand pulling 糸 silk until it becomes 紧 tense.",
    "曷": "曰 speech inside 勹 wrap surrounds a 𠃊 hidden area and 人 person, leaving 曷 question.",
    "釘": "金 gold shaped like a 丁 fourth mark becomes 釘 nail.",
    "針": "金 gold drawn to a sharp point on a 十 ten guide becomes 針 needle.",
    "鈴": "金 gold struck by 令 orders rings out as 鈴 small bell.",
    "鉛": "A 口 mouth warns that 金 gold-colored 鉛 lead is not for tasting.",
    "銀": "金 gold turned pale and 艮 stubborn in shine becomes 銀 silver.",
    "銅": "金 gold sealed by 𠔼 cover around 口 mouth turns reddish as 銅 copper.",
    "銭": "金 gold shortened into 㦮 abbreviated marks becomes 銭 currency.",
    "鋼": "金 gold in a forge hardens like a 岡 ridge of a hill, forming 鋼 steel.",
    "錢": "金 gold cut into 戔 narrow pieces becomes 錢 coin.",
    "錫": "A 金 gold-colored metal that is 易 easy to melt is 錫 tin.",
    "錬": "金 gold heated from the 東 east furnace is ready to 錬 refine.",
    "鍋": "A 金 gold rim around a 咼 jaw-shaped bowl becomes 鍋 pot.",
    "鍛": "金 gold worked through 段 stage after stage is how you 鍛 forge.",
    "鎖": "金 gold broken into 𧴪 fragments links shut as 鎖 lock.",
    "鐚": "金 gold stamped with 惡 harmful value is reduced to 鐚 small coin.",
    "鐵": "金 gold worked 十 ten times with 戜 scrape marks becomes 鐵 iron.",
    "鉄": "金 gold that refuses to 失 lose its shape becomes 鉄 iron.",
    "铁": "钅 metal that refuses to 失 lose its shape becomes 铁 iron.",
    "門": "The two leaves of 門 gate frame an opening, making 門 gate.",
    "门": "The simplified 门 gate still frames a doorway as 门 gate.",
    "東": "日 day rises through 木 tree branches, marking 東 east.",
    "东": "The compact 东 east mark holds the idea of sunrise in the 东 east.",
    "貝": "The hard shell shape of 貝 shellfish holds value as 貝 shellfish.",
    "贝": "The simplified 贝 shell keeps the curve of a 贝 shell.",
    "后": "A 丿 slash and 一 one line crown the 口 mouth giving commands as 后 queen.",
    "么": "A 丿 slash points into a 厶 secret, forming 么 interrogative.",
    "當": "A 尚 esteem marker over a 田 rice field shows which role will 當 work as the main one.",
    "鳥": "The perched shape of 鳥 bird shows head, wing, and tail as 鳥 bird.",
    "𫶧": "A 川 river drawn as a trailing lower form becomes 𫶧 flow tail.",
}


def collapse_repeated_words(text: str) -> str:
    words = text.split()
    if len(words) < 2:
        return text
    output: list[str] = []
    collapsed = False
    for word in words:
        normalized = re.sub(r"^[^\w-]+|[^\w-]+$", "", word.lower())
        previous = re.sub(r"^[^\w-]+|[^\w-]+$", "", output[-1].lower()) if output else ""
        if normalized and normalized == previous:
            collapsed = True
            continue
        output.append(word)
    result = " ".join(output)
    return result.lower() if collapsed else result


def is_han_codepoint(code: int) -> bool:
    return (
        0x2E80 <= code <= 0x2EFF
        or 0x2F00 <= code <= 0x2FDF
        or 0x3400 <= code <= 0x4DBF
        or 0x4E00 <= code <= 0x9FFF
        or 0xF900 <= code <= 0xFAFF
        or 0x20000 <= code <= 0x2A6DF
        or 0x2A700 <= code <= 0x2B73F
        or 0x2B740 <= code <= 0x2B81F
        or 0x2B820 <= code <= 0x2CEAF
        or 0x2CEB0 <= code <= 0x2EBEF
        or 0x2EBF0 <= code <= 0x2EE5F
        or 0x2F800 <= code <= 0x2FA1F
        or 0x30000 <= code <= 0x3134F
        or 0x31350 <= code <= 0x323AF
    )


def is_han_string(ch: str) -> bool:
    return len(ch) == 1 and is_han_codepoint(ord(ch))


def all_target_characters() -> list[str]:
    chars: set[str] = set()
    for path in (GAME_DATA_DIR / "component_glosses.json", GAME_DATA_DIR / "char_taxonomy.json"):
        data = json.loads(path.read_text())
        chars.update(ch for ch in data if is_han_string(ch))
    return sorted(chars, key=lambda ch: (ord(ch), ch))


def load_artifact(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}
    data = json.loads(path.read_text())
    return {card["character"]: card for card in data.get("mnemonics", [])}


def strip_required_pairs(card: dict[str, Any]) -> str:
    text = str(card.get("mnemonic") or "")
    for component in card.get("components") or []:
        text = text.replace(f"{component.get('character')} {component.get('gloss')}", "")
    text = text.replace(f"{card.get('character')} {card.get('meaning')}", "")
    return text


def card_is_clean(card: dict[str, Any]) -> bool:
    mnemonic = str(card.get("mnemonic") or "")
    if not mnemonic:
        return False
    if len(mnemonic) > 190:
        return False
    if len([part for part in re.split(r"[.!?。！？]+", mnemonic) if part.strip()]) > 1:
        return False
    stripped = strip_required_pairs(card)
    if AWKWARD_RE.search(stripped) or BAD_STYLE_RE.search(stripped):
        return False
    validation = card.get("validation") or {}
    if validation.get("valid") is False:
        return False
    return True


def safe_gloss(char: str, gloss: str, *, component_mode: bool = False) -> str:
    if char in LOCAL_GLOSS_OVERRIDES:
        return LOCAL_GLOSS_OVERRIDES[char]
    if component_mode and char in sm.MANUAL_COMPONENT_GLOSS_OVERRIDES:
        return sm.MANUAL_COMPONENT_GLOSS_OVERRIDES[char]

    cleaned = sm.clean_gloss(gloss) or ""
    lowered = cleaned.lower()
    if "kwukyel" in lowered:
        return "rank mark" if "rank" in lowered else "reading mark"
    if "what?" in lowered or "why?" in lowered or "where?" in lowered:
        return "question"

    regex_replacements = [
        (r"\bnon[- ]?classical\b", ""),
        (r"\bnon[- ]?standard\b", ""),
        (r"\bkangxi\s+radical\b", "shape mark"),
        (r"\bobscure\s+component\b", "form"),
        (r"\bold\s+component\b", "old form"),
        (r"\bcomponent\s+form\b", "form"),
        (r"\bcomponent\b", "form"),
        (r"\bradical\b", "shape mark"),
        (r"\bvariant\s+of\b", "alternate form"),
        (r"\bvariant\b", "alternate form"),
        (r"\bsame\s+as\b", "related form"),
        (r"\bsame\s+a\b", "related form"),
        (r"\bsame\b", "related form"),
        (r"\barchaic\s+a\b", "old form"),
        (r"\barchaic\b", ""),
        (r"\brare\b", ""),
        (r"\bobscure\b", ""),
        (r"\bunknown\b", ""),
        (r"\bfig\b", ""),
        (r"\binsincere\s+and\s+cunning\b", "cunning"),
        (r"\bslave\s+girls\b", "attendants"),
        (r"\bslave\b", "attendant"),
        (r"\bcriminal\b", "offender"),
        (r"\bprisoner\b", "confined person"),
        (r"\bbutcher\b", "cutter"),
        (r"\bfierce\b", "strong"),
        (r"\bmalicious\b", "harmful"),
        (r"\bevil\b", "harmful"),
        (r"\bugly\s+woman\b", "appearance"),
        (r"\bbeautiful\s+face\b", "face"),
        (r"\blady\s+officer\b", "officer"),
        (r"\binstrument\s+of\s+torture\b", "instrument"),
        (r"\bcut\s+off\s+the\s+nose\b", "cut mark"),
        (r"\bworship\s+of\s+god\b", "worship"),
        (r"\bgoddess'?s\s+name\b", "name"),
        (r"\bname\s+of\s+a\s+god\b", "name"),
        (r"\bname\s+of\s+a\s+person\b", "name"),
        (r"\bused\s+in\s+(?:girl|boy)'?s\s+name\b", "name"),
        (r"\bused\s+in\s+.*?\s+name\b", "name"),
        (r"\bname\s+a\s+name\s+of\b", "name"),
        (r"\bname\s+of\b", "name"),
        (r"\bdo\s+not\s+fear\s+to\b", "fearless"),
        (r"\btorture\s+used\s+in\b", "tool"),
        (r"\bgoblin\b", "spirit"),
        (r"\bgod\s+of\s+cereals\b", "grain altar"),
        (r"\braise\s+god\b", "raise"),
        (r"\bloquacious\b", "talkative"),
        (r"\bkangxi\b", "form"),
        (r"\bgirl\b", "woman"),
        (r"\bgod\s+god\b", "deity"),
        (r"\bgoddess\s+goddess\b", "deity"),
        (r"\bgoddess\s+of\s+an?\s+(.+)", r"\1 deity"),
        (r"\bgod\s+of\s+the\s+(.+)", r"\1 deity"),
        (r"\bgod\s+of\s+(.+)", r"\1 deity"),
        (r"\bworship\s+the\s+god\b", "worship"),
        (r"\boffering\s+blood\s+to\s+god\b", "blood offering"),
        (r"\bgoddess\b", "deity"),
        (r"\bgod\b", "deity"),
    ]
    for pattern, replacement in regex_replacements:
        cleaned = re.sub(pattern, replacement, cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bA\b", "", cleaned)
    cleaned = re.sub(r"^an?\s+kind\s+of\s+", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"^type\s+of\s+", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"^an?\s+", "", cleaned, flags=re.IGNORECASE)
    if re.search(r"\b(?:name|girl|boy)\b", cleaned, flags=re.IGNORECASE) and len(cleaned.split()) > 2:
        cleaned = "name"
    if cleaned.lower().startswith("related form"):
        cleaned = "related form"
    if cleaned.lower().startswith("alternate form"):
        cleaned = "alternate form"
    if cleaned.lower() in {"name a", "a", "used", "kind"}:
        cleaned = "form" if cleaned.lower() != "name a" else "name"
    if component_mode and cleaned.strip().lower() == "matching mark":
        cleaned = "related form"
    cleaned = re.sub(r"[.!?。！？]+", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" -;:,")
    cleaned = re.sub(r"\b(?:to|of|or|the)$", "", cleaned, flags=re.IGNORECASE).strip(" -;:,")
    cleaned = collapse_repeated_words(cleaned)
    return cleaned or "form"


def sanitize_prepared_card(card: dict[str, Any]) -> dict[str, Any]:
    sanitized = dict(card)
    sanitized["meaning"] = safe_gloss(card["character"], str(card.get("meaning") or ""), component_mode=False)

    def clean_component(component: dict[str, Any]) -> dict[str, str]:
        char = str(component.get("character") or component.get("char") or "")
        return {
            "character": char,
            "gloss": safe_gloss(char, str(component.get("gloss") or ""), component_mode=True),
        }

    sanitized["components"] = [clean_component(component) for component in card.get("components") or []]
    sanitized["visual_components"] = [
        clean_component(component)
        for component in (card.get("visual_components") or card.get("components") or [])
    ]
    if card.get("historical_components"):
        sanitized["historical_components"] = [
            clean_component(component)
            for component in card.get("historical_components") or []
        ]
    if card.get("historical_component_source"):
        sanitized["historical_component_source"] = card.get("historical_component_source")
    return sanitized


def fallback_card(char: str) -> dict[str, Any]:
    meaning = safe_gloss(char, sm.canonical_component_gloss(char, sm.GLOSSES.get(char, "")), component_mode=True)
    component = {"character": char, "gloss": meaning}
    return {
        "character": char,
        "meaning": meaning,
        "components": [component],
        "visual_components": [component],
        "component_source": "self_fallback",
        "source_meaning": meaning,
    }


def prepare_card(char: str) -> dict[str, Any]:
    _, card, _ = sm.prepare_one_card(char)
    return sanitize_prepared_card(card) if card else fallback_card(char)


def phrase_components(components: list[dict[str, str]], char: str) -> str:
    pairs = [f"{component['character']} {component['gloss']}" for component in components]
    if len(pairs) == 1:
        return f"a {pairs[0]}"
    if len(pairs) == 2:
        relations = ("beside", "under", "over", "with", "near")
        relation = relations[sm.simple_hash(char) % len(relations)]
        return f"a {pairs[0]} {relation} a {pairs[1]}"
    article_pairs = [f"a {pair}" for pair in pairs]
    return ", ".join(article_pairs[:-1]) + f", and {article_pairs[-1]}"


def meaning_action(meaning: str, plural: bool) -> str:
    lower = meaning.lower()

    def has_keyword(needle: str) -> bool:
        escaped = re.escape(needle)
        return bool(re.search(rf"(?<![a-z]){escaped}(?![a-z])", lower))

    classes = [
        (("water", "river", "sea", "lake", "spring", "tide", "liquid", "rain", "pond", "swamp", "stream"),
         "flow into" if plural else "flows into"),
        (("fire", "heat", "warm", "hot", "burn", "light", "bright", "shine", "sun", "ray", "lamp"),
         "light up into" if plural else "lights up into"),
        (("say", "speak", "talk", "ask", "call", "read", "write", "word", "sound", "voice", "name", "language"),
         "carry words into" if plural else "carries words into"),
        (("heart", "feel", "worry", "sad", "anger", "fear", "love", "desire", "wish", "think", "recall"),
         "press inward into" if plural else "presses inward into"),
        (("go", "walk", "run", "move", "enter", "exit", "return", "cross", "reach", "arrive", "advance", "retreat", "follow"),
         "move toward" if plural else "moves toward"),
        (("protect", "guard", "hide", "cover", "surround", "enclose", "safe", "secure", "keep"),
         "close around" if plural else "closes around"),
        (("tight", "bind", "bound", "knot", "rope", "thread", "string", "silk"),
         "pull tight into" if plural else "pulls tight into"),
        (("grip", "grasp", "hold", "seize", "catch"),
         "close around" if plural else "closes around"),
        (("cut", "divide", "break", "split", "sever", "hew", "stab", "strike", "beat", "grind"),
         "cut toward" if plural else "cuts toward"),
        (("count", "number", "measure", "order", "rank", "line", "list", "record", "copy"),
         "line up as" if plural else "lines up as"),
        (("make", "build", "create", "form", "shape", "construct", "establish", "set", "frame"),
         "take shape as" if plural else "takes shape as"),
        (("tree", "grass", "flower", "plant", "grain", "leaf", "root", "branch", "bamboo", "crop"),
         "grow into" if plural else "grows into"),
        (("bird", "fish", "horse", "dog", "ox", "cow", "sheep", "insect", "animal", "pooch"),
         "take living shape as" if plural else "takes living shape as"),
        (("house", "room", "city", "country", "village", "temple", "store", "gate", "place", "street", "building"),
         "mark the site of" if plural else "marks the site of"),
        (("person", "woman", "man", "child", "mother", "father", "official", "teacher", "king", "monarch"),
         "identify" if plural else "identifies"),
    ]
    for needles, action in classes:
        if any(has_keyword(needle) for needle in needles):
            return action
    return "come together as" if plural else "comes together as"


def local_mnemonic(prepared: dict[str, Any]) -> str:
    char = prepared["character"]
    final_pair = f"{char} {prepared['meaning']}"
    components = prepared["components"]
    component_text = phrase_components(components, char)
    if component_text.startswith("a "):
        component_text = "A " + component_text[2:]
    if len(components) == 1 and components[0]["character"] == char:
        return f"{component_text} stands alone as {final_pair}."
    return f"{component_text} {meaning_action(prepared['meaning'], len(components) > 2)} {final_pair}."


def local_hero_prompt(prepared: dict[str, Any]) -> str:
    labels = ", ".join(f"{component['character']} {component['gloss']}" for component in prepared["components"])
    return (
        f"Square mnemonic illustration for {prepared['character']} {prepared['meaning']}: "
        f"show {labels} in a simple uncluttered scene, labels directly on objects, no app UI."
    )


def local_card(prepared: dict[str, Any], source: str, replaced_reason: str | None = None) -> dict[str, Any]:
    expected_equation = " + ".join(f"{c['character']} {c['gloss']}" for c in prepared["components"])
    expected_equation += f" = {prepared['character']} {prepared['meaning']}"
    output = {
        "character": prepared["character"],
        "meaning": prepared["meaning"],
        "equation": expected_equation,
        "mnemonic": local_mnemonic(prepared),
        "hero_image_prompt": local_hero_prompt(prepared),
    }
    validation = sm.validate_card(output, prepared)
    record = sm.generated_record(output, prepared, validation)
    record["generation_source"] = source
    if replaced_reason:
        record["replaced_reason"] = replaced_reason
    return record


def attach_coverage_metadata(record: dict[str, Any], metadata: dict[str, str]) -> dict[str, Any]:
    if metadata.get("evidence"):
        record["coverage_evidence"] = metadata["evidence"]
    if metadata.get("alias_of"):
        record["alias_of"] = metadata["alias_of"]
    if metadata.get("alias_reason"):
        record["alias_reason"] = metadata["alias_reason"]
    return record


def alias_card(alias_char: str, base_record: dict[str, Any], metadata: dict[str, str]) -> dict[str, Any]:
    components = [
        {"character": component["character"], "gloss": component["gloss"]}
        for component in base_record.get("components") or []
    ]
    meaning = safe_gloss(alias_char, metadata.get("meaning") or str(base_record.get("meaning") or "form"))
    if not components:
        components = [{"character": alias_char, "gloss": meaning}]
    prepared = {
        "character": alias_char,
        "meaning": meaning,
        "components": components,
        "visual_components": components,
        "component_source": f"variant_alias:{metadata['alias_of']}",
        "source_meaning": f"alias of {metadata['alias_of']}",
    }
    record = local_card(prepared, metadata.get("generation_source", "codex_local_variant_alias"))
    record["alias_of"] = metadata["alias_of"]
    record["alias_reason"] = metadata.get("reason", "")
    if metadata.get("alias_kind"):
        record["alias_kind"] = metadata["alias_kind"]
    return record


def automatic_nfkc_alias_targets(covered_chars: set[str]) -> dict[str, dict[str, str]]:
    targets: dict[str, dict[str, str]] = {}
    for start, end in AUTO_COMPATIBILITY_ALIAS_RANGES:
        for codepoint in range(start, end + 1):
            alias_char = chr(codepoint)
            normalized = unicodedata.normalize("NFKC", alias_char)
            if alias_char in covered_chars or normalized == alias_char:
                continue
            if len(normalized) != 1 or not is_han_string(normalized):
                continue
            if normalized not in covered_chars:
                continue
            targets[alias_char] = {
                "alias_of": normalized,
                "alias_kind": "nfkc_compatibility",
                "generation_source": "codex_local_nfkc_variant_alias",
                "reason": "Unicode NFKC compatibility ideograph",
            }
    return dict(sorted(targets.items(), key=lambda item: (ord(item[0]), item[0])))


def existing_nfkc_alias_targets(covered_chars: set[str]) -> dict[str, dict[str, str]]:
    targets: dict[str, dict[str, str]] = {}
    for alias_char in covered_chars:
        codepoint = ord(alias_char)
        if not any(start <= codepoint <= end for start, end in AUTO_COMPATIBILITY_ALIAS_RANGES):
            continue
        normalized = unicodedata.normalize("NFKC", alias_char)
        if normalized == alias_char or len(normalized) != 1 or normalized not in covered_chars:
            continue
        targets[alias_char] = {
            "alias_of": normalized,
            "alias_kind": "nfkc_compatibility",
            "generation_source": "codex_local_nfkc_variant_alias",
            "reason": "Unicode NFKC compatibility ideograph",
        }
    return dict(sorted(targets.items(), key=lambda item: (ord(item[0]), item[0])))


def add_learner_gap_cards(
    cards: list[dict[str, Any]],
    prepared: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    by_char = {card["character"]: card for card in cards}

    for char, metadata in EXTRA_LEARNER_TARGETS.items():
        if char in by_char:
            attach_coverage_metadata(by_char[char], metadata)
            continue
        prepared_card = prepared.get(char) or prepare_card(char)
        record = local_card(prepared_card, "codex_local_learner_gap")
        attach_coverage_metadata(record, metadata)
        by_char[char] = record
        cards.append(record)

    for alias_char, metadata in VARIANT_ALIAS_TARGETS.items():
        base = by_char.get(metadata["alias_of"])
        if base is None:
            base_prepared = prepared.get(metadata["alias_of"]) or prepare_card(metadata["alias_of"])
            base = local_card(base_prepared, "codex_local_completion")
            by_char[metadata["alias_of"]] = base
            cards.append(base)
        record = alias_card(alias_char, base, metadata)
        by_char[alias_char] = record

    all_nfkc_aliases = {
        **existing_nfkc_alias_targets(set(by_char)),
        **automatic_nfkc_alias_targets(set(by_char)),
    }
    for alias_char, metadata in all_nfkc_aliases.items():
        if alias_char in VARIANT_ALIAS_TARGETS:
            continue
        base = by_char.get(metadata["alias_of"])
        if base is None:
            continue
        record = alias_card(alias_char, base, metadata)
        by_char[alias_char] = record

    return sorted(by_char.values(), key=lambda card: (ord(card["character"]), card["character"]))


def count_sources(cards: list[dict[str, Any]]) -> dict[str, int]:
    source_counts: dict[str, int] = {}
    for card in cards:
        source = str(card.get("generation_source") or "unknown")
        source_counts[source] = source_counts.get(source, 0) + 1
    return source_counts


def append_source_marker_once(source: str, marker: str) -> str:
    parts = [part for part in source.split("+") if part]
    cleaned: list[str] = []
    marker_seen = False
    for part in parts:
        if part == marker:
            if marker_seen:
                continue
            marker_seen = True
        cleaned.append(part)
    if not marker_seen:
        cleaned.append(marker)
    return "+".join(cleaned) or marker


def normalize_existing(card: dict[str, Any], source: str) -> dict[str, Any]:
    record = dict(card)
    record["generation_source"] = source
    return record


def prepared_from_record(record: dict[str, Any]) -> dict[str, Any]:
    components = [
        {
            "character": str(component.get("character") or component.get("char") or ""),
            "gloss": str(component.get("gloss") or ""),
        }
        for component in (record.get("components") or [])
        if component.get("character") or component.get("char")
    ]
    if not components:
        char = str(record["character"])
        meaning = str(record.get("meaning") or "form")
        components = [{"character": char, "gloss": meaning}]
    return sanitize_prepared_card({
        "character": str(record["character"]),
        "meaning": str(record.get("meaning") or "form"),
        "components": components,
        "visual_components": components,
    })


def refresh_validation(record: dict[str, Any], prepared: dict[str, Any]) -> dict[str, Any]:
    validation = sm.validate_card(record, prepared)
    record["validation"] = validation
    record["heuristic_score"] = validation["heuristic_score"]
    record["style_score"] = sm.cheap_style_score(record)
    record["combined_score"] = validation["heuristic_score"] * 0.65 + record["style_score"] * 0.35
    return record


def restyle_generic_mnemonic(record: dict[str, Any]) -> dict[str, Any]:
    prepared = prepared_from_record(record)
    expected_pairs = [f"{component['character']} {component['gloss']}" for component in prepared["components"]]
    final_pair = f"{prepared['character']} {prepared['meaning']}"
    equation = str(record.get("equation") or "")
    mnemonic = str(record.get("mnemonic") or "")
    stale_pairs = any(pair not in equation or pair not in mnemonic for pair in expected_pairs)
    stale_final = final_pair not in equation or final_pair not in mnemonic
    validation = record.get("validation") or {}
    if (
        not GENERIC_MNEMONIC_RE.search(mnemonic)
        and validation.get("valid", True)
        and not stale_pairs
        and not stale_final
    ):
        return record
    record = dict(record)
    record["meaning"] = prepared["meaning"]
    record["components"] = prepared["components"]
    record["visual_components"] = prepared["visual_components"]
    record["equation"] = " + ".join(
        f"{component['character']} {component['gloss']}"
        for component in prepared["components"]
    ) + f" = {prepared['character']} {prepared['meaning']}"
    record["mnemonic"] = local_mnemonic(prepared)
    record["style_patch"] = "removed_generic_visual_image_phrase"
    return refresh_validation(record, prepared)


def clean_free_text(text: str) -> str:
    replacements = {
        "tiny thread": "thread",
        "metal (side)": "metal",
        "silk (side)": "silk",
        "kwukyel: rank": "rank mark",
        "kwukyel (alt)": "reading mark",
        "kwukyel": "reading mark",
        "person mark": "food cover",
    }
    for before, after in replacements.items():
        text = text.replace(before, after)
    return text


POSITIONAL_GLOSS_RE = re.compile(
    r"\s+\((?:side|top|bottom|left|right|drops|alt)\)",
    re.IGNORECASE,
)
BARE_ALT_MEANING_RE = re.compile(
    r"([\u2e80-\u2eff\u2f00-\u2fdf\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff])\s+\(alt\)",
    re.IGNORECASE,
)


def clean_mnemonic_prose(text: str) -> str:
    text = BARE_ALT_MEANING_RE.sub(r"\1 alternate form", text)
    text = POSITIONAL_GLOSS_RE.sub("", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def validation_expected_from_record(record: dict[str, Any]) -> dict[str, Any]:
    components = [
        {
            "character": str(component.get("character") or component.get("char") or ""),
            "gloss": str(component.get("gloss") or ""),
        }
        for component in (record.get("components") or [])
        if component.get("character") or component.get("char")
    ]
    if not components:
        components = [{"character": str(record["character"]), "gloss": str(record.get("meaning") or "form")}]
    return {
        "character": str(record["character"]),
        "meaning": str(record.get("meaning") or "form"),
        "components": components,
    }


def clean_card_free_text(record: dict[str, Any]) -> dict[str, Any]:
    updated = False
    mnemonic = record.get("mnemonic")
    if isinstance(mnemonic, str):
        cleaned_mnemonic = clean_mnemonic_prose(mnemonic)
        if cleaned_mnemonic != mnemonic:
            if not updated:
                record = dict(record)
                updated = True
            record["mnemonic"] = cleaned_mnemonic

    for key in ("historical_components",):
        components = record.get(key)
        if isinstance(components, list):
            cleaned_components = []
            for component in components:
                if not isinstance(component, dict):
                    cleaned_components.append(component)
                    continue
                char = str(component.get("character") or component.get("char") or "")
                gloss = safe_gloss(char, str(component.get("gloss") or ""), component_mode=True)
                cleaned = dict(component)
                cleaned["gloss"] = gloss
                cleaned_components.append(cleaned)
            if cleaned_components != components:
                if not updated:
                    record = dict(record)
                    updated = True
                record[key] = cleaned_components

    hero = record.get("hero_image_prompt")
    if isinstance(hero, str):
        cleaned_hero = clean_free_text(hero)
        if cleaned_hero != hero:
            if not updated:
                record = dict(record)
                updated = True
            record["hero_image_prompt"] = cleaned_hero
    if updated:
        record = refresh_validation(record, validation_expected_from_record(record))
    return record


def apply_targeted_quality_overrides(card: dict[str, Any]) -> dict[str, Any]:
    char = str(card.get("character") or "")
    mnemonic = TARGETED_MNEMONIC_OVERRIDES.get(char)
    if not mnemonic:
        return card

    prepared = prepare_card(char)
    if char in TARGETED_COMPONENT_OVERRIDES:
        components = [
            {
                "character": component["character"],
                "gloss": safe_gloss(
                    component["character"],
                    component["gloss"],
                    component_mode=True,
                ),
            }
            for component in TARGETED_COMPONENT_OVERRIDES[char]
        ]
        prepared["components"] = components
        prepared["visual_components"] = components
    prepared["meaning"] = safe_gloss(
        char,
        str(card.get("meaning") or prepared.get("meaning") or ""),
        component_mode=False,
    )

    record = dict(card)
    record["meaning"] = prepared["meaning"]
    record["components"] = prepared["components"]
    record["visual_components"] = prepared["visual_components"]
    record["component_source"] = append_source_marker_once(
        str(prepared.get("component_source") or record.get("component_source") or "unknown"),
        "manual_visual_repair" if char in TARGETED_COMPONENT_OVERRIDES else "manual_quality_override",
    )
    if char in TARGETED_COMPONENT_OVERRIDES:
        record["component_source"] = append_source_marker_once(
            record["component_source"],
            "manual_quality_override",
        )
    historical_components = prepared.get("historical_components") or []
    if historical_components and not sm.component_sets_equivalent(prepared["components"], historical_components):
        record["historical_components"] = historical_components
        record["historical_component_source"] = prepared.get("historical_component_source")
    else:
        record.pop("historical_components", None)
        record.pop("historical_component_source", None)
    record["equation"] = " + ".join(
        f"{component['character']} {component['gloss']}"
        for component in prepared["components"]
    ) + f" = {prepared['character']} {prepared['meaning']}"
    record["mnemonic"] = mnemonic
    record["hero_image_prompt"] = local_hero_prompt(prepared)
    record["generation_source"] = MANUAL_QUALITY_SOURCE
    record["style_patch"] = "targeted_top_1000_quality_override"
    return refresh_validation(record, prepared)


def build_prepared_map(chars: list[str], workers: int = 24) -> dict[str, dict[str, Any]]:
    prepared: dict[str, dict[str, Any]] = {}
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(prepare_card, char): char for char in chars}
        for index, future in enumerate(as_completed(futures), start=1):
            char = futures[future]
            try:
                prepared[char] = future.result()
            except Exception:
                prepared[char] = fallback_card(char)
            if index % 1000 == 0:
                print(f"prepared {index}/{len(chars)}", flush=True)
    return prepared


def validate_artifact(cards: list[dict[str, Any]]) -> dict[str, Any]:
    invalid: list[dict[str, Any]] = []
    lengths: list[int] = []
    source_counts: dict[str, int] = {}
    component_sources: dict[str, int] = {}
    for card in cards:
        lengths.append(len(str(card.get("mnemonic") or "")))
        source = str(card.get("generation_source") or "unknown")
        source_counts[source] = source_counts.get(source, 0) + 1
        component_source = str(card.get("component_source") or "unknown")
        component_sources[component_source] = component_sources.get(component_source, 0) + 1
        validation = card.get("validation") or {}
        if not validation.get("valid", False):
            invalid.append({
                "character": card.get("character"),
                "problems": validation.get("problems", ["missing validation"]),
            })
    lengths.sort()

    def q(p: float) -> int:
        if not lengths:
            return 0
        return lengths[int((len(lengths) - 1) * p)]

    return {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "count": len(cards),
        "invalid_count": len(invalid),
        "invalid": invalid[:100],
        "source_counts": source_counts,
        "component_source_counts": component_sources,
        "mnemonic_length": {
            "min": lengths[0] if lengths else 0,
            "p50": q(0.5),
            "p90": q(0.9),
            "p95": q(0.95),
            "max": lengths[-1] if lengths else 0,
        },
    }


def main() -> None:
    targets = all_target_characters()
    paid_10k = load_artifact(PAID_10K_PATH)
    reviewed_1000 = load_artifact(REVIEWED_1000_PATH)
    existing_best = load_artifact(OUTPUT_PATH)
    manual_quality = {
        char: card
        for char, card in existing_best.items()
        if card.get("generation_source") == MANUAL_QUALITY_SOURCE
    }
    prepared = build_prepared_map(targets)

    cards: list[dict[str, Any]] = []
    source_counts: dict[str, int] = {}
    for char in targets:
        if char in manual_quality:
            card = normalize_existing(manual_quality[char], MANUAL_QUALITY_SOURCE)
        elif char in reviewed_1000:
            card = normalize_existing(reviewed_1000[char], "gemini35_reviewed_1000")
        elif char in paid_10k:
            reason = None if card_is_clean(paid_10k[char]) else "paid_10k_failed_style_scan"
            card = local_card(prepared[char], "codex_local_reauthor_paid_9000", reason)
        else:
            card = local_card(prepared[char], "codex_local_completion")
        source = card["generation_source"]
        source_counts[source] = source_counts.get(source, 0) + 1
        cards.append(card)

    cards = add_learner_gap_cards(cards, prepared)
    cards = [restyle_generic_mnemonic(card) for card in cards]
    cards = [clean_card_free_text(card) for card in cards]
    cards = [apply_targeted_quality_overrides(card) for card in cards]
    cards = [clean_card_free_text(card) for card in cards]
    source_counts = count_sources(cards)

    artifact = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "model": {
            "name": "codex-authored-complete-semantic-mnemonics",
            "provider": "mixed",
            "id": "reviewed-1000+codex-reauthored-paid-9000+codex-local-completion+learner-gap-aliases",
        },
        "count": len(cards),
        "coverage_note": (
            "The reviewed first 1000 cards are preserved. The other paid 9000 Gemini cards "
            "are re-authored locally, and the remaining characters are completed locally, "
            "using canonical visual component glosses and validation for every card. "
            "Extra learner-gap glyphs and Japanese compatibility forms are added explicitly "
            "when frequency/name/JPDB heuristics showed useful exact glyphs outside the "
            "original component-gloss and taxonomy target set."
        ),
        "card_input_cache_version": sm.CARD_INPUT_CACHE_VERSION,
        "manual_gloss_overrides_used": sm.MANUAL_GLOSS_OVERRIDES,
        "manual_component_gloss_overrides_used": sm.MANUAL_COMPONENT_GLOSS_OVERRIDES,
        "extra_learner_targets_used": EXTRA_LEARNER_TARGETS,
        "variant_alias_targets_used": VARIANT_ALIAS_TARGETS,
        "source_counts": source_counts,
        "mnemonics": cards,
        "quality_patch_note": (
            "Hand-audited cards from the prior artifact are preserved when present; "
            "generic fallback wording is restyled through the deterministic local builder."
        ),
        "quality_patch_at": datetime.now(timezone.utc).isoformat(),
        "quality_patch_reviewed_characters": sorted(manual_quality, key=lambda ch: (ord(ch), ch)),
        "quality_patch_reviewed_count": len(manual_quality),
    }
    OUTPUT_PATH.write_text(json.dumps(artifact, ensure_ascii=False, separators=(",", ":")))
    evaluation = validate_artifact(cards)
    EVAL_PATH.write_text(json.dumps(evaluation, ensure_ascii=False, indent=2))
    print(json.dumps({
        "output": str(OUTPUT_PATH),
        "eval": str(EVAL_PATH),
        "count": len(cards),
        "source_counts": source_counts,
        "invalid_count": evaluation["invalid_count"],
        "mnemonic_length": evaluation["mnemonic_length"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
