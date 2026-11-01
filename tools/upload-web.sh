#!/bin/bash
# release/web/ (tools/publish-web.mjs 결과)을 저장소의 web 브랜치에 올린다.
# exe 들은 https://raw.githubusercontent.com/yh20507/minigame-incursion/web/web-version.json 을 보고 받아간다.
# 빌드마다 b<빌드번호>/ 폴더에 넣어서 GitHub 캐시 때문에 옛 파일을 받는 일이 없게 한다.
set -e
cd "$(dirname "$0")/.."
[ -f release/web/web-version.json ] || { echo "release/web 이 없어요. npm run web 먼저"; exit 1; }
BUILD=$(node -e "console.log(require('./release/web/web-version.json').build)")
TMP=$(mktemp -d)
mkdir -p "$TMP/b$BUILD"
for f in release/web/*; do [ "$(basename "$f")" = web-version.json ] || cp "$f" "$TMP/b$BUILD/"; done
node -e "const m=require('./release/web/web-version.json'); m.dir='b$BUILD'; require('fs').writeFileSync('$TMP/web-version.json', JSON.stringify(m))"
cat > "$TMP/README.md" <<MD
# 자동 업데이트 파일 (자동 생성)
미니게임-인커젼 exe 가 켤 때 받아가는 게임 코드·데이터. 직접 고치지 말 것 — tools/upload-web.sh 가 매번 덮어씀.
MD
cd "$TMP"
git init -q -b web
git add -A
git -c user.name=yh20507 -c user.email=yh20507@gmail.com commit -q -m "web build $BUILD"
git push -q -f "$(git -C "$OLDPWD" remote get-url origin)" web:web
cd - >/dev/null
rm -rf "$TMP"
echo "올림: 빌드 $BUILD → web 브랜치"
