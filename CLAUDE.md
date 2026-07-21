---
user_level: "advanced"
compliance: not_required
---

# my-food-map (Juno 맛집 리스트)

개인용 맛집 기록 웹앱. 지도(Naver Maps), 사진, 평점, 방문 기록, 시·도/세부지역/카테고리/태그 필터를 제공. 데이터는 브라우저 `localStorage`에만 저장 — 서버/DB 없음.

## 기술 스택
- 순수 HTML/CSS/JS (ES Modules). **빌드 도구, 프레임워크, npm 의존성 없음** — 새 기능을 추가할 때도 이 원칙을 유지할 것 (React/Vite/번들러 도입 금지, 필요 없음).
- 로컬 서버: `server.mjs` (Node 내장 `http` 모듈만 사용, 정적 파일 서빙)
- 지도/지오코딩: Naver Maps JavaScript API v3 (`ncpKeyId` 방식, `oapi.map.naver.com`), 실패 시 OpenStreetMap Nominatim으로 폴백

## 실행
```powershell
node server.mjs
# http://127.0.0.1:5173
```
`js/config.local.js`에 `NAVER_MAP_CLIENT_ID` 설정 필요 (`.gitignore` 처리됨, `config.local.example.js` 참고). 자세한 설정은 `README.md` 참고.

## 코드 스타일 (기존 파일 전부 이 스타일을 따름 — 새 코드도 통일할 것)
- 함수 본문을 한 줄로 압축해서 작성하는 밀도 높은 스타일 (세미콜론 구분, 줄바꿈 최소화). Prettier 등으로 재포맷하지 말 것 — 의도된 컨벤션임.
- 주석 거의 없음. 변수/함수명으로 의도를 표현.
- 각 `js/*.js` 파일은 단일 책임 모듈: `constants.js`(공용 상수·데이터), `regions.js`(주소→시도/세부지역 판별, **지역 판별 로직은 이 파일에만 존재해야 함** — 다른 파일에서 중복 구현하지 말 것), `geocoding.js`(주소→좌표), `images.js`(사진 압축/검증), `map.js`(Naver 지도 제어), `naver-sdk.js`(SDK 단일 로더), `storage.js`(localStorage 입출력/정규화), `seed-data.js`(초기 샘플).
- `app.js`는 오케스트레이션 전용 — DOM 이벤트/렌더링 조합만 담당, 비즈니스 로직은 `js/`로.

## 알려진 함정 (재발 방지)
- **`#map` 높이 0px 버그 (2026-07-21 수정)**: Naver Maps SDK가 초기화 시 `#map`에 `style="position:relative"`를 인라인으로 주입해서 `#map{position:absolute;inset:0}`만으로는 부모를 채우지 못하고 높이가 0으로 붕괴됨 (지도 API 인증/타일 요청은 전부 성공하는데 화면엔 아무것도 안 보이는 상태가 됨). 그래서 `#map`에 `width:100%;height:100%`를 명시적으로 같이 지정해둠 — 이 규칙을 지우지 말 것.
- Naver 지오코딩 실패 시 재시도용 `enrichAddress`는 `regions.js`의 `getProvince`를 사용함 (예전엔 자체 구현이 있었는데 광역시/도 별칭을 못 잡아 서울 주소에서 사실상 무력화되어 있었음 — 통합함).

## 이 프로젝트에 없는 것 (의도적)
개인 로컬 프로젝트라 다른 조직 업무 프로젝트들과 달리 다음을 두지 않음:
- `.claude/skills`, `.claude/memory` 등 무거운 스캐폴딩 — 반복 워크플로우가 없는 단일 페이지 앱 규모라 과함.
- 컴플라이언스 감사 (`compliance: not_required`) — 개인 데이터, 외부 사용자 없음.
- 백엔드/DB — 모든 데이터는 브라우저 로컬 저장소.

기능이 늘어나 위 판단이 바뀌면(예: 여러 기기 동기화, 공유 기능 추가 등) 이 섹션부터 다시 검토.
