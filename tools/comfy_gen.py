"""미니게임-인커젼 그림 자동 생성기 (ComfyUI 연동)

내 PC에서 돌아가는 ComfyUI 에 캐릭터·배경 그림을 자동으로 주문하고,
받은 그림을 게임 규격(픽셀 변환 포함)으로 바꿔 assets 폴더에 넣는다.

처음 한 번
  1. ComfyUI 를 켠다 (기본 주소 http://127.0.0.1:8188)
  2. python tools/comfy_gen.py init      → 연결 확인, 체크포인트 고르기, 설정·프롬프트 파일 생성

쓰는 법
  python tools/comfy_gen.py                       메뉴로 실행 (그림_자동생성.bat 도 같음)
  python tools/comfy_gen.py run                   빠진 그림 전부 생성
  python tools/comfy_gen.py run --ids heim,nova   특정 캐릭터만
  python tools/comfy_gen.py run --kinds sprite    게임용 캐릭터만 (sprite, art, full, bg)
  python tools/comfy_gen.py run --world marvel    세계관/영역 하나만
  python tools/comfy_gen.py run --redo            이미 있는 것도 다시
  python tools/comfy_gen.py pick heim sprite 3    후보 중 3번을 게임에 적용
  python tools/comfy_gen.py status                무엇이 빠졌는지 보기

파일
  tools/comfy/config.json   서버 주소, 체크포인트, 크기, 공통 스타일 (init 이 만든다)
  tools/comfy/prompts.json  그림마다 프롬프트. 자유롭게 고쳐도 되고, 고친 줄은 다시 만들어도 안 바뀐다
  art_raw/<종류>/<id>/      ComfyUI 가 만든 원본 후보들

필요: Python 3.9+ 와 Pillow (pip install pillow)
"""
import argparse
import json
import os
import random
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HERE = os.path.join(ROOT, "tools", "comfy")
CONFIG = os.path.join(HERE, "config.json")
PROMPTS = os.path.join(HERE, "prompts.json")
sys.path.insert(0, os.path.join(ROOT, "tools"))

KINDS = ["sprite", "art", "full", "bg"]


# ---------------------------------------------------------------- 공용
def load_json(p, default=None):
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return default


def save_json(p, data):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)


def rel(p):
    return p if os.path.isabs(p) else os.path.join(ROOT, p)


def load_config():
    cfg = load_json(CONFIG)
    if cfg is None:
        cfg = load_json(os.path.join(HERE, "config.example.json"))
        save_json(CONFIG, cfg)
    return cfg


def game_data(name):
    return load_json(os.path.join(ROOT, "public", "data", name + ".json"), [])


