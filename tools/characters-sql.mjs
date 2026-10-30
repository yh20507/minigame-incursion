// 캐릭터 목록(public/data/characters.json)과 뽑기 설정(gacha.json)을
// Supabase 에 올릴 SQL 로 바꿔 supabase/seed.sql 에 저장한다.
// 사용: npm run db:characters  → 만들어진 seed.sql 을 Supabase SQL Editor 에서 실행
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const chars = JSON.parse(readFileSync(join(root, 'public/data/characters.json'), 'utf8'));
const gacha = JSON.parse(readFileSync(join(root, 'public/data/gacha.json'), 'utf8'));
const items = JSON.parse(readFileSync(join(root, 'public/data/items.json'), 'utf8'));
const rewards = JSON.parse(readFileSync(join(root, 'public/data/rewards.json'), 'utf8'));
const tickets = Object.fromEntries(rewards.tickets.map((t) => [t.id, { world: t.world, rarity: t.rarity ?? 5 }]));
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

const rows = chars.map((c) => `  (${q(c.id)}, ${q(c.origin)}, ${q(c.domain)}, ${c.rarity}, ${c.pool ? 'true' : 'false'})`).join(',\n');
const sql = `-- 자동 생성: tools/characters-sql.mjs (직접 고치지 말고 JSON 을 고친 뒤 다시 생성)
insert into public.mi_characters (id, origin, domain, rarity, pool) values
${rows}
on conflict (id) do update set origin = excluded.origin, domain = excluded.domain, rarity = excluded.rarity, pool = excluded.pool;

insert into public.mi_config (key, value) values
  ('gacha', ${q(JSON.stringify(gacha))}::jsonb),
  ('items', ${q(JSON.stringify(items))}::jsonb),
  ('tickets', ${q(JSON.stringify(tickets))}::jsonb)
on conflict (key) do update set value = excluded.value;
`;
writeFileSync(join(root, 'supabase/seed.sql'), sql);
console.log(`seed.sql 생성: 캐릭터 ${chars.length}명`);
