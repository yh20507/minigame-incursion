// 미니게임-인커젼 데스크톱 실행기 (Electron)
// - 게임 파일은 app://game/ 주소로 제공한다.
// - exe 옆의 assets 폴더와 config.json 이 있으면 그것을 먼저 쓴다.
//   → 그림을 바꿀 때 다시 빌드할 필요 없이 exe 옆 폴더에 넣기만 하면 된다.
const { app, BrowserWindow, Menu, protocol, net, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
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
    width: 1280,
    height: 720,
    minWidth: 640,
    minHeight: 360,
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

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const u = new URL(req.url);
    let rel = decodeURIComponent(u.pathname).replace(/^\/+/, '');
    if (!rel) rel = 'index.html';
    const file = resolveFile(rel);
    if (!file) return new Response('not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
});

app.on('window-all-closed', () => app.quit());
