/*
 * 홈 화면 — 여행 목록 (index.html)
 * 여행 파일(js/trips/*.js)로 카드와 동선 그림을 바로 그리고, 사진 서버에서 여행마다 사진 수와 썸네일을 받아 채운다.
 * 사진 서버에 닿지 못해도 목록과 동선 그림은 그대로 보인다.
 */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CONFIG = typeof DIARY_CONFIG !== 'undefined' ? DIARY_CONFIG : {};
  const THUMBS = 5;   // 카드에 보여줄 사진 수 (좁은 화면에서는 CSS 가 4장까지만)

  // ---------- 여행 정보 ----------
  const stopsOf = trip => trip.days.flatMap(d => d.stops);
  // 장소: 좌표가 같은 곳(숙소, 두 번 간 곳)은 한 곳으로 센다. 이름은 처음 나온 것을 쓴다.
  const placesOf = trip => {
    const seen = new Map();
    stopsOf(trip).forEach(s => {
      if (typeof s.lat !== 'number' || typeof s.lng !== 'number') return;
      const k = `${s.lat.toFixed(5)},${s.lng.toFixed(5)}`;
      if (!seen.has(k)) seen.set(k, s.name);
    });
    return [...seen.values()];
  };
  const md = (m, d) => `${Number(m)}월 ${Number(d)}일`;
  function dateText(trip) {
    let a, b;
    if (trip.start) {
      a = trip.start.split('-'); b = (trip.end || trip.start).split('-');
      a = [a[1], a[2]]; b = [b[1], b[2]];
    } else {   // 연도를 모르는 여행: 일정의 첫날·마지막 날 "MM.DD"
      a = String(trip.days[0]?.date || '').split('.');
      b = String(trip.days[trip.days.length - 1]?.date || '').split('.');
    }
    if (a.length < 2) return '';
    if (b.length < 2 || (a[0] === b[0] && a[1] === b[1])) return md(a[0], a[1]);
    return a[0] === b[0] ? `${md(a[0], a[1])} – ${Number(b[1])}일` : `${md(a[0], a[1])} – ${md(b[0], b[1])}`;
  }
  const yearOf = trip => (trip.start ? trip.start.slice(0, 4) : '');
  const groupKey = trip => (trip.planned || !trip.start ? 'planned' : yearOf(trip));

  // ---------- 동선 그림 (실제 좌표를 이어 그린 선) ----------
  function routeSvg(trip) {
    const pts = [];
    stopsOf(trip).forEach(s => {
      if (typeof s.lat !== 'number' || typeof s.lng !== 'number') return;
      const last = pts[pts.length - 1];
      if (!last || last.lat !== s.lat || last.lng !== s.lng) pts.push({ lat: s.lat, lng: s.lng });
    });
    if (!pts.length) return '<svg class="route" viewBox="0 0 100 100" aria-hidden="true"></svg>';
    const lat0 = pts.reduce((n, p) => n + p.lat, 0) / pts.length * Math.PI / 180;
    const xy = pts.map(p => ({ x: p.lng * Math.cos(lat0), y: -p.lat }));
    const minX = Math.min(...xy.map(p => p.x)), maxX = Math.max(...xy.map(p => p.x));
    const minY = Math.min(...xy.map(p => p.y)), maxY = Math.max(...xy.map(p => p.y));
    const span = Math.max(maxX - minX, maxY - minY) || 1;
    const PAD = 14, SIZE = 100 - PAD * 2;
    const ox = PAD + (SIZE - (maxX - minX) / span * SIZE) / 2;
    const oy = PAD + (SIZE - (maxY - minY) / span * SIZE) / 2;
    const P = xy.map(p => ({ x: +(ox + (p.x - minX) / span * SIZE).toFixed(2), y: +(oy + (p.y - minY) / span * SIZE).toFixed(2) }));
    const d = P.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
    const uniq = [...new Map(P.map(p => [`${p.x},${p.y}`, p])).values()];
    const first = P[0], last = P[P.length - 1];
    return `<svg class="route" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <path class="route-line" d="${d}" pathLength="1"/>
      ${uniq.map(p => `<circle class="route-stop" cx="${p.x}" cy="${p.y}" r="1.6"/>`).join('')}
      ${P.length > 1 ? `<circle class="route-end" cx="${last.x}" cy="${last.y}" r="2.6"/>` : ''}
      <circle class="route-start" cx="${first.x}" cy="${first.y}" r="2.6"/>
    </svg>`;
  }

  // ---------- 카드 ----------
  function card(trip, i) {
    const places = placesOf(trip);
    const days = trip.days.length;
    return `
      <a class="trip" href="trip.html?trip=${encodeURIComponent(trip.id)}" data-trip="${esc(trip.id)}" style="--i:${i}">
        <figure class="trip-route">${routeSvg(trip)}</figure>
        <div class="trip-body">
          <h3 class="trip-title">${esc(trip.title)}</h3>
          <p class="trip-meta">
            ${trip.place ? `<span>${esc(trip.place)}</span>` : ''}
            <span>${esc(dateText(trip))}</span>
            <span>${esc(trip.nights || `${days}일`)}</span>
          </p>
          <p class="trip-places">${esc(places.slice(0, 4).join(', '))}${places.length > 4 ? ` 외 ${places.length - 4}곳` : ''}</p>
        </div>
        <div class="trip-photos" data-state="loading" aria-hidden="true">
          ${Array.from({ length: THUMBS }, () => '<span class="ph ph-empty"></span>').join('')}
        </div>
        <p class="trip-stats">
          <span>장소 ${places.length}곳</span>
          <span class="stat-photos" hidden></span>
          <span class="stat-notes" hidden></span>
        </p>
      </a>`;
  }

  function render() {
    const trips = [...TRIPS];
    const groups = new Map();
    // 다가올 여행 먼저, 그다음 최근 연도부터. 같은 묶음 안에서는 최근 여행이 위
    trips.sort((a, b) => (b.start || '9999').localeCompare(a.start || '9999'));
    trips.forEach(t => { const k = groupKey(t); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t); });
    const keys = [...groups.keys()].sort((a, b) => (a === 'planned' ? -1 : b === 'planned' ? 1 : b.localeCompare(a)));
    let n = 0;
    $('#trip-list').innerHTML = keys.map(k => `
      <section class="trip-group" aria-labelledby="g-${k}">
        <h2 class="group-title${k === 'planned' ? ' is-word' : ''}" id="g-${k}">${k === 'planned' ? '다가올 여행' : esc(k)}</h2>
        ${groups.get(k).map(t => card(t, n++)).join('')}
      </section>`).join('') || '<p class="home-lede">아직 여행이 없어요. js/trips/manifest.js 에 여행 파일을 추가하세요.</p>';
  }

  // ---------- 사진 서버 ----------
  async function fetchState(trip) {
    const server = String(trip.server ?? CONFIG.server ?? '').replace(/\/+$/, '');
    if (!server) return null;   // 브라우저 모드 여행: 사진은 각 기기에만 있다
    const res = await fetch(`${server}/api/${encodeURIComponent(trip.id)}/state`, { headers: { 'X-Diary-Key': trip.serverKey ?? CONFIG.serverKey ?? '' } });
    if (!res.ok) throw new Error(`서버 응답 ${res.status}`);
    const s = await res.json();
    const order = new Map(stopsOf(trip).map((st, i) => [st.id, i]));
    const photos = (s.photos || [])
      .filter(p => order.has(p.stopId))
      .sort((a, b) => order.get(a.stopId) - order.get(b.stopId) || (a.order ?? 0) - (b.order ?? 0));
    // 썸네일: 장소마다 첫 사진을 먼저 고르고, 모자라면 나머지에서 채운다 (한 장소 사진만 줄줄이 나오지 않게)
    const firsts = [], rest = [], seen = new Set();
    photos.forEach(p => { if (seen.has(p.stopId)) rest.push(p); else { seen.add(p.stopId); firsts.push(p); } });
    const pick = [...firsts, ...rest].slice(0, THUMBS);
    const thumb = p => `${server}/files/${encodeURIComponent(trip.id)}/${encodeURIComponent(p.id)}.thumb.jpg?k=${encodeURIComponent(s.fileToken || '')}`;
    const notes = (s.entries || []).filter(e => e.note && String(e.note).trim()).length;
    return { total: photos.length, notes, thumbs: pick.map(thumb) };
  }

  function fill(trip, data) {
    const el = document.querySelector(`.trip[data-trip="${CSS.escape(trip.id)}"]`);
    if (!el) return;
    const strip = $('.trip-photos', el);
    if (!data || !data.total) {   // 사진이 없으면 사진 칸을 숨기고 장소 이름을 보여준다
      strip.hidden = true;
      el.classList.add('no-photos');
    } else {
      // 마지막 칸에 남은 사진 수(+N). 넓은 화면은 5칸, 좁은 화면은 4칸까지 보이므로 둘 다 계산해 둔다.
      const tiles = data.thumbs.length;
      const moreWide = i => (i === tiles - 1 && data.total > tiles ? `+${data.total - tiles}` : '');
      const moreNarrow = i => (i === Math.min(tiles, 4) - 1 && data.total > Math.min(tiles, 4) ? `+${data.total - Math.min(tiles, 4)}` : '');
      strip.innerHTML = data.thumbs.map((src, i) => `
        <span class="ph"${moreWide(i) ? ` data-more="${moreWide(i)}"` : ''}${moreNarrow(i) ? ` data-more-narrow="${moreNarrow(i)}"` : ''}>
          <img src="${esc(src)}" alt="" loading="lazy" decoding="async">
        </span>`).join('');
      strip.querySelectorAll('img').forEach(img => {
        const done = () => img.parentElement.classList.add('is-loaded');
        if (img.complete && img.naturalWidth) done(); else { img.addEventListener('load', done); img.addEventListener('error', () => img.parentElement.classList.add('is-broken')); }
      });
      strip.dataset.state = 'ready';
      el.classList.add('has-photos');
      const sp = $('.stat-photos', el); sp.textContent = `사진 ${data.total}장`; sp.hidden = false;
    }
    if (data && data.notes) { const sn = $('.stat-notes', el); sn.textContent = `기록 ${data.notes}개`; sn.hidden = false; }
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

  render();
  loadPhotos();
})();
