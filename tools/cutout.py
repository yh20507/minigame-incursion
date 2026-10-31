"""특별 일러스트(_full)·스킨 일러스트에서 캐릭터만 누끼 따서 _fig.png 로 저장 (로비 전용).
사용: python tools/cutout.py [public/assets]   (이미 있으면 건너뜀, --redo 로 다시)
"""
import os
import sys

from PIL import Image
from rembg import new_session, remove

root = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("-") else "public/assets"
redo = "--redo" in sys.argv
sess = new_session("isnet-anime")
n = 0
for d in (os.path.join(root, "chars"), os.path.join(root, "chars", "skins")):
    for f in sorted(os.listdir(d)):
        if not f.endswith("_full.png"):
            continue
        dst = os.path.join(d, f[:-9] + "_fig.png")
        if os.path.exists(dst) and not redo:
            continue
        im = Image.open(os.path.join(d, f)).convert("RGBA")
        out = remove(im, session=sess)
        bbox = out.getbbox()
        if bbox:
            out = out.crop((max(0, bbox[0] - 8), max(0, bbox[1] - 8), min(out.width, bbox[2] + 8), min(out.height, bbox[3] + 8)))
        out.save(dst)
        n += 1
        print(f"  {f} → {os.path.basename(dst)} {out.size}")
print(f"{n}장 완료")
