const { ipcRenderer } = require('electron'); 
const canvas = document.getElementById('mascotCanvas');
const ctx = canvas.getContext('2d');

let handState = 'middle'; let prevMouseX = null; let leftHandState = 0; const pressedKeys = new Set(); 

const colorModes = [ [255, 255, 255], [226, 255, 208], [255, 243, 208], [0, 0, 0] ];
let mode = 0; let isFlipped = false; let isHeadphoneOn = false; let isSunglassesOn = false;
let isEyeBlinkOn = true; let isBlinking = false; let blinkTimeout = null;

const settingsAreaQuad = [ { x: 220, y: 249 }, { x: 198, y: 337 }, { x: 443, y: 392 }, { x: 463, y: 306 } ];

const imgSrcs = {
    desk: './photo/desk.png', mainRed: './photo/mainred.png', mainNoHand: './photo/mainnohand.png',
    mainNoHandBlink: './photo/mainnohandblink.png', 
    rhmm_m: './photo/rhmm.png', rhmm_c: './photo/rmrmred.png', rhmm_o: './photo/rhmh.png',     
    rhrm_m: './photo/rhrm.png', rhrm_c: './photo/rmrhred.png', rhrm_o: './photo/rhrh.png',
    rhlm_m: './photo/rhlm.png', rhlm_c: './photo/rmrlred.png', rhlm_o: './photo/rhlh.png',
    lh0: './photo/lh0.png', lh1_c: './photo/lh1red.png', lh1: './photo/lh1.png',           
    lh2_c: './photo/lh2red.png', lh2: './photo/lh2.png', lh3_c: './photo/lh3red.png',      
    lh3: './photo/lh3.png', lh4_c: './photo/lh4red.png', lh4: './photo/lh4.png',
    headphonel: './photo/headphonel.png', headphoner: './photo/headphoner.png', sunglasses: './photo/sunglasses.png',
    uppertimer: './photo/uppertimer.png'
};
const images = {};

const offCanvas = document.createElement('canvas'); offCanvas.width = 500; offCanvas.height = 500;
const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

let isNowPlayingOn = true; let currentNowPlayingData = ""; const appStartTime = Date.now(); 

// 👉 시계/타이머/스톱워치 전역 상태
let clockMode = 'off'; // off, system, timer, stopwatch
let systemColor = 0;
let system24h = true;

let timerState = 'idle'; // idle, running, paused, blinking
let timerColor = 0;
let timerTargetMs = 0;
let timerPausedRemaining = 0;
let timerRemainingSecs = 0;
let blinkStartTime = 0;

let stopwatchState = 'idle'; // idle, running, paused
let stopwatchColor = 0;
let stopwatchStartMs = 0;
let stopwatchElapsedMs = 0;

function loadAllImages() {
    return Promise.all(Object.keys(imgSrcs).map(key => new Promise(resolve => {
        const img = new Image(); img.src = imgSrcs[key];
        img.onload = () => { images[key] = img; resolve(); }; img.onerror = () => { images[key] = img; resolve(); };
    })));
}

const customFonts = [
    new FontFace('CorporateLogo', "url('./fonts/Corporate-Logo-Rounded-Bold-ver3.otf')"),
    new FontFace('Tmoney', "url('./fonts/TmoneyRoundWindExtraBold.ttf')"),
    new FontFace('Mplus', "url('./fonts/rounded-x-mplus-2p-bold.ttf')")
];

Promise.allSettled(customFonts.map(font => font.load())).then((results) => {
    results.forEach((result, index) => { if (result.status === 'fulfilled') document.fonts.add(result.value); });
    loadAllImages().then(() => { scheduleNextBlink(); requestAnimationFrame(animationLoop); });
});

// 타이머 및 스톱워치 틱(Tick)
setInterval(() => {
    if (clockMode === 'timer') {
        if (timerState === 'running') {
            timerRemainingSecs = Math.max(0, Math.ceil((timerTargetMs - Date.now()) / 1000));
            if (timerRemainingSecs <= 0) { timerState = 'blinking'; blinkStartTime = Date.now(); }
        } else if (timerState === 'blinking') {
            if (Date.now() - blinkStartTime > 60000) { timerState = 'idle'; }
        }
        ipcRenderer.send('sync-ui', { key: 'timer-sync', state: timerState, remaining: timerRemainingSecs });
    } else if (clockMode === 'stopwatch') {
        if (stopwatchState === 'running') {
            stopwatchElapsedMs = Date.now() - stopwatchStartMs;
        }
        ipcRenderer.send('sync-ui', { key: 'stopwatch-sync', state: stopwatchState });
    }
}, 500);

