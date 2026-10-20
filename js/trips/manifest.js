/*
 * 여행 목록과 공통 설정 — 홈 화면(index.html)과 여행 페이지(trip.html)가 함께 쓴다.
 *
 * 새 여행 추가:
 *   1) js/trips/tokyo.js 를 복사해 js/trips/<이름>.js 를 만들고 id·제목·날짜·일정을 바꾼다 (id 는 영문 소문자·숫자·- 만).
 *   2) 아래 TRIP_FILES 에 <이름> 을 넣는다. 홈 화면에 카드가 생기고, trip.html?trip=<id> 로 열린다.
 */
const TRIP_FILES = ['gangneung', 'tokyo'];

// 사진·기록을 기기 간에 공유하는 서버. server 를 비우면("") 각 브라우저 안(IndexedDB)에만 저장한다.
// serverKey 가 여기 있으므로 비밀번호를 묻지 않는다 (주소를 아는 사람은 누구나 사진을 보고 올리고 지울 수 있음).
const DIARY_CONFIG = {
  server: "https://parking.tail7d1054.ts.net:8443",
  serverKey: "SgbvO4gEOnWbvhSyCPHByGDJspcNkMV9"
};

const TRIPS = [];
function registerTrip(trip) { TRIPS.push(trip); }

// 스크립트를 순서대로 불러온다 (file:// 에서도 동작). 여행 파일 → 페이지 스크립트 순으로 실행된다.
function loadScripts(srcs) {
  srcs.forEach(src => {
    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    document.body.appendChild(s);
  });
}
const tripScripts = () => TRIP_FILES.map(name => `js/trips/${name}.js`);
