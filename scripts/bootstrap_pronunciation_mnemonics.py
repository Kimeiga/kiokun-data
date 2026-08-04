#!/usr/bin/env python3
"""One-time, reproducible bootstrap for the reviewed top-100 corpus.

The bucketed records are authoritative after this script runs. This file keeps
the initial editorial decisions reviewable without introducing a monolithic
runtime artifact.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
import manage_pronunciation_mnemonic_corpus as corpus


ROOT = Path(__file__).resolve().parents[1]


# character | display reading | anchor word | full anchor reading
ZH_DATA = """
我|wǒ|我|wǒ
的|de|的|de
的|dí|的确|dí què
你|nǐ|你好|nǐ hǎo
是|shì|但是|dàn shì
了|le|了|le
了|liǎo|了解|liǎo jiě
不|bù|不是|bù shì
们|men|我们|wǒmen
这|zhè|这个|zhè ge
一|yī|一|yī
他|tā|他们|tā men
么|me|什么|shén me
在|zài|现在|xiàn zài
有|yǒu|没有|méi yǒu
个|gè|个|gè
好|hǎo|你好|nǐ hǎo
好|hào|爱好|ài hào
来|lái|未来|wèi lái
人|rén|人们|rén men
那|nà|那里|nà li
要|yào|需要|xū yào
要|yāo|要求|yāo qiú
会|huì|机会|jī huì
会|kuài|会计|kuài jì
就|jiù|就是|jiù shì
什|shén|什么|shén me
没|méi|没有|méi yǒu
没|mò|沉没|chén mò
到|dào|到达|dào dá
说|shuō|说话|shuō huà
吗|ma|吗|ma
为|wèi|因为|yīn wèi
为|wéi|成为|chéng wéi
想|xiǎng|想法|xiǎng fǎ
能|néng|能力|néng lì
上|shàng|上面|shàng miàn
去|qù|过去|guò qù
道|dào|知道|zhī dào
她|tā|她们|tā men
很|hěn|很|hěn
看|kàn|看见|kàn jiàn
看|kān|看守|kān shǒu
可|kě|可以|kě yǐ
知|zhī|知道|zhī dào
得|dé|得到|dé dào
得|děi|总得|zǒng děi
得|de|得|de
过|guò|过去|guò qù
过|guo|过|guo
吧|ba|吧|ba
还|hái|还是|hái shi
还|huán|偿还|cháng huán
对|duì|对不起|duì bu qǐ
里|lǐ|里面|lǐ miàn
以|yǐ|可以|kě yǐ
都|dōu|都|dōu
都|dū|首都|shǒu dū
事|shì|事情|shì qing
子|zǐ|子女|zǐ nǚ
子|zi|孩子|hái zi
生|shēng|生活|shēng huó
时|shí|时间|shí jiān
样|yàng|一样|yī yàng
也|yě|也|yě
和|hé|和平|hé píng
和|huo|暖和|nuǎn huo
下|xià|下面|xià miàn
真|zhēn|真的|zhēn de
现|xiàn|现在|xiàn zài
做|zuò|做事|zuò shì
大|dà|大家|dà jiā
大|dài|大夫|dài fu
啊|a|啊|a
怎|zěn|怎么|zěn me
出|chū|出来|chū lái
点|diǎn|一点|yī diǎn
起|qǐ|起来|qǐ lai
天|tiān|今天|jīn tiān
把|bǎ|把|bǎ
开|kāi|开始|kāi shǐ
让|ràng|让开|ràng kāi
给|gěi|给|gěi
给|jǐ|供给|gōng jǐ
但|dàn|但是|dàn shì
谢|xiè|谢谢|xiè xie
着|zhe|着|zhe
着|zháo|着急|zháo jí
着|zhuó|着手|zhuó shǒu
只|zhǐ|只是|zhǐ shì
只|zhī|只|zhī
些|xiē|一些|yī xiē
如|rú|如果|rú guǒ
家|jiā|大家|dà jiā
家|jia|人家|rén jia
后|hòu|后来|hòu lái
儿|ér|儿子|ér zi
多|duō|多少|duō shao
意|yì|意思|yì si
别|bié|别人|bié ren
别|biè|别扭|biè niu
所|suǒ|所以|suǒ yǐ
话|huà|说话|shuō huà
小|xiǎo|小心|xiǎo xīn
自|zì|自己|zì jǐ
回|huí|回来|huí lai
然|rán|然后|rán hòu
果|guǒ|如果|rú guǒ
发|fā|发现|fā xiàn
发|fà|头发|tóu fa
见|jiàn|看见|kàn jiàn
心|xīn|小心|xiǎo xīn
走|zǒu|走路|zǒu lù
定|dìng|一定|yī dìng
听|tīng|听说|tīng shuō
觉|jué|觉得|jué de
觉|jiào|睡觉|shuì jiào
太|tài|太|tài
该|gāi|应该|yīng gāi
当|dāng|当然|dāng rán
当|dàng|上当|shàng dàng
经|jīng|已经|yǐ jīng
妈|mā|妈妈|mā ma
用|yòng|使用|shǐ yòng
打|dǎ|打开|dǎ kāi
行|xíng|行动|xíng dòng
行|háng|银行|yín háng
""".strip()


# character | type | display | KANJIDIC reading | word | full word reading
JA_DATA = """
日|on|ニチ|ニチ|日曜日|にちようび
日|on|ジツ|ジツ|本日|ほんじつ
日|kun|ひ|ひ|日|ひ
一|on|イチ|イチ|一番|いちばん
一|kun|ひとつ|ひと.つ|一つ|ひとつ
国|on|コク|コク|外国|がいこく
国|kun|くに|くに|国|くに
会|on|カイ|カイ|会社|かいしゃ
会|kun|あう|あ.う|会う|あう
人|on|ジン|ジン|日本人|にほんじん
人|on|ニン|ニン|三人|さんにん
人|kun|ひと|ひと|人|ひと
年|on|ネン|ネン|来年|らいねん
年|kun|とし|とし|年|とし
大|on|ダイ|ダイ|大学|だいがく
大|on|タイ|タイ|大切|たいせつ
大|kun|おおきい|おお.きい|大きい|おおきい
十|on|ジュウ|ジュウ|十分|じゅうぶん
十|kun|とお|とお|十|とお
二|on|ニ|ニ|二月|にがつ
二|kun|ふたつ|ふた.つ|二つ|ふたつ
本|on|ホン|ホン|本|ほん
本|kun|もと|もと|本|もと
中|on|チュウ|チュウ|中国|ちゅうごく
中|kun|なか|なか|中|なか
長|on|チョウ|チョウ|社長|しゃちょう
長|kun|ながい|なが.い|長い|ながい
出|on|シュツ|シュツ|出発|しゅっぱつ
出|kun|でる|で.る|出る|でる
出|kun|だす|だ.す|出す|だす
三|on|サン|サン|三月|さんがつ
三|kun|みっつ|みっ.つ|三つ|みっつ
同|on|ドウ|ドウ|同時|どうじ
同|kun|おなじ|おな.じ|同じ|おなじ
時|on|ジ|ジ|時間|じかん
時|kun|とき|とき|時|とき
政|on|セイ|セイ|政治|せいじ
事|on|ジ|ジ|事件|じけん
事|kun|こと|こと|事|こと
自|on|ジ|ジ|自分|じぶん
自|kun|みずから|みずか.ら|自ら|みずから
行|on|コウ|コウ|行動|こうどう
行|on|ギョウ|ギョウ|行列|ぎょうれつ
行|kun|いく|い.く|行く|いく
行|kun|おこなう|おこな.う|行う|おこなう
社|on|シャ|シャ|会社|かいしゃ
見|on|ケン|ケン|意見|いけん
見|kun|みる|み.る|見る|みる
見|kun|みえる|み.える|見える|みえる
見|kun|みせる|み.せる|見せる|みせる
月|on|ゲツ|ゲツ|月曜日|げつようび
月|on|ガツ|ガツ|一月|いちがつ
月|kun|つき|つき|月|つき
分|on|ブン|ブン|自分|じぶん
分|on|フン|フン|五分|ごふん
分|kun|わかる|わ.かる|分かる|わかる
分|kun|わける|わ.ける|分ける|わける
議|on|ギ|ギ|会議|かいぎ
後|on|ゴ|ゴ|午後|ごご
後|kun|あと|あと|後|あと
後|kun|うしろ|うし.ろ|後ろ|うしろ
前|on|ゼン|ゼン|午前|ごぜん
前|kun|まえ|まえ|前|まえ
民|on|ミン|ミン|国民|こくみん
生|on|セイ|セイ|生活|せいかつ
生|on|ショウ|ショウ|一生|いっしょう
生|kun|いきる|い.きる|生きる|いきる
生|kun|うまれる|う.まれる|生まれる|うまれる
生|kun|なま|なま|生ビール|なまビール
連|on|レン|レン|連絡|れんらく
連|kun|つれる|つ.れる|連れる|つれる
五|on|ゴ|ゴ|五月|ごがつ
五|kun|いつつ|いつ.つ|五つ|いつつ
発|on|ハツ|ハツ|出発|しゅっぱつ
間|on|カン|カン|時間|じかん
間|on|ケン|ケン|世間|せけん
間|kun|あいだ|あいだ|間|あいだ
間|kun|ま|ま|間|ま
対|on|タイ|タイ|反対|はんたい
上|on|ジョウ|ジョウ|以上|いじょう
上|kun|うえ|うえ|上|うえ
上|kun|あげる|あ.げる|上げる|あげる
上|kun|あがる|あ.がる|上がる|あがる
上|kun|のぼる|のぼ.る|上る|のぼる
部|on|ブ|ブ|部分|ぶぶん
東|on|トウ|トウ|東京|とうきょう
東|kun|ひがし|ひがし|東|ひがし
者|on|シャ|シャ|医者|いしゃ
者|kun|もの|もの|者|もの
党|on|トウ|トウ|政党|せいとう
地|on|チ|チ|地図|ちず
地|on|ジ|ジ|地面|じめん
合|on|ゴウ|ゴウ|合計|ごうけい
合|kun|あう|あ.う|合う|あう
合|kun|あわせる|あ.わせる|合わせる|あわせる
市|on|シ|シ|市民|しみん
市|kun|いち|いち|市場|いちば
業|on|ギョウ|ギョウ|企業|きぎょう
内|on|ナイ|ナイ|国内|こくない
内|kun|うち|うち|内|うち
相|on|ソウ|ソウ|相談|そうだん
相|kun|あい|あい-|相手|あいて
方|on|ホウ|ホウ|方法|ほうほう
方|kun|かた|かた|方|かた
四|on|シ|シ|四月|しがつ
四|kun|よん|よん|四|よん
四|kun|よっつ|よっ.つ|四つ|よっつ
定|on|テイ|テイ|予定|よてい
定|kun|さだめる|さだ.める|定める|さだめる
今|on|コン|コン|今回|こんかい
今|kun|いま|いま|今|いま
回|on|カイ|カイ|今回|こんかい
回|kun|まわる|まわ.る|回る|まわる
回|kun|まわす|まわ.す|回す|まわす
新|on|シン|シン|新聞|しんぶん
新|kun|あたらしい|あたら.しい|新しい|あたらしい
場|on|ジョウ|ジョウ|会場|かいじょう
場|kun|ば|ば|場所|ばしょ
金|on|キン|キン|金曜日|きんようび
金|kun|かね|かね|金|かね
員|on|イン|イン|会社員|かいしゃいん
九|on|キュウ|キュウ|九|きゅう
九|on|ク|ク|九時|くじ
九|kun|ここのつ|ここの.つ|九つ|ここのつ
入|on|ニュウ|ニュウ|入学|にゅうがく
入|kun|はいる|はい.る|入る|はいる
入|kun|いれる|い.れる|入れる|いれる
選|on|セン|セン|選手|せんしゅ
選|kun|えらぶ|えら.ぶ|選ぶ|えらぶ
立|on|リツ|リツ|国立|こくりつ
立|kun|たつ|た.つ|立つ|たつ
立|kun|たてる|た.てる|立てる|たてる
開|on|カイ|カイ|開始|かいし
開|kun|あく|あ.く|開く|あく
開|kun|あける|あ.ける|開ける|あける
開|kun|ひらく|ひら.く|開く|ひらく
手|on|シュ|シュ|選手|せんしゅ
手|kun|て|て|手|て
米|on|ベイ|ベイ|米国|べいこく
米|kun|こめ|こめ|米|こめ
力|on|リョク|リョク|能力|のうりょく
力|on|リキ|リキ|力士|りきし
力|kun|ちから|ちから|力|ちから
学|on|ガク|ガク|学生|がくせい
学|kun|まなぶ|まな.ぶ|学ぶ|まなぶ
問|on|モン|モン|問題|もんだい
問|kun|とう|と.う|問う|とう
高|on|コウ|コウ|高校|こうこう
高|kun|たかい|たか.い|高い|たかい
代|on|ダイ|ダイ|時代|じだい
代|kun|かわる|か.わる|代わる|かわる
代|kun|かえる|か.える|代える|かえる
明|on|メイ|メイ|説明|せつめい
明|on|ミョウ|ミョウ|明朝|みょうちょう
明|kun|あかるい|あか.るい|明るい|あかるい
明|kun|あける|あ.ける|明ける|あける
実|on|ジツ|ジツ|実際|じっさい
実|kun|み|み|実|み
実|kun|みのる|みの.る|実る|みのる
円|on|エン|エン|円|えん
関|on|カン|カン|関係|かんけい
関|kun|かかわる|かか.わる|関わる|かかわる
決|on|ケツ|ケツ|決定|けってい
決|kun|きめる|き.める|決める|きめる
決|kun|きまる|き.まる|決まる|きまる
子|on|シ|シ|電子|でんし
子|kun|こ|こ|子供|こども
動|on|ドウ|ドウ|動物|どうぶつ
動|kun|うごく|うご.く|動く|うごく
動|kun|うごかす|うご.かす|動かす|うごかす
京|on|キョウ|キョウ|東京|とうきょう
全|on|ゼン|ゼン|全部|ぜんぶ
全|kun|すべて|すべ.て|全て|すべて
目|on|モク|モク|目的|もくてき
目|kun|め|め|目|め
表|on|ヒョウ|ヒョウ|発表|はっぴょう
表|kun|おもて|おもて|表|おもて
表|kun|あらわす|あらわ.す|表す|あらわす
表|kun|あらわれる|あらわ.れる|表れる|あらわれる
戦|on|セン|セン|戦争|せんそう
戦|kun|たたかう|たたか.う|戦う|たたかう
経|on|ケイ|ケイ|経験|けいけん
通|on|ツウ|ツウ|交通|こうつう
通|kun|とおる|とお.る|通る|とおる
通|kun|とおす|とお.す|通す|とおす
通|kun|かよう|かよ.う|通う|かよう
外|on|ガイ|ガイ|外国|がいこく
外|kun|そと|そと|外|そと
外|kun|ほか|ほか|外|ほか
外|kun|はずす|はず.す|外す|はずす
外|kun|はずれる|はず.れる|外れる|はずれる
最|on|サイ|サイ|最近|さいきん
最|kun|もっとも|もっと.も|最も|もっとも
言|on|ゲン|ゲン|言語|げんご
言|kun|いう|い.う|言う|いう
言|kun|こと|こと|言葉|ことば
氏|on|シ|シ|氏名|しめい
氏|kun|うじ|うじ|氏|うじ
現|on|ゲン|ゲン|現在|げんざい
現|kun|あらわれる|あらわ.れる|現れる|あらわれる
現|kun|あらわす|あらわ.す|現す|あらわす
理|on|リ|リ|理由|りゆう
調|on|チョウ|チョウ|調査|ちょうさ
調|kun|しらべる|しら.べる|調べる|しらべる
体|on|タイ|タイ|体験|たいけん
体|kun|からだ|からだ|体|からだ
化|on|カ|カ|文化|ぶんか
化|on|ケ|ケ|化粧|けしょう
化|kun|ばける|ば.ける|化ける|ばける
田|on|デン|デン|水田|すいでん
田|kun|た|た|田|た
当|on|トウ|トウ|本当|ほんとう
当|kun|あたる|あ.たる|当たる|あたる
当|kun|あてる|あ.てる|当てる|あてる
八|on|ハチ|ハチ|八月|はちがつ
八|kun|やっつ|やっ.つ|八つ|やっつ
六|on|ロク|ロク|六月|ろくがつ
六|kun|むっつ|むっ.つ|六つ|むっつ
約|on|ヤク|ヤク|約束|やくそく
主|on|シュ|シュ|主人|しゅじん
主|kun|おも|おも|主に|おもに
主|kun|ぬし|ぬし|持ち主|もちぬし
題|on|ダイ|ダイ|問題|もんだい
下|on|カ|カ|以下|いか
下|on|ゲ|ゲ|下車|げしゃ
下|kun|した|した|下|した
下|kun|さげる|さ.げる|下げる|さげる
下|kun|さがる|さ.がる|下がる|さがる
下|kun|くだる|くだ.る|下る|くだる
下|kun|くださる|くだ.さる|下さる|くださる
下|kun|おりる|お.りる|下りる|おりる
首|on|シュ|シュ|首相|しゅしょう
首|kun|くび|くび|首|くび
意|on|イ|イ|意味|いみ
法|on|ホウ|ホウ|方法|ほうほう
図|on|ズ|ズ|地図|ちず
図|on|ト|ト|図書館|としょかん
図|kun|はかる|はか.る|図る|はかる
食|on|ショク|ショク|食事|しょくじ
食|kun|たべる|た.べる|食べる|たべる
食|kun|くう|く.う|食う|くう
""".strip()


PHONETIC_COMPONENTS = {
    "们": ("门／門", "mén"),
    "吗": ("马／馬", "mǎ"),
    "想": ("相", "xiāng / xiàng"),
    "现": ("见／見", "jiàn"),
    "妈": ("马／馬", "mǎ"),
}

INTEGRATED_CUES = {
    "你": "A knee dips and rises inside the existing scene, cueing third-tone nǐ.",
    "是": "She drops sharply into the scene, cueing fourth-tone shì.",
    "不": "A quick “boo!” falls through the scene, cueing fourth-tone bù.",
    "有": "A yo-yo dips and rises, tracing third-tone yǒu.",
    "太": "A tie drops sharply across the scene, cueing fourth-tone tài.",
    "听": "A bell's ting stays high and level, cueing tīng.",
    "走": "A zooming figure dips and rises along the path, cueing zǒu.",
}

SURFACE_NOTES = {
    ("出", "シュツ", "出発"): ("しゅっ", "促音化 shortens シュツ to しゅっ before 発."),
    ("発", "ハツ", "出発"): ("ぱつ", "After the sokuon in しゅっ, ハツ surfaces as ぱつ."),
    ("実", "ジツ", "実際"): ("じっ", "ジツ undergoes common 促音化 to じっ before 際."),
    ("決", "ケツ", "決定"): ("けっ", "ケツ undergoes common 促音化 to けっ before 定."),
    ("表", "ヒョウ", "発表"): ("ぴょう", "After the sokuon in はっ, ヒョウ surfaces as ぴょう."),
}

GLOSS_OVERRIDES = {
    # Repository dictionary senses are authoritative for readings, but a few
    # headwords select a proper-name or homographic first gloss that is poor
    # learner-facing copy. These concise overrides were checked manually.
    ("zh", "下面", "xià"): "below; underneath",
    ("zh", "个", "gè"): "general measure word",
    ("zh", "事情", "shì"): "matter; affair",
    ("zh", "行动", "xíng"): "action",
    ("zh", "当然", "dāng"): "of course",
    ("zh", "起来", "qǐ"): "to rise; upward complement",
    ("zh", "的", "de"): "possessive and attributive particle",
    ("zh", "和平", "hé"): "peace",
    ("zh", "得", "de"): "structural particle after a verb",
    ("zh", "过去", "qù"): "past; formerly",
    ("zh", "过去", "guò"): "past; to pass",
    ("zh", "过", "guo"): "experiential aspect particle",
    ("zh", "给", "gěi"): "to give; for",
    ("zh", "对不起", "duì"): "sorry",
    ("zh", "吧", "ba"): "suggestion or softening particle",
    ("zh", "听说", "tīng"): "to hear; it is said",
    ("zh", "只", "zhī"): "classifier for animals and one of a pair",
    ("zh", "太", "tài"): "too; very",
    ("zh", "多少", "duō"): "how many; how much",
    ("zh", "然后", "rán"): "then; afterward",
    ("zh", "把", "bǎ"): "disposal marker; to hold",
    ("zh", "没有", "yǒu"): "to not have; there is no",
    ("zh", "睡觉", "jiào"): "to sleep",
    ("ja", "以上", "ジョウ"): "at least; above",
    ("ja", "以下", "カ"): "at most; below",
    ("ja", "下車", "ゲ"): "to get off a vehicle",
    ("ja", "下げる", "さげる"): "to lower",
    ("ja", "下がる", "さがる"): "to go down",
    ("ja", "下さる", "くださる"): "to give (honorific)",
    ("ja", "下りる", "おりる"): "to go down; get off",
    ("ja", "主人", "シュ"): "husband; master",
    ("ja", "時代", "ダイ"): "era; period",
    ("ja", "体験", "タイ"): "experience",
    ("ja", "入学", "ニュウ"): "entering school",
    ("ja", "国内", "ナイ"): "domestic; within the country",
    ("ja", "化ける", "ばける"): "to transform; disguise oneself",
    ("ja", "市民", "シ"): "citizen",
    ("ja", "学生", "ガク"): "student",
    ("ja", "力", "ちから"): "strength; power",
    ("ja", "戦う", "たたかう"): "to fight",
    ("ja", "当たる", "あたる"): "to hit; be correct",
    ("ja", "当てる", "あてる"): "to hit; guess correctly",
    ("ja", "後", "あと"): "after; later",
    ("ja", "明ける", "あける"): "to dawn; to end",
    ("ja", "生ビール", "なま"): "draft beer",
    ("ja", "米国", "ベイ"): "United States",
    ("ja", "連絡", "レン"): "contact",
    ("ja", "通す", "とおす"): "to pass through",
}


def parse_rows(data: str, width: int) -> list[list[str]]:
    rows = [line.split("|") for line in data.splitlines() if line.strip()]
    if any(len(row) != width for row in rows):
        raise ValueError("malformed editorial row")
    return rows


def load_chinese_index() -> dict[tuple[str, str], dict]:
    result = {}
    with (ROOT / "data/chinese_dictionary_word_2025-06-25.jsonl").open(encoding="utf-8") as handle:
        for line in handle:
            row = json.loads(line)
            for item in row.get("items") or []:
                if not item.get("pinyin"):
                    continue
                normalized = corpus.normalize_pinyin_phrase(item["pinyin"])
                for word in {row["simp"], row["trad"]}:
                    result[(word, normalized)] = row
    return result


def load_jpdb() -> dict[tuple[str, str], int]:
    result = {}
    with (ROOT / "data/jpdb_v2.2_freq_list_2024-10-13.csv").open(
        encoding="utf-8-sig", newline=""
    ) as handle:
        for row in csv.DictReader(handle, delimiter="\t"):
            key = (row["term"], corpus.normalize_japanese_reading(row["reading"]))
            rank = int(row["frequency"])
            result[key] = min(result.get(key, rank), rank)
    return result


def frequency(source: str, rank: int | None, field: str) -> dict:
    value = {"source": source, "field": field}
    if rank is not None:
        value["rank"] = rank
    else:
        value["usefulness"] = "authoritative modern dictionary headword"
    return value


def short_gloss(value: str | None) -> str:
    text = (value or "common modern usage").strip()
    return text if len(text) <= 120 else text[:117].rstrip() + "…"


def chinese_cards(targets: dict) -> list[dict]:
    by_character: dict[str, list[list[str]]] = {}
    for row in parse_rows(ZH_DATA, 4):
        by_character.setdefault(row[0], []).append(row)
    target_by_character = {entry["identity"]: entry for entry in targets["entries"]}
    expected = set(target_by_character) | {"行"}
    if set(by_character) != expected:
        raise ValueError(f"Chinese editorial coverage mismatch: {set(by_character) ^ expected}")
    word_index = load_chinese_index()
    cards = []
    templates = {
        1: "{word} holds {display} high and level: “{gloss}.”",
        2: "In {word}, {display} rises toward “{gloss}.”",
        3: "Let {word} trace {display} down and back up: “{gloss}.”",
        4: "{word} gives {display} a decisive falling stroke: “{gloss}.”",
        5: "In {word}, {display} lands lightly and unstressed: “{gloss}.”",
    }
    for character in sorted(by_character, key=ord):
        target = target_by_character.get(character)
        variants = target["variants"] if target else [character]
        readings = []
        for _, display, word, word_reading in by_character[character]:
            normalized_word = corpus.normalize_pinyin_phrase(word_reading)
            row = word_index[(word, normalized_word)]
            stats = row.get("statistics") or {}
            gloss = GLOSS_OVERRIDES.get(
                ("zh", word, display), short_gloss(row.get("gloss"))
            )
            normalized = corpus.normalize_pinyin_syllable(display)
            tone = int(normalized[-1])
            strategy = "word_anchor"
            overlay = templates[tone].format(
                word=word, display=display, gloss=gloss
            )
            reading = {
                "reading_type": "mandarin",
                "display_reading": display,
                "normalized_reading": normalized,
                "status": "core",
                "usage_gloss": gloss,
                "editorial_reason": f"Promoted because {word} is a common modern anchor for this distinct reading.",
                "strategy": strategy,
                "overlay": overlay,
                "tone": tone,
                "sound_cue": {
                    "syllable": normalized[:-1],
                    "tone_behavior": corpus.TONE_BEHAVIORS[tone],
                },
                "anchors": [
                    {
                        "word": word,
                        "reading": word_reading,
                        "character_reading": display,
                        "gloss": gloss,
                        "frequency": frequency(
                            "chinese_dictionary_word_2025-06-25.jsonl",
                            stats.get("movieWordRank"),
                            "statistics.movieWordRank",
                        ),
                    }
                ],
            }
            if character in PHONETIC_COMPONENTS:
                component, component_reading = PHONETIC_COMPONENTS[character]
                reading["strategy"] = "phonetic_component"
                reading["phonetic_component"] = {
                    "character": component,
                    "reading": component_reading,
                    "relationship": "The repository character source classifies this component as sound-bearing; the anchor fixes the modern reading and tone.",
                    "source": "chinese_dictionary_char_2025-06-25.jsonl components[].type=sound",
                }
                reading["overlay"] = (
                    f"{component} carries the sound family; {word} fixes the modern form as {display}, "
                    f"with the {corpus.TONE_BEHAVIORS[tone].replace('_', ' ')} tone path."
                )
            elif character in INTEGRATED_CUES:
                reading["strategy"] = "integrated_sound_cue"
                reading["overlay"] = f"{INTEGRATED_CUES[character]} Anchor it in {word} — {gloss}."
            if character == "不":
                reading["overlay"] += " Before another fourth tone it commonly surfaces as bú; bù remains the canonical reading."
            if character == "一":
                reading["overlay"] += " In connected speech yī often becomes yí before a fourth tone or yì before first, second, or third tone."
            readings.append(reading)
        cards.append(
            {
                "character": character,
                "variants": variants,
                "language": "zh",
                "target_rank": target["rank"] if target else None,
                "selection_note": (
                    "Top-100 movieCharRank target"
                    if target
                    else "Reviewed regression extension: polyphonic 行"
                ),
                "review_status": "reviewed",
                "confidence": "high",
                "sources": [
                    {
                        "path": "data/chinese_dictionary_char_2025-06-25.jsonl",
                        "supports": ["character frequency", "canonical readings", "variants", "sound components"],
                    },
                    {
                        "path": "data/chinese_dictionary_word_2025-06-25.jsonl",
                        "supports": ["anchor readings", "glosses", "word frequency"],
                    },
                ],
                "readings": readings,
            }
        )
    return cards


def japanese_cards(targets: dict) -> list[dict]:
    by_character: dict[str, list[list[str]]] = {}
    for row in parse_rows(JA_DATA, 6):
        by_character.setdefault(row[0], []).append(row)
    target_by_character = {entry["identity"]: entry for entry in targets["entries"]}
    expected = set(target_by_character) | {"図", "食"}
    if set(by_character) != expected:
        raise ValueError(f"Japanese editorial coverage mismatch: {set(by_character) ^ expected}")
    evidence = corpus.Evidence()
    jpdb = load_jpdb()
    on_templates = [
        "Attach {display} to the semantic scene through {word}（{kana}）—“{gloss}.”",
        "The compound {word}（{kana}）locks in On {display}: “{gloss}.”",
        "Reuse the scene in {word}（{kana}）; its On sound is {display} and its meaning is “{gloss}.”",
    ]
    kun_templates = [
        "Keep the semantic image, then recall the complete word {word}（{kana}）—“{gloss}.”",
        "Kun {display} lives in the full lexeme {word}（{kana}）: “{gloss}.”",
        "Anchor the native reading with the complete lexeme {word}（{kana}）: “{gloss}.”",
    ]
    cards = []
    for character in sorted(by_character, key=ord):
        target = target_by_character.get(character)
        readings = []
        for index, (_, reading_type, display, source_reading, word, kana) in enumerate(
            by_character[character]
        ):
            gloss = GLOSS_OVERRIDES.get(
                ("ja", word, display),
                short_gloss(
                    evidence.japanese_words[(word, corpus.normalize_japanese_reading(kana))]
                ),
            )
            templates = on_templates if reading_type == "on" else kun_templates
            overlay = templates[(ord(character) + index) % len(templates)].format(
                display=display, word=word, kana=kana, gloss=gloss
            )
            surface, note = SURFACE_NOTES.get(
                (character, display, word),
                (corpus.normalize_japanese_reading(display), None),
            )
            if reading_type == "kun":
                # KANJIDIC's dot separates the character-bearing stem from
                # okurigana. Keep that stem as character_reading while the
                # display and anchor fields preserve the complete lexeme.
                surface = corpus.normalize_japanese_reading(
                    source_reading.split(".", 1)[0].rstrip("-")
                )
            anchor = {
                "word": word,
                "reading": kana,
                "character_reading": surface,
                "gloss": gloss,
                "frequency": frequency(
                    "jpdb_v2.2_freq_list_2024-10-13.csv",
                    jpdb.get((word, corpus.normalize_japanese_reading(kana))),
                    "frequency",
                ),
            }
            if note:
                anchor["phonological_note"] = note
            readings.append(
                {
                    "reading_type": reading_type,
                    "display_reading": display,
                    "normalized_reading": corpus.normalize_japanese_reading(display),
                    "source_reading": source_reading,
                    "status": "core",
                    "usage_gloss": gloss,
                    "editorial_reason": f"Promoted because {word}（{kana}）is common, modern, and pedagogically useful.",
                    "strategy": "word_anchor",
                    "overlay": overlay,
                    "anchors": [anchor],
                }
            )
        cards.append(
            {
                "character": character,
                "variants": [character],
                "language": "ja",
                "target_rank": target["rank"] if target else None,
                "selection_note": (
                    "Top-100 KANJIDIC usage-frequency target"
                    if target
                    else f"Reviewed regression extension: {character}"
                ),
                "review_status": "reviewed",
                "confidence": "high",
                "sources": [
                    {
                        "path": "data/kanjidic2-en-3.6.1.json",
                        "supports": ["usage rank", "on readings", "kun readings"],
                    },
                    {
                        "path": "data/jmdict-examples-eng-3.6.1.json",
                        "supports": ["complete word readings", "okurigana", "glosses"],
                    },
                    {
                        "path": "data/jpdb_v2.2_freq_list_2024-10-13.csv",
                        "supports": ["anchor-word usefulness rank"],
                    },
                ],
                "readings": readings,
            }
        )
    return cards


def main() -> None:
    corpus_dir = corpus.DEFAULT_CORPUS_DIR
    targets = corpus.load_targets(corpus_dir)
    cards = chinese_cards(targets["zh"]) + japanese_cards(targets["ja"])
    result = corpus.publish_cards(cards, corpus_dir)
    print(
        json.dumps(
            {
                key: result[key]
                for key in (
                    "card_count",
                    "unique_character_count",
                    "core_reading_counts",
                    "strategy_counts",
                )
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
