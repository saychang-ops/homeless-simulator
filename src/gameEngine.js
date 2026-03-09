/* ═══════════════════════════════════════════════════
 *  Homeless Simulator – ゲームエンジン v5.1
 *  日雇い4h / ねる / もちもの経由アイテム
 * ═══════════════════════════════════════════════════ */

import {
    AREAS, BASE_LEVELS, ITEMS, CLOTHING_ITEMS,
    WEATHER_TYPES, INITIAL_STATE, BENTO_SHOP_ITEMS, FURUGIYA_ITEMS,
    DAY_LABOR, FOOD_DISTRIBUTION, SUPPORT_EVENTS,
    SLEEP_CONFIG, WORK_TALK_EVENTS, VETERAN_INFO,
    DISEASES, SEASONAL_SEARCH_EVENTS, TRUST_BENEFITS,
    isChristmasPeriod, isSummerFestivalPeriod, CHRISTMAS_FOOD_DIST_ITEM,
    SENTO_PRICE, SENTO_HYGIENE_RESTORE, FUKUBIKI_TICKET_COST, FUKUBIKI_PRIZES,
    SMELL_THRESHOLD, getSeason, RECYCLE_SHOP_ITEMS,
} from './gameData.js'

const SAVE_KEY = 'homeless_sim_save_v5'

/* ═══ セーブ / ロード ═══ */
export function saveGame(state) {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, lastTickTime: Date.now() }))
}
export function loadGame() {
    try {
        const raw = localStorage.getItem(SAVE_KEY)
        if (!raw) return null
        const s = JSON.parse(raw)
        if (!s.clothing) s.clothing = { ...INITIAL_STATE.clothing }
        if (!s.inventory) s.inventory = []
        if (s.todayWorked === undefined) s.todayWorked = false
        if (s.todayFoodDist === undefined) s.todayFoodDist = false
        if (s.status.feelsLike === undefined) s.status.feelsLike = 15
        if (s.sleeping === undefined) s.sleeping = null
        if (s.newspaperEquipTime === undefined) s.newspaperEquipTime = null
        if (!s.onigiriLog) s.onigiriLog = []
        if (s.chinchiroYen === undefined) s.chinchiroYen = null
        if (s.chinchiroDayKey === undefined) s.chinchiroDayKey = null
        // v5→v6 マイグレーション: isSick → diseases
        if (s.isSick !== undefined) {
            if (!s.diseases) s.diseases = []
            if (s.isSick && s.diseases.length === 0) {
                s.diseases = [{ id: 'kaze', level: 1, lastEscalationTime: Date.now() }]
            }
            delete s.isSick
        }
        if (!s.diseases) s.diseases = []
        if (s.status.hygiene === undefined) s.status.hygiene = 100
        if (s.hungerZeroStart === undefined) s.hungerZeroStart = null
        if (s.hasPriorityTicket === undefined) s.hasPriorityTicket = false
        if (!s.clothingStorage) s.clothingStorage = []
        // 衣服スロット移行: head スロット追加、newspaper_equip を clothing.other から除去
        if (!s.clothing.head) s.clothing.head = null
        if (s.clothing.other === 'newspaper_equip') {
            s.clothing.other = null  // 新聞紙は newspaperEquipTime で管理
        }
        // 旧 other スロットにキャップ系があれば head に移行
        if (s.clothing.other === 'knit_cap' || s.clothing.other === 'cap') {
            s.clothing.head = s.clothing.other
            s.clothing.other = null
        }
        // v12 マイグレーション: umbrella スロット追加、materials.bluesheet 追加
        if (s.clothing.umbrella === undefined) s.clothing.umbrella = null
        if (!s.materials) s.materials = {}
        if (s.materials.bluesheet === undefined) s.materials.bluesheet = 0
        return s
    } catch { return null }
}
export function clearSave() { localStorage.removeItem(SAVE_KEY) }

/* ═══ ちんちろりん日付キー（深夜3時区切り） ═══ */
export function getChinchiroDayKey() {
    const now = new Date()
    if (now.getHours() < 3) {
        const d = new Date(now)
        d.setDate(d.getDate() - 1)
        return d.toDateString()
    }
    return now.toDateString()
}

/* ═══ OpenWeather API ═══ */
const OW_MAP = {
    Clear: 'clear', Clouds: 'cloudy', Rain: 'rain', Drizzle: 'rain',
    Thunderstorm: 'rain', Snow: 'snow', Mist: 'cloudy', Fog: 'cloudy',
    Haze: 'cloudy', Dust: 'wind', Sand: 'wind', Squall: 'wind', Tornado: 'wind',
}

