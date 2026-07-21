# Juno 맛집 리스트

내가 다녀온 맛집과 가고 싶은 곳을 지도, 사진, 평점, 방문 기록, 편의 태그와 함께 관리하는 개인용 웹앱입니다. 시·도와 세부 행정구역, 카테고리, 태그별 필터를 제공하며 데이터는 브라우저 `localStorage`에 저장됩니다. JSON 백업과 복원도 지원합니다.

## 실행

```powershell
node server.mjs
```

브라우저에서 `http://127.0.0.1:5173` 또는 `http://localhost:5173`을 엽니다. 네이버 클라우드 Application의 Web 서비스 URL에도 실제로 접속할 주소를 등록해야 합니다.

## 네이버 Maps Client ID 설정

네이버 클라우드 Application에서 `Dynamic Map`과 `Geocoding`을 활성화합니다. 이후 예제 설정을 로컬 설정으로 복사합니다.

```powershell
Copy-Item js/config.local.example.js js/config.local.js
```

`js/config.local.js`에 발급받은 Client ID를 입력합니다.

```js
export const NAVER_MAP_CLIENT_ID = "발급받은_Client_ID";
```

`config.local.js`는 `.gitignore`에 포함되어 커밋되지 않습니다. Client ID가 설정되면 지도 화면은 네이버 Web Dynamic Map으로 표시됩니다. 새로 등록하거나 주소를 변경하는 맛집은 네이버 Geocoder를 먼저 사용하고, 실패할 때만 OpenStreetMap Nominatim을 대체 검색으로 사용합니다. 저장 데이터에는 `coordinateSource`가 `naver` 또는 `osm`으로 함께 기록됩니다.

### Client Secret 보안

Client Secret은 이 브라우저 프로젝트의 HTML, JavaScript, `config.local.js`에 입력하지 마세요. 브라우저에 전달된 값은 누구나 개발자 도구로 확인할 수 있습니다. Client Secret이 필요한 네이버 REST API를 추가할 때는 별도 백엔드 서버의 환경변수에 저장하고 브라우저는 해당 백엔드만 호출해야 합니다.

현재 Web Dynamic Map/Geocoder JavaScript SDK 연동에는 Client ID만 사용합니다.

### 주소 위치 선택

맛집 등록·수정 화면에서 도로명 또는 지번 주소를 입력하고 `네이버 주소 검색`을 누릅니다. 검색 결과 중 사용할 주소를 선택하면 네이버 Geocoder가 반환한 좌표가 지도에 미리 반영되며, 저장할 때도 동일한 좌표가 사용됩니다. 새 주소나 변경된 주소는 검색 결과를 선택해야 저장할 수 있습니다.

이 기능은 네이버 지도 SDK의 주소 Geocoder를 사용하므로 식당 상호명 검색이 아니라 도로명·지번 주소 검색을 지원합니다. 상호명 기반 장소 검색을 추가하려면 별도의 네이버 지역 검색 API와 Client Secret을 보호할 백엔드가 필요합니다.

## 프로젝트 구조

```text
my-food-map/
├─ index.html                  화면 마크업
├─ styles.css                 화면 스타일
├─ app.js                     UI 상태와 이벤트 조정
├─ server.mjs                 로컬 정적 서버
├─ js/
│  ├─ config.js               로컬 런타임 설정 로더
│  ├─ config.local.example.js Client ID 설정 예제
│  ├─ constants.js            공통 상수와 한국 행정구역
│  ├─ geocoding.js            네이버 우선 주소→좌표 변환
│  ├─ images.js               사진 검증·압축
│  ├─ map.js                  네이버 지도·마커·정보창 제어
│  ├─ naver-sdk.js            네이버 Maps SDK 단일 로더
│  ├─ regions.js              시·도와 세부 지역 분류
│  ├─ seed-data.js            최초 샘플 데이터
│  └─ storage.js              localStorage와 데이터 검증
└─ .gitignore                 비밀·로컬 설정 제외
```

지도 화면과 주소 검색은 네이버 Maps JavaScript API v3를 사용합니다. 저장된 `lat`/`lng` 좌표는 지도 공급자와 독립적인 위·경도 값이므로 기존 데이터도 그대로 표시됩니다. 정식 도메인이 확정되면 네이버 클라우드 Application의 Web 서비스 URL에 운영 도메인을 추가하세요.

## 데이터 백업

우측 대시보드의 `백업 내보내기`로 사진을 포함한 기록을 JSON 파일로 저장할 수 있습니다. 네이버 지도로 전환하거나 브라우저를 변경하기 전에 백업하는 것을 권장합니다.
