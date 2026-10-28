"""게임 아이콘 생성: 조각세계 4색 타일 + 차원 균열 (32x32 픽셀 → 256 확대)"""
from PIL import Image
import os

N = 32
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "build")
def hx(h): return tuple(int(h[i:i+2], 16) for i in (1, 3, 5)) + (255,)
def mix(a, b, t): return tuple(int(a[i] * (1 - t) + b[i] * t) for i in range(3)) + (255,)

DARK = hx("#07060f")
BORDER = hx("#b48cff")
tiles = [mix(hx("#d9a066"), DARK, 0.45), mix(hx("#ff4fa8"), DARK, 0.5),
         mix(hx("#5fd3e0"), DARK, 0.5), mix(hx("#7a5cd6"), DARK, 0.45)]
img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
px = img.load()

def inside(x, y, r=4, m=1):
    # 둥근 사각형
    lo, hi = m, N - 1 - m
    if not (lo <= x <= hi and lo <= y <= hi): return False
    cx = min(max(x, lo + r), hi - r); cy = min(max(y, lo + r), hi - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 1

# 바탕: 이음선이 살짝 어긋난 4조각
for y in range(N):
    for x in range(N):
        if not inside(x, y): continue
        sx = 15 + (1 if (y // 4) % 2 else 0)
        sy = 16 + (1 if (x // 5) % 2 else 0)
        q = (0 if x < sx else 1) + (0 if y < sy else 2)
        c = tiles[q]
        # 조각 안 은은한 결
        if (x * 3 + y * 5) % 11 == 0: c = mix(c, (255, 255, 255, 255), 0.08)
        px[x, y] = c
# 이음선 바느질
for y in range(3, N - 3):
    sx = 15 + (1 if (y // 4) % 2 else 0)
    if inside(sx, y) and y % 3: px[sx, y] = mix(BORDER, DARK, 0.35)
for x in range(3, N - 3):
    sy = 16 + (1 if (x // 5) % 2 else 0)
    if inside(x, sy) and x % 3: px[x, sy] = mix(BORDER, DARK, 0.35)

# 테두리
for y in range(N):
    for x in range(N):
        if inside(x, y, m=1) and not inside(x, y, r=3, m=3):
            px[x, y] = BORDER
        elif inside(x, y, r=5, m=0) and not inside(x, y, m=1):
            px[x, y] = DARK
        elif inside(x, y, m=1) and not inside(x, y, r=3, m=2):
            pass

# 균열 (오른쪽 위 → 왼쪽 아래, 지그재그)
pts = [(25, 4), (21, 9), (23, 12), (17, 15), (19, 18), (12, 21), (14, 24), (7, 28)]
crack = set()
def line(a, b):
    (x0, y0), (x1, y1) = a, b
    dx, dy = abs(x1 - x0), -abs(y1 - y0); sx = 1 if x0 < x1 else -1; sy = 1 if y0 < y1 else -1; e = dx + dy
    while True:
        crack.add((x0, y0))
        if (x0, y0) == (x1, y1): break
        e2 = 2 * e
        if e2 >= dy: e += dy; x0 += sx
        if e2 <= dx: e += dx; y0 += sy
for a, b in zip(pts, pts[1:]): line(a, b)
# 굵은 가운데 구간
core = set(crack)
for (x, y) in list(crack):
    if 9 <= y <= 22: core.add((x + 1, y))
glow1 = {(x + dx, y + dy) for (x, y) in core for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
glow2 = {(x + dx, y + dy) for (x, y) in glow1 for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
PINK = hx("#ff5fd2")
for (x, y) in glow2 - glow1:
    if inside(x, y, r=3, m=3): px[x, y] = mix(px[x, y], PINK, 0.35)
for (x, y) in glow1 - core:
    if inside(x, y, r=3, m=3): px[x, y] = PINK
for (x, y) in core:
    if inside(x, y, r=3, m=3): px[x, y] = (255, 240, 252, 255)

# 반짝이
def star(x, y, c, big=False):
    px[x, y] = (255, 255, 255, 255)
    for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        px[x + d[0], y + d[1]] = c
        if big: px[x + 2 * d[0], y + 2 * d[1]] = mix(c, DARK, 0.3)
star(8, 8, hx("#ffc845"), True)
star(25, 24, hx("#ffc845"))
star(27, 13, (255, 255, 255, 255))

big = img.resize((256, 256), Image.NEAREST)
big.save(os.path.join(OUT, "icon.png"))
big.save(os.path.join(OUT, "icon.ico"), sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
print("ok", OUT)