function scheduleNextBlink() {
    if (blinkTimeout) clearTimeout(blinkTimeout);
    if (!isEyeBlinkOn) { if (isBlinking) { isBlinking = false; render(); } return; }
    const delay = Math.random() * 7000 + 5000; 
    blinkTimeout = setTimeout(() => {
        if (!isEyeBlinkOn) return; isBlinking = true; render();
        setTimeout(() => { isBlinking = false; render(); scheduleNextBlink(); }, Math.random() * 300 + 100); 
    }, delay);
}

ipcRenderer.on('mouse-x', (e, x) => { if (prevMouseX === null) { prevMouseX = x; return; }
    const dx = x - prevMouseX; let ns = handState;
    if (dx > 20) ns = 'right'; else if (dx < -20) ns = 'left'; else ns = 'middle';
    if (ns !== handState) { handState = ns; render(); } prevMouseX = x; });
ipcRenderer.on('global-keydown', (e, k) => { if (k==='space') k=' '; pressedKeys.add(k); updateLeftHandState(); });
ipcRenderer.on('global-keyup', (e, k) => { if (k==='space') k=' '; pressedKeys.delete(k); updateLeftHandState(); });
ipcRenderer.on('now-playing-data', (e, text) => { if (currentNowPlayingData !== text) { currentNowPlayingData = text; render(); } });

