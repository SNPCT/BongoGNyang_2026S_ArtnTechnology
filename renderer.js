const { ipcRenderer } = require('electron'); 
const canvas = document.getElementById('mascotCanvas');
const ctx = canvas.getContext('2d');

let handState = 'middle'; 
let prevMouseX = null;
let leftHandState = 0;
const pressedKeys = new Set(); 

// 1. 상태 변수 정의
// 색상 모드 정의 (RGB)
const colorModes = [
    [255, 255, 255], // 모드 0 (흰색)
    [226, 255, 208], // 모드 1 (연두색)
    [255, 243, 208]  // 모드 2 (연노랑)
];
let mode = 0; 
// 👉 [신규] 좌우 반전 상태 변수 (false: 원래 방향, true: 좌우 반전)
let isFlipped = false; 

// 2. 다각형 클릭 영역 정의 (정수로 정리)
// 색상 변경 영역 (8각형, 이전 프롬프트 좌표)
const colorAreaPolygon = [
    { x: 98, y: 207 }, { x: 225, y: 94 }, { x: 250, y: 64 },
    { x: 280, y: 90 }, { x: 390, y: 140 }, { x: 431, y: 128 },
    { x: 429, y: 200 }, { x: 461, y: 282 }
];

// 👉 [신규] 좌우 반전 트리거 영역 (사각형, image_3.png 좌표 반올림 정리)
const flipAreaQuad = [
    { x: 208, y: 254 }, // P1
    { x: 186, y: 369 }, // P2
    { x: 427, y: 421 }, // P3
    { x: 455, y: 313 }  // P4
];

// 이미지 파일 경로 정의
const imgSrcs = {
    desk: './photo/desk.png', mainRed: './photo/mainred.png', mainNoHand: './photo/mainnohand.png',
    rhmm_m: './photo/rhmm.png', rhmm_c: './photo/rmrmred.png', rhmm_o: './photo/rhmh.png',     
    rhrm_m: './photo/rhrm.png', rhrm_c: './photo/rmrhred.png', rhrm_o: './photo/rhrh.png',
    rhlm_m: './photo/rhlm.png', rhlm_c: './photo/rmrlred.png', rhlm_o: './photo/rhlh.png',
    lh0: './photo/lh0.png', lh1_c: './photo/lh1red.png', lh1: './photo/lh1.png',           
    lh2_c: './photo/lh2red.png', lh2: './photo/lh2.png', lh3_c: './photo/lh3red.png',      
    lh3: './photo/lh3.png', lh4_c: './photo/lh4red.png', lh4: './photo/lh4.png'            
};
const images = {};

// 이미지 로딩 함수
function loadAllImages() {
    const promises = Object.keys(imgSrcs).map(key => {
        return new Promise((resolve) => {
            const img = new Image(); img.src = imgSrcs[key];
            img.onload = () => { images[key] = img; resolve(); };
            img.onerror = () => { images[key] = img; resolve(); };
        });
    });
    return Promise.all(promises);
}
loadAllImages().then(() => { render(); });

// 백그라운드 후킹 신호 수신
ipcRenderer.on('mouse-x', (event, currentMouseX) => {
    if (prevMouseX === null) { prevMouseX = currentMouseX; return; }
    const deltaX = currentMouseX - prevMouseX;
    let newState = handState;
    if (deltaX > 20) newState = 'right'; else if (deltaX < -20) newState = 'left'; else newState = 'middle';
    if (newState !== handState) { handState = newState; render(); }
    prevMouseX = currentMouseX;
});

ipcRenderer.on('global-keydown', (event, key) => {
    if (key === 'space') key = ' '; pressedKeys.add(key); updateLeftHandState();
});
ipcRenderer.on('global-keyup', (event, key) => {
    if (key === 'space') key = ' '; pressedKeys.delete(key); updateLeftHandState();
});

