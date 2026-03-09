/* ═══════════════════════════════════════════════════
 *  Homeless Simulator – サウンドマネージャー
 *  エリア × 時間帯 × 天候 で環境音をループ切替
 *  店舗サブエリアは Web Audio API アンサンブルシンセで演奏
 *  テーマ：「新宿の哀愁と喧騒」
 * ═══════════════════════════════════════════════════ */

const FADE_MS = 1500  // フェード時間

/* ── サウンドマップ（MP3 環境音のみ） ── */
const SOUND_MAP = {
    // 西口
    nishiguchi_morning: '/sound/nishi_day.mp3',
    nishiguchi_noon:    '/sound/nishi_day.mp3',
    nishiguchi_evening: '/sound/nishi_night.mp3',
    nishiguchi_night:   '/sound/nishi_night.mp3',
    nishiguchi_rain:    '/sound/city_rain.mp3',

    // 都庁
    tocho_morning: '/sound/tocho_day.mp3',
    tocho_noon:    '/sound/tocho_day.mp3',
    tocho_evening: '/sound/tocho_day.mp3',
    tocho_night:   '/sound/nishi_night.mp3',
    tocho_rain:    '/sound/city_rain.mp3',

    // 公園
    park_morning: '/sound/park_morning.mp3',
    park_noon:    '/sound/park_day.mp3',
    park_evening: '/sound/park_day.mp3',
    park_night:   '/sound/park_night.mp3',
    park_rain:    '/sound/park_rain.mp3',

    // 特殊状態
    sleeping: '/sound/park_night.mp3',
    working:  '/sound/work.mp3',
}

/* ── 店舗エリアセット ── */
const SHOP_AREAS = new Set(['sento', 'bentoya', 'furugiya', 'recycle', 'fukubiki'])

/* ── 周波数テーブル ── */
const N = {
    REST: 0,
    C2:65.41, D2:73.42, E2:82.41, F2:87.31, G2:98.00, A2:110.00, Bb2:116.54, B2:123.47,
    C3:130.81, D3:146.83, E3:164.81, F3:174.61, G3:196.00, A3:220.00, Bb3:233.08, B3:246.94,
    C4:261.63, D4:293.66, E4:329.63, F4:349.23, G4:392.00, A4:440.00, Bb4:466.16, B4:493.88,
    C5:523.25, D5:587.33, E5:659.25, F5:698.46, G5:783.99, A5:880.00, Bb5:932.33, B5:987.77,
    C6:1046.50, D6:1174.66,
}

/* ══════════════════════════════════════════════════════
 *  店舗別アンサンブルデータ
 *  各店舗は { bpm, channels, delay? } の形式
 *  channels: { melody, bass, noise }
 *    melody/bass: { wave, vol, detune, notes: [[Hz, beats], ...] }
 *    noise:       { type('hihat'|'snare'|'burst'), vol, pattern, stepLen }
 *  delay: { time, feedback, wet }  ← DelayNode エフェクト（任意）
 * ══════════════════════════════════════════════════════ */
