# 미니게임-인커젼

여러 세계가 꿰매어진 '조각세계'에서 30~60초짜리 미니게임으로 코인을 모으고, 차원 균열에서 캐릭터를 불러 수집하는 개인용 게임.

- 영역 3개 (잿빛 왕관 · 네온 하버 · 성운 표류선) + 중심부 최종장
- 미니게임 12개, 보스 스테이지, 번개 모드, 오늘의 도전, 마라톤
- 캐릭터 44명 (뽑기 39 + 실력 해금 4 + 시작 동료 1), 5단계 등급, 공통 천장 (전설 500 / 초레어 2000)
- 편성 (리더 + 서포트 2), 패시브, 돌파, 세트 보너스, 크로스오버 보너스
- 프롤로그부터 엔딩까지 스토리 대화
- 오프라인 저장(이 PC) 또는 Supabase 온라인 저장

## 바로 하기

`release/` 의 `MinigameIncursion-0.1.0-portable.exe` 를 실행한다. 설치가 필요 없다.
압축본(`...-x64.zip`)을 풀어서 `미니게임-인커젼.exe` 를 실행해도 된다.

조작: 방향키 · 스페이스(또는 Z) · 마우스. ESC 일시정지/뒤로, F11 전체화면.

## 그림 넣기

넣어야 할 파일 이름과 캐릭터 설명은 [ASSETS.md](ASSETS.md) 에 있다.

| 상황 | 넣는 곳 |
| --- | --- |
| 압축본 exe 로 플레이 | exe 옆 `assets/chars`, `assets/bg` 폴더 → 게임 다시 켜면 반영 |
| 포터블 exe 로 플레이 | 포터블 exe 와 같은 폴더에 `assets/chars`, `assets/bg` 를 만들어 넣기 |
| 개발 중 / 다시 빌드 | `public/assets/chars`, `public/assets/bg` |

AI 원본을 진짜 픽셀 그림으로 바꾸기:

```
pip install pillow
python tools/pixelize.py 원본.png public/assets/chars/heim_sprite.png --size 48
python tools/pixelize.py 원본.png public/assets/chars/heim_art.png --size 256 --colors 64
python tools/pixelize.py 배경.png public/assets/bg/ashen.png --size 640x360 --keep-bg --fill
```

## ComfyUI 로 그림 자동 생성

내 PC에서 ComfyUI 를 켜 두고 `comfy_images.bat` 을 더블클릭하면 메뉴가 뜬다. (Python 3.9+ 와 `pip install pillow` 필요)

1. 메뉴 1번: ComfyUI 연결 확인, 쓸 체크포인트 고르기, 프롬프트 파일 생성
2. 메뉴 2번: 빠진 그림 전부 생성. 그림마다 후보 4장을 만들고 1번 후보를 게임 규격으로 바꿔 `public/assets` 에 넣는다
3. 마음에 안 들면 메뉴 5번으로 다른 후보 적용 (`art_raw/<종류>/<id>/` 에서 번호 확인)

- 종류: `sprite`(게임용 48×48), `art`(일러스트 256×256), `full`(★5 고화질, 변환 없이 그대로), `bg`(배경 640×360)
- 프롬프트는 `tools/comfy/prompts.json` 에서 그림마다 고칠 수 있다. 고친 줄은 다시 생성해도 덮어쓰지 않는다
- 캐릭터 외형 기본값은 `characters.json` 의 `look` (영어)
- 공통 스타일, 크기, 후보 수, 서버 주소는 `tools/comfy/config.json`
- LoRA 등 자기 워크플로를 쓰려면 ComfyUI 에서 'Save (API Format)' 으로 저장한 JSON 의 프롬프트·크기·시드 자리에 `%PROMPT%`, `%NEGATIVE%`, `%WIDTH%`, `%HEIGHT%`, `%SEED%` 를 넣고 config 의 `workflow` 를 그 파일로 바꾼다
- exe 옆 assets 폴더에 바로 넣으려면 config 의 `assetsDir` 를 그 폴더 경로로 바꾼다

## 음원 넣기와 자르기

`assets/audio` 아래에 mp3 를 넣으면 기본 칩튠 대신 재생된다.

