HashMap<String, PImage> images = new HashMap<String, PImage>();

int digit1 = 0; 
int digit2 = 2; 

int pastMouseX = 0;
int lastCheckTime = 0;

void setup() {
  size(500, 500);
  textAlign(CENTER, CENTER);
  textSize(30);
  
  pastMouseX = mouseX;
  
  // 이미지 로드 (이전과 동일)
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
  background(240);
  
  // 1. 마우스 움직임 감지
  if (millis() - lastCheckTime >= 10) {
    int moveDiff = mouseX - pastMouseX;
    if (moveDiff >= 20) digit2 = 3;
    else if (moveDiff <= -20) digit2 = 1;
    else digit2 = 2;
    
    pastMouseX = mouseX;
    lastCheckTime = millis();
  }
  
  // 2. 파일명 조합 및 출력
  String currentFileName = "w" + digit1 + digit2 + ".png";
  
  if (images.containsKey(currentFileName)) {
    image(images.get(currentFileName), 0, 0);
  } else {
    fill(0);
    text("Current Image:\n" + currentFileName, width/2, height/2);
  }
}

// -----------------------------------------
// 3. 키보드 감지 (keyCode 사용으로 한글 문제 해결)
// -----------------------------------------
void keyPressed() {
  // keyCode는 한글/영문 상관없이 물리적인 키 위치를 알려줍니다.
  int group = checkKeyGroup(keyCode);
  if (group != 0) {
    digit1 = group;
  }
}

void keyReleased() {
  digit1 = 0;
}

// keyCode를 기준으로 그룹 판별
int checkKeyGroup(int k) {
  
  // 그룹 1: 1~6, Q~Y
  if ((k >= '1' && k <= '6') || k == 'Q' || k == 'W' || k == 'E' || k == 'R' || k == 'T' || k == 'Y') return 1;
  
  // 그룹 2: 7~0, -, =, U~P
  if ((k >= '7' && k <= '9') || k == '0' || k == 111 || k == 61 || k == 'U' || k == 'I' || k == 'O' || k == 'P') return 2;
  
  // 그룹 3: A~G, Z~V, B, Space
  if (k == 'A' || k == 'S' || k == 'D' || k == 'F' || k == 'G' || k == 'Z' || k == 'X' || k == 'C' || k == 'V' || k == 'B' || k == ' ') return 3;
  
  // 그룹 4: H~L, N~M
  if (k == 'H' || k == 'J' || k == 'K' || k == 'L' || k == 'N' || k == 'M') return 4;
  
  return 0; 
}
