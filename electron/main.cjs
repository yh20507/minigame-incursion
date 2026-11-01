// 미니게임-인커젼 데스크톱 실행기 (Electron)
// - 게임 파일은 app://game/ 주소로 제공한다.
// - exe 옆의 assets 폴더와 config.json 이 있으면 그것을 먼저 쓴다.
//   → 그림을 바꿀 때 다시 빌드할 필요 없이 exe 옆 폴더에 넣기만 하면 된다.
const { app, BrowserWindow, Menu, protocol, net, shell, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

const crypto = require('node:crypto');

const distDir = path.join(__dirname, '..', 'dist');
const userDir = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath('exe'));

// ---------- 자동 업데이트 (게임 코드·데이터만, exe 는 그대로) ----------
// 켤 때 UPDATE_BASE/web-version.json 을 확인해서 더 새 빌드가 있으면 그 파일들만 받아
// %APPDATA%/미니게임-인커젼/web 에 두고, 그 폴더를 exe 안 dist 보다 먼저 쓴다.
// 그림·음악은 exe 안의 것을 그대로 쓴다 (용량이 커서 업데이트 대상 아님).
const SHELL_API = 1; // 실행기(main.cjs)가 바뀌어 예전 exe 로는 못 돌리는 빌드가 나오면 올린다
const DEFAULT_UPDATE_BASE = 'https://raw.githubusercontent.com/yh20507/minigame-incursion/web';
const updDir = path.join(app.getPath('appData'), '미니게임-인커젼', 'web');
const stageDir = updDir + '.new';
let useUpd = false;
let updatedTo = null;

