"""
veteran.png の白背景をフラッドフィル（コーナーから）で透過処理するスクリプト
"""
from PIL import Image
import os
from collections import deque

INPUT  = os.path.join(os.path.dirname(__file__), "../public/image/npc/veteran.png")
OUTPUT = INPUT

img = Image.open(INPUT).convert("RGBA")
pixels = img.load()
w, h = img.size

def is_bg(r, g, b, a):
    """白〜薄いグレーかどうか判定（閾値180）"""
    return a > 0 and r > 180 and g > 180 and b > 180

def flood_fill_transparent(start_pixels):
    visited = set()
    queue = deque(start_pixels)
    while queue:
        x, y = queue.popleft()
        if (x, y) in visited:
            continue
        if x < 0 or x >= w or y < 0 or y >= h:
            continue
        r, g, b, a = pixels[x, y]
        if not is_bg(r, g, b, a):
            continue
        visited.add((x, y))
        pixels[x, y] = (r, g, b, 0)
        queue.extend([(x+1,y),(x-1,y),(x,y+1),(x,y-1)])

# 四隅と外縁からフラッドフィル開始
edge_pixels = []
for x in range(w):
    edge_pixels.append((x, 0))
    edge_pixels.append((x, h-1))
for y in range(h):
    edge_pixels.append((0, y))
    edge_pixels.append((w-1, y))

flood_fill_transparent(edge_pixels)

img.save(OUTPUT, "PNG")
print(f"完了: {OUTPUT}  ({w}x{h})")