| 파일 | 쓰이는 곳 |
| --- | --- |
| `bgm/<화면>.mp3` (title, lobby, map, gacha, boss, final, result, challenge, micro, story, expedition, 영역·세계관 id) | 화면 배경음 |
| `sfx/<이름>.mp3` (select, confirm, coin, star, jump, hit, tear, flip, pack 등) | 효과음 |
| `chars/<캐릭터id>.mp3` | ★4·★5 뽑기 연출, 도감 일러스트, 로비 주크박스 |
| `worlds/<세계관id>.mp3` | 캐릭터 곡이 없을 때 대신 |

통곡을 자르는 도구 (ffmpeg 필요):

```
python tools/audio_cut.py highlight 원곡.mp3 --to chars/mv_ironman            # 하이라이트 30초 자동
python tools/audio_cut.py highlight 원곡.mp3 --to chars/sl_yuni --start 1:05  # 시작 지점 직접
python tools/audio_cut.py loop 원곡.mp3 --to bgm/lobby                        # 반복용
python tools/audio_cut.py split 앨범.mp3 --out 나눈곡                          # 무음 기준으로 나누기
python tools/audio_cut.py batch 목록.json                                     # 여러 곡 한꺼번에
```

## 콘텐츠 고치기

전부 `public/data/` 의 JSON 이다. 코드를 건드리지 않고 바꿀 수 있다.

| 파일 | 내용 |
| --- | --- |
| `domains.json` | 영역 이름, 색, 소속 미니게임, 보스 조건, 배경음 |
| `minigames.json` | 미니게임 이름, 규칙 설명, 목숨, 별 기준 점수, 코인 배율 |
| `characters.json` | 캐릭터 이름, 등급, 영역, 패시브, 소개, 뽑기 대상 여부 |
| `gacha.json` | 등급 확률, 천장, 가격, 시작 코인 |
| `banners.json` | 균열(배너) 목록 |
| `synergies.json` | 세트·크로스오버 보너스 |
| `challenges.json` | 보스·번개·오늘의 도전·마라톤 규칙 |
| `story.json` | 스토리 대본 |
| `updates.json` | 시즌 (새 소식 창, 한정 균열 묶음) |
| `frontier.json` | 새 대륙 탐사 단계, 좌표 조각 규칙, 원정 보상 |

exe 로 플레이 중이면 exe 옆에 `data/` 폴더를 만들고 바꾼 JSON 을 넣어도 반영된다.
캐릭터나 뽑기 설정을 바꿨고 온라인 저장을 쓰면 `npm run db:characters` 로 `supabase/seed.sql` 을 다시 만들어 Supabase 에서 실행한다.

## 온라인 저장 (Supabase)

1. Supabase SQL Editor 에서 `supabase/schema.sql` → `supabase/seed.sql` 순서로 실행한다. 모든 테이블과 함수 이름이 `mi_` 로 시작해서 기존 프로젝트에 넣어도 겹치지 않는다.
2. exe 옆 `config.json` (개발 중에는 `public/config.json`) 에 프로젝트 주소와 anon(publishable) 키를 넣는다.
   ```json
   { "supabaseUrl": "https://xxxx.supabase.co", "supabaseAnonKey": "eyJ..." }
   ```
3. 게임을 켜면 로그인 창이 나온다. 처음이면 회원가입. (Supabase 기본 설정은 가입 확인 메일이 필요하다. Authentication → Sign In / Providers 에서 'Confirm email' 을 끄면 바로 로그인된다.)

`config.json` 이 비어 있으면 오프라인 저장 모드로 동작한다.

## 개발

```
npm install
npm run dev        # 브라우저에서 http://localhost:5173
npm run build      # 타입 검사 + dist 빌드
npm run app        # Electron 창으로 실행 (build 후)
npm run dist       # Windows exe 만들기 → release/
npm run assets:list  # ASSETS.md 다시 만들기
```

새 미니게임 추가: `src/minigames/` 에 `MiniGame` 을 상속한 파일을 만들고 `registry.ts` 에 한 줄, `minigames.json` 과 `domains.json` 에 항목을 추가한다.

## GitHub 자동 빌드

`.github/workflows/build.yml` 이 들어 있다. `v0.1.1` 같은 태그를 올리면 Windows exe 를 만들어 Releases 에 올린다. 저장소 Settings → Secrets 에 `SUPABASE_URL`, `SUPABASE_ANON_KEY` 를 넣어두면 그 값이 들어간 exe 가 나온다.

## 크레딧

글꼴: [갈무리](https://github.com/quiple/galmuri) (SIL Open Font License 1.1). 효과음과 배경음은 코드로 합성.
