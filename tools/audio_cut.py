"""미니게임-인커젼 음원 자르기 도구

통으로 받은 곡을 게임에 맞게 잘라서 assets/audio 아래 이름 규칙대로 저장한다.
필요: ffmpeg (PATH 에 있어야 함), Python 3.9+, numpy (pip install numpy)

명령
  highlight  곡에서 가장 고조되는 구간을 잘라 테마곡으로 (뽑기 연출용, 기본 30초)
      python tools/audio_cut.py highlight 원곡.mp3 --to chars/mv_ironman
      python tools/audio_cut.py highlight 원곡.mp3 --to chars/sl_yuni --start 1:20 --len 35
  loop       자연스럽게 반복되는 구간을 잘라 화면 배경음으로 (기본 60~120초)
      python tools/audio_cut.py loop 원곡.mp3 --to bgm/lobby
  split      여러 곡이 이어진 긴 파일을 곡 사이 무음으로 나눈다
      python tools/audio_cut.py split 앨범.mp3 --out 나눈곡폴더
  batch      목록 파일대로 한꺼번에
      python tools/audio_cut.py batch 목록.json

목록 파일 예 (목록.json)
  [
    {"file": "avengers.mp3", "to": "chars/mv_ironman", "mode": "highlight"},
    {"file": "yuni_song.mp3", "to": "chars/sl_yuni", "mode": "highlight", "start": "1:05"},
    {"file": "lobby_song.mp3", "to": "bgm/lobby", "mode": "loop"}
  ]

--to 는 assets/audio 아래 경로 (확장자 빼고). 결과는 mp3, 음량은 비슷하게 맞춘다.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 22050


def need_ffmpeg():
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg 를 찾을 수 없어요. https://ffmpeg.org 에서 받아 PATH 에 넣어 주세요.")


def tsec(v):
    if v is None or v == "":
        return None
    if isinstance(v, (int, float)):
        return float(v)
    parts = [float(x) for x in str(v).split(":")]
    s = 0.0
    for p in parts:
        s = s * 60 + p
    return s


def fmt(t):
    return f"{int(t // 60)}:{t % 60:04.1f}"


def duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True)
    return float(out.stdout.strip() or 0)


def decode(path):
    import numpy as np

    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def rms_curve(x, hop=0.25):
    import numpy as np

    n = int(SR * hop)
    m = len(x) // n
    if m == 0:
        return np.zeros(1), hop
    frames = x[: m * n].reshape(m, n)
    return np.sqrt((frames**2).mean(axis=1) + 1e-12), hop


def find_highlight(path, length):
    """에너지가 높고 오래 유지되는 구간. 시작점은 그 직전의 에너지 상승 지점에 맞춘다."""
    import numpy as np

    x = decode(path)
    r, hop = rms_curve(x)
    w = max(1, int(length / hop))
    if len(r) <= w:
        return 0.0
    db = 20 * np.log10(r)
    csum = np.cumsum(np.insert(db, 0, 0))
    mean = (csum[w:] - csum[:-w]) / w
    # 곡 맨 앞·맨 뒤 10%는 피한다 (인트로·아웃트로)
    lo, hi = int(len(mean) * 0.1), int(len(mean) * 0.9)
    best = lo + int(np.argmax(mean[lo:hi])) if hi > lo else int(np.argmax(mean))
    # 앞쪽 4초 안에서 에너지가 가장 크게 뛰는 곳(후렴 시작)으로 당긴다
    look = int(4 / hop)
    a = max(1, best - look)
    rise = np.diff(db[a - 1 : best + 2])
    if len(rise):
        best = a - 1 + int(np.argmax(rise)) + 1
    return best * hop


def find_loop(path, min_len, max_len):
    """끝과 처음의 소리가 가장 비슷한 구간 (반복할 때 튀지 않게)."""
    import numpy as np

    x = decode(path)
    hop = 0.1
    n = int(SR * hop)
    m = len(x) // n
    frames = x[: m * n].reshape(m, n)
    spec = np.abs(np.fft.rfft(frames * np.hanning(n), axis=1))[:, :128]
    spec = np.log1p(spec)
    spec /= np.linalg.norm(spec, axis=1, keepdims=True) + 1e-9
    total = m * hop
    best = (1e9, 0.0, min(max_len, total))
    starts = np.arange(int(total * 0.05 / hop), int(total * 0.5 / hop), int(1 / hop))
    for s in starts:
        e_lo, e_hi = s + int(min_len / hop), min(m - 2, s + int(max_len / hop))
        if e_lo >= e_hi:
            continue
        a = spec[s : s + 5].mean(axis=0)
        cands = np.arange(e_lo, e_hi)
        b = np.stack([spec[e : e + 5].mean(axis=0) for e in cands])
        d = 1 - b @ a
        k = int(np.argmin(d))
        if d[k] < best[0]:
            best = (float(d[k]), s * hop, (cands[k] - s) * hop)
    return best[1], best[2]


def encode(src, dst, start, length, fade_in, fade_out):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    af = []
    if fade_in > 0:
        af.append(f"afade=t=in:st=0:d={fade_in}")
    if fade_out > 0:
        af.append(f"afade=t=out:st={max(0, length - fade_out)}:d={fade_out}")
    af.append("loudnorm=I=-16:TP=-1.5:LRA=11")
    cmd = ["ffmpeg", "-v", "error", "-y", "-ss", f"{start:.2f}", "-t", f"{length:.2f}", "-i", src, "-af", ",".join(af), "-ar", "44100", "-ac", "2", "-b:a", "192k", dst]
    subprocess.run(cmd, check=True)


def out_path(to):
    to = to.replace("\\", "/").strip("/")
    if to.endswith(".mp3"):
        to = to[:-4]
    base = os.path.join(ROOT, "public", "assets", "audio")
    cfg = os.path.join(ROOT, "tools", "audio_out.txt")
    if os.path.exists(cfg):
        base = open(cfg, encoding="utf-8").read().strip() or base
    return os.path.join(base, to + ".mp3")


def do_highlight(src, to, start=None, length=30):
    need_ffmpeg()
    dur = duration(src)
    length = min(length, dur)
    st = tsec(start)
    if st is None:
        st = find_highlight(src, length)
    st = max(0.0, min(st, max(0, dur - length)))
    dst = out_path(to)
    encode(src, dst, st, length, 0.6, 2.0)
    print(f"[하이라이트] {os.path.basename(src)} {fmt(st)}~{fmt(st + length)} → {os.path.relpath(dst, ROOT)}")


def do_loop(src, to, start=None, min_len=60, max_len=120):
    need_ffmpeg()
    dur = duration(src)
    st = tsec(start)
    if st is None:
        st, length = find_loop(src, min(min_len, dur * 0.5), min(max_len, dur * 0.95))
    else:
        length = min(max_len, dur - st)
    dst = out_path(to)
    encode(src, dst, st, length, 0.05, 0.05)
    print(f"[반복용] {os.path.basename(src)} {fmt(st)}~{fmt(st + length)} ({length:.0f}초) → {os.path.relpath(dst, ROOT)}")


def do_split(src, outdir, min_silence=1.5, noise=-40):
    need_ffmpeg()
    log = subprocess.run(["ffmpeg", "-i", src, "-af", f"silencedetect=noise={noise}dB:d={min_silence}", "-f", "null", "-"], capture_output=True, text=True).stderr
    starts = [float(v) for v in re.findall(r"silence_start: ([\d.]+)", log)]
    ends = [float(v) for v in re.findall(r"silence_end: ([\d.]+)", log)]
    dur = duration(src)
    cuts = [0.0]
    for s, e in zip(starts, ends):
        cuts.append((s + e) / 2)
    cuts.append(dur)
    os.makedirs(outdir, exist_ok=True)
    n = 0
    for a, b in zip(cuts, cuts[1:]):
        if b - a < 10:
            continue
        n += 1
        dst = os.path.join(outdir, f"{n:02d}.mp3")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{a:.2f}", "-t", f"{b - a:.2f}", "-i", src, "-b:a", "192k", dst], check=True)
        print(f"[나누기] {n:02d}.mp3  {fmt(a)}~{fmt(b)}")
    print(f"{n}곡으로 나눴어요 → {outdir}")


def do_batch(listfile):
    items = json.load(open(listfile, encoding="utf-8"))
    base = os.path.dirname(os.path.abspath(listfile))
    for it in items:
        src = it["file"] if os.path.isabs(it["file"]) else os.path.join(base, it["file"])
        try:
            if it.get("mode", "highlight") == "loop":
                do_loop(src, it["to"], it.get("start"), it.get("min", 60), it.get("max", 120))
            else:
                do_highlight(src, it["to"], it.get("start"), it.get("len", 30))
        except Exception as e:
            print(f"[실패] {it['file']}: {e}")


def main():
    ap = argparse.ArgumentParser(description="게임용 음원 자르기")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("highlight")
    p.add_argument("src")
    p.add_argument("--to", required=True)
    p.add_argument("--start")
    p.add_argument("--len", type=float, default=30)
    p = sub.add_parser("loop")
    p.add_argument("src")
    p.add_argument("--to", required=True)
    p.add_argument("--start")
    p.add_argument("--min", type=float, default=60)
    p.add_argument("--max", type=float, default=120)
    p = sub.add_parser("split")
    p.add_argument("src")
    p.add_argument("--out", required=True)
    p.add_argument("--silence", type=float, default=1.5)
    p = sub.add_parser("batch")
    p.add_argument("list")
    a = ap.parse_args()
    if a.cmd == "highlight":
        do_highlight(a.src, a.to, a.start, a.len)
    elif a.cmd == "loop":
        do_loop(a.src, a.to, a.start, a.min, a.max)
    elif a.cmd == "split":
        do_split(a.src, a.out, a.silence)
    elif a.cmd == "batch":
        do_batch(a.list)


if __name__ == "__main__":
    main()
