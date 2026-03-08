/* ═══════════════════════════════════════════════════
 *  Homeless Simulator – ゲームデータ定義 v5.1
 *  衣服 / 医療支援 / リアル日雇い(4h) / ねる
 * ═══════════════════════════════════════════════════ */

/* ── 時刻別エリア画像 ── */
const bgNishiMorning = '/image/bg/bg_nishi_morning_1772362813181.png'
const bgNishiNoon = '/image/bg/bg_nishi_noon_1772362826633.png'
const bgNishiEvening = '/image/bg/bg_nishi_evening_1772362843655.png'
const bgNishiNight = '/image/bg/bg_nishiguchi_v2_1772361188900.png'

const bgTochoMorning = '/image/bg/bg_tocho_morning_cheap_1772910069735.png'
const bgTochoNoon = '/image/bg/bg_tocho_noon_cheap_1772910088939.png'
const bgTochoEvening = '/image/bg/bg_tocho_evening_cheap_1772910106479.png'
const bgTochoNight = '/image/bg/bg_tocho_night_cheap_1772910123196.png'

const bgParkMorning = '/image/bg/bg_park_morning_1772362929856.png'
const bgParkNoon = '/image/bg/bg_park_noon_1772362964470.png'
const bgParkEvening = '/image/bg/bg_park_evening_1772362978037.png'
const bgParkNight = '/image/bg/bg_park_v2_1772361219411.png'

/* ── 拠点画像 ── */
const baseLevel1Img = '/image/bg/base_level1_v2_1772451369994.png'
const baseLevel0Img = null  // のざらし = 公園の通常画像を使うので null

/* ── 時間帯判定 ── */
export function getTimeOfDay(hour) {
    if (hour >= 5 && hour < 10) return 'morning'
    if (hour >= 10 && hour < 16) return 'noon'
    if (hour >= 16 && hour < 19) return 'evening'
    return 'night'
}

