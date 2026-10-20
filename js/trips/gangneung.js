/*
 * 여행 일정 — 강릉 (1박 2일)
 * - 이 파일만 고치면 그 여행의 페이지(제목, 내비게이션, 타임라인, 다이어리 카드, 지도)와 홈 화면 카드에 반영됩니다.
 * - stop.id 는 사진과 기록을 연결하는 키입니다. 사진을 넣은 뒤에는 id를 바꾸지 마세요.
 * - next: 다음 장소까지의 이동 수단/시간. 없으면 생략해도 됩니다.
 * - lat / lng: 지도 핀 좌표(WGS84). 없으면 지도와 홈 화면의 동선 그림에 나오지 않습니다.
 * - approx: true 이면 팝업에 "추정 위치" 안내가 붙습니다.
 * - place: 홈 화면에 나오는 지역 이름. start / end: 여행 날짜(YYYY-MM-DD). 홈 화면의 연도 묶음과 정렬에 쓰입니다.
 * - planned: true 이면 홈 화면의 "다가올 여행"에 나옵니다 (날짜를 아직 모를 때도 씁니다).
 * - 사진 서버 주소와 접속 키는 js/trips/manifest.js 의 DIARY_CONFIG 에서 모든 여행이 함께 씁니다.
 */

registerTrip((() => {
  const HOTEL = { lat: 37.785187, lng: 128.928717 };   // 신라모노그램 강릉 호텔동 (송정동, 해안로 186). 레지던스동이면 37.785972, 128.926079

  return {
    place: "강원 강릉",
    start: "2026-10-18",
    end: "2026-10-19",
    id: "gangneung",
    storageKey: "gangneung-diary",
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
          { id: "gangmun-beach",      name: "강문해변",            en: "GANGMUN BEACH",        next: "도보 7분",  lat: 37.796790, lng: 128.916860 },   // 강문솟대다리 남단 광장
          { id: "toetmaru",           name: "툇마루",              en: "CAFE TOETMARU",        next: "차 20분",  lat: 37.792891, lng: 128.914476 },   // 카페 툇마루 (난설헌로 232, 네이버 플레이스 998885728)
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
          { id: "gangmun-beach-2",    name: "강문해변",             en: "GANGMUN BEACH",       next: "차 10분",  lat: 37.796790, lng: 128.916860 },   // 1일차 강문해변과 같은 곳 (지도에서는 핀 하나로 묶임)
          { id: "jungang-market-2",   name: "강릉 중앙시장",          en: "JUNGANG MARKET",      next: "도보 1분",  lat: 37.754150, lng: 128.898680 },   // 1일차와 같은 금성로 정문
          { id: "gilgamja",           name: "길감자",              en: "GANGNEUNG GILGAMJA",  next: "도보 1분",  lat: 37.754647, lng: 128.898628 },   // 강릉길감자 본점 (금성로 16, 중앙시장 금성로 입구 옆. 2026-05 중앙시장2길에서 이전)
          { id: "gamja-ongsimi",      name: "감자옹심이",            en: "GAMJA ONGSIMI",       next: "귀가",     lat: 37.755110, lng: 128.898179 },   // 감자옹심이 (금성로14번길 9-1, 수요일 휴무)
          { id: "go-home",            name: "집으로 이동",          en: "HOME" }
        ]
      }
    ]
  };
})());
