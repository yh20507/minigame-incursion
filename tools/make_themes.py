"""오리지널 ★4·★5 캐릭터 전용 테마곡 만들기 (직접 합성, 저작권 걱정 없음)

    python tools/make_themes.py            # 전부
    python tools/make_themes.py orden adel # 일부만

결과: public/assets/audio/chars/<id>.mp3 (10초, 뽑기 연출·도감 일러스트·로비 주크박스에서 재생)
필요: numpy, ffmpeg
"""
import os
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "assets", "audio", "chars")
SR = 44100
LEN = 10.0

SCALES = {
    "major": [0, 2, 4, 5, 7, 9, 11],
    "minor": [0, 2, 3, 5, 7, 8, 10],
    "dorian": [0, 2, 3, 5, 7, 9, 10],
    "lydian": [0, 2, 4, 6, 7, 9, 11],
    "mixolydian": [0, 2, 4, 5, 7, 9, 10],
    "phrygian": [0, 1, 3, 5, 7, 8, 10],
    "harmonic": [0, 2, 3, 5, 7, 8, 11],
    "whole": [0, 2, 4, 6, 8, 10, 12],
}


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def note_of(root, scale, deg):
    sc = SCALES[scale]
    o, i = divmod(deg, len(sc))
    return root + 12 * o + sc[i]


# ---------------------------------------------------------------- 악기
def env(n, a=0.01, d=0.1, s=0.7, r=0.1):
    t = np.arange(n) / SR
    dur = n / SR
    e = np.ones(n) * s
    tot = a + d + r
    if tot * SR > n:  # 짧은 음이면 비율대로 줄인다
        k = n / (tot * SR)
        a, d, r = a * k, d * k, r * k
    a_n = min(n, max(1, int(a * SR)))
    e[:a_n] = np.linspace(0, 1, a_n)
    d_end = min(n, a_n + int(d * SR))
    if d_end > a_n:
        e[a_n:d_end] = np.linspace(1, s, d_end - a_n)
    r_n = min(n, int(r * SR))
    if r_n:
        e[-r_n:] *= np.linspace(1, 0, r_n)
    return e


def osc(kind, f, n, duty=0.5, detune=0.0):
    t = np.arange(n) / SR
    ph = (f * (1 + detune)) * t
    if kind == "sine":
        return np.sin(2 * np.pi * ph)
    if kind == "tri":
        return 2 * np.abs(2 * (ph % 1) - 1) - 1
    if kind == "saw":
        return 2 * (ph % 1) - 1
    if kind == "pulse":
        return np.where((ph % 1) < duty, 1.0, -1.0)
    raise ValueError(kind)


def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):  # 짧은 음이라 충분히 빠르다
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def inst(name, f, n):
    if name == "brass":
        x = osc("saw", f, n) * 0.6 + osc("saw", f, n, detune=0.004) * 0.4
        return lowpass(x, 2200) * env(n, 0.03, 0.15, 0.8, 0.08)
    if name == "lead":
        return osc("pulse", f, n, 0.5) * 0.35 * env(n, 0.005, 0.08, 0.7, 0.05)
    if name == "thin":
        return osc("pulse", f, n, 0.25) * 0.35 * env(n, 0.005, 0.06, 0.6, 0.04)
    if name == "reed":
        x = osc("pulse", f, n, 0.125) * 0.5 + osc("saw", f * 1.002, n) * 0.3
        return lowpass(x, 3000) * env(n, 0.02, 0.1, 0.8, 0.05) * 0.6
    if name == "tri":
        return osc("tri", f, n) * 0.6 * env(n, 0.005, 0.1, 0.8, 0.05)
    if name == "bell":
        t = np.arange(n) / SR
        x = np.sin(2 * np.pi * f * t + 2.2 * np.exp(-t * 3) * np.sin(2 * np.pi * f * 3.5 * t))
        return x * np.exp(-t * 2.6) * 0.5
    if name == "organ":
        x = sum(osc("sine", f * h, n) * w for h, w in [(1, 0.6), (2, 0.3), (3, 0.15), (4, 0.1), (0.5, 0.25)])
        return x * env(n, 0.04, 0.1, 0.9, 0.1) * 0.5
    if name == "pad":
        x = sum(osc("saw", f, n, detune=d) for d in (-0.006, 0.0, 0.006)) / 3
        return lowpass(x, 1400) * env(n, 0.35, 0.3, 0.8, 0.4) * 0.35
    if name == "choir":
        t = np.arange(n) / SR
        vib = 1 + 0.004 * np.sin(2 * np.pi * 5 * t)
        x = sum(np.sin(2 * np.pi * f * k * vib * t) / k for k in (1, 2, 3, 4))
        return x * env(n, 0.5, 0.3, 0.8, 0.5) * 0.3
    if name == "bass":
        return osc("tri", f, n) * 0.8 * env(n, 0.005, 0.1, 0.8, 0.04)
    if name == "sqbass":
        return lowpass(osc("pulse", f, n, 0.5), 900) * 0.5 * env(n, 0.005, 0.1, 0.7, 0.04)
    raise ValueError(name)