/* ── エリア定義 ── */
export const AREAS = {
    nishiguchi: {
        id: 'nishiguchi',
        name: 'しんじゅくえき にしぐち',
        bg: { morning: bgNishiMorning, noon: bgNishiNoon, evening: bgNishiEvening, night: bgNishiNight },
        desc: 'ひとどおりのおおい えきまえ。',
        canWork: false,
        canBase: false,
        searchEvents: [
            { text: 'じはんきのしたから {amount}えん みつけた！', chance: 0.5, type: 'money', min: 1, max: 100 },
            { text: 'しんぶんしをひろった。', chance: 0.3, type: 'item', item: 'newspaper' },
            { text: 'あきかんを ひろった。', chance: 0.1, type: 'item', item: 'empty_can' },
            { text: 'ふくびきけんが おちていた！', chance: 0.06, type: 'item', item: 'fukubiki_ticket' },
            { text: 'すてられた ふるいせんぷうきが あった！ ひろった。', chance: 0.06, type: 'item', item: 'old_fan' },
            { text: 'こわれたテレビが すてられていた！ ひろった。', chance: 0.05, type: 'item', item: 'broken_tv' },
            { text: 'なにもみつからなかった…', chance: 1, type: 'miss' },
        ],
        talkEvents: [
            { text: 'つうこうにん「…」 めをあわせてくれなかった。', effect: null },
            { text: 'よっぱらい「おう にいちゃん げんきだせよ！」', effect: null },
            { text: 'せんぱい「こうえんにいけば あさ しごとのぼしゅうがあるぞ」', effect: null },
            { text: 'おばあさん「これ たべなさい」 おにぎりをもらった！', effect: null, giveItem: 'onigiri' },
            { text: 'こわそうなひと「かね よこせよ…」 ひっぱられた！ うまく にげたが HPがへった。', effect: { randomHpMod: { min: -10, max: -5 } } },
            { text: 'つうこうにん「…すみません、かまわないでください」 そっぽを むかれた。', effect: null },
            { text: 'わかいひと「おい まってよ。 だいじょうぶ？」 こころが すこし あたたまった。', effect: { hp: 2 } },
            { text: 'おじさんが こづちを わたしてくれた！ {amount}えん もらった！', effect: null, giveYen: { min: 10, max: 50 } },
        ],
        rejectsSmelly: true,
    },
    tocho: {
        id: 'tocho',
        name: 'とちょう しゅうへん',
        bg: { morning: bgTochoMorning, noon: bgTochoNoon, evening: bgTochoEvening, night: bgTochoNight },
        desc: 'きょだいな ちょうしゃがそびえたつ。',
        canWork: false,
        canBase: false,
        hasSoudan: true,
        moveTo: ['bentoya', 'recycle'],
        searchEvents: [
            { text: 'かだんのすみに {amount}えん おちていた！', chance: 0.4, type: 'money', min: 10, max: 150 },
            { text: 'だんボールをみつけた！', chance: 0.2, type: 'base_material', material: 'cardboard' },
            { text: 'あきかんを ひろった。', chance: 0.08, type: 'item', item: 'empty_can' },
            { text: 'すてられた でんしレンジが あった！ ひろった。', chance: 0.06, type: 'item', item: 'microwave' },
            { text: 'こわれたテレビが すてられていた！ ひろった。', chance: 0.05, type: 'item', item: 'broken_tv' },
            { text: 'なにもみつからなかった…', chance: 1, type: 'miss' },
        ],
        talkEvents: [
            { text: 'サラリーマン「すみません いそいでるんで…」', effect: null },
            { text: 'せいそういんのおじさん「ここは おいだされるぞ きをつけな」', effect: null },
            { text: 'つうこうにん「…かまわないでもらえますか」 むしされた。', effect: null },
            { text: 'おばさん「だいじょうぶ？」 こころが すこし あたたまった。', effect: { hp: 2 } },
            { text: 'つかれたサラリーマン「よかったら」 こづちを くれた！ {amount}えん もらった！', effect: null, giveYen: { min: 10, max: 50 } },
            { text: 'こわいにいちゃん「じゃまだよ！」 つきとばされた！ HPがへった。', effect: { randomHpMod: { min: -10, max: -5 } } },
        ],
    },
    park: {
        id: 'park',
        name: 'しんじゅく ちゅうおうこうえん',
        bg: { morning: bgParkMorning, noon: bgParkNoon, evening: bgParkEvening, night: bgParkNight },
        desc: 'みどりゆたかな こうえん。きょてんを かまえられる。',
        canWork: true,
        canBase: true,
        moveTo: ['sento'],
        searchEvents: [
            { text: 'ベンチのしたに {amount}えん はっけん！', chance: 0.3, type: 'money', min: 1, max: 50 },
            { text: 'みずのみばで みずをのんだ。すこし げんきがでた。', chance: 0.4, type: 'heal', hp: 10 },
            { text: 'あきかんを ひろった。', chance: 0.1, type: 'item', item: 'empty_can' },
            { text: 'すてられた ふるいせんぷうきが あった！ ひろった。', chance: 0.06, type: 'item', item: 'old_fan' },
            { text: 'なにもみつからなかった…', chance: 1, type: 'miss' },
        ],
        talkEvents: [
            { text: 'ベテラン「ふゆは しんぶんしを からだにまくんだ」', effect: null },
            { text: 'いぬをつれたおばさん「だいじょうぶ？ これのみなさい」 おちゃをもらった。', effect: null, giveItem: 'hottea_item' },
            { text: 'ねこがすりよってきた。すこし こころがあたたまった。', effect: { hp: 5 } },
            { text: 'ベテラン「ごはんプラスは どようびの 14じから とちょうまえだ。 ただで しょくりょうと いりょうそうだんが うけられるぞ」', effect: null },
            { text: 'ベテラン「れんらくかいは だい2にちようびの 10じから こうえんでやってる。 からだを みてもらえるぞ」', effect: null },
            { text: 'ベテラン「くやくしょの そうだんまどぐちは とちょうにいけば へいじつ9じから17じまでやってる」', effect: null },
            { text: 'ベテラン「しょくりょうはいふは まいにち ひるの12じから こうえんでやってる。 べんとうが もらえるぞ」', effect: null },
        ],
    },
    bentoya: {
        id: 'bentoya',
        name: 'べんとうや',
        bg: { morning: '/bentoya.png', noon: '/bentoya.png', evening: '/bentoya.png', night: '/bentoya.png' },
        desc: 'あたたかい べんとうが うっている。',
        canWork: false,
        canBase: false,
        isShop: true,
        parentArea: 'tocho',
        openHour: 7, closeHour: 21,
        rejectsSmelly: true,
        searchEvents: [
            { text: 'おみせの なかには きになるものは ない。', chance: 1, type: 'miss' },
        ],
        talkEvents: [
            { text: 'てんいん「いらっしゃい！ なにに する？」', effect: null, isBentoShop: true },
        ],
    },
    furugiya: {
        id: 'furugiya',
        name: 'ふるぎや',
        bg: { morning: '/furugiya.png', noon: '/furugiya.png', evening: '/furugiya.png', night: '/furugiya.png' },
        desc: 'あたたかい ふくが そろっている。',
        canWork: false,
        canBase: false,
        isShop: true,
        parentArea: 'nishiguchi',
        openHour: 10, closeHour: 19,
        rejectsSmelly: true,
        searchEvents: [
            { text: 'おみせの なかには きになるものは ない。', chance: 1, type: 'miss' },
        ],
        talkEvents: [
            { text: 'てんしゅ「いらっしゃい。 なにか さがしてるかい？」', effect: null, isFurugiyaShop: true },
        ],
    },
    fukubiki: {
        id: 'fukubiki',
        name: 'しょうてんがい ふくびきじょ',
        bg: {
            morning: '/image/fukubiki_center_8bit_room_cheap_1772722769924.png',
            noon: '/image/fukubiki_center_8bit_room_cheap_1772722769924.png',
            evening: '/image/fukubiki_center_8bit_room_cheap_1772722769924.png',
            night: '/image/fukubiki_center_8bit_room_cheap_1772722769924.png',
        },
        desc: 'ふくびきけん3まいで ガラポンがひける。',
        canWork: false,
        canBase: false,
        isShop: true,
        parentArea: 'nishiguchi',
        openHour: 11, closeHour: 19,
        rejectsSmelly: true,
        searchEvents: [
            { text: 'ふくびきじょのなかには きになるものは ない。', chance: 1, type: 'miss' },
        ],
        talkEvents: [
            { text: 'スタッフ「ふくびきけんが 3まいあれば まわせますよ！」', effect: null, isFukubiki: true },
        ],
    },
    recycle: {
        id: 'recycle',
        name: 'リサイクルショップ',
        bg: {
            morning: '/image/recycle_shop_8bit_room_cheap_1772722785951.png',
            noon: '/image/recycle_shop_8bit_room_cheap_1772722785951.png',
            evening: '/image/recycle_shop_8bit_room_cheap_1772722785951.png',
            night: '/image/recycle_shop_8bit_room_cheap_1772722785951.png',
        },
        desc: 'こうきゅうひんや あきかんを うれる。',
        canWork: false,
        canBase: false,
        isShop: true,
        parentArea: 'tocho',
        openHour: 10, closeHour: 20,
        searchEvents: [
            { text: 'おみせの なかには きになるものは ない。', chance: 1, type: 'miss' },
        ],
        talkEvents: [
            { text: 'てんいん「なにか うるものが ありますか？」', effect: null, isRecycle: true },
        ],
    },
    sento: {
        id: 'sento',
        name: 'せんとう',
        bg: {
            morning: '/image/public_bath_8bit_room_cheap_1772722800358.png',
            noon: '/image/public_bath_8bit_room_cheap_1772722800358.png',
            evening: '/image/public_bath_8bit_room_cheap_1772722800358.png',
            night: '/image/public_bath_8bit_room_cheap_1772722800358.png',
        },
        desc: 'にゅうよくで えいせいが おおきく かいふく。',
        canWork: false,
        canBase: false,
        isShop: true,
        parentArea: 'park',
        openHour: 10, closeHour: 22,
        searchEvents: [
            { text: 'よくじょの なかには きになるものは ない。', chance: 1, type: 'miss' },
        ],
        talkEvents: [
            { text: 'ばんとうさん「おひとり ¥500ですよ。」', effect: null, isSento: true },
        ],
    },
}

