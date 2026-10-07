/*
 * 여행 일정 데이터 — 강릉 (1박 2일)
 * - 이 파일만 고치면 페이지 전체(제목, 내비게이션, 타임라인, 다이어리 카드, 지도)에 반영됩니다.
 * - 아래 일정은 강릉 대표 코스로 짠 샘플입니다. 실제 일정에 맞게 장소·이동시간을 바꿔 쓰세요.
 * - stop.id 는 사진과 기록을 연결하는 키입니다. 사진을 넣은 뒤에는 id를 바꾸지 마세요.
 * - next: 다음 장소까지의 이동 수단/시간. 없으면 생략해도 됩니다.
 * - lat / lng: 지도 핀 좌표(WGS84). 없으면 지도에 표시되지 않습니다.
 *   좌표는 OpenStreetMap 과 도로명주소 검색으로 각각 찾아 맞춘 값입니다 (역·매표소·광장 등 실제 입구 기준).
 * - approx: true 이면 팝업에 "추정 위치" 안내가 붙습니다. 숙소처럼 정확한 위치를 모를 때 씁니다.
 * - storageKey: 브라우저 저장소 이름. 여행마다 다르게 두면 사진·기록이 섞이지 않습니다.
 * - 도쿄 일정은 js/itinerary.tokyo.js 에 보관되어 있습니다. index.html 의 script 태그를 바꾸면 다시 쓸 수 있습니다.
 */
const HOTEL = { lat: 37.77400, lng: 128.94500, approx: true };   // 안목해변 근처(가정). 실제 숙소 좌표로 바꿔 주세요.

const ITINERARY = {
  id: "gangneung",
  storageKey: "gangneung-diary",
  // 사진·기록을 기기 간에 공유하는 서버 주소. 비우면("") 브라우저 안(IndexedDB)에만 저장한다.
  server: "https://parking.tail7d1054.ts.net:8443",
  title: "강릉여행",
  brand: "Gangneung Diary",
  seal: "",   // 오른쪽 위 붉은 도장 글자. 비우면 숨겨진다 (예: "江陵")
  period: "10.18 SUN — 10.19 MON",
  nights: "1박 2일",
  days: [
    {
      id: "day1", label: "DAY 1", date: "10.18", weekday: "SUN",
      stops: [
        { id: "gangneung-arrival", name: "강릉역 도착",       en: "GANGNEUNG STATION · KTX", next: "택시 10분", lat: 37.764408, lng: 128.899519 },   // 강릉역 역사
        { id: "chodang-tofu",      name: "초당순두부마을",     en: "CHODANG TOFU VILLAGE",    next: "도보 15분", lat: 37.790452, lng: 128.915481 },   // 초당순두부길 식당가 중심
        { id: "gangmun-beach",     name: "강문해변",           en: "GANGMUN BEACH",           next: "도보 20분", lat: 37.796900, lng: 128.917200 },   // 강문솟대다리 남측 광장
        { id: "gyeongpo-beach",    name: "경포해변",           en: "GYEONGPO BEACH",          next: "택시 10분", lat: 37.805380, lng: 128.907220 },   // 경포해변 중앙광장
        { id: "hotel-checkin",     name: "숙소 체크인",        en: "CHECK-IN",                next: "도보 5분",  ...HOTEL },
        { id: "anmok-coffee",      name: "안목해변 커피거리",   en: "ANMOK COFFEE STREET",                       lat: 37.772030, lng: 128.947975 }    // 커피거리 중간
      ]
    },
    {
      id: "day2", label: "DAY 2", date: "10.19", weekday: "MON",
      stops: [
        { id: "hotel-breakfast",   name: "숙소 조식",                en: "BREAKFAST",               next: "차 30분", ...HOTEL },
        { id: "jeongdongjin",      name: "정동진역 · 모래시계공원",   en: "JEONGDONGJIN",            next: "차 10분", lat: 37.691830, lng: 129.032509 },   // 정동진역
        { id: "haslla",            name: "하슬라아트월드",           en: "HASLLA ART WORLD",        next: "차 25분", lat: 37.706207, lng: 129.012020 },   // 매표소 (율곡로 1441)
        { id: "terarosa",          name: "테라로사 커피공장",        en: "TERAROSA COFFEE FACTORY", next: "차 20분", lat: 37.696338, lng: 128.892412 },   // 구정면 본점 (현천길 7)
        { id: "ojukheon",          name: "오죽헌",                  en: "OJUKHEON",                next: "차 10분", lat: 37.779151, lng: 128.879670 },   // 매표소 (정문)
        { id: "jungang-market",    name: "강릉중앙시장",            en: "JUNGANG MARKET",          next: "차 5분",  lat: 37.754099, lng: 128.898689 },   // 금성로 정문
        { id: "gangneung-depart",  name: "강릉역 출발",              en: "GANGNEUNG STATION · KTX",                  lat: 37.764408, lng: 128.899519 }
      ]
    }
  ]
};

// 더 넣고 싶을 때 쓸 수 있는 장소들 (주문진 방면, 좌표 검증 완료)
// { id: "jumunjin-market",     name: "주문진 수산시장",         en: "JUMUNJIN FISH MARKET", lat: 37.891080, lng: 128.827701 }
// { id: "yeongjin-breakwater", name: "영진해변 도깨비 방파제",   en: "YEONGJIN BREAKWATER",  lat: 37.879872, lng: 128.834190 }   // 영진해변 북쪽 끝, 도깨비 촬영지 정류장 옆
