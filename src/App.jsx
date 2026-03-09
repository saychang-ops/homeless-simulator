import { useState, useEffect, useCallback, useRef } from 'react'
import {
    COMMANDS, AREAS, AREA_LIST, BASE_LEVELS, ITEMS, INITIAL_STATE, BENTO_SHOP_ITEMS, FURUGIYA_ITEMS,
    CLOTHING_SLOTS, CLOTHING_SLOT_NAMES, CLOTHING_ITEMS, WORK_COMMANDS,
    getTimeOfDay, getWeatherOverlay, BENTO_OPEN, BENTO_CLOSE, FURUGIYA_OPEN, FURUGIYA_CLOSE,
    DISEASES, TRUST_BENEFITS, isSummerFestivalPeriod, SUPPORT_EVENTS,
    SMELL_THRESHOLD, FUKUBIKI_TICKET_COST, SENTO_OPEN, SENTO_CLOSE,
    RECYCLE_OPEN, RECYCLE_CLOSE, FUKUBIKI_OPEN, FUKUBIKI_CLOSE, RECYCLE_SHOP_ITEMS,
} from './gameData.js'
import {
    saveGame, loadGame, clearSave,
    fetchRealWeather, doSearch, doTalk, doWorkTalk,
    canRecruitJob, applyForJob, completeDayJob, quitDayJob, checkJobCollapse,
    upgradeBase, calculateRealtimeDecay, buyBentoItem, buyFurugiyaItem, buyVeteranInfo,
    useItem, checkFoodDistribution, takeFoodDistribution,
    getAvailableSupportEvents, useSupportEvent, visitHospital, grantPriorityTicket,
    getMumble, isGameOver, startSleep, wakeUp, formatRemainingTime, formatElapsedTime,
    isSmelly, useSento, getSellableItems, sellRecycleItem, doFukubiki,
    storeClothing, retrieveClothing, fetchWeatherForecast, getChinchiroDayKey,
    buyRecycleShopItem,
} from './gameEngine.js'
import soundManager from './soundManager.js'
import {
    initChinchiro, decideOya, placeBets, doOneRoll, advanceToNextPlayer, endRound,
    canPlayChinchiro, MIN_BET, MAX_ROLLS
} from './chinchirorin.js'

const FS = 18
const FONT = "'DotGothic16', sans-serif"
const INDENT = '\u3000'  // 全角スペース

let globalLogIdCounter = 1

const TypewriterTextArea = ({ logs, logColor, onUpdate }) => {
    const [visibleChars, setVisibleChars] = useState({})
    const [skipAll, setSkipAll] = useState(false)

    useEffect(() => {
        setSkipAll(false)
    }, [logs])

    useEffect(() => {
        if (onUpdate) onUpdate()
    }, [visibleChars, onUpdate])

    useEffect(() => {
        if (skipAll) return

        let activeLog = null
        for (let i = 0; i < logs.length; i++) {
            const logId = logs[i].id
            const currentVis = visibleChars[logId] || 0
            if (currentVis < (logs[i].text || '').length) {
                activeLog = logs[i]
                break
            }
        }

        if (activeLog) {
            const timer = setTimeout(() => {
                setVisibleChars(prev => ({
                    ...prev,
                    [activeLog.id]: (prev[activeLog.id] || 0) + 1
                }))
                soundManager.playTextSound()
            }, 30) // 1文字あたりの表示速度 (ms)
            return () => clearTimeout(timer)
        }
    }, [logs, visibleChars, skipAll])

    const handleSkip = () => setSkipAll(true)

    return (
        <div onClick={handleSkip} style={{ cursor: 'pointer' }}>
            {logs.map((log) => {
                const text = log.text || ''
                const vis = skipAll ? text.length : (visibleChars[log.id] || 0)
                const isCompleted = vis >= text.length
                const active = !isCompleted && !skipAll && (visibleChars[log.id] || 0) > 0

                return (
                    <div key={log.id} style={{ color: logColor(log.type), fontSize: FS, lineHeight: 2, letterSpacing: 2 }}>
                        {text.slice(0, vis)}
                        {active && <span className="animate-blink">_</span>}
                    </div>
                )
            })}
        </div>
    )
}

/* ═══════════════════════════════════════════════════
 *  タイトル画面コンポーネント
 * ═══════════════════════════════════════════════════ */