const SHOP_MELODIES = {

    // ─────────────────────────────────────────────────
    // 銭湯: 三角波ヨナ抜き（D E G A B）＋ エコー
    //   疲れた体を温める、どこか寂しい湯気の音
    // ─────────────────────────────────────────────────
    sento: {
        bpm: 60,
        channels: {
            melody: {
                wave: 'triangle', vol: 0.18, detune: 0,
                notes: [
                    [N.D4,2],[N.E4,1],[N.G4,1],[N.A4,2],[N.REST,1],
                    [N.B4,1],[N.A4,1],[N.G4,1],[N.E4,2],[N.D4,1],
                    [N.REST,1],[N.G4,1],[N.A4,1],[N.B4,2],[N.A4,1],
                    [N.G4,2],[N.E4,1],[N.D4,3],[N.REST,2],
                    [N.A4,2],[N.G4,1],[N.E4,1],[N.D4,2],[N.REST,1],
                    [N.E4,1],[N.G4,1],[N.A4,1],[N.B4,2],[N.A4,1],
                    [N.G4,2],[N.E4,2],[N.D4,4],[N.REST,2],
                ],
            },
            bass: {
                wave: 'triangle', vol: 0.14, detune: 0,
                notes: [
                    [N.D2,4],[N.A2,4],[N.G2,4],[N.D2,4],
                    [N.D2,4],[N.A2,4],[N.G2,4],[N.D2,4],
                ],
            },
        },
        delay: { time: 0.48, feedback: 0.35, wet: 0.4 },
    },

    // ─────────────────────────────────────────────────
    // 弁当屋: 矩形波高速アルペジオ ＋ ハイハット
    //   昼どきの喧騒、蛍光灯と電子レンジの音
    // ─────────────────────────────────────────────────
    bentoya: {
        bpm: 168,
        channels: {
            melody: {
                wave: 'square', vol: 0.10, detune: 0,
                notes: [
                    [N.C5,0.5],[N.E5,0.5],[N.G5,0.5],[N.C6,0.5],[N.G5,0.5],[N.E5,0.5],[N.C5,0.5],[N.REST,0.5],
                    [N.D5,0.5],[N.F5,0.5],[N.A5,0.5],[N.D6,0.5],[N.A5,0.5],[N.F5,0.5],[N.D5,0.5],[N.REST,0.5],
                    [N.E5,0.5],[N.G5,0.5],[N.B5,0.5],[N.E5,0.5],[N.G5,0.5],[N.E5,0.5],[N.C5,0.5],[N.REST,0.5],
                    [N.G4,0.5],[N.C5,0.5],[N.E5,0.5],[N.G5,0.5],[N.E5,0.5],[N.C5,0.5],[N.G4,0.5],[N.REST,0.5],
                ],
            },
            bass: {
                wave: 'square', vol: 0.13, detune: 0,
                notes: [
                    [N.C3,1],[N.C3,1],[N.D3,1],[N.D3,1],
                    [N.E3,1],[N.E3,1],[N.G3,1],[N.G3,1],
                ],
            },
            noise: {
                type: 'hihat', vol: 0.04,
                pattern: [1,0,1,0,1,0,1,0],
                stepLen: 0.5,
            },
        },
    },

    // ─────────────────────────────────────────────────
    // 古着屋: 80年代シティポップの残骸
    //   三角波ウォーキングベース ＋ デチューン矩形波メロディ
    //   埃っぽいレコードの針音
    // ─────────────────────────────────────────────────
    furugiya: {
        bpm: 88,
        channels: {
            melody: {
                wave: 'square', vol: 0.10, detune: 8,
                notes: [
                    [N.A4,1.5],[N.REST,0.5],[N.C5,1],[N.E5,1],[N.D5,1.5],[N.C5,0.5],[N.A4,2],[N.REST,1],
                    [N.G4,1.5],[N.REST,0.5],[N.Bb4,1],[N.D5,1],[N.C5,1.5],[N.A4,0.5],[N.G4,2],[N.REST,1],
                    [N.A4,1],[N.C5,1],[N.D5,1],[N.E5,1.5],[N.D5,0.5],[N.C5,1],[N.A4,3],[N.REST,1],
                    [N.E4,0.5],[N.G4,0.5],[N.A4,1],[N.Bb4,1],[N.A4,1],[N.G4,1],[N.A4,4],
                ],
            },
            bass: {
                wave: 'triangle', vol: 0.16, detune: 0,
                notes: [
                    [N.A2,2],[N.G2,2],[N.F2,2],[N.E2,2],
                    [N.A2,2],[N.G2,2],[N.E2,2],[N.A2,2],
                ],
            },
        },
    },

    // ─────────────────────────────────────────────────
    // リサイクルショップ: 吹き溜まりの不気味さ
    //   のこぎり波クロマティック ＋ 不規則ノイズバースト
    //   錆びた金属と蛍光灯のちらつき
    // ─────────────────────────────────────────────────
    recycle: {
        bpm: 76,
        channels: {
            melody: {
                wave: 'sawtooth', vol: 0.08, detune: 0,
                notes: [
                    [N.A4,0.5],[N.Bb4,0.5],[N.A4,0.5],[N.REST,0.5],[N.G4,1],[N.F4,0.5],[N.E4,1],[N.REST,0.5],
                    [N.A3,0.5],[N.C4,0.5],[N.E4,0.5],[N.G4,0.5],[N.Bb4,1],[N.A4,0.5],[N.REST,1],
                    [N.E4,0.5],[N.F4,0.5],[N.G4,0.5],[N.F4,0.5],[N.E4,1],[N.D4,0.5],[N.C4,1],[N.REST,0.5],
                    [N.Bb3,0.5],[N.C4,0.5],[N.D4,0.5],[N.E4,0.5],[N.G4,0.5],[N.Bb4,0.5],[N.A4,2],[N.REST,1],
                ],
            },
            bass: {
                wave: 'sawtooth', vol: 0.15, detune: 0,
                notes: [
                    [N.D2,4],[N.D2,2],[N.E2,2],
                    [N.F2,4],[N.E2,2],[N.D2,2],
                ],
            },
            noise: {
                type: 'burst', vol: 0.06,
                pattern: [0,0,0,1,0,0,1,0],
                stepLen: 1,
            },
        },
    },

    // ─────────────────────────────────────────────────
    // 福引き: 空虚な祝祭感
    //   明るすぎる高速ペンタ ＋ パーカッシブノイズ
    //   誰もいないゲーセンの奥
    // ─────────────────────────────────────────────────
    fukubiki: {
        bpm: 180,
        channels: {
            melody: {
                wave: 'square', vol: 0.10, detune: 0,
                notes: [
                    [N.G4,0.25],[N.A4,0.25],[N.C5,0.5],[N.D5,0.25],[N.E5,0.25],
                    [N.D5,0.5],[N.C5,0.25],[N.A4,0.25],[N.G4,0.5],[N.REST,0.25],
                    [N.C5,0.25],[N.D5,0.25],[N.E5,0.25],[N.G5,0.5],[N.E5,0.25],
                    [N.D5,0.25],[N.C5,0.5],[N.REST,0.25],
                    [N.A4,0.25],[N.C5,0.25],[N.D5,0.25],[N.E5,0.25],
                    [N.G5,0.25],[N.E5,0.25],[N.D5,0.25],[N.C5,0.25],
                    [N.A4,0.75],[N.REST,0.25],
                    [N.G4,0.25],[N.A4,0.25],[N.C5,0.25],[N.A4,0.25],
                    [N.G4,0.25],[N.E4,0.25],[N.G4,0.75],[N.REST,0.5],
                ],
            },
            bass: {
                wave: 'square', vol: 0.13, detune: 0,
                notes: [
                    [N.G3,1],[N.G3,1],[N.C4,1],[N.D4,1],
                    [N.E4,1],[N.C4,1],[N.G3,2],
                ],
            },
            noise: {
                type: 'snare', vol: 0.05,
                pattern: [0,0,1,0,0,0,1,0],
                stepLen: 0.25,
            },
        },
    },
}

