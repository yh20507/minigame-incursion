"""빌드된 dist/assets 의 큰 일러스트(PNG)를 WebP 로 바꿔 exe 용량을 줄인다.
게임은 계속 .png 로 요청하고, electron/main.cjs 가 같은 이름의 .webp 를 대신 찾아준다.
도트(sprite)·미니게임 배경(640×360)은 픽셀이 깨지면 안 되니 PNG 그대로 둔다.
사용: python tools/shrink_art.py dist/assets
"""
import os
import sys

from PIL import Image

root = sys.argv[1] if len(sys.argv) > 1 else "dist/assets"
TARGET = ("_art.png", "_full.png", "_hd.png")
before = after = n = 0
for d, _, files in os.walk(root):
    for f in files:
        if not f.endswith(TARGET):
            continue
        src = os.path.join(d, f)
        dst = src[:-4] + ".webp"
        im = Image.open(src)
        im = im.convert("RGBA") if im.mode in ("RGBA", "LA", "P") and im.getchannel("A").getextrema()[0] < 255 else im.convert("RGB")
        im.save(dst, "WEBP", quality=90, method=6)
        before += os.path.getsize(src)
        after += os.path.getsize(dst)
        os.remove(src)
        n += 1
print(f"{n}장: {before / 1e6:.0f}MB → {after / 1e6:.0f}MB")