# ---------------------------------------------------------------- ComfyUI
class Comfy:
    def __init__(self, server):
        self.base = server.rstrip("/")
        self.client = str(uuid.uuid4())
        # ComfyUI 는 보통 내 PC나 같은 네트워크에 있으니 시스템 프록시를 거치지 않는다
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def _req(self, path, data=None, timeout=30):
        url = self.base + path
        body = None
        headers = {}
        if data is not None:
            body = json.dumps(data).encode("utf-8")
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(url, data=body, headers=headers)
        with self.opener.open(req, timeout=timeout) as r:
            return r.read()

    def ok(self):
        try:
            json.loads(self._req("/system_stats", timeout=5))
            return True
        except Exception:
            return False

    def upload(self, path):
        """참고 그림을 ComfyUI input 폴더에 올린다. 올라간 이름을 돌려준다."""
        boundary = "----mi" + uuid.uuid4().hex
        name = "incursion_ref_" + os.path.basename(path)
        with open(path, "rb") as f:
            data = f.read()
        body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"{name}\"\r\n"
                f"Content-Type: image/png\r\n\r\n").encode() + data + \
               f"\r\n--{boundary}\r\nContent-Disposition: form-data; name=\"overwrite\"\r\n\r\ntrue\r\n--{boundary}--\r\n".encode()
        req = urllib.request.Request(self.base + "/upload/image", data=body,
                                     headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
        with self.opener.open(req, timeout=60) as r:
            return json.loads(r.read())["name"]

    def models_dir(self):
        """ComfyUI 가 알려주는 실행 정보로 models\\checkpoints 위치를 찾는다"""
        try:
            st = json.loads(self._req("/system_stats", timeout=5)).get("system", {})
        except Exception:
            return None
        argv = st.get("argv") or []
        base = None
        for flag in ("--base-directory", "--base_directory"):
            if flag in argv and argv.index(flag) + 1 < len(argv):
                base = argv[argv.index(flag) + 1]
        if not base:
            main = next((a for a in argv if a.endswith("main.py")), None)
            if main:
                base = os.path.dirname(os.path.abspath(main))
        return os.path.join(base, "models", "checkpoints") if base else None

    def checkpoints(self):
        # 1) /models/checkpoints (대부분 버전)
        try:
            lst = json.loads(self._req("/models/checkpoints"))
            if isinstance(lst, list) and lst:
                return [x for x in lst if isinstance(x, str)]
        except Exception:
            pass
        # 2) object_info: 예전 형식 [[...]] / 새 형식 ["COMBO", {"options": [...]}]
        try:
            info = json.loads(self._req("/object_info/CheckpointLoaderSimple"))
            spec = info["CheckpointLoaderSimple"]["input"]["required"]["ckpt_name"]
            if isinstance(spec[0], list):
                return spec[0]
            if len(spec) > 1 and isinstance(spec[1], dict):
                return spec[1].get("options", [])
        except Exception:
            pass
        return []

    def queue(self, workflow):
        try:
            res = json.loads(self._req("/prompt", {"prompt": workflow, "client_id": self.client}))
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")
            raise RuntimeError(f"ComfyUI 가 작업을 거절했어요: {detail[:400]}")
        return res["prompt_id"]

    def wait(self, prompt_id, timeout=900):
        start = time.time()
        while time.time() - start < timeout:
            hist = json.loads(self._req("/history/" + prompt_id))
            if prompt_id in hist:
                h = hist[prompt_id]
                st = h.get("status", {})
                if st.get("status_str") == "error":
                    raise RuntimeError("ComfyUI 에서 생성 중 오류가 났어요. ComfyUI 창의 로그를 확인하세요.")
                images = []
                for out in h.get("outputs", {}).values():
                    for im in out.get("images", []):
                        if im.get("type", "output") == "output":
                            images.append(im)
                if images or st.get("completed"):
                    return images
            time.sleep(1)
        raise TimeoutError("생성이 너무 오래 걸려요")

    def download(self, im):
        q = urllib.parse.urlencode({"filename": im["filename"], "subfolder": im.get("subfolder", ""), "type": im.get("type", "output")})
        return self._req("/view?" + q, timeout=120)


def fill_workflow(template, values):
    """워크플로 안의 %PROMPT% 같은 자리표시자를 값으로 바꾼다. 숫자 자리는 숫자로 넣는다."""

    def walk(v):
        if isinstance(v, dict):
            return {k: walk(x) for k, x in v.items()}
        if isinstance(v, list):
            return [walk(x) for x in v]
        if isinstance(v, str) and "%" in v:
            for k, val in values.items():
                token = "%" + k + "%"
                if v == token:
                    return val
                if token in v:
                    v = v.replace(token, str(val))
        return v

    return walk(template)


# ---------------------------------------------------------------- 프롬프트
def build_prompts(cfg, existing):
    """characters.json · domains · worlds 에서 프롬프트를 만든다. 사용자가 고친 항목은 유지."""
    chars = game_data("characters")
    story = load_json(os.path.join(ROOT, "public", "data", "story.json"), {})
    speakers = {v.get("char") for v in story.get("speakers", {}).values() if v.get("char")}
    domains = game_data("domains")
    worlds = game_data("worlds")
    theme = {d["id"]: d for d in domains}
    theme.update({w["id"]: w for w in worlds})
    out = dict(existing or {})

    def put(key, entry):
        old = out.get(key)
        if old and old.get("edited"):
            return
        if old and old.get("prompt") != old.get("_auto"):
            old["edited"] = True  # 손으로 고친 흔적이 있으면 보존
            return
        entry["_auto"] = entry["prompt"]
        out[key] = entry

    for c in chars:
        look = c.get("look") or c.get("title", "")
        group = c["domain"]
        setting = {
            "ashen": "dark fantasy knight kingdom",
            "neon": "rainy cyberpunk harbor city",
            "nebula": "space station in a nebula",
            "rift": "mysterious dimensional rift",
        }.get(group, "")
        # 전원: 게임용(sprite) + 기본 일러스트(art)
        # ★4·★5: 특별 일러스트(full)를 하나 더, 더 높은 품질로
        kinds = ["sprite", "art"] + (["full"] if c["rarity"] >= 4 else [])
        for k in kinds:
            parts = [cfg["kinds"][k]["prefix"], look]
            if k == "art" and setting:
                parts.append(setting + " mood")
            if k == "full":
                if c["rarity"] >= 5:
                    parts.append("radiant, glowing magical particles, iridescent light, special rare card art")
                if setting:
                    parts.append(setting + " background")
            put(f"{c['id']}:{k}", {"id": c["id"], "kind": k, "name": c["name"], "group": group, "prompt": ", ".join(p for p in parts if p)})

    bg_hint = {
        "ashen": "dark fantasy fallen knight kingdom at dusk, ash falling, ruined castle walls, amber firelight",
        "neon": "rainy cyberpunk harbor city at night, neon signs reflected in puddles, pink and cyan glow",
        "nebula": "space station drifting through a colorful nebula, ring structure, starfield, teal and violet",
        "rift": "mysterious dimensional rift, fragments of different worlds floating in violet void, magenta cracks",
    }
    for gid in [d["id"] for d in domains] + ["rift"] + [w["id"] for w in worlds]:
        hint = bg_hint.get(gid) or f"{theme[gid].get('name', gid)} themed scenery, {theme[gid].get('subtitle', '')}"
        put(f"{gid}:bg", {"id": gid, "kind": "bg", "name": gid, "group": gid, "prompt": f"{cfg['kinds']['bg']['prefix']}, {hint}"})
    valid = {f"{c['id']}:{k}" for c in chars for k in (["sprite", "art"] + (["full"] if c["rarity"] >= 4 else []))}
    valid |= {f"{g}:bg" for g in [d["id"] for d in domains] + ["rift"] + [w["id"] for w in worlds]}
    return {k: v for k, v in out.items() if k in valid}


def target_path(cfg, entry):
    assets = rel(cfg["assetsDir"])
    if entry["kind"] == "bg":
        return os.path.join(assets, "bg", entry["id"] + ".png")
    return os.path.join(assets, "chars", f"{entry['id']}_{entry['kind']}.png")


def convert(cfg, src, entry):
    """원본을 게임 규격으로 변환해서 넣는다"""
    from PIL import Image

    dst = target_path(cfg, entry)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    k = entry["kind"]
    if k == "full":
        Image.open(src).convert("RGB").save(dst)
        return dst
    import pixelize

    if k == "sprite":
        pixelize.process(src, dst, (48, 48), 32, False, 60, False, 0)
    elif k == "art":
        pixelize.process(src, dst, (256, 256), 64, True, 60, True, 0)
    elif k == "bg":
        pixelize.process(src, dst, (640, 360), 64, True, 60, True, 0)
    return dst


# 참고 그림은 기본으로 도트 캐릭터(sprite)에만 쓴다. 일러스트도 참고하려면 config 의 "refKinds" 에 "art", "full" 추가
REF_DENOISE = {"sprite": 0.8, "full": 0.6, "art": 0.55}


def find_ref(cid):
    """ref/<캐릭터id>.png 가 있으면 그 경로"""
    for ext in (".png", ".jpg", ".jpeg", ".webp"):
        p = os.path.join(ROOT, "ref", cid + ext)
        if os.path.exists(p):
            return p
    return None


def apply_ref(wf, image_name, width, height, denoise):
    """빈 latent 대신 참고 그림에서 시작하게 워크플로를 바꾼다 (img2img)."""
    ks = next((k for k, n in wf.items() if n.get("class_type", "").startswith("KSampler")), None)
    ck = next((k for k, n in wf.items() if n.get("class_type") == "CheckpointLoaderSimple"), None)
    if not ks or not ck:
        return wf
    wf["900"] = {"class_type": "LoadImage", "inputs": {"image": image_name}}
    wf["901"] = {"class_type": "ImageScale", "inputs": {"image": ["900", 0], "upscale_method": "lanczos",
                                                         "width": width, "height": height, "crop": "center"}}
    wf["902"] = {"class_type": "VAEEncode", "inputs": {"pixels": ["901", 0], "vae": [ck, 2]}}
    wf[ks]["inputs"]["latent_image"] = ["902", 0]
    wf[ks]["inputs"]["denoise"] = denoise
    return wf


def show_models_dir(comfy):
    d = comfy.models_dir()
    if not d:
        print("    ComfyUI 화면의 메뉴에서 models 폴더 열기를 찾아 주세요.")
        return
    print(f"    모델 넣을 폴더: {d}")
    try:
        os.makedirs(d, exist_ok=True)
        if hasattr(os, "startfile"):
            os.startfile(d)
            print("    (그 폴더를 열어 뒀어요)")
    except Exception:
        pass


def find_server(cfg):
    """설정 주소가 안 되면 내 PC의 흔한 포트(8188 일반판, 8000 데스크탑판)를 차례로 찾아본다."""
    tried = [cfg["server"]] + [f"http://127.0.0.1:{p}" for p in (8188, 8000, 8189, 8001)]
    for url in dict.fromkeys(tried):
        if Comfy(url).ok():
            if url != cfg["server"]:
                print(f"  ComfyUI 를 {url} 에서 찾았어요")
                cfg["server"] = url
                save_json(CONFIG, cfg)
            return Comfy(url)
    return None


# ---------------------------------------------------------------- 명령
def cmd_init(args):
    cfg = load_config()
    if args.server:
        cfg["server"] = args.server
    print(f"ComfyUI 연결 확인: {cfg['server']}")
    comfy = Comfy(cfg["server"]) if args.server else find_server(cfg)
    if not comfy or not comfy.ok():
        print("  연결 실패. ComfyUI 가 켜져 있는지, 주소가 맞는지 확인하세요.")
        print("  (다른 주소면: python tools/comfy_gen.py init --server http://주소:포트)")
        save_json(CONFIG, cfg)
        return 1
    print("  연결 성공")
    cks = comfy.checkpoints()
    if cks:
        print("체크포인트 목록:")
        for i, c in enumerate(cks, 1):
            print(f"  {i}. {c}")
        cur = cfg.get("checkpoint")
        default = cks.index(cur) + 1 if cur in cks else 1
        ans = input(f"쓸 체크포인트 번호 [{default}]: ").strip() if sys.stdin.isatty() else ""
        n = int(ans) if ans.isdigit() and 1 <= int(ans) <= len(cks) else default
        cfg["checkpoint"] = cks[n - 1]
        print(f"  → {cfg['checkpoint']}")
    else:
        print("  [!] 체크포인트(그림 모델)를 하나도 못 찾았어요.")
        print("      ComfyUI 의 models\\checkpoints 폴더에 .safetensors 모델을 넣고 ComfyUI 를 다시 켠 뒤 1번을 다시 하세요.")
        print("      또는 tools\\comfy\\config.json 의 \"checkpoint\" 에 모델 파일 이름을 직접 적어도 돼요.")
        show_models_dir(comfy)
    save_json(CONFIG, cfg)
    prompts = build_prompts(cfg, load_json(PROMPTS, {}))
    save_json(PROMPTS, prompts)
    print(f"설정 저장: {os.path.relpath(CONFIG, ROOT)}")
    print(f"프롬프트 {len(prompts)}개: {os.path.relpath(PROMPTS, ROOT)} (자유롭게 고쳐도 돼요)")
    return 0


def select(prompts, cfg, args):
    ids = set(filter(None, (args.ids or "").split(",")))
    kinds = set(filter(None, (args.kinds or "").split(","))) or set(KINDS)
    out = []
    for key, e in prompts.items():
        if ids and e["id"] not in ids:
            continue
        if e["kind"] not in kinds:
            continue
        if args.world and e.get("group") != args.world:
            continue
        if not args.redo and os.path.exists(target_path(cfg, e)):
            continue
        out.append((key, e))
    return out


def cmd_run(args):
    cfg = load_config()
    comfy = find_server(cfg)
    if not comfy:
        print(f"ComfyUI 에 연결할 수 없어요: {cfg['server']}  (ComfyUI 를 켜고 다시 해 주세요)")
        return 1
    if not cfg.get("checkpoint") and "%CHECKPOINT%" in json.dumps(load_json(rel(cfg["workflow"]), {})):
        cks = comfy.checkpoints()
        if not cks:
            print("[!] ComfyUI 에 그림 모델(체크포인트)이 없어요.")
            print("    ComfyUI 의 models\\checkpoints 폴더에 .safetensors 모델을 넣고 ComfyUI 를 다시 켜 주세요.")
            show_models_dir(comfy)
            return 1
        print("쓸 그림 모델을 골라 주세요:")
        for i, c in enumerate(cks, 1):
            print(f"  {i}. {c}")
        ans = input("번호 [1]: ").strip() if sys.stdin.isatty() else ""
        n = int(ans) if ans.isdigit() and 1 <= int(ans) <= len(cks) else 1
        cfg["checkpoint"] = cks[n - 1]
        save_json(CONFIG, cfg)
        print(f"  → {cfg['checkpoint']}")
    prompts = build_prompts(cfg, load_json(PROMPTS, {}))
    save_json(PROMPTS, prompts)
    todo = select(prompts, cfg, args)
    if not todo:
        print("만들 그림이 없어요. (이미 다 있으면 --redo)")
        return 0
    n = args.count or cfg.get("candidates", 4)
    print(f"그림 {len(todo)}종 × 후보 {n}장 생성 시작")
    template = load_json(rel(cfg["workflow"]))
    raw_root = rel(cfg["rawDir"])
    for i, (key, e) in enumerate(todo, 1):
        kc = cfg["kinds"][e["kind"]]
        style = kc.get("style", cfg["style"])
        prompt = f"{e['prompt']}, {style}"
        negative = e.get("negative") or cfg["negative"]
        folder = os.path.join(raw_root, e["kind"], e["id"])
        os.makedirs(folder, exist_ok=True)
        ref = find_ref(e["id"]) if e["kind"] in cfg.get("refKinds", ["sprite"]) else None
        ref_name = None
        if ref:
            try:
                ref_name = comfy.upload(ref)
            except Exception as err:
                print(f"    참고 그림 올리기 실패, 참고 없이 만들어요: {err}")
        print(f"[{i}/{len(todo)}] {e['name']} ({e['kind']}){'  · 참고 그림 사용' if ref_name else ''}")
        saved = []
        for j in range(n):
            seed = random.randint(1, 2**31 - 1) if e.get("seed") is None else e["seed"] + j
            wf = fill_workflow(template, {
                "PROMPT": prompt,
                "NEGATIVE": negative,
                "WIDTH": e.get("width", kc["width"]),
                "HEIGHT": e.get("height", kc["height"]),
                "SEED": seed,
                "STEPS": kc.get("steps", cfg.get("steps", 28)),
                "CFG": kc.get("cfg", cfg.get("cfg", 6.5)),
                "CHECKPOINT": cfg.get("checkpoint", ""),
                "PREFIX": f"incursion/{e['kind']}_{e['id']}",
            })
            if ref_name:
                dn = cfg.get("refDenoise", {}).get(e["kind"], REF_DENOISE[e["kind"]])
                wf = apply_ref(wf, ref_name, e.get("width", kc["width"]), e.get("height", kc["height"]), dn)
            try:
                pid = comfy.queue(wf)
                images = comfy.wait(pid)
            except Exception as err:
                print(f"    실패: {err}")
                continue
            for im in images[:1]:
                data = comfy.download(im)
                idx = len([f for f in os.listdir(folder) if f.endswith(".png")]) + 1
                p = os.path.join(folder, f"{idx}.png")
                with open(p, "wb") as f:
                    f.write(data)
                saved.append(p)
                print(f"    후보 {idx} 저장 (seed {seed})")
        if saved:
            dst = convert(cfg, saved[0], e)
            print(f"    → 게임에 적용: {os.path.relpath(dst, ROOT)}  (다른 후보: pick {e['id']} {e['kind']} 번호)")
    print("끝. 게임을 다시 켜면 반영돼요.")
    return 0


def cmd_pick(args):
    cfg = load_config()
    prompts = build_prompts(cfg, load_json(PROMPTS, {}))
    e = prompts.get(f"{args.id}:{args.kind}")
    if not e:
        print("그런 항목이 없어요. 예: pick heim sprite 2")
        return 1
    src = os.path.join(rel(cfg["rawDir"]), args.kind, args.id, f"{args.n}.png")
    if not os.path.exists(src):
        print(f"후보가 없어요: {src}")
        return 1
    dst = convert(cfg, src, e)
    print(f"적용: {os.path.relpath(dst, ROOT)}")
    return 0


def cmd_status(args):
    cfg = load_config()
    prompts = build_prompts(cfg, load_json(PROMPTS, {}))
    by = {}
    for e in prompts.values():
        g = by.setdefault(e.get("group", "?"), {k: [0, 0] for k in KINDS})
        g[e["kind"]][1] += 1
        if os.path.exists(target_path(cfg, e)):
            g[e["kind"]][0] += 1
    print(f"{'그룹':<12}" + "".join(f"{k:>12}" for k in KINDS))
    for g, v in by.items():
        print(f"{g:<12}" + "".join(f"{(str(v[k][0]) + '/' + str(v[k][1])) if v[k][1] else '-':>12}" for k in KINDS))
    return 0


def menu():
    while True:
        print("\n=== 미니게임-인커젼 그림 자동 생성 (ComfyUI) ===")
        print("1. 처음 설정 / 연결 확인")
        print("2. 빠진 그림 전부 만들기")
        print("3. 종류 골라서 만들기 (게임용 / 일러스트 / ★5 고화질 / 배경)")
        print("4. 특정 캐릭터만 만들기")
        print("5. 후보 바꾸기")
        print("6. 현황 보기")
        print("0. 끝내기")
        c = input("> ").strip()
        ns = argparse.Namespace(server=None, ids=None, kinds=None, world=None, redo=False, count=None)
        if c == "1":
            cmd_init(ns)
        elif c == "2":
            cmd_run(ns)
        elif c == "3":
            k = input("종류 (sprite/art/full/bg, 여러 개는 쉼표): ").strip()
            ns.kinds = k
            cmd_run(ns)
        elif c == "4":
            ns.ids = input("캐릭터 id (쉼표로 여러 개, 목록은 ASSETS.md): ").strip()
            ns.redo = input("이미 있어도 다시 만들까요? (y/N): ").strip().lower() == "y"
            cmd_run(ns)
        elif c == "5":
            parts = input("id 종류 번호 (예: heim sprite 2): ").split()
            if len(parts) == 3 and parts[2].isdigit():
                cmd_pick(argparse.Namespace(id=parts[0], kind=parts[1], n=int(parts[2])))
        elif c == "6":
            cmd_status(ns)
        elif c == "0":
            return 0


def main():
    ap = argparse.ArgumentParser(description="ComfyUI 로 게임 그림 자동 생성")
    sub = ap.add_subparsers(dest="cmd")
    p = sub.add_parser("init")
    p.add_argument("--server")
    p = sub.add_parser("run")
    p.add_argument("--ids")
    p.add_argument("--kinds")
    p.add_argument("--world")
    p.add_argument("--redo", action="store_true")
    p.add_argument("--count", type=int)
    p = sub.add_parser("pick")
    p.add_argument("id")
    p.add_argument("kind", choices=KINDS)
    p.add_argument("n", type=int)
    sub.add_parser("status")
    a = ap.parse_args()
    if a.cmd == "init":
        return cmd_init(a)
    if a.cmd == "run":
        return cmd_run(a)
    if a.cmd == "pick":
        return cmd_pick(a)
    if a.cmd == "status":
        return cmd_status(a)
    return menu()


if __name__ == "__main__":
    sys.exit(main() or 0)
