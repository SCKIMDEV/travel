/*
 * 여행 페이지 시작: 주소의 ?trip=<id> 로 여행을 고르고, 찾으면 다이어리 스크립트를 불러온다.
 * 모르는 여행이거나 trip 이 없으면 홈 화면(여행 목록)으로 돌아간다.
 */
(() => {
  'use strict';
  const id = new URLSearchParams(location.search).get('trip');
  const trip = TRIPS.find(t => t.id === id);
  if (!trip) { location.replace('index.html'); return; }
  window.ITINERARY = trip;
  document.title = `${trip.title} · Travel Diary`;
  loadScripts(['js/db.js', 'js/remote.js', 'js/net-alert.js', 'js/app.js']);
})();
