// 넣어야 할 그림 목록을 데이터 파일에서 뽑아 ASSETS.md 와 public/assets/README.txt 로 만든다.
// 사용: npm run assets:list
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (f) => JSON.parse(readFileSync(join(root, 'public/data', f), 'utf8'));
const chars = load('characters.json');
const domains = load('domains.json');
const rar = ['', '일반', '희귀', '영웅', '전설', '초레어'];
const theme = {
  ashen: 'dark fantasy fallen knight kingdom, ash grey and amber palette',
  neon: 'rainy cyberpunk harbor city, neon pink and cyan palette',
  nebula: 'space station drifting through a nebula, deep blue and teal palette',
  rift: 'mysterious dimensional rift, violet and magenta palette',
};
const STYLE = 'high resolution pixel art, clean outlines, limited palette';
const have = (f) => existsSync(join(root, 'public/assets', f));

let md = `# 미니게임-인커젼 그림 목록

그림을 아래 파일 이름으로 저장해서 넣으면 임시 그림 대신 나온다. 없는 파일은 임시 그림이 계속 쓰인다.

- **개발 중**: \`public/assets/\` 아래에 넣는다.
- **exe로 플레이 중**: exe 옆의 \`assets/\` 폴더에 넣고 게임을 다시 켠다. 다시 빌드할 필요 없다.
- AI 원본(1024px 등)은 \`tools/pixelize.py\` 로 진짜 픽셀 크기로 줄여서 넣으면 선명하다.

## 규격

| 종류 | 파일 | 크기 | 배경 |
| --- | --- | --- | --- |
| 게임용 캐릭터 | \`chars/<id>_sprite.png\` | 48×48 (정사각, 발이 아래쪽) | 투명 |
| 도감·대화 일러스트 | \`chars/<id>_art.png\` | 256×256 (정사각 권장) | 투명 또는 자유 |
| 영역 배경 | \`bg/<영역id>.png\` | 640×360 | 꽉 채움 |
| 타이틀 로고 (선택) | \`ui/logo.png\` | 가로 420 이하 | 투명 |

공통 스타일 문구 (모든 프롬프트 끝에 붙여 화풍 통일): \`${STYLE}\`

## 영역 배경

| 파일 | 영역 | 프롬프트 힌트 |
| --- | --- | --- |
${[...domains.map((d) => `| \`bg/${d.id}.png\` | ${d.name} | ${theme[d.id]}, wide landscape, no characters |`), `| \`bg/rift.png\` | 균열 (타이틀·지도·스토리) | ${theme.rift}, stitched fragments of worlds, no characters |`].join('\n')}

## 캐릭터 (${chars.length}명)

| id | 이름 | 등급 | 영역 | 설명 (프롬프트 재료) | 있음 |
| --- | --- | --- | --- | --- | --- |
${chars
  .map((c) => {
    const d = domains.find((x) => x.id === c.domain);
    const ok = (have(`chars/${c.id}_sprite.png`) ? 'S' : '-') + (have(`chars/${c.id}_art.png`) ? 'A' : '-');
    return `| \`${c.id}\` | ${c.name} | ${rar[c.rarity]} | ${d ? d.name : '균열'} | ${c.title}. ${c.desc} | ${ok} |`;
  })
  .join('\n')}

'있음' 칸: S = 게임용 있음, A = 일러스트 있음.
`;
writeFileSync(join(root, 'ASSETS.md'), md);

const txt = `여기에 그림을 넣으면 게임에 반영됩니다. (exe 옆 assets 폴더도 똑같이 동작)

chars/<캐릭터id>_sprite.png   게임용 48x48, 투명 배경
chars/<캐릭터id>_art.png      도감/대화 일러스트 256x256
bg/<영역id>.png               배경 640x360 (ashen, neon, nebula, rift)
ui/logo.png                   타이틀 로고 (선택)

캐릭터 id 와 설명 전체 목록은 ASSETS.md 를 보세요.
캐릭터 id: ${chars.map((c) => c.id).join(', ')}
`;
writeFileSync(join(root, 'public/assets/README.txt'), txt);
console.log('ASSETS.md, public/assets/README.txt 생성');