// 移動メニューに表示するエリア（サブエリアは除外）
export const AREA_LIST = Object.values(AREAS).filter(a => !a.parentArea)

// 各エリアからのサブ移動先
AREAS.nishiguchi.moveTo = ['furugiya', 'fukubiki']

/* ── コマンド定義 (ねる追加) ── */
export const COMMANDS = [
    { id: 'basho', label: 'ばしょいどう' },
    { id: 'shiraberu', label: 'しらべる' },
    { id: 'hanasu', label: 'はなす' },
    { id: 'tsubuyaku', label: 'つぶやく' },
    { id: 'hiyatoi', label: 'ひやとい' },
    { id: 'kyoten', label: 'きょてん' },
    { id: 'mochimono', label: 'もちもの' },
    { id: 'jotai', label: 'じょうたい' },
]

/* ── 作業中のみ使えるコマンド ── */
export const WORK_COMMANDS = [
    { id: 'quit_work', label: 'しごとをやめる' },
    { id: 'tsubuyaku', label: 'つぶやく' },
    { id: 'hanasu_work', label: 'はなす' },
    { id: 'mochimono', label: 'もちもの' },
    { id: 'jotai', label: 'じょうたい' },
]

/* ── 作業中の会話 ── */
export const WORK_TALK_EVENTS = [
    'さぎょういん「おう にいちゃん がんばれよ！」',
    'さぎょういん「にちとういくらもらえるんだ？ おれは5せんえんだ」',
    'さぎょういん「こしが いてえな…」',
    'さぎょういん「ひるめしは べんとうがでるらしいぞ」',
    'さぎょういん「おわったら いっぱい やるか！ …かねないか」',
]

