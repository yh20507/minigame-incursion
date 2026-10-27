"""AI가 만든 '가짜 픽셀' 그림을 진짜 픽셀 그림으로 바꾼다.

하는 일
  1. 네 모서리 색과 비슷한 단색 배경을 투명하게 지운다 (--keep-bg 로 끔)
  2. 그림 안의 픽셀 한 칸 크기를 추정해서 그 크기로 줄인다
  3. 색 수를 줄인다 (--colors)
  4. 정해진 크기 상자 안에 비율을 지켜 넣는다 (--size)

사용 예
  python tools/pixelize.py 원본.png public/assets/chars/heim_sprite.png --size 48
  python tools/pixelize.py 원본.png public/assets/chars/heim_art.png --size 256 --colors 64
  python tools/pixelize.py 배경.png public/assets/bg/ashen.png --size 640x360 --keep-bg --fill
  python tools/pixelize.py raw_folder/ out_folder/ --size 48      (폴더 통째로)

필요: Python 3 + Pillow (pip install pillow)
"""
import argparse
import os
import sys
from collections import Counter

from PIL import Image, ImageChops, ImageStat


def remove_bg(img, tol):
    img = img.convert("RGBA")
    w, h = img.size
    px = img.load()
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    bg = Counter(c[:3] for c in corners).most_common(1)[0][0]
    # 가장자리에서부터 비슷한 색만 지운다 (그림 안쪽 같은 색은 보존)
    seen = set()
    stack = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    while stack:
        x, y = stack.pop()
        if (x, y) in seen or x < 0 or y < 0 or x >= w or y >= h:
            continue
        seen.add((x, y))
        r, g, b, a = px[x, y]
        if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) > tol:
            continue
        px[x, y] = (0, 0, 0, 0)
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return img


def estimate_cell(img):
    """같은 색이 이어지는 길이들을 모아, 대부분의 길이가 배수가 되는 가장 큰 칸 크기를 고른다"""
    rgb = img.convert("RGB")
    w, h = rgb.size
    px = rgb.load()
    runs = Counter()
    for horizontal in (True, False):
        lines = range(0, h, max(1, h // 96)) if horizontal else range(0, w, max(1, w // 96))
        length = w if horizontal else h
        for k in lines:
            run = 1
            for i in range(1, length):
                a = px[i, k] if horizontal else px[k, i]
                b = px[i - 1, k] if horizontal else px[k, i - 1]
                if sum(abs(a[j] - b[j]) for j in range(3)) < 30:
                    run += 1
                else:
                    if run >= 3:
                        runs[run] += 1
                    run = 1
    total = sum(runs.values())
    if not total:
        return 1
    fits = {}
    for c in range(2, max(3, min(128, min(w, h) // 8))):
        ok = sum(n for r, n in runs.items() if r >= c * 0.75 and abs(r - round(r / c) * c) <= max(1.5, c * 0.2))
        fits[c] = ok / total
    best_fit = max(fits.values())
    good = [c for c, f in fits.items() if f >= best_fit * 0.85]
    return max(good) if good else 1


def downscale(img, c):
    """추정한 칸 크기 근처에서, 줄였다 다시 키웠을 때 원본과 가장 비슷한 칸 수를 고른다"""
    w, h = img.size
    rgb = img.convert("RGB")
    guess = max(1, round(w / c))
    trials = []
    for n in range(max(2, guess - 3), guess + 4):
        cs = w / n
        nh = max(1, round(h / cs))
        small = rgb.resize((n, nh), Image.NEAREST)
        up = small.resize((w, h), Image.NEAREST)
        err = sum(ImageStat.Stat(ImageChops.difference(rgb, up)).mean)
        trials.append((n, nh, err))
    best = min(t[2] for t in trials)
    n, nh, _ = min((t for t in trials if t[2] <= best * 1.08 + 0.5), key=lambda t: t[0])
    return img.resize((n, nh), Image.NEAREST), w / n


def process(src, dst, size, colors, keep_bg, tol, fill, cell):
    img = Image.open(src).convert("RGBA")
    if not keep_bg:
        img = remove_bg(img, tol)
    c = cell or estimate_cell(img)
    if c > 1:
        img, c = downscale(img, c)
    alpha = img.getchannel("A").point(lambda a: 255 if a > 127 else 0)
    rgb = img.convert("RGB").quantize(colors=colors, method=Image.Quantize.MEDIANCUT).convert("RGB")
    img = rgb.convert("RGBA")
    img.putalpha(alpha)
    bbox = img.getbbox()
    if bbox and not fill:
        img = img.crop(bbox)
    tw, th = size
    if fill:
        scale = max(tw / img.width, th / img.height)
    else:
        scale = min(tw / img.width, th / img.height)
    nw, nh = max(1, round(img.width * scale)), max(1, round(img.height * scale))
    img = img.resize((nw, nh), Image.NEAREST)
    out = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    ox = (tw - nw) // 2
    oy = (th - nh) // 2 if fill else th - nh  # 캐릭터는 발이 바닥에 닿게
    out.paste(img, (ox, oy), img)
    os.makedirs(os.path.dirname(os.path.abspath(dst)), exist_ok=True)
    out.save(dst)
    print(f"{os.path.basename(src)} -> {dst}  (칸 크기 {c:.1f}px, {tw}x{th})")


def main():
    ap = argparse.ArgumentParser(description="AI 픽셀풍 그림을 진짜 픽셀 그림으로 변환")
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--size", default="48", help="48 또는 640x360")
    ap.add_argument("--colors", type=int, default=32)
    ap.add_argument("--keep-bg", action="store_true", help="배경을 지우지 않음")
    ap.add_argument("--tol", type=int, default=60, help="배경 색 허용 오차")
    ap.add_argument("--fill", action="store_true", help="상자를 꽉 채움 (배경용)")
    ap.add_argument("--cell", type=int, default=0, help="픽셀 칸 크기를 직접 지정")
    a = ap.parse_args()
    size = tuple(int(v) for v in a.size.lower().split("x")) if "x" in a.size.lower() else (int(a.size), int(a.size))
    if os.path.isdir(a.src):
        os.makedirs(a.dst, exist_ok=True)
        for f in sorted(os.listdir(a.src)):
            if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
                process(os.path.join(a.src, f), os.path.join(a.dst, os.path.splitext(f)[0] + ".png"), size, a.colors, a.keep_bg, a.tol, a.fill, a.cell)
    else:
        process(a.src, a.dst, size, a.colors, a.keep_bg, a.tol, a.fill, a.cell)


if __name__ == "__main__":
    sys.exit(main())
