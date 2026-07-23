---
user_level: "advanced"
compliance: not_required
---

# my-food-map (Juno 맛집 리스트)

맛집 기록 웹앱. 지도(Naver Maps), 사진, 평점, 방문 기록, 시·도/세부지역/카테고리/태그/컬렉션 폴더 필터, 통계·메뉴 추천을 제공. 데이터는 **Supabase의 공용 테이블 한 행**에 저장되어 기기 간 공유되고, 편집은 관리자 로그인(매직링크) 후에만 가능. 방문자는 로그인 없이 지도·목록·통계를 볼 수 있음(읽기 전용).

## 기술 스택
- 순수 HTML/CSS/JS (ES Modules). **빌드 도구, 프레임워크, npm 의존성 없음** — 새 기능을 추가할 때도 이 원칙을 유지할 것 (React/Vite/번들러 도입 금지, 필요 없음).
- 로컬 서버: `server.mjs` (Node 내장 `http` 모듈만 사용, 정적 파일 서빙)
- 지도/지오코딩: Naver Maps JavaScript API v3 (`ncpKeyId` 방식, `oapi.map.naver.com`), 실패 시 OpenStreetMap Nominatim으로 폴백
- 데이터/인증: Supabase (Postgres + Auth + Edge Functions). CDN에서 `@supabase/supabase-js` ESM을 동적 import (`js/supabase.js`).
- 배포: GitHub Actions → GitHub Pages (`.github/workflows/pages.yml`). Naver/Supabase 값은 저장소 Secrets에서 빌드 시점에 `js/config.local.js`로 생성됨 — **저장소에는 절대 커밋하지 않음**.