/* ── アイテム定義 ── */
export const ITEMS = {
    newspaper: { id: 'newspaper', name: 'しんぶんし', desc: 'そうびすると たいかんおんど+1℃', feelsBonus: 1, usable: true, type: 'equip_newspaper' },
    cardboard: { id: 'cardboard', name: 'だんボール', desc: 'きょてんの ざいりょう', feelsBonus: 0, usable: false, type: 'material' },
    onigiri: { id: 'onigiri', name: 'おにぎり', desc: 'たべると くうふく かいふく', hungerRestore: 30, usable: true, type: 'food' },
    bento: { id: 'bento', name: 'まくのうちべんとう', desc: 'がっつり かいふく', hungerRestore: 80, hpRestore: 20, usable: true, type: 'food' },
    hottea_item: { id: 'hottea_item', name: 'あたたかいおちゃ', desc: 'のむと すこし あたたまる', hpRestore: 5, feelsBonus: 2, usable: true, type: 'drink' },
    cupmen: { id: 'cupmen', name: 'カップめん', desc: 'あたたかくて おなかにたまる', hungerRestore: 50, hpRestore: 5, feelsBonus: 2, usable: true, type: 'food' },
    nikuman: { id: 'nikuman', name: 'にくまん', desc: 'ほかほか にくまん', hungerRestore: 40, hpRestore: 5, feelsBonus: 2, usable: true, type: 'food' },
    // 薬
    medicine_normal: { id: 'medicine_normal', name: 'くすり', desc: 'びょうきのLvを2さげる', usable: true, type: 'medicine', lvReduction: 2 },
    medicine_strong: { id: 'medicine_strong', name: 'つよいくすり', desc: 'びょうきのLvを4さげる', usable: true, type: 'medicine', lvReduction: 4 },
    medicine_bulk: { id: 'medicine_bulk', name: 'たくさんのくすり', desc: 'じゅうびょうをかんかいさせる', usable: true, type: 'medicine', lvReduction: 5 },
    // クリスマスイベント
    luxury_bag: { id: 'luxury_bag', name: 'こうきゅうバッグ', desc: 'うれば おかねになる', sellValue: 3000, usable: true, type: 'sell_item' },
    luxury_watch: { id: 'luxury_watch', name: 'こうきゅうとけい', desc: 'うれば おかねになる', sellValue: 5000, usable: true, type: 'sell_item' },
    christmas_cake: { id: 'christmas_cake', name: 'クリスマスケーキ', desc: 'たべると かいふく', hungerRestore: 60, hpRestore: 15, usable: true, type: 'food' },
    special_stew: { id: 'special_stew', name: 'とくせいシチュー', desc: 'からだがあたたまる かいふくりょうおおい', hungerRestore: 70, hpRestore: 25, usable: true, type: 'food' },
    // 夏祭りイベント
    festival_food: { id: 'festival_food', name: 'まつりのたべもの', desc: 'スタミナかいふく', hungerRestore: 50, hpRestore: 10, usable: true, type: 'food' },
    ice: { id: 'ice', name: 'こおり', desc: 'からだをひやす ねつをさげる', tempCool: 1.0, hpRestore: 5, usable: true, type: 'cooling' },
    // しんらいど特典
    priority_ticket: { id: 'priority_ticket', name: 'たきだしゆうせんけん', desc: 'たきだしに おくれても しょくりょうをうけとれる', usable: false, type: 'ticket' },
    // リサイクル・空き缶
    empty_can: { id: 'empty_can', name: 'あきかん', desc: 'リサイクルショップで うれる', sellValue: 8, usable: false, type: 'recycle_item' },
    radio_cassette: { id: 'radio_cassette', name: 'ラジカセ（ふるい）', desc: 'リサイクルショップで うれる', sellValue: 800, usable: false, type: 'recycle_item' },
    good_clothing: { id: 'good_clothing', name: 'きれいなふく', desc: 'リサイクルショップで うれる', sellValue: 500, usable: false, type: 'recycle_item' },
    // 福引
    fukubiki_ticket: { id: 'fukubiki_ticket', name: 'ふくびきけん', desc: 'ふくびきじょで 3まいつかう', usable: false, type: 'fukubiki_ticket' },
    // 雨具・拠点素材
    bluesheet: { id: 'bluesheet', name: 'ブルーシート', desc: 'もちものから つかうと 雨よけに そうびできる。きょてんのそざいにも なる。', usable: true, type: 'equip_bluesheet' },
    // 家電（探索で低確率入手・売却専用）
    old_fan: { id: 'old_fan', name: 'ふるいせんぷうき', desc: 'リサイクルショップで うれる', sellValue: 800, usable: false, type: 'appliance' },
    broken_tv: { id: 'broken_tv', name: 'こわれたテレビ', desc: 'リサイクルショップで うれる', sellValue: 1500, usable: false, type: 'appliance' },
    microwave: { id: 'microwave', name: 'でんしレンジ', desc: 'リサイクルショップで うれる', sellValue: 2000, usable: false, type: 'appliance' },
    // 福引景品・使い捨て
    pocket_tissue: { id: 'pocket_tissue', name: 'ポケットティッシュ', desc: 'えいせい +5', hygieneRestore: 5, usable: true, type: 'hygiene' },
    snack: { id: 'snack', name: 'スナックがし', desc: 'くうふく +10', hungerRestore: 10, usable: true, type: 'food' },
    // テント（福引特賞）
    tent_item: { id: 'tent_item', name: 'テント', desc: 'きょてんを テントに アップグレードできる', usable: false, type: 'tent_item' },
}

