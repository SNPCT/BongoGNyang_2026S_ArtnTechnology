const util = require('util');
if (!util.isObject) { util.isObject = function(obj) { return obj !== null && typeof obj === 'object'; }; }
if (!util.isFunction) { util.isFunction = function(arg) { return typeof arg === 'function'; }; }
if (!util.isString) { util.isString = function(arg) { return typeof arg === 'string'; }; }

const { app, BrowserWindow, screen, ipcMain } = require('electron');
const { GlobalKeyboardListener } = require("node-global-key-listener");
const { exec } = require('child_process'); 

let win;
let settingsWin;
let nowPlayingInterval = null;

function fetchNowPlaying() {
    const script = `
      set nowPlaying to ""
      if application "Spotify" is running then
          tell application "Spotify"
              if player state is playing then set nowPlaying to artist of current track & " - " & name of current track
          end tell
      end if
      if nowPlaying is "" and application "Music" is running then
          tell application "Music"
              if player state is playing then set nowPlaying to artist of current track & " - " & name of current track
          end tell
      end if
      return nowPlaying
    `;
    exec(`osascript -e '${script}'`, (err, stdout) => {
        if (!err && win && !win.isDestroyed()) {
            win.webContents.send('now-playing-data', stdout.trim());
        }
    });
}

function createWindow() {
  win = new BrowserWindow({
    width: 250, height: 250, 
    frame: false, transparent: true, alwaysOnTop: true, resizable: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  win.loadFile('index.html');

  settingsWin = new BrowserWindow({
    width: 320, height: 410,
    frame: false, transparent: true, alwaysOnTop: true, resizable: false, show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  settingsWin.loadFile('settings.html');

  win.webContents.on('did-finish-load', () => {
    setInterval(() => {
      const mouseX = screen.getCursorScreenPoint().x;
      if (!win.isDestroyed()) win.webContents.send('mouse-x', mouseX);
    }, 200);

    const keyboardListener = new GlobalKeyboardListener();
    keyboardListener.addListener(function (e, down) {
      if (!win.isDestroyed()) {
        const keyName = e.name.toLowerCase(); 
        if (e.state === "DOWN") win.webContents.send('global-keydown', keyName);
        else if (e.state === "UP") win.webContents.send('global-keyup', keyName);
      }
    });

    fetchNowPlaying(); 
    nowPlayingInterval = setInterval(fetchNowPlaying, 2000);
  });

  // 👉 고도화된 스냅(Snap) 로직 변수들
  let winStartPosition = { x: 0, y: 0 };
  let mouseStartPosition = { x: 0, y: 0 };
  let isSnapEnabled = true; // 현재 스냅 활성화 상태
  let isCurrentlySnapped = false; // 방금 스냅이 발동했었는지 여부

  ipcMain.on('drag-start', (event, screenMousePos) => {
      winStartPosition = { x: win.getPosition()[0], y: win.getPosition()[1] };
      mouseStartPosition = screenMousePos;
      
      // 창을 새로 집어 들었을 때 스냅 기능 무조건 재활성화
      isSnapEnabled = true; 
      isCurrentlySnapped = false;
  });
  
  ipcMain.on('drag-move', (event, screenMousePos) => {
      const deltaX = screenMousePos.x - mouseStartPosition.x;
      const deltaY = screenMousePos.y - mouseStartPosition.y;
      
      let targetX = parseInt(winStartPosition.x + deltaX, 10) || 0;
      let targetY = parseInt(winStartPosition.y + deltaY, 10) || 0;

      // 현재 마우스가 있는 모니터 정보 가져오기
      const currentDisplay = screen.getDisplayNearestPoint({ x: screenMousePos.x, y: screenMousePos.y });
      
      // bounds: 모니터 전체 영역 (메뉴바, Dock 아래의 '진짜' 끝부분 포함)
      // workArea: 안전 영역 (앱들이 겹치지 않게 보장된 영역)
      const bounds = currentDisplay.bounds;
      const workArea = currentDisplay.workArea; 
      
      const winSize = win.getSize();
      const snapMargin = 25; 

      // 스냅 계산을 위해 임시로 저장할 변수
      let snappedX = targetX;
      let snappedY = targetY;
      let willSnap = false;

      // 👉 스냅 로직 (화면의 '진짜' 끝 bounds와 안전영역 workArea를 모두 판단)
      if (isSnapEnabled) {
          // 좌우 스냅 (안전영역 기준)
          if (targetX < workArea.x + snapMargin) {
              snappedX = workArea.x;
              willSnap = true;
          } else if (targetX + winSize[0] > workArea.x + workArea.width - snapMargin) {
              snappedX = workArea.x + workArea.width - winSize[0];
              willSnap = true;
          }

          // 상하 스냅 (Mac의 '진짜' 바닥을 위해 bounds.height 우선 사용)
          // bounds를 쓰면 Dock 뒤쪽이나 스테이지 매니저 하단까지도 뚫고 진짜 바닥에 붙을 수 있습니다.
          if (targetY < bounds.y + snapMargin) {
              snappedY = bounds.y; // 천장
              willSnap = true;
          } else if (targetY + winSize[1] > bounds.y + bounds.height - snapMargin) {
              snappedY = bounds.y + bounds.height - winSize[1]; // 진짜 바닥
              willSnap = true;
          }
      }

      // 👉 "붙였다 떼면 스냅 무시" 로직
      if (willSnap) {
          // 스냅 조건에 들어왔으므로 위치 고정
          win.setPosition(snappedX, snappedY);
          isCurrentlySnapped = true;
      } else {
          // 스냅 영역 밖으로 나감
          win.setPosition(targetX, targetY);
          
          // 방금까지 스냅 상태였는데 마우스를 더 움직여서(드래그) 영역을 벗어났다면?
          // -> 사용자가 의도적으로 '떼어냈다'고 판단하여 이번 드래그 동안은 스냅 비활성화!
          if (isCurrentlySnapped) {
              isSnapEnabled = false;
              isCurrentlySnapped = false;
          }
      }
  });

  ipcMain.on('toggle-settings', () => { if (settingsWin.isVisible()) settingsWin.hide(); else settingsWin.show(); });
  ipcMain.on('close-settings', () => { settingsWin.hide(); });
  ipcMain.on('quit-app', () => { app.quit(); }); 
  ipcMain.on('resize-window', (e, size) => { if (win) win.setSize(size, size); });
  ipcMain.on('sync-ui', (e, data) => { if (settingsWin) settingsWin.webContents.send('sync-ui', data); });

  ipcMain.on('setting-changed', (e, data) => { 
      if (win) win.webContents.send('apply-setting', data); 
      
      if (data.key === 'isNowPlayingOn') {
          if (data.val) {
              fetchNowPlaying(); 
              nowPlayingInterval = setInterval(fetchNowPlaying, 2000);
          } else {
              if (nowPlayingInterval) clearInterval(nowPlayingInterval);
              if (win && !win.isDestroyed()) win.webContents.send('now-playing-data', "");
          }
      }
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