## 실행 (로컬)
```powershell
node server.mjs
# http://127.0.0.1:5173
```
`js/config.local.js`에 `NAVER_MAP_CLIENT_ID`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` 설정 필요 (`.gitignore` 처리됨, `config.local.example.js` 참고). Supabase 설정이 없으면 `loadFoodMapData()`가 자동으로 `localStorage` 전용 모드로 폴백함 (로컬 개발 시 유용).

## 배포 (GitHub Pages)
- 워크플로: `.github/workflows/pages.yml`. `NAVER_MAP_CLIENT_ID`/`SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY` GitHub Secrets를 읽어 `_site/js/config.local.js`를 생성.
- **Secret 값은 반드시 개행/공백 없이 저장할 것** — 값에 개행이 섞이면 생성된 JS 문자열 리터럴이 깨져 import가 통째로 실패함 (2026-07-21 실제 발생, `NAVER_MAP_CLIENT_ID` secret에 trailing newline). 워크플로 자체도 `tr -d '\n\r'`로 방어하지만, 애초에 secret 입력 시 주의.
- GitHub Pages CDN 캐시(`max-age=600`) 대응으로 배포 시 `index.html`의 `styles.css`/`auth.css`/`app.js`와 모든 `.js` 파일의 정적/동적 import 경로에 `?v=$GITHUB_SHA`를 sed로 붙임. 새 정적 asset을 추가하면 이 sed 대상에도 포함되는지 확인할 것.
- Supabase Edge Function(`supabase/functions/naver-place-search`)의 시크릿(`NAVER_SEARCH_CLIENT_ID`/`SECRET`)은 **GitHub Secrets가 아니라 Supabase 프로젝트 자체의 함수 시크릿**으로 별도 관리됨 — 헷갈리지 말 것.

## 데이터 모델 / 백엔드
- 모든 맛집·컬렉션은 `public.food_map_collections` 테이블의 단일 행(`id='juno'`)에 JSON(`restaurants`, 컬렉션 이름은 앱단에서 파생)으로 저장 (`supabase/setup.sql`).
- RLS: `anon`+`authenticated` 모두 SELECT 가능(공개 읽기), UPDATE는 `authenticated`만 가능. **"authenticated"는 Supabase Auth에 등록된 아무 사용자나 해당** — 별도 admin 역할 체크는 없음. 관리자를 늘릴 계획이면 이 가정부터 다시 볼 것.
- 관리자 인증: 이메일 매직링크(OTP), `shouldCreateUser:false`라 Supabase Auth에 미리 등록된 이메일만 로그인 가능(자가 가입 불가).
- **백업**: 관리자 로그인 시 대시보드 상단에 백업 내보내기/불러오기 버튼이 보임 (`exportBackup`/`importBackup`, `app.js`). 공용 데이터가 단일 행이라 실수로 덮어쓰면 되돌릴 방법이 없으므로, **중요한 일괄 편집 전에는 내보내기부터 하는 습관을 들일 것**. 이 기능이 다시 사라지지 않도록 주의 (2026-07 Supabase 전환 때 한 번 소실되어 복구함).

## 코드 스타일 (기존 파일 전부 이 스타일을 따름 — 새 코드도 통일할 것)
- 함수 본문을 한 줄로 압축해서 작성하는 밀도 높은 스타일 (세미콜론 구분, 줄바꿈 최소화). Prettier 등으로 재포맷하지 말 것 — 의도된 컨벤션임.
- 주석 거의 없음. 변수/함수명으로 의도를 표현.
- 각 `js/*.js` 파일은 단일 책임 모듈:
  - `constants.js` — 공용 상수(태그, 컬렉션 제한, 한국 행정구역 등)
  - `regions.js` — 주소→시도/세부지역 판별. **지역 판별 로직은 이 파일에만 존재해야 함** — 다른 파일에서 중복 구현 금지.
  - `geocoding.js` — 주소→좌표 (Naver 우선, OSM 폴백), `searchNaverAddresses`도 여기.
  - `search.js` — 초성/오타 허용 퍼지 검색 (`matchesRestaurantSearch`).
  - `insights.js` — 통계/컬렉션 그룹핑/메뉴 추천 로직 (순수 함수, DOM 없음).
  - `images.js` — 사진 압축/검증.
  - `map.js` — Naver 지도·마커·정보창 제어.
  - `naver-sdk.js` — Naver Maps SDK 단일 로더.
  - `supabase.js` — Supabase 클라이언트, 인증, 공용 데이터 CRUD, Edge Function 호출.
  - `storage.js` — 데이터 정규화(`normalizeRestaurant`/`normalizeFoodMapData`) + 로컬/Supabase 저장 분기.
  - `seed-data.js` — 로컬 전용 모드일 때 초기 샘플.
- `app.js`는 오케스트레이션 담당(DOM 이벤트/렌더링 조합). 다만 기능이 늘면서 일괄선택 상태, 추천 마법사 상태(`recommendationStep` 등)처럼 순수 로직도 일부 섞여 들어가고 있음 — 더 늘어나면 `js/`로 분리 고려.

## 알려진 함정 (재발 방지)
- **`#map` 높이 0px 버그 (2026-07-21 수정)**: Naver Maps SDK가 초기화 시 `#map`에 `style="position:relative"`를 인라인으로 주입해서 `#map{position:absolute;inset:0}`만으로는 부모를 채우지 못하고 높이가 0으로 붕괴됨. `#map`에 `width:100%;height:100%`를 명시적으로 같이 지정해둠 — 이 규칙을 지우지 말 것.
- Naver 지오코딩 실패 시 재시도용 `enrichAddress`는 `regions.js`의 `getProvince`를 사용함 (자체 구현 금지, 위 참고).
- **좌표 검증 (2026-07-23 수정)**: `storage.js`의 `normalizeRestaurant`가 `lat`/`lng`을 `Number.isFinite` 체크해서 유효하지 않으면 `null`로 정규화함. `map.js`의 `renderMarkers`(app.js 래퍼)와 `focus()`도 좌표 없는 항목은 건너뜀 — 그렇지 않으면 좌표 하나 깨진 레코드 때문에 그 뒤 마커가 전부 안 그려질 수 있었음.
- GitHub Secrets 값 개행 이슈 (위 "배포" 섹션 참고).

## 이 프로젝트에 의도적으로 없는 것
- `.claude/skills`, `.claude/memory` 등 무거운 스캐폴딩 — 반복 워크플로우가 없는 규모라 과함.
- 조직 컴플라이언스 감사 (`compliance: not_required`).
- 세분화된 admin 역할/권한 — 관리자는 "Supabase Auth에 등록된 사용자"로 단순화되어 있음. 여러 관리자를 두거나 권한을 나누게 되면 이 가정부터 재검토.

기능이 늘어 위 판단이 바뀌면 이 섹션부터 다시 검토.