// 키보드 그룹화
function getLeftHandGroup(key) {
    if (['1','2','3','4','5','6','q','w','e','r','t','y'].includes(key)) return 1;
    if (['7','8','9','0','minus','equals','u','i','o','p'].includes(key)) return 2;
    if (['a','s','d','f','g','z','x','c','v','b',' '].includes(key)) return 3;
    if (['h','j','k','l','n','m'].includes(key)) return 4;
    return 0; 
}

function updateLeftHandState() {
    let newState = 0;
    for (let key of pressedKeys) {
        const group = getLeftHandGroup(key);
        if (group !== 0) { newState = group; break; }
    }
    if (leftHandState !== newState) { leftHandState = newState; render(); }
}

// ---------------------------------------------------------
// [공통] 다각형 영역 판별 수학 함수 (Ray-casting 알고리즘)
// ---------------------------------------------------------
function isPointInPolygon(point, vs) {
    var xi, xj, i, j, intersect, x = point.x, y = point.y, inside = false;
    for (i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        xi = vs[i].x; yi = vs[i].y; xj = vs[j].x; yj = vs[j].y;
        intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}
// ---------------------------------------------------------

// --- 스마트 드래그 & 클릭 구분 로직 ---
let isDragging = false;
let dragStartScreenX = 0;
let dragStartScreenY = 0;

window.addEventListener('pointerdown', (e) => {
    isDragging = true;
    dragStartScreenX = e.screenX;
    dragStartScreenY = e.screenY;
    e.target.setPointerCapture(e.pointerId); 
    ipcRenderer.send('drag-start', { x: e.screenX, y: e.screenY });
});

window.addEventListener('pointermove', (e) => {
    if (isDragging) {
        ipcRenderer.send('drag-move', { x: e.screenX, y: e.screenY });
    }
});

window.addEventListener('pointerup', (e) => {
    isDragging = false;
    e.target.releasePointerCapture(e.pointerId);

    // 마우스 누름/뗌 거리 계산 (5픽셀 미만이면 '클릭'으로 판별)
    const diffX = Math.abs(e.screenX - dragStartScreenX);
    const diffY = Math.abs(e.screenY - dragStartScreenY);

    if (diffX < 5 && diffY < 5) {
        // 클릭된 마우스의 창 내부 좌표 계산
        const rect = canvas.getBoundingClientRect();
        let clickedX = e.clientX - rect.left;
        let clickedY = e.clientY - rect.top;

        // 👉 [신규 핵심 로직] 현재 좌우 반전 상태라면, 클릭 좌표도 논리적으로 반전시켜서 판별
        // 사용자는 우측 영역을 클릭하지만, 판별은 원래 좌표계의 좌측 영역에서 이루어지게 함
        if (isFlipped) {
            clickedX = canvas.width - clickedX; // X좌표를 캔버스 너비(500) 기준으로 뒤집음
        }
        
        const clickedPoint = { x: clickedX, y: clickedY };
        
        // 👉 [신규] 1순위: 좌우 반전 트리거 영역 클릭 확인
        if (isPointInPolygon(clickedPoint, flipAreaQuad)) {
            console.log("좌우 반전 구역 클릭됨! 마스코트 방향을 전환합니다.");
            isFlipped = !isFlipped; // 반전 상태 토글
            render(); // 즉시 다시 그리기
            return; // 다른 클릭 이벤트를 방지하기 위해 여기서 종료
        }

        // 2순위: 색상 변경 영역 클릭 확인
        if (isPointInPolygon(clickedPoint, colorAreaPolygon)) {
            console.log("색상 변경 구역 클릭됨! 모드를 전환합니다.");
            mode = (mode + 1) % colorModes.length; 
            render();
            return;
        }
    }
});
// ---------------------------------

// 메인 렌더링 함수
function render() {
    if (Object.keys(images).length < Object.keys(imgSrcs).length) return;
    
    // 캔버스 초기화
    ctx.clearRect(0, 0, canvas.width, canvas.height); 

    // 👉 [신규 핵심 로직] 시각적 좌우 반전 처리
    if (isFlipped) {
        ctx.save(); // 현재 상태 저장
        ctx.translate(canvas.width, 0); // 그리기 원점을 캔버스 오른쪽 끝(500)으로 이동
        ctx.scale(-1, 1); // X축 방향으로 거울처럼 뒤집기 (-1배)
    }

    // --- 반전 상태(Flipped) 상태에서 그려지는 구역 ---
    ctx.drawImage(images.desk, 0, 0, 500, 500); // 책상
    drawColorizedImage(images.mainRed, mode); // 몸통 색칠
    ctx.drawImage(images.mainNoHand, 0, 0, 500, 500); // 선화
    drawLeftHandSystem(); // 왼손(키보드)
    drawRightHandSystem(); // 오른손(마우스)
    // -----------------------------------------------

    // 좌우 반전 그리기 종료
    if (isFlipped) {
        ctx.restore(); // 저장했던 원래 상태(반전 안 된 상태)로 복구
    }
}

// 왼손(키보드) 그리기
function drawLeftHandSystem() {
    if (leftHandState === 0) {
        if (images.lh0.complete) ctx.drawImage(images.lh0, 0, 0, 500, 500);
        return;
    }
    let colorImg, outlineImg;
    if (leftHandState === 1) { colorImg = images.lh1_c; outlineImg = images.lh1; }
    else if (leftHandState === 2) { colorImg = images.lh2_c; outlineImg = images.lh2; }
    else if (leftHandState === 3) { colorImg = images.lh3_c; outlineImg = images.lh3; }
    else if (leftHandState === 4) { colorImg = images.lh4_c; outlineImg = images.lh4; }

    if (!colorImg || !outlineImg) return;
    if (colorImg.complete) drawColorizedImage(colorImg, mode);
    if (outlineImg.complete) ctx.drawImage(outlineImg, 0, 0, 500, 500);
}

// 오른손(마우스) 그리기
function drawRightHandSystem() {
    let mouseImg, colorImg, outlineImg;
    if (handState === 'right') { mouseImg = images.rhrm_m; colorImg = images.rhrm_c; outlineImg = images.rhrm_o; } 
    else if (handState === 'left') { mouseImg = images.rhlm_m; colorImg = images.rhlm_c; outlineImg = images.rhlm_o; } 
    else { mouseImg = images.rhmm_m; colorImg = images.rhmm_c; outlineImg = images.rhmm_o; }

    if (!mouseImg || !colorImg || !outlineImg) return;
    if (mouseImg.complete) ctx.drawImage(mouseImg, 0, 0, 500, 500);
    if (colorImg.complete) drawColorizedImage(colorImg, mode);
    if (outlineImg.complete) ctx.drawImage(outlineImg, 0, 0, 500, 500);
}

// 다중 색상 모드 지원 색상 변환 함수
function drawColorizedImage(img, currentMode) {
    if (!img || !img.complete || !img.width || !img.height) return; 
    
    // 오프스크린 캔버스 생성
    const offCanvas = document.createElement('canvas');
    offCanvas.width = 500; offCanvas.height = 500;
    const offCtx = offCanvas.getContext('2d');
    offCtx.drawImage(img, 0, 0, 500, 500);
    
    // 픽셀 데이터 가져오기
    const imageData = offCtx.getImageData(0, 0, 500, 500);
    const data = imageData.data;
    const targetColor = colorModes[currentMode];

    // 빨간색 영역 감지 및 대체
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i]; const g = data[i + 1]; const b = data[i + 2]; const a = data[i + 3];
        if (a === 0) continue; 
        if (r > 150 && g < 100 && b < 100) {
            data[i] = targetColor[0]; data[i + 1] = targetColor[1]; data[i + 2] = targetColor[2]; 
        }
    }
    
    // 메인 캔버스에 그리기
    offCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(offCanvas, 0, 0, 500, 500);
}