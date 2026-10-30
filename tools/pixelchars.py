"""캐릭터 도트(48×48) 생성기 — 24×23 격자를 2px 로 찍는 손그림 스타일 치비.

  python tools/pixelchars.py              모든 캐릭터·스킨 도트를 public/assets/chars/ 에 생성
  python tools/pixelchars.py --sheet x.png  검수용 시트만
  python tools/pixelchars.py --only heim,nova

캐릭터마다 CHARS 에 생김새 파라미터가 있고, 없는 캐릭터는 look 문자열에서 대충 추측한다.
"""
import argparse
import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 24, 24
YOFF = 1  # 맨 윗줄 한 칸은 후광·뿔·귀 자리


def hexc(s):
    if isinstance(s, tuple):
        return s
    s = s.lstrip("#")
    if len(s) == 3:
        s = "".join(ch * 2 for ch in s)
    return tuple(int(s[i : i + 2], 16) for i in (0, 2, 4)) + (255,)


def shade(c, f):
    c = hexc(c)
    r, g, b, a = c
    if f < 0:
        k = 1 + f
        return (int(r * k), int(g * k), int(b * k), a)
    return (int(r + (255 - r) * f), int(g + (255 - g) * f), int(b + (255 - b) * f), a)


OUTLINE = hexc("#2a2230")
WHITE = hexc("#ffffff")