def drum(kind, n=None):
    if kind == "kick":
        n = int(0.25 * SR)
        t = np.arange(n) / SR
        f = 120 * np.exp(-t * 18) + 45
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * 0.9
    if kind == "timp":
        n = int(0.8 * SR)
        t = np.arange(n) / SR
        f = 90 * np.exp(-t * 4) + 55
        return (np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.random.randn(n) * np.exp(-t * 30)) * np.exp(-t * 3.5) * 0.8
    if kind == "snare":
        n = int(0.18 * SR)
        t = np.arange(n) / SR
        return (np.random.randn(n) * 0.6 + np.sin(2 * np.pi * 190 * t) * 0.5) * np.exp(-t * 22) * 0.6
    if kind == "hat":
        n = int(0.05 * SR)
        x = np.random.randn(n)
        x = x - lowpass(x, 6000)
        return x * np.exp(-np.arange(n) / SR * 80) * 0.35
    if kind == "crush":
        n = int(0.2 * SR)
        t = np.arange(n) / SR
        x = np.sin(2 * np.pi * np.cumsum(140 * np.exp(-t * 25) + 50) / SR) * np.exp(-t * 10)
        return np.round(x * 6) / 6 * 0.8
    raise ValueError(kind)


# ---------------------------------------------------------------- 곡
class Song:
    def __init__(self, bpm, root, scale):
        self.bpm, self.root, self.scale = bpm, root, scale
        self.beat = 60 / bpm
        self.buf = np.zeros(int(SR * (LEN + 2)))
        self.wet = np.zeros_like(self.buf)

    def put(self, x, at, vol=1.0, rev=0.0):
        i = int(at * SR)
        if i >= len(self.buf):
            return
        x = x[: len(self.buf) - i]
        self.buf[i : i + len(x)] += x * vol
        if rev:
            self.wet[i : i + len(x)] += x * vol * rev

    def notes(self, name, seq, start=0.0, vol=1.0, octave=0, rev=0.0, gate=0.92, until=LEN):
        """seq: [(음계 도수 또는 None, 박자), ...] 를 곡 끝까지 반복"""
        t = start
        while t < until:
            for deg, beats in seq:
                d = beats * self.beat
                if deg is not None and t < until:
                    degs = deg if isinstance(deg, (list, tuple)) else [deg]
                    for dg in degs:
                        f = hz(note_of(self.root + 12 * octave, self.scale, dg))
                        self.put(inst(name, f, int(d * gate * SR)), t, vol, rev)
                t += d
                if t >= until:
                    break

    def drums(self, pattern, steps_per_beat=2, vol=1.0, start=0.0):
        """pattern: {'kick': 'x...x...', ...} 한 마디(또는 그 이상) 패턴"""
        step = self.beat / steps_per_beat
        L = max(len(p) for p in pattern.values())
        t = start
        k = 0
        while t < LEN:
            for kind, p in pattern.items():
                c = p[k % len(p)]
                if c in "xX":
                    self.put(drum(kind), t, vol * (1.0 if c == "X" else 0.7))
            t += step
            k += 1
            if k > 10000:
                break
        _ = L

    def render(self, rev_time=0.23, rev_fb=0.45):
        d = int(rev_time * SR)
        w = self.wet.copy()
        for _ in range(6):
            w[d:] += w[:-d] * rev_fb
        y = self.buf + lowpass_fast(w, 3500) * 0.5
        y = y[: int(SR * LEN)]
        fade = int(1.6 * SR)
        y[-fade:] *= np.linspace(1, 0, fade) ** 1.5
        y[: int(0.01 * SR)] *= np.linspace(0, 1, int(0.01 * SR))
        peak = np.max(np.abs(y)) or 1
        y = np.tanh(y / peak * 1.4) * 0.89
        return y