/* ── 病気定義 ── */
// hpDecayPerHour[Lv] : Lv0=未使用, Lv1〜Lv5
export const DISEASES = {
    kaze: {
        id: 'kaze', name: 'かぜ',
        hpDecayPerHour: [0, 3, 5, 8, 12, 20],
        escalationIntervalMs: 24 * 60 * 60 * 1000,
    },
    hypoglycemia: {
        id: 'hypoglycemia', name: 'ていけっとう',
        hpDecayPerHour: [0, 5, 8, 12, 18, 30],
        escalationIntervalMs: 24 * 60 * 60 * 1000,
        triggerHungerZeroMs: 2 * 60 * 60 * 1000,
    },
    skin_disease: {
        id: 'skin_disease', name: 'ひふしっかん',
        hpDecayPerHour: [0, 1, 2, 4, 7, 12],
        escalationIntervalMs: 24 * 60 * 60 * 1000,
        triggerHygieneThreshold: 30,
    },
}

/* ── 衣服定義 ── */
// 'head' スロット追加でマフラーと帽子が同時装備可能
// 新聞紙は clothing スロットを使わず newspaperEquipTime で別管理
export const CLOTHING_SLOTS = ['outer', 'tops', 'bottoms', 'inner', 'underwear', 'head', 'other', 'umbrella']
export const CLOTHING_SLOT_NAMES = {
    outer: 'アウター', tops: 'トップス', bottoms: 'ボトムス',
    inner: 'インナー', underwear: 'したぎ', head: 'ぼうし', other: 'マフラー', umbrella: '雨よけ',
}

