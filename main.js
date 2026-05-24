// [마법의 꼼수 코드] 사라진 util 함수들 강제로 만들어주기
const util = require('util');
if (!util.isObject) { util.isObject = function(obj) { return obj !== null && typeof obj === 'object'; }; }
if (!util.isFunction) { util.isFunction = function(arg) { return typeof arg === 'function'; }; }
if (!util.isString) { util.isString = function(arg) { return typeof arg === 'string'; }; }

const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const { GlobalKeyboardListener } = require("node-global-key-listener");

function createWindow() {
  const win = new BrowserWindow({
    width: 500,
    height: 500,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile('index.html');

  win.webContents.on('did-finish-load', () => {
    setInterval(() => {
      const mouseX = screen.getCursorScreenPoint().x;
      win.webContents.send('mouse-x', mouseX);
    }, 200);

    const keyboardListener = new GlobalKeyboardListener();
    keyboardListener.addListener(function (e, down) {
      const keyName = e.name.toLowerCase(); 
      if (e.state === "DOWN") win.webContents.send('global-keydown', keyName);
      else if (e.state === "UP") win.webContents.send('global-keyup', keyName);
    });
  });

  // [스마트 드래그 기능 수정] parseInt를 사용하여 -0 에러 원천 차단
  let winStartPosition = { x: 0, y: 0 };
  let mouseStartPosition = { x: 0, y: 0 };

  ipcMain.on('drag-start', (event, screenMousePos) => {
      winStartPosition = { x: win.getPosition()[0], y: win.getPosition()[1] };
      mouseStartPosition = screenMousePos;
  });

  ipcMain.on('drag-move', (event, screenMousePos) => {
      const deltaX = screenMousePos.x - mouseStartPosition.x;
      const deltaY = screenMousePos.y - mouseStartPosition.y;

      // 👉 수정된 부분: Math.round 대신 parseInt를 사용하고, 혹시 모를 에러를 대비해 || 0 안전장치 추가
      const newX = parseInt(winStartPosition.x + deltaX, 10) || 0;
      const newY = parseInt(winStartPosition.y + deltaY, 10) || 0;

      win.setPosition(newX, newY);
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});