def lowpass_fast(x, cutoff):
    # 긴 신호용: 주파수 영역 저역 통과
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / (1 + (f / cutoff) ** 4)
    return np.fft.irfft(X, len(x))


def stereo_write(y, path, width=0.012):
    d = int(width * SR)
    left = y
    right = np.concatenate([np.zeros(d), y[:-d]]) * 0.92 + y * 0.08
    st = np.stack([left, right], 1).astype(np.float32)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", "-b:a", "192k", path],
        input=st.tobytes(),
        check=True,
    )


# ---------------------------------------------------------------- 캐릭터별 곡
_ = None
KNIGHT = [(0, 1), (0, 0.5), (2, 0.5), (4, 1), (4, 1), (5, 0.5), (4, 0.5), (3, 0.5), (2, 0.5), (1, 2),
          (2, 1), (2, 0.5), (4, 0.5), (7, 1.5), (6, 0.5), (5, 1), (4, 1), (2, 1), (4, 1)]
POP = [(4, 0.5), (4, 0.5), (5, 0.5), (4, 0.5), (2, 1), (_, 0.5), (0, 0.5), (1, 0.5), (2, 0.5), (4, 1.5), (_, 0.5),
       (5, 0.5), (5, 0.5), (7, 0.5), (5, 0.5), (4, 1), (2, 0.5), (1, 0.5), (2, 2)]


def seraphina():
    s = Song(112, 62, "major")  # D 장조 행진곡
    s.notes("brass", KNIGHT, vol=0.55, octave=0, rev=0.3)
    s.notes("pad", [([0, 2, 4], 4), ([3, 5, 7], 4), ([4, 6, 8], 4), ([0, 2, 4], 4)], vol=0.6, octave=-1, rev=0.4)
    s.notes("bass", [(0, 1), (4, 1), (0, 1), (4, 1), (3, 1), (0, 1), (3, 1), (0, 1), (4, 1), (1, 1), (4, 1), (1, 1), (0, 1), (4, 1), (0, 1), (0, 1)], vol=0.7, octave=-2)
    s.drums({"snare": "x.xxx.x.x.xxx.xx", "kick": "x...x...x...x..."}, 4, 0.7)
    return s


def seraphina_x():
    s = Song(84, 62, "minor")  # 같은 선율을 단조로, 균열에 물든 느낌
    s.notes("bell", KNIGHT, vol=0.7, octave=1, rev=0.6, gate=1.0)
    s.notes("choir", [([0, 2, 4], 4), ([5, 7, 9], 4), ([3, 5, 7], 4), ([4, 6, 8], 4)], vol=0.7, octave=-1, rev=0.6)
    s.notes("bass", [(0, 4), (5, 4), (3, 4), (4, 4)], vol=0.6, octave=-2)
    s.drums({"timp": "x.......x......."}, 2, 0.5)
    return s


