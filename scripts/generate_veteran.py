"""
70代のベテランNPC画像生成スクリプト（Gemini画像API使用）
"""
import requests, base64, os, sys

API_KEY = "AIzaSyABMc5V2kCw6OqSRfpTH_lmxwEtwyFtG7o"
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "../public/image/npc/veteran.png")

PROMPT = (
    "NES Famicom 8-bit pixel art sprite of a weathered homeless Japanese man in his 70s. "
    "He is sitting on a park bench, wearing dirty layered clothes, old coat, worn-out shoes. "
    "Wrinkled face, stubble, tired but sharp eyes that hint at past wisdom. "
    "Full body character sprite, transparent background, facing slightly left, "
    "Shinjuku park setting. Limited 16-color NES palette. "
    "Pixel art style, crisp edges, no anti-aliasing. Retro RPG NPC character."
)

url = (
    f"https://generativelanguage.googleapis.com/v1beta/models/"
    f"gemini-2.0-flash-exp-image-generation:generateContent?key={API_KEY}"
)

payload = {
    "contents": [{"parts": [{"text": PROMPT}]}],
    "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]},
}

print("画像生成中...")
resp = requests.post(url, json=payload, timeout=60)
resp.raise_for_status()
data = resp.json()

for part in data["candidates"][0]["content"]["parts"]:
    if "inlineData" in part:
        img_bytes = base64.b64decode(part["inlineData"]["data"])
        os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
        with open(OUTPUT_PATH, "wb") as f:
            f.write(img_bytes)
        print(f"保存完了: {OUTPUT_PATH}")
        sys.exit(0)

print("ERROR: 画像データが返ってきませんでした")
sys.exit(1)