function getLeftHandGroup(key) {
    if (['1','2','3','4','5','6','q','w','e','r','t','y'].includes(key)) return 1;
    if (['7','8','9','0','minus','equals','u','i','o','p'].includes(key)) return 2;
    if (['a','s','d','f','g','z','x','c','v','b',' '].includes(key)) return 3;
    if (['h','j','k','l','n','m'].includes(key)) return 4; return 0; 
}
function updateLeftHandState() {
    let ns = 0; for (let key of pressedKeys) { ns = getLeftHandGroup(key); if (ns !== 0) break; }
    if (leftHandState !== ns) { leftHandState = ns; render(); }
}
function isPointInPolygon(point, vs) {
    let x = point.x, y = point.y, inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i].x, yi = vs[i].y, xj = vs[j].x, yj = vs[j].y;
        if (((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    } return inside;
}

ipcRenderer.on('apply-setting', (e, data) => {
    if (data.key === 'mode') mode = data.val;
    if (data.key === 'isFlipped') isFlipped = data.val;
    if (data.key === 'isSunglassesOn') isSunglassesOn = data.val;
    if (data.key === 'isHeadphoneOn') isHeadphoneOn = data.val;
    if (data.key === 'isNowPlayingOn') isNowPlayingOn = data.val; 
    if (data.key === 'isEyeBlinkOn') { isEyeBlinkOn = data.val; scheduleNextBlink(); } 
    
    if (data.key === 'clockMode') clockMode = data.val;
    if (data.key === 'systemColor') systemColor = data.val;
    if (data.key === 'system24h') system24h = data.val;
    if (data.key === 'timerColor') timerColor = data.val;
    if (data.key === 'stopwatchColor') stopwatchColor = data.val;
    
    if (data.key === 'timer-command') {
        if (data.action === 'start') {
            timerState = 'running'; timerColor = data.color;
            timerRemainingSecs = data.duration; timerTargetMs = Date.now() + (data.duration * 1000);
        } else if (data.action === 'pause') { timerState = 'paused'; timerPausedRemaining = timerRemainingSecs;
        } else if (data.action === 'resume') { timerState = 'running'; timerTargetMs = Date.now() + (timerPausedRemaining * 1000);
        } else if (data.action === 'stop' || data.action === 'clear') {
            timerState = 'idle'; ipcRenderer.send('sync-ui', { key: 'timer-sync', state: 'idle' });
        }
    } else if (data.key === 'stopwatch-command') {
        if (data.action === 'start') {
            stopwatchState = 'running'; stopwatchColor = data.color;
            stopwatchElapsedMs = 0; stopwatchStartMs = Date.now();
        } else if (data.action === 'pause') {
            stopwatchState = 'paused'; stopwatchElapsedMs = Date.now() - stopwatchStartMs;
        } else if (data.action === 'resume') {
            stopwatchState = 'running'; stopwatchStartMs = Date.now() - stopwatchElapsedMs;
        } else if (data.action === 'reset' || data.action === 'clear') {
            stopwatchState = 'idle'; stopwatchElapsedMs = 0;
            ipcRenderer.send('sync-ui', { key: 'stopwatch-sync', state: 'idle' });
        }
    }
    render();
});

let isDragging = false; let dragStartScreenX = 0; let dragStartScreenY = 0;
window.addEventListener('pointerdown', (e) => { isDragging = true; dragStartScreenX = e.screenX; dragStartScreenY = e.screenY; e.target.setPointerCapture(e.pointerId); ipcRenderer.send('drag-start', { x: e.screenX, y: e.screenY }); });
window.addEventListener('pointermove', (e) => { if (isDragging) ipcRenderer.send('drag-move', { x: e.screenX, y: e.screenY }); });
window.addEventListener('pointerup', (e) => {
    if (!isDragging) return; isDragging = false; e.target.releasePointerCapture(e.pointerId);
    if (Math.abs(e.screenX - dragStartScreenX) < 5 && Math.abs(e.screenY - dragStartScreenY) < 5) {
        const rect = canvas.getBoundingClientRect();
        let clickedX = (e.clientX - rect.left) * (canvas.width / rect.width); let clickedY = (e.clientY - rect.top) * (canvas.height / rect.height);
        if (isFlipped) clickedX = canvas.width - clickedX; 
        const cp = { x: clickedX, y: clickedY };
        
        // Timer 영역 클릭 제어
        if (clockMode === 'timer' && timerState === 'blinking') {
            if (cp.x >= 127.3 && cp.x <= 407.7 && cp.y >= 24.0 && cp.y <= 69.2) {
                timerState = 'idle'; ipcRenderer.send('sync-ui', { key: 'timer-sync', state: 'idle' }); render(); return; 
            }
        }
        
        // 👉 [핵심 로직] Stopwatch 영역 클릭 시 일시정지/재개
        if (clockMode === 'stopwatch' && (stopwatchState === 'running' || stopwatchState === 'paused')) {
            if (cp.x >= 127.3 && cp.x <= 407.7 && cp.y >= 24.0 && cp.y <= 69.2) {
                if (stopwatchState === 'running') {
                    stopwatchState = 'paused'; stopwatchElapsedMs = Date.now() - stopwatchStartMs;
                } else {
                    stopwatchState = 'running'; stopwatchStartMs = Date.now() - stopwatchElapsedMs;
                }
                ipcRenderer.send('sync-ui', { key: 'stopwatch-sync', state: stopwatchState });
                render(); return;
            }
        }
        
        if (isPointInPolygon(cp, settingsAreaQuad)) { ipcRenderer.send('toggle-settings'); return; }
    }
});

let lastTime = 0;
function animationLoop(timestamp) {
    requestAnimationFrame(animationLoop);
    if (timestamp - lastTime < 33) return; lastTime = timestamp;
    let elapsed = Date.now() - appStartTime;
    if (elapsed < 6000 || isNowPlayingOn || clockMode === 'system' || (clockMode === 'timer' && timerState !== 'idle') || clockMode === 'stopwatch') render();
}

function drawInvertedImage(img) {
    if (!img || !img.complete || !img.width || !img.height) return; 
    offCtx.clearRect(0, 0, 500, 500); offCtx.drawImage(img, 0, 0, 500, 500);
    const imageData = offCtx.getImageData(0, 0, 500, 500); const data = imageData.data; 
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue; 
        data[i] = 255 - data[i]; data[i + 1] = 255 - data[i + 1]; data[i + 2] = 255 - data[i + 2]; 
    }
    offCtx.putImageData(imageData, 0, 0); ctx.drawImage(offCanvas, 0, 0, 500, 500);
}

