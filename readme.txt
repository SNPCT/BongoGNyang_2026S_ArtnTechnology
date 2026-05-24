1. 컴퓨터에 Node.js 설치하기

2. 폴더를 다운받은 후에 다음 파일들이 잘 들어있는지 확인
- photo/ (폴더)
- index.html
- style.css
- main.js
- renderer.js
- package.json
- package-lock.json

3. 폴더 안에서 Shift + 마우스 우클릭 → '여기에 PowerShell 창 열기' → 'npm install' 입력해서 라이브러리 설치

4. vscode에서 해당 폴더 연 후에 terminal에서 'npm start' 입력해서 잘 되는지 확인
	기능 1) 고양이 클릭하면 색깔 바뀜
	기능 2) 키보드 클릭하면 좌우반전됨
	기능 3) 마우스 키보드 움직임 반영 (키보드 입력 반응이 안되면 '관리자 권한으로 실행' or 보안 경고창에서 '허용')

5. 'npm rum build:win' 입력하면 dist 폴더 안에 .exe 파일로 설치 파일 만들어짐