function readJSON(f) {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return null;
  }
}
function updateBase() {
  const cfg = readJSON(path.join(userDir, 'config.json')) || readJSON(path.join(distDir, 'config.json')) || {};
  return (cfg.updateBase ?? DEFAULT_UPDATE_BASE).replace(/\/+$/, '');
}
const buildOf = (m) => (m && Number(m.build)) || 0;
function swapStaged() {
  if (!fs.existsSync(path.join(stageDir, 'READY'))) return;
  fs.rmSync(updDir, { recursive: true, force: true });
  fs.renameSync(stageDir, updDir);
}
function pickActive() {
  const dist = readJSON(path.join(distDir, 'web-version.json'));
  const upd = readJSON(path.join(updDir, 'web-version.json'));
  useUpd = !!upd && (upd.shell ?? 1) <= SHELL_API && buildOf(upd) > buildOf(dist);
}
async function checkUpdate() {
  const base = updateBase();
  if (!base) return false;
  const res = await net.fetch(`${base}/web-version.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) return false;
  const remote = await res.json();
  if ((remote.shell ?? 1) > SHELL_API) return false; // 새 exe 가 필요한 빌드
  const local = Math.max(buildOf(readJSON(path.join(distDir, 'web-version.json'))), buildOf(readJSON(path.join(updDir, 'web-version.json'))));
  if (buildOf(remote) <= local) return false;
  fs.rmSync(stageDir, { recursive: true, force: true });
  for (const f of remote.files) {
    const r = await net.fetch(`${base}/${remote.dir ? remote.dir + '/' : ''}${f.name}`);
    if (!r.ok) throw new Error('download ' + f.name + ' ' + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    if (crypto.createHash('sha256').update(buf).digest('hex') !== f.sha256) throw new Error('hash ' + f.name);
    const out = path.join(stageDir, f.path);
    if (!path.normalize(out).startsWith(path.normalize(stageDir))) throw new Error('bad path');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, buf);
  }
  fs.writeFileSync(path.join(stageDir, 'web-version.json'), JSON.stringify(remote));
  fs.writeFileSync(path.join(stageDir, 'READY'), '1');
  return remote.version || String(remote.build);
}

function candidatesFor(rel) {
  const candidates = [];
  // 일러스트는 용량 때문에 exe 안에 .webp 로 들어간다. 게임은 .png 로 요청하므로 같은 이름의 .webp 도 찾아본다.
  const rels = rel.endsWith('.png') ? [rel, rel.slice(0, -4) + '.webp'] : [rel];
  if (rel.startsWith('assets/') || rel === 'config.json' || rel.startsWith('data/')) {
    for (const r of rels) candidates.push(path.join(userDir, r));
  }
  if (useUpd && rel !== 'config.json') for (const r of rels) candidates.push(path.join(updDir, r));
  for (const r of rels) candidates.push(path.join(distDir, r));
  const roots = [userDir, distDir, updDir].map((d) => path.normalize(d));
  return candidates.map((p) => path.normalize(p)).filter((norm) => roots.some((r) => norm.startsWith(r)));
}

/** 바깥 폴더(exe 옆 assets) → 안쪽(dist) 순서로, 실제로 읽히는 첫 파일을 돌려준다.
 *  OneDrive 의 '온라인 전용' 자리표시자처럼 stat 은 되는데 읽기가 실패하는 파일은 건너뛴다. */
function readFirst(rel) {
  for (const norm of candidatesFor(rel)) {
    try {
      if (!fs.statSync(norm).isFile()) continue;
      return { file: norm, data: fs.readFileSync(norm) };
    } catch {
      /* 다음 후보 */
    }
  }
  return null;
}

function resolveFile(rel) {
  const r = readFirst(rel);
  return r ? r.file : null;
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json' };

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 960,
    minHeight: 540,
    icon: require('path').join(__dirname, '..', 'dist', 'icon.png'),
    useContentSize: true,
    backgroundColor: '#07060f',
    title: '미니게임-인커젼',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  Menu.setApplicationMenu(null);
  win.loadURL('app://game/index.html');
  if (updatedTo) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(() => win.webContents.executeJavaScript(`window.__ui && window.__ui.toast(${JSON.stringify('게임이 ' + updatedTo + ' 로 업데이트됐어요')}, 'good')`).catch(() => {}), 4000);
    });
  }
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    } else if (input.key === 'F12') {
      win.webContents.toggleDevTools();
      e.preventDefault();
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(async () => {
  // 음원·그림을 바꿔 넣어도 예전 것이 나오지 않게, 켤 때마다 캐시를 비운다
  await session.defaultSession.clearCache().catch(() => {});
  protocol.handle('app', (req) => {
    const u = new URL(req.url);
    let rel = decodeURIComponent(u.pathname).replace(/^\/+/, '');
    if (!rel) rel = 'index.html';
    const found = readFirst(rel);
    if (!found) return new Response('not found', { status: 404 });
    const file = found.file;
    // 음원·영상은 직접 응답 (구간 요청을 지원해야 재생·이어듣기가 된다)
    const ext = path.extname(file).toLowerCase();
    const MEDIA = { '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.mp4': 'video/mp4', '.webm': 'video/webm' };
    if (MEDIA[ext]) {
      const size = fs.statSync(file).size;
      const headers = { 'Content-Type': MEDIA[ext], 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
      if (req.method === 'HEAD') return new Response(null, { status: 200, headers: { ...headers, 'Content-Length': String(size) } });
      const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
      if (m) {
        const start = m[1] ? Number(m[1]) : 0;
        const end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
        const buf = Buffer.alloc(end - start + 1);
        const fd = fs.openSync(file, 'r');
        fs.readSync(fd, buf, 0, buf.length, start);
        fs.closeSync(fd);
        return new Response(buf, { status: 206, headers: { ...headers, 'Content-Length': String(buf.length), 'Content-Range': `bytes ${start}-${end}/${size}` } });
      }
      return new Response(fs.readFileSync(file), { status: 200, headers: { ...headers, 'Content-Length': String(size) } });
    }
    // 일반 파일은 직접 읽어서 응답 (asar 안/밖, OneDrive 모두 같은 경로로 처리)
    return new Response(found.data, { status: 200, headers: { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': String(found.data.length), 'Cache-Control': 'no-store' } });
  });
  // 지난번에 받아둔 업데이트 적용 → 새 업데이트 확인 (최대 8초, 넘으면 다음에 켤 때 적용)
  try {
    swapStaged();
  } catch {}
  try {
    const job = checkUpdate().catch(() => {
      fs.rmSync(stageDir, { recursive: true, force: true });
      return false;
    });
    const got = await Promise.race([job, new Promise((r) => setTimeout(() => r(false), 8000))]);
    if (got) {
      swapStaged();
      updatedTo = got;
    }
  } catch {
    fs.rmSync(stageDir, { recursive: true, force: true });
  }
  pickActive();
  createWindow();
});

app.on('window-all-closed', () => app.quit());
