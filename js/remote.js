/*
 * 서버 저장소 — js/itinerary.js 에 server 주소가 있을 때 IndexedDB(DB) 대신 쓴다.
 * DB 와 같은 메서드 이름을 가지며, 사진 객체의 full/thumb 는 Blob 대신 서버 파일 URL 문자열이다.
 * 비밀번호(X-Diary-Key)는 주소의 #k=... 조각(링크)에서 읽어 localStorage 에 기억한다. 브라우저 대화상자는 띄우지 않고,
 * 비밀번호가 없거나 틀리면 NO_KEY / UNAUTHORIZED 오류를 던져 화면이 안내 문구와 입력 버튼을 보여주게 한다.
 * 이미지 주소에는 비밀번호 대신 서버가 내려준 읽기 전용 파일 토큰이 들어간다.
 */
const RemoteStore = (() => {
  'use strict';

  const KEY_RE = /^[\x21-\x7e]{16,}$/;   // 영문·숫자·기호 16자 이상 (서버와 같은 규칙)
  let base = '';
  let trip = '';
  let storageKey = 'diary.key';
  let key = '';
  let keyVerified = false;
  let fileToken = '';
  let asking = null;
  const uploaded = new Set();            // 이번 세션에 서버로 올린 사진 id

  function configure(serverUrl, tripId) {
    base = String(serverUrl).replace(/\/+$/, '');
    trip = tripId;
    storageKey = `diary.key:${trip}`;
    try { key = localStorage.getItem(storageKey) || ''; } catch { key = ''; }
    keyVerified = false;
    // 링크에 담긴 비밀번호: https://.../travel/#k=비밀번호 로 열면 저장하고 주소에서 지운다 (서버로는 전송되지 않는 조각).
    const m = /(?:^#|[#&])k=([^&]+)/.exec(location.hash || '');
    if (m) {
      const v = decodeURIComponent(m[1]).trim();
      if (KEY_RE.test(v)) { key = v; keyVerified = false; try { localStorage.setItem(storageKey, key); } catch { /* 저장 불가 환경 */ } }
      try { history.replaceState(null, '', location.pathname + location.search); } catch { /* 무시 */ }
    }
  }

  function fileUrl(id, kind) {
    return `${base}/files/${trip}/${id}${kind === 'thumb' ? '.thumb' : ''}.jpg?k=${encodeURIComponent(fileToken)}`;
  }
  const withUrls = meta => ({ ...meta, full: fileUrl(meta.id, 'full'), thumb: fileUrl(meta.id, 'thumb') });

  // 사용자가 버튼을 눌렀을 때만 비밀번호를 묻는다 (자동으로 대화상자를 띄우지 않는다).
  function askKey(message) {
    if (asking) return asking;
    asking = new Promise((resolve, reject) => {
      let v = window.prompt(message || '다이어리 비밀번호를 입력하세요 (영문·숫자 16자 이상, 이 기기에 기억됩니다)');
      if (v === null) { reject(Object.assign(new Error('비밀번호가 필요해요'), { code: 'NO_KEY' })); return; }
      v = v.trim();
      if (!KEY_RE.test(v)) { reject(Object.assign(new Error('비밀번호 형식이 아니에요 (영문·숫자·기호 16자 이상)'), { code: 'BAD_KEY' })); return; }
      key = v;
      keyVerified = false;
      resolve(key);
    });
    asking.finally(() => { asking = null; }).catch(() => {});
    return asking;
  }

  function remember() {
    if (keyVerified) return;
    keyVerified = true;
    try { localStorage.setItem(storageKey, key); } catch { /* 저장 불가 환경 */ }
  }

  async function request(method, pathname, { body, headers = {} } = {}) {
    if (!key) throw Object.assign(new Error('비밀번호가 필요해요'), { code: 'NO_KEY' });
    const init = { method, headers: { 'X-Diary-Key': key, ...headers }, body };
    if (typeof body === 'string' && new Blob([body]).size < 60000) init.keepalive = true;   // 페이지를 떠날 때도 저장되도록
    const res = await fetch(`${base}/api/${trip}/${pathname}`, init);
    if (res.status === 401) {
      keyVerified = false;
      throw Object.assign(new Error('비밀번호가 맞지 않아요'), { code: 'UNAUTHORIZED' });
    }
    if (res.status === 429) throw new Error('비밀번호 오류가 잦아 잠시 막혔어요. 몇 분 뒤 다시 시도해 주세요');
    if (!res.ok) {
      let msg = `서버 오류 (${res.status})`;
      try { msg = (await res.json()).error || msg; } catch { /* 본문 없음 */ }
      throw new Error(msg);
    }
    remember();
    const type = res.headers.get('content-type') || '';
    return type.includes('application/json') ? res.json() : res.text();
  }
  const json = (method, pathname, obj) =>
    request(method, pathname, { body: JSON.stringify(obj), headers: { 'Content-Type': 'application/json' } });

  async function state() {
    const s = await request('GET', 'state');
    if (typeof s.fileToken === 'string') fileToken = s.fileToken;
    return s;
  }

  return {
    configure,
    fileUrl,
    askKey,
    get hasKey() { return !!key; },
    forgetKey() { key = ''; keyVerified = false; asking = null; try { localStorage.removeItem(storageKey); } catch { /* 무시 */ } },

    async getAllPhotos() { return (await state()).photos.map(withUrls); },
    async getAllEntries() { return (await state()).entries; },
    async getAllMeta() { return []; },
    async getMeta() { return undefined; },
    async putMeta() { /* 서버 모드에서는 쓰지 않음 */ },
    async deleteMeta() { /* 서버 모드에서는 쓰지 않음 */ },

    async putPhoto(photo) {
      if (photo.full instanceof Blob && !uploaded.has(photo.id)) {
        // 썸네일을 먼저 올리고 원본+메타를 마지막에 올린다: 중간에 끊겨도 목록에 반쪽짜리 사진이 남지 않는다.
        if (photo.thumb instanceof Blob) {
          await request('PUT', `photos/${photo.id}`, { body: photo.thumb, headers: { 'Content-Type': 'image/jpeg', 'X-Kind': 'thumb' } });
        }
        const meta = {
          stopId: photo.stopId, order: photo.order, caption: photo.caption || '', createdAt: photo.createdAt,
          name: photo.name || '', width: photo.width, height: photo.height
        };
        await request('PUT', `photos/${photo.id}`, {
          body: photo.full,
          headers: { 'Content-Type': 'image/jpeg', 'X-Kind': 'full', 'X-Meta': encodeURIComponent(JSON.stringify(meta)) }
        });
        uploaded.add(photo.id);
      } else {
        await json('PATCH', `photos/${photo.id}`, { caption: photo.caption || '', order: photo.order });
      }
      return photo.id;
    },
    async putPhotos(list) {
      if (!list.length) return;
      const sorted = [...list].sort((a, b) => a.order - b.order);
      await json('PUT', 'order', { stopId: sorted[0].stopId, ids: sorted.map(p => p.id) });
    },
    deletePhoto: id => request('DELETE', `photos/${id}`),
    putEntry: e => json('PUT', `entries/${e.id}`, { note: e.note || '', time: e.time || '' }),

    // 백업 복원: 먼저 전부 올린 뒤, 백업에 없는 것만 지운다 (중간에 끊겨도 기존 데이터가 사라지지 않는다).
    async replaceAll({ photos = [], entries = [] }) {
      for (const p of photos) { uploaded.delete(p.id); await this.putPhoto(p); }
      for (const e of entries) await this.putEntry(e);
      await json('POST', 'prune', { keepPhotos: photos.map(p => p.id), keepEntries: entries.map(e => e.id) });
    }
  };
})();
