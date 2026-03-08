/*
 * chinchirorin.js – ちんちろりん ゲームロジック v2
 * 4パネルUI対応・3回振り制・ロール履歴・感想コメント
 */

/* ── 定数 ── */
const SHONBEN_RATE = 0.05
const MIN_BET = 100
const SENPAI_NAMES = ['せんぱいA', 'せんぱいB', 'せんぱいC']
const MAX_ROLLS = 3

/* ── 役の定義 ── */
export const YAKU = {
    PINZORO: { rank: 100, name: 'ピンゾロ', multiplier: 5, instant: 'win' },
    ARASHI: { rank: 90, name: 'アラシ', multiplier: 3, instant: 'win' },
    SHIGORO: { rank: 80, name: 'シゴロ', multiplier: 2, instant: 'win' },
    ME6: { rank: 60, name: '6のめ', multiplier: 1, instant: 'win' },
    ME5: { rank: 50, name: '5のめ', multiplier: 1, instant: null },
    ME4: { rank: 40, name: '4のめ', multiplier: 1, instant: null },
    ME3: { rank: 30, name: '3のめ', multiplier: 1, instant: null },
    ME2: { rank: 20, name: '2のめ', multiplier: 1, instant: null },
    ME1: { rank: 10, name: '1のめ', multiplier: 1, instant: 'lose' },
    MENASHI: { rank: 5, name: 'めなし', multiplier: 1, instant: 'lose' },
    SHONBEN: { rank: 3, name: 'ションベン', multiplier: 1, instant: 'lose' },
    HIFUMI: { rank: 1, name: 'ヒフミ', multiplier: 2, instant: 'lose' },
}

/* ── 感想コメント ── */
const COMMENTS = {
    PINZORO_WIN: ['うおおお!!ピンゾロ!!', 'まじかよ!!ピンゾロだ!!', 'きたーー!!ピンゾロ!!'],
    ARASHI_WIN: ['アラシだ!!つよい!!', 'ゾロ目きた!!', 'おおー!アラシ!!'],
    SHIGORO_WIN: ['シゴロ!!いい目だ!', 'シゴロきたー!', '456！さいこう!'],
    ME_HIGH: ['まあまあだな', 'わるくない', 'いいめがでた'],
    ME_LOW: ['うーん…びみょう', 'ちいさいな…', 'もうちょっとほしかった'],
    MENASHI: ['めなしかよ…', 'だめだこりゃ', 'はずれた…'],
    SHONBEN: ['あっ!!こぼした!!', 'ションベンだ…', 'やっちまった…'],
    HIFUMI: ['ヒフミ…さいあくだ', '123はまずい…', 'ヒフミかよ…'],
    WIN: ['やった！かった！', 'もうかったぜ', 'ラッキー！'],
    LOSE: ['くそー…まけた', 'まけちった…', 'つぎはかつ'],
    DRAW: ['ワカレか…', 'ひきわけだな', 'どっこいだ'],
    OYA_WIN_ALL: ['そうどり！きもちいい!', 'ぜんぶもらい!', 'おやのつよみ!'],
    OYA_LOSE_ALL: ['そうばらいか…', 'いたい…', 'おやはつらい…'],
    BROKE: ['もう…かねがない…', 'すっからかんだ…', 'おわった…まけた…', 'くやしい…ぜんぶもっていかれた'],
}

function randomComment(key) {
    const arr = COMMENTS[key] || ['…']
    return arr[Math.floor(Math.random() * arr.length)]
}

export function getComment(result, isWin) {
    if (!result) return '…'
    if (result.rank === YAKU.PINZORO.rank) return randomComment('PINZORO_WIN')
    if (result.rank === YAKU.ARASHI.rank) return randomComment('ARASHI_WIN')
    if (result.rank === YAKU.SHIGORO.rank) return randomComment('SHIGORO_WIN')
    if (result.rank === YAKU.HIFUMI.rank) return randomComment('HIFUMI')
    if (result.rank === YAKU.SHONBEN.rank) return randomComment('SHONBEN')
    if (result.rank === YAKU.MENASHI.rank) return randomComment('MENASHI')
    if (result.rank >= 50) return randomComment('ME_HIGH')
    return randomComment('ME_LOW')
}

export function getSettleComment(won) {
    if (won === 'win') return randomComment('WIN')
    if (won === 'lose') return randomComment('LOSE')
    return randomComment('DRAW')
}