function TitleScreen({ screen, hasSave, onStart, onNewGame, onContinue }) {
    const [showFsBtn, setShowFsBtn] = useState(!document.fullscreenElement)

    useEffect(() => {
        // タイトル表示直後にフルスクリーン＋横画面ロックを試行
        document.documentElement.requestFullscreen()
            .then(() => screen.orientation?.lock('landscape').catch(() => {}))
            .catch(() => {
                screen.orientation?.lock('landscape').catch(() => {})
            })
    }, [])

    useEffect(() => {
        const update = () => setShowFsBtn(!document.fullscreenElement)
        document.addEventListener('fullscreenchange', update)
        window.addEventListener('resize', update)
        return () => {
            document.removeEventListener('fullscreenchange', update)
            window.removeEventListener('resize', update)
        }
    }, [])

    const handleFsBtn = () => {
        document.documentElement.requestFullscreen()
            .then(() => {
                setShowFsBtn(false)
                screen.orientation?.lock('landscape').catch(() => {})
            })
            .catch(() => { })
    }

    return (
        <>
            {/* フルスクリーン回復インジケーター（URLバーが出ているとき） */}
            {showFsBtn && (
                <span
                    onClick={handleFsBtn}
                    className="animate-blink"
                    style={{
                        position: 'fixed', top: 6, left: 8, zIndex: 9999,
                        color: '#f00', fontSize: 20, cursor: 'pointer',
                        fontFamily: FONT, userSelect: 'none',
                    }}
                >▲</span>
            )}

            <div style={{
                position: 'fixed', inset: 0, background: '#000',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                fontFamily: FONT, userSelect: 'none', height: '100dvh', overflow: 'hidden',
            }}>
                <div className="crt-overlay" />
                <div className="crt-vignette" />

                <div style={{
                    position: 'relative', zIndex: 10, width: '100%', maxWidth: 520, height: '100dvh',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'flex-start', paddingTop: '1dvh',
                    boxSizing: 'border-box', overflow: 'hidden',
                }}>
                    {/* AI生成タイトル画像（上端を基点にスケール・タイトル文字を見切れさせない） */}
                    <div style={{
                        width: '100%', overflow: 'hidden',
                        maxHeight: '72dvh', flexShrink: 0,
                    }}>
                        <img
                            src="/img/title.png"
                            alt="HOMELESS SIMULATOR"
                            style={{
                                width: '100%', height: '72dvh',
                                objectFit: 'cover', objectPosition: 'center top',
                                imageRendering: 'pixelated', display: 'block',
                                transform: 'scale(1.12)', transformOrigin: 'center top',
                            }}
                        />
                    </div>

                    {/* TOUCH TO START（点滅） */}
                    {screen === 'title' && (
                        <div
                            onClick={onStart}
                            className="animate-blink"
                            style={{ color: '#fff', fontSize: 18, marginTop: '2dvh', cursor: 'pointer', letterSpacing: 7, padding: '8px 0', fontWeight: 'bold' }}
                        >
                            TOUCH TO START
                        </div>
                    )}

                    {/* タイトルメニュー（NEW GAME / CONTINUE を横並びに） */}
                    {screen === 'menu' && (
                        <div style={{ width: '90%', marginTop: '2dvh', display: 'flex', flexDirection: 'row', gap: 12 }}>
                            <button onClick={onNewGame} className="title-menu-btn" style={{ flex: 1 }}>▶ NEW GAME</button>
                            {hasSave && <button onClick={onContinue} className="title-menu-btn" style={{ flex: 1 }}>▶ CONTINUE</button>}
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}

export default function App() {
    const [gameState, setGameState] = useState(null)
    const [_logs, _setLogs] = useState([])
    const logs = _logs

    const setLogs = useCallback((arg) => {
        if (typeof arg === 'function') {
            _setLogs(prev => {
                const next = arg(prev)
                return next.map(l => l.id ? l : { ...l, id: globalLogIdCounter++ })
            })
        } else {
            _setLogs(arg.map(l => l.id ? l : { ...l, id: globalLogIdCounter++ }))
        }
    }, [])
    const [isProcessing, setIsProcessing] = useState(false)
    const [subMenu, setSubMenu] = useState(null)
    const [gameOverScreen, setGameOverScreen] = useState(false)
    const [loaded, setLoaded] = useState(false)
    const [weatherData, setWeatherData] = useState(null)
    const [weatherForecast, setWeatherForecast] = useState(null)
    const [currentTime, setCurrentTime] = useState(new Date())
    const [jobProgress, setJobProgress] = useState(0)
    const [jobRemaining, setJobRemaining] = useState('')
    const [sleepElapsed, setSleepElapsed] = useState('')
    const [chinchiro, setChinchiro] = useState(null)
    const [chinchiroLogs, setChinchiroLogs] = useState([])
    const [betInput, setBetInput] = useState(100)
    const [diceAnim, setDiceAnim] = useState(null) // [d1,d2,d3] during animation
    const [isRolling, setIsRolling] = useState(false)
    const [senpaiBrokeDay, setSenpaiBrokeDay] = useState(null)
    const [chinchiroBGM, setChinchiroBGM] = useState(null)
    const [showFireworks, setShowFireworks] = useState(false)
    const [upgradeFlash, setUpgradeFlash] = useState(false)
    const [upgradeReveal, setUpgradeReveal] = useState(false)   // 新画像+光エフェクト
    const [upgradeImgSrc, setUpgradeImgSrc] = useState(null)    // 表示する新拠点画像
    const [gameOverTime, setGameOverTime] = useState(null)

    // タイトル画面管理
    const [screen, setScreen] = useState('title')   // 'title' | 'menu' | 'game'
    const [hasSave, setHasSave] = useState(false)

    // 右カラムスクロールインジケーター
    const rightCmdRef = useRef(null)
    const [rightShowScroll, setRightShowScroll] = useState(false)

    // ログエリアスクロール制御
    const logAreaRef = useRef(null)
    const [logShowScrollUp, setLogShowScrollUp] = useState(false)
    const [logShowScrollDown, setLogShowScrollDown] = useState(false)

    const setRecentLogs = useCallback((nl) => setLogs(nl.slice(-5)), [])
    const addLogs = useCallback((nl) => setLogs(prev => [...prev, ...nl].slice(-5)), [])

    const updateLogScroll = useCallback(() => {
        const el = logAreaRef.current
        if (!el) return
        setLogShowScrollUp(el.scrollTop > 2)
        setLogShowScrollDown(el.scrollHeight > el.clientHeight + el.scrollTop + 2)
    }, [])

    // ログ更新時に最下部へ自動スクロール
    useEffect(() => {
        const el = logAreaRef.current
        if (!el) return
        el.scrollTop = el.scrollHeight
        updateLogScroll()
    }, [logs, updateLogScroll])

    const scrollLogToBottom = useCallback(() => {
        const el = logAreaRef.current
        if (!el) return
        el.scrollTop = el.scrollHeight
        updateLogScroll()
    }, [updateLogScroll])

    /* ── サイコロSE ── */
    const playDiceSE = useCallback(() => {
        if (!soundManager.enabled) return
        const se = new Audio('/sound/サイコロ.mp3')
        se.volume = 0.8
        se.play().catch(() => { })
    }, [])

    /* ── 花火表示制御（夏祭り夜間） ── */
    useEffect(() => {
        const check = () => {
            if (isSummerFestivalPeriod()) {
                const h = new Date().getHours()
                setShowFireworks(h >= 19 && h < 23)
            } else {
                setShowFireworks(false)
            }
        }
        check()
        const iv = setInterval(check, 60000)
        return () => clearInterval(iv)
    }, [])

    /* ── ちんちろりん BGM制御 ── */
    useEffect(() => {
        if (subMenu === 'chinchiro' && soundManager.enabled) {
            soundManager.bgmOverride = true
            soundManager.stop() // 環境音を強制停止
            const audio = new Audio('/sound/ちんちろりん.mp3')
            audio.loop = true
            audio.volume = 0.4
            audio.play().catch(() => { })
            setChinchiroBGM(audio)
        } else {
            soundManager.bgmOverride = false
            if (chinchiroBGM) {
                chinchiroBGM.pause()
                chinchiroBGM.src = ''
                setChinchiroBGM(null)
            }
        }
        return () => {
            if (chinchiroBGM) { chinchiroBGM.pause(); chinchiroBGM.src = ''; }
        }
    }, [subMenu, soundManager.enabled])

    /* ── NPC自動ロール ── */
    const npcAutoRoll = useCallback((state, delay = 1500) => {
        const doNext = (s, d) => {
            setTimeout(() => {
                const pid = s.players[s.activePlayerIndex].id
                if (s.finalResults[pid]) {
                    const s2 = advanceToNextPlayer(s)
                    setChinchiro(s2)
                    if (s2.phase === 'rolling' && !s2.players[s2.activePlayerIndex].isHuman) {
                        doNext(s2, d)
                    }
                    return
                }
                setIsRolling(true)
                playDiceSE() // 自動ロール時にSE再生
                // dice animation
                let animCount = 0
                const animInterval = setInterval(() => {
                    setDiceAnim([Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6)])
                    animCount++
                    if (animCount >= 10) {
                        clearInterval(animInterval)
                        const s2 = doOneRoll(s)
                        setChinchiro(s2)
                        setDiceAnim(null)
                        setIsRolling(false)
                        // Check if this NPC needs more rolls or move to next
                        const nPid = s2.players[s2.activePlayerIndex].id
                        if (s2.finalResults[nPid]) {
                            setTimeout(() => {
                                const s3 = advanceToNextPlayer(s2)
                                setChinchiro(s3)
                                if (s3.phase === 'rolling' && !s3.players[s3.activePlayerIndex].isHuman) {
                                    doNext(s3, d)
                                }
                            }, d)
                        } else {
                            doNext(s2, d)
                        }
                    }
                }, 80)
            }, d)
        }
        doNext(state, delay)
    }, [])

    /* ── ちんちろりんのコメントをログに反映 ── */
    useEffect(() => {
        if (!chinchiro || !chinchiro.comments) return
        const entries = Object.entries(chinchiro.comments)
        if (entries.length === 0) return
        let newLogs = []
        if (chinchiro.phase === 'round_end' && chinchiro.payouts) {
            chinchiro.players.forEach(p => {
                const c = chinchiro.comments[p.id]
                const pAmt = chinchiro.payouts[p.id]
                if (c === undefined) return
                const sign = pAmt > 0 ? '+' : ''
                const type = pAmt > 0 ? 'chinchiro_win' : pAmt < 0 ? 'chinchiro_lose' : 'system'
                const amtStr = pAmt !== undefined ? `　${sign}¥${pAmt}` : ''
                newLogs.push({ text: `${p.name}「${c}」${amtStr}`, type })
            })
        } else {
            newLogs = entries.map(([pid, comment]) => {
                const p = chinchiro.players.find(pl => pl.id === pid)
                return { text: `${p?.name || '?'}「${comment}」`, type: 'narration' }
            })
        }
        setLogs(newLogs.slice(-10)) // 8〜10行保持
    }, [chinchiro?.comments, chinchiro?.phase, chinchiro?.payouts])

    /* ── セーブデータ存在確認（タイトル画面のCONTINUE表示制御） ── */
    useEffect(() => { setHasSave(!!loadGame()) }, [])

    /* ── 初期ロード（ゲーム本編移行時のみ実行） ── */
    useEffect(() => {
        if (screen !== 'game' || loaded) return
        const saved = loadGame()
        if (saved) {
            setGameState(saved)
            setRecentLogs([
                { text: 'セーブデータをロード。', type: 'system' },
                { text: `${AREAS[saved.area].name}`, type: 'location' },
            ])
        } else {
            // ディープコピーして初期状態を準備
            const init = JSON.parse(JSON.stringify(INITIAL_STATE))
            init.lastTickTime = Date.now()

            setGameState(init)

            setRecentLogs([
                { text: 'HOMELESS SIMULATOR v5', type: 'system' },
                { text: 'ようこそ、かこくな げんじつへ。', type: 'system' },
                { text: `${AREAS.nishiguchi.name}`, type: 'location' },
            ])
        }
        setLoaded(true) // ロード完了をマーク
    }, [screen, loaded, setRecentLogs])


    /* ── 天候API (1時間ごと) ── */
    const OW_API_KEY = '8916fe60d0a5b6785cee675a74c771ab'
    const fetchWeather = useCallback(async () => {
        const r = await fetchRealWeather(OW_API_KEY)
        if (r) setWeatherData(r)
    }, [])

    useEffect(() => {
        fetchWeather()
        const iv = setInterval(fetchWeather, 60 * 60 * 1000)
        return () => clearInterval(iv)
    }, [fetchWeather])

    /* ── 天気予報 (3時間ごと) ── */
    const fetchForecast = useCallback(async () => {
        const r = await fetchWeatherForecast(OW_API_KEY)
        if (r) setWeatherForecast(r)
    }, [])

    useEffect(() => {
        fetchForecast()
        const iv = setInterval(fetchForecast, 3 * 60 * 60 * 1000)
        return () => clearInterval(iv)
    }, [fetchForecast])

    /* ── リアルタイムタイマー ── */
    useEffect(() => {
        if (!gameState || gameOverScreen) return
        const iv = setInterval(() => {
            setCurrentTime(new Date())
            setGameState(prev => {
                if (!prev) return prev
                const next = calculateRealtimeDecay(prev, weatherData)
                if (isGameOver(next)) { setGameOverScreen(true); setGameOverTime(new Date()) }

                // 睡眠: 経過時間更新のみ（自動起床なし）
                if (next.sleeping) {
                    setSleepElapsed(formatElapsedTime(next.sleeping.startTime))
                }

                // 日雇い進捗
                if (next.activeJob) {
                    const collapse = checkJobCollapse(next)
                    if (collapse) {
                        addLogs(collapse.logs)
                        saveGame(collapse.state)
                        setSubMenu(null)
                        return collapse.state
                    }
                    const now = Date.now()
                    const { startTime, endTime } = next.activeJob
                    const progress = Math.min(100, ((now - startTime) / (endTime - startTime)) * 100)
                    setJobProgress(Math.round(progress))
                    setJobRemaining(formatRemainingTime(endTime))
                    if (now >= endTime) {
                        const result = completeDayJob(next)
                        addLogs(result.logs)
                        saveGame(result.state)
                        setSubMenu(null)
                        return result.state
                    }
                } else {
                    setJobProgress(0)
                    setJobRemaining('')
                }
                return next
            })
        }, 1000)

        // サウンド更新（1秒ごと）
        const soundIv = setInterval(() => {
            if (!gameState) return
            const tod = getTimeOfDay(new Date().getHours())
            const wo = weatherData ? getWeatherOverlay(weatherData.weather.id) : 'clear'
            soundManager.update(
                gameState.area, tod, wo,
                !!gameState.sleeping, !!gameState.activeJob
            )
        }, 1000)

        // loadedがtrueの時のみ自動セーブする
        const saveIv = setInterval(() => {
            if (loaded && gameState && !gameOverScreen) saveGame(gameState)
        }, 10000)

        return () => { clearInterval(iv); clearInterval(soundIv); clearInterval(saveIv) }
    }, [gameState, gameOverScreen, weatherData, loaded, addLogs])

    /* ── 右カラムスクロールインジケーター ── */
    useEffect(() => {
        const el = rightCmdRef.current
        if (!el) return
        const update = () => setRightShowScroll(el.scrollHeight > el.clientHeight + el.scrollTop + 2)
        update()
        el.addEventListener('scroll', update)
        return () => el.removeEventListener('scroll', update)
    }, [subMenu, gameState?.area])

    /* ── コマンドハンドラ ── */
    const handleCommand = (commandId) => {
        if (isProcessing || !gameState || gameOverScreen) return
        // 寝ている間は「おきる」以外不可
        if (gameState.sleeping && commandId !== 'neru') {
            setRecentLogs([{ text: 'ねている… zzz', type: 'system' }])
            return
        }
        // 作業中は限定コマンドのみ
        if (gameState.activeJob && !['quit_work', 'tsubuyaku', 'hanasu_work', 'mochimono', 'jotai'].includes(commandId)) return
        if (subMenu && !gameState.activeJob && !gameState.sleeping && commandId !== 'neru') { setSubMenu(null); return }

        setIsProcessing(true)

        switch (commandId) {
            case 'shiraberu':
                if (gameState.area === 'tocho') { setSubMenu('tocho_shiraberu'); setIsProcessing(false) }
                else setTimeout(() => { const r = doSearch(gameState); setGameState(r.state); setRecentLogs(r.logs); saveGame(r.state); setIsProcessing(false) }, 500)
                break
            case 'basho': setSubMenu('move'); setIsProcessing(false); break
            case 'hanasu': {
                const events = getAvailableSupportEvents(gameState)
                if (events.length > 0) { setSubMenu('support'); setIsProcessing(false); break }
                setTimeout(() => {
                    const r = doTalk(gameState)
                    setGameState(r.state); setRecentLogs(r.logs)
                    if (r.openBentoShop) {
                        const h = new Date().getHours()
                        if (h >= BENTO_OPEN && h < BENTO_CLOSE) setSubMenu('bentoya')
                        else setRecentLogs([{ text: 'てんいん「いまは えいぎょうじかんがい だよ(7-21じ)」', type: 'quote' }])
                    } else if (r.openFurugiyaShop) {
                        const h = new Date().getHours()
                        if (h >= FURUGIYA_OPEN && h < FURUGIYA_CLOSE) setSubMenu('furugiya')
                        else setRecentLogs([{ text: 'てんしゅ「いまは しまってるよ(10-19じ)」', type: 'quote' }])
                    } else if (r.openSentoShop) {
                        const h = new Date().getHours()
                        if (h >= SENTO_OPEN && h < SENTO_CLOSE) setSubMenu('sento')
                        else setRecentLogs([{ text: 'ばんとうさん「いまは じゅんびちゅうです（10-22じ）」', type: 'quote' }])
                    } else if (r.openRecycleShop) {
                        const h = new Date().getHours()
                        if (h >= RECYCLE_OPEN && h < RECYCLE_CLOSE) setSubMenu('recycle')
                        else setRecentLogs([{ text: 'てんいん「いまは えいぎょうじかんがい です（10-20じ）」', type: 'quote' }])
                    } else if (r.openFukubikiShop) {
                        const h = new Date().getHours()
                        if (h >= FUKUBIKI_OPEN && h < FUKUBIKI_CLOSE) setSubMenu('fukubiki')
                        else setRecentLogs([{ text: 'スタッフ「いまは じゅんびちゅうです（11-19じ）」', type: 'quote' }])
                    }
                    saveGame(r.state); setIsProcessing(false)
                }, 500)
                break
            }
            case 'hanasu_work':
                setTimeout(() => { const logs = doWorkTalk(); setRecentLogs(logs); setIsProcessing(false) }, 300)
                break
            case 'tsubuyaku':
                setTimeout(() => { setRecentLogs(getMumble(gameState).map(t => ({ text: t, type: 'quote' }))); setIsProcessing(false) }, 300)
                break
            case 'neru':
                if (gameState.sleeping) {
                    setTimeout(() => { const r = wakeUp(gameState); setGameState(r.state); setRecentLogs(r.logs); saveGame(r.state); setSleepElapsed(''); setIsProcessing(false) }, 300)
                } else {
                    setTimeout(() => {
                        // 日が回ったとみなして先輩破産フラグをリセット
                        setSenpaiBrokeDay(null)
                        const r = startSleep(gameState); setGameState(r.state); setRecentLogs(r.logs); saveGame(r.state); setIsProcessing(false)
                    }, 300)
                }
                break
            case 'hiyatoi': {
                const skinD = (gameState.diseases || []).find(d => d.id === 'skin_disease')
                if (skinD && skinD.level >= 2) {
                    setTimeout(() => { setRecentLogs([{ text: 'ひふしっかんが ひどく さぎょういんに ことわられた…', type: 'narration' }]); setIsProcessing(false) }, 300)
                    break
                }
                if (!canRecruitJob(gameState)) {
                    let msg = 'しごとの ぼしゅうは あさ6:00-7:30 こうえんにて。'
                    if (gameState.todayWorked) msg = 'きょうは もう ぼしゅうずみ。'
                    else if (gameState.area !== 'park') msg = 'こうえんで ぼしゅうしている。 いどうしよう。'
                    setTimeout(() => { setRecentLogs([{ text: msg, type: 'system' }]); setIsProcessing(false) }, 300)
                } else {
                    const trust = gameState.status.trust || 0
                    if (trust >= TRUST_BENEFITS.goodJobThreshold) {
                        setSubMenu('recruit_trust')
                    } else {
                        setSubMenu('recruit')
                    }
                    setIsProcessing(false)
                }
                break
            }
            case 'quit_work':
                setTimeout(() => { const r = quitDayJob(gameState); setGameState(r.state); setRecentLogs(r.logs); saveGame(r.state); setIsProcessing(false) }, 300)
                break
            case 'kyoten':
                if (gameState.area !== 'park') {
                    setTimeout(() => { setRecentLogs([{ text: 'きょてんは こうえんでのみ。', type: 'system' }]); setIsProcessing(false) }, 300)
                } else { setSubMenu('base'); setIsProcessing(false) }
                break
            case 'mochimono': setSubMenu('items'); setIsProcessing(false); break
            case 'jotai': setSubMenu('status'); setIsProcessing(false); break
            default: setIsProcessing(false)
        }
    }

    const handleMove = (aId) => {
        if (aId === gameState.area) { setRecentLogs([{ text: 'もうここにいる。', type: 'system' }]); setSubMenu(null); return }
        const dest = AREAS[aId]
        // においチェック
        if (dest.rejectsSmelly && isSmelly(gameState)) {
            setRecentLogs([{ text: 'においが きつくて いれてもらえなかった… せんとうへ いこう。', type: 'narration' }])
            setSubMenu(null); return
        }
        // 営業時間チェック
        if (dest.openHour !== undefined) {
            const h = new Date().getHours() + new Date().getMinutes() / 60
            if (h < dest.openHour || h >= dest.closeHour) {
                setRecentLogs([{ text: `ただいまは じゅんびちゅうです。\n${dest.openHour}:00〜${dest.closeHour}:00 にどうぞ。`, type: 'system' }])
                setSubMenu(null); return
            }
        }
        setSubMenu(null)
        setTimeout(() => {
            setGameState(prev => {
                const isExiting = aId === AREAS[prev.area]?.parentArea
                return {
                    ...prev,
                    area: aId,
                    status: {
                        ...prev.status,
                        hp: isExiting ? prev.status.hp : Math.max(0, prev.status.hp - 2),
                        hunger: isExiting ? prev.status.hunger : Math.max(0, prev.status.hunger - 3),
                    },
                }
            })
            setRecentLogs([{ text: `${AREAS[aId].name}`, type: 'location' }, { text: AREAS[aId].desc, type: 'narration' }])
        }, 400)
    }

    const handleApplyJob = () => { const r = applyForJob(gameState); setGameState(r.state); setRecentLogs(r.logs); saveGame(r.state); if (r.accepted) setSubMenu(null); else setSubMenu(null) }
    const handleBuyBento = (itemId) => { setTimeout(() => { const r = buyBentoItem(gameState, itemId); setGameState(r.state); setRecentLogs(r.logs); saveGame(r.state) }, 300) }
    const handleBuyFurugiya = (itemId) => { setTimeout(() => { const r = buyFurugiyaItem(gameState, itemId); setGameState(r.state); setRecentLogs(r.logs); saveGame(r.state) }, 300) }
    const handleBuyVeteranInfo = () => { setSubMenu(null); setTimeout(() => { const r = buyVeteranInfo(gameState); setGameState(r.state); setRecentLogs(r.logs); saveGame(r.state) }, 300) }
    const handleUseItem = (idx) => { const r = useItem(gameState, idx); setGameState(r.state); setRecentLogs(r.logs); saveGame(r.state); if ((r.state.inventory || []).length === 0) setSubMenu(null) }
    const handleBaseUpgrade = () => {
        setSubMenu(null)
        setTimeout(() => {
            const r = upgradeBase(gameState)
            setGameState(r.state)
            setRecentLogs(r.logs)
            saveGame(r.state)
            // 新レベルの拠点画像を取得して表示
            const newImgRaw = BASE_LEVELS[r.state.baseLevel]?.img
            const newImg = newImgRaw && typeof newImgRaw === 'object' ? newImgRaw[tod] : newImgRaw
            if (newImg) {
                setUpgradeImgSrc(newImg)
                setUpgradeReveal(true)
                setTimeout(() => {
                    setUpgradeReveal(false)
                    setTimeout(() => setUpgradeImgSrc(null), 400)
                }, 2400)
            } else {
                setUpgradeFlash(true)
                setTimeout(() => setUpgradeFlash(false), 800)
            }
        }, 400)
    }
    const handleFoodDist = () => { const r = takeFoodDistribution(gameState); setGameState(r.state); setRecentLogs(r.logs); saveGame(r.state) }
    const handleSupportEvent = (ev) => { const r = useSupportEvent(gameState, ev); setGameState(r.state); setRecentLogs(r.logs); saveGame(r.state); setSubMenu(null) }
    const handleVisitHospital = () => { const r = visitHospital(gameState); setGameState(r.state); setRecentLogs(r.logs); saveGame(r.state); setSubMenu(null) }
    const handleGrantPriorityTicket = () => { const r = grantPriorityTicket(gameState); setGameState(r.state); setRecentLogs(r.logs); saveGame(r.state) }
    const handleUseSento = () => { const r = useSento(gameState); setGameState(r.state); setRecentLogs(r.logs); saveGame(r.state) }
    const handleSellItem = (itemId) => { const r = sellRecycleItem(gameState, itemId); setGameState(r.state); setRecentLogs(r.logs); saveGame(r.state) }
    const handleBuyRecycleShopItem = (itemId) => { setTimeout(() => { const r = buyRecycleShopItem(gameState, itemId); setGameState(r.state); setRecentLogs(r.logs); saveGame(r.state) }, 300) }
    const handleFukubiki = () => { const r = doFukubiki(gameState); setGameState(r.state); setRecentLogs(r.logs); saveGame(r.state) }
    const handleStoreClothing = (slot) => { const r = storeClothing(gameState, slot); setGameState(r.state); setRecentLogs(r.logs); saveGame(r.state) }
    const handleRetrieveClothing = (itemId) => { const r = retrieveClothing(gameState, itemId); setGameState(r.state); setRecentLogs(r.logs); saveGame(r.state) }

    const handleNewGame = () => {
        clearSave(); setGameState({ ...INITIAL_STATE, lastTickTime: Date.now() }); setGameOverScreen(false); setSubMenu(null)
        setRecentLogs([{ text: '── ニューゲーム ──', type: 'system' }, { text: `${AREAS.nishiguchi.name}`, type: 'location' }])
    }

    /* ── タイトル画面ハンドラー ── */
    const handleTouchToStart = () => {
        soundManager.enable()
        soundManager.playTextSound()
        soundManager.playOpeningBGM()
        // フルスクリーン化
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => { })
        }
        // 横画面ロック
        if (window.screen?.orientation?.lock) {
            window.screen.orientation.lock('landscape').catch(() => { })
        }
        setScreen('menu')
    }

    const handleTitleNewGame = () => {
        soundManager.playTextSound()
        clearSave()
        const init = JSON.parse(JSON.stringify(INITIAL_STATE))
        init.lastTickTime = Date.now()
        setGameState(init)
        setLoaded(true)
        setRecentLogs([
            { text: 'HOMELESS SIMULATOR v5', type: 'system' },
            { text: 'ようこそ、かこくな げんじつへ。', type: 'system' },
            { text: `${AREAS.nishiguchi.name}`, type: 'location' },
        ])
        soundManager.stopOpeningBGM()
        setScreen('game')
    }

    const handleTitleContinue = () => {
        soundManager.playTextSound()
        soundManager.stopOpeningBGM()
        const saved = loadGame()
        if (saved) {
            setGameState(saved)
            setRecentLogs([
                { text: 'セーブデータをロード。', type: 'system' },
                { text: `${AREAS[saved.area].name}`, type: 'location' },
            ])
        }
        setLoaded(true)
        setScreen('game')
    }

    /* ── タイトル画面表示（全hookの後） ── */
    if (screen !== 'game') {
        return (
            <TitleScreen
                screen={screen}
                hasSave={hasSave}
                onStart={handleTouchToStart}
                onNewGame={handleTitleNewGame}
                onContinue={handleTitleContinue}
            />
        )
    }

    const logColor = (t) => {
        switch (t) {
            case 'system': return '#00ffff'
            case 'location': return '#ffb000'
            case 'quote': return '#33ff33'
            case 'chinchiro_win': return '#33ff33'
            case 'chinchiro_lose': return '#ff3333'
            default: return '#e0e0e0'
        }
    }

    if (!gameState) return null

    const area = AREAS[gameState.area]
    const tod = getTimeOfDay(currentTime.getHours())
    const baseImgRaw = BASE_LEVELS[gameState.baseLevel]?.img
    // 拠点画像: オブジェクトなら時刻別、単一値ならそのまま
    const baseImg = baseImgRaw && typeof baseImgRaw === 'object' ? baseImgRaw[tod] : baseImgRaw
    const showBaseImg = gameState.area === 'park' && baseImg && subMenu === 'base'
    const bgImage = upgradeImgSrc || (showBaseImg ? baseImg : area.bg[tod])
    const weatherOverlay = weatherData ? getWeatherOverlay(weatherData.weather.id) : 'clear'
    const weatherStr = weatherData ? weatherData.description : 'はれ'
    const tempStr = weatherData ? `${weatherData.realTemp}℃` : '--℃'
    const dateStr = `${currentTime.getMonth() + 1}/${currentTime.getDate()}`
    const timeStr = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`
    const feelsLikeStr = `${gameState.status.feelsLike ?? '--'}℃`
    const weatherFilter = weatherOverlay === 'rain' ? 'brightness(0.6) contrast(1.1)' : weatherOverlay === 'cloudy' ? 'brightness(0.8) saturate(0.7)' : 'none'

    const S = { color: '#fff', cursor: 'pointer', padding: '4px 0', fontSize: FS, background: 'none', border: 'none', textAlign: 'left', fontFamily: FONT, width: '100%', whiteSpace: 'normal', wordBreak: 'break-all' }
    const SI = { ...S, paddingLeft: '1em' }  // インデントつきスタイル

    /* ── ゲームオーバー ── */
    if (gameOverScreen) {
        const goT = gameOverTime || currentTime
        const goTimeStr = `${String(goT.getHours()).padStart(2, '0')}:${String(goT.getMinutes()).padStart(2, '0')}`
        const goDateStr = `${goT.getMonth() + 1}がつ ${goT.getDate()}にち`
        return (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', fontFamily: FONT }}>
                <div className="crt-overlay" /><div className="crt-vignette" />
                <div style={{ textAlign: 'center', zIndex: 10 }}>
                    <div style={{ color: '#ff3333', fontSize: 40, marginBottom: 20, letterSpacing: 4, fontWeight: 'bold', animation: 'blink 0.8s step-end infinite' }}>あなたは　しにました。</div>
                    <div style={{ color: '#888', fontSize: FS - 2, marginBottom: 4 }}>{goDateStr}　{goTimeStr}</div>
                    <div style={{ color: '#888', fontSize: FS, marginBottom: 32 }}>さいしゅう しょじきん: ¥{gameState.status.yen}</div>
                    <button onClick={handleNewGame} style={{ padding: '12px 24px', border: '2px solid #33ff33', color: '#33ff33', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: FS }}>CONTINUE?</button>
                </div>
            </div>
        )
    }

    /* ── 右パネル ── */
    const renderRight = () => {
        // 寝ている時
        if (gameState.sleeping) {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ color: '#aaa', fontSize: FS }}>すいみんちゅう… zzz</div>
                    <div style={{ color: '#fff', fontSize: FS }}>すいみんじかん: {sleepElapsed || '0じかん 0ふん'}</div>
                    <button onClick={() => handleCommand('neru')} style={{ ...S, color: '#ffb000', marginTop: 12 }}>おきる</button>
                </div>
            )
        }

        // 作業中
        if (gameState.activeJob) {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ color: '#ffb000', fontSize: FS }}>せいそうさぎょうちゅう…</div>
                    <div style={{ marginTop: 4, width: '100%', height: 14, border: '1px solid #fff', background: '#000' }}>
                        <div style={{ width: `${jobProgress}%`, height: '100%', background: '#33ff33' }} />
                    </div>
                    <div style={{ color: '#fff', fontSize: FS }}>{jobProgress}%</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12 }}>
                        {WORK_COMMANDS.map(cmd => (
                            <button key={cmd.id} onClick={() => handleCommand(cmd.id)} style={{ ...S, color: cmd.id === 'quit_work' ? '#ff3333' : '#fff' }}>{cmd.label}</button>
                        ))}
                    </div>
                </div>
            )
        }

        if (subMenu === 'recruit') {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ color: '#fff', fontSize: FS }}>ひやとい ぼしゅう</div>
                    <div style={{ color: '#aaa', fontSize: FS }}>{INDENT}とくべつせいそうじぎょう</div>
                    <div style={{ color: '#aaa', fontSize: FS }}>{INDENT}ほうしゅう: ¥5000~6000</div>
                    <div style={{ color: '#aaa', fontSize: FS }}>{INDENT}さぎょう: やく4じかん</div>
                    <div style={{ color: '#aaa', fontSize: FS }}>{INDENT}※ちゅうせんあり</div>
                    <button onClick={handleApplyJob} style={{ ...SI, color: '#33ff33', marginTop: 8 }}>おうぼする</button>
                    <button onClick={() => setSubMenu(null)} style={{ ...SI }}>やめとく</button>
                </div>
            )
        }
        if (subMenu === 'recruit_trust') {
            const gj = TRUST_BENEFITS.goodJob
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ color: '#fff', fontSize: FS }}>ひやとい ぼしゅう</div>
                    <div style={{ color: '#aaa', fontSize: FS }}>{INDENT}とくべつせいそうじぎょう</div>
                    <div style={{ color: '#aaa', fontSize: FS }}>{INDENT}ほうしゅう: ¥5000~6000</div>
                    <div style={{ color: '#aaa', fontSize: FS }}>{INDENT}※ちゅうせんあり</div>
                    <div style={{ color: '#33ffcc', fontSize: FS, marginTop: 8 }}>{INDENT}★ ゆうりょうあんけん あり</div>
                    <div style={{ color: '#33ffcc', fontSize: FS }}>{INDENT}ほうしゅう: ¥{gj.pay.min}~{gj.pay.max}</div>
                    <div style={{ color: '#33ffcc', fontSize: FS }}>{INDENT}たいりょくしょうもう: すくなめ</div>
                    <button onClick={handleApplyJob} style={{ ...SI, color: '#33ff33', marginTop: 8 }}>おうぼする</button>
                    <button onClick={() => setSubMenu(null)} style={{ ...SI }}>やめとく</button>
                </div>
            )
        }
        if (subMenu === 'status') {
            const diseases = gameState.diseases || []
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ color: '#fff', fontSize: FS }}>じょうたい</div>
                    <div style={{ color: '#fff', fontSize: FS }}>{INDENT}たいりょく {Math.round(gameState.status.hp)}</div>
                    <div style={{ color: '#fff', fontSize: FS }}>{INDENT}くうふく {Math.round(gameState.status.hunger)}</div>
                    <div style={{ color: '#fff', fontSize: FS }}>{INDENT}えいせい {Math.round(gameState.status.hygiene ?? 100)}</div>
                    {isSmelly(gameState) && (
                        <div style={{ color: '#ff9900', fontSize: FS }}>{INDENT}※ においがきつい…（せんとうへ いこう）</div>
                    )}
                    <div style={{ color: '#fff', fontSize: FS }}>{INDENT}たいおん {gameState.status.temp.toFixed(1)}℃</div>
                    <div style={{ color: '#fff', fontSize: FS }}>{INDENT}たいかんおんど {feelsLikeStr}</div>
                    <div style={{ color: '#fff', fontSize: FS }}>{INDENT}しんらいど {Math.round(gameState.status.trust || 0)}</div>
                    {diseases.length > 0 && diseases.map(d => {
                        const def = DISEASES[d.id]
                        const col = d.level >= 5 ? '#ff0000' : d.level >= 3 ? '#ff6600' : '#ff9900'
                        return (
                            <div key={d.id} style={{ color: col, fontSize: FS, animation: d.level >= 5 ? 'blink 0.8s step-end infinite' : 'none' }}>
                                {INDENT}※ {def?.name || d.id} Lv{d.level}{d.level >= 5 ? '【じゅうたい！】' : ''}
                            </div>
                        )
                    })}
                    <button onClick={() => setSubMenu(null)} style={{ ...S, marginTop: 8 }}>もどる</button>
                </div>
            )
        }
        if (subMenu === 'move') {
            const currentArea = AREAS[gameState.area]
            const extraMoves = currentArea.moveTo || []
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ color: '#fff', fontSize: FS }}>どこへ？</div>
                    {AREA_LIST.filter(a => a.id !== gameState.area).map(a => <button key={a.id} onClick={() => handleMove(a.id)} style={SI}>{a.name}</button>)}
                    {extraMoves.filter(aId => aId !== gameState.area).map(aId => {
                        const a = AREAS[aId]
                        return <button key={aId} onClick={() => handleMove(aId)} style={{ ...SI, color: '#ffb000' }}>★ {a.name}</button>
                    })}
                    <button onClick={() => setSubMenu(null)} style={{ ...S, marginTop: 8 }}>もどる</button>
                </div>
            )
        }
        if (subMenu === 'base') {
            const next = BASE_LEVELS[gameState.baseLevel + 1]
            const canUp = next &&
                gameState.status.yen >= (next.cost || 0) &&
                (!next.requires?.cardboard || (gameState.materials?.cardboard || 0) >= next.requires.cardboard) &&
                (!next.requires?.bluesheet || (gameState.materials?.bluesheet || 0) >= next.requires.bluesheet) &&
                (!next.requiresItem || (gameState.inventory || []).includes(next.requiresItem))
            // 必要条件テキスト生成
            const nextReqText = () => {
                if (!next) return ''
                const parts = []
                if (next.cost > 0) parts.push(`¥${next.cost}`)
                if (next.requires?.cardboard) parts.push(`だんボール${next.requires.cardboard}こ`)
                if (next.requires?.bluesheet) parts.push(`ブルーシート${next.requires.bluesheet}まい`)
                if (next.requiresItem) parts.push('テント（ふくびきとくしょう）')
                return parts.join(' / ')
            }
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ color: '#fff', fontSize: FS }}>きょてん</div>
                    <div style={{ color: '#fff', fontSize: FS }}>{INDENT}いま: {BASE_LEVELS[gameState.baseLevel].name}</div>
                    <div style={{ color: '#aaa', fontSize: FS }}>{INDENT}ぼうかん: +{BASE_LEVELS[gameState.baseLevel].feelsBonus}℃</div>
                    {next ? (
                        <>
                            <div style={{ color: '#aaa', fontSize: FS }}>{INDENT}つぎ: {next.name}</div>
                            <div style={{ color: '#aaa', fontSize: FS }}>{INDENT}ひつよう: {nextReqText() || 'なし'}</div>
                            {next.requires?.bluesheet && (
                                <div style={{ color: '#aaa', fontSize: FS }}>{INDENT}（もち: ブルーシート {gameState.materials?.bluesheet || 0}まい）</div>
                            )}
                            <button onClick={handleBaseUpgrade} disabled={!canUp} className={canUp ? 'animate-blink' : ''} style={{ ...SI, color: canUp ? '#33ff33' : '#555' }}>{INDENT}アップグレード</button>
                        </>
                    ) : <div style={{ color: '#aaa', fontSize: FS }}>{INDENT}さいだいレベル</div>}
                    {gameState.baseLevel >= 1 && (
                        <button onClick={() => setSubMenu('storage')} style={{ ...SI, color: '#00ffff', marginTop: 8 }}>アイテムボックス</button>
                    )}
                    <button onClick={() => {
                        if (!canPlayChinchiro()) {
                            setRecentLogs([{ text: 'ちんちろりんは 21:00〜27:00 のあいだだけだ。', type: 'system' }])
                            return
                        }
                        if (senpaiBrokeDay === dateStr) { // 今日すでに破産させている場合
                            setRecentLogs([{ text: 'せんぱい「きょうは もう かねがない…」', type: 'quote' }])
                            return
                        }
                        if (gameState.status.yen < MIN_BET) {
                            setRecentLogs([{ text: 'かけるかねがたりない… さいてい¥100ひつよう。', type: 'system' }])
                            return
                        }
                        const dayKey = getChinchiroDayKey()
                        const startYen = (gameState.chinchiroDayKey === dayKey && gameState.chinchiroYen != null)
                            ? gameState.chinchiroYen
                            : gameState.status.yen
                        const g = initChinchiro(startYen)
                        const g2 = decideOya(g)
                        setChinchiro(g2)
                        setChinchiroLogs([])
                        setBetInput(MIN_BET)
                        setSubMenu('chinchiro')
                    }} style={{ ...SI, color: '#ff6666', marginTop: 12 }}>ちんちろりん</button>
                    {gameState.sleeping ? (
                        <button onClick={() => handleCommand('neru')} style={{ ...SI, color: '#ffb000', marginTop: 4 }}>おきる</button>
                    ) : (
                        <button onClick={() => handleCommand('neru')} style={{ ...SI, color: '#33ff33', marginTop: 4 }}>ねる</button>
                    )}
                    <button onClick={() => setSubMenu(null)} style={{ ...S, marginTop: 8 }}>もどる</button>
                </div>
            )
        }
        if (subMenu === 'chinchiro' && chinchiro) {
            const player = chinchiro.players.find(p => p.isHuman)
            const isPlayerOya = chinchiro.players[chinchiro.oyaIndex]?.isHuman
            const activeP = chinchiro.players[chinchiro.activePlayerIndex]
            const isPlayerTurn = activeP?.isHuman && chinchiro.phase === 'rolling'
            const playerPid = player?.id
            const playerRolls = chinchiro.rolls[playerPid] || []
            const playerDone = !!chinchiro.finalResults[playerPid]

            // サイコロ画像 (CSSで描画)
            const DiceFace = ({ value, size = 28 }) => {
                const dots = {
                    1: [[1, 1]], 2: [[0, 2], [2, 0]], 3: [[0, 2], [1, 1], [2, 0]],
                    4: [[0, 0], [0, 2], [2, 0], [2, 2]], 5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
                    6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]]
                }
                return (
                    <div style={{ width: size, height: size, background: '#fff', borderRadius: 3, border: '1px solid #555', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gridTemplateRows: 'repeat(3,1fr)', padding: 2, boxSizing: 'border-box' }}>
                        {[0, 1, 2].map(r => [0, 1, 2].map(c => {
                            const hasDot = (dots[value] || []).some(([dc, dr]) => dr === r && dc === c)
                            const dotColor = value === 1 ? '#cc0000' : '#111'
                            return <div key={`${r}${c}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {hasDot && <div style={{ width: size * 0.18, height: size * 0.18, borderRadius: '50%', background: dotColor }} />}
                            </div>
                        }))}
                    </div>
                )
            }

            // プレイヤーカード
            const PlayerCard = ({ pIdx }) => {
                const p = chinchiro.players[pIdx]
                const isOya = pIdx === chinchiro.oyaIndex
                const isActive = pIdx === chinchiro.activePlayerIndex && chinchiro.phase === 'rolling'
                const rolls = chinchiro.rolls[p.id] || []
                const finalR = chinchiro.finalResults[p.id]
                const bet = chinchiro.bets[p.id]
                const bg = isActive ? '#1a2a1a' : '#111'
                const border = isActive ? '2px solid #33ff33' : '1px solid #333'
                const animDice = isActive && diceAnim

                return (
                    <div style={{ background: bg, border, borderRadius: 6, padding: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div style={{ color: p.isHuman ? '#33ff33' : '#ffb000', fontSize: FS - 3, fontWeight: 'bold' }}>
                            {isOya ? '(親)' : '(子)'}{p.name}: ¥{p.yen}
                        </div>
                        {/* ロール履歴 (最大3行) */}
                        {[0, 1, 2].map(i => {
                            const roll = rolls[i]
                            if (roll) {
                                return (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        {roll.dice.map((d, j) => <DiceFace key={j} value={d} size={24} />)}
                                        <span style={{ color: '#aaa', fontSize: FS - 4, marginLeft: 4 }}>
                                            {roll.result.settled ? roll.result.name : '〜'}
                                        </span>
                                    </div>
                                )
                            }
                            // アニメーション表示 (アクティブプレイヤーの次の行)
                            if (animDice && i === rolls.length) {
                                return (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        {animDice.map((d, j) => <DiceFace key={j} value={d} size={24} />)}
                                        <span style={{ color: '#555', fontSize: FS - 4, marginLeft: 4 }}>...</span>
                                    </div>
                                )
                            }
                            return (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: 26 }}>
                                    {[0, 1, 2].map(j => <div key={j} style={{ width: 24, height: 24, border: '1px dashed #333', borderRadius: 3 }} />)}
                                    <span style={{ color: '#333', fontSize: FS - 4, marginLeft: 4 }}>〜</span>
                                </div>
                            )
                        })}
                        {bet !== undefined && <div style={{ color: '#aaa', fontSize: FS - 4 }}>かけきん: ¥{bet || 0}</div>}
                    </div>
                )
            }

            const exitChinchiro = () => {
                const finalYen = chinchiro.players.find(p => p.isHuman).yen
                const dayKey = getChinchiroDayKey()
                const ns = {
                    ...gameState,
                    status: { ...gameState.status, yen: finalYen },
                    chinchiroYen: finalYen,
                    chinchiroDayKey: dayKey,
                }

                // せんぱいが破産して終了した場合、その日の日付を記録
                const senpais = chinchiro.players.filter(p => !p.isHuman)
                if (senpais.every(p => p.yen <= 0)) {
                    setSenpaiBrokeDay(dateStr)
                }

                setGameState(ns); saveGame(ns)
                setChinchiro(null); setChinchiroLogs([])
                setSubMenu('base'); setDiceAnim(null); setIsRolling(false)
                setRecentLogs([{ text: `ちんちろりん おわり。しょじきん: ¥${finalYen}`, type: 'system' }])
            }

            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ color: '#ff6666', fontSize: FS, fontWeight: 'bold' }}>🎲 ちんちろりん R{chinchiro.roundNum}</div>
                    {/* コントロール */}
                    {chinchiro.phase === 'bet' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {!isPlayerOya && (
                                <>
                                    <div style={{ color: '#fff', fontSize: FS }}>ベット: ¥{betInput}</div>
                                    <div style={{ display: 'flex', gap: 2 }}>
                                        <button onClick={() => setBetInput(v => Math.max(MIN_BET, v - 100))} style={{ ...S, flex: 1, textAlign: 'center', fontSize: FS - 2, padding: '2px' }}>-100</button>
                                        <button onClick={() => setBetInput(v => Math.min(player.yen, v + 100))} style={{ ...S, flex: 1, textAlign: 'center', fontSize: FS - 2, padding: '2px' }}>+100</button>
                                        <button onClick={() => setBetInput(v => Math.min(player.yen, v + 1000))} style={{ ...S, flex: 1, textAlign: 'center', fontSize: FS - 2, padding: '2px' }}>+1k</button>
                                        <button onClick={() => setBetInput(player.yen)} style={{ ...S, flex: 1, textAlign: 'center', fontSize: FS - 2, padding: '2px' }}>全</button>
                                    </div>
                                </>
                            )}
                            <button onClick={() => {
                                const g = placeBets(chinchiro, betInput)
                                setChinchiro(g)
                                // 親が振り始める
                                if (g.players[g.activePlayerIndex].isHuman) {
                                    // プレイヤーが親 → 手動
                                } else {
                                    // NPC親 → 自動ロール
                                    npcAutoRoll(g)
                                }
                            }} style={{ ...SI, color: '#33ff33' }}>{isPlayerOya ? 'サイコロをふる！' : 'かける！'}</button>
                        </div>
                    )}
                    {chinchiro.phase === 'rolling' && isPlayerTurn && !isRolling && !playerDone && (
                        <button onClick={() => {
                            setIsRolling(true)
                            playDiceSE()
                            let animCount = 0
                            const animInterval = setInterval(() => {
                                setDiceAnim([Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6)])
                                animCount++
                                if (animCount >= 12) {
                                    clearInterval(animInterval)
                                    const g = doOneRoll(chinchiro)
                                    setChinchiro(g)
                                    setDiceAnim(null)
                                    setIsRolling(false)
                                    // 確定したら自動的に次へ
                                    if (g.finalResults[playerPid]) {
                                        setTimeout(() => {
                                            const g2 = advanceToNextPlayer(g)
                                            setChinchiro(g2)
                                            if (g2.phase === 'rolling' && !g2.players[g2.activePlayerIndex].isHuman) {
                                                npcAutoRoll(g2)
                                            }
                                        }, 1000)
                                    }
                                }
                            }, 80)
                        }} style={{ ...SI, color: '#33ff33', fontSize: FS }}>🎲 サイコロをふる！ ({playerRolls.length + 1}/{MAX_ROLLS})</button>
                    )}
                    {chinchiro.phase === 'rolling' && !isPlayerTurn && !isRolling && (
                        <div style={{ color: '#aaa', fontSize: FS }}>{activeP?.name} がふってる...</div>
                    )}
                    {chinchiro.phase === 'round_end' && (
                        <button onClick={() => {
                            const g = endRound(chinchiro)
                            setChinchiro(g)
                            setBetInput(MIN_BET)
                        }} style={{ ...SI, color: '#ffb000', fontSize: FS }}>つぎのラウンドへ</button>
                    )}
                    {chinchiro.phase === 'game_over' && (
                        <>
                            <div style={{ color: '#ff3333', fontSize: FS, fontWeight: 'bold' }}>ゲームしゅうりょう！</div>
                            <button onClick={exitChinchiro} style={{ ...SI, color: '#fff', fontSize: FS }}>きょてんにもどる</button>
                        </>
                    )}
                    {chinchiro.phase === 'round_end' && (
                        <button onClick={exitChinchiro} style={{ ...S, marginTop: 4, color: '#aaa', fontSize: FS }}>やめる</button>
                    )}
                </div>
            )
        }
        if (subMenu === 'items') {
            const inv = gameState.inventory || []
            // 食べ物・使えるアイテムをまとめる
            const itemCounts = {}
            inv.forEach((id, i) => {
                if (!itemCounts[id]) itemCounts[id] = { id, indices: [] }
                itemCounts[id].indices.push(i)
            })
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ color: '#fff', fontSize: FS }}>もちもの</div>
                    <button onClick={() => setSubMenu('clothing')} style={{ ...SI, color: '#ffb000' }}>そうび</button>
                    <div style={{ color: '#fff', fontSize: FS }}>{INDENT}しょじきん ¥{gameState.status.yen}</div>
                    {Object.keys(itemCounts).length === 0 ? (
                        <div style={{ color: '#aaa', fontSize: FS }}>{INDENT}アイテム なし</div>
                    ) : (
                        Object.values(itemCounts).map(({ id, indices }) => {
                            const item = ITEMS[id]
                            const hint = id === 'tent_item' ? ' [きょてんで つかう]'
                                : item?.usable ? ' [つかう]' : ''
                            return (
                                <button key={id} onClick={() => item?.usable ? handleUseItem(indices[0]) : null}
                                    style={{ ...SI, color: item?.usable ? '#fff' : '#aaa' }}>
                                    {item?.name || id} x{indices.length}{hint}
                                </button>
                            )
                        })
                    )}
                    {(gameState.materials?.cardboard || 0) > 0 && (
                        <div style={{ color: '#fff', fontSize: FS }}>{INDENT}だんボール: {gameState.materials.cardboard}こ</div>
                    )}
                    {(gameState.materials?.bluesheet || 0) > 0 && (
                        <div style={{ color: '#fff', fontSize: FS }}>{INDENT}ブルーシート: {gameState.materials.bluesheet}まい</div>
                    )}
                    <button onClick={() => setSubMenu(null)} style={{ ...S, marginTop: 8 }}>もどる</button>
                </div>
            )
        }
        if (subMenu === 'clothing') {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ color: '#fff', fontSize: FS }}>そうび</div>
                    {CLOTHING_SLOTS.map(slot => {
                        const itemId = gameState.clothing?.[slot]
                        const item = itemId ? CLOTHING_ITEMS[itemId] : null
                        return (
                            <div key={slot} style={{ color: '#fff', fontSize: FS }}>
                                {INDENT}{CLOTHING_SLOT_NAMES[slot]}: {item ? `${item.name} (+${item.feelsBonus}℃)` : 'なし'}
                            </div>
                        )
                    })}
                    <button onClick={() => setSubMenu('items')} style={{ ...S, marginTop: 8 }}>もどる</button>
                </div>
            )
        }
        if (subMenu === 'bentoya') {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ color: '#fff', fontSize: FS }}>べんとうや</div>
                    <div style={{ color: '#aaa', fontSize: FS }}>{INDENT}しょじきん: ¥{gameState.status.yen}</div>
                    {BENTO_SHOP_ITEMS.map(item => (
                        <button key={item.id} onClick={() => handleBuyBento(item.id)} style={SI}>
                            {item.name} ¥{item.price}
                        </button>
                    ))}
                    <button onClick={() => setSubMenu(null)} style={{ ...S, marginTop: 8 }}>かわない</button>
                </div>
            )
        }
        if (subMenu === 'furugiya') {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ color: '#fff', fontSize: FS }}>ふるぎや</div>
                    <div style={{ color: '#aaa', fontSize: FS }}>{INDENT}しょじきん: ¥{gameState.status.yen}</div>
                    {FURUGIYA_ITEMS.map(item => {
                        const equipped = gameState.clothing[item.slot] === item.id
                        return (
                            <button key={item.id} onClick={() => handleBuyFurugiya(item.id)} disabled={equipped}
                                style={{ ...SI, color: equipped ? '#555' : '#fff' }}>
                                {item.name} ¥{item.price} (+{item.feelsBonus}℃){equipped ? ' [そうびずみ]' : ''}
                            </button>
                        )
                    })}
                    <button onClick={() => setSubMenu(null)} style={{ ...S, marginTop: 8 }}>かわない</button>
                </div>
            )
        }
        if (subMenu === 'support') {
            const events = getAvailableSupportEvents(gameState)
            const isSoudanAvailable = events.some(ev => ev.name === SUPPORT_EVENTS.soudan.name)
            const trust = gameState.status.trust || 0
            const hasDiseases = (gameState.diseases || []).length > 0
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ color: '#fff', fontSize: FS }}>しえんイベント</div>
                    {events.map((ev, i) => (
                        <button key={i} onClick={() => handleSupportEvent(ev)} style={SI}>{ev.name}</button>
                    ))}
                    {isSoudanAvailable && hasDiseases && (
                        <button onClick={handleVisitHospital} style={{ ...SI, color: '#ff9900' }}>しんさつをうける（くすり しょほう）</button>
                    )}
                    {gameState.area === 'park' && (
                        <button onClick={handleBuyVeteranInfo} style={{ ...SI, color: '#ffcc00' }}>ベテランにきく (¥50〜)</button>
                    )}
                    {gameState.area === 'park' && trust >= TRUST_BENEFITS.priorityTicketThreshold && !(gameState.inventory || []).includes('priority_ticket') && (
                        <button onClick={handleGrantPriorityTicket} style={{ ...SI, color: '#33ffcc' }}>たきだしゆうせんけんをもらう</button>
                    )}
                    <button onClick={() => { setSubMenu(null); setTimeout(() => { const r = doTalk(gameState); setGameState(r.state); setRecentLogs(r.logs); saveGame(r.state) }, 300) }} style={{ ...S, marginTop: 8 }}>ふつうに はなす</button>
                </div>
            )
        }

        if (subMenu === 'sento') {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ color: '#fff', fontSize: FS }}>せんとう</div>
                    <div style={{ color: '#aaa', fontSize: FS }}>{INDENT}えいぎょう: {SENTO_OPEN}:00〜{SENTO_CLOSE}:00</div>
                    <div style={{ color: '#aaa', fontSize: FS }}>{INDENT}にゅうよくりょう: ¥500</div>
                    <div style={{ color: '#aaa', fontSize: FS }}>{INDENT}しょじきん: ¥{gameState.status.yen}</div>
                    <div style={{ color: '#aaa', fontSize: FS }}>{INDENT}えいせい: {Math.round(gameState.status.hygiene ?? 100)}</div>
                    <button onClick={handleUseSento} style={{ ...SI, color: '#00ffff', marginTop: 8 }}>おふろにはいる（¥500）</button>
                    <button onClick={() => setSubMenu(null)} style={{ ...S, marginTop: 8 }}>もどる</button>
                </div>
            )
        }
        if (subMenu === 'recycle') {
            const sellables = getSellableItems(gameState)
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ color: '#fff', fontSize: FS }}>リサイクルショップ</div>
                    <div style={{ color: '#aaa', fontSize: FS }}>{INDENT}えいぎょう: {RECYCLE_OPEN}:00〜{RECYCLE_CLOSE}:00</div>
                    <div style={{ color: '#aaa', fontSize: FS }}>{INDENT}しょじきん: ¥{gameState.status.yen}</div>
                    <div style={{ color: '#ffb000', fontSize: FS, marginTop: 4 }}>{INDENT}── こうにゅう ──</div>
                    {RECYCLE_SHOP_ITEMS.map(item => {
                        const canBuy = gameState.status.yen >= item.price
                        const alreadyEquipped = item.targetClothing && gameState.clothing?.[item.targetClothing] === item.id
                        return (
                            <button key={item.id}
                                onClick={() => !alreadyEquipped && handleBuyRecycleShopItem(item.id)}
                                disabled={alreadyEquipped}
                                style={{ ...SI, color: alreadyEquipped ? '#555' : canBuy ? '#fff' : '#888' }}>
                                {item.name} ¥{item.price}　{item.desc}{alreadyEquipped ? ' [そうびずみ]' : ''}
                            </button>
                        )
                    })}
                    <div style={{ color: '#ffb000', fontSize: FS, marginTop: 4 }}>{INDENT}── うりとり ──</div>
                    {sellables.length === 0 ? (
                        <div style={{ color: '#aaa', fontSize: FS }}>{INDENT}うれるものが ない。</div>
                    ) : (
                        sellables.map(({ id, item, indices }) => (
                            <button key={id} onClick={() => handleSellItem(id)} style={SI}>
                                {item?.name || id} x{indices.length} → ¥{item?.sellValue}
                            </button>
                        ))
                    )}
                    <button onClick={() => setSubMenu(null)} style={{ ...S, marginTop: 8 }}>もどる</button>
                </div>
            )
        }
        if (subMenu === 'fukubiki') {
            const ticketCount = (gameState.inventory || []).filter(id => id === 'fukubiki_ticket').length
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ color: '#fff', fontSize: FS }}>しょうてんがい ふくびきじょ</div>
                    <div style={{ color: '#aaa', fontSize: FS }}>{INDENT}えいぎょう: {FUKUBIKI_OPEN}:00〜{FUKUBIKI_CLOSE}:00</div>
                    <div style={{ color: '#aaa', fontSize: FS }}>{INDENT}もっているけん: {ticketCount}まい</div>
                    <div style={{ color: '#aaa', fontSize: FS }}>{INDENT}ひつようなけん: {FUKUBIKI_TICKET_COST}まい</div>
                    <button onClick={handleFukubiki} disabled={ticketCount < FUKUBIKI_TICKET_COST}
                        style={{ ...SI, color: ticketCount >= FUKUBIKI_TICKET_COST ? '#ffb000' : '#555', marginTop: 8 }}>
                        ガラポンをひく（けん{FUKUBIKI_TICKET_COST}まい）
                    </button>
                    <button onClick={() => setSubMenu(null)} style={{ ...S, marginTop: 8 }}>もどる</button>
                </div>
            )
        }
        if (subMenu === 'storage') {
            const storage = gameState.clothingStorage || []
            const equippedSlots = CLOTHING_SLOTS.filter(slot => gameState.clothing?.[slot])
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ color: '#fff', fontSize: FS }}>アイテムボックス</div>
                    {storage.length === 0 ? (
                        <div style={{ color: '#555', fontSize: FS }}>{INDENT}なにもない。</div>
                    ) : (
                        storage.map((itemId, i) => {
                            const item = CLOTHING_ITEMS[itemId]
                            return (
                                <button key={i} onClick={() => handleRetrieveClothing(itemId)} style={SI}>
                                    {INDENT}{item?.name || itemId}
                                </button>
                            )
                        })
                    )}
                    <div style={{ color: '#fff', fontSize: FS, marginTop: 6 }}>そうびちゅう</div>
                    {equippedSlots.length === 0 ? (
                        <div style={{ color: '#555', fontSize: FS }}>{INDENT}なにもない。</div>
                    ) : (
                        equippedSlots.map(slot => {
                            const itemId = gameState.clothing[slot]
                            const item = CLOTHING_ITEMS[itemId]
                            return (
                                <button key={slot} onClick={() => handleStoreClothing(slot)} style={SI}>
                                    {INDENT}{item?.name || itemId}
                                </button>
                            )
                        })
                    )}
                    <button onClick={() => setSubMenu('base')} style={{ ...S, marginTop: 8 }}>もどる</button>
                </div>
            )
        }
        if (subMenu === 'tocho_shiraberu') {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ color: '#fff', fontSize: FS }}>しらべる</div>
                    <button onClick={() => setSubMenu('forecast')} style={{ ...SI, color: '#00ffff' }}>けいじばんをみる（てんきよほう）</button>
                    <button onClick={() => {
                        setIsProcessing(true)
                        setTimeout(() => { const r = doSearch(gameState); setGameState(r.state); setRecentLogs(r.logs); saveGame(r.state); setIsProcessing(false) }, 500)
                    }} style={SI}>あたりをしらべる</button>
                    <button onClick={() => setSubMenu(null)} style={{ ...S, marginTop: 8 }}>もどる</button>
                </div>
            )
        }
        if (subMenu === 'forecast') {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ color: '#fff', fontSize: FS }}>てんきよほう（とうきょう）</div>
                    {!weatherForecast ? (
                        <div style={{ color: '#aaa', fontSize: FS }}>{INDENT}よほうデータを とりこみちゅう…</div>
                    ) : (
                        weatherForecast.map((fc, i) => {
                            const h = new Date(fc.dt).getHours()
                            return (
                                <div key={i} style={{ color: '#aaa', fontSize: FS }}>
                                    {INDENT}{String(h).padStart(2, '0')}:00 {fc.desc} {fc.temp}℃
                                </div>
                            )
                        })
                    )}
                    <button onClick={() => setSubMenu(null)} style={{ ...S, marginTop: 8 }}>もどる</button>
                </div>
            )
        }

        // デフォルトコマンド
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {COMMANDS.map(cmd => {
                    if (cmd.id === 'basho' && AREAS[gameState.area]?.parentArea) {
                        return <button key={cmd.id} onClick={() => handleMove(AREAS[gameState.area].parentArea)} disabled={isProcessing} style={S}>そとへでる</button>
                    }
                    return <button key={cmd.id} onClick={() => handleCommand(cmd.id)} disabled={isProcessing} style={S}>{cmd.label}</button>
                })}
                {checkFoodDistribution(gameState) && (
                    <button onClick={handleFoodDist} disabled={isProcessing} style={{ ...S, color: '#ffb000' }} className="animate-blink">しょくりょうはいふ</button>
                )}
            </div>
        )
    }

    // 作業中の残り時間ログ
    const workLog = gameState.activeJob ? `きんむしゅうりょうまで ${jobRemaining}` : ''

    return (
        <>
            <div onClick={() => soundManager.enable()} style={{ width: '100vw', height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontSize: FS, userSelect: 'none', position: 'relative', background: '#000', overflow: 'hidden' }}>
                <div className="crt-overlay" /><div className="crt-vignette" />

                {/* アスペクト比拘束ゲーム画面（黒帯でレターボックス表示） */}
                <div style={{ width: 'min(100vw, calc(100dvh * 16 / 9))', height: 'min(100dvh, calc(100vw * 9 / 16))', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', zIndex: 1 }}>
                <div style={{ display: 'flex', flex: 1, height: '100%', width: '100%', padding: '6px 8px', gap: 10, zIndex: 10, boxSizing: 'border-box', overflow: 'hidden' }}>
                    {/* 左カラム: 画像（またはちんちろ）＋ログ */}
                    <div style={{ flex: 7, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                        {subMenu === 'chinchiro' && chinchiro ? (
                            <div style={{ flexShrink: 0, width: '100%', aspectRatio: '16/9', background: '#000', position: 'relative', overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 4, padding: 4, boxSizing: 'border-box' }}>
                                {chinchiro.players.map((p, i) => {
                                    const isOya = i === chinchiro.oyaIndex
                                    const isActive = i === chinchiro.activePlayerIndex && chinchiro.phase === 'rolling'
                                    const rolls = chinchiro.rolls[p.id] || []
                                    const bet = chinchiro.bets[p.id]
                                    const bg = isActive ? '#1a2a1a' : '#111'
                                    const border = isActive ? '2px solid #33ff33' : '1px solid #333'
                                    const animDice = isActive && diceAnim
                                    const getYakuColor = (rank) => {
                                        if (!rank || rank <= 5) return '#fff'
                                        if (rank === 10) return '#ff3333'
                                        if (rank <= 60) return '#fff'
                                        if (rank === 80) return '#ffb000'
                                        if (rank === 90) return '#00ffff'
                                        if (rank === 100) return '#ff00ff'
                                        return '#fff'
                                    }
                                    const DiceFace = ({ value, size = 28 }) => {
                                        const dots = { 1: [[1, 1]], 2: [[0, 2], [2, 0]], 3: [[0, 2], [1, 1], [2, 0]], 4: [[0, 0], [0, 2], [2, 0], [2, 2]], 5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]], 6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]] }
                                        return <div style={{ width: size, height: size, background: '#fff', borderRadius: 3, border: '1px solid #555', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gridTemplateRows: 'repeat(3,1fr)', padding: 2, boxSizing: 'border-box' }}>
                                            {[0, 1, 2].map(r => [0, 1, 2].map(c => { const has = (dots[value] || []).some(([dc, dr]) => dr === r && dc === c); return <div key={`${r}${c}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{has && <div style={{ width: size * 0.18, height: size * 0.18, borderRadius: '50%', background: value === 1 ? '#cc0000' : '#111' }} />}</div> }))}
                                        </div>
                                    }
                                    return (
                                        <div key={p.id} style={{ background: bg, border, borderRadius: 6, padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden' }}>
                                            <div style={{ color: p.isHuman ? '#33ff33' : '#ffb000', fontSize: FS, fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                                {isOya ? '(親)' : '(子)'}{p.name}: ¥{p.yen}
                                            </div>
                                            {[0, 1, 2].map(ri => {
                                                const roll = rolls[ri]
                                                if (roll) return <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{roll.dice.map((d, j) => <DiceFace key={j} value={d} />)}<span style={{ color: roll.result.settled ? getYakuColor(roll.result.rank) : '#888', fontSize: FS, marginLeft: 4, fontWeight: 'bold' }}>{roll.result.settled ? roll.result.name : 'メナシ'}</span></div>
                                                if (animDice && ri === rolls.length) return <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{animDice.map((d, j) => <DiceFace key={j} value={d} />)}<span style={{ color: '#555', fontSize: FS }}>...</span></div>
                                                return <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: 28 }}>{[0, 1, 2].map(j => <div key={j} style={{ width: 28, height: 28, border: '1px dashed #333', borderRadius: 3 }} />)}</div>
                                            })}
                                            {bet !== undefined && <div style={{ color: '#ffb000', fontSize: FS, fontWeight: 'bold' }}>かけきん: ¥{bet || 0}</div>}
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <div style={{ flexShrink: 0, width: '100%', aspectRatio: '16/9', background: '#000', position: 'relative', overflow: 'hidden' }}>
                                <img src={bgImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', imageRendering: 'pixelated', filter: weatherFilter }} />
                                {weatherOverlay === 'rain' && <div className="rain-overlay" />}
                                {showFireworks && (
                                    <img
                                        src="/image/fireworks_with_city_8bit_cheap_1772717518927.png"
                                        alt=""
                                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', imageRendering: 'pixelated', opacity: 0.75, animation: 'fireworks-pulse 2.5s ease-in-out infinite' }}
                                    />
                                )}
                                {upgradeFlash && <div className="upgrade-flash" />}
                                {upgradeReveal && <div className="upgrade-reveal" />}
                                {upgradeReveal && <div className="upgrade-overlay-pulse" />}
                            </div>
                        )}
                        {/* ログ: 画像の直下 */}
                        <div style={{ flex: 1, marginTop: 4, position: 'relative', overflow: 'hidden' }}>
                            <div
                                ref={logAreaRef}
                                onScroll={updateLogScroll}
                                style={{
                                    height: '100%', overflowY: 'auto', paddingBottom: 4,
                                    maxHeight: subMenu === 'chinchiro' ? `${3 * 2 * FS}px` : undefined,
                                }}
                            >
                                {workLog && <div style={{ color: '#ffb000', fontSize: FS, lineHeight: 2, letterSpacing: 2 }}>{workLog}</div>}
                                <TypewriterTextArea logs={logs} logColor={logColor} onUpdate={scrollLogToBottom} />
                                {isProcessing && <div style={{ color: '#fff' }} className="animate-blink">▼</div>}
                            </div>
                            {logShowScrollUp && (
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'none', textAlign: 'center', background: 'linear-gradient(#000, transparent)', paddingBottom: 4 }}>
                                    <span className="animate-blink" style={{ color: '#fff', fontSize: 12 }}>▲</span>
                                </div>
                            )}
                            {logShowScrollDown && (
                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, pointerEvents: 'none', textAlign: 'center', background: 'linear-gradient(transparent, #000)', paddingTop: 4 }}>
                                    <span className="animate-blink" style={{ color: '#fff', fontSize: 12 }}>▼</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 右カラム: 日時・天気・コマンド */}
                    <div style={{ flex: 3, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, overflow: 'hidden' }}>
                        <div style={{ color: '#fff', marginBottom: 6, lineHeight: 1.6, fontSize: 13, flexShrink: 0 }}>
                            <div>{dateStr}　{timeStr}</div>
                            <div>{weatherStr}　{tempStr}</div>
                        </div>
                        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                            <div ref={rightCmdRef} style={{ height: '100%', overflowY: 'auto' }}>{renderRight()}</div>
                            {rightShowScroll && (
                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, pointerEvents: 'none', textAlign: 'center', paddingTop: 12, background: 'linear-gradient(transparent, #000)' }}>
                                    <span className="animate-blink" style={{ color: '#fff', fontSize: 14 }}>▼</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                </div>{/* /game-screen */}

            </div>
        </>
    )
}
