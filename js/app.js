/*
 * Travel Diary — 화면 구성과 상호작용 (여행 내용은 js/itinerary.js 에서 온다)
 * 사진은 브라우저 안에서 리사이즈(JPEG)해 IndexedDB에 저장한다. 서버가 필요 없다.
 * 지도는 Leaflet + OpenStreetMap 타일을 온라인에서 불러오고, 실패하면 안내 문구만 보여준다.
 */
(() => {
  'use strict';

  const MAX_FULL = 2048;      // 원본 보관용 긴 변 최대 픽셀
  const MAX_THUMB = 640;      // 썸네일 긴 변
  const JPEG_Q_FULL = 0.9;
  const JPEG_Q_THUMB = 0.82;

  const LEAFLET_CSS = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
  const LEAFLET_JS = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
  // OpenStreetMap 표준 타일(키 불필요). 색은 CSS 필터(.map .leaflet-tile-pane)로 종이 느낌에 맞춘다.
  const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  // 저장소: itinerary.js 의 server 주소(또는 ?server= 쿼리)가 있으면 서버, 없으면 브라우저 IndexedDB
  // ?server= 덮어쓰기는 로컬 테스트용. 공개 주소에서는 무시한다 (가짜 서버 링크로 비밀번호를 가로채지 못하도록).
  const LOCAL_HOST = ['localhost', '127.0.0.1', '[::1]', ''].includes(location.hostname);
  const SERVER = (LOCAL_HOST && new URLSearchParams(location.search).get('server')) || ITINERARY.server || '';
  const REMOTE = !!SERVER && typeof RemoteStore !== 'undefined';
  if (REMOTE) RemoteStore.configure(SERVER, ITINERARY.id || 'trip', ITINERARY.serverKey || '');
  const STORE = REMOTE ? RemoteStore : DB;
  const toBlob = async x => {   // 서버 모드에서는 URL 을 받아온다
    if (x instanceof Blob) return x;
    const res = await fetch(x);
    if (!res.ok) throw new Error(`사진을 받지 못했어요 (${res.status})`);
    return res.blob();
  };
  let serverError = '';   // 서버 모드에서 서버에 닿지 못했을 때의 안내 문구

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad2 = n => String(n).padStart(2, '0');
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));

  const CAMERA_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
  const PIN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 21s-6-5.4-6-11a6 6 0 0 1 12 0c0 5.6-6 11-6 11z"/><circle cx="12" cy="10" r="2.3"/></svg>';

  // ---------- 상태 ----------
  const stopIndex = new Map();     // stopId -> { stop, day, dayNo, n }
  const photosByStop = new Map();  // stopId -> photo[] (order 순)
  const entries = new Map();       // id -> { id, note, time, updatedAt }
  const urls = new Map();          // photoId -> { thumb, full } object URL
  const saveTimers = new Map();    // entryId -> timeout
  let lightbox = { stopId: null, index: 0 };
  let pickTarget = null;           // 파일 선택창을 연 장소 id
  let toastTimer = null;

  ITINERARY.days.forEach((day, di) => day.stops.forEach((stop, i) => stopIndex.set(stop.id, { stop, day, dayNo: di + 1, n: i + 1 })));

  function hasCoords(s) { return Number.isFinite(s.lat) && Number.isFinite(s.lng); }

  // ---------- 정적 구조 ----------
  function buildStatic() {
    const brand = ITINERARY.brand || `${ITINERARY.title} Diary`;
    document.title = brand;
    $('#nav-brand').textContent = brand;
    $('#hero-title').textContent = ITINERARY.title;
    const seal = $('#seal');
    seal.textContent = ITINERARY.seal || '';
    seal.hidden = !ITINERARY.seal;
    fitTitle();
    $('#hero-period').textContent = ITINERARY.period;
    $('#hero-nights').textContent = ITINERARY.nights || '';
    $('#nav-days').innerHTML = ITINERARY.days.map(d => `<a href="#${d.id}" data-day="${d.id}">${esc(d.label)}</a>`).join('');
    $('#days').innerHTML = ITINERARY.days.map(renderDay).join('');
    layoutTimelines();
  }

  // 제목이 한 줄에 들어가지 않으면(예: GANGNEUNG) 글자 크기를 폭에 맞춰 줄인다. 도장 자리는 항상 비워 둔다.
  function fitTitle() {
    const el = $('#hero-title');
    const seal = $('#seal');
    el.style.fontSize = '';
    if (!el.firstChild) return;
    const reserve = seal.hidden ? 0 : seal.getBoundingClientRect().width + 16;
    const available = el.clientWidth - reserve;
    // 블록의 scrollWidth 는 넘치지 않으면 clientWidth 와 같으므로, 글자 자체의 폭을 잰다.
    const range = document.createRange();
    range.selectNodeContents(el);
    const textWidth = range.getBoundingClientRect().width;
    if (available > 0 && textWidth > available) {
      const base = parseFloat(getComputedStyle(el).fontSize);
      el.style.fontSize = `${Math.max(24, Math.floor(base * available / textWidth))}px`;
    }
  }

  // 좁은 화면에서는 타임라인을 ㄹ자 두 줄로 접는다: 첫째 줄은 왼쪽→오른쪽, 둘째 줄은 오른쪽→왼쪽.
  // 첫째 줄 마지막 장소 바로 아래에 다음 장소가 오고, 둘을 U자 선으로 잇는다 (row-end). 읽는 순서(DOM)는 그대로다.
  function layoutTimelines() {
    const narrow = window.innerWidth <= 760;
    $$('.timeline').forEach(tl => {
      const items = $$('.tl-stop', tl);
      const wrap = narrow && items.length > 3;
      tl.classList.toggle('is-wrapped', wrap);
      const perRow = wrap ? Math.ceil(items.length / 2) : 0;
      tl.style.gridTemplateColumns = wrap ? `repeat(${perRow}, minmax(0, 1fr))` : '';
      items.forEach((el, i) => {
        const second = wrap && i >= perRow;
        el.style.gridRow = wrap ? (second ? '2' : '1') : '';
        el.style.gridColumn = wrap ? String(second ? perRow - (i - perRow) : i + 1) : '';
        el.classList.toggle('row-end', wrap && i === perRow - 1 && i !== items.length - 1);
        el.classList.toggle('row-rev', second);
      });
      fitLabels(tl);
    });
  }
  // 장소 이름 맞추기 (한글 이름이 단어 중간에서 끊기지 않도록):
  //  1) 칸보다 긴 단어가 있으면 이름 상자를 그 단어 폭까지 넓혀 점 위 가운데에 둔다 (옆 칸 여백으로 조금 넘침)
  //  2) 그래도 이웃 이름과 닿으면 더 넓은 쪽 글자를 1px 씩 최대 2px 줄인다
  //  3) 그래도 닿으면 마지막 수단으로 단어 중간 줄바꿈(is-tight)
  function fitLabels(tl) {
    const labs = $$('.tl-label', tl);
    if (!labs.length) return;
    labs.forEach(l => { l.style.fontSize = ''; l.style.maxWidth = ''; l.classList.remove('is-tight'); });
    const base = parseFloat(getComputedStyle(labs[0]).fontSize) || 14;
    const lines = l => { const r = document.createRange(); r.selectNodeContents(l); return [...r.getClientRects()]; };
    const box = l => { const r = document.createRange(); r.selectNodeContents(l); return r.getBoundingClientRect(); };
    const widen = l => {
      const widest = Math.max(0, ...lines(l).map(r => r.width));
      if (widest > l.clientWidth - 4 + 0.5) l.style.maxWidth = `${Math.ceil(widest) + 4}px`;   // 좌우 padding 2px 씩
    };
    const GAP = 4;
    const touch = (a, b) => {
      const p = box(a), q = box(b);
      return p.right + GAP > q.left && q.right + GAP > p.left && p.bottom > q.top && q.bottom > p.top;
    };
    const shrink = l => {
      const size = parseFloat(l.style.fontSize) || base;
      if (size <= base - 2) return false;
      l.style.fontSize = `${size - 1}px`; l.style.maxWidth = ''; widen(l);
      return true;
    };
    const tighten = l => {
      if (l.classList.contains('is-tight')) return false;
      l.classList.add('is-tight'); l.style.maxWidth = '';
      return true;
    };
    labs.forEach(widen);
    for (let pass = 0; pass < 8; pass++) {
      let changed = false;
      for (let i = 0; i < labs.length; i++) {
        for (let j = i + 1; j < labs.length; j++) {
          if (!touch(labs[i], labs[j])) continue;
          const [a, b] = box(labs[i]).width >= box(labs[j]).width ? [labs[i], labs[j]] : [labs[j], labs[i]];
          if (shrink(a) || shrink(b) || tighten(a) || tighten(b)) changed = true;   // 넓은 쪽 → 이웃 → 단어 끊기 순
        }
      }
      if (!changed) break;
    }
  }

  function renderDay(day) {
    const last = day.stops.length - 1;
    const timeline = day.stops.map((s, i) => `
      <div class="tl-stop${i === last ? ' is-last' : ''}" role="listitem" data-stop="${s.id}">
        <button class="tl-label" type="button" data-action="map" data-stop="${s.id}" title="지도에서 보기">${esc(s.name)}</button>
        <span class="tl-dot"></span>
        ${s.next && i !== last ? `<span class="tl-transit">${esc(s.next)}</span>` : ''}
      </div>`).join('');

    const stops = day.stops.map((s, i) => `
      <article class="stop" id="stop-${s.id}" data-stop="${s.id}" tabindex="-1">
        <header class="stop-head">
          <span class="stop-idx">${pad2(i + 1)}</span>
          <div class="stop-titles">
            <h3 class="stop-name">${esc(s.name)}</h3>
            ${s.en ? `<span class="stop-en">${esc(s.en)}</span>` : ''}
            ${hasCoords(s) ? `<button class="btn-icon" type="button" data-action="locate" data-stop="${s.id}" title="지도에서 보기" aria-label="${esc(s.name)} 지도에서 보기">${PIN_SVG}</button>` : ''}
          </div>
          <input class="stop-time" type="text" inputmode="numeric" placeholder="--:--" maxlength="5"
                 aria-label="${esc(s.name)} 방문 시간" data-field="time" data-entry="${s.id}">
          <button class="btn btn-ghost" type="button" data-action="add" data-stop="${s.id}">+ 사진</button>
        </header>
        <div class="photos" data-role="photos"></div>
        <div class="note-wrap">
          <textarea class="note" rows="1" placeholder="이곳에서의 기록을 남겨보세요"
                    aria-label="${esc(s.name)} 기록" data-field="note" data-entry="${s.id}"></textarea>
          <span class="save-state" data-role="save"></span>
        </div>
      </article>
      ${i !== last && s.next ? `<div class="transit"><span>${esc(s.next)}</span></div>` : ''}`).join('');

    return `
      <section class="day" id="${day.id}" data-day="${day.id}">
        <div class="day-side"><div class="day-side-inner">
          <span class="day-badge">${esc(day.label)}</span>
          <p class="day-date">${esc(day.date)} ${esc(day.weekday)}</p>
        </div></div>
        <div class="day-main">
          <div class="timeline" role="list" aria-label="${esc(day.label)} 동선">${timeline}</div>
          <div class="day-memo">
            <span class="memo-label">${esc(day.label)} · MEMO</span>
            <div class="note-wrap">
              <textarea class="note" rows="1" placeholder="오늘 하루는 어땠나요?"
                        aria-label="${esc(day.label)} 메모" data-field="note" data-entry="memo:${day.id}"></textarea>
              <span class="save-state" data-role="save"></span>
            </div>
          </div>
          <div class="stops">${stops}</div>
        </div>
      </section>`;
  }

  // ---------- 데이터 로드 ----------
  async function loadData() {
    const [photos, ents] = await Promise.all([STORE.getAllPhotos(), STORE.getAllEntries()]);
    photosByStop.clear();
    entries.clear();
    photos.forEach(p => {
      if (!photosByStop.has(p.stopId)) photosByStop.set(p.stopId, []);
      photosByStop.get(p.stopId).push(p);
    });
    photosByStop.forEach(list => list.sort((a, b) => a.order - b.order));
    ents.forEach(e => entries.set(e.id, e));
  }

  function renderAll() {
    stopIndex.forEach((_, id) => { renderPhotos(id); updateDot(id); });
    $$('[data-field]').forEach(el => {
      const e = entries.get(el.dataset.entry);
      el.value = e ? (e[el.dataset.field] || '') : '';
      if (el.tagName === 'TEXTAREA') autosize(el);
    });
  }

  // ---------- 사진 표시 ----------
  function urlFor(photo, kind) {
    let u = urls.get(photo.id);
    if (!u) { u = {}; urls.set(photo.id, u); }
    if (!u[kind]) u[kind] = typeof photo[kind] === 'string' ? photo[kind] : URL.createObjectURL(photo[kind]);
    return u[kind];
  }
  function revokeUrls(id) {
    const u = urls.get(id);
    if (!u) return;
    Object.values(u).forEach(x => { if (x.startsWith('blob:')) URL.revokeObjectURL(x); });
    urls.delete(id);
  }
  function stopName(id) { const s = stopIndex.get(id); return s ? s.stop.name : ''; }

  function renderPhotos(stopId) {
    const card = document.getElementById(`stop-${stopId}`);
    if (!card) return;
    const wrap = $('[data-role="photos"]', card);
    const list = photosByStop.get(stopId) || [];
    if (!list.length) {
      wrap.innerHTML = `<button class="dropzone" type="button" data-action="add" data-stop="${stopId}">${CAMERA_SVG}<span>사진을 끌어다 놓거나 클릭해서 추가하세요</span></button>`;
      return;
    }
    wrap.innerHTML = `<div class="photo-grid">${list.map((p, i) => `
      <figure class="photo" data-action="open" data-stop="${stopId}" data-index="${i}" tabindex="0" role="button"
              aria-label="${esc(p.caption || stopName(stopId))} 사진 ${i + 1}">
        <img src="${urlFor(p, 'thumb')}" alt="${esc(p.caption || '')}" loading="lazy" draggable="false">
        ${p.caption ? `<figcaption class="photo-cap">${esc(p.caption)}</figcaption>` : ''}
      </figure>`).join('')}
      <button class="photo-add" type="button" data-action="add" data-stop="${stopId}" aria-label="사진 추가">+</button>
    </div>`;
  }

  function hasContent(stopId) {
    const e = entries.get(stopId);
    return (photosByStop.get(stopId) || []).length > 0 || !!(e && e.note && e.note.trim());
  }
  function updateDot(stopId) {
    $$(`.tl-stop[data-stop="${stopId}"]`).forEach(el => el.classList.toggle('has-content', hasContent(stopId)));
    refreshPin(stopId);
  }
  // ---------- 기록 저장 ----------
  function saveEntry(id, patch, statusEl) {
    const cur = entries.get(id) || { id };
    const next = { ...cur, ...patch, updatedAt: Date.now() };
    entries.set(id, next);
    clearTimeout(saveTimers.get(id));
    saveTimers.set(id, setTimeout(async () => {
      saveTimers.delete(id);
      try {
        await STORE.putEntry(next);
        flashSaved(statusEl);
      } catch (err) {
        console.error(err);
        toast(`저장에 실패했어요: ${err.message || ''}`, 5000);
        if (statusEl) { statusEl.textContent = 'NOT SAVED'; statusEl.classList.add('is-visible', 'is-error'); }
        return;
      }
      if (stopIndex.has(id)) updateDot(id);
    }, 400));
  }
  function flushSaves() {
    saveTimers.forEach((t, id) => {
      clearTimeout(t);
      const e = entries.get(id);
      if (e) STORE.putEntry(e).catch(() => {});
    });
    saveTimers.clear();
  }
  function flashSaved(el) {
    if (!el) return;
    el.textContent = 'SAVED';
    el.classList.remove('is-error');
    el.classList.add('is-visible');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('is-visible'), 1600);
  }
  function autosize(ta) {
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  }

  // ---------- 이미지 처리 ----------
  async function decodeImage(file) {
    if (typeof createImageBitmap === 'function') {
      // EXIF 회전 반영. 옵션을 모르는 브라우저는 예외를 던지므로 순서대로 시도한다.
      try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (_) { /* fall through */ }
      try { return await createImageBitmap(file); } catch (_) { /* fall through */ }
    }
    const dataUrl = await readAsDataURL(file);
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    return img;
  }
  function drawScaled(src, max, quality) {
    const sw = src.naturalWidth || src.width;
    const sh = src.naturalHeight || src.height;
    const r = Math.min(1, max / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * r));
    const h = Math.max(1, Math.round(sh * r));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(src, 0, 0, w, h);
    return new Promise((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve({ blob: b, w, h }) : reject(new Error('toBlob 실패'))), 'image/jpeg', quality));
  }
  async function processImage(file) {
    const src = await decodeImage(file);
    try {
      const full = await drawScaled(src, MAX_FULL, JPEG_Q_FULL);
      const thumb = await drawScaled(src, MAX_THUMB, JPEG_Q_THUMB);
      return { full: full.blob, thumb: thumb.blob, width: full.w, height: full.h };
    } finally {
      if (typeof src.close === 'function') src.close();
    }
  }
  const readAsDataURL = blob => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
  function dataUrlToBlob(dataUrl) {
    const comma = dataUrl.indexOf(',');
    const head = dataUrl.slice(0, comma);
    const mime = (/data:([^;,]+)/.exec(head) || [])[1] || 'image/jpeg';
    const bin = atob(dataUrl.slice(comma + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  // ---------- 사진 추가 ----------
  async function addFiles(stopId, fileList) {
    if (!stopIndex.has(stopId)) return;
    if (serverError) { toast(`사진 서버에 연결할 수 없어 올릴 수 없어요. ${serverError}`, 5000); return; }
    const files = Array.from(fileList || []).filter(f => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    if (!files.length) { toast('이미지 파일만 추가할 수 있어요'); return; }
    toast(`사진 ${files.length}장을 정리하는 중…`, 0);
    const list = photosByStop.get(stopId) || [];
    let order = list.length ? Math.max(...list.map(p => p.order)) + 1 : 1;
    let ok = 0;
    const failed = [];
    let uploadError = '';
    for (const file of files) {
      let img;
      try { img = await processImage(file); }
      catch (err) { console.warn('사진 변환 실패:', file.name, err); failed.push(file.name); continue; }
      const photo = { id: uid(), stopId, order: order++, caption: '', createdAt: Date.now(), name: file.name, ...img };
      try { await STORE.putPhoto(photo); }
      catch (err) { console.error('사진 저장 실패:', file.name, err); uploadError = err.message || '저장 실패'; break; }
      list.push(photo);
      ok++;
    }
    photosByStop.set(stopId, list);
    renderPhotos(stopId);
    updateDot(stopId);
    if (uploadError) toast(`${ok}장 추가 후 ${REMOTE ? '서버에 올리지' : '저장하지'} 못했어요: ${uploadError}`, 6000);
    else if (failed.length) toast(`${ok}장 추가 · ${failed.length}장은 열 수 없었어요 (HEIC 등 미지원 형식)`, 4500);
    else toast(`사진 ${ok}장을 추가했어요`);
  }

  // ---------- 사진 보기 ----------
  const lb = {
    el: $('#lightbox'), img: $('#lb-img'), title: $('#lb-title'),
    count: $('#lb-count'), caption: $('#lb-caption')
  };
  function currentPhoto() {
    const list = photosByStop.get(lightbox.stopId) || [];
    return list[lightbox.index] || null;
  }
  function openLightbox(stopId, index) {
    lightbox = { stopId, index };
    lb.el.hidden = false;
    document.body.style.overflow = 'hidden';
    showLightbox();
    $('#lb-close').focus();
  }
  function showLightbox() {
    const list = photosByStop.get(lightbox.stopId) || [];
    if (!list.length) { closeLightbox(); return; }
    lightbox.index = Math.max(0, Math.min(lightbox.index, list.length - 1));
    const p = list[lightbox.index];
    lb.img.src = urlFor(p, 'full');
    lb.img.alt = p.caption || stopName(lightbox.stopId);
    lb.title.textContent = stopName(lightbox.stopId);
    lb.count.textContent = `${lightbox.index + 1} / ${list.length}`;
    lb.caption.value = p.caption || '';
    const first = lightbox.index === 0;
    const lastIdx = lightbox.index === list.length - 1;
    $('#lb-prev').disabled = first;
    $('#lb-move-prev').disabled = first;
    $('#lb-next').disabled = lastIdx;
    $('#lb-move-next').disabled = lastIdx;
  }
  function closeLightbox() {
    lb.el.hidden = true;
    document.body.style.overflow = '';
    lb.img.removeAttribute('src');
  }
  function stepLightbox(d) {
    const list = photosByStop.get(lightbox.stopId) || [];
    const next = lightbox.index + d;
    if (next < 0 || next >= list.length) return;
    lightbox.index = next;
    showLightbox();
  }
  async function saveCaption() {
    const p = currentPhoto();
    if (!p) return;
    const v = lb.caption.value.trim();
    if (v === (p.caption || '')) return;
    p.caption = v;
    try {
      await STORE.putPhoto(p);
      renderPhotos(lightbox.stopId);
      toast('사진 설명을 저장했어요');
    } catch (err) { console.error(err); toast('저장에 실패했어요'); }
  }
  async function movePhoto(d) {
    const list = photosByStop.get(lightbox.stopId) || [];
    const i = lightbox.index;
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const [p] = list.splice(i, 1);
    list.splice(j, 0, p);
    list.forEach((x, k) => { x.order = k + 1; });
    try {
      await STORE.putPhotos(list);
      lightbox.index = j;
      renderPhotos(lightbox.stopId);
      showLightbox();
    } catch (err) { console.error(err); toast('순서 변경에 실패했어요'); }
  }
  async function deleteCurrent() {
    const p = currentPhoto();
    if (!p) return;
    if (!confirm('이 사진을 삭제할까요? 되돌릴 수 없어요.')) return;
    try {
      await STORE.deletePhoto(p.id);
    } catch (err) { console.error(err); toast('삭제에 실패했어요'); return; }
    const list = photosByStop.get(lightbox.stopId) || [];
    list.splice(list.indexOf(p), 1);
    revokeUrls(p.id);
    renderPhotos(lightbox.stopId);
    updateDot(lightbox.stopId);
    if (!list.length) closeLightbox(); else showLightbox();
    toast('사진을 삭제했어요');
  }
  async function downloadCurrent() {
    const p = currentPhoto();
    if (!p) return;
    const s = stopIndex.get(lightbox.stopId);
    const name = `${s.day.label.replace(/\s+/g, '')}-${pad2(s.n)}-${stopName(lightbox.stopId)}-${pad2(lightbox.index + 1)}.jpg`;
    try { downloadBlob(await toBlob(p.full), name); } catch (err) { console.error(err); toast('사진을 내려받지 못했어요'); }
  }
  function downloadBlob(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }

  // ---------- 지도 ----------
  let map = null;
  let activeDay = 'all';
  let lastOpened = null;           // 마지막으로 팝업을 연 rec (Esc 로 닫을 때 포커스 복귀용)
  const markerRecs = [];           // { marker, key, items: [{ day, dayNo, stop, n }], days: Set }
  const markerByStop = new Map();  // stopId -> rec
  const dayLines = new Map();      // dayId -> polyline

  function loadLeaflet() {
    if (window.L) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let left = 2;
      const done = () => { if (--left === 0) resolve(); };
      const css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = LEAFLET_CSS;
      css.onload = done; css.onerror = () => reject(new Error('Leaflet CSS 로드 실패'));
      const js = document.createElement('script');
      js.src = LEAFLET_JS;
      js.onload = done; js.onerror = () => reject(new Error('Leaflet JS 로드 실패'));
      document.head.append(css, js);
    });
  }

  async function initMap() {
    const el = $('#map');
    try { await loadLeaflet(); } catch (err) {
      console.warn(err);
      $('#map-fallback').hidden = false;
      return;
    }
    const mobile = !!(L.Browser && L.Browser.mobile) || !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
    // 터치 기기에서는 한 번 탭하기 전까지 드래그를 꺼 둔다(한 손가락 스와이프가 페이지 스크롤로 남도록).
    map = L.map(el, { scrollWheelZoom: false, dragging: !mobile, zoomSnap: 0.5, attributionControl: true });
    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map);

    // 같은 좌표(숙소 등)에 있는 장소는 핀 하나로 묶는다.
    ITINERARY.days.forEach((day, di) => {
      const pts = [];
      day.stops.forEach((stop, i) => {
        if (!hasCoords(stop)) return;
        pts.push([stop.lat, stop.lng]);
        const key = `${stop.lat.toFixed(5)},${stop.lng.toFixed(5)}`;
        let rec = markerRecs.find(r => r.key === key);
        if (!rec) {
          rec = { key, items: [], days: new Set(), marker: L.marker([stop.lat, stop.lng], { riseOnHover: true, keyboard: true }) };
          rec.marker.bindPopup(() => popupHtml(rec), { closeButton: false, maxWidth: 280, minWidth: 170 });
          rec.marker.on('popupopen', () => { lastOpened = rec; });
          rec.marker.on('popupclose', () => { if (lastOpened === rec) lastOpened = null; });
          markerRecs.push(rec);
        }
        rec.items.push({ day, dayNo: di + 1, stop, n: i + 1 });
        rec.days.add(day.id);
        markerByStop.set(stop.id, rec);
      });
      if (pts.length > 1) {
        dayLines.set(day.id, L.polyline(pts, { color: '#171717', weight: 1.5, dashArray: '4 5', opacity: .65, interactive: false }));
      }
    });
    markerRecs.forEach(rec => {
      rec.marker.options.title = rec.items.map(x => x.stop.name).join(' / ');
      rec.marker.setIcon(pinIcon(rec));
    });
    // 여러 장소가 묶인 팝업만 지도 높이의 70% 로 제한해 안에서 스크롤되게 한다(크기가 바뀌면 다시 계산).
    const applyPopupMaxH = () => {
      const h = Math.max(150, Math.round(el.clientHeight * 0.7));
      markerRecs.forEach(r => { r.marker.getPopup().options.maxHeight = r.items.length > 1 ? h : null; });
    };
    applyPopupMaxH();
    map.on('resize', () => { applyPopupMaxH(); map.closePopup(); });

    el.addEventListener('click', e => {
      const t = e.target.closest('[data-action="jump"]');
      if (!t) return;
      map.closePopup();
      jumpTo(t.dataset.stop);
    });
    // 지도를 클릭한 뒤에만 휠 줌, 모바일에서는 탭한 뒤에만 드래그 (페이지 스크롤을 가로채지 않도록)
    const hint = $('#map-hint');
    const setDrag = on => {
      if (on) map.dragging.enable(); else map.dragging.disable();
      hint.hidden = !mobile || on;
    };
    if (mobile) setDrag(false);
    map.on('click', () => { map.scrollWheelZoom.enable(); if (mobile) setDrag(true); });
    map.on('mouseout', () => map.scrollWheelZoom.disable());
    document.addEventListener('touchstart', e => {
      if (mobile && map.dragging.enabled() && !el.contains(e.target)) setDrag(false);
    }, { passive: true });
    // Esc 로 팝업 닫기 (포커스는 그 핀으로 되돌린다). 실제로 열려 있을 때만 동작한다.
    el.addEventListener('keydown', e => {
      const rec = lastOpened;
      if (e.key !== 'Escape' || !rec || !rec.marker.isPopupOpen()) return;
      map.closePopup();
      const pin = rec.marker.getElement();
      if (pin) pin.focus({ preventScroll: true });
    });

    const tabs = $('#map-tabs');
    tabs.innerHTML = [
      '<button type="button" data-day="all">전체</button>',
      ...ITINERARY.days.map(d => `<button type="button" data-day="${d.id}">${esc(d.label)}</button>`)
    ].join('');
    tabs.addEventListener('click', e => {
      const b = e.target.closest('button[data-day]');
      if (b) setActiveDay(b.dataset.day);
    });
    setActiveDay('all');
  }

  function pinIcon(rec) {
    // 전체 보기: 일차 번호(여러 날이면 ✦), 날짜 보기: 그날의 방문 순서(같은 곳을 두 번 들르면 "2·5")
    const inDay = activeDay === 'all' ? [] : rec.items.filter(x => x.day.id === activeDay);
    const dayNos = [...new Set(rec.items.map(x => x.dayNo))];
    const label = inDay.length ? inDay.map(x => x.n).join('·') : (dayNos.length === 1 ? String(dayNos[0]) : '✦');
    const has = rec.items.some(x => hasContent(x.stop.id));
    const name = rec.items.map(x => `${x.day.label} ${x.stop.name}`).join(', ') + (has ? ' · 사진/기록 있음' : '');
    return L.divIcon({
      className: 'pin',
      html: `<span class="pin-dot${has ? ' has-content' : ''}${label.length > 2 ? ' is-multi' : ''}" aria-hidden="true">${label}</span><span class="sr-only">${esc(name)}</span>`,
      iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -14]
    });
  }
  function refreshPin(stopId) {
    const rec = markerByStop.get(stopId);
    if (rec && map) rec.marker.setIcon(pinIcon(rec));
  }
  function popupHtml(rec) {
    const single = rec.items.length === 1;
    const approx = rec.items.some(x => x.stop.approx);
    return `<div class="pop">${rec.items.map(({ day, stop, n }) => {
      const photos = photosByStop.get(stop.id) || [];
      const e = entries.get(stop.id);
      const meta = [photos.length ? `사진 ${photos.length}장` : '', e && e.note && e.note.trim() ? '기록 있음' : ''].filter(Boolean).join(' · ');
      return `<div class="pop-item">
        <span class="pop-day">${esc(day.label)} · ${pad2(n)}</span>
        <strong class="pop-name">${esc(stop.name)}</strong>
        ${single && stop.en ? `<span class="pop-en">${esc(stop.en)}</span>` : ''}
        ${single && photos.length ? `<img class="pop-thumb" src="${urlFor(photos[0], 'thumb')}" alt="">` : ''}
        ${meta ? `<span class="pop-meta">${meta}</span>` : ''}
        <button class="pop-link" type="button" data-action="jump" data-stop="${stop.id}" aria-label="${esc(day.label)} ${esc(stop.name)} 기록 보기">기록 보기 →</button>
      </div>`;
    }).join('')}${approx ? '<span class="pop-approx">추정 위치예요 (정확하지 않을 수 있어요)</span>' : ''}</div>`;
  }
  function setActiveDay(dayId, { animate = true } = {}) {
    if (!map) return;
    activeDay = dayId;
    $$('#map-tabs button').forEach(b => {
      const on = b.dataset.day === dayId;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const show = id => dayId === 'all' || id === dayId;
    const pts = [];
    markerRecs.forEach(rec => {
      const on = [...rec.days].some(show);
      if (on) {
        rec.marker.setIcon(pinIcon(rec));   // 보기 방식에 따라 핀 숫자가 달라진다
        rec.marker.addTo(map);
        pts.push(rec.marker.getLatLng());
      } else map.removeLayer(rec.marker);
    });
    dayLines.forEach((line, id) => { if (show(id)) line.addTo(map); else map.removeLayer(line); });
    map.closePopup();
    if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [32, 32], maxZoom: 15, animate });
  }
  function jumpTo(stopId) {
    const card = document.getElementById(`stop-${stopId}`);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    card.focus({ preventScroll: true });
  }
  let pendingLocate = null;   // 진행 중인 '지도에서 보기' { onMove, timer }
  function locate(stopId) {
    const s = stopIndex.get(stopId);
    const rec = markerByStop.get(stopId);
    if (!map || !s || !rec) return false;
    if (pendingLocate) {   // 연달아 누르면 이전 요청은 취소
      map.off('moveend', pendingLocate.onMove);
      clearTimeout(pendingLocate.timer);
      pendingLocate = null;
    }
    if (activeDay !== 'all' && activeDay !== s.day.id) setActiveDay(s.day.id, { animate: false });
    $('#map').scrollIntoView({ behavior: 'smooth', block: 'center' });
    const target = rec.marker.getLatLng();
    const zoom = Math.max(Math.round(map.getZoom() * 2) / 2, 15);
    let done = false;
    const open = force => {
      if (done) return;
      // 다른 애니메이션의 moveend 일 수 있으니 도착했는지 확인하고, 아니면 계속 기다린다
      if (!force && (Math.abs(map.getZoom() - zoom) > 0.01 || !map.getCenter().equals(target, 1e-5))) {
        map.once('moveend', onMove);
        return;
      }
      done = true;
      map.off('moveend', onMove);
      if (pendingLocate) clearTimeout(pendingLocate.timer);
      pendingLocate = null;
      if (force) map.setView(target, zoom, { animate: false });   // 애니메이션이 멈춘 경우(백그라운드 탭 등)엔 바로 이동
      rec.marker.openPopup();
      const popupEl = rec.marker.getPopup() ? rec.marker.getPopup().getElement() : null;
      const content = popupEl && popupEl.querySelector('.leaflet-popup-content');
      const link = popupEl && popupEl.querySelector(`.pop-link[data-stop="${stopId}"]`);
      if (content && link) {   // 여러 장소가 묶인 팝업이면 요청한 항목이 보이도록 팝업 안쪽만 스크롤
        const item = link.closest('.pop-item') || link;
        content.scrollTop += item.getBoundingClientRect().top - content.getBoundingClientRect().top;
      }
      const focusTarget = link || rec.marker.getElement();
      if (focusTarget) focusTarget.focus({ preventScroll: true });
    };
    const onMove = () => open(false);
    map.closePopup();   // 이미 열려 있으면 openPopup 이 무시되어 autoPan 이 안 되므로 먼저 닫는다
    map.flyTo(target, zoom, { duration: 0.8 });   // flyTo 내부 _stop 이 이전 애니메이션의 moveend 를 먼저 흘려보낸다
    map.once('moveend', onMove);
    pendingLocate = { onMove, timer: setTimeout(() => open(true), 1500) };
    return true;
  }

  // ---------- 백업 ----------
  const stamp = () => {
    const d = new Date();
    return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
  };
  async function exportBackup() {
    try {
      toast('백업 파일을 만드는 중…', 0);
      const [photos, ents, meta] = await Promise.all([STORE.getAllPhotos(), STORE.getAllEntries(), STORE.getAllMeta()]);
      // 사진이 많아도 거대한 문자열 하나를 만들지 않도록 조각으로 이어 붙인다.
      const parts = [`{"app":"travel-diary","trip":${JSON.stringify(ITINERARY.id || '')},"version":1,"exportedAt":${JSON.stringify(new Date().toISOString())},"entries":${JSON.stringify(ents)},"meta":[`];
      for (let i = 0; i < meta.length; i++) {
        const m = meta[i];
        const item = m.blob ? { ...m, blob: await readAsDataURL(m.blob) } : m;
        parts.push((i ? ',' : '') + JSON.stringify(item));
      }
      parts.push('],"photos":[');
      let written = 0;
      const skipped = [];
      for (const p of photos) {
        let item;
        try { item = { ...p, full: await readAsDataURL(await toBlob(p.full)), thumb: await readAsDataURL(await toBlob(p.thumb)) }; }
        catch (err) { console.warn('백업에서 건너뜀:', p.id, err); skipped.push(p.id); continue; }
        parts.push((written++ ? ',' : '') + JSON.stringify(item));
      }
      parts.push(']}');
      if (!written && photos.length) throw new Error('사진을 한 장도 받지 못했어요');
      downloadBlob(new Blob(parts, { type: 'application/json' }), `${ITINERARY.id || 'travel'}-diary-${stamp()}.json`);
      toast(skipped.length ? `백업 파일을 저장했어요 (사진 ${written}장, ${skipped.length}장은 받지 못해 제외)` : `백업 파일을 저장했어요 (사진 ${written}장)`, skipped.length ? 6000 : 2200);
    } catch (err) {
      console.error(err);
      toast(`백업에 실패했어요: ${err.message || ''}`, 5000);
    }
  }
  async function importBackup(file) {
    let data;
    try { data = JSON.parse(await file.text()); } catch { toast('백업 파일을 읽을 수 없어요'); return; }
    const knownApp = data && (data.app === 'travel-diary' || data.app === 'tokyo-diary');   // 'tokyo-diary' 는 예전 형식
    if (!knownApp || !Array.isArray(data.photos)) { toast('이 다이어리의 백업 파일이 아니에요'); return; }
    const trip = data.trip || (data.app === 'tokyo-diary' ? 'tokyo' : '');
    if (trip && ITINERARY.id && trip !== ITINERARY.id &&
        !confirm(`다른 여행("${trip}")의 백업이에요. 장소 id 가 다르면 사진이 보이지 않고, 숙소처럼 id 가 겹치면 엉뚱한 카드에 붙을 수 있어요.\n그래도 불러올까요?`)) return;
    const n = data.photos.length;
    const m = (data.entries || []).length;
    const isImage = v => typeof v === 'string' && /^data:image\//.test(v);
    if (!data.photos.every(p => p && typeof p.id === 'string' && isImage(p.full) && isImage(p.thumb))) { toast('백업 파일에 깨진 사진 항목이 있어 불러오지 않았어요'); return; }
    const where = REMOTE ? '서버에 저장된 사진과 기록이 모든 기기에서' : '지금 저장된 사진과 기록이';
    if (!confirm(`백업을 불러오면 ${where} 이 파일의 내용으로 바뀝니다.\n(사진 ${n}장, 기록 ${m}개)\n\n계속할까요?`)) return;
    try {
      toast('백업을 불러오는 중…', 0);
      const photos = data.photos.map(p => ({ ...p, full: dataUrlToBlob(p.full), thumb: dataUrlToBlob(p.thumb) }));
      const meta = (data.meta || []).map(x => (x.blob ? { ...x, blob: dataUrlToBlob(x.blob) } : x));
      await STORE.replaceAll({ photos, entries: data.entries || [], meta });
      await reload();
      toast(`백업을 불러왔어요 (사진 ${n}장)`);
    } catch (err) {
      console.error(err);
      toast(`불러오기에 실패했어요: ${err.message || ''}`, 6000);
      try { await reload(); } catch { /* 서버 상태를 다시 읽지 못함 */ }
    }
  }
  async function reload() {
    Array.from(urls.keys()).forEach(revokeUrls);
    await loadData();
    renderAll();
  }

  // ---------- 토스트 ----------
  function toast(msg, ms = 2200) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    if (ms > 0) toastTimer = setTimeout(() => { el.hidden = true; }, ms);
  }

  // ---------- 내비게이션 활성 표시 ----------
  function setupNavHighlight() {
    const links = $$('#nav-days a');
    const sections = ITINERARY.days.map(d => document.getElementById(d.id)).filter(Boolean);
    let ticking = false;
    const update = () => {
      ticking = false;
      const line = $('#nav').offsetHeight + 40;
      let active = null;
      sections.forEach(s => { if (s.getBoundingClientRect().top <= line) active = s.id; });
      links.forEach(a => a.classList.toggle('is-active', a.dataset.day === active));
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  // ---------- 이벤트 ----------
  const hasFiles = e => !!(e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files'));

  function bindEvents() {
    const main = $('#days');

    main.addEventListener('click', e => {
      const t = e.target.closest('[data-action]');
      if (!t) return;
      const { action, stop } = t.dataset;
      if (action === 'add') {
        pickTarget = stop;
        $('#photo-file').click();
      } else if (action === 'open') {
        openLightbox(stop, Number(t.dataset.index));
      } else if (action === 'jump') {
        jumpTo(stop);
      } else if (action === 'locate') {
        locate(stop);
      } else if (action === 'map') {   // 타임라인: 지도에서 보기. 지도가 없거나(오프라인) 좌표가 없는 장소면 기록으로 이동
        if (!locate(stop)) jumpTo(stop);
      }
    });
    main.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.photo')) {
        e.preventDefault();
        e.target.click();
      }
    });
    main.addEventListener('input', e => {
      const el = e.target;
      if (!el.dataset.field) return;
      if (el.tagName === 'TEXTAREA') autosize(el);
      saveEntry(el.dataset.entry, { [el.dataset.field]: el.value }, $('[data-role="save"]', el.parentElement));
    });

    // 드래그 앤 드롭
    ['dragenter', 'dragover'].forEach(type => main.addEventListener(type, e => {
      if (!hasFiles(e)) return;
      const card = e.target.closest('.stop');
      if (!card) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      card.classList.add('is-dragover');
    }));
    main.addEventListener('dragleave', e => {
      const card = e.target.closest('.stop');
      if (card && !card.contains(e.relatedTarget)) card.classList.remove('is-dragover');
    });
    main.addEventListener('drop', e => {
      const card = e.target.closest('.stop');
      $$('.stop.is-dragover').forEach(c => c.classList.remove('is-dragover'));
      if (!card || !hasFiles(e)) return;
      e.preventDefault();
      addFiles(card.dataset.stop, e.dataTransfer.files);
    });
    window.addEventListener('dragover', e => e.preventDefault());
    window.addEventListener('drop', e => e.preventDefault());

    // 붙여넣기: 카드 안(기록 입력 중 등)에 포커스가 있을 때 이미지 붙여넣기
    document.addEventListener('paste', e => {
      const active = document.activeElement;
      const card = active && active.closest ? active.closest('.stop') : null;
      if (!card || !e.clipboardData) return;
      const files = Array.from(e.clipboardData.files || []).filter(f => f.type.startsWith('image/'));
      if (files.length) { e.preventDefault(); addFiles(card.dataset.stop, files); }
    });

    // 파일 선택
    $('#photo-file').addEventListener('change', e => {
      if (pickTarget && e.target.files.length) addFiles(pickTarget, e.target.files);
      e.target.value = '';
    });

    // 사진 보기
    $('#lb-close').addEventListener('click', closeLightbox);
    $('#lb-prev').addEventListener('click', () => stepLightbox(-1));
    $('#lb-next').addEventListener('click', () => stepLightbox(1));
    $('#lb-move-prev').addEventListener('click', () => movePhoto(-1));
    $('#lb-move-next').addEventListener('click', () => movePhoto(1));
    $('#lb-download').addEventListener('click', downloadCurrent);
    $('#lb-delete').addEventListener('click', deleteCurrent);
    lb.caption.addEventListener('change', saveCaption);
    lb.el.addEventListener('click', e => {
      if (e.target === lb.el || e.target.classList.contains('lb-figure')) closeLightbox();
    });
    document.addEventListener('keydown', e => {
      if (lb.el.hidden) return;
      if (e.key === 'Escape') {
        if (document.activeElement === lb.caption) lb.caption.blur();
        closeLightbox();
        return;
      }
      if (document.activeElement === lb.caption) return;
      if (e.key === 'ArrowLeft') stepLightbox(-1);
      if (e.key === 'ArrowRight') stepLightbox(1);
    });

    // 미저장 기록 밀어넣기
    window.addEventListener('beforeunload', flushSaves);
    document.addEventListener('visibilitychange', () => { if (document.hidden) flushSaves(); });

    // 폰트 로드/창 크기 변화 후 textarea 높이 재계산
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { $$('textarea.note').forEach(autosize); fitTitle(); layoutTimelines(); }, 150);
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { $$('textarea.note').forEach(autosize); fitTitle(); layoutTimelines(); });
  }

  // ---------- 시작 ----------
  async function init() {
    buildStatic();
    bindEvents();
    setupNavHighlight();
    try {
      await loadData();
    } catch (err) {
      console.error(err);
      if (REMOTE) serverError = err.message || '';
      toast(REMOTE
        ? `사진 서버에 연결할 수 없어요 (${err.message}). 서버 PC 가 켜져 있는지 확인해 주세요.`
        : '브라우저 저장소를 열 수 없어요. 시크릿 모드이거나 저장소가 차단된 것 같아요.', 0);
    }
    renderAll();
    initMap();   // 온라인일 때만 지도가 뜬다. 실패해도 나머지는 그대로 동작.
  }

  // 콘솔/테스트용 (백업: TravelDiary.exportBackup() / TravelDiary.importBackup(file))
  window.TravelDiary = { addFiles, exportBackup, importBackup, locate, setActiveDay, reload, remote: REMOTE };

  init();
})();
