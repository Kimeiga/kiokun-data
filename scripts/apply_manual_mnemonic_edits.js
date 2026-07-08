#!/usr/bin/env node

const fs = require("fs");

const artifactPath = "sveltekit-app/static/research/mnemonics/semantic_mnemonics_1000_refined_pairs_gemini35.json";
const evalPath = "sveltekit-app/static/research/mnemonics/semantic_mnemonics_1000_refined_pairs_gemini35_eval.json";

const componentGlossOverrides = {
  "龰": "foot",
  "𠔼": "cover",
  "龴": "top hook",
  "直": "straight",
  "𦥑": "mortar",
  "殳": "hand tool",
  "杀": "cut mark",
};

const manualMnemonics = {
  "足": `A 口 mouth points down toward a 龰 foot to mark the 足 lower leg.`,
  "従": `A 彳 step through the 䒑 grass top lands behind another 龰 foot, showing how to 従 follow.`,
  "興": `When 一 one 𦥑 mortar sits under a 𠔼 cover and 八 eight helpers cheer with 口 mouth, the room fills with 興 excitement.`,
  "疑": `A 龴 top hook catches on a 疋 roll-of-cloth, making the buyer pause in 疑 doubt.`,
  "値": `A 亻 person (side) gives a 直 straight answer to state the 値 cost.`,
  "緒": `A 者 person ties the first 糸 silk strand, marking the 緒 inception of the work.`,
  "走": `A 龰 foot presses into 土 earth as the body begins to 走 walk.`,
  "同": `A 𠔼 cover over one 口 mouth makes every answer sound 同 same.`,
  "夜": `A 亻 person (side) under a 亠 lid follows a 丶 dot while they 夂 walk through 夜 night.`,
  "歌": `The 哥 older brother opens his 欠 deficient voice and turns it into a 歌 song.`,
  "使": `A 亻 person (side) takes instructions from 吏 government and learns how to 使 use the tool.`,
  "訪": `You 言 say a greeting in the right 方 direction when you 訪 call on a friend.`,
  "花": `The 艹 grass (top) begins to 化 transform into a 花 flower.`,
  "楽": `A 白 white note resting by a 木 tree starts simple 楽 music.`,
  "詩": `Inside a 寺 temple, you 言 say a line that becomes a 詩 poem.`,
  "美": `A 大 big 𦍌 sheep stands calmly as the image of 美 beautiful.`,
  "図": `A 囗 enclosure frames a clear 図 picture.`,
  "展": `A 尸 sitting person uses 一 one 𠄌 diagonal hook and a 丿 slash to pull a 乀 stretch across the 卄 twentieth fold and 展 unfold the sheet.`,
  "散": `A 攵 tap breaks the 卄 twentieth 一 one piece from the ⺼ meat (side), leaving the bits 散 scattered.`,
  "振": `A 扌 hand (side) touches the 辰 sign of the dragon and feels it 振 vibrate.`,
  "栄": `A 木 tree standing at the center of a courtyard gives the place 栄 glory.`,
  "京": `A 亠 lid over a 口 mouth with a 小 small gate marks the entrance to the 京 capital.`,
  "限": `A ⻖ mound (left) blocks the 艮 stubborn traveler at the 限 limit.`,
  "撃": `A 手 hand uses a 殳 hand tool beside a 車 vehicle to 撃 beat a steady rhythm.`,
  "盛": `A 皿 dish begins to 成 turn into a full meal, showing 盛 flourishing.`,
  "農": `A farmer follows a 曲 bent row beneath the 辰 sign of the dragon while practicing 農 agriculture.`,
  "鬼": `A 甶 human's head on a 人 person hiding a 厶 secret gives the shape of a 鬼 ghost.`,
  "設": `You 言 say the plan, then use a 殳 hand tool to 設 establish the frame.`,
  "殿": `A 𡱒 buttocks rests by a 殳 hand tool inside the 殿 ceremonial hall.`,
  "役": `Each 彳 step with a 殳 hand tool becomes daily 役 service.`,
  "重": `A 亻 person (side) returning from 東 east carries a 重 heavy pack.`,
  "蔵": `In 茂 lush storage, a 臣 watchful eye guards what the owner will 蔵 hoard.`,
  "宮": `A 宀 roof over a 呂 spine-like row of rooms forms a 宮 palace.`,
  "医": `The 医 physician opens a 匚 box (open) and chooses a 矢 dart for treatment.`,
  "為": `A 又 hand guides a 象 elephant through each motion to 為 act.`,
  "震": `When 雨 rain strikes the 辰 sign of the dragon, the ground begins to 震 quake.`,
  "天": `A 大 big figure stands beneath 一 one line of sky, pointing up to 天 heaven.`,
  "件": `A 亻 person (side) counts one 牛 cow as a single 件 piece in the ledger.`,
  "見": `A 目 eye on 儿 human legs moves around to 見 see.`,
  "裁": `A 裁 tailor covers a 𢦏 wound with fitted 衣 clothing.`,
  "容": `A 宀 roof over a 谷 valley can 容 contain a village.`,
  "登": `癶 legs step over 豆 beans to 登 ascend the platform.`,
  "江": `氵 water (drops) beside steady 工 work marks the 江 Yangtze.`,
  "像": `A 亻 person (side) studies a 象 elephant to carve its 像 likeness.`,
  "樹": `A 木 tree left 尌 standing in the yard will become 樹 timber.`,
  "技": `A 扌 hand (side) trains on a 支 offshoot until the motion becomes 技 skill.`,
  "暴": `On a hot 日 day, people 共 together splash 氺 water in a sudden 暴 violent outburst.`,
  "衆": `A 衆 crowd forms when 乑 people standing side-by-side gather around shared 血 blood.`,
  "爆": `A 火 fire meeting a 暴 violent force makes the pot 爆 explode.`,
  "委": `A 女 woman checks the 禾 standing grain for the 委 committee.`,
  "殺": `A 杀 cut mark beside a 殳 hand tool warns of an intent to 殺 kill.`,
  "投": `A 扌 hand (side) swings a 殳 hand tool forward to 投 throw.`,
  "闘": `At the 門 gate, two workers argue over a 𭔰 beans measure until a 闘 fight starts.`,
  "開": `廾 two hands lift the 閂 latch to 開 open the gate.`,
  "術": `You 行 go through each motion with 术 skill until it becomes 術 art.`,
  "雄": `An 厷 forearm lifts a 隹 short-tailed bird in a pose of 雄 grand strength.`,
  "岩": `A 石 stone resting on a 山 mountain forms 岩 rock.`,
  "太": `Adding a 丶 dot to something 大 big makes it 太 overly full.`,
  "述": `A 辶 movement guided by 术 skill helps the speaker 述 narrate the path.`,
  "段": `A 殳 hand tool strikes the boards to mark the next 段 stage.`,
  "般": `A 舟 boat carries one 殳 hand tool of each 般 sort.`,
  "魔": `A 鬼 ghost tangled in 麻 hemp becomes a 魔 demon.`,
  "血": `A 丿 slash drips into a 皿 dish, marking 血 blood.`,
  "船": `A 舟 boat with a painted 口 mouth at the bow becomes a 船 ship.`,
  "襲": `A 龍 dragon pulls on 衣 clothing during a sudden 襲 raid.`,
  "号": `A 口 mouth calls through a 丂 axe handle like a signpost to give a 号 appellation.`,
  "渡": `氵 water (drops) must cross at the right 度 degree for the 渡 ferry.`,
  "教": `A lesson uses 孝 filial piety and a gentle 攵 tap to 教 teach.`,
  "度": `Under a 广 roof, 廿 twenty marks line up with the 又 hand to set the 度 degree.`,
  "量": `At 旦 dawn, measuring one 里 li shows the day's 量 quantity.`,
  "繰": `糸 silk turns on the reel while 喿 chirping of birds marks the rhythm to 繰 reel silk.`,
  "領": `令 orders keep the 頁 head aligned above the 領 collar.`,
  "廃": `Under a 广 roof, workers 発 send out old boards to 廃 abrogate the site.`,
  "算": `竹 bamboo rods line up before a 目 eye while 廾 two hands move them to 算 calculate.`,
  "真": `十 ten checks with a 具 tool make the result 真 true.`,
  "局": `A 尸 sitting person behind a 𠃌 wrap speaks through a 口 mouth inside the 局 bureau.`,
  "訳": `A 尺 ruler measures what people 言 say so you can 訳 translate it.`,
  "解": `Turning the knot at the right 角 angle lets you 解 untie it.`,
  "午": `A 𠂉 hair tuft above 十 ten marks 午 noon.`,
  "察": `Under the 宀 roof, the priest prepares to 祭 offer sacrifice and 察 scrutinize the altar.`,
  "甘": `A ◎ marker inside the 口 mouth shows where 甘 sweet taste lands.`,
  "屋": `A 尸 sitting person waits 至 until morning inside the 屋 habitation.`,
  "議": `People 言 say what follows 義 righteousness when they 議 deliberate.`,
  "護": `言 say the boundary and 蒦 measure the gate to 護 protect it.`,
  "釣": `A 金 gold hook dips from a 勺 ladle at a 釣 angle.`,
  "半": `八 eight portions from one 牛 cow are split into 半 half.`,
  "里": `A 田 rice field set into 土 earth marks one 里 li.`,
  "眼": `A 目 eye presses against a 艮 stubborn knot to find the 眼 eyelet.`,
  "仲": `A 亻 person (side) stands in the 中 middle as the 仲 mid- point.`,
  "視": `示 show the sign and 見 see it clearly to 視 inspect.`,
  "敷": `First 旉 state to where the plaster goes, then 攵 tap it flat to 敷 apply.`,
  "玉": `A 丶 dot inside the ◎ marker marks 玉 jade.`,
  "齢": `歯 teeth checked under 令 orders reveal 齢 age.`,
  "読": `You 言 say the words from a 売 sell sign when you 読 read.`,
  "養": `Give 食 food to a 𦍌 sheep to 養 raise it.`,
  "位": `A 亻 person (side) 立 standing up holds their 位 position.`,
  "平": `A ◎ marker on the 丂 axe handle helps keep the line 平 even.`,
  "事": `A 又 hand places an ◎ marker to note the 事 matter.`,
  "与": `一 one gift held forward becomes an 与 offer.`,
  "音": `A ◎ marker on what you 言 say fixes the 音 sound.`,
  "令": `A 亽 person mark under a 龴 top hook receives 令 orders.`,
  "律": `Each 彳 step follows the 聿 writing of 律 law.`,
  "記": `You 言 say a note to your 己 self to 記 remember.`,
  "法": `氵 water (drops) 去 go along the channel, showing a 法 method.`,
  "装": `壮 robust armor under 衣 clothing helps you 装 dress.`,
  "在": `Standing on 土 earth marks where you are 在 at.`,
  "格": `On a 木 tree, 各 each branch follows a 格 pattern.`,
  "央": `An ◎ marker on a 大 big target shows the 央 center.`,
  "憂": `A 頁 head burdened with thoughts and a 心 heart accompany every 夂 walk, bringing 憂 worry.`,
  "理": `A polished 𤣩 jade (alt) beside one 里 li marker gives the judge a clear 理 reason.`,
  "作": `A 亻 person (side) trying 乍 for the first time learns to 作 make a simple tool.`,
  "戦": `A 単 list beside a 戈 halberd records the start of 戦 war.`,
  "声": `A 士 soldier turns through a 𠃜 turn stroke and sends out a clear 声 voice.`,
  "無": `A 𠂉 hair tuft, 卌 fortieth tally, 一 one line, and 灬 fire (bottom) leave 無 nothing behind.`,
  "神": `A 示 show altar and a 申 express sign point toward the 神 gods.`,
  "死": `A 歹 malicious mark beside an 匕 ancient spoon warns that the scene ends in 死 death.`,
  "兵": `On a 丘 hill, 八 eight flags mark where the 兵 troops gather.`,
  "衛": `People 行 go in a circuit wearing 韋 tanned hide to 衛 protect the gate.`,
  "市": `A 亠 lid shades a 巾 towel where goods are laid out in the 市 market.`,
  "様": `A single 木 tree changes the whole scene's 様 appearance.`,
  "第": `A 竹 bamboo tally with a 丿 slash used while people 弔 condole marks the 第 ordinal prefix.`,
  "流": `氵 water (drops) passes a 𠫓 newborn and a 𫶧 semantic form as the river begins to 流 flow.`,
  "然": `A 𠂊 slash stroke opens 冫 ice while a 犬 pooch rests by 灬 fire (bottom), the 然 sort of thing winter brings.`,
  "初": `A 刀 sword trims 衤 clothing (side), giving the work its 初 elementary beginning.`,
  "直": `Ten 十 ten marks in a row show a 直 straight line.`,
  "別": `A 刂 knife (side) at the boundary marks 別 don't cross.`,
  "権": `A tall 木 tree held like a staff signals 権 authority.`,
  "特": `A 牜 an ox at a 寺 temple marks a 特 special offering.`,
  "制": `A 牛 cow, a 冂 large room, and a 刂 knife (side) require a clear 制 system.`,
  "命": `A 口 mouth giving 令 orders can decide someone's 命 fate.`,
  "得": `Each 彳 step toward the 㝵 ancient marker shows what one 得 must do.`,
  "違": `A 辶 movement against the wrapped 韋 tanned hide boundary shows how to 違 disobey.`,
  "置": `A 罒 net (top) hung 直 straight lets you 置 set up a boundary.`,
  "歳": `A 止 stop mark, 戌 11th terrestrial branch, and 小 small tally count 歳 years of age.`,
  "色": `A 爪 claw touches a 卩 person kneeling and leaves a clear 色 color.`,
  "悪": `A 亜 Asia map pressed onto 心 heart gives the story its 悪 evil.`,
  "売": `A 士 soldier opens a 冗 business stall to 売 sell supplies.`,
  "過": `A 辶 movement past a 咼 jaw lets you 過 cross the threshold.`,
  "武": `弋 catch, 一 one line, and 止 stop form the controlled stance of 武 military.`,
  "計": `言 say each of 十 ten steps aloud to make a 計 plan.`,
  "判": `A 刂 knife (side) divides 半 half of the case so the clerk can 判 judge.`,
  "族": `A 矢 dart marks the banner carried by the 族 tribe.`,
  "御": `A 彳 step beside the place to 卸 unload marks the 御 imperial route.`,
  "争": `A ⺈ knife (side) catches on a 亅 hook as two hands 争 contend.`,
  "参": `A strand of 彡 hair is tied to the item you 参 take.`,
  "態": `能 ability held in the 心 heart shapes 態 attitude.`,
  "営": `A 吕 pitchpipe calls people back to the 営 camp.`,
  "介": `A 𠆢 person roof shelters the introduction as people 介 introduce themselves.`,
  "守": `A 宀 roof measured 寸 inch by inch is something to 守 guard.`,
  "任": `A 亻 person (side) carrying the 壬 9th heavenly stem receives the duty to 任 appoint a helper.`,
  "居": `A 尸 sitting person beside an 古 ancient marker chooses to 居 reside there.`,
  "離": `A 离 netted beast startles a 隹 short-tailed bird, making both 離 leave.`,
  "寺": `土 earth measured 寸 inch by inch marks the site of a 寺 temple.`,
  "隊": `Behind a ⻖ mound (left), 丷 split horns and a 豕 boar marker gather into a 隊 team.`,
  "将": `A 丬 piece of wood at 夕 dusk measured by 寸 inch marks the 将 commander position.`,
  "県": `A 𠃊 hidden area with 目 eye, 口 mouth, 乚 turning stroke, and 䖵 insects marks the 県 county map.`,
  "失": `A 丿 slash separates the 夫 husband from the path, making him 失 lose his way.`,
  "泉": `White 白 white 水 water rises from a 泉 spring.`,
  "良": `A 丶 dot softens a 艮 stubborn line into 良 high-quality work.`,
  "職": `An 耳 ear listens while the 戠 sword stays sheathed during the 職 job.`,
  "識": `言 say what the 戠 sword cannot, and the result is 識 knowledge.`,
  "僕": `A 亻 person (side) clears a 菐 thicket while working as 僕 servant.`,
  "苦": `艹 grass (top) growing from 古 ancient soil tastes bitter like 苦 suffering.`,
  "例": `A 亻 person (side) joins a 列 line up to become an 例 example.`,
  "型": `刑 punishment pressed into 土 earth leaves the shape of a 型 mold.`,
  "負": `A 貝 shellfish under a ⺈ knife (side) is the image of 負 defeated.`,
  "福": `示 show the sign and 畐 fill the house with 福 happiness.`,
  "割": `A 刂 knife (side) removes the part causing 害 harm to 割 cut off the damaged branch.`,
  "案": `An 安 peaceful place under a 木 tree becomes a quiet 案 case for review.`,
  "妻": `A 女 woman counts 十 ten rings at the ceremony and becomes 妻 wife.`,
  "宗": `Under a 宀 roof, a 示 show altar marks the 宗 religion.`,
  "越": `A 走 walk past the 戉 battle-axe marker lets you 越 surpass the boundary.`,
  "服": `Every 月 month, tailors 𠬝 submit fabric for 服 apparel.`,
  "接": `A 扌 hand (side) reaches toward the 妾 concubine to 接 welcome her.`,
  "密": `A 宓 silent path inside a 山 mountain keeps the 密 secret.`,
  "規": `A 夫 husband stops to 見 see the written 規 regulations.`,
  "徳": `A 彳 step taken with care becomes 徳 morality.`,
  "志": `A 士 soldier keeps a 心 heart fixed on 志 aspiration.`,
  "辺": `A 辶 movement beside a 刀 sword marker traces the 辺 border.`,
  "系": `A 丿 slash marks the 糸 silk thread of 系 lineage.`,
  "河": `氵 water (drops) gathers where 可 can flow into a 河 large river.`,
  "織": `糸 silk stretched beside a 戠 sword edge is ready to 織 weave.`,
  "娘": `A 女 woman offering 良 high-quality care is called 娘 mom.`,
  "端": `立 standing up at the 耑 specialized edge keeps the post 端 upright.`,
  "探": `A 扌 hand (side) reaches 罙 deep into the drawer to 探 spy.`,
  "犯": `A 犭 dog (side) beside a broken 㔾 seal marks the 犯 criminal.`,
  "舞": `A 𠂉 hair tuft moves through the 卌 fortieth step, 一 one beat at a time without 舛 deviate, making a 舞 dance.`,
  "寝": `Under the 宀 roof, a 丬 piece of wood blocks the door so 𠬶 invade cannot interrupt 寝 get some shuteye.`,
  "婦": `A 女 woman puts away the 帚 broom before greeting the 婦 married woman.`,
  "温": `氵 water (drops) warmed while you 昷 feed a prisoner becomes 温 lukewarm soup.`,
  "載": `A 車 vehicle carrying someone with a 𢦏 wound is 載 laden with care.`,
  "秘": `禾 standing grain hidden where only 必 certainly marked hands can find it remains 秘 mysterious.`,
  "健": `A 亻 person (side) who can 建 build steadily remains 健 healthy.`,
  "隠": `Behind a ⻖ mound (left), 爫 claw (top), 彐 snout, and 心 heart all 隠 hide from view.`,
  "夢": `Under 艹 grass (top), a closed ⺫ eye (side), 冖 cover, and 夕 dusk draw the sleeper into a 夢 dream.`,
  "環": `A 𤣩 jade (alt) that people 睘 stare at circles into an 環 ring.`,
  "故": `A 古 ancient bell gives a soft 攵 tap when the action is 故 deliberately done.`,
  "弟": `A 丿 slash above 丷 split horns and 弔 condole marks the duty of a 弟 younger brother.`,
  "刊": `干 offend words meet a 刂 knife (side) editor before 刊 publication.`,
  "焼": `火 fire under 尭 a legendary ancient makes the room feel like 焼 fever.`,
  "罪": `A 罒 net (top) over 非 non- conduct marks 罪 guilt.`,
  "亡": `A 刀 sword beside an ◎ marker marks someone 亡 deceased.`,
  "掛": `A 扌 hand (side) lifts the 卦 trigram scroll to 掛 hang it on the wall.`,
  "怒": `A 奴 slave presses a wounded 心 heart into 怒 anger.`,
  "列": `A 歹 malicious mark and 刂 knife (side) separate items into a 列 line up.`,
  "弾": `A 弓 bow beside a 単 list marks the stored 弾 bullet.`,
  "払": `A 扌 hand (side) moves in 厶 secret to 払 caress the cloth.`,
  "超": `A 走 walk toward a voice that will 召 summon you helps you 超 transcend the path.`,
  "含": `A 口 mouth holding 今 now's thought can 含 harbor it quietly.`,
  "抗": `A 扌 hand (side) raised before a 亢 proud wall begins to 抗 combat the pressure.`,
  "劇": `A 豦 wild boar beside a 刂 knife (side) prop creates 劇 drama on stage.`,
  "傷": `A 亻 person (side) marked by 𬀷 injure carries a 傷 wound.`,
  "刺": `A 朿 stab beside a 刂 knife (side) feels like a 刺 thorn.`,
  "刑": `A 刂 knife (side) at the court where they 开 initiate judgment signals 刑 punishment.`,
  "脱": `A 兑 cash token buys a wrapper around ⺼ meat (side) that you 脱 take off before cooking.`,
  "陣": `A 車 vehicle parked behind a ⻖ mound (left) marks the 陣 battle formation.`,
  "迫": `A 辶 movement toward a 白 white marker begins to 迫 compel the crowd forward.`,
  "窓": `A 穴 hole with 厶 secret light and a 心 heart behind it becomes a 窓 shutter.`,
  "討": `言 say every 寸 inch of the complaint to 討 condemn the act.`,
  "剣": `A 人 person keeps a 口 mouth closed while carrying a 刂 knife (side) as a 剣 saber.`,
  "壊": `土 earth, 十 ten marks, an ⺫ eye (side), and 衣 clothing all fall together as the scene begins to 壊 Spoil.`,
  "創": `A 刂 knife (side) opens the 倉 storehouse so the workshop can 創 initiate a project.`,
  "儀": `A 亻 person (side) following 義 righteousness performs the 儀 rite.`,
  "占": `Inside a 囗 enclosure, ⺊ divination marks where people 占 tell fortunes.`,
  "那": `A 刀 sword points between 二 two gates of the ⻏ city (right) to mark 那 that.`,
  "核": `A 木 tree with the 亥 sign of the hog carved in its center marks the 核 nucleus.`,
  "哲": `A 口 mouth pauses at a 折 discount sign and asks like a 哲 philosopher.`,
  "沈": `氵 water (drops) 冘 move on across the sign marked 沈 Shen.`,
  "銃": `金 gold and 充 sufficient metal are shaped into a 銃 gun.`,
  "到": `Travel 至 until you meet the 刂 knife (side) marker and 到 arrive at the edge.`,
  "券": `龹 raised hands lift a paper cut by a 刀 sword to show the 券 voucher.`,
  "祭": `A 𠂊 slash stroke opens 冫 ice to 示 show the place for 祭 offer sacrifice.`,
  "脳": `⺼ meat (side) protected around a 凶 sinister signal marks the 脳 brain.`,
  "融": `Warmth from a 鬲 type of cauldron loosens frozen 虫 insects until they 融 melt.`,
  "快": `A 忄 heart (side) suddenly 夬 parted makes the pulse 快 fast.`,
  "拠": `A 扌 hand (side) marks the 処 location you 拠 occupy.`,
  "堀": `Digging 土 earth where the bank 屈 knuckle under forms a 堀 moat.`,
  "辞": `A 舌 tongue touched by 辛 peppery words creates sharp 辞 phraseology.`,
  "幹": `At 𠦝 sunrise, a 𠆢 person roof shields the tree from 干 offend marks on the 幹 trunk.`,
  "混": `氵 water (drops) poured among 昆 descendants helps 混 mix them in the same pool.`,
  "徴": `With every 彳 step up the 山 mountain, the 王 king gives a 攵 tap to 徴 levy the tax.`,
  "詰": `言 say a 吉 lucky explanation when asked to 詰 interrogate.`,
  "順": `A 頁 head follows the 川 river path to 順 obey the current.`,
  "隣": `A ⻖ mound (left) beside a 粦 will-o'-the wisp marks the 隣 adjacent field.`,
  "尊": `An 酋 chieftain measured 寸 inch by inch becomes someone people 尊 venerate.`,
  "漢": `氵 water (drops) and a 𦰩 sigh mark the long road to 漢 Han.`,
  "盗": `The 次 next 皿 dish moved in secret marks 盗 steal.`,
  "仮": `A 亻 person (side) acting 反 against truth creates 仮 falsehood.`,
  "慣": `A 忄 heart (side) meets 貫 pierce again and again until it becomes 慣 accustomed to it.`,
  "斬": `A 斤 catty blade strikes a 車 vehicle axle to 斬 hew it apart.`,
  "威": `At the 戌 11th terrestrial branch, a 女 woman stands firm with 威 might.`,
  "屈": `A 尸 sitting person near the 出 exit bends low to 屈 knuckle under and pass through.`,
  "艦": `A 舟 boat under 監 supervise becomes a 艦 warship.`,
  "虎": `A 虍 tiger (top) above 儿 human legs forms 虎 tiger.`,
  "射": `A 身 somebody measures 寸 inch from the target before they 射 shoot.`,
  "園": `A 囗 enclosure with a 袁 loincloth marker surrounds the 園 park.`,
  "管": `A 竹 bamboo tube held by a 官 bureaucrat becomes a 管 pipe.`,
  "療": `Under 疒 sickness, a bright 尞 burnt offering marks the moment of 療 cure.`,
  "策": `A 竹 bamboo pointer makes a 朿 stab on the map to show the 策 strategy.`,
  "司": `A 𠃌 wrap around a 𠮛 mouth marks who will 司 take charge of the room.`,
  "監": `A 臣 watchful eye, 𠂉 hair tuft, 一 one line, and 皿 dish help 監 supervise the checklist.`,
  "妙": `A 女 woman needs only 少 few steps to reveal a 妙 wonderful trick.`,
  "忘": `When 亡 deceased memories leave the 心 heart, you 忘 forget.`,
  "因": `A 大 big shape inside a 囗 enclosure becomes the 因 cause of the squeeze.`,
  "折": `A 扌 hand (side) marks a 斤 catty cut to create an 折 discount.`,
  "骨": `A 冎 bone under ⺼ meat (side) sketches the 骨 skeleton beneath the body.`,
  "聖": `When words 呈 submit through an 耳 ear, the listener treats them as 聖 holy.`,
  "年": `A 人 person harvests 禾 standing grain once each 年 year.`,
  "国": `A 囗 enclosure around 玉 jade marks the protected 国 country.`,
  "者": `An 耂 old (top) figure under the 日 day sun stands for 者 person.`,
  "的": `A 白 white mark on a 勺 ladle gives you a clear 的 target.`,
  "合": `亼 assemble the lid over a 口 mouth so the pieces 合 fit.`,
  "経": `A 圣 sage binds 糸 silk around a scroll of 経 scripture.`,
  "員": `A 口 mouth counts 貝 shellfish for the 員 employee ledger.`,
  "村": `A 木 tree measured by 寸 inch marks the edge of the 村 village.`,
  "調": `言 say around the 周 circumference of the room to set the 調 tune.`,
  "続": `糸 silk tied to the 売 sell tag lets the shop 続 continue.`,
  "師": `Inside the 𠂤 store, people sit in a 帀 round circle around the 師 teacher.`,
  "消": `氵 water (drops) makes the flame 肖 resemble smoke as it begins to 消 extinguish.`,
  "芸": `艹 grass (top) whistles as people 云 utter a rhythm for 芸 technique.`,
  "球": `A 𤣩 jade (alt) shaped by 求 request becomes a 球 ball.`,
  "鉄": `A 金 gold ingot marked 失 lose is replaced by 鉄 iron.`,
  "銀": `金 gold beside a 艮 stubborn pale metal points to 銀 silver.`,
  "街": `People 行 go along a 圭 jade pointed at top marker in the 街 street.`,
  "軽": `A 車 vehicle carrying a 圣 sage rolls as 軽 light as wood.`,
  "録": `A 金 gold sheet pressed 录 down leaves a 録 copy.`,
  "礼": `示 show a bow with a 乚 turning stroke during the 礼 ceremony.`,
  "給": `糸 silk threads 合 fit together before you 給 give the cloth.`,
  "講": `言 say a lesson in 冓 a secluded place to 講 lecture.`,
  "典": `A 冊 volume held by 廾 two hands becomes the 典 canon.`,
  "功": `工 work backed by 力 power leads to 功 achievement.`,
  "床": `Under a 广 roof, a 木 tree frame becomes a 床 bed.`,
  "宝": `玉 jade kept under a 宀 roof becomes 宝 treasure.`,
  "審": `Under a 宀 roof, every 番 try is checked with 審 painstaking care.`,
  "仁": `A 亻 person (side) standing with 二 two others shows 仁 benevolence.`,
  "部": `A 咅 spit mark at the ⻏ city (right) gate labels one 部 section.`,
  "物": `A 牜 an ox beside the 勿 not sign marks the 物 thing to set aside.`,
  "当": `A ⺌ small (top) cap over a 彐 snout marks what will 当 work as the pointer.`,
  "性": `忄 heart (side) joined with 生 life marks 性 sex as part of living nature.`,
  "男": `A 田 rice field beside 力 power marks 男 male in the old fieldwork image.`,
  "道": `辶 movement guided by 首 heads opens the 道 way.`,
  "民": `A 目 eye marked with an ◎ marker stands among the 民 people.`,
  "考": `An 耂 old (top) scholar rests a 丂 axe handle beside the desk before they 考 take an exam.`,
  "食": `A 亽 kwukyel mark over 艮 stubborn grain points to 食 food.`,
  "安": `A 女 woman resting under a 宀 roof gives the scene 安 peaceful balance.`,
  "笑": `竹 bamboo bends above a 夭 die young figure, turning the scene into 笑 laugh.`,
  "保": `A 亻 person (side) keeps watch over a 呆 dim-witted sign to 保 safeguard the path.`,
  "選": `辶 movement through a 巽 obedient line lets you 選 choose the route.`,
  "吉": `A 士 soldier opens a 口 mouth with news of 吉 lucky fortune.`,
  "運": `辶 movement keeps the 軍 army supplies in 運 carry motion.`,
  "交": `A 亠 lid lifts as 父 father steps forward to 交 mingle.`,
  "告": `A ⺧ cow (side) sign beside a 口 mouth lets the farmer 告 declare the count.`,
  "深": `氵 water (drops) falling into a 罙 deep well makes 深 deep water.`,
  "商": `A 亠 lid above 丷 split horns and a 冏 bright window marks the stall of a 商 salesman.`,
  "害": `A 𫲸 phonetic form leaving the 口 mouth can cause 害 harm.`,
  "器": `A 哭 cry and 吅 noise call attention to the missing 器 utensil.`,
  "遠": `A long 辶 movement past a 袁 loincloth marker points to somewhere 遠 distant.`,
  "橋": `A 木 tree laid across a gap lets people 喬 pretend it is a 橋 bridge.`,
  "望": `A 王 king under the 月 month watches the 亡 deceased sign and 望 expect news.`,
  "戻": `A 户 family beside a 大 big bend marks a 戻 perverse turn.`,
  "移": `多 many bundles of 禾 standing grain force the farmer to 移 shift them.`,
  "席": `Under a 广 roof, 廿 twenty marks on a 巾 towel show the 席 mat.`,
  "冷": `冫 ice follows 令 orders and makes the room 冷 cold.`,
  "攻": `工 work starts with a 攵 tap that signals the 攻 attack on the task.`,
  "準": `A 隼 falcon dipping toward 氵 water (drops) traces a 準 standard line.`,
  "授": `A 扌 hand (side) presents what the learner will 受 accept and 授 confer.`,
  "弱": `A spill marked 尿 urine leaves the floor 弱 weak and unsafe.`,
  "寿": `三 three marks, a 丿 slash, and 寸 inch ticks count the years of 寿 old age.`,
  "脚": `⺼ meat (side) remains 却 still at the base, forming a 脚 foot.`,
  "仕": `A 亻 person (side) standing beside a 士 soldier works as a 仕 official.`,
};

