/*
 * 여행 일정 데이터 — 강릉 (1박 2일)
 * - 이 파일만 고치면 페이지 전체(제목, 내비게이션, 타임라인, 다이어리 카드, 지도)에 반영됩니다.
 * - stop.id 는 사진과 기록을 연결하는 키입니다. 사진을 넣은 뒤에는 id를 바꾸지 마세요.
 * - next: 다음 장소까지의 이동 수단/시간. 좌표 사이 거리로 추정한 값이라 실제와 다를 수 있습니다.
 * - lat / lng: 지도 핀 좌표(WGS84). 없으면 지도에 표시되지 않습니다.
 *   좌표는 OpenStreetMap 과 도로명주소 검색으로 각각 찾아 맞춘 값입니다 (입구·매장 기준).
 * - approx: true 이면 팝업에 "추정 위치" 안내가 붙습니다 (지점을 가정한 곳).
 * - storageKey: 브라우저 저장소 이름. server: 사진·기록을 기기 간에 공유하는 서버 주소 (비우면 브라우저에만 저장).
 * - 도쿄 일정은 js/itinerary.tokyo.js 에 보관되어 있습니다. index.html 의 script 태그를 바꾸면 다시 쓸 수 있습니다.
 */
const HOTEL = { lat: 37.785187, lng: 128.928717 };   // 신라모노그램 강릉 호텔동 (송정동, 해안로 186). 레지던스동이면 37.785972, 128.926079

const ITINERARY = {
  id: "gangneung",
  storageKey: "gangneung-diary",
  // 사진·기록을 기기 간에 공유하는 서버 주소. 비우면("") 브라우저 안(IndexedDB)에만 저장한다.
  server: "https://parking.tail7d1054.ts.net:8443",
  // 서버 접속 키. 여기에 적어 두면 비밀번호를 묻지 않는다 (주소를 아는 사람은 누구나 사진을 보고 올리고 지울 수 있음).
  serverKey: "SgbvO4gEOnWbvhSyCPHByGDJspcNkMV9",
  title: "강릉여행",
  brand: "Gangneung Diary",
  seal: "",   // 오른쪽 위 붉은 도장 글자. 비우면 숨겨진다 (예: "江陵")
  period: "10.18 SUN — 10.19 MON",
  nights: "1박 2일",
  days: [
    {
      id: "day1", label: "DAY 1", date: "10.18", weekday: "SUN",
      stops: [
        { id: "chahyunhee-sundubu", name: "차현희 순두부청국장", en: "CHAHYUNHEE SUNDUBU",   next: "도보 2분",  lat: 37.791050, lng: 128.916170 },   // 초당동 본점
        { id: "sundubu-gelato",     name: "순두부 젤라또",       en: "SUNDUBU GELATO",       next: "도보 9분",  lat: 37.791710, lng: 128.915470 },   // 1호점 (초당 본점)
        { id: "gangmun-beach",      name: "강문해변",            en: "GANGMUN BEACH",        next: "차 20분",  lat: 37.796790, lng: 128.916860 },   // 강문솟대다리 남단 광장
        { id: "horin-park",         name: "호린파크",            en: "HORIN PARK",           next: "차 10분",  lat: 37.844430, lng: 128.865620 },   // 사천면 (경포대허브농장)
        { id: "terarosa",           name: "테라로사",            en: "TERAROSA SACHEON",     next: "차 15분",  lat: 37.822400, lng: 128.885040, approx: true },   // 사천점 기준. 다른 지점이면 좌표 수정 (구정 본점 37.696338, 128.892412 / 경포점은 검색)
        { id: "hotel-checkin",      name: "신라모노그램 체크인",  en: "SHILLA MONOGRAM · CHECK-IN", next: "차 10분", ...HOTEL },
        { id: "gamja-yuwonji",      name: "감자유원지",          en: "GAMJA YUWONJI · DINNER", next: "도보 4분",  lat: 37.756350, lng: 128.897400 },   // 중앙시장 옆
        { id: "jungang-market",     name: "강릉 중앙시장",       en: "JUNGANG MARKET",       next: "차 10분",  lat: 37.754150, lng: 128.898680 },   // 금성로 정문
        { id: "hotel-night",        name: "숙소 · 수영과 밤 산책", en: "SWIM · NIGHT WALK",                      ...HOTEL }
      ]
    },
    {
      id: "day2", label: "DAY 2", date: "10.19", weekday: "MON",
      stops: [
        { id: "gossine-makguksu",   name: "고씨네 동해 막국수",   en: "GOSSINE MAKGUKSU",     next: "차 10분",  lat: 37.796280, lng: 128.917150 },   // 강문 본점
        { id: "duding",             name: "두딩",                en: "DUDING",               next: "도보 2분",  lat: 37.758090, lng: 128.892120 },   // 교동 두부푸딩
        { id: "boiled-potato",      name: "삶은 감자",           en: "SALMEUN GAMJA",        next: "도보 1분",  lat: 37.758940, lng: 128.891710 },   // 감자 소품숍
        { id: "zamo-pajama",        name: "자모파자마",          en: "ZAMOPAJAMA",           next: "도보 2분",  lat: 37.759660, lng: 128.892200 },   // 파자마 매장
        { id: "cafe-pino",          name: "카페피노",            en: "CAFE PINO",            next: "차 40분",  lat: 37.758340, lng: 128.892370 },
        { id: "daegwallyeong-sheep", name: "대관령 양떼목장",     en: "DAEGWALLYEONG SHEEP FARM", next: "귀가",  lat: 37.686760, lng: 128.752840 },   // 매표소
        { id: "go-home",            name: "집으로 이동",          en: "HOME" }
      ]
    }
  ]
};
