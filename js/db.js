/*
 * IndexedDB 래퍼
 * - photos  : { id, stopId, order, caption, createdAt, name, full(Blob), thumb(Blob), width, height }
 * - entries : { id, note, time, updatedAt }   id = stopId 또는 "memo:<dayId>"
 * - meta    : { key, ... }                     현재는 쓰지 않음 (예전 커버 사진용, 백업 호환을 위해 유지)
 */
const DB = (() => {
  'use strict';

  // 여행마다 저장소를 따로 쓴다 (js/itinerary.js 의 storageKey). 예전 도쿄 데이터는 'tokyo-diary' 에 그대로 남는다.
  const NAME = (typeof ITINERARY !== 'undefined' && ITINERARY.storageKey) || 'travel-diary';
  const VERSION = 1;
  const STORES = ['photos', 'entries', 'meta'];
  let opening = null;

  function open() {
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('이 브라우저는 IndexedDB를 지원하지 않습니다.'));
        return;
      }
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('photos')) {
          db.createObjectStore('photos', { keyPath: 'id' }).createIndex('stopId', 'stopId', { unique: false });
        }
        if (!db.objectStoreNames.contains('entries')) db.createObjectStore('entries', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      req.onerror = () => reject(req.error || new Error('IndexedDB를 열 수 없습니다.'));
      req.onblocked = () => reject(new Error('다른 탭이 저장소를 사용 중입니다.'));
    });
    opening.catch(() => { opening = null; });
    return opening;
  }

  // 트랜잭션 생성과 요청을 같은 틱에 처리해 자동 커밋 문제를 피한다.
  async function request(storeName, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const req = fn(tx.objectStore(storeName));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      tx.onabort = () => reject(tx.error || new Error('저장이 중단되었습니다.'));
    });
  }

  function done(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('저장이 중단되었습니다.'));
    });
  }

  return {
    getAllPhotos: () => request('photos', 'readonly', s => s.getAll()),
    putPhoto: photo => request('photos', 'readwrite', s => s.put(photo)),
    deletePhoto: id => request('photos', 'readwrite', s => s.delete(id)),

    getAllEntries: () => request('entries', 'readonly', s => s.getAll()),
    putEntry: entry => request('entries', 'readwrite', s => s.put(entry)),

    getAllMeta: () => request('meta', 'readonly', s => s.getAll()),
    getMeta: key => request('meta', 'readonly', s => s.get(key)),
    putMeta: item => request('meta', 'readwrite', s => s.put(item)),
    deleteMeta: key => request('meta', 'readwrite', s => s.delete(key)),

    async putPhotos(photos) {
      const db = await open();
      const tx = db.transaction('photos', 'readwrite');
      const store = tx.objectStore('photos');
      photos.forEach(p => store.put(p));
      return done(tx);
    },

    /** 저장된 모든 데이터를 지우고 백업 내용으로 교체한다. */
    async replaceAll({ photos = [], entries = [], meta = [] }) {
      const db = await open();
      const tx = db.transaction(STORES, 'readwrite');
      const p = tx.objectStore('photos');
      const e = tx.objectStore('entries');
      const m = tx.objectStore('meta');
      p.clear(); e.clear(); m.clear();
      photos.forEach(x => p.put(x));
      entries.forEach(x => e.put(x));
      meta.forEach(x => m.put(x));
      return done(tx);
    }
  };
})();