/* ── マネージャー本体 ── */
class SoundManager {
    constructor() {
        this.current     = null   // 現在再生中の Audio (MP3)
        this.currentKey  = null   // 現在のサウンドキー
        this.volume      = 0.4    // 基本音量
        this.enabled     = false  // ユーザー操作後に有効化
        this.fadeTimer   = null
        this.audioCtx    = null   // Web Audio API コンテキスト
        this.bgmOverride = false  // ちんちろりんBGM中は環境音を更新しない

        // アンサンブルシンセ関連
        this._synthActive  = false
        this._synthTimers  = []    // 全チャネルのタイマーIDを管理
        this._synthMaster  = null  // マスターゲインノード
        this._synthFxNodes = []    // DelayFX等のノード群
        this._synthAreaId  = null

        // オープニングBGM
        this._openingAudio = null
    }

    /** ユーザー操作で有効化 */
    enable() {
        this.enabled = true
        if (!this.audioCtx) {
            try {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)()
            } catch (e) {
                console.error('Web Audio API not supported', e)
            }
        }
    }

    /** シーンに応じたサウンドキーを決定 */
    getKey(area, timeOfDay, weatherOverlay, sleeping, working) {
        if (sleeping) return 'sleeping'
        if (working)  return 'working'
        // 店舗・施設（サブエリア）は時間帯・天候によらず専用BGMを使用
        if (SHOP_AREAS.has(area)) return area
        if (weatherOverlay === 'rain') return `${area}_rain`
        return `${area}_${timeOfDay}`
    }

    /** サウンド更新（毎秒呼ばれる想定） */
    update(area, timeOfDay, weatherOverlay, sleeping, working) {
        if (!this.enabled) return
        if (this.bgmOverride) return  // ちんちろりんBGM再生中は更新しない

        const key = this.getKey(area, timeOfDay, weatherOverlay, sleeping, working)
        if (key === this.currentKey) return  // 同じなら何もしない

        // ── 店舗サブエリアへ入った ──
        if (SHOP_AREAS.has(key)) {
            // MP3 環境音をフェードアウト停止
            if (this.current) {
                this._fadeOut(this.current)
                this.current = null
            }
            this.currentKey = key
            this.playSynthBGM(key)
            return
        }

        // ── 店舗から外へ出た（シンセBGM停止） ──
        if (this._synthActive) {
            this.stopSynthBGM()
        }

        const src = SOUND_MAP[key]
        if (!src) {
            this.stop()
            return
        }

        this.crossfadeTo(src, key)
    }

    /* ═════════════════════════════════════════════════
     *  アンサンブルシンセ BGM
     *  Melody / Bass / Noise を並行ループ再生
     * ═════════════════════════════════════════════════ */

    /** 単音を鳴らす（ADSRエンベロープ付き） */
    _playNote(freq, duration, wave, vol, detune, output) {
        if (freq === 0 || !this.audioCtx) return
        const ctx = this.audioCtx
        const now = ctx.currentTime
        const osc  = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = wave
        osc.frequency.setValueAtTime(freq, now)
        if (detune) osc.detune.setValueAtTime(detune, now)

        // ADSR: アタック → サステイン → リリース
        gain.gain.setValueAtTime(0, now)
        gain.gain.linearRampToValueAtTime(vol, now + 0.008)           // Attack
        gain.gain.setValueAtTime(vol, now + duration * 0.75)          // Sustain
        gain.gain.linearRampToValueAtTime(0, now + duration * 0.95)   // Release

        osc.connect(gain)
        gain.connect(output)
        osc.start(now)
        osc.stop(now + duration)
        osc.onended = () => { try { osc.disconnect(); gain.disconnect() } catch { /* ignore */ } }
    }

    /** ノイズヒットを鳴らす（ハイハット / スネア / バースト） */
    _playNoise(type, vol, duration, output) {
        if (!this.audioCtx) return
        const ctx = this.audioCtx
        const bufSize = Math.ceil(ctx.sampleRate * Math.min(duration, 0.15))
        const buf  = ctx.createBuffer(1, bufSize, ctx.sampleRate)
        const data = buf.getChannelData(0)
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1

        const source = ctx.createBufferSource()
        source.buffer = buf

        const filter = ctx.createBiquadFilter()
        if (type === 'hihat') {
            filter.type = 'highpass'; filter.frequency.value = 8000
        } else if (type === 'snare') {
            filter.type = 'bandpass'; filter.frequency.value = 1800; filter.Q.value = 0.8
        } else {
            filter.type = 'lowpass'; filter.frequency.value = 2000
        }

        const gain = ctx.createGain()
        const now  = ctx.currentTime
        gain.gain.setValueAtTime(vol, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.9)

        source.connect(filter)
        filter.connect(gain)
        gain.connect(output)
        source.start(now)
        source.onended = () => { try { source.disconnect(); filter.disconnect(); gain.disconnect() } catch { /* ignore */ } }
    }

    /** DelayFXノードを生成してマスターへ接続 */
    _buildDelayFx(spec) {
        const ctx      = this.audioCtx
        const delay    = ctx.createDelay(2.0)
        const feedback = ctx.createGain()
        const wetGain  = ctx.createGain()
        const dryGain  = ctx.createGain()

        delay.delayTime.value = spec.time
        feedback.gain.value   = spec.feedback
        wetGain.gain.value    = spec.wet
        dryGain.gain.value    = 1.0

        // dry: input → dryGain → destination
        // wet: input → delay → wetGain → destination
        //            ↑feedback↙
        delay.connect(feedback)
        feedback.connect(delay)
        delay.connect(wetGain)
        wetGain.connect(ctx.destination)
        dryGain.connect(ctx.destination)

        this._synthFxNodes.push(delay, feedback, wetGain, dryGain)
        return dryGain  // メロディはここへ接続（dryはそのままdestへ、delayにもルーティング）
    }

    /** チャネルループを開始し、タイマーIDを _synthTimers に登録 */
    _startMelodyLoop(ch, secPerBeat, output) {
        const totalSec = ch.notes.reduce((s, [, b]) => s + b * secPerBeat, 0)
        const loop = (noteIdx) => {
            if (!this._synthActive) return
            const [freq, beats] = ch.notes[noteIdx]
            const dur = beats * secPerBeat
            this._playNote(freq, dur * 0.92, ch.wave, ch.vol, ch.detune || 0, output)
            const next = (noteIdx + 1) % ch.notes.length
            const t = setTimeout(() => loop(next), dur * 1000)
            this._synthTimers.push(t)
        }
        loop(0)
    }

    _startBassLoop(ch, secPerBeat, output) {
        const loop = (noteIdx) => {
            if (!this._synthActive) return
            const [freq, beats] = ch.notes[noteIdx]
            const dur = beats * secPerBeat
            this._playNote(freq, dur * 0.85, ch.wave, ch.vol, ch.detune || 0, output)
            const next = (noteIdx + 1) % ch.notes.length
            const t = setTimeout(() => loop(next), dur * 1000)
            this._synthTimers.push(t)
        }
        loop(0)
    }

    _startNoiseLoop(n, secPerBeat, output) {
        const stepSec = n.stepLen * secPerBeat
        const loop = (step) => {
            if (!this._synthActive) return
            if (n.pattern[step]) {
                this._playNoise(n.type, n.vol, stepSec * 0.7, output)
            }
            const next = (step + 1) % n.pattern.length
            const t = setTimeout(() => loop(next), stepSec * 1000)
            this._synthTimers.push(t)
        }
        loop(0)
    }

    /** 店舗専用アンサンブルシンセ BGM を開始 */
    playSynthBGM(areaId) {
        if (!this.audioCtx || !SHOP_MELODIES[areaId]) return

        this.stopSynthBGM()

        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume()
        }

        const spec       = SHOP_MELODIES[areaId]
        const secPerBeat = 60 / spec.bpm

        // マスターゲイン（タイピング音の邪魔にならないよう小さめ）
        const master = this.audioCtx.createGain()
        master.gain.setValueAtTime(0.55, this.audioCtx.currentTime)
        master.connect(this.audioCtx.destination)
        this._synthMaster = master
        this._synthActive = true
        this._synthAreaId = areaId
        this._synthFxNodes = []
        this._synthTimers  = []

        const ch = spec.channels

        // ── Melody チャンネル（DelayFX 経由の場合あり） ──
        if (ch.melody) {
            let melodyOut = master
            if (spec.delay) {
                const dryIn = this._buildDelayFx(spec.delay)
                // delay にも入力させる（wet 用）
                const splitter = this.audioCtx.createGain()
                splitter.gain.value = 1
                splitter.connect(dryIn)
                const delayNode = this._synthFxNodes[0]  // 最初に追加された delay
                splitter.connect(delayNode)
                this._synthFxNodes.push(splitter)
                melodyOut = splitter
            }
            this._startMelodyLoop(ch.melody, secPerBeat, melodyOut)
        }

        // ── Bass チャンネル ──
        if (ch.bass) {
            this._startBassLoop(ch.bass, secPerBeat, master)
        }

        // ── Noise チャンネル ──
        if (ch.noise) {
            this._startNoiseLoop(ch.noise, secPerBeat, master)
        }
    }

    /** アンサンブルシンセ BGM を停止 */
    stopSynthBGM() {
        this._synthActive = false
        this._synthAreaId = null
        this._synthTimers.forEach(t => clearTimeout(t))
        this._synthTimers = []
        this._synthFxNodes.forEach(n => { try { n.disconnect() } catch { /* ignore */ } })
        this._synthFxNodes = []
        if (this._synthMaster) {
            try { this._synthMaster.disconnect() } catch { /* ignore */ }
            this._synthMaster = null
        }
    }

    /* ─────────────────────────────────────────
     *  MP3 環境音
     * ───────────────────────────────────────── */

    /** クロスフェードで次の MP3 サウンドに切替 */
    crossfadeTo(src, key) {
        const oldAudio = this.current

        if (oldAudio) {
            this._fadeOut(oldAudio)
        }

        const newAudio = new Audio(src)
        newAudio.loop   = true
        newAudio.volume = 0
        newAudio.play().catch(() => { })

        this.current    = newAudio
        this.currentKey = key

        this._fadeIn(newAudio, this.volume)
    }

    _fadeIn(audio, targetVolume = this.volume) {
        const step      = 50
        const increment = targetVolume / (FADE_MS / step)
        let vol = 0
        const timer = setInterval(() => {
            vol = Math.min(targetVolume, vol + increment)
            try { audio.volume = vol } catch { }
            if (vol >= targetVolume) clearInterval(timer)
        }, step)
    }

    _fadeOut(audio) {
        const step      = 50
        const decrement = audio.volume / (FADE_MS / step)
        let vol = audio.volume
        const timer = setInterval(() => {
            vol = Math.max(0, vol - decrement)
            try { audio.volume = vol } catch { }
            if (vol <= 0) {
                clearInterval(timer)
                audio.pause()
                audio.src = ''
            }
        }, step)
    }

    stop() {
        this.stopSynthBGM()
        if (this.current) {
            this._fadeOut(this.current)
            this.current    = null
            this.currentKey = null
        }
    }

    /* ─────────────────────────────────────────
     *  オープニングBGM
     * ───────────────────────────────────────── */

    /** オープニングBGM再生（タイトル画面用） */
    playOpeningBGM() {
        if (this._openingAudio) return  // already playing
        this.bgmOverride = true         // 環境音の自動切替を抑制
        // 既存の環境音・シンセを停止
        if (this.current) { this._fadeOut(this.current); this.current = null }
        this.stopSynthBGM()

        if (this.audioCtx?.state === 'suspended') this.audioCtx.resume()

        const audio = new Audio('/sound/opening.mp3')
        audio.loop   = true
        audio.volume = 0
        audio.play().catch(() => { })
        this._openingAudio = audio
        this._fadeIn(audio, this.volume * 0.8)
    }

    /** オープニングBGM停止（ゲーム本編へ移行時） */
    stopOpeningBGM() {
        if (!this._openingAudio) return
        this._fadeOut(this._openingAudio)
        this._openingAudio = null
        this.bgmOverride   = false
        this.currentKey    = null  // 環境音を最初から再生させる
    }

    /* ─────────────────────────────────────────
     *  テキスト表示用レトロタイピング音
     * ───────────────────────────────────────── */
    playTextSound() {
        if (!this.enabled || !this.audioCtx) return

        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume()
        }

        const osc  = this.audioCtx.createOscillator()
        const gain = this.audioCtx.createGain()

        osc.type = 'square'
        osc.frequency.setValueAtTime(880, this.audioCtx.currentTime)           // A5
        osc.frequency.exponentialRampToValueAtTime(440, this.audioCtx.currentTime + 0.03)

        gain.gain.setValueAtTime(0.05, this.audioCtx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.03)

        osc.connect(gain)
        gain.connect(this.audioCtx.destination)

        osc.start()
        osc.stop(this.audioCtx.currentTime + 0.04)
    }
}

// シングルトン
const soundManager = new SoundManager()
export default soundManager