export const CLOTHING_ITEMS = {
    jersey_top: { id: 'jersey_top', slot: 'tops', name: 'ジャージ(うわぎ)', feelsBonus: 2 },
    shirt: { id: 'shirt', slot: 'tops', name: 'シャツ', feelsBonus: 1 },
    knit: { id: 'knit', slot: 'tops', name: 'ニットセーター', feelsBonus: 4 },
    jersey_bot: { id: 'jersey_bot', slot: 'bottoms', name: 'ジャージ(したぎ)', feelsBonus: 2 },
    pants: { id: 'pants', slot: 'bottoms', name: 'パンツ', feelsBonus: 2 },
    chinos: { id: 'chinos', slot: 'bottoms', name: 'チノパン', feelsBonus: 3 },
    tshirt: { id: 'tshirt', slot: 'inner', name: 'Tシャツ', feelsBonus: 1 },
    heattech: { id: 'heattech', slot: 'inner', name: 'ヒートテック', feelsBonus: 4 },
    trunks: { id: 'trunks', slot: 'underwear', name: 'トランクス', feelsBonus: 0 },
    coat: { id: 'coat', slot: 'outer', name: 'コート', feelsBonus: 8 },
    jacket: { id: 'jacket', slot: 'outer', name: 'ジャケット', feelsBonus: 5 },
    blouson: { id: 'blouson', slot: 'outer', name: 'ブルゾン', feelsBonus: 6 },
    atsude_jumper: { id: 'atsude_jumper', slot: 'outer', name: 'あつでジャンバー', feelsBonus: 10 },
    muffler: { id: 'muffler', slot: 'other', name: 'マフラー', feelsBonus: 3 },
    knit_cap: { id: 'knit_cap', slot: 'head', name: 'ニットぼう', feelsBonus: 2 },
    cap: { id: 'cap', slot: 'head', name: 'ぼうし', feelsBonus: 1 },
    // 雨具（umbrella スロット）
    umbrella: { id: 'umbrella', slot: 'umbrella', name: 'ビニールがさ', feelsBonus: 0 },
    kappa: { id: 'kappa', slot: 'umbrella', name: 'かっぱ', feelsBonus: 2 },
    bluesheet: { id: 'bluesheet', slot: 'umbrella', name: 'ブルーシート', feelsBonus: 0 },
}

export const DEFAULT_CLOTHING = {
    outer: null, tops: 'jersey_top', bottoms: 'jersey_bot',
    inner: 'tshirt', underwear: 'trunks', head: null, other: null, umbrella: null,
}

/* ── 拠点レベル（時刻対応） ── */
export const BASE_LEVELS = [
    { level: 0, name: 'のざらし', feelsBonus: 0, cost: 0, desc: 'さむさがこたえる。', img: baseLevel0Img },
    { level: 1, name: 'だんボールハウス', feelsBonus: 3, cost: 500, desc: 'かぜはふせげる。', img: baseLevel1Img, requires: { cardboard: 3 } },
    {
        level: 2, name: 'ブルーシートごや', feelsBonus: 6, cost: 0, desc: 'あめもしのげる。',
        requires: { bluesheet: 5 },
        img: {
            morning: '/bluesheet_morning.png', noon: '/bluesheet_morning.png',
            evening: '/bluesheet_evening.png', night: '/bluesheet_night.png',
        }
    },
    {
        level: 3, name: 'テント', feelsBonus: 12, cost: 0, desc: 'かなりかいてき。',
        requiresItem: 'tent_item',
        img: {
            morning: '/tent_morning.png', noon: '/tent_morning.png',
            evening: '/tent_evening.png', night: '/tent_night.png',
        }
    },
]

/* ── 弁当屋商品 ── */
export const BENTO_SHOP_ITEMS = [
    { id: 'onigiri', name: 'おにぎり', price: 150 },
    { id: 'bento', name: 'まくのうちべんとう', price: 500 },
    { id: 'hottea_item', name: 'あたたかいおちゃ', price: 120 },
    { id: 'cupmen', name: 'カップめん', price: 200 },
    { id: 'nikuman', name: 'にくまん', price: 180 },
]
export const BENTO_OPEN = 7
export const BENTO_CLOSE = 21

/* ── 古着屋商品 ── */
export const FURUGIYA_ITEMS = [
    { id: 'atsude_jumper', slot: 'outer', name: 'あつでジャンバー', price: 3000, feelsBonus: 10 },
    { id: 'knit', slot: 'tops', name: 'ニットセーター', price: 1500, feelsBonus: 4 },
    { id: 'chinos', slot: 'bottoms', name: 'チノパン', price: 800, feelsBonus: 3 },
    { id: 'heattech', slot: 'inner', name: 'ヒートテック', price: 800, feelsBonus: 4 },
    { id: 'muffler', slot: 'other', name: 'マフラー', price: 600, feelsBonus: 3 },
    { id: 'knit_cap', slot: 'head', name: 'ニットぼう', price: 400, feelsBonus: 2 },
    { id: 'kappa', slot: 'umbrella', name: 'かっぱ', price: 2000, feelsBonus: 2 },
]
export const FURUGIYA_OPEN = 10
export const FURUGIYA_CLOSE = 19