// 통합 레이어 렌더링
function drawClockLayer() {
    if (clockMode === 'off') return;
    if (clockMode === 'timer' && timerState === 'idle') return;
    
    const img = images.uppertimer; if (!img || !img.complete) return;
    
    offCtx.clearRect(0, 0, 500, 500); offCtx.drawImage(img, 0, 0, 500, 500);
    const imageData = offCtx.getImageData(0, 0, 500, 500); const data = imageData.data;
    
    let activeColorMode = (clockMode === 'system') ? systemColor : ((clockMode === 'timer') ? timerColor : stopwatchColor);
    const tColors = [ [255, 255, 255], [226, 255, 208], [255, 243, 208], [255, 210, 201], [201, 242, 255], [0, 0, 0] ];
    let tc = tColors[activeColorMode];
    let isOlive = (activeColorMode === 5);

    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;
        let r = data[i], g = data[i + 1], b = data[i + 2];
        let isRedMask = (r > 150 && g < 100 && b < 100);

        if (isOlive) {
            if (isRedMask) { data[i] = 255; data[i+1] = 255; data[i+2] = 255; }
            data[i] = 255 - data[i]; data[i+1] = 255 - data[i+1]; data[i+2] = 255 - data[i+2];
        } else {
            if (isRedMask) { data[i] = tc[0]; data[i + 1] = tc[1]; data[i + 2] = tc[2]; }
        }
    }
    offCtx.putImageData(imageData, 0, 0); 
    ctx.drawImage(offCanvas, 0, 0, 500, 500);

    ctx.save();
    ctx.font = "26px 'Mplus', Arial"; 
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    let textColor = isOlive ? "#ffffff" : "#000000";
    let timeStr = "";

    if (clockMode === 'timer') {
        if (timerState === 'blinking' && Math.floor((Date.now() - blinkStartTime) / 1000) % 2 === 0) textColor = "#ff3b30";
        let h = Math.floor(timerRemainingSecs / 3600); let m = Math.floor((timerRemainingSecs % 3600) / 60); let s = timerRemainingSecs % 60;
        timeStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    } else if (clockMode === 'system') {
        let d = new Date(); let h = d.getHours(); let m = d.getMinutes(); let s = d.getSeconds(); let ampm = "";
        if (!system24h) { ampm = h >= 12 ? " PM" : " AM"; h = h % 12; if (h === 0) h = 12; }
        timeStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}${ampm}`;
        if (!system24h) ctx.font = "22px 'Mplus', Arial";
    } else if (clockMode === 'stopwatch') {
        // 👉 스톱워치는 항상(idle, running, paused) 시간을 표시함
        let totalSecs = Math.floor(stopwatchElapsedMs / 1000);
        let h = Math.floor(totalSecs / 3600); let m = Math.floor((totalSecs % 3600) / 60); let s = totalSecs % 60;
        timeStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }
    
    ctx.fillStyle = textColor;
    ctx.fillText(timeStr, 267.5, 48.0);
    ctx.restore();
}

function render() {
    if (Object.keys(images).length < Object.keys(imgSrcs).length) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height); 
    
    if (isFlipped) { ctx.save(); ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
    
    let currentBodyOutline = (isBlinking && images.mainNoHandBlink.complete) ? images.mainNoHandBlink : images.mainNoHand;
    drawColorizedImage(images.mainRed, mode); 
    if (isHeadphoneOn && images.headphonel.complete) { if (mode === 3) drawInvertedImage(images.headphonel); else ctx.drawImage(images.headphonel, 0, 0, 500, 500); }
    if (mode === 3) drawInvertedImage(currentBodyOutline); else ctx.drawImage(currentBodyOutline, 0, 0, 500, 500);
    if (isSunglassesOn && images.sunglasses.complete) { if (mode === 3) drawInvertedImage(images.sunglasses); else ctx.drawImage(images.sunglasses, 0, 0, 500, 500); }
    if (isHeadphoneOn && images.headphoner.complete) { if (mode === 3) drawInvertedImage(images.headphoner); else ctx.drawImage(images.headphoner, 0, 0, 500, 500); }
    
    ctx.drawImage(images.desk, 0, 0, 500, 500); 
    drawLeftHandSystem(); drawRightHandSystem(); 
    
    if (isFlipped) { ctx.restore(); }
    drawClockLayer();

    drawToastMessage();
    if (isNowPlayingOn && currentNowPlayingData) drawNowPlaying(); 
}

function drawToastMessage() {
    let elapsed = Date.now() - appStartTime;
    if (elapsed > 6000) return; 
    let alpha = 1; if (elapsed > 3000) alpha = 1 - ((elapsed - 3000) / 3000); 
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = "rgba(50, 50, 50, 0.9)";
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(50, 200, 400, 100, 10) : ctx.rect(50, 200, 400, 100); ctx.fill();
    ctx.font = "20px Tmoney"; ctx.fillStyle = "#ffffff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; 
    ctx.fillText("Click keyboard to open settings", 250, 250); ctx.restore();
}

function drawNowPlaying() {
    ctx.save(); ctx.font = "35px 'CorporateLogo', 'Mplus', 'Tmoney', Arial"; ctx.fillStyle = "#000000"; ctx.textBaseline = "middle"; 
    let text = currentNowPlayingData; let textWidth = ctx.measureText(text).width; let boxWidth = 400; 
    ctx.beginPath(); ctx.rect(50, 400, boxWidth, 60); ctx.clip(); 
    let xPos = 250; ctx.textAlign = "center"; 
    if (textWidth > boxWidth) {
        ctx.textAlign = "left"; let maxOffset = textWidth - boxWidth; let moveTime = (maxOffset / 80) * 1000;
        let totalCycleTime = 3000 + moveTime + 3000 + moveTime; let cycle = Date.now() % totalCycleTime; let offset = 0;
        if (cycle < 3000) offset = 0;
        else if (cycle < 3000 + moveTime) offset = maxOffset * ((cycle - 3000) / moveTime);
        else if (cycle < 6000 + moveTime) offset = maxOffset;
        else offset = maxOffset * (1 - ((cycle - (6000 + moveTime)) / moveTime));
        xPos = 50 - offset; 
    }
    ctx.fillText(text, xPos, 430); ctx.restore();
}

function drawLeftHandSystem() {
    if (leftHandState === 0) { if (images.lh0.complete) { if (mode === 3) drawInvertedImage(images.lh0); else ctx.drawImage(images.lh0, 0, 0, 500, 500); } return; }
    let colorImg, outlineImg;
    if (leftHandState === 1) { colorImg = images.lh1_c; outlineImg = images.lh1; }
    else if (leftHandState === 2) { colorImg = images.lh2_c; outlineImg = images.lh2; }
    else if (leftHandState === 3) { colorImg = images.lh3_c; outlineImg = images.lh3; }
    else if (leftHandState === 4) { colorImg = images.lh4_c; outlineImg = images.lh4; }
    if (!colorImg || !outlineImg) return;
    if (colorImg.complete) drawColorizedImage(colorImg, mode);
    if (outlineImg.complete) { if (mode === 3) drawInvertedImage(outlineImg); else ctx.drawImage(outlineImg, 0, 0, 500, 500); }
}

function drawRightHandSystem() {
    let mouseImg, colorImg, outlineImg;
    if (handState === 'right') { mouseImg = images.rhrm_m; colorImg = images.rhrm_c; outlineImg = images.rhrm_o; } 
    else if (handState === 'left') { mouseImg = images.rhlm_m; colorImg = images.rhlm_c; outlineImg = images.rhlm_o; } 
    else { mouseImg = images.rhmm_m; colorImg = images.rhmm_c; outlineImg = images.rhmm_o; }
    if (!mouseImg || !colorImg || !outlineImg) return;
    if (mouseImg.complete) ctx.drawImage(mouseImg, 0, 0, 500, 500); 
    if (colorImg.complete) drawColorizedImage(colorImg, mode);
    if (outlineImg.complete) { if (mode === 3) drawInvertedImage(outlineImg); else ctx.drawImage(outlineImg, 0, 0, 500, 500); }
}

function drawColorizedImage(img, currentMode) {
    if (!img || !img.complete || !img.width || !img.height) return; 
    offCtx.clearRect(0, 0, 500, 500); offCtx.drawImage(img, 0, 0, 500, 500);
    const imageData = offCtx.getImageData(0, 0, 500, 500); const data = imageData.data;
    const targetColor = colorModes[currentMode];
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue; 
        if (data[i] > 150 && data[i + 1] < 100 && data[i + 2] < 100) { data[i] = targetColor[0]; data[i + 1] = targetColor[1]; data[i + 2] = targetColor[2]; }
    }
    offCtx.putImageData(imageData, 0, 0); ctx.drawImage(offCanvas, 0, 0, 500, 500);
}