/* ═══════════════════════════════════════════════════
 *  Homeless Simulator – サウンドマネージャー
 *  エリア × 時間帯 × 天候 で環境音をループ切替
 *  店舗サブエリアは Web Audio API 8bit シンセで演奏
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

/* ── 8bit シンセ用周波数テーブル ── */
const N = {
    REST: 0,
    C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, Bb3: 233.08, B3: 246.94,
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, Bb4: 466.16, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, Bb5: 932.33,
    C6: 1046.50,
}

/* ── 店舗別メロディデータ [周波数Hz, 秒数] ──
 *   REST(0) は無音ポーズ
 * ───────────────────────────────────────── */
const SHOP_MELODIES = {

    // 銭湯: ゆったり和風（ヨナ抜き音階 C D E G A）
    sento: [
        [N.C4, 0.6], [N.D4, 0.3], [N.E4, 0.6], [N.G4, 0.6],
        [N.A4, 0.9], [N.REST, 0.3], [N.G4, 0.6], [N.E4, 0.6],
        [N.D4, 0.4], [N.C4, 0.3], [N.D4, 0.3], [N.E4, 0.9],
        [N.REST, 0.3], [N.G4, 0.6], [N.E4, 0.4], [N.D4, 0.2],
        [N.C4, 0.6], [N.A3, 0.6], [N.C4, 1.2], [N.REST, 0.6],
        [N.E4, 0.6], [N.G4, 0.6], [N.A4, 0.6], [N.G4, 0.4],
        [N.E4, 0.3], [N.D4, 0.3], [N.C4, 1.5], [N.REST, 0.6],
    ],

    // 弁当屋: 明るく元気（ハ長調・アイテム屋風）
    bentoya: [
        [N.C5, 0.15], [N.E5, 0.15], [N.G5, 0.15], [N.E5, 0.15],
        [N.C5, 0.15], [N.D5, 0.15], [N.E5, 0.30], [N.REST, 0.15],
        [N.G4, 0.15], [N.A4, 0.15], [N.C5, 0.15], [N.A4, 0.15],
        [N.G4, 0.15], [N.E4, 0.30], [N.REST, 0.15],
        [N.C5, 0.15], [N.B4, 0.15], [N.A4, 0.15], [N.G4, 0.15],
        [N.E4, 0.15], [N.G4, 0.15], [N.C5, 0.45], [N.REST, 0.15],
        [N.E5, 0.15], [N.D5, 0.15], [N.C5, 0.15], [N.B4, 0.15],
        [N.C5, 0.15], [N.E5, 0.15], [N.G5, 0.30], [N.REST, 0.30],
    ],

    // 古着屋: 都会的・落ち着き（イ短調・ジャジーな間）
    furugiya: [
        [N.A4, 0.30], [N.REST, 0.15], [N.C5, 0.30], [N.E5, 0.30],
        [N.D5, 0.45], [N.C5, 0.15], [N.A4, 0.60], [N.REST, 0.30],
        [N.G4, 0.30], [N.REST, 0.15], [N.Bb4, 0.30], [N.D5, 0.30],
        [N.C5, 0.45], [N.A4, 0.15], [N.G4, 0.60], [N.REST, 0.45],
        [N.A4, 0.30], [N.C5, 0.30], [N.D5, 0.30], [N.E5, 0.45],
        [N.D5, 0.15], [N.C5, 0.30], [N.A4, 0.90], [N.REST, 0.30],
        [N.G4, 0.15], [N.A4, 0.15], [N.C5, 0.30], [N.Bb4, 0.30],
        [N.A4, 0.30], [N.G4, 0.30], [N.A4, 1.20], [N.REST, 0.60],
    ],

    // リサイクルショップ: 怪しげ（半音・マイナースケール）
    recycle: [
        [N.A4, 0.20], [N.Bb4, 0.20], [N.A4, 0.20], [N.REST, 0.20],
        [N.G4, 0.40], [N.F4, 0.20], [N.E4, 0.40], [N.REST, 0.20],
        [N.A3, 0.20], [N.C4, 0.20], [N.E4, 0.20], [N.G4, 0.20],
        [N.Bb4, 0.40], [N.A4, 0.20], [N.REST, 0.40],
        [N.E4, 0.20], [N.F4, 0.20], [N.G4, 0.20], [N.F4, 0.20],
        [N.E4, 0.40], [N.D4, 0.20], [N.C4, 0.40], [N.REST, 0.20],
        [N.Bb3, 0.20], [N.C4, 0.20], [N.D4, 0.20], [N.E4, 0.20],
        [N.G4, 0.20], [N.Bb4, 0.20], [N.A4, 0.60], [N.REST, 0.40],
    ],

    // 福引き: アップテンポ・お祭り（ペンタトニック）
    fukubiki: [
        [N.G4, 0.10], [N.A4, 0.10], [N.C5, 0.20], [N.D5, 0.10], [N.E5, 0.10],
        [N.D5, 0.20], [N.C5, 0.10], [N.A4, 0.10], [N.G4, 0.20], [N.REST, 0.10],
        [N.C5, 0.10], [N.D5, 0.10], [N.E5, 0.10], [N.G5, 0.20], [N.E5, 0.10],
        [N.D5, 0.10], [N.C5, 0.20], [N.REST, 0.10],
        [N.A4, 0.10], [N.C5, 0.10], [N.D5, 0.10], [N.E5, 0.10],
        [N.G5, 0.10], [N.E5, 0.10], [N.D5, 0.10], [N.C5, 0.10],
        [N.A4, 0.30], [N.REST, 0.10],
        [N.G4, 0.10], [N.A4, 0.10], [N.C5, 0.10], [N.A4, 0.10],
        [N.G4, 0.10], [N.E4, 0.10], [N.G4, 0.30], [N.REST, 0.20],
    ],
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

        // シンセ関連
        this._synthActive = false
        this._synthTimer  = null
        this._synthGain   = null
        this._synthAreaId = null

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

    /* ─────────────────────────────────────────
     *  8bit シンセ BGM
     * ───────────────────────────────────────── */

    /** 店舗専用 8bit シンセ BGM を開始 */
    playSynthBGM(areaId) {
        if (!this.audioCtx || !SHOP_MELODIES[areaId]) return

        // 既存シンセを停止してから開始
        this.stopSynthBGM()

        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume()
        }

        // マスターゲイン（タイピング音の邪魔にならないよう小さめ）
        const masterGain = this.audioCtx.createGain()
        masterGain.gain.setValueAtTime(0.05, this.audioCtx.currentTime)
        masterGain.connect(this.audioCtx.destination)
        this._synthGain   = masterGain
        this._synthActive = true
        this._synthAreaId = areaId

        const melody = SHOP_MELODIES[areaId]
        let noteIndex = 0

        const tick = () => {
            if (!this._synthActive) return

            const [freq, duration] = melody[noteIndex]
            noteIndex = (noteIndex + 1) % melody.length

            if (freq > 0) {
                const osc     = this.audioCtx.createOscillator()
                const envGain = this.audioCtx.createGain()
                const now     = this.audioCtx.currentTime

                // 波形: sento=triangle(柔らかい), recycle=sawtooth(怪しい), others=square(ゲーム感)
                const waveTypes = { sento: 'triangle', recycle: 'sawtooth', furugiya: 'triangle' }
                osc.type = waveTypes[areaId] || 'square'
                osc.frequency.setValueAtTime(freq, now)

                // エンベロープ: アタック → 音の末尾でカット
                envGain.gain.setValueAtTime(0, now)
                envGain.gain.linearRampToValueAtTime(1, now + 0.005)          // 素早いアタック
                envGain.gain.setValueAtTime(1, now + duration * 0.80)         // サステイン
                envGain.gain.linearRampToValueAtTime(0, now + duration * 0.95) // リリース

                osc.connect(envGain)
                envGain.connect(masterGain)

                osc.start(now)
                osc.stop(now + duration)
            }

            this._synthTimer = setTimeout(tick, duration * 1000)
        }

        tick()
    }

    /** 8bit シンセ BGM を停止 */
    stopSynthBGM() {
        this._synthActive = false
        this._synthAreaId = null
        if (this._synthTimer) {
            clearTimeout(this._synthTimer)
            this._synthTimer = null
        }
        if (this._synthGain) {
            try { this._synthGain.disconnect() } catch { /* ignore */ }
            this._synthGain = null
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