/* ── 銭湯 ── */
export const SENTO_PRICE = 500
export const SENTO_HYGIENE_RESTORE = 80
export const SENTO_OPEN = 10
export const SENTO_CLOSE = 22

/* ── リサイクルショップ ── */
export const RECYCLE_OPEN = 10
export const RECYCLE_CLOSE = 20
export const RECYCLE_SHOP_ITEMS = [
    { id: 'bluesheet', name: 'ブルーシート', price: 3500, targetMaterial: 'bluesheet', desc: 'きょてんアップグレード用' },
    { id: 'umbrella', name: 'ビニールがさ', price: 500, targetClothing: 'umbrella', slot: 'umbrella', desc: 'あめよけ（こうか ひくめ）' },
]

/* ── 福引 ── */
export const FUKUBIKI_OPEN = 11
export const FUKUBIKI_CLOSE = 19
export const FUKUBIKI_TICKET_COST = 3
export const FUKUBIKI_PRIZES = [
    { text: 'とくしょう！！ テントが あたった！！！', item: 'tent_item', chance: 0.015 },
    { text: 'ラジカセ（ふるい）が あたった！', item: 'radio_cassette', chance: 0.15 },
    { text: 'きれいなふくが あたった！', item: 'good_clothing', chance: 0.20 },
    { text: 'ふくびきけん3まいが あたった！', item: 'fukubiki_ticket', count: 3, chance: 0.10 },
    { text: 'ポケットティッシュが あたった！', item: 'pocket_tissue', chance: 0.25 },
    { text: 'スナックがしが あたった！', item: 'snack', chance: 0.285 },
]

/* ── におい閾値 ── */
export const SMELL_THRESHOLD = 25

/* ── 日雇い (4時間 = 14400000ms) ── */
export const DAY_LABOR = {
    recruitStart: 6,
    recruitEnd: 7.5,
    workStart: 8.5,
    workEnd: 12.5,
    durationMs: 4 * 60 * 60 * 1000,  // 4時間
    pay: { min: 5000, max: 6000 },
    hpCost: 35,
    hungerCost: 30,
    winChance: 0.6,
    collapseHpThreshold: 20,
}

/* ── 食料配布 ── */
export const FOOD_DISTRIBUTION = {
    startHour: 12, endHour: 13, area: 'park',
    giveItem: 'bento',
    text: 'しょくりょうはいふが おこなわれた！ おべんとうをもらった。',
}

/* ── 睡眠設定 ── */
export const SLEEP_CONFIG = {
    hpPerHour: 5,      // 1時間あたりHP回復
    hungerPerHour: 2.5, // 1時間あたり空腹減少
}

/* ── 医療・支援イベント ── */
export const SUPPORT_EVENTS = {
    gohanPlus: {
        name: 'しんじゅくごはんプラス', area: 'tocho',
        dayOfWeek: 6, startHour: 14, endHour: 14.75,
        effects: { hunger: 40, hp: 20 },
        text: 'しんじゅくごはんプラスの そうだんかいに さんかした。\nしょくりょうと いりょうそうだんを うけた。',
        healSick: true,
    },
    renrakukai: {
        name: 'しんじゅくれんらくかい', area: 'park',
        weekOfMonth: 2, dayOfWeek: 0, startHour: 10, endHour: 12,
        effects: { hp: 30 },
        text: 'しんじゅくれんらくかいの いりょうそうだんかいに さんかした。\nからだを みてもらった。',
        healSick: true,
    },
    soudan: {
        name: 'そうだんまどぐち', area: 'tocho',
        weekdays: true, startHour: 9, endHour: 17,
        effects: { hp: 10 },
        text: 'くやくしょの そうだんまどぐちで はなしをきいてもらった。',
        healSick: true,
    },
}

/* ── 天候定義 ── */
export const WEATHER_TYPES = {
    clear: { id: 'clear', name: 'はれ', tempMod: 0 },
    cloudy: { id: 'cloudy', name: 'くもり', tempMod: -2 },
    rain: { id: 'rain', name: 'あめ', tempMod: -6 },
    snow: { id: 'snow', name: 'ゆき', tempMod: -12 },
    wind: { id: 'wind', name: 'きょうふう', tempMod: -4 },
}