def cassian():
    s = Song(150, 64, "dorian")  # 하늘을 나는 용 기수: 질주
    s.notes("thin", [(0, 0.5), (2, 0.5), (4, 0.5), (7, 1), (6, 0.5), (4, 0.5), (2, 0.5), (3, 1.5), (_, 0.5), (4, 0.5), (6, 0.5), (8, 1), (7, 0.5), (6, 0.5), (4, 0.5), (7, 2)], vol=0.6, octave=1, rev=0.25)
    s.notes("sqbass", [(0, 0.5), (0, 0.25), (0, 0.25)] * 4 + [(3, 0.5), (3, 0.25), (3, 0.25)] * 4, vol=0.6, octave=-2)
    s.notes("pad", [([0, 2, 4], 4), ([3, 5, 7], 4)], vol=0.4, octave=-1, rev=0.3)
    s.drums({"kick": "x..x..x.x..x..x.", "snare": "....x.......x...", "hat": "xxxxxxxxxxxxxxxx"}, 4, 0.75)
    return s


def lumiere():
    s = Song(120, 69, "major")  # 네온 팝
    s.notes("lead", POP, vol=0.6, octave=0, rev=0.45)
    s.notes("pad", [(_, 0.5), ([0, 2, 4], 0.5)] * 4 + [(_, 0.5), ([5, 7, 9], 0.5)] * 4 + [(_, 0.5), ([3, 5, 7], 0.5)] * 4 + [(_, 0.5), ([4, 6, 8], 0.5)] * 4, vol=0.5, octave=-1)
    s.notes("sqbass", [(0, 0.5), (7, 0.5)] * 4 + [(5, 0.5), (12, 0.5)] * 4 + [(3, 0.5), (10, 0.5)] * 4 + [(4, 0.5), (11, 0.5)] * 4, vol=0.55, octave=-2)
    s.drums({"kick": "x...x...x...x...", "snare": "....x.......x...", "hat": "..x...x...x...x."}, 4, 0.8)
    return s


def lumiere_x():
    s = Song(90, 69, "minor")  # 영원한 앙코르: 같은 선율, 느리고 몽환적으로
    s.notes("bell", POP, vol=0.65, octave=1, rev=0.7, gate=1.0)
    s.notes("pad", [([0, 2, 4], 4), ([5, 7, 9], 4), ([3, 5, 7], 4), ([6, 8, 10], 4)], vol=0.7, octave=-1, rev=0.6)
    s.notes("bass", [(0, 4), (5, 4), (3, 4), (6, 4)], vol=0.5, octave=-2)
    s.drums({"kick": "x.......x.......", "hat": "....x.......x..."}, 4, 0.45)
    return s


def nova():
    s = Song(132, 65, "lydian")  # 은하 탐험: 반짝이는 아르페지오
    s.notes("bell", [(0, 0.25), (4, 0.25), (7, 0.25), (11, 0.25)] * 4 + [(1, 0.25), (5, 0.25), (8, 0.25), (12, 0.25)] * 4, vol=0.4, octave=1, rev=0.5, gate=1.0)
    s.notes("tri", [(4, 1.5), (6, 0.5), (7, 1), (9, 1), (8, 2), (7, 1), (6, 1)], vol=0.7, octave=1, rev=0.3)
    s.notes("bass", [(0, 1)] * 4 + [(1, 1)] * 4, vol=0.6, octave=-2)
    s.drums({"kick": "x.....x.x.......", "snare": "....x.......x...", "hat": "x.x.x.x.x.x.x.x."}, 4, 0.6)
    return s


def orden():
    s = Song(70, 60, "phrygian")  # 잿빛 왕: 무겁고 장엄하게
    s.notes("brass", [(0, 1.5), (1, 0.5), (0, 1), (-1, 1), (-2, 2), (-3, 2), (0, 1.5), (2, 0.5), (3, 1), (4, 1), (1, 4)], vol=0.7, octave=-1, rev=0.5)
    s.notes("choir", [([0, 2, 4], 4), ([-2, 0, 2], 4), ([1, 3, 5], 4)], vol=0.6, octave=-1, rev=0.6)
    s.notes("bass", [(0, 2), (0, 2), (-2, 2), (-2, 2), (1, 4)], vol=0.8, octave=-2)
    s.drums({"timp": "x...x.x.x...x..."}, 2, 0.8)
    return s


