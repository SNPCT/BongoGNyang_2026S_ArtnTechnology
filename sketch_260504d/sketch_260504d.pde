PImage img0, img1, img2;
int state = 0;

// 오각형의 좌표 설정 (제공해주신 이미지 기준)
float[] polyX = { 97.2, 151.8, 355.5, 476.0, 463.4 };
float[] polyY = { 209.7, 98.5, 61.9, 202.4, 285.0 };

void setup() {
  size(500, 500);
  
  // 이미지 로드 (경로/파일명 확인 필수)
  img0 = loadImage("img00l.png");
  img1 = loadImage("img10l.png");
  img2 = loadImage("img20l.png");
  
  imageMode(CORNER);
}

void draw() {
  background(255);
  
  // 현재 상태에 따른 이미지 표시
  if (state == 0) image(img0, 0, 0, 500, 500);
  else if (state == 1) image(img1, 0, 0, 500, 500);
  else if (state == 2) image(img2, 0, 0, 500, 500);
}

void mousePressed() {
  // 클릭한 위치(mouseX, mouseY)가 오각형 내부에 있는지 확인
  if (isPointInPolygon(mouseX, mouseY, polyX, polyY)) {
    state = (state + 1) % 3;
    println("이미지 변경! 현재 상태: " + state);
  }
}

// 다각형 내부 클릭 여부를 판별하는 알고리즘 (Ray Casting)
boolean isPointInPolygon(float px, float py, float[] vx, float[] vy) {
  boolean collision = false;
  int n = vx.length;
  
  for (int i = 0; i < n; i++) {
    int next = (i + 1) % n;
    
    // 점이 다각형의 모서리 사이에 있고, 수평 광선이 변과 교차하는지 계산
    if (((vy[i] > py) != (vy[next] > py)) &&
        (px < (vx[next] - vx[i]) * (py - vy[i]) / (vy[next] - vy[i]) + vx[i])) {
      collision = !collision;
    }
  }
  return collision;
}