export function getWeatherOverlay(weatherId) {
    switch (weatherId) {
        case 'rain': case 'snow': return 'rain'
        case 'cloudy': return 'cloudy'
        default: return 'clear'
    }
}

/* ── 季節判定 ── */
export function getSeason() {
    const m = new Date().getMonth() + 1
    if (m >= 3 && m <= 5) return 'spring'
    if (m >= 6 && m <= 8) return 'summer'
    if (m >= 9 && m <= 11) return 'autumn'
    return 'winter'
}

export function isChristmasPeriod() {
    const now = new Date()
    return now.getMonth() === 11 && now.getDate() >= 23 && now.getDate() <= 26
}

export function isSummerFestivalPeriod() {
    const now = new Date()
    const m = now.getMonth() + 1
    const d = now.getDate()
    return (m === 7 && d >= 15) || (m === 8 && d <= 15)
}

/* ── 季節限定サーチイベント ── */
export const SEASONAL_SEARCH_EVENTS = {
    christmas: [
        { text: 'こうきゅうブランドバッグが おちていた！ もちものに いれた。', chance: 0.12, type: 'item', item: 'luxury_bag' },
        { text: 'こうきゅうとけいを みつけた！ うれるかも…', chance: 0.08, type: 'item', item: 'luxury_watch' },
        { text: 'たべかけの クリスマスケーキが おいてあった！', chance: 0.18, type: 'item', item: 'christmas_cake' },
    ],
    summer: [
        { text: 'まつりの たこやきの こりを みつけた！', chance: 0.22, type: 'item', item: 'festival_food' },
        { text: 'ボランティアが こおりを くれた。 すずしくなった。', chance: 0.18, type: 'item', item: 'ice' },
    ],
}

/* ── クリスマス炊き出し強化 ── */
export const CHRISTMAS_FOOD_DIST_ITEM = 'special_stew'

/* ── しんらいど特典 ── */
export const TRUST_BENEFITS = {
    priorityTicketThreshold: 50,
    goodJobThreshold: 40,
    goodJob: {
        pay: { min: 6500, max: 7500 },
        hpCost: 20,
        hungerCost: 20,
        label: 'ゆうりょうあんけん（¥6500〜7500）',
    },
}

/* ── ベテラン情報 ── */
export const VETERAN_INFO = [
    { text: 'ベテラン「ごはんプラスは どようび 14じから とちょうの まえだ。 しょくりょうと いりょうそうだんが うけられるぞ」', cost: 50 },
    { text: 'ベテラン「れんらくかいは だい2にちようび 10じから こうえんでやってる。 からだを みてもらえるぞ」', cost: 50 },
    { text: 'ベテラン「くやくしょの そうだんまどぐちは へいじつ 9じから17じまでだ。 とちょうにいけ」', cost: 100 },
    { text: 'ベテラン「しょくりょうはいふは ひるの12じから こうえんでやってるぞ。 べんとうがもらえる」', cost: 50 },
    { text: 'ベテラン「べんとうやは とちょうの ちかくにある。 7じから21じまで やってるぞ」', cost: 50 },
    { text: 'ベテラン「ふるぎやは にしぐちの ちかくにある。 10じから19じまでだ」', cost: 50 },
]

/* ── 初期ステータス ── */
export const INITIAL_STATE = {
    status: { hp: 100, hunger: 80, temp: 36.0, feelsLike: 15, yen: 0, trust: 10, hygiene: 100 },
    area: 'nishiguchi',
    baseLevel: 0,
    inventory: [],
    materials: { cardboard: 0, bluesheet: 0 },
    clothing: { ...DEFAULT_CLOTHING },
    clothingStorage: [],  // アイテムボックス（clothing item ID の配列）
    lastTickTime: null,
    totalActions: 0,
    activeJob: null,     // { startTime, endTime, isGoodJob? }
    diseases: [],        // [{ id, level, lastEscalationTime }]
    hungerZeroStart: null, // hunger が0になった時刻 (Date.now())
    hasPriorityTicket: false,
    todayWorked: false,
    todayFoodDist: false,
    lastDateStr: null,
    sleeping: null,      // { startTime } or null
    newspaperEquipTime: null,  // 新聞紙装備時刻（clothingスロット不使用・独立管理）
    onigiriLog: [],
    chinchiroYen: null,      // ちんちろりん継続持ち金（当日分）
    chinchiroDayKey: null,   // 持ち金が有効なゲーム日付キー
}