function updateGlosses(card) {
  for (const listName of ["components", "visual_components"]) {
    if (!Array.isArray(card[listName])) continue;
    for (const component of card[listName]) {
      if (componentGlossOverrides[component.character]) {
        component.gloss = componentGlossOverrides[component.character];
      }
    }
  }
}

function equationFor(card) {
  return `${card.components.map((c) => `${c.character} ${c.gloss}`).join(" + ")} = ${card.character} ${card.meaning}`;
}

const metaRe = /\b(?:the character combines|this character|component|radical|represents|depicts)\b/i;

function validate(card) {
  const problems = [];
  const equation = String(card.equation || "");
  const mnemonic = String(card.mnemonic || "");
  for (const component of card.components || []) {
    const pair = `${component.character} ${component.gloss}`;
    if (!equation.includes(pair)) problems.push(`equation missing ${pair}`);
    if (!mnemonic.includes(pair)) problems.push(`mnemonic missing ${pair}`);
  }
  const finalPair = `${card.character} ${card.meaning}`;
  if (!equation.includes(finalPair)) problems.push(`equation missing ${finalPair}`);
  if (!mnemonic.includes(finalPair)) problems.push(`mnemonic missing ${finalPair}`);
  if ((equation.match(/=/g) || []).length !== 1) problems.push("equation should have one equals sign");
  if (mnemonic.length > 190) problems.push("mnemonic too long");
  if (mnemonic.split(/[.!?。！？]+/).filter((s) => s.trim()).length > 1) problems.push("mnemonic has multiple sentences");
  if (/(sounds like|pronounced|on'yomi|pinyin)/i.test(mnemonic)) problems.push("contains pronunciation hook");
  if (metaRe.test(mnemonic)) problems.push("contains meta phrasing");
  if (!card.hero_image_prompt) problems.push("missing hero image prompt");
  return {
    problems,
    valid: problems.length === 0,
    heuristic_score: Math.max(0, 10 - problems.length * 1.5 - Math.max(0, mnemonic.length - 160) / 40),
  };
}

function requiredPairs(card) {
  return [
    ...(card.components || []).map((component) => `${component.character} ${component.gloss}`),
    `${card.character} ${card.meaning}`,
  ];
}

function stripRequiredPairs(card, text) {
  let stripped = text;
  for (const pair of requiredPairs(card).sort((a, b) => b.length - a.length)) {
    stripped = stripped.split(pair).join("");
  }
  return stripped;
}

function suspiciousRows(artifact) {
  const bad = /(represents|the character combines|this character|component|radical|sounds like|pronounced|pinyin|on'yomi)/i;
  const filler = /(magical|glowing|mystical|neon|tragic|tragically|beautiful|proudly|always|society|polite|poor)/i;
  const heavy = /giant|dragon|monster|weapon|blood|kill|violent|terrifying|desperate|massive/i;
  const generic = /exact|precise|carefully|important|proper|official/i;
  const rows = [];
  for (const card of artifact.mnemonics) {
    const stripped = stripRequiredPairs(card, card.mnemonic || "");
    let score = 0;
    const reasons = [];
    if (bad.test(stripped)) { score += 10; reasons.push("banned-meta"); }
    if (filler.test(stripped)) { score += 2; reasons.push("filler"); }
    if ((card.mnemonic || "").length > 165) { score += 2; reasons.push("long"); }
    if (/\(.{0,12}[\u3400-\u9fff].{0,12}\)/u.test(stripped)) { score += 3; reasons.push("paren-char"); }
    const duplicate = stripped.replace(/\s+/g, " ").match(/\b([A-Za-z]{4,})\s+\1\b/i);
    if (duplicate) { score += 2; reasons.push("duplicate-word"); }
    if (heavy.test(stripped)) { score += 1; reasons.push("heavy-imagery"); }
    if (generic.test(stripped)) { score += 0.25; reasons.push("generic-wording"); }
    if (score > 0) rows.push({ score, reasons, character: card.character, meaning: card.meaning, equation: card.equation, mnemonic: card.mnemonic });
  }
  rows.sort((a, b) => b.score - a.score || b.mnemonic.length - a.mnemonic.length);
  return rows;
}

const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
const edited = [];
const missing = [];

for (const card of artifact.mnemonics) {
  updateGlosses(card);
  card.equation = equationFor(card);
  if (manualMnemonics[card.character]) {
    card.mnemonic = manualMnemonics[card.character];
    card.manual_review = {
      reviewed_at: new Date().toISOString(),
      reason: "manual cleanup of suspicious generated mnemonic",
    };
    edited.push(card.character);
  }
  card.validation = validate(card);
}

for (const character of Object.keys(manualMnemonics)) {
  if (!artifact.mnemonics.some((card) => card.character === character)) missing.push(character);
}

artifact.manual_review = {
  reviewed_at: new Date().toISOString(),
  edited_count: edited.length,
  edited_characters: edited,
  component_gloss_overrides_applied: componentGlossOverrides,
};
artifact.manual_component_gloss_overrides_used = {
  ...(artifact.manual_component_gloss_overrides_used || {}),
  ...componentGlossOverrides,
};

if (missing.length) {
  throw new Error(`manual edits missing artifact cards: ${missing.join("")}`);
}

const invalid = artifact.mnemonics.filter((card) => !card.validation.valid);
if (invalid.length) {
  console.error(JSON.stringify(invalid.map((card) => ({ character: card.character, problems: card.validation.problems, mnemonic: card.mnemonic })), null, 2));
  throw new Error(`${invalid.length} manual edits failed validation`);
}

const suspicious = suspiciousRows(artifact);
const lens = artifact.mnemonics.map((card) => (card.mnemonic || "").length).sort((a, b) => a - b);
const pct = (p) => lens[Math.floor((lens.length - 1) * p)];
const report = {
  created_at: new Date().toISOString(),
  source: artifactPath,
  model: artifact.model,
  count: artifact.count,
  manual_review: artifact.manual_review,
  validator: { invalid_count: invalid.length, invalid: [] },
  mnemonic_length: { min: lens[0], p50: pct(0.5), p90: pct(0.9), p95: pct(0.95), max: lens[lens.length - 1] },
  suspicious_count: suspicious.length,
  suspicious_top: suspicious.slice(0, 120),
  suspicious_scanner_note: "Scanner removes exact required character/gloss pairs before flagging heavy or generic words, so unavoidable glosses like 殺 kill do not count by themselves.",
};

fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
fs.writeFileSync(evalPath, JSON.stringify(report, null, 2));

console.log(`edited=${edited.length}`);
console.log(`invalid=${invalid.length}`);
console.log(`suspicious=${suspicious.length}`);
