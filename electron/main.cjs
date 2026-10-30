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

const distDir = path.join(__dirname, '..', 'dist');
const userDir = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath('exe'));

function resolveFile(rel) {
  const candidates = [];
  if (rel.startsWith('assets/') || rel === 'config.json' || rel.startsWith('data/')) {
    candidates.push(path.join(userDir, rel));
  }
  candidates.push(path.join(distDir, rel));
  for (const p of candidates) {
    const norm = path.normalize(p);
    if (!norm.startsWith(path.normalize(userDir)) && !norm.startsWith(path.normalize(distDir))) continue;
    try {
      if (fs.statSync(norm).isFile()) return norm;
    } catch {
      /* 없음 */
    }
  }
  return null;
}

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
    const file = resolveFile(rel);
    if (!file) return new Response('not found', { status: 404 });
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
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
});

app.on('window-all-closed', () => app.quit());
