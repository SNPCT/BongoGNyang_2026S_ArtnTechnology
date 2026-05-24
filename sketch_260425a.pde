import java.awt.MouseInfo;
import java.awt.Point;

int prevX = 0;         
int currentX = 0;      
int lastUpdateTime = 0; 
int interval = 50;    
int state = 0; 
int activeGroup = 0; 

boolean isBlueBlackMode = false; 
int bgMode = 0;                 
boolean showEyes = false;        

void setup() {
  size(400, 400);
  pixelDensity(displayDensity()); 
  background(255);
  
  Point mouse = MouseInfo.getPointerInfo().getLocation();
  prevX = mouse.x;
}

void draw() {
  if (bgMode == 0) {
    background(255); 
  } else if (bgMode == 1) {
    background(153, 255, 255); 
  } else if (bgMode == 2) {
    background(255, 204, 204);
  } else if (bgMode == 3) {
    background(229, 255, 204); 
  }
  
  // 2. 마우스 위치 및 사각형 로직 (기존과 동일)
  if (millis() - lastUpdateTime >= interval) {
    Point mouse = MouseInfo.getPointerInfo().getLocation();
    currentX = mouse.x;
    int diff = currentX - prevX; 
    if (diff >= 50) state = 2;
    else if (diff < -50) state = 1;
    else state = 0; 
    prevX = currentX;
    lastUpdateTime = millis();
  }
  
  // 3. 중앙 사각형 그리기
  rectMode(CENTER);
  noStroke();
  if (state == 1) { 
    if (isBlueBlackMode) fill(0, 0, 255); 
    else fill(255, 0, 0);                 
    rect(width/2, height/2, 100, 100); 
  } 
  else if (state == 2) { 
    if (isBlueBlackMode) fill(0);          
    else fill(0, 255, 0);                  
    rect(width/2, height/2, 100, 100); 
  }
  
  // 4. 마우스 클릭 시 옆에 뜨는 원
  if (mousePressed) {
    if (mouseButton == LEFT) { fill(0, 255, 0); ellipse(width/2 - 120, height/2, 50, 50); }
    else if (mouseButton == RIGHT) { fill(255, 0, 0); ellipse(width/2 + 120, height/2, 50, 50); }
  }

  // 5. 키보드 그룹 원
  if (activeGroup != 0) {
    if (activeGroup == 1) fill(0, 0, 255);
    else if (activeGroup == 2) fill(255, 0, 0);
    else if (activeGroup == 3) fill(0, 255, 0);
    else if (activeGroup == 4) fill(255, 255, 0);
    ellipse(width/2, height/2 + 120, 50, 50);
  }
  
  // 6. 눈 그리기
  if (showEyes) {
    fill(0); 
    ellipse(150, 40, 20, 20); 
    ellipse(250, 40, 20, 20);
  }
}

// 클릭 시 토글 및 순환 기능
void mousePressed() {
  // 왼쪽 위: 모드 토글
  if (mouseX < 200 && mouseY < 200) {
    isBlueBlackMode = !isBlueBlackMode;
  } 
  // [수정] 오른쪽 위: 배경색 4단계 순환
  else if (mouseX >= 200 && mouseY < 200) {
    bgMode = (bgMode + 1) % 4; // 0 -> 1 -> 2 -> 3 -> 0 순환
  }
  // 왼쪽 아래: 눈 토글
  else if (mouseX < 200 && mouseY >= 200) {
    showEyes = !showEyes;
  }
}

void keyPressed() {
  if (keyCode == '1' || keyCode == '2' || keyCode == '3' || keyCode == 'Q' || keyCode == 'W' || keyCode == 'E') activeGroup = 1;
  else if (keyCode == '4' || keyCode == '5' || keyCode == '6' || keyCode == 'R' || keyCode == 'T' || keyCode == 'Y') activeGroup = 2;
  else if (keyCode == '7' || keyCode == '8' || keyCode == '9' || keyCode == 'U' || keyCode == 'I' || keyCode == 'O') activeGroup = 3;
  else if (keyCode == '0' || keyCode == 45 || keyCode == 61 || keyCode == 'P' || keyCode == 91 || keyCode == 93) activeGroup = 4;
}

void keyReleased() {
  activeGroup = 0;
}
