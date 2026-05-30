const { app, BrowserWindow, ipcMain, dialog, systemPreferences, screen } = require('electron');
const { exec } = require('child_process');
const { GlobalKeyboardListener } = require('node-global-key-listener');

// 👉 권한 확인 및 요청 로직 (macOS 전용 - 영어 버전)
async function checkAndPromptMacPermissions() {
    if (process.platform !== 'darwin') return;

    const isAccessibilityGranted = systemPreferences.isTrustedAccessibilityClient(false);

    if (!isAccessibilityGranted) { 
        const { response } = await dialog.showMessageBox({
            type: 'info',
            title: 'Permission Request',
            message: 'BongoGNyang needs your permission to work perfectly!',
            detail: '1. [Accessibility] permission is required for the cat to react to your keyboard typing.\n2. [Automation] permission is required to display currently playing music.\n\nClick "OK" to open the system permission requests.',
            buttons: ['OK', 'Later'],
            defaultId: 0,
            cancelId: 1
        });

        if (response === 0) {
            systemPreferences.isTrustedAccessibilityClient(true);
            exec(`osascript -e 'tell application "Spotify" to get version'`, () => {});
            exec(`osascript -e 'tell application "Music" to get version'`, () => {});
        }
    }
}

let win;
let settingsWin;
let nowPlayingInterval = null;
let keyReleaseTimeout = null; 
let currentWinMedia = "";

if (process.platform === 'win32') {
    try {
        const { MediaManager } = require('windows-media-controller');
        const mediaManager = new MediaManager();

        mediaManager.on('newSession', (session) => {
            session.on('mediaPropertiesChanged', (info) => {
                if (info.title) {
                    currentWinMedia = info.artist ? `${info.artist} - ${info.title}` : info.title;
                }
            });
            session.on('playbackInfoChanged', (info) => {
                if (info.controls.playbackStatus !== 4) { // 4 = Playing
                    currentWinMedia = "";
                }
            });
        });
        mediaManager.start();
    } catch (e) {
        console.error("Windows 미디어 컨트롤러를 불러올 수 없습니다:", e);
    }
}

function fetchNowPlaying() {
    if (process.platform === 'darwin') {
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
    } else if (process.platform === 'win32') {
        if (win && !win.isDestroyed()) {
            win.webContents.send('now-playing-data', currentWinMedia);
        }
    }
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
        
        if (e.state === "DOWN") {
            win.webContents.send('global-keydown', keyName);
            
            // 👉 [신규 로직] 이미 작동 중인 타이머가 있다면 취소하고 새로 시작
            if (keyReleaseTimeout) clearTimeout(keyReleaseTimeout);
            
            // 1초(1000ms) 후에 자동으로 손을 떼는(lh0 상태로 돌아가는) 이벤트 전송
            keyReleaseTimeout = setTimeout(() => {
                if (!win.isDestroyed()) {
                    win.webContents.send('global-keyup', keyName);
                }
            }, 1000);
            
        } else if (e.state === "UP") {
            // 사용자가 1초가 되기 전에 직접 키를 뗐다면 즉시 상태 복구 및 타이머 취소
            win.webContents.send('global-keyup', keyName);
            if (keyReleaseTimeout) clearTimeout(keyReleaseTimeout);
        }
      }
    });

    fetchNowPlaying(); 
    nowPlayingInterval = setInterval(fetchNowPlaying, 2000);
  });

  // 스냅(Snap) 로직 변수들
  let winStartPosition = { x: 0, y: 0 };
  let mouseStartPosition = { x: 0, y: 0 };
  let isSnapEnabled = true; 
  let isCurrentlySnapped = false; 

  ipcMain.on('drag-start', (event, screenMousePos) => {
      winStartPosition = { x: win.getPosition()[0], y: win.getPosition()[1] };
      mouseStartPosition = screenMousePos;
      isSnapEnabled = true; 
      isCurrentlySnapped = false;
  });
  
  ipcMain.on('drag-move', (event, screenMousePos) => {
      const deltaX = screenMousePos.x - mouseStartPosition.x;
      const deltaY = screenMousePos.y - mouseStartPosition.y;
      
      let targetX = parseInt(winStartPosition.x + deltaX, 10) || 0;
      let targetY = parseInt(winStartPosition.y + deltaY, 10) || 0;

      const currentDisplay = screen.getDisplayNearestPoint({ x: screenMousePos.x, y: screenMousePos.y });
      const bounds = currentDisplay.bounds;
      const workArea = currentDisplay.workArea; 
      
      const winSize = win.getSize();
      const snapMargin = 25; 

      let snappedX = targetX;
      let snappedY = targetY;
      let willSnap = false;

      if (isSnapEnabled) {
          if (targetX < workArea.x + snapMargin) {
              snappedX = workArea.x; willSnap = true;
          } else if (targetX + winSize[0] > workArea.x + workArea.width - snapMargin) {
              snappedX = workArea.x + workArea.width - winSize[0]; willSnap = true;
          }

          if (targetY < bounds.y + snapMargin) {
              snappedY = bounds.y; willSnap = true;
          } else if (targetY + winSize[1] > bounds.y + bounds.height - snapMargin) {
              snappedY = bounds.y + bounds.height - winSize[1]; willSnap = true;
          }
      }

      if (willSnap) {
          win.setPosition(snappedX, snappedY);
          isCurrentlySnapped = true;
      } else {
          win.setPosition(targetX, targetY);
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
  ipcMain.on('resize-settings', (e, height) => { if (settingsWin) settingsWin.setContentSize(320, height); });

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

app.whenReady().then(async () => {
    await checkAndPromptMacPermissions(); 
    createWindow(); 
    
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});