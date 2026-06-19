const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow = null;
let dynamicPort = 3000;

// 🟢 Configurar modo Electron para que el servidor no abra el navegador por su cuenta
process.env.ELECTRON_MODE = '1';
const expressApp = require('./server');

// 🟢 Iniciar servidor interno en un puerto aleatorio disponible
const localServer = http.createServer(expressApp);

function startServer() {
  return new Promise((resolve) => {
    localServer.listen(0, '127.0.0.1', () => {
      dynamicPort = localServer.address().port;
      console.log('Servidor interno corriendo en puerto:', dynamicPort);
      resolve();
    });
  });
}

// 🟢 Crear la ventana principal 🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'CleanSweep Dev v2',
    backgroundColor: '#0b0f17',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
    show: false,
  });

  mainWindow.loadURL(`http://localhost:${dynamicPort}`);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Abrir links externos en el navegador del sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 🟢 Ciclo de vida de Electron 🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢
app.whenReady().then(async () => {
  await startServer();
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
