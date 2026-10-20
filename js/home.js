/*
 * 홈 화면 — 여행 다이어리 서재 (index.html)
 * 여행마다 가죽 표지 다이어리 한 권. 마우스를 올리거나(키보드 포커스) 누르면 표지가 열리고,
 * 안쪽 표지에는 실제 좌표로 그린 동선 지도, 첫 장에는 사진(없으면 날짜별 일정)이 보인다.
 * 터치 화면(마우스 없음)에서는 첫 탭에 펼치고, 펼친 다이어리를 한 번 더 누르면 여행 페이지로 간다.
 * 여행 목록·동선은 여행 파일(js/trips/*.js)로 바로 그리고, 사진 수·썸네일은 사진 서버에서 받아 채운다.
 */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CONFIG = typeof DIARY_CONFIG !== 'undefined' ? DIARY_CONFIG : {};
  const CAN_HOVER = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  // 여행 파일에 diary.cover / ribbon 이 없을 때 차례로 쓰는 가죽·끈 색
  const COVERS = ['#1f3a44', '#8a5b37', '#3c4a33', '#5a2f3b', '#2f3440'];
  const RIBBONS = ['#b23a2a', '#1f3a44', '#b23a2a', '#c49a45', '#b23a2a'];
  const NOT_SIGHTS = /숙소|체크인|공항|집으로|넥스|조식/;   // 일정 요약에서 뺄 이동·숙소 항목

  // ---------- 여행 정보 ----------
  const stopsOf = trip => trip.days.flatMap(d => d.stops);
  const hasXY = s => typeof s.lat === 'number' && typeof s.lng === 'number';
  const placesOf = trip => {   // 좌표가 같은 곳은 한 곳으로 센다
    const seen = new Map();
    stopsOf(trip).forEach(s => { if (hasXY(s)) { const k = `${s.lat.toFixed(5)},${s.lng.toFixed(5)}`; if (!seen.has(k)) seen.set(k, s.name); } });
    return [...seen.values()];
  };
  const ymd = iso => (iso ? iso.split('-').map(Number) : null);
  function coverDate(trip) {   // 표지 라벨: 2026. 10. 18 — 19 / 연도 모르면 3월 1일 — 5일
    const a = ymd(trip.start), b = ymd(trip.end || trip.start);
    if (a) {
      const head = `${a[0]}. ${a[1]}. ${a[2]}`;
      if (!b || (a[1] === b[1] && a[2] === b[2])) return head;
      return a[1] === b[1] ? `${head} — ${b[2]}` : `${head} — ${b[1]}. ${b[2]}`;
    }
    const f = String(trip.days[0]?.date || '').split('.').map(Number);
    const l = String(trip.days[trip.days.length - 1]?.date || '').split('.').map(Number);
    if (f.length < 2) return '';
    if (l.length < 2 || (f[0] === l[0] && f[1] === l[1])) return `${f[0]}월 ${f[1]}일`;
    return f[0] === l[0] ? `${f[0]}월 ${f[1]}일 — ${l[1]}일` : `${f[0]}월 ${f[1]}일 — ${l[0]}월 ${l[1]}일`;
  }
  const isPlanned = trip => !!trip.planned || !trip.start;
  // D+ : 기준일(DIARY_CONFIG.dday)이 D+1. 날짜만 비교하도록 UTC 자정으로 센다. 셀 수 없으면 null.
  function dPlus(trip) {
    const base = ymd(CONFIG.dday), day = ymd(trip.start);
    if (!base || !day || base.some(Number.isNaN) || day.some(Number.isNaN)) return null;
    const n = Math.round((Date.UTC(day[0], day[1] - 1, day[2]) - Date.UTC(base[0], base[1] - 1, base[2])) / 86400000) + 1;
    return n >= 1 ? n : null;
  }
  const caption = trip => {
    if (isPlanned(trip)) return '다가올 여행';
    const a = ymd(trip.start);
    return `${a[0]}년 ${a[1]}월`;
  };

  // ---------- 동선 지도 (실제 좌표를 이어 그린 선) ----------
  function routeSvg(trip) {
    const labels = (trip.diary && trip.diary.labels) || {};
    const pts = [];
    stopsOf(trip).forEach(s => {
      if (!hasXY(s)) return;
      const last = pts[pts.length - 1];
      if (!last || last.lat !== s.lat || last.lng !== s.lng) pts.push({ lat: s.lat, lng: s.lng, label: labels[s.id] });
      else if (labels[s.id] && !last.label) last.label = labels[s.id];
    });
    if (!pts.length) return '';
    const lat0 = pts.reduce((n, p) => n + p.lat, 0) / pts.length * Math.PI / 180;
    const xy = pts.map(p => ({ x: p.lng * Math.cos(lat0), y: -p.lat }));
    const minX = Math.min(...xy.map(p => p.x)), maxX = Math.max(...xy.map(p => p.x));
    const minY = Math.min(...xy.map(p => p.y)), maxY = Math.max(...xy.map(p => p.y));
    const span = Math.max(maxX - minX, maxY - minY) || 1;
    const PAD = 14, SIZE = 100 - PAD * 2;
    const ox = PAD + (SIZE - (maxX - minX) / span * SIZE) / 2, oy = PAD + (SIZE - (maxY - minY) / span * SIZE) / 2;
    const P = xy.map((p, i) => ({ x: +(ox + (p.x - minX) / span * SIZE).toFixed(1), y: +(oy + (p.y - minY) / span * SIZE).toFixed(1), label: pts[i].label }));
    const d = P.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
    const uniq = [...new Map(P.map(p => [`${p.x},${p.y}`, p])).values()];
    const first = P[0], last = P[P.length - 1];
    const named = [...new Map(P.filter(p => p.label).map(p => [p.label, p])).values()];
    return `<svg class="map-svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <path class="map-line" d="${d}"/>
      ${uniq.map(p => `<circle class="map-stop" cx="${p.x}" cy="${p.y}" r="1.6"/>`).join('')}
      ${P.length > 1 && (last.x !== first.x || last.y !== first.y) ? `<circle class="map-end" cx="${last.x}" cy="${last.y}" r="2.6"/>` : ''}
      <circle class="map-start" cx="${first.x}" cy="${first.y}" r="2.6"/>
      ${named.map(p => p.x > 68
        ? `<text class="map-label" x="${(p.x - 3.6).toFixed(1)}" y="${(p.y + 2.6).toFixed(1)}" text-anchor="end">${esc(p.label)}</text>`
        : `<text class="map-label" x="${(p.x + 3.6).toFixed(1)}" y="${(p.y + 2.6).toFixed(1)}">${esc(p.label)}</text>`).join('')}
    </svg>`;
  }

  // ---------- 첫 장: 사진이 없을 때 보이는 날짜별 일정 ----------
  function planHtml(trip) {
    const rows = trip.days.map((day, i) => {
      const sights = day.stops.map(s => s.name).filter(n => !NOT_SIGHTS.test(n));
      return { day: `Day ${i + 1}`, text: (sights.length ? sights : day.stops.map(s => s.name)).slice(0, 2).join(', ') };
    });
    const shown = rows.length > 5 ? rows.slice(0, 4) : rows;
    return `<div class="plan">
      ${shown.map(r => `<span class="plan-day">${esc(r.day)}</span><span class="plan-text">${esc(r.text)}</span>`).join('')}
      ${rows.length > shown.length ? `<span class="plan-day"></span><span class="plan-text plan-more">외 ${rows.length - shown.length}일</span>` : ''}
    </div>`;
  }

  // ---------- 다이어리 한 권 ----------
  function diaryHtml(trip, vol, i) {
    const look = trip.diary || {};
    const cover = look.cover || COVERS[i % COVERS.length];
    const ribbon = look.ribbon || RIBBONS[i % RIBBONS.length];
    const dp = dPlus(trip);
    const stamp = dp ? '' : (look.stamp ?? trip.seal ?? '');
    const places = placesOf(trip);
    const planned = isPlanned(trip);
    const days = trip.days.length;
    const href = `trip.html?trip=${encodeURIComponent(trip.id)}`;
    const date = coverDate(trip);
    const label = `${trip.title} 다이어리. ${planned ? '다가올 여행, ' : ''}${date}${dPlus(trip) ? `, D+${dPlus(trip)}` : ''}, 장소 ${places.length}곳`;
    return `
      <div class="slot" data-trip="${esc(trip.id)}">
        <a class="diary" href="${href}" aria-label="${esc(label)}" style="--cover:${esc(cover)};--ribbon:${esc(ribbon)}">
          <div class="book">
            <span class="book-shadow" aria-hidden="true"></span>
            <div class="page" aria-hidden="true">
              <p class="page-meta"><span>${esc(date)}</span><span>${esc(trip.nights || `${days}일`)}</span></p>
              <div class="page-body" data-state="${planned ? 'plan' : 'loading'}">
                ${planned ? `<span class="planned">다가올 여행</span>${planHtml(trip)}` : `
                <div class="polaroids">
                  <figure class="polaroid p1"><span class="ph"></span><span class="tape"></span></figure>
                  <figure class="polaroid p2"><span class="ph"></span><span class="tape"></span></figure>
                </div>`}
              </div>
              <p class="hand">${esc(look.note || (planned ? '다녀와서 사진 붙이기' : ''))}</p>
              <span class="page-fill"></span>
              <p class="stats"><span class="stat-photos" hidden></span><span>장소 ${places.length}곳</span></p>
              <span class="cta">${planned ? '일정 보기' : '기록 펼치기'}<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg></span>
              <span class="ribbon"></span>
            </div>
            <div class="cover">
              <div class="face face-front" aria-hidden="true">
                <div class="label">
                  <p class="label-vol">No. ${vol}</p>
                  <p class="label-title">${esc(trip.title)}</p>
                  <p class="label-date">${esc(date)}</p>
                  ${dp ? `<span class="stamp stamp-dday"><small>D+</small>${dp}</span>` : stamp ? `<span class="stamp">${esc(stamp)}</span>` : ''}
                </div>
                ${trip.place ? `<p class="deboss">${esc(trip.place)}</p>` : ''}
                <span class="elastic"></span>
              </div>
              <div class="face face-back" aria-hidden="true">
                <div class="map-card">${routeSvg(trip)}<span class="tape t1"></span><span class="tape t2"></span></div>
                <span class="page-fill"></span>
                <p class="legend"><span class="key key-start"></span>출발<span class="key key-end"></span>끝<span class="legend-sum">${days}일, 장소 ${places.length}곳</span></p>
              </div>
            </div>
          </div>
        </a>
        <p class="slot-caption">${esc(caption(trip))}</p>
      </div>`;
  }

  // 정렬: 다가올 여행 먼저, 그다음 최근 여행부터. 권 번호(No.)는 날짜 순서대로 1부터.
  const byNewest = (a, b) => (b.start || '9999').localeCompare(a.start || '9999');
  const ordered = [...TRIPS].sort(byNewest);
  const volumes = new Map([...TRIPS].sort((a, b) => -byNewest(a, b)).map((t, i) => [t.id, i + 1]));

  function render() {
    $('#trip-list').innerHTML = ordered.map((t, i) => diaryHtml(t, volumes.get(t.id), i)).join('')
      || '<p class="home-lede">아직 여행이 없어요. js/trips/manifest.js 에 여행 파일을 추가하세요.</p>';
    if (!CAN_HOVER) $('#home-lede').textContent = '다이어리를 누르면 펼쳐지고, 한 번 더 누르면 그 여행이 열려요.';
    updateCount();
  }

  // ---------- 사진 서버 ----------
  let totalPhotos = 0;
  function updateCount() {
    $('#home-count').textContent = `다이어리 ${TRIPS.length}권${totalPhotos ? `, 사진 ${totalPhotos}장` : ''}`;
  }
  async function fetchState(trip) {
    const server = String(trip.server ?? CONFIG.server ?? '').replace(/\/+$/, '');
    if (!server) return null;   // 브라우저 모드 여행: 사진은 각 기기에만 있다
    const res = await fetch(`${server}/api/${encodeURIComponent(trip.id)}/state`, { headers: { 'X-Diary-Key': trip.serverKey ?? CONFIG.serverKey ?? '' } });
    if (!res.ok) throw new Error(`서버 응답 ${res.status}`);
    const s = await res.json();
    const order = new Map(stopsOf(trip).map((st, i) => [st.id, i]));
    const photos = (s.photos || []).filter(p => order.has(p.stopId))
      .sort((a, b) => order.get(a.stopId) - order.get(b.stopId) || (a.order ?? 0) - (b.order ?? 0));
    // 첫 장에 붙일 두 장: 서로 다른 장소의 첫 사진을 고른다
    const firsts = [], seen = new Set();
    photos.forEach(p => { if (!seen.has(p.stopId)) { seen.add(p.stopId); firsts.push(p); } });
    const pick = (firsts.length >= 2 ? firsts : photos).slice(0, 2);
    const thumb = p => `${server}/files/${encodeURIComponent(trip.id)}/${encodeURIComponent(p.id)}.thumb.jpg?k=${encodeURIComponent(s.fileToken || '')}`;
    return { total: photos.length, thumbs: pick.map(thumb) };
  }

  function fill(trip, data) {
    const slot = document.querySelector(`.slot[data-trip="${CSS.escape(trip.id)}"]`);
    if (!slot) return;
    const body = $('.page-body', slot);
    if (data && data.total) {
      const sp = $('.stat-photos', slot); sp.textContent = `사진 ${data.total}장`; sp.hidden = false;
      if (body.dataset.state === 'loading') {
        $$('.polaroid', body).forEach((fig, i) => {
          const src = data.thumbs[i];
          if (!src) { fig.hidden = true; return; }
          const img = new Image();
          img.alt = ''; img.decoding = 'async';
          img.addEventListener('load', () => fig.classList.add('is-loaded'));
          img.addEventListener('error', () => { fig.hidden = true; });
          img.src = src;
          $('.ph', fig).replaceWith(img);
        });
        body.dataset.state = 'photos';
      }
      totalPhotos += data.total;
      updateCount();
    } else if (body.dataset.state === 'loading') {   // 사진이 없는 지난 여행: 날짜별 일정을 대신 보여준다
      body.innerHTML = planHtml(trip);
      body.dataset.state = 'plan';
      const hand = $('.hand', slot);
      if (!hand.textContent) hand.textContent = data ? '아직 붙인 사진이 없어요' : '';
    }
  }

  async function loadPhotos() {
    const results = await Promise.allSettled(TRIPS.map(t => fetchState(t)));
    let failed = 0;
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') fill(TRIPS[i], r.value);
      else { failed++; console.warn(TRIPS[i].id, r.reason); fill(TRIPS[i], null); }
    });
    if (failed) {
      const note = $('#home-note');
      note.textContent = "사진을 불러오지 못했어요. Tailscale 이 켜진 기기라면 주소창 왼쪽 아이콘에서 '로컬 네트워크 액세스'를 허용하고 새로고침하세요. 그래도 안 되면 서버 PC 가 켜져 있는지 확인하세요.";
      note.hidden = false;
    }
  }

  // ---------- 터치 화면: 첫 탭에 펼치고, 펼친 다이어리를 다시 누르면 들어간다 ----------
  function bindTouch() {
    if (CAN_HOVER) return;
    const list = $('#trip-list');
    list.addEventListener('click', e => {
      const diary = e.target.closest('.diary');
      if (!diary || diary.classList.contains('is-open') || e.detail === 0) return;   // 이미 펼쳐져 있거나 키보드·보조기기로 누르면 링크대로 이동
      e.preventDefault();
      $$('.diary.is-open', list).forEach(d => d.classList.remove('is-open'));
      diary.classList.add('is-open');
    });
    document.addEventListener('click', e => {   // 바깥을 누르면 접는다
      if (!e.target.closest('.diary')) $$('.diary.is-open').forEach(d => d.classList.remove('is-open'));
    });
  }

  render();
  bindTouch();
  loadPhotos();
})();