/* ── サイコロ関連 ── */
function rollOneDie() { return Math.floor(Math.random() * 6) + 1 }

export function rollThreeDice() {
    return [rollOneDie(), rollOneDie(), rollOneDie()].sort((a, b) => a - b)
}

/** サイコロ3個を判定 */
export function judgeRoll(dice, checkShonben = true) {
    if (checkShonben && Math.random() < SHONBEN_RATE) {
        return { ...YAKU.SHONBEN, dice, settled: true }
    }
    const sorted = [...dice].sort((a, b) => a - b)
    const [a, b, c] = sorted

    if (a === 1 && b === 2 && c === 3) return { ...YAKU.HIFUMI, dice, settled: true }
    if (a === 1 && b === 1 && c === 1) return { ...YAKU.PINZORO, dice, settled: true }
    if (a === b && b === c) return { ...YAKU.ARASHI, dice, settled: true }
    if (a === 4 && b === 5 && c === 6) return { ...YAKU.SHIGORO, dice, settled: true }

    if (a === b) return { ...getMeYaku(c), dice, settled: true }
    if (b === c) return { ...getMeYaku(a), dice, settled: true }
    if (a === c) return { ...getMeYaku(b), dice, settled: true }

    return { ...YAKU.MENASHI, dice, settled: false }  // settled=false → 目なし（まだ振れる）
}

function getMeYaku(me) {
    switch (me) {
        case 6: return YAKU.ME6; case 5: return YAKU.ME5; case 4: return YAKU.ME4
        case 3: return YAKU.ME3; case 2: return YAKU.ME2; case 1: return YAKU.ME1
        default: return YAKU.MENASHI
    }
}

/* ── ゲームステート管理 ── */

export function initChinchiro(playerYen) {
    const players = [
        { id: 'player', name: 'じぶん', yen: playerYen, isHuman: true },
        ...SENPAI_NAMES.map((name, i) => ({
            id: `senpai${i}`, name,
            yen: Math.floor(Math.random() * 28) * 1000 + 3000,
            isHuman: false,
        }))
    ]
    return {
        phase: 'decide_oya',      // decide_oya | bet | rolling | settle | round_end | game_over
        players,
        oyaIndex: -1,
        activePlayerIndex: -1,    // 現在サイコロを振っているプレイヤー
        rolls: {},                // { playerId: [{ dice, result }] }  各プレイヤーのロール履歴
        finalResults: {},         // { playerId: result }  最終判定結果
        bets: {},
        comments: {},             // { playerId: string }
        roundNum: 0,
    }
}

/** 親決定 */
export function decideOya(state) {
    const diceRolls = state.players.map(p => ({ id: p.id, name: p.name, roll: rollOneDie() }))
    let maxRoll = 0, maxIdx = 0
    diceRolls.forEach((r, i) => { if (r.roll > maxRoll) { maxRoll = r.roll; maxIdx = i } })
    const comments = {}
    diceRolls.forEach((r, i) => {
        comments[r.id] = i === maxIdx ? 'おれがおやか' : `🎲${r.roll}`
    })
    return {
        ...state,
        phase: 'bet',
        oyaIndex: maxIdx,
        roundNum: state.roundNum + 1,
        comments,
        rolls: {},
        finalResults: {},
    }
}

/** NPCベット額 */
function npcBetAmount(yen) {
    if (yen <= 0) return 0
    const pct = 0.1 + Math.random() * 0.2
    return Math.min(Math.max(MIN_BET, Math.round(yen * pct / 100) * 100), yen)
}

/** ベット確定 */
export function placeBets(state, playerBet) {
    const bets = {}
    const comments = {}
    state.players.forEach((p, i) => {
        if (i === state.oyaIndex) { comments[p.id] = 'おやだ。まってるぞ'; return }
        if (p.yen <= 0) { bets[p.id] = 0; comments[p.id] = 'かねがない…'; return }
        if (p.isHuman) {
            bets[p.id] = Math.min(Math.max(MIN_BET, playerBet), p.yen)
            comments[p.id] = `¥${bets[p.id]} かけた`
        } else {
            bets[p.id] = npcBetAmount(p.yen)
            comments[p.id] = `¥${bets[p.id]} かけた`
        }
    })
    // 親から振り始める
    return {
        ...state, phase: 'rolling', bets, comments,
        activePlayerIndex: state.oyaIndex,
        rolls: {}, finalResults: {},
    }
}

