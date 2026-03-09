// Vercel Serverless Function: Gemini API プロキシ
export default async function handler(req, res) {
    // CORS ヘッダー
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not set on server. Add it in Vercel Settings > Environment Variables' })

    // body は Vercel が自動パース済み（Content-Type: application/json の場合）
    // 念のため文字列の場合も対応
    let body = req.body
    if (typeof body === 'string') {
        try { body = JSON.parse(body) } catch { return res.status(400).json({ error: 'Invalid JSON body' }) }
    }

    try {
        const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            }
        )
        const data = await geminiRes.json()
        return res.status(geminiRes.status).json(data)
    } catch (err) {
        return res.status(500).json({ error: err.message || 'fetch failed' })
    }
}
