"""公園背景にベテランを合成して確認用画像を生成"""
from PIL import Image
import os

BG   = os.path.join(os.path.dirname(__file__), "../public/image/bg/bg_park_noon_1772362964470.png")
NPC  = os.path.join(os.path.dirname(__file__), "../public/image/npc/veteran.png")
OUT  = os.path.join(os.path.dirname(__file__), "../public/image/npc/veteran_preview.png")

bg  = Image.open(BG).convert("RGBA")
npc = Image.open(NPC).convert("RGBA")

bw, bh = bg.size
# ベテランを背景高さの75%にリサイズ
npc_h = int(bh * 0.75)
npc_w = int(npc.width * npc_h / npc.height)
npc_resized = npc.resize((npc_w, npc_h), Image.NEAREST)  # ピクセルアートはNEAREST

# 左側の10%から配置、縦は下揃え
x = int(bw * 0.06)
y = bh - npc_h

composite = bg.copy()
composite.paste(npc_resized, (x, y), npc_resized)
composite.save(OUT)
print(f"合成完了: {OUT}  BG={bw}x{bh}  NPC={npc_w}x{npc_h}  pos=({x},{y})")
