// 자동 업데이트용 웹 번들 만들기.
// dist 에서 그림·음악을 뺀 게임 코드·데이터만 골라 release/web/ 에 평평한 이름으로 복사하고
// web-version.json(빌드 번호·파일 목록·해시)을 만든다. 같은 web-version.json 을 dist 에도 넣어
// exe 안의 기준 빌드로 삼는다. 만든 release/web/ 의 파일들을 업데이트 주소(config.json 의 updateBase)에 올리면
// 이미 깔린 exe 들이 다음에 켤 때 받아간다.
// 사용: node tools/publish-web.mjs   (npm run build 뒤에)
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const out = join(root, 'release', 'web');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const SKIP = /^(assets\/(chars|bg|audio|items|ui)\/|config\.json$|web-version\.json$)/;
const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else {
      const rel = relative(dist, p).split('\\').join('/');
      if (!SKIP.test(rel)) files.push(rel);
    }
  }
};
walk(dist);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const list = files.map((rel) => {
  const buf = readFileSync(join(dist, rel));
  const name = rel.replace(/\//g, '__');
  cpSync(join(dist, rel), join(out, name));
  return { path: rel, name, size: buf.length, sha256: createHash('sha256').update(buf).digest('hex') };
});
const manifest = { version: 'v' + pkg.version, build: Date.now(), shell: 1, files: list };
writeFileSync(join(out, 'web-version.json'), JSON.stringify(manifest));
writeFileSync(join(dist, 'web-version.json'), JSON.stringify(manifest));
const kb = list.reduce((a, f) => a + f.size, 0) / 1024;
console.log(`웹 번들 v${pkg.version} (빌드 ${manifest.build}): 파일 ${list.length}개 · ${kb.toFixed(0)}KB → release/web/`);
