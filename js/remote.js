/*
 * 서버 저장소 — js/itinerary.js 에 server 주소가 있을 때 IndexedDB(DB) 대신 쓴다.
 * DB 와 같은 메서드 이름을 가지며, 사진 객체의 full/thumb 는 Blob 대신 서버 파일 URL 문자열이다.
 * 서버 접속 키(X-Diary-Key)는 js/itinerary.js 의 serverKey 를 그대로 쓴다. 사용자에게 비밀번호를 묻지 않는다.
 * 이미지 주소에는 접속 키 대신 서버가 내려준 읽기 전용 파일 토큰이 들어간다.
 */
const RemoteStore = (() => {
  'use strict';

  let base = '';
  let trip = '';
  let key = '';
  let fileToken = '';
  const uploaded = new Set();            // 이번 세션에 서버로 올린 사진 id

  function configure(serverUrl, tripId, accessKey) {
    base = String(serverUrl).replace(/\/+$/, '');
    trip = tripId;
    key = String(accessKey || '').trim();
  }

  function fileUrl(id, kind) {
    return `${base}/files/${trip}/${id}${kind === 'thumb' ? '.thumb' : ''}.jpg?k=${encodeURIComponent(fileToken)}`;
  }
  const withUrls = meta => ({ ...meta, full: fileUrl(meta.id, 'full'), thumb: fileUrl(meta.id, 'thumb') });

  async function request(method, pathname, { body, headers = {} } = {}) {
    if (!key) throw Object.assign(new Error('서버 접속 키가 없어요 (js/itinerary.js 의 serverKey)'), { code: 'NO_KEY' });
    const init = { method, headers: { 'X-Diary-Key': key, ...headers }, body };
    if (typeof body === 'string' && new Blob([body]).size < 60000) init.keepalive = true;   // 페이지를 떠날 때도 저장되도록
    const res = await fetch(`${base}/api/${trip}/${pathname}`, init);
    if (res.status === 401) throw Object.assign(new Error('서버 접속 키가 맞지 않아요 (js/itinerary.js 의 serverKey 와 서버의 DIARY_KEY 확인)'), { code: 'UNAUTHORIZED' });
    if (res.status === 429) throw new Error('요청이 잠시 막혔어요. 몇 분 뒤 다시 시도해 주세요');
    if (!res.ok) {
      let msg = `서버 오류 (${res.status})`;
      try { msg = (await res.json()).error || msg; } catch { /* 본문 없음 */ }
      throw new Error(msg);
    }
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
