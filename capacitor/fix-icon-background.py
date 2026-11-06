#!/usr/bin/env python3
"""Replace the opaque near-black outer frame in the existing Yasno icon.

Android's adaptive icon mask is applied by the launcher. Keep its entire
1024x1024 source opaque, and avoid an additional baked-in black square.
"""
from collections import deque
from pathlib import Path
from PIL import Image

icon = Path("assets/icon.png")
im = Image.open(icon).convert("RGB")
w, h = im.size
px = im.load()
seen = bytearray(w * h)
queue = deque()

def is_outer_dark(x, y):
    r, g, b = px[x, y]
    return max(r, g, b) <= 24

def add(x, y):
    k = y * w + x
    if not seen[k] and is_outer_dark(x, y):
        seen[k] = 1
        queue.append((x, y))

for x in range(w):
    add(x, 0)
    add(x, h-1)
for y in range(h):
    add(0, y)
    add(w-1, y)

# Color-match the Android adaptive launcher background.
background = (40, 55, 113)
changed = 0
while queue:
    x, y = queue.popleft()
    px[x, y] = background
    changed += 1
    if x > 0: add(x-1, y)
    if x+1 < w: add(x+1, y)
    if y > 0: add(x, y-1)
    if y+1 < h: add(x, y+1)

im.save(icon)
print(f"Icon: replaced {changed} outer dark pixels with #283771, output {w}x{h}.")