export async function fetchRealWeather(apiKey) {
    if (!apiKey) return null
    try {
        const r = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=Tokyo,jp&appid=${apiKey}&units=metric&lang=ja`)
        if (!r.ok) return null
        const d = await r.json()
        const wId = OW_MAP[d.weather?.[0]?.main] || 'clear'
        const w = (d.wind?.speed >= 10 && wId !== 'snow' && wId !== 'rain') ? WEATHER_TYPES['wind'] : WEATHER_TYPES[wId]
        return {
            weather: w,
            realTemp: Math.round(d.main?.temp ?? 10),
            feelsLike: Math.round(d.main?.feels_like ?? 10),
            description: d.weather?.[0]?.description || '',
            humidity: d.main?.humidity ?? 0,
            windSpeed: Math.round((d.wind?.speed ?? 0) * 10) / 10,
            source: 'api',
        }
    } catch { return null }
}

/* ═══ 体感温度 ═══ */
export function getClothingFeelsBonus(clothing) {
    if (!clothing) return 5
    let total = 0
    for (const [slot, itemId] of Object.entries(clothing)) {
        // newspaper_equip は独立管理のため除外
        if (itemId && itemId !== 'newspaper_equip' && CLOTHING_ITEMS[itemId]) {
            total += CLOTHING_ITEMS[itemId].feelsBonus
        }
    }
    return total
}

export function calculateFeelsLikeTemp(state, weatherData) {
    let base = weatherData ? (weatherData.feelsLike ?? weatherData.realTemp) : 15
    base += weatherData ? (weatherData.weather.tempMod || 0) : 0
    if (state.area === 'park') base += BASE_LEVELS[state.baseLevel]?.feelsBonus || 0
    base += getClothingFeelsBonus(state.clothing)
    // 新聞紙装備ボーナス（clothingスロット不使用・独立管理）
    if (state.newspaperEquipTime) base += 1
    // 雨天時・雨具なしペナルティ: -3℃
    const isRainy = ['rain', 'wind', 'snow'].includes(weatherData?.weather?.id)
    const hasRainProtection = ['umbrella', 'kappa', 'bluesheet'].includes(state.clothing?.umbrella)
    if (isRainy && !hasRainProtection) base -= 3
    return Math.round(base)
}

/* ═══ つぶやき ═══ */
export function getMumble(state) {
    const lines = []
    const { hp, hunger, temp, feelsLike } = state.status
    const diseases = state.diseases || []
    if (feelsLike < 0) lines.push('「さむい… しぬほど さむい…」')
    else if (feelsLike < 5) lines.push('「さむい… からだが ふるえる…」')
    else if (feelsLike < 10) lines.push('「さむいな… てが かじかむ…」')
    else if (feelsLike > 30) lines.push('「あつい… あせが とまらない…」')
    else if (feelsLike > 25) lines.push('「ちょっと あついな…」')
    else lines.push('「きおんは まあまあだな…」')
    if (diseases.length > 0) {
        const worst = [...diseases].sort((a, b) => b.level - a.level)[0]
        if (worst.id === 'kaze') lines.push('「からだが ねつっぽい… かぜかな…」')
        else if (worst.id === 'hypoglycemia') lines.push('「くらくらする… あたまが まわらない…」')
        else if (worst.id === 'skin_disease') lines.push('「かゆい… からだが かゆくて たまらない…」')
        if (worst.level >= 4) lines.push('「びょうきが ひどい… はやく くすりを もらわないと…」')
    }
    if (temp < 35) lines.push('「からだが ひえきってる… やばい…」')
    else if (temp > 37.5) lines.push('「ねつがあるみたいだ…」')
    if (hunger <= 0) lines.push('「はらが へりすぎて うごけない…」')
    else if (hunger < 20) lines.push('「はら へったな… なにか たべたい…」')
    else if (hunger < 40) lines.push('「すこし おなかがすいてきた…」')
    if (hp < 20) lines.push('「もう からだが かぎかいだ… たおれそう…」')
    else if (hp < 40) lines.push('「からだが おもい… きつい…」')
    else if (hp < 60) lines.push('「すこし つかれてるな…」')
    const hour = new Date().getHours()
    if ((hour >= 23 || hour < 5) && hp < 70) lines.push('「ねむい… どこかで やすみたい…」')
    if ((state.status.hygiene ?? 100) < SMELL_THRESHOLD) lines.push('「におうかな。。 せんとうにでも いくか…」')
    if (lines.length === 0) lines.push('「まあ なんとかなってるな。」')
    return lines
}

/* ═══ リアルタイム減少 ═══ */

// 病気HPダメージをまとめて適用するヘルパー
function applyDiseaseDecay(s, elapsedHours) {
    let totalDecay = 0
    for (const disease of (s.diseases || [])) {
        const def = DISEASES[disease.id]
        if (!def) continue
        totalDecay += (def.hpDecayPerHour[disease.level] || 0) * elapsedHours
    }
    if (totalDecay > 0) {
        s = { ...s, status: { ...s.status, hp: Math.max(0, s.status.hp - totalDecay) } }
    }
    return s
}

export function calculateRealtimeDecay(state, weatherData) {
    const now = Date.now()
    if (!state.lastTickTime) return { ...state, lastTickTime: now }
    const elapsedMs = Math.max(0, now - state.lastTickTime)
    const elapsedHours = elapsedMs / (1000 * 60 * 60)
    if (elapsedHours < 0.0001) return state

    let s = {
        ...state,
        status: { ...state.status },
        lastTickTime: now,
        diseases: [...(state.diseases || [])],
    }

    // 日付リセット
    const todayStr = new Date().toDateString()
    if (s.lastDateStr !== todayStr) {
        s.todayWorked = false
        s.todayFoodDist = false
        s.lastDateStr = todayStr
    }

    s.status.feelsLike = calculateFeelsLikeTemp(s, weatherData)

    // しんぶんし装備の24時間劣化チェック（clothingスロット不使用）
    if (s.newspaperEquipTime && now - s.newspaperEquipTime >= 24 * 60 * 60 * 1000) {
        s.newspaperEquipTime = null
    }

    // 睡眠中: HP回復、空腹・衛生は微減、病気ダメージは継続
    if (s.sleeping) {
        s.status.hp = Math.min(100, s.status.hp + elapsedHours * SLEEP_CONFIG.hpPerHour)
        s.status.hunger = Math.max(0, s.status.hunger - elapsedHours * SLEEP_CONFIG.hungerPerHour)
        s.status.hygiene = Math.max(0, (s.status.hygiene ?? 100) - elapsedHours * 0.5)
        // 新聞紙劣化（睡眠中も進行）
        if (s.newspaperEquipTime && now - s.newspaperEquipTime >= 24 * 60 * 60 * 1000) {
            s.newspaperEquipTime = null
        }
        s = applyDiseaseDecay(s, elapsedHours)
        return s
    }

    // 空腹
    const prevHunger = s.status.hunger
    s.status.hunger = Math.max(0, s.status.hunger - elapsedHours * 2)
    if (prevHunger > 0 && s.status.hunger <= 0) {
        s.hungerZeroStart = now
    } else if (s.status.hunger > 0) {
        s.hungerZeroStart = null
    }

    // 衛生（雨天は劣化速度UP、雨具なしでさらに倍）
    const isRainy = ['rain', 'wind', 'snow'].includes(weatherData?.weather?.id)
    const hasRainProtection = ['umbrella', 'kappa', 'bluesheet'].includes(s.clothing?.umbrella)
    const isWet = isRainy && !hasRainProtection
    const baseHygieneRate = isRainy ? 5 : 3
    const hygieneDecayRate = isWet ? baseHygieneRate * 2 : baseHygieneRate
    s.status.hygiene = Math.max(0, (s.status.hygiene ?? 100) - elapsedHours * hygieneDecayRate)

    // 体温
    const feelsLike = s.status.feelsLike
    let tempTarget = 36.5
    if (feelsLike < 5) tempTarget = 34.0
    else if (feelsLike < 10) tempTarget = 35.0
    else if (feelsLike < 15) tempTarget = 35.5
    else if (feelsLike > 30) tempTarget = 37.0
    s.status.temp += (tempTarget - s.status.temp) * Math.min(0.3, elapsedHours * 0.5)
    s.status.temp = Math.min(38.5, Math.max(30, s.status.temp))

    // ── 病気の発症判定 ──
    const kazeIdx = s.diseases.findIndex(d => d.id === 'kaze')
    const hypoIdx = s.diseases.findIndex(d => d.id === 'hypoglycemia')
    const skinIdx = s.diseases.findIndex(d => d.id === 'skin_disease')

    // かぜ発症（低体感温度＋低体温）
    if (feelsLike <= 5 && s.status.temp < 35 && kazeIdx === -1) {
        if (Math.random() < elapsedHours * 0.1) {
            s.diseases = [...s.diseases, { id: 'kaze', level: 1, lastEscalationTime: now }]
        }
    }
    // かぜ自然回復
    if (kazeIdx !== -1 && feelsLike >= 15 && s.status.temp >= 36) {
        if (Math.random() < elapsedHours * 0.05) {
            s.diseases = s.diseases.filter(d => d.id !== 'kaze')
        }
    }

    // 低血糖発症（空腹0が2時間以上）
    if (s.status.hunger <= 0 && s.hungerZeroStart !== null && hypoIdx === -1) {
        if (now - s.hungerZeroStart >= DISEASES.hypoglycemia.triggerHungerZeroMs) {
            s.diseases = [...s.diseases, { id: 'hypoglycemia', level: 1, lastEscalationTime: now }]
        }
    }

    // 皮膚疾患発症（衛生30以下）
    if ((s.status.hygiene ?? 100) <= DISEASES.skin_disease.triggerHygieneThreshold && skinIdx === -1) {
        if (Math.random() < elapsedHours * 0.1) {
            s.diseases = [...s.diseases, { id: 'skin_disease', level: 1, lastEscalationTime: now }]
        }
    }

    // ── 病気の進行（24時間未治療でLv+1） ──
    s.diseases = s.diseases.map(disease => {
        const def = DISEASES[disease.id]
        if (!def || disease.level >= 5) return disease
        if (now - disease.lastEscalationTime >= def.escalationIntervalMs) {
            return { ...disease, level: disease.level + 1, lastEscalationTime: now }
        }
        return disease
    })

    // ── HP減少 ──
    s = applyDiseaseDecay(s, elapsedHours)
    let hpDecay = 0
    if (s.status.hunger <= 0) hpDecay += elapsedHours * 5
    if (s.status.temp < 34) hpDecay += elapsedHours * 5
    if (feelsLike < 0) hpDecay += elapsedHours * 2
    // 熱中症（夏季・体感温度35℃超）
    const month = new Date().getMonth() + 1
    if ((month >= 6 && month <= 9) && feelsLike > 35) {
        hpDecay += elapsedHours * 4
    }
    s.status.hp = Math.max(0, s.status.hp - hpDecay)

    return s
}

/* ═══ しらべる ═══ */
export function doSearch(state) {
    // 季節限定イベントを通常イベントにマージ
    let baseEvents = [...AREAS[state.area].searchEvents]
    if (isChristmasPeriod() && (state.area === 'tocho' || state.area === 'park' || state.area === 'nishiguchi')) {
        baseEvents = [...SEASONAL_SEARCH_EVENTS.christmas, ...baseEvents]
    }
    if (isSummerFestivalPeriod() && (state.area === 'park' || state.area === 'tocho')) {
        baseEvents = [...SEASONAL_SEARCH_EVENTS.summer, ...baseEvents]
    }

    let s = { ...state, status: { ...state.status }, materials: { ...state.materials }, inventory: [...(state.inventory || [])] }
    const roll = Math.random()
    let cum = 0
    let chosen = baseEvents[baseEvents.length - 1]
    for (const ev of baseEvents) { cum += ev.chance / baseEvents.length; if (roll < cum) { chosen = ev; break } }
    const logs = []
    switch (chosen.type) {
        case 'money': {
            const amt = Math.floor(Math.random() * (chosen.max - chosen.min + 1)) + chosen.min
            logs.push({ text: chosen.text.replace('{amount}', amt), type: 'narration' })
            s.status.yen += amt; break
        }
        case 'base_material':
            logs.push({ text: chosen.text, type: 'narration' })
            s.materials[chosen.material] = (s.materials[chosen.material] || 0) + 1; break
        case 'item': {
            const pickedDef = ITEMS[chosen.item]
            if (pickedDef?.type === 'appliance') {
                const hasAppliance = s.inventory.some(id => ITEMS[id]?.type === 'appliance')
                if (hasAppliance) {
                    logs.push({ text: 'もちものが いっぱいで ひろえなかった…', type: 'narration' })
                    break
                }
            }
            logs.push({ text: chosen.text, type: 'narration' })
            s.inventory.push(chosen.item); break
        }
        case 'heal':
            logs.push({ text: chosen.text, type: 'narration' })
            if (chosen.hp) s.status.hp = Math.min(100, s.status.hp + chosen.hp); break
        default:
            logs.push({ text: chosen.text, type: 'narration' })
    }
    s.totalActions++
    return { state: s, logs }
}

/* ═══ はなす (giveItem対応・おにぎり制限) ═══ */
export function doTalk(state) {
    // 皮膚疾患Lv2以上で会話拒否
    const skinDisease = (state.diseases || []).find(d => d.id === 'skin_disease')
    if (skinDisease && skinDisease.level >= 2) {
        return { state, logs: [{ text: 'ひふしっかんが ひどく にじゅうされた… くすりが ひつよう。', type: 'narration' }] }
    }
    // においペナルティ（hygiene 低い場合は50%で会話失敗）
    if ((state.status.hygiene ?? 100) < SMELL_THRESHOLD && Math.random() < 0.5) {
        return { state, logs: [{ text: 'つうこうにん「くさい！ あっちいってくれ！」', type: 'quote' }] }
    }
    const events = AREAS[state.area].talkEvents
    const chosen = events[Math.floor(Math.random() * events.length)]
    if (chosen.isShop) return { state, logs: [{ text: chosen.text, type: 'quote' }], openShop: true }
    if (chosen.isBentoShop) return { state, logs: [{ text: chosen.text, type: 'quote' }], openBentoShop: true }
    if (chosen.isFurugiyaShop) return { state, logs: [{ text: chosen.text, type: 'quote' }], openFurugiyaShop: true }
    if (chosen.isSento) return { state, logs: [{ text: chosen.text, type: 'quote' }], openSentoShop: true }
    if (chosen.isRecycle) return { state, logs: [{ text: chosen.text, type: 'quote' }], openRecycleShop: true }
    if (chosen.isFukubiki) return { state, logs: [{ text: chosen.text, type: 'quote' }], openFukubikiShop: true }
    let s = { ...state, status: { ...state.status }, inventory: [...(state.inventory || [])], onigiriLog: [...(state.onigiriLog || [])] }
    if (chosen.giveItem) {
        // おにぎり制限: 2時間で2個まで
        if (chosen.giveItem === 'onigiri') {
            const now = Date.now()
            const twoHoursAgo = now - 2 * 60 * 60 * 1000
            const recentOnigiri = s.onigiriLog.filter(t => t > twoHoursAgo)
            if (recentOnigiri.length >= 2) {
                s.totalActions++
                return { state: s, logs: [{ text: 'つうこうにん「いまは あげられるものが ないんだ… ごめんな」', type: 'quote' }], openShop: false }
            }
            s.onigiriLog = [...recentOnigiri, now]
        }
        s.inventory.push(chosen.giveItem)
    }
    // ランダム金銭贈与
    let logText = chosen.text
    if (chosen.giveYen) {
        const amt = Math.floor(Math.random() * (chosen.giveYen.max - chosen.giveYen.min + 1)) + chosen.giveYen.min
        s.status.yen += amt
        logText = logText.replace('{amount}', amt)
    }
    if (chosen.effect) {
        if (chosen.effect.hunger) s.status.hunger = Math.min(100, s.status.hunger + chosen.effect.hunger)
        if (chosen.effect.hp) s.status.hp = Math.max(0, Math.min(100, s.status.hp + chosen.effect.hp))
        // ランダムHPペナルティ
        if (chosen.effect.randomHpMod) {
            const { min, max } = chosen.effect.randomHpMod
            const mod = Math.floor(Math.random() * (max - min + 1)) + min
            s.status.hp = Math.max(0, Math.min(100, s.status.hp + mod))
        }
    }
    s.totalActions++
    return { state: s, logs: [{ text: logText, type: 'quote' }], openShop: false }
}

/* ═══ 福引券おまけ付与ヘルパー ═══ */
function tryGrantFukubikiTicket(inventory, price) {
    const inv = [...inventory]
    const logs = []
    if (price >= 1000) {
        inv.push('fukubiki_ticket')
        logs.push({ text: '「ほらよ、オマケだ」 てんしゅから ふくびきけん をもらった！', type: 'system' })
        if (Math.random() < 0.20) {
            inv.push('fukubiki_ticket')
            logs.push({ text: 'もう1まい もらった！', type: 'system' })
        }
    } else if (price >= 500 && Math.random() < 0.30) {
        inv.push('fukubiki_ticket')
        logs.push({ text: '「ほらよ、オマケだ」 てんしゅから ふくびきけん をもらった！', type: 'system' })
    }
    return { inventory: inv, logs }
}

/* ═══ 弁当屋 → もちものに追加 ═══ */
export function buyBentoItem(state, itemId) {
    const shopItem = BENTO_SHOP_ITEMS.find(i => i.id === itemId)
    if (!shopItem) return { state, logs: [] }
    let s = { ...state, status: { ...state.status }, inventory: [...(state.inventory || [])] }
    if (s.status.yen < shopItem.price) return { state, logs: [{ text: 'てんいん「おかねがたりないね…」', type: 'quote' }] }
    s.status.yen -= shopItem.price
    s.inventory.push(itemId)  // もちものに追加
    const ticketResult = tryGrantFukubikiTicket(s.inventory, shopItem.price)
    s.inventory = ticketResult.inventory
    s.totalActions++
    return { state: s, logs: [{ text: `${shopItem.name} をかった。 もちものに いれた。`, type: 'narration' }, ...ticketResult.logs] }
}

/* ═══ 古着屋 → 装備スロットに直接装着 ═══ */
export function buyFurugiyaItem(state, itemId) {
    const shopItem = FURUGIYA_ITEMS.find(i => i.id === itemId)
    if (!shopItem) return { state, logs: [] }
    let s = { ...state, status: { ...state.status }, clothing: { ...state.clothing } }
    if (s.status.yen < shopItem.price) return { state, logs: [{ text: 'てんしゅ「おかねがたりないな…」', type: 'quote' }] }
    // 既に同じスロットに同じアイテムを装備していないかチェック
    if (s.clothing[shopItem.slot] === shopItem.id) {
        return { state, logs: [{ text: `もう ${shopItem.name} をそうびしている。`, type: 'narration' }] }
    }
    s.status.yen -= shopItem.price
    s.clothing[shopItem.slot] = shopItem.id
    const ticketResultF = tryGrantFukubikiTicket(s.inventory, shopItem.price)
    s.inventory = ticketResultF.inventory
    s.totalActions++
    return {
        state: s, logs: [
            { text: `${shopItem.name} をかって そうびした！`, type: 'narration' },
            { text: `たいかんおんどが +${shopItem.feelsBonus}℃ あがった。`, type: 'narration' },
            ...ticketResultF.logs,
        ]
    }
}

/* ═══ リサイクルショップ 購入 ═══ */
export function buyRecycleShopItem(state, itemId) {
    const shopItem = RECYCLE_SHOP_ITEMS.find(i => i.id === itemId)
    if (!shopItem) return { state, logs: [] }
    let s = {
        ...state,
        status: { ...state.status },
        inventory: [...(state.inventory || [])],
        materials: { ...state.materials },
        clothing: { ...state.clothing },
    }
    if (s.status.yen < shopItem.price) return { state, logs: [{ text: 'てんいん「おかねがたりないです…」', type: 'quote' }] }
    s.status.yen -= shopItem.price
    const logs = []
    if (shopItem.targetMaterial) {
        s.materials[shopItem.targetMaterial] = (s.materials[shopItem.targetMaterial] || 0) + 1
        logs.push({ text: `${shopItem.name} をかった。（${s.materials[shopItem.targetMaterial]}まい もち）`, type: 'narration' })
    } else if (shopItem.targetClothing) {
        const clothingItem = CLOTHING_ITEMS[shopItem.id]
        if (clothingItem) {
            if (s.clothing[shopItem.targetClothing] === shopItem.id) {
                return { state, logs: [{ text: `もう ${shopItem.name} をそうびしている。`, type: 'narration' }] }
            }
            s.clothing[shopItem.targetClothing] = shopItem.id
            const feelsBonus = clothingItem.feelsBonus
            logs.push({ text: `${shopItem.name} をかって そうびした！`, type: 'narration' })
            if (feelsBonus > 0) logs.push({ text: `たいかんおんどが +${feelsBonus}℃ あがった。`, type: 'narration' })
        }
    }
    const ticketResult = tryGrantFukubikiTicket(s.inventory, shopItem.price)
    s.inventory = ticketResult.inventory
    logs.push(...ticketResult.logs)
    s.totalActions = (s.totalActions || 0) + 1
    return { state: s, logs }
}

/* ═══ ベテラン情報購入 ═══ */
export function buyVeteranInfo(state) {
    const info = VETERAN_INFO[Math.floor(Math.random() * VETERAN_INFO.length)]
    let s = { ...state, status: { ...state.status } }
    if (s.status.yen < info.cost) return { state, logs: [{ text: 'ベテラン「おかねがないと おしえられないな…」', type: 'quote' }] }
    s.status.yen -= info.cost
    s.totalActions++
    return {
        state: s, logs: [
            { text: `¥${info.cost} はらった。`, type: 'system' },
            { text: info.text, type: 'quote' },
        ]
    }
}

/* ═══ もちもの: アイテム使用 ═══ */
export function useItem(state, index) {
    let s = { ...state, status: { ...state.status }, inventory: [...(state.inventory || [])], clothing: { ...state.clothing }, diseases: [...(state.diseases || [])] }
    const itemId = s.inventory[index]
    const item = ITEMS[itemId]
    if (!item || !item.usable) return { state, logs: [{ text: 'つかえないアイテムだ。', type: 'narration' }] }
    s.inventory.splice(index, 1)
    const logs = []
    if (item.type === 'food') {
        const prevHunger = Math.round(s.status.hunger)
        const prevHp = Math.round(s.status.hp)
        if (item.hungerRestore) s.status.hunger = Math.min(100, s.status.hunger + item.hungerRestore)
        if (item.hpRestore) s.status.hp = Math.min(100, s.status.hp + item.hpRestore)
        logs.push({ text: `${item.name}をたべた。`, type: 'narration' })
        if (item.hungerRestore) logs.push({ text: `くうふくが ${item.hungerRestore} かいふくした。（${prevHunger}→${Math.round(s.status.hunger)}）`, type: 'narration' })
        if (item.hpRestore) logs.push({ text: `たいりょくが ${item.hpRestore} かいふくした。（${prevHp}→${Math.round(s.status.hp)}）`, type: 'narration' })
        if (item.feelsBonus) {
            s.status.temp = Math.min(37.5, s.status.temp + item.feelsBonus * 0.3)
            logs.push({ text: `ぽかぽか あたたまりました！ からだのおんど が ${item.feelsBonus}ど あがりました。`, type: 'narration' })
        }
    } else if (item.type === 'drink') {
        const prevHungerD = Math.round(s.status.hunger)
        const prevHpD = Math.round(s.status.hp)
        if (item.hungerRestore) s.status.hunger = Math.min(100, s.status.hunger + item.hungerRestore)
        if (item.hpRestore) s.status.hp = Math.min(100, s.status.hp + item.hpRestore)
        if (item.feelsBonus) s.status.temp = Math.min(37.5, s.status.temp + item.feelsBonus * 0.3)
        logs.push({ text: `${item.name}をのんだ。`, type: 'narration' })
        if (item.hungerRestore) logs.push({ text: `くうふくが ${item.hungerRestore} かいふくした。（${prevHungerD}→${Math.round(s.status.hunger)}）`, type: 'narration' })
        if (item.hpRestore) logs.push({ text: `たいりょくが ${item.hpRestore} かいふくした。（${prevHpD}→${Math.round(s.status.hp)}）`, type: 'narration' })
        if (item.feelsBonus) logs.push({ text: `ぽかぽか あたたまった！ たいかんおんどが +${item.feelsBonus}℃`, type: 'narration' })
    } else if (item.type === 'equip_newspaper') {
        // 新聞紙は clothing スロットを使わず newspaperEquipTime で独立管理
        if (s.newspaperEquipTime) {
            s.inventory.push(itemId)
            logs.push({ text: 'もう しんぶんしを そうびしている。', type: 'narration' })
        } else {
            s.newspaperEquipTime = Date.now()
            logs.push({ text: 'しんぶんしを まきつけた。たいかんおんど+1℃', type: 'narration' })
        }
    } else if (item.type === 'warmth') {
        s.status.temp = Math.min(37.5, s.status.temp + (item.feelsBonus || 1) * 0.3)
        logs.push({ text: `${item.name} をつかった。 すこし あたたかくなった。`, type: 'narration' })
    } else if (item.type === 'medicine') {
        if (s.diseases.length === 0) {
            s.inventory.push(itemId)
            logs.push({ text: 'いまは びょうきでは ない。', type: 'narration' })
        } else {
            const sorted = [...s.diseases].sort((a, b) => b.level - a.level)
            const target = sorted[0]
            const newLevel = Math.max(0, target.level - item.lvReduction)
            const diseaseName = DISEASES[target.id]?.name || target.id
            if (newLevel === 0) {
                s.diseases = s.diseases.filter(d => d.id !== target.id)
                logs.push({ text: `${item.name}をのんだ。 ${diseaseName} がかんかいした！`, type: 'narration' })
            } else {
                s.diseases = s.diseases.map(d => d.id === target.id
                    ? { ...d, level: newLevel, lastEscalationTime: Date.now() }
                    : d)
                logs.push({ text: `${item.name}をのんだ。 ${diseaseName} Lv${newLevel} になった。`, type: 'narration' })
            }
        }
    } else if (item.type === 'cooling') {
        if (item.hpRestore) s.status.hp = Math.min(100, s.status.hp + item.hpRestore)
        if (item.tempCool) s.status.temp = Math.max(35.0, s.status.temp - item.tempCool)
        logs.push({ text: `${item.name}をつかった。 からだが すずしくなった。`, type: 'narration' })
        if (item.hpRestore) logs.push({ text: `たいりょくが ${item.hpRestore} かいふくした。`, type: 'narration' })
    } else if (item.type === 'sell_item') {
        s.status.yen += item.sellValue || 0
        logs.push({ text: `${item.name}を うった！ ¥${item.sellValue} てにはいった。`, type: 'narration' })
    } else if (item.type === 'hygiene') {
        if (item.hygieneRestore) s.status.hygiene = Math.min(100, (s.status.hygiene ?? 0) + item.hygieneRestore)
        logs.push({ text: `${item.name}をつかった。 えいせいが ${item.hygieneRestore || 0} かいふくした。`, type: 'narration' })
    } else if (item.type === 'equip_bluesheet') {
        if (s.clothing.umbrella === 'bluesheet') {
            s.inventory.push(itemId)
            logs.push({ text: 'もう ブルーシートを 雨よけに そうびしている。', type: 'narration' })
        } else {
            s.clothing.umbrella = 'bluesheet'
            logs.push({ text: 'ブルーシートを 雨よけに そうびした。', type: 'narration' })
        }
    }
    return { state: s, logs }
}

/* ═══ 日雇い (4時間) ═══ */
export function canRecruitJob(state) {
    if (state.area !== 'park' || state.todayWorked || state.sleeping) return false
    const h = new Date().getHours() + new Date().getMinutes() / 60
    return h >= DAY_LABOR.recruitStart && h <= DAY_LABOR.recruitEnd
}

export function applyForJob(state) {
    // 皮膚疾患Lv2以上で就労拒否
    const skinDisease = (state.diseases || []).find(d => d.id === 'skin_disease')
    if (skinDisease && skinDisease.level >= 2) {
        return {
            state,
            logs: [{ text: 'ひふしっかんが ひどく さぎょういんに ことわられた…', type: 'narration' }],
            accepted: false,
        }
    }
    const now = Date.now()
    // しんらいどが高いと優良案件チャンス
    const trust = state.status.trust || 0
    if (trust >= TRUST_BENEFITS.goodJobThreshold && Math.random() < 0.35) {
        const gj = TRUST_BENEFITS.goodJob
        return {
            state: { ...state, todayWorked: true, activeJob: { startTime: now, endTime: now + DAY_LABOR.durationMs, isGoodJob: true } },
            logs: [
                { text: 'ちゅうせんに あたった！', type: 'narration' },
                { text: `しんらいどが たかく「${gj.label}」が しょうかいされた！`, type: 'system' },
            ],
            accepted: true,
        }
    }
    const won = Math.random() < DAY_LABOR.winChance
    if (!won) {
        return {
            state: { ...state, todayWorked: true },
            logs: [{ text: 'ちゅうせんの けっか… はずれ。きょうは しごとがない。', type: 'narration' }],
            accepted: false,
        }
    }
    return {
        state: { ...state, todayWorked: true, activeJob: { startTime: now, endTime: now + DAY_LABOR.durationMs } },
        logs: [{ text: 'ちゅうせんに あたった！ せいそうさぎょう かいし。', type: 'narration' }],
        accepted: true,
    }
}

export function checkJobCollapse(state) {
    if (!state.activeJob) return null
    if (state.status.hp <= DAY_LABOR.collapseHpThreshold) {
        let s = { ...state, status: { ...state.status }, activeJob: null }
        s.status.trust = Math.max(0, (s.status.trust || 0) - 10)
        return {
            state: s, logs: [
                { text: 'たいりょくがもたず とちゅうで たおれてしまった…', type: 'narration' },
                { text: 'しんらいど がさがった。', type: 'system' },
            ]
        }
    }
    return null
}

export function completeDayJob(state) {
    if (!state.activeJob) return { state, logs: [] }
    const isGoodJob = !!state.activeJob.isGoodJob
    const gj = TRUST_BENEFITS.goodJob
    const payRange = isGoodJob ? gj.pay : DAY_LABOR.pay
    const hpCost = isGoodJob ? gj.hpCost : DAY_LABOR.hpCost
    const hungerCost = isGoodJob ? gj.hungerCost : DAY_LABOR.hungerCost
    const pay = Math.floor(Math.random() * (payRange.max - payRange.min + 1)) + payRange.min
    let s = { ...state, status: { ...state.status }, activeJob: null }
    s.status.hp = Math.max(0, s.status.hp - hpCost)
    s.status.hunger = Math.max(0, s.status.hunger - hungerCost)
    s.status.yen += pay
    s.status.trust = Math.min(100, (s.status.trust || 0) + 3)
    s.totalActions++
    return {
        state: s, logs: [
            { text: `${isGoodJob ? 'ゆうりょうあんけん' : 'せいそうさぎょう'} おわり！ ${pay}えん かせいだ。`, type: 'narration' },
            { text: 'しんらいど すこしアップ。', type: 'system' },
        ]
    }
}

export function quitDayJob(state) {
    if (!state.activeJob) return { state, logs: [] }
    const { startTime } = state.activeJob
    const ratio = Math.min(1, (Date.now() - startTime) / DAY_LABOR.durationMs)
    let s = { ...state, status: { ...state.status }, activeJob: null }
    s.status.hp = Math.max(0, s.status.hp - DAY_LABOR.hpCost * ratio * 0.5)
    s.status.hunger = Math.max(0, s.status.hunger - DAY_LABOR.hungerCost * ratio * 0.5)
    s.status.trust = Math.max(0, (s.status.trust || 0) - 10)
    return {
        state: s, logs: [
            { text: 'しごとを とちゅうで やめた…', type: 'narration' },
            { text: 'しんらいど ダウン。', type: 'system' },
        ]
    }
}

/* ═══ 作業中はなす ═══ */
export function doWorkTalk() {
    const text = WORK_TALK_EVENTS[Math.floor(Math.random() * WORK_TALK_EVENTS.length)]
    return [{ text, type: 'quote' }]
}

/* ═══ 食料配布 → もちものに追加 ═══ */
export function checkFoodDistribution(state) {
    if (state.area !== FOOD_DISTRIBUTION.area) return false
    if (state.todayFoodDist) return false
    const h = new Date().getHours()
    const inTime = h >= FOOD_DISTRIBUTION.startHour && h < FOOD_DISTRIBUTION.endHour
    const hasTicket = (state.inventory || []).includes('priority_ticket')
    return inTime || hasTicket
}

export function takeFoodDistribution(state) {
    const h = new Date().getHours()
    const inNormalTime = h >= FOOD_DISTRIBUTION.startHour && h < FOOD_DISTRIBUTION.endHour
    let s = { ...state, inventory: [...(state.inventory || [])], todayFoodDist: true }
    // 時間外かつ優先券使用 → 券を消費
    if (!inNormalTime) {
        const ticketIdx = s.inventory.indexOf('priority_ticket')
        if (ticketIdx !== -1) s.inventory.splice(ticketIdx, 1)
    }
    // クリスマス期間は特製シチュー
    const giveItemId = isChristmasPeriod() ? CHRISTMAS_FOOD_DIST_ITEM : FOOD_DISTRIBUTION.giveItem
    s.inventory.push(giveItemId)
    const itemName = giveItemId === CHRISTMAS_FOOD_DIST_ITEM ? 'とくせいシチュー' : 'おべんとう'
    const text = isChristmasPeriod()
        ? `クリスマスの たきだし！ ${itemName}をもらった！`
        : FOOD_DISTRIBUTION.text
    return { state: s, logs: [{ text, type: 'narration' }] }
}

/* ═══ 医療・支援 ═══ */
export function getAvailableSupportEvents(state) {
    const now = new Date()
    const hour = now.getHours() + now.getMinutes() / 60
    const dow = now.getDay()
    const weekOfMonth = Math.ceil(now.getDate() / 7)
    const isWeekday = dow >= 1 && dow <= 5
    const available = []
    const gp = SUPPORT_EVENTS.gohanPlus
    if (state.area === gp.area && dow === gp.dayOfWeek && hour >= gp.startHour && hour < gp.endHour) available.push(gp)
    const rk = SUPPORT_EVENTS.renrakukai
    if (state.area === rk.area && dow === rk.dayOfWeek && weekOfMonth === rk.weekOfMonth && hour >= rk.startHour && hour < rk.endHour) available.push(rk)
    const sd = SUPPORT_EVENTS.soudan
    if (state.area === sd.area && isWeekday && hour >= sd.startHour && hour < sd.endHour) available.push(sd)
    return available
}

export function useSupportEvent(state, event) {
    let s = { ...state, status: { ...state.status }, diseases: [...(state.diseases || [])] }
    if (event.effects.hunger) s.status.hunger = Math.min(100, s.status.hunger + event.effects.hunger)
    if (event.effects.hp) s.status.hp = Math.min(100, s.status.hp + event.effects.hp)
    if (event.healSick && s.diseases.length > 0) {
        // 医療相談: 各病気のLvを2下げる（最低1）
        s.diseases = s.diseases.map(d => ({
            ...d,
            level: Math.max(1, d.level - 2),
            lastEscalationTime: Date.now(),
        }))
    }
    s.totalActions++
    return { state: s, logs: [{ text: event.text, type: 'narration' }] }
}

/* ═══ 病院（そうだんまどぐち）診察・処方 ═══ */
export function visitHospital(state) {
    const now = new Date()
    const hour = now.getHours() + now.getMinutes() / 60
    const dow = now.getDay()
    if (!(dow >= 1 && dow <= 5) || hour < 9 || hour >= 17) {
        return { state, logs: [{ text: 'うけつけ: 「へいじつ 9:00〜17:00 のみ しんさつできます。」', type: 'quote' }] }
    }
    const diseases = state.diseases || []
    if (diseases.length === 0) {
        return { state, logs: [{ text: 'いしゃ「とくに いじょうは みあたりません。 きをつけて くらしてね。」', type: 'quote' }] }
    }
    const sorted = [...diseases].sort((a, b) => b.level - a.level)
    const worst = sorted[0]
    const diseaseName = DISEASES[worst.id]?.name || worst.id
    const logs = []
    let prescribed = []
    if (worst.level <= 2) {
        prescribed = ['medicine_normal']
        logs.push({ text: `いしゃ「${diseaseName} ですね。 くすりを だしておきます。」`, type: 'quote' })
    } else if (worst.level <= 4) {
        prescribed = ['medicine_strong', 'medicine_strong']
        logs.push({ text: `いしゃ「${diseaseName} Lv${worst.level}… かなり ひどいですね。 つよいくすりを2こ だします。」`, type: 'quote' })
    } else {
        prescribed = ['medicine_bulk']
        logs.push({ text: `いしゃ「Lv5！ じゅうたいです！ にゅういんが ひつよう。 とくべつな くすりを だします。」`, type: 'quote' })
    }
    let s = { ...state, inventory: [...(state.inventory || [])] }
    for (const med of prescribed) s.inventory.push(med)
    logs.push({ text: `くすりを ${prescribed.length}こ もらった。 もちものから「つかう」こと。`, type: 'narration' })
    s.totalActions = (s.totalActions || 0) + 1
    return { state: s, logs }
}

/* ═══ しんらいど特典 ═══ */
export function grantPriorityTicket(state) {
    if ((state.status.trust || 0) < TRUST_BENEFITS.priorityTicketThreshold) {
        return { state, logs: [{ text: 'ベテラン「まだ しんらいどが たりないな…」', type: 'quote' }] }
    }
    let s = { ...state, inventory: [...(state.inventory || [])] }
    if (s.inventory.includes('priority_ticket')) {
        return { state, logs: [{ text: 'ベテラン「もう もってるじゃないか。」', type: 'quote' }] }
    }
    s.inventory.push('priority_ticket')
    return {
        state: s, logs: [
            { text: 'ベテラン「しんらいどが たかいから これを やろう。」', type: 'quote' },
            { text: 'たきだしゆうせんけんを もらった！', type: 'narration' },
        ]
    }
}

/* ═══ ねる / おきる ═══ */
export function startSleep(state) {
    if (state.area !== 'park') return { state, logs: [{ text: 'きょてんでしか ねられない。 こうえんにいこう。', type: 'system' }] }
    if (state.sleeping) return { state, logs: [{ text: 'もう ねている。', type: 'system' }] }
    if (state.activeJob) return { state, logs: [{ text: 'しごとちゅうは ねられない。', type: 'system' }] }
    return {
        state: { ...state, sleeping: { startTime: Date.now() } },
        logs: [{ text: 'よこになった… zzz', type: 'narration' }],
    }
}

export function wakeUp(state) {
    if (!state.sleeping) return { state, logs: [] }
    let s = { ...state, sleeping: null }
    // HP回復・空腹減少はcalculateRealtimeDecay内でリアルタイム反映済み
    const elapsedH = (Date.now() - state.sleeping.startTime) / (1000 * 60 * 60)
    const h = Math.floor(elapsedH)
    const m = Math.floor((elapsedH - h) * 60)
    const hpRecovered = Math.min(Math.round(elapsedH * SLEEP_CONFIG.hpPerHour), 100)
    return {
        state: s, logs: [
            { text: `めがさめた。 ${h}じかん${m}ふん ねた。`, type: 'narration' },
            { text: `たいりょくが ${hpRecovered} かいふくした。`, type: 'narration' },
        ]
    }
}

/* ═══ きょてん ═══ */
export function upgradeBase(state) {
    const next = BASE_LEVELS[state.baseLevel + 1]
    if (!next) return { state, logs: [{ text: 'さいだいレベルだ。', type: 'system' }] }
    let s = { ...state, status: { ...state.status }, materials: { ...state.materials }, inventory: [...(state.inventory || [])] }
    // テントアイテムが必要な場合（Lv3）
    if (next.requiresItem) {
        const idx = s.inventory.indexOf(next.requiresItem)
        if (idx === -1) return { state, logs: [{ text: 'テントが ひつよう。 ふくびきで てにいれよう。', type: 'system' }] }
        s.inventory.splice(idx, 1)
    }
    s.status.yen -= next.cost
    if (next.requires) { for (const [k, v] of Object.entries(next.requires)) s.materials[k] -= v }
    s.baseLevel = next.level
    s.totalActions++
    return { state: s, logs: [{ text: `きょてんを ${next.name} にした！ ${next.desc}`, type: 'narration' }] }
}

/* ═══ においヘルパー ═══ */
export function isSmelly(state) {
    return (state.status.hygiene ?? 100) < SMELL_THRESHOLD
}

/* ═══ 銭湯 ═══ */
export function useSento(state) {
    if (state.status.yen < SENTO_PRICE) {
        return { state, logs: [{ text: `ばんとうさん「にゅうよくは ¥${SENTO_PRICE} です。」`, type: 'quote' }] }
    }
    let s = { ...state, status: { ...state.status } }
    s.status.yen -= SENTO_PRICE
    s.status.hygiene = Math.min(100, (s.status.hygiene ?? 0) + SENTO_HYGIENE_RESTORE)
    s.totalActions = (s.totalActions || 0) + 1
    return {
        state: s, logs: [
            { text: `¥${SENTO_PRICE} はらって にゅうよくした。`, type: 'narration' },
            { text: `えいせいが おおきく かいふくした！ (${Math.round(s.status.hygiene)})`, type: 'narration' },
        ]
    }
}

/* ═══ リサイクルショップ 換金 ═══ */
export function getSellableItems(state) {
    const inv = state.inventory || []
    const seen = {}
    const result = []
    inv.forEach((id, idx) => {
        const item = ITEMS[id]
        if (!item || !item.sellValue) return
        if (!seen[id]) { seen[id] = { id, item, indices: [] } }
        seen[id].indices.push(idx)
    })
    return Object.values(seen)
}

export function sellRecycleItem(state, itemId) {
    const inv = [...(state.inventory || [])]
    const idx = inv.findIndex(id => id === itemId)
    if (idx === -1) return { state, logs: [{ text: 'そのアイテムは もっていない。', type: 'system' }] }
    const item = ITEMS[itemId]
    if (!item?.sellValue) return { state, logs: [{ text: 'これは うれない。', type: 'system' }] }
    inv.splice(idx, 1)
    let s = { ...state, status: { ...state.status }, inventory: inv }
    s.status.yen += item.sellValue
    s.totalActions = (s.totalActions || 0) + 1
    return {
        state: s, logs: [
            { text: `てんいん「${item.name}ですね。¥${item.sellValue} で かいとります。」`, type: 'quote' },
            { text: `¥${item.sellValue} てにはいった。`, type: 'narration' },
        ]
    }
}

/* ═══ 福引 ═══ */
export function doFukubiki(state) {
    const inv = [...(state.inventory || [])]
    const ticketCount = inv.filter(id => id === 'fukubiki_ticket').length
    if (ticketCount < FUKUBIKI_TICKET_COST) {
        return { state, logs: [{ text: `ふくびきけんが ${FUKUBIKI_TICKET_COST}まい ひつよう。いまは ${ticketCount}まい。`, type: 'system' }] }
    }
    // チケット3枚消費
    let removed = 0
    const newInv = inv.filter(id => {
        if (id === 'fukubiki_ticket' && removed < FUKUBIKI_TICKET_COST) { removed++; return false }
        return true
    })
    // 抽選（直接重み付き選択: chanceの合計が1.0になるよう設定済み）
    const roll = Math.random()
    let cum = 0
    let prize = FUKUBIKI_PRIZES[FUKUBIKI_PRIZES.length - 1]
    for (const p of FUKUBIKI_PRIZES) {
        cum += p.chance
        if (roll < cum) { prize = p; break }
    }
    if (prize.item) {
        const count = prize.count || 1
        for (let i = 0; i < count; i++) newInv.push(prize.item)
    }
    let s = { ...state, inventory: newInv }
    s.totalActions = (s.totalActions || 0) + 1
    const prizeType = (prize.item === 'tent_item') ? 'system' : (prize.item ? 'system' : 'narration')
    return {
        state: s, logs: [
            { text: 'ガラポンを まわした… ！', type: 'narration' },
            { text: prize.text, type: prizeType },
        ]
    }
}

/* ═══ アイテムボックス（衣服保管） ═══ */
export function storeClothing(state, slot) {
    if (state.baseLevel < 1) return { state, logs: [{ text: 'きょてんを アップグレードしないと つかえない。', type: 'system' }] }
    const itemId = state.clothing[slot]
    if (!itemId) return { state, logs: [{ text: 'そのスロットには なにも そうびしていない。', type: 'system' }] }
    const item = CLOTHING_ITEMS[itemId]
    let s = {
        ...state,
        clothing: { ...state.clothing, [slot]: null },
        clothingStorage: [...(state.clothingStorage || []), itemId],
    }
    return { state: s, logs: [{ text: `${item?.name || itemId} を アイテムボックスに しまった。`, type: 'narration' }] }
}

export function retrieveClothing(state, itemId) {
    if (state.baseLevel < 1) return { state, logs: [{ text: 'きょてんを アップグレードしないと つかえない。', type: 'system' }] }
    const storage = [...(state.clothingStorage || [])]
    const idx = storage.indexOf(itemId)
    if (idx === -1) return { state, logs: [{ text: 'そのアイテムは ボックスに ない。', type: 'system' }] }
    const item = CLOTHING_ITEMS[itemId]
    if (!item) return { state, logs: [] }
    storage.splice(idx, 1)
    const clothing = { ...state.clothing, [item.slot]: itemId }
    let s = { ...state, clothing, clothingStorage: storage }
    return { state: s, logs: [{ text: `${item.name} を とりだして そうびした。`, type: 'narration' }] }
}

/* ═══ 天気予報取得 ═══ */
export async function fetchWeatherForecast(apiKey) {
    if (!apiKey) return null
    try {
        const r = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=Tokyo,jp&appid=${apiKey}&units=metric&lang=ja&cnt=8`)
        if (!r.ok) return null
        const d = await r.json()
        return (d.list || []).map(item => ({
            dt: item.dt * 1000,
            temp: Math.round(item.main?.temp ?? 0),
            desc: item.weather?.[0]?.description || '',
            icon: item.weather?.[0]?.main || 'Clear',
        }))
    } catch { return null }
}

/* ═══ ゲームオーバー ═══ */
export function isGameOver(state) { return state.status.hp <= 0 }

/* ═══ 残り時間 / 経過時間フォーマット ═══ */
export function formatRemainingTime(endTime) {
    const remaining = Math.max(0, endTime - Date.now())
    const h = Math.floor(remaining / (1000 * 60 * 60))
    const m = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
    return `あと ${h}じかん ${m}ふん`
}

export function formatElapsedTime(startTime) {
    const elapsed = Math.max(0, Date.now() - startTime)
    const h = Math.floor(elapsed / (1000 * 60 * 60))
    const m = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60))
    return `${h}じかん ${m}ふん`
}