/** 1回振る（1人のプレイヤーが1回サイコロを投擲） */
export function doOneRoll(state) {
    const pi = state.activePlayerIndex
    const p = state.players[pi]
    const pid = p.id
    const prevRolls = state.rolls[pid] || []

    // 既に確定している場合はスキップ
    if (state.finalResults[pid]) return state

    const dice = rollThreeDice()
    const result = judgeRoll(dice)
    const newRolls = [...prevRolls, { dice, result }]

    const newState = {
        ...state,
        rolls: { ...state.rolls, [pid]: newRolls },
        comments: { ...state.comments, [pid]: getComment(result) },
    }

    // 役が確定（settled=true）OR 3回振った → 最終結果確定
    if (result.settled || newRolls.length >= MAX_ROLLS) {
        const finalResult = result.settled ? result : { ...YAKU.MENASHI, dice, settled: true }
        newState.finalResults = { ...state.finalResults, [pid]: finalResult }
        newState.comments = { ...newState.comments, [pid]: getComment(finalResult) }
    }

    return newState
}

/** 次のプレイヤーに進む */
export function advanceToNextPlayer(state) {
    const currentIdx = state.activePlayerIndex
    const isOya = currentIdx === state.oyaIndex
    const oyaResult = state.finalResults[state.players[state.oyaIndex].id]

    if (isOya && oyaResult) {
        // 親の結果が確定 → 即決判定
        if (oyaResult.instant === 'win') {
            return settleOyaInstantWin(state)
        }
        if (oyaResult.instant === 'lose') {
            return settleOyaInstantLose(state)
        }
        // 勝負 → 次の子へ
        const nextKo = findNextKo(state.oyaIndex, state)
        if (nextKo === -1) return { ...state, phase: 'round_end' }
        return { ...state, activePlayerIndex: nextKo }
    }

    // 子の結果 → 次の子
    const nextKo = findNextKo(currentIdx, state)
    if (nextKo === -1) {
        return settleAllKo(state)
    }
    return { ...state, activePlayerIndex: nextKo }
}

/** 親即勝ち精算 */
function settleOyaInstantWin(state) {
    const newPlayers = state.players.map(p => ({ ...p }))
    const oyaResult = state.finalResults[state.players[state.oyaIndex].id]
    let totalWin = 0
    const comments = { ...state.comments }
    const payouts = {}

    Object.entries(state.bets).forEach(([pid, bet]) => {
        const payout = bet * oyaResult.multiplier
        const pIdx = newPlayers.findIndex(p => p.id === pid)
        const actual = Math.min(payout, newPlayers[pIdx].yen)
        newPlayers[pIdx].yen -= actual
        totalWin += actual
        payouts[pid] = -actual
        comments[pid] = getSettleComment('lose')
        if (newPlayers[pIdx].yen <= 0) comments[pid] = randomComment('BROKE')
    })
    newPlayers[state.oyaIndex].yen += totalWin
    payouts[state.players[state.oyaIndex].id] = totalWin
    comments[newPlayers[state.oyaIndex].id] = randomComment('OYA_WIN_ALL')

    // 破産チェック
    newPlayers.forEach(p => { if (p.yen <= 0 && !comments[p.id]?.includes('おわった')) comments[p.id] = comments[p.id] })

    return { ...state, players: newPlayers, phase: 'round_end', comments, payouts }
}

/** 親即負け精算 */
function settleOyaInstantLose(state) {
    const newPlayers = state.players.map(p => ({ ...p }))
    const oyaResult = state.finalResults[state.players[state.oyaIndex].id]
    let totalLoss = 0
    const comments = { ...state.comments }
    const payouts = {}

    Object.entries(state.bets).forEach(([pid, bet]) => {
        const payout = bet * oyaResult.multiplier
        const pIdx = newPlayers.findIndex(p => p.id === pid)
        const actual = Math.min(payout, newPlayers[state.oyaIndex].yen - totalLoss)
        if (actual > 0) { newPlayers[pIdx].yen += actual; totalLoss += actual; payouts[pid] = actual }
        else { payouts[pid] = 0 }
        comments[pid] = getSettleComment('win')
    })
    newPlayers[state.oyaIndex].yen -= totalLoss
    payouts[state.players[state.oyaIndex].id] = -totalLoss
    if (newPlayers[state.oyaIndex].yen <= 0) {
        comments[newPlayers[state.oyaIndex].id] = randomComment('BROKE')
    } else {
        comments[newPlayers[state.oyaIndex].id] = randomComment('OYA_LOSE_ALL')
    }

    return { ...state, players: newPlayers, phase: 'round_end', comments, payouts }
}

