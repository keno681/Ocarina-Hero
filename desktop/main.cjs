const { app, BrowserWindow, session, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const { PatchEngine } = require('./patch-engine.cjs');
const files = ['index.html', 'style.css', 'app.js'];
let gameWindow, editorWindow, gameDir;
const editorURL = pathToFileURL(path.join(__dirname, 'editor.html')).href;
function verify(event, name) {
  if (!editorWindow || event.sender !== editorWindow.webContents || event.senderFrame.url !== editorURL || (name && !files.includes(name))) throw Error('Accès refusé');
}
function secure(window) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
}
function openEditor() {
  if (editorWindow) { editorWindow.focus(); return; }
  editorWindow = new BrowserWindow({ width: 850, height: 700, autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  secure(editorWindow);
  editorWindow.on('closed', () => { editorWindow = null; });
  editorWindow.loadURL(editorURL);
}
app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  gameDir = path.join(app.getPath('userData'), 'game');
  await fs.mkdir(gameDir, { recursive: true });
  await fs.copyFile(path.join(__dirname, '..', 'gamepad.js'), path.join(gameDir, 'gamepad.js'));
  for (const name of files) {
    try { await fs.copyFile(path.join(__dirname, '..', name), path.join(gameDir, name), require('node:fs').constants.COPYFILE_EXCL); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  const patches = new PatchEngine(gameDir);
  ipcMain.handle('patch:preview', (event, text) => { verify(event); return patches.preview(text); });
  ipcMain.handle('patch:apply', event => { verify(event); const title = patches.apply(); gameWindow?.reload(); return title; });
  ipcMain.handle('patch:undo', event => { verify(event); const title = patches.undo(); gameWindow?.reload(); return title; });
  ipcMain.handle('editor:read', async (event, name) => { verify(event, name); return fs.readFile(path.join(gameDir, name), 'utf8'); });
  ipcMain.handle('editor:save', async (event, name, content) => {
    verify(event, name);
    if (typeof content !== 'string' || Buffer.byteLength(content) > 2_000_000) throw Error('Fichier trop volumineux');
    const target = path.join(gameDir, name);
    await fs.copyFile(target, target + '.bak');
    await fs.writeFile(target + '.tmp', content, 'utf8');
    await fs.rename(target + '.tmp', target);
    gameWindow?.reload();
  });
  ipcMain.handle('editor:restore', async (event, name) => {
    verify(event, name);
    await fs.copyFile(path.join(__dirname, '..', name), path.join(gameDir, name));
    gameWindow?.reload();
    return fs.readFile(path.join(gameDir, name), 'utf8');
  });
  function openGame() {
    gameWindow = new BrowserWindow({ width: 1100, height: 850, minWidth: 400, minHeight: 600, autoHideMenuBar: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
    secure(gameWindow);
    // The button is injected after every load, so editing HTML cannot accidentally remove it.
    gameWindow.webContents.on('did-finish-load', async () => {
      await gameWindow.webContents.executeJavaScript(await fs.readFile(path.join(__dirname, '..', 'gamepad.js'), 'utf8'));
      // Also unlock sound for existing locally edited game files.
      await gameWindow.webContents.executeJavaScript("document.addEventListener('ocarina-unlock-audio', () => { if(typeof context === 'function') context(); });");
      gameWindow.webContents.executeJavaScript(`(() => {
        if(document.getElementById('desktop-editor')) return;
        const b=document.createElement('button'); b.id='desktop-editor'; b.title='Modifier les fichiers du jeu'; b.setAttribute('aria-label',b.title);
        b.style.cssText='position:fixed;right:20px;bottom:20px;width:48px;height:48px;border:3px solid #222;border-radius:50%;background:linear-gradient(#e44848 0 44%,#222 44% 56%,white 56%);z-index:2147483647;cursor:pointer;box-shadow:0 3px 12px #0005';
        b.innerHTML='<span style="position:absolute;left:14px;top:14px;width:14px;height:14px;border:3px solid #222;border-radius:50%;background:white"></span>';
        b.onclick=()=>window.open('ocarina-editor://open');document.body.appendChild(b);
      })()`);
    });
    gameWindow.webContents.setWindowOpenHandler(({ url }) => { if(url === 'ocarina-editor://open') openEditor(); return {action:'deny'}; });
    gameWindow.on('closed', () => { gameWindow = null; editorWindow?.close(); });
    gameWindow.loadFile(path.join(gameDir, 'index.html'));
  }
  openGame();
  app.on('activate', () => { if (!gameWindow) openGame(); });
}).catch(error => { console.error(error); app.quit(); });
app.on('window-all-closed', () => { if(process.platform !== 'darwin') app.quit(); });
