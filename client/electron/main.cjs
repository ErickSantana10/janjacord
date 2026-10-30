const { app, BrowserWindow, ipcMain, desktopCapturer, session, shell } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

// Melhora compatibilidade de captura de tela, WebRTC e exclui o próprio áudio do Janjacord no loopback do Windows (Zero Eco!)
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch(
  'enable-features',
  'RestrictOwnAudio,SystemLoopbackAsAecReference,WebRTCPipeWireCapturer'
);

let mainWindow = null;
let selectedSourceId = null;
let selectedShareAudio = true;
let localServer = null;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

function startStaticServer(distDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const parsedUrl = new URL(req.url || '/', 'http://127.0.0.1');
        let pathname = decodeURIComponent(parsedUrl.pathname);
        if (pathname === '/') pathname = '/index.html';

        let filePath = path.join(distDir, pathname);
        // Previne directory traversal
        if (!filePath.startsWith(distDir)) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }

        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          filePath = path.join(distDir, 'index.html');
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        fs.readFile(filePath, (err, content) => {
          if (err) {
            res.writeHead(500);
            res.end('Internal Server Error');
            return;
          }
          res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'no-cache',
          });
          res.end(content);
        });
      } catch (e) {
        res.writeHead(500);
        res.end('Server Error');
      }
    });

    // Tenta usar porta fixa 19847 para manter o localStorage persistente entre sessões
    const tryPorts = [19847, 19848, 19849, 0];
    let portIndex = 0;

    const tryListen = () => {
      const port = tryPorts[portIndex];
      server.once('error', (err) => {
        if (portIndex < tryPorts.length - 1) {
          portIndex++;
          tryListen();
        } else {
          reject(err);
        }
      });
      server.listen(port, '127.0.0.1', () => {
        const address = server.address();
        resolve({ server, port: address.port });
      });
    };

    tryListen();
  });
}

function setupScreenShareAndPermissions() {
  // 1. Concede automaticamente permissões de microfone, câmera e captura de tela
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = [
      'media',
      'display-capture',
      'audioCapture',
      'videoCapture',
      ' desktopCapture',
      'fullscreen',
      'notifications',
    ];
    callback(allowed.includes(permission) || true);
  });

  session.defaultSession.setPermissionCheckHandler(() => true);

  // 2. IPC para listar todas as telas e janelas abertas com miniatura em tempo real
  ipcMain.handle('desktop-capturer:get-sources', async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 480, height: 270 },
        fetchWindowIcons: true,
      });

      return sources.map((source) => ({
        id: source.id,
        name: source.name,
        display_id: source.display_id,
        isScreen: source.id.startsWith('screen:'),
        thumbnail: source.thumbnail.toDataURL(),
        appIcon: source.appIcon ? source.appIcon.toDataURL() : null,
      }));
    } catch (err) {
      console.error('[Electron] Erro ao listar fontes de captura:', err);
      return [];
    }
  });

  // 3. IPC para definir qual tela/janela o usuário escolheu antes de iniciar getDisplayMedia
  ipcMain.handle('desktop-capturer:select-source', (_event, { sourceId, shareAudio }) => {
    selectedSourceId = sourceId || null;
    selectedShareAudio = Boolean(shareAudio);
    return { success: true };
  });

  // 4. Handler nativo para getDisplayMedia no Electron (resolve o bug de transmissão de tela!)
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
      });

      if (!sources || sources.length === 0) {
        callback({});
        return;
      }

      let chosen = null;
      if (selectedSourceId) {
        chosen = sources.find((s) => s.id === selectedSourceId);
      }
      if (!chosen) {
        chosen = sources.find((s) => s.id.startsWith('screen:')) || sources[0];
      }

      const response = { video: chosen };
      if (selectedShareAudio && process.platform === 'win32') {
        response.audio = 'loopback';
      }

      callback(response);
    } catch (err) {
      console.error('[Electron] Erro em setDisplayMediaRequestHandler:', err);
      callback({});
    }
  });

  // 5. Abrir links externos no navegador padrão do usuário
  ipcMain.handle('shell:open-external', async (_event, url) => {
    if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
      await shell.openExternal(url);
    }
  });
}

async function createWindow() {
  const iconPath = fs.existsSync(path.join(__dirname, '../dist/icon.ico'))
    ? path.join(__dirname, '../dist/icon.ico')
    : path.join(__dirname, '../public/icon.ico');

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 840,
    minWidth: 960,
    minHeight: 620,
    title: 'Janjacord',
    backgroundColor: '#090612',
    icon: iconPath,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  // Abre links com target="_blank" no navegador externo
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    await mainWindow.loadURL(devUrl);
  } else {
    const distDir = path.join(__dirname, '../dist');
    const { server, port } = await startStaticServer(distDir);
    localServer = server;
    await mainWindow.loadURL(`http://127.0.0.1:${port}`);
  }
}

app.whenReady().then(async () => {
  setupScreenShareAndPermissions();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (localServer) {
    try {
      localServer.close();
    } catch {}
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
