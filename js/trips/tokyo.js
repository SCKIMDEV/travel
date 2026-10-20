/*
 * 여행 일정 — 도쿄 (4박 5일, 예정). 연도는 아직 정하지 않아 planned 로 둡니다.
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
  const HOTEL = { lat: 35.69150, lng: 139.70630, approx: true };   // 신주쿠 3초메 부근(추정). 실제 숙소 좌표로 바꿔 주세요.

  return {
    place: "일본 도쿄",
    planned: true,
    id: "tokyo",
    storageKey: "tokyo-diary",
    brand: "Tokyo Diary",
    seal: "東京",
    // 홈 화면의 다이어리 모양 (모두 선택): cover 표지 가죽색, ribbon 책갈피 끈 색, stamp 표지 도장 글자(D+ 를 셀 수 없을 때만, 없으면 seal),
    // note 첫 장의 손글씨 한 줄, labels 지도 카드에 붙일 짧은 지명 { 장소 id: "이름" }
    diary: {
      cover: "#8a5b37", ribbon: "#1f3a44",
      labels: { "narita-arrival": "나리타", "hotel-checkin": "신주쿠", "disneyland": "디즈니", "kamakurakokomae": "가마쿠라" }
    },
    title: "TOKYO",
    period: "03.01 WED — 03.05 SUN",
    nights: "4박 5일",
    days: [
      {
        id: "day1", label: "DAY 1", date: "03.01", weekday: "WED",
        stops: [
          // 제1터미널(대한항공·아시아나). 제2터미널이면 35.772954, 140.388636
          { id: "narita-arrival", name: "나리타공항",    en: "NARITA AIRPORT", next: "1시간 반",   lat: 35.763098, lng: 140.386371 },
          { id: "hotel-checkin",  name: "숙소 체크인",   en: "CHECK-IN",       next: "지하철 30분", ...HOTEL },
          { id: "shibuya-sky",    name: "시부야 스카이", en: "SHIBUYA SKY",    next: "지하철 13분", lat: 35.658165, lng: 139.702266 },   // 渋谷スクランブルスクエア
          { id: "tonki",          name: "돈카츠 돈키",   en: "TONKATSU TONKI", next: "지하철 30분", lat: 35.633650, lng: 139.714289 },   // とんき 目黒本店
          { id: "hotel-day1",     name: "숙소",          en: "HOTEL",                              ...HOTEL }
        ]
      },
      {
        id: "day2", label: "DAY 2", date: "03.02", weekday: "THU",
        stops: [
          { id: "disneyland",  name: "디즈니랜드", en: "TOKYO DISNEYLAND", next: "지하철 40분", lat: 35.635030, lng: 139.878709 },   // 메인 입구
          { id: "sato-yosuke", name: "사토요스케", en: "SATO YOSUKE",      next: "지하철 30분", lat: 35.671453, lng: 139.761473, approx: true },   // 銀座店(銀座6-4-17) 기준. 다른 지점이면 좌표 수정
          { id: "hotel-day2",  name: "숙소",       en: "HOTEL",                                 ...HOTEL }
        ]
      },
      {
        id: "day3", label: "DAY 3", date: "03.03", weekday: "FRI",
        stops: [
          { id: "shichirigahama",   name: "시치리가하마",      en: "SHICHIRIGAHAMA",   next: "도보 14분",  lat: 35.306256, lng: 139.510053 },   // 七里ヶ浜駅
          { id: "yoridokoro",       name: "요리도코로",        en: "YORIDOKORO",       next: "에노덴 10분", lat: 35.304525, lng: 139.523901 },   // ヨリドコロ 稲村ヶ崎本店
          { id: "kamakurakokomae",  name: "가마쿠라 코코마에", en: "KAMAKURAKOKOMAE",  next: "에노덴 15분", lat: 35.306720, lng: 139.500710 },   // 鎌倉高校前駅
          { id: "sakanoshita-cafe", name: "사카노시타 카페",   en: "SAKANOSHITA CAFE", next: "도보 8분",   lat: 35.309315, lng: 139.533930 },   // 坂ノ下21-15 (현 사카노시타 sacanosita)
          { id: "orgel-do",         name: "오르골당",          en: "ORGEL-DO",         next: "에노덴 22분", lat: 35.312730, lng: 139.534500 },   // 鎌倉オルゴール堂 長谷3-10-33
          { id: "komachi-dori",     name: "고마치도리 거리",   en: "KOMACHI-DORI",     next: "1시간",      lat: 35.319548, lng: 139.551360 },   // 가마쿠라역 동쪽 입구
          { id: "tsukishima-monja", name: "츠키시마 몬자",     en: "TSUKISHIMA MONJA",                    lat: 35.663570, lng: 139.781462 }    // 西仲通り 상점가 중간
        ]
      },
      {
        id: "day4", label: "DAY 4", date: "03.04", weekday: "SAT",
        stops: [
          { id: "iruca-ramen", name: "이루카 라멘",    en: "IRUCA RAMEN",  next: "지하철 20분", lat: 35.664792, lng: 139.731681 },   // 入鹿TOKYO 六本木
          { id: "tricolore",   name: "트리콜로르",     en: "TRICOLORE",    next: "도보 3분",   lat: 35.670293, lng: 139.765040 },   // トリコロール本店 銀座5-9-17
          { id: "ginza",       name: "긴자 거리 구경", en: "GINZA",        next: "지하철 20분", lat: 35.671220, lng: 139.765038 },   // 銀座四丁目交差点
          { id: "sumida",      name: "스미다강",       en: "SUMIDA RIVER", next: "도보 10분",  lat: 35.710604, lng: 139.799006, approx: true },   // 吾妻橋(아사쿠사 쪽) 기준
          { id: "sensoji",     name: "센소지",         en: "SENSO-JI",     next: "지하철 26분", lat: 35.714729, lng: 139.796748 },   // 浅草寺 本堂
          { id: "imahan",      name: "이마한",         en: "IMAHAN",                           lat: 35.685767, lng: 139.783694, approx: true }    // 人形町今半 本店 기준. 浅草今半이면 35.713932, 139.792252
        ]
      },
      {
        id: "day5", label: "DAY 5", date: "03.05", weekday: "SUN",
        stops: [
          { id: "hotel-breakfast", name: "숙소 조식",                en: "BREAKFAST",            next: "도보 11분", ...HOTEL },
          { id: "shinjuku-gyoen",  name: "신주쿠 교엔",              en: "SHINJUKU GYOEN",                        lat: 35.688330, lng: 139.707492 },   // 新宿門
          { id: "nex",             name: "신주쿠에서 12시 넥스 탑승", en: "NARITA EXPRESS 12:00",                  lat: 35.690261, lng: 139.700512 },   // JR 新宿駅
          { id: "narita-depart",   name: "나리타 공항",              en: "NARITA AIRPORT",                        lat: 35.763098, lng: 140.386371 }    // 제1터미널
        ]
      }
    ]
  };
})());