/** 全子の精算（勝負の場合） */
function settleAllKo(state) {
    const newPlayers = state.players.map(p => ({ ...p }))
    const oyaPid = state.players[state.oyaIndex].id
    const oyaResult = state.finalResults[oyaPid]
    const comments = { ...state.comments }
    let oyaNetChange = 0
    const payouts = {}

    state.players.forEach((p, i) => {
        if (i === state.oyaIndex) return
        const koResult = state.finalResults[p.id]
        if (!koResult) return
        const bet = state.bets[p.id] || 0
        if (bet <= 0) { payouts[p.id] = 0; return }

        if (koResult.instant === 'win' || koResult.rank > oyaResult.rank) {
            const mult = koResult.instant === 'win' ? koResult.multiplier : 1
            const payout = Math.max(0, Math.min(bet * mult, newPlayers[state.oyaIndex].yen + oyaNetChange))
            newPlayers[i].yen += payout
            oyaNetChange -= payout
            payouts[p.id] = payout
            comments[p.id] = getSettleComment('win')
        } else if (koResult.instant === 'lose' || koResult.rank < oyaResult.rank) {
            const mult = koResult.instant === 'lose' ? koResult.multiplier : 1
            const payout = Math.min(bet * mult, newPlayers[i].yen)
            newPlayers[i].yen -= payout
            oyaNetChange += payout
            payouts[p.id] = -payout
            comments[p.id] = newPlayers[i].yen <= 0 ? randomComment('BROKE') : getSettleComment('lose')
        } else {
            payouts[p.id] = 0
            comments[p.id] = getSettleComment('draw')
        }
    })

    newPlayers[state.oyaIndex].yen += oyaNetChange
    payouts[oyaPid] = oyaNetChange
    comments[oyaPid] = oyaNetChange > 0 ? randomComment('WIN') : oyaNetChange < 0 ? randomComment('LOSE') : randomComment('DRAW')

    // 親落ち判定はendRoundで行うためここではstateの更新のみ
    return { ...state, players: newPlayers, phase: 'round_end', comments, payouts }
}

/** ラウンド終了→次 or ゲームオーバー */
export function endRound(state) {
    const player = state.players.find(p => p.isHuman)
    const senpais = state.players.filter(p => !p.isHuman)
    const allSenpaisBroke = senpais.every(p => p.yen <= 0)

    if (allSenpaisBroke) {
        return { ...state, phase: 'game_over', comments: { [state.players[0].id]: 'せんぱいのかねがつきた！' } }
    }
    if (player.yen <= 0) {
        return { ...state, phase: 'game_over', comments: { [state.players[0].id]: 'かねがなくなった…' } }
    }

    const oyaPid = state.players[state.oyaIndex].id
    const oyaResult = state.finalResults[oyaPid]
    let oyaLost = false
    if (oyaResult && oyaResult.instant === 'lose') oyaLost = true
    else if (state.payouts && state.payouts[oyaPid] < 0) oyaLost = true

    const newOyaIndex = oyaLost ? findNextOya(state.oyaIndex, state.players) : state.oyaIndex

    return {
        ...state,
        phase: 'bet',
        roundNum: state.roundNum + 1,
        oyaIndex: newOyaIndex,
        rolls: {},
        finalResults: {},
        bets: {},
        payouts: null,
    }
}

/* ── ヘルパー ── */
function findNextOya(currentOya, players) {
    for (let i = 1; i < players.length; i++) {
        const idx = (currentOya + i) % players.length
        if (players[idx].yen > 0) return idx
    }
    return currentOya
}

function findNextKo(currentIdx, state) {
    const { players, oyaIndex, finalResults } = state
    for (let i = 1; i < players.length; i++) {
        const idx = (currentIdx + i) % players.length
        if (idx === oyaIndex) continue
        const pid = players[idx].id
        if (players[idx].yen > 0 && !finalResults[pid]) return idx
    }
    return -1
}

/** 時間チェック: 21:00〜27:00（翌3:00） */
export function canPlayChinchiro() {
    const h = new Date().getHours()
    return h >= 21 || h < 3
}

export { MIN_BET, MAX_ROLLS }