def adel():
    s = Song(128, 66, "minor")  # 홀로그램 AI: 디지털 아르페지오
    rng = np.random.default_rng(7)
    arp = []
    for bar in range(4):
        base = [0, 5, 3, 4][bar]
        for i in range(16):
            arp.append((base + [0, 2, 4, 7][i % 4] + (7 if rng.random() < 0.2 else 0), 0.25))
    s.notes("thin", arp, vol=0.45, octave=1, rev=0.2, gate=0.6)
    s.notes("lead", [(4, 1), (_, 0.5), (4, 0.5), (6, 0.5), (7, 0.5), (6, 1), (4, 2), (_, 2), (3, 1), (4, 1), (2, 2)], vol=0.5, octave=0, rev=0.35)
    s.notes("sqbass", [(0, 0.5)] * 8 + [(5, 0.5)] * 8 + [(3, 0.5)] * 8 + [(4, 0.5)] * 8, vol=0.5, octave=-2)
    s.drums({"crush": "x..x..x...x..x..", "hat": "xxx.xxx.xxx.xx.x", "snare": "....x.......x..x"}, 4, 0.7)
    return s


def vorex():
    s = Song(104, 67, "mixolydian")  # 표류선 함장: 뱃노래 (6/8 느낌)
    t = 1 / 3
    s.notes("reed", [(4, 2 * t), (4, t), (5, 2 * t), (4, t), (2, 2 * t), (0, t), (2, 3 * t), (_, 3 * t),
                     (4, 2 * t), (5, t), (7, 2 * t), (6, t), (5, 2 * t), (4, t), (4, 6 * t)], vol=0.6, octave=0, rev=0.3)
    s.notes("bass", [(0, 3 * t), (4, 3 * t), (0, 3 * t), (4, 3 * t), (3, 3 * t), (0, 3 * t), (4, 3 * t), (0, 3 * t)], vol=0.7, octave=-2)
    s.notes("tri", [(_, t), ([2, 4], t), ([2, 4], t)] * 4, vol=0.35, octave=0)
    s.drums({"kick": "x.....x.....", "snare": "...x.....x.x", "hat": "x.xx.xx.xx.x"}, 3, 0.65)
    return s


def architect():
    s = Song(60, 59, "whole")  # 설계자: 불안하고 신비로운 온음 음계
    s.notes("organ", [([0, 2, 4], 2), ([1, 3, 5], 2), ([2, 4, 6], 2), ([0, 3, 5], 2)], vol=0.6, octave=-1, rev=0.6)
    s.notes("bell", [(6, 0.75), (4, 0.25), (5, 1), (_, 0.5), (3, 0.5), (2, 1.5), (_, 0.5), (8, 0.75), (7, 0.25), (6, 2)], vol=0.55, octave=1, rev=0.8, gate=1.0)
    s.notes("choir", [(0, 4), (-1, 4)], vol=0.6, octave=-2, rev=0.5)
    s.drums({"timp": "x.......x.....x."}, 2, 0.45)
    return s


SONGS = {f.__name__: f for f in (seraphina, seraphina_x, cassian, lumiere, lumiere_x, nova, orden, adel, vorex, architect)}


def main():
    ids = sys.argv[1:] or list(SONGS)
    for cid in ids:
        np.random.seed(abs(hash(cid)) % 2**31)
        song = SONGS[cid]()
        y = song.render()
        path = os.path.join(OUT, cid + ".mp3")
        stereo_write(y, path)
        print("테마곡:", os.path.relpath(path, ROOT))


if __name__ == "__main__":
    main()
