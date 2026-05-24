HashMap<String, PImage> images = new HashMap<String, PImage>();

int digit1 = 0; 
int digit2 = 2; 

int pastMouseX = 0;
int lastCheckTime = 0;

boolean isRPressed = false;
boolean isGPressed = false;
boolean isBPressed = false;

// [수정] 프로그램 시작 시 이미지가 아닌 폴더 화면부터 보이도록 false로 시작
boolean showImage = false;

void setup() {
  size(500, 500);
  textAlign(CENTER, CENTER);
  textSize(30);
  
  pastMouseX = mouseX;
  
  // 이미지 로드
  for (int i = 0; i <= 4; i++) {
    for (int j = 1; j <= 3; j++) {
      String imgName = "w" + i + j + ".png";
      PImage img = loadImage(imgName);
      if (img != null) {
        images.put(imgName, img);
      }
    }
  }
}

void draw() {
  // 마우스 움직임 감지 (백그라운드에서 계속 동작)
  if (millis() - lastCheckTime >= 10) {
    int moveDiff = mouseX - pastMouseX;
    if (moveDiff >= 20) digit2 = 3;
    else if (moveDiff <= -20) digit2 = 1;
    else digit2 = 2;
    
    pastMouseX = mouseX;
    lastCheckTime = millis();
  }
  
  // -----------------------------------------
  // 화면 그리기 로직
  // -----------------------------------------
  if (showImage) {
    cursor(ARROW); // 이미지가 켜졌을 때는 기본 커서로 복구
    background(240); 
    
    String currentFileName = "w" + digit1 + digit2 + ".png";
    
    if (images.containsKey(currentFileName)) {
      PImage img = images.get(currentFileName);
      
      if (isRPressed || isGPressed || isBPressed) {
        PImage tempImg = img.copy(); 
        tempImg.loadPixels();        
        
        color targetColor = color(255); 
        if (isRPressed) {
          targetColor = color(255, 0, 0);
        } else if (isGPressed) {
          targetColor = color(150, 255, 50);
        } else if (isBPressed) {
          targetColor = color(135, 206, 235);
        }
        
        for (int i = 0; i < tempImg.pixels.length; i++) {
          color c = tempImg.pixels[i];
          if (red(c) == 255 && green(c) == 255 && blue(c) == 255 && alpha(c) > 0) {
            tempImg.pixels[i] = targetColor;
          }
        }
        
        tempImg.updatePixels(); 
        image(tempImg, 0, 0);   
      } else {
        image(img, 0, 0);
      }
      
    } else {
      fill(0);
      text("Current Image:\n" + currentFileName, width/2, height/2);
    }
    
  } else {
    // -----------------------------------------
    // 폴더 화면 (showImage == false)
    // -----------------------------------------
    background(255); 
    drawFolderIcon(20, 20);
    
    // [추가] 마우스가 폴더 영역(x: 20~110, y: 20~95) 안에 있으면 커서 모양 변경
    if (mouseX >= 20 && mouseX <= 110 && mouseY >= 20 && mouseY <= 95) {
      cursor(HAND); // 클릭 가능한 손가락 모양
    } else {
      cursor(ARROW); // 기본 화살표 모양
    }
  }
}

// 폴더 아이콘 그리기 함수
void drawFolderIcon(int x, int y) {
  pushStyle(); 
  noStroke();  
  
  fill(250, 200, 50); 
  rect(x, y, 35, 15, 5, 5, 0, 0); 
  
  fill(255, 220, 80); 
  rect(x, y + 15, 90, 60, 0, 5, 5, 5); 
  
  popStyle(); 
}

// -----------------------------------------
// [수정] 마우스 클릭 감지
// -----------------------------------------
void mousePressed() {
  if (!showImage) {
    // 폴더 화면일 때 좌클릭 감지
    if (mouseButton == LEFT) {
      // 마우스가 폴더의 영역 안에 있는지 좌표 검사
      if (mouseX >= 20 && mouseX <= 110 && mouseY >= 20 && mouseY <= 95) {
        showImage = true; // 이미지 열기
      }
    }
  } else {
    // 이미지가 열려있을 때 우클릭하면 다시 폴더 화면으로 돌아가는 기능 유지
    if (mouseButton == RIGHT) {
      showImage = false;
    }
  }
}

// -----------------------------------------
// 키보드 감지
// -----------------------------------------
void keyPressed() {
  if (key == 'r' || key == 'R') isRPressed = true;
  if (key == 'g' || key == 'G') isGPressed = true;
  if (key == 'b' || key == 'B') isBPressed = true;
  
  int group = checkKeyGroup(keyCode);
  if (group != 0) {
    digit1 = group;
  }
}

void keyReleased() {
  if (key == 'r' || key == 'R') isRPressed = false;
  if (key == 'g' || key == 'G') isGPressed = false;
  if (key == 'b' || key == 'B') isBPressed = false;
  
  digit1 = 0;
}

int checkKeyGroup(int k) {
  if ((k >= '1' && k <= '6') || k == 'Q' || k == 'W' || k == 'E' || k == 'R' || k == 'T' || k == 'Y') return 1;
  if ((k >= '7' && k <= '9') || k == '0' || k == 111 || k == 61 || k == 'U' || k == 'I' || k == 'O' || k == 'P') return 2;
  if (k == 'A' || k == 'S' || k == 'D' || k == 'F' || k == 'G' || k == 'Z' || k == 'X' || k == 'C' || k == 'V' || k == 'B' || k == ' ') return 3;
  if (k == 'H' || k == 'J' || k == 'K' || k == 'L' || k == 'N' || k == 'M') return 4;
  return 0; 
}