class Px:
    def __init__(self):
        self.g = [[None] * W for _ in range(H)]

    def set(self, x, y, c):
        y += YOFF
        if 0 <= x < W and 0 <= y < H and c is not None:
            self.g[y][x] = hexc(c)

    def rect(self, x0, y0, x1, y1, c):
        for y in range(min(y0, y1), max(y0, y1) + 1):
            for x in range(min(x0, x1), max(x0, x1) + 1):
                self.set(x, y, c)

    def hline(self, x0, x1, y, c):
        self.rect(x0, y, x1, y, c)

    def vline(self, x, y0, y1, c):
        self.rect(x, y0, x, y1, c)

    def get(self, x, y):
        y += YOFF
        if 0 <= x < W and 0 <= y < H:
            return self.g[y][x]
        return None

    def image(self, glow=None):
        im = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
        px = im.load()
        oy = 48 - H * 2
        if glow:
            gc = hexc(glow)[:3] + (120,)
            for y in range(H):
                for x in range(W):
                    if self.g[y][x]:
                        continue
                    if any(self.get(x + dx, y + dy - YOFF) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                        for dy in range(2):
                            for dx in range(2):
                                px[x * 2 + dx, oy + y * 2 + dy] = gc
        for y in range(H):
            for x in range(W):
                c = self.g[y][x]
                if c:
                    for dy in range(2):
                        for dx in range(2):
                            px[x * 2 + dx, oy + y * 2 + dy] = c
        return im


SKIN_TONES = {"light": "#f6d7c3", "tan": "#e2b48f", "dark": "#8d5a3c", "pale": "#fbe9dd", "blue": "#7fa9d8", "green": "#8fd48a", "grey": "#b9bcc6", "cyan": "#8ff0ff", "purple": "#b48cff"}


# ---------------------------------------------------------------- 그리기
def draw(p):
    P = Px()
    skin = hexc(SKIN_TONES.get(p.get("skin", "light"), p.get("skin", "#f6d7c3")))
    skin_d = shade(skin, -0.18)
    hair = hexc(p.get("hair", "#3a2a2a"))
    hair_d, hair_l = shade(hair, -0.3), shade(hair, 0.25)
    eye = hexc(p.get("eye", "#3a3a4a"))
    top = hexc(p.get("top", "#5a5a7a"))
    top_d, top_l = shade(top, -0.25), shade(top, 0.25)
    bot = hexc(p.get("bottom", shade(top, -0.3)))
    acc = set(p.get("acc", []))
    body = p.get("body", "human")
    outfit = p.get("outfit", "shirt")
    hs = p.get("hairStyle", "short")
    big = p.get("big", False)  # 덩치

    # ---------- 특수 몸체는 따로
    if body in ("spirit", "robot", "skeleton", "raccoon", "paper", "leaf", "pages", "golem", "hologram_ring"):
        return draw_special(P, p, body, skin, hair, eye, top, bot, acc)

    # ---------- 뒤: 망토 · 날개 · 꼬리 · 등 뒤 무기
    cape = p.get("cape")
    if cape:
        cc = hexc(cape)
        P.rect(6, 13, 17, 21, cc)
        P.rect(7, 22, 16, 22, shade(cc, -0.25))
        P.vline(6, 14, 21, shade(cc, -0.2))
        P.vline(17, 14, 21, shade(cc, -0.2))
    wings = p.get("wings")
    if wings == "bat":
        wc, wd = hexc(p.get("wingColor", "#e24bd0")), hexc("#3a2240")
        for s in (-1, 1):
            cx = 12 + s * 9
            P.rect(cx, 9, cx + s * 3, 16, wc)
            P.rect(cx + s, 7, cx + s * 4, 9, wc)
            P.set(cx + s * 4, 10, wc)
            P.set(cx + s * 3, 17, wc)
            P.set(cx + s, 9, wd); P.set(cx + s * 2, 11, wd); P.set(cx + s * 3, 13, wd); P.set(cx + s * 4, 7, wd); P.set(cx + s * 2, 16, wd)
    elif wings == "angel":
        wc, wd = hexc(p.get("wingColor", "#ffffff")), hexc("#d7c8ff")
        for s in (-1, 1):
            cx = 12 + s * 8
            P.rect(cx, 10, cx + s * 3, 15, wc)
            P.rect(cx + s, 8, cx + s * 3, 9, wc)
            for y in (11, 13, 15):
                P.set(cx + s * 2, y, wd); P.set(cx + s * 3, y - 1, wd)
    elif wings == "mech":
        wc, wd = hexc(p.get("wingColor", "#c0c4cc")), hexc("#8a1f1f")
        for s in (-1, 1):
            cx = 12 + s * 8
            P.rect(cx, 11, cx + s * 4, 12, wc)
            P.rect(cx + s, 13, cx + s * 4, 14, wc)
            P.rect(cx + s * 2, 15, cx + s * 4, 16, wc)
            P.set(cx + s * 4, 12, wd); P.set(cx + s * 4, 14, wd)
    tails = p.get("tails")
    if tails == "fox9":
        tc = hexc(p.get("tailColor", "#ffffff"))
        for i, (x, y) in enumerate(((2, 12), (3, 9), (5, 7), (18, 7), (20, 9), (21, 12), (3, 15), (20, 15), (12, 6))):
            P.rect(x, y, x + 1, y + 3, tc)
            P.set(x, y, shade(tc, -0.15))
    elif tails == "fox1":
        tc = hexc(p.get("tailColor", "#c9b6ee")); P.rect(18, 15, 20, 21, tc); P.set(21, 17, tc); P.rect(19, 20, 20, 21, shade(tc, 0.4))
    elif tails == "dragon":
        tc = hexc(p.get("tailColor", "#4a3a5a")); P.rect(18, 18, 21, 19, tc); P.set(22, 17, tc); P.set(23, 16, tc); P.set(20, 18, shade(tc, 0.25))
    elif tails == "cat":
        tc = hexc(p.get("tailColor", hair))
        P.vline(19, 16, 21, tc); P.set(20, 15, tc); P.set(20, 14, shade(tc, 0.3))
    elif tails == "tiger":
        tc = hexc(p.get("tailColor", "#d9b06a"))
        P.vline(19, 16, 21, tc); P.set(20, 15, tc); P.set(19, 18, hexc("#2a2230")); P.set(19, 20, hexc("#2a2230"))
    elif tails == "raccoon":
        tc = hexc("#8a6a4a")
        P.vline(19, 15, 21, tc); P.set(20, 14, tc); P.set(19, 17, hexc("#3a2a1a")); P.set(19, 20, hexc("#3a2a1a"))
    for pr in p.get("backProps", []):
        draw_prop(P, pr, skin, back=True)

    # ---------- 뒷머리
    if hs in ("long", "twin", "longwavy", "longinner", "sideponytail", "braid", "braid2", "lowtwin", "ponytail", "halfup", "wavybob", "longbangs"):
        P.rect(5, 6, 6, 16, hair)
        P.rect(17, 6, 18, 16, hair)
        P.rect(7, 6, 16, 12, hair)
        if hs == "longwavy":
            P.rect(4, 10, 4, 17, hair); P.rect(19, 10, 19, 17, hair)
            P.set(5, 17, hair_d); P.set(18, 17, hair_d); P.set(4, 12, hair_l); P.set(19, 14, hair_l)
        if hs == "twin":
            P.rect(3, 8, 4, 19, hair); P.rect(19, 8, 20, 19, hair)
            P.set(4, 7, hair_l); P.set(19, 7, hair_l)
            P.rect(3, 5, 5, 5, hair); P.rect(18, 5, 20, 5, hair)
        if hs == "lowtwin":
            tip = hexc(p.get("hairTip", hair))
            P.rect(4, 13, 5, 19, hair); P.rect(18, 13, 19, 19, hair)
            P.rect(4, 18, 5, 20, tip); P.rect(18, 18, 19, 20, tip)
        if hs == "longinner":
            inner = hexc(p.get("hairInner", hair_l))
            P.rect(5, 12, 6, 16, inner); P.rect(17, 12, 18, 16, inner); P.rect(5, 17, 6, 19, inner); P.rect(17, 17, 18, 19, inner)
        if hs == "sideponytail":
            P.rect(17, 5, 20, 7, hair); P.rect(18, 8, 21, 14, hair); P.rect(19, 15, 21, 18, hair); P.set(20, 10, hair_l); P.set(21, 13, hair_d)
        if hs == "ponytail":
            P.rect(10, 0, 13, 1, hair); P.rect(16, 2, 19, 4, hair); P.rect(18, 5, 20, 14, hair); P.set(19, 8, hair_l)
        if hs == "braid2":
            for x in (4, 18):
                P.rect(x, 13, x + 1, 20, hair)
                for y in (14, 16, 18):
                    P.set(x, y, hair_d); P.set(x + 1, y + 1, hair_d)
        if hs == "braid":
            P.rect(18, 13, 19, 20, hair)
            for y in (14, 16, 18):
                P.set(18, y, hair_d); P.set(19, y + 1, hair_d)
        if hs == "wavybob":
            P.rect(5, 6, 6, 13, hair); P.rect(17, 6, 18, 13, hair); P.set(5, 14, hair_d); P.set(18, 14, hair_d)
            P.rect(5, 14, 6, 16, None) if False else None
        if hs == "halfup":
            P.rect(10, 0, 13, 0, hair); P.set(11, -1, hair)
    elif hs == "bob":
        P.rect(5, 6, 6, 12, hair); P.rect(17, 6, 18, 12, hair); P.rect(7, 6, 16, 11, hair); P.set(5, 13, hair_d); P.set(18, 13, hair_d)
    elif hs == "buns":
        P.rect(6, 6, 17, 11, hair)
        P.rect(4, 2, 6, 4, hair); P.rect(17, 2, 19, 4, hair); P.set(5, 3, hair_l); P.set(18, 3, hair_l)
    elif hs == "topknot":
        P.rect(10, 0, 13, 1, hair); P.rect(11, -1, 12, -1, hair); P.rect(6, 6, 17, 10, hair)
    elif hs == "afro":
        P.rect(4, 0, 19, 7, hair); P.rect(3, 2, 20, 6, hair); P.rect(5, 8, 6, 9, hair); P.rect(17, 8, 18, 9, hair)
    elif hs == "mohawk":
        mc = hexc(p.get("hairTip", hair))
        P.rect(10, -1, 13, 2, mc); P.rect(11, -2, 12, -2, mc); P.rect(6, 6, 17, 9, hair)
    elif hs == "pompadour":
        P.rect(7, -2, 16, 2, hair); P.rect(8, -3, 15, -3, hair); P.set(8, -1, hair_l); P.rect(6, 6, 17, 9, hair)
    elif hs == "spiky":
        for x in (6, 9, 12, 15):
            P.rect(x, -1, x + 1, 1, hair)
        P.set(7, -2, hair); P.set(13, -2, hair); P.rect(6, 6, 17, 9, hair)
    elif hs == "curly":
        P.rect(5, 1, 18, 8, hair); P.set(4, 3, hair); P.set(19, 4, hair); P.set(5, 9, hair); P.set(18, 9, hair)
        for (x, y) in ((6, 2), (10, 1), (14, 2), (17, 4), (5, 6), (18, 7)):
            P.set(x, y, hair_l)
    elif hs == "bald":
        pass
    else:  # short
        P.rect(6, 6, 17, 9, hair)
        P.rect(5, 6, 5, 8, hair); P.rect(18, 6, 18, 8, hair)

    # ---------- 몸
    torso = (9, 13, 14, 18)
    arm_l, arm_r = (7, 13, 7, 17), (16, 13, 16, 17)
    if big:
        torso = (8, 13, 15, 18)
        arm_l, arm_r = (6, 13, 6, 18), (17, 13, 17, 18)
    tx0, ty0, tx1, ty1 = torso
    P.rect(tx0, ty0, tx1, ty1, skin)
    P.rect(tx0 - 1, ty0 + 1, tx0 - 1, ty1 - 1, skin)
    P.rect(tx1 + 1, ty0 + 1, tx1 + 1, ty1 - 1, skin)
    P.rect(*arm_l, skin); P.rect(*arm_r, skin)
    P.set(arm_l[0], arm_l[3] + 1, skin_d); P.set(arm_r[0], arm_r[3] + 1, skin_d)
    legs_drawn = False
    sleeve = p.get("sleeve", "long")
    if outfit in ("shirt", "suit", "armor", "hoodie", "coat", "jumpsuit", "vest", "uniform", "bodysuit", "tunic", "jacket"):
        P.rect(tx0, ty0, tx1, ty1, top)
        P.rect(tx0 - 1, ty0 + 1, tx0 - 1, ty1 - 1, top)
        P.rect(tx1 + 1, ty0 + 1, tx1 + 1, ty1 - 1, top)
        if sleeve == "long":
            P.rect(arm_l[0], arm_l[1], arm_l[2], arm_l[3] - 1, top); P.rect(arm_r[0], arm_r[1], arm_r[2], arm_r[3] - 1, top)
        elif sleeve == "short":
            P.rect(arm_l[0], arm_l[1], arm_l[2], arm_l[1] + 1, top); P.rect(arm_r[0], arm_r[1], arm_r[2], arm_r[1] + 1, top)
        P.set(tx0 + 2, ty0, top_d); P.set(tx1 - 2, ty0, top_d)
        if outfit == "suit":
            P.rect(11, 13, 12, 17, hexc(p.get("shirt", "#ffffff"))); P.vline(11, 14, 16, hexc(p.get("tie", "#2a2230"))); P.set(12, 13, top)
        if outfit == "armor":
            P.hline(tx0, tx1, ty0 + 2, top_l); P.set(tx0 + 1, ty0 + 4, top_d); P.set(tx1 - 1, ty0 + 4, top_d)
            P.rect(tx0 - 1, ty0, tx0 - 1, ty0, top_l); P.rect(tx1 + 1, ty0, tx1 + 1, ty0, top_l)  # 어깨
        if outfit == "hoodie":
            P.rect(tx0, ty0 - 1, tx1, ty0 - 1, top_d); P.set(11, 14, top_d); P.set(12, 14, top_d); P.rect(10, 17, 13, 18, top_d)
        if outfit == "coat":
            P.vline(11, ty0, ty1, top_d); P.set(12, ty0, top_l); P.rect(tx0, 19, tx1, 21, top); P.rect(tx0 - 1, 19, tx0 - 1, 20, top); P.rect(tx1 + 1, 19, tx1 + 1, 20, top)
            P.vline(11, 19, 21, top_d)
            legs_drawn = True
            P.rect(9, 22, 10, 22, hexc("#2a2230")); P.rect(13, 22, 14, 22, hexc("#2a2230"))
        if outfit == "jumpsuit":
            P.vline(11, ty0, ty1, top_d); P.rect(10, 16, 13, 17, shade(top, -0.4))
        if outfit == "vest":
            P.rect(11, 13, 12, 18, hexc(p.get("shirt", "#eae2d0")))
        if outfit == "uniform":
            P.hline(tx0, tx1, ty0, top_l); P.set(11, 15, hexc("#ffd84b")); P.set(12, 16, hexc("#ffd84b"))
        if outfit == "bodysuit":
            P.hline(tx0, tx1, ty1, bot); P.rect(9, 19, 10, 21, top); P.rect(13, 19, 14, 21, top); P.rect(9, 22, 10, 22, top_d); P.rect(13, 22, 14, 22, top_d)
            legs_drawn = True
            if p.get("suitLine"):
                lc = hexc(p["suitLine"]); P.set(11, 14, lc); P.set(12, 14, lc); P.set(11, 17, lc); P.set(12, 17, lc)
        if outfit == "tunic":
            P.rect(tx0, 19, tx1, 19, top); P.hline(tx0, tx1, 18, bot)
        if outfit == "jacket":
            P.rect(11, 13, 12, 18, hexc(p.get("shirt", "#dddddd"))); P.vline(10, 13, 18, top_d); P.vline(13, 13, 18, top_d)
    elif outfit == "robe":
        P.rect(tx0, ty0, tx1, 21, top); P.rect(tx0 - 1, ty0 + 1, tx0 - 1, 21, top); P.rect(tx1 + 1, ty0 + 1, tx1 + 1, 21, top)
        P.rect(arm_l[0], arm_l[1], arm_l[2], arm_l[3], top); P.rect(arm_r[0], arm_r[1], arm_r[2], arm_r[3], top)
        P.set(arm_l[0], arm_l[3] + 1, skin); P.set(arm_r[0], arm_r[3] + 1, skin)
        P.hline(tx0 - 1, tx1 + 1, 22, shade(top, -0.35)); P.vline(11, ty0, 21, top_d); P.set(12, ty0, top_l)
        legs_drawn = True
    elif outfit == "dress":
        P.rect(tx0, ty0, tx1, ty1, top)
        P.rect(tx0 - 1, ty0 + 1, tx0 - 1, ty1 - 1, top); P.rect(tx1 + 1, ty0 + 1, tx1 + 1, ty1 - 1, top)
        if sleeve == "long":
            P.rect(arm_l[0], arm_l[1], arm_l[2], arm_l[3] - 1, top); P.rect(arm_r[0], arm_r[1], arm_r[2], arm_r[3] - 1, top)
        P.rect(tx0 - 1, 19, tx1 + 1, 21, bot); P.rect(tx0 - 2, 21, tx1 + 2, 21, bot); P.hline(tx0 - 2, tx1 + 2, 22, shade(bot, -0.3))
        P.set(11, 14, top_l)
        legs_drawn = True
    elif outfit == "kimono":
        P.rect(tx0, ty0, tx1, 21, top); P.rect(tx0 - 1, ty0 + 1, tx0 - 1, 21, top); P.rect(tx1 + 1, ty0 + 1, tx1 + 1, 21, top)
        P.rect(6, 13, 7, 18, top); P.rect(16, 13, 17, 18, top); P.set(6, 18, top_d); P.set(17, 18, top_d)
        P.set(11, 13, WHITE); P.set(12, 13, WHITE); P.set(11, 14, top_d); P.set(12, 14, top_d)
        P.rect(tx0, 17, tx1, 18, bot); P.set(11, 17, shade(bot, 0.4))
        P.hline(tx0 - 1, tx1 + 1, 22, top_d)
        for (x, y) in p.get("pattern", []):
            P.set(x, y, hexc(p.get("patternColor", top_l)))
        legs_drawn = True
    elif outfit == "apron":
        base = hexc(p.get("under", "#8a6a5a"))
        P.rect(tx0, ty0, tx1, ty1, base); P.rect(tx0 - 1, ty0 + 1, tx0 - 1, ty1 - 1, base); P.rect(tx1 + 1, ty0 + 1, tx1 + 1, ty1 - 1, base)
        if sleeve == "long":
            P.rect(arm_l[0], arm_l[1], arm_l[2], arm_l[3] - 1, base); P.rect(arm_r[0], arm_r[1], arm_r[2], arm_r[3] - 1, base)
        P.rect(10, 14, 13, 21, top); P.hline(10, 13, 14, top_d); P.rect(9, 19, 14, 21, top)
        legs_drawn = True
        P.rect(9, 22, 10, 22, hexc("#2a2230")); P.rect(13, 22, 14, 22, hexc("#2a2230"))
    elif outfit == "shirtless":
        P.hline(tx0, tx1, 16, skin_d)
        P.rect(tx0, 18, tx1, 18, bot)
    elif outfit == "bikini":
        P.rect(9, 14, 14, 15, top); P.set(11, 14, top_d); P.set(12, 14, top_d); P.set(9, 13, top_d); P.set(14, 13, top_d)
        P.rect(9, 18, 14, 19, bot); P.set(11, 19, shade(bot, -0.3)); P.set(12, 19, shade(bot, -0.3))
        if p.get("frill"):
            P.hline(8, 15, 15, shade(top, 0.4) if top != WHITE else hexc("#dfe9ff"))
    elif outfit == "camisole":
        P.rect(9, 13, 14, 18, top); P.set(9, 13, top_d); P.set(14, 13, top_d); P.hline(9, 14, 14, shade(top, 0.3))
        P.rect(8, 18, 15, 20, bot); P.hline(8, 15, 20, shade(bot, -0.2)); P.set(10, 16, shade(top, -0.35)); P.set(13, 15, shade(top, -0.35))
    elif outfit == "yukata":
        yd = top_d; fl = hexc(p.get("patternColor", "#8a5fd6"))
        P.rect(8, 13, 15, 22, top); P.rect(6, 13, 7, 18, top); P.rect(16, 13, 17, 18, top); P.set(6, 18, yd); P.set(17, 18, yd)
        for (x, y) in p.get("pattern", ((9, 14), (13, 15), (10, 20), (14, 21), (7, 16), (16, 15))):
            P.set(x, y, fl)
        P.set(11, 13, WHITE); P.set(12, 13, WHITE); P.set(11, 14, yd); P.set(12, 14, yd)
        P.rect(8, 17, 15, 18, bot); P.set(11, 17, shade(bot, 0.4)); P.set(12, 18, shade(bot, 0.4)); P.rect(8, 22, 15, 22, yd)
        legs_drawn = True
    elif outfit == "overalls":
        base = hexc(p.get("shirt", "#f0e0c0"))
        P.rect(tx0, ty0, tx1, ty1, base); P.rect(tx0 - 1, ty0 + 1, tx0 - 1, ty1 - 1, base); P.rect(tx1 + 1, ty0 + 1, tx1 + 1, ty1 - 1, base)
        if sleeve == "long":
            P.rect(arm_l[0], arm_l[1], arm_l[2], arm_l[3] - 1, base); P.rect(arm_r[0], arm_r[1], arm_r[2], arm_r[3] - 1, base)
        P.rect(tx0, 15, tx1, 18, top); P.vline(10, 13, 14, top); P.vline(13, 13, 14, top); P.rect(11, 16, 12, 17, top_d)
    # 다리
    if not legs_drawn:
        leg = hexc(p.get("legs", bot if outfit not in ("bikini", "camisole", "shirtless") else skin))
        if outfit == "camisole":
            P.rect(9, 21, 10, 21, skin); P.rect(13, 21, 14, 21, skin)
        else:
            P.rect(9, 19, 10, 21, leg); P.rect(13, 19, 14, 21, leg)
            if outfit == "bikini":
                P.rect(9, 20, 10, 21, skin); P.rect(13, 20, 14, 21, skin)
            if outfit == "shirtless" and p.get("shorts"):
                P.rect(9, 19, 10, 19, bot); P.rect(13, 19, 14, 19, bot); P.rect(9, 20, 10, 21, skin); P.rect(13, 20, 14, 21, skin)
        shoe = hexc(p.get("shoes", "#2a2230"))
        P.rect(9, 22, 10, 22, shoe); P.rect(13, 22, 14, 22, shoe)
    if p.get("skirt"):  # 셔츠·재킷류 위에 치마
        sc = hexc(p["skirt"]); P.rect(tx0 - 1, 19, tx1 + 1, 20, sc); P.hline(tx0 - 1, tx1 + 1, 20, shade(sc, -0.2))
        if p.get("plaid"):
            pc = hexc(p["plaid"]); P.set(tx0, 19, pc); P.set(tx0 + 3, 19, pc); P.set(tx1, 19, pc); P.set(tx0 + 1, 20, pc); P.set(tx0 + 4, 20, pc)
        if p.get("skirtFrill"):
            P.hline(tx0 - 1, tx1 + 1, 21, hexc(p["skirtFrill"]))
    if p.get("socks"):
        sc = hexc(p["socks"]); y0 = p.get("socksTop", 21); P.rect(9, y0, 10, 21, sc); P.rect(13, y0, 14, 21, sc)
    if p.get("stripedLegs"):
        a_, b_ = hexc(p["stripedLegs"][0]), hexc(p["stripedLegs"][1])
        for y in range(19, 22):
            c = a_ if y % 2 else b_
            P.rect(9, y, 10, y, c); P.rect(13, y, 14, y, c)
    if p.get("oneSock"):
        P.rect(13, 19, 14, 21, hexc(p["oneSock"]))
    if p.get("wideSleeves"):
        wc = hexc(p["wideSleeves"]); P.rect(4, 14, 6, 19, wc); P.rect(17, 14, 19, 19, wc); P.hline(4, 6, 19, shade(wc, -0.2)); P.hline(17, 19, 19, shade(wc, -0.2)); P.set(7, 13, wc); P.set(16, 13, wc)
        if p.get("sleeveTrim"):
            tc = hexc(p["sleeveTrim"]); P.hline(4, 6, 18, tc); P.hline(17, 19, 18, tc)
    if p.get("apron"):
        ac = hexc(p["apron"]); P.rect(10, 15, 13, 20, ac); P.hline(10, 13, 20, shade(ac, -0.15)); P.set(11, 17, hexc(p.get("apronMark", ac)))
    if p.get("bowTie"):
        bc = hexc(p["bowTie"]); P.set(10, 13, bc); P.set(13, 13, bc); P.set(11, 14, bc); P.set(12, 14, bc)
    if p.get("bigBowChest"):
        bc = hexc(p["bigBowChest"]); P.rect(9, 14, 10, 15, bc); P.rect(13, 14, 14, 15, bc); P.set(11, 14, shade(bc, -0.3)); P.set(12, 15, shade(bc, -0.3))
    if p.get("belt"):
        P.hline(tx0, tx1, 18, hexc(p["belt"])); P.set(11, 18, hexc("#ffd84b"))
    if p.get("sash"):
        P.hline(tx0, tx1, 17, hexc(p["sash"])); P.set(tx1 + 1, 18, hexc(p["sash"]))
    if p.get("jacket"):
        jc = hexc(p["jacket"])
        P.rect(5, 13, 6, 19, jc); P.rect(17, 13, 18, 19, jc); P.set(7, 13, jc); P.set(16, 13, jc); P.set(6, 19, shade(jc, -0.3)); P.set(17, 19, shade(jc, -0.3))
    if p.get("sarong"):
        sc = hexc(p["sarong"]); P.rect(13, 18, 16, 21, sc); P.set(16, 21, shade(sc, -0.2)); P.set(15, 22, sc); P.set(14, 17, hexc("#7ec8ff"))
    if p.get("necklace"):
        P.hline(10, 13, 13, hexc(p["necklace"]))
    if p.get("choker"):
        P.hline(9, 14, 13, hexc(p["choker"] if isinstance(p["choker"], str) else "#2a2230"))
    if p.get("thighband"):
        P.hline(13, 14, 20, hexc(p["thighband"]))
    if p.get("chest"):  # 가슴 장식 (아크 리액터, 별 등)
        P.set(11, 15, hexc(p["chest"])); P.set(12, 15, hexc(p["chest"]))
    if p.get("emblem"):
        P.set(11, 15, hexc(p["emblem"])); P.set(12, 15, hexc(p["emblem"])); P.set(11, 16, hexc(p["emblem"])); P.set(12, 16, hexc(p["emblem"]))
    if p.get("scarf"):
        sc = hexc(p["scarf"]); P.rect(8, 12, 15, 13, sc); P.rect(15, 14, 16, 16, sc); P.set(16, 17, shade(sc, -0.2))
    if p.get("gloves"):
        gc = hexc(p["gloves"]); P.set(arm_l[0], arm_l[3], gc); P.set(arm_r[0], arm_r[3], gc); P.set(arm_l[0], arm_l[3] + 1, gc); P.set(arm_r[0], arm_r[3] + 1, gc)
    if p.get("bigGloves"):
        gc = hexc(p["bigGloves"]); P.rect(5, 16, 7, 19, gc); P.rect(16, 16, 18, 19, gc); P.set(6, 17, shade(gc, 0.3)); P.set(17, 17, shade(gc, 0.3))

    # ---------- 얼굴
    face_kind = p.get("face", "normal")
    if face_kind != "hidden":
        P.rect(7, 4, 16, 12, skin); P.rect(6, 6, 6, 11, skin); P.rect(17, 6, 17, 11, skin)
        P.hline(8, 15, 13, skin_d)
    else:
        P.rect(7, 4, 16, 12, hexc(p.get("faceColor", "#120d1f"))); P.rect(6, 6, 6, 11, hexc(p.get("faceColor", "#120d1f"))); P.rect(17, 6, 17, 11, hexc(p.get("faceColor", "#120d1f")))
    # 앞머리
    if hs != "bald" and not p.get("fullHelmet"):
        P.rect(6, 1, 17, 3, hair); P.rect(7, 0, 16, 0, hair); P.rect(6, 4, 17, 5, hair)
        bangs = p.get("bangs", "straight")
        if bangs == "straight":
            P.hline(7, 16, 6, hair); P.set(7, 7, hair); P.set(16, 7, hair)
        elif bangs == "side":
            P.hline(7, 12, 6, hair); P.rect(7, 7, 9, 7, hair); P.set(16, 6, hair)
        elif bangs == "sideR":
            P.hline(11, 16, 6, hair); P.rect(14, 7, 16, 7, hair); P.set(7, 6, hair)
        elif bangs == "cover":
            P.hline(7, 16, 6, hair); P.rect(7, 7, 10, 9, hair); P.set(16, 7, hair)
        elif bangs == "coverR":
            P.hline(7, 16, 6, hair); P.rect(13, 7, 16, 9, hair); P.set(7, 7, hair)
        elif bangs == "parted":
            P.rect(7, 6, 9, 7, hair); P.rect(14, 6, 16, 7, hair); P.set(10, 6, hair); P.set(13, 6, hair)
        elif bangs == "up":
            P.rect(6, 0, 17, 1, hair); P.rect(7, -1, 16, -1, hair)
        elif bangs == "messy":
            P.hline(7, 16, 6, hair); P.set(8, 7, hair); P.set(11, 7, hair); P.set(15, 7, hair); P.set(6, 0, hair); P.set(18, 1, hair)
        elif bangs == "eyes":
            P.rect(7, 6, 16, 9, hair)
        P.hline(8, 15, 1, hair_l)
        if p.get("streak"):
            st = hexc(p["streak"]); P.set(8, 5, st); P.set(8, 6, st); P.set(14, 2, st)
        if p.get("streak2"):
            st = hexc(p["streak2"]); P.set(15, 5, st); P.set(15, 6, st); P.set(10, 1, st)
        if p.get("rainbow"):
            for i, c in enumerate(("#ff8fa3", "#ffd27a", "#9fe08f", "#8fd0ff", "#c9a0ff")):
                P.set(9 + i, 5, c)
    elif p.get("fullHelmet"):
        hc = hexc(p["fullHelmet"]); hd = shade(hc, -0.25)
        P.rect(6, 1, 17, 12, hc); P.rect(7, 0, 16, 0, hc); P.rect(5, 4, 5, 10, hd); P.rect(18, 4, 18, 10, hd)
        P.hline(7, 16, 1, shade(hc, 0.3))
        vz = hexc(p.get("visor", "#5fd3e0"))
        if p.get("helmetStyle") == "ironman":
            P.rect(7, 4, 16, 11, hexc("#e8c04a")); P.rect(8, 7, 9, 7, vz); P.rect(14, 7, 15, 7, vz); P.hline(10, 13, 10, hd)
        elif p.get("helmetStyle") == "mask":
            P.rect(7, 6, 10, 8, hexc(p.get("eyePatch", "#ffffff"))); P.rect(13, 6, 16, 8, hexc(p.get("eyePatch", "#ffffff"))); P.rect(8, 7, 9, 7, hexc("#111111")); P.rect(14, 7, 15, 7, hexc("#111111"))
            if p.get("maskBand"):
                P.rect(6, 4, 17, 9, hexc(p["maskBand"])); P.rect(7, 6, 10, 8, hexc(p.get("eyePatch", "#ffffff"))); P.rect(13, 6, 16, 8, hexc(p.get("eyePatch", "#ffffff")))
        elif p.get("helmetStyle") == "lens":
            P.rect(8, 6, 15, 9, hexc("#1b1b24")); P.rect(9, 7, 10, 8, vz); P.rect(13, 7, 14, 8, vz)
        elif p.get("helmetStyle") == "diver":
            P.rect(8, 5, 15, 10, hexc("#223b55")); P.rect(9, 6, 14, 9, hexc("#9fd3ff")); P.set(10, 7, WHITE)
        elif p.get("helmetStyle") == "open":
            P.rect(7, 6, 16, 11, skin); P.rect(6, 7, 6, 10, skin); P.rect(17, 7, 17, 10, skin)
        if p.get("antenna"):
            P.set(8, 0, hexc("#c0c0c0")); P.set(7, -1, hexc("#c0c0c0")); P.set(15, 0, hexc("#c0c0c0")); P.set(16, -1, hexc("#c0c0c0"))
        if p.get("helmetEars"):
            ec = hexc(p["helmetEars"]); P.rect(6, -1, 7, 0, ec); P.rect(16, -1, 17, 0, ec)
    # 눈
    eyes = p.get("eyes", "normal")
    show_eyes = face_kind != "hidden" and not (p.get("fullHelmet") and p.get("helmetStyle") != "open")
    if show_eyes:
        for x in (9, 14):
            if eyes == "closed":
                P.set(x - 1, 9, OUTLINE); P.set(x, 8, OUTLINE); P.set(x + 1, 9, OUTLINE)
            elif eyes == "sleepy":
                P.rect(x - 1, 9, x, 9, OUTLINE); P.set(x - 1, 10, eye); P.set(x, 10, shade(eye, -0.35))
            elif eyes == "glasses":
                P.rect(x - 1, 8, x, 8, OUTLINE); P.set(x - 1, 9, shade(eye, 0.6)); P.set(x, 9, eye); P.set(x - 1, 10, eye); P.set(x, 10, shade(eye, -0.35))
            elif eyes == "angry":
                P.set(x - 1, 8, OUTLINE); P.set(x, 8 if x == 9 else 8, OUTLINE); P.set(x, 9, eye); P.set(x - 1, 10, eye); P.set(x - 1, 9, shade(eye, 0.6)); P.set(x, 10, shade(eye, -0.35))
                P.set(x - 1 if x == 9 else x + 1, 7, OUTLINE)
            elif eyes == "dot":
                P.set(x - 1, 9, OUTLINE); P.set(x, 9, OUTLINE)
            elif eyes == "glow":
                gc = eye; P.rect(x - 1, 8, x, 10, gc); P.set(x - 1, 9, shade(gc, 0.5))
            elif eyes == "star":
                P.set(x - 1, 9, eye); P.set(x, 8, eye); P.set(x, 10, eye); P.set(x + 1, 9, eye); P.set(x, 9, WHITE)
            else:
                P.rect(x - 1, 8, x, 8, OUTLINE); P.set(x - 1, 9, shade(eye, 0.6)); P.set(x, 9, eye); P.set(x - 1, 10, eye); P.set(x, 10, shade(eye, -0.35))
        if p.get("eye2"):  # 오드아이
            e2 = hexc(p["eye2"]); P.set(13, 9, shade(e2, 0.6)); P.set(14, 9, e2); P.set(13, 10, e2); P.set(14, 10, shade(e2, -0.35))
        if p.get("wink"):
            P.rect(13, 8, 14, 10, skin); P.set(13, 9, OUTLINE); P.set(14, 8, OUTLINE); P.set(15, 9, OUTLINE)
        if p.get("bangs") == "cover":
            P.rect(8, 8, 10, 10, hair); P.set(10, 10, skin)
        if p.get("bangs") == "coverR":
            P.rect(13, 8, 15, 10, hair); P.set(13, 10, skin)
        if p.get("bangs") == "eyes":
            P.rect(7, 6, 16, 10, hair); P.set(8, 10, hair_d); P.set(12, 10, hair_d); P.set(15, 10, hair_d)
        if eyes == "glasses" or "glasses" in acc:
            gc = hexc(p.get("glassColor", "#e8e8f0"))
            P.hline(7, 10, 8, gc); P.hline(13, 16, 8, gc); P.set(7, 9, gc); P.set(10, 9, gc); P.set(13, 9, gc); P.set(16, 9, gc); P.hline(11, 12, 8, gc)
        if "sunglasses" in acc:
            sg = hexc(p.get("sunglassColor", "#1b1b24")); P.rect(7, 8, 10, 10, sg); P.rect(13, 8, 16, 10, sg); P.hline(11, 12, 8, sg); P.set(8, 9, shade(sg, 0.35)); P.set(14, 9, shade(sg, 0.35))
        if "blindfold" in acc:
            bc = hexc(p.get("blindfoldColor", "#c62828")); P.rect(6, 8, 17, 10, bc); P.hline(7, 16, 9, shade(bc, -0.2))
        if "goggles_eyes" in acc:
            gc = hexc(p.get("goggleColor", "#5fd3e0")); P.rect(7, 8, 10, 10, gc); P.rect(13, 8, 16, 10, gc); P.hline(11, 12, 9, hexc("#444444")); P.set(8, 9, shade(gc, 0.5)); P.set(14, 9, shade(gc, 0.5))
        if "eyepatch" in acc:
            P.rect(13, 8, 15, 10, hexc("#1b1b24")); P.hline(6, 17, 7, hexc("#1b1b24"))
        if "scar" in acc:
            P.set(8, 11, hexc("#d98a97")); P.set(7, 7, hexc("#d98a97"))
        if "scarR" in acc:
            P.set(15, 11, hexc("#d98a97")); P.set(16, 7, hexc("#d98a97"))
        if "freckles" in acc:
            P.set(7, 10, skin_d); P.set(16, 10, skin_d); P.set(11, 11, skin_d)
        if "whiskers" in acc:
            P.set(6, 10, hexc("#6a4a6a")); P.set(17, 10, hexc("#6a4a6a")); P.set(7, 9, hexc("#6a4a6a")); P.set(16, 9, hexc("#6a4a6a"))
        if "mole" in acc:
            P.set(15, 11, OUTLINE)
        if "mask" in acc:  # 복면 (코 아래)
            mc = hexc(p.get("maskColor", "#2a2230")); P.rect(7, 11, 16, 12, mc); P.rect(6, 11, 6, 11, mc); P.rect(17, 11, 17, 11, mc)
        if "cheekpaint" in acc:
            P.set(7, 11, hexc("#2a7fd4")); P.set(16, 11, hexc("#2a7fd4"))
        if "nose" in acc:
            P.rect(11, 10, 12, 11, hexc(p.get("noseColor", "#e23a3a")))
        if "longnose" in acc:
            P.rect(11, 10, 12, 10, skin_d); P.rect(11, 11, 12, 12, skin_d); P.set(11, 13, skin_d)
        # 볼·입
        if face_kind == "normal" and "mask" not in acc:
            if not p.get("noBlush"):
                P.set(7, 11, hexc("#f3a3b1")) if not any(k in acc for k in ("cheekpaint", "freckles")) else None
                P.set(16, 11, hexc("#f3a3b1")) if not any(k in acc for k in ("cheekpaint", "freckles")) else None
            mouth = p.get("mouth", "flat")
            if mouth == "open":
                P.rect(11, 11, 12, 12, hexc("#c84a5f")); P.hline(11, 12, 11, hexc("#fff0f0"))
            elif mouth == "grin":
                P.rect(10, 11, 13, 12, hexc("#c84a5f")); P.hline(10, 13, 11, hexc("#fff0f0"))
            elif mouth == "smile":
                P.hline(11, 12, 12, hexc("#c84a5f"))
            elif mouth == "frown":
                P.hline(11, 12, 12, hexc("#a84a5f")); P.set(10, 11, hexc("#a84a5f")); P.set(13, 11, hexc("#a84a5f"))
            elif mouth == "smirk":
                P.hline(11, 12, 13, hexc("#c84a5f"))
            elif mouth == "none":
                pass
            else:
                P.hline(11, 12, 12, hexc("#d98a97"))
    # 수염
    beard = p.get("beard")
    if beard:
        bc = hexc(p.get("beardColor", hair))
        if beard == "full":
            P.rect(7, 11, 16, 13, bc); P.rect(8, 14, 15, 14, bc); P.set(6, 11, bc); P.set(17, 11, bc); P.hline(11, 12, 12, hexc("#a84a5f"))
        elif beard == "goatee":
            P.rect(11, 12, 12, 13, bc)
        elif beard == "stubble":
            P.set(8, 12, shade(skin, -0.2)); P.set(10, 12, shade(skin, -0.2)); P.set(13, 12, shade(skin, -0.2)); P.set(15, 12, shade(skin, -0.2))
        elif beard == "long":
            P.rect(7, 11, 16, 13, bc); P.rect(8, 14, 15, 17, bc); P.rect(9, 18, 14, 19, bc); P.hline(11, 12, 12, hexc("#a84a5f"))
        elif beard == "mustache":
            P.hline(9, 14, 11, bc)
        elif beard == "sideburns":
            P.rect(6, 7, 6, 11, bc); P.rect(17, 7, 17, 11, bc)
    # 귀
    ears = p.get("ears")
    if ears == "cat":
        ec = hexc(p.get("earColor", hair)); P.rect(6, 0, 8, 1, ec); P.set(7, -1, ec); P.rect(15, 0, 17, 1, ec); P.set(16, -1, ec); P.set(7, 1, hexc("#f7b7c6")); P.set(16, 1, hexc("#f7b7c6"))
    elif ears == "fox":
        ec = hexc(p.get("earColor", hair)); P.rect(5, -1, 7, 1, ec); P.set(6, -2, ec); P.rect(16, -1, 18, 1, ec); P.set(17, -2, ec); P.set(6, 0, WHITE); P.set(17, 0, WHITE)
    elif ears == "tiger":
        ec = hexc(p.get("earColor", "#c9c9d0")); P.rect(6, -1, 8, 1, shade(ec, -0.25)); P.rect(15, -1, 17, 1, shade(ec, -0.25)); P.set(7, 1, hexc("#f7b7c6")); P.set(16, 1, hexc("#f7b7c6")); P.set(6, -1, hexc("#2a2230")); P.set(17, -1, hexc("#2a2230"))
    elif ears == "pointy":
        P.set(5, 7, skin); P.set(4, 6, skin); P.set(18, 7, skin); P.set(19, 6, skin)
    elif ears == "round":
        ec = hexc(p.get("earColor", hair)); P.rect(5, 1, 6, 2, ec); P.rect(17, 1, 18, 2, ec)
    # 뿔
    horns = p.get("horns")
    if horns == "demon":
        hc, ht = hexc(p.get("hornColor", "#4a4452")), hexc("#9a93a6"); P.set(6, 2, hc); P.set(5, 1, hc); P.set(5, 0, ht); P.set(17, 2, hc); P.set(18, 1, hc); P.set(18, 0, ht)
    elif horns == "unicorn":
        P.rect(11, 0, 12, 1, hexc("#e8dcff")); P.set(12, -1, hexc("#c9b6ff")); P.set(11, 1, hexc("#c9b6ff"))
    elif horns == "small":
        P.set(8, 0, hexc(p.get("hornColor", "#ffd84b"))); P.set(15, 0, hexc(p.get("hornColor", "#ffd84b")))

    # ---------- 머리 장식 · 모자
    hat = p.get("hat")
    hc = hexc(p.get("hatColor", "#2a2230")); hd = shade(hc, -0.25); hl = shade(hc, 0.25)
    if hat == "helmet":
        P.rect(6, 0, 17, 4, hc); P.rect(7, -1, 16, -1, hc); P.hline(7, 0, 16, hl) if False else P.hline(7, 16, 0, hl); P.rect(5, 2, 5, 6, hc); P.rect(18, 2, 18, 6, hc)
        if p.get("plume"):
            P.rect(11, -3, 12, -1, hexc(p["plume"]))
    elif hat == "cap":
        P.rect(6, 0, 17, 3, hc); P.rect(7, -1, 16, -1, hc); P.hline(5, 18, 4, hd)
    elif hat == "capback":
        P.rect(6, 0, 17, 3, hc); P.rect(7, -1, 16, -1, hc); P.rect(18, 2, 20, 3, hd)
    elif hat == "beret":
        P.rect(6, 0, 17, 2, hc); P.rect(5, 1, 18, 2, hc); P.rect(7, -1, 15, -1, hc); P.set(16, -1, hl); P.set(12, -2, hd)
    elif hat == "tophat":
        P.rect(7, -5, 16, 1, hc); P.rect(5, 1, 18, 2, hc); P.hline(7, 16, 0, hexc(p.get("hatBand", "#8a2a2a")))
    elif hat == "strawhat":
        sc = hexc("#e8c86a"); P.rect(7, -2, 16, 1, sc); P.rect(3, 2, 20, 3, sc); P.hline(7, 16, 1, hexc("#c62828")); P.hline(4, 19, 3, shade(sc, -0.2))
    elif hat == "cowboy":
        P.rect(7, -3, 16, 1, hc); P.rect(4, 2, 19, 3, hc); P.set(4, 1, hc); P.set(19, 1, hc); P.hline(7, 16, 1, hexc(p.get("hatBand", "#ff5fd2")))
    elif hat == "widehat":
        P.rect(7, -2, 16, 1, hc); P.rect(2, 2, 21, 3, hc); P.hline(7, 16, 1, hd)
    elif hat == "feathered":
        P.rect(6, 0, 17, 2, hc); P.rect(4, 2, 19, 3, hc); P.rect(17, -3, 18, -1, hexc(p.get("plume", "#e24b4b"))); P.set(19, -4, hexc(p.get("plume", "#e24b4b")))
    elif hat == "hood":
        P.rect(5, 0, 18, 6, hc); P.rect(6, -1, 17, -1, hc); P.rect(4, 3, 4, 12, hc); P.rect(19, 3, 19, 12, hc); P.rect(5, 7, 5, 12, hc); P.rect(18, 7, 18, 12, hc)
        P.hline(6, 17, 6, hd) if p.get("hoodShadow") else None
    elif hat == "crown":
        cc = hexc(p.get("hatColor", "#ffd84b")); P.hline(7, 16, 1, cc); P.set(7, 0, cc); P.set(10, 0, cc); P.set(13, 0, cc); P.set(16, 0, cc); P.set(11, -1, cc); P.set(12, -1, cc)
        P.set(11, 1, hexc(p.get("gem", "#ff5fd2"))) if p.get("gem") else None
    elif hat == "tiara":
        cc = hexc(p.get("hatColor", "#e23a3a")); P.hline(8, 15, 2, cc); P.set(10, 1, cc); P.set(13, 1, cc); P.set(11, 0, cc); P.set(12, 0, cc)
    elif hat == "bandana":
        P.rect(6, 1, 17, 3, hc); P.rect(7, 0, 16, 0, hc); P.rect(18, 2, 20, 4, hc); P.set(19, 5, hc)
    elif hat == "headband":
        P.hline(6, 17, 3, hc)
    elif hat == "goggles":
        gc = hexc(p.get("goggleColor", "#5fd3e0")); P.hline(6, 17, 2, hexc("#4a3a2a")); P.rect(8, 1, 10, 2, gc); P.rect(13, 1, 15, 2, gc); P.set(9, 1, shade(gc, 0.4))
    elif hat == "sunglasses_head":
        P.hline(7, 16, 2, hexc(p.get("hatColor", "#ffffff"))); P.rect(8, 3, 10, 3, hexc("#6ea8ff")); P.rect(13, 3, 15, 3, hexc("#6ea8ff"))
    elif hat == "headscarf":
        P.rect(5, 0, 18, 5, hc); P.rect(6, -1, 17, -1, hc); P.rect(4, 3, 4, 14, hc); P.rect(19, 3, 19, 14, hc); P.rect(5, 6, 5, 13, hc); P.rect(18, 6, 18, 13, hc)
    elif hat == "veil":
        vc = hexc(p.get("hatColor", "#ffffff")); P.rect(5, 1, 18, 2, vc); P.rect(4, 3, 4, 16, vc); P.rect(19, 3, 19, 16, vc); P.set(5, 3, vc); P.set(18, 3, vc)
    elif hat == "flowercrown":
        for i, x in enumerate(range(6, 18, 2)):
            P.set(x, 2, hexc(("#ff8fa3", "#ffd27a", "#ffffff")[i % 3])); P.set(x + 1, 2, hexc("#6fcf7a"))
    elif hat == "halo":
        P.hline(8, 15, -1, hexc("#ffe08a")); P.set(9, 0, hexc("#ffd84b")); P.set(14, 0, hexc("#ffd84b"))
    elif hat == "maid":
        P.hline(7, 16, 1, WHITE); P.set(7, 0, WHITE); P.set(10, 0, WHITE); P.set(13, 0, WHITE); P.set(16, 0, WHITE)
    elif hat == "peakedcap":
        P.rect(6, -1, 17, 2, hc); P.rect(7, -2, 16, -2, hc); P.hline(6, 17, 3, hd); P.set(11, 0, hexc("#ffd84b")); P.set(12, 0, hexc("#ffd84b"))
    elif hat == "visor":
        P.hline(6, 17, 3, hexc("#ff7fc0")); P.hline(7, 16, 4, hexc("#ffb3dd")); P.set(6, 4, WHITE); P.set(17, 4, WHITE)
    elif hat == "sleepmask":
        mc = hexc("#c9b6ee"); P.rect(7, 1, 16, 3, mc); P.set(6, 0, mc); P.set(7, 0, mc); P.set(16, 0, mc); P.set(17, 0, mc); P.set(10, 2, hexc("#6b5a8e")); P.set(13, 2, hexc("#6b5a8e"))
    elif hat == "furhat":
        P.rect(6, -1, 17, 3, hc); P.rect(7, -2, 16, -2, hc); P.set(8, 0, hexc("#5a4a3a")); P.set(12, -1, hexc("#5a4a3a")); P.set(15, 1, hexc("#5a4a3a")); P.set(10, 2, hexc("#5a4a3a"))
    elif hat == "pilot":
        P.rect(6, 0, 17, 4, hc); P.rect(7, -1, 16, -1, hc); P.rect(5, 2, 5, 9, hc); P.rect(18, 2, 18, 9, hc); P.hline(7, 16, 1, hexc("#5fd3e0"))
    elif hat == "jelly":
        jc = hexc(p.get("hatColor", "#9fe0ff")); P.rect(5, -3, 18, 2, jc); P.rect(6, -4, 17, -4, jc); P.set(7, -2, shade(jc, 0.4)); P.set(5, 3, jc); P.set(9, 3, jc); P.set(14, 3, jc); P.set(18, 3, jc)
    elif hat == "headphones":
        P.hline(6, 17, 0, hc); P.rect(4, 4, 5, 8, hc); P.rect(18, 4, 19, 8, hc); P.set(5, 6, hl); P.set(18, 6, hl)
    elif hat == "headset":
        P.hline(6, 17, 0, hc); P.rect(18, 4, 19, 7, hc); P.rect(17, 11, 18, 11, hc)
    elif hat == "headlamp":
        P.hline(6, 17, 1, hexc("#4a4a4a")); P.rect(11, 0, 12, 2, hexc("#ffe08a")); P.set(11, 1, WHITE)
    elif hat == "catcap":
        P.rect(6, 0, 17, 3, hc); P.rect(7, -1, 16, -1, hc); P.hline(5, 18, 4, hd); P.rect(6, -2, 7, -1, hc); P.rect(16, -2, 17, -1, hc)
    elif hat == "ribbonbow":
        bc = hexc(p.get("hatColor", "#e23a3a")); P.rect(14, -1, 16, 1, bc); P.rect(18, -1, 20, 1, bc); P.set(17, 0, shade(bc, -0.3))
    elif hat == "origamicrown":
        cc = hexc("#f2e9d0"); P.hline(7, 16, 1, cc); P.set(8, 0, cc); P.set(12, 0, cc); P.set(15, 0, cc); P.set(12, -1, cc)

    if ears == "cat" and hat:
        ec = hexc(p.get("earColor", hair)); P.rect(6, -1, 8, 0, ec); P.set(7, -2, ec); P.rect(15, -1, 17, 0, ec); P.set(16, -2, ec); P.set(7, 0, hexc("#f7b7c6")); P.set(16, 0, hexc("#f7b7c6"))
    # 작은 장식
    if "hibiscus" in acc:
        fc = hexc(p.get("flower", "#ff3366")); P.rect(4, 2, 6, 4, fc); P.set(5, 3, hexc("#ffd84b")); P.set(4, 2, shade(fc, 0.3))
    if "hibiscus_r" in acc:
        fc = hexc(p.get("flower", "#ff3366")); P.rect(17, 2, 19, 4, fc); P.set(18, 3, hexc("#ffd84b"))
    if "flower_pink" in acc:
        P.rect(17, 3, 19, 5, hexc("#ff5fa8")); P.set(18, 4, hexc("#ffd84b"))
    if "whiteflower" in acc:
        P.rect(16, 1, 18, 3, WHITE); P.set(17, 2, hexc("#ffd84b"))
    if "blackflower" in acc:
        P.rect(4, 1, 5, 2, hexc("#2b2232")); P.set(18, 1, hexc("#2b2232")); P.set(19, 2, hexc("#2b2232"))
    if "sunglasses_head_pink" in acc:
        P.hline(7, 16, 3, hexc("#ff8fd0")); P.rect(8, 4, 10, 4, hexc("#2a2230")); P.rect(13, 4, 15, 4, hexc("#2a2230"))
    if "catgoggle" in acc:
        P.rect(6, -1, 7, 0, hexc("#f4f4ff")); P.rect(16, -1, 17, 0, hexc("#f4f4ff"))
    if "tiebar" in acc:
        P.set(11, 15, hexc("#dfe6ee"))
    if "toaclips" in acc:
        P.rect(5, 3, 6, 4, hexc("#e9c6ff")); P.set(5, 3, hexc("#ff8fd0")); P.set(8, 3, hexc("#ff8fd0")); P.set(8, 4, hexc("#ff8fd0"))
    if "xclip" in acc:
        P.set(7, 3, hexc(p.get("clipColor", "#ffd84b"))); P.set(8, 4, hexc(p.get("clipColor", "#ffd84b"))); P.set(8, 3, hexc(p.get("clipColor", "#ffd84b")))
    if "heartclip" in acc:
        P.set(15, 3, hexc("#ffd84b")); P.set(16, 3, hexc("#ffd84b")); P.set(15, 4, hexc("#ffd84b"))
    if "ribbon" in acc:
        rc = hexc(p.get("ribbonColor", "#5a8aff")); P.rect(3, 6, 4, 7, rc); P.rect(19, 6, 20, 7, rc)
    if "bigbow" in acc:
        bc = hexc(p.get("ribbonColor", "#e23a3a")); P.rect(15, -1, 17, 1, bc); P.rect(19, -1, 21, 1, bc); P.set(18, 0, shade(bc, -0.3)); P.set(18, 1, shade(bc, -0.3))
    if "starclip" in acc:
        P.set(16, 2, hexc("#ffd84b")); P.set(15, 3, hexc("#ffd84b")); P.set(17, 3, hexc("#ffd84b")); P.set(16, 4, hexc("#ffd84b")); P.set(16, 3, WHITE)
    if "bell" in acc:
        P.set(17, 3, hexc("#ffd84b")); P.set(18, 4, hexc("#ffd84b")); P.set(17, 4, hexc("#ffd84b")); P.set(18, 3, hexc("#ffd84b"))
    if "pompom" in acc:
        P.rect(16, 1, 17, 2, hexc("#ff8fd0")); P.rect(5, 1, 6, 2, hexc("#ff8fd0"))
    if "batclip" in acc:
        P.set(6, 3, hexc("#2b2232")); P.set(8, 3, hexc("#2b2232")); P.set(7, 4, hexc("#2b2232"))
    if "ahoge" in acc:
        P.set(12, -1, hair); P.set(13, -2, hair); P.set(11, -1, hair)
    if "earrings" in acc:
        ec = hexc(p.get("earringColor", "#ffd84b")); P.set(5, 11, ec); P.set(18, 11, ec)
    if "cloudclip" in acc:
        P.rect(5, 2, 7, 3, WHITE); P.set(8, 3, WHITE)
    if "snow" in acc:
        P.set(8, 0, WHITE); P.set(13, -1, WHITE); P.set(16, 0, WHITE)
    if "goggles_fore" in acc:
        gc = hexc(p.get("goggleColor", "#5fd3e0")); P.hline(6, 17, 3, hexc("#4a3a2a")); P.rect(8, 2, 10, 3, gc); P.rect(13, 2, 15, 3, gc)
    if "crack" in acc:
        P.set(14, 2, hexc("#ff5fd2")); P.set(15, 3, hexc("#ff5fd2")); P.set(15, 4, hexc("#ff5fd2"))

    # ---------- 앞 소품
    for pr in p.get("props", []):
        draw_prop(P, pr, skin, back=False)
    return P


def draw_prop(P, pr, skin, back=False):
    kind = pr if isinstance(pr, str) else pr[0]
    col = hexc(pr[1]) if not isinstance(pr, str) and len(pr) > 1 else None
    if kind == "sword":
        c = col or hexc("#dfe6ee"); P.vline(20, 9, 19, c); P.set(20, 8, shade(c, 0.4)); P.hline(19, 21, 19, hexc("#ffd84b")); P.rect(20, 20, 20, 21, hexc("#5a3a2a"))
    elif kind == "greatsword":
        c = col or hexc("#dfe6ee"); P.rect(20, 3, 21, 18, c); P.set(20, 2, shade(c, 0.4)); P.set(21, 2, shade(c, 0.4)); P.hline(19, 22, 19, hexc("#ffd84b")); P.rect(20, 20, 21, 22, hexc("#5a3a2a"))
    elif kind == "katana":
        c = col or hexc("#dfe6ee"); P.vline(20, 7, 17, c); P.set(20, 6, shade(c, 0.4)); P.hline(19, 21, 18, hexc("#3a3a4a")); P.rect(20, 19, 20, 21, hexc("#2a2230"))
    elif kind == "katana3":
        for i, x in enumerate((19, 21, 23)):
            P.vline(x, 10 + i, 19, hexc("#dfe6ee")); P.rect(x, 20, x, 21, hexc("#2a2230"))
    elif kind == "staff":
        c = col or hexc("#8a5a2a"); P.vline(3, 4, 21, c); P.rect(2, 2, 4, 4, hexc(pr[2]) if not isinstance(pr, str) and len(pr) > 2 else hexc("#ff5fd2")); P.set(3, 3, WHITE)
    elif kind == "spear":
        P.vline(3, 2, 21, hexc("#8a5a2a")); P.rect(3, -1, 3, 1, hexc("#dfe6ee")); P.set(2, 0, hexc("#dfe6ee")); P.set(4, 0, hexc("#dfe6ee"))
    elif kind == "shield":
        c = col or hexc("#6a6a8a"); P.rect(1, 12, 5, 18, c); P.rect(2, 19, 4, 19, c); P.set(3, 20, c); P.rect(2, 13, 4, 17, shade(c, 0.25)); P.set(3, 15, hexc(pr[2]) if not isinstance(pr, str) and len(pr) > 2 else shade(c, -0.3))
    elif kind == "roundshield":
        P.rect(1, 12, 6, 17, hexc("#c62828")); P.rect(2, 13, 5, 16, WHITE); P.rect(3, 14, 4, 15, hexc("#2a63d8")); P.set(3, 14, WHITE)
    elif kind == "bow":
        c = col or hexc("#8a5a2a"); P.vline(2, 7, 19, c); P.set(3, 6, c); P.set(3, 20, c); P.vline(4, 7, 19, hexc("#eeeeee"))
    elif kind == "hammer":
        P.vline(20, 10, 21, hexc("#8a5a2a")); P.rect(18, 7, 22, 10, col or hexc("#7a7a8a")); P.hline(18, 22, 7, shade(col or hexc("#7a7a8a"), 0.3))
    elif kind == "mjolnir":
        P.vline(20, 12, 20, hexc("#5a3a2a")); P.rect(18, 8, 22, 12, hexc("#aeb6c2")); P.hline(18, 22, 8, hexc("#dfe6ee")); P.set(23, 10, hexc("#9fe0ff")); P.set(17, 9, hexc("#9fe0ff"))
    elif kind == "axe":
        P.vline(20, 6, 21, hexc("#5a3a2a")); P.rect(17, 5, 19, 10, hexc("#8a8a9a")); P.set(16, 7, hexc("#8a8a9a")); P.rect(21, 5, 23, 10, hexc("#8a8a9a")); P.set(17, 6, hexc("#dfe6ee"))
    elif kind == "lance":
        P.vline(21, 1, 21, hexc("#8a7a6a")); P.rect(21, -1, 21, 0, hexc("#dfe6ee")); P.rect(20, 6, 22, 7, hexc("#5a4a3a"))
    elif kind == "rifle":
        c = col or hexc("#3a3a4a"); P.rect(18, 9, 20, 10, c); P.vline(19, 3, 9, c); P.set(19, 2, shade(c, 0.4)); P.set(21, 11, hexc("#5a3a2a"))
    elif kind == "sniper":
        P.vline(20, -1, 16, hexc("#3a3a6a")); P.rect(19, 5, 21, 7, hexc("#5a3a2a")); P.set(21, 3, hexc("#5fd3e0"))
    elif kind == "bigrifle":
        P.rect(17, 11, 23, 13, col or hexc("#4a4a5a")); P.rect(21, 9, 23, 10, hexc("#6a6a7a")); P.set(23, 12, hexc("#ff8a3a"))
    elif kind == "watergun":
        P.rect(18, 11, 22, 13, hexc("#6fd36f")); P.rect(21, 9, 23, 10, hexc("#ff8a3a")); P.set(18, 13, hexc("#ff8a3a"))
    elif kind == "lantern":
        c = col or hexc("#ffe08a"); P.vline(21, 10, 12, hexc("#4a4a4a")); P.rect(20, 13, 22, 16, hexc("#4a4a4a")); P.rect(21, 14, 21, 15, c); P.set(21, 14, WHITE)
    elif kind == "book":
        c = col or hexc("#8a5a2a"); P.rect(18, 15, 22, 18, c); P.rect(19, 16, 21, 17, hexc("#f2e9d0")); P.set(20, 16, shade(c, -0.3))
    elif kind == "openbook":
        P.rect(8, 15, 15, 18, hexc("#f2e9d0")); P.vline(11, 15, 18, hexc("#c9bfa6")); P.hline(9, 10, 16, hexc("#8a8a8a")); P.hline(13, 14, 16, hexc("#8a8a8a"))
    elif kind == "mic":
        P.vline(20, 14, 18, hexc("#4a4a4a")); P.rect(19, 11, 21, 13, col or hexc("#dfe6ee")); P.set(20, 12, shade(col or hexc("#dfe6ee"), -0.3))
    elif kind == "holomic":
        P.vline(20, 14, 18, hexc("#5fd3e0")); P.rect(19, 11, 21, 13, hexc("#9fe0ff")); P.set(20, 12, WHITE)
    elif kind == "lute":
        P.rect(18, 12, 21, 16, hexc("#b07a3a")); P.vline(19, 6, 11, hexc("#5a3a2a")); P.rect(19, 13, 20, 14, hexc("#3a2a1a")); P.set(19, 12, hexc("#f2e9d0"))
    elif kind == "violin":
        P.rect(18, 12, 20, 16, hexc("#9a4a2a")); P.vline(19, 7, 11, hexc("#5a3a2a")); P.set(19, 14, hexc("#3a2a1a"))
    elif kind == "cane":
        P.vline(20, 12, 21, col or hexc("#2a2230")); P.set(21, 11, hexc("#ffd84b")); P.set(20, 11, hexc("#ffd84b"))
    elif kind == "canesword":
        P.vline(20, 10, 21, hexc("#2a2230")); P.set(20, 9, hexc("#ffd84b"))
    elif kind == "umbrella":
        c = col or hexc("#ff8fa3"); P.rect(16, 4, 23, 5, c); P.rect(17, 3, 22, 3, c); P.hline(16, 23, 6, shade(c, -0.2)); P.vline(20, 7, 16, hexc("#8a5a2a"))
    elif kind == "parasol":
        c = col or hexc("#ff8fa3"); P.rect(1, 4, 8, 5, c); P.rect(2, 3, 7, 3, c); P.vline(4, 6, 16, hexc("#8a5a2a"))
    elif kind == "crate":
        P.rect(17, 14, 22, 19, hexc("#b07a3a")); P.hline(17, 22, 16, hexc("#8a5a2a")); P.vline(19, 14, 19, hexc("#8a5a2a"))
    elif kind == "box":
        c = col or hexc("#ff5fd2"); P.rect(18, 10, 23, 15, c); P.hline(18, 23, 12, shade(c, -0.3))
    elif kind == "pan":
        P.rect(18, 13, 22, 15, hexc("#4a4a5a")); P.vline(23, 12, 13, hexc("#2a2230")); P.set(20, 14, hexc("#ffd84b"))
    elif kind == "pot":
        P.rect(17, 14, 22, 19, hexc("#6a6a7a")); P.hline(17, 22, 14, hexc("#9a9aaa")); P.set(18, 12, hexc("#e0e0e0")); P.set(21, 11, hexc("#e0e0e0"))
    elif kind == "ladle":
        P.vline(20, 9, 15, hexc("#9a9aaa")); P.rect(19, 16, 21, 17, hexc("#9a9aaa"))
    elif kind == "wrench":
        P.vline(20, 10, 17, hexc("#9aa0aa")); P.rect(19, 8, 21, 9, hexc("#9aa0aa")); P.set(20, 9, hexc("#2a2230"))
    elif kind == "laptop":
        P.rect(17, 14, 22, 18, hexc("#3a3a4a")); P.rect(18, 15, 21, 17, hexc("#5fd3e0")); P.set(19, 16, WHITE)
    elif kind == "lollipop":
        P.vline(17, 11, 13, WHITE); P.rect(16, 9, 18, 10, col or hexc("#ff5fd2")); P.set(17, 9, WHITE)
    elif kind == "teapot":
        P.rect(18, 14, 22, 18, hexc("#e0e0f0")); P.set(17, 15, hexc("#e0e0f0")); P.set(23, 15, hexc("#e0e0f0")); P.set(20, 13, hexc("#e0e0f0")); P.set(19, 11, hexc("#f0f0f0")); P.set(21, 10, hexc("#f0f0f0"))
    elif kind == "brush":
        P.vline(20, 6, 18, hexc("#5a3a2a")); P.rect(19, 3, 21, 5, hexc("#2a2230"))
    elif kind == "chisel":
        P.vline(20, 12, 18, hexc("#8a5a2a")); P.rect(20, 10, 20, 11, hexc("#dfe6ee"))
    elif kind == "quill":
        P.vline(20, 10, 16, hexc("#f2e9d0")); P.set(21, 9, hexc("#f2e9d0")); P.set(20, 17, hexc("#2a2230"))
    elif kind == "watch":
        P.rect(2, 13, 4, 15, hexc("#ffd84b")); P.set(3, 14, WHITE); P.vline(3, 11, 12, hexc("#ffd84b"))
    elif kind == "key":
        P.rect(18, 4, 21, 7, hexc("#d9a93a")); P.rect(19, 5, 20, 6, None) if False else None; P.vline(19, 8, 16, hexc("#d9a93a")); P.set(20, 14, hexc("#d9a93a")); P.set(20, 16, hexc("#d9a93a"))
    elif kind == "bucket":
        P.rect(18, 15, 22, 19, hexc("#5fd3e0")); P.hline(18, 22, 15, hexc("#9fe0ff")); P.set(20, 14, hexc("#eeeeee"))
    elif kind == "canister":
        P.rect(18, 13, 22, 19, hexc("#c62828")); P.rect(19, 15, 21, 17, hexc("#ffe08a")); P.set(20, 12, hexc("#9a9aaa"))
    elif kind == "conch":
        P.rect(17, 11, 22, 15, hexc("#ffd1b3")); P.set(23, 12, hexc("#ffd1b3")); P.set(23, 11, hexc("#ffd1b3")); P.rect(18, 12, 19, 13, hexc("#ff8fa3"))
    elif kind == "net":
        P.vline(20, 6, 18, hexc("#8a5a2a")); P.rect(17, 2, 23, 6, hexc("#5fd3e0")); P.set(18, 4, hexc("#ffd84b")); P.set(21, 3, hexc("#ff5fd2")); P.set(20, 5, hexc("#ffe08a"))
    elif kind == "fish":
        P.rect(1, 6, 4, 8, hexc("#5fd3e0")); P.set(5, 7, hexc("#5fd3e0")); P.set(2, 7, WHITE); P.set(2, 4, hexc("#ffe08a")); P.set(19, 10, hexc("#ffe08a")); P.rect(20, 11, 22, 12, hexc("#5fd3e0"))
    elif kind == "crook":
        P.vline(3, 4, 21, hexc("#8a5a2a")); P.set(4, 3, hexc("#8a5a2a")); P.set(5, 4, hexc("#8a5a2a"))
    elif kind == "sheep":
        P.rect(18, 15, 23, 19, hexc("#f4f4ff")); P.rect(17, 16, 17, 18, hexc("#f4f4ff")); P.rect(21, 14, 23, 16, hexc("#2a2230")); P.set(22, 15, WHITE); P.set(19, 20, hexc("#2a2230")); P.set(22, 20, hexc("#2a2230"))
    elif kind == "bird":
        P.rect(1, 6, 5, 9, col or hexc("#8a6a4a")); P.set(6, 7, hexc("#ffd84b")); P.set(4, 7, hexc("#2a2230")); P.rect(0, 10, 4, 11, shade(col or hexc("#8a6a4a"), -0.25)); P.set(5, 10, hexc("#2a2230"))
    elif kind == "shears":
        P.rect(19, 12, 20, 15, hexc("#dfe6ee")); P.set(19, 16, hexc("#c62828")); P.set(20, 16, hexc("#c62828")); P.set(18, 11, hexc("#dfe6ee")); P.set(21, 11, hexc("#dfe6ee"))
    elif kind == "wateringcan":
        P.rect(1, 14, 5, 18, hexc("#6fcf7a")); P.hline(5, 7, 14, hexc("#6fcf7a")); P.set(7, 13, hexc("#6fcf7a"))
    elif kind == "blowpipe":
        P.vline(20, 5, 17, hexc("#8a8a9a")); P.rect(19, 3, 21, 5, hexc("#ff8a3a")); P.set(20, 4, hexc("#ffe08a"))
    elif kind == "compass":
        P.rect(18, 14, 21, 17, hexc("#d9a93a")); P.rect(19, 15, 20, 16, WHITE); P.set(19, 15, hexc("#c62828"))
    elif kind == "wheel":
        c = hexc("#8a5a2a"); P.rect(1, 12, 5, 16, c); P.rect(2, 13, 4, 15, None) if False else None; P.set(3, 14, hexc("#ffd84b")); P.set(0, 14, c); P.set(6, 14, c); P.set(3, 11, c); P.set(3, 17, c)
    elif kind == "mirror":
        P.rect(18, 9, 22, 14, hexc("#d9a93a")); P.rect(19, 10, 21, 13, hexc("#bfe6ff")); P.set(19, 10, WHITE); P.vline(20, 15, 18, hexc("#d9a93a"))
    elif kind == "mirrorblade":
        P.vline(20, 7, 18, hexc("#bfe6ff")); P.set(20, 6, WHITE); P.set(20, 12, hexc("#ff8fa3")); P.hline(19, 21, 19, hexc("#d9a93a")); P.rect(20, 20, 20, 21, hexc("#2a2230"))
    elif kind == "props":
        P.rect(17, 8, 22, 12, hexc("#c62828")); P.rect(18, 13, 23, 16, hexc("#5fd3e0")); P.rect(16, 5, 20, 7, hexc("#ffd84b"))
    elif kind == "crane":
        P.rect(17, 6, 20, 8, hexc("#f2e9d0")); P.set(21, 7, hexc("#ff8a3a")); P.set(19, 5, hexc("#f2e9d0")); P.set(16, 9, hexc("#f2e9d0"))
    elif kind == "spotlight":
        P.rect(17, 9, 22, 13, hexc("#4a4a5a")); P.rect(18, 10, 21, 12, hexc("#ffe08a")); P.set(19, 11, WHITE)
    elif kind == "scroll":
        P.rect(17, 14, 23, 17, hexc("#f2e9d0")); P.vline(17, 13, 18, hexc("#c9bfa6")); P.vline(23, 13, 18, hexc("#c9bfa6")); P.hline(19, 21, 15, hexc("#8a8a8a"))
    elif kind == "puppet":
        P.vline(20, 5, 9, hexc("#dddddd")); P.rect(19, 10, 21, 12, hexc("#f2e9d0")); P.rect(19, 13, 21, 15, hexc("#ff8fa3")); P.set(20, 11, OUTLINE)
    elif kind == "orb":
        c = col or hexc("#5fd3e0"); P.rect(19, 10, 21, 12, c); P.set(19, 10, WHITE); P.set(22, 11, shade(c, 0.3)); P.set(20, 13, shade(c, 0.3))
    elif kind == "flame":
        c = col or hexc("#ff8a3a"); P.rect(19, 9, 21, 12, c); P.set(20, 8, c); P.set(19, 7, shade(c, 0.3)); P.set(21, 8, shade(c, 0.3)); P.set(20, 10, hexc("#ffe08a"))
    elif kind == "magic":
        c = col or hexc("#ff5fd2"); P.set(2, 9, c); P.set(3, 11, c); P.set(1, 12, c); P.set(21, 9, c); P.set(22, 11, c); P.set(20, 12, c); P.set(3, 8, shade(c, 0.4)); P.set(21, 13, shade(c, 0.4))
    elif kind == "lightning":
        c = hexc("#9fe0ff"); P.set(2, 4, c); P.set(3, 5, c); P.set(2, 6, c); P.set(3, 7, c); P.set(1, 8, c)
    elif kind == "claws":
        c = hexc("#dfe6ee");
        for x in (4, 5, 6):
            P.vline(x, 14, 18, c)
        for x in (17, 18, 19):
            P.vline(x, 14, 18, c)
    elif kind == "gauntlets":
        c = col or hexc("#ff8fb0"); P.rect(3, 14, 7, 20, c); P.rect(16, 14, 20, 20, c); P.set(5, 16, hexc("#5fd3e0")); P.set(18, 16, hexc("#5fd3e0")); P.hline(3, 7, 20, shade(c, -0.3)); P.hline(16, 20, 20, shade(c, -0.3))
    elif kind == "bighands":
        c = col or hexc("#d9a93a"); P.rect(2, 13, 6, 19, c); P.rect(17, 13, 21, 19, c); P.hline(2, 6, 16, shade(c, -0.3)); P.hline(17, 21, 16, shade(c, -0.3))
    elif kind == "metalarms":
        c = hexc("#6fa8dc"); P.rect(3, 13, 7, 19, c); P.rect(16, 13, 20, 19, c); P.set(4, 15, hexc("#2a63d8")); P.set(18, 15, hexc("#2a63d8")); P.set(5, 18, hexc("#2a2230")); P.set(18, 18, hexc("#2a2230"))
    elif kind == "mecharm":
        c = col or hexc("#9aa0aa"); P.rect(16, 13, 17, 18, c); P.set(16, 15, hexc("#5fd3e0")); P.set(17, 17, shade(c, -0.3))
    elif kind == "mecharmL":
        c = col or hexc("#9aa0aa"); P.rect(6, 13, 7, 18, c); P.set(7, 15, hexc("#ff8a3a")); P.set(6, 17, shade(c, -0.3))
    elif kind == "blades":
        c = hexc("#dfe6ee"); P.rect(1, 8, 2, 10, c); P.rect(21, 6, 22, 8, c); P.rect(2, 16, 3, 18, c); P.rect(20, 15, 21, 17, c)
    elif kind == "slingshot":
        P.vline(20, 12, 17, hexc("#8a5a2a")); P.set(19, 11, hexc("#8a5a2a")); P.set(21, 11, hexc("#8a5a2a")); P.hline(19, 21, 10, hexc("#2a2230"))
    elif kind == "goods":
        P.rect(1, 12, 3, 14, hexc("#ffd84b")); P.rect(20, 11, 22, 13, hexc("#ff5fd2")); P.rect(1, 16, 3, 18, hexc("#5fd3e0")); P.rect(20, 16, 22, 18, hexc("#6fcf7a"))
    elif kind == "tentacles":
        c = col or hexc("#7fdc8a"); P.rect(3, 12, 4, 19, c); P.rect(19, 12, 20, 19, c); P.set(2, 19, c); P.set(21, 19, c); P.rect(1, 14, 2, 17, c); P.rect(21, 14, 22, 17, c)
    elif kind == "creature":
        P.rect(17, 14, 21, 17, hexc("#c9a0ff")); P.set(18, 15, OUTLINE); P.set(20, 15, OUTLINE); P.set(16, 15, hexc("#c9a0ff")); P.set(22, 15, hexc("#c9a0ff"))
    elif kind == "snake":
        c = hexc("#e0c0e8"); P.rect(18, 9, 19, 10, c); P.set(20, 11, c); P.set(21, 12, c); P.set(20, 13, c); P.set(19, 14, c); P.set(20, 15, c); P.set(21, 16, c); P.set(18, 9, hexc("#2a2230"))
    elif kind == "candyapple":
        P.vline(20, 12, 16, hexc("#f2e9d0")); P.rect(19, 9, 21, 11, hexc("#c62828")); P.set(19, 9, hexc("#ff8a8a"))
    elif kind == "fan":
        P.rect(1, 9, 5, 13, hexc("#f4f4ff")); P.set(3, 11, hexc("#c9a0ff")); P.vline(3, 14, 16, hexc("#8a5a2a"))
    elif kind == "handfan":
        c = col or hexc("#ff8fa3"); P.rect(17, 10, 22, 12, c); P.rect(18, 9, 21, 9, c); P.set(19, 13, hexc("#8a5a2a")); P.set(19, 14, hexc("#8a5a2a"))
    elif kind == "clima":
        P.vline(20, 5, 19, hexc("#5fb3ff")); P.set(20, 4, hexc("#ffffff")); P.set(20, 9, hexc("#ffd84b")); P.set(20, 14, hexc("#ffd84b"))
    elif kind == "screens":
        c = hexc("#5fd3e0"); P.rect(1, 8, 4, 10, c); P.rect(19, 6, 22, 8, c); P.rect(0, 13, 3, 15, c); P.set(2, 9, WHITE); P.set(20, 7, WHITE); P.set(1, 14, WHITE)
    elif kind == "datarings":
        c = hexc("#9fe0ff"); P.hline(3, 20, 15, c); P.set(2, 14, c); P.set(21, 14, c); P.set(2, 16, c); P.set(21, 16, c)
    elif kind == "threads":
        c = hexc("#ff5fd2"); P.set(2, 10, c); P.set(3, 13, c); P.set(1, 16, c); P.set(21, 11, c); P.set(22, 14, c); P.set(20, 17, c); P.vline(22, 5, 9, hexc("#dfe6ee")); P.set(22, 4, WHITE)
    elif kind == "wind":
        c = hexc("#cfeeff"); P.hline(0, 4, 9, c); P.hline(1, 5, 12, c); P.hline(19, 23, 10, c); P.hline(18, 22, 13, c)
    elif kind == "ice":
        c = hexc("#bfe6ff"); P.set(2, 8, c); P.set(3, 12, c); P.set(1, 15, c); P.set(21, 7, c); P.set(22, 12, c); P.set(20, 16, c)
    elif kind == "bubbles":
        c = hexc("#bfe6ff"); P.set(2, 6, c); P.set(4, 9, c); P.set(20, 5, c); P.set(22, 9, c); P.set(21, 13, c)
    elif kind == "sparkle":
        c = col or hexc("#ffe08a"); P.set(2, 7, c); P.set(21, 5, c); P.set(22, 12, c); P.set(1, 13, c)
    elif kind == "gear":
        c = hexc("#d9a93a"); P.rect(19, 15, 21, 17, c); P.set(18, 16, c); P.set(22, 16, c); P.set(20, 14, c); P.set(20, 18, c); P.set(20, 16, hexc("#2a2230"))
    elif kind == "cards":
        P.rect(17, 12, 19, 15, WHITE); P.rect(19, 11, 21, 14, WHITE); P.set(18, 13, hexc("#c62828")); P.set(20, 12, hexc("#2a2230"))
    elif kind == "vials":
        P.set(3, 17, hexc("#6fcf7a")); P.set(4, 17, hexc("#ff5fd2")); P.set(5, 17, hexc("#5fd3e0")); P.set(3, 18, hexc("#6fcf7a")); P.set(4, 18, hexc("#ff5fd2")); P.set(5, 18, hexc("#5fd3e0"))
    elif kind == "daggers":
        c = hexc("#dfe6ee"); P.vline(4, 13, 17, c); P.vline(19, 13, 17, c); P.set(4, 18, hexc("#2a2230")); P.set(19, 18, hexc("#2a2230"))
    elif kind == "helmetarm":
        c = col or hexc("#ff5fd2"); P.rect(17, 14, 21, 18, c); P.rect(18, 16, 20, 17, hexc("#2a2230"))
    elif kind == "quiver":
        P.rect(2, 10, 4, 18, hexc("#5a3a2a")); P.set(2, 9, hexc("#dfe6ee")); P.set(3, 8, hexc("#dfe6ee")); P.set(4, 9, hexc("#dfe6ee"))
    elif kind == "ball":
        P.rect(18, 4, 21, 7, hexc("#ff5fa8")); P.rect(19, 4, 20, 5, WHITE); P.set(21, 6, WHITE)
    elif kind == "shavedice":
        P.rect(18, 13, 22, 15, hexc("#e0f4ff")); P.rect(19, 11, 21, 12, hexc("#c9a0ff")); P.rect(19, 16, 21, 18, hexc("#f4f4ff")); P.set(20, 10, hexc("#ff8fa3"))
    elif kind == "drink":
        P.rect(18, 12, 21, 16, hexc("#5fb3ff")); P.set(19, 11, hexc("#ff8a3a")); P.set(20, 10, hexc("#c62828")); P.vline(19, 17, 18, hexc("#f4f4ff"))
    elif kind == "watermelon":
        P.rect(18, 11, 21, 13, hexc("#e23a3a")); P.hline(18, 21, 14, hexc("#6fcf7a")); P.set(19, 12, OUTLINE)
    elif kind == "spoon":
        P.vline(20, 11, 14, hexc("#dfe6ee")); P.set(20, 10, hexc("#f4f4ff"))
    elif kind == "flamingo":
        c = hexc("#ff7fb0"); P.rect(0, 17, 23, 20, c); P.rect(0, 7, 2, 16, c); P.rect(0, 5, 3, 7, c); P.set(4, 6, hexc("#2a2230")); P.set(1, 6, OUTLINE)
    elif kind == "towel":
        P.rect(4, 11, 5, 19, WHITE); P.rect(18, 11, 19, 19, WHITE); P.set(4, 19, hexc("#ff7fb0")); P.set(19, 19, hexc("#ff7fb0"))
    elif kind == "bandage":
        P.hline(13, 14, 20, hexc("#f4f4ff")); P.hline(9, 10, 21, hexc("#f4f4ff"))
    elif kind == "broom":
        P.vline(3, 6, 20, hexc("#8a5a2a")); P.rect(2, 20, 4, 22, hexc("#5a3a2a"))
    elif kind == "glove_long":
        c = col or hexc("#c84ad8"); P.rect(16, 15, 16, 18, c); P.rect(7, 15, 7, 18, hexc("#ffffff"))


def draw_special(P, p, body, skin, hair, eye, top, bot, acc):
    if body == "spirit":
        c = hexc(p.get("top", "#b48cff")); d = shade(c, -0.3); l = shade(c, 0.35)
        P.rect(6, 6, 17, 18, c); P.rect(7, 5, 16, 5, c); P.rect(8, 4, 15, 4, c); P.rect(5, 8, 5, 15, c); P.rect(18, 8, 18, 15, c)
        P.rect(7, 19, 9, 20, c); P.rect(14, 19, 16, 20, c); P.rect(4, 10, 4, 13, c); P.rect(19, 10, 19, 13, c)
        P.set(8, 3, hexc("#ffd6ff")); P.set(8, 2, hexc("#ffd6ff")); P.set(15, 3, hexc("#ffd6ff")); P.set(15, 2, hexc("#ffd6ff"))
        P.rect(7, 7, 16, 9, l)
        P.rect(9, 10, 10, 12, OUTLINE); P.rect(13, 10, 14, 12, OUTLINE); P.set(9, 10, WHITE); P.set(13, 10, WHITE)
        P.set(7, 13, hexc("#ff8fb0")); P.set(16, 13, hexc("#ff8fb0")); P.rect(11, 14, 12, 14, hexc("#ff5fd2"))
        return P
    if body == "robot":
        m = hexc(p.get("top", "#9fb3c8")); d = shade(m, -0.25)
        P.rect(5, 3, 18, 12, m); P.rect(6, 2, 17, 2, m); P.rect(7, 5, 16, 10, hexc("#1b2a3a"))
        P.rect(10, 6, 13, 9, hexc(p.get("eye", "#5fd3e0"))); P.set(11, 7, WHITE)
        P.rect(10, -1, 13, 1, d); P.set(11, -2, hexc("#ff5f5f")); P.set(12, -2, hexc("#ff5f5f"))
        P.rect(6, 13, 17, 19, d); P.rect(4, 13, 5, 17, m); P.rect(18, 13, 19, 17, m); P.rect(3, 18, 5, 19, hexc("#55606e")); P.rect(18, 18, 21, 19, hexc("#9aa0aa")); P.set(21, 17, hexc("#9aa0aa"))
        P.rect(10, 14, 13, 16, hexc("#ffd84b")); P.rect(6, 20, 9, 22, hexc("#55606e")); P.rect(14, 20, 17, 22, hexc("#55606e"))
        return P
    if body == "skeleton":
        bone = hexc("#f4f0e4"); P.rect(7, 4, 16, 12, bone); P.rect(6, 6, 6, 10, bone); P.rect(17, 6, 17, 10, bone)
        P.rect(8, 7, 10, 9, hexc("#1b1b24")); P.rect(13, 7, 15, 9, hexc("#1b1b24")); P.set(9, 8, hexc("#ffd84b")); P.set(14, 8, hexc("#ffd84b")); P.rect(9, 11, 14, 12, hexc("#1b1b24")); P.set(10, 11, bone); P.set(12, 11, bone)
        P.rect(4, -1, 19, 5, hexc("#1b1b24")); P.rect(3, 1, 20, 4, hexc("#1b1b24"))  # 아프로
        P.rect(7, -6, 16, -2, hexc("#1b1b24")); P.rect(5, -2, 18, -1, hexc("#1b1b24"))  # 탑햇
        P.rect(9, 13, 14, 18, hexc("#1b1b24")); P.rect(8, 14, 8, 17, hexc("#1b1b24")); P.rect(15, 14, 15, 17, hexc("#1b1b24")); P.rect(7, 13, 7, 17, hexc("#1b1b24")); P.rect(16, 13, 16, 17, hexc("#1b1b24"))
        P.rect(11, 13, 12, 14, hexc("#ff8a3a")); P.set(11, 15, WHITE); P.set(12, 16, WHITE)
        P.rect(9, 19, 10, 21, hexc("#1b1b24")); P.rect(13, 19, 14, 21, hexc("#1b1b24")); P.rect(9, 22, 10, 22, bone); P.rect(13, 22, 14, 22, bone)
        P.set(7, 18, bone); P.set(16, 18, bone)
        draw_prop(P, ("cane",), skin)
        return P
    if body == "raccoon":
        fur = hexc("#8a6a4a"); d = shade(fur, -0.35); P.rect(6, 4, 17, 12, fur); P.rect(5, 1, 7, 3, fur); P.rect(16, 1, 18, 3, fur); P.rect(7, 7, 16, 9, d)
        P.rect(9, 8, 10, 8, hexc("#ffe08a")); P.rect(13, 8, 14, 8, hexc("#ffe08a")); P.rect(10, 10, 13, 12, hexc("#d9c9b0")); P.set(11, 10, OUTLINE); P.set(12, 10, OUTLINE)
        oc = hexc("#ff8a3a"); P.rect(8, 13, 15, 19, oc); P.rect(7, 14, 7, 18, oc); P.rect(16, 14, 16, 18, oc); P.vline(11, 13, 19, shade(oc, -0.3)); P.rect(9, 20, 10, 22, fur); P.rect(13, 20, 14, 22, fur)
        draw_prop(P, ("bigrifle",), skin); draw_prop(P, "raccoon_tail", skin) if False else None
        tc = fur; P.vline(3, 14, 21, tc); P.set(2, 13, tc); P.set(3, 16, d); P.set(3, 19, d)
        return P
    if body == "paper":  # 종이 배우 오르페
        pc = hexc("#f2e9d0"); d = shade(pc, -0.2)
        P.rect(7, 4, 16, 12, pc); P.rect(6, 6, 6, 11, pc); P.rect(17, 6, 17, 11, pc); P.rect(6, 1, 17, 3, d); P.rect(7, 0, 16, 0, d); P.hline(7, 16, 4, d)
        P.rect(8, 8, 9, 10, OUTLINE); P.rect(13, 8, 14, 10, OUTLINE); P.set(8, 8, WHITE); P.set(13, 8, WHITE); P.hline(11, 12, 12, hexc("#c84a5f"))
        P.rect(6, 13, 17, 22, pc); P.vline(11, 13, 22, d); P.vline(8, 14, 21, hexc("#9a9a9a")); P.vline(14, 14, 21, hexc("#9a9a9a")); P.hline(9, 10, 16, hexc("#9a9a9a")); P.hline(12, 13, 18, hexc("#9a9a9a"))
        cc = hexc("#ffd84b"); P.hline(7, 16, 1, cc); P.set(8, 0, cc); P.set(12, 0, cc); P.set(15, 0, cc); P.set(12, -1, cc)
        draw_prop(P, ("sparkle", "#ffe08a"), skin)
        return P
    if body == "leaf":  # 제피 — 잎과 바람의 정령
        lc = hexc("#6fcf7a"); d = shade(lc, -0.3); l = shade(lc, 0.3)
        P.rect(6, 3, 17, 12, lc); P.rect(5, 5, 5, 10, lc); P.rect(18, 5, 18, 10, lc); P.set(7, 2, l); P.set(10, 1, l); P.set(14, 2, l); P.set(5, 4, d); P.set(18, 4, d)
        P.rect(8, 7, 9, 9, hexc("#ffe08a")); P.rect(14, 7, 15, 9, hexc("#ffe08a")); P.set(8, 7, WHITE); P.set(14, 7, WHITE)
        pet = hexc("#ff8fa3"); P.rect(8, 12, 15, 14, pet); P.rect(9, 15, 14, 17, pet); P.set(10, 18, pet); P.set(13, 18, pet); P.set(11, 19, shade(pet, 0.3))
        P.rect(6, 13, 17, 21, d); P.rect(7, 22, 16, 22, shade(d, -0.3)); P.set(8, 15, lc); P.set(15, 17, lc); P.set(9, 19, l)
        P.vline(3, 2, 21, hexc("#8a5a2a")); P.set(2, 3, lc); P.set(4, 5, lc); P.set(2, 7, lc)
        draw_prop(P, "wind", skin)
        return P
    if body == "pages":  # 관측자 — 흩날리는 페이지 로브
        pc = hexc("#f2e9d0"); d = shade(pc, -0.25)
        P.rect(6, 1, 17, 12, hexc("#3a2f18")); P.rect(7, 0, 16, 0, hexc("#3a2f18")); P.rect(5, 3, 5, 11, hexc("#3a2f18")); P.rect(18, 3, 18, 11, hexc("#3a2f18"))
        P.rect(10, 6, 13, 9, hexc("#ffe08a")); P.set(11, 7, WHITE); P.set(12, 7, WHITE)
        P.rect(6, 13, 17, 22, pc); P.rect(5, 14, 5, 21, pc); P.rect(18, 14, 18, 21, pc)
        for (x, y) in ((7, 15), (9, 18), (12, 14), (15, 16), (10, 21), (14, 20), (6, 19), (16, 21)):
            P.set(x, y, d)
        for (x, y) in ((2, 6), (3, 11), (1, 16), (21, 5), (22, 10), (20, 15), (22, 19)):
            P.rect(x, y, x + 1, y + 1, pc); P.set(x, y, d)
        draw_prop(P, "openbook", skin)
        return P
    if body == "golem":  # 블리츠크랭크
        m = hexc("#d9a93a"); d = shade(m, -0.3)
        P.rect(6, 2, 17, 11, m); P.rect(7, 1, 16, 1, m); P.rect(9, 5, 14, 8, hexc("#2a2230")); P.rect(10, 6, 13, 7, hexc("#ffe08a")); P.set(11, 6, WHITE)
        P.rect(5, 12, 18, 19, m); P.rect(7, 13, 16, 18, d); P.rect(10, 14, 13, 17, m); P.set(5, 10, hexc("#9aa0aa")); P.set(18, 10, hexc("#9aa0aa")); P.set(4, 9, hexc("#dddddd")); P.set(19, 9, hexc("#dddddd"))
        P.rect(6, 20, 9, 22, d); P.rect(14, 20, 17, 22, d)
        draw_prop(P, ("bighands", "#d9a93a"), skin)
        return P
    return P


# ---------------------------------------------------------------- 캐릭터 파라미터
A = "#f6d7c3"
CHARS = {
    # ---- 틈새 · 설계자
    "teumsae": dict(body="spirit", top="#b48cff"),
    "architect": dict(hair="#2a2140", hairStyle="long", face="hidden", faceColor="#120d1f", eyes="glow", eye="#ff5fd2", outfit="robe", top="#2a2140", hat="hood", hatColor="#2a2140", props=["threads"], glow="#ff5fd2"),
    # ---- 잿빛 왕관
    "heim": dict(hair="#6a5a4a", hairStyle="short", eye="#4a3a2a", beard="full", beardColor="#8a7a6a", outfit="armor", top="#6a6a78", hat="helmet", hatColor="#7a7a88", props=[("spear",), ("shield", "#5a4a3a", "#8a7a6a")], mouth="flat"),
    "brenda": dict(hair="#b5533c", hairStyle="bob", eye="#5a3a2a", outfit="apron", top="#7a5a3a", under="#d9c9b0", sleeve="short", props=[("hammer", "#6a6a7a")], mouth="grin", skin="tan"),
    "felix": dict(hair="#c9a24a", hairStyle="short", bangs="side", eye="#5aa0d0", outfit="tunic", top="#6a8a4a", bottom="#5a3a2a", cape="#8a5a3a", hat="feathered", hatColor="#5a7a3a", plume="#e24b4b", props=["lute"], mouth="smile"),
    "isolde": dict(hair="#4a3a2a", hairStyle="ponytail", eye="#6fcf7a", outfit="armor", top="#5a6a3a", bottom="#4a3a2a", hat="hood", hatColor="#4a5a3a", acc=["scar"], props=[("bow",)], backProps=["quiver"]),
    "marcus": dict(hair="#8a7a6a", hairStyle="short", bangs="parted", eye="#3a3a4a", eyes="glasses", outfit="robe", top="#6a4a7a", props=["vials"], belt="#5a3a2a"),
    "elowen": dict(hair="#dfe3ee", hairStyle="long", eye="#b48cff", outfit="robe", top="#3a2a6a", props=[("staff", "#8a5a2a", "#ff5fd2")], acc=["starclip"], mouth="smile"),
    "nia": dict(hair="#1b1b24", hairStyle="short", eye="#ffd84b", outfit="bodysuit", top="#1b1b24", bottom="#2a2230", hat="hood", hatColor="#1b1b24", acc=["mask"], maskColor="#2a2230", props=["daggers"]),
    "seraphina": dict(hair="#e8c05a", hairStyle="braid", eye="#5aa0d0", outfit="armor", top="#c9cfd8", bottom="#8a8a9a", cape="#c62828", props=[("sword",)], mouth="flat"),
    "cassian": dict(hair="#5a3a2a", hairStyle="short", bangs="messy", eye="#d9a93a", outfit="armor", top="#5a7a6a", bottom="#3a3a3a", hat="goggles", goggleColor="#ffe08a", scarf="#e24b4b", props=["lance"], mouth="grin", skin="tan"),
    "seraphina_x": dict(hair="#e8c05a", hairStyle="braid", eye="#ff5fd2", eyes="glow", outfit="armor", top="#3a2060", bottom="#2a1a4a", cape="#1a0f22", props=[("sword", "#ff8fd0")], glow="#ff5fd2", mouth="smirk"),
    "orden": dict(hair="#8a8a8a", hairStyle="short", eye="#9a9aaa", beard="full", beardColor="#9a9a9a", outfit="armor", top="#5a5a60", bottom="#3a3a40", cape="#5a2a2a", hat="crown", hatColor="#9a8a5a", acc=["crack"], props=[("greatsword", "#9aa0aa")], mouth="frown", eyes="sleepy"),
    # ---- 네온 하버
    "gino": dict(hair="#2a2a3a", hairStyle="short", eye="#3a3a4a", outfit="jacket", top="#ffd23a", shirt="#2a2a3a", hat="helmet", hatColor="#ff5fd2", backProps=[("box", "#5fd3e0")], mouth="grin"),
    "tan": dict(hair="#2a2a2a", hairStyle="short", eye="#3a2a2a", outfit="apron", top="#f4f4ff", under="#3a5a8a", sleeve="short", hat="headband", hatColor="#e24b4b", props=["ladle"], mouth="grin", skin="tan"),
    "koda": dict(hair="#2a2a3a", hairStyle="short", bangs="up", eye="#3a3a4a", outfit="hoodie", top="#5a3a9a", hat="headphones", hatColor="#ff5fd2", acc=["sunglasses"], sunglassColor="#5fd3e0", mouth="grin", skin="dark"),
    "yuna": dict(hair="#ff8fd0", hairStyle="twin", eye="#5fd3e0", outfit="hoodie", top="#2a2a3a", ears="cat", earColor="#2a2a3a", acc=["goggles_eyes"], goggleColor="#6fcf7a", props=[("lollipop", "#ff5fd2"), "laptop"], mouth="smirk"),
    "leo": dict(hair="#8a5a3a", hairStyle="short", bangs="messy", eye="#5a4a3a", outfit="overalls", top="#3a5a8a", shirt="#d9c9b0", sleeve="short", props=["mecharm", "wrench"], belt="#5a3a2a", mouth="flat"),
    "bas": dict(hair="#4a3a2a", hairStyle="short", eye="#d9a93a", eye2="#5fd3e0", beard="full", beardColor="#4a3a2a", outfit="coat", top="#2a3a4a", hat="peakedcap", hatColor="#1b2a3a", mouth="flat"),
    "kai": dict(hair="#1b1b24", hairStyle="short", bangs="up", eye="#2a2230", outfit="suit", top="#1b1b24", shirt="#ffffff", tie="#1b1b24", acc=["sunglasses"], mouth="flat"),
    "roxy": dict(hair="#ff5fd2", hairStyle="mohawk", hairTip="#5fd3e0", eye="#ffd84b", outfit="jacket", top="#2a2230", shirt="#ff5fd2", props=[("helmetarm", "#ff5fd2")], mouth="smirk", acc=["earrings"]),
    "silva": dict(hair="#9a7ab0", hairStyle="longwavy", eye="#ff5fd2", outfit="dress", top="#3a2a4a", bottom="#2a1a3a", props=["screens"], mouth="smirk", acc=["earrings"]),
    "lumiere": dict(hair="#9fe0ff", hairStyle="longwavy", eye="#ff5fd2", outfit="dress", top="#ff5fd2", bottom="#ff8fd0", sleeve="none", props=["holomic", ("sparkle", "#ffe08a")], mouth="open", glow="#9fe0ff"),
    "lumiere_x": dict(hair="#9fe0ff", hairStyle="longwavy", eye="#ff5fd2", eyes="glow", outfit="dress", top="#2a1a4a", bottom="#3a1a5a", sleeve="none", props=["holomic", ("magic", "#ff5fd2")], glow="#ff5fd2", mouth="smirk"),
    "adel": dict(skin="cyan", hair="#3fc8e0", hairStyle="bob", eye="#ffffff", eyes="glow", outfit="uniform", top="#2a7a9a", hat="peakedcap", hatColor="#1b5a7a", props=["datarings"], mouth="smile"),
    # ---- 성운 표류선
    "fip": dict(hair="#d9a93a", hairStyle="short", bangs="messy", eye="#5a4a3a", outfit="vest", top="#ff8a3a", shirt="#d9c9b0", props=["crate"], mouth="open", skin="tan"),
    "b07": dict(body="robot", top="#9fb3c8", eye="#5fd3e0"),
    "margo": dict(hair="#c9603a", hairStyle="buns", eye="#5a3a2a", outfit="apron", top="#9fe0ff", under="#e24b6a", sleeve="short", props=["pan"], mouth="smile", big=True),
    "astrid": dict(hair="#3a3a4a", hairStyle="short", bangs="side", eye="#5fd3e0", outfit="jumpsuit", top="#ff8a3a", props=[("helmetarm", "#dfe6ee")], mouth="flat"),
    "kirill": dict(hair="#8a9aaa", hairStyle="short", bangs="parted", eye="#6fcf7a", eyes="glasses", outfit="coat", top="#f4f4ff", props=["creature"], mouth="smile"),
    "drake": dict(hair="#2a2a2a", hairStyle="short", eye="#d9a93a", beard="stubble", outfit="coat", top="#4a3a2a", hat="cowboy", hatColor="#3a2a1a", hatBand="#d9a93a", props=[("rifle",)], mouth="flat", acc=["scarR"]),
    "onyx": dict(hair="#1b1b24", hairStyle="bald", eye="#9aa0aa", outfit="armor", top="#3a3a4a", bottom="#2a2230", props=[("shield", "#3a3a4a", "#5fd3e0")], mouth="frown", skin="dark", eyes="angry"),
    "qura": dict(skin="green", hair="#7fdc8a", hairStyle="bald", eye="#1b1b24", eyes="glow", outfit="vest", top="#8a5a2a", shirt="#d9a93a", horns="small", props=["tentacles", "goods"], mouth="grin"),
    "nova": dict(hair="#6a3a9a", hairStyle="long", eye="#ffd84b", outfit="jumpsuit", top="#5a3a9a", backProps=[("box", "#ff8a3a")], acc=["starclip"], mouth="grin"),
    "vorex": dict(hair="#e8e8e8", hairStyle="short", eye="#5fd3e0", beard="long", beardColor="#e8e8e8", outfit="coat", top="#3a2a4a", hat="peakedcap", hatColor="#2a1a3a", props=["mecharm"], mouth="flat", big=True),
    # ---- 마블
    "mv_hawkeye": dict(hair="#d9c07a", hairStyle="short", eye="#5aa0d0", outfit="bodysuit", top="#5a2a8a", bottom="#1b1b24", suitLine="#1b1b24", sleeve="none", props=[("bow", "#5a2a8a")], backProps=["quiver"], mouth="flat"),
    "mv_falcon": dict(skin="dark", hair="#1b1b24", hairStyle="short", eye="#3a2a2a", outfit="bodysuit", top="#c62828", bottom="#9a9aaa", suitLine="#dfe6ee", wings="mech", acc=["goggles_eyes"], goggleColor="#e24b4b", mouth="smile"),
    "mv_antman": dict(fullHelmet="#c62828", helmetStyle="lens", visor="#e24b4b", antenna=True, outfit="bodysuit", top="#c62828", bottom="#1b1b24", suitLine="#9aa0aa", props=[("sparkle", "#9fe0ff")]),
    "mv_deadpool": dict(fullHelmet="#c62828", helmetStyle="mask", eyePatch="#ffffff", maskBand="#1b1b24", outfit="bodysuit", top="#c62828", bottom="#1b1b24", suitLine="#1b1b24", belt="#5a4a3a", backProps=["katana3"], mouth="none"),
    "mv_widow": dict(hair="#d9442a", hairStyle="wavybob", eye="#6fcf7a", outfit="bodysuit", top="#1b1b24", bottom="#1b1b24", suitLine="#ffd84b", belt="#3a3a4a", gloves="#3a3a4a", mouth="smirk"),
    "mv_rocket": dict(body="raccoon"),
    "mv_wolverine": dict(fullHelmet="#ffd23a", helmetStyle="mask", eyePatch="#ffffff", maskBand="#2a4a8a", helmetEars="#1b1b24", outfit="bodysuit", top="#ffd23a", bottom="#2a4a8a", suitLine="#2a4a8a", props=["claws"], big=True),
    "mv_cap": dict(fullHelmet="#2a63d8", helmetStyle="open", hair="#d9c07a", eye="#5aa0d0", outfit="bodysuit", top="#2a63d8", bottom="#c62828", suitLine="#ffffff", chest="#ffffff", props=["roundshield"], gloves="#8a2a2a", mouth="flat"),
    "mv_panther": dict(fullHelmet="#1b1b24", helmetStyle="lens", visor="#dfe6ee", helmetEars="#1b1b24", outfit="bodysuit", top="#1b1b24", bottom="#2a2230", suitLine="#b48cff", necklace="#c0c0c8", skin="dark"),
    "mv_strange": dict(hair="#2a2a2a", hairStyle="short", bangs="parted", streak="#dfe6ee", streak2="#dfe6ee", eye="#5aa0d0", beard="goatee", outfit="tunic", top="#2a4a8a", bottom="#1b2a4a", cape="#c62828", chest="#6fcf7a", props=[("magic", "#ff8a3a")], mouth="flat"),
    "mv_ironman": dict(fullHelmet="#c62828", helmetStyle="ironman", visor="#9fe0ff", outfit="armor", top="#c62828", bottom="#8a1f1f", chest="#9fe0ff", gloves="#e8c04a", props=[("sparkle", "#9fe0ff")], belt="#e8c04a"),
    "mv_thor": dict(hair="#e8c05a", hairStyle="long", bangs="parted", eye="#5aa0d0", beard="full", beardColor="#d9a93a", outfit="armor", top="#9aa0aa", bottom="#3a3a4a", cape="#c62828", props=["mjolnir", "lightning"], mouth="flat", big=True),
    "mv_wanda": dict(hair="#8a3a2a", hairStyle="longwavy", eye="#e24b4b", eyes="glow", outfit="bodysuit", top="#c62828", bottom="#1b1b24", suitLine="#8a1f1f", cape="#8a1f1f", hat="tiara", hatColor="#e23a3a", props=[("magic", "#ff3a3a")], glow="#ff3a3a", mouth="flat"),
    # ---- 원피스
    "op_usopp": dict(skin="tan", hair="#1b1b24", hairStyle="curly", eye="#2a2230", acc=["longnose", "goggles_fore"], goggleColor="#ffd84b", hat="bandana", hatColor="#d9a93a", outfit="overalls", top="#8a5a2a", shirt="#f4f4ff", sleeve="none", props=["slingshot"], mouth="grin"),
    "op_franky": dict(hair="#2a63d8", hairStyle="pompadour", eye="#2a2230", acc=["sunglasses"], outfit="shirtless", bottom="#c62828", shorts=True, props=["metalarms"], jacket="#ff8a3a", mouth="grin", big=True, chest="#ffd84b"),
    "op_brook": dict(body="skeleton"),
    "op_buggy": dict(hair="#2a63d8", hairStyle="long", eye="#2a2230", acc=["nose", "cheekpaint"], noseColor="#e23a3a", hat="cowboy", hatColor="#ff8a3a", hatBand="#ffffff", outfit="coat", top="#c62828", cape="#ff8a3a", mouth="grin", scarf="#ffd84b"),
    "op_nami": dict(hair="#ff8a3a", hairStyle="longwavy", eye="#8a5a3a", outfit="shirt", top="#f4f4ff", bottom="#2a4a8a", sleeve="short", props=["clima"], mouth="smile", legs="#2a4a8a"),
    "op_sanji": dict(hair="#e8c05a", hairStyle="short", bangs="cover", eye="#2a2230", beard="goatee", beardColor="#c9a24a", outfit="suit", top="#1b1b24", shirt="#2a63d8", tie="#1b1b24", mouth="flat"),
    "op_jinbe": dict(skin="blue", hair="#1b1b24", hairStyle="topknot", eye="#2a2230", outfit="kimono", top="#ffd84b", bottom="#2a4a8a", pattern=[(9, 15), (13, 19), (10, 20), (15, 16)], patternColor="#5fb3ff", mouth="flat", big=True, beard="sideburns", beardColor="#1b1b24"),
    "op_robin": dict(skin="tan", hair="#1b1b24", hairStyle="long", eye="#5aa0d0", outfit="dress", top="#8a3a9a", bottom="#ffd1b3", sleeve="none", hat="sunglasses_head", hatColor="#2a2230", mouth="smile"),
    "op_law": dict(skin="tan", hair="#1b1b24", hairStyle="short", eye="#9aa0aa", beard="goatee", hat="furhat", hatColor="#f4f4ff", outfit="hoodie", top="#ffd23a", bottom="#1b1b24", props=[("katana", "#dfe6ee")], mouth="flat", acc=["earrings"], earringColor="#ffd84b"),
    "op_hancock": dict(hair="#1b1b24", hairStyle="long", eye="#2a2a4a", outfit="dress", top="#c62828", bottom="#8a1f1f", acc=["earrings"], earringColor="#ffffff", props=["snake"], mouth="smirk"),
    "op_zoro": dict(skin="tan", hair="#5aa05a", hairStyle="short", eye="#2a2230", acc=["scar"], outfit="coat", top="#2a5a3a", sash="#c62828", props=["katana3"], mouth="frown", eyes="angry"),
    "op_ace": dict(skin="tan", hair="#1b1b24", hairStyle="short", bangs="messy", eye="#2a2230", acc=["freckles"], hat="cowboy", hatColor="#ff8a3a", hatBand="#c62828", outfit="shirtless", bottom="#1b1b24", shorts=True, necklace="#c62828", props=[("flame", "#ff8a3a")], mouth="grin"),
    "op_luffy": dict(skin="tan", hair="#1b1b24", hairStyle="short", bangs="messy", eye="#2a2230", acc=["scar"], hat="strawhat", outfit="vest", top="#c62828", shirt=A, bottom="#2a63d8", legs="#2a63d8", shoes="#8a5a2a", mouth="grin"),
    # ---- 리그 오브 레전드
    "lol_garen": dict(hair="#5a3a2a", hairStyle="short", eye="#5aa0d0", outfit="armor", top="#2a63d8", bottom="#3a3a4a", props=[("greatsword", "#dfe6ee")], emblem="#ffd84b", mouth="flat", big=True),
    "lol_ashe": dict(hair="#f4f4ff", hairStyle="long", eye="#9fe0ff", outfit="dress", top="#2a4a8a", bottom="#1b2a4a", hat="hood", hatColor="#2a4a8a", props=[("bow", "#9fe0ff"), "ice"], mouth="flat"),
    "lol_yi": dict(fullHelmet="#d9a93a", helmetStyle="lens", visor="#6fcf7a", outfit="armor", top="#2a6a3a", bottom="#1b4a2a", props=[("sword", "#dfe6ee")], belt="#d9a93a"),
    "lol_darius": dict(hair="#1b1b24", hairStyle="short", eye="#c62828", beard="full", beardColor="#1b1b24", outfit="armor", top="#5a1f1f", bottom="#1b1b24", props=["axe"], acc=["scar"], mouth="frown", eyes="angry", big=True),
    "lol_lux": dict(hair="#e8c05a", hairStyle="long", eye="#5aa0d0", outfit="armor", top="#f4f4ff", bottom="#d9a93a", props=[("staff", "#d9a93a", "#ffe08a"), ("sparkle", "#ffe08a")], mouth="smile"),
    "lol_blitz": dict(body="golem"),
    "lol_irelia": dict(hair="#1b1b24", hairStyle="long", eye="#5aa0d0", outfit="dress", top="#c62828", bottom="#ffd84b", sleeve="none", props=["blades"], mouth="flat", acc=["ribbon"], ribbonColor="#c62828"),
    "lol_cait": dict(hair="#3a2a6a", hairStyle="long", eye="#5aa0d0", outfit="jacket", top="#3a2a6a", shirt="#f4f4ff", hat="tophat", hatColor="#3a2a6a", hatBand="#d9a93a", props=["sniper"], mouth="flat"),
    "lol_vi": dict(hair="#ff5fa8", hairStyle="short", bangs="side", eye="#5aa0d0", outfit="jacket", top="#8a2a4a", shirt="#d9c9b0", props=[("gauntlets", "#ff8fb0")], mouth="grin", acc=["scarR"]),
    "lol_leesin": dict(skin="tan", hair="#1b1b24", hairStyle="short", eye="#2a2230", acc=["blindfold"], blindfoldColor="#c62828", outfit="shirtless", bottom="#c62828", props=[("flame", "#ff8a3a")], mouth="flat", belt="#d9a93a"),
    "lol_yasuo": dict(skin="tan", hair="#1b1b24", hairStyle="ponytail", eye="#2a2230", beard="stubble", outfit="tunic", top="#2a4a8a", bottom="#5a3a2a", sleeve="none", props=[("katana", "#dfe6ee"), "wind"], mouth="flat", sash="#c62828"),
    "lol_ahri": dict(hair="#1b1b24", hairStyle="long", eye="#ffd84b", ears="fox", earColor="#1b1b24", tails="fox9", tailColor="#f4f4ff", acc=["whiskers"], outfit="dress", top="#c62828", bottom="#f4f4ff", props=[("orb", "#5fd3e0")], mouth="smirk"),
    "lol_kaisa": dict(hair="#3a2a6a", hairStyle="long", eye="#b48cff", eyes="glow", outfit="bodysuit", top="#3a1a5a", bottom="#2a1040", suitLine="#b48cff", props=[("sparkle", "#b48cff")], glow="#8a3ad8", mouth="flat"),
    # ---- 스텔라이브 (공식 전신 일러스트 기준)
    "sl_shibuki": dict(hair="#c9b6ee", hairStyle="long", bangs="parted", eye="#e8c05a", eye2="#ff8fb0", acc=["ahoge", "pompom"], ears="cat", earColor="#c9b6ee", tails="fox1", tailColor="#d9c9f2",
                       outfit="shirt", top="#f4f4ff", sleeve="none", wideSleeves="#f4f4ff", sleeveTrim="#e24b4b", bowTie="#e24b4b", skirt="#c62828", stripedLegs=("#5fb3ff", "#f4f4ff"), shoes="#f4f4ff", mouth="open"),
    "sl_yuni": dict(hair="#f4f4ff", hairStyle="longwavy", eye="#b48cff", horns="unicorn", wings="angel", acc=["ribbon"], ribbonColor="#5fb3ff",
                    outfit="dress", top="#f4f4ff", bottom="#bfe6ff", sleeve="long", socks="#f4f4ff", mouth="smile", glow=None),
    "sl_riko": dict(hair="#b9f0b0", hairStyle="twin", eye="#9aa0aa", hat="halo", acc=["xclip"], clipColor="#6fcf7a",
                    outfit="jacket", top="#f4f4ff", shirt="#1b1b24", skirt="#f4f4ff", belt="#2a2230", props=[("sword", "#dfe6ee")], socks="#f4f4ff", mouth="flat"),
    "sl_nana": dict(hair="#ff8fd0", hairStyle="long", eye="#6fcf7a", hat="beret", hatColor="#1b1b24", acc=["xclip", "sunglasses_head_pink"], clipColor="#ffd84b",
                    outfit="jacket", top="#1b1b24", shirt="#1b1b24", bowTie="#c62828", skirt="#1b1b24", oneSock="#5a5a6a", shoes="#1b1b24", mouth="grin"),
    "sl_huya": dict(hair="#5b3a9a", hairStyle="twin", eye="#ffd84b", horns="demon", ears="pointy", wings="bat", wingColor="#c84ad8", tails="dragon", tailColor="#3a2a4a",
                    outfit="dress", top="#f4f4ff", bottom="#5a3a9a", sleeve="short", choker="#2a2230", necklace="#ffd84b", socks="#f4f4ff", mouth="smile", acc=["starclip"]),
    "sl_tabi": dict(hair="#5fb3ff", hairStyle="twin", eye="#5aa0d0", hat="goggles", goggleColor="#9fe0ff", acc=["catgoggle"],
                    outfit="hoodie", top="#f4f4ff", bowTie="#5fb3ff", emblem="#c62828", skirt="#9a9aaa", belt="#2a2230", mouth="smile"),
    "sl_lize": dict(hair="#b5302a", hairStyle="long", streak="#e8c05a", eye="#9aa0aa", acc=["mole", "batclip"],
                    outfit="jacket", top="#5a5a66", shirt="#1b1b24", skirt="#1b1b24", belt="#dfe6ee", socks="#f4f4ff", socksTop=20, mouth="smirk"),
    "sl_hina": dict(hair="#1b1a22", hairStyle="long", eye="#3b7bd6", acc=["bigbow", "heartclip"], ribbonColor="#c62828",
                    outfit="vest", top="#e8e0cc", shirt="#f4f4ff", bowTie="#c62828", skirt="#8a2a2a", plaid="#c9a24a", legs="#1b1b24", shoes="#5a3a2a", mouth="flat"),
    "sl_hiyori": dict(hair="#d9c7a0", hairTip="#ff8fb0", hairStyle="lowtwin", eye="#ff8fb0", hat="veil", acc=["whiteflower"],
                      outfit="dress", top="#f4f4ff", bottom="#f4f4ff", sleeve="long", socks="#f4f4ff", socksTop=19, props=[("sparkle", "#ff8fb0")], mouth="open"),
    "sl_meri": dict(hair="#e8c05a", hairStyle="longwavy", bangs="eyes", eye="#5aa0d0", acc=["ahoge", "ribbon"], ribbonColor="#2a4a8a", choker="#2a2230",
                    outfit="dress", top="#1b1b24", bottom="#f4f4ff", sleeve="long", bigBowChest="#2a4a8a", apron="#f4f4ff", socks="#f4f4ff", mouth="smile"),
    "sl_rang": dict(hair="#c9c9d0", hairStyle="longinner", hairInner="#d9a93a", eye="#e8c05a", ears="tiger", earColor="#c9c9d0", tails="tiger", acc=["bell", "ahoge"],
                    outfit="bikini", top="#1b1b24", bottom="#d9a93a", frill=False, wideSleeves="#f4f4ff", sleeveTrim="#d9a93a", necklace="#ffd84b", chest="#d9a93a", shoes="#1b1b24", mouth="flat", props=["bandage"]),
    "sl_toa": dict(hair="#15141f", hairTip="#8a5fd6", hairStyle="lowtwin", bangs="side", eye="#b48cff", acc=["toaclips"],
                   outfit="jacket", top="#1b2a4a", shirt="#f4f4ff", bowTie="#ff8fd0", skirt="#8a3ad8", plaid="#b48cff", socks="#1b1b24", socksTop=19, mouth="smile", necklace="#dfe6ee"),
    "sl_mashiro": dict(hair="#b9b9c2", hairStyle="bob", streak="#e0383f", eye="#e03a3a", ears="cat", earColor="#b9b9c2", hat="peakedcap", hatColor="#1b1b24",
                       outfit="coat", top="#1b1b24", shirt="#f4f4ff", tie="#c62828", mouth="flat", acc=["tiebar"]),
    "sl_gangzi": dict(hair="#1b2a4a", hairStyle="braid2", eye="#e2c23a", hat="maid", outfit="jacket", top="#4a4a55", shirt="#2a2a33", apron="#f4f4ff", apronMark="#1b1b24", skirt="#2a2a33", socks="#f4f4ff", socksTop=20, mouth="open"),
    "sl_rin": dict(hair="#f4f4ff", hairStyle="sideponytail", streak="#2a63d8", streak2="#2a63d8", eye="#5aa0d0", hat="maid", acc=["ribbon"], ribbonColor="#2a63d8",
                   outfit="dress", top="#9a9aaa", bottom="#2a63d8", sleeve="short", apron="#f4f4ff", socks="#f4f4ff", socksTop=19, props=[("broom",)], mouth="smile"),
    # ---- 서리 시계탑
    "ur": dict(hair="#3a3a3a", hairStyle="short", bangs="messy", eye="#5aa0d0", hat="cap", hatColor="#4a4a5a", acc=["snow"], scarf="#c62828", outfit="coat", top="#3a3a4a", props=["brush"], mouth="smile", skin="pale"),
    "nell": dict(hair="#c9a24a", hairStyle="braid", eye="#6fcf7a", outfit="apron", top="#f4f4ff", under="#5a7a9a", props=["teapot"], mouth="smile"),
    "gretel": dict(hair="#b5533c", hairStyle="bob", eye="#d9a93a", hat="goggles", goggleColor="#9fe0ff", outfit="overalls", top="#5a4a3a", shirt="#d9c9b0", props=["gear", ("sparkle", "#9fe0ff")], belt="#d9a93a", mouth="grin"),
    "bastian": dict(hair="#dfe6ee", hairStyle="short", eye="#5aa0d0", beard="full", beardColor="#dfe6ee", outfit="apron", top="#9aa0aa", under="#3a4a5a", props=["chisel", "ice"], mouth="flat", big=True),
    "isu": dict(hair="#5a6a8a", hairStyle="long", bangs="parted", eye="#9fe0ff", outfit="coat", top="#2a3a5a", props=["quill", "watch"], mouth="flat", skin="pale"),
    "kairos": dict(hair="#9fe0ff", hairStyle="short", eye="#9fe0ff", outfit="armor", top="#5aa0d0", bottom="#2a4a8a", props=[("sword", "#bfe6ff"), ("shield", "#dfe6ee", "#d9a93a"), "ice"], mouth="flat"),
    "chrono": dict(hair="#d9a93a", hairStyle="short", bangs="straight", eye="#9fe0ff", eyes="glow", outfit="jumpsuit", top="#8a6a3a", chest="#bfe6ff", backProps=["key"], mouth="smile", skin="pale", glow="#bfe6ff"),
    "halma": dict(hair="#dfe6ee", hairStyle="buns", eye="#d9a93a", eyes="glow", outfit="robe", top="#5a4a6a", scarf="#d9a93a", props=[("lantern", "#bfe6ff"), "gear"], mouth="smile", skin="grey"),
    # ---- 심해 등대
    "moss": dict(hair="#2a6a5a", hairStyle="short", bangs="messy", eye="#5fd3e0", acc=["goggles_fore", "freckles"], goggleColor="#9fe0ff", outfit="shirt", top="#ffd84b", bottom="#2a4a5a", sleeve="short", props=["bucket", "bubbles"], mouth="grin"),
    "lilia": dict(hair="#ff8fb0", hairStyle="bob", eye="#5fd3e0", hat="jelly", hatColor="#9fe0ff", outfit="apron", top="#f4f4ff", under="#2a6a7a", props=["ladle", "bubbles"], mouth="open"),
    "harold": dict(fullHelmet="#b08a3a", helmetStyle="diver", outfit="jumpsuit", top="#4a5a6a", props=["canister"], belt="#5a3a2a", big=True),
    "yur": dict(hair="#2a8a7a", hairStyle="longwavy", eye="#ffd84b", outfit="robe", top="#1b4a5a", props=["conch", "bubbles"], mouth="open"),
    "sasha": dict(hair="#8a5a3a", hairStyle="ponytail", eye="#d9a93a", acc=["scar"], hat="headlamp", outfit="jumpsuit", top="#3a4a5a", props=["net"], mouth="flat", skin="tan"),
    "nerei": dict(hair="#4fd1c5", hairStyle="longwavy", eye="#ffe08a", eyes="glow", outfit="robe", top="#1b5a6a", props=["fish", ("sparkle", "#ffe08a")], mouth="smile", glow="#4fd1c5", skin="pale"),
    "bell": dict(hair="#9a9aaa", hairStyle="short", eye="#5aa0d0", beard="stubble", outfit="coat", top="#4a4a5a", scarf="#8a6a4a", props=[("lantern", "#ffffff")], mouth="smile", eyes="sleepy"),
    # ---- 하늘 정원
    "toby": dict(hair="#c9a24a", hairStyle="short", bangs="messy", eye="#5aa0d0", outfit="vest", top="#8a5a2a", shirt="#f4f4ff", props=["crook", "sheep"], mouth="smile"),
    "mia": dict(hair="#8a5a3a", hairStyle="twin", eye="#6fcf7a", hat="flowercrown", outfit="dress", top="#f4f4ff", bottom="#6fcf7a", props=[("umbrella", "#ff8fa3")], mouth="smile"),
    "rufe": dict(hair="#3a3a3a", hairStyle="short", eye="#d9a93a", hat="goggles", goggleColor="#ffe08a", outfit="jacket", top="#5a3a2a", shirt="#d9c9b0", gloves="#8a5a2a", props=[("bird", "#8a6a4a")], mouth="flat", skin="tan"),
    "enya": dict(hair="#5a7a9a", hairStyle="bob", eye="#5aa0d0", eyes="glasses", outfit="coat", top="#2a4a6a", props=["scroll", "wind"], acc=["ribbon"], ribbonColor="#f4f4ff", mouth="flat"),
    "cedric": dict(hair="#4a6a3a", hairStyle="short", eye="#6fcf7a", beard="stubble", outfit="apron", top="#5a7a3a", under="#8a6a4a", props=["shears", "wateringcan"], mouth="smile", skin="tan"),
    "aurel": dict(hair="#dfe6ee", hairStyle="short", bangs="messy", eye="#5fd3e0", hat="goggles", goggleColor="#9fe0ff", outfit="armor", top="#9fe0ff", bottom="#2a4a8a", cape="#f4f4ff", props=["wind"], mouth="grin"),
    "zephy": dict(body="leaf"),
    # ---- 유리 사막
    "dar": dict(hair="#5a3a2a", hairStyle="short", bangs="messy", eye="#d9a93a", outfit="apron", top="#d9c9a0", under="#8a5a2a", sleeve="short", props=["blowpipe"], mouth="flat", skin="tan"),
    "sahara": dict(hair="#2a2a2a", hairStyle="long", eye="#d9a93a", hat="headscarf", hatColor="#e8c05a", outfit="dress", top="#c9603a", bottom="#8a3a2a", props=["compass"], mouth="smile", skin="tan"),
    "omar": dict(hair="#2a2a2a", hairStyle="short", eye="#5aa0d0", beard="goatee", hat="widehat", hatColor="#d9c9a0", outfit="coat", top="#5a4a8a", props=["wheel"], mouth="smile", skin="tan"),
    "rina": dict(hair="#9a7ab0", hairStyle="long", eye="#bfe6ff", eyes="glow", hat="veil", hatColor="#e0d0ff", outfit="dress", top="#5a3a7a", bottom="#3a2a5a", props=[("lantern", "#ffe08a")], mouth="smile"),
    "kasim": dict(hair="#2a2a2a", hairStyle="short", eye="#5a3a2a", beard="mustache", hat="cap", hatColor="#8a2a4a", outfit="vest", top="#d9a93a", shirt="#f4f4ff", props=["mirror", ("sparkle", "#ffd84b")], mouth="smirk", skin="tan"),
    "silvan": dict(hair="#dfe6ee", hairStyle="short", bangs="coverR", eye="#5aa0d0", eye2="#ff8fa3", outfit="coat", top="#3a2a4a", props=["mirrorblade"], mouth="flat"),
    "aina": dict(hair="#e0d0ff", hairStyle="longwavy", eye="#b48cff", hat="crown", hatColor="#bfe6ff", gem="#ff8fa3", outfit="dress", top="#9fe0ff", bottom="#5a3a7a", props=[("sparkle", "#ffffff")], mouth="frown", skin="pale"),
    # ---- 종이 극장
    "ink": dict(hair="#2a2a3a", hairStyle="short", bangs="messy", eye="#2a2230", outfit="shirt", top="#f4f4ff", bottom="#3a3a4a", sleeve="short", gloves="#1b1b24", props=["props"], mouth="grin"),
    "fold": dict(hair="#d9a93a", hairStyle="bob", eye="#5aa0d0", outfit="shirt", top="#ff8a3a", bottom="#5a3a2a", props=["crane"], mouth="flat"),
    "marion": dict(hair="#8a5a3a", hairStyle="ponytail", eye="#ffd84b", hat="headset", hatColor="#2a2230", outfit="jumpsuit", top="#2a2230", props=["spotlight"], mouth="smile"),
    "theo": dict(hair="#5a4a3a", hairStyle="short", bangs="parted", eye="#5a3a2a", eyes="glasses", outfit="robe", top="#6a4a3a", props=["quill", "scroll"], mouth="smirk"),
    "viola": dict(hair="#1b1b24", hairStyle="long", face="hidden", faceColor="#1b1b24", eyes="glow", eye="#ffe08a", outfit="dress", top="#1b1b24", bottom="#2a2230", props=["puppet"], glow="#ffe08a"),
    "colette": dict(hair="#c9603a", hairStyle="buns", eye="#6fcf7a", outfit="dress", top="#c62828", bottom="#f4f4ff", props=["puppet", ("sparkle", "#ff8fa3")], acc=["ribbon"], ribbonColor="#ffd84b", mouth="smile"),
    "orphe": dict(body="paper"),
    "fin": dict(hair="#9a9aaa", hairStyle="short", eye="#2a2230", beard="mustache", hat="tophat", hatColor="#2a2230", hatBand="#c62828", outfit="suit", top="#2a2230", shirt="#f4f4ff", tie="#c62828", props=["cane"], mouth="grin"),
    # ---- 서재
    "observer": dict(body="pages"),
}

# 스킨: 캐릭터 파라미터를 바탕으로 의상만 바꾼다
SKINS = {
    "sk_elowen_1": dict(outfit="coat", top="#1b1b24", bottom="#1b1b24", shirt="#ffd84b", cape="#1b1b24"),
    "sk_nia_1": dict(outfit="suit", top="#1b1b24", shirt="#ffd84b", tie="#1b1b24", hat=None),
    "sk_seraphina_1": dict(outfit="suit", top="#1b1b24", shirt="#ffd84b", tie="#c62828", cape="#8a1f1f"),
    "sk_cassian_1": dict(outfit="suit", top="#1b1b24", shirt="#ffd84b", tie="#2a2230", cape=None, props=["lance"]),
    "sk_seraphina_x_1": dict(outfit="suit", top="#1b1b24", shirt="#ff5fd2", tie="#1b1b24", cape="#2a1a4a"),
    "sk_orden_1": dict(outfit="suit", top="#1b1b24", shirt="#ffd84b", tie="#8a1f1f", cape="#1b1b24"),
    "sk_kai_1": dict(outfit="jacket", top="#ff5fd2", shirt="#5fd3e0", acc=["sunglasses"], props=["mic", ("sparkle", "#5fd3e0")]),
    "sk_roxy_1": dict(outfit="dress", top="#5fd3e0", bottom="#ff5fd2", props=["mic", ("sparkle", "#ff5fd2")]),
    "sk_silva_1": dict(outfit="dress", top="#ff5fd2", bottom="#5fd3e0", props=["mic", ("sparkle", "#5fd3e0")]),
    "sk_lumiere_1": dict(outfit="dress", top="#5fd3e0", bottom="#ff5fd2", props=["holomic", ("sparkle", "#ff5fd2")]),
    "sk_lumiere_x_1": dict(outfit="dress", top="#1b1b24", bottom="#5fd3e0", props=["holomic", ("magic", "#ff5fd2")]),
    "sk_adel_1": dict(outfit="dress", top="#ff5fd2", bottom="#5fd3e0", hat=None, props=["holomic", "datarings"]),
    "sk_onyx_1": dict(outfit="jacket", top="#2a4a8a", shirt="#4fd1c5", props=[], mouth="flat"),
    "sk_qura_1": dict(outfit="jacket", top="#2a4a8a", shirt="#4fd1c5"),
    "sk_nova_1": dict(outfit="jacket", top="#2a4a8a", shirt="#4fd1c5", backProps=[], acc=["starclip"], props=[("sparkle", "#4fd1c5")]),
    "sk_vorex_1": dict(outfit="jacket", top="#2a4a8a", shirt="#4fd1c5", hat=None),
    "sk_architect_1": dict(outfit="coat", top="#3a2a5a", hat=None, hairStyle="long", hair="#2a2140", props=["threads", ("sparkle", "#ff5fd2")]),
    "sk_mv_cap_1": dict(top="#2a63d8", bottom="#c62828", suitLine="#ffffff", fullHelmet="#2a63d8", helmetStyle="mask", eyePatch="#ffffff", maskBand="#2a63d8"),
    "sk_mv_panther_1": dict(top="#1b1b24", suitLine="#dfe6ee", necklace="#dfe6ee", cape="#5a3a9a"),
    "sk_mv_strange_1": dict(top="#2a63d8", cape="#e23a3a", chest="#ffd84b", props=[("magic", "#ffe08a")]),
    "sk_mv_ironman_1": dict(top="#e23a3a", bottom="#ffd84b", gloves="#ffd84b", chest="#ffffff"),
    "sk_mv_thor_1": dict(top="#2a63d8", bottom="#ffd84b", cape="#e23a3a", hat="helmet", hatColor="#9aa0aa", plume=None),
    "sk_mv_wanda_1": dict(top="#e23a3a", bottom="#ff8fb0", cape="#e23a3a", suitLine="#ff8fb0", hat="tiara", hatColor="#ff8fb0"),
    "sk_op_robin_1": dict(outfit="kimono", top="#5a3a7a", bottom="#ffd84b", pattern=[(9, 15), (13, 19), (10, 20), (15, 16)], patternColor="#ff8fa3", hat=None),
    "sk_op_law_1": dict(outfit="kimono", top="#ffd23a", bottom="#1b1b24", pattern=[(9, 15), (13, 19), (10, 20)], patternColor="#1b1b24"),
    "sk_op_hancock_1": dict(outfit="kimono", top="#c62828", bottom="#ffd84b", pattern=[(9, 15), (13, 19), (10, 20), (15, 16)], patternColor="#ffd1b3"),
    "sk_op_zoro_1": dict(outfit="kimono", top="#2a5a3a", bottom="#c62828", pattern=[(9, 15), (13, 19)], patternColor="#8fd48a", props=["katana3"]),
    "sk_op_ace_1": dict(outfit="kimono", top="#ff8a3a", bottom="#1b1b24", pattern=[(9, 15), (13, 19), (10, 20)], patternColor="#ffd84b", props=[("flame", "#ff8a3a")]),
    "sk_op_luffy_1": dict(outfit="kimono", top="#c62828", bottom="#ffd84b", pattern=[(9, 15), (13, 19), (10, 20)], patternColor="#ffd84b"),
    "sk_lol_cait_1": dict(outfit="dress", top="#1b1b24", bottom="#d9a93a", hat=None, props=["mic", ("sparkle", "#d9a93a")]),
    "sk_lol_vi_1": dict(outfit="jacket", top="#1b1b24", shirt="#d9a93a", props=[("gauntlets", "#d9a93a")]),
    "sk_lol_leesin_1": dict(outfit="jacket", top="#1b1b24", shirt="#d9a93a", props=[("sparkle", "#d9a93a")]),
    "sk_lol_yasuo_1": dict(outfit="jacket", top="#1b1b24", shirt="#d9a93a", props=[("katana", "#ffd84b"), ("sparkle", "#d9a93a")]),
    "sk_lol_ahri_1": dict(outfit="dress", top="#1b1b24", bottom="#d9a93a", props=[("orb", "#ff5fd2"), ("sparkle", "#d9a93a")]),
    "sk_lol_kaisa_1": dict(top="#1b1b24", bottom="#5a3a9a", suitLine="#d9a93a", props=[("sparkle", "#d9a93a")]),
    # 스텔라이브 수영복 (직접 그린 일러스트 기준)
    "sk_sl_hina_1": dict(hair="#1b1a22", eye="#3b7bd6", top="#ffffff", bottom="#2a63d8", hairStyle="twin", bangs="straight", acc=["hibiscus"], flower="#ff2d6f", hat="sunglasses_head", hatColor="#ffffff", outfit="bikini", frill=True, sarong="#9fdcf0", necklace="#fff3c4", mouth="smile", props=[]),
    "sk_sl_huya_1": dict(hair="#5b3a9a", eye="#f2c230", top="#1d1a24", bottom="#1d1a24", hairStyle="sideponytail", bangs="side", hat=None, acc=["flower_pink"], horns="demon", wings="bat", outfit="bikini", frill=True, necklace="#f4f0ff", mouth="open", thighband="#c84ad8", choker=None, props=[]),
    "sk_sl_yuni_1": dict(hair="#d9cdf2", eye="#a98cff", top="#1d1a24", bottom="#1d1a24", hairStyle="buns", bangs="cover", eyes="closed", acc=["blackflower"], horns="unicorn", wings="angel", outfit="bikini", jacket="#b9a6e0", necklace="#ffffff", mouth="open", thighband="#2a2230", rainbow=False, props=[], chest=None),
    "sk_sl_mashiro_1": dict(hair="#b9b9c2", streak="#e0383f", eye="#e03a3a", top="#ff6fb0", bottom="#ff6fb0", hairStyle="braid", bangs="side", wink=True, hat="visor", acc=["hibiscus_r"], flower="#ffcf3a", outfit="bikini", frill=True, jacket="#eef2ff", choker="#2a2230", mouth="smile", thighband="#2a2230", props=[]),
    "sk_sl_gangzi_1": dict(hair="#141622", hairInner="#2a6cff", eye="#e2c23a", top="#cdbdf0", bottom="#cdbdf0", hairStyle="longinner", bangs="straight", hat="sleepmask", acc=[], outfit="camisole", choker="#2a2230", mouth="flat", props=[]),
    "sk_sl_toa_1": dict(hair="#15141f", hairTip="#8a5fd6", eye="#b48cff", top="#e4d4f5", bottom="#7a2a8a", patternColor="#8a5fd6", hairStyle="lowtwin", bangs="side", acc=["toaclips"], outfit="yukata", mouth="smile", props=["candyapple"]),
}


def params_for(cid, chars_by_id):
    base = dict(CHARS.get(cid) or {})
    if not base:
        # 모르는 캐릭터: look 에서 색만 대충
        look = (chars_by_id.get(cid, {}).get("look") or "").lower()
        hair = "#3a2a2a"
        for k, v in (("silver", "#dfe6ee"), ("white", "#f4f4ff"), ("blond", "#e8c05a"), ("gold", "#e8c05a"), ("red", "#c62828"), ("pink", "#ff8fd0"), ("blue", "#2a63d8"), ("green", "#5aa05a"), ("purple", "#7a4fd0"), ("black", "#1b1b24"), ("brown", "#5a3a2a"), ("orange", "#ff8a3a"), ("grey", "#9a9aaa")):
            if k + " hair" in look:
                hair = v
                break
        base = dict(hair=hair, hairStyle="long" if ("1girl" in look or "woman" in look or "girl" in look) else "short", top="#5a5a7a")
    return base


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only")
    ap.add_argument("--sheet")
    ap.add_argument("--out", default=os.path.join(ROOT, "public", "assets", "chars"))
    ap.add_argument("--no-write", action="store_true")
    a = ap.parse_args()
    chars = json.load(open(os.path.join(ROOT, "public", "data", "characters.json"), encoding="utf-8"))
    by = {c["id"]: c for c in chars}
    skins = json.load(open(os.path.join(ROOT, "public", "data", "skins.json"), encoding="utf-8"))["skins"]
    only = set(a.only.split(",")) if a.only else None
    jobs = []
    for c in chars:
        if only and c["id"] not in only:
            continue
        jobs.append((c["id"], params_for(c["id"], by), os.path.join(a.out, f"{c['id']}_sprite.png")))
    for sk in skins:
        if only and sk["id"] not in only and sk["char"] not in only:
            continue
        if sk["id"] not in SKINS:
            continue
        # 스텔라이브 스킨은 일러스트 기준으로 따로 정의돼 있어 기본값을 섞지 않는다
        p = dict(SKINS[sk["id"]]) if sk["id"].startswith("sk_sl_") else {**params_for(sk["char"], by), **SKINS[sk["id"]]}
        jobs.append((sk["id"], p, os.path.join(a.out, "skins", f"{sk['id']}_sprite.png")))
    imgs = []
    for sid, p, dst in jobs:
        im = draw(p).image(glow=p.get("glow"))
        imgs.append((sid, im))
        if not a.no_write:
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            im.save(dst)
    if a.sheet:
        cols = 12
        rows = (len(imgs) + cols - 1) // cols
        sheet = Image.new("RGBA", (cols * 100, rows * 112), (40, 36, 52, 255))
        from PIL import ImageDraw
        d = ImageDraw.Draw(sheet)
        for i, (sid, im) in enumerate(imgs):
            x, y = (i % cols) * 100, (i // cols) * 112
            big = im.resize((96, 96), Image.NEAREST)
            sheet.paste(big, (x + 2, y + 2), big)
            d.text((x + 3, y + 99), sid[:16], fill=(220, 220, 230, 255))
        sheet.save(a.sheet)
    print(f"{len(imgs)}개 생성")


if __name__ == "__main__":
    main()